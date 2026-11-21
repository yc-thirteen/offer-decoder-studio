/**
 * Day-one checklist as stable ids; the UI writes the words. Mirrors checklist() in
 * harness/reference/engine.py. Order follows the funds hierarchy (FINANCE_SPEC.md):
 * match → debt → buffer → health plan → HSA → account type → life → W-4 → vesting.
 */
import { calculate, defaultElections } from "./calculate";
import { dominatedPlanIds } from "./health";
import { lifeInsurance } from "./life";
import { recommend } from "./recommend";
import { fullMatchDollars } from "./retirement";
import type { CalcResult, ChecklistId, Elections, Offer, Profile } from "./types";

/** Precomputed pieces runCase already has; anything omitted is computed here. */
export interface ChecklistInputs {
  defaults?: Elections;
  recommended?: Elections;
  defaultCalc?: CalcResult;
}

export function checklist(
  offer: Offer,
  profile: Profile,
  inputs: ChecklistInputs = {},
): ChecklistId[] {
  const d = inputs.defaults ?? defaultElections(offer);
  const r = inputs.recommended ?? recommend(offer, profile);
  const dc = inputs.defaultCalc ?? calculate(offer, profile, d);
  const items: ChecklistId[] = [];

  if (r.employeePct > d.employeePct) items.push("raise-401k");
  // Half a dollar of slack, as in engine.py, so rounding never reports a phantom gap.
  if (fullMatchDollars(offer) - dc.employerMatch > 0.5) items.push("unclaimed-match");
  if (profile.hasHighInterestDebt) items.push("pay-high-interest-debt");
  if (!profile.hasEmergencyFund) items.push("build-emergency-fund");
  if (r.planId !== d.planId) items.push("switch-health-plan");
  if (dominatedPlanIds(offer.healthPlans).includes(d.planId)) items.push("default-plan-dominated");
  if (r.employeeHsa > 0) items.push("open-hsa");
  items.push(r.accountType === "roth" ? "choose-roth" : "choose-traditional");
  items.push(lifeInsurance(offer, profile) ? "life-insurance" : "skip-extra-life-insurance");
  items.push("check-w4");
  if (offer.retirement.vesting.type !== "immediate") items.push("note-vesting-date");
  return items;
}
