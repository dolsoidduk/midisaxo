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

        <div v-if="isCustomSysEx" :class="`col-span-${gridCols}`">
          <div class="form-field" :class="{ error: !!sysExError }">
            <label class="label">
              SysEx (HEX)
              <small class="instructions">F0 ... F7 포함해서 입력</small>
            </label>

            <textarea
              v-model="sysExText"
              class="form-input mt-1 py-1 text-sm block w-full"
              rows="4"
              name="sysexHex"
              placeholder="예: F0 7E 7F 06 01 F7"
              @change="saveSysExMacro"
            />

            <p class="help-text">
              최대 32바이트(F0/F7 제외)까지 저장됩니다. SysEx는 이 버튼 번호에 매핑되어 디바이스에 저장됩니다.
            </p>
            <p v-if="sysExHelpText" class="help-text">{{ sysExHelpText }}</p>
            <p v-if="sysExError" class="error-message text-red-500">
              {{ sysExError }}
            </p>

            <div class="mt-2">
              <label class="label">
                SysEx 캡처 입력 포트
                <small class="instructions">외부 장치 → 브라우저(WebMIDI)로 들어오는 SysEx</small>
              </label>

              <select
                v-model="sysExCaptureInputId"
                class="form-input mt-1 py-1 text-sm block w-full"
                :disabled="isSysExCaptureArmed"
              >
                <option value="">(자동 선택)</option>
                <option v-for="p in availableMidiInputs" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select>

              <p class="help-text">
                캡처를 시작하면 SysEx 1개를 수신하는 즉시 이 버튼에 저장합니다.
              </p>
            </div>

            <div class="mt-2 flex gap-2">
              <button class="btn btn-xs" type="button" @click="toggleSysExCapture">
                {{ isSysExCaptureArmed ? "SysEx 캡처 중지" : "MIDI에서 SysEx 1회 캡처" }}
              </button>
              <button class="btn btn-xs" type="button" @click="reloadSysExMacro">
                디바이스 값 다시 불러오기
              </button>
              <button class="btn btn-xs" type="button" @click="saveSysExMacro">
                저장
              </button>
            </div>
          </div>
        </div>

          <div v-if="isBankSelectProgramChange && !isCustomSysEx" :class="`col-span-${gridCols}`">
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
            v-if="showFieldForCurrentMode(section)"
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
import { defineComponent, computed, ref, watch, onBeforeUnmount } from "vue";
import type { Input, InputEventBase } from "webmidi";
import {
  Block,
  ButtonMessageType,
  SectionType,
  openDeckManufacturerId,
} from "../../interface";
import { useDeviceForm } from "../../../composables";
import { deviceStoreMapped, deviceStore } from "../../../store";
import router from "../../../router";
import { parseHexBytes, parseRawMidiToButton } from "../../../util/raw-midi";
import { midiState } from "../../midi/midi-store/state";
import { ErrorCode, getErrorDefinition } from "../../error";

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

    const isCustomSysEx = computed(
      () => Number(deviceForm.formData.messageType) === ButtonMessageType.CustomSysEx,
    );

    const showFieldForCurrentMode = (section: any): boolean => {
      // If SysEx is selected, keep this button dedicated to SysEx.
      // Only allow changing the messageType (to switch away from SysEx).
      if (isCustomSysEx.value) {
        return section?.key === "messageType";
      }
      return deviceForm.showField(section);
    };

    const sysExText = ref("");
    const sysExError = ref<string | null>(null);
    const sysExHelpText = ref<string | null>(null);

    // SysEx capture (learn): listen on a MIDI input port and store the first SysEx received.
    const availableMidiInputs = computed(() => midiState.inputs);
    const sysExCaptureInputId = ref<string>("");
    const isSysExCaptureArmed = ref(false);
    let sysExCaptureAttachedInput: Input | null = null;
    let sysExCaptureHandler: ((e: InputEventBase<"sysex">) => void) | null = null;

    const detachSysExCapture = (): void => {
      if (sysExCaptureAttachedInput && sysExCaptureHandler) {
        try {
          sysExCaptureAttachedInput.removeListener(
            "sysex",
            "all",
            sysExCaptureHandler as any,
          );
        } catch {
          // ignore
        }
      }
      sysExCaptureAttachedInput = null;
      sysExCaptureHandler = null;
      isSysExCaptureArmed.value = false;
    };

    const pickCaptureInput = (): Input | null => {
      const inputs = availableMidiInputs.value || [];
      if (!inputs.length) {
        return null;
      }

      if (sysExCaptureInputId.value) {
        return inputs.find((i) => i.id === sysExCaptureInputId.value) || null;
      }

      // Prefer a non-OpenDeck port to avoid capturing configurator traffic.
      return inputs.find((i) => !i.name.includes("OpenDeck")) || inputs[0];
    };

    // Firmware storage slots are addressed by a 7-bit VALUE (0-127).
    // We map SysEx storage index to the button index so users don't have to manage slots.
    const SYSEX_MACRO_COUNT = 128;
    const SYSEX_MACRO_MAX_LENGTH = 32;

    // Section indices differ across firmware versions:
    // - Newer: LENGTH=6, DATA=7 (with RESERVED at 5)
    // - Older: LENGTH=5, DATA=6
    const SYSEX_SECTIONS_NEW = { length: 6, data: 7 } as const;
    const SYSEX_SECTIONS_OLD = { length: 5, data: 6 } as const;
    const resolvedSysExSections = ref<{ length: number; data: number } | null>(
      null,
    );

    const formatDeviceError = (e: unknown): string => {
      const asNumber = Number(e);
      if (Number.isFinite(asNumber)) {
        const def = getErrorDefinition(asNumber as ErrorCode);
        return `${asNumber} (${ErrorCode[asNumber as ErrorCode] || "UNKNOWN"}): ${def.description}`;
      }
      if (e instanceof Error) {
        return e.message;
      }
      if (typeof e === "string") {
        return e;
      }
      return JSON.stringify(e);
    };

    const isSectionOrNotSupportedError = (e: unknown): boolean => {
      const asNumber = Number(e);
      return (
        Number.isFinite(asNumber) &&
        [ErrorCode.SECTION, ErrorCode.NOT_SUPPORTED].includes(
          asNumber as ErrorCode,
        )
      );
    };

    const resolveSysExSections = async (): Promise<
      { length: number; data: number } | null
    > => {
      if (resolvedSysExSections.value) {
        return resolvedSysExSections.value;
      }

      if (!isDeviceConnected.value) {
        // Best-effort default; connection is required to probe.
        return SYSEX_SECTIONS_NEW;
      }

      // Probe slot 0 length section. It should always be readable (0 if unused).
      try {
        await deviceStore.actions.getValue(
          Block.Button,
          SYSEX_SECTIONS_NEW.length,
          0,
        );
        resolvedSysExSections.value = { ...SYSEX_SECTIONS_NEW };
        return resolvedSysExSections.value;
      } catch (e) {
        if (!isSectionOrNotSupportedError(e)) {
          throw e;
        }
      }

      try {
        await deviceStore.actions.getValue(
          Block.Button,
          SYSEX_SECTIONS_OLD.length,
          0,
        );
        resolvedSysExSections.value = { ...SYSEX_SECTIONS_OLD };
        return resolvedSysExSections.value;
      } catch (e) {
        if (!isSectionOrNotSupportedError(e)) {
          throw e;
        }
      }

      // Not supported on this firmware/target.
      return null;
    };

    const attachSysExCapture = (): void => {
      detachSysExCapture();

      if (!isCustomSysEx.value) {
        sysExError.value = "SysEx 모드에서만 캡처할 수 있습니다.";
        return;
      }

      if (!availableMidiInputs.value.length) {
        sysExError.value =
          "사용 가능한 MIDI 입력 포트가 없습니다. (WebMIDI 권한/장치 연결 상태를 확인해주세요)";
        return;
      }

      const input = pickCaptureInput();
      if (!input) {
        sysExError.value = "캡처 입력 포트를 선택할 수 없습니다.";
        return;
      }

      isSysExCaptureArmed.value = true;
      sysExHelpText.value = `SysEx 캡처 대기 중: ${input.name} (1회 수신 후 자동 저장)`;
      sysExError.value = null;

      const handler = (event: InputEventBase<"sysex">): void => {
        const data = Array.from(event.data || []);
        if (data.length < 2 || data[0] !== 0xf0 || data[data.length - 1] !== 0xf7) {
          return;
        }

        // Ignore OpenDeck configurator protocol traffic.
        if (
          data.length >= 5 &&
          data[1] === openDeckManufacturerId[0] &&
          data[2] === openDeckManufacturerId[1] &&
          data[3] === openDeckManufacturerId[2]
        ) {
          return;
        }

        // One-shot capture.
        detachSysExCapture();

        const normalized = data
          .map((b) => Number(b).toString(16).toUpperCase().padStart(2, "0"))
          .join(" ");
        sysExText.value = normalized;
        sysExHelpText.value = `SysEx 캡처 완료: ${input.name}`;

        // Auto-save (best effort). If device isn't connected, text remains for later.
        void (async () => {
          try {
            await saveSysExMacro();
          } catch (e) {
            sysExError.value = `캡처 저장 실패: ${formatDeviceError(e)}`;
          }
        })();
      };

      sysExCaptureAttachedInput = input;
      sysExCaptureHandler = handler;

      try {
        input.addListener("sysex", "all", handler as any);
      } catch (e) {
        detachSysExCapture();
        sysExError.value = `SysEx 캡처 시작 실패: ${formatDeviceError(e)}`;
      }
    };

    const toggleSysExCapture = (): void => {
      if (isSysExCaptureArmed.value) {
        detachSysExCapture();
        sysExHelpText.value = "SysEx 캡처가 중지되었습니다.";
        return;
      }
      attachSysExCapture();
    };

    const desiredMacroIndex = computed(() => {
      // Button indices in UI are 0-based.
      const i = index.value;
      return Math.max(0, Math.min(SYSEX_MACRO_COUNT - 1, Math.floor(i)));
    });

    const parseSysExText = ():
      | { ok: true; payload: number[]; normalized: string }
      | { ok: false; error: string } => {
      const parsed = parseHexBytes(sysExText.value);
      if (parsed.error) {
        return { ok: false, error: parsed.error };
      }

      const bytes = parsed.bytes;
      if (bytes.length < 2) {
        return { ok: false, error: "SysEx는 최소 2바이트(F0...F7)여야 합니다." };
      }
      if (bytes[0] !== 0xf0 || bytes[bytes.length - 1] !== 0xf7) {
        return { ok: false, error: "F0로 시작하고 F7로 끝나야 합니다." };
      }

      const payload = bytes.slice(1, -1);

      if (payload.length > SYSEX_MACRO_MAX_LENGTH) {
        return {
          ok: false,
          error: `최대 ${SYSEX_MACRO_MAX_LENGTH}바이트(F0/F7 제외)까지만 저장 가능합니다.`,
        };
      }

      const invalid = payload.find((b) => b < 0 || b > 0x7f);
      if (typeof invalid === "number") {
        return {
          ok: false,
          error:
            "SysEx payload는 00-7F(7-bit 데이터)만 허용됩니다. 예: 0x90 같은 MIDI 상태바이트는 SysEx에 넣을 수 없습니다. (Note/CC/PC는 SysEx가 아니라 위의 MIDI(HEX)로 설정하세요)",
        };
      }

      const normalized = [0xf0, ...payload, 0xf7]
        .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
        .join(" ");

      return { ok: true, payload, normalized };
    };

    const clampMacroSlot = async () => {
      if (!isCustomSysEx.value) {
        return;
      }

      if (index.value >= SYSEX_MACRO_COUNT) {
        sysExError.value =
          `이 버튼 인덱스(${index.value})는 SysEx 저장 범위(0-${SYSEX_MACRO_COUNT - 1})를 초과합니다.`;
        return;
      }

      const current = Number(deviceForm.formData.value ?? 0);
      const next = desiredMacroIndex.value;

      if (next === current) {
        return;
      }

      // Always set local state.
      deviceForm.formData.value = next;

      // If connected, persist the clamped slot back to device.
      if (!isDeviceConnected.value) {
        return;
      }

      try {
        await setValueAndUpdate("value", 3, next);
      } catch {
        // ignore; UI state is still clamped
      }
    };

    const reloadSysExMacro = async () => {
      if (!isCustomSysEx.value) {
        return;
      }
      sysExError.value = null;
      sysExHelpText.value = null;

      if (!isDeviceConnected.value) {
        sysExHelpText.value = "장치가 연결되어 있지 않습니다.";
        return;
      }

      const macroIndex = desiredMacroIndex.value;
      deviceForm.loading.value = true;
      try {
        const sections = await resolveSysExSections();
        if (!sections) {
          sysExHelpText.value =
            "현재 펌웨어/타겟에서는 SysEx 저장소 불러오기를 지원하지 않습니다. (펌웨어 업데이트가 필요할 수 있어요)";
          return;
        }

        const length = await deviceStore.actions.getValue(
          Block.Button,
          sections.length,
          macroIndex,
        );
        const safeLength = Math.max(0, Math.min(SYSEX_MACRO_MAX_LENGTH, length));

        const payload: number[] = [];
        for (let i = 0; i < safeLength; i++) {
          const dataIndex = macroIndex * SYSEX_MACRO_MAX_LENGTH + i;
          const b = await deviceStore.actions.getValue(
            Block.Button,
            sections.data,
            dataIndex,
          );
          payload.push(b & 0xff);
        }

        sysExText.value = [0xf0, ...payload, 0xf7]
          .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
          .join(" ");
        sysExHelpText.value = `슬롯 ${macroIndex} 불러오기 완료 (길이 ${payload.length})`;
      } catch (e) {
        sysExError.value = `불러오기 실패: ${formatDeviceError(e)}`;
      } finally {
        deviceForm.loading.value = false;
      }
    };

    const saveSysExMacro = async () => {
      if (!isCustomSysEx.value) {
        return;
      }

      sysExError.value = null;
      sysExHelpText.value = null;

      const parsed = parseSysExText();
      if (!parsed.ok) {
        sysExError.value = parsed.error;
        return;
      }

      // Normalize the text for consistency.
      sysExText.value = parsed.normalized;

      if (!isDeviceConnected.value) {
        sysExHelpText.value = "장치가 연결되어 있지 않아, 지금은 저장할 수 없습니다.";
        return;
      }

      const macroIndex = desiredMacroIndex.value;
      deviceForm.loading.value = true;
      try {
        const sections = await resolveSysExSections();
        if (!sections) {
          sysExError.value =
            "현재 펌웨어/타겟에서는 SysEx 저장을 지원하지 않습니다. (펌웨어 업데이트가 필요할 수 있어요)";
          return;
        }

        // 1) Write length
        await deviceStore.actions.setComponentSectionValue(
          {
            block: Block.Button,
            section: sections.length,
            index: macroIndex,
            value: parsed.payload.length,
          } as any,
          () => {
            // no-op
          },
        );

        // 2) Write payload bytes
        for (let i = 0; i < parsed.payload.length; i++) {
          const dataIndex = macroIndex * SYSEX_MACRO_MAX_LENGTH + i;
          await deviceStore.actions.setComponentSectionValue(
            {
              block: Block.Button,
              section: sections.data,
              index: dataIndex,
              value: parsed.payload[i],
            } as any,
            () => {
              // no-op
            },
          );
        }

        sysExHelpText.value = `슬롯 ${macroIndex} 저장 완료 (길이 ${parsed.payload.length})`;
      } catch (e) {
        sysExError.value = `저장 실패: ${formatDeviceError(e)}`;
      } finally {
        deviceForm.loading.value = false;
      }
    };

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

    // Raw MIDI paste helper is for Note/CC/PC/RealTime mapping.
    // When SysEx Macro is selected, keep the button dedicated to SysEx.
    const showRawMidiHex = computed(() => !isCustomSysEx.value);

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
      () => [isDeviceConnected.value, isCustomSysEx.value, desiredMacroIndex.value] as const,
      async ([connected, enabled]) => {
        if (!connected || !enabled) {
          return;
        }
        await clampMacroSlot();
        await reloadSysExMacro();
      },
      { immediate: true },
    );

    watch(
      () => isCustomSysEx.value,
      async (enabled) => {
        if (!enabled) {
          detachSysExCapture();
          sysExError.value = null;
          sysExHelpText.value = null;
          return;
        }

        sysExHelpText.value =
          "SysEx는 F0..F7 형식이며, payload는 00-7F(7-bit)만 가능합니다. 예: F0 7E 7F 06 01 F7";

        await clampMacroSlot();
      },
      { immediate: true },
    );

    onBeforeUnmount(() => {
      detachSysExCapture();
    });

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
      showFieldForCurrentMode,
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
      isCustomSysEx,
      sysExText,
      sysExError,
      sysExHelpText,
      availableMidiInputs,
      sysExCaptureInputId,
      isSysExCaptureArmed,
      toggleSysExCapture,
      reloadSysExMacro,
      saveSysExMacro,
    };
  },
});
</script>
