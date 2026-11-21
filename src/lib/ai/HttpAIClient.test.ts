import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import sampleCases from "@/data/sampleCases.json";
import { runCase, type Offer, type Profile } from "@/lib/engine";
import {
  AIError,
  AI_TIMEOUT_MS,
  HttpAIClient,
  INVALID_EXPLAIN_REQUEST,
  MISSING_NOTES,
  READER_ERRORS,
  SUMMARY_ERRORS,
  buildExplainRequest,
  parseLetter,
  validateExtractResult,
  type ExplainRequest,
} from "./index";

const URL = "https://example-ref.supabase.co";
const KEY = "pk-test";
const config = { supabaseUrl: URL, publishableKey: KEY };

type CaseJson = { id: string; profile: Profile; offers: Offer[] };
const cases = (sampleCases as unknown as { cases: CaseJson[] }).cases;

function explainRequest(): ExplainRequest {
  const c = cases.find((x) => x.id === "chicago-vs-austin")!;
  const r = runCase(c);
  return buildExplainRequest(
    c.offers.map((offer, i) => ({ offer, result: r.offers[i]! })),
    { default: r.winnerBy_default, recommended: r.winnerBy_recommended },
    "recommended",
  );
}

const letterFields = () =>
  JSON.parse(
    JSON.stringify(
      parseLetter(
        readFileSync(path.resolve(__dirname, "../../data/letters/northfield.txt"), "utf8"),
      ),
    ),
  );

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** A fetch that never resolves until its signal aborts, like a hung server. */
const hangingFetch = vi.fn(
  (_url: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      );
    }),
);

afterEach(() => {
  vi.useRealTimers();
  hangingFetch.mockClear();
});

describe("HttpAIClient requests", () => {
  it("POSTs the letter to decode-offer with the publishable key headers", async () => {
    const fields = letterFields();
    const fetch = vi.fn(async () => json({ fields }));
    const client = new HttpAIClient(config, { fetch });
    const result = await client.extractOffer({ text: "Northfield letter text" });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${URL}/functions/v1/decode-offer`);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
    });
    expect(JSON.parse(init.body as string)).toEqual({ text: "Northfield letter text" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({ fields });
  });

  it("POSTs the engine numbers to explain-stub and returns the trimmed summary", async () => {
    const req = explainRequest();
    const fetch = vi.fn(async () => json({ summary: "  Austin comes out ahead.  " }));
    const client = new HttpAIClient(config, { fetch });
    expect(await client.explainStub(req)).toEqual({ summary: "Austin comes out ahead." });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${URL}/functions/v1/explain-stub`);
    expect(JSON.parse(init.body as string)).toEqual(req);
  });

  it("rejects bad input before any request", async () => {
    const fetch = vi.fn(async () => json({}));
    const client = new HttpAIClient(config, { fetch });
    await expect(client.extractOffer({ text: "   " })).rejects.toThrow(/letter is empty/);
    await expect(client.explainStub({ ...explainRequest(), offers: [] })).rejects.toThrow(
      INVALID_EXPLAIN_REQUEST,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses a 20 second timeout by default", () => {
    expect(AI_TIMEOUT_MS).toBe(20_000);
  });
});

