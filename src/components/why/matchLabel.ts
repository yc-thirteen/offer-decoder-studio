/**
 * Where MatchChart writes the match line's name, kept clear of the marker lines (rubric 6:
 * no label crossed by a line). Pure, so the placement is tested without a browser.
 */

/** Rough width of one 13px, 600-weight character. */
export const CHAR_PX = 8;

/** [left, top, right, bottom] in px. */
export type Box = [number, number, number, number];

/** The match line's name, on one line or broken in two when one line has no room. */
export const LINE_LABEL = "Employer match per year";
export const LINE_LABEL_ROWS = ["Employer match", "per year"];
/** Px kept clear between a marker line and the line label's estimated box. */
export const MARKER_CLEARANCE = 4;

export interface LineLabel {
  x: number;
  y: number;
  rows: string[];
  box: Box;
}

/** The label's estimated box with its first baseline at `y`. */
export function labelBox(x: number, y: number, rows: readonly string[]): Box {
  const w = Math.max(...rows.map((r) => r.length)) * CHAR_PX;
  return [x, y - 13, x + w, y + 3 + 16 * (rows.length - 1)];
}

/**
 * Where the match line's name goes inside the plot: in the band at the top (the line never
 * reaches it, since the y axis runs to at least 1.4 times the whole match), in the first
 * gap between marker lines wide enough to hold it. Left of every marker first, then just
 * past each marker in turn; one line before two. Returns its x and rows, or null when no
 * gap holds it (a narrow chart with the markers spread across it): then it gets its own
 * row above the marker titles, where no marker line reaches.
 */
export function placeLineLabel(
  markerXs: readonly number[],
  x0: number,
  x1: number,
): { x: number; rows: string[] } | null {
  const starts = [x0 + 8, ...[...markerXs].sort((a, b) => a - b).map((xm) => xm + 6)];
  for (const rows of [[LINE_LABEL], LINE_LABEL_ROWS]) {
    for (const x of starts) {
      const b = labelBox(x, 0, rows);
      const clear = markerXs.every(
        (xm) => xm < b[0] - MARKER_CLEARANCE || xm > b[2] + MARKER_CLEARANCE,
      );
      if (b[2] <= x1 && clear) return { x, rows };
    }
  }
  return null;
}

/**
 * The red "left on the table" label: one line, two when one has no room between the
 * markers, three on the narrowest charts.
 */
export function gapRows(amount: string): string[][] {
  return [
    [`${amount} left on the table`],
    [`${amount} left`, "on the table"],
    [amount, "left on", "the table"],
  ];
}

export interface GapLabel {
  x: number;
  y: number;
  anchor: "start" | "end";
  rows: string[];
  box: Box;
}

/** `labelBox` for text anchored at its start or its end. */
export function anchoredBox(
  x: number,
  y: number,
  rows: readonly string[],
  anchor: "start" | "end",
): Box {
  const b = labelBox(x, y, rows);
  return anchor === "start" ? b : [x - (b[2] - b[0]), b[1], x, b[3]];
}

/** Whether the segment from `a` to `b` passes through `box` (Liang–Barsky clipping). */
export function segmentHitsBox(
  a: readonly [number, number],
  b: readonly [number, number],
  box: Box,
): boolean {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, a[0] - box[0]],
    [dx, box[2] - a[0]],
    [-dy, a[1] - box[1]],
    [dy, box[3] - a[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

export interface GapLabelInput {
  /** The formatted amount left on the table, e.g. "$2,250". */
  amount: string;
  /** The default dot, in px. */
  dot: readonly [number, number];
  /** The y of the whole match (the flat part of the line and the bracket's top), in px. */
  yFull: number;
  /** Every marker line's x, in px. */
  markerXs: readonly number[];
  /** The match line, in px. */
  line: readonly (readonly [number, number])[];
  /** The plot's edges, in px. */
  plot: { x0: number; x1: number; top: number; bottom: number };
  /** Boxes already taken (the line label). */
  avoid: readonly Box[];
}

/**
 * Where the red "$X left on the table" label goes, clear of every marker line by
 * MARKER_CLEARANCE, of the match line, and of the boxes in `avoid` (rubric 6: no label
 * crossed by a line). In order: left of the default dot, halfway up the bracket (empty: the
 * line rises to the right); above the flat line just past the default marker, then past
 * each later marker, then at the right edge; one line before two before three. Below the flat line past
 * a marker is the last resort. Returns null when nothing fits.
 */
export function placeGapLabel(input: GapLabelInput): GapLabel | null {
  const { amount, dot, yFull, markerXs, line, plot, avoid } = input;
  const [cx, cy] = dot;
  const later = [...markerXs].filter((xm) => xm >= cx - 0.5).sort((a, b) => a - b);
  const mid = (cy + yFull) / 2;
  const fits = (b: Box) =>
    b[0] >= plot.x0 + 2 &&
    b[2] <= plot.x1 &&
    b[1] >= plot.top &&
    b[3] <= plot.bottom - 2 &&
    markerXs.every((xm) => xm < b[0] - MARKER_CLEARANCE || xm > b[2] + MARKER_CLEARANCE) &&
    !avoid.some((a) => boxesOverlap(a, b)) &&
    !line.some((p, i) => i > 0 && segmentHitsBox(line[i - 1]!, p, b));

  const all = gapRows(amount);
  const tries = (rowsSets: string[][], below: boolean) =>
    rowsSets.flatMap((rows) => {
      const extra = 16 * (rows.length - 1);
      const out: [number, number, "start" | "end"][] = [];
      if (below) {
        for (const xm of later) out.push([xm + 6, yFull + 18, "start"]);
        return out.map((t) => ({ t, rows }));
      }
      out.push([cx - 8, mid + 4 - extra / 2, "end"]);
      for (const xm of later) out.push([xm + 6, yFull - 8 - extra, "start"]);
      out.push([plot.x1 - 2, yFull - 8 - extra, "end"]);
      return out.map((t) => ({ t, rows }));
    });
  for (const { t, rows } of [...tries(all, false), ...tries(all, true)]) {
    const [x, y, anchor] = t;
    const box = anchoredBox(x, y, rows, anchor);
    if (fits(box)) return { x, y, anchor, rows, box };
  }
  return null;
}
