import { ButtonMessageType } from "../definitions";

const tokenizeHex = (raw: string): string[] => {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return [];
  }

  // Normalize separators
  const normalized = trimmed
    // Allow users to paste docs examples like "01..." or "..."
    // Strip ellipsis markers (ASCII "..." and Unicode "…") before tokenization.
    .replace(/\.{3,}/g, "")
    .replace(/…/g, "")
    .replace(/,/g, " ")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If user pasted a continuous hex string like "F043F7"
  if (/^[0-9a-fA-F]+$/.test(normalized) && normalized.length >= 2) {
    if (normalized.length % 2 === 0) {
      const pairs: string[] = [];
      for (let i = 0; i < normalized.length; i += 2) {
        pairs.push(normalized.slice(i, i + 2));
      }
      return pairs;
    }
  }

  return normalized.split(" ").filter(Boolean);
};

export const parseHexBytes = (
  raw: string,
): { bytes: number[]; error?: string } => {
  const tokens = tokenizeHex(raw);

  if (!tokens.length) {
    return { bytes: [] };
  }

  const bytes: number[] = [];
  for (const tokenRaw of tokens) {
    const token = tokenRaw.toLowerCase().startsWith("0x")
      ? tokenRaw.slice(2)
      : tokenRaw;

    if (!/^[0-9a-fA-F]{1,2}$/.test(token)) {
      return {
        bytes: [],
        error: `잘못된 HEX 바이트: '${tokenRaw}' (예: F0 또는 0xF0)`,
      };
    }

    const value = parseInt(token, 16);
    if (Number.isNaN(value) || value < 0 || value > 255) {
      return {
        bytes: [],
        error: `HEX 바이트 범위 오류: '${tokenRaw}'`,
      };
    }

    bytes.push(value);
  }

  return { bytes };
};

const toHex = (value: number): string =>
  (value & 0xff).toString(16).toUpperCase().padStart(2, "0");

export type ParsedRawMidi =
  | {
      messageType: ButtonMessageType;
      midiChannel?: number;
      midiId?: number;
      value?: number;
      sysEx?: {
        payload: number[];
        length: number;
        words: number[];
        truncated: boolean;
      };
    }
  | { error: string };

const CUSTOM_SYSEX_MAX_TOTAL_BYTES = 16;
const CUSTOM_SYSEX_MAX_PAYLOAD_BYTES = CUSTOM_SYSEX_MAX_TOTAL_BYTES - 2;
const CUSTOM_SYSEX_WORDS = CUSTOM_SYSEX_MAX_TOTAL_BYTES / 2;

const normalizeSysexPayload = (
  bytes: number[],
): { payload: number[]; truncated: boolean; error?: string } => {
  if (!bytes.length) {
    return { payload: [], truncated: false };
  }

  const hasF0 = bytes[0] === 0xf0;
  const hasF7 = bytes[bytes.length - 1] === 0xf7;

  if (!(hasF0 && hasF7)) {
    return {
      payload: [],
      truncated: false,
      error: "SysEx는 F0로 시작하고 F7로 끝나야 합니다.",
    };
  }

  if (bytes.length < 2) {
    return {
      payload: [],
      truncated: false,
      error: "SysEx 길이가 너무 짧습니다.",
    };
  }

  const payload = bytes.slice(1, -1);

  for (const b of payload) {
    if (b < 0 || b > 0x7f) {
      return {
        payload: [],
        truncated: false,
        error: "SysEx payload 바이트는 00..7F 범위여야 합니다.",
      };
    }
  }

  const truncatedPayload = payload.slice(0, CUSTOM_SYSEX_MAX_PAYLOAD_BYTES);
  return {
    payload: truncatedPayload,
    truncated: truncatedPayload.length !== payload.length,
  };
};

