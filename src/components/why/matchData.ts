/**
 * Data and words for "The match and vesting" panel (harness/DESIGN.md "Why these
 * elections"). Pure: the match line comes from the engine's employerMatch on capped
 * contribution dollars, the markers from the engine's default and recommended calcs, and
 * the vesting steps from OfferResult.vestedPctByYear. This file only picks the window to
 * draw and phrases the conclusions.
 */
import { formatMoney } from "@/components/stub";
import { memoName } from "@/components/decoder/memoText";
import {
  LIMIT_401K,
  employee401kDollars,
  employerMatch,
  type Offer,
  type OfferResult,
} from "@/lib/engine";

/** [your contribution, % of pay; employer match, $ a year]. */
export type MatchPoint = [pct: number, dollars: number];

export type MarkerKind = "default" | "recommended" | "both";

export interface MatchMarker {
  kind: MarkerKind;
  pct: number;
  /** The engine's employer match for that set of elections. */
  match: number;
  /** "Default 3%", "Recommended 12%", or "Default and recommended 6%". */
  label: string;
}

export interface MatchChartData {
  /** The match line from 0% to xMax, bending only at tier edges (and the 401(k) limit). */
  points: MatchPoint[];
  /** Interior bends: where a tier ends or the limit stops your dollars. */
  bends: MatchPoint[];
  /** % of pay that gets the whole match (0 with no match). */
  capPct: number;
  /** The most the employer adds a year. */
  fullMatch: number;
  /** One marker per distinct %: default first, then recommended. */
  markers: MatchMarker[];
  /** Whole match minus the match at the default %; 0 when the default already gets it all. */
  leftOnTable: number;
  xMax: number;
  xStep: number;
  yMax: number;
  sentence: string;
  /** Vested percent at years 0–6, straight from the engine. */
  vested: number[];
  vestingSentence: string;
}

const money = (v: number) => formatMoney(v);
const pctText = (p: number) => `${Math.round(p * 100) / 100}%`;
const yearsText = (n: number) => (n === 1 ? "1 year" : `${n} years`);

/** The engine's match at a contribution %, on dollars capped at the 401(k) limit. */
export function matchAt(offer: Offer, pct: number): number {
  return employerMatch(offer, employee401kDollars(offer, pct));
}

/** Window and tick step for the % axis: a little past the highest marker or tier edge. */
export function pctWindow(highest: number): { xMax: number; xStep: number } {
  const raw = Math.max(highest + 2, 6);
  const xStep = raw <= 10 ? 1 : raw <= 20 ? 2 : 5;
  return { xMax: Math.ceil(raw / xStep) * xStep, xStep };
}

export function matchChartData(offer: Offer, result: OfferResult): MatchChartData {
  const d = result.default;
  const r = result.recommended;
  const capPct = result.matchCapPct;
  const { xMax, xStep } = pctWindow(Math.max(capPct, d.employeePct, r.employeePct));

  const limitPct = offer.salary > 0 ? (100 * LIMIT_401K) / offer.salary : Infinity;
  const pcts = [0, xMax, ...offer.retirement.match.map((t) => t.upToPct), limitPct]
    .filter((p) => p >= 0 && p <= xMax)
    .sort((a, b) => a - b)
    .filter((p, i, all) => i === 0 || p !== all[i - 1]);
  const points: MatchPoint[] = pcts.map((p) => [p, matchAt(offer, p)]);
  // A bend is a point where the slope changes.
  const bends = points.filter((p, i) => {
    if (i === 0 || i === points.length - 1) return false;
    const [a, b, c] = [points[i - 1]!, p, points[i + 1]!];
    const s1 = (b[1] - a[1]) / (b[0] - a[0]);
    const s2 = (c[1] - b[1]) / (c[0] - b[0]);
    return Math.abs(s1 - s2) > 1e-9;
  });
  const fullMatch = Math.max(0, ...points.map(([, m]) => m));

  const markers: MatchMarker[] =
    d.employeePct === r.employeePct
      ? [
          {
            kind: "both",
            pct: r.employeePct,
            match: r.employerMatch,
            label: `Default and recommended ${pctText(r.employeePct)}`,
          },
        ]
      : [
          {
            kind: "default",
            pct: d.employeePct,
            match: d.employerMatch,
            label: `Default ${pctText(d.employeePct)}`,
          },
          {
            kind: "recommended",
            pct: r.employeePct,
            match: r.employerMatch,
            label: `Recommended ${pctText(r.employeePct)}`,
          },
        ];
  const gap = fullMatch - d.employerMatch;
  const leftOnTable = Math.round(gap) > 0 ? gap : 0;

  return {
    points,
    bends,
    capPct,
    fullMatch,
    markers,
    leftOnTable,
    xMax,
    xStep,
    yMax: Math.max(1000, fullMatch * 1.4),
    sentence: matchSentence(offer, result, fullMatch, leftOnTable),
    vested: result.vestedPctByYear,
    vestingSentence: vestingSentence(result.vestedPctByYear, r.employerMatch, r.employeePct),
  };
}

/** The match conclusion for one offer, stated before the chart. */
export function matchSentence(
  offer: Offer,
  result: OfferResult,
  fullMatch: number,
  leftOnTable: number,
): string {
  const d = result.default;
  const r = result.recommended;
  const cap = pctText(result.matchCapPct);
  if (offer.retirement.match.length === 0 || Math.round(fullMatch) <= 0) {
    const tail =
      r.employeePct > d.employeePct
        ? ` The recommended ${pctText(r.employeePct)} is for your own savings.`
        : "";
    return `${memoName(offer.employer, 0)} offers no 401(k) match, so no contribution adds employer money.${tail}`;
  }
  const past =
    r.employeePct > result.matchCapPct
      ? ` The recommended ${pctText(r.employeePct)} saves more of your own pay past that.`
      : "";
  if (leftOnTable > 0) {
    return (
      `Put in at least ${cap} to get the whole match: at the default ${pctText(d.employeePct)} ` +
      `the employer adds ${money(d.employerMatch)} a year, at ${cap} it adds ${money(fullMatch)}, ` +
      `so the default leaves ${money(leftOnTable)} on the table.${past}`
    );
  }
  return (
    `The default ${pctText(d.employeePct)} already gets the whole match, ${money(fullMatch)} a ` +
    `year; the match stops growing at ${cap} of pay.${past}`
  );
}

/** The vesting conclusion, read off the same years 0–6 the timeline draws. */
export function vestingSentence(vested: readonly number[], match: number, pct: number): string {
  const firstSome = vested.findIndex((v) => v > 0);
  const firstFull = vested.findIndex((v) => v >= 100);
  if (firstFull === 0)
    return "The match is yours from day one, so leaving early forfeits none of it.";
  const cost =
    Math.round(match) > 0
      ? ` At the recommended ${pctText(pct)}, that is ${money(match)} of match a year.`
      : "";
  if (firstFull > 0 && firstSome === firstFull) {
    return (
      `The match vests all at once after ${yearsText(firstFull)}: leave sooner and you forfeit ` +
      `all of it.${cost}`
    );
  }
  if (firstSome < 0) {
    return `None of the match vests in the first ${yearsText(vested.length - 1)}.${cost}`;
  }
  const start = `You keep ${vested[firstSome]}% of the match after ${yearsText(firstSome)}`;
  const end =
    firstFull > 0
      ? `, rising to 100% after ${yearsText(firstFull)}`
      : `, rising to ${vested[vested.length - 1]}% after ${yearsText(vested.length - 1)}`;
  return `${start}${end}. Leave sooner and you forfeit the unvested part.${cost}`;
}
