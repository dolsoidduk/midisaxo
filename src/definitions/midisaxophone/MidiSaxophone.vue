<template>
  <form class="relative flex flex-wrap flex-grow" novalidate @submit.prevent="">
    <div v-if="loading" class="absolute flex inset-0 opacity-75 bg-gray-900">
      <Spinner class="self-center" />
    </div>

    <Section title="MIDI Saxophone" class="w-full">
      <div class="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <p class="text-sm mb-6">
          야마하 YDS-150 키 시스템 지원 (레지스터 키 + 브레스 컨트롤러).
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
          v-if="isConnected"
          class="surface-neutral border border-gray-700/60 rounded px-4 py-3 mb-6 text-sm"
        >
          <div class="text-gray-200 font-semibold">피치벤드(입) 캘리브레이션 안내</div>
          <div class="mt-2 text-gray-300 whitespace-pre-line">
            피치벤드 기본값이 0(센터)로만 느껴지거나, ‘입으로 무는 정도’ 기준이 안 맞으면
            버튼 메시지 타입을 <strong>PB Center Capture</strong>로 설정한 뒤 아래처럼 한 번 캡처하세요.
          </div>
          <ol class="mt-2 text-gray-300 list-decimal list-inside space-y-1">
            <li>평소 연주할 때처럼 ‘입으로 무는 정도’를 유지</li>
            <li>그 상태에서 PB Center Capture 버튼을 1번 눌러 캡처</li>
            <li>이후부터 그 상태가 0(센터) 기준이 되고, 입을 떼면 음의 방향(−쪽)으로 자연스럽게 내려갑니다</li>
          </ol>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              :disabled="pbCenterCaptureBusy"
              @click.prevent="runPbCenterCapture"
            >
              {{ pbCenterCaptureBusy ? "CAL..." : "CAL" }}
            </Button>
            <span class="text-xs text-gray-400">
              UI에서 바로 캡처(= PB Center Capture 요청 전송)
            </span>
            <span v-if="pbCenterCaptureNotice" class="text-xs text-green-300">
              {{ pbCenterCaptureNotice }}
            </span>
          </div>
          <div class="mt-2 text-xs text-gray-400">
            팁: 캡처 후에도 흔들리면 "피치벤드 중앙 민감도(데드존)" 값을 조금 올려보세요.
          </div>
        </div>

        <div
          class="form-grid sax-settings-grid mb-8"
          :class="{ 'pointer-events-none opacity-50': !isConnected }"
        >
          <template v-for="section in saxSections" :key="section.key">
            <div v-if="showField(section)" class="flex flex-col gap-1">
              <FormField
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
          v-if="isConnected"
          class="mb-6"
          :class="{ 'pointer-events-none opacity-50': fingeringLoading }"
        >
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <h4 class="heading mb-0">핑거링 테이블 (26키)</h4>

            <div class="flex items-center gap-2 ml-auto">
              <div class="flex items-center gap-2">
                <div class="text-xs text-gray-300 font-semibold">엔트리 표시(가로/세로)</div>
                <select
                  class="text-sm px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200"
                  :disabled="fingeringSupport === 'unsupported'"
                  :value="fingeringEntryLayoutMode"
                  @change="onFingeringEntryLayoutModeChange($event)"
                >
                  <option value="horizontal">가로(스크롤)</option>
                  <option value="grid">세로(그리드)</option>
                </select>

                <div v-if="fingeringEntryLayoutMode === 'horizontal'" class="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    :disabled="fingeringSupport === 'unsupported' || !showFingeringTable || !canScrollFingeringLeft"
                    @click.prevent="scrollFingeringEntriesByPage(-1)"
                  >
                    ◀
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    :disabled="fingeringSupport === 'unsupported' || !showFingeringTable || !canScrollFingeringRight"
                    @click.prevent="scrollFingeringEntriesByPage(1)"
                  >
                    ▶
                  </Button>
                </div>
              </div>

              <Button
                size="sm"
                variant="secondary"
                :disabled="fingeringSupport === 'unsupported' || !showFingeringTable"
                @click.prevent="openAllFingeringEntryDetails"
              >
                전체 펼치기
              </Button>
              <Button
                size="sm"
                variant="secondary"
                :disabled="fingeringSupport === 'unsupported' || !showFingeringTable"
                @click.prevent="closeAllFingeringEntryDetails"
              >
                전체 접기
              </Button>

              <Button size="sm" variant="secondary" @click.prevent="showFingeringTable = !showFingeringTable">
                {{ showFingeringTable ? "접기" : "펼치기" }}
              </Button>
            </div>
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

          <div v-if="fingeringSupport !== 'unsupported'" class="surface-neutral border rounded px-3 py-2 mb-3">
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

          <div
            v-if="fingeringSupport !== 'unsupported'"
            class="surface-neutral border rounded px-3 py-2 mb-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <div class="text-xs text-gray-300 font-semibold">키 라벨</div>

              <select
                class="text-sm px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200"
                :value="fingeringKeyLabelPreset"
                @change="onFingeringLabelPresetChange($event)"
              >
                <option value="sax">색소폰 표준(추천)</option>
                <option value="numbers">0-25 숫자</option>
              </select>

              <label class="text-xs text-gray-300 flex items-center gap-1">
                <input type="checkbox" v-model="showFingeringKeyIndex" />
                인덱스(#0-25) 표시
              </label>

              <Button
                size="sm"
                variant="secondary"
                @click.prevent="showFingeringLabelEditor = !showFingeringLabelEditor"
              >
                {{ showFingeringLabelEditor ? "라벨 편집 닫기" : "라벨 편집" }}
              </Button>

              <div class="flex-grow"></div>

              <Button
                size="sm"
                variant="secondary"
                @click.prevent="resetFingeringLabelsToPreset()"
              >
                프리셋으로 초기화
              </Button>
            </div>

            <div v-if="showFingeringLabelEditor" class="mt-3">
              <div class="text-xs text-gray-400 mb-2">
                위에서부터 <strong class="text-gray-200">키 #0</strong> ~ <strong class="text-gray-200">키 #25</strong>
                순서로 1줄에 1개씩 입력하세요.
              </div>
              <textarea
                class="w-full text-sm px-2 py-2 border border-gray-700 rounded bg-transparent text-gray-200 font-mono"
                style="min-height: 220px;"
                :value="fingeringKeyLabelsText"
                @input="onFingeringKeyLabelsTextInput($event)"
              />
              <div class="text-[11px] text-gray-500 mt-2">
                팁: 라벨은 UI 표시용이며 펌웨어 인덱스/기능은 바뀌지 않습니다.
              </div>
            </div>
          </div>

          <div
            v-if="fingeringEntryLayoutMode === 'horizontal'"
            ref="fingeringEntriesScrollEl"
            @scroll.passive="updateFingeringScrollButtons"
            class="flex gap-2 overflow-x-auto pb-2"
            style="scrollbar-gutter: stable; scroll-snap-type: x mandatory; scroll-padding-left: 4px; scroll-padding-right: 4px;"
          >
            <div
              v-for="entry in visibleFingeringEntries"
              :key="`fing-${entry.index}`"
              :ref="setFingeringEntryEl(entry.index)"
              class="surface-neutral border rounded px-2 py-2 flex-none"
              style="width: 340px; scroll-snap-align: start;"
              :class="{ 'ring-2 ring-blue-500': activeFingeringEntryIndex === entry.index, 'opacity-80': !entry.enabled }"
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
                    사용(매핑)
                  </label>
                </div>
              </div>

              <div v-if="!entry.enabled" class="text-[11px] text-gray-500 mb-2">
                비활성: 이 엔트리는 매핑에서 제외됩니다. (편집은 가능)
              </div>

              <label class="text-xs text-gray-400 block mb-1">눌린 키 (0-25)</label>
              <SaxFingeringKeyPad
                class="mb-2"
                :mask="entry.mask"
                :disabled="fingeringLoading || !isConnected || fingeringSupport !== 'supported'"
                :labels="fingeringKeyLabels"
                :show-index="showFingeringKeyIndex"
                @update:mask="(m) => setFingeringMask(entry.index, m)"
              />

              <div class="flex items-center gap-2 mt-2">
                <div class="text-xs text-gray-400">텍스트/노트</div>
                <div class="flex-grow"></div>
                <Button
                  size="sm"
                  variant="secondary"
                  @click.prevent="toggleFingeringEntryDetails(entry.index)"
                >
                  {{ isFingeringEntryDetailsOpen(entry.index) ? "접기" : "펼치기" }}
                </Button>
              </div>

              <div v-show="isFingeringEntryDetailsOpen(entry.index)">
                <label class="text-[11px] text-gray-500 block mt-2 mb-1">텍스트 입력 (고급)</label>
                <input
                  class="w-full text-sm px-2 py-1"
                  :value="entry.keysText"
                  :disabled="fingeringLoading || !isConnected || fingeringSupport !== 'supported'"
                  @change="onFingeringKeysChange(entry.index, $event)"
                />

                <label class="text-xs text-gray-400 block mt-3 mb-1">노트 (0-127)</label>
                <input
                  class="w-full text-sm px-2 py-1"
                  type="number"
                  min="0"
                  max="127"
                  :value="entry.note"
                  :disabled="fingeringLoading || !isConnected || fingeringSupport !== 'supported'"
                  :ref="setFingeringNoteInputEl(entry.index)"
                  @change="onFingeringNoteChange(entry.index, $event)"
                />
              </div>
            </div>
          </div>

          <div
            v-else
            class="grid gap-2"
            style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));"
          >
            <div
              v-for="entry in visibleFingeringEntries"
              :key="`fing-${entry.index}`"
              :ref="setFingeringEntryEl(entry.index)"
              class="surface-neutral border rounded px-2 py-2"
              :class="{ 'ring-2 ring-blue-500': activeFingeringEntryIndex === entry.index, 'opacity-80': !entry.enabled }"
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
                    사용(매핑)
                  </label>
                </div>
              </div>

              <div v-if="!entry.enabled" class="text-[11px] text-gray-500 mb-2">
                비활성: 이 엔트리는 매핑에서 제외됩니다. (편집은 가능)
              </div>

              <label class="text-xs text-gray-400 block mb-1">눌린 키 (0-25)</label>
              <SaxFingeringKeyPad
                class="mb-2"
                :mask="entry.mask"
                :disabled="fingeringLoading || !isConnected || fingeringSupport !== 'supported'"
                :labels="fingeringKeyLabels"
                :show-index="showFingeringKeyIndex"
                @update:mask="(m) => setFingeringMask(entry.index, m)"
              />

              <div class="flex items-center gap-2 mt-2">
                <div class="text-xs text-gray-400">텍스트/노트</div>
                <div class="flex-grow"></div>
                <Button
                  size="sm"
                  variant="secondary"
                  @click.prevent="toggleFingeringEntryDetails(entry.index)"
                >
                  {{ isFingeringEntryDetailsOpen(entry.index) ? "접기" : "펼치기" }}
                </Button>
              </div>

              <div v-show="isFingeringEntryDetailsOpen(entry.index)">
                <label class="text-[11px] text-gray-500 block mt-2 mb-1">텍스트 입력 (고급)</label>
                <input
                  class="w-full text-sm px-2 py-1"
                  :value="entry.keysText"
                  :disabled="fingeringLoading || !isConnected || fingeringSupport !== 'supported'"
                  @change="onFingeringKeysChange(entry.index, $event)"
                />

                <label class="text-xs text-gray-400 block mt-3 mb-1">노트 (0-127)</label>
                <input
                  class="w-full text-sm px-2 py-1"
                  type="number"
                  min="0"
                  max="127"
                  :value="entry.note"
                  :disabled="fingeringLoading || !isConnected || fingeringSupport !== 'supported'"
                  :ref="setFingeringNoteInputEl(entry.index)"
                  @change="onFingeringNoteChange(entry.index, $event)"
                />
              </div>
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
import SaxFingeringKeyPad from "./SaxFingeringKeyPad.vue";

