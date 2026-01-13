<template>
  <form class="relative flex flex-wrap flex-grow" novalidate @submit.prevent="">
    <div v-if="loading" class="absolute flex inset-0 opacity-75 bg-gray-900">
      <Spinner class="self-center" />
    </div>

    <Section title="MIDI Saxophone" class="w-full">
      <div class="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <p class="text-sm mb-6">
          야마하 YDS-150 키 시스템 지원 (크로매틱 순서로 키 레지스터 + 브레스 컨트롤러).
        </p>

        <div
          v-if="!isConnected"
          class="surface-neutral border rounded px-4 py-3 mb-6 text-sm"
        >
          <div class="text-gray-200 font-semibold">연결 안내</div>
          <div class="mt-2 text-gray-300">
            WebMIDI 권한(MIDI+SysEx)을 먼저 허용한 뒤 보드를 선택하세요.
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <router-link
              :to="{ name: 'home' }"
              class="px-3 py-1 border border-gray-600 rounded text-gray-200 hover:border-gray-400"
            >
              홈(보드 선택)으로 이동
            </router-link>
            <span class="text-gray-400">
              → <strong>SysEx 권한 요청 + Reload</strong> 클릭 → 보드 선택
            </span>
          </div>
          <div class="mt-2 text-xs text-gray-400">권장 브라우저: Chrome/Edge</div>
        </div>

        <p v-else-if="!hasSaxSections" class="text-sm mb-6">
          이 UI 빌드에는 색소폰 설정 항목이 포함되어 있지 않습니다.
        </p>

        <div class="surface-neutral border rounded px-4 py-3 mb-6 text-sm">
          <div class="text-gray-200 font-semibold">설정 설명</div>
          <div
            v-if="isConnected && saxRegisterKeyMapSupport === 'unsupported'"
            class="mt-2 text-gray-300"
          >
            이 펌웨어에서는 레지스터 키 매핑 저장을 지원하지 않습니다.
          </div>
          <div
            class="mt-2 grid gap-3"
            style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));"
          >
            <div
              v-for="item in saxHelpItems"
              :key="`help-${item.key}`"
              class="text-xs"
              :class="{ 'opacity-60': !item.isVisible }"
            >
              <div class="text-gray-200 font-semibold">
                {{ item.label }}
                <span v-if="item.rangeText" class="text-gray-400 font-normal">({{ item.rangeText }})</span>
              </div>
              <div v-if="item.disabledText" class="mt-1 text-red-400">
                {{ item.disabledText }}
              </div>
              <div v-else-if="item.description" class="mt-1 text-gray-300 whitespace-pre-line">
                {{ item.description }}
              </div>
            </div>
          </div>
        </div>

        <div
          class="form-grid sax-settings-grid mb-8"
          :class="{ 'pointer-events-none opacity-50': !isConnected }"
        >
          <template v-for="section in saxSections" :key="section.key">
            <div v-if="showField(section)" class="flex flex-col gap-1">
              <FormField
                v-if="section.key !== 'saxRegisterChromaticTranspose'"
                :value="formData[section.key]"
                :field-definition="section"
                :simple-layout="true"
                @modified="onSaxSettingChange"
              />

              <div
                v-if="isConnected && section.key === 'saxBreathControllerMidPercent'"
                class="text-xs text-gray-300 whitespace-nowrap"
              >
                현재 출력:
                <span class="ml-2 font-mono text-yellow-300">{{ breathCcStatusLine }}</span>
                <span v-if="lastBreathCcTime" class="ml-2 text-gray-500">({{ lastBreathCcTime }})</span>
                <button
                  class="ml-2 px-1.5 py-0.5 border border-gray-700 rounded text-[10px] text-gray-200 hover:border-gray-500"
                  @click.prevent="clearBreathActivity"
                >
                  clear
                </button>
              </div>
            </div>
          </template>
        </div>

        <div
          v-if="isConnected && formData.saxRegisterChromaticEnable"
          class="mb-6"
        >
          <div class="flex items-center gap-2 mb-2">
            <h4 class="heading mb-0">레지스터 키 맵(미리보기)</h4>
            <div class="flex-grow"></div>
            <Button
              v-if="registerKeys.length > registerPreviewDefaultCount"
              size="sm"
              variant="secondary"
              @click.prevent="showRegisterPreviewAll = !showRegisterPreviewAll"
            >
              {{ showRegisterPreviewAll ? "처음만" : "전체" }}
            </Button>
          </div>
          <p class="text-sm mb-3">
            레지스터 키 인덱스(디지털 입력)와 실제 전송되는 노트 번호를 보여줍니다.
          </p>

          <Hero
            v-if="!registerKeyCount"
            custom="h-20"
            title="레지스터 키 수를 확인할 수 없습니다. (버튼 컴포넌트 수가 0이거나 아직 로드되지 않았습니다.)"
          />

          <div v-else class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));">
            <div
              v-for="key in visibleRegisterKeys"
              :key="key.index"
              class="surface-neutral border rounded px-2 py-2"
            >
              <div class="text-xs">
                <strong>키 {{ key.index }}</strong>
              </div>
              <div class="text-xs text-gray-400 mt-0.5">
                레지스터 키: <strong>{{ key.mappedIndex }}</strong>
              </div>
              <div class="text-xs mt-0.5">
                노트: <strong>{{ key.note }}</strong>
                <span v-if="key.noteName">({{ key.noteName }})</span>
              </div>
            </div>
          </div>

          <p
            v-if="!showRegisterPreviewAll && registerKeys.length > registerPreviewDefaultCount"
            class="text-xs text-gray-400 mt-2"
          >
            {{ registerKeys.length }}개 중 {{ registerPreviewDefaultCount }}개만 표시 중
          </p>
        </div>

        <div
          v-if="isConnected && formData.saxRegisterChromaticEnable"
          class="mb-6"
          :class="{ 'pointer-events-none opacity-50': fingeringLoading }"
        >
          <div class="flex items-center gap-2 mb-2">
            <h4 class="heading mb-0">핑거링 테이블 (26키)</h4>
            <div class="flex-grow"></div>
            <Button size="sm" variant="secondary" @click.prevent="showFingeringTable = !showFingeringTable">
              {{ showFingeringTable ? "접기" : "펼치기" }}
            </Button>
          </div>
          <p class="text-sm mb-3">
            키 조합(눌린 키 목록) → 노트(0-127)를 테이블로 지정합니다. 매칭은 “가장 많은 키가 일치하는 항목”이 우선입니다.
          </p>

          <div v-if="showFingeringTable">

          <Hero
            v-if="fingeringSupport === 'unsupported'"
            custom="h-20"
            title="이 펌웨어에서는 핑거링 테이블을 지원하지 않습니다."
          />

          <div v-else class="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-3">
            <span>
              펌웨어 지원:
              <strong class="text-gray-200">
                {{
                  fingeringSupport === "supported"
                    ? "지원됨"
                    : fingeringSupport === "unsupported"
                      ? "미지원"
                      : "확인중"
                }}
              </strong>
            </span>
            <span>
              엔트리: <strong class="text-gray-200">{{ fingeringEntryCount }}</strong>
            </span>
            <div class="flex-grow"></div>
            <Button size="sm" variant="secondary" @click.prevent="reloadFingering">
              새로고침
            </Button>
          </div>

          <div v-if="fingeringSupport === 'supported'" class="surface-neutral border rounded px-3 py-2 mb-3">
            <div class="flex flex-wrap items-center gap-2">
              <input
                v-model="fingeringFilterText"
                class="text-sm px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200"
                style="min-width: 220px;"
                placeholder="#인덱스, 키(예: 1,2,3), 노트(예: 60 또는 C4)"
              />

              <label class="text-xs text-gray-300 flex items-center gap-1">
                <input type="checkbox" v-model="fingeringFilterOnlyEnabled" />
                사용 중만
              </label>

              <label class="text-xs text-gray-300 flex items-center gap-1">
                <input type="checkbox" v-model="fingeringFilterOnlyWithKeys" />
                키 지정됨만
              </label>

              <label class="text-xs text-gray-300 flex items-center gap-1">
                <input type="checkbox" v-model="fingeringFilterOnlyWithNote" />
                노트 지정됨만
              </label>

              <div class="text-xs text-gray-300 flex items-center gap-1">
                인덱스
                <input
                  v-model.number="fingeringFilterIndexFrom"
                  type="number"
                  min="0"
                  :max="fingeringEntryCount - 1"
                  class="w-16 text-sm px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200"
                />
                ~
                <input
                  v-model.number="fingeringFilterIndexTo"
                  type="number"
                  min="0"
                  :max="fingeringEntryCount - 1"
                  class="w-16 text-sm px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200"
                />
              </div>

              <Button size="sm" variant="secondary" @click.prevent="resetFingeringFilters">
                초기화
              </Button>

              <div class="flex-grow"></div>
              <div class="text-xs text-gray-400">
                표시: <strong class="text-gray-200">{{ visibleFingeringEntries.length }}</strong> / {{ fingeringEntryCount }}
              </div>
            </div>
          </div>

          <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));">
            <div
              v-for="entry in visibleFingeringEntries"
              :key="`fing-${entry.index}`"
              :ref="setFingeringEntryEl(entry.index)"
              class="surface-neutral border rounded px-2 py-2"
              :class="{ 'ring-2 ring-blue-500': activeFingeringEntryIndex === entry.index }"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="text-xs"><strong>#{{ entry.index }}</strong></div>
                <div class="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    :disabled="!isConnected || fingeringSupport !== 'supported'"
                    @click.prevent="captureFingeringEntry(entry.index)"
                  >
                    현재 눌림 캡처
                  </Button>
                  <label class="text-xs text-gray-400">
                    <input
                      type="checkbox"
                      :checked="entry.enabled"
                      @change="onFingeringEnabledChange(entry.index, $event)"
                    />
                    사용
                  </label>
                </div>
              </div>

              <label class="text-xs text-gray-400 block mb-1">눌린 키 (0-25)</label>
              <input
                class="w-full text-sm px-2 py-1"
                :value="entry.keysText"
                :disabled="!entry.enabled"
                @change="onFingeringKeysChange(entry.index, $event)"
              />

              <label class="text-xs text-gray-400 block mt-3 mb-1">노트 (0-127)</label>
              <input
                class="w-full text-sm px-2 py-1"
                type="number"
                min="0"
                max="127"
                :value="entry.note"
                :disabled="!entry.enabled"
                :ref="setFingeringNoteInputEl(entry.index)"
                @change="onFingeringNoteChange(entry.index, $event)"
              />
            </div>
          </div>
          </div>
        </div>

        <div
          v-if="isConnected && formData.saxRegisterChromaticEnable"
          class="mb-6"
          :class="{ 'pointer-events-none opacity-50': keyMapLoading }"
        >
          <div class="flex items-center gap-2 mb-2">
            <h4 class="heading mb-0">레지스터 키 매핑</h4>
            <div class="flex-grow"></div>
            <Button size="sm" variant="secondary" @click.prevent="showKeyMapping = !showKeyMapping">
              {{ showKeyMapping ? "접기" : "펼치기" }}
            </Button>
          </div>
          <p class="text-sm mb-3">
            각 키(디지털 입력)가 어떤 레지스터 키 번호(0부터)로 동작할지 지정합니다. 기본값은 “자기 인덱스 그대로”입니다.
          </p>

          <div v-if="showKeyMapping">

          <div class="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-3">
            <span>
              펌웨어 지원:
              <strong class="text-gray-200">
                {{
                  saxRegisterKeyMapSupport === "supported"
                    ? "지원됨"
                    : saxRegisterKeyMapSupport === "unsupported"
                      ? "미지원"
                      : "확인중"
                }}
              </strong>
            </span>
            <span v-if="saxRegisterKeyMapSupport === 'supported'">
              변경된 키: <strong class="text-gray-200">{{ changedKeyCount }}</strong>
            </span>

            <div class="flex-grow"></div>
            <Button
              v-if="saxRegisterKeyMapSupport !== 'unsupported'"
              size="sm"
              variant="secondary"
              @click.prevent="reloadKeyMap"
            >
              새로고침
            </Button>
            <Button
              v-if="saxRegisterKeyMapSupport === 'supported'"
              size="sm"
              variant="secondary"
              @click.prevent="resetKeyMapToDefault"
            >
              전체 기본값
            </Button>
          </div>

          <Hero
            v-if="saxRegisterKeyMapSupport === 'unsupported'"
            custom="h-20"
            title="이 펌웨어에서는 레지스터 키 매핑 저장을 지원하지 않습니다."
          />

          <p
            v-else-if="duplicateMappedKeys.length"
            class="text-sm mb-3"
          >
            중복된 레지스터 키 매핑이 있습니다 (같은 레지스터 키를 여러 키가 사용):
            <strong>{{ duplicateMappedKeys.join(', ') }}</strong>
            <span class="block mt-2 text-xs text-gray-400">
              <span
                v-for="item in duplicateMappedKeyDetails"
                :key="`dup-${item.mappedIndex}`"
                class="block"
              >
                레지스터 키 {{ item.mappedIndex }}: 키 {{ item.keys.join(', ') }}
              </span>
            </span>
          </p>

          <div v-else class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
            <div
              v-for="key in registerKeys"
              :key="`map-${key.index}`"
              class="surface-neutral border rounded px-2 py-2"
            >
              <div class="text-xs mb-1">
                <strong>키 {{ key.index }}</strong>
              </div>

              <label class="text-xs text-gray-400 block mb-1">레지스터 키 번호</label>
              <select
                class="w-full text-sm px-2 py-1"
                :value="getKeyMapSelectValue(key.index)"
                @change="onKeyMapChange(key.index, $event)"
              >
                <option :value="0">기본값 (키 {{ key.index }})</option>
                <option
                  v-for="opt in keyMapOptions"
                  :key="`opt-${key.index}-${opt.value}`"
                  :value="opt.value"
                >
                  {{ opt.text }}
                </option>
              </select>
            </div>
          </div>
          </div>
        </div>
      </div>
    </Section>
  </form>
