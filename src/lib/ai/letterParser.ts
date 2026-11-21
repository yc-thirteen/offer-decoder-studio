/**
 * Deterministic offer-letter parser behind the mock reader. It copies only what a
 * letter states, field by field; anything it can't find comes back "missing" with a
 * directive note, never a guess. It does no math beyond reading a letter's own words
 * (a tier written as "the next 2%" becomes an edge 2 points above the last one,
 * "biweekly" becomes 26 pay periods).
 */
import type { HealthPlan, MatchTier, Offer, StateCode, Vesting } from "@/lib/engine";
import {
  EXTRACT_FIELD_KEYS,
  type ExtractFieldKey,
  type ExtractedField,
  type ExtractedFields,
  type ExtractedOfferValues,
} from "./types";

/** What the UI shows under a field the letter doesn't state (DESIGN.md empty states). */
export const MISSING_NOTES: Record<ExtractFieldKey, string> = {
  employer: "No employer name in this letter. Type it here.",
  city: "No city in this letter. Type it here.",
  state: "No state in this letter. Choose it here.",
  customStateRate: "Only needed for a state not on the list. Type its flat rate here if so.",
  salary: "No salary in this letter. Type it here.",
  payPeriods: "No pay schedule in this letter. Type the paychecks per year here.",
  match: "No 401(k) match in this letter. Add the match tiers here.",
  defaultEmployeePct: "No automatic 401(k) rate in this letter. Type it here.",
  vesting: "No vesting schedule in this letter. Choose it here.",
  rothAvailable: "The letter doesn't say whether Roth 401(k) is offered. Choose it here.",
  healthPlans:
    "The letter doesn't give each plan's premium, deductible, coinsurance, and out-of-pocket maximum. Type them here.",
  defaultPlanId: "The letter doesn't say which plan you get if you elect nothing. Choose it here.",
  lifeBasicMultiple:
    "No company-paid life insurance in this letter. Type the multiple of salary here.",
  lifeSupplementalMaxMultiple:
    "No supplemental life insurance in this letter. Type the most you can buy, or 0.",
};

/** The note on every field when the sample reader doesn't recognize the letter. */
export const UNKNOWN_LETTER_NOTE =
  "The sample reader only reads the three sample letters. Type this in by hand.";

/** Employers of the three sample letters (harness/fixtures/letters). */
export const SAMPLE_EMPLOYERS = ["Northfield Health", "Lakeshore Systems", "Cascade Robotics"];

const missing = <T>(note: string): ExtractedField<T> => ({ source: "missing", value: null, note });
const found = <T>(value: T): ExtractedField<T> => ({ source: "letter", value });

/** Every field missing, each with the same note. */
export function allMissing(note: string = UNKNOWN_LETTER_NOTE): ExtractedFields {
  const out = {} as Record<ExtractFieldKey, ExtractedField<unknown>>;
  for (const k of EXTRACT_FIELD_KEYS) out[k] = missing(note);
  return out as ExtractedFields;
}

/** The sample employer this letter is from, or null. */
export function sampleEmployer(text: string): string | null {
  const lower = text.toLowerCase();
  return SAMPLE_EMPLOYERS.find((e) => lower.includes(e.toLowerCase())) ?? null;
}

/* ---------- small readers ---------- */

/** A number written in the letter; an absent capture reads as NaN, which no caller keeps. */
const num = (s: string | undefined) => Number((s ?? "").replace(/,/g, "") || NaN);
const MONEY = String.raw`\$([\d,]+(?:\.\d+)?)`;

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};
const ENGINE_STATES = new Set<StateCode>([
  "IL",
  "TX",
  "FL",
  "WA",
  "NV",
  "TN",
  "SD",
  "WY",
  "AK",
  "NH",
]);

function toStateCode(token: string | undefined): StateCode | null {
  if (!token) return null;
  const upper = token.toUpperCase();
  const abbr =
    upper in STATE_NAMES
      ? upper
      : Object.keys(STATE_NAMES).find((k) => STATE_NAMES[k]?.toLowerCase() === token.toLowerCase());
  if (!abbr) return null;
  return ENGINE_STATES.has(abbr as StateCode) ? (abbr as StateCode) : "OTHER";
}

