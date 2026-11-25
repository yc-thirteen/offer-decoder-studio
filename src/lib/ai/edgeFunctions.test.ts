/**
 * The decode-offer and explain-stub edge functions (supabase/functions), run here
 * against a fake Gateway SDK call. No network and no real key.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMessage, ConfigurationError, OperationFailedError } from "@lovable.dev/ai-gateway";
vi.mock("@lovable.dev/ai-gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lovable.dev/ai-gateway")>();
  return { ...actual, generateMessage: vi.fn() };
});
import sampleCases from "@/data/sampleCases.json";
import extractions from "@/data/letters/expected-extractions.json";
import { STATE_CODES as ENGINE_STATE_CODES, runCase, type Offer, type Profile } from "@/lib/engine";
import { MODEL, UPSTREAM_TIMEOUT_MS } from "../../../supabase/functions/_shared/anthropic.ts";
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
import { buildOfferDocumentText, DOCUMENT_KIND } from "../offerDocuments";

type CaseJson = { id: string; profile: Profile; offers: Offer[] };
const cases = (sampleCases as unknown as { cases: CaseJson[] }).cases;
const letterText = (file: string) =>
  readFileSync(path.resolve(__dirname, "../../data/letters", file), "utf8");
const KEY = "test-key-not-real";

/** A Messages API response whose text block is `text`. */
function modelReply(text: string, stop_reason = "tool_use") {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    input = text;
  }
  return new Response(
    JSON.stringify({
      type: "message",
      stop_reason,
      content: [
        { type: "thinking", thinking: "" },
        { type: "tool_use", name: "answer", id: "test", input },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function routeGatewayTo(fetch: typeof globalThis.fetch) {
  vi.mocked(generateMessage).mockImplementation(async (payload, options) => {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/messages", {
      method: "POST",
      body: JSON.stringify(payload),
      ...(options?.signal ? { signal: options.signal } : {}),
    });
    if (!res.ok) throw new OperationFailedError("redacted", { httpStatus: res.status });
    return await res.json();
  });
}
function fakeAnthropic(reply: () => Response | Promise<Response>) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => reply());
  routeGatewayTo(fetch);
  return fetch;
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
    expect(STATE_CODES).toEqual([...ENGINE_STATE_CODES, "OTHER"]);
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

describe("gateway failures", () => {
  it.each([
    [429, "busy"],
    [402, "noCredits"],
  ] as const)("returns status %s and each function's own %s message", async (status, key) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = fakeAnthropic(() => new Response("not JSON", { status: Number(status) }));
    const decode = await handleDecodeOffer(post("decode-offer", { text: "Offer" }), {
      apiKey: KEY,
      fetch,
    });
    expect(decode.status).toBe(status);
    expect(await decode.json()).toEqual({ error: DECODE_COPY[key] });
    const explain = await handleExplainStub(
      post("explain-stub", requestFor("chicago-vs-austin", "recommended")),
      { apiKey: KEY, fetch },
    );
    expect(explain.status).toBe(status);
    expect(await explain.json()).toEqual({ error: EXPLAIN_COPY[key] });
    expect(console.error).toHaveBeenCalledWith(status);
  });
  it("rejects valid JSON whose values violate the requested schema", async () => {
    const fields = parseLetter(letterText("cascade.txt"));
    const fetch = fakeAnthropic(() =>
      modelReply(
        JSON.stringify({
          fields: { ...fields, salary: { source: "letter", value: "not a number" } },
        }),
      ),
    );
    const res = await handleDecodeOffer(post("decode-offer", { text: "Offer" }), {
      apiKey: KEY,
      fetch,
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: DECODE_COPY.invalid });
  });
});

