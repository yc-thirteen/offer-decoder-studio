/**
 * Recommended elections (7B slide 43, the funds hierarchy). Mirrors recommend() in
 * harness/reference/engine.py.
 */
import { HSA_LIMIT, ROTH_MAX_MARGINAL, TARGET_SAVINGS_RATE } from "./constants";
import { calculate } from "./calculate";
import { employerHsaDeposit, recommendedPlan } from "./health";
import { matchCapPct, maxMatchPct } from "./retirement";
import type { Elections, Offer, Profile } from "./types";

/** "Ready" to save past the match: an emergency fund and no high-interest debt. */
export function isReady(profile: Profile): boolean {
  return profile.hasEmergencyFund && !profile.hasHighInterestDebt;
}

/**
 * 1. Always at least the full match. 2. Not ready → stop at the match, no HSA.
 * 3. Ready → max(match cap, ceil(15 − match % at the cap)) and fill the HSA to the
 * tier limit minus the employer deposit. 4. Never below the default %.
 * 5. Roth if offered and the marginal rate under traditional elections is ≤ 12%.
 */
export function recommend(offer: Offer, profile: Profile): Elections {
  const plan = recommendedPlan(
    offer.healthPlans,
    profile.expectedMedicalSpend,
    profile.hasEmergencyFund,
  );
  const ready = isReady(profile);
  const cap = matchCapPct(offer);
  let pct = cap;
  if (ready) pct = Math.max(cap, Math.ceil(100 * TARGET_SAVINGS_RATE - maxMatchPct(offer) - 1e-9));
  pct = Math.max(pct, offer.retirement.defaultEmployeePct);

  const employeeHsa =
    plan.hsaEligible && ready
      ? Math.max(0, HSA_LIMIT[profile.coverage] - employerHsaDeposit(plan))
      : 0;

  const probe = calculate(offer, profile, {
    planId: plan.id,
    employeePct: pct,
    accountType: "traditional",
    employeeHsa,
  });
  const roth = offer.retirement.rothAvailable && probe.federalMarginalRate <= ROTH_MAX_MARGINAL;
  return {
    planId: plan.id,
    employeePct: pct,
    accountType: roth ? "roth" : "traditional",
    employeeHsa,
  };
}
