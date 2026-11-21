/**
 * Where HealthCostChart writes each plan's cost beside its dot at your expected spending,
 * kept off the plan's own line (rubric 6: no label crossed by a line). Pure, so the
 * placement is tested without a browser.
 *
 * A plan's cost never falls as spending rises, so left of the dot its line is at or below
 * the dot and right of the dot it is at or above it. A label above-left or below-right of
 * the dot therefore never touches its own line, whatever the slope. Above-right and
 * below-left work too once the label clears the line at its far corner, which is where the
 * line comes closest over the label's width.
 */
import { overlaps, type Box } from "./chartKit";

/** Rough width of one 13px, 600-weight tabular figure (see yAxisLeft in chartKit). */
export const VALUE_CHAR_PX = 8.5;
/** Px from the baseline up to the top of "$" and the figures (cap height plus a margin). */
const ASCENT = 11;
/** Px from the baseline down to the foot of "$". */
const DESCENT = 2;
/** Px from the marker line to the label's near edge. */
export const VALUE_SIDE_GAP = 6;
/** Px from the plan line to the label box's near edge. */
export const VALUE_LINE_GAP = 3;
/** Px between stacked tries when the nearest spot is taken. */
const STEP = 16;
const TRIES = 3;

export interface ValueLabel {
  x: number;
  /** Baseline. */
  y: number;
  anchor: "start" | "end";
  box: Box;
}

/** The estimated box of a value label whose baseline is at y. */
export function valueBox(text: string, x: number, y: number, anchor: "start" | "end"): Box {
  const w = text.length * VALUE_CHAR_PX;
  const [l, r] = anchor === "start" ? [x, x + w] : [x - w, x];
  return [l, y - ASCENT, r, y + DESCENT];
}

export interface ValueLabelInput {
  /** The dot's y in px. */
  y: number;
  text: string;
  /** The plan line's y at a given x in px. Never rises as x falls (cost only grows). */
  lineY: (x: number) => number;
}

export interface ValueLabelBounds {
  /** The marker's x, where every dot sits. */
  xs: number;
  /** Plot edges: left, top, right, bottom. */
  plot: Box;
  /** Boxes the labels must not overlap (the line labels at the right edge). */
  avoid: readonly Box[];
}

function at(text: string, x: number, y: number, anchor: "start" | "end"): ValueLabel {
  return { x, y, anchor, box: valueBox(text, x, y, anchor) };
}

/**
 * Above-left of the dot first, then below-right, above-right, and below-left, each nearest
 * first and stepping away as needed. Each is VALUE_LINE_GAP clear of its own line.
 */
function candidates(dot: ValueLabelInput, xs: number): { label: ValueLabel; step: number }[] {
  const { text, y } = dot;
  const w = text.length * VALUE_CHAR_PX;
  const left = xs - VALUE_SIDE_GAP;
  const right = xs + VALUE_SIDE_GAP;
  const above = y - VALUE_LINE_GAP - DESCENT;
  const below = y + VALUE_LINE_GAP + ASCENT;
  const aboveRight = Math.min(y, dot.lineY(right + w)) - VALUE_LINE_GAP - DESCENT;
  const belowLeft = Math.max(y, dot.lineY(left - w)) + VALUE_LINE_GAP + ASCENT;
  const out: { label: ValueLabel; step: number }[] = [];
  for (let step = 0; step < TRIES; step++) {
    const d = step * STEP;
    out.push(
      { label: at(text, left, above - d, "end"), step },
      { label: at(text, right, below + d, "start"), step },
      { label: at(text, right, aboveRight - d, "start"), step },
      { label: at(text, left, belowLeft + d, "end"), step },
    );
  }
  return out;
}

/** Px around a label box that another plan's line, drawn up to 2.5px wide, must stay out of. */
const LINE_CLEAR = 1.5;

/**
 * Whether a line touches the box, padded by LINE_CLEAR. A plan line never falls as x rises
 * (in px its y never grows), so over the padded width it takes every y from lineY(right) to
 * lineY(left), and it touches the box exactly when that span meets the box's padded height.
 */
export function lineCrosses(lineY: (x: number) => number, box: Box): boolean {
  const [l, t, r, b] = [
    box[0] - LINE_CLEAR,
    box[1] - LINE_CLEAR,
    box[2] + LINE_CLEAR,
    box[3] + LINE_CLEAR,
  ];
  return lineY(r) < b && t < lineY(l);
}

/**
 * One label per dot, in input order. Dots are placed from the top down. Each takes the spot
 * that breaks the fewest rules, weighted: inside the plot first, then clear of other plans'
 * lines, then clear of the line labels and earlier value labels, then on the same side of
 * other lines as its own line, then nearest. Ties go to the earlier try. No spot ever crosses the
 * dot's own line.
 */
export function placeValueLabels(
  dots: readonly ValueLabelInput[],
  { xs, plot, avoid }: ValueLabelBounds,
): ValueLabel[] {
  const placed: Box[] = [];
  const out = new Array<ValueLabel>(dots.length);
  const order = dots.map((d, i) => ({ d, i })).sort((a, b) => a.d.y - b.d.y || a.i - b.i);
  for (const { d, i } of order) {
    const others = dots.filter((_, j) => j !== i);
    let best: ValueLabel | undefined;
    let bestScore = Infinity;
    for (const { label, step } of candidates(d, xs)) {
      const box = label.box;
      const [l, t, r, b] = box;
      const cx = (l + r) / 2;
      const cy = (t + b) / 2;
      const outside = l < plot[0] + 2 || r > plot[2] || t < plot[1] || b > plot[3];
      const clash = [...avoid, ...placed].some((o) => overlaps(box, o));
      const crosses = others.some((o) => lineCrosses(o.lineY, box));
      // Another plan's line runs between this label and its own line.
      const own = d.lineY(cx);
      const apart = others.some((o) => {
        const oy = o.lineY(cx);
        return (oy - own) * (oy - cy) < 0;
      });
      const score =
        (outside ? 8 : 0) + (crosses ? 6 : 0) + (clash ? 4 : 0) + (apart ? 2 : 0) + step * 0.5;
      if (score < bestScore) {
        best = label;
        bestScore = score;
      }
    }
    out[i] = best!;
    placed.push(best!.box);
  }
  return out;
}
