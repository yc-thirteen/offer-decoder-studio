/** Annualized planning. Payroll deductions are already included in calculate().netPay. */
import { HSA_LIMIT, LIMIT_401K } from "./constants";
import { employerHsaDeposit } from "./health";
import { r2 } from "./calculate";
import type { CalcResult, Elections, Offer, Profile } from "./types";

export interface MonthlyBudget {
  livingExpenses: number | null;
  minimumDebtPayments: number | null;
  cashSavings: number | null;
  useHsaForMedical: boolean;
}

export function blankMonthlyBudget(): MonthlyBudget {
  return {
    livingExpenses: null,
    minimumDebtPayments: null,
    cashSavings: null,
    useHsaForMedical: false,
  };
}

export type CustomElections = Omit<Elections, "employeePct" | "employeeHsa"> & {
  employeePct: number | null;
  employeeHsa: number | null;
};
export type ElectionErrors = Partial<Record<keyof CustomElections | "deductions", string>>;

export function hsaAllowance(offer: Offer, profile: Profile, planId: string): number {
  const plan = offer.healthPlans.find((p) => p.id === planId);
  return plan?.hsaEligible
    ? Math.max(0, HSA_LIMIT[profile.coverage] - employerHsaDeposit(plan))
    : 0;
}

/** Seed the effective percentage at the annual cap without changing contribution dollars. */
export function editableElections(offer: Offer, elections: Elections): CustomElections {
  const maxPct = offer.salary > 0 ? (100 * LIMIT_401K) / offer.salary : 0;
  return { ...elections, employeePct: Math.min(elections.employeePct, maxPct) };
}

export function validateElections(
  offer: Offer,
  profile: Profile,
  e: CustomElections,
): ElectionErrors {
  const errors: ElectionErrors = {};
  const plan = offer.healthPlans.find((p) => p.id === e.planId);
  if (!plan) errors.planId = "Choose a health plan offered by this employer.";
  if (
    e.employeePct === null ||
    !Number.isFinite(e.employeePct) ||
    e.employeePct < 0 ||
    e.employeePct > 100
  ) {
    errors.employeePct = "Enter a 401(k) percentage from 0 to 100.";
  } else if ((offer.salary * e.employeePct) / 100 > LIMIT_401K + 0.001) {
    errors.employeePct =
      "Lower the percentage to stay within the $24,500 basic annual employee limit.";
  }
  if (e.accountType !== "traditional" && e.accountType !== "roth")
    errors.accountType = "Choose traditional or Roth.";
  else if (e.accountType === "roth" && !offer.retirement.rothAvailable)
    errors.accountType = "This employer does not offer a Roth 401(k).";
  const allowance = hsaAllowance(offer, profile, e.planId);
  if (e.employeeHsa === null || !Number.isFinite(e.employeeHsa) || e.employeeHsa < 0) {
    errors.employeeHsa = "Enter a yearly HSA contribution of zero or more.";
  } else if (e.employeeHsa > allowance) {
    errors.employeeHsa = plan?.hsaEligible
      ? `Enter at most $${allowance.toLocaleString("en-US")} a year after the employer deposit.`
      : "This plan is not HSA-eligible. Set your HSA contribution to zero.";
  }
  if (
    plan &&
    e.employeePct !== null &&
    e.employeeHsa !== null &&
    !Object.keys(errors).length &&
    (offer.salary * e.employeePct) / 100 + plan.premium + e.employeeHsa > offer.salary
  ) {
    errors.deductions =
      "Payroll deductions exceed this salary. Lower the contributions or check the offer details.";
  }
  return errors;
}

export interface MonthlyPlanResult {
  monthlyTakeHome: number;
  medicalFromHsa: number;
  hsaRetained: number;
  monthlyCashMedical: number;
  monthlyRetirement: number;
  retirementRate: number;
  complete: boolean;
  remaining: number | null;
}

export function calculateMonthlyPlan(calc: CalcResult, budget: MonthlyBudget): MonthlyPlanResult {
  const totalHsa = calc.employeeHsa + calc.employerHsa;
  const medicalFromHsa = budget.useHsaForMedical ? Math.min(calc.expectedOutOfPocket, totalHsa) : 0;
  const medicalCash = calc.expectedOutOfPocket - medicalFromHsa;
  const amounts = [budget.livingExpenses, budget.minimumDebtPayments, budget.cashSavings];
  const complete = amounts.every((n) => n !== null && Number.isFinite(n) && n >= 0);
  return {
    monthlyTakeHome: r2(calc.netPay / 12),
    medicalFromHsa: r2(medicalFromHsa),
    hsaRetained: r2(totalHsa - medicalFromHsa),
    monthlyCashMedical: r2(medicalCash / 12),
    monthlyRetirement: r2((calc.employee401k + calc.employerMatch) / 12),
    retirementRate:
      calc.grossPay > 0 ? r2((100 * (calc.employee401k + calc.employerMatch)) / calc.grossPay) : 0,
    complete,
    remaining: complete
      ? r2(
          calc.netPay / 12 -
            medicalCash / 12 -
            budget.livingExpenses! -
            budget.minimumDebtPayments! -
            budget.cashSavings!,
        )
      : null,
  };
}