function readLocation(text: string): { city: string; state: StateCode } | null {
  const names = Object.values(STATE_NAMES).join("|");
  const abbrs = Object.keys(STATE_NAMES).join("|");
  const re = new RegExp(String.raw`\b((?:[A-Z][a-z]+ )*[A-Z][a-z]+), (${names}|${abbrs})\b`, "g");
  for (const m of text.matchAll(re)) {
    const state = toStateCode(m[2]);
    if (state && m[1]) return { city: m[1], state };
  }
  return null;
}

const PERIOD_WORDS: [RegExp, number][] = [
  [/\b(?:bi-?weekly|every other (?:week|friday|thursday))\b/i, 26],
  [/\b(?:semi-?monthly|twice a month)\b/i, 24],
  [/\bweekly\b/i, 52],
  [/\bmonthly\b/i, 12],
];

function readPayPeriods(text: string): number | null {
  const n = text.match(/\b(\d{1,2}) (?:pay periods|paychecks|pay checks)\b/i);
  if (n) return num(n[1]);
  for (const [re, periods] of PERIOD_WORDS) if (re.test(text)) return periods;
  return null;
}

/** Sentences, splitting on ". " and line breaks; a "W." abbreviation split is harmless here. */
const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);

function readMatch(text: string): MatchTier[] | null {
  for (const s of sentences(text)) {
    if (!/match/i.test(s)) continue;
    const tiers: MatchTier[] = [];
    const re = /(\d+(?:\.\d+)?)%\)?[^%]*?\b(first|up to|next)\s+(\d+(?:\.\d+)?)%/gi;
    for (const m of s.matchAll(re)) {
      const rate = num(m[1]) / 100;
      const width = num(m[3]);
      const prev = tiers.at(-1)?.upToPct ?? 0;
      if (!Number.isFinite(rate) || !Number.isFinite(width)) return null;
      const upToPct = m[2]?.toLowerCase() === "next" ? prev + width : width;
      if (upToPct <= prev) return null;
      tiers.push({ rate, upToPct });
    }
    if (tiers.length) return tiers;
  }
  return null;
}

function readDefaultPct(text: string): number | null {
  if (
    /\b(?:enrollment is not automatic|not (?:be )?automatically enrolled|no automatic enrollment)\b/i.test(
      text,
    )
  )
    return 0;
  const m = text.match(/\bauto(?:matically)?[- ]enrolled\b[^.%]*?(\d+(?:\.\d+)?)%/i);
  return m ? num(m[1]) : null;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

function readVesting(text: string): Vesting | null {
  if (
    /\b(?:fully vested immediately|vest(?:ed|s)? immediately|100% vested from day one|yours immediately)\b/i.test(
      text,
    )
  )
    return { type: "immediate" };
  const cliff = text.match(/\bvests? (?:in full )?after (\w+)(?: \((\d+)\))? years?\b/i);
  if (cliff) {
    const years = cliff[2]
      ? num(cliff[2])
      : (NUMBER_WORDS[(cliff[1] ?? "").toLowerCase()] ?? num(cliff[1]));
    if (Number.isFinite(years) && years > 0) return { type: "cliff", years };
  }
  const graded = text.match(/\bvests? (\d+)% (?:per|each|a) year\b/i);
  if (graded) {
    const step = num(graded[1]);
    if (step > 0 && step <= 100) {
      const schedule = [];
      for (let year = 1, pct = step; ; year++, pct += step) {
        schedule.push({ year, pct: Math.min(pct, 100) });
        if (pct >= 100) break;
      }
      return { type: "graded", schedule };
    }
  }
  return null;
}

function readRoth(text: string): boolean | null {
  if (/\b(?:no roth|roth (?:401\(k\) )?(?:is )?not (?:available|offered))\b/i.test(text))
    return false;
  if (/\broth\b[^.]*?\b(?:available|options?|offered)\b/i.test(text)) return true;
  return null;
}

/* ---------- health plans ---------- */

const PLAN_NAME = /\b(?:PPO|HMO|EPO|POS|HDHP|HSA Plan|High Deductible Plan) ?\d+\b/g;
const LIFE_START = /^\W*life\b/im;

function lineStart(text: string, i: number) {
  return text.lastIndexOf("\n", i) + 1;
}

/** Each named plan and the stretch of text that describes it, from its line to the next plan's line. */
function planSegments(text: string): { name: string; body: string }[] {
  const firsts: { name: string; at: number }[] = [];
  for (const m of text.matchAll(PLAN_NAME)) {
    if (!firsts.some((p) => p.name === m[0])) firsts.push({ name: m[0], at: m.index ?? 0 });
  }
  const segs: { name: string; body: string }[] = [];
  let prevEnd = 0;
  firsts.forEach((p, i) => {
    const start = Math.max(prevEnd, lineStart(text, p.at));
    const nextAt = i + 1 < firsts.length ? lineStart(text, firsts[i + 1]!.at) : text.length;
    const lifeRel = text.slice(p.at).search(LIFE_START);
    const lifeAt = lifeRel < 0 ? text.length : p.at + lifeRel;
    const end = Math.max(p.at + p.name.length, Math.min(nextAt, lifeAt));
    segs.push({ name: p.name, body: text.slice(start, end) });
    prevEnd = end;
  });
  return segs;
}

function firstNumber(body: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = body.match(re);
    if (m) return num(m[1]);
  }
  return null;
}

