import { computed } from "vue";
import {
  Block,
  BlockMap,
  ButtonMessageType,
  FormInputComponent,
  ISectionDefinition,
  SectionType,
} from "../definitions";
import { deviceStore } from "../store";
import { IViewSettingState } from "../definitions/device/device-store/state";

interface IViewSettings {
  componentCount: Computed<number>;
  indexRange: Computed<Array<number>>;
  pages: Computed<Array<number>>;
  pageSizes: Computed<Array<number>>;
  sections: Dictionary<ISectionDefinition>;
  viewSetting: Computed<IViewSettingState>;
}

export const useViewSettings = (block: Block): IViewSettings => {
  const viewSetting = computed(() => deviceStore.state.viewSettings[block]);
  const FALLBACK_COMPONENT_COUNT = 16;

  const componentCount = computed(() => {
    const reported: any = (deviceStore.state.numberOfComponents as any)?.[block];

    if (typeof reported === "number" && Number.isFinite(reported)) {
      // Positive counts are always trustworthy.
      if (reported > 0) {
        return reported;
      }

      // If firmware version couldn't be read during connect, we are likely
      // running against a variant/target that doesn't fully support the
      // connection-info custom requests. In that case, a reported 0 count
      // is more often "unknown" than "not present".
      if (reported === 0 && deviceStore.state.firmwareVersion === "v0.0.0") {
        const blockDef = BlockMap[block];
        if (blockDef && blockDef.componentCountResponseIndex !== undefined) {
          return FALLBACK_COMPONENT_COUNT;
        }
      }

      // Otherwise, respect explicit 0.
      return reported;
    }

    // Only apply fallback to blocks that are component-based.
    const blockDef = BlockMap[block];
    if (!blockDef || blockDef.componentCountResponseIndex === undefined) {
      return 0;
    }

    return FALLBACK_COMPONENT_COUNT;
  });

  const pages = computed(() =>
    Math.ceil(componentCount.value / viewSetting.value.itemsPerPage),
  );
  const min = computed(
    () => (viewSetting.value.currentPage - 1) * viewSetting.value.itemsPerPage,
  );

  const maxCalc = computed(() => min.value + viewSetting.value.itemsPerPage);
  const max = computed(() =>
    maxCalc.value > componentCount.value ? componentCount.value : maxCalc.value,
  );

  const allowedPageSizes = [16, 32, 56, 112];

  const pageSizes = computed(() =>
    allowedPageSizes.filter((size: number) => size < componentCount.value),
  );

  const indexRange = computed(() => {
    const items = [];
    for (let i = min.value; i < max.value; i++) {
      items.push(i);
    }
    return items;
  });

  const sections = computed(() => {
    const base = BlockMap[block].sections;

    // Table-only helper field: allow pasting raw MIDI bytes and auto-map to button settings.
    if (!viewSetting.value.viewListAsTable || block !== Block.Button) {
      return base;
    }

    const rawMidiHex: ISectionDefinition = {
      showIf: (formState: any): boolean => {
        const t = Number(formState?.messageType);
        if (!Number.isFinite(t)) {
          return false;
        }

        // Only show the helper for message types that can be represented as
        // simple 3-byte MIDI messages (or realtime 1-byte).
        return [
          ButtonMessageType.Note,
          ButtonMessageType.ControlChange,
          ButtonMessageType.ProgramChange,
          ButtonMessageType.BankSelectProgramChange,
          ButtonMessageType.RealTimeClock,
          ButtonMessageType.RealTimeStart,
          ButtonMessageType.RealTimeContinue,
          ButtonMessageType.RealTimeStop,
          ButtonMessageType.RealTimeActiveSensing,
          ButtonMessageType.RealTimeSystemReset,
        ].includes(t);
      },
      block: Block.Button,
      key: "rawMidiHex",
      type: SectionType.Value,
      section: -1,
      component: FormInputComponent.Input,
      label: "MIDI (HEX)",
      helpText:
        "HEX를 붙여넣으면 버튼 설정으로 변환해 저장합니다. (Note/CC/PC/RealTime 또는 SysEx(F0..F7) 자동 인식)",
    };

    return {
      RawMidiHex: rawMidiHex,
      ...base,
    };
  });

  return {
    componentCount,
    indexRange,
    pages,
    pageSizes,
    sections,
    viewSetting,
  };
};
