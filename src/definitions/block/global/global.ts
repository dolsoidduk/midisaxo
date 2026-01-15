import { markRaw } from "vue";
import {
  Block,
  IBlockDefinition,
  IFormSelectOption,
  ISectionDefinition,
  SectionType,
  FormInputComponent,
} from "../../interface";
import { deviceStore } from "../../../store";

import GlobalForm from "./GlobalForm.vue";
import GlobalFirmware from "./GlobalFirmware.vue";
import GlobalIcon from "./GlobalIcon.vue";

const sections: Dictionary<ISectionDefinition> = {
  PreservePresetState: {
    block: Block.Global,
    key: "preservePresetState",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 1,
    component: FormInputComponent.Toggle,
    label: "Preserve preset setting",
    helpText: `When disabled, first preset will always be loaded on device power on.
      Otherwise, preset specified with "Active preset" option is remembered. This is not related to saving of configuration
      to specified preset - the configuration data is always retained even after power off.`,
  },
  DisableForcedValueRefreshAfterPresetChange: {
    block: Block.Global,
    key: "disableForcedValueRefreshAfterPresetChange",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 2,
    component: FormInputComponent.Toggle,
    label: "Disable forced value refresh after preset change",
    helpText: `If this option isn't enabled, all components will resend their current values once the preset changes.`,
  },
  EnablePresetChangeWithProgramChangeIn: {
    block: Block.Global,
    key: "enablePresetChangeWithProgramChangeIn",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 3,
    component: FormInputComponent.Toggle,
    label: "Enable preset change with MIDI Program Change In",
    helpText: `When enabled, upon receiving MIDI Program Change message (on any interface and any channel) the board will change the preset to cooresponding program change value.`,
  },

  // Sax fingering table (24 keys): hidden raw sections used by MIDI Saxophone page.
  // These use SectionType.Value so they can be bulk-fetched via GetSectionValues.
  SaxFingeringMaskLo14: {
    showIf: (): boolean => false,
    block: Block.Global,
    key: "saxFingeringMaskLo14",
    type: SectionType.Value,
    section: 3,
    component: FormInputComponent.Input,
    label: "Sax fingering mask lo14",
    helpText: "Internal",
    min: 0,
    max: 16383,
  },
  SaxFingeringMaskHi10Enable: {
    showIf: (): boolean => false,
    block: Block.Global,
    key: "saxFingeringMaskHi10Enable",
    type: SectionType.Value,
    section: 4,
    component: FormInputComponent.Input,
    label: "Sax fingering mask hi10+enable",
    helpText: "Internal",
    min: 0,
    max: 2047,
  },
  SaxFingeringNote: {
    showIf: (): boolean => false,
    block: Block.Global,
    key: "saxFingeringNote",
    type: SectionType.Value,
    section: 5,
    component: FormInputComponent.Input,
    label: "Sax fingering note",
    helpText: "Internal",
    min: 0,
    max: 127,
  },
  SaxRegisterChromaticEnable: {
    showIf: (): boolean => false,
    block: Block.Global,
    key: "saxRegisterChromaticEnable",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 4,
    component: FormInputComponent.Toggle,
    label: "색소폰 레지스터 크로매틱 모드",
    helpText: `활성화되면 디지털 버튼 입력이 단일 모노포닉 크로매틱 노트 스트림(레지스터 키)으로 결합됩니다.`,
  },
  SaxRegisterChromaticBaseNote: {
    showIf: (): boolean => false,
    block: Block.Global,
    key: "saxRegisterChromaticBaseNote",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 5,
    min: 0,
    max: 127,
    component: FormInputComponent.Input,
    label: "색소폰 기본음 (0-127)",
    helpText: `레지스터 키 0에 대한 기본 MIDI 노트 번호입니다. 레지스터 키 인덱스는 이 값에 추가됩니다.`,
  },
  SaxRegisterChromaticTranspose: {
    showIf: (): boolean => false,
    block: Block.Global,
    key: "saxRegisterChromaticTranspose",
    type: SectionType.Setting,
    section: 2,
    // 0..48 where 24 == 0 semitones (range -24..+24)
    settingIndex: 11,
    min: 0,
    max: 48,
    component: FormInputComponent.Input,
    label: "레지스터 트랜스포즈(반음) (-24..+24)",
    helpText: `레지스터 크로매틱 모드에서 전송되는 최종 노트에 반음 단위 트랜스포즈를 적용합니다.\n\n값 범위는 0..48이고, 24가 0반음(기본값)입니다. 예) 12= -12반음, 36= +12반음`,
  },
  SaxRegisterChromaticInputInvert: {
    showIf: (): boolean => false,
    block: Block.Global,
    key: "saxRegisterChromaticInputInvert",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 9,
    component: FormInputComponent.Toggle,
    label: "키 입력 반전 (Active-Low)",
    helpText:
      "센서 출력이 0(LOW)일 때 ‘눌림/닫힘’으로 동작한다면 활성화하세요.",
  },
  SaxBreathControllerEnable: {
    block: Block.Global,
    key: "saxBreathControllerEnable",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 6,
    component: FormInputComponent.Toggle,
    label: "색소폰 브레스 컨트롤러 (MPXV7002DP)",
    helpText: `활성화하면 선택한 아날로그 입력(브레스 센서 값)을 MIDI CC(호흡/표현)로 변환해 전송합니다.

피치벤드를 별도 MPXV7002DP로 제어하려면:
  - 이 옵션은 켠 상태로(브레스 CC 전송)
  - 다른 아날로그 입력을 Analog 블록에서 "Pitch bend"로 설정
하는 구성을 사용할 수 있습니다.`,
  },
  SaxBreathControllerAnalogIndex: {
    showIf: (formState: FormState): boolean =>
      !!formState.saxBreathControllerEnable,
    block: Block.Global,
    key: "saxBreathControllerAnalogIndex",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 7,
    min: 0,
    max: 255,
    component: FormInputComponent.Input,
    label: "브레스 아날로그 인덱스 (0-255)",
    helpText: `MPXV7002DP(브레스 센서)에 연결된 아날로그 입력 인덱스입니다.
  인덱스 매핑은 타겟(보드) 설정에 따라 달라질 수 있습니다.

RP2040 Pico + native ADC 3채널 추천 구성:
  - 0: 오프셋 트림(예약)
  - 1: 브레스 센서(권장)
  - 2: (선택) 피치 Amount(밴딩/비브라토 스케일) 또는 Pitch Bend 센서`,
  },
  SaxBreathControllerMidPercent: {
    showIf: (formState: FormState): boolean =>
      !!formState.saxBreathControllerEnable,
    block: Block.Global,
    key: "saxBreathControllerMidPercent",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 10,
    min: 0,
    max: 100,
    component: FormInputComponent.Input,
    label: "브레스 오프셋(중앙값 %) (0-100)",
    helpText: `무호흡(0 압력)일 때의 센서 기준점을 ADC 전체 범위 대비 %로 설정합니다.

  대부분의 MPXV7002DP는 50% 근처(Vcc/2)입니다.
  값이 낮으면 작은 압력에서도 CC가 더 빨리 올라가고, 값이 높으면 반대로 더 늦게 올라갑니다.`,
  },
  SaxBreathControllerCC: {
    showIf: (formState: FormState): boolean =>
      !!formState.saxBreathControllerEnable,
    block: Block.Global,
    key: "saxBreathControllerCC",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 8,
    component: FormInputComponent.Select,
    options: (): IFormSelectOption[] => [
      { value: 2, text: "CC2 (Breath Controller)" },
      { value: 11, text: "CC11 (Expression)" },
      { value: 13, text: "CC2 + CC11" },
    ],
    label: "브레스 CC",
    helpText: `호흡 압력에 따라 전송할 MIDI CC를 선택합니다.

  일반적으로는 CC2(Breath) 또는 CC11(Expression)를 사용합니다.`,
  },
  SaxPitchBendDeadzone: {
    showIf: (formState: FormState): boolean => {
      if (formState.saxBreathControllerEnable) {
        return true;
      }

      const board = String(deviceStore.state?.boardName || "").toLowerCase();
      return board.includes("midisaxo");
    },
    block: Block.Global,
    key: "saxPitchBendDeadzone",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 12,
    min: 0,
    max: 2000,
    component: FormInputComponent.Input,
    label: "피치벤드 중앙 민감도(데드존) (0-2000)",
    helpText: `중립(센터) 근처에서 피치벤드가 얼마나 둔해질지 설정합니다.

  값이 클수록 중앙에서 더 둔해지고, 값이 작을수록 중앙에서도 더 민감해집니다.
  단위는 14-bit 피치벤드 값 기준(센터 주변 ±N)입니다. 예) 100 = ±100.

  팁: 센터(0) 기준이 내 연주 습관과 안 맞으면,
  버튼 메시지 타입을 "PB Center Capture"로 설정하고 ‘평소에 무는 정도’에서 한 번 캡처해 두는 걸 추천합니다.

  이 설정은 장치에 저장되며 전원을 껐다 켜도 유지됩니다.`,
  },

  SaxAutoVibratoEnable: {
    showIf: (): boolean => {
      const board = String(deviceStore.state?.boardName || "").toLowerCase();
      return board.includes("midisaxo");
    },
    block: Block.Global,
    key: "saxAutoVibratoEnable",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 14,
    component: FormInputComponent.Toggle,
    label: "자동 비브라토 (압력 게이트)",
    helpText:
      "활성화하면 선택한 Pitch Bend 센서가 일정 압력(임계값) 이상일 때만 자동으로 비브라토(LFO)를 오버레이합니다.\n\n팁: ‘원하는 타이밍’에만 비브라토를 걸고 싶을 때 유용합니다.",
  },

  SaxAutoVibratoAnalogIndex: {
    showIf: (formState: FormState): boolean => {
      const board = String(deviceStore.state?.boardName || "").toLowerCase();
      return board.includes("midisaxo") && !!formState.saxAutoVibratoEnable;
    },
    block: Block.Global,
    key: "saxAutoVibratoAnalogIndex",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 18,
    min: 0,
    max: 255,
    component: FormInputComponent.Input,
    label: "비브라토 대상 아날로그 인덱스 (0-255)",
    helpText:
      "자동 비브라토를 적용할 Pitch Bend 센서의 아날로그 인덱스입니다.\n\nRP2040 Pico + midisaxo_pico 기본 구성에서는 Pitch Bend 센서를 보통 2번(ADC2)에 연결합니다.",
  },

  SaxAutoVibratoGateThreshold: {
    showIf: (formState: FormState): boolean => {
      const board = String(deviceStore.state?.boardName || "").toLowerCase();
      return board.includes("midisaxo") && !!formState.saxAutoVibratoEnable;
    },
    block: Block.Global,
    key: "saxAutoVibratoGateThreshold",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 15,
    min: 0,
    max: 8192,
    component: FormInputComponent.Input,
    label: "비브라토 임계값 (0-8192)",
    helpText:
      "Pitch Bend 센서 값이 ‘센터(중립점) + 임계값’을 넘을 때만 비브라토가 켜집니다.\n\n센터(중립점)는 PB Center Capture(버튼)로 캡처한 값 기준이며, UI/DAW로 나가는 피치벤드 ‘중립’은 항상 8192로 정규화됩니다.\n\n값이 작을수록 쉽게 켜지고, 값이 클수록 더 강하게 불어야(눌러야) 켜집니다.",
  },

  SaxAutoVibratoDepth: {
    showIf: (formState: FormState): boolean => {
      const board = String(deviceStore.state?.boardName || "").toLowerCase();
      return board.includes("midisaxo") && !!formState.saxAutoVibratoEnable;
    },
    block: Block.Global,
    key: "saxAutoVibratoDepth",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 16,
    min: 0,
    max: 8192,
    component: FormInputComponent.Input,
    label: "비브라토 깊이(진폭) (0-8192)",
    helpText:
      "비브라토의 최대 진폭(14-bit Pitch Bend 기준)입니다.\n\n값이 클수록 더 크게 흔들립니다.",
  },

  SaxAutoVibratoRateHz10: {
    showIf: (formState: FormState): boolean => {
      const board = String(deviceStore.state?.boardName || "").toLowerCase();
      return board.includes("midisaxo") && !!formState.saxAutoVibratoEnable;
    },
    block: Block.Global,
    key: "saxAutoVibratoRateHz10",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 17,
    min: 10,
    max: 200,
    component: FormInputComponent.Input,
    label: "비브라토 속도 (Hz×10, 예: 60=6.0Hz)",
    helpText:
      "비브라토 속도입니다. 값은 ‘Hz × 10’로 저장됩니다.\n예) 50=5.0Hz, 60=6.0Hz, 70=7.0Hz",
  },
  ActivePreset: {
    block: Block.Global,
    key: "activePreset",
    type: SectionType.Setting,
    section: 2,
    settingIndex: 0,
    component: FormInputComponent.Select,
    // Note: Read supported preset count from state
    options: (): any => {
      const count = deviceStore.state.supportedPresetsCount || 1;
      const options = [];
      for (let value = 0; value < count; value++) {
        options.push({
          value,
          text: String(value + 1),
        });
      }
      return options;
    },
    // Note: update separate state property (different UI segment than the form) when loading value
    onLoad: (value: number): void => {
      deviceStore.state.activePreset = value;
    },
    label: "Active preset",
    helpText: `Preset stores the entire configuration for device.`,
  },
  UseGlobalChannel: {
    block: Block.Global,
    key: "useGlobalChannel",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 13,
    component: FormInputComponent.Toggle,
    label: "Use global channel",
    helpText: `When enabled, specified global MIDI channel will be used for all components. Individual channels for components will be ignored.`,
  },
  GlobalChannel: {
    showIf: (formState: FormState): boolean => !!formState.useGlobalChannel,
    block: Block.Global,
    key: "globalChannel",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 14,
    min: 1,
    max: 17,
    component: FormInputComponent.Input,
    label: "Global channel",
    helpText: `Setting the channel to value 17 will cause sending of data on each MIDI channel, and incoming channel for LEDs and other components will be ignored.`,
  },
  StandardNoteOff: {
    block: Block.Global,
    key: "standardNoteOff",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 0,
    component: FormInputComponent.Toggle,
    label: "Standard note off",
    helpText: `When disabled, Note On with velocity 0 will be sent as note off. If enabled, true Note Off event will be sent instead.`,
  },
  RunningStatus: {
    showIf: (formState: FormState): boolean => !!formState.dinMidiState,
    block: Block.Global,
    key: "runningStatus",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 1,
    component: FormInputComponent.Toggle,
    label: "Running status",
    helpText: `This setting applies only to DIN MIDI out. When enabled,
    MIDI output bandwidth increases due to lower amount of bytes being sent. This setting can cause issues on older MIDI gear so it's best to leave it disabled.`,
  },
  MIDIClock: {
    showIf: (formState: FormState): boolean => !!formState.dinMidiState,
    block: Block.Global,
    key: "midiClock",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 15,
    component: FormInputComponent.Toggle,
    label: "Send MIDI clock",
    helpText: `This setting applies only to DIN MIDI out.
    When enabled, MIDI clock will be sent out at default BPM of 120. The tempo can be changed with buttons or encoders.`,
  },
  DinMidiState: {
    block: Block.Global,
    key: "dinMidiState",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 3,
    component: FormInputComponent.Toggle,
    label: "DIN MIDI",
    helpText: `Enable or disable DIN MIDI input and output.`,
  },
  BleMidiState: {
    block: Block.Global,
    key: "bleMidiState",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 9,
    component: FormInputComponent.Toggle,
    label: "BLE MIDI",
    helpText: `Enable or disable BLE (Bluetooth Low Energy) MIDI input and output.`,
  },
  UsbToDinThru: {
    showIf: (formState: FormState): boolean => !!formState.dinMidiState,
    block: Block.Global,
    key: "usbToDinThru",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 4,
    component: FormInputComponent.Toggle,
    label: "USB to DIN Thru",
    helpText: `When enabled, all data received via USB will be forwarded to DIN out.`,
  },
  UsbToUsbThru: {
    block: Block.Global,
    key: "usbToUsbThru",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 5,
    component: FormInputComponent.Toggle,
    label: "USB to USB Thru",
    helpText: `When enabled, all data received via USB will be forwarded to USB out.`,
  },
  UsbToBleThru: {
    showIf: (formState: FormState): boolean => !!formState.bleMidiState,
    block: Block.Global,
    key: "usbToBleThru",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 6,
    component: FormInputComponent.Toggle,
    label: "USB to BLE Thru",
    helpText: `When enabled, all data received via USB will be forwarded to BLE out.`,
  },
  DinToDinThru: {
    showIf: (formState: FormState): boolean => !!formState.dinMidiState,
    block: Block.Global,
    key: "dinToDinThru",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 7,
    component: FormInputComponent.Toggle,
    label: "DIN to DIN Thru",
    helpText: `When enabled, all data received via DIN will be forwarded to DIN out.`,
  },
  DinToUsbThru: {
    showIf: (formState: FormState): boolean => !!formState.dinMidiState,
    block: Block.Global,
    key: "dinToUsbThru",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 2,
    component: FormInputComponent.Toggle,
    label: "DIN to USB Thru",
    helpText: `When enabled, all data received via DIN will be forwarded to USB out.`,
  },
  DinToBleThru: {
    showIf: (formState: FormState): boolean =>
      !!formState.dinMidiState && !!formState.bleMidiState,
    block: Block.Global,
    key: "dinToBleThru",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 8,
    component: FormInputComponent.Toggle,
    label: "DIN to BLE Thru",
    helpText: `When enabled, all data received via DIN will be forwarded to BLE out.`,
  },
  BleToDinThru: {
    showIf: (formState: FormState): boolean =>
      !!formState.dinMidiState && !!formState.bleMidiState,
    block: Block.Global,
    key: "bleToDinThru",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 10,
    component: FormInputComponent.Toggle,
    label: "BLE to DIN Thru",
    helpText: `When enabled, all data received via BLE will be forwarded to DIN out.`,
  },
  BleToUsbThru: {
    showIf: (formState: FormState): boolean => !!formState.bleMidiState,
    block: Block.Global,
    key: "bleToUsbThru",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 11,
    component: FormInputComponent.Toggle,
    label: "BLE to USB Thru",
    helpText: `When enabled, all data received via BLE will be forwarded to USB out.`,
  },
  BleToBleThru: {
    showIf: (formState: FormState): boolean => !!formState.bleMidiState,
    block: Block.Global,
    key: "bleToBleThru",
    type: SectionType.Setting,
    section: 0,
    settingIndex: 12,
    component: FormInputComponent.Toggle,
    label: "BLE to BLE Thru",
    helpText: `When enabled, all data received via BLE will be forwarded to BLE out.`,
  },
};

export const GlobalBlock: IBlockDefinition = {
  block: Block.Global,
  title: "Global",
  routeName: "device-global",
  iconComponent: markRaw(GlobalIcon),
  sections,
  routes: [
    {
      path: "",
      name: "device-global",
      component: GlobalForm,
    },
    {
      path: "firmware-update",
      name: "device-firmware-update",
      component: GlobalFirmware,
    },
  ],
};
