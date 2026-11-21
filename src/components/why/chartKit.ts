/**
 * Small, pure helpers shared by the hand-built SVG charts in "Why these elections"
 * (harness/DESIGN.md: 1.5px ink axes at 60%, dotted gridlines at 20%, 13px tabular labels,
 * values written on the chart, direct labels, no legend boxes).
 */

/** Linear map from a data domain onto a pixel range. */
export function scale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** A "nice" step (1, 2, 2.5, or 5 × 10^n) so roughly `count` ticks cover the span. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || count < 1) return 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * mag;
}

/** Tick values from the first multiple of the step at or below `min` up to the first at or above `max`. */
export function niceTicks(min: number, max: number, count: number): number[] {
  const step = niceStep(max - min, count);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 1e6; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/**
 * Nudge label positions apart so no two are closer than `gap`, keeping them inside
 * [lo, hi] where possible. Returns new positions in the input order.
 */
export function spreadLabels(ys: readonly number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const out = order.map((o) => Math.min(Math.max(o.y, lo), hi));
  for (let k = 1; k < out.length; k++) out[k] = Math.max(out[k]!, out[k - 1]! + gap);
  const over = (out[out.length - 1] ?? hi) - hi;
  if (over > 0) {
    out[out.length - 1] = hi;
    for (let k = out.length - 2; k >= 0; k--) out[k] = Math.min(out[k]!, out[k + 1]! - gap);
  }
  const result = new Array<number>(ys.length);
  order.forEach((o, k) => (result[o.i] = out[k]!));
  return result;
}

/** Compact money for axis ticks: "$0", "$500", "$5,000", "−$1,000". */
export function tickMoney(v: number): string {
  const n = Math.round(v);
  const text = `$${Math.abs(n).toLocaleString("en-US")}`;
  return n < 0 ? `−${text}` : text;
}

/**
 * The plot's left edge for a y axis whose tick labels end 8px left of it: wide enough for the
 * widest label (13px tabular figures run about 8.4px a character in Public Sans), never less
 * than `min`. Without it, "$10,000" and "−$2,000" hang past the chart's left edge.
 */
export function yAxisLeft(labels: readonly string[], min = 62): number {
  const widest = Math.max(0, ...labels.map((l) => l.length));
  return Math.max(min, Math.ceil(widest * 8.5 + 10));
}

/** [left, top, right, bottom] in px. */
export type Box = [number, number, number, number];

export function overlaps(a: Box, b: Box): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

/** Rough width of one 13px, 600-weight character, for text boxes in chart layout. */
export const CHAR_PX = 8;

/** The box of a one-line 13px label whose baseline is at y. */
export function textBox(text: string, x: number, y: number, anchor: "start" | "end"): Box {
  const w = text.length * CHAR_PX;
  return anchor === "start" ? [x, y - 13, x + w, y + 3] : [x - w, y - 13, x, y + 3];
}

/** Width of one 13px, 600-weight Public Sans glyph (measured with getComputedTextLength). */
function boldGlyphPx(ch: string): number {
  if (/[0-9]/.test(ch)) return 9.2; // tabular figures, 9.1px
  if (ch === "%") return 12;
  if (ch === "." || ch === ",") return 4;
  if (ch === " ") return 3.5;
  if (/[mwMW]/.test(ch)) return 11.5;
  if (/[fijlrt]/.test(ch)) return 4.5;
  if (/[A-Z$]/.test(ch)) return 9.5;
  return 7.5;
}

/** The halo stroke (4px wide, so 2px past each side of the glyphs) a label is knocked out with. */
export const HALO_PAD = 2;

/**
 * The drawn width of a 13px, 600-weight label with a halo: the glyphs plus the halo on both
 * ends. "12%" measures 30.2px in the browser, more than `text.length * CHAR_PX` (24px), so a
 * label sized by CHAR_PX can run into a line its box was meant to clear.
 */
export function haloTextWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += boldGlyphPx(ch);
  return w + 2 * HALO_PAD;
}

/** The box of a one-line 13px, 600-weight haloed label whose baseline is at y. */
export function haloTextBox(
  text: string,
  x: number,
  y: number,
  anchor: "start" | "middle" | "end",
): Box {
  const w = haloTextWidth(text);
  const l = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  return [l, y - 13, l + w, y + 3];
}
