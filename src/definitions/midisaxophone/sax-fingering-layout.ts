export type SaxLayoutKey = {
  idx: number;
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
  big?: boolean;
};

export const SAX_LAYOUT_LEGACY_COLS = 12;
export const SAX_LAYOUT_GRID_SCALE = 2;
export const SAX_LAYOUT_COLS = SAX_LAYOUT_LEGACY_COLS * SAX_LAYOUT_GRID_SCALE;

const maxColEnd = (layout: SaxLayoutKey[]): number => {
  return layout.reduce((m, k) => {
    const colSpan = Math.max(1, Math.floor(Number(k.colSpan ?? 1) || 1));
    return Math.max(m, k.col + colSpan - 1);
  }, 0);
};

const maxRowEnd = (layout: SaxLayoutKey[]): number => {
  return layout.reduce((m, k) => {
    const rowSpan = Math.max(1, Math.floor(Number(k.rowSpan ?? 1) || 1));
    return Math.max(m, k.row + rowSpan - 1);
  }, 0);
};

export const isLegacySaxLayoutGrid = (layout: SaxLayoutKey[]): boolean => {
  // Legacy layouts were authored on a 12-column grid (default), with modest row counts.
  // New finer grid uses doubled coordinates/spans and typically reaches beyond 12 columns.
  const colEnd = maxColEnd(layout);
  const rowEnd = maxRowEnd(layout);
  return colEnd <= SAX_LAYOUT_LEGACY_COLS && rowEnd <= 40;
};

export const scaleSaxLayout = (
  layout: SaxLayoutKey[],
  factor: number,
): SaxLayoutKey[] => {
  const f = Math.max(1, Math.floor(Number(factor) || 1));
  return layout.map((k) => {
    const rowSpan = Math.max(1, Math.floor(Number(k.rowSpan ?? 1) || 1));
    const colSpan = Math.max(1, Math.floor(Number(k.colSpan ?? 1) || 1));
    return {
      ...k,
      row: Math.max(1, Math.floor(Number(k.row) || 1) * f),
      col: Math.max(1, Math.floor(Number(k.col) || 1) * f),
      rowSpan: rowSpan * f,
      colSpan: colSpan * f,
    };
  });
};

export const normalizeSaxLayoutToFineGrid = (
  layout: SaxLayoutKey[],
): SaxLayoutKey[] => {
  if (isLegacySaxLayoutGrid(layout)) {
    return scaleSaxLayout(layout, SAX_LAYOUT_GRID_SCALE);
  }
  // Still normalize spans to be explicit integers.
  return scaleSaxLayout(layout, 1);
};

const clampInt = (value: unknown, min: number, max: number): number => {
  const n = Math.floor(Number(value) || 0);
  return Math.max(min, Math.min(max, n));
};

const spanInt = (value: unknown): number => {
  return Math.max(1, Math.floor(Number(value) || 1));
};

const occupies = (
  occupied: Set<string>,
  k: SaxLayoutKey,
  cols: number,
  rows: number,
): boolean => {
  const rowSpan = spanInt(k.rowSpan);
  const colSpan = spanInt(k.colSpan);
  const r0 = clampInt(k.row, 1, rows);
  const c0 = clampInt(k.col, 1, cols);
  if (c0 + colSpan - 1 > cols) {
    return true;
  }
  if (r0 + rowSpan - 1 > rows) {
    return true;
  }
  for (let r = r0; r < r0 + rowSpan; r++) {
    for (let c = c0; c < c0 + colSpan; c++) {
      const key = `${r},${c}`;
      if (occupied.has(key)) {
        return true;
      }
    }
  }
  for (let r = r0; r < r0 + rowSpan; r++) {
    for (let c = c0; c < c0 + colSpan; c++) {
      occupied.add(`${r},${c}`);
    }
  }
  return false;
};

export const detectSaxLayoutCollision = (
  layout: SaxLayoutKey[],
  activeIdxMask = 0x00ffffff,
  maxRows = 40,
  cols = SAX_LAYOUT_COLS,
): boolean => {
  const rows = clampInt(maxRows, 1, 200);
  const m = (Number(activeIdxMask) >>> 0) & 0x00ffffff;
  const occupied = new Set<string>();
  for (const k of layout) {
    const idx = clampInt(k.idx, 0, 23);
    if (((m >>> idx) & 1) === 0) {
      continue;
    }
    if (occupies(occupied, k, cols, rows)) {
      return true;
    }
  }
  return false;
};

const buildPreferredOrder = (desired: number, max: number): number[] => {
  const d = clampInt(desired, 1, max);
  const arr = Array.from({ length: max }, (_, i) => i + 1);
  arr.sort((a, b) => {
    const da = Math.abs(a - d);
    const db = Math.abs(b - d);
    return da !== db ? da - db : a - b;
  });
  return arr;
};