function readPremium(body: string, payPeriods: number | null): number | null {
  if (/\bcovers the full premium\b/i.test(body)) return 0;
  const paren = body.match(new RegExp(String.raw`per paycheck \(${MONEY} (?:per|a) year\)`, "i"));
  if (paren) return num(paren[1]);
  const yearly = body.match(
    new RegExp(
      String.raw`(?:premium(?: is)?|your cost)[^$]{0,20}${MONEY}\s*(?:per year|a year|/yr|/year)`,
      "i",
    ),
  );
  if (yearly) return num(yearly[1]);
  const perCheck = body.match(new RegExp(String.raw`${MONEY} per paycheck`, "i"));
  if (perCheck && payPeriods) return Math.round(num(perCheck[1]) * payPeriods * 100) / 100;
  return null;
}

function readPlan(
  name: string,
  body: string,
  payPeriods: number | null,
): Omit<HealthPlan, "id"> | null {
  const hsaEligible = /\b(?:HSA|HDHP|high deductible)\b/i.test(name);
  const premium = readPremium(body, payPeriods);
  const deductible = firstNumber(body, [
    new RegExp(String.raw`${MONEY} deductible`, "i"),
    new RegExp(String.raw`deductible(?: of| is)?:? ${MONEY}`, "i"),
  ]);
  const coinsurancePct = firstNumber(body, [
    /(\d+(?:\.\d+)?)% coinsurance/i,
    /coinsurance(?: of| is)?:? (\d+(?:\.\d+)?)%/i,
    /\byou pay (\d+(?:\.\d+)?)%/i,
  ]);
  const oopMax = firstNumber(body, [
    new RegExp(String.raw`${MONEY} out-of-pocket max`, "i"),
    new RegExp(String.raw`out-of-pocket max(?:imum)?(?: of| is)?:? ${MONEY}`, "i"),
  ]);
  const employerHsa = hsaEligible
    ? (firstNumber(body, [
        new RegExp(
          String.raw`(?:deposits|contributes|adds) ${MONEY}(?: per year| a year)? (?:in)?to your (?:HSA|Health Savings Account)`,
          "i",
        ),
      ]) ?? 0)
    : 0;
  if (premium === null || deductible === null || coinsurancePct === null || oopMax === null)
    return null;
  return {
    name,
    hsaEligible,
    premium,
    deductible,
    coinsurance: coinsurancePct / 100,
    oopMax,
    employerHsa,
  };
}

function readHealthPlans(text: string, payPeriods: number | null): HealthPlan[] | null {
  const segs = planSegments(text);
  if (!segs.length) return null;
  const plans: HealthPlan[] = [];
  for (const s of segs) {
    const p = readPlan(s.name, s.body, payPeriods);
    if (!p) return null;
    const base = p.hsaEligible ? "hdhp" : "ppo";
    const taken = plans.filter((q) => q.id === base || q.id.startsWith(`${base}-`)).length;
    plans.push({ id: taken ? `${base}-${taken + 1}` : base, ...p });
  }
  return plans;
}

