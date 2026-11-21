/**
 * Edit offer mode, the pure part: an offer as editable text (OfferDraft), and validation
 * that turns a draft back into an engine Offer or lists directive errors by field key.
 * Rates the engine keeps as 0–1 (match rate, coinsurance, custom state rate) are typed
 * as percents. Kept apart from the component so it is testable and fast-refresh safe.
 */
import type { HealthPlan, MatchTier, Offer, StateCode, Vesting } from "@/lib/engine";
import { groupDigits } from "./profileFormat";

export type VestingType = Vesting["type"];

export interface PlanDraft {
  /** The engine plan id; also the React key. */
  id: string;
  name: string;
  hsaEligible: boolean;
  premium: string;
  deductible: string;
  /** Your share after the deductible, in percent. */
  coinsurancePct: string;
  /** The loaded 0–1 value, kept so an untouched field saves exactly (see pctToRate). */
  coinsuranceExact?: number | undefined;
  oopMax: string;
  employerHsa: string;
}

export interface TierDraft {
  key: string;
  /** Employer cents per dollar you put in, as a percent (50 = 50 cents). */
  ratePct: string;
  rateExact?: number | undefined;
  upToPct: string;
}

export interface StepDraft {
  key: string;
  year: string;
  pct: string;
}

export interface OfferDraft {
  id: string;
  employer: string;
  city: string;
  state: StateCode;
  customStatePct: string;
  customStateExact?: number | undefined;
  salary: string;
  payPeriods: string;
  defaultEmployeePct: string;
  rothAvailable: boolean;
  tiers: TierDraft[];
  vestingType: VestingType;
  cliffYears: string;
  steps: StepDraft[];
  plans: PlanDraft[];
  defaultPlanId: string;
  basicMultiple: string;
  supplementalMaxMultiple: string;
}

/** Field key → directive message. Keys: "salary", "plan.<id>.premium", "tier.<key>.upToPct", … */
export type DraftErrors = Record<string, string>;

let counter = 0;
/** A fresh key for a new tier, step, or plan. */
export function newKey(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** 0.07 → "7", 0.125 → "12.5", 4/3 → "133.33": a 0–1 rate as a percent, two decimals at most. */
export function rateToPct(rate: number): string {
  return String(Number((rate * 100).toFixed(2)));
}

/**
 * Typed percent → 0–1 rate. When the text is still exactly what the loaded rate displays
 * as, the loaded rate is kept, so saving an untouched offer never rounds a rate like 4/3.
 */
function pctToRate(text: string, exact: number | undefined, typed: number): number {
  return exact !== undefined && text.trim() === rateToPct(exact) ? exact : typed / 100;
}

function num(n: number): string {
  return String(Number(n.toFixed(4)));
}

export function draftFromOffer(offer: Offer): OfferDraft {
  const v = offer.retirement.vesting;
  return {
    id: offer.id,
    employer: offer.employer,
    city: offer.city,
    state: offer.state,
    customStatePct: offer.customStateRate !== undefined ? rateToPct(offer.customStateRate) : "",
    customStateExact: offer.customStateRate,
    salary: groupDigits(offer.salary),
    payPeriods: String(offer.payPeriods),
    defaultEmployeePct: num(offer.retirement.defaultEmployeePct),
    rothAvailable: offer.retirement.rothAvailable,
    tiers: offer.retirement.match.map((t) => ({
      key: newKey("tier"),
      ratePct: rateToPct(t.rate),
      rateExact: t.rate,
      upToPct: num(t.upToPct),
    })),
    vestingType: v.type,
    cliffYears: v.type === "cliff" ? String(v.years) : "3",
    steps:
      v.type === "graded"
        ? v.schedule.map((s) => ({ key: newKey("step"), year: String(s.year), pct: num(s.pct) }))
        : [],
    plans: offer.healthPlans.map((p) => ({
      id: p.id,
      name: p.name,
      hsaEligible: p.hsaEligible,
      premium: groupDigits(p.premium),
      deductible: groupDigits(p.deductible),
      coinsurancePct: rateToPct(p.coinsurance),
      coinsuranceExact: p.coinsurance,
      oopMax: groupDigits(p.oopMax),
      employerHsa: groupDigits(p.employerHsa),
    })),
    defaultPlanId: offer.defaultPlanId,
    basicMultiple: num(offer.life.basicMultiple),
    supplementalMaxMultiple: num(offer.life.supplementalMaxMultiple),
  };
}

export function blankPlan(): PlanDraft {
  return {
    id: newKey("plan"),
    name: "",
    hsaEligible: false,
    premium: "",
    deductible: "",
    coinsurancePct: "20",
    oopMax: "",
    employerHsa: "0",
  };
}

export function blankTier(): TierDraft {
  return { key: newKey("tier"), ratePct: "100", upToPct: "" };
}

export function blankStep(): StepDraft {
  return { key: newKey("step"), year: "", pct: "" };
}

/** A new offer for an empty stub: everything the letter would say is left blank. */
export function blankDraft(slot: 0 | 1): OfferDraft {
  const plan = blankPlan();
  return {
    id: `offer-${slot + 1}`,
    employer: "",
    city: "",
    state: "IL",
    customStatePct: "",
    salary: "",
    payPeriods: "26",
    defaultEmployeePct: "0",
    rothAvailable: true,
    tiers: [],
    vestingType: "immediate",
    cliffYears: "3",
    steps: [],
    plans: [plan],
    defaultPlanId: plan.id,
    basicMultiple: "1",
    supplementalMaxMultiple: "0",
  };
}

/** "12.5", "12.5%", " 6 " → number; null when it isn't a plain non-negative number. */
export function parseNumber(text: string): number | null {
  const t = text.replace(/[%,\s]/g, "");
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(t)) return null;
  return Number(t);
}

