/**
 * Mock AI client, used whenever no Lovable Cloud env vars are present.
 * extractOffer reads the three sample letters with a deterministic parser and returns
 * every field as missing for any other text, so it never fakes success (DESIGN.md
 * "AI elements"). explainStub is filled in by the next BACKLOG task; until then it
 * fails loudly.
 */
import { allMissing, parseLetter, sampleEmployer } from "./letterParser";
import {
  AIError,
  type AIClient,
  type ExplainResult,
  type ExtractRequest,
  type ExtractResult,
} from "./types";

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AIError("Reading the letter was cancelled. Read it again.");
}

export class MockAIClient implements AIClient {
  readonly kind = "mock" as const;

  async extractOffer(req: ExtractRequest, signal?: AbortSignal): Promise<ExtractResult> {
    checkAborted(signal);
    const text = typeof req?.text === "string" ? req.text : "";
    if (!text.trim()) throw new AIError("The letter is empty. Paste its text or drop a .txt file.");
    return { fields: sampleEmployer(text) ? parseLetter(text) : allMissing() };
  }

  explainStub(): Promise<ExplainResult> {
    return Promise.reject(
      new AIError("The sample summary isn't built yet. Read the stubs and checklist."),
    );
  }
}
