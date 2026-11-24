/**
 * Mock AI client, used whenever no Lovable Cloud env vars are present.
 * extractOffer reads the three sample letters with a deterministic parser and returns
 * every field as missing for any other text, so it never fakes success (DESIGN.md
 * "AI elements"). explainStub words the request's engine numbers with a fixed template.
 */
import { explainTemplate } from "./explainTemplate";
import { allMissing, parseLetter, sampleEmployer } from "./letterParser";
import { readOfferDocuments } from "@/lib/offerDocuments";
import {
  AIError,
  type AIClient,
  type ExplainRequest,
  type ExplainResult,
  type ExtractRequest,
  type ExtractResult,
} from "./types";

function checkAborted(signal: AbortSignal | undefined, message: string) {
  if (signal?.aborted) throw new AIError(message);
}

export class MockAIClient implements AIClient {
  readonly kind = "mock" as const;

  async extractOffer(req: ExtractRequest, signal?: AbortSignal): Promise<ExtractResult> {
    checkAborted(signal, "Reading the letter was cancelled. Read it again.");
    const text = typeof req?.text === "string" ? req.text : "";
    if (!text.trim())
      throw new AIError("The letter is empty. Paste its text or drop the letter's file.");
    const documents = readOfferDocuments(text);
    const source = documents ? `${documents.offerLetter}\n\n${documents.benefitsGuide}` : text;
    const fields = sampleEmployer(source) ? parseLetter(source) : allMissing();
    // The bundled samples only quote employee-only benefits. Do not present those
    // amounts as family costs in offline demonstrations.
    if (documents?.coverage === "family" && fields.healthPlans.source === "letter") {
      fields.healthPlans = {
        source: "missing",
        value: null,
        note: "The samples quote employee-only benefits. Enter the family plan details here.",
      };
      fields.defaultPlanId = {
        source: "missing",
        value: null,
        note: "Choose the default plan after entering its family costs.",
      };
    }
    return { fields };
  }

  async explainStub(req: ExplainRequest, signal?: AbortSignal): Promise<ExplainResult> {
    checkAborted(signal, "The summary was cancelled. Ask for it again.");
    return { summary: explainTemplate(req) };
  }
}
