<template>
  <div class="form-table-row">
    <div>
      <span
        class="btn"
        :class="{
          'btn-highlight': isHighlighted,
        }"
      >
        {{ index }}
      </span>
    </div>
    <template v-for="section in sections">
      <div
        v-if="section.key === 'rawMidiHex' && showField(section, formData)"
        :key="`${index}-raw-midi-hex`"
        class="form-field"
        :class="{ error: !!rawMidiError }"
      >
        <label class="label text-promoted">
          MIDI (HEX)
          <small class="instructions">Note/CC/PC/RealTime</small>
        </label>

        <input
          v-model="rawMidiText"
          class="form-input mt-1 py-1 text-sm block w-full"
          type="text"
          :name="`rawMidiHex-${index}`"
          placeholder="예: 90 3C 7F / B0 07 40 / C0 10 / FA"
          @change="applyRawMidiText"
        />

        <p v-if="rawMidiHelpText" class="help-text">{{ rawMidiHelpText }}</p>
        <p v-if="rawMidiError" class="error-message text-red-500">
          {{ rawMidiError }}
        </p>
      </div>
      <FormField
        v-else-if="showField(section, formData)"
        :key="section.key"
        :index="index"
        :value="formData[section.key]"
        :field-definition="section"
        @modified="onValueChange"
      />
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, toRefs, ref, computed, watch } from "vue";
import { useHighlightAnimation } from "./../../composables/use-highlight-animation";
import { Block, ButtonMessageType } from "./../../definitions";
import { deviceStore, deviceStoreMapped } from "../../store";
import { parseHexBytes, parseRawMidiToButton } from "../../util/raw-midi";

export default defineComponent({
  name: "DeviceTableComponentRow",
  props: {
    formData: {
      type: Object,
      default: () => ({}),
    },
    showField: {
      required: true,
      type: Function,
    },
    onValueChange: {
      required: true,
      type: Function,
    },
    index: {
      required: true,
      type: Number,
    },
    sections: {
      required: true,
      type: Object,
    },
    highlight: {
      type: Number,
      default: null,
    },
  },
  setup(props) {
    const { highlight } = toRefs(props);

    const rawMidiText = ref("");
    const rawMidiError = ref<string | null>(null);
    const rawMidiHelpText = ref<string>(
      "HEX를 붙여넣으면 버튼 설정으로 변환해 저장합니다. (Note/CC/PC/RealTime 또는 SysEx(F0..F7) 자동 인식)",
    );
    const rawMidiPendingSave = ref(false);

    const isMidiConnected = (): boolean => {
      const maybeRef = (deviceStoreMapped as any).isConnected;
      if (maybeRef && typeof maybeRef === "object" && "value" in maybeRef) {
        return !!maybeRef.value;
      }
      return !!maybeRef;
    };

    const isCustomSysEx = computed(
      () => Number((props.formData as any)?.messageType) === ButtonMessageType.CustomSysEx,
    );

    const setValueAndUpdate = async (
      key: string,
      section: number,
      value: number,
    ) => {
      // Optimistically update local state so UI reflects changes.
      (props.formData as any)[key] = value;

      await deviceStore.actions.setComponentSectionValue(
        {
          block: Block.Button,
          section,
          index: props.index,
          value,
        } as any,
        () => {
          // no-op
        },
      );
    };

    const applyRawMidiText = async () => {
      rawMidiError.value = null;

      const parsed = parseHexBytes(rawMidiText.value);
      if (parsed.error) {
        rawMidiError.value = parsed.error;
        return;
      }

      const mapped = parseRawMidiToButton(parsed.bytes);
      if ("error" in mapped) {
        rawMidiError.value = mapped.error;
        return;
      }

      const isSysExMapping =
        mapped.messageType === ButtonMessageType.CustomSysEx && !!mapped.sysEx;

      // Always reflect mapping in local state
      (props.formData as any).messageType = mapped.messageType;
      if (typeof mapped.midiChannel === "number") {
        (props.formData as any).midiChannel = mapped.midiChannel;
      }
      if (typeof mapped.midiId === "number") {
        (props.formData as any).midiId = mapped.midiId;
      }
      if (typeof mapped.value === "number") {
        (props.formData as any).value = mapped.value;
      }

      if (isSysExMapping) {
        (props.formData as any).sysExLength = mapped.sysEx!.length;
        for (let i = 0; i < 8; i++) {
          (props.formData as any)[`sysExData${i}`] = mapped.sysEx!.words[i] ?? 0;
        }
      }

      if (!isMidiConnected()) {
        rawMidiPendingSave.value = true;
        rawMidiHelpText.value =
          "장치가 연결되어 있지 않습니다. 연결되면 다시 변경(포커스 이동)해주세요.";
        return;
      }

      try {
        await setValueAndUpdate("messageType", 1, mapped.messageType);

        if (isSysExMapping) {
          // Ensure defaults are persisted for Custom SysEx.
          if (typeof mapped.midiId === "number") {
            await setValueAndUpdate("midiId", 2, mapped.midiId);
          }
          if (typeof mapped.value === "number") {
            await setValueAndUpdate("value", 3, mapped.value);
          }

          await setValueAndUpdate("sysExLength", 6, mapped.sysEx!.length);
          for (let i = 0; i < 8; i++) {
            await setValueAndUpdate(
              `sysExData${i}`,
              7 + i,
              mapped.sysEx!.words[i] ?? 0,
            );
          }

          rawMidiHelpText.value = mapped.sysEx!.truncated
            ? "저장되었습니다. (SysEx가 길어서 자동으로 잘렸습니다)"
            : "저장되었습니다.";
          return;
        }

        if (typeof mapped.midiChannel === "number") {
          await setValueAndUpdate("midiChannel", 4, mapped.midiChannel);
        }
        if (typeof mapped.midiId === "number") {
          await setValueAndUpdate("midiId", 2, mapped.midiId);
        }
        if (typeof mapped.value === "number") {
          await setValueAndUpdate("value", 3, mapped.value);
        }
        rawMidiHelpText.value = "저장되었습니다.";
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : JSON.stringify(e);
        rawMidiError.value =
          "저장에 실패했습니다. 연결/권한(WebMIDI) 상태를 확인해주세요." +
          (message ? ` (${message})` : "");
      }
    };

    watch(
      () => isCustomSysEx.value,
      () => {
        rawMidiError.value = null;
        rawMidiPendingSave.value = false;
      },
    );

    watch(
      () => isMidiConnected(),
      async (connected) => {
        if (!connected) {
          return;
        }
        if (!rawMidiPendingSave.value) {
          return;
        }
        rawMidiPendingSave.value = false;
        await applyRawMidiText();
      },
    );

    return {
      ...useHighlightAnimation(highlight),
      rawMidiText,
      rawMidiError,
      rawMidiHelpText,
      applyRawMidiText,
    };
  },
});
</script>