describe("decode-offer", () => {
  it("passes both document contents and trusted coverage context through the unchanged HTTP contract", async () => {
    const source = (name: string) =>
      readFileSync(path.resolve(__dirname, "../../data/documents", name), "utf8");
    const offerLetter = source("northfield-offer.txt");
    const benefitsGuide = source("northfield-benefits.txt");
    const expected = parseLetter(`${offerLetter}\n\n${benefitsGuide}`);
    const fetch = fakeAnthropic(() => modelReply(JSON.stringify({ fields: expected })));
    const client = new HttpAIClient(
      { supabaseUrl: "https://ref.supabase.co", publishableKey: "test-public" },
      {
        fetch: async (input, init) =>
          handleDecodeOffer(new Request(String(input), init), { apiKey: KEY, fetch }),
      },
    );
    const result = await client.extractOffer({
      text: buildOfferDocumentText({ offerLetter, benefitsGuide, coverage: "family" }),
    });
    expect(result.fields).toEqual(expected);
    const payload = vi.mocked(generateMessage).mock.calls.at(-1)![0];
    expect(payload.system).toContain("Requested coverage tier: family");
    expect(payload.system).toContain("Never mix tiers");
    expect(payload.system).toContain("contradict each other");
    expect(payload.system).toContain("monthly premium is multiplied by 12");
    const content = payload.messages[0]!.content as string;
    const documents = JSON.parse(content.slice(content.indexOf("\n") + 1));
    expect(documents).toEqual({
      offerLetter: offerLetter.trim(),
      benefitsGuide: benefitsGuide.trim(),
    });
  });

  it("rejects an empty document envelope before calling the gateway", async () => {
    const fetch = fakeAnthropic(() => modelReply("{}"));
    const res = await handleDecodeOffer(
      post("decode-offer", {
        text: JSON.stringify({
          kind: DOCUMENT_KIND,
          coverage: "self",
          offerLetter: " ",
          benefitsGuide: "",
        }),
      }),
      { apiKey: KEY, fetch },
    );
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
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
    vi.mocked(generateMessage).mockRejectedValueOnce(new ConfigurationError("missing"));
    const res = await handleDecodeOffer(post("decode-offer", { text: "Offer" }), {
      apiKey: undefined,
      fetch,
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: DECODE_COPY.notConnected });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls Claude on the gateway with structured JSON and the existing budget", async () => {
    const text = letterText("cascade.txt");
    const fetch = fakeAnthropic(() => modelReply(JSON.stringify({ fields: parseLetter(text) })));
    await handleDecodeOffer(post("decode-offer", { text }), { apiKey: KEY, fetch });
    const calls = vi.mocked(generateMessage).mock.calls;
    const latest = calls.at(-1);
    if (!latest) throw new Error("No model call");
    const [body, options] = latest;
    expect(body.model).toBe(MODEL);
    expect(body.max_tokens).toBe(16000);
    expect(body.tools?.[0]).toMatchObject({ name: "answer", input_schema: EXTRACT_SCHEMA });
    expect(body.tool_choice).toEqual({
      type: "tool",
      name: "answer",
      disable_parallel_tool_use: true,
    });
    expect(body.system).toContain("never guess");
    expect(body.messages[0]?.content).toContain(text);
    expect(options?.maxRetries).toBe(0);
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.apiKey).toBe(KEY);
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
      routeGatewayTo(fetch);
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
    expect(UPSTREAM_TIMEOUT_MS).toBe(18_000);
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
      const fetch = fakeAnthropic(reply);
      await handleDecodeOffer(post("decode-offer", { text }), { apiKey: KEY, fetch });
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

describe("long-document extraction through the gateway contract", () => {
  it("reads every section, carries known pay frequency, and reconciles the guide's final page", async () => {
    vi.mocked(generateMessage).mockClear();
    const missing = () => allMissing("");
    const seen: string[] = [];
    const frequencies: unknown[] = [];
    const letter =
      Array.from(
        { length: 8 },
        (_, i) => `OFFER PAGE ${i + 1}\n${"Employment policy. ".repeat(180)}\n`,
      ).join("\n") + "SALARY_AT_END PAY_FREQUENCY_AT_END";
    const guide =
      Array.from(
        { length: 38 },
        (_, i) => `BENEFITS PAGE ${i + 1}\n${"Fictional benefits policy. ".repeat(140)}\n`,
      ).join("\n") + "HEALTH_PLAN_AT_END";
    vi.mocked(generateMessage).mockImplementation(async (payload) => {
      const data = JSON.parse(String(payload.messages[0]!.content));
      const fields = missing();
      let extra = {};
      if (data.sourceText) {
        seen.push(data.sourceText);
        expect(data.sourceText.length).toBeLessThanOrEqual(20000);
        if (data.sourceText.includes("SALARY_AT_END"))
          fields.salary = { source: "letter", value: 150000 };
        if (data.sourceText.includes("PAY_FREQUENCY_AT_END"))
          fields.payPeriods = { source: "letter", value: 26 };
        if (data.document === "benefits guide") frequencies.push(data.payPeriodsFromOffer);
        if (data.sourceText.includes("HEALTH_PLAN_AT_END")) {
          fields.healthPlans = {
            source: "letter",
            value: [
              {
                id: "ppo",
                name: "Family PPO",
                hsaEligible: false,
                premium: 2400,
                deductible: 1000,
                coinsurance: 0.2,
                oopMax: 5000,
                employerHsa: 0,
              },
            ],
          } as never;
          fields.defaultPlanId = { source: "letter", value: "ppo" };
        }
        extra = { conflicts: [] };
      } else {
        expect(data.candidates.salary).toEqual([150000]);
        expect(data.candidates.payPeriods).toEqual([26]);
        expect(data.candidates.healthPlans[0][0].name).toBe("Family PPO");
        for (const key of FIELD_KEYS)
          if (data.candidates[key]?.length)
            (fields as Record<string, unknown>)[key] = {
              source: "letter",
              value: data.candidates[key][0],
            };
      }
      return {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: "answer", id: "test", input: { fields, ...extra } }],
      } as never;
    });
    const response = await handleDecodeOffer(
      post("decode-offer", {
        text: buildOfferDocumentText({
          offerLetter: letter,
          benefitsGuide: guide,
          coverage: "family",
        }),
      }),
      { apiKey: KEY },
    );
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    const result = validateExtractResult(await response.json())!;
    expect(result.fields.salary).toEqual({ source: "letter", value: 150000 });
    expect(result.fields.healthPlans.source).toBe("letter");
    expect(result.fields.defaultPlanId).toEqual({ source: "letter", value: "ppo" });
    expect(seen.join("\n")).toContain("HEALTH_PLAN_AT_END");
    expect(frequencies.length).toBeGreaterThan(1);
    expect(frequencies.every((f) => f === 26)).toBe(true);
    expect(
      vi.mocked(generateMessage).mock.calls.every(([p]) => String(p.system).includes("family")),
    ).toBe(true);
  });

  it("forces conflicting scalar values to missing even when reconciliation selects a number", async () => {
    const makeFields = (salary?: number) =>
      Object.fromEntries(
        FIELD_KEYS.map((k) => [
          k,
          k === "salary" && salary !== undefined
            ? { source: "letter", value: salary }
            : { source: "missing", value: null, note: "" },
        ]),
      );
    vi.mocked(generateMessage).mockImplementation(async (payload) => {
      const data = JSON.parse(String(payload.messages[0]!.content));
      const section = typeof data.sourceText === "string";
      const salary = section
        ? data.sourceText.includes("SECOND_SALARY")
          ? 140000
          : data.sourceText.includes("FIRST_SALARY")
            ? 150000
            : undefined
        : 150000;
      return {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            name: "answer",
            input: { fields: makeFields(salary), ...(section ? { conflicts: [] } : {}) },
          },
        ],
      } as never;
    });
    const text = buildOfferDocumentText({
      offerLetter: "FIRST_SALARY\n" + "Text ".repeat(9000) + "\nSECOND_SALARY",
      benefitsGuide: "",
      coverage: "self",
    });
    const response = await handleDecodeOffer(post("decode-offer", { text }), { apiKey: KEY });
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    const result = validateExtractResult(await response.json())!;
    expect(result.fields.salary.source).toBe("missing");
    if (result.fields.salary.source === "missing")
      expect(result.fields.salary.note).toContain("Conflicting values");
  });
});

