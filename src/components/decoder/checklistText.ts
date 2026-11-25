/**
 * Words for the back of the stub (harness/DESIGN.md "Checklist copy"). Pure: the engine picks
 * the checklist ids and every value; this only fills them into sentences. Any amount that
 * comes out as $0 is left out and the sentence is rephrased so it still reads naturally.
 */
import {
  HSA_LIMIT,
  calculate,
  dominatedPlanIds,
  fullMatchDollars,
  type ChecklistId,
  type HealthPlan,
  type Offer,
  type OfferResult,
  type Profile,
  type Vesting,
} from "@/lib/engine";
import { formatMoney } from "@/components/stub";

export interface ChecklistItem {
  id: ChecklistId | "lower-401k";
  text: string;
}

function years(n: number): string {
  return n === 1 ? "1 year" : `${n} years`;
}

function planName(offer: Offer, id: string): string {
  return offer.healthPlans.find((p) => p.id === id)?.name ?? id;
}

/** Rounds to whole dollars first, so "$0" means it would print as $0. */
function isZero(amount: number): boolean {
  return Math.round(amount) === 0;
}

/** "a", "a and b", "a, b, and c". */
function joinList(parts: string[]): string {
  if (parts.length <= 2) return parts.join(" and ");
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** The vesting date in words, for "Put your vesting date in your calendar: …". */
export function vestingDateText(vesting: Vesting): string {
  switch (vesting.type) {
    case "immediate":
      return "the match is yours from day one";
    case "cliff":
      return `the match is fully yours after ${years(vesting.years)} of service`;
    case "graded": {
      const steps = [...vesting.schedule].sort((a, b) => a.year - b.year);
      const first = steps[0];
      const full = steps.find((s) => s.pct >= 100);
      if (!first) return "the match is yours from day one";
      if (!full || full === first) {
        return `${first.pct}% of the match is yours after ${years(first.year)} of service`;
      }
      return `${first.pct}% of the match is yours after ${years(first.year)}, rising to 100% after ${years(full.year)}`;
    }
  }
}

/**
 * A plan that dominates the default, for "The default X costs more than Y…". Prefers the
 * recommended plan; the dominance test itself is the engine's.
 */
function dominatingPlan(offer: Offer, defaultId: string, preferId: string): HealthPlan | undefined {
  const def = offer.healthPlans.find((p) => p.id === defaultId);
  if (!def) return undefined;
  const others = offer.healthPlans.filter((p) => p.id !== defaultId);
  others.sort((a, b) => Number(b.id === preferId) - Number(a.id === preferId));
  return others.find((p) => dominatedPlanIds([def, p]).includes(def.id));
}

/** One checklist sentence, or null when there is nothing to say (the item is then dropped). */
export function checklistSentence(
  id: ChecklistId,
  offer: Offer,
  result: OfferResult,
  profile: Profile,
): string | null {
  const d = result.default;
  const r = result.recommendedElections;
  switch (id) {
    case "raise-401k":
      return d.employeePct === 0
        ? `Start your 401(k) at ${r.employeePct}% of pay.`
        : `Raise your 401(k) from ${d.employeePct}% to ${r.employeePct}% of pay.`;
    case "unclaimed-match": {
      const unclaimed = fullMatchDollars(offer) - d.employerMatch;
      if (isZero(unclaimed)) return null;
      return `At ${d.employeePct}% you'd leave ${formatMoney(unclaimed)} of free match on the table each year.`;
    }
    case "pay-high-interest-debt":
      return "Pay off high-interest debt next. Beyond the match, it beats any investment.";
    case "build-emergency-fund":
      return "Build 3–6 months of expenses in cash before saving more for retirement.";
    case "switch-health-plan":
      return `Choose ${planName(offer, r.planId)} instead of the default ${planName(offer, d.planId)}.`;
    case "default-plan-dominated": {
      const better = dominatingPlan(offer, d.planId, r.planId);
      if (!better) return null;
      return `The default ${planName(offer, d.planId)} costs more than ${better.name} at every level of medical spending.`;
    }
    case "open-hsa": {
      if (isZero(r.employeeHsa)) return null;
      const limit = formatMoney(HSA_LIMIT[profile.coverage]);
      const employerHsa = result.recommended.employerHsa;
      const reach = isZero(employerHsa)
        ? `That reaches the ${limit} limit`
        : `With the employer's ${formatMoney(employerHsa)} you reach the ${limit} limit`;
      return `Open the HSA and contribute ${formatMoney(r.employeeHsa)} a year through payroll. ${reach}, and payroll contributions skip Social Security and Medicare tax.`;
    }
    case "choose-roth":
    case "choose-traditional": {
      // The bracket the engine compared: the recommended elections with traditional dollars.
      const probe = calculate(offer, profile, { ...r, accountType: "traditional" });
      const rate = Math.round(probe.federalMarginalRate * 100);
      return id === "choose-roth"
        ? `Pick Roth. Your federal bracket is ${rate}%, likely lower than it will be later.`
        : `Pick traditional. At a ${rate}% federal bracket, deducting now is worth more.`;
    }
    case "life-insurance": {
      const life = result.lifeInsurance;
      if (!life || isZero(life.totalRecommendedCoverage)) return null;
      const parts: string[] = [];
      if (!isZero(life.basicCoverage))
        parts.push(`keep the free ${formatMoney(life.basicCoverage)}`);
      if (!isZero(life.recommendedSupplemental)) {
        parts.push(`add ${formatMoney(life.recommendedSupplemental)} through work`);
      }
      if (parts.length === 0) {
        return `Buy ${formatMoney(life.totalRecommendedCoverage)} of term life coverage on your own. Term, not whole life.`;
      }
      if (isZero(life.recommendedSupplemental) && isZero(life.recommendedIndividualPolicy)) {
        return `Keep the free ${formatMoney(life.basicCoverage)} of term life coverage through work and skip buying more. Term, not whole life.`;
      }
      if (!isZero(life.recommendedIndividualPolicy)) {
        parts.push(
          `buy ${formatMoney(life.recommendedIndividualPolicy)} on your own only if needed`,
        );
      }
      return `Get ${formatMoney(life.totalRecommendedCoverage)} of term life coverage: ${joinList(parts)}. Term, not whole life.`;
    }
    case "skip-extra-life-insurance":
      return "No one depends on your income, so keep the free coverage and skip buying more.";
    case "check-w4":
      return "Fill out your W-4 so you don't over-withhold. A big refund is an interest-free loan to the government.";
    case "note-vesting-date":
      return `Put your vesting date in your calendar: ${vestingDateText(offer.retirement.vesting)}.`;
  }
}

/** The day-one checklist for one offer, in the engine's order. */
export function checklistItems(
  offer: Offer,
  result: OfferResult,
  profile: Profile,
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  if (result.recommendedElections.employeePct < result.default.employeePct) {
    items.push({
      id: "lower-401k",
      text: `The suggested plan lowers your 401(k) from ${result.default.employeePct}% to ${result.recommendedElections.employeePct}% of pay. Check that this fits your goals and monthly expenses.`,
    });
  }
  for (const id of result.checklist) {
    const text = checklistSentence(id, offer, result, profile);
    if (text) items.push({ id, text });
  }
  return items;
}
