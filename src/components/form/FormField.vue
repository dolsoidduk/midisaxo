<template>
  <div
    v-if="(!isMsb || showMsbControls)"
    class="form-field"
    :class="{
      error: errors.length,
    }"
  >
    <label class="label">
      {{
        !showMsbControls && isLsb
          ? label.replace("(LSB)", "").replace("LSB", "")
          : label
      }}
      <InfoTooltip
        v-if="normalizedHelpText"
        :text="normalizedHelpText"
      />
      <small v-if="!isDisabled && (min || max)" class="instructions"
        >{{ min }} - {{ (!showMsbControls && max2Byte) || max }}</small
      >
    </label>

    <div v-if="!isDisabled" class="flex items-center gap-2">
      <div v-if="isBreathOffsetField" class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <component
            :is="fieldComponent"
            :value="input"
            v-bind="componentProps"
            @changed="onValueChange"
          />
          <span
            v-if="extraInfoText"
            class="text-xs text-gray-200 whitespace-nowrap px-2 py-1 rounded border border-gray-700 bg-gray-800 font-mono"
          >
            {{ extraInfoText }}
          </span>
        </div>

        <input
          class="w-56"
          type="range"
          min="0"
          max="100"
          step="1"
          :value="breathSliderValue"
          @input="onBreathSliderInput"
        />
      </div>

      <template v-else>
        <component
          :is="fieldComponent"
          :value="input"
          v-bind="componentProps"
          @changed="onValueChange"
        />
        <span
          v-if="extraInfoText"
          class="text-xs text-gray-200 whitespace-nowrap px-2 py-1 rounded border border-gray-700 bg-gray-800 font-mono"
        >
          {{ extraInfoText }}
        </span>
      </template>
    </div>
    <p v-else class="error-message text-red-500">
      <template v-if="isDisabled === ControlDisableType.NotSupported">
        이 디바이스에서는 지원되지 않습니다.
      </template>
      <template v-if="isDisabled === ControlDisableType.MissingIndex">
        이 펌웨어에서는 지원되지 않습니다.
      </template>
      <template v-if="isDisabled === ControlDisableType.UartInterfaceAllocated">
        이 주변장치에 필요한 보드의 UART 인터페이스가 이미 다른 주변장치에 의해
        사용 중입니다.
      </template>
    </p>

    <FormErrorDisplay class="error-message" :errors="errors" />
  </div>
</template>

<script lang="ts">
import { defineComponent, toRefs, computed } from "vue";
import {
  FormInputComponent,
  ISectionDefinition,
  ISectionSetting,
  ControlDisableType,
} from "../../definitions";
import { deviceStoreMapped } from "../../store";
import {
  required,
  minValue,
  maxValue,
  allowedValues,
} from "../../composables/validators";
import { useInputValidator } from "../../composables";
import FormSelect from "./FormSelect.vue";
import FormToggle from "./FormToggle.vue";
import FormInput from "./FormInput.vue";
import FormErrorDisplay from "./FormErrorDisplay.vue";
import InfoTooltip from "../elements/InfoTooltip.vue";

const getValidatorForDefinition = (definition: ISectionDefinition) => {
  const validators = [required()] as any[];

  switch (definition.component) {
    case FormInputComponent.Toggle:
      validators.push(minValue(0), maxValue(1));
      break;

    case FormInputComponent.Input:
      if (definition.min !== undefined) {
        validators.push(minValue(definition.min));
      }
      if (definition.max !== undefined) {
        // For newer versions with 2-byte data protocol values can be bigger
        let maxSize =
          definition.max2Byte && deviceStoreMapped.showMsbControls
            ? definition.max2Byte
            : definition.max;
        validators.push(maxValue(maxSize));
      }
      break;

    case FormInputComponent.Select:
      if (definition.options && Array.isArray(definition.options)) {
        validators.push(
          allowedValues(definition.options.map((opt) => opt.value)),
        );
      }
      break;

    default:
      throw new Error(
        `Unknown component type ${definition.component} for ${definition.key}`,
      );
  }

  return validators;
};

