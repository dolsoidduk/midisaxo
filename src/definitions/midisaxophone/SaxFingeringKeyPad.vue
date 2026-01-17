<template>
  <div class="surface-neutral border rounded px-2 py-2">
    <div class="flex items-center justify-between mb-2">
      <div class="text-xs text-gray-400">
        <strong class="text-gray-200">{{ visibleKeyCount }}키</strong>
        <span class="ml-2">눌림: <strong class="text-gray-200">{{ activeCount }}개</strong></span>
        <span class="ml-2 text-gray-500">({{ activeKeysText || "-" }})</span>
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
            class="group relative select-none rounded-full border font-semibold transition flex items-center justify-center overflow-hidden sax-pad"
            :class="[keyClass(k.idx), k.big ? 'text-sm' : 'text-xs']"
            :style="keyStyle(k)"
            :aria-pressed="isActive(k.idx) ? 'true' : 'false'"
            :title="`#${k.idx} ${labelFor(k.idx)}`"
            :disabled="disabled || !isUsableKey(k.idx)"
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

    <div v-else-if="layoutMode === 'linear'" class="grid gap-2">
      <div
        class="grid gap-1"
        :style="{ gridTemplateColumns: `repeat(${Math.min(8, Math.max(1, visibleKeyCount))}, minmax(0, 1fr))` }"
      >
        <button
          v-for="idx in linearKeys"
          :key="`lin-${idx}`"
          type="button"
          class="group relative select-none rounded-full border font-semibold transition flex items-center justify-center overflow-hidden sax-pad"
          :class="[keyClass(idx), 'text-sm']"
          :style="{ height: '42px' }"
          :aria-pressed="isActive(idx) ? 'true' : 'false'"
          :title="`#${idx} ${labelFor(idx)}`"
          :disabled="disabled"
          @click="toggle(idx)"
        >
          <span
            v-if="showIndex"
            class="absolute left-1 top-1 text-[10px] font-mono text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {{ idx }}
          </span>
          <span class="px-1 text-center leading-tight">{{ labelFor(idx) }}</span>
        </button>
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
              class="group relative select-none rounded-full border font-semibold transition flex items-center justify-center overflow-hidden sax-pad"
              :class="[keyClass(idx), group.big ? 'text-sm' : 'text-xs']"
              :style="{ height: group.big ? '42px' : '34px' }"
              :aria-pressed="isActive(idx) ? 'true' : 'false'"
              :title="`#${idx} ${labelFor(idx)}`"
              :disabled="disabled || !isUsableKey(idx)"
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
import {
  DEFAULT_SAX_LAYOUT_24,
  SaxLayoutKey,
  normalizeSaxLayoutToFineGrid,
} from "./sax-fingering-layout";

type KeyGroup = {
  key: string;
  title: string;
  keys: number[];
  columns: number;
  big?: boolean;
};

