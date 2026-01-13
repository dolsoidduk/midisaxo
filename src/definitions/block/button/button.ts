import { markRaw } from "vue";
import {
  IBlockDefinition,
  ISectionDefinition,
  SectionType,
  FormInputComponent,
  HideButtonVelocityOnTypes,
  HideButtonMidiIdOnTypes,
  HideButtonMidiChannelOnTypes,
  Block,
  ButtonMessageType,
} from "../../interface";

import RouteWrapper from "../../../components/RouteWrapper.vue";
import ButtonForm from "./ButtonForm.vue";
import DeviceGrid from "../../device/DeviceGrid.vue";
import ButtonIcon from "./ButtonIcon.vue";

type FormState = Dictionary<number>;

const CUSTOM_SYSEX_MAX_TOTAL_BYTES = 16;
const CUSTOM_SYSEX_MAX_PAYLOAD_BYTES = CUSTOM_SYSEX_MAX_TOTAL_BYTES - 2;

const sections: Dictionary<ISectionDefinition> = {
  Type: {
    showIf: (): boolean => true,
    block: Block.Button,
    key: "type",
    type: SectionType.Value,
    section: 0,
    component: FormInputComponent.Select,
    colspan: 2,
    options: [
      { value: 0, text: "모멘터리" },
      { value: 1, text: "래칭" },
    ],
    label: "타입",
    helpText: `
      버튼 타입이 모멘터리인 경우 버튼을 놓는 순간 설정된 MIDI 메시지가 전송됩니다.
      래칭인 경우에는 두 번째 버튼 누름에서 메시지가 전송됩니다.
      기본값은 모멘터리이며, 메시지 타입에 따라 이 설정이 무시될 수 있습니다.`,
  },
  MidiMessage: {
    key: "messageType",
    type: SectionType.Value,
    section: 1,
    component: FormInputComponent.Select,
    options: [
      { value: ButtonMessageType.Note, text: "Note" },
      { value: ButtonMessageType.ProgramChange, text: "Program Change" },
      {
        value: ButtonMessageType.BankSelectProgramChange,
        text: "Bank Select (MSB/LSB) + Program Change",
      },
      { value: ButtonMessageType.ProgramChangeInc, text: "Program Change Inc" },
      { value: ButtonMessageType.ProgramChangeDec, text: "Program Change Dec" },
      {
        value: ButtonMessageType.ProgramChangeOffsetInc,
        text: "Program Change Offset Increment",
      },
      {
        value: ButtonMessageType.ProgramChangeOffsetDec,
        text: "Program Change Offset Decrement",
      },
      { value: ButtonMessageType.ControlChange, text: "CC" },
      { value: ButtonMessageType.ControlChangeOff, text: "CC/0 Off" },
      { value: ButtonMessageType.MmcStop, text: "MMC Stop" },
      { value: ButtonMessageType.MmcPlay, text: "MMC Play" },
      { value: ButtonMessageType.MmcPlayStop, text: "MMC Play/Stop" },
      { value: ButtonMessageType.MmcRecord, text: "MMC Record" },
      { value: ButtonMessageType.MmcPause, text: "MMC Pause" },
      { value: ButtonMessageType.RealTimeClock, text: "Real Time Clock" },
      { value: ButtonMessageType.RealTimeStart, text: "Real Time Start" },
      { value: ButtonMessageType.RealTimeContinue, text: "Real Time Continue" },
      { value: ButtonMessageType.RealTimeStop, text: "Real Time Stop" },
      {
        value: ButtonMessageType.RealTimeActiveSensing,
        text: "Real Time Active Sensing",
      },
      {
        value: ButtonMessageType.RealTimeSystemReset,
        text: "Real Time System Reset",
      },
      { value: ButtonMessageType.None, text: "None" },
      { value: ButtonMessageType.PresetChange, text: "Preset Change" },
      {
        value: ButtonMessageType.MultiValueIncResetNote,
        text: "Multi Value IncReset Note",
      },
      {
        value: ButtonMessageType.MultiValueIncDecNote,
        text: "Multi Value IncDec Note",
      },
      {
        value: ButtonMessageType.MultiValueIncResetCC,
        text: "Multi Value IncReset CC",
      },
      {
        value: ButtonMessageType.MultiValueIncDecCC,
        text: "Multi Value IncDec CC",
      },
      { value: ButtonMessageType.NoteOffOnly, text: "Note Off Only" },
      { value: ButtonMessageType.ControlChange0Only, text: "CC/0 only" },
      { value: ButtonMessageType.BpmInc, text: "BPM Inc" },
      { value: ButtonMessageType.BpmDec, text: "BPM Dec" },
      { value: ButtonMessageType.CustomSysEx, text: "Custom SysEx" },
    ],
    label: "메시지 타입",
    helpText: ``,
    block: Block.Button,
  },
  MidiChannel: {
    showIf: (formState: FormState): boolean =>
      !HideButtonMidiChannelOnTypes.includes(formState.messageType),
    key: "midiChannel",
    type: SectionType.Value,
    block: Block.Button,
    section: 4,
    component: FormInputComponent.Input,
    min: 1,
    max: 17,
    label: "MIDI 채널",
    helpText:
      "채널을 17로 설정하면 모든 MIDI 채널(1~16)로 데이터를 전송합니다.",
  },
  MidiId: {
    showIf: (formState: FormState): boolean =>
      !HideButtonMidiIdOnTypes.includes(formState.messageType) &&
      formState.messageType !== ButtonMessageType.BankSelectProgramChange &&
      formState.messageType !== ButtonMessageType.CustomSysEx,
    key: "midiId",
    type: SectionType.Value,
    section: 2,
    component: FormInputComponent.Input,
    min: 0,
    max: 127,
    label: "MIDI ID",
    helpText: "",
    block: Block.Button,
  },

  MidiIdProgram: {
    showIf: (formState: FormState): boolean =>
      formState.messageType == ButtonMessageType.BankSelectProgramChange,
    key: "midiId",
    type: SectionType.Value,
    section: 2,
    component: FormInputComponent.Input,
    min: 0,
    max: 127,
    label: "프로그램(PC)",
    helpText:
      "Program Change 번호(0-127). 일부 장치는 프로그램을 1-128로 표기합니다.",
    block: Block.Button,
  },

  SysExVarPos: {
    showIf: (formState: FormState): boolean =>
      formState.messageType == ButtonMessageType.CustomSysEx,
    key: "midiId",
    type: SectionType.Value,
    section: 2,
    component: FormInputComponent.Input,
    min: 0,
    max: CUSTOM_SYSEX_MAX_TOTAL_BYTES - 1,
    label: "Variable byte index",
    helpText:
      "0 = 치환 안 함. 인덱스는 전체 SysEx 기준(F0=0, 첫 payload=1). 1~15 = 해당 바이트를 Value(0-127)로 치환.",
    block: Block.Button,
  },
  Preset: {
    showIf: (formState: FormState): boolean =>
      formState.messageType == ButtonMessageType.PresetChange,
    key: "preset",
    type: SectionType.Value,
    section: 2,
    component: FormInputComponent.Input,
    min: 0,
    max: 9,
    label: "프리셋",
    helpText:
      "버튼을 눌렀을 때 전환할 프리셋입니다. 번호는 0부터 시작하므로 값 0은 프리셋 1을 로드합니다.",
    block: Block.Button,
  },
  Value: {
    showIf: (formState: FormState): boolean =>
      !HideButtonVelocityOnTypes.includes(formState.messageType) &&
      formState.messageType !== ButtonMessageType.BankSelectProgramChange &&
      formState.messageType !== ButtonMessageType.CustomSysEx,
    key: "value",
    type: SectionType.Value,
    section: 3,
    component: FormInputComponent.Input,
    min: 1,
    max: 127,
    label: "값",
    helpText:
      "노트의 Velocity, CC의 컨트롤 값, Multi Value 타입의 증감값 또는 Program Change의 오프셋입니다.",
    block: Block.Button,
  },

  ValueBank: {
    showIf: (formState: FormState): boolean =>
      formState.messageType == ButtonMessageType.BankSelectProgramChange,
    key: "value",
    type: SectionType.Value,
    section: 3,
    component: FormInputComponent.Input,
    min: 0,
    max: 16383,
    label: "뱅크(0-16383)",
    helpText:
      "14-bit bank number. MSB = bank >> 7, LSB = bank & 0x7F. OpenDeck sends CC#0 (MSB), CC#32 (LSB), then Program Change.",
    block: Block.Button,
  },

  SysExVarValue: {
    showIf: (formState: FormState): boolean =>
      formState.messageType == ButtonMessageType.CustomSysEx,
    key: "value",
    type: SectionType.Value,
    section: 3,
    component: FormInputComponent.Input,
    min: 0,
    max: 127,
    label: "Variable value (0-127)",
    helpText:
      "Variable byte index 위치에 써질 7-bit 값(0-127). (F0/F7 포함 인덱스)",
    block: Block.Button,
  },

  SysExLength: {
    showIf: (): boolean => false,
    key: "sysExLength",
    type: SectionType.Value,
    section: 6,
    component: FormInputComponent.Input,
    min: 0,
    max: CUSTOM_SYSEX_MAX_PAYLOAD_BYTES,
    label: "SysEx 길이(바이트)",
    helpText: `SysEx payload length (between F0 and F7). Max ${CUSTOM_SYSEX_MAX_PAYLOAD_BYTES} (total message length is payload+2, max ${CUSTOM_SYSEX_MAX_TOTAL_BYTES}).`,
    block: Block.Button,
  },

  SysExData0: {
    showIf: (): boolean => false,
    key: "sysExData0",
    type: SectionType.Value,
    section: 7,
    component: FormInputComponent.Input,
    min: 0,
    max: 16383,
    label: "SysEx 데이터 워드 0",
    helpText:
      "Packed payload bytes [b0 | (b1<<7)] (both bytes must be 00..7F).",
    block: Block.Button,
  },
  SysExData1: {
    showIf: (): boolean => false,
    key: "sysExData1",
    type: SectionType.Value,
    section: 8,
    component: FormInputComponent.Input,
    min: 0,
    max: 16383,
    label: "SysEx 데이터 워드 1",
    helpText: "Packed payload bytes [b2 | (b3<<7)].",
    block: Block.Button,
  },
  SysExData2: {
    showIf: (): boolean => false,
    key: "sysExData2",
    type: SectionType.Value,
    section: 9,
    component: FormInputComponent.Input,
    min: 0,
    max: 16383,
    label: "SysEx 데이터 워드 2",
    helpText: "Packed payload bytes [b4 | (b5<<7)].",
    block: Block.Button,
  },
  SysExData3: {
    showIf: (): boolean => false,
    key: "sysExData3",
    type: SectionType.Value,
    section: 10,
    component: FormInputComponent.Input,
    min: 0,
    max: 16383,
    label: "SysEx 데이터 워드 3",
    helpText: "Packed payload bytes [b6 | (b7<<7)].",
    block: Block.Button,
  },
  SysExData4: {
    showIf: (): boolean => false,
    key: "sysExData4",
    type: SectionType.Value,
    section: 11,
    component: FormInputComponent.Input,
    min: 0,
    max: 16383,
    label: "SysEx 데이터 워드 4",
    helpText: "Packed payload bytes [b8 | (b9<<7)].",
    block: Block.Button,
  },
  SysExData5: {
    showIf: (): boolean => false,
    key: "sysExData5",
    type: SectionType.Value,
    section: 12,
    component: FormInputComponent.Input,
    min: 0,
    max: 16383,
    label: "SysEx 데이터 워드 5",
    helpText: "Packed payload bytes [b10 | (b11<<7)].",
    block: Block.Button,
  },
  SysExData6: {
    showIf: (): boolean => false,
    key: "sysExData6",
    type: SectionType.Value,
    section: 13,
    component: FormInputComponent.Input,
    min: 0,
    max: 16383,
    label: "SysEx 데이터 워드 6",
    helpText: "Packed payload bytes [b12 | (b13<<7)].",
    block: Block.Button,
  },
  SysExData7: {
    showIf: (): boolean => false,
    key: "sysExData7",
    type: SectionType.Value,
    section: 14,
    component: FormInputComponent.Input,
    min: 0,
    max: 16383,
    label: "SysEx 데이터 워드 7",
    helpText: "Packed payload bytes [b14 | (b15<<7)].",
    block: Block.Button,
  },

  // Hidden by default; used by the MIDI Saxophone page to remap register keys.
  SaxRegisterKeyMap: {
    showIf: (): boolean => false,
    key: "saxRegisterKeyMap",
    type: SectionType.Value,
    section: 5,
    component: FormInputComponent.Select,
    options: [],
    label: "색소폰 레지스터 키 맵",
    helpText: "0 = 기본(그대로); 그 외 = mappedIndex+1",
    block: Block.Button,
  },
};

export const ButtonBlock: IBlockDefinition = {
  block: Block.Button,
  title: "버튼",
  routeName: "device-buttons",
  iconComponent: markRaw(ButtonIcon),
  componentCountResponseIndex: 0,
  sections,
  routes: [
    {
      path: "buttons",
      name: "device-buttons",
      component: RouteWrapper,
      redirect: { name: "device-buttons-list" },
      children: [
        {
          path: "list",
          name: "device-buttons-list",
          component: DeviceGrid,
          props: {
            block: Block.Button,
            routeName: "device-buttons-form",
            segmentGrid: true,
          },
        },
        {
          path: "buttons/:index",
          name: "device-buttons-form",
          component: ButtonForm,
          props: {
            block: Block.Button,
          },
        },
      ],
    },
  ],
};
