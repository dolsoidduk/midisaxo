import { LogType, ILogEntryBase, state } from "./state";
import { addBuffered } from "./actions";
import { convertToHexString, ensureString } from "../../../util";

export type MidiEventType =
  | "noteon"
  | "noteoff"
  | "controlchange"
  | "programchange"
  | "pitchbend"
  | "sysex"
  | "clock"
  | "start"
  | "continue"
  | "stop"
  | "activesensing"
  | "mmcstop"
  | "mmcplay"
  | "mmcsrecordstart"
  | "mmcsrecordstop"
  | "mmcspause"
  | "reset";

export const MidiEventTypeLabel = {
  noteon: "Note On",
  noteoff: "Note Off",
  controlchange: "Control Change",
  programchange: "Program Change",
  pitchbend: "Pitch Bend",
  sysex: "SysEx",
  clock: "RealTime: Clock",
  start: "RealTime: Start",
  continue: "RealTime: Continue",
  stop: "RealTime: Stop",
  activesensing: "RealTime: Active Sensing",
  reset: "RealTime: Reset",
  mmcstop: "MMC Stop",
  mmcplay: "MMC Play",
  mmcrecordstart: "MMC Record Start",
  mmcrecordstop: "MMC Record Stop",
  mmcpause: "MMC Pause",
};

export const MidiEventTypeMMC = {
  1: "mmcstop",
  2: "mmcplay",
  6: "mmcrecordstart",
  7: "mmcrecordstop",
  9: "mmcpause",
};

export const MidiRealtimeEvent = [
  "clock",
  "start",
  "continue",
  "stop",
  "activesensing",
  "reset",
];

export interface ILogEntryMidi extends ILogEntryBase {
  label: string;
  type: LogType.Midi;
  eventType: MidiEventType;
  channel?: number;
  data?: number[];
  value?: number;
  note?: number;
  controllerNumber?: number;
  velocity?: number;
  dataHex?: string;
  dataDec?: string;
}

export interface MidiEventParams {
  type: MidiEventType;
  channel?: number;
  data?: Uint8Array;
  value?: number;
  controller?: number;
}

type OpenDeckSysexTraceInfo = {
  btnIdx: number;
  len: number;
  varPos: number;
  varVal: number;
  firstBytes: number[];
};

const tryParseOpenDeckSysexTrace = (
  data: number[],
): OpenDeckSysexTraceInfo | null => {
  // Format (firmware debug):
  // F0 7D 'O' 'D' 01 <btnIdx> <len> <varPos> <varVal> <hi/lo nibbles...> F7
  if (data.length < 14) {
    return null;
  }

  if (
    data[0] !== 0xf0 ||
    data[1] !== 0x7d ||
    data[2] !== 0x4f ||
    data[3] !== 0x44 ||
    data[4] !== 0x01
  ) {
    return null;
  }

  if (data[data.length - 1] !== 0xf7) {
    return null;
  }

  const btnIdx = typeof data[5] === "number" ? data[5] : 0;
  const len = typeof data[6] === "number" ? data[6] : 0;
  const varPos = typeof data[7] === "number" ? data[7] : 0;
  const varVal = typeof data[8] === "number" ? data[8] : 0;

  const traceBytes = len < 8 ? len : 8;
  const nibbleStart = 9;
  const requiredLen = 10 + 2 * traceBytes;
  if (data.length < requiredLen) {
    return null;
  }

  const firstBytes: number[] = [];
  for (let i = 0; i < traceBytes; i++) {
    const hi = data[nibbleStart + 2 * i];
    const lo = data[nibbleStart + 2 * i + 1];

    if (
      typeof hi !== "number" ||
      typeof lo !== "number" ||
      hi < 0 ||
      hi > 0x0f ||
      lo < 0 ||
      lo > 0x0f
    ) {
      return null;
    }

    firstBytes.push(((hi & 0x0f) << 4) | (lo & 0x0f));
  }

  return {
    btnIdx,
    len,
    varPos,
    varVal,
    firstBytes,
  };
};

export const addMidi = (params: MidiEventParams): void => {
  // While the UI is syncing via SysEx, keep logging user-relevant channel MIDI
  // (e.g., button presses), but suppress high-rate realtime events to avoid spam.
  if (state.suspendMidiLogs && MidiRealtimeEvent.includes(params.type)) {
    return;
  }

  const { type, channel, data, controller } = params;
  const dataArray = data ? Array.from(data) : [];
  const value =
    params.value && type !== "controlchange" && type !== "sysex"
      ? params.value
      : undefined;
  const note =
    ["noteon", "noteoff"].includes(type) && data ? data[1] : undefined;
  const controllerNumber = controller;
  const velocity = data && data.length > 2 ? data[2] : undefined;
  const label =
    type == "noteoff"
      ? data[0] >= 144
        ? MidiEventTypeLabel.noteon
        : MidiEventTypeLabel.noteoff
      : MidiEventTypeLabel[type];

  const traceInfo =
    type === "sysex" ? tryParseOpenDeckSysexTrace(dataArray) : null;

  const firstHex =
    traceInfo && traceInfo.firstBytes.length
      ? ensureString(convertToHexString(traceInfo.firstBytes))
      : "";

  const labelWithTrace = traceInfo
    ? `SysEx Trace (btn ${traceInfo.btnIdx}, len ${traceInfo.len}, var ${traceInfo.varPos}=${traceInfo.varVal})${firstHex ? ` first=${firstHex}` : ""}`
    : label;

  const dataDec = data && ensureString(dataArray);
  const dataHex = data && ensureString(convertToHexString(dataArray));

  const logEntry = {
    label: labelWithTrace,
    type: LogType.Midi,
    eventType: type,
    channel,
    dataHex,
    dataDec,
    value,
    controllerNumber,
    note,
    velocity,
  } as ILogEntryMidi;

  addBuffered(logEntry);
};
