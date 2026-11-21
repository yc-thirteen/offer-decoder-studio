/**
 * The full pay calculation and bottom line for one offer under one set of elections
 * (Lecture 4B, plus 7A/7B for employer money). Mirrors calculate() and
 * default_elections() in harness/reference/engine.py. Dollar outputs are rounded to
 * cents exactly like engine.py's r2().
 */
import { LIMIT_401K, RETIREMENT_TAX_RATE } from "./constants";
import { employerHsaDeposit, outOfPocket } from "./health";
import { employee401kDollars, employerMatch } from "./retirement";
import {
  federalMarginalRate,
  federalTaxOnJob,
  medicareTax,
  socialSecurityTax,
  stateIncomeTax,
} from "./tax";
import type { CalcResult, Elections, HealthPlan, Offer, Profile } from "./types";

/** Round to cents, nudged like engine.py's r2 so .xx5 edges round the same way. */
export function r2(x: number): number {
  return Math.round((x + 1e-9) * 100) / 100;
}

/** Spouse's wages count only when filing jointly. */
export function otherWages(profile: Profile): number {
  return profile.filingStatus === "mfj" ? (profile.otherHouseholdWages ?? 0) : 0;
}

/** What you get if you elect nothing: default plan, default %, traditional, no HSA. */
export function defaultElections(offer: Offer): Elections {
  return {
    planId: offer.defaultPlanId,
    employeePct: offer.retirement.defaultEmployeePct,
    accountType: "traditional",
    employeeHsa: 0,
  };
}

/** The elected plan; throws a directive message if the id is not one of the offer's plans. */
export function findPlan(offer: Offer, planId: string): HealthPlan {
  const plan = offer.healthPlans.find((p) => p.id === planId);
  if (!plan) throw new Error(`Choose one of this offer's health plans (no plan "${planId}").`);
  return plan;
}

export function calculate(offer: Offer, profile: Profile, elections: Elections): CalcResult {
  const status = profile.filingStatus;
  const sal = offer.salary;
  const other = otherWages(profile);
  const plan = findPlan(offer, elections.planId);

  const k = employee401kDollars(offer, elections.employeePct);
  const trad = elections.accountType === "traditional" ? k : 0;
  const hsaEmp = plan.hsaEligible ? elections.employeeHsa : 0;
  // Section 125: premium + employee HSA are pre-tax for income AND payroll tax.
  const sec125 = plan.premium + hsaEmp;
  // A traditional 401(k) is pre-tax for income tax only.
  const fedWages = sal - trad - sec125;
  const fed = federalTaxOnJob(fedWages, other, status);
  const payrollWages = sal - sec125;
  const ss = socialSecurityTax(payrollWages);
  const medicare = medicareTax(payrollWages, other, status);
  const state = stateIncomeTax(fedWages, offer.state, offer.customStateRate);

  const net = sal - k - plan.premium - hsaEmp - fed - ss - medicare - state;
  const match = employerMatch(offer, k);
  const eHsa = employerHsaDeposit(plan);
  const expectedOop = outOfPocket(plan, profile.expectedMedicalSpend);
  const savings = k + match + hsaEmp + eHsa;
  // Traditional dollars and the match are taxed on withdrawal (7B slide 7); Roth and HSA are not.
  const savingsAfterTax = (trad + match) * (1 - RETIREMENT_TAX_RATE) + (k - trad) + hsaEmp + eHsa;

  return {
    planId: plan.id,
    employeePct: elections.employeePct,
    accountType: elections.accountType,
    grossPay: r2(sal),
    employee401k: r2(k),
    hitsLimit401k: (sal * elections.employeePct) / 100 > LIMIT_401K,
    traditional401k: r2(trad),
    roth401k: r2(k - trad),
    healthPremium: r2(plan.premium),
    employeeHsa: r2(hsaEmp),
    federalIncomeTax: r2(fed),
    socialSecurity: r2(ss),
    medicare: r2(medicare),
    stateIncomeTax: r2(state),
    netPay: r2(net),
    netPayPerPaycheck: r2(offer.payPeriods > 0 ? net / offer.payPeriods : net),
    employerMatch: r2(match),
    employerHsa: r2(eHsa),
    savingsInYourName: r2(savings),
    savingsAfterFutureTax: r2(savingsAfterTax),
    expectedOutOfPocket: r2(expectedOop),
    bottomLine: r2(net + savingsAfterTax - expectedOop),
    federalMarginalRate: federalMarginalRate(fedWages, other, status),
    federalAverageRateOnJob: r2(sal > 0 ? (fed / sal) * 100 : 0),
  };
}