/** "$1,200" → 1200 (rounded to whole dollars); null when not a non-negative amount. */
export function parseMoney(text: string): number | null {
  const n = parseNumber(text.replace(/\$/g, ""));
  return n === null ? null : Math.round(n);
}

function parseWhole(text: string): number | null {
  const n = parseNumber(text);
  return n !== null && Number.isInteger(n) ? n : null;
}

/** Validates a draft. Returns the engine Offer when there are no errors. */
export function validateDraft(d: OfferDraft): { offer: Offer | null; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const check = <T>(key: string, value: T | null, ok: (v: T) => boolean, msg: string) => {
    if (value === null || !ok(value)) {
      errors[key] = msg;
      return null;
    }
    return value;
  };

  const employer = d.employer.trim();
  if (!employer) errors["employer"] = "Type the employer's name.";
  const city = d.city.trim();
  if (!city) errors["city"] = "Type the city, or Remote.";

  const salary = check(
    "salary",
    parseMoney(d.salary),
    (n) => n > 0,
    "Type the yearly salary in dollars.",
  );
  const payPeriods = check(
    "payPeriods",
    parseWhole(d.payPeriods),
    (n) => n >= 1 && n <= 52,
    "Type paychecks a year as a whole number from 1 to 52 (26 is every two weeks).",
  );
  let customStateRate: number | undefined;
  if (d.state === "OTHER") {
    const p = check(
      "customStatePct",
      parseNumber(d.customStatePct),
      (n) => n <= 15,
      "Type the state's flat income tax rate, 0 to 15%.",
    );
    if (p !== null) customStateRate = pctToRate(d.customStatePct, d.customStateExact, p);
  }

  const defaultEmployeePct = check(
    "defaultEmployeePct",
    parseNumber(d.defaultEmployeePct),
    (n) => n <= 100,
    "Type the percent you'd contribute by default, 0 to 100. Use 0 if there is none.",
  );

  const match: MatchTier[] = [];
  let prevUpTo = 0;
  for (const t of d.tiers) {
    const rate = check(
      `tier.${t.key}.ratePct`,
      parseNumber(t.ratePct),
      (n) => n > 0 && n <= 500,
      "Type the match rate as a percent: 100 matches each dollar, 50 matches half.",
    );
    const upTo = check(
      `tier.${t.key}.upToPct`,
      parseNumber(t.upToPct),
      (n) => n > 0 && n <= 100,
      "Type the percent of pay this tier reaches, above 0 and up to 100.",
    );
    if (upTo !== null && upTo <= prevUpTo) {
      errors[`tier.${t.key}.upToPct`] =
        `Each tier must reach a higher percent of pay than the one above it (more than ${num(prevUpTo)}%).`;
    }
    if (upTo !== null) prevUpTo = Math.max(prevUpTo, upTo);
    if (rate !== null && upTo !== null) {
      match.push({ rate: pctToRate(t.ratePct, t.rateExact, rate), upToPct: upTo });
    }
  }

  let vesting: Vesting = { type: "immediate" };
  if (d.vestingType === "cliff") {
    const years = check(
      "cliffYears",
      parseWhole(d.cliffYears),
      (n) => n >= 1 && n <= 10,
      "Type the years until the match vests, a whole number from 1 to 10.",
    );
    if (years !== null) vesting = { type: "cliff", years };
  } else if (d.vestingType === "graded") {
    const schedule: { year: number; pct: number }[] = [];
    let prevYear = -1;
    let prevPct = 0;
    if (d.steps.length === 0)
      errors["steps"] = "Add at least one vesting step, or pick another vesting type.";
    for (const s of d.steps) {
      const year = check(
        `step.${s.key}.year`,
        parseWhole(s.year),
        (n) => n >= 0 && n <= 10,
        "Type the year of service, a whole number from 0 to 10.",
      );
      const pct = check(
        `step.${s.key}.pct`,
        parseNumber(s.pct),
        (n) => n <= 100,
        "Type the vested percent, 0 to 100.",
      );
      if (year !== null && year <= prevYear) {
        errors[`step.${s.key}.year`] =
          "List the steps in order, each a later year than the one above.";
      }
      if (pct !== null && pct < prevPct) {
        errors[`step.${s.key}.pct`] = "The vested percent can't go down in a later year.";
      }
      if (year !== null) prevYear = Math.max(prevYear, year);
      if (pct !== null) prevPct = Math.max(prevPct, pct);
      if (year !== null && pct !== null) schedule.push({ year, pct });
    }
    const last = d.steps[d.steps.length - 1];
    if (last && !errors[`step.${last.key}.pct`] && parseNumber(last.pct) !== 100) {
      errors[`step.${last.key}.pct`] = "The last step must reach 100%.";
    }
    vesting = { type: "graded", schedule };
  }

  const healthPlans: HealthPlan[] = [];
  if (d.plans.length === 0) errors["plans"] = "Add at least one health plan.";
  for (const p of d.plans) {
    const k = (f: string) => `plan.${p.id}.${f}`;
    const name = p.name.trim();
    if (!name) errors[k("name")] = "Type the plan's name, e.g. PPO 500.";
    const premium = check(
      k("premium"),
      parseMoney(p.premium),
      () => true,
      "Type your yearly premium in dollars, or 0.",
    );
    const deductible = check(
      k("deductible"),
      parseMoney(p.deductible),
      () => true,
      "Type the deductible in dollars, or 0.",
    );
    const coins = check(
      k("coinsurancePct"),
      parseNumber(p.coinsurancePct),
      (n) => n <= 100,
      "Type your share after the deductible, 0 to 100%.",
    );
    const oopMax = check(
      k("oopMax"),
      parseMoney(p.oopMax),
      () => true,
      "Type the out-of-pocket max in dollars.",
    );
    if (oopMax !== null && deductible !== null && oopMax < deductible) {
      errors[k("oopMax")] = "The out-of-pocket max can't be below the deductible. Raise it.";
    }
    let employerHsa = 0;
    if (p.hsaEligible) {
      const e = check(
        k("employerHsa"),
        parseMoney(p.employerHsa),
        () => true,
        "Type the employer's HSA deposit in dollars, or 0.",
      );
      if (e !== null) employerHsa = e;
    }
    if (premium !== null && deductible !== null && coins !== null && oopMax !== null) {
      healthPlans.push({
        id: p.id,
        name,
        hsaEligible: p.hsaEligible,
        premium,
        deductible,
        coinsurance: pctToRate(p.coinsurancePct, p.coinsuranceExact, coins),
        oopMax,
        employerHsa,
      });
    }
  }
  if (d.plans.length > 0 && !d.plans.some((p) => p.id === d.defaultPlanId)) {
    errors["defaultPlanId"] = "Choose the plan you get if you elect nothing.";
  }

  const basicMultiple = check(
    "basicMultiple",
    parseNumber(d.basicMultiple),
    (n) => n <= 10,
    "Type the free coverage as a multiple of salary, 0 to 10.",
  );
  const supplementalMaxMultiple = check(
    "supplementalMaxMultiple",
    parseNumber(d.supplementalMaxMultiple),
    (n) => n <= 10,
    "Type the most extra coverage you can buy as a multiple of salary, 0 to 10.",
  );

  if (Object.keys(errors).length > 0) return { offer: null, errors };

  const offer: Offer = {
    id: d.id,
    employer,
    city,
    state: d.state,
    ...(customStateRate !== undefined ? { customStateRate } : {}),
    salary: salary!,
    payPeriods: payPeriods!,
    retirement: {
      match,
      defaultEmployeePct: defaultEmployeePct!,
      vesting,
      rothAvailable: d.rothAvailable,
    },
    healthPlans,
    defaultPlanId: d.defaultPlanId,
    life: { basicMultiple: basicMultiple!, supplementalMaxMultiple: supplementalMaxMultiple! },
  };
  return { offer, errors };
}
