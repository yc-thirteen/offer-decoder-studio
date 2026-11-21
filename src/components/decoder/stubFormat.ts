/**
 * Words for the stub (harness/DESIGN.md "Stub line items"). Pure helpers: they turn engine
 * facts into labels and notes and compute nothing financial.
 */
import {
  LIMIT_401K,
  STATE_CODES,
  STATE_TAX,
  hasWageIncomeTax,
  type AccountType,
  type TaxedState,
  type Offer,
  type StateCode,
  type Vesting,
} from "@/lib/engine";
import { formatMoney } from "@/components/stub";

/** "California" for CA, for every built-in state (stateTax.ts holds the names). */
export const STATE_NAMES: Readonly<Record<TaxedState, string>> = Object.fromEntries(
  STATE_CODES.map((code) => [code, STATE_TAX[code].name]),
) as Record<TaxedState, string>;

/** "Chicago, IL"; an OTHER-state offer shows just its city ("Remote"). */
export function placeText(offer: Pick<Offer, "city" | "state">): string {
  return offer.state === "OTHER" ? offer.city : `${offer.city}, ${offer.state}`;
}

/**
 * The state tax row label. A state with no wage income tax reads "Texas has no state income
 * tax"; any other state reads "Illinois income tax", even when its deductions bring this
 * offer's tax to $0; a custom-rate state reads "State income tax".
 */
export function stateTaxRowLabel(
  offer: Pick<Offer, "state" | "customStateRate">,
  stateTax: number,
): string {
  if (offer.state === "OTHER") return stateTax > 0 ? "State income tax" : "No state income tax";
  const name = STATE_NAMES[offer.state];
  return hasWageIncomeTax(offer.state) ? `${name} income tax` : `${name} has no state income tax`;
}

/** "Flat 5% on wages" note for a custom-rate state, else null. */
export function stateTaxNote(offer: Pick<Offer, "state" | "customStateRate">): string | null {
  if (offer.state !== "OTHER" || !offer.customStateRate) return null;
  return `A flat ${pct(offer.customStateRate * 100)} on wages, the rate entered for this offer.`;
}

/** Percent with at most one decimal and no trailing ".0": 15.39 → "15.4%", 24 → "24%". */
export function pct(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}

export function accountLabel(type: AccountType): string {
  return type === "roth" ? "Roth" : "traditional";
}

export function federalNote(marginalRate: number, averageRatePct: number): string {
  return `Federal marginal rate ${pct(marginalRate * 100)}, average ${pct(averageRatePct)}`;
}

export function limitNote(): string {
  return `Capped at the ${formatMoney(LIMIT_401K)} limit`;
}

function years(n: number): string {
  return n === 1 ? "1 year" : `${n} years`;
}

/** The note under the 401(k) match row. */
export function vestingNote(vesting: Vesting): string {
  switch (vesting.type) {
    case "immediate":
      return "The match is yours from day one.";
    case "cliff":
      return `Match vests after ${years(vesting.years)}. Leave sooner and you forfeit it.`;
    case "graded": {
      const steps = [...vesting.schedule].sort((a, b) => a.year - b.year);
      const first = steps[0];
      const full = steps.find((s) => s.pct >= 100);
      if (!first) return "The match is yours from day one.";
      const start = `Match vests ${first.pct}% after ${years(first.year)}`;
      const end = full && full !== first ? `, fully after ${years(full.year)}` : "";
      return `${start}${end}. Leave sooner and you forfeit the unvested part.`;
    }
  }
}
