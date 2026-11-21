/**
 * Taxes (Lecture 4B). Pure functions, unrounded; calculate.ts rounds for display.
 * Mirrors income_tax / marginal_rate and the tax lines of calculate() in
 * harness/reference/engine.py.
 */
import {
  ADDL_MEDICARE_RATE,
  ADDL_MEDICARE_THRESHOLD,
  BRACKETS,
  MEDICARE_RATE,
  SS_RATE,
  SS_WAGE_CAP,
  STD_DEDUCTION,
} from "./constants";
import { STATE_TAX, stateTaxOnIncome } from "./stateTax";
import type { FilingStatus, StateCode } from "./types";

/** Federal income tax on taxable income, walking the brackets (4B slides 7–11). */
export function incomeTax(taxable: number, status: FilingStatus): number {
  let tax = 0;
  let lo = 0;
  for (const [hi, rate] of BRACKETS[status]) {
    if (taxable > lo) tax += (Math.min(taxable, hi) - lo) * rate;
    lo = hi;
  }
  return tax;
}

/** Rate of the bracket that taxable income falls in (an edge belongs to the lower bracket). */
export function marginalRate(taxable: number, status: FilingStatus): number {
  for (const [hi, rate] of BRACKETS[status]) {
    if (taxable <= hi) return rate;
  }
  return 0.37;
}

/** Taxable income: wages minus the standard deduction, floored at 0 (4B slide 17). */
export function taxableIncome(wages: number, status: FilingStatus): number {
  return Math.max(0, wages - STD_DEDUCTION[status]);
}

/**
 * Federal income tax attributed to this job by the marginal method: what the job adds
 * to the household bill. `otherWages` is the spouse's wages (pass 0 when single).
 */
export function federalTaxOnJob(
  federalWages: number,
  otherWages: number,
  status: FilingStatus,
): number {
  return (
    incomeTax(taxableIncome(federalWages + otherWages, status), status) -
    incomeTax(taxableIncome(otherWages, status), status)
  );
}

/** Household federal marginal rate with this job included. */
export function federalMarginalRate(
  federalWages: number,
  otherWages: number,
  status: FilingStatus,
): number {
  return marginalRate(taxableIncome(federalWages + otherWages, status), status);
}

/** Social Security: 6.2% of payroll wages up to the wage cap (4B slide 6). */
export function socialSecurityTax(payrollWages: number): number {
  return SS_RATE * Math.min(payrollWages, SS_WAGE_CAP);
}

/**
 * Medicare: 1.45% of payroll wages, plus the 0.9% surtax on the part of household
 * wages above the threshold that this job adds (4B slide 6).
 */
export function medicareTax(
  payrollWages: number,
  otherWages: number,
  status: FilingStatus,
): number {
  const th = ADDL_MEDICARE_THRESHOLD[status];
  const addl = Math.max(0, payrollWages + otherWages - th) - Math.max(0, otherWages - th);
  return MEDICARE_RATE * payrollWages + ADDL_MEDICARE_RATE * addl;
}

/** What the state counts as wages: federal wages, plus any pre-tax dollars it doesn't exclude. */
export function stateWages(
  state: StateCode,
  federalWages: number,
  traditional401k: number,
  employeeHsa: number,
): number {
  if (state === "OTHER") return federalWages;
  const rule = STATE_TAX[state];
  return federalWages + (rule.taxes401k ? traditional401k : 0) + (rule.taxesHsa ? employeeHsa : 0);
}

/**
 * State income tax attributed to this job, by the same marginal method as federal tax:
 * tax(this job's state wages + spouse wages) − tax(spouse wages), with 2026 brackets,
 * deductions, and exemptions (stateTax.ts). OTHER is the entered flat rate × wages.
 */
export function stateIncomeTax(
  wages: number,
  otherWages: number,
  status: FilingStatus,
  state: StateCode,
  customStateRate?: number,
): number {
  if (state === "OTHER") return (customStateRate ?? 0) * wages;
  const other = Math.max(0, otherWages);
  return stateTaxOnIncome(state, status, wages + other) - stateTaxOnIncome(state, status, other);
}
