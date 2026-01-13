<template>
  <form class="relative section" novalidate @submit.prevent="">
    <h1 class="w-full section-heading">
      <div class="section-heading-inner flex">
        <router-link class="mr-6" :to="{ name: blockDefinition.routeName }">
          <h2>{{ blockDefinition.title }}</h2>
        </router-link>
        <span class="mr-6">&rsaquo;</span>
        <div class="mr-6 text-gray-400">
          {{ blockDefinition.title }}
          <strong>
            {{ index }}
          </strong>
        </div>
        <div class="hidden md:block md:flex-grow text-right">
          <Siblinks
            param-key="index"
            :current="index"
            :total="numberOfComponents[block]"
            :params="{ outputId }"
          />
        </div>
      </div>
    </h1>

    <SpinnerOverlay v-if="loading" />

    <p class="text-sm mb-4" v-if="deviceLabel">
      연결된 장치: <strong>{{ deviceLabel }}</strong>
      <template v-if="firmwareVersion"> / FW: {{ firmwareVersion }}</template>
      <template v-if="isBootloaderMode"> / Bootloader 모드</template>
    </p>

    <div class="section-content">
      <div class="form-grid" :class="`lg:grid-cols-${gridCols}`">
        <div v-if="showRawMidiHex" :class="`col-span-${gridCols}`">
          <div class="form-field" :class="{ error: !!rawMidiError }">
            <label class="label text-promoted">
              MIDI (HEX)
              <small class="instructions">Note/CC/PC/RealTime 지원</small>
            </label>

            <input
              v-model="rawMidiText"
              class="form-input mt-1 py-1 text-sm block w-full"
              type="text"
              name="rawMidiHex"
              placeholder="예: 90 3C 7F / B0 07 40 / C0 10 / FA"
              @change="applyRawMidiText"
            />

            <p v-if="rawMidiHelpText" class="help-text">{{ rawMidiHelpText }}</p>
            <p v-if="rawMidiError" class="error-message text-red-500">
              {{ rawMidiError }}
            </p>
          </div>
        </div>

        <div v-if="isCustomSysEx" :class="`col-span-${gridCols}`">
          <div class="form-field" :class="{ error: !!sysexError }">
            <label class="label">
              SysEx (HEX)
              <small class="instructions">최대 16바이트 (payload 14)</small>
            </label>

            <input
              v-model="sysexText"
              class="form-input mt-1 py-1 text-sm block w-full"
              type="text"
              name="customSysExHex"
              placeholder="예: F0 43 10 4C 00 00 7F F7"
              @change="applySysexText"
            />

            <p v-if="sysexHelpText" class="help-text">{{ sysexHelpText }}</p>
            <p class="help-text">
              <template v-if="varPos === 0">
                치환: 사용 안 함 (Variable byte index = 0)
              </template>
              <template v-else>
                치환: index {{ varPos }} 의 바이트를 value {{ varValue }}(0x{{
                  varValueHex
                }})로 전송합니다.
              </template>
            </p>
            <p v-if="sysexPreviewOriginal" class="help-text">
              미리보기(원본): {{ sysexPreviewOriginal }}
            </p>
            <p v-if="sysexPreviewTransmit" class="help-text">
              미리보기(전송): {{ sysexPreviewTransmit }}
            </p>
            <p v-if="sysexVarWarning" class="error-message text-red-500">
              {{ sysexVarWarning }}
            </p>
            <p v-if="sysexError" class="error-message text-red-500">
              {{ sysexError }}
            </p>
          </div>
        </div>

        <template v-for="section in sections">
          <FormField
            v-if="showField(section)"
            :key="section.key"
            :class="`col-span-${section.colspan || 1}`"
            :value="formData[section.key]"
            :field-definition="section"
            @modified="onValueChange"
          />
        </template>
      </div>
    </div>
  </form>
</template>

<script lang="ts">
import { defineComponent, computed, ref, watch } from "vue";
import { Block, ButtonMessageType, SectionType } from "../../interface";
import { ErrorCode } from "../../error";
import { useDeviceForm } from "../../../composables";
import { deviceStoreMapped, deviceStore } from "../../../store";
import router from "../../../router";
import { parseHexBytes, parseRawMidiToButton } from "../../../util/raw-midi";

