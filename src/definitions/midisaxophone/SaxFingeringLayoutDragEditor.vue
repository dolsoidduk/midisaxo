<template>
  <div class="border border-gray-800/60 rounded-md px-2 py-2">
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <div class="text-[11px] text-gray-400">
        키를 드래그해서 위치를 바꿉니다(스냅). 겹치면 이동이 적용되지 않습니다.
      </div>
      <div class="flex-grow"></div>
      <div class="flex items-center gap-2 text-[11px] text-gray-500">
        <span>줌</span>
        <input
          v-model.number="zoomPercent"
          type="range"
          min="70"
          max="160"
          step="5"
        />
        <span class="font-mono text-gray-400">{{ zoomPercent }}%</span>
        <button
          type="button"
          class="px-2 py-1 border border-gray-700 rounded text-gray-200 hover:border-gray-500"
          @click.prevent="resetZoom"
        >
          100%
        </button>
      </div>
      <div class="text-[11px] text-gray-500">
        선택 후 방향키로 미세 이동 가능
      </div>
    </div>

    <div class="sax-layout">
      <div class="sax-panel editor-resize" :style="editorPanelStyle">
        <div
          ref="gridEl"
          class="sax-grid"
          tabindex="0"
          role="application"
          aria-label="Sax layout editor"
          :style="gridStyle"
          @keydown="onGridKeyDown"
        >
          <button
            v-for="k in visibleLayout"
            :key="`edit-${k.idx}`"
            type="button"
            class="key-btn group relative select-none rounded-full border font-semibold transition flex items-center justify-center overflow-hidden sax-pad"
            :class="keyClass(k.idx, k.big)"
            :style="keyStyle(k)"
            :title="`#${k.idx} ${labelFor(k.idx)}`"
            @click.prevent="select(k.idx)"
            @pointerdown.prevent="onPointerDown(k.idx, $event)"
            @keydown="onGridKeyDown"
          >
            <span
              v-if="showIndexHint"
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
      <div class="mt-1 text-[11px] text-gray-500">
        편집창은 엔트리 키패드와 비슷한 비율로 표시됩니다. 크기는 위의 줌으로
        조절하세요.
      </div>
    </div>

    <div
      v-if="selectedKey"
      class="mt-2 border border-gray-800/60 rounded-md px-2 py-2"
    >
      <div class="flex flex-wrap items-center gap-2 mb-2">
        <div class="text-[11px] text-gray-400">
          선택된 키:
          <strong class="text-gray-200">#{{ selectedKey.idx }}</strong>
          <span class="ml-2 text-gray-500"
            >({{ labelFor(selectedKey.idx) }})</span
          >
        </div>
        <div class="flex-grow"></div>
        <button
          type="button"
          class="px-2 py-1 border border-gray-700 rounded text-gray-200 hover:border-gray-500"
          @click.prevent="resetSelectedToDefault"
        >
          기본값으로
        </button>
        <button
          type="button"
          class="px-2 py-1 border border-gray-700 rounded text-gray-200 hover:border-gray-500"
          @click.prevent="applySelectedDraft"
        >
          적용
        </button>
      </div>

      <div class="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <label class="text-[11px] text-gray-300 grid gap-1 min-w-0">
          row
          <input
            v-model.number="draftRow"
            type="number"
            min="1"
            class="px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200 w-full min-w-0"
          />
        </label>
        <label class="text-[11px] text-gray-300 grid gap-1 min-w-0">
          col
          <input
            v-model.number="draftCol"
            type="number"
            min="1"
            class="px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200 w-full min-w-0"
          />
        </label>
        <label class="text-[11px] text-gray-300 grid gap-1 min-w-0">
          height
          <input
            v-model.number="draftRowSpan"
            type="number"
            min="1"
            class="px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200 w-full min-w-0"
          />
        </label>
        <label class="text-[11px] text-gray-300 grid gap-1 min-w-0">
          width
          <input
            v-model.number="draftColSpan"
            type="number"
            min="1"
            class="px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200 w-full min-w-0"
          />
        </label>
        <label
          class="text-[11px] text-gray-300 flex items-center gap-2 lg:justify-center"
        >
          <input v-model="draftBig" type="checkbox" />
          big
        </label>
      </div>

      <div v-if="lastError" class="mt-2 text-[11px] text-red-400">
        {{ lastError }}
      </div>
    </div>

    <div class="mt-2 text-[11px] text-gray-500">
      팁: 아래 JSON 텍스트에도 즉시 반영됩니다(저장: localStorage).
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, computed } from "vue";
import {
  DEFAULT_SAX_LAYOUT_24,
  SaxLayoutKey,
  normalizeSaxLayoutToFineGrid,
} from "./sax-fingering-layout";