export const relocateSaxLayoutKeysToAvoidCollisions = (
  layout: SaxLayoutKey[],
  fixedIdxMask: number,
  activeIdxMask = 0x00ffffff,
  maxRows = 40,
  cols = SAX_LAYOUT_COLS,
): SaxLayoutKey[] => {
  const rows = clampInt(maxRows, 1, 200);
  const active = (Number(activeIdxMask) >>> 0) & 0x00ffffff;
  const fixed = (Number(fixedIdxMask) >>> 0) & 0x00ffffff;

  const byIdx = new Map<number, SaxLayoutKey>();
  for (const k of layout) {
    const idx = clampInt(k.idx, 0, 23);
    byIdx.set(idx, {
      ...k,
      idx,
      row: Math.max(1, Math.floor(Number(k.row) || 1)),
      col: Math.max(1, Math.floor(Number(k.col) || 1)),
      rowSpan: spanInt(k.rowSpan),
      colSpan: spanInt(k.colSpan),
      big: !!k.big,
    });
  }

  const full = Array.from({ length: 24 }, (_, i) => {
    return (
      byIdx.get(i) || {
        idx: i,
        row: 1,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
        big: false,
      }
    );
  });

  const occupied = new Set<string>();

  // First, place fixed active keys as-is (assumed collision-free among themselves).
  for (let i = 0; i < 24; i++) {
    if (((active >>> i) & 1) === 0) {
      continue;
    }
    if (((fixed >>> i) & 1) === 0) {
      continue;
    }
    occupies(occupied, full[i], cols, rows);
  }

  // Then, place the remaining active keys; if they collide, move them to a free spot.
  for (let i = 0; i < 24; i++) {
    if (((active >>> i) & 1) === 0) {
      continue;
    }
    if (((fixed >>> i) & 1) === 1) {
      continue;
    }

    const k = full[i];
    const rowSpan = spanInt(k.rowSpan);
    const colSpan = spanInt(k.colSpan);

    // Try current position first.
    {
      const test = new Set<string>(occupied);
      const ok = !occupies(test, k, cols, rows);
      if (ok) {
        occupies(occupied, k, cols, rows);
        continue;
      }
    }

    const rowOrder = buildPreferredOrder(k.row, rows);
    const colOrder = buildPreferredOrder(k.col, cols);

    let placed = false;
    for (const r of rowOrder) {
      if (r + rowSpan - 1 > rows) {
        continue;
      }
      for (const c of colOrder) {
        if (c + colSpan - 1 > cols) {
          continue;
        }

        const candidate: SaxLayoutKey = { ...k, row: r, col: c };
        const test = new Set<string>(occupied);
        const ok = !occupies(test, candidate, cols, rows);
        if (!ok) {
          continue;
        }

        full[i] = candidate;
        occupies(occupied, candidate, cols, rows);
        placed = true;
        break;
      }
      if (placed) {
        break;
      }
    }

    // If we can't place it, keep it as-is (better than losing the key).
    if (!placed) {
      occupies(occupied, k, cols, rows);
    }
  }

  return full;
};

// Default 24-key sax silhouette layout.
// IMPORTANT: idx(0..23) meaning must match the MIDI Saxophone page label preset.
export const DEFAULT_SAX_LAYOUT_24: SaxLayoutKey[] = [
  // octave (back key)
  { idx: 0, row: 2, col: 1, rowSpan: 2, colSpan: 2, big: true },

  // palm keys (LH top)
  { idx: 11, row: 1, col: 3, colSpan: 2 },
  { idx: 12, row: 1, col: 5, colSpan: 2 },
  { idx: 13, row: 2, col: 3, colSpan: 2 },

  // front/extra near top of LH
  { idx: 21, row: 2, col: 7, colSpan: 2 },

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
  { idx: 19, row: 11, col: 1, colSpan: 2 },
  { idx: 20, row: 12, col: 1, colSpan: 2 },

  // LOW C#
  { idx: 23, row: 11, col: 3, colSpan: 2 },

  // RH pinky cluster (C / Eb)
  // 요청: Low Eb/Low C를 RH3 바로 아래(살짝 오른쪽)로 이동
  { idx: 17, row: 11, col: 9, colSpan: 2 },
  { idx: 18, row: 12, col: 9, colSpan: 2 },

  // low F# (RH pinky) + HIGH F# above
  // 요청: Low F#를 RH2와 RH3 사이로 이동
  { idx: 7, row: 8, col: 9, colSpan: 2 },
  // 요청: High F#를 Low F# 바로 아래로 이동
  { idx: 22, row: 10, col: 9, colSpan: 2 },

  // alt keys (extra)
  { idx: 8, row: 13, col: 7, colSpan: 2 },
];