function readDefaultPlan(text: string, plans: HealthPlan[] | null): string | null {
  if (!plans) return null;
  if (plans.length === 1) return plans[0]!.id;
  const m = text.match(
    /\b(?:do not|don't) (?:make an election|elect a plan|elect|choose)[^.]*?\b(?:enrolled in|get|placed in) (?:the )?([^.,;]+)/i,
  );
  if (!m) return null;
  const named = plans.find((p) => m[1]?.includes(p.name));
  return named?.id ?? null;
}

/* ---------- life ---------- */

function lifeText(text: string): string {
  const i = text.search(/\blife insurance\b|^\W*life\b/im);
  return i < 0 ? "" : text.slice(i);
}

function readLifeBasic(life: string): number | null {
  for (const m of life.matchAll(/(\d+(?:\.\d+)?)x (?:your )?(?:annual |base )?salary/gi)) {
    const before = life.slice(Math.max(0, (m.index ?? 0) - 12), m.index);
    if (!/up to\s*$/i.test(before)) return num(m[1]);
  }
  return null;
}

function readLifeSupplemental(life: string): number | null {
  const m = life.match(/supplemental[^.]*?up to (\d+(?:\.\d+)?)x/i);
  return m ? num(m[1]) : null;
}

/* ---------- entry ---------- */

function field<T>(key: ExtractFieldKey, value: T | null): ExtractedField<T> {
  return value === null ? missing<T>(MISSING_NOTES[key]) : found(value);
}

/**
 * Reads every Offer field the letter states. The employer is the sample employer
 * named in the text (the mock reader only runs on the three sample letters).
 */
export function parseLetter(text: string): ExtractedFields {
  const loc = readLocation(text);
  const salaryMatch = text.match(new RegExp(String.raw`salary[^$]{0,40}${MONEY}`, "i"));
  const payPeriods = readPayPeriods(text);
  const healthPlans = readHealthPlans(text, payPeriods);
  const life = lifeText(text);
  const values: { [K in ExtractFieldKey]: ExtractedOfferValues[K] | null } = {
    employer: sampleEmployer(text),
    city: loc?.city ?? null,
    state: loc?.state ?? null,
    customStateRate: null,
    salary: salaryMatch ? num(salaryMatch[1]) : null,
    payPeriods,
    match: readMatch(text),
    defaultEmployeePct: readDefaultPct(text),
    vesting: readVesting(text),
    rothAvailable: readRoth(text),
    healthPlans,
    defaultPlanId: readDefaultPlan(text, healthPlans),
    lifeBasicMultiple: life ? readLifeBasic(life) : null,
    lifeSupplementalMaxMultiple: life ? readLifeSupplemental(life) : null,
  };
  const out = {} as Record<ExtractFieldKey, ExtractedField<unknown>>;
  for (const k of EXTRACT_FIELD_KEYS) out[k] = field(k, values[k]);
  return out as ExtractedFields;
}

/**
 * The full Offer when every field it needs came from the letter, or null. A custom
 * state rate is needed only when the state is OTHER.
 */
export function fieldsToOffer(fields: ExtractedFields, id: string): Offer | null {
  const v = <K extends ExtractFieldKey>(k: K) => fields[k].value as ExtractedOfferValues[K] | null;
  const state = v("state");
  const needed: ExtractFieldKey[] = EXTRACT_FIELD_KEYS.filter(
    (k) => k !== "customStateRate" || state === "OTHER",
  );
  if (needed.some((k) => fields[k].source !== "letter")) return null;
  const offer: Offer = {
    id,
    employer: v("employer")!,
    city: v("city")!,
    state: state!,
    salary: v("salary")!,
    payPeriods: v("payPeriods")!,
    retirement: {
      match: v("match")!,
      defaultEmployeePct: v("defaultEmployeePct")!,
      vesting: v("vesting")!,
      rothAvailable: v("rothAvailable")!,
    },
    healthPlans: v("healthPlans")!,
    defaultPlanId: v("defaultPlanId")!,
    life: {
      basicMultiple: v("lifeBasicMultiple")!,
      supplementalMaxMultiple: v("lifeSupplementalMaxMultiple")!,
    },
  };
  if (state === "OTHER") offer.customStateRate = v("customStateRate")!;
  return offer;
}
