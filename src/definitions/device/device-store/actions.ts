import semverGt from "semver/functions/gt";
import marked from "marked";
import { Input, Output } from "webmidi";
import FileSaver from "file-saver";
import { logger, delay, arrayEqual, convertToHex } from "../../../util";
import { Request } from "../../../definitions";
import router from "../../../router";
import {
  Request,
  ISectionDefinition,
  SectionType,
  Block,
  BlockMap,
  IOpenDeckRelease,
  GitHubReleasesUrl,
  getBoardDefinition,
} from "../../../definitions";
import {
  sendMessagesFromFileWithDelay,
  newLineCharacter,
} from "./actions-utility";
import { midiStore } from "../../midi";
import {
  IDeviceState,
  IRequestConfig,
  DeviceConnectionState,
  ControlDisableType,
} from "./interface";
import { ErrorCode, getErrorDefinition } from "../../error";
import { deviceState, defaultState, IViewSettingState } from "./state";
import { sendMessage, handleSysExEvent, resetQueue } from "./request-qeueue";
import {
  attachMidiEventHandlers,
  detachMidiEventHandlers,
} from "./midi-event-handlers";

let connectionWatcherTimer = null;

// Actions

const isControlDisabled = (def: ISectionDefinition): ControlDisableType =>
  deviceState.unsupportedComponents[def.block][def.key];

export const disableControl = (
  def: ISectionDefinition,
  type: ControlDisableType,
): void =>
  (deviceState.unsupportedComponents[def.block][def.key] = type || !type);

const resetDeviceStore = async (): void => {
  resetQueue();

  if (deviceState.input) {
    deviceState.input.removeListener("sysex", "all"); // make sure we don't duplicate listeners
    detachMidiEventHandlers(deviceState.input);
  }

  const lastConnectionError = deviceState.lastConnectionError;
  const lastRequestErrorContext = deviceState.lastRequestErrorContext;
  Object.assign(deviceState, defaultState);
  deviceState.lastConnectionError = lastConnectionError;
  deviceState.lastRequestErrorContext = lastRequestErrorContext;
};

const setInfo = (data: Partial<IDeviceState>): void => {
  Object.assign(deviceState, data);
};

export const setViewSetting = (
  block: Block,
  setting: IViewSettingState,
): void => {
  // Reset page if changing paging options
  if (
    setting.itemsPerPage &&
    setting.itemsPerPage !== deviceState.viewSettings[block].itemsPerPage
  ) {
    deviceState.viewSettings[block].currentPage = 1;
  }
  Object.assign(deviceState.viewSettings[block], setting);
};

const connectionWatcher = async (): Promise<void> => {
  stopDeviceConnectionWatcher();

  try {
    if (!deviceState.outputId) {
      return router.push({ name: "home" });
    }

    const output = await midiStore.actions.findOutputById(deviceState.outputId);
    if (!output) {
      return router.push({ name: "home" });
    }
  } catch (err) {
    logger.error("Device connection watcher error", err);
    return router.push({ name: "home" });
  }

  connectionWatcherTimer = setTimeout(() => connectionWatcher(), 1000);
};

const startDeviceConnectionWatcher = (): Promise<void> =>
  // Prevent connection watcher from causing duplicate redirects on reconnect
  delay(5000).then(connectionWatcher);

const stopDeviceConnectionWatcher = (): Promise<void> => {
  if (connectionWatcherTimer) {
    clearTimeout(connectionWatcherTimer);
    connectionWatcherTimer = null;
  }
};