const bytesToWords = (bytes: number[]): number[] => {
  const words: number[] = [];
  for (let i = 0; i < CUSTOM_SYSEX_WORDS; i++) {
    const b0 = (bytes[i * 2] ?? 0) & 0x7f;
    const b1 = (bytes[i * 2 + 1] ?? 0) & 0x7f;
    words.push(b0 | (b1 << 7));
  }
  return words;
};

type ParsedMidiMessage =
  | {
      kind: "realtime";
      status: number;
    }
  | {
      kind: "channel";
      status: number;
      channel: number; // 1..16
      type: number; // 0x80..0xE0
      data1: number;
      data2?: number;
    };

const parseMessageStream = (bytes: number[]): ParsedMidiMessage[] | string => {
  const out: ParsedMidiMessage[] = [];

  for (let i = 0; i < bytes.length; ) {
    const status = bytes[i] & 0xff;

    // Realtime messages can appear anywhere.
    if (status >= 0xf8) {
      out.push({ kind: "realtime", status });
      i += 1;
      continue;
    }

    if (status < 0x80 || status > 0xef) {
      return `지원하지 않는 상태 바이트입니다: ${toHex(
        status,
      )} (지원: 8n/9n/Bn/Cn 또는 RealTime)`;
    }

    const channel = (status & 0x0f) + 1;
    const type = status & 0xf0;

    // Program Change / Channel Pressure
    if (type === 0xc0 || type === 0xd0) {
      if (i + 1 >= bytes.length) {
        return `메시지가 잘렸습니다: ${toHex(status)} (데이터 1바이트 필요)`;
      }
      out.push({
        kind: "channel",
        status,
        channel,
        type,
        data1: bytes[i + 1] & 0x7f,
      });
      i += 2;
      continue;
    }

    // Most channel voice messages
    if (i + 2 >= bytes.length) {
      return `메시지가 잘렸습니다: ${toHex(status)} (데이터 2바이트 필요)`;
    }

    out.push({
      kind: "channel",
      status,
      channel,
      type,
      data1: bytes[i + 1] & 0x7f,
      data2: bytes[i + 2] & 0x7f,
    });
    i += 3;
  }

  return out;
};

