import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sampleCases from "@/data/sampleCases.json";
import extractions from "@/data/letters/expected-extractions.json";
import type { Offer } from "@/lib/engine";
import { AIError, EXTRACT_FIELD_KEYS, MockAIClient, getAIClient } from "./index";
import {
  MISSING_NOTES,
  UNKNOWN_LETTER_NOTE,
  allMissing,
  fieldsToOffer,
  parseLetter,
} from "./letterParser";

const letterText = (file: string) =>
  readFileSync(path.resolve(__dirname, "../../data/letters", file), "utf8");

type CaseJson = { id: string; offers: Offer[] };
const cases = (sampleCases as unknown as { cases: CaseJson[] }).cases;
const fixtureOffer = (caseId: string, offerId: string) => {
  const o = cases.find((c) => c.id === caseId)?.offers.find((x) => x.id === offerId);
  if (!o) throw new Error(`no fixture offer ${caseId}/${offerId}`);
  return o;
};

const client = new MockAIClient();

describe("MockAIClient.extractOffer on the sample letters", () => {
  it("covers exactly the three letters named in expected-extractions.json", () => {
    expect(extractions.letters.map((l) => l.file).sort()).toEqual([
      "cascade.txt",
      "lakeshore.txt",
      "northfield.txt",
    ]);
  });

  it.each(extractions.letters)("$file extracts into fixture offer $offerId", async (l) => {
    const { fields } = await client.extractOffer({ text: letterText(l.file) });
    const expected = fixtureOffer(l.caseId, l.offerId);
    // Every field the offer needs came from the letter; the custom state rate is
    // not stated (none of the sample states is OTHER) and says why it isn't needed.
    for (const k of EXTRACT_FIELD_KEYS) {
      if (k === "customStateRate") continue;
      expect(fields[k].source, k).toBe("letter");
    }
    expect(fields.customStateRate).toEqual({
      source: "missing",
      value: null,
      note: MISSING_NOTES.customStateRate,
    });
    expect(fieldsToOffer(fields, l.offerId)).toEqual(expected);
  });

  it("reads the field values a letter states, not defaults", async () => {
    const north = (await client.extractOffer({ text: letterText("northfield.txt") })).fields;
    expect(north.salary.value).toBe(150000);
    expect(north.defaultPlanId.value).toBe("ppo");
    expect(north.vesting.value).toEqual({ type: "cliff", years: 3 });
    // $92.31 per paycheck is read from its stated yearly figure, not multiplied out.
    expect(north.healthPlans.value?.map((p) => p.premium)).toEqual([2400, 600]);
    const cascade = (await client.extractOffer({ text: letterText("cascade.txt") })).fields;
    expect(cascade.match.value).toEqual([
      { rate: 1, upToPct: 3 },
      { rate: 0.5, upToPct: 5 },
    ]);
    expect(cascade.defaultEmployeePct.value).toBe(0);
  });

  it("is what getAIClient() returns without Cloud env vars", async () => {
    const { fields } = await getAIClient({}).extractOffer({ text: letterText("lakeshore.txt") });
    expect(fieldsToOffer(fields, "lakeshore")).toEqual(
      fixtureOffer("chicago-vs-austin", "lakeshore"),
    );
  });
});

describe("MockAIClient.extractOffer never invents values", () => {
  it("returns every field missing for text that isn't a sample letter", async () => {
    const text =
      "Acme Corp, Denver, Colorado. Base salary: $95,000, paid biweekly. We match 100% of the first 5%.";
    const { fields } = await client.extractOffer({ text });
    expect(fields).toEqual(allMissing());
    for (const k of EXTRACT_FIELD_KEYS) {
      expect(fields[k]).toEqual({ source: "missing", value: null, note: UNKNOWN_LETTER_NOTE });
    }
    expect(fieldsToOffer(fields, "x")).toBeNull();
  });

  it("marks only the removed field missing when a sample letter leaves it out", async () => {
    const text = letterText("northfield.txt").replace(
      "Your annual base salary will be $150,000, paid biweekly (26 pay periods per year).",
      "",
    );
    const { fields } = await client.extractOffer({ text });
    expect(fields.salary).toEqual({
      source: "missing",
      value: null,
      note: "No salary in these documents. Type it here.",
    });
    expect(fields.payPeriods).toEqual({
      source: "missing",
      value: null,
      note: MISSING_NOTES.payPeriods,
    });
    // The per-paycheck premiums still have their stated yearly figures.
    expect(fields.healthPlans.source).toBe("letter");
    expect(fields.employer.value).toBe("Northfield Health");
    expect(fieldsToOffer(fields, "northfield")).toBeNull();
  });

  it("drops the health plans rather than guess a missing number", () => {
    const fields = parseLetter(
      letterText("lakeshore.txt").replace("Deductible $1,000, then", "Then"),
    );
    expect(fields.healthPlans.source).toBe("missing");
    expect(fields.defaultPlanId.source).toBe("missing");
    expect(fields.salary.value).toBe(140000);
  });

  it("reads an edited sample letter's own numbers", () => {
    const fields = parseLetter(letterText("cascade.txt").replace("$58,000", "$61,500"));
    expect(fields.salary.value).toBe(61500);
  });

  it("rejects empty text and an aborted request with directive errors", async () => {
    await expect(client.extractOffer({ text: "   " })).rejects.toBeInstanceOf(AIError);
    await expect(client.extractOffer({ text: "   " })).rejects.toThrow(/Paste its text/);
    const ac = new AbortController();
    ac.abort();
    await expect(
      client.extractOffer({ text: letterText("cascade.txt") }, ac.signal),
    ).rejects.toThrow(/Read it again/);
  });
});
