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
  STATE_RATES,
  STD_DEDUCTION,
} from "./constants";
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

/** Flat state rate for an offer. OTHER uses the user's rate (0 if not entered yet). */
export function stateRate(state: StateCode, customStateRate?: number): number {
  return state === "OTHER" ? (customStateRate ?? 0) : STATE_RATES[state];
}

/** State tax = flat rate × federal wages (ignores state exemptions and credits). */
export function stateIncomeTax(
  federalWages: number,
  state: StateCode,
  customStateRate?: number,
): number {
  return stateRate(state, customStateRate) * federalWages;
}
