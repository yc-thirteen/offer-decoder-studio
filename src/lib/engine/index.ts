/**
 * Engine entry point. runCase() mirrors run_case() in harness/reference/engine.py:
 * for each offer, compute default and recommended elections, both pay calculations,
 * match/vesting facts, plan cost curves, life insurance and the checklist; then pick
 * the winner by bottom line under each set of elections.
 * The UI imports from here only; it formats what this returns and computes nothing.
 */
import { calculate, defaultElections, r2 } from "./calculate";
import { checklist } from "./checklist";
import { dominatedPlanIds, planCostCurves } from "./health";
import { lifeInsurance } from "./life";
import { recommend } from "./recommend";
import { matchCapPct, maxMatchPct, vestedPctByYear } from "./retirement";
import type { CaseResult, CostPoint, Offer, OfferResult, Profile } from "./types";

export * from "./types";
export * from "./constants";
export { calculate, defaultElections, findPlan, r2 } from "./calculate";
export { checklist } from "./checklist";
export {
  breakpoints,
  dominatedPlanIds,
  planCost,
  planCostCurves,
  recommendedPlan,
  worstCaseCost,
} from "./health";
export {
  DEFAULT_LIFE_PARAMS,
  humanCapital,
  insuredFraction,
  lifeInsurance,
  type LifeParams,
} from "./life";
export { isReady, recommend } from "./recommend";
export {
  federalTaxOnJob,
  incomeTax,
  marginalRate,
  stateIncomeTax,
  stateWages,
  taxableIncome,
} from "./tax";
export {
  STATE_CODES,
  STATE_TAX,
  STATE_TAX_LEFT_OUT,
  hasWageIncomeTax,
  stateTaxOnIncome,
  type StateTaxRule,
  type TaxedState,
} from "./stateTax";
export {
  employee401kDollars,
  employerMatch,
  fullMatchDollars,
  matchCapPct,
  maxMatchPct,
  vestedPctByYear,
} from "./retirement";

/** Everything the decoder shows for one offer. */
export function runOffer(offer: Offer, profile: Profile): OfferResult {
  const d = defaultElections(offer);
  const r = recommend(offer, profile);
  const dc = calculate(offer, profile, d);
  const rc = calculate(offer, profile, r);

  const curves: Record<string, CostPoint[]> = {};
  for (const [id, pts] of Object.entries(planCostCurves(offer.healthPlans))) {
    curves[id] = pts.map(([s, c]): CostPoint => [s, r2(c)]);
  }

  return {
    offerId: offer.id,
    dominatedPlanIds: dominatedPlanIds(offer.healthPlans),
    recommendedElections: r,
    default: dc,
    recommended: rc,
    matchCapPct: matchCapPct(offer),
    maxMatchPctOfSalary: r2(maxMatchPct(offer)),
    vestedPctByYear: vestedPctByYear(offer.retirement.vesting),
    planCostCurves: curves,
    lifeInsurance: lifeInsurance(offer, profile),
    checklist: checklist(offer, profile, { defaults: d, recommended: r, defaultCalc: dc }),
  };
}

/** The offer id with the highest bottom line; the first offer wins a tie (like Python's max). */
function winner(offers: OfferResult[], key: "default" | "recommended"): string {
  let best: OfferResult | undefined;
  for (const o of offers) if (!best || o[key].bottomLine > best[key].bottomLine) best = o;
  return best?.offerId ?? "";
}

/** Run a whole case: one profile, any number of offers (the decoder uses two). */
export function runCase(c: { id: string; profile: Profile; offers: Offer[] }): CaseResult {
  const offers = c.offers.map((o) => runOffer(o, c.profile));
  return {
    id: c.id,
    offers,
    winnerBy_default: winner(offers, "default"),
    winnerBy_recommended: winner(offers, "recommended"),
  };
}

export {
  blankMonthlyBudget,
  calculateMonthlyPlan,
  editableElections,
  hsaAllowance,
  validateElections,
} from "./monthlyPlan";
export type {
  MonthlyBudget,
  MonthlyPlanResult,
  CustomElections,
  ElectionErrors,
} from "./monthlyPlan";