export default defineComponent({
  name: "SaxFingeringKeyPad",
  props: {
    mask: { type: Number, required: true },
    disabled: { type: Boolean, default: false },
    keyCount: { type: Number, default: 24 },
    usableMask: { type: Number, default: null },
    visibleMask: { type: Number, default: null },
    hideUnusableKeys: { type: Boolean, default: false },
    labels: {
      type: (Array as unknown) as () => string[] | null,
      default: null,
    },
    showIndex: { type: Boolean, default: false },
    layoutMode: {
      type: (String as unknown) as () => "sax" | "grouped" | "linear",
      default: "sax",
    },

    // Optional override for the sax silhouette layout (UI only).
    // If invalid, the built-in default layout will be used.
    saxLayoutOverride: {
      type: Array as unknown as () => SaxLayoutKey[] | null,
      default: null,
    },
  },
  emits: ["update:mask"],
  setup(props, { emit }) {
    const effectiveKeyCount = computed(() => {
      return Math.max(0, Math.min(24, Math.floor(Number(props.keyCount) || 24)));
    });

    const full24Mask = 0x00ffffff;

    const normalizedUsableMask = computed((): number | null => {
      const raw = props.usableMask;
      if (typeof raw !== "number") {
        return null;
      }
      return (Number(raw) >>> 0) & full24Mask;
    });

    const normalizedVisibleMask = computed((): number | null => {
      const raw = props.visibleMask;
      if (typeof raw !== "number") {
        return null;
      }
      return (Number(raw) >>> 0) & full24Mask;
    });

    const allMask = computed(() => {
      const usable = normalizedUsableMask.value;
      if (typeof usable === "number") {
        return usable;
      }
      const count = effectiveKeyCount.value;
      // 24 is safe for JS bitwise ops (<= 31)
      return ((1 << count) - 1) >>> 0;
    });

    // For visualization, keep the raw 24-bit mask even if usableMask hides/disables keys.
    // This prevents “눌림은 있는데 표시가 없다” 상황을 줄입니다.
    const safeMask = computed(() => (Number(props.mask) >>> 0) & full24Mask);

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
        "LOW C#",
      ];
    });

    const labelFor = (index: number): string => {
      const i = Math.max(0, Math.min(23, Math.floor(Number(index) || 0)));
      const custom =
        props.labels && Array.isArray(props.labels) ? props.labels : null;
      const list = custom && custom.length >= 24 ? custom : defaultLabels.value;
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
          // LOW C#은 ALT1(23)을 재지정해서 사용(표시/편의 목적)
          keys: [19, 20, 23, 18, 17, 7],
          columns: 6,
        },
        {
          key: "alt",
          title: "보조/알티시모",
          keys: [21, 22, 8],
          columns: 3,
        },
      ];
    });

    const visibleGroups = computed((): KeyGroup[] => {
      if (!props.hideUnusableKeys && typeof normalizedVisibleMask.value !== "number") {
        return groups.value;
      }

      return groups.value
        .map((g) => ({
          ...g,
          keys: g.keys.filter((k) => isVisibleKey(k)),
        }))
        .filter((g) => g.keys.length > 0);
    });

    const normalizeSaxLayout = (raw: unknown): SaxLayoutKey[] | null => {
      if (!raw || !Array.isArray(raw)) {
        return null;
      }

      if (raw.length !== 24) {
        return null;
      }

      const seen = new Set<number>();
      const out: SaxLayoutKey[] = [];

      for (const item of raw as any[]) {
        const idx = Math.floor(Number(item?.idx));
        const row = Math.floor(Number(item?.row));
        const col = Math.floor(Number(item?.col));
        if (!Number.isFinite(idx) || idx < 0 || idx > 23) {
          return null;
        }
        if (!Number.isFinite(row) || row < 1) {
          return null;
        }
        if (!Number.isFinite(col) || col < 1) {
          return null;
        }
        if (seen.has(idx)) {
          return null;
        }
        seen.add(idx);

        const rowSpan =
          item?.rowSpan === undefined
            ? undefined
            : Math.max(1, Math.floor(Number(item?.rowSpan) || 1));
        const colSpan =
          item?.colSpan === undefined
            ? undefined
            : Math.max(1, Math.floor(Number(item?.colSpan) || 1));

        out.push({
          idx,
          row,
          col,
          rowSpan,
          colSpan,
          big: !!item?.big,
        });
      }

      return out;
    };

    const saxLayout = computed((): SaxLayoutKey[] => {
      const override = normalizeSaxLayout(props.saxLayoutOverride);
      const base = override ?? DEFAULT_SAX_LAYOUT_24;
      return normalizeSaxLayoutToFineGrid(base);
    });

    const visibleSaxLayout = computed((): SaxLayoutKey[] => {
      if (!props.hideUnusableKeys && typeof normalizedVisibleMask.value !== "number") {
        return saxLayout.value;
      }
      return saxLayout.value.filter((k) => isVisibleKey(k.idx));
    });

    const visibleKeys = computed((): number[] => {
      const visible = normalizedVisibleMask.value;
      if (typeof visible === "number") {
        const keys: number[] = [];
        for (let i = 0; i < 24; i++) {
          if ((visible >>> i) & 1) {
            keys.push(i);
          }
        }
        return keys;
      }

      const usable = normalizedUsableMask.value;
      if (typeof usable === "number") {
        const keys: number[] = [];
        for (let i = 0; i < 24; i++) {
          if ((usable >>> i) & 1) {
            keys.push(i);
          }
        }
        return keys;
      }

      const count = effectiveKeyCount.value;
      return Array.from({ length: count }, (_, i) => i);
    });

    const visibleKeyCount = computed((): number => visibleKeys.value.length);

    const linearKeys = computed((): number[] => visibleKeys.value);

    const keyStyle = (k: SaxLayoutKey) => {
      const rowSpan = Math.max(1, Math.floor(Number(k.rowSpan) || 1));
      const colSpan = Math.max(1, Math.floor(Number(k.colSpan) || 1));

      return {
        gridRow: `${k.row} / span ${rowSpan}`,
        gridColumn: `${k.col} / span ${colSpan}`,
        width: "100%",
        height: "100%",
      };
    };

    const activeCount = computed(() => {
      let cnt = 0;
      for (let i = 0; i < 24; i++) {
        if ((safeMask.value >>> i) & 1) {
          cnt++;
        }
      }
      return cnt;
    });

    const activeKeysText = computed((): string => {
      const keys: number[] = [];
      for (let i = 0; i < 24; i++) {
        if ((safeMask.value >>> i) & 1) {
          keys.push(i);
        }
      }
      return keys.join(",");
    });

    const isActive = (index: number): boolean => {
      const i = Math.max(0, Math.min(23, Math.floor(Number(index) || 0)));
      return ((safeMask.value >>> i) & 1) === 1;
    };

    const isUsableKey = (index: number): boolean => {
      const i = Math.max(0, Math.min(23, Math.floor(Number(index) || 0)));
      const usable = normalizedUsableMask.value;
      if (typeof usable === "number") {
        return ((usable >>> i) & 1) === 1;
      }
      return i < effectiveKeyCount.value;
    };

    const isVisibleKey = (index: number): boolean => {
      const i = Math.max(0, Math.min(23, Math.floor(Number(index) || 0)));
      const visible = normalizedVisibleMask.value;
      if (typeof visible === "number") {
        return ((visible >>> i) & 1) === 1;
      }
      if (props.hideUnusableKeys) {
        return isUsableKey(i);
      }
      return true;
    };

    const keyClass = (index: number): string => {
      // In read-only mode (disabled), still show which keys are active.
      if (props.disabled) {
        if (isActive(index)) {
          // Make active keys clearly visible even when disabled (read-only preview).
          return "cursor-not-allowed border-blue-300 bg-blue-500/45 text-blue-50 ring-1 ring-blue-400/70 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]";
        }
        if (!isUsableKey(index)) {
          return "opacity-30 cursor-not-allowed border-gray-800 bg-gray-900/20 text-gray-500";
        }
        return "opacity-55 cursor-not-allowed border-gray-800 bg-gray-900/30 text-gray-200";
      }

      if (isActive(index)) {
        return "border-blue-300 bg-blue-500/45 text-blue-50 ring-1 ring-blue-400/70 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]";
      }

      if (!isUsableKey(index)) {
        return "opacity-35 cursor-not-allowed border-gray-800 bg-gray-900/20 text-gray-500";
      }

      return "border-gray-700 bg-gray-900/30 text-gray-200 hover:border-gray-500";
    };

    const toggle = (index: number): void => {
      if (props.disabled) {
        return;
      }
      const i = Math.max(0, Math.min(23, Math.floor(Number(index) || 0)));

      if (!isUsableKey(i)) {
        return;
      }

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
      effectiveKeyCount,
      visibleKeyCount,
      maskHex,
      groups: visibleGroups,
      saxLayout: visibleSaxLayout,
      linearKeys,
      activeCount,
      activeKeysText,
      isActive,
      isUsableKey,
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
  grid-template-columns: repeat(24, minmax(0, 1fr));
  grid-auto-rows: 21px;
  gap: 0.175rem;
  align-items: stretch;
  justify-items: stretch;
}

.sax-pad {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -2px 0 rgba(0, 0, 0, 0.35), 0 2px 10px rgba(0, 0, 0, 0.32);
}

.sax-pad::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.03) 40%,
    rgba(0, 0, 0, 0.15) 100%
  );
}

.sax-pad:active {
  transform: translateY(1px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.35),
    0 1px 6px rgba(0, 0, 0, 0.28);
}
</style>
