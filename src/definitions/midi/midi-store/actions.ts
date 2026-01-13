import WebMidi, { Input, Output } from "webmidi";
import { openDeckManufacturerId } from "../../../definitions";
import { logger, delay } from "../../../util";
import router from "../../../router";

import { MidiConnectionState } from "./interface";
import { midiState } from "./state";
import { isConnected, isConnecting } from "./computed";

// Local states

let loadMidiPromise = (null as unknown) as Promise<void>;

let connectionWatcherTimer = null;

// Helpers

const HANDSHAKE_TIMEOUT_MS = 1000;
const MATCH_RETRY_DELAY_MS = 250;
const MAX_MATCH_ATTEMPTS = 10;

const dumpMidiPorts = (tag: string): void => {
  if (!WebMidi.supported) {
    logger.warn(`[MIDI] ${tag}: WebMIDI not supported by this browser`);
    return;
  }

  if (!WebMidi.enabled) {
    logger.warn(`[MIDI] ${tag}: WebMIDI not enabled yet`);
    return;
  }

  const summarize = (port: Input | Output) => {
    // webmidi may not provide manufacturer on some platforms
    const manufacturer = (port as any)?.manufacturer ?? "(unknown manufacturer)";
    const state = (port as any)?.state ?? "(unknown state)";

    return {
      id: port.id,
      name: port.name,
      manufacturer,
      state,
    };
  };

  logger.log(`[MIDI] ${tag}: inputs=${WebMidi.inputs.length} outputs=${WebMidi.outputs.length}`);
  logger.log("[MIDI] inputs", WebMidi.inputs.map(summarize));
  logger.log("[MIDI] outputs", WebMidi.outputs.map(summarize));

  // Persist raw port list for UI diagnostics (DeviceSelect).
  try {
    midiState.rawInputs = WebMidi.inputs.map(summarize);
    midiState.rawOutputs = WebMidi.outputs.map(summarize);
  } catch (_) {
    // ignore
  }

  const names = [...WebMidi.inputs.map((i) => i.name), ...WebMidi.outputs.map((o) => o.name)];
  const hasOnlyGenericThrough =
    names.length > 0 && names.every((name) => /\bmidi\s*(thru|through)\b/i.test(name));

  if (hasOnlyGenericThrough) {
    logger.warn(
      "[MIDI] Only 'MIDI Through' ports detected. This usually means the OS/browser does not see your USB-MIDI device. UI filtering is not the cause.",
    );
  }
};

const setConnectionState = (value: MidiConnectionState): void => {
  midiState.connectionState = value;
};

const connectionWatcher = async (): Promise<void> => {
  stopMidiConnectionWatcher();

  // Avoid racing with explicit reloads (disable/enable).
  if (midiState.isReloading) {
    connectionWatcherTimer = setTimeout(connectionWatcher, 500);
    return;
  }

  try {
    if (!isConnected() && !isConnecting()) {
      await loadMidi();
    }

    assignInputs();

    const currentRouteName = router.currentRoute.value.name;
    const isDevicePageOpen = router.currentRoute.value.matched.some(
      (r) => r.name === "device",
    );
    const isHomePageOpen = currentRouteName === "home";
    const isDeviceSelectMode = router.currentRoute.value.query?.select === "1";

    // If only one output is available, open it right away (home page only)
    // unless user explicitly entered "device select" mode.
    if (
      isHomePageOpen &&
      !isDeviceSelectMode &&
      midiState.outputs.length === 1 &&
      !isDevicePageOpen
    ) {
      // Avoid redirecting to unrelated MIDI devices when device name doesn't
      // include "OpenDeck" (some setups may list multiple generic MIDI outputs).
      if (!midiState.outputs[0].name.includes("OpenDeck")) {
        return;
      }

      // Redirect directly to FW page to prevent global section clogging msg stack
      const name = midiState.outputs[0].name.includes("OpenDeck DFU")
        ? "device-firmware-update"
        : "device";

      router.push({
        name,
        params: {
          outputId: midiState.outputs[0].id,
        },
      });
    }
  } catch (err) {
    logger.error("MIDI Connection watcher error", err);
  }

  connectionWatcherTimer = setTimeout(connectionWatcher, 500);
};