// Firmware stores only SysEx payload (bytes between F0 and F7) as 7-bit safe bytes.
// Payload is packed into 8x 14-bit words: word = b0 | (b1 << 7)
// Total transmitted SysEx length is payload + 2 (F0/F7), limited to 16 bytes.
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

  // Allow either full SysEx (F0 .. F7) or payload-only.
  if (hasF0 || hasF7)
  {
    if (!(hasF0 && hasF7))
    {
      return {
        payload: [],
        truncated: false,
        error:
          "SysEx는 F0로 시작하고 F7로 끝나야 합니다. (또는 payload만 입력하세요)",
      };
    }

    if (bytes.length < 2)
    {
      return {
        payload: [],
        truncated: false,
        error: "SysEx 길이가 너무 짧습니다.",
      };
    }
  }

  const payload = hasF0 && hasF7 ? bytes.slice(1, -1) : bytes.slice();

  for (const b of payload)
  {
    if (b < 0 || b > 0x7f)
    {
      return {
        payload: [],
        truncated: false,
        error:
          "SysEx payload 바이트는 00..7F 범위여야 합니다. (F0/F7는 자동 처리됩니다)",
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

const wordsToBytes = (words: number[]): number[] => {
  const bytes: number[] = [];
  for (const wordRaw of words) {
    const word = Number(wordRaw ?? 0) & 0x3fff;
    bytes.push(word & 0x7f);
    bytes.push((word >> 7) & 0x7f);
  }
  return bytes;
};

const formatHex = (bytes: number[]): string =>
  bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");

export default defineComponent({
  name: "ButtonForm",
  props: {
    block: {
      required: true,
      type: Number as () => Block,
    },
    gridCols: {
      default: 3,
      type: Number,
    },
  },
  setup(props) {
    const {
      numberOfComponents,
      outputId,
      isConnected: isDeviceConnected,
      boardName,
      firmwareVersion,
      isBootloaderMode,
      name: inputName,
      manufacturer: inputManufacturer,
    } = deviceStoreMapped;
    const index = computed(() => Number(router.currentRoute.value.params.index));

    const deviceForm = useDeviceForm(props.block, SectionType.Value, index);

    const sysexText = ref("");
    const sysexError = ref<string | null>(null);
    const sysexHelpText = ref<string>(
      "HEX를 공백/콤마로 나누어서 입력하세요. (F0..F7 포함 또는 payload만) 입력 후 포커스를 옮기면 저장됩니다. (.../… 생략 표기는 무시됩니다)",
    );
    const sysexDirty = ref(false);
    const sysexPendingSave = ref(false);

    const rawMidiText = ref("");
    const rawMidiError = ref<string | null>(null);
    const rawMidiHelpText = ref<string>(
      "HEX를 붙여넣으면 버튼 설정으로 변환해 저장합니다. (Note/CC/PC/RealTime 또는 SysEx(F0..F7) 자동 인식)",
    );
    const rawMidiPendingSave = ref(false);

    const isCustomSysEx = computed(
      () =>
        Number(deviceForm.formData.messageType) ===
        ButtonMessageType.CustomSysEx,
    );

    const showRawMidiHex = computed(() => {
      const t = Number(deviceForm.formData.messageType);
      if (!Number.isFinite(t)) {
        return false;
      }

      if (isCustomSysEx.value) {
        return false;
      }

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
    });

    const deviceLabel = computed(() => {
      const parts: string[] = [];
      if (inputManufacturer?.value) {
        parts.push(String(inputManufacturer.value));
      }
      if (boardName?.value) {
        parts.push(String(boardName.value));
      } else if (inputName?.value) {
        parts.push(String(inputName.value));
      }
      return parts.filter(Boolean).join(" ");
    });

    const varPos = computed(() => Number(deviceForm.formData.midiId ?? 0));
    const varValue = computed(() => Number(deviceForm.formData.value ?? 0) & 0x7f);
    const varValueHex = computed(() =>
      varValue.value.toString(16).toUpperCase().padStart(2, "0"),
    );

    const getPayloadFromSysexText = (): {
      payload: number[];
      truncated: boolean;
      error?: string;
    } => {
      const parsed = parseHexBytes(sysexText.value);
      if (parsed.error) {
        return { payload: [], truncated: false, error: parsed.error };
      }
      return normalizeSysexPayload(parsed.bytes);
    };

    const buildFullSysexFromPayload = (payload: number[]): number[] => {
      if (!payload.length) {
        return [];
      }
      return [0xf0, ...payload.slice(0, CUSTOM_SYSEX_MAX_PAYLOAD_BYTES), 0xf7];
    };

    const sysexPreviewOriginal = computed(() => {
      if (!isCustomSysEx.value) {
        return "";
      }

      const parsed = getPayloadFromSysexText();
      if (parsed.error || !parsed.payload.length) {
        return "";
      }

      const bytes = buildFullSysexFromPayload(parsed.payload);
      const pos = varPos.value;

      return bytes
        .map((b, i) => {
          const hex = b.toString(16).toUpperCase().padStart(2, "0");
          return pos !== 0 && i === pos ? `[${hex}]` : hex;
        })
        .join(" ");
    });

    const sysexPreviewTransmit = computed(() => {
      if (!isCustomSysEx.value) {
        return "";
      }

      const parsed = getPayloadFromSysexText();
      if (parsed.error || !parsed.payload.length) {
        return "";
      }

      const bytes = buildFullSysexFromPayload(parsed.payload);
      const pos = varPos.value;
      const substituted = bytes.map((b, i) =>
        pos !== 0 && i === pos ? varValue.value : b,
      );

      return substituted
        .map((b, i) => {
          const hex = b.toString(16).toUpperCase().padStart(2, "0");
          return pos !== 0 && i === pos ? `[${hex}]` : hex;
        })
        .join(" ");
    });

    const sysexVarWarning = computed(() => {
      if (!isCustomSysEx.value) {
        return "";
      }

      const parsed = getPayloadFromSysexText();
      if (parsed.error) {
        return "";
      }

      const length = parsed.payload.length ? parsed.payload.length + 2 : 0;
      if (length === 0) {
        return "";
      }

      if (varPos.value === 0) {
        return "";
      }

      // Firmware uses full-message indexing and disallows targeting the trailing 0xF7.
      if (varPos.value < 0 || varPos.value >= length - 1) {
        return `Variable byte index(${varPos.value})가 SysEx 길이(${length}) 범위를 벗어납니다. (F0 포함 인덱스)`;
      }

      return "";
    });

    const buildSysexFromForm = () => {
      const length = Number(deviceForm.formData.sysExLength ?? 0);
      const words = [
        deviceForm.formData.sysExData0,
        deviceForm.formData.sysExData1,
        deviceForm.formData.sysExData2,
        deviceForm.formData.sysExData3,
        deviceForm.formData.sysExData4,
        deviceForm.formData.sysExData5,
        deviceForm.formData.sysExData6,
        deviceForm.formData.sysExData7,
      ].map((v) => Number(v ?? 0));

      const payload = wordsToBytes(words).slice(0, Math.max(0, length));
      const full = buildFullSysexFromPayload(payload);
      return full.length ? formatHex(full) : "";
    };

    const refreshSysexTextFromDeviceState = () => {
      if (!isCustomSysEx.value) {
        return;
      }
      if (sysexDirty.value) {
        return;
      }
      sysexText.value = buildSysexFromForm();
    };

    const setValueAndUpdate = async (
      key: string,
      section: number,
      value: number,
    ) => {
      const cfg = {
        block: props.block,
        section,
        index: index.value,
        value,
      };

      // Optimistically update local state so UI doesn't lose edits on transient failures.
      deviceForm.formData[key] = value;
      await deviceStore.actions.setComponentSectionValue(cfg as any, () => {
        // no-op: local state already updated optimistically
      });
    };

    const applySysexText = async () => {
      if (!isCustomSysEx.value) {
        return;
      }

      sysexDirty.value = true;
      sysexError.value = null;

      const parsed = parseHexBytes(sysexText.value);
      if (parsed.error) {
        sysexError.value = parsed.error;
        return;
      }

      const normalized = normalizeSysexPayload(parsed.bytes);
      if (normalized.error) {
        sysexError.value = normalized.error;
        return;
      }

      const payload = normalized.payload;

      if (normalized.truncated) {
        sysexHelpText.value =
          `payload는 최대 ${CUSTOM_SYSEX_MAX_PAYLOAD_BYTES}바이트까지만 저장됩니다. (자동으로 잘림)`;
      } else {
        sysexHelpText.value =
          "HEX를 공백/콤마로 나누어서 입력하세요. (F0..F7 포함 또는 payload만) 입력 후 포커스를 옮기면 저장됩니다. (.../… 생략 표기는 무시됩니다)";
      }

      const length = payload.length;
      const words = bytesToWords(payload);

      // Always reflect parsed bytes in local form state.
      deviceForm.formData.sysExLength = length;
      for (let i = 0; i < 8; i++) {
        (deviceForm.formData as any)[`sysExData${i}`] = words[i] ?? 0;
      }

      // If not connected, update local state only and defer writing.
      if (!isDeviceConnected.value) {
        sysexPendingSave.value = true;
        sysexHelpText.value =
          "장치가 연결되어 있지 않습니다. 연결되면 자동으로 저장됩니다.";
        return;
      }

      deviceForm.loading.value = true;
      try {
        await setValueAndUpdate("sysExLength", 6, length);
        for (let i = 0; i < 8; i++) {
          await setValueAndUpdate(`sysExData${i}`, 7 + i, words[i] ?? 0);
        }
      } catch (e) {
        const errorCode = typeof e === "number" ? (e as number) : undefined;

        // Some errors are not transient and shouldn't be auto-retried.
        const isNonTransient =
          errorCode === ErrorCode.SECTION ||
          errorCode === ErrorCode.BLOCK ||
          errorCode === ErrorCode.NOT_SUPPORTED;

        sysexPendingSave.value = !isNonTransient;

        if (errorCode === ErrorCode.SECTION) {
          sysexError.value =
            "SysEx 저장에 실패했습니다. (7=SECTION) 현재 보드 펌웨어가 Custom SysEx 저장 섹션을 지원하지 않는 것 같습니다. " +
            "최신 펌웨어(UF2)로 업데이트 후 다시 시도해주세요." +
            (deviceLabel.value ? ` (현재 연결: ${deviceLabel.value})` : "");
          return;
        }

        if (errorCode === ErrorCode.HANDSHAKE) {
          sysexError.value =
            "SysEx 저장에 실패했습니다. (3=HANDSHAKE) 장치 연결이 초기화되지 않았습니다. 장치를 다시 선택/연결 후 시도해주세요.";
          return;
        }

        const message =
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : JSON.stringify(e);

        sysexError.value =
          "SysEx 저장에 실패했습니다. 연결/권한(WebMIDI SysEx) 상태를 확인해주세요." +
          (message ? ` (${message})` : "");
      } finally {
        deviceForm.loading.value = false;
      }
    };

    const applyRawMidiText = async () => {
      if (!showRawMidiHex.value) {
        return;
      }

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

      // Always reflect parsed mapping in local state.
      deviceForm.formData.messageType = mapped.messageType;
      if (typeof mapped.midiChannel === "number") {
        deviceForm.formData.midiChannel = mapped.midiChannel;
      }
      if (typeof mapped.midiId === "number") {
        deviceForm.formData.midiId = mapped.midiId;
      }
      if (typeof mapped.value === "number") {
        deviceForm.formData.value = mapped.value;
      }

      if (isSysExMapping) {
        const length = mapped.sysEx!.length;
        const words = mapped.sysEx!.words;

        deviceForm.formData.sysExLength = length;
        for (let i = 0; i < 8; i++) {
          (deviceForm.formData as any)[`sysExData${i}`] = words[i] ?? 0;
        }

        // Keep the dedicated SysEx field in sync for visibility/editing.
        sysexDirty.value = true;
        sysexError.value = null;
        sysexText.value = length
          ? formatHex([0xf0, ...mapped.sysEx!.payload.slice(0, length), 0xf7])
          : "";

        if (mapped.sysEx!.truncated) {
          sysexHelpText.value =
            `SysEx는 최대 ${CUSTOM_SYSEX_MAX_TOTAL_BYTES}바이트(총길이) / payload ${CUSTOM_SYSEX_MAX_PAYLOAD_BYTES}바이트까지만 저장됩니다. (자동으로 잘림)`;
        } else {
          sysexHelpText.value =
            "HEX를 공백/콤마로 나누어서 입력하세요. (F0..F7 포함 또는 payload만) 입력 후 포커스를 옮기면 저장됩니다. (.../… 생략 표기는 무시됩니다)";
        }
      }

      // If not connected, update local state only and defer writing.
      if (!isDeviceConnected.value) {
        rawMidiPendingSave.value = true;
        rawMidiHelpText.value =
          "장치가 연결되어 있지 않습니다. 연결되면 자동으로 저장됩니다.";
        return;
      }

      deviceForm.loading.value = true;
      try {
        await setValueAndUpdate("messageType", 1, mapped.messageType);

        if (isSysExMapping) {
          // Ensure substitution defaults are stored (varPos/varValue).
          if (typeof mapped.midiId === "number") {
            await setValueAndUpdate("midiId", 2, mapped.midiId);
          }
          if (typeof mapped.value === "number") {
            await setValueAndUpdate("value", 3, mapped.value);
          }

          const length = mapped.sysEx!.length;
          const words = mapped.sysEx!.words;
          await setValueAndUpdate("sysExLength", 6, length);
          for (let i = 0; i < 8; i++) {
            await setValueAndUpdate(`sysExData${i}`, 7 + i, words[i] ?? 0);
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
      } finally {
        deviceForm.loading.value = false;
      }
    };

    // Refresh when data loads / index changes
    watch(
      () => deviceForm.loading.value,
      (isLoading) => {
        if (!isLoading) {
          refreshSysexTextFromDeviceState();
        }
      },
    );

    watch(
      () => index.value,
      () => {
        sysexDirty.value = false;
        sysexPendingSave.value = false;
        sysexError.value = null;
        sysexHelpText.value =
          "HEX를 공백/콤마로 나누어서 입력하세요. (F0..F7 포함 또는 payload만) 입력 후 포커스를 옮기면 저장됩니다. (.../… 생략 표기는 무시됩니다)";
        refreshSysexTextFromDeviceState();

        rawMidiPendingSave.value = false;
        rawMidiError.value = null;
        rawMidiHelpText.value =
          "HEX를 붙여넣으면 버튼 설정으로 변환해 저장합니다. (Note/CC/PC/RealTime 또는 SysEx(F0..F7) 자동 인식)";
      },
    );

    watch(
      () => isCustomSysEx.value,
      (enabled) => {
        sysexDirty.value = false;
        sysexPendingSave.value = false;
        sysexError.value = null;
        if (enabled) {
          refreshSysexTextFromDeviceState();
        }

        rawMidiPendingSave.value = false;
        rawMidiError.value = null;
      },
    );

    watch(
      () => isDeviceConnected.value,
      async (connected) => {
        if (!connected) {
          return;
        }
        if (!sysexPendingSave.value) {
          // continue - raw MIDI might still be pending
        }

        if (sysexPendingSave.value) {
          sysexPendingSave.value = false;
          await applySysexText();
        }

        if (rawMidiPendingSave.value) {
          rawMidiPendingSave.value = false;
          await applyRawMidiText();
        }
      },
    );

    return {
      ...deviceForm,
      outputId,
      numberOfComponents,
      index,
      deviceLabel,
      firmwareVersion,
      isBootloaderMode,
      showRawMidiHex,
      rawMidiText,
      rawMidiError,
      rawMidiHelpText,
      applyRawMidiText,
      isCustomSysEx,
      sysexText,
      sysexError,
      sysexHelpText,
      sysexPreviewOriginal,
      sysexPreviewTransmit,
      sysexVarWarning,
      varPos,
      varValue,
      varValueHex,
      applySysexText,
    };
  },
});
</script>
