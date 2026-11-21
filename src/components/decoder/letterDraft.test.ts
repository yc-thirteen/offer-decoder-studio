import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import extractions from "@/data/letters/expected-extractions.json";
import { EXTRACT_FIELD_KEYS, MISSING_NOTES, parseLetter, type ExtractedFields } from "@/lib/ai";
import { allMissing } from "@/lib/ai/letterParser";
import { SAMPLE_CASES } from "@/state/decoderState";
import { draftFromLetter, markCounts, touchMarks } from "./letterDraft";
import { validateDraft } from "./offerDraft";

const letterText = (file: string) =>
  readFileSync(path.resolve(__dirname, "../../data/letters", file), "utf8");

const fixtureOffer = (caseId: string, offerId: string) => {
  const o = SAMPLE_CASES.find((c) => c.id === caseId)?.offers.find((x) => x.id === offerId);
  if (!o) throw new Error(`no fixture offer ${caseId}/${offerId}`);
  return o;
};

/** The northfield letter's fields with some of them missing (house notes, as the clients send). */
function withMissing(...keys: (keyof ExtractedFields)[]): ExtractedFields {
  const fields = { ...parseLetter(letterText("northfield.txt")) };
  for (const k of keys) {
    (fields as Record<string, unknown>)[k] = {
      source: "missing",
      value: null,
      note: MISSING_NOTES[k],
    };
  }
  return fields;
}

describe("draftFromLetter", () => {
  it.each(extractions.letters)(
    "$file becomes a draft that saves as fixture offer $offerId",
    (l) => {
      const review = draftFromLetter(parseLetter(letterText(l.file)), 1);
      expect(review).not.toBeNull();
      const { offer, errors } = validateDraft(review!.draft);
      expect(errors).toEqual({});
      expect(offer).toEqual({ ...fixtureOffer(l.caseId, l.offerId), id: "offer-2" });
      // Every field came from the letter; nothing is flagged missing.
      expect(markCounts(review!.marks).missing).toBe(0);
      for (const key of ["employer", "city", "state", "salary", "payPeriods", "rothAvailable"]) {
        expect(review!.marks.fromLetter.has(key)).toBe(true);
      }
      const planId = review!.draft.plans[0]!.id;
      expect(review!.marks.fromLetter.has(`plan.${planId}.premium`)).toBe(true);
      expect(review!.marks.missing).toEqual({});
    },
  );

  it("returns null when the letter stated nothing, so no blank form opens", () => {
    expect(draftFromLetter(allMissing(), 0)).toBeNull();
  });

  it("leaves missing fields blank with the reader's note, never a guess", () => {
    const review = draftFromLetter(
      withMissing("salary", "payPeriods", "state", "rothAvailable", "vesting"),
      0,
    )!;
    const d = review.draft;
    expect(d.id).toBe("offer-1");
    expect(d.salary).toBe("");
    expect(d.payPeriods).toBe("");
    expect(d.state).toBe("");
    expect(d.rothAvailable).toBeNull();
    expect(d.vestingType).toBe("");
    expect(review.marks.missing["salary"]).toBe("No salary in this letter. Type it here.");
    expect(review.marks.missing["vestingType"]).toBe(MISSING_NOTES.vesting);
    expect(review.marks.fromLetter.has("salary")).toBe(false);
    expect(review.marks.fromLetter.has("employer")).toBe(true);
    expect(markCounts(review.marks).missing).toBe(5);

    const { offer, errors } = validateDraft(d);
    expect(offer).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(
      ["payPeriods", "rothAvailable", "salary", "state", "vestingType"].sort(),
    );
  });

  it("gives missing plans one blank plan to type into, with no guessed coinsurance", () => {
    const review = draftFromLetter(withMissing("healthPlans", "defaultPlanId", "match"), 0)!;
    const [plan] = review.draft.plans;
    expect(review.draft.plans).toHaveLength(1);
    expect(plan!.coinsurancePct).toBe("");
    expect(plan!.premium).toBe("");
    expect(review.draft.defaultPlanId).toBe("");
    expect(review.draft.tiers).toEqual([]);
    expect(review.marks.missing["plans"]).toBe(MISSING_NOTES.healthPlans);
    expect(review.marks.missing["tiers"]).toBe(MISSING_NOTES.match);
    expect(review.marks.missing[`plan.${plan!.id}.premium`]).toBe("");
    // Underline-only marks don't count as notes.
    expect(markCounts(review.marks).missing).toBe(3);
  });

  it("ignores the custom state rate unless the state is OTHER", () => {
    const review = draftFromLetter(withMissing("customStateRate"), 0)!;
    expect(review.marks.missing["customStatePct"]).toBeUndefined();
    expect(review.draft.customStatePct).toBe("");
  });

  it("covers every extract field key", () => {
    // A guard: a new ExtractFieldKey must be mapped here too.
    expect(EXTRACT_FIELD_KEYS).toHaveLength(14);
  });
});

describe("touchMarks", () => {
  it("drops a field's marker or note once edited, and its section's note", () => {
    const review = draftFromLetter(withMissing("salary", "healthPlans"), 0)!;
    const planId = review.draft.plans[0]!.id;
    let m = touchMarks(review.marks, "employer");
    expect(m.fromLetter.has("employer")).toBe(false);
    m = touchMarks(m, "salary");
    expect(m.missing["salary"]).toBeUndefined();
    m = touchMarks(m, `plan.${planId}.premium`);
    expect(m.missing["plans"]).toBeUndefined();
    expect(m.missing[`plan.${planId}.premium`]).toBeUndefined();
    expect(m.missing[`plan.${planId}.deductible`]).toBe("");
    expect(touchMarks(m, "nothing-marked")).toBe(m);
  });
});
