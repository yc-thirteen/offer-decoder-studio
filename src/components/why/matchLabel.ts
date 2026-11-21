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
