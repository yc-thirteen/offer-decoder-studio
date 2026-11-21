/**
 * Shared plumbing for the decode-offer and explain-stub edge functions: CORS, JSON
 * responses, and one call to the Anthropic Messages API that must come back as
 * JSON matching a schema. Pure TypeScript with no Deno or npm imports, so the
 * Vitest suite can run it. Nothing here logs request or response text.
 */

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const MODEL = "claude-sonnet-5-5";
/** Server-side refusal fallback (beta). "default" routes by refusal category. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";
/** The browser gives up at 20s; answer first so it shows this function's message. */
export const UPSTREAM_TIMEOUT_MS = 18_000;

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** A failure with the status to send and a directive message the UI shows as is. */
export class FunctionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The words one function uses for each way the model call can fail. */
export interface FailureCopy {
  notConnected: string;
  timeout: string;
  upstream: string;
  refused: string;
  invalid: string;
}

export interface ModelCall {
  apiKey: string | undefined;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  copy: FailureCopy;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** The Messages API request body. JSON output is enforced by the schema. */
export function messagesBody(system: string, user: string, schema: Record<string, unknown>) {
  return {
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: user }],
    // Low effort keeps the round trip inside the browser's 20s limit; the task is
    // copying, not reasoning.
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    fallbacks: "default",
  };
}

/** The response properties read here, so access stays dot-style under strict TS. */
type Rec = Partial<Record<"stop_reason" | "content" | "type" | "text", unknown>>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** Calls the model and returns its JSON answer, or throws a FunctionError. */
export async function callModel(call: ModelCall): Promise<unknown> {
  const { copy } = call;
  const { generateMessage, GatewayError } = await import("@lovable.dev/ai-gateway");
  const { default: Ajv } = await import("ajv");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), call.timeoutMs ?? UPSTREAM_TIMEOUT_MS);

  let body: unknown;
  try {
    body = await generateMessage(
      {
        model: "anthropic/claude-sonnet-5",
        max_tokens: 16000,
        system: call.system,
        messages: [{ role: "user", content: call.user }],
        output_config: { effort: "low" },
        tools: [
          {
            name: "answer",
            description: "Return the answer matching this JSON schema.",
            input_schema: call.schema,
          },
        ],
        tool_choice: { type: "tool", name: "answer", disable_parallel_tool_use: true },
      },
      { signal: controller.signal, maxRetries: 0 },
    );
  } catch (error) {
    if (controller.signal.aborted) throw new FunctionError(504, copy.timeout);
    if (error instanceof GatewayError) {
      if (error.httpStatus !== undefined) console.error(error.httpStatus);
      if (error.httpStatus === 429)
        throw new FunctionError(429, "The AI is busy. Wait a minute, then try again.");
      if (error.httpStatus === 402)
        throw new FunctionError(
          402,
          "The AI is out of credits. Add credits in Lovable, or type the offer in by hand.",
        );
      if (error.code === "configuration_error" || error.code === "authentication_error")
        throw new FunctionError(500, copy.notConnected);
    }
    throw new FunctionError(502, copy.upstream);
  } finally {
    clearTimeout(timer);
  }

  if (!isRec(body)) throw new FunctionError(502, copy.upstream);
  if (body.stop_reason === "refusal") throw new FunctionError(502, copy.refused);
  if (body.stop_reason !== "tool_use") throw new FunctionError(502, copy.invalid);

  const content = Array.isArray(body.content) ? body.content : [];
  try {
    const tools = content.filter(
      (block): block is Record<string, unknown> =>
        typeof block === "object" && block !== null && "type" in block && block.type === "tool_use",
    );
    const tool = tools[0];
    if (tools.length !== 1 || tool?.["name"] !== "answer")
      throw new FunctionError(502, copy.invalid);
    const answer: unknown = JSON.parse(JSON.stringify(tool["input"]));
    const validate = new Ajv({ strict: false, logger: false }).compile(call.schema);
    if (!validate(answer)) throw new FunctionError(502, copy.invalid);
    return answer;
  } catch {
    throw new FunctionError(502, copy.invalid);
  }
}

/**
 * Runs one POST handler with CORS, JSON parsing, and directive errors. `run` gets
 * the parsed body and returns the response body, or throws a FunctionError.
 */
export async function serve(
  req: Request,
  copy: { badJson: string; failed: string },
  run: (body: unknown) => Promise<unknown>,
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Send a POST request with a JSON body." });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: copy.badJson });
  }
  try {
    return json(200, await run(body));
  } catch (e) {
    if (e instanceof FunctionError) return json(e.status, { error: e.message });
    console.error("unexpected failure", e instanceof Error ? e.name : typeof e);
    return json(500, { error: copy.failed });
  }
}
