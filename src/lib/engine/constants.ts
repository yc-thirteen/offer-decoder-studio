/**
 * 2026 constants, taken exactly from harness/FINANCE_SPEC.md (and engine.py).
 * Lecture refs: 4B = Taxes, 7A = Insurance, 7B = Retirement.
 */
import type { CoverageTier, FilingStatus, StateCode } from "./types";

/** [upper edge of bracket, rate]. The last edge is Infinity. */
export type Bracket = readonly [upTo: number, rate: number];

/** Federal brackets (4B slide 7). */
export const BRACKETS: Readonly<Record<FilingStatus, readonly Bracket[]>> = {
  single: [
    [12_400, 0.1],
    [50_400, 0.12],
    [105_700, 0.22],
    [201_775, 0.24],
    [256_225, 0.32],
    [640_600, 0.35],
    [Infinity, 0.37],
  ],
  mfj: [
    [24_800, 0.1],
    [100_800, 0.12],
    [211_400, 0.22],
    [403_550, 0.24],
    [512_450, 0.32],
    [768_700, 0.35],
    [Infinity, 0.37],
  ],
};

/** Standard deduction (4B slide 17). */
export const STD_DEDUCTION: Readonly<Record<FilingStatus, number>> = {
  single: 16_100,
  mfj: 32_200,
};

/** Social Security: 6.2% up to the wage cap (4B slide 6). */
export const SS_RATE = 0.062;
export const SS_WAGE_CAP = 184_500;

/** Medicare: 1.45%, plus 0.9% above the threshold (4B slide 6). */
export const MEDICARE_RATE = 0.0145;
export const ADDL_MEDICARE_RATE = 0.009;
export const ADDL_MEDICARE_THRESHOLD: Readonly<Record<FilingStatus, number>> = {
  single: 200_000,
  mfj: 250_000,
};

/** Employee 401(k) limit (7B slide 33). */
export const LIMIT_401K = 24_500;

/** HSA limit, employee + employer combined (4B slide 47, 7A slide 36). */
export const HSA_LIMIT: Readonly<Record<CoverageTier, number>> = { self: 4_400, family: 8_750 };

/** Retirement savings target, employee + employer, as a share of pay (7B slides 24, 49). */
export const TARGET_SAVINGS_RATE = 0.15;

/** Choose Roth when the federal marginal rate is at most this (7B slide 40). */
export const ROTH_MAX_MARGINAL = 0.12;

/** Tax rate in retirement, applied to traditional 401(k) and match dollars (7B slide 7). */
export const RETIREMENT_TAX_RATE = 0.15;

/** State income tax on wages. OTHER uses the offer's customStateRate. */
export const STATE_RATES: Readonly<Record<Exclude<StateCode, "OTHER">, number>> = {
  IL: 0.0495,
  TX: 0,
  FL: 0,
  WA: 0,
  NV: 0,
  TN: 0,
  SD: 0,
  WY: 0,
  AK: 0,
  NH: 0,
};

/** Life insurance and human capital (7A slides 27–28; reproduces the slide's $1.6M). */
export const LIFE = {
  employerMarkup: 0.2,
  individualMarkup: 1.0,
  riskAversion: 3,
  wageGrowth: 0.05,
  discountRate: 0.1,
  retirementAge: 67,
} as const;

/** Vesting is reported for years 0 through this value. */
export const VESTING_YEARS_SHOWN = 6;
