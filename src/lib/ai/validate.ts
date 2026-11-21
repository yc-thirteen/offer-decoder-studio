/**
 * Shape checks for what the edge functions send back. A response that isn't an
 * object of the expected shape is rejected outright. Inside a well-formed extract
 * result, a "letter" field whose value has the wrong type is downgraded to
 * "missing" with the usual directive note, so a malformed value is never shown as
 * if the letter stated it, and the rest of the letter is still usable.
 */
import { STATE_RATES, type HealthPlan, type MatchTier, type Vesting } from "@/lib/engine";
import { MISSING_NOTES } from "./letterParser";
import {
  EXTRACT_FIELD_KEYS,
  type ExtractFieldKey,
  type ExtractResult,
  type ExtractedField,
  type ExtractedFields,
  type ExplainResult,
} from "./types";

/** The property names these checks read, so access stays dot-style under strict TS. */
type Key =
  | ExtractFieldKey
  | "fields"
  | "source"
  | "value"
  | "note"
  | "summary"
  | "error"
  | "rate"
  | "upToPct"
  | "type"
  | "years"
  | "schedule"
  | "year"
  | "pct"
  | "id"
  | "name"
  | "hsaEligible"
  | "premium"
  | "deductible"
  | "coinsurance"
  | "oopMax"
  | "employerHsa";
type Rec = Partial<Record<Key, unknown>>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const nonNeg = (v: unknown): v is number => isNum(v) && v >= 0;
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isRate = (v: unknown): v is number => isNum(v) && v >= 0 && v <= 1;

const STATES = new Set<string>([...Object.keys(STATE_RATES), "OTHER"]);

function isMatchTier(v: unknown): v is MatchTier {
  return isRec(v) && nonNeg(v.rate) && isNum(v.upToPct) && v.upToPct > 0 && v.upToPct <= 100;
}

function isVesting(v: unknown): v is Vesting {
  if (!isRec(v)) return false;
  if (v.type === "immediate") return true;
  if (v.type === "cliff") return nonNeg(v.years);
  if (v.type === "graded") {
    return (
      Array.isArray(v.schedule) &&
      v.schedule.length > 0 &&
      v.schedule.every((s) => isRec(s) && nonNeg(s.year) && nonNeg(s.pct) && s.pct <= 100)
    );
  }
  return false;
}

function isHealthPlan(v: unknown): v is HealthPlan {
  return (
    isRec(v) &&
    isText(v.id) &&
    isText(v.name) &&
    typeof v.hsaEligible === "boolean" &&
    nonNeg(v.premium) &&
    nonNeg(v.deductible) &&
    isRate(v.coinsurance) &&
    nonNeg(v.oopMax) &&
    nonNeg(v.employerHsa)
  );
}

const CHECKS: Record<ExtractFieldKey, (v: unknown) => boolean> = {
  employer: isText,
  city: isText,
  state: (v) => typeof v === "string" && STATES.has(v),
  customStateRate: isRate,
  salary: (v) => isNum(v) && v > 0,
  payPeriods: (v) => Number.isInteger(v) && (v as number) > 0 && (v as number) <= 52,
  match: (v) => Array.isArray(v) && v.every(isMatchTier),
  defaultEmployeePct: (v) => nonNeg(v) && v <= 100,
  vesting: isVesting,
  rothAvailable: (v) => typeof v === "boolean",
  healthPlans: (v) => Array.isArray(v) && v.length > 0 && v.every(isHealthPlan),
  defaultPlanId: isText,
  lifeBasicMultiple: nonNeg,
  lifeSupplementalMaxMultiple: nonNeg,
};

function checkField(key: ExtractFieldKey, raw: unknown): ExtractedField<unknown> | null {
  if (!isRec(raw)) return null;
  if (raw.source === "missing") {
    const note = isText(raw.note) ? raw.note.trim() : MISSING_NOTES[key];
    return { source: "missing", value: null, note };
  }
  if (raw.source === "letter") {
    return CHECKS[key](raw.value)
      ? { source: "letter", value: raw.value }
      : { source: "missing", value: null, note: MISSING_NOTES[key] };
  }
  return null;
}

/** The extract result, or null when the body isn't {fields: {...every key...}}. */
export function validateExtractResult(body: unknown): ExtractResult | null {
  if (!isRec(body) || !isRec(body.fields)) return null;
  const fields = {} as Record<ExtractFieldKey, ExtractedField<unknown>>;
  for (const key of EXTRACT_FIELD_KEYS) {
    const f = checkField(key, body.fields[key]);
    if (!f) return null;
    fields[key] = f;
  }
  // The default plan must be one of the letter's plans; otherwise it isn't stated.
  const plans = fields.healthPlans;
  const def = fields.defaultPlanId;
  if (
    def.source === "letter" &&
    plans.source === "letter" &&
    !(plans.value as HealthPlan[]).some((p) => p.id === def.value)
  ) {
    fields.defaultPlanId = { source: "missing", value: null, note: MISSING_NOTES.defaultPlanId };
  }
  return { fields: fields as ExtractedFields };
}

/** The explain result, or null when the body has no non-empty summary string. */
export function validateExplainResult(body: unknown): ExplainResult | null {
  if (!isRec(body) || !isText(body.summary)) return null;
  return { summary: body.summary.trim() };
}

/** The `error` string an edge function sent with a failing status, if usable. */
export function serverErrorMessage(body: unknown): string | null {
  if (!isRec(body) || !isText(body.error)) return null;
  const msg = body.error.trim();
  return msg.length <= 240 ? msg : null;
}
