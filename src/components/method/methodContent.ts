/**
 * Data for the Method page (harness/DESIGN.md "/method"). Every number is read from the
 * engine's constants, so the page cannot drift from the math the stubs use.
 */
import {
  ADDL_MEDICARE_RATE,
  ADDL_MEDICARE_THRESHOLD,
  BRACKETS,
  HSA_LIMIT,
  LIFE,
  LIMIT_401K,
  MEDICARE_RATE,
  RETIREMENT_TAX_RATE,
  ROTH_MAX_MARGINAL,
  SS_RATE,
  SS_WAGE_CAP,
  STATE_CODES,
  STATE_TAX,
  STATE_TAX_LEFT_OUT,
  STD_DEDUCTION,
  hasWageIncomeTax,
  TARGET_SAVINGS_RATE,
} from "@/lib/engine";
import { formatMoney } from "@/components/stub/format";
import { STATE_NAMES } from "@/components/decoder/stubFormat";

/** 0.0495 → "4.95%", 0.2 → "20%". */
export function formatRate(rate: number): string {
  return `${Number((rate * 100).toFixed(2))}%`;
}

/** "a, b, and c". */
export function listJoin(items: string[]): string {
  if (items.length <= 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

export const LECTURES = [
  { code: "4B", name: "Taxes" },
  { code: "7A", name: "Insurance" },
  { code: "7B", name: "Retirement" },
] as const;

export type BracketRow = { rate: string; single: string; joint: string };

/** One row per rate: the top of that bracket for each filing status ("over …" for the last). */
export function bracketRows(): BracketRow[] {
  return BRACKETS.single.map(([upTo, rate], i) => {
    const jointUpTo = BRACKETS.mfj[i]![0];
    const top = (edge: number, prev: number | undefined) =>
      Number.isFinite(edge) ? formatMoney(edge) : `over ${formatMoney(prev ?? 0)}`;
    return {
      rate: formatRate(rate),
      single: top(upTo, BRACKETS.single[i - 1]?.[0]),
      joint: top(jointUpTo, BRACKETS.mfj[i - 1]?.[0]),
    };
  });
}

export type ConstantRow = { name: string; value: string; source: string };

const zeroTaxStates = STATE_CODES.filter((code) => !hasWageIncomeTax(code)).map(
  (code) => STATE_NAMES[code],
);

export const ZERO_TAX_STATES = zeroTaxStates;

/** Illinois's flat rate, which the lecture gives (4B). */
export const ILLINOIS_RATE = STATE_TAX.IL.single.brackets[0]![1];

export const CONSTANT_ROWS: ConstantRow[] = [
  {
    name: "Standard deduction",
    value: `${formatMoney(STD_DEDUCTION.single)} single, ${formatMoney(STD_DEDUCTION.mfj)} married filing jointly`,
    source: "Taxes 4B, slide 17",
  },
  {
    name: "Social Security",
    value: `${formatRate(SS_RATE)} of wages up to ${formatMoney(SS_WAGE_CAP)}`,
    source: "Taxes 4B, slide 6",
  },
  {
    name: "Medicare",
    value: `${formatRate(MEDICARE_RATE)} of wages, plus ${formatRate(ADDL_MEDICARE_RATE)} above ${formatMoney(ADDL_MEDICARE_THRESHOLD.single)} single or ${formatMoney(ADDL_MEDICARE_THRESHOLD.mfj)} joint`,
    source: "Taxes 4B, slide 6",
  },
  {
    name: "401(k) limit on your own contributions",
    value: formatMoney(LIMIT_401K),
    source: "Retirement 7B, slide 33",
  },
  {
    name: "HSA limit, yours and the employer's combined",
    value: `${formatMoney(HSA_LIMIT.self)} just you, ${formatMoney(HSA_LIMIT.family)} family`,
    source: "Taxes 4B, slide 47; Insurance 7A, slide 36",
  },
  {
    name: "Retirement savings target",
    value: `${formatRate(TARGET_SAVINGS_RATE)} of pay, yours and the employer's together`,
    source: "Retirement 7B, slides 24 and 49",
  },
  {
    name: "Tax rate in retirement",
    value: formatRate(RETIREMENT_TAX_RATE),
    source: "Retirement 7B, slide 7",
  },
  {
    name: "Roth or traditional",
    value: `Roth when your federal marginal rate is ${formatRate(ROTH_MAX_MARGINAL)} or less`,
    source: "Retirement 7B, slide 40",
  },
  {
    name: "Markup on life insurance",
    value: `${formatRate(LIFE.employerMarkup)} through work, ${formatRate(LIFE.individualMarkup)} on your own`,
    source: "Insurance 7A, slide 28",
  },
  {
    name: "Risk aversion",
    value: String(LIFE.riskAversion),
    source: "Insurance 7A, slide 27",
  },
  {
    name: "Human capital",
    value: `Pay grows ${formatRate(LIFE.wageGrowth)} a year, discounted at ${formatRate(LIFE.discountRate)}, until you retire at ${LIFE.retirementAge}`,
    source: "Insurance 7A, slide 27",
  },
  {
    name: "State income tax on wages",
    value: `Illinois ${formatRate(ILLINOIS_RATE)} flat; 0% in ${listJoin(zeroTaxStates)}; every other state and DC uses its 2026 brackets, standard deduction, and exemptions`,
    source:
      "Illinois: Taxes 4B. Other states: Tax Foundation, 2026 State Income Tax Rates and Brackets (February 2026)",
  },
];

/** DESIGN.md's honest list of what the site simplifies or leaves out. */
export const SIMPLIFICATIONS: string[] = [
  "No head of household filing status. The lectures don't give its standard deduction, so the site offers only single and married filing jointly.",
  STATE_TAX_LEFT_OUT,
  "No local or city income tax, such as New York City's or Maryland's county taxes.",
  "No HSA catch-up contribution for people 55 and older.",
  "No imputed income on group life coverage above $50,000, which shows up as a small taxable amount on real stubs.",
  `Every traditional 401(k) and match dollar is taxed at ${formatRate(RETIREMENT_TAX_RATE)} when you take it out in retirement, whatever your real future rate turns out to be.`,
  "The match is figured once a year on your capped contribution. There is no per-paycheck true-up.",
  "Expected medical spending is one number you choose. The site doesn't model a range of bad years except through the worst case it uses when you have no emergency fund.",
];
