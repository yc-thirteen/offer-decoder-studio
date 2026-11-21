/**
 * Mock AI client, used whenever no Lovable Cloud env vars are present.
 * extractOffer and explainStub are filled in by the next two BACKLOG tasks; until
 * then they fail loudly rather than fake success (DESIGN.md "AI elements").
 */
import { AIError, type AIClient, type ExplainResult, type ExtractResult } from "./types";

export class MockAIClient implements AIClient {
  readonly kind = "mock" as const;

  extractOffer(): Promise<ExtractResult> {
    return Promise.reject(
      new AIError("The sample reader isn't built yet. Type the offer in by hand."),
    );
  }

  explainStub(): Promise<ExplainResult> {
    return Promise.reject(
      new AIError("The sample summary isn't built yet. Read the stubs and checklist."),
    );
  }
}