export const parseRawMidiToButton = (bytes: number[]): ParsedRawMidi => {
  if (!bytes.length) {
    return { error: "HEX가 비어 있습니다." };
  }

  const status = bytes[0] & 0xff;

  // SysEx (F0..F7)
  if (status === 0xf0 || bytes.includes(0xf7) || bytes.includes(0xf0)) {
    if (bytes[0] !== 0xf0) {
      return { error: "SysEx는 F0로 시작해야 합니다." };
    }
    if (bytes[bytes.length - 1] !== 0xf7) {
      return { error: "SysEx는 F7로 끝나야 합니다." };
    }

    if (bytes.length > CUSTOM_SYSEX_MAX_TOTAL_BYTES) {
      // Still allow mapping, but it'll be truncated at payload level.
    }

    const normalized = normalizeSysexPayload(bytes);
    if (normalized.error) {
      return { error: normalized.error };
    }

    const payload = normalized.payload;
    const length = payload.length;
    const words = bytesToWords(payload);

    return {
      messageType: ButtonMessageType.CustomSysEx,
      // Default: no substitution.
      midiId: 0,
      value: 0,
      sysEx: {
        payload,
        length,
        words,
        truncated: normalized.truncated || bytes.length > CUSTOM_SYSEX_MAX_TOTAL_BYTES,
      },
    };
  }

  const messagesOrError = parseMessageStream(bytes);
  if (typeof messagesOrError === "string") {
    return { error: messagesOrError };
  }
  const messages = messagesOrError;

  // Only realtime messages (common in transport buttons)
  if (messages.length === 1 && messages[0].kind === "realtime") {
    switch (messages[0].status) {
      case 0xf8:
        return { messageType: ButtonMessageType.RealTimeClock };
      case 0xfa:
        return { messageType: ButtonMessageType.RealTimeStart };
      case 0xfb:
        return { messageType: ButtonMessageType.RealTimeContinue };
      case 0xfc:
        return { messageType: ButtonMessageType.RealTimeStop };
      case 0xfe:
        return { messageType: ButtonMessageType.RealTimeActiveSensing };
      case 0xff:
        return { messageType: ButtonMessageType.RealTimeSystemReset };
      default:
        return {
          error: `지원하지 않는 1바이트 메시지입니다: ${toHex(
            messages[0].status,
          )} (지원: F8/FA/FB/FC/FE/FF)`,
        };
    }
  }

  // Bank Select + Program Change
  // Accept a concatenation like: Bn 00 <msb>  Bn 20 <lsb>  Cn <pc>
  // Order does not matter; missing MSB/LSB defaults to 0.
  const channelMsgs = messages.filter(
    (m): m is Extract<ParsedMidiMessage, { kind: "channel" }> =>
      m.kind === "channel",
  );

  const uniqueChannels = Array.from(new Set(channelMsgs.map((m) => m.channel)));
  if (uniqueChannels.length > 1) {
    return {
      error: "여러 채널의 메시지가 섞여 있습니다. (한 줄에는 한 채널만)",
    };
  }

  const pcMessages = channelMsgs.filter((m) => m.type === 0xc0);
  const ccMessages = channelMsgs.filter((m) => m.type === 0xb0);

  if (pcMessages.length === 1 && (ccMessages.length >= 1 || bytes.length > 2)) {
    const channel = pcMessages[0].channel;
    const program = pcMessages[0].data1 & 0x7f;

    let bankMsb = 0;
    let bankLsb = 0;
    for (const cc of ccMessages) {
      if (cc.channel !== channel) {
        continue;
      }
      if (cc.data1 === 0 && typeof cc.data2 === "number") {
        bankMsb = cc.data2 & 0x7f;
      }
      if (cc.data1 === 32 && typeof cc.data2 === "number") {
        bankLsb = cc.data2 & 0x7f;
      }
    }

    if (ccMessages.some((cc) => cc.data1 === 0 || cc.data1 === 32)) {
      const bank = (bankMsb << 7) | bankLsb;
      return {
        messageType: ButtonMessageType.BankSelectProgramChange,
        midiChannel: channel,
        midiId: program,
        value: bank,
      };
    }
  }

  // Single channel message fallbacks
  if (channelMsgs.length !== 1 || messages.length !== 1) {
    return {
      error:
        "여러 메시지가 감지되었습니다. 현재는 Bank Select(CC0/CC32)+PC 조합만 지원합니다.",
    };
  }

  const msg = channelMsgs[0];

  if (msg.type === 0xc0) {
    return {
      messageType: ButtonMessageType.ProgramChange,
      midiChannel: msg.channel,
      midiId: msg.data1 & 0x7f,
    };
  }

  if (msg.type === 0x80) {
    return {
      messageType: ButtonMessageType.NoteOffOnly,
      midiChannel: msg.channel,
      midiId: msg.data1,
    };
  }

  if (msg.type === 0x90) {
    const vel = msg.data2 ?? 0;
    if (vel === 0) {
      return {
        messageType: ButtonMessageType.NoteOffOnly,
        midiChannel: msg.channel,
        midiId: msg.data1,
      };
    }
    return {
      messageType: ButtonMessageType.Note,
      midiChannel: msg.channel,
      midiId: msg.data1,
      value: vel,
    };
  }

  if (msg.type === 0xb0) {
    return {
      messageType: ButtonMessageType.ControlChange,
      midiChannel: msg.channel,
      midiId: msg.data1,
      value: msg.data2 ?? 0,
    };
  }

  return {
    error: `현재 HEX 입력은 Note(8n/9n), CC(Bn), PC(Cn), Bank Select(CC0/CC32)+PC, RealTime만 지원합니다. (입력: ${bytes
      .map(toHex)
      .join(" ")})`,
  };
};
