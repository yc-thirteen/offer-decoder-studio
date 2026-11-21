/**
 * Health plans (Lecture 7A slides 21, 36–37). Pure functions, unrounded.
 * Mirrors oop / plan_cost / breakpoints / dominated_plan_ids / worst_case_cost /
 * recommended_plan in harness/reference/engine.py.
 */
import type { CostPoint, HealthPlan } from "./types";

/** Comparison slack for floating-point cost curves (same as engine.py). */
const EPS = 1e-9;

/**
 * Out-of-pocket at total medical spending `spend`: everything up to the deductible,
 * then the coinsurance share above it, capped at the out-of-pocket max.
 */
export function outOfPocket(plan: HealthPlan, spend: number): number {
  const v =
    spend <= plan.deductible
      ? spend
      : plan.deductible + plan.coinsurance * (spend - plan.deductible);
  return Math.min(v, plan.oopMax);
}

/** Employer HSA deposit; counts only when the plan is HSA-eligible. */
export function employerHsaDeposit(plan: HealthPlan): number {
  return plan.hsaEligible ? plan.employerHsa : 0;
}

/** Yearly plan cost at a spending level: premium + out-of-pocket − employer HSA deposit. */
export function planCost(plan: HealthPlan, spend: number): number {
  return plan.premium + outOfPocket(plan, spend) - employerHsaDeposit(plan);
}

/** Worst-case yearly cost: premium + out-of-pocket max − employer HSA deposit. */
export function worstCaseCost(plan: HealthPlan): number {
  return plan.premium + plan.oopMax - employerHsaDeposit(plan);
}

/**
 * Spending levels where any plan's cost curve can bend: 0, every deductible, every
 * point where out-of-pocket reaches its max, plus one point past the last kink.
 * Comparing curves at these points is exact because they are piecewise linear.
 * Sorted ascending, no duplicates.
 */
export function breakpoints(plans: readonly HealthPlan[]): number[] {
  const pts = new Set<number>([0]);
  for (const p of plans) {
    pts.add(p.deductible);
    if (p.coinsurance > 0) pts.add(p.deductible + (p.oopMax - p.deductible) / p.coinsurance);
  }
  pts.add(Math.max(...pts) * 1.5 + 1000);
  return [...pts].sort((a, b) => a - b);
}

/** Plan id → [spending, cost] at every breakpoint of the offer's plans (for the chart). */
export function planCostCurves(plans: readonly HealthPlan[]): Record<string, CostPoint[]> {
  const pts = breakpoints(plans);
  const out: Record<string, CostPoint[]> = {};
  for (const p of plans) out[p.id] = pts.map((s): CostPoint => [s, planCost(p, s)]);
  return out;
}

/**
 * Ids of dominated plans: plan A is dominated if another plan costs no more at every
 * spending level and strictly less at some level. Order follows the input.
 */
export function dominatedPlanIds(plans: readonly HealthPlan[]): string[] {
  const pts = breakpoints(plans);
  const isDominatedBy = (a: HealthPlan, b: HealthPlan) => {
    const diffs = pts.map((s) => planCost(a, s) - planCost(b, s));
    return diffs.every((d) => d >= -EPS) && diffs.some((d) => d > EPS);
  };
  return plans.filter((a) => plans.some((b) => b !== a && isDominatedBy(a, b))).map((a) => a.id);
}

/** Round to 6 decimals so float noise doesn't break ties (engine.py: round(score, 6)). */
function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/**
 * The plan to elect. Never a dominated plan. With an emergency fund, the lowest cost at
 * expected spending (7A slide 37); without one, the lowest worst-case cost, because a
 * high deductible needs a cash cushion (7A slide 21). Ties go to the lower premium,
 * then to the earlier plan in the list.
 */
export function recommendedPlan(
  plans: readonly HealthPlan[],
  expectedSpend: number,
  hasEmergencyFund: boolean,
): HealthPlan {
  if (plans.length === 0) throw new Error("An offer needs at least one health plan.");
  const dominated = new Set(dominatedPlanIds(plans));
  const undominated = plans.filter((p) => !dominated.has(p.id));
  // Only empty if plans share an id (invalid input); fall back rather than crash.
  const candidates = undominated.length > 0 ? undominated : [...plans];
  const score = (p: HealthPlan) =>
    round6(hasEmergencyFund ? planCost(p, expectedSpend) : worstCaseCost(p));
  return candidates.reduce((best, p) => {
    const s = score(p);
    const b = score(best);
    return s < b || (s === b && p.premium < best.premium) ? p : best;
  });
}
