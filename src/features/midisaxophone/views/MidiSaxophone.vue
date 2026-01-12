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
          v-if="isConnected && formData.saxRegisterChromaticEnable"
          class="mb-8"
        >
          <h4 class="heading mb-2">레지스터 키 맵(미리보기)</h4>
          <p class="text-sm mb-4">
            레지스터 키 인덱스(디지털 입력)와 실제 전송되는 노트 번호를 보여줍니다.
          </p>

          <Hero
            v-if="!registerKeyCount"
            custom="h-32"
            title="레지스터 키 수를 확인할 수 없습니다. (버튼 컴포넌트 수가 0이거나 아직 로드되지 않았습니다.)"
          />

          <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));">
            <div
              v-for="key in registerKeys"
              :key="key.index"
              class="surface-neutral border rounded px-4 py-3"
            >
              <div class="text-sm">
                <strong>키 {{ key.index }}</strong>
              </div>
              <div class="text-xs text-gray-400 mt-1">
                레지스터 키: <strong>{{ key.mappedIndex }}</strong>
              </div>
              <div class="text-sm mt-1">
                노트: <strong>{{ key.note }}</strong>
                <span v-if="key.noteName">({{ key.noteName }})</span>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="isConnected && formData.saxRegisterChromaticEnable"
          class="mb-8"
          :class="{ 'pointer-events-none opacity-50': fingeringLoading }"
        >
          <h4 class="heading mb-2">핑거링 테이블 (24키)</h4>
          <p class="text-sm mb-4">
            키 조합(눌린 키 목록) → 노트(0-127)를 테이블로 지정합니다. 매칭은 “가장 많은 키가 일치하는 항목”이 우선입니다.
          </p>

          <Hero
            v-if="fingeringSupport === 'unsupported'"
            custom="h-32"
            title="이 펌웨어에서는 핑거링 테이블을 지원하지 않습니다."
          />

          <div v-else class="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-4">
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

          <div class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
            <div
              v-for="entry in fingeringEntries"
              :key="`fing-${entry.index}`"
              class="surface-neutral border rounded px-4 py-3"
            >
              <div class="flex items-center justify-between mb-3">
                <div class="text-sm"><strong>#{{ entry.index }}</strong></div>
                <label class="text-xs text-gray-400">
                  <input
                    type="checkbox"
                    :checked="entry.enabled"
                    @change="onFingeringEnabledChange(entry.index, $event)"
                  />
                  사용
                </label>
              </div>

              <label class="text-xs text-gray-400 block mb-1">눌린 키 목록 (0-23, 예: 0,3,5)</label>
              <input
                class="w-full"
                :value="entry.keysText"
                :disabled="!entry.enabled"
                @change="onFingeringKeysChange(entry.index, $event)"
              />

              <label class="text-xs text-gray-400 block mt-3 mb-1">노트 (0-127)</label>
              <input
                class="w-full"
                type="number"
                min="0"
                max="127"
                :value="entry.note"
                :disabled="!entry.enabled"
                @change="onFingeringNoteChange(entry.index, $event)"
              />
            </div>
          </div>
        </div>

        <div
          v-if="isConnected && formData.saxRegisterChromaticEnable"
          class="mb-8"
          :class="{ 'pointer-events-none opacity-50': keyMapLoading }"
        >
          <h4 class="heading mb-2">레지스터 키 매핑</h4>
          <p class="text-sm mb-4">
            각 키(디지털 입력)가 어떤 레지스터 키 번호(0부터)로 동작할지 지정합니다. 기본값은 “자기 인덱스 그대로”입니다.
          </p>

          <div class="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-4">
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
            custom="h-32"
            title="이 펌웨어에서는 레지스터 키 매핑 저장을 지원하지 않습니다."
          />

          <p v-else-if="duplicateMappedKeys.length" class="text-sm mb-4">
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

          <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));">
            <div
              v-for="key in registerKeys"
              :key="`map-${key.index}`"
              class="surface-neutral border rounded px-4 py-3"
            >
              <div class="text-sm mb-2">
                <strong>키 {{ key.index }}</strong>
              </div>

              <label class="text-xs text-gray-400 block mb-1">레지스터 키 번호</label>
              <select
                class="w-full"
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

        <p v-if="!isConnected" class="text-sm mb-6">
          디바이스가 연결되지 않았습니다. 설정을 변경하려면 먼저 연결하세요.
        </p>

        <p v-else-if="!hasSaxSections" class="text-sm mb-6">
          이 UI 빌드에는 색소폰 설정 항목이 포함되어 있지 않습니다.
        </p>

        <div
          class="form-grid"
          :class="{ 'pointer-events-none opacity-50': !isConnected }"
        >
          <template v-for="section in saxSections">
            <FormField
              v-if="showField(section)"
              :key="section.key"
              :value="formData[section.key]"
              :field-definition="section"
              @modified="onSaxSettingChange"
            />
          </template>
        </div>
      </div>
    </Section>
  </form>
</template>