export const connectDeviceStoreToInput = async (
  outputId: string,
): Promise<any> => {
  const matched = await midiStore.actions.matchInputOutput(outputId);
  const { input, output, isBootloaderMode, valueSize } = matched;

  deviceState.isBootloaderMode = isBootloaderMode;
  deviceState.outputId = outputId;
  deviceState.input = input as Input;
  deviceState.output = output as Output;
  // Start from handshake-derived valueSize if available; we'll query the real valueSize from the board.
  // Some firmware variants may not reply to GetValueSize; in that case we fall back to the handshake.
  deviceState.valueSize = valueSize || 1;
  deviceState.valuesPerMessageRequest = null;
  deviceState.firmwareVersion = null;

  // make sure we don't duplicate listeners
  deviceState.input.removeListener("sysex", "all");
  deviceState.input.addListener("sysex", "all", handleSysExEvent);
  detachMidiEventHandlers(deviceState.input);
  attachMidiEventHandlers(deviceState.input);

  // In bootloader mode, we cannot send regular requests
  if (isBootloaderMode) {
    deviceState.boardName = output.name;
    deviceState.connectionState = DeviceConnectionState.Open;
    deviceState.connectionPromise = (null as unknown) as Promise<any>;
    startDeviceConnectionWatcher();
    return;
  }

  // Determine protocol value size (1-byte vs 2-byte) first.
  // If it times out, keep the handshake-derived valueSize.
  try {
    await sendMessage({
      command: Request.GetValueSize,
      handler: (valueSize: number) => setInfo({ valueSize }),
    });
  } catch (err) {
    // UI_QUEUE_REQ_TIMED_OUT / HANDSHAKE can happen on some targets; continue with fallback.
    logger.warn("[Device] GetValueSize failed; continuing with fallback valueSize", {
      err,
      fallbackValueSize: deviceState.valueSize,
    });
  }

  // Determine how many values the device can return per request.
  // Some custom/older firmware variants don't implement this request.
  // If it times out, fall back to 1 and continue.
  try {
    await sendMessage({
      command: Request.GetValuesPerMessage,
      handler: (valuesPerMessageRequest: number) =>
        setInfo({ valuesPerMessageRequest }),
    });
  } catch (err) {
    setInfo({ valuesPerMessageRequest: 1 });
    logger.warn(
      "[Device] GetValuesPerMessage failed; continuing with fallback valuesPerMessageRequest",
      {
        err,
        fallbackValuesPerMessageRequest: deviceState.valuesPerMessageRequest,
      },
    );
  }
  // Firmware version is useful but not strictly required to open the UI.
  // Some custom targets may not implement this custom request.
  try {
    await sendMessage({
      command: Request.GetFirmwareVersion,
      handler: (firmwareVersion: string) => setInfo({ firmwareVersion }),
    });
  } catch (err) {
    // Keep a sane semver-like value to avoid breaking semver comparisons.
    setInfo({ firmwareVersion: "v0.0.0" });
    logger.warn("[Device] GetFirmwareVersion failed; continuing with fallback firmwareVersion", {
      err,
      fallbackFirmwareVersion: deviceState.firmwareVersion,
    });
  }
  deviceState.connectionState = DeviceConnectionState.Open;
  deviceState.connectionPromise = (null as unknown) as Promise<any>;
  startDeviceConnectionWatcher();

  // These requests won't run until connection promise is finished.
  // They are best-effort: missing responses shouldn't prevent UI entry.
  try {
    await loadDeviceInfo();
  } catch (err) {
    logger.warn("[Device] loadDeviceInfo failed; continuing", err);
  }

  scheduleDeviceInfoRetry();
};

const connectDevice = async (outputId: string): Promise<void> => {
  if (typeof outputId !== "string") {
    throw new Error("MISSING OR INVALID DEVICE OUTPUT ID");
  }

  if (deviceState.connectionPromise) {
    return deviceState.connectionPromise;
  }
  deviceState.connectionState = DeviceConnectionState.Pending;
  deviceState.lastConnectionError = null;
  deviceState.lastRequestErrorContext = null;

  // All subsequent connect attempts should receive the same promise as response
  deviceState.connectionPromise = connectDeviceStoreToInput(outputId).catch(
    (err) => {
      const message =
        typeof err === "number"
          ? getErrorDefinition(err as ErrorCode).description
          : (err as any)?.message ??
            (typeof err === "string" ? err : String(err));
      deviceState.connectionState = DeviceConnectionState.Closed;
      deviceState.connectionPromise = (null as unknown) as Promise<any>;
      const ctx = deviceState.lastRequestErrorContext
        ? `\n${deviceState.lastRequestErrorContext}`
        : "";
      deviceState.lastConnectionError =
        (message || "장치 연결에 실패했습니다. (SysEx 핸드셰이크 실패)") + ctx;
      throw err;
    },
  );

  return deviceState.connectionPromise;
};

export const closeConnection = (): Promise<void> => {
  stopDeviceConnectionWatcher();
  resetDeviceStore();
};

export const clearLastConnectionError = (): void => {
  deviceState.lastConnectionError = null;
  deviceState.lastRequestErrorContext = null;
};

export const ensureConnection = async (): Promise<void> => {
  if (deviceState.connectionState === DeviceConnectionState.Open) {
    return;
  }

  if (deviceState.connectionPromise) {
    return deviceState.connectionPromise;
  }

  if (deviceState.outputId) {
    return connectDevice(deviceState.outputId);
  }

  throw new Error("CANNOT ENSURE CONNECTION, MISSING outputId");
};

// Firmware updates

export const startBootLoaderMode = async (): Promise<void> => {
  await sendMessage({
    command: Request.BootloaderMode,
    handler: () => logger.log("Bootloader mode started"),
  });
};

const startFirmwareUpdate = async (file: File): Promise<void> => {
  resetQueue();

  const success = await sendMessagesFromFileWithDelay(
    file,
    Request.FirmwareUpdate,
  );

  deviceState.isSystemOperationRunning = false;

  const msg = success
    ? "Firmware update finished"
    : "Firmware update finished with errors";
  alert(msg);
};

