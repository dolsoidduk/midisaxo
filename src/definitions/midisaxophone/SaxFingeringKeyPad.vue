<template>
  <div class="surface-neutral border rounded px-2 py-2">
    <div class="flex items-center justify-between mb-2">
      <div class="text-xs text-gray-400">
        <strong class="text-gray-200">26키</strong>
        <span class="ml-2">클릭해서 토글</span>
      </div>

      <div class="flex items-center gap-2 text-xs">
        <button
          class="px-2 py-1 border border-gray-700 rounded text-gray-200 hover:border-gray-500 disabled:opacity-50"
          :disabled="disabled"
          type="button"
          @click="clearAll"
        >
          전체 해제
        </button>
        <button
          class="px-2 py-1 border border-gray-700 rounded text-gray-200 hover:border-gray-500 disabled:opacity-50"
          :disabled="disabled"
          type="button"
          @click="invert"
        >
          반전
        </button>
      </div>
    </div>

    <div v-if="layoutMode === 'sax'" class="sax-layout">
      <div class="sax-panel">
        <div class="sax-grid">
          <button
            v-for="k in saxLayout"
            :key="`sax-${k.idx}`"
            type="button"
            class="group relative select-none rounded-md border font-semibold transition flex items-center justify-center"
            :class="[keyClass(k.idx), k.big ? 'text-sm' : 'text-xs']"
            :style="keyStyle(k)"
            :aria-pressed="isActive(k.idx) ? 'true' : 'false'"
            :title="`#${k.idx} ${labelFor(k.idx)}`"
            @click="toggle(k.idx)"
          >
            <span
              v-if="showIndex"
              class="absolute left-1 top-1 text-[10px] font-mono text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {{ k.idx }}
            </span>
            <span class="px-1 text-center leading-tight">{{
              labelFor(k.idx)
            }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-else class="grid gap-3">
      <div
        class="grid gap-2"
        style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));"
      >
        <div
          v-for="group in groups"
          :key="group.key"
          class="border border-gray-800/60 rounded-md px-2 py-2"
        >
          <div class="text-[11px] text-gray-400 mb-2">{{ group.title }}</div>
          <div
            class="grid gap-1"
            :style="{
              gridTemplateColumns: `repeat(${group.columns}, minmax(0, 1fr))`,
            }"
          >
            <button
              v-for="idx in group.keys"
              :key="`k-${group.key}-${idx}`"
              type="button"
              class="group relative select-none rounded-md border font-semibold transition flex items-center justify-center"
              :class="[keyClass(idx), group.big ? 'text-sm' : 'text-xs']"
              :style="{ height: group.big ? '42px' : '34px' }"
              :aria-pressed="isActive(idx) ? 'true' : 'false'"
              :title="`#${idx} ${labelFor(idx)}`"
              @click="toggle(idx)"
            >
              <span
                v-if="showIndex"
                class="absolute left-1 top-1 text-[10px] font-mono text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {{ idx }}
              </span>
              <span class="px-1 text-center leading-tight">{{
                labelFor(idx)
              }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-2 text-[11px] text-gray-400">
      현재 마스크: <span class="font-mono text-gray-200">0x{{ maskHex }}</span>
      <span class="ml-2">({{ activeCount }} keys)</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";

type KeyGroup = {
  key: string;
  title: string;
  keys: number[];
  columns: number;
  big?: boolean;
};

type SaxLayoutKey = {
  idx: number;
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
  big?: boolean;
};

export default defineComponent({
  name: "SaxFingeringKeyPad",
  props: {
    mask: { type: Number, required: true },
    disabled: { type: Boolean, default: false },
    keyCount: { type: Number, default: 26 },
    labels: {
      type: (Array as unknown) as () => string[] | null,
      default: null,
    },
    showIndex: { type: Boolean, default: false },
    layoutMode: {
      type: (String as unknown) as () => "sax" | "grouped",
      default: "sax",
    },
  },
  emits: ["update:mask"],
  setup(props, { emit }) {
    const allMask = computed(() => {
      const count = Math.max(
        0,
        Math.min(26, Math.floor(Number(props.keyCount) || 26)),
      );
      // 26 is safe for JS bitwise ops (<= 31)
      return ((1 << count) - 1) >>> 0;
    });

    const safeMask = computed(() => (Number(props.mask) >>> 0) & allMask.value);

    const maskHex = computed(() =>
      safeMask.value.toString(16).toUpperCase().padStart(8, "0"),
    );

    const defaultLabels = computed((): string[] => {
      // 기본은 실제 색소폰 키 느낌의 라벨을 제공하되,
      // 내부 매핑(인덱스)은 그대로 유지합니다.
      return [
        // NOTE: Keep this aligned with the MIDI Saxophone page preset
        // (index->meaning mapping) so layout and labels stay consistent.
        "OCT",
        "LH1",
        "LH2",
        "LH3",
        "RH1",
        "RH2",
        "RH3",
        "LOW F#",
        "ALT",
        "BIS Bb",
        "G#",
        "PALM D",
        "PALM Eb",
        "PALM F",
        "SIDE C",
        "SIDE Bb",
        "SIDE F#",
        "LOW Eb",
        "LOW C",
        "LOW B",
        "LOW Bb",
        "FRONT F",
        "HIGH F#",
        "ALT 1",
        "ALT 2",
        "LOW A",
      ];
    });

    const labelFor = (index: number): string => {
      const i = Math.max(0, Math.min(25, Math.floor(Number(index) || 0)));
      const custom =
        props.labels && Array.isArray(props.labels) ? props.labels : null;
      const list = custom && custom.length >= 26 ? custom : defaultLabels.value;
      return String(list[i] ?? i);
    };

    const groups = computed((): KeyGroup[] => {
      // 그룹 구성은 UI용이며, 인덱스 자체는 변경하지 않습니다.
      return [
        {
          key: "register",
          title: "레지스터",
          keys: [0],
          columns: 4,
          big: true,
        },
        {
          key: "left",
          title: "왼손 메인",
          keys: [1, 2, 3, 9, 10],
          columns: 5,
        },
        {
          key: "palm",
          title: "팜/상단",
          keys: [11, 12, 13],
          columns: 3,
        },
        {
          key: "right",
          title: "오른손 메인",
          keys: [4, 5, 6],
          columns: 3,
        },
        {
          key: "side",
          title: "사이드",
          keys: [14, 15, 16],
          columns: 3,
        },
        {
          key: "low",
          title: "로우(하단)",
          // 실제 색소폰 느낌(왼손 새끼손가락 클러스터: G#/B/Bb, 오른손 새끼손가락: C/Eb)
          // 인덱스 의미는 그대로 두고, 표시 순서만 더 직관적으로 정리합니다.
          // 바리톤(LOW A 포함) 기준으로 LOW A(25)도 로우 클러스터에 포함합니다.
          keys: [19, 20, 25, 18, 17, 7],
          columns: 6,
        },
        {
          key: "alt",
          title: "보조/알티시모",
          keys: [21, 22, 23, 24, 8],
          columns: 5,
        },
      ];
    });

    const saxLayout = computed((): SaxLayoutKey[] => {
      // 대략적인 색소폰 실루엣 레이아웃 (12 columns grid)
      // IMPORTANT: idx(0..25) 의미는 MIDI Saxophone 페이지의 라벨 프리셋과 동일해야 함.
      // row/col은 1-base, span은 선택.
      return [
        // octave (back key)
        { idx: 0, row: 2, col: 1, rowSpan: 2, colSpan: 2, big: true },

        // palm keys (LH top)
        { idx: 11, row: 1, col: 3, colSpan: 2 },
        { idx: 12, row: 1, col: 5, colSpan: 2 },
        { idx: 13, row: 2, col: 3, colSpan: 2 },

        // front/extra near top of LH
        { idx: 21, row: 2, col: 7, colSpan: 2 },
        { idx: 22, row: 2, col: 9, colSpan: 2 },

        // left hand main stack
        { idx: 1, row: 4, col: 4, rowSpan: 2, colSpan: 2, big: true },
        { idx: 2, row: 6, col: 4, rowSpan: 2, colSpan: 2, big: true },
        { idx: 3, row: 8, col: 4, rowSpan: 2, colSpan: 2, big: true },

        // bis / g# near left hand
        { idx: 9, row: 4, col: 7, colSpan: 2 },
        { idx: 10, row: 9, col: 1, colSpan: 2 },

        // right hand main stack
        { idx: 4, row: 5, col: 7, rowSpan: 2, colSpan: 2, big: true },
        { idx: 5, row: 7, col: 7, rowSpan: 2, colSpan: 2, big: true },
        { idx: 6, row: 9, col: 7, rowSpan: 2, colSpan: 2, big: true },

        // side keys (RH side)
        { idx: 14, row: 5, col: 11, colSpan: 2 },
        { idx: 15, row: 7, col: 11, colSpan: 2 },
        { idx: 16, row: 9, col: 11, colSpan: 2 },

        // low keys cluster
        // 목표: 실제 색소폰처럼 왼손 새끼손가락(G#) 아래에 LOW B / LOW Bb를 배치.
        // 오른손 새끼손가락 쪽(C/Eb)은 우측에 모아 배치.
        { idx: 19, row: 11, col: 1, colSpan: 2 },
        { idx: 20, row: 12, col: 1, colSpan: 2 },

        // RH pinky cluster (C / Eb) + low F# (often sits further right)
        // Option A: C를 Eb보다 살짝 아래로 내려 롤러 느낌을 만듭니다.
        { idx: 18, row: 12, col: 7, colSpan: 2 },
        { idx: 17, row: 11, col: 9, colSpan: 2 },

        { idx: 7, row: 12, col: 11, colSpan: 2 },
        // baritone LOW A extension (place under left-hand spatula cluster)
        { idx: 25, row: 13, col: 1, colSpan: 2 },

        // alt keys (extra)
        { idx: 8, row: 13, col: 7, colSpan: 2 },
        { idx: 23, row: 14, col: 5, colSpan: 2 },
        { idx: 24, row: 14, col: 7, colSpan: 2 },
      ];
    });

    const keyStyle = (k: SaxLayoutKey) => {
      const rowSpan = Math.max(1, Math.floor(Number(k.rowSpan) || 1));
      const colSpan = Math.max(1, Math.floor(Number(k.colSpan) || 1));
      const height = k.big ? 40 : 32;

      return {
        gridRow: `${k.row} / span ${rowSpan}`,
        gridColumn: `${k.col} / span ${colSpan}`,
        height: `${height}px`,
      };
    };

    const activeCount = computed(() => {
      let cnt = 0;
      for (let i = 0; i < 26; i++) {
        if ((safeMask.value >>> i) & 1) {
          cnt++;
        }
      }
      return cnt;
    });

    const isActive = (index: number): boolean => {
      const i = Math.max(0, Math.min(25, Math.floor(Number(index) || 0)));
      return ((safeMask.value >>> i) & 1) === 1;
    };

    const keyClass = (index: number): string => {
      if (props.disabled) {
        return "opacity-50 cursor-not-allowed border-gray-800";
      }

      if (isActive(index)) {
        return "border-blue-400 bg-blue-500/15 text-blue-100 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]";
      }

      return "border-gray-700 bg-gray-900/30 text-gray-200 hover:border-gray-500";
    };

    const toggle = (index: number): void => {
      if (props.disabled) {
        return;
      }
      const i = Math.max(0, Math.min(25, Math.floor(Number(index) || 0)));
      const next = (safeMask.value ^ (1 << i)) >>> 0;
      emit("update:mask", next);
    };

    const clearAll = (): void => {
      if (props.disabled) {
        return;
      }
      emit("update:mask", 0);
    };

    const invert = (): void => {
      if (props.disabled) {
        return;
      }
      emit("update:mask", (safeMask.value ^ allMask.value) >>> 0);
    };

    return {
      maskHex,
      groups,
      saxLayout,
      activeCount,
      isActive,
      keyClass,
      keyStyle,
      labelFor,
      toggle,
      clearAll,
      invert,
    };
  },
});
</script>

<style scoped>
.sax-layout {
  padding: 0.25rem;
}

.sax-panel {
  border: 1px solid rgba(31, 41, 55, 0.7);
  border-radius: 0.75rem;
  padding: 0.75rem;
  background: rgba(17, 24, 39, 0.18);
}

.sax-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 32px;
  gap: 0.35rem;
}
</style>