<script lang="ts">
import { defineComponent, computed, ref, onMounted, watch } from "vue";
import { Block, SectionType, BlockMap } from "../../../definitions";
import { useDeviceForm } from "../../../composables";
import { midiStoreMapped, deviceStoreMapped, deviceStore } from "../../../store";

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

    const fingeringEntryCount = 128;

    const { formData, loading, onSettingChange, showField } = useDeviceForm(
      Block.Global,
      SectionType.Setting,
    );

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
      "saxBreathControllerCC",
    ]);

    const saxSections = computed(() => {
      const globalSections = Object.values(BlockMap[Block.Global].sections);
      return globalSections.filter(
        (section) => section.type === SectionType.Setting && saxKeys.has(section.key),
      );
    });

    const hasSaxSections = computed(() => saxSections.value.length > 0);

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
      const count =
        (numberOfComponents.value && numberOfComponents.value[Block.Button]) || 0;
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
          Object.prototype.hasOwnProperty.call(
            values,
            "saxFingeringMaskHi10Enable",
          ) &&
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

    const parseKeysToMask24 = (text: string): number => {
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
        if (idx < 0 || idx > 23) {
          continue;
        }
        mask |= 1 << idx;
      }
      return mask >>> 0;
    };

    const mask24ToKeysText = (mask: number): string => {
      const keys: number[] = [];
      for (let i = 0; i < 24; i++) {
        if ((mask >>> i) & 1) {
          keys.push(i);
        }
      }
      return keys.join(",");
    };

    const splitMaskTo14BitParts = (mask: number) => {
      const lo14 = mask & 0x3fff;
      const hi10 = (mask >>> 14) & 0x03ff;
      return { lo14, hi10 };
    };

    const setGlobalValue = async (
      section: number,
      index: number,
      value: number,
    ) => {
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
      const current =
        (fingeringMaskHi10Enable.value &&
          fingeringMaskHi10Enable.value[entryIndex]) ||
        0;
      const hi10 = current & 0x03ff;
      const next = enabled ? hi10 | (1 << 10) : hi10;
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
      const raw =
        target && typeof target.value !== "undefined" ? Number(target.value) : 0;
      return setFingeringNote(entryIndex, raw);
    };

    const setFingeringKeysText = async (entryIndex: number, text: string) => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }
      const mask = parseKeysToMask24(text);
      const { lo14, hi10 } = splitMaskTo14BitParts(mask);
      const currentHiEn =
        (fingeringMaskHi10Enable.value &&
          fingeringMaskHi10Enable.value[entryIndex]) ||
        0;
      const enabledBit = currentHiEn & (1 << 10);
      const nextHiEn = (hi10 & 0x03ff) | enabledBit;

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
      const text =
        target && typeof target.value !== "undefined" ? String(target.value) : "";
      return setFingeringKeysText(entryIndex, text);
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
          const current =
            saxRegisterKeyMapRaw.value && saxRegisterKeyMapRaw.value[i];
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
      const rawValue =
        target && typeof target.value !== "undefined" ? Number(target.value) : 0;
      return setSaxRegisterKeyMap(physicalIndex, rawValue);
    };

    const registerKeys = computed(() => {
      const count = registerKeyCount.value;
      const base = clampMidiNote(Number(formData.saxRegisterChromaticBaseNote) || 0);
      return Array.from({ length: count }, (_, index) => {
        const raw = saxRegisterKeyMapRaw.value && saxRegisterKeyMapRaw.value[index];
        const mappedIndex = raw && raw > 0 ? raw - 1 : index;
        const note = clampMidiNote(base + mappedIndex);
        return {
          index,
          mappedIndex,
          note,
          noteName: midiNoteName(note),
        };
      });
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
      const raw =
        saxRegisterKeyMapRaw.value && saxRegisterKeyMapRaw.value[physicalIndex];
      return Number(raw) || 0;
    };

    onMounted(() => {
      loadSaxRegisterKeyMap();
      loadFingeringTable();
    });

    watch(
      () => isConnected.value,
      (connected) => {
        if (connected) {
          loadSaxRegisterKeyMap();
          loadFingeringTable();
        } else {
          saxRegisterKeyMapRaw.value = null;
          saxRegisterKeyMapSupport.value = "unknown";
          fingeringMaskLo14.value = null;
          fingeringMaskHi10Enable.value = null;
          fingeringNote.value = null;
          fingeringSupport.value = "unknown";
        }
      },
    );

    const fingeringEntries = computed(() => {
      const lo = fingeringMaskLo14.value || [];
      const hiEn = fingeringMaskHi10Enable.value || [];
      const noteArr = fingeringNote.value || [];

      return Array.from({ length: fingeringEntryCount }, (_, index) => {
        const lo14 = Number(lo[index] || 0) & 0x3fff;
        const hiEnVal = Number(hiEn[index] || 0) & 0x7ff;
        const hi10 = hiEnVal & 0x03ff;
        const enabled = (hiEnVal & (1 << 10)) !== 0;
        const mask = (lo14 | (hi10 << 14)) >>> 0;
        const note = Math.max(
          0,
          Math.min(127, Math.floor(Number(noteArr[index] || 0))),
        );

        return {
          index,
          enabled,
          mask,
          keysText: mask24ToKeysText(mask),
          note,
        };
      });
    });

    return {
      formData,
      loading,
      onSaxSettingChange,
      showField,
      saxSections,
      hasSaxSections,
      isConnected,
      registerKeyCount,
      registerKeys,
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
      reloadFingering,
      onFingeringEnabledChange,
      onFingeringKeysChange,
      onFingeringNoteChange,
      setFingeringEnabled,
      setFingeringKeysText,
      setFingeringNote,
    };
  },
});
</script>