type DragState = {
  idx: number;
  started: boolean;
  moved: boolean;
  startRow: number;
  startCol: number;
};

type PointerGridMetrics = {
  rectLeft: number;
  rectTop: number;
  rectWidth: number;
  cols: number;
  stepX: number;
  stepY: number;
  scrollLeft: number;
  scrollTop: number;
};

const clampInt = (value: unknown, min: number, max: number): number => {
  const n = Math.floor(Number(value) || 0);
  return Math.max(min, Math.min(max, n));
};

const toFullLayout = (input: unknown): SaxLayoutKey[] => {
  const baseByIdx = new Map<number, SaxLayoutKey>();
  for (const k of normalizeSaxLayoutToFineGrid(DEFAULT_SAX_LAYOUT_24)) {
    baseByIdx.set(k.idx, { ...k });
  }

  const arr = Array.isArray(input) ? (input as any[]) : [];
  const rawKeys: SaxLayoutKey[] = [];
  for (const raw of arr) {
    const idx = clampInt(raw?.idx, 0, 23);
    const row = Number(raw?.row);
    const col = Number(raw?.col);
    if (!Number.isFinite(row) || row < 1) {
      continue;
    }
    if (!Number.isFinite(col) || col < 1) {
      continue;
    }
    rawKeys.push({
      idx,
      row: Math.floor(row),
      col: Math.floor(col),
      rowSpan:
        raw?.rowSpan === undefined
          ? undefined
          : Math.max(1, Math.floor(Number(raw?.rowSpan) || 1)),
      colSpan:
        raw?.colSpan === undefined
          ? undefined
          : Math.max(1, Math.floor(Number(raw?.colSpan) || 1)),
      big: !!raw?.big,
    });
  }

  const normalizedRaw = normalizeSaxLayoutToFineGrid(rawKeys);
  for (const raw of normalizedRaw) {
    const idx = clampInt(raw?.idx, 0, 23);
    const base = baseByIdx.get(idx);
    if (!base) {
      continue;
    }

    if (raw?.row !== undefined) {
      base.row = Math.max(1, Math.floor(Number(raw?.row) || 1));
    }
    if (raw?.col !== undefined) {
      base.col = Math.max(1, Math.floor(Number(raw?.col) || 1));
    }
    if (raw?.rowSpan !== undefined) {
      base.rowSpan = Math.max(1, Math.floor(Number(raw?.rowSpan) || 1));
    }
    if (raw?.colSpan !== undefined) {
      base.colSpan = Math.max(1, Math.floor(Number(raw?.colSpan) || 1));
    }
    if (raw?.big !== undefined) {
      base.big = !!raw?.big;
    }
  }

  return Array.from({ length: 24 }, (_, i) => baseByIdx.get(i) as SaxLayoutKey);
};

const detectCollision = (layout: SaxLayoutKey[]): boolean => {
  const occupied = new Set<string>();
  for (const k of layout) {
    const rowSpan = Math.max(1, Math.floor(Number(k.rowSpan) || 1));
    const colSpan = Math.max(1, Math.floor(Number(k.colSpan) || 1));
    for (let r = k.row; r < k.row + rowSpan; r++) {
      for (let c = k.col; c < k.col + colSpan; c++) {
        const key = `${r},${c}`;
        if (occupied.has(key)) {
          return true;
        }
        occupied.add(key);
      }
    }
  }
  return false;
};

const layoutSignature = (layout: SaxLayoutKey[]): string => {
  // Fixed 24-key signature, order by idx.
  const parts: string[] = [];
  for (let i = 0; i < 24; i++) {
    const k = layout[i] as SaxLayoutKey | undefined;
    const row = Math.max(1, Math.floor(Number(k?.row) || 1));
    const col = Math.max(1, Math.floor(Number(k?.col) || 1));
    const rowSpan = Math.max(1, Math.floor(Number(k?.rowSpan) || 1));
    const colSpan = Math.max(1, Math.floor(Number(k?.colSpan) || 1));
    const big = k?.big ? 1 : 0;
    parts.push(`${row},${col},${rowSpan},${colSpan},${big}`);
  }
  return parts.join("|");
};