export default defineComponent({
  name: "FormField",
  components: {
    FormSelect,
    FormInput,
    FormToggle,
    FormErrorDisplay,
    InfoTooltip,
  },
  props: {
    value: {
      default: null,
      type: [String, Number],
    },
    fieldDefinition: {
      type: Object as () => ISectionDefinition,
      required: true,
    },
    index: {
      type: Number,
      default: undefined, // Used in table-view
    },
    simpleLayout: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["modified"],
  setup(props, { emit }) {
    const { fieldDefinition } = toRefs(props);
    const {
      component,
      key,
      section,
      label,
      helpText,
      isMsb,
      isLsb,
      min,
      max,
      max2Byte,
      options,
      onLoad,
    } = fieldDefinition.value;

    const settingIndex = (props.fieldDefinition as ISectionSetting)
      .settingIndex;

    const isDisabled = computed(() =>
      deviceStoreMapped.isControlDisabled(props.fieldDefinition),
    );

    const valueRef = toRefs(props).value;
    const validators = getValidatorForDefinition(props.fieldDefinition);
    const isBreathOffsetField = key === "saxBreathControllerMidPercent";
    let pendingEmitTimer: ReturnType<typeof setTimeout> | null = null;

    const emitModified = (numericValue: number) => {
      emit("modified", {
        key,
        value: numericValue,
        section,
        settingIndex, // defined for settings only
        index: props.index, // defined for column view only
        onLoad, // handles storing value to special store sections (ie active preset)
      });
    };

    const valueChangeHandler = (value: any) => {
      const numericValue = Number(value);
      if (numericValue === valueRef.value) {
        return;
      }

      // For breath offset tuning, react while typing but avoid spamming MIDI writes.
      if (isBreathOffsetField) {
        if (pendingEmitTimer) {
          clearTimeout(pendingEmitTimer);
        }
        pendingEmitTimer = setTimeout(() => emitModified(numericValue), 250);
        return;
      }

      emitModified(numericValue);
    };
    const { input, errors, onValueChange } = useInputValidator(
      valueRef,
      validators,
      valueChangeHandler,
    );

    const extraInfoText = computed(() => {
      // MIDI Saxophone: show a quick preview for breath controller offset
      if (key !== "saxBreathControllerMidPercent") {
        return "";
      }

      const raw = Number(input.value);
      if (!Number.isFinite(raw)) {
        return "";
      }

      const clamped = Math.max(0, Math.min(100, raw));
      // OpenDeck UI help texts commonly assume 12-bit ADC range 0-4095
      const adcMax = 4095;
      const adcMid = Math.round((clamped / 100) * adcMax);
      return `미리보기: 무호흡 기준 ADC ≈ ${adcMid} / ${adcMax} (${clamped}%)`;
    });

    const componentProps = {
      label,
      helpText,
      name: key,
    } as any;

    if (isBreathOffsetField) {
      componentProps.updateOnInput = true;
    }

    if (component === FormInputComponent.Select) {
      componentProps.options = options;
    }

    const { showMsbControls } = deviceStoreMapped;

    const normalizedHelpText = computed((): string => {
      const raw = helpText || "";
      if (!raw) {
        return "";
      }

      return !showMsbControls.value && raw
        ? raw.replace("(LSB)", "").replace("LSB", "")
        : raw;
    });

    const breathSliderValue = computed(() => {
      if (!isBreathOffsetField) {
        return 0;
      }
      const raw = Number(input.value);
      if (!Number.isFinite(raw)) {
        return 0;
      }
      return Math.max(0, Math.min(100, Math.round(raw)));
    });

    const onBreathSliderInput = (event: Event) => {
      const value = (event.target as HTMLInputElement | null)?.value;
      onValueChange(value as any);
    };

    return {
      fieldComponent: props.fieldDefinition.component,
      showMsbControls,
      componentProps,
      emit,
      input,
      errors,
      onValueChange,
      extraInfoText,
      isBreathOffsetField,
      breathSliderValue,
      onBreathSliderInput,
      label,
      helpText,
      normalizedHelpText,
      isDisabled,
      isMsb,
      isLsb,
      min,
      max,
      max2Byte,
      ControlDisableType,
    };
  },
});
</script>
