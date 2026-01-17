<template>
  <Section title="MIDI Bank Changer" class="w-full">
    <div class="w-full px-4 sm:px-6 lg:px-8">
      <p v-if="!isWebMidiSupported" class="text-sm">
        이 브라우저는 WebMIDI를 지원하지 않습니다.
      </p>

      <div v-else class="max-w-screen-sm">
        <p v-if="!outputs.length" class="text-sm">
          사용할 수 있는 MIDI Output이 없습니다.
        </p>

        <div v-else class="form-grid">
          <div class="form-field">
            <label class="label">MIDI Output</label>
            <select class="form-select mt-1 py-1 text-sm block w-full" v-model="selectedOutputId">
              <option
                v-for="o in outputs"
                :key="o.id"
                :value="o.id"
              >
                {{ o.name }}
              </option>
            </select>
          </div>

          <div class="form-field">
            <label class="label">Channel (1-16)</label>
            <input
              class="form-input mt-1 py-1 text-sm block w-full"
              type="number"
              min="1"
              max="16"
              v-model.number="channel"
            />
          </div>

          <div class="form-field">
            <label class="label">OpenDeck LED 피드백</label>
            <FormToggle
              :value="feedbackCcEnabled"
              @changed="setFeedbackCcEnabled"
            >
              LED 피드백용 CC 보내기
            </FormToggle>

            <p class="text-xs text-gray-500 mt-2">
              OpenDeck의 LED 설정을 "MIDI in / CC (Single value)"로 맞추면,
              각 버튼 번호에 따라 하드웨어 LED를 켤 수 있습니다.
            </p>
          </div>

          <div v-if="feedbackCcEnabled" class="form-field">
            <label class="label">LED Feedback CC# (0-127)</label>
            <input
              class="form-input mt-1 py-1 text-sm block w-full"
              type="number"
              min="0"
              max="127"
              v-model.number="feedbackCcNumber"
            />
          </div>
        </div>

        <div v-if="outputs.length" class="mt-6">
          <div v-if="buttonCount === 0 && touchscreenCount === 0" class="space-y-4">
            <p class="text-sm">
              타겟 보드의 버튼/터치스크린 컴포넌트 개수를 가져오지 못했습니다.
            </p>

            <p class="text-xs text-gray-500">
              보드(OpenDeck) 연결 없이도 전송 기능을 테스트하려면 아래에서 개수를 직접 입력할 수 있습니다.
              보드가 정상 연결되면 자동으로 보드 값을 사용합니다.
            </p>

            <div class="form-grid">
              <div class="form-field">
                <label class="label">테스트용 Buttons 개수</label>
                <input
                  class="form-input mt-1 py-1 text-sm block w-full"
                  type="number"
                  min="0"
                  max="128"
                  v-model.number="manualButtonCount"
                />
              </div>

              <div class="form-field">
                <label class="label">테스트용 Touchscreen 개수</label>
                <input
                  class="form-input mt-1 py-1 text-sm block w-full"
                  type="number"
                  min="0"
                  max="128"
                  v-model.number="manualTouchscreenCount"
                />
              </div>
            </div>
          </div>

          <div v-else class="space-y-8">
            <div v-if="buttonCount > 0" class="space-y-6">
              <p class="text-sm font-semibold">Buttons</p>

              <div
                v-for="index in buttonIndices"
                :key="`btn-${index}`"
                class="form-grid"
              >
                <div class="form-field">
                  <label class="label">버튼 {{ index + 1 }}</label>
                  <Button
                    variant="primary"
                    :disabled="!canSend"
                    :class="{ 'btn-highlight': isLedOn('button', index) }"
                    @click.prevent="sendMappedBankChange('button', index)"
                  >
                    보내기
                  </Button>
                </div>

                <div class="form-field">
                  <label class="label">전송 타입</label>
                  <select class="form-select mt-1 py-1 text-sm block w-full" v-model="buttonMappings[index].mode">
                    <option value="msb+lsb+pc">MSB + LSB + PC</option>
                    <option value="msb+pc">MSB + PC</option>
                    <option value="lsb+pc">LSB + PC</option>
                    <option value="pc">PC만</option>
                    <option value="cc">CC만</option>
                  </select>
                </div>

                <div class="form-field">
                  <label class="label">Bank MSB (CC0, 0-127)</label>
                  <input
                    class="form-input mt-1 py-1 text-sm block w-full"
                    type="number"
                    min="0"
                    max="127"
                    v-model.number="buttonMappings[index].msb"
                  />
                </div>

                <div class="form-field">
                  <label class="label">Bank LSB (CC32, 0-127)</label>
                  <input
                    class="form-input mt-1 py-1 text-sm block w-full"
                    type="number"
                    min="0"
                    max="127"
                    v-model.number="buttonMappings[index].lsb"
                  />
                </div>

                <div
                  v-if="buttonMappings[index].mode !== 'cc' && buttonMappings[index].mode !== 'pc'"
                  class="form-field"
                >
                  <label class="label">Bank (0-16383)</label>
                  <div class="relative">
                    <input
                      class="form-input mt-1 py-1 text-sm block w-full pr-8"
                      type="number"
                      min="0"
                      max="16383"
                      v-model.number="buttonBank[index]"
                      @input="onBankInput('button', index)"
                    />

                    <div class="absolute top-0 right-0 bottom-0 flex flex-col justify-center pr-2">
                      <button
                        class="px-1 text-xs leading-none text-gray-400 hover:text-gray-200 focus:outline-none"
                        type="button"
                        @click="nudgeBank('button', index, 1)"
                        aria-label="Bank +1"
                        title="Bank +1"
                      >
                        ▲
                      </button>
                      <button
                        class="px-1 text-xs leading-none text-gray-400 hover:text-gray-200 focus:outline-none"
                        type="button"
                        @click="nudgeBank('button', index, -1)"
                        aria-label="Bank -1"
                        title="Bank -1"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                  <p class="text-xs text-gray-500 mt-1">
                    MSB = bank >> 7, LSB = bank & 0x7F
                  </p>
                </div>

                <div class="form-field">
                  <label class="label">Program (PC, 0-127)</label>
                  <input
                    class="form-input mt-1 py-1 text-sm block w-full"
                    type="number"
                    min="0"
                    max="127"
                    v-model.number="buttonMappings[index].pc"
                  />
                </div>

                <div
                  v-if="buttonMappings[index].mode === 'cc'"
                  class="form-field"
                >
                  <label class="label">CC# (0-127)</label>
                  <input
                    class="form-input mt-1 py-1 text-sm block w-full"
                    type="number"
                    min="0"
                    max="127"
                    v-model.number="buttonMappings[index].ccNumber"
                  />
                </div>

                <div
                  v-if="buttonMappings[index].mode === 'cc'"
                  class="form-field"
                >
                  <label class="label">CC Value (0-127)</label>
                  <input
                    class="form-input mt-1 py-1 text-sm block w-full"
                    type="number"
                    min="0"
                    max="127"
                    v-model.number="buttonMappings[index].ccValue"
                  />
                </div>
              </div>
            </div>

            <div v-if="touchscreenCount > 0" class="space-y-6">
              <p class="text-sm font-semibold">Touchscreen (Nextion HMI)</p>

              <div
                v-for="index in touchscreenIndices"
                :key="`ts-${index}`"
                class="form-grid"
              >
                <div class="form-field">
                  <label class="label">버튼 {{ buttonCount + index + 1 }}</label>
                  <Button
                    variant="primary"
                    :disabled="!canSend"
                    :class="{ 'btn-highlight': isLedOn('touchscreen', index) }"
                    @click.prevent="sendMappedBankChange('touchscreen', index)"
                  >
                    보내기
                  </Button>
                </div>

                <div class="form-field">
                  <label class="label">전송 타입</label>
                  <select class="form-select mt-1 py-1 text-sm block w-full" v-model="touchscreenMappings[index].mode">
                    <option value="msb+lsb+pc">MSB + LSB + PC</option>
                    <option value="msb+pc">MSB + PC</option>
                    <option value="lsb+pc">LSB + PC</option>
                    <option value="pc">PC만</option>
                    <option value="cc">CC만</option>
                  </select>
                </div>

                <div class="form-field">
                  <label class="label">Bank MSB (CC0, 0-127)</label>
                  <input
                    class="form-input mt-1 py-1 text-sm block w-full"
                    type="number"
                    min="0"
                    max="127"
                    v-model.number="touchscreenMappings[index].msb"
                  />
                </div>

                <div class="form-field">
                  <label class="label">Bank LSB (CC32, 0-127)</label>
                  <input
                    class="form-input mt-1 py-1 text-sm block w-full"
                    type="number"
                    min="0"
                    max="127"
                    v-model.number="touchscreenMappings[index].lsb"
                  />
                </div>

                <div
                  v-if="touchscreenMappings[index].mode !== 'cc' && touchscreenMappings[index].mode !== 'pc'"
                  class="form-field"
                >
                  <label class="label">Bank (0-16383)</label>
                  <div class="relative">
                    <input
                      class="form-input mt-1 py-1 text-sm block w-full pr-8"
                      type="number"
                      min="0"
                      max="16383"
                      v-model.number="touchscreenBank[index]"
                      @input="onBankInput('touchscreen', index)"
                    />

                    <div class="absolute top-0 right-0 bottom-0 flex flex-col justify-center pr-2">
                      <button
                        class="px-1 text-xs leading-none text-gray-400 hover:text-gray-200 focus:outline-none"
                        type="button"
                        @click="nudgeBank('touchscreen', index, 1)"
                        aria-label="Bank +1"
                        title="Bank +1"
                      >
                        ▲
                      </button>
                      <button
                        class="px-1 text-xs leading-none text-gray-400 hover:text-gray-200 focus:outline-none"
                        type="button"
                        @click="nudgeBank('touchscreen', index, -1)"
                        aria-label="Bank -1"
                        title="Bank -1"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                  <p class="text-xs text-gray-500 mt-1">
                    MSB = bank >> 7, LSB = bank & 0x7F
                  </p>
                </div>

                <div class="form-field">
                  <label class="label">Program (PC, 0-127)</label>
                  <input
                    class="form-input mt-1 py-1 text-sm block w-full"
                    type="number"
                    min="0"
                    max="127"
                    v-model.number="touchscreenMappings[index].pc"
                  />
                </div>

                <div
                  v-if="touchscreenMappings[index].mode === 'cc'"
                  class="form-field"
                >
                  <label class="label">CC# (0-127)</label>
                  <input
                    class="form-input mt-1 py-1 text-sm block w-full"
                    type="number"
                    min="0"
                    max="127"
                    v-model.number="touchscreenMappings[index].ccNumber"
                  />
                </div>

                <div
                  v-if="touchscreenMappings[index].mode === 'cc'"
                  class="form-field"
                >
                  <label class="label">CC Value (0-127)</label>
                  <input
                    class="form-input mt-1 py-1 text-sm block w-full"
                    type="number"
                    min="0"
                    max="127"
                    v-model.number="touchscreenMappings[index].ccValue"
                  />
                </div>
              </div>
            </div>

            <p v-if="error" class="text-sm text-red-400">
              {{ error }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Section>
</template>

<script lang="ts">
import {
  defineComponent,
  computed,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import type { Output } from "webmidi";

import { Block } from "../../../definitions";
import { readFromStorage, saveToStorage } from "../../../util";
import { deviceStoreMapped, midiStoreMapped } from "../../../store";

interface BankMapping {
  mode: "msb+lsb+pc" | "msb+pc" | "lsb+pc" | "pc" | "cc";
  msb: number;
  lsb: number;
  pc: number;
  ccNumber: number;
  ccValue: number;
}

type MappingGroup = "button" | "touchscreen";

export default defineComponent({
  name: "MidiBankChanger",
  setup() {
    const selectedOutputId = ref<string>("");
    const channel = ref<number>(1);
    const error = ref<string>("");

    const feedbackCcEnabled = ref<number>(0);
    const feedbackCcNumber = ref<number>(0);

    const setFeedbackCcEnabled = (value: number) => {
      feedbackCcEnabled.value = value;
    };

    const clampInt = (value: unknown, min: number, max: number): number => {
      const n = Math.floor(Number(value));
      if (!Number.isFinite(n)) {
        return min;
      }
      return Math.max(min, Math.min(max, n));
    };

    const bankFromMsbLsb = (msb: unknown, lsb: unknown): number => {
      const safeMsb = clampInt(msb, 0, 127);
      const safeLsb = clampInt(lsb, 0, 127);
      return (safeMsb << 7) + safeLsb;
    };

    const applyBankToMapping = (mapping: BankMapping, bankRaw: unknown) => {
      const bank = clampInt(bankRaw, 0, 16383);
      mapping.msb = (bank >> 7) & 0x7f;
      mapping.lsb = bank & 0x7f;
    };

    const buttonMappings = ref<BankMapping[]>([]);
    const touchscreenMappings = ref<BankMapping[]>([]);

    // Bank UI values are stored separately so MSB/LSB edits always reflect back into
    // the Bank input (even while the input is focused).
    const buttonBank = ref<number[]>([]);
    const touchscreenBank = ref<number[]>([]);

    const syncBankUiFromMappings = (group: MappingGroup) => {
      const mappings =
        group === "button" ? buttonMappings.value : touchscreenMappings.value;
      const bankUi = group === "button" ? buttonBank.value : touchscreenBank.value;

      // Keep length aligned.
      if (bankUi.length !== mappings.length) {
        bankUi.length = mappings.length;
      }

      for (let i = 0; i < mappings.length; i++) {
        const m = mappings[i];
        bankUi[i] = bankFromMsbLsb(m?.msb ?? 0, m?.lsb ?? 0);
      }
    };

    const onBankInput = (group: MappingGroup, index: number) => {
      const mappings =
        group === "button" ? buttonMappings.value : touchscreenMappings.value;
      const mapping = mappings[index];
      if (!mapping) {
        return;
      }

      const bankUi = group === "button" ? buttonBank.value : touchscreenBank.value;
      applyBankToMapping(mapping, bankUi[index]);
    };

    const nudgeBank = (group: MappingGroup, index: number, delta: number) => {
      const bankUi = group === "button" ? buttonBank.value : touchscreenBank.value;
      bankUi[index] = clampInt((bankUi[index] ?? 0) + delta, 0, 16383);
      onBankInput(group, index);
    };

    // If device-reported component counts are unavailable (0/0), allow manual counts for testing.
    const manualButtonCount = ref<number>(0);
    const manualTouchscreenCount = ref<number>(0);

    const deviceButtonCount = computed(() => {
      const count =
        (deviceStoreMapped.numberOfComponents?.value &&
          deviceStoreMapped.numberOfComponents.value[Block.Button]) ||
        0;
      return Number(count) || 0;
    });

    const deviceTouchscreenCount = computed(() => {
      const count =
        (deviceStoreMapped.numberOfComponents?.value &&
          deviceStoreMapped.numberOfComponents.value[Block.Touchscreen]) ||
        0;
      return Number(count) || 0;
    });

    const buttonCount = computed(() => {
      if (deviceButtonCount.value > 0 || deviceTouchscreenCount.value > 0) {
        return deviceButtonCount.value;
      }
      return clampInt(manualButtonCount.value, 0, 128);
    });

    const touchscreenCount = computed(() => {
      if (deviceButtonCount.value > 0 || deviceTouchscreenCount.value > 0) {
        return deviceTouchscreenCount.value;
      }
      return clampInt(manualTouchscreenCount.value, 0, 128);
    });

    const buttonIndices = computed(() => {
      const indices: number[] = [];
      for (let i = 0; i < buttonCount.value; i++) {
        indices.push(i);
      }
      return indices;
    });

    const touchscreenIndices = computed(() => {
      const indices: number[] = [];
      for (let i = 0; i < touchscreenCount.value; i++) {
        indices.push(i);
      }
      return indices;
    });

    const sendLed = reactive<Record<string, boolean>>({});
    const sendLedTimeouts = new Map<string, number>();

    const ledKey = (group: MappingGroup, index: number): string =>
      `${group}:${index}`;

    const isLedOn = (group: MappingGroup, index: number): boolean =>
      !!sendLed[ledKey(group, index)];

    const blinkLed = (group: MappingGroup, index: number) => {
      const key = ledKey(group, index);
      sendLed[key] = true;

      const existing = sendLedTimeouts.get(key);
      if (existing) {
        clearTimeout(existing);
      }

      const timeoutId = window.setTimeout(() => {
        sendLed[key] = false;
        sendLedTimeouts.delete(key);
      }, 250);

      sendLedTimeouts.set(key, timeoutId);
    };

    const outputs = computed(() => (midiStoreMapped.outputs?.value ?? []) as Output[]);
    const isWebMidiSupported = computed(
      () => !!midiStoreMapped.isWebMidiSupported?.value,
    );

    const selectedOutput = computed((): Output | null => {
      if (!selectedOutputId.value) {
        return null;
      }
      return outputs.value.find((o) => o.id === selectedOutputId.value) ?? null;
    });

    const canSend = computed(() => !!selectedOutput.value);

    const refreshPorts = async () => {
      error.value = "";
      try {
        await midiStoreMapped.loadMidi();
        await midiStoreMapped.assignInputs();
      } catch (e) {
        error.value = "WebMIDI 초기화에 실패했습니다.";
      }
    };

    const ensureSelectedOutput = () => {
      if (!outputs.value.length) {
        selectedOutputId.value = "";
        return;
      }

      const hasSelected = !!selectedOutputId.value;
      const isValidSelected =
        hasSelected && outputs.value.some((o) => o.id === selectedOutputId.value);

      if (!hasSelected || !isValidSelected) {
        selectedOutputId.value = outputs.value[0].id;
      }
    };

    const defaultMapping = (): BankMapping => ({
      mode: "msb+lsb+pc",
      msb: 0,
      lsb: 0,
      pc: 0,
      ccNumber: 0,
      ccValue: 0,
    });

    const normalizeMappings = (count: number, input: unknown): BankMapping[] => {
      const out: BankMapping[] = [];
      const arr = Array.isArray(input) ? input : [];

      for (let i = 0; i < count; i++) {
        const item = arr[i] as Partial<BankMapping> | undefined;

        const rawMode = (item as any)?.mode;
        const mode: BankMapping["mode"] =
          rawMode === "msb+pc" ||
          rawMode === "lsb+pc" ||
          rawMode === "pc" ||
          rawMode === "cc"
            ? rawMode
            : "msb+lsb+pc";

        out.push({
          mode,
          msb: clampInt(item?.msb ?? 0, 0, 127),
          lsb: clampInt(item?.lsb ?? 0, 0, 127),
          pc: clampInt(item?.pc ?? 0, 0, 127),
          ccNumber: clampInt((item as any)?.ccNumber ?? 0, 0, 127),
          ccValue: clampInt((item as any)?.ccValue ?? 0, 0, 127),
        });
      }
      return out;
    };

    const storageKey = computed(() => {
      const boardName = deviceStoreMapped.boardName?.value || "unknown";
      return `midisaxo:midi-bank-changer:${boardName}`;
    });

    const loadFromStorage = () => {
      try {
        const saved = readFromStorage(storageKey.value);
        if (saved && typeof saved === "object") {
          if (typeof saved.selectedOutputId === "string") {
            selectedOutputId.value = saved.selectedOutputId;
          }
          if (saved.channel !== undefined) {
            channel.value = clampInt(saved.channel, 1, 16);
          }

          // Backward-compat: legacy saved.mappings => buttonMappings
          const legacyButtonMappings =
            saved.buttonMappings !== undefined
              ? saved.buttonMappings
              : saved.mappings;

          if (legacyButtonMappings !== undefined) {
            buttonMappings.value = normalizeMappings(
              buttonCount.value,
              legacyButtonMappings,
            );
          }

          if (saved.touchscreenMappings !== undefined) {
            touchscreenMappings.value = normalizeMappings(
              touchscreenCount.value,
              saved.touchscreenMappings,
            );
          }

          if (saved.feedbackCcEnabled !== undefined) {
            feedbackCcEnabled.value = saved.feedbackCcEnabled ? 1 : 0;
          }

          if (saved.feedbackCcNumber !== undefined) {
            feedbackCcNumber.value = clampInt(saved.feedbackCcNumber, 0, 127);
          }

          if (saved.manualButtonCount !== undefined) {
            manualButtonCount.value = clampInt(saved.manualButtonCount, 0, 128);
          }

          if (saved.manualTouchscreenCount !== undefined) {
            manualTouchscreenCount.value = clampInt(
              saved.manualTouchscreenCount,
              0,
              128,
            );
          }
        }
      } catch {
        // ignore bad storage
      }
    };

    const persistToStorage = () => {
      try {
        saveToStorage(storageKey.value, {
          selectedOutputId: selectedOutputId.value,
          channel: clampInt(channel.value, 1, 16),
          buttonMappings: buttonMappings.value,
          touchscreenMappings: touchscreenMappings.value,
          feedbackCcEnabled: !!feedbackCcEnabled.value,
          feedbackCcNumber: clampInt(feedbackCcNumber.value, 0, 127),
          manualButtonCount: clampInt(manualButtonCount.value, 0, 128),
          manualTouchscreenCount: clampInt(manualTouchscreenCount.value, 0, 128),
        });
      } catch {
        // ignore storage failures
      }
    };

    const sendMappedBankChange = (group: MappingGroup, index: number) => {
      error.value = "";

      const out = selectedOutput.value;
      if (!out) {
        error.value = "MIDI Output을 선택하세요.";
        return;
      }

      const mappingList =
        group === "touchscreen" ? touchscreenMappings.value : buttonMappings.value;

      const mapping = mappingList[index] || defaultMapping();
      const ch = clampInt(channel.value, 1, 16);
      const msb = clampInt(mapping.msb, 0, 127);
      const lsb = clampInt(mapping.lsb, 0, 127);
      const pc = clampInt(mapping.pc, 0, 127);

      const mode = mapping.mode || "msb+lsb+pc";

      if (mode === "cc") {
        const ccNum = clampInt(mapping.ccNumber, 0, 127);
        const ccVal = clampInt(mapping.ccValue, 0, 127);
        out.sendControlChange(ccNum, ccVal, ch);
      } else if (mode === "pc") {
        out.sendProgramChange(pc, ch);
      } else if (mode === "msb+pc") {
        out.sendControlChange(0, msb, ch);
        out.sendProgramChange(pc, ch);
      } else if (mode === "lsb+pc") {
        out.sendControlChange(32, lsb, ch);
        out.sendProgramChange(pc, ch);
      } else {
        // Default: Bank Select: CC0 (MSB) + CC32 (LSB) then Program Change
        out.sendControlChange(0, msb, ch);
        out.sendControlChange(32, lsb, ch);
        out.sendProgramChange(pc, ch);
      }

      // Optional: send an extra CC for OpenDeck LED block matching.
      // Configure LED block as: Control type = MIDI in / CC (Single value)
      // Activation ID = feedback CC#, Activation Value = 버튼 번호 (1..127)
      if (feedbackCcEnabled.value) {
        const cc = clampInt(feedbackCcNumber.value, 0, 127);
        const value =
          group === "touchscreen" ? buttonCount.value + index + 1 : index + 1;

        if (value < 0 || value > 127) {
          error.value = "LED 피드백 값이 0-127 범위를 초과합니다.";
        } else {
          out.sendControlChange(cc, value, ch);
        }
      }

      // UI feedback only (not hardware LED)
      blinkLed(group, index);
    };

    onMounted(async () => {
      await refreshPorts();
      ensureSelectedOutput();

      if (!buttonMappings.value.length) {
        buttonMappings.value = normalizeMappings(buttonCount.value, []);
      }
      if (!touchscreenMappings.value.length) {
        touchscreenMappings.value = normalizeMappings(touchscreenCount.value, []);
      }
      loadFromStorage();

      // Storage may contain an outputId that is no longer available.
      ensureSelectedOutput();
    });

    watch(outputs, () => {
      ensureSelectedOutput();
    });

    watch(buttonCount, (count) => {
      buttonMappings.value = normalizeMappings(count, buttonMappings.value);
      syncBankUiFromMappings("button");
    });

    watch(touchscreenCount, (count) => {
      touchscreenMappings.value = normalizeMappings(count, touchscreenMappings.value);
      syncBankUiFromMappings("touchscreen");
    });

    watch(
      buttonMappings,
      () => {
        syncBankUiFromMappings("button");
      },
      { deep: true },
    );

    watch(
      touchscreenMappings,
      () => {
        syncBankUiFromMappings("touchscreen");
      },
      { deep: true },
    );

    watch(storageKey, () => {
      loadFromStorage();
    });

    watch(
      [
        selectedOutputId,
        channel,
        buttonMappings,
        touchscreenMappings,
        feedbackCcEnabled,
        feedbackCcNumber,
        manualButtonCount,
        manualTouchscreenCount,
      ],
      () => {
        persistToStorage();
      },
      { deep: true },
    );

    return {
      outputs,
      isWebMidiSupported,
      selectedOutputId,
      channel,
      feedbackCcEnabled,
      feedbackCcNumber,
      setFeedbackCcEnabled,
      manualButtonCount,
      manualTouchscreenCount,
      buttonCount,
      touchscreenCount,
      buttonIndices,
      touchscreenIndices,
      buttonMappings,
      touchscreenMappings,
      buttonBank,
      touchscreenBank,
      canSend,
      error,
      isLedOn,
      sendMappedBankChange,
      bankFromMsbLsb,
      onBankInput,
      nudgeBank,
    };
  },
});
</script>
