/**
 * AI entry point. getAIClient() returns the HTTP client when the Lovable Cloud
 * (Supabase) URL and publishable key are set, and the mock client otherwise.
 * The Anthropic key lives only in the edge functions' secrets, never here.
 */
import { HttpAIClient, type HttpAIConfig } from "./HttpAIClient";
import { MockAIClient } from "./MockAIClient";
import type { AIClient } from "./types";

export * from "./types";
export {
  AI_TIMEOUT_MS,
  HttpAIClient,
  READER_ERRORS,
  SUMMARY_ERRORS,
  type HttpAIConfig,
  type HttpAIOptions,
} from "./HttpAIClient";
export { serverErrorMessage, validateExplainResult, validateExtractResult } from "./validate";
export { MockAIClient } from "./MockAIClient";
export {
  INVALID_EXPLAIN_REQUEST,
  assertExplainRequest,
  buildExplainRequest,
  explainTemplate,
  type ExplainInput,
} from "./explainTemplate";
export {
  MISSING_NOTES,
  SAMPLE_EMPLOYERS,
  UNKNOWN_LETTER_NOTE,
  fieldsToOffer,
  parseLetter,
} from "./letterParser";

export type AIEnv = Partial<Record<string, string | boolean | undefined>>;

function read(env: AIEnv, name: string): string {
  const v = env[name];
  return typeof v === "string" ? v.trim() : "";
}

/** The HTTP config from env, or null when the URL or key is absent. */
export function aiConfigFromEnv(env: AIEnv): HttpAIConfig | null {
  const supabaseUrl = read(env, "VITE_SUPABASE_URL").replace(/\/+$/, "");
  const publishableKey =
    read(env, "VITE_SUPABASE_PUBLISHABLE_KEY") || read(env, "VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !publishableKey) return null;
  return { supabaseUrl, publishableKey };
}

export function getAIClient(env: AIEnv = import.meta.env): AIClient {
  const config = aiConfigFromEnv(env);
  return config ? new HttpAIClient(config) : new MockAIClient();
}
