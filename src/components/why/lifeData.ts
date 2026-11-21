/**
 * Pure data for the "Life insurance" panel (harness/DESIGN.md "Why these elections";
 * FINANCE_SPEC.md "Life insurance", 7A slides 27–28). Every number comes from the engine's
 * lifeInsurance() and insuredFraction(); this module only picks points and writes words.
 */
import { formatMoney } from "@/components/stub";
import { checklistSentence } from "@/components/decoder/checklistText";
import {
  LIFE,
  insuredFraction,
  lifeInsurance,
  type LifeResult,
  type Offer,
  type OfferResult,
  type Profile,
} from "@/lib/engine";

/** What the panel's two sliders control. Everything else stays at the lecture's values. */
export interface LifeSettings {
  riskAversion: number;
  /** Markup on coverage through work, 0–1. */
  employerMarkup: number;
}

export const LECTURE_SETTINGS: Readonly<LifeSettings> = {
  riskAversion: LIFE.riskAversion,
  employerMarkup: LIFE.employerMarkup,
};

export const RISK_AVERSION_RANGE = { min: 1, max: 6, step: 0.5 } as const;
/** In percent. */
export const MARKUP_RANGE = { min: 0, max: 100, step: 5 } as const;
/** The chart's markup axis runs 0–150% so the on-your-own point (100%) sits inside it. */
export const MARKUP_X_MAX = 150;

export function isLectureSettings(s: LifeSettings): boolean {
  return (
    Math.abs(s.riskAversion - LECTURE_SETTINGS.riskAversion) < 1e-9 &&
    Math.abs(s.employerMarkup - LECTURE_SETTINGS.employerMarkup) < 1e-9
  );
}

/** The engine's life result for these settings. At the lecture values it is the case result. */
export function lifeFor(
  offer: Offer,
  result: OfferResult,
  profile: Profile,
  settings: LifeSettings,
): LifeResult | null {
  if (isLectureSettings(settings)) return result.lifeInsurance;
  return lifeInsurance(offer, profile, settings);
}

export type LifeMarkerKind = "work" | "own";

export interface LifeMarker {
  kind: LifeMarkerKind;
  label: string;
  /** Markup in percent. */
  markupPct: number;
  /** Share of human capital to insure, in percent (the engine's 2-place fraction × 100). */
  fractionPct: number;
}

export interface LifeRow {
  label: string;
  amount: number;
}

export interface LifeChartData {
  life: LifeResult;
  /** [markup %, share to insure %] along the engine's formula. */
  points: [number, number][];
  /** Markup % past which nothing is worth insuring; null when it is past the chart. */
  zeroAtPct: number | null;
  markers: LifeMarker[];
  /** The conclusion: how much term coverage to get and from where. */
  sentence: string;
  /** Why: human capital, its share of household wealth, and the two fractions. */
  reason: string;
  rows: LifeRow[];
  total: LifeRow;
}

const pct = (fraction: number) => Math.round(fraction * 100);

/** "3" or "3.5". */
export function formatRiskAversion(g: number): string {
  return Number.isInteger(g) ? String(g) : g.toFixed(1);
}

/** The conclusion sentence, in the checklist's words so the two never disagree. */
export function lifeSentence(
  offer: Offer,
  result: OfferResult,
  profile: Profile,
  life: LifeResult,
): string {
  if (Math.round(life.totalRecommendedCoverage) === 0) {
    return "At these settings, life insurance costs more than it protects, so buy none.";
  }
  const withLife: OfferResult = { ...result, lifeInsurance: life };
  return checklistSentence("life-insurance", offer, withLife, profile) ?? "";
}

export function lifeReason(life: LifeResult, settings: LifeSettings): string {
  const share = pct(life.lossShare);
  const fe = pct(life.fractionEmployer);
  const fi = pct(life.fractionIndividual);
  const markup = pct(settings.employerMarkup);
  const head = `Your pay to age ${LIFE.retirementAge} is worth ${formatMoney(life.humanCapital)} today, ${share}% of your household's wealth.`;
  if (fe === 0) {
    return `${head} At a ${markup}% markup, even coverage through work costs more than it protects, so keep only what is free.`;
  }
  const own =
    fi === 0
      ? "and none of it on your own, where coverage costs a 100% markup"
      : `but only ${fi}% on your own, where coverage costs a 100% markup`;
  return `${head} Insure ${fe}% of it through work, at a ${markup}% markup, ${own}.`;
}

/** Null when nobody depends on your income (the engine skips life insurance then). */
export function lifeChartData(
  offer: Offer,
  result: OfferResult,
  profile: Profile,
  settings: LifeSettings,
): LifeChartData | null {
  const life = lifeFor(offer, result, profile, settings);
  if (!life) return null;
  const L = life.humanCapital;
  const W = life.householdWealth;
  const lossShare = W > 0 ? L / W : 0;
  const g = settings.riskAversion;
  const at = (m: number) => insuredFraction(m / 100, g, lossShare) * 100;

  const zero = g * lossShare * 100;
  const zeroAtPct = lossShare > 0 && zero < MARKUP_X_MAX ? zero : null;
  const xs = [0, ...(zeroAtPct !== null ? [zeroAtPct] : []), MARKUP_X_MAX];
  const points = xs.map((m): [number, number] => [m, at(m)]);

  const fe = pct(life.fractionEmployer);
  const fi = pct(life.fractionIndividual);
  const markers: LifeMarker[] = [
    {
      kind: "work",
      label: `Through work: ${fe}%`,
      markupPct: pct(settings.employerMarkup),
      fractionPct: life.fractionEmployer * 100,
    },
    {
      kind: "own",
      label: `On your own: ${fi}%`,
      markupPct: pct(LIFE.individualMarkup),
      fractionPct: life.fractionIndividual * 100,
    },
  ];

  const rows: LifeRow[] = [
    { label: `Worth insuring through work (${fe}%)`, amount: life.recommendedCoverageEmployer },
    { label: `Worth insuring on your own (${fi}%)`, amount: life.recommendedCoverageIndividual },
    { label: "Free basic coverage", amount: life.basicCoverage },
    { label: "Add through work", amount: life.recommendedSupplemental },
    { label: "Buy on your own", amount: life.recommendedIndividualPolicy },
  ];

  return {
    life,
    points,
    zeroAtPct,
    markers,
    sentence: lifeSentence(offer, result, profile, life),
    reason: lifeReason(life, settings),
    rows,
    total: { label: "Term life coverage to get", amount: life.totalRecommendedCoverage },
  };
}
