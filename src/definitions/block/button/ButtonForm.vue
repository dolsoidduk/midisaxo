<template>
  <form class="relative section" novalidate @submit.prevent="">
    <h1 class="w-full section-heading">
      <div class="section-heading-inner flex">
        <router-link class="mr-6" :to="{ name: blockDefinition.routeName }">
          <h2>{{ blockDefinition.title }}s</h2>
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
            <label class="label">
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

          <div v-if="isBankSelectProgramChange" :class="`col-span-${gridCols}`">
            <div class="form-field">
              <label class="label">
                Bank 계산기
                <small class="instructions">MSB/LSB ↔ Bank(0-16383)</small>
              </label>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label class="label text-xs">MSB (0-127)</label>
                  <input
                    v-model.number="bankCalcMsb"
                    class="form-input mt-1 py-1 text-sm block w-full"
                    type="number"
                    min="0"
                    max="127"
                  />
                </div>

                <div>
                  <label class="label text-xs">LSB (0-127)</label>
                  <input
                    v-model.number="bankCalcLsb"
                    class="form-input mt-1 py-1 text-sm block w-full"
                    type="number"
                    min="0"
                    max="127"
                  />
                </div>

                <div>
                  <label class="label text-xs">계산된 Bank</label>
                  <div class="relative mt-1">
                    <input
                      v-model.number="calcBankModel"
                      class="form-input py-1 text-sm block w-full pr-8"
                      type="number"
                      min="0"
                      max="16383"
                    />

                    <div class="absolute top-0 right-0 bottom-0 flex flex-col justify-center pr-2">
                      <button
                        class="px-1 text-xs leading-none text-gray-400 hover:text-gray-200 focus:outline-none"
                        type="button"
                        @click="nudgeCalcBank(1)"
                        aria-label="Bank +1"
                        title="Bank +1"
                      >
                        ▲
                      </button>
                      <button
                        class="px-1 text-xs leading-none text-gray-400 hover:text-gray-200 focus:outline-none"
                        type="button"
                        @click="nudgeCalcBank(-1)"
                        aria-label="Bank -1"
                        title="Bank -1"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <p class="help-text">
                현재 Bank={{ bankValue }} → MSB={{ bankMsbFromBank }} / LSB={{ bankLsbFromBank }}
              </p>
              <p class="help-text">
                전송 순서: CC#0(MSB) → CC#32(LSB) → Program Change
              </p>

              <button class="btn btn-xs" type="button" @click="applyCalcBank">
                Bank에 적용
              </button>
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
import { useDeviceForm } from "../../../composables";
import { deviceStoreMapped, deviceStore } from "../../../store";
import router from "../../../router";
import { parseHexBytes, parseRawMidiToButton } from "../../../util/raw-midi";

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

    const rawMidiText = ref("");
    const rawMidiError = ref<string | null>(null);
    const rawMidiHelpText = ref<string>(
      "HEX를 붙여넣으면 버튼 설정으로 변환해 저장합니다. (Note/CC/PC/RealTime 자동 인식)",
    );
    const rawMidiPendingSave = ref(false);

    const isBankSelectProgramChange = computed(
      () =>
        Number(deviceForm.formData.messageType) ===
        ButtonMessageType.BankSelectProgramChange,
    );

    const bankValue = computed(() => {
      const raw = Number(deviceForm.formData.value ?? 0);
      if (!Number.isFinite(raw)) {
        return 0;
      }
      return Math.max(0, Math.min(16383, raw));
    });

    const bankMsbFromBank = computed(() => (bankValue.value >> 7) & 0x7f);
    const bankLsbFromBank = computed(() => bankValue.value & 0x7f);

    const bankCalcMsb = ref(0);
    const bankCalcLsb = ref(0);

    // Keep calculator inputs in sync with the current Bank field.
    watch(
      () => [isBankSelectProgramChange.value, bankValue.value] as const,
      ([enabled]) => {
        if (!enabled) {
          return;
        }
        bankCalcMsb.value = bankMsbFromBank.value;
        bankCalcLsb.value = bankLsbFromBank.value;
      },
      { immediate: true },
    );

    const calcBank = computed(() => {
      const msb = Math.max(0, Math.min(127, Number(bankCalcMsb.value) || 0));
      const lsb = Math.max(0, Math.min(127, Number(bankCalcLsb.value) || 0));
      return (msb << 7) + lsb;
    });

    const calcBankModel = computed<number>({
      get: () => calcBank.value,
      set: (value: number) => {
        const bank = Math.max(0, Math.min(16383, Math.floor(Number(value) || 0)));
        bankCalcMsb.value = (bank >> 7) & 0x7f;
        bankCalcLsb.value = bank & 0x7f;
      },
    });

    const nudgeCalcBank = (delta: number) => {
      calcBankModel.value = calcBankModel.value + delta;
    };

    const applyCalcBank = async () => {
      const bank = Math.max(0, Math.min(16383, calcBank.value));

      // Always keep local state in sync.
      deviceForm.formData.value = bank;

      // If not connected, don't try to write to the device.
      if (!isDeviceConnected.value) {
        return;
      }

      // Write without toggling the global loading overlay (prevents UI flicker).
      await setValueAndUpdate("value", 3, bank);
    };

    // Auto-apply calculator changes to the real Bank field.
    // This keeps the stored Bank(value) in sync without requiring a manual button click.
    const autoApplyTimeoutId = ref<number | null>(null);
    const scheduleAutoApplyCalcBank = () => {
      if (!isBankSelectProgramChange.value) {
        return;
      }

      const target = Math.max(0, Math.min(16383, calcBank.value));
      const current = bankValue.value;

      // Avoid redundant writes / loops.
      if (target === current) {
        return;
      }

      if (autoApplyTimeoutId.value) {
        window.clearTimeout(autoApplyTimeoutId.value);
      }

      autoApplyTimeoutId.value = window.setTimeout(async () => {
        autoApplyTimeoutId.value = null;
        // Re-check after debounce
        const newTarget = Math.max(0, Math.min(16383, calcBank.value));
        if (newTarget === bankValue.value) {
          return;
        }
        await applyCalcBank();
      }, 250);
    };

    watch(
      () => [isBankSelectProgramChange.value, calcBank.value, bankValue.value] as const,
      ([enabled]) => {
        if (!enabled) {
          return;
        }
        scheduleAutoApplyCalcBank();
      },
    );

    const showRawMidiHex = computed(() => true);

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
        // no-op
      },
    );

    watch(
      () => index.value,
      () => {
        rawMidiPendingSave.value = false;
        rawMidiError.value = null;
        rawMidiHelpText.value =
          "HEX를 붙여넣으면 버튼 설정으로 변환해 저장합니다. (Note/CC/PC/RealTime 자동 인식)";
      },
    );

    watch(
      () => isDeviceConnected.value,
      async (connected) => {
        if (!connected) {
          return;
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
      isBankSelectProgramChange,
      bankValue,
      bankMsbFromBank,
      bankLsbFromBank,
      bankCalcMsb,
      bankCalcLsb,
      calcBank,
      calcBankModel,
      nudgeCalcBank,
      applyCalcBank,
    };
  },
});
</script>
