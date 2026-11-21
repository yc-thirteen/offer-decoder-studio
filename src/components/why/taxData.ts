/**
 * Data for "Marginal vs average tax" (harness/DESIGN.md "Why these elections", Lecture 4B):
 * the federal brackets as steps, the household's taxable income under the elections on the
 * stubs, the tax in each bracket, and the sentences that state the conclusion. Pure: every
 * number comes from the engine's tax functions and CalcResult; this module only arranges it.
 */
import { formatMoney } from "@/components/stub";
import { pct } from "@/components/decoder/stubFormat";
import {
  BRACKETS,
  STD_DEDUCTION,
  incomeTax,
  marginalRate,
  taxableIncome,
  type CalcResult,
  type Profile,
} from "@/lib/engine";
import { niceTicks } from "./chartKit";

export interface TaxStep {
  /** Bracket floor and ceiling in taxable dollars (the ceiling is Infinity for the top bracket). */
  lo: number;
  hi: number;
  /** 0–1. */
  rate: number;
  /** Taxable dollars that fall inside this bracket, and the tax on them. */
  taxed: number;
  tax: number;
  /** The bracket your last taxable dollar falls in. */
  yours: boolean;
}

export interface TaxRow {
  label: string;
  amount: number;
}

export interface TaxChartData {
  /** Federal wages for this job: salary minus traditional 401(k), premium, and employee HSA. */
  federalWages: number;
  /** Spouse's wages counted on a joint return (0 when single). */
  spouseWages: number;
  deduction: number;
  /** Household taxable income with this job. */
  taxable: number;
  /** The brackets drawn on the chart: every one that starts below xMax. */
  steps: TaxStep[];
  xMax: number;
  /** Household marginal rate, 0–1 (the engine's federalMarginalRate). */
  marginalRate: number;
  /** The engine's federal tax on this job ÷ salary, in percent. */
  averagePct: number;
  /** The engine's federal income tax on this job. */
  jobTax: number;
  sentence: string;
  raiseSentence: string;
  /** From wages to taxable income. */
  incomeRows: TaxRow[];
  /** Tax in each bracket that holds some of your income. */
  bracketRows: TaxRow[];
  /** Rows between the bracket rows and the total (joint filers with a working spouse). */
  spouseRows: TaxRow[];
  total: TaxRow;
}

function money(n: number): string {
  return formatMoney(n);
}

/** "10% on the first $12,400", "22% on $50,400 to $105,700", "24% on $105,700 to $117,000". */
function bracketLabel(step: TaxStep, taxable: number): string {
  const rate = pct(step.rate * 100);
  if (step.lo === 0) return `${rate} on the first ${money(Math.min(step.hi, taxable))}`;
  return `${rate} on ${money(step.lo)} to ${money(Math.min(step.hi, taxable))}`;
}

/** The chart's right edge: past your income and into the next bracket, ending on a round tick. */
function windowEnd(taxable: number, edges: readonly number[], own: number, count: number): number {
  const ownHi = edges[own] ?? Infinity;
  const nextHi = edges[own + 1] ?? Infinity;
  const base = Number.isFinite(ownHi) ? ownHi : taxable;
  const end = Math.max(Math.min(nextHi, base * 1.5), taxable * 1.15, 20_000);
  const ticks = niceTicks(0, end, count);
  return ticks[ticks.length - 1] ?? end;
}

export function taxChartData(
  calc: CalcResult,
  profile: Profile,
  { tickCount = 4 }: { tickCount?: number } = {},
): TaxChartData {
  const status = profile.filingStatus;
  const joint = status === "mfj";
  const spouseWages = joint ? (profile.otherHouseholdWages ?? 0) : 0;
  const federalWages = calc.grossPay - calc.traditional401k - calc.healthPremium - calc.employeeHsa;
  const deduction = STD_DEDUCTION[status];
  const taxable = taxableIncome(federalWages + spouseWages, status);
  const brackets = BRACKETS[status];
  const edges = brackets.map(([hi]) => hi);
  const rate = marginalRate(taxable, status);
  const own = Math.max(
    0,
    brackets.findIndex(([hi]) => taxable <= hi),
  );
  const xMax = windowEnd(taxable, edges, own, tickCount);

  const steps: TaxStep[] = [];
  let lo = 0;
  brackets.forEach(([hi, r], i) => {
    if (lo < xMax) {
      const taxed = Math.max(0, Math.min(taxable, hi) - lo);
      steps.push({ lo, hi, rate: r, taxed, tax: taxed * r, yours: i === own });
    }
    lo = hi;
  });

  const ownStep = steps.find((s) => s.yours)!;
  const marginal = pct(rate * 100);
  const average = pct(calc.federalAverageRateOnJob);
  const whose = joint && spouseWages > 0 ? "your household's" : "your";
  const jobTax = calc.federalIncomeTax;

  let sentence: string;
  if (taxable <= 0) {
    sentence = `Your pay is under the ${money(deduction)} standard deduction, so this job owes no federal income tax.`;
  } else if (ownStep.lo === 0) {
    sentence =
      `All of ${whose} taxable income, ${money(taxable)}, is in the lowest bracket, ${marginal}, ` +
      `so the federal tax on this job is ${money(jobTax)}, ${average} of your pay.`;
  } else {
    sentence =
      `Only the part of ${whose} taxable income above ${money(ownStep.lo)} is taxed at ${marginal}. ` +
      `Everything below it keeps the lower rates, so the federal tax on this job is ` +
      `${money(jobTax)}, an average of ${average} of your pay.`;
  }
  const raiseSentence =
    `A raise is taxed only on the new dollars: another $1,000 of pay adds about ` +
    `${money(rate * 1000)} of federal tax, and the rest of your income keeps its rates.`;

  const incomeRows: TaxRow[] = [{ label: "Wages after pre-tax deductions", amount: federalWages }];
  if (spouseWages > 0) incomeRows.push({ label: "Spouse's wages", amount: spouseWages });
  incomeRows.push({ label: "Standard deduction", amount: -deduction });

  const bracketRows = steps
    .filter((s) => s.taxed > 0)
    .map((s) => ({ label: bracketLabel(s, taxable), amount: s.tax }));

  const spouseRows: TaxRow[] = [];
  if (spouseWages > 0) {
    const householdTax = incomeTax(taxable, status);
    spouseRows.push(
      { label: "Household federal income tax", amount: householdTax },
      {
        label: "Tax on your spouse's wages alone",
        amount: -incomeTax(taxableIncome(spouseWages, status), status),
      },
    );
  }

  return {
    federalWages,
    spouseWages,
    deduction,
    taxable,
    steps,
    xMax,
    marginalRate: rate,
    averagePct: calc.federalAverageRateOnJob,
    jobTax,
    sentence,
    raiseSentence,
    incomeRows,
    bracketRows,
    spouseRows,
    total: { label: "Federal income tax on this job", amount: jobTax },
  };
}
