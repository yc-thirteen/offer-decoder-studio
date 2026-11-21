/**
 * HTTP AI client for the Lovable Cloud (Supabase) edge functions decode-offer and
 * explain-stub. The requests themselves arrive in a later BACKLOG task; until then
 * the methods fail loudly rather than fake success.
 */
import { AIError, type AIClient, type ExplainResult, type ExtractResult } from "./types";

export interface HttpAIConfig {
  /** Project URL without a trailing slash, e.g. https://ref.supabase.co */
  supabaseUrl: string;
  /** Publishable (anon) key. Public by design; never the Anthropic key. */
  publishableKey: string;
}

export class HttpAIClient implements AIClient {
  readonly kind = "http" as const;

  constructor(readonly config: HttpAIConfig) {}

  extractOffer(): Promise<ExtractResult> {
    return Promise.reject(
      new AIError("The letter reader isn't connected yet. Type the offer in by hand."),
    );
  }

  explainStub(): Promise<ExplainResult> {
    return Promise.reject(
      new AIError("The summary isn't connected yet. Read the stubs and checklist."),
    );
  }
}
