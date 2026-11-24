/**
 * Upload documents, the pure part: an ExtractResult becomes an editable OfferDraft plus
 * marks for the review state (harness/DESIGN.md "AI elements"). Fields the letter stated
 * carry a "from documents" mark until you edit them or save; fields it didn't state stay blank
 * (never guessed) and carry the reader's note on what is missing. Mark keys are the same
 * draft field keys the editor's validation errors use ("salary", "plan.<id>.premium", …),
 * plus the section keys "tiers" and "plans".
 */
import type { ExtractedFields } from "@/lib/ai";
import { groupDigits } from "./profileFormat";
import {
  blankPlan,
  num,
  planDrafts,
  rateToPct,
  tierDrafts,
  vestingDraft,
  type OfferDraft,
} from "./offerDraft";

export interface LetterMarks {
  /** Draft field keys whose value came from the letter. */
  fromLetter: ReadonlySet<string>;
  /** Draft field or section key → what the letter is missing. "" underlines without a note. */
  missing: Readonly<Record<string, string>>;
}

export interface LetterReview {
  draft: OfferDraft;
  marks: LetterMarks;
}

export const NO_MARKS: LetterMarks = { fromLetter: new Set(), missing: {} };

/** Plan fields a missing plan list leaves blank and underlined. */
const PLAN_FIELDS = ["name", "premium", "deductible", "coinsurancePct", "oopMax"] as const;

/**
 * The review draft for one stub, or null when the letter stated nothing at all (the
 * reader couldn't read it), so the panel can say so instead of opening a blank form.
 */
export function draftFromLetter(fields: ExtractedFields, slot: 0 | 1): LetterReview | null {
  if (!Object.values(fields).some((f) => f.source === "letter")) return null;

  const fromLetter = new Set<string>();
  const missing: Record<string, string> = {};
  /** The letter's value (marking the draft key), or the fallback with the missing note. */
  const take = <T, D>(
    field: { source: "letter"; value: T } | { source: "missing"; value: null; note: string },
    key: string,
    toDraft: (v: T) => D,
    blank: D,
  ): D => {
    if (field.source === "letter") {
      fromLetter.add(key);
      return toDraft(field.value);
    }
    missing[key] = field.note;
    return blank;
  };
  const text = (v: string) => v;

  const state = take(fields.state, "state", (v): OfferDraft["state"] => v, "");
  let customStatePct = "";
  let customStateExact: number | undefined;
  if (state === "OTHER") {
    customStatePct = take(fields.customStateRate, "customStatePct", rateToPct, "");
    if (fields.customStateRate.source === "letter") customStateExact = fields.customStateRate.value;
  }

  const tiers = take(fields.match, "tiers", tierDrafts, []);
  if (fields.match.source === "letter") {
    fromLetter.delete("tiers");
    for (const t of tiers) {
      fromLetter.add(`tier.${t.key}.ratePct`);
      fromLetter.add(`tier.${t.key}.upToPct`);
    }
  }

  const vesting = take(fields.vesting, "vestingType", vestingDraft, {
    vestingType: "" as const,
    cliffYears: "3",
    steps: [],
  });
  if (vesting.vestingType === "cliff") fromLetter.add("cliffYears");
  for (const s of vesting.steps) {
    fromLetter.add(`step.${s.key}.year`);
    fromLetter.add(`step.${s.key}.pct`);
  }

  let plans = take(fields.healthPlans, "plans", planDrafts, []);
  if (fields.healthPlans.source === "letter") {
    fromLetter.delete("plans");
    for (const p of plans) {
      for (const f of [...PLAN_FIELDS, "hsaEligible"]) fromLetter.add(`plan.${p.id}.${f}`);
      if (p.hsaEligible) fromLetter.add(`plan.${p.id}.employerHsa`);
    }
  } else {
    // One blank plan to type into. Coinsurance is blank too: 20% would be a guess.
    const plan = { ...blankPlan(), coinsurancePct: "" };
    plans = [plan];
    for (const f of PLAN_FIELDS) missing[`plan.${plan.id}.${f}`] = "";
  }

  const draft: OfferDraft = {
    id: `offer-${slot + 1}`,
    employer: take(fields.employer, "employer", text, ""),
    city: take(fields.city, "city", text, ""),
    state,
    customStatePct,
    ...(customStateExact !== undefined ? { customStateExact } : {}),
    salary: take(fields.salary, "salary", groupDigits, ""),
    payPeriods: take(fields.payPeriods, "payPeriods", String, ""),
    defaultEmployeePct: take(fields.defaultEmployeePct, "defaultEmployeePct", num, ""),
    rothAvailable: take(fields.rothAvailable, "rothAvailable", (v: boolean) => v, null),
    tiers,
    ...vesting,
    plans,
    defaultPlanId: take(fields.defaultPlanId, "defaultPlanId", text, ""),
    basicMultiple: take(fields.lifeBasicMultiple, "basicMultiple", num, ""),
    supplementalMaxMultiple: take(
      fields.lifeSupplementalMaxMultiple,
      "supplementalMaxMultiple",
      num,
      "",
    ),
  };
  return { draft, marks: { fromLetter, missing } };
}

/** The marks once a field is edited: its own marks go, and so does its section's note. */
export function touchMarks(marks: LetterMarks, key: string): LetterMarks {
  const section = key.startsWith("tier.") ? "tiers" : key.startsWith("plan.") ? "plans" : null;
  if (
    !marks.fromLetter.has(key) &&
    !(key in marks.missing) &&
    !(section && section in marks.missing)
  )
    return marks;
  const fromLetter = new Set(marks.fromLetter);
  fromLetter.delete(key);
  const missing = { ...marks.missing };
  delete missing[key];
  if (section) delete missing[section];
  return { fromLetter, missing };
}

/** How many fields the letter filled, and how many notes say something is missing. */
export function markCounts(marks: LetterMarks): { filled: number; missing: number } {
  return {
    filled: marks.fromLetter.size,
    missing: Object.values(marks.missing).filter((note) => note !== "").length,
  };
}
