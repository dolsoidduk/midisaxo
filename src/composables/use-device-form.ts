import { ref, reactive, onMounted, watch } from "vue";
import {
  Block,
  BlockMap,
  SectionType,
  ISectionDefinition,
  getDefaultDataForBlock,
  IBlockDefinition,
} from "../definitions";
import { delay, logger } from "../util";
import { deviceStore } from "../store";
import { midiStoreMapped } from "../store";

interface IDeviceForm {
  formData: Ref<any>;
  loading: Ref<boolean>;
  loadData: Promise<void>;
  onSettingChange: Promise<void>;
  onValueChange: Promise<void>;
  showField(definition: ISectionDefinition): boolean;
  sections: Array<ISectionDefinition>;
  blockDefinition: IBlockDefinition;
}

export const useDeviceForm = (
  block: Block,
  sectionType: SectionType,
  indexRef?: Ref<number>,
): IDeviceForm => {
  const loading = ref(true);
  const defaultData = getDefaultDataForBlock(block, sectionType);
  const formData = reactive(defaultData);

  const isMidiConnected = (): boolean => {
    const maybeRef = (midiStoreMapped as any).isConnected;
    if (maybeRef && typeof maybeRef === "object" && "value" in maybeRef) {
      return !!maybeRef.value;
    }
    return !!maybeRef;
  };

  const showField = (sectionDef: ISectionDefinition): boolean =>
    sectionDef && (!sectionDef.showIf || sectionDef.showIf(formData));

  const shouldAutoSwitchDinAndTouchscreen = (): boolean => {
    const boardName = (deviceStore.state.boardName || "").toLowerCase();
    return boardName.includes("midisaxo xiao rp2040");
  };

  const isTouchscreenSupported = (): boolean => {
    const count = deviceStore.state.numberOfComponents?.[Block.Touchscreen] || 0;
    return count > 0;
  };

  const syncDinMidiAndTouchscreenIfNeeded = async (
    changedBlock: Block,
    changedKey: string,
    newValue: number,
  ): Promise<void> => {
    if (!shouldAutoSwitchDinAndTouchscreen() || !isTouchscreenSupported()) {
      return;
    }

    // Enforce exclusive usage on Midisaxo XIAO RP2040 targets where DIN MIDI and
    // touchscreen share the same UART pins.
    if (changedBlock === Block.Global && changedKey === "dinMidiState") {
      const desiredTouchscreen = newValue ? 0 : 1;
      await deviceStore.actions
        .setComponentSectionValue(
          {
            block: Block.Touchscreen,
            section: 0,
            index: 0,
            value: desiredTouchscreen,
          },
          () => undefined,
        )
        .catch(() => undefined);
      return;
    }

    if (changedBlock === Block.Touchscreen && changedKey === "enableTouchscreen") {
      const desiredDinMidi = newValue ? 0 : 1;
      await deviceStore.actions
        .setComponentSectionValue(
          {
            block: Block.Global,
            section: 0,
            index: 3,
            value: desiredDinMidi,
          },
          () => undefined,
        )
        .catch(() => undefined);
    }
  };

  const sections = deviceStore.actions.getFilteredSectionsForBlock(
    block,
    sectionType,
  );

  const loadData = async () => {
    if (!isMidiConnected()) {
      loading.value = false;
      return;
    }

    loading.value = true;
    const indexVal =
      sectionType === SectionType.Value && indexRef
        ? indexRef.value
        : undefined;

    try {
      const componentConfig = await deviceStore.actions.getComponentSettings(
        block,
        sectionType,
        indexVal,
      );
      Object.assign(formData, componentConfig);
    } catch (error) {
      logger.error("ERROR WHILE LOADING FORM DATA", error);
      loading.value = false;
      return;
    }

    // prevent initial value change from writing to device
    delay(100).then(() => (loading.value = false));
  };

  const onChange = async (
    key: string,
    config: IRequestConfig,
    onLoad?: (value: number) => void,
  ) => {
    if (loading.value) {
      return;
    }

    // Allow UI to be usable even when the device is not connected.
    // In that case we only update local state (no MIDI writes).
    if (!isMidiConnected()) {
      formData[key] = config.value;
      if (onLoad) {
        onLoad(config.value);
      }
      return;
    }

    // Optimistically update local state so conditional fields can react
    // immediately, while the device write is pending.
    formData[key] = config.value;
    if (onLoad) {
      onLoad(config.value);
    }

    loading.value = true;

    try {
      await deviceStore.actions.setComponentSectionValue(config, () => undefined);
      await syncDinMidiAndTouchscreenIfNeeded(block, key, config.value);
      delay(100).then(() => (loading.value = false));
      if (onLoad) {
        onLoad(config.value);
      }
    } catch (error) {
      logger.error("ERROR WHILE SAVING SETTING DATA", error);
      // Try reloading the formData to reinit without failed fields
      await loadData();
    }
  };

  interface IValueChangeParams {
    key: string;
    value: number;
    section: number;
    settingIndex: number;
    onLoad?: (value: number) => void;
  }

  const onSettingChange = (params: IValueChangeParams) => {
    const { key, value, section, settingIndex, onLoad } = params;
    const config = { block, section, index: settingIndex, value };

    return onChange(key, config, onLoad);
  };

  const onValueChange = (params: IValueChangeParams) => {
    const { key, value, section, onLoad } = params;
    const config = { block, section, index: indexRef.value, value };

    return onChange(key, config, onLoad);
  };

  onMounted(() => {
    if (isMidiConnected()) {
      return loadData();
    }
    loading.value = false;
  });

  watch(
    () => isMidiConnected(),
    (connected) => {
      if (connected) {
        loadData();
      }
    },
  );
  if (indexRef) {
    watch([indexRef], () => indexRef && indexRef.value && loadData());
  }

  return {
    formData,
    loading,
    loadData,
    onSettingChange,
    onValueChange,
    showField,
    sections,
    blockDefinition: BlockMap[block],
  };
};