describe("long-document reconciliation guardrails", () => {
  it.each(["invented salary", "conflicting plan terms"])(
    "requires manual review for %s",
    async (scenario) => {
      const plan = (premium: number) => ({
        id: "ppo",
        name: "Shared PPO",
        hsaEligible: false,
        premium,
        deductible: 500,
        coinsurance: 0.2,
        oopMax: 3000,
        employerHsa: 0,
      });
      vi.mocked(generateMessage).mockImplementation(async (payload) => {
        const data = JSON.parse(String(payload.messages[0]!.content));
        const fields = allMissing("");
        const section = typeof data.sourceText === "string";
        const source = section ? data.sourceText : "LOW_PLAN";
        if (!section || source.includes("LOW_PLAN") || source.includes("HIGH_PLAN")) {
          fields.salary = {
            source: "letter",
            value: !section && scenario === "invented salary" ? 9999999 : 150000,
          };
          fields.healthPlans = {
            source: "letter",
            value: [plan(source.includes("HIGH_PLAN") ? 3600 : 2400)],
          };
          fields.defaultPlanId = { source: "letter", value: "ppo" };
        }
        return {
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              name: "answer",
              input: { fields, ...(section ? { conflicts: [] } : {}) },
            },
          ],
        } as never;
      });
      const text = buildOfferDocumentText({
        offerLetter: "",
        benefitsGuide:
          "LOW_PLAN\n" +
          "Policy text. ".repeat(5000) +
          (scenario === "conflicting plan terms" ? "\nHIGH_PLAN" : ""),
        coverage: "self",
      });
      const response = await handleDecodeOffer(post("decode-offer", { text }), { apiKey: KEY });
      expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
      const result = validateExtractResult(await response.json())!;
      if (scenario === "invented salary") expect(result.fields.salary.source).toBe("missing");
      else {
        expect(result.fields.healthPlans.source).toBe("missing");
        expect(result.fields.defaultPlanId.source).toBe("missing");
      }
    },
  );

  it("rejects an excessive section count before starting any gateway calls", async () => {
    vi.mocked(generateMessage).mockClear();
    const response = await handleDecodeOffer(
      post("decode-offer", { text: "\u0001".repeat(100000) }),
      { apiKey: KEY },
    );
    expect(response.status).toBe(400);
    expect(vi.mocked(generateMessage)).not.toHaveBeenCalled();
  });
});
