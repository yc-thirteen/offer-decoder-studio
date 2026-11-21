/**
 * The decode-offer and explain-stub edge functions (supabase/functions), run here
 * against a fake Anthropic API. No network and no real key.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import sampleCases from "@/data/sampleCases.json";
import extractions from "@/data/letters/expected-extractions.json";
import { STATE_RATES, runCase, type Offer, type Profile } from "@/lib/engine";
import {
  ANTHROPIC_VERSION,
  MODEL,
  UPSTREAM_TIMEOUT_MS,
} from "../../../supabase/functions/_shared/anthropic.ts";
import {
  DECODE_COPY,
  EXTRACT_SCHEMA,
  FIELD_KEYS,
  MAX_LETTER_CHARS,
  STATE_CODES,
  handleDecodeOffer,
} from "../../../supabase/functions/_shared/decodeOffer.ts";
import {
  EXPLAIN_COPY,
  EXPLAIN_SYSTEM,
  factsText,
  handleExplainStub,
  readExplainRequest,
} from "../../../supabase/functions/_shared/explainStub.ts";
import { HttpAIClient } from "./HttpAIClient";
import { buildExplainRequest, explainTemplate } from "./explainTemplate";
import { MISSING_NOTES, allMissing, fieldsToOffer, parseLetter } from "./letterParser";
import { EXTRACT_FIELD_KEYS, type ExplainMode, type ExplainRequest } from "./types";
import { validateExtractResult } from "./validate";

type CaseJson = { id: string; profile: Profile; offers: Offer[] };
const cases = (sampleCases as unknown as { cases: CaseJson[] }).cases;
const letterText = (file: string) =>
  readFileSync(path.resolve(__dirname, "../../data/letters", file), "utf8");
const KEY = "test-key-not-real";

/** A Messages API response whose text block is `text`. */
function modelReply(text: string, stop_reason = "end_turn") {
  return new Response(
    JSON.stringify({
      type: "message",
      stop_reason,
      content: [
        { type: "thinking", thinking: "" },
        { type: "text", text },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function fakeAnthropic(reply: () => Response | Promise<Response>) {
  return vi.fn<typeof fetch>(async () => reply());
}

const post = (fn: string, body: unknown) =>
  new Request(`https://ref.supabase.co/functions/v1/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

function requestFor(caseId: string, mode: ExplainMode): ExplainRequest {
  const c = cases.find((x) => x.id === caseId)!;
  const r = runCase(c);
  return buildExplainRequest(
    c.offers.map((offer, i) => ({ offer, result: r.offers[i]! })),
    { default: r.winnerBy_default, recommended: r.winnerBy_recommended },
    mode,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("edge function contracts match the app", () => {
  it("uses the app's field keys and state codes", () => {
    expect([...FIELD_KEYS]).toEqual([...EXTRACT_FIELD_KEYS]);
    expect(STATE_CODES).toEqual([...Object.keys(STATE_RATES), "OTHER"]);
    const props = (EXTRACT_SCHEMA.properties as { fields: { properties: object } }).fields
      .properties;
    expect(Object.keys(props)).toEqual([...EXTRACT_FIELD_KEYS]);
  });

  it("keeps every directive message short enough for the app to show", () => {
    for (const msg of [...Object.values(DECODE_COPY), ...Object.values(EXPLAIN_COPY)]) {
      expect(msg.length).toBeLessThanOrEqual(240);
      expect(msg).not.toContain("!");
    }
  });
});

describe("decode-offer", () => {
  it("answers CORS preflight and rejects other methods", async () => {
    const pre = await handleDecodeOffer(
      new Request("https://x/functions/v1/decode-offer", { method: "OPTIONS" }),
      { apiKey: KEY },
    );
    expect(pre.status).toBe(200);
    expect(pre.headers.get("access-control-allow-origin")).toBe("*");
    expect(pre.headers.get("access-control-allow-headers")).toContain("apikey");
    const get = await handleDecodeOffer(new Request("https://x/functions/v1/decode-offer"), {
      apiKey: KEY,
    });
    expect(get.status).toBe(405);
  });

  it("returns 400 with a directive error on invalid input, without calling the model", async () => {
    const fetch = fakeAnthropic(() => modelReply("{}"));
    const cases: [unknown, string][] = [
      ["not json", DECODE_COPY.badJson],
      [{}, DECODE_COPY.empty],
      [{ text: "   " }, DECODE_COPY.empty],
      [{ text: 42 }, DECODE_COPY.empty],
      [{ text: "x".repeat(MAX_LETTER_CHARS + 1) }, DECODE_COPY.long],
    ];
    for (const [body, error] of cases) {
      const res = await handleDecodeOffer(post("decode-offer", body), { apiKey: KEY, fetch });
      expect(res.status).toBe(400);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(await res.json()).toEqual({ error });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says how to connect when the secret is missing", async () => {
    const fetch = fakeAnthropic(() => modelReply("{}"));
    const res = await handleDecodeOffer(post("decode-offer", { text: "Offer" }), {
      apiKey: undefined,
      fetch,
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: DECODE_COPY.notConnected });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls the Messages API with the key, version, model, and JSON schema", async () => {
    const text = letterText("cascade.txt");
    const fetch = fakeAnthropic(() => modelReply(JSON.stringify({ fields: parseLetter(text) })));
    await handleDecodeOffer(post("decode-offer", { text }), { apiKey: KEY, fetch });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init!.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(KEY);
    expect(headers["anthropic-version"]).toBe(ANTHROPIC_VERSION);
    expect(ANTHROPIC_VERSION).toBe("2023-06-01");
    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe(MODEL);
    expect(MODEL).toBe("claude-sonnet-5-5");
    expect(body.output_config.format).toEqual({ type: "json_schema", schema: EXTRACT_SCHEMA });
    expect(body.system).toContain("never guess");
    expect(body.messages[0].content).toContain(text);
  });

  it.each(extractions.letters)(
    "$file round-trips through the function into fixture offer $offerId",
    async (l) => {
      const text = letterText(l.file);
      const fetch = fakeAnthropic(() => modelReply(JSON.stringify({ fields: parseLetter(text) })));
      const res = await handleDecodeOffer(post("decode-offer", { text }), { apiKey: KEY, fetch });
      expect(res.status).toBe(200);
      const result = validateExtractResult(await res.json());
      expect(result).not.toBeNull();
      const expected = cases
        .find((c) => c.id === l.caseId)!
        .offers.find((o) => o.id === l.offerId)!;
      expect(fieldsToOffer(result!.fields, l.offerId)).toEqual(expected);
    },
  );

  it("blanks the model's missing notes so the app shows its own", async () => {
    const fields = allMissing("I think the salary is probably $90,000.");
    const fetch = fakeAnthropic(() => modelReply(JSON.stringify({ fields })));
    const res = await handleDecodeOffer(post("decode-offer", { text: "Hello" }), {
      apiKey: KEY,
      fetch,
    });
    const body = await res.json();
    for (const k of EXTRACT_FIELD_KEYS)
      expect(body.fields[k]).toEqual({ source: "missing", value: null, note: "" });
    const result = validateExtractResult(body)!;
    expect(result.fields.salary).toEqual({
      source: "missing",
      value: null,
      note: MISSING_NOTES.salary,
    });
  });

  it("rejects model output that isn't the expected shape", async () => {
    const outputs = [
      "not json",
      JSON.stringify({ summary: "x" }),
      JSON.stringify({ fields: { employer: { source: "letter", value: "A" } } }),
      JSON.stringify({
        fields: {
          ...parseLetter(letterText("cascade.txt")),
          salary: { source: "letter", value: null },
        },
      }),
    ];
    for (const out of outputs) {
      const fetch = fakeAnthropic(() => modelReply(out));
      const res = await handleDecodeOffer(post("decode-offer", { text: "Offer" }), {
        apiKey: KEY,
        fetch,
      });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: DECODE_COPY.invalid });
    }
  });

  it("turns refusals, truncation, upstream errors, network failures, and timeouts into directive errors", async () => {
    const run = async (fetch: typeof globalThis.fetch, timeoutMs?: number) => {
      const res = await handleDecodeOffer(post("decode-offer", { text: "Offer" }), {
        apiKey: KEY,
        fetch,
        ...(timeoutMs ? { timeoutMs } : {}),
      });
      return [res.status, (await res.json()).error];
    };
    expect(await run(fakeAnthropic(() => modelReply("", "refusal")))).toEqual([
      502,
      DECODE_COPY.refused,
    ]);
    expect(await run(fakeAnthropic(() => modelReply('{"fields":', "max_tokens")))).toEqual([
      502,
      DECODE_COPY.invalid,
    ]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await run(
        fakeAnthropic(() => new Response('{"error":{"type":"overloaded"}}', { status: 529 })),
      ),
    ).toEqual([502, DECODE_COPY.upstream]);
    expect(
      await run(
        vi.fn<typeof fetch>(async () => {
          throw new TypeError("network");
        }),
      ),
    ).toEqual([502, DECODE_COPY.upstream]);
    const hang = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_, reject) =>
          init!.signal!.addEventListener("abort", () => reject(new DOMException("", "AbortError"))),
        ),
    );
    expect(await run(hang, 10)).toEqual([504, DECODE_COPY.timeout]);
    expect(UPSTREAM_TIMEOUT_MS).toBeLessThan(20_000);
  });

  it("never logs the letter text", async () => {
    const text = "SECRET-LETTER Northfield Health salary $1";
    const logged: string[] = [];
    for (const level of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, level).mockImplementation((...args) => {
        logged.push(args.map(String).join(" "));
      });
    }
    const replies = [
      () => new Response(JSON.stringify({ error: { message: text } }), { status: 400 }),
      () => modelReply(`not json ${text}`),
      () => {
        throw new Error(text);
      },
    ];
    for (const reply of replies) {
      await handleDecodeOffer(post("decode-offer", { text }), {
        apiKey: KEY,
        fetch: vi.fn<typeof fetch>(async () => reply()),
      });
    }
    expect(logged.join("\n")).not.toContain("SECRET-LETTER");
  });

  it("works end to end behind HttpAIClient", async () => {
    const text = letterText("northfield.txt");
    const anthropic = fakeAnthropic(() =>
      modelReply(JSON.stringify({ fields: parseLetter(text) })),
    );
    const client = new HttpAIClient(
      { supabaseUrl: "https://ref.supabase.co", publishableKey: "pk" },
      {
        fetch: async (url, init) =>
          handleDecodeOffer(new Request(url, init), { apiKey: KEY, fetch: anthropic }),
      },
    );
    const { fields } = await client.extractOffer({ text });
    expect(fields.employer).toEqual({ source: "letter", value: "Northfield Health" });
  });
});

describe("explain-stub", () => {
  it("returns 400 on an invalid request without calling the model", async () => {
    const good = requestFor("chicago-vs-austin", "recommended");
    const fetch = fakeAnthropic(() => modelReply("{}"));
    const bad: unknown[] = [
      {},
      { ...good, offers: [good.offers[0]] },
      { ...good, offers: [good.offers[0], good.offers[0]] },
      { ...good, winnerId: "nobody" },
      { ...good, winnerId: good.winnerByDefault === good.winnerId ? "x" : good.winnerByDefault },
      { ...good, offers: [{ ...good.offers[0], netPay: "lots" }, good.offers[1]] },
      { ...good, offers: [{ ...good.offers[0], employer: "x".repeat(500) }, good.offers[1]] },
    ];
    for (const body of bad) {
      const res = await handleExplainStub(post("explain-stub", body), { apiKey: KEY, fetch });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: EXPLAIN_COPY.badRequest });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("gives the model the engine's figures and tells it to use only those", async () => {
    const req = requestFor("chicago-vs-austin", "recommended");
    const fetch = fakeAnthropic(() =>
      modelReply(JSON.stringify({ summary: explainTemplate(req) })),
    );
    await handleExplainStub(post("explain-stub", req), { apiKey: KEY, fetch });
    const body = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
    expect(body.system).toBe(EXPLAIN_SYSTEM);
    expect(EXPLAIN_SYSTEM).toContain("Use only the facts given");
    expect(EXPLAIN_SYSTEM).toContain("do not mention any number that isn't in the facts");
    const facts = factsText(readExplainRequest(req));
    expect(body.messages[0].content).toContain(facts);
    expect(facts).toContain("comes out ahead by $");
    expect(facts).toContain(`$${Math.round(req.offers[0]!.netPay).toLocaleString("en-US")}`);
  });

  it.each(
    cases.flatMap((c) =>
      (["default", "recommended"] as const).map((m): [string, ExplainMode] => [c.id, m]),
    ),
  )("accepts a summary that uses only the request's numbers (%s, %s)", async (caseId, mode) => {
    const req = requestFor(caseId, mode);
    const summary = explainTemplate(req).replace(/−/g, "-");
    const fetch = fakeAnthropic(() => modelReply(JSON.stringify({ summary })));
    const res = await handleExplainStub(post("explain-stub", req), { apiKey: KEY, fetch });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summary });
  });

  it("rejects a summary with a number the engine didn't produce", async () => {
    const req = requestFor("chicago-vs-austin", "recommended");
    for (const extra of [
      " You'd save $1,234,567 over ten years.",
      " That's 37.5% more.",
      " The raise is worth 123,456 dollars.",
    ]) {
      const summary = explainTemplate(req) + extra;
      const fetch = fakeAnthropic(() => modelReply(JSON.stringify({ summary })));
      const res = await handleExplainStub(post("explain-stub", req), { apiKey: KEY, fetch });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: EXPLAIN_COPY.offStub });
    }
  });

  it("works end to end behind HttpAIClient", async () => {
    const req = requestFor("high-earner-family", "default");
    const anthropic = fakeAnthropic(() =>
      modelReply(JSON.stringify({ summary: explainTemplate(req) })),
    );
    const client = new HttpAIClient(
      { supabaseUrl: "https://ref.supabase.co", publishableKey: "pk" },
      {
        fetch: async (url, init) =>
          handleExplainStub(new Request(url, init), { apiKey: KEY, fetch: anthropic }),
      },
    );
    expect((await client.explainStub(req)).summary).toBe(explainTemplate(req));
  });
});
