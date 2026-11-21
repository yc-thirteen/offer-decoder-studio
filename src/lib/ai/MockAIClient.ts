/**
 * Mock AI client, used whenever no Lovable Cloud env vars are present.
 * extractOffer reads the three sample letters with a deterministic parser and returns
 * every field as missing for any other text, so it never fakes success (DESIGN.md
 * "AI elements"). explainStub words the request's engine numbers with a fixed template.
 */
import { explainTemplate } from "./explainTemplate";
import { allMissing, parseLetter, sampleEmployer } from "./letterParser";
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
    return { fields: sampleEmployer(text) ? parseLetter(text) : allMissing() };
  }

  async explainStub(req: ExplainRequest, signal?: AbortSignal): Promise<ExplainResult> {
    checkAborted(signal, "The summary was cancelled. Ask for it again.");
    return { summary: explainTemplate(req) };
  }
}