const startMidiConnectionWatcher = (): Promise<void> => connectionWatcher();

const stopMidiConnectionWatcher = (): Promise<void> => {
  if (connectionWatcherTimer) {
    clearTimeout(connectionWatcherTimer);
    connectionWatcherTimer = null;
  }
};

export const assignInputs = async (): Promise<void> => {
  if (!WebMidi.supported || !WebMidi.enabled) {
    midiState.inputs = [];
    midiState.outputs = [];
    midiState.rawInputs = [];
    midiState.rawOutputs = [];
    return;
  }

  dumpMidiPorts("assignInputs (raw)");

  // Prefer OpenDeck-named devices, but fall back to listing all MIDI devices.
  // Some custom targets/platforms expose a different USB MIDI name even though
  // the device speaks the OpenDeck SysEx protocol.
  const isGenericThroughPort = (name: string): boolean =>
    /\bmidi\s*(thru|through)\b/i.test(name);

  const nonBleInputs = WebMidi.inputs.filter(
    (input: Input) => !input.name.includes("BLE"),
  );
  const nonBleOutputs = WebMidi.outputs.filter(
    (output: Output) => !output.name.includes("BLE"),
  );

  // Hide MIDI Through only when there are other real ports available.
  const inputs = nonBleInputs.filter(
    (input: Input) => !isGenericThroughPort(input.name),
  );
  const outputs = nonBleOutputs.filter(
    (output: Output) => !isGenericThroughPort(output.name),
  );

  const openDeckInputs = inputs.filter((input: Input) =>
    input.name.includes("OpenDeck"),
  );
  const openDeckOutputs = outputs.filter((output: Output) =>
    output.name.includes("OpenDeck"),
  );

  midiState.inputs = openDeckInputs.length
    ? openDeckInputs
    : inputs.length
      ? inputs
      : nonBleInputs;

  midiState.outputs = openDeckOutputs.length
    ? openDeckOutputs
    : outputs.length
      ? outputs
      : nonBleOutputs;

  logger.log("[MIDI] assignInputs (selected)", {
    inputs: midiState.inputs.map((i) => ({ id: i.id, name: i.name })),
    outputs: midiState.outputs.map((o) => ({ id: o.id, name: o.name })),
  });
};

// Actions

export const findOutputById = (outputId: string): Output => {
  return WebMidi.outputs.find((output: Output) => output.id === outputId);
};

const pingOutputOnce = async (output: Output, inputs: Array<Input>) => {
  return new Promise((resolve, reject) => {
    let input;
    let resolved = false;

    // When device is in Bootloader mode, it's name will contain "DFU"
    const isBootloaderMode = output.name.includes("OpenDeck DFU");
    if (isBootloaderMode) {
      input = inputs.find((input: Input) =>
        input.name.includes("OpenDeck DFU"),
      );

      resolved = true;

      return resolve({ input, output, isBootloaderMode });
    }

    const cleanupListeners = (): void => {
      inputs.forEach((input: Input) => {
        input.removeListener("sysex", "all");
      });
    };

    const handleInitialHandShake = (event: InputEventBase<"sysex">): void => {
      // Only accept replies that belong to the OpenDeck SysEx namespace.
      // Otherwise, any random SysEx message from another device could be mistaken
      // as the handshake response, causing us to bind the wrong input and then
      // time out on GetValueSize / other requests.
      const data = event.data;
      if (
        !data ||
        data.length < 6 ||
        data[1] !== openDeckManufacturerId[0] ||
        data[2] !== openDeckManufacturerId[1] ||
        data[3] !== openDeckManufacturerId[2]
      ) {
        return;
      }

      input = event.target;

      const valueSize = event.data.length === 7 ? 1 : 2;

      cleanupListeners();

      resolved = true;

      resolve({ input, output, isBootloaderMode, valueSize });
    };

    inputs.forEach((input: Input) => {
      input.removeListener("sysex", "all");
      input.addListener("sysex", "all", handleInitialHandShake);
    });

    // Send HandShake to find which input will reply
    try {
      output.sendSysex(openDeckManufacturerId, [0, 0, 1]);
    } catch (err) {
      cleanupListeners();
      return reject(err);
    }

    return delay(HANDSHAKE_TIMEOUT_MS).then(() => {
      if (!resolved) {
        cleanupListeners();
        reject(new Error("HANDSHAKE_TIMED_OUT"));
      }
    });
  });
};