describe("HttpAIClient failures", () => {
  it("times out after 20 seconds with a directive message", async () => {
    vi.useFakeTimers();
    const client = new HttpAIClient(config, { fetch: hangingFetch });
    const p = client.extractOffer({ text: "letter" });
    const caught = p.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS - 1);
    expect(hangingFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const err = await caught;
    expect(err).toBeInstanceOf(AIError);
    expect((err as AIError).message).toBe(READER_ERRORS.timeout);

    const s = new HttpAIClient(config, { fetch: hangingFetch }).explainStub(explainRequest());
    const sc = s.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS);
    expect(((await sc) as AIError).message).toBe(SUMMARY_ERRORS.timeout);
  });

  it("says cancelled when the caller aborts, before or during the request", async () => {
    const client = new HttpAIClient(config, { fetch: hangingFetch });
    const pre = new AbortController();
    pre.abort();
    await expect(client.extractOffer({ text: "letter" }, pre.signal)).rejects.toThrow(
      READER_ERRORS.cancelled,
    );
    expect(hangingFetch).not.toHaveBeenCalled();

    const mid = new AbortController();
    const p = client.explainStub(explainRequest(), mid.signal);
    mid.abort();
    await expect(p).rejects.toThrow(SUMMARY_ERRORS.cancelled);
  });

  it("turns a network failure into a directive message", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const client = new HttpAIClient(config, { fetch });
    await expect(client.extractOffer({ text: "letter" })).rejects.toThrow(READER_ERRORS.network);
    await expect(client.explainStub(explainRequest())).rejects.toThrow(SUMMARY_ERRORS.network);
  });

  it("shows the function's own error on a failing status, or a directive fallback", async () => {
    const msg = "The letter is too long. Paste only the offer details.";
    const client400 = new HttpAIClient(config, {
      fetch: vi.fn(async () => json({ error: msg }, 400)),
    });
    await expect(client400.extractOffer({ text: "letter" })).rejects.toThrow(msg);

    const client500 = new HttpAIClient(config, {
      fetch: vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 })),
    });
    await expect(client500.extractOffer({ text: "letter" })).rejects.toThrow(READER_ERRORS.failed);
    await expect(client500.explainStub(explainRequest())).rejects.toThrow(SUMMARY_ERRORS.failed);

    const longErr = new HttpAIClient(config, {
      fetch: vi.fn(async () => json({ error: "x".repeat(500) }, 500)),
    });
    await expect(longErr.extractOffer({ text: "letter" })).rejects.toThrow(READER_ERRORS.failed);
  });

  it("rejects a response of the wrong shape instead of showing it", async () => {
    for (const body of [
      {},
      { fields: null },
      { fields: { salary: { source: "letter", value: 1 } } },
    ]) {
      const client = new HttpAIClient(config, { fetch: vi.fn(async () => json(body)) });
      await expect(client.extractOffer({ text: "letter" })).rejects.toThrow(READER_ERRORS.invalid);
    }
    for (const body of [{}, { summary: "" }, { summary: 4 }]) {
      const client = new HttpAIClient(config, { fetch: vi.fn(async () => json(body)) });
      await expect(client.explainStub(explainRequest())).rejects.toThrow(SUMMARY_ERRORS.invalid);
    }
    const notJson = new HttpAIClient(config, {
      fetch: vi.fn(async () => new Response("not json", { status: 200 })),
    });
    await expect(notJson.extractOffer({ text: "letter" })).rejects.toThrow(READER_ERRORS.invalid);
  });
});

describe("validateExtractResult", () => {
  it("accepts a parsed sample letter unchanged", () => {
    const fields = letterFields();
    expect(validateExtractResult({ fields })).toEqual({ fields });
  });

  it("downgrades a mistyped letter value to missing with the directive note", () => {
    const fields = letterFields();
    fields.salary = { source: "letter", value: "lots" };
    fields.state = { source: "letter", value: "CA" };
    fields.healthPlans = { source: "letter", value: [{ id: "ppo", name: "PPO" }] };
    const out = validateExtractResult({ fields })!;
    expect(out.fields.salary).toEqual({
      source: "missing",
      value: null,
      note: MISSING_NOTES.salary,
    });
    expect(out.fields.state).toEqual({ source: "missing", value: null, note: MISSING_NOTES.state });
    expect(out.fields.healthPlans.source).toBe("missing");
    expect(out.fields.employer.source).toBe("letter");
  });

  it("drops a value from a missing field and keeps or supplies its note", () => {
    const fields = letterFields();
    fields.salary = { source: "missing", value: 90000, note: "No salary stated. Type it here." };
    fields.city = { source: "missing", value: null };
    const out = validateExtractResult({ fields })!;
    expect(out.fields.salary).toEqual({
      source: "missing",
      value: null,
      note: "No salary stated. Type it here.",
    });
    expect(out.fields.city).toEqual({ source: "missing", value: null, note: MISSING_NOTES.city });
  });

  it("marks a default plan that isn't one of the letter's plans as missing", () => {
    const fields = letterFields();
    fields.defaultPlanId = { source: "letter", value: "no-such-plan" };
    expect(validateExtractResult({ fields })!.fields.defaultPlanId.source).toBe("missing");
  });
});
