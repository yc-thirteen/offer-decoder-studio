/**
 * Life insurance sizing (Lecture 7A slides 27–28). Mirrors human_capital() and
 * life_insurance() in harness/reference/engine.py. Only computed when someone depends
 * on your income; otherwise the result is null and the checklist says to keep the free
 * coverage and skip buying more.
 */
import { r2, otherWages } from "./calculate";
import { LIFE } from "./constants";
import type { LifeResult, Offer, Profile } from "./types";

/** Tunable inputs, so the life panel's sliders can recompute live. Defaults are LIFE. */
export interface LifeParams {
  riskAversion: number;
  employerMarkup: number;
  individualMarkup: number;
  wageGrowth: number;
  discountRate: number;
  retirementAge: number;
}

export const DEFAULT_LIFE_PARAMS: Readonly<LifeParams> = { ...LIFE };

/**
 * Present value of a growing wage stream (growing annuity, 7A slide 27):
 * salary / (r − g) × (1 − ((1 + g) / (1 + r))^years). 0 for no years or no salary.
 */
export function humanCapital(salary: number, years: number, g: number, r: number): number {
  if (years <= 0 || salary <= 0) return 0;
  // r = g is the limit of the formula: salary × years / (1 + r).
  if (Math.abs(r - g) < 1e-12) return (salary * years) / (1 + r);
  return (salary / (r - g)) * (1 - ((1 + g) / (1 + r)) ** years);
}

/**
 * Fraction of human capital to insure at a given markup (7A slide 28):
 * 1 − (markup / risk aversion) / (L / W), floored at 0.
 * 0 when there is no human capital to insure (avoids dividing by zero).
 */
export function insuredFraction(markup: number, riskAversion: number, lossShare: number): number {
  if (lossShare <= 0 || riskAversion <= 0) return 0;
  return Math.max(0, 1 - markup / riskAversion / lossShare);
}

export function lifeInsurance(
  offer: Offer,
  profile: Profile,
  params: Partial<LifeParams> = {},
): LifeResult | null {
  if (!profile.hasDependents) return null;
  const p = { ...DEFAULT_LIFE_PARAMS, ...params };
  const years = p.retirementAge - profile.age;
  const L = humanCapital(offer.salary, years, p.wageGrowth, p.discountRate);
  const spouseL = humanCapital(otherWages(profile), years, p.wageGrowth, p.discountRate);
  const W = L + spouseL + (profile.currentSavings ?? 0);
  const lossShare = W > 0 ? L / W : 0;

  const fe = insuredFraction(p.employerMarkup, p.riskAversion, lossShare);
  const fi = insuredFraction(p.individualMarkup, p.riskAversion, lossShare);
  const basic = offer.life.basicMultiple * offer.salary;
  const rec = fe * L;
  const supp = Math.min(
    Math.max(0, rec - basic),
    offer.life.supplementalMaxMultiple * offer.salary,
  );
  // Coverage beyond what work sells costs the individual markup, so only top up to fi × L.
  const individual = Math.max(0, fi * L - basic - supp);

  return {
    humanCapital: r2(L),
    householdWealth: r2(W),
    lossShare: r2(lossShare),
    fractionEmployer: r2(fe),
    fractionIndividual: r2(fi),
    recommendedCoverageEmployer: r2(rec),
    recommendedCoverageIndividual: r2(fi * L),
    basicCoverage: r2(basic),
    recommendedSupplemental: r2(supp),
    recommendedIndividualPolicy: r2(individual),
    totalRecommendedCoverage: r2(basic + supp + individual),
  };
}