export default defineComponent({
  name: "SaxFingeringLayoutDragEditor",
  props: {
    layout: {
      type: Array as unknown as () => SaxLayoutKey[],
      required: true,
    },
    labels: {
      type: Array as unknown as () => string[] | null,
      default: null,
    },
    usableMask: {
      type: Number,
      default: null,
    },
    hideUnusableKeys: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:layout"],
  setup(props, { emit }) {
    const gridEl = ref<HTMLElement | null>(null);

    const localLayout = ref<SaxLayoutKey[]>(toFullLayout(props.layout));

    const lastLocalSig = ref<string>(layoutSignature(localLayout.value));
    const lastEmittedSig = ref<string>(lastLocalSig.value);

    watch(
      () => props.layout,
      (next) => {
        localLayout.value = toFullLayout(next);
        lastLocalSig.value = layoutSignature(localLayout.value);
        // Treat the incoming prop as the new upstream source of truth.
        lastEmittedSig.value = lastLocalSig.value;
      },
      { deep: true },
    );

    const gridCols = computed((): number => {
      // Match the display keypad grid: always 24 columns.
      // (Dynamic shrinking makes the editor feel left-biased and prevents moving
      // keys further to the right than current maxEnd.)
      return 24;
    });

    const gridRows = computed((): number => {
      const maxEnd = localLayout.value.reduce((m, k) => {
        const rowSpan = Math.max(1, Math.floor(Number(k.rowSpan) || 1));
        return Math.max(m, k.row + rowSpan - 1);
      }, 14);
      return Math.max(14, Math.min(40, maxEnd + 1));
    });

    const selectedIdx = ref<number | null>(null);
    const drag = ref<DragState | null>(null);
    const lastError = ref<string>("");

    const normalizedUsableMask = computed((): number | null => {
      if (!props.hideUnusableKeys) {
        return null;
      }
      const raw = props.usableMask;
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return null;
      }
      // low 24 bits only
      return (Number(raw) >>> 0) & 0x00ffffff;
    });

    const isIdxVisible = (idx: number): boolean => {
      const i = clampInt(idx, 0, 23);
      const m = normalizedUsableMask.value;
      if (typeof m !== "number") {
        return true;
      }
      return ((m >>> i) & 1) === 1;
    };

    const visibleLayout = computed((): SaxLayoutKey[] => {
      const m = normalizedUsableMask.value;
      if (typeof m !== "number") {
        return localLayout.value;
      }
      return localLayout.value.filter((k) => isIdxVisible(k.idx));
    });

    const zoomPercent = ref<number>(100);
    const zoom = computed(() =>
      Math.max(0.7, Math.min(1.6, (Number(zoomPercent.value) || 100) / 100)),
    );
    const showIndexHint = computed(() => zoom.value >= 0.9);

    const keyFontSize = computed((): string => {
      if (zoom.value >= 1.15) {
        return "0.9rem";
      }
      if (zoom.value <= 0.85) {
        return "0.72rem";
      }
      return "0.8rem";
    });

    const resetZoom = (): void => {
      zoomPercent.value = 100;
    };

    const gridStyle = computed((): Record<string, string> => {
      const cellSize = Math.max(14, Math.round(21 * zoom.value));
      const gapPx = Math.max(1, Math.round(3 * zoom.value));
      return {
        // Use square units: columns must match row height.
        // With 24 fine-grid columns this will typically overflow horizontally;
        // the parent panel already scrolls.
        gridTemplateColumns: `repeat(${gridCols.value}, var(--cell-size))`,
        "--cell-size": `${cellSize}px`,
        "--cell-gap": `${gapPx}px`,
        "--key-font": keyFontSize.value,
      };
    });

    const editorPanelStyle = computed((): Record<string, string> => {
      // Keep a keypad-like aspect by constraining width and letting height follow content.
      // (If it's too tall for the viewport, it will scroll.)
      const cellSize = Math.max(14, Math.round(21 * zoom.value));
      const gapPx = Math.max(1, Math.round(3 * zoom.value));
      const rows = gridRows.value;
      const paddingPx = 12; // 0.75rem
      const borderPx = 2;
      const preferredMinHeight =
        rows * cellSize +
        Math.max(0, rows - 1) * gapPx +
        paddingPx * 2 +
        borderPx;
      return {
        width: "100%",
        maxWidth: "340px",
        marginLeft: "auto",
        marginRight: "auto",
        minHeight: `${preferredMinHeight}px`,
        maxHeight: "75vh",
      };
    });

    const selectedKey = computed((): SaxLayoutKey | null => {
      if (selectedIdx.value === null) {
        return null;
      }
      const i = clampInt(selectedIdx.value, 0, 23);
      if (!isIdxVisible(i)) {
        return null;
      }
      return localLayout.value[i] || null;
    });

    watch(
      () => [props.hideUnusableKeys, props.usableMask],
      () => {
        if (selectedIdx.value !== null && !isIdxVisible(selectedIdx.value)) {
          selectedIdx.value = null;
        }
      },
      { immediate: true },
    );

    const draftRow = ref<number>(1);
    const draftCol = ref<number>(1);
    const draftRowSpan = ref<number>(1);
    const draftColSpan = ref<number>(1);
    const draftBig = ref<boolean>(false);

    const syncDraftFromSelected = (): void => {
      const k = selectedKey.value;
      if (!k) {
        return;
      }
      draftRow.value = Math.max(1, Math.floor(Number(k.row) || 1));
      draftCol.value = Math.max(1, Math.floor(Number(k.col) || 1));
      draftRowSpan.value = Math.max(1, Math.floor(Number(k.rowSpan) || 1));
      draftColSpan.value = Math.max(1, Math.floor(Number(k.colSpan) || 1));
      draftBig.value = !!k.big;
    };

    watch(selectedKey, () => {
      lastError.value = "";
      syncDraftFromSelected();
    });

    const labelFor = (index: number): string => {
      const i = clampInt(index, 0, 23);
      const custom =
        props.labels && Array.isArray(props.labels) ? props.labels : null;
      if (custom && custom.length >= 24) {
        return String(custom[i] ?? i);
      }
      return String(i);
    };

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

    const keyClass = (idx: number, big?: boolean): string[] => {
      const i = clampInt(idx, 0, 23);
      const isSelected = selectedIdx.value === i;
      const isDragging = drag.value?.idx === i;

      return [
        // Match SaxFingeringKeyPad look as closely as possible.
        "border-gray-700",
        "bg-gray-900/30",
        "text-gray-200",
        "hover:border-gray-500",
        big ? "text-sm" : "text-xs",
        isSelected ? "is-selected" : "",
        isDragging ? "opacity-80" : "",
      ].filter(Boolean);
    };

    const withUpdatedKey = (
      idx: number,
      patch: Partial<SaxLayoutKey>,
    ): SaxLayoutKey[] => {
      const next = localLayout.value.map((k) => ({ ...k }));
      const i = clampInt(idx, 0, 23);
      next[i] = { ...next[i], ...patch, idx: i };
      return next;
    };

    const tryMoveKey = (idx: number, row: number, col: number): boolean => {
      const i = clampInt(idx, 0, 23);
      const cur = localLayout.value[i];
      const rowSpan = Math.max(1, Math.floor(Number(cur.rowSpan) || 1));
      const colSpan = Math.max(1, Math.floor(Number(cur.colSpan) || 1));

      const r = clampInt(row, 1, Math.max(1, gridRows.value - rowSpan + 1));
      const c = clampInt(col, 1, Math.max(1, gridCols.value - colSpan + 1));

      const candidate = withUpdatedKey(i, { row: r, col: c });
      const collision = (() => {
        const m = normalizedUsableMask.value;
        if (typeof m !== "number") {
          return detectCollision(candidate);
        }
        // When filtering to usable keys, ignore hidden keys for collision detection.
        const filtered = candidate.filter((k) => isIdxVisible(k.idx));
        return detectCollision(filtered);
      })();
      if (collision) {
        return false;
      }
      const sig = layoutSignature(candidate);
      if (sig === lastLocalSig.value) {
        return true;
      }
      localLayout.value = candidate;
      lastLocalSig.value = sig;
      return true;
    };

    const emitUpdate = (): void => {
      const sig = layoutSignature(localLayout.value);
      if (sig === lastEmittedSig.value) {
        return;
      }
      lastEmittedSig.value = sig;
      emit(
        "update:layout",
        localLayout.value.map((k) => ({ ...k })),
      );
    };

    const select = (idx: number): void => {
      const i = clampInt(idx, 0, 23);
      if (!isIdxVisible(i)) {
        return;
      }
      selectedIdx.value = i;
    };

    const capturePointerMetrics = (): PointerGridMetrics | null => {
      const el = gridEl.value;
      if (!el) {
        return null;
      }
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);

      const cols = gridCols.value;
      const colGap = Number.parseFloat(style.columnGap || "0") || 0;
      const rowGap = Number.parseFloat(style.rowGap || "0") || 0;
      const autoRowsRaw = style.getPropertyValue("grid-auto-rows");
      const rowHeight = Number.parseFloat(autoRowsRaw || "21") || 21;

      // Columns are fixed to --cell-size so they match row height.
      const cellSizeRaw = style.getPropertyValue("--cell-size");
      const cellSize = Number.parseFloat(cellSizeRaw || "") || rowHeight || 21;

      const stepX = cellSize + colGap;
      const stepY = rowHeight + rowGap;

      return {
        rectLeft: rect.left,
        rectTop: rect.top,
        rectWidth: rect.width,
        cols,
        stepX,
        stepY,
        scrollLeft: el.scrollLeft || 0,
        scrollTop: el.scrollTop || 0,
      };
    };

    const calcRowColFromPointerWithMetrics = (
      e: PointerEvent,
      m: PointerGridMetrics,
    ): { row: number; col: number } => {
      const x = e.clientX - m.rectLeft + m.scrollLeft;
      const y = e.clientY - m.rectTop + m.scrollTop;
      const col = Math.floor(x / m.stepX) + 1;
      const row = Math.floor(y / m.stepY) + 1;
      return {
        col: clampInt(col, 1, m.cols),
        row: clampInt(row, 1, gridRows.value),
      };
    };

    const onPointerDown = (idx: number, e: PointerEvent): void => {
      const i = clampInt(idx, 0, 23);
      select(i);
      lastError.value = "";

      const el = e.currentTarget as HTMLElement | null;
      const pointerId = e.pointerId;
      if (el && el.setPointerCapture) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }

      const cur = localLayout.value[i];
      drag.value = {
        idx: i,
        started: true,
        moved: false,
        startRow: cur.row,
        startCol: cur.col,
      };

      const metrics = capturePointerMetrics();
      let raf = 0;
      let pending: PointerEvent | null = null;

      const onMove = (ev: PointerEvent): void => {
        if (!drag.value || drag.value.idx !== i) {
          return;
        }
        pending = ev;
        if (raf) {
          return;
        }
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          const p = pending;
          pending = null;
          if (!p || !drag.value || drag.value.idx !== i) {
            return;
          }
          if (!metrics) {
            return;
          }
          const pos = calcRowColFromPointerWithMetrics(p, metrics);
          const moved = tryMoveKey(i, pos.row, pos.col);
          if (moved) {
            drag.value.moved = true;
            lastError.value = "";
          }
        });
      };

      const onUp = (): void => {
        const d = drag.value;
        drag.value = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("blur", onUp);

        // Be defensive: if pointer capture remains, it can swallow subsequent clicks
        // (making other inputs feel "dead").
        if (el && (el as any).releasePointerCapture) {
          try {
            (el as any).releasePointerCapture(pointerId);
          } catch {
            // ignore
          }
        }

        if (raf) {
          window.cancelAnimationFrame(raf);
          raf = 0;
        }
        pending = null;

        if (d?.moved) {
          emitUpdate();
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("blur", onUp);
    };

    const nudgeSelected = (dr: number, dc: number): void => {
      if (selectedIdx.value === null) {
        return;
      }
      if (!isIdxVisible(selectedIdx.value)) {
        return;
      }
      const i = selectedIdx.value;
      const cur = localLayout.value[i];
      const ok = tryMoveKey(i, cur.row + dr, cur.col + dc);
      if (ok) {
        lastError.value = "";
        emitUpdate();
      }
    };

    const applySelectedDraft = (): void => {
      if (selectedIdx.value === null) {
        return;
      }
      if (!isIdxVisible(selectedIdx.value)) {
        return;
      }

      const i = clampInt(selectedIdx.value, 0, 23);
      const rowSpan = Math.max(1, Math.floor(Number(draftRowSpan.value) || 1));
      const colSpan = Math.max(1, Math.floor(Number(draftColSpan.value) || 1));
      const row = clampInt(draftRow.value, 1, Math.max(1, gridRows.value));
      const col = clampInt(draftCol.value, 1, Math.max(1, gridCols.value));

      const candidate = withUpdatedKey(i, {
        row,
        col,
        rowSpan,
        colSpan,
        big: !!draftBig.value,
      });

      const sig = layoutSignature(candidate);
      if (sig === lastLocalSig.value) {
        lastError.value = "";
        return;
      }

      const collision = (() => {
        const m = normalizedUsableMask.value;
        if (typeof m !== "number") {
          return detectCollision(candidate);
        }
        const filtered = candidate.filter((k) => isIdxVisible(k.idx));
        return detectCollision(filtered);
      })();
      if (collision) {
        lastError.value = "겹치는 키가 있어서 적용할 수 없습니다.";
        return;
      }

      lastError.value = "";
      localLayout.value = candidate;
      lastLocalSig.value = sig;
      emitUpdate();
    };

    // Auto-apply draft edits so users can see size/shape changes immediately.
    // On collision, we keep the draft values so the user can adjust them.
    watch(
      [draftRow, draftCol, draftRowSpan, draftColSpan, draftBig],
      () => {
        if (selectedIdx.value === null) {
          return;
        }
        applySelectedDraft();
      },
      { flush: "post" },
    );

    const resetSelectedToDefault = (): void => {
      if (selectedIdx.value === null) {
        return;
      }
      if (!isIdxVisible(selectedIdx.value)) {
        return;
      }
      const i = clampInt(selectedIdx.value, 0, 23);
      const base = toFullLayout(DEFAULT_SAX_LAYOUT_24);
      const candidate = withUpdatedKey(i, base[i]);
      const collision = (() => {
        const m = normalizedUsableMask.value;
        if (typeof m !== "number") {
          return detectCollision(candidate);
        }
        const filtered = candidate.filter((k) => isIdxVisible(k.idx));
        return detectCollision(filtered);
      })();
      if (collision) {
        lastError.value = "겹치는 키가 있어서 기본값으로 되돌릴 수 없습니다.";
        return;
      }
      lastError.value = "";
      localLayout.value = candidate;
      emitUpdate();
      syncDraftFromSelected();
    };

    const onGridKeyDown = (e: KeyboardEvent): void => {
      // Allow arrow-key nudging while the mouse button is held, until the pointer has
      // actually moved. This makes "click + arrow" fine adjustment possible.
      if (drag.value?.moved) {
        return;
      }

      // Don't interfere with IME/text input.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() || "";
      if (
        tag === "input" ||
        tag === "textarea" ||
        (target as any)?.isContentEditable
      ) {
        return;
      }

      const step = e.shiftKey ? 2 : 1;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        nudgeSelected(-step, 0);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        nudgeSelected(step, 0);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nudgeSelected(0, -step);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nudgeSelected(0, step);
      }
    };

    return {
      gridEl,
      localLayout,
      visibleLayout,
      gridCols,
      gridRows,
      selectedKey,
      draftRow,
      draftCol,
      draftRowSpan,
      draftColSpan,
      draftBig,
      lastError,
      zoomPercent,
      resetZoom,
      gridStyle,
      editorPanelStyle,
      showIndexHint,
      labelFor,
      keyStyle,
      keyClass,
      select,
      onPointerDown,
      onGridKeyDown,
      applySelectedDraft,
      resetSelectedToDefault,
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

.editor-resize {
  resize: none;
  overflow: auto;
}

.sax-grid {
  display: grid;
  grid-auto-rows: var(--cell-size, 21px);
  gap: var(--cell-gap, 0.175rem);
  align-items: stretch;
  justify-items: stretch;
  touch-action: none;
  user-select: none;
}

.sax-pad {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -2px 0 rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.28);
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

.is-selected::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 2px solid rgba(59, 130, 246, 0.6);
  border-radius: 9999px;
}

.sax-pad:active {
  transform: translateY(1px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.35), 0 1px 4px rgba(0, 0, 0, 0.22);
}

.key-btn {
  touch-action: none;
  font-size: var(--key-font, 0.8rem);
}
</style>