export const matchInputOutput = async (
  outputId: string,
  attempt = 0,
): Promise<InputOutputMatch> => {
  await loadMidi();

  const output = WebMidi.outputs.find((output: Output) => {
    return output.id === outputId;
  });
  if (!output) {
    if (attempt >= MAX_MATCH_ATTEMPTS) {
      throw new Error("출력 포트를 찾을 수 없습니다. 장치를 다시 연결한 뒤 재시도해주세요.");
    }
    return delay(MATCH_RETRY_DELAY_MS).then(() => matchInputOutput(outputId, attempt + 1));
  }

  const allInputs = WebMidi.inputs;
  if (!allInputs.length) {
    if (attempt >= MAX_MATCH_ATTEMPTS) {
      throw new Error("입력 포트를 찾을 수 없습니다. WebMIDI 입력이 노출되는지 확인해주세요.");
    }
    return delay(MATCH_RETRY_DELAY_MS).then(() => matchInputOutput(outputId, attempt + 1));
  }

  // Some platforms expose different names for input vs output ports.
  // Prefer strict name match first, but fall back to a broader search and rely
  // on the SysEx handshake to identify the correct input.
  const exactNameInputs = allInputs.filter((input: Input) => input.name === output.name);
  const fuzzyNameInputs = allInputs.filter(
    (input: Input) =>
      input.name.includes(output.name) || output.name.includes(input.name),
  );

  const outputManufacturer = (output as any)?.manufacturer;
  const manufacturerInputs = outputManufacturer
    ? allInputs.filter((input: Input) => (input as any)?.manufacturer === outputManufacturer)
    : [];

  const inputs = exactNameInputs.length
    ? exactNameInputs
    : fuzzyNameInputs.length
      ? fuzzyNameInputs
      : manufacturerInputs.length
        ? manufacturerInputs
        : allInputs;

  if (!exactNameInputs.length) {
    logger.warn(
      "[MIDI] Input/output name mismatch; using handshake-based matching",
      {
        output: { id: output.id, name: output.name, manufacturer: outputManufacturer },
        candidateInputs: inputs.map((i) => ({
          id: i.id,
          name: i.name,
          manufacturer: (i as any)?.manufacturer,
        })),
      },
    );
  }

  try {
    return await pingOutputOnce(output, inputs);
  } catch (err) {
    if (attempt < MAX_MATCH_ATTEMPTS) {
      logger.warn("[MIDI] Initial handshake failed; retrying", {
        attempt: attempt + 1,
        error: (err as any)?.message ?? String(err),
      });
      return delay(MATCH_RETRY_DELAY_MS).then(() => matchInputOutput(outputId, attempt + 1));
    }

    const msg =
      "장치와 SysEx 핸드셰이크에 실패했습니다.\n" +
      "- OpenDeck가 펌웨어 실행 중인지 확인\n" +
      "- 다른 MIDI 프로그램(DAW 등) 점유 해제\n" +
      "- 오프라인 앱이라면 NO_SANDBOX=1 로 실행\n" +
      "- 케이블/포트 변경 후 재시도";
    const finalErr = new Error(msg);
    (finalErr as any).code = "HANDSHAKE";
    throw finalErr;
  }
};