export const startUpdatesCheck = async (
  firmwareFileName?: string,
): Promise<Array<IOpenDeckRelease>> => {
  const releases = await fetch(GitHubReleasesUrl).then((response) =>
    response.json(),
  );

  const currentVersion = deviceState.firmwareVersion;

  return releases
    .filter(
      (release) =>
        release.name.length && semverGt(release.name, currentVersion),
    )
    .map((release) => ({
      html_description: marked(release.body, { headerIds: false }),
      firmwareFileLink: release.assets.find(
        (asset) => asset.name === firmwareFileName,
      ),
      ...release,
    }));
};

// Backup

const startRestore = async (file: File): Promise<void> => {
  await sendMessagesFromFileWithDelay(file, Request.RestoreBackup);

  deviceState.isSystemOperationRunning = false;

  alert(
    "Restoring from backup finished. The board will now reboot and apply the parameters. This can take up to 30 seconds.",
  );
};

const startBackup = async (): Promise<void> => {
  let receivedCount = 0;
  let firstResponse = null;
  const backupData = [];

  const handler = (data) => {
    if (!receivedCount) {
      firstResponse = data;
    }

    // Note: first and ast messages are identical signals
    const isLastMessage = receivedCount && arrayEqual(firstResponse, data);
    const isFirstMessage = receivedCount === 0;

    receivedCount = receivedCount + 1;
    if (!isFirstMessage && !isLastMessage) {
      backupData.push(data.map(convertToHex).join(" "));
    }

    if (isLastMessage) {
      const blob = new Blob([backupData.join(newLineCharacter)], {
        type: "text/plain;charset=utf-8",
      });

      const timeString = new Date()
        .toISOString()
        .slice(0, -8)
        .replace(":", "-")
        .replace("T", "-");

      FileSaver.saveAs(blob, `OpenDeckUI-Backup-${timeString}.sysex`);
    }

    // Signal End of broadcast when response is identical to the first one
    return isLastMessage;
  };

  sendMessage({
    command: Request.Backup,
    handler,
  }).catch((error) => logger.error("Failed to read component config", error));
};

// Other hardware

export const startFactoryReset = async (): Promise<void> => {
  const handler = () => logger.log("Bootloader mode started");
  await sendMessageAndRebootUi(Request.FactoryReset, handler);
};

export const startReboot = async (): Promise<void> => {
  const handler = () => logger.log("Reboot mode started");
  await sendMessageAndRebootUi(Request.Reboot, handler);
};

const sendMessageAndRebootUi = async (
  command: Request,
  handler: () => void,
): Promise<any> => {
  await sendMessage({
    command,
    handler,
  });

  deviceState.connectionState = DeviceConnectionState.Closed;

  return delay(200).then(() => router.push({ name: "home" }));
};

const loadDeviceInfo = async (): Promise<void> => {
  try {
    await sendMessage({
      command: Request.IdentifyBoard,
      handler: (value: number[]) => {
        const board = getBoardDefinition(value);
        const boardName = (board && board.name) || "Custom OpenDeck board";
        const firmwareFileName = board && board.firmwareFileName;

        setInfo({ boardName, firmwareFileName });
      },
    });
  } catch (err) {
    logger.warn("[Device] IdentifyBoard failed; continuing", err);
  }

  try {
    await sendMessage({
      command: Request.GetNumberOfSupportedComponents,
      handler: (numberOfComponents: array[]) => setInfo({ numberOfComponents }),
    });
  } catch (err) {
    logger.warn("[Device] GetNumberOfSupportedComponents failed; continuing", err);
  }
  try {
    if (deviceState.valueSize === 2) {
      await sendMessage({
        command: Request.GetBootLoaderSupport,
        handler: (bootLoaderSupport: string) => setInfo({ bootLoaderSupport }),
      });
    }
  } catch (err) {
    logger.error(
      "Error while checking for bootloader support, setting to false",
      err,
    );
    setInfo({ bootLoaderSupport: false });
  }

  try {
    await sendMessage({
      command: Request.GetNumberOfSupportedPresets,
      handler: (supportedPresetsCount: number) =>
        setInfo({ supportedPresetsCount }),
    });
  } catch (err) {
    logger.warn("[Device] GetNumberOfSupportedPresets failed; continuing", err);
    setInfo({ supportedPresetsCount: 0 as any });
  }
};

const hasAnyComponentCounts = (): boolean => {
  try {
    const counts: any = deviceState.numberOfComponents;
    if (!counts) {
      return false;
    }

    return Object.values(counts).some(
      (v: any) => typeof v === "number" && Number.isFinite(v) && v > 0,
    );
  } catch (_) {
    return false;
  }
};