export default defineComponent({
  name: "MidiSaxophone",
  components: {
    SaxFingeringKeyPad,
  },
  setup() {
    const { isConnected } = midiStoreMapped;

    const pbCenterCaptureBusy = ref(false);
    const pbCenterCaptureNotice = ref<string>("");

    const runPbCenterCapture = async (): Promise<void> => {
      if (pbCenterCaptureBusy.value) {
        return;
      }

      pbCenterCaptureBusy.value = true;
      pbCenterCaptureNotice.value = "";

      try {
        await deviceStore.actions.saxPitchBendCenterCapture();
        pbCenterCaptureNotice.value = "캡처 요청 전송됨 (평소 무는 상태 유지 중에 눌러주세요)";
      } catch {
        pbCenterCaptureNotice.value = "캡처 요청 실패 (연결/권한을 확인하세요)";
      } finally {
        pbCenterCaptureBusy.value = false;
        window.setTimeout(() => {
          pbCenterCaptureNotice.value = "";
        }, 3000);
      }
    };

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

    const showFingeringTable = ref(false);

    const fingeringFilterText = ref("");
    const fingeringFilterOnlyEnabled = ref(false);
    const fingeringFilterOnlyWithKeys = ref(false);
    const fingeringFilterOnlyWithNote = ref(false);
    const fingeringFilterIndexFrom = ref(0);
    const fingeringFilterIndexTo = ref(fingeringEntryCount - 1);

    const saxKeyLabelPresets: Record<"sax" | "numbers", string[]> = {
      // 인덱스(0-25)는 펌웨어 내부 키 번호이고, 라벨은 UI 표시용입니다.
      sax: [
        "Octave",
        "LH 1",
        "LH 2",
        "LH 3",
        "RH 1",
        "RH 2",
        "RH 3",
        "Low F#",
        "Alt",
        "Bis Bb",
        "G#",
        "Palm D",
        "Palm Eb",
        "Palm F",
        "Side C",
        "Side Bb",
        "Side F#",
        "Low Eb",
        "Low C",
        "Low B",
        "Low Bb",
        "Front F",
        "High F#",
        "Alt 1",
        "Alt 2",
        "Low A",
      ],
      numbers: Array.from({ length: 26 }, (_, i) => String(i)),
    };

    const fingeringKeyLabelPreset = ref<"sax" | "numbers">("sax");
    const fingeringKeyLabels = ref<string[]>([...saxKeyLabelPresets.sax]);
    const showFingeringKeyIndex = ref(false);
    const showFingeringLabelEditor = ref(false);

    type FingeringEntryLayoutMode = "grid" | "horizontal";
    const fingeringEntryLayoutMode = ref<FingeringEntryLayoutMode>("horizontal");

    const fingeringEntriesScrollEl = ref<HTMLElement | null>(null);
    const canScrollFingeringLeft = ref(false);
    const canScrollFingeringRight = ref(false);

    const updateFingeringScrollButtons = (): void => {
      const el = fingeringEntriesScrollEl.value;
      if (!el || fingeringEntryLayoutMode.value !== "horizontal") {
        canScrollFingeringLeft.value = false;
        canScrollFingeringRight.value = false;
        return;
      }

      const left = el.scrollLeft;
      const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);

      canScrollFingeringLeft.value = left > 0;
      // allow a tiny epsilon for fractional scroll positions
      canScrollFingeringRight.value = left < maxLeft - 1;
    };

    const scrollFingeringEntriesByPage = (direction: number): void => {
      const el = fingeringEntriesScrollEl.value;
      if (!el || fingeringEntryLayoutMode.value !== "horizontal") {
        return;
      }

      const dir = Math.sign(Number(direction) || 0);
      if (!dir) {
        return;
      }

      const page = Math.max(120, el.clientWidth);
      el.scrollBy({ left: dir * page, behavior: "smooth" });

      // After smooth scroll, update state a bit later.
      window.setTimeout(() => updateFingeringScrollButtons(), 200);
    };

    const uiStateKey = "opendeck.midisaxophone.ui";

    const loadUiState = (): void => {
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(uiStateKey) : null;
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.showFingeringTable === "boolean") {
            showFingeringTable.value = parsed.showFingeringTable;
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

          if (parsed.fingeringKeyLabelPreset === "sax" || parsed.fingeringKeyLabelPreset === "numbers") {
            fingeringKeyLabelPreset.value = parsed.fingeringKeyLabelPreset;
          }
          if (typeof parsed.showFingeringKeyIndex === "boolean") {
            showFingeringKeyIndex.value = parsed.showFingeringKeyIndex;
          }
          if (typeof parsed.showFingeringLabelEditor === "boolean") {
            showFingeringLabelEditor.value = parsed.showFingeringLabelEditor;
          }
          if (parsed.fingeringEntryLayoutMode === "grid" || parsed.fingeringEntryLayoutMode === "horizontal") {
            fingeringEntryLayoutMode.value = parsed.fingeringEntryLayoutMode;
          }
          if (Array.isArray(parsed.fingeringKeyLabels)) {
            const next = parsed.fingeringKeyLabels
              .slice(0, 26)
              .map((v: any, i: number) => (typeof v === "string" ? v : saxKeyLabelPresets[fingeringKeyLabelPreset.value][i] || String(i)));
            if (next.length === 26) {
              fingeringKeyLabels.value = next;
            }
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
            showFingeringTable: showFingeringTable.value,
            fingeringFilterText: fingeringFilterText.value,
            fingeringFilterOnlyEnabled: fingeringFilterOnlyEnabled.value,
            fingeringFilterOnlyWithKeys: fingeringFilterOnlyWithKeys.value,
            fingeringFilterOnlyWithNote: fingeringFilterOnlyWithNote.value,
            fingeringFilterIndexFrom: fingeringFilterIndexFrom.value,
            fingeringFilterIndexTo: fingeringFilterIndexTo.value,

            fingeringKeyLabelPreset: fingeringKeyLabelPreset.value,
            fingeringKeyLabels: fingeringKeyLabels.value,
            showFingeringKeyIndex: showFingeringKeyIndex.value,
            showFingeringLabelEditor: showFingeringLabelEditor.value,
            fingeringEntryLayoutMode: fingeringEntryLayoutMode.value,
          }),
        );
      } catch {
        // ignore quota / private mode
      }
    };

    const onFingeringEntryLayoutModeChange = (event: Event): void => {
      const target = event && (event.target as unknown as HTMLSelectElement);
      const value = target && typeof target.value === "string" ? target.value : "horizontal";
      if (value === "grid" || value === "horizontal") {
        fingeringEntryLayoutMode.value = value;
      }
    };

    const resetFingeringLabelsToPreset = (): void => {
      fingeringKeyLabels.value = [...saxKeyLabelPresets[fingeringKeyLabelPreset.value]];
    };

    const onFingeringLabelPresetChange = (event: Event): void => {
      const target = event && (event.target as unknown as HTMLSelectElement);
      const value = target && typeof target.value === "string" ? target.value : "sax";
      if (value === "sax" || value === "numbers") {
        fingeringKeyLabelPreset.value = value;
        resetFingeringLabelsToPreset();
      }
    };

    const onFingeringKeyLabelInput = (index: number, event: Event): void => {
      const i = Math.max(0, Math.min(25, Math.floor(Number(index) || 0)));
      const target = event && (event.target as unknown as HTMLInputElement);
      const text = target && typeof target.value === "string" ? target.value : "";

      const next = [...fingeringKeyLabels.value];
      while (next.length < 26) {
        next.push("");
      }
      next[i] = text;
      fingeringKeyLabels.value = next;
    };

    const fingeringKeyLabelsText = computed((): string => {
      const list = fingeringKeyLabels.value || [];
      const lines: string[] = [];
      for (let i = 0; i < 26; i++) {
        lines.push(String(list[i] ?? ""));
      }
      return lines.join("\n");
    });

    const onFingeringKeyLabelsTextInput = (event: Event): void => {
      const target = event && (event.target as unknown as HTMLTextAreaElement);
      const text = target && typeof target.value === "string" ? target.value : "";
      const rawLines = text.split(/\r?\n/);
      const next: string[] = [];
      for (let i = 0; i < 26; i++) {
        const v = rawLines[i];
        next.push(typeof v === "string" ? v.trim() : "");
      }
      fingeringKeyLabels.value = next;
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
      return saxSections.value.map((section: any) => {
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

    const setFingeringMask = async (entryIndex: number, rawMask: number) => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }

      const all = ((1 << fingeringKeyCount) - 1) >>> 0;
      const mask = (Number(rawMask) >>> 0) & all;

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

    const setFingeringKeysText = async (entryIndex: number, text: string) => {
      const mask = parseKeysToMask(text);
      return setFingeringMask(entryIndex, mask);
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

    onMounted(() => {
      loadUiState();
      loadFingeringTable();

      // Keep scroll arrow enablement in sync.
      window.setTimeout(() => updateFingeringScrollButtons(), 0);
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
      () => [showFingeringTable.value],
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
      () => [
        fingeringKeyLabelPreset.value,
        showFingeringKeyIndex.value,
        showFingeringLabelEditor.value,
        fingeringEntryLayoutMode.value,
        fingeringKeyLabels.value.join("\u0000"),
      ],
      () => saveUiState(),
      { deep: false },
    );

    watch(
      () => isConnected.value,
      (connected) => {
        if (connected) {
          loadFingeringTable();
          detachBreathActivityListener?.();
          detachBreathActivityListener = attachBreathActivityListener(deviceStore.state.input as any);
        } else {
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

    const fingeringEntryDetailsOpen = ref<Record<number, boolean>>({});
    const isFingeringEntryDetailsOpen = (entryIndex: number): boolean => fingeringEntryDetailsOpen.value[entryIndex] === true;
    const toggleFingeringEntryDetails = (entryIndex: number): void => {
      fingeringEntryDetailsOpen.value[entryIndex] = !isFingeringEntryDetailsOpen(entryIndex);
    };

    const openAllFingeringEntryDetails = (): void => {
      const next: Record<number, boolean> = {};
      for (let i = 0; i < fingeringEntryCount; i++) {
        next[i] = true;
      }
      fingeringEntryDetailsOpen.value = next;
    };

    const closeAllFingeringEntryDetails = (): void => {
      fingeringEntryDetailsOpen.value = {};
    };

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

    watch(
      () => [
        fingeringEntryLayoutMode.value,
        visibleFingeringEntries.value.length,
        fingeringLoading.value,
      ],
      () => {
        window.setTimeout(() => updateFingeringScrollButtons(), 0);
      },
      { deep: false },
    );

    return {
      formData,
      loading,
      onSaxSettingChange,
      showField,
      saxSections,
      hasSaxSections,
      saxHelpItems,
      isConnected,

      pbCenterCaptureBusy,
      pbCenterCaptureNotice,
      runPbCenterCapture,

      clearBreathActivity,
      breathCcStatusLine,
      lastBreathCcTime,
      showFingeringTable,

      fingeringSupport,
      fingeringLoading,
      fingeringEntryCount,
      fingeringEntries,
      visibleFingeringEntries,
      isFingeringEntryDetailsOpen,
      toggleFingeringEntryDetails,
      openAllFingeringEntryDetails,
      closeAllFingeringEntryDetails,
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
      setFingeringMask,
      setFingeringKeysText,
      setFingeringNote,
      activeFingeringEntryIndex,
      setFingeringEntryEl,
      setFingeringNoteInputEl,

      fingeringKeyLabelPreset,
      fingeringKeyLabels,
      showFingeringKeyIndex,
      showFingeringLabelEditor,
      fingeringEntryLayoutMode,
      fingeringEntriesScrollEl,
      canScrollFingeringLeft,
      canScrollFingeringRight,
      scrollFingeringEntriesByPage,
      updateFingeringScrollButtons,
      onFingeringLabelPresetChange,
      onFingeringEntryLayoutModeChange,
      onFingeringKeyLabelInput,
      fingeringKeyLabelsText,
      onFingeringKeyLabelsTextInput,
      resetFingeringLabelsToPreset,
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
