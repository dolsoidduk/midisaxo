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

    // If only one input is available, open it right away (home page only)
    if (isHomePageOpen && midiState.outputs.length === 1 && !isDevicePageOpen) {
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

const pingOutput = async (output: Output, inputs: Inputs[]) => {
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

    const handleInitialHandShake = (event: InputEventBase<"sysex">): void => {
      input = event.target;

      const valueSize = event.data.length === 7 ? 1 : 2;

      inputs.forEach((input: Input) => {
        input.removeListener("sysex", "all");
      });

      resolved = true;

      resolve({ input, output, isBootloaderMode, valueSize });
    };

    inputs.forEach((input: Input) => {
      input.removeListener("sysex", "all");
      input.addListener("sysex", "all", handleInitialHandShake);
    });

    // Send HandShake to find which input will reply
    output.sendSysex(openDeckManufacturerId, [0, 0, 1]);

    return delay(1000).then(() => {
      if (!resolved) {
        logger.error("INITIAL HANDSHAKE TIMED OUT, RETRYING");
        reject("TIMED OUT");
      }
    });
  }).catch(() => matchInputOutput(output.id));
};

export const matchInputOutput = async (
  outputId: string,
): Promise<InputOutputMatch> => {
  await loadMidi();

  const output = WebMidi.outputs.find((output: Output) => {
    return output.id === outputId;
  });
  if (!output) {
    return delay(250).then(() => matchInputOutput(outputId));
  }

  const inputs = WebMidi.inputs.filter(
    (input: Input) => input.name === output.name,
  );
  if (!inputs.length) {
    return delay(250).then(() => matchInputOutput(outputId));
  }

  return pingOutput(output, inputs);
};

export const loadMidi = async (): Promise<void> => {
  if (!WebMidi.supported) {
    return;
  }

  midiState.isWebMidiSupported = true;

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

const newMidiLoadPromise = async (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (WebMidi.enabled) {
      setConnectionState(MidiConnectionState.Open);
      return resolve();
    }

    setConnectionState(MidiConnectionState.Pending);
    WebMidi.enable(function (error) {
      if (error) {
        logger.error("Failed to load WebMidi", error);
        setConnectionState(MidiConnectionState.Closed);
        loadMidiPromise = (null as unknown) as Promise<void>;
        reject(error);
      } else {
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
  assignInputs: () => Promise<void>;
  matchInputOutput: (outputId: string) => Promise<InputOutputMatch>;
  startMidiConnectionWatcher: () => void;
  stopMidiConnectionWatcher: () => void;
}

export const midiStoreActions: IMidiActions = {
  loadMidi,
  matchInputOutput,
  assignInputs,
  findOutputById,
  startMidiConnectionWatcher,
  stopMidiConnectionWatcher,
};