const scheduleDeviceInfoRetry = (): void => {
  // If the device didn't respond during connect, retry a few times in the background.
  // This avoids a "blank components" UI when responses arrive late.
  if (hasAnyComponentCounts()) {
    return;
  }

  const delays = [1000, 3000, 6000];
  delays.forEach((ms) => {
    setTimeout(async () => {
      try {
        if (deviceState.connectionState !== DeviceConnectionState.Open) {
          return;
        }

        await sendMessage({
          command: Request.GetNumberOfSupportedComponents,
          handler: (numberOfComponents: array[]) => setInfo({ numberOfComponents }),
        });
      } catch (err) {
        // keep silent; we'll either succeed later or stay in "unknown" mode
        logger.warn("[Device] Background component-count retry failed", err);
      }
    }, ms);
  });
};

// Section / Component values

const filterSectionsByType = (
  sectionDef: ISectionDefinition,
  type: SectionType,
) => sectionDef.type === type;

const filterOutDisabledSections = (sectionDef: ISectionDefinition) =>
  !isControlDisabled(sectionDef);

const filterOutMsbSections = (sectionDef: ISectionDefinition) =>
  deviceState.valueSize === 1 || !sectionDef.isMsb;

const UI_VALUE_READ_TIMEOUT_MS = 1200;

export const getFilteredSectionsForBlock = (
  block: Block,
  sectionType: SectionType,
): ISectionDefinition[] => {
  if (!BlockMap[block]) {
    throw new Error(`Block definition not found in BlockMap ${block}`);
  }

  const { sections } = BlockMap[block];

  return Object.values(sections)
    .filter((sectionDef) => filterSectionsByType(sectionDef, sectionType))
    .filter(filterOutDisabledSections)
    .filter(filterOutMsbSections);
};

export const getComponentSettings = async (
  block: Block,
  sectionType: SectionType,
  componentIndex?: number,
): Promise<any> => {
  await ensureConnection();
  const settings = {} as any;

  // Load sequentially and fail-fast.
  // If a device/target doesn't respond to GetValue, the old code would enqueue
  // dozens of requests; even with per-request timeouts, the UI would look frozen
  // while the queue slowly timed out one-by-one.
  const sectionDefs = getFilteredSectionsForBlock(block, sectionType);
  const maxConsecutiveFailures = 1;
  let consecutiveFailures = 0;

  for (const sectionDef of sectionDefs) {
    const { key, section, onLoad, settingIndex } = sectionDef;
    const index =
      typeof componentIndex === "number" ? componentIndex : settingIndex;

    const handler = (res: number[]): void => {
      const val = res[0];
      settings[key] = val;
      if (onLoad) {
        onLoad(val);
      }
    };

    try {
      await sendMessage({
        command: Request.GetValue,
        handler,
        config: { block, section, index },
        timeoutMs: UI_VALUE_READ_TIMEOUT_MS,
      });
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      logger.error("Failed to read component config", error);

      if (consecutiveFailures >= maxConsecutiveFailures) {
        break;
      }
    }
  }

  return settings;
};

export const setComponentSectionValue = async (
  config: IRequestConfig,
  handler: (val: any) => void,
): Promise<void> =>
  sendMessage({
    command: Request.SetValue,
    handler,
    config,
  });

export const getSectionValues = async (
  block: Block,
): Promise<Record<string, number[]>> => {
  await ensureConnection();
  const settings = {} as any;

  const sectionDefs = getFilteredSectionsForBlock(block, SectionType.Value);
  const maxConsecutiveFailures = 1;
  let consecutiveFailures = 0;

  for (const sectionDef of sectionDefs) {
    const { key, section } = sectionDef;

    const handler = (res: number[]): void => {
      if (!settings[key]) {
        settings[key] = [];
      }
      settings[key].push(...res);
      return false;
    };

    try {
      await sendMessage({
        command: Request.GetSectionValues,
        handler,
        config: { block, section },
        timeoutMs: UI_VALUE_READ_TIMEOUT_MS,
      });
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      logger.error("Failed to read component config", error);
      if (consecutiveFailures >= maxConsecutiveFailures) {
        break;
      }
    }
  }

  return settings;
};

// Export

export const deviceStoreActions = {
  setInfo,
  setViewSetting,
  connectDevice,
  closeConnection,
  clearLastConnectionError,
  ensureConnection,
  startUpdatesCheck,
  startBootLoaderMode,
  startFactoryReset,
  startReboot,
  startDeviceConnectionWatcher,
  stopDeviceConnectionWatcher,
  startFirmwareUpdate,
  isControlDisabled,
  disableControl,
  startBackup,
  startRestore,
  getComponentSettings,
  setComponentSectionValue,
  getSectionValues,
  getFilteredSectionsForBlock,
};

export type IDeviceActions = typeof deviceStoreActions;
