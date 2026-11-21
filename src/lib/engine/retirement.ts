/**
 * Retirement: employer match and vesting (Lecture 7B). Pure functions, unrounded.
 * Mirrors match_cap_pct / employer_match / max_match_pct / vested_pct in
 * harness/reference/engine.py.
 */
import { LIMIT_401K } from "./constants";
import type { Offer, Vesting } from "./types";

/** Years of service reported on the vesting timeline (0–6). */
export const VESTING_YEARS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Tiers sorted by their upper edge, so bands are cumulative from 0% of pay. */
function sortedTiers(offer: Offer) {
  return [...offer.retirement.match].sort((a, b) => a.upToPct - b.upToPct);
}

/**
 * Percent of salary you must put in to get the whole match: the highest tier edge.
 * 0 when the offer has no match.
 */
export function matchCapPct(offer: Offer): number {
  const tiers = offer.retirement.match;
  return tiers.length === 0 ? 0 : Math.max(...tiers.map((t) => t.upToPct));
}

/** Employee 401(k) dollars for a percent of salary, capped at the 24,500 limit. */
export function employee401kDollars(offer: Offer, employeePct: number): number {
  return Math.min((offer.salary * employeePct) / 100, LIMIT_401K);
}

/** True when the percent asks for more than the 24,500 limit (strictly above, as engine.py). */
export function hitsLimit401k(offer: Offer, employeePct: number): boolean {
  return (offer.salary * employeePct) / 100 > LIMIT_401K;
}

/**
 * Employer match dollars on the employee's actual (already capped) contribution.
 * Tiers are cumulative bands of pay: [{rate:1, upToPct:3}, {rate:0.5, upToPct:5}]
 * means 100% on the first 3% of pay and 50% on the next 2%.
 */
export function employerMatch(offer: Offer, employeeDollars: number): number {
  const sal = offer.salary;
  if (sal <= 0) return 0;
  const pct = (100 * employeeDollars) / sal;
  let prev = 0;
  let m = 0;
  for (const t of sortedTiers(offer)) {
    const band = Math.max(0, Math.min(pct, t.upToPct) - prev);
    m += (t.rate * band * sal) / 100;
    prev = t.upToPct;
  }
  return m;
}

/** The whole match, in dollars: the match when you contribute exactly the cap %. */
export function fullMatchDollars(offer: Offer): number {
  return employerMatch(offer, (offer.salary * matchCapPct(offer)) / 100);
}

/** The whole match as a percent of salary (e.g. 4 for 100% of 3% + 50% of the next 2%). */
export function maxMatchPct(offer: Offer): number {
  if (offer.salary <= 0) return 0;
  return (100 * fullMatchDollars(offer)) / offer.salary;
}

/** Vested percent (0–100) of employer money after `years` of service. */
export function vestedPct(vesting: Vesting, years: number): number {
  switch (vesting.type) {
    case "immediate":
      return 100;
    case "cliff":
      return years >= vesting.years ? 100 : 0;
    case "graded": {
      let v = 0;
      for (const step of vesting.schedule) {
        if (years >= step.year) v = step.pct;
      }
      return v;
    }
  }
}

/** Vested percent at years 0–6, for the vesting timeline. */
export function vestedPctByYear(vesting: Vesting): number[] {
  return VESTING_YEARS.map((y) => vestedPct(vesting, y));
}
