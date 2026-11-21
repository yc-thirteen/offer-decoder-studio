/**
 * Data and words for the "Health plan costs" panel (harness/DESIGN.md "Why these
 * elections"). Pure: the curves come from the engine's breakpoints (OfferResult.planCostCurves)
 * and the costs from the engine's planCost/worstCaseCost; this file only picks the window
 * to draw and phrases the conclusion.
 */
import { formatMoney } from "@/components/stub";
import { memoName } from "@/components/decoder/memoText";
import {
  planCost,
  worstCaseCost,
  type CostPoint,
  type HealthPlan,
  type Offer,
  type OfferResult,
  type Profile,
} from "@/lib/engine";
import { niceStep } from "./chartKit";

export type PlanLineKind = "recommended" | "dominated" | "other";

export interface PlanLine {
  plan: HealthPlan;
  kind: PlanLineKind;
  isDefault: boolean;
  /** [spending, yearly cost] from 0 to xMax, bending only at the engine's breakpoints. */
  points: CostPoint[];
  /** Yearly cost at the profile's expected medical spending. */
  costAtSpend: number;
  /** Premium + out-of-pocket max − employer HSA deposit: the most this plan can cost. */
  worstCase: number;
}

export interface HealthChartData {
  lines: PlanLine[];
  spend: number;
  xMax: number;
  yMin: number;
  yMax: number;
  sentence: string;
}

const money = (v: number) => formatMoney(v);

/**
 * The spending window: past the last bend (where every plan has hit its out-of-pocket max)
 * and past your expected spending, rounded up to a nice step.
 */
export function spendWindow(curves: Record<string, CostPoint[]>, spend: number): number {
  const xs = Object.values(curves)[0]?.map(([s]) => s) ?? [0];
  // The engine's last breakpoint is a synthetic point 50% past the last bend; drop it.
  const lastBend = xs.length > 1 ? xs[xs.length - 2]! : 0;
  const raw = Math.max(lastBend * 1.15, spend * 1.15, 1000);
  const step = niceStep(raw, 8);
  return Math.ceil(raw / step) * step;
}

export function healthChartData(
  offer: Offer,
  result: OfferResult,
  profile: Profile,
): HealthChartData {
  const spend = Math.max(0, profile.expectedMedicalSpend);
  const xMax = spendWindow(result.planCostCurves, spend);
  const dominated = new Set(result.dominatedPlanIds);
  const recId = result.recommendedElections.planId;

  const lines: PlanLine[] = offer.healthPlans.map((plan) => {
    const curve = result.planCostCurves[plan.id] ?? [];
    const points: CostPoint[] = curve.filter(([s]) => s < xMax);
    points.push([xMax, planCost(plan, xMax)]);
    return {
      plan,
      kind: plan.id === recId ? "recommended" : dominated.has(plan.id) ? "dominated" : "other",
      isDefault: plan.id === offer.defaultPlanId,
      points,
      costAtSpend: planCost(plan, spend),
      worstCase: worstCaseCost(plan),
    };
  });

  const ys = lines.flatMap((l) => l.points.map(([, c]) => c));
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(1000, ...ys) * 1.08;

  return { lines, spend, xMax, yMin, yMax, sentence: healthSentence(offer, lines, spend, profile) };
}

/** The panel's conclusion for one offer, stated before the chart. */
export function healthSentence(
  offer: Offer,
  lines: readonly PlanLine[],
  spend: number,
  profile: Pick<Profile, "hasEmergencyFund">,
): string {
  const rec = lines.find((l) => l.kind === "recommended") ?? lines[0];
  if (!rec) return "Add a health plan to this offer to compare its costs.";
  const at = `at your expected ${money(spend)} of medical spending`;

  if (lines.length === 1) {
    return (
      `${memoName(offer.employer, 0)} offers one plan, ${rec.plan.name}: ${at} it costs ` +
      `${money(rec.costAtSpend)} a year, and never more than ${money(rec.worstCase)}.`
    );
  }

  const byWorst = !profile.hasEmergencyFund;
  const score = (l: PlanLine) => (byWorst ? l.worstCase : l.costAtSpend);
  const others = lines.filter((l) => l !== rec);
  const ref = rec.isDefault
    ? others.reduce((best, l) => (score(l) < score(best) ? l : best))
    : (others.find((l) => l.isDefault) ?? others[0]!);
  const refName = ref.isDefault ? `the default ${ref.plan.name}` : ref.plan.name;
  const refTail = ref.kind === "dominated" ? `, which costs more at every level of spending` : "";
  const lead = rec.isDefault ? `Keep the default ${rec.plan.name}` : `Choose ${rec.plan.name}`;

  if (byWorst) {
    return (
      `${lead}: with no emergency fund, the lowest worst case wins, and it tops out at ` +
      `${money(rec.worstCase)} a year against ${money(ref.worstCase)} for ${refName}${refTail}.`
    );
  }
  const diff = ref.costAtSpend - rec.costAtSpend;
  const compare =
    Math.round(diff) > 0 ? `${money(diff)} less than ${refName}` : `the same as ${refName}`;
  return `${lead}: ${at} it costs ${money(rec.costAtSpend)} a year, ${compare}${refTail}.`;
}

/**
 * Line label on the chart: the plan name, plus what its color and dash mean in words.
 * An offer with one plan has nothing to recommend between, so its line gets no tag.
 */
export function lineLabel(line: PlanLine, planCount: number): string {
  if (planCount < 2) return line.plan.name;
  if (line.kind === "recommended") return `${line.plan.name}, recommended`;
  if (line.kind === "dominated") return `${line.plan.name}, dominated`;
  return line.plan.name;
}