export const loadMidi = async (): Promise<void> => {
  midiState.isWebMidiSupported = WebMidi.supported;
  if (!WebMidi.supported) {
    midiState.lastEnableError = "이 브라우저/환경에서는 WebMIDI를 지원하지 않습니다.";
    return;
  }

  if (loadMidiPromise) {
    return loadMidiPromise;
  }
  if (WebMidi.enabled) {
    setConnectionState(MidiConnectionState.Open);
    return;
  }

  loadMidiPromise = newMidiLoadPromise();

  return loadMidiPromise;
};

export const reloadMidi = async (): Promise<void> => {
  midiState.isWebMidiSupported = WebMidi.supported;
  if (!WebMidi.supported) {
    midiState.lastEnableError = "이 브라우저/환경에서는 WebMIDI를 지원하지 않습니다.";
    return;
  }
  midiState.lastEnableError = null;
  midiState.lastRescanAt = Date.now();
  midiState.isReloading = true;

  // Pause the watcher to prevent concurrent loadMidi()/assignInputs() calls.
  stopMidiConnectionWatcher();

  try {
    // webmidi.js keeps its own internal state; to truly re-enumerate ports,
    // we need to disable and enable again.
    if (WebMidi.enabled) {
      try {
        WebMidi.disable();
      } catch (_) {
        // ignore
      }

      // Give Chromium a moment to tear down the MIDI backend.
      await delay(100);
    }

    loadMidiPromise = (null as unknown) as Promise<void>;
    await newMidiLoadPromise();
  } finally {
    midiState.isReloading = false;
    await assignInputs();

    // Resume watcher after a manual rescan.
    startMidiConnectionWatcher();
  }
};

const newMidiLoadPromise = async (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (WebMidi.enabled) {
      setConnectionState(MidiConnectionState.Open);
      return resolve();
    }

    // WebMIDI in Chromium requires a secure context (https) except for localhost.
    // When served via a LAN IP (http://192.168.x.x), WebMidi.enable may fail with
    // a vague error; make it explicit for the user.
    try {
      const win = window as any;
      const isSecure = Boolean(win?.isSecureContext);
      const host = String(win?.location?.hostname ?? "");
      const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
      if (!isSecure && !isLocalhost) {
        const msg =
          "WebMIDI는 보안 컨텍스트(https)에서만 동작합니다. localhost(127.0.0.1)로 접속하거나 https로 제공하세요.";
        midiState.lastEnableError = msg;
        setConnectionState(MidiConnectionState.Closed);
        loadMidiPromise = (null as unknown) as Promise<void>;
        return reject(new Error(msg));
      }
    } catch (_) {
      // ignore
    }

    setConnectionState(MidiConnectionState.Pending);
    WebMidi.enable(function (error) {
      if (error) {
        logger.error("Failed to load WebMidi", error);
        midiState.lastEnableError =
          (error as any)?.message ?? (typeof error === "string" ? error : String(error));
        setConnectionState(MidiConnectionState.Closed);
        loadMidiPromise = (null as unknown) as Promise<void>;
        reject(error);
      } else {
        midiState.lastEnableError = null;
        dumpMidiPorts("WebMidi.enable (success)");
        assignInputs();
        setConnectionState(MidiConnectionState.Open);
        loadMidiPromise = (null as unknown) as Promise<void>;
        return resolve();
      }
    }, true);
  });

// Export

interface InputOutputMatch {
  input: Input;
  output: Output;
  isBootloaderMode: number;
  valueSize: number;
}

export interface IMidiActions {
  loadMidi: () => Promise<void>;
  reloadMidi: () => Promise<void>;
  assignInputs: () => Promise<void>;
  matchInputOutput: (outputId: string) => Promise<InputOutputMatch>;
  startMidiConnectionWatcher: () => void;
  stopMidiConnectionWatcher: () => void;
}

export const midiStoreActions: IMidiActions = {
  loadMidi,
  reloadMidi,
  matchInputOutput,
  assignInputs,
  findOutputById,
  startMidiConnectionWatcher,
  stopMidiConnectionWatcher,
};