</template>

<script lang="ts">
import { defineComponent, computed, ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { Block, SectionType, BlockMap } from "../index";
import { useDeviceForm } from "../../composables";
import { midiStoreMapped, deviceStoreMapped, deviceStore } from "../../store";

export default defineComponent({
  name: "MidiSaxophone",
  setup() {
    const { isConnected } = midiStoreMapped;
    const { numberOfComponents } = deviceStoreMapped;

    const saxRegisterKeyMapRaw = ref<number[] | null>(null);
    const saxRegisterKeyMapSupport = ref<"unknown" | "supported" | "unsupported">(
      "unknown",
    );
    const keyMapLoading = ref(false);

    const fingeringMaskLo14 = ref<number[] | null>(null);
    const fingeringMaskHi10Enable = ref<number[] | null>(null);
    const fingeringNote = ref<number[] | null>(null);
    const fingeringSupport = ref<"unknown" | "supported" | "unsupported">(
      "unknown",
    );
    const fingeringLoading = ref(false);

    const activeFingeringEntryIndex = ref<number | null>(null);
    const fingeringEntryEls = new Map<number, HTMLElement>();
    const fingeringNoteInputEls = new Map<number, HTMLInputElement>();

    const fingeringEntryCount = 128;

    const showRegisterPreviewAll = ref(false);
    const showFingeringTable = ref(false);
    const showKeyMapping = ref(false);
    const registerPreviewDefaultCount = 24;

    const fingeringFilterText = ref("");
    const fingeringFilterOnlyEnabled = ref(false);
    const fingeringFilterOnlyWithKeys = ref(false);
    const fingeringFilterOnlyWithNote = ref(false);
    const fingeringFilterIndexFrom = ref(0);
    const fingeringFilterIndexTo = ref(fingeringEntryCount - 1);

    const uiStateKey = "opendeck.midisaxophone.ui";

    const loadUiState = (): void => {
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(uiStateKey) : null;
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.showRegisterPreviewAll === "boolean") {
            showRegisterPreviewAll.value = parsed.showRegisterPreviewAll;
          }
          if (typeof parsed.showFingeringTable === "boolean") {
            showFingeringTable.value = parsed.showFingeringTable;
          }
          if (typeof parsed.showKeyMapping === "boolean") {
            showKeyMapping.value = parsed.showKeyMapping;
          }

          if (typeof parsed.fingeringFilterText === "string") {
            fingeringFilterText.value = parsed.fingeringFilterText;
          }
          if (typeof parsed.fingeringFilterOnlyEnabled === "boolean") {
            fingeringFilterOnlyEnabled.value = parsed.fingeringFilterOnlyEnabled;
          }
          if (typeof parsed.fingeringFilterOnlyWithKeys === "boolean") {
            fingeringFilterOnlyWithKeys.value = parsed.fingeringFilterOnlyWithKeys;
          }
          if (typeof parsed.fingeringFilterOnlyWithNote === "boolean") {
            fingeringFilterOnlyWithNote.value = parsed.fingeringFilterOnlyWithNote;
          }
          if (typeof parsed.fingeringFilterIndexFrom === "number") {
            fingeringFilterIndexFrom.value = Math.max(0, Math.min(fingeringEntryCount - 1, Math.floor(parsed.fingeringFilterIndexFrom)));
          }
          if (typeof parsed.fingeringFilterIndexTo === "number") {
            fingeringFilterIndexTo.value = Math.max(0, Math.min(fingeringEntryCount - 1, Math.floor(parsed.fingeringFilterIndexTo)));
          }
        }
      } catch {
        // ignore corrupted localStorage
      }
    };

    const saveUiState = (): void => {
      try {
        if (typeof window === "undefined") {
          return;
        }
        window.localStorage.setItem(
          uiStateKey,
          JSON.stringify({
            showRegisterPreviewAll: showRegisterPreviewAll.value,
            showFingeringTable: showFingeringTable.value,
            showKeyMapping: showKeyMapping.value,
            fingeringFilterText: fingeringFilterText.value,
            fingeringFilterOnlyEnabled: fingeringFilterOnlyEnabled.value,
            fingeringFilterOnlyWithKeys: fingeringFilterOnlyWithKeys.value,
            fingeringFilterOnlyWithNote: fingeringFilterOnlyWithNote.value,
            fingeringFilterIndexFrom: fingeringFilterIndexFrom.value,
            fingeringFilterIndexTo: fingeringFilterIndexTo.value,
          }),
        );
      } catch {
        // ignore quota / private mode
      }
    };

    const { formData, loading, onSettingChange, showField } =
      useDeviceForm(Block.Global, SectionType.Setting);

    const lastBreathCc2 = ref<number | null>(null);
    const lastBreathCc11 = ref<number | null>(null);
    const lastBreathCcTime = ref<string | null>(null);
    const clearBreathActivity = (): void => {
      lastBreathCc2.value = null;
      lastBreathCc11.value = null;
      lastBreathCcTime.value = null;
    };

    const breathCcStatusLine = computed((): string => {
      const ccMode = Number((formData as any).saxBreathControllerCC);
      const cc2 = lastBreathCc2.value;
      const cc11 = lastBreathCc11.value;

      const fmt = (value: number | null): string =>
        value === null ? "---" : String(value).padStart(3, "0");

      if (ccMode === 2) {
        return `CC2 v${fmt(cc2)}`;
      }

      if (ccMode === 11) {
        return `CC11 v${fmt(cc11)}`;
      }

      // 13 = CC2 + CC11, or unknown -> show both.
      return `CC2 v${fmt(cc2)} | CC11 v${fmt(cc11)}`;
    });

    const attachBreathActivityListener = (input: any): (() => void) => {
      if (!input || typeof input.addListener !== "function") {
        return () => {};
      }

      const handler = (event: any) => {
        const cc = Number(event?.controller?.number);
        if (cc !== 2 && cc !== 11) {
          return;
        }

        const value = Number(event?.value);
        const channel = Number(event?.channel);
        const now = new Date();
        const time = now.toTimeString().slice(0, 8);

        if (!Number.isFinite(value) || !Number.isFinite(channel)) {
          return;
        }

        const normalizedValue = Math.max(0, Math.min(127, Math.floor(value)));
        lastBreathCcTime.value = time;
        if (cc === 2) {
          lastBreathCc2.value = normalizedValue;
        } else {
          lastBreathCc11.value = normalizedValue;
        }
      };

      input.addListener("controlchange", "all", handler);

      return () => {
        try {
          input.removeListener("controlchange", "all", handler);
        } catch {
          // ignore
        }
      };
    };

    let detachBreathActivityListener: (() => void) | null = null;

    const onSaxSettingChange = (params: any) => {
      if (!isConnected.value) {
        return;
      }
      return onSettingChange(params);
    };

    const saxKeys = new Set([
      "saxRegisterChromaticEnable",
      "saxRegisterChromaticBaseNote",
      "saxRegisterChromaticInputInvert",
      "saxBreathControllerEnable",
      "saxBreathControllerAnalogIndex",
      "saxBreathControllerMidPercent",
      "saxBreathControllerCC",
    ]);

    const saxSections = computed(() => {
      const globalSections = Object.values(BlockMap[Block.Global].sections);
      return globalSections.filter(
        (section) => section.type === SectionType.Setting && saxKeys.has(section.key),
      );
    });

    const hasSaxSections = computed(() => saxSections.value.length > 0);

    const saxHelpItems = computed(() => {
      return saxSections.value
        .filter((section: any) => section.key !== "saxRegisterChromaticTranspose")
        .map((section: any) => {
        const disabled = deviceStoreMapped.isControlDisabled(section);
        const disabledText = disabled ? "이 펌웨어/디바이스에서는 지원되지 않습니다." : "";

        const min = typeof section.min === "number" ? section.min : undefined;
        const max = typeof section.max === "number" ? section.max : undefined;
        const rangeText =
          typeof min === "number" && typeof max === "number" ? `${min} - ${max}` : "";

        const description =
          typeof section.helpText === "string" ? section.helpText.trim() : "";

        return {
          key: section.key,
          label: section.label || section.key,
          rangeText,
          description,
          disabledText,
          isVisible: !!showField(section),
        };
      });
    });

    const clampMidiNote = (value: number): number =>
      Math.max(0, Math.min(127, value));

    const midiNoteName = (note: number): string => {
      const names = [
        "C",
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "A#",
        "B",
      ];
      const n = clampMidiNote(note);
      const octave = Math.floor(n / 12) - 1;
      return `${names[n % 12]}${octave}`;
    };

    const registerKeyCount = computed(() => {
      const count = (numberOfComponents.value && numberOfComponents.value[Block.Button]) || 0;
      return Number(count) || 0;
    });

    const loadSaxRegisterKeyMap = async () => {
      if (!isConnected.value) {
        saxRegisterKeyMapRaw.value = null;
        saxRegisterKeyMapSupport.value = "unknown";
        return;
      }

      keyMapLoading.value = true;
      try {
        const values = await deviceStore.actions.getSectionValues(Block.Button);
        if (Object.prototype.hasOwnProperty.call(values, "saxRegisterKeyMap")) {
          saxRegisterKeyMapSupport.value = "supported";
          saxRegisterKeyMapRaw.value = values.saxRegisterKeyMap;
        } else {
          saxRegisterKeyMapSupport.value = "unsupported";
          saxRegisterKeyMapRaw.value = null;
        }
      } finally {
        keyMapLoading.value = false;
      }
    };

    const loadFingeringTable = async () => {
      if (!isConnected.value) {
        fingeringMaskLo14.value = null;
        fingeringMaskHi10Enable.value = null;
        fingeringNote.value = null;
        fingeringSupport.value = "unknown";
        return;
      }

      fingeringLoading.value = true;
      try {
        const values = await deviceStore.actions.getSectionValues(Block.Global);
        if (
          Object.prototype.hasOwnProperty.call(values, "saxFingeringMaskLo14") &&
          Object.prototype.hasOwnProperty.call(values, "saxFingeringMaskHi10Enable") &&
          Object.prototype.hasOwnProperty.call(values, "saxFingeringNote")
        ) {
          fingeringSupport.value = "supported";
          fingeringMaskLo14.value = values.saxFingeringMaskLo14;
          fingeringMaskHi10Enable.value = values.saxFingeringMaskHi10Enable;
          fingeringNote.value = values.saxFingeringNote;
        } else {
          fingeringSupport.value = "unsupported";
          fingeringMaskLo14.value = null;
          fingeringMaskHi10Enable.value = null;
          fingeringNote.value = null;
        }
      } finally {
        fingeringLoading.value = false;
      }
    };

    const reloadFingering = async () => {
      await loadFingeringTable();
    };

    const fingeringKeyCount = 26;
    const fingeringHiBits = Math.max(0, fingeringKeyCount - 14);
    const fingeringHiMask = (1 << fingeringHiBits) - 1;
    const fingeringEnableBit = 1 << fingeringHiBits;

    const parseKeysToMask = (text: string): number => {
      if (!text) {
        return 0;
      }
      const parts = text
        .split(/[,\s]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      let mask = 0;
      for (const p of parts) {
        const n = Number(p);
        if (!Number.isFinite(n)) {
          continue;
        }
        const idx = Math.floor(n);
        if (idx < 0 || idx > fingeringKeyCount - 1) {
          continue;
        }
        mask |= 1 << idx;
      }
      return mask >>> 0;
    };

    const maskToKeysText = (mask: number): string => {
      const keys: number[] = [];
      for (let i = 0; i < fingeringKeyCount; i++) {
        if ((mask >>> i) & 1) {
          keys.push(i);
        }
      }
      return keys.join(",");
    };

    const splitMaskTo14BitParts = (mask: number) => {
      const lo14 = mask & 0x3fff;
      const hi = (mask >>> 14) & fingeringHiMask;
      return { lo14, hi };
    };

    const setGlobalValue = async (section: number, index: number, value: number) => {
      await deviceStore.actions.setComponentSectionValue(
        {
          block: Block.Global,
          section,
          index,
          value,
        },
        () => void 0,
      );
    };

    const setFingeringEnabled = async (entryIndex: number, enabled: boolean) => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }
      const current = (fingeringMaskHi10Enable.value && fingeringMaskHi10Enable.value[entryIndex]) || 0;
      const hi = current & fingeringHiMask;
      const next = enabled ? (hi | fingeringEnableBit) : hi;
      fingeringLoading.value = true;
      try {
        await setGlobalValue(4, entryIndex, next);
        if (fingeringMaskHi10Enable.value) {
          fingeringMaskHi10Enable.value[entryIndex] = next;
        }
      } finally {
        fingeringLoading.value = false;
      }
    };

    const onFingeringEnabledChange = (entryIndex: number, event: Event) => {
      const target = event && (event.target as unknown as HTMLInputElement);
      const enabled = !!(target && (target as any).checked);
      return setFingeringEnabled(entryIndex, enabled);
    };

    const setFingeringNote = async (entryIndex: number, noteValue: number) => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }
      const n = Math.max(0, Math.min(127, Math.floor(Number(noteValue) || 0)));
      fingeringLoading.value = true;
      try {
        await setGlobalValue(5, entryIndex, n);
        if (fingeringNote.value) {
          fingeringNote.value[entryIndex] = n;
        }
      } finally {
        fingeringLoading.value = false;
      }
    };

    const onFingeringNoteChange = (entryIndex: number, event: Event) => {
      const target = event && (event.target as unknown as HTMLInputElement);
      const raw = target && typeof target.value !== "undefined" ? Number(target.value) : 0;
      return setFingeringNote(entryIndex, raw);
    };

    const setFingeringKeysText = async (entryIndex: number, text: string) => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }
      const mask = parseKeysToMask(text);
      const { lo14, hi } = splitMaskTo14BitParts(mask);
      const currentHiEn = (fingeringMaskHi10Enable.value && fingeringMaskHi10Enable.value[entryIndex]) || 0;
      const enabledBit = currentHiEn & fingeringEnableBit;
      const nextHiEn = (hi & fingeringHiMask) | enabledBit;

      fingeringLoading.value = true;
      try {
        // write lo then hi/en
        await setGlobalValue(3, entryIndex, lo14);
        await setGlobalValue(4, entryIndex, nextHiEn);

        if (fingeringMaskLo14.value) {
          fingeringMaskLo14.value[entryIndex] = lo14;
        }
        if (fingeringMaskHi10Enable.value) {
          fingeringMaskHi10Enable.value[entryIndex] = nextHiEn;
        }
      } finally {
        fingeringLoading.value = false;
      }
    };

    const onFingeringKeysChange = (entryIndex: number, event: Event) => {
      const target = event && (event.target as unknown as HTMLInputElement);
      const text = target && typeof target.value !== "undefined" ? String(target.value) : "";
      return setFingeringKeysText(entryIndex, text);
    };

    const setFingeringEntryEl = (entryIndex: number) => (el: unknown) => {
      if (el && el instanceof HTMLElement) {
        fingeringEntryEls.set(entryIndex, el);
      } else {
        fingeringEntryEls.delete(entryIndex);
      }
    };

    const setFingeringNoteInputEl = (entryIndex: number) => (el: unknown) => {
      if (el && el instanceof HTMLInputElement) {
        fingeringNoteInputEls.set(entryIndex, el);
      } else {
        fingeringNoteInputEls.delete(entryIndex);
      }
    };

    const focusFingeringEntry = async (entryIndex: number) => {
      activeFingeringEntryIndex.value = entryIndex;
      await nextTick();

      const container = fingeringEntryEls.get(entryIndex);
      if (container) {
        container.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      const noteInput = fingeringNoteInputEls.get(entryIndex);
      if (noteInput && !noteInput.disabled) {
        noteInput.focus();
        noteInput.select();
      }
    };

    const captureFingeringEntry = async (entryIndex: number) => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }

      // If note is already set, send it along so capture updates note+mask in one go.
      // If note isn't available yet, use >=128 to keep existing note in firmware.
      const currentNote = fingeringNote.value ? fingeringNote.value[entryIndex] : undefined;
      const noteValue = typeof currentNote === "number" ? currentNote : 128;

      fingeringLoading.value = true;
      try {
        // Global section 6: SAX_FINGERING_CAPTURE (write-only)
        await setGlobalValue(6, entryIndex, noteValue);
        await loadFingeringTable();

        const nextIndex = Math.min(entryIndex + 1, fingeringEntryCount - 1);
        await focusFingeringEntry(nextIndex);
      } finally {
        fingeringLoading.value = false;
      }
    };

    const reloadKeyMap = async () => {
      await loadSaxRegisterKeyMap();
    };

    const resetKeyMapToDefault = async () => {
      if (!isConnected.value) {
        return;
      }
      if (saxRegisterKeyMapSupport.value !== "supported") {
        return;
      }

      const count = registerKeyCount.value;
      if (!count) {
        return;
      }

      keyMapLoading.value = true;
      try {
        // sequential writes to avoid overwhelming the request queue
        for (let i = 0; i < count; i++) {
          // only write if needed
          const current = saxRegisterKeyMapRaw.value && saxRegisterKeyMapRaw.value[i];
          if (!current) {
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          await setSaxRegisterKeyMap(i, 0);
        }
      } finally {
        keyMapLoading.value = false;
      }
    };

    const setSaxRegisterKeyMap = async (physicalIndex: number, rawValue: number) => {
      if (!isConnected.value) {
        return;
      }

      keyMapLoading.value = true;
      try {
        await deviceStore.actions.setComponentSectionValue(
          {
            block: Block.Button,
            section: 5,
            index: physicalIndex,
            value: rawValue,
          },
          () => {
            if (!saxRegisterKeyMapRaw.value) {
              saxRegisterKeyMapRaw.value = [];
            }
            saxRegisterKeyMapRaw.value[physicalIndex] = rawValue;
          },
        );
      } finally {
        keyMapLoading.value = false;
      }
    };

    const onKeyMapChange = (physicalIndex: number, event: Event) => {
      const target = event && (event.target as unknown as HTMLSelectElement);
      const rawValue = target && typeof target.value !== "undefined" ? Number(target.value) : 0;
      return setSaxRegisterKeyMap(physicalIndex, rawValue);
    };

    const registerKeys = computed(() => {
      const count = registerKeyCount.value;
      const base = clampMidiNote(Number(formData.saxRegisterChromaticBaseNote) || 0);

      const transposeRaw = Math.max(0, Math.min(48, Math.floor(Number((formData as any).saxRegisterChromaticTranspose) || 24)));
      const transpose = transposeRaw - 24;

      return Array.from({ length: count }, (_, index) => {
        const raw = saxRegisterKeyMapRaw.value && saxRegisterKeyMapRaw.value[index];
        const mappedIndex = raw && raw > 0 ? raw - 1 : index;
        const note = clampMidiNote(base + mappedIndex + transpose);
        return {
          index,
          mappedIndex,
          note,
          noteName: midiNoteName(note),
        };
      });
    });

    const visibleRegisterKeys = computed(() => {
      if (showRegisterPreviewAll.value) {
        return registerKeys.value;
      }
      return registerKeys.value.slice(0, registerPreviewDefaultCount);
    });

    const keyMapOptions = computed(() => {
      const count = registerKeyCount.value;
      const options = Array.from({ length: count }, (_, idx) => ({
        value: idx + 1,
        text: `레지스터 키 ${idx}`,
      }));
      return options;
    });

    const changedKeyCount = computed(() => {
      const count = registerKeyCount.value;
      if (!count || !saxRegisterKeyMapRaw.value) {
        return 0;
      }
      let changed = 0;
      for (let i = 0; i < count; i++) {
        const raw = saxRegisterKeyMapRaw.value[i];
        if (raw && Number(raw) !== 0) {
          changed++;
        }
      }
      return changed;
    });

    const duplicateMappedKeys = computed(() => {
      const count = registerKeyCount.value;
      if (!count || !saxRegisterKeyMapRaw.value) {
        return [] as number[];
      }

      const seen = new Set<number>();
      const duplicates = new Set<number>();

      for (let i = 0; i < count; i++) {
        const raw = saxRegisterKeyMapRaw.value[i];
        const mappedIndex = raw && Number(raw) > 0 ? Number(raw) - 1 : i;

        if (seen.has(mappedIndex)) {
          duplicates.add(mappedIndex);
        } else {
          seen.add(mappedIndex);
        }
      }

      return Array.from(duplicates).sort((a, b) => a - b);
    });

    const duplicateMappedKeyDetails = computed(() => {
      const count = registerKeyCount.value;
      if (!count || !saxRegisterKeyMapRaw.value) {
        return [] as Array<{ mappedIndex: number; keys: number[] }>;
      }

      const groups = new Map<number, number[]>();
      for (let i = 0; i < count; i++) {
        const raw = saxRegisterKeyMapRaw.value[i];
        const mappedIndex = raw && Number(raw) > 0 ? Number(raw) - 1 : i;
        if (!groups.has(mappedIndex)) {
          groups.set(mappedIndex, []);
        }
        groups.get(mappedIndex)!.push(i);
      }

      return Array.from(groups.entries())
        .filter(([, keys]) => keys.length > 1)
        .map(([mappedIndex, keys]) => ({ mappedIndex, keys }))
        .sort((a, b) => a.mappedIndex - b.mappedIndex);
    });

    const getKeyMapSelectValue = (physicalIndex: number): number => {
      const raw = saxRegisterKeyMapRaw.value && saxRegisterKeyMapRaw.value[physicalIndex];
      return Number(raw) || 0;
    };

    onMounted(() => {
      loadUiState();
      loadSaxRegisterKeyMap();
      loadFingeringTable();
    });

    onMounted(() => {
      // Keep a lightweight activity panel in this view regardless of the global Activity toggle.
      detachBreathActivityListener?.();
      detachBreathActivityListener = attachBreathActivityListener(deviceStore.state.input as any);
    });

    onUnmounted(() => {
      detachBreathActivityListener?.();
      detachBreathActivityListener = null;
    });

    watch(
      () => [showRegisterPreviewAll.value, showFingeringTable.value, showKeyMapping.value],
      () => saveUiState(),
      { deep: false },
    );

    watch(
      () => [
        fingeringFilterText.value,
        fingeringFilterOnlyEnabled.value,
        fingeringFilterOnlyWithKeys.value,
        fingeringFilterOnlyWithNote.value,
        fingeringFilterIndexFrom.value,
        fingeringFilterIndexTo.value,
      ],
      () => saveUiState(),
      { deep: false },
    );

    watch(
      () => isConnected.value,
      (connected) => {
        if (connected) {
          loadSaxRegisterKeyMap();
          loadFingeringTable();
          detachBreathActivityListener?.();
          detachBreathActivityListener = attachBreathActivityListener(deviceStore.state.input as any);
        } else {
          saxRegisterKeyMapRaw.value = null;
          saxRegisterKeyMapSupport.value = "unknown";
          fingeringMaskLo14.value = null;
          fingeringMaskHi10Enable.value = null;
          fingeringNote.value = null;
          fingeringSupport.value = "unknown";
          clearBreathActivity();
          detachBreathActivityListener?.();
          detachBreathActivityListener = null;
        }
      },
    );

    watch(
      () => deviceStore.state.input,
      (input) => {
        if (!isConnected.value) {
          return;
        }
        detachBreathActivityListener?.();
        detachBreathActivityListener = attachBreathActivityListener(input as any);
      },
    );

    const fingeringEntries = computed(() => {
      const lo = fingeringMaskLo14.value || [];
      const hiEn = fingeringMaskHi10Enable.value || [];
      const noteArr = fingeringNote.value || [];

      return Array.from({ length: fingeringEntryCount }, (_, index) => {
        const lo14 = Number(lo[index] || 0) & 0x3fff;
        const hiEnVal = Number(hiEn[index] || 0) & (fingeringHiMask | fingeringEnableBit);
        const hi = hiEnVal & fingeringHiMask;
        const enabled = (hiEnVal & fingeringEnableBit) !== 0;
        const mask = (lo14 | (hi << 14)) >>> 0;
        const note = Math.max(0, Math.min(127, Math.floor(Number(noteArr[index] || 0))));

        return {
          index,
          enabled,
          mask,
          keysText: maskToKeysText(mask),
          note,
        };
      });
    });

    const normalizeFilterText = (text: string): string =>
      String(text || "")
        .trim()
        .toLowerCase();

    const resetFingeringFilters = (): void => {
      fingeringFilterText.value = "";
      fingeringFilterOnlyEnabled.value = false;
      fingeringFilterOnlyWithKeys.value = false;
      fingeringFilterOnlyWithNote.value = false;
      fingeringFilterIndexFrom.value = 0;
      fingeringFilterIndexTo.value = fingeringEntryCount - 1;
    };

    const visibleFingeringEntries = computed(() => {
      const q = normalizeFilterText(fingeringFilterText.value);
      const from = Math.max(0, Math.min(fingeringEntryCount - 1, Math.floor(Number(fingeringFilterIndexFrom.value) || 0)));
      const to = Math.max(0, Math.min(fingeringEntryCount - 1, Math.floor(Number(fingeringFilterIndexTo.value) || (fingeringEntryCount - 1))));
      const rangeStart = Math.min(from, to);
      const rangeEnd = Math.max(from, to);

      const qNoSpaces = q.replace(/\s+/g, "");

      return fingeringEntries.value.filter((entry) => {
        if (entry.index < rangeStart || entry.index > rangeEnd) {
          return false;
        }
        if (fingeringFilterOnlyEnabled.value && !entry.enabled) {
          return false;
        }
        if (fingeringFilterOnlyWithKeys.value && !entry.mask) {
          return false;
        }
        if (fingeringFilterOnlyWithNote.value && !entry.note) {
          return false;
        }

        if (!qNoSpaces) {
          return true;
        }

        const keysText = String(entry.keysText || "").toLowerCase();
        const keysTextNoSpaces = keysText.replace(/\s+/g, "");
        const noteName = midiNoteName(entry.note).toLowerCase();

        return (
          String(entry.index).includes(qNoSpaces.replace(/^#/, "")) ||
          String(entry.note).includes(qNoSpaces) ||
          noteName.includes(qNoSpaces) ||
          keysTextNoSpaces.includes(qNoSpaces)
        );
      });
    });

    return {
      formData,
      loading,
      onSaxSettingChange,
      showField,
      saxSections,
      hasSaxSections,
      saxHelpItems,
      isConnected,
      clearBreathActivity,
      breathCcStatusLine,
      lastBreathCcTime,
      registerKeyCount,
      registerKeys,
      visibleRegisterKeys,
      showRegisterPreviewAll,
      registerPreviewDefaultCount,
      showFingeringTable,
      showKeyMapping,
      saxRegisterKeyMapSupport,
      keyMapLoading,
      keyMapOptions,
      changedKeyCount,
      duplicateMappedKeys,
      duplicateMappedKeyDetails,
      getKeyMapSelectValue,
      setSaxRegisterKeyMap,
      onKeyMapChange,
      reloadKeyMap,
      resetKeyMapToDefault,

      fingeringSupport,
      fingeringLoading,
      fingeringEntryCount,
      fingeringEntries,
      visibleFingeringEntries,
      fingeringFilterText,
      fingeringFilterOnlyEnabled,
      fingeringFilterOnlyWithKeys,
      fingeringFilterOnlyWithNote,
      fingeringFilterIndexFrom,
      fingeringFilterIndexTo,
      resetFingeringFilters,
      reloadFingering,
      captureFingeringEntry,
      onFingeringEnabledChange,
      onFingeringKeysChange,
      onFingeringNoteChange,
      setFingeringEnabled,
      setFingeringKeysText,
      setFingeringNote,
      activeFingeringEntryIndex,
      setFingeringEntryEl,
      setFingeringNoteInputEl,
    };
  },
});
</script>

<style scoped>
.form-grid.sax-settings-grid {
  padding-bottom: 1rem;
  gap: 0.75rem 1rem;
}

.sax-settings-grid :deep(.form-field .label) {
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  line-height: 1.1;
}

.sax-settings-grid :deep(.form-field .instructions) {
  font-size: 0.75rem;
}

.sax-settings-grid :deep(.form-field .error-message) {
  margin-top: 0.25rem;
  font-size: 0.75rem;
}
</style>
