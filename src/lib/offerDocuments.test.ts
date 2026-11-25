import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MockAIClient, parseLetter } from "@/lib/ai";
import {
  buildOfferDocumentText,
  DOCUMENT_ERRORS,
  MAX_LETTER_CHARS,
  readOfferDocuments,
} from "./offerDocuments";

const source = (name: string) =>
  readFileSync(path.resolve(__dirname, "../data/documents", name), "utf8");
const offerLetter = source("northfield-offer.txt");
const benefitsGuide = source("northfield-benefits.txt");

describe("offer documents", () => {
  it("preserves the two source texts and explicit coverage, including quotes and newlines", () => {
    const text = buildOfferDocumentText({ offerLetter, benefitsGuide, coverage: "family" });
    expect(readOfferDocuments(text)).toMatchObject({
      offerLetter: offerLetter.trim(),
      benefitsGuide: benefitsGuide.trim(),
      coverage: "family",
    });
    expect(readOfferDocuments("An ordinary legacy offer letter")).toBeNull();
    expect(
      readOfferDocuments('{"kind":"offer-decoder-documents-v1","coverage":"wrong"}'),
    ).toBeNull();
  });

  it("accepts either document alone and rejects empty or oversized combined requests", () => {
    expect(() =>
      buildOfferDocumentText({ offerLetter, benefitsGuide: "", coverage: "self" }),
    ).not.toThrow();
    expect(() =>
      buildOfferDocumentText({ offerLetter: "", benefitsGuide, coverage: "self" }),
    ).not.toThrow();
    expect(() =>
      buildOfferDocumentText({ offerLetter: " ", benefitsGuide: "\n", coverage: "self" }),
    ).toThrow(DOCUMENT_ERRORS.empty);
    expect(() =>
      buildOfferDocumentText({
        offerLetter: "x".repeat(MAX_LETTER_CHARS / 2),
        benefitsGuide: "y".repeat(MAX_LETTER_CHARS / 2),
        coverage: "self",
      }),
    ).toThrow(DOCUMENT_ERRORS.long);
    const empty = JSON.stringify({
      kind: "offer-decoder-documents-v1",
      coverage: "self",
      offerLetter: "",
      benefitsGuide: "",
    });
    const text = buildOfferDocumentText({
      offerLetter: "x".repeat(MAX_LETTER_CHARS - empty.length),
      benefitsGuide: "",
      coverage: "self",
    });
    expect(text.length).toBe(MAX_LETTER_CHARS);
    expect(() =>
      buildOfferDocumentText({
        offerLetter: "x".repeat(MAX_LETTER_CHARS - empty.length + 1),
        benefitsGuide: "",
        coverage: "self",
      }),
    ).toThrow(DOCUMENT_ERRORS.long);
  });

  it("the offline sample pair fills the same offer as the original combined sample", async () => {
    const client = new MockAIClient();
    const original = readFileSync(
      path.resolve(__dirname, "../data/letters/northfield.txt"),
      "utf8",
    );
    const result = await client.extractOffer({
      text: buildOfferDocumentText({ offerLetter, benefitsGuide, coverage: "self" }),
    });
    expect(result.fields).toEqual(parseLetter(original));
  });

  it("does not reuse employee-only sample benefits as family costs", async () => {
    const result = await new MockAIClient().extractOffer({
      text: buildOfferDocumentText({ offerLetter, benefitsGuide, coverage: "family" }),
    });
    expect(result.fields.salary).toEqual({ source: "letter", value: 150000 });
    expect(result.fields.healthPlans.source).toBe("missing");
    expect(result.fields.defaultPlanId.source).toBe("missing");
  });
});
