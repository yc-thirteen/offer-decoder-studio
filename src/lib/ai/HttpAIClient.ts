/**
 * HTTP AI client for the Lovable Cloud (Supabase) edge functions decode-offer and
 * explain-stub. It sends only the publishable key (public by design); the
 * Anthropic key stays in the functions' secrets. Every failure becomes a directive
 * AIError the UI can show as is, and a response of the wrong shape is rejected
 * rather than shown.
 */
import {
  LONG_READER_TIMEOUT_MS,
  SINGLE_READ_CHARS,
} from "../../../supabase/functions/_shared/documentSections";
import { assertExplainRequest } from "./explainTemplate";
import {
  AIError,
  type AIClient,
  type ExplainRequest,
  type ExplainResult,
  type ExtractRequest,
  type ExtractResult,
} from "./types";
import { serverErrorMessage, validateExplainResult, validateExtractResult } from "./validate";

export interface HttpAIConfig {
  /** Project URL without a trailing slash, e.g. https://ref.supabase.co */
  supabaseUrl: string;
  /** Publishable (anon) key. Public by design; never the Anthropic key. */
  publishableKey: string;
}

export interface HttpAIOptions {
  /** Defaults to the global fetch. Injected in tests. */
  fetch?: typeof fetch;
  /** Defaults to 20 seconds. */
  timeoutMs?: number;
}

export const AI_TIMEOUT_MS = 20_000;

interface Copy {
  timeout: string;
  cancelled: string;
  network: string;
  failed: string;
  invalid: string;
}

export const READER_ERRORS: Copy = {
  timeout:
    "The letter reader took longer than 20 seconds. Read the letter again, or type the offer in by hand.",
  cancelled: "Reading the letter was cancelled. Read it again.",
  network:
    "Couldn't reach the letter reader. Check your connection and read the letter again, or type the offer in by hand.",
  failed: "The letter reader didn't answer. Read the letter again, or type the offer in by hand.",
  invalid:
    "The letter reader sent back something unreadable. Read the letter again, or type the offer in by hand.",
};

export const SUMMARY_ERRORS: Copy = {
  timeout:
    "The summary took longer than 20 seconds. Ask for it again, or read the stubs and checklist.",
  cancelled: "The summary was cancelled. Ask for it again.",
  network:
    "Couldn't reach the summary writer. Check your connection and ask again, or read the stubs and checklist.",
  failed: "The summary writer didn't answer. Ask again, or read the stubs and checklist.",
  invalid:
    "The summary writer sent back something unreadable. Ask again, or read the stubs and checklist.",
};

export class HttpAIClient implements AIClient {
  readonly kind = "http" as const;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly longReaderTimeoutMs: number;

  constructor(
    readonly config: HttpAIConfig,
    options: HttpAIOptions = {},
  ) {
    this.fetchImpl = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.timeoutMs = options.timeoutMs ?? AI_TIMEOUT_MS;
    this.longReaderTimeoutMs = options.timeoutMs ?? LONG_READER_TIMEOUT_MS;
  }

  async extractOffer(req: ExtractRequest, signal?: AbortSignal): Promise<ExtractResult> {
    if (signal?.aborted) throw new AIError(READER_ERRORS.cancelled);
    const text = typeof req?.text === "string" ? req.text : "";
    if (!text.trim())
      throw new AIError("The letter is empty. Paste its text or drop the letter's file.");
    const long = text.length > SINGLE_READ_CHARS;
    const copy = long
      ? {
          ...READER_ERRORS,
          timeout:
            "The document reader could not finish in time. Try the offer and the benefits pages that apply to you, or fill in the details manually.",
        }
      : READER_ERRORS;
    const body = await this.post(
      "decode-offer",
      { text },
      copy,
      signal,
      long ? this.longReaderTimeoutMs : this.timeoutMs,
    );
    const result = validateExtractResult(body);
    if (!result) throw new AIError(READER_ERRORS.invalid);
    return result;
  }

  async explainStub(req: ExplainRequest, signal?: AbortSignal): Promise<ExplainResult> {
    if (signal?.aborted) throw new AIError(SUMMARY_ERRORS.cancelled);
    assertExplainRequest(req);
    const body = await this.post("explain-stub", req, SUMMARY_ERRORS, signal);
    const result = validateExplainResult(body);
    if (!result) throw new AIError(SUMMARY_ERRORS.invalid);
    return result;
  }

  /** POSTs JSON to one edge function and returns the parsed JSON body. */
  private async post(
    fn: "decode-offer" | "explain-stub",
    payload: unknown,
    copy: Copy,
    signal?: AbortSignal,
    timeoutMs = this.timeoutMs,
  ): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });

    const { supabaseUrl, publishableKey } = this.config;
    try {
      let res: Response;
      try {
        res = await this.fetchImpl(`${supabaseUrl}/functions/v1/${fn}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: publishableKey,
            ...(!publishableKey.startsWith("sb_publishable_")
              ? { Authorization: `Bearer ${publishableKey}` }
              : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch {
        if (timedOut) throw new AIError(copy.timeout);
        if (signal?.aborted) throw new AIError(copy.cancelled);
        throw new AIError(copy.network);
      }

      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        if (timedOut) throw new AIError(copy.timeout);
        if (signal?.aborted) throw new AIError(copy.cancelled);
        body = null;
      }

      if (!res.ok) throw new AIError(serverErrorMessage(body) ?? copy.failed);
      if (body === null) throw new AIError(copy.invalid);
      return body;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
}
