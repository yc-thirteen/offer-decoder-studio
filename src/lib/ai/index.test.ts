import { describe, expect, it } from "vitest";
import {
  AIError,
  EXTRACT_FIELD_KEYS,
  HttpAIClient,
  MockAIClient,
  aiConfigFromEnv,
  getAIClient,
  type ExtractedFields,
} from "./index";

const URL = "https://example-ref.supabase.co";

describe("getAIClient", () => {
  it("returns the mock client with no env vars", () => {
    const c = getAIClient({});
    expect(c).toBeInstanceOf(MockAIClient);
    expect(c.kind).toBe("mock");
  });

  it("returns the mock client in the test environment (no Cloud vars set)", () => {
    expect(getAIClient().kind).toBe("mock");
  });

  it("needs both the URL and a key", () => {
    expect(getAIClient({ VITE_SUPABASE_URL: URL }).kind).toBe("mock");
    expect(getAIClient({ VITE_SUPABASE_PUBLISHABLE_KEY: "pk" }).kind).toBe("mock");
    expect(getAIClient({ VITE_SUPABASE_URL: "  ", VITE_SUPABASE_PUBLISHABLE_KEY: "pk" }).kind).toBe(
      "mock",
    );
  });

  it("returns the HTTP client with the URL and publishable key", () => {
    const c = getAIClient({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: "pk" });
    expect(c).toBeInstanceOf(HttpAIClient);
    expect((c as HttpAIClient).config).toEqual({ supabaseUrl: URL, publishableKey: "pk" });
  });

  it("accepts the anon key name and prefers the publishable key", () => {
    expect(aiConfigFromEnv({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: "anon" })).toEqual({
      supabaseUrl: URL,
      publishableKey: "anon",
    });
    expect(
      aiConfigFromEnv({
        VITE_SUPABASE_URL: URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: "pk",
        VITE_SUPABASE_ANON_KEY: "anon",
      })?.publishableKey,
    ).toBe("pk");
  });

  it("trims whitespace and trailing slashes from the URL", () => {
    expect(
      aiConfigFromEnv({ VITE_SUPABASE_URL: ` ${URL}// `, VITE_SUPABASE_PUBLISHABLE_KEY: " pk " }),
    ).toEqual({ supabaseUrl: URL, publishableKey: "pk" });
  });

  it("ignores non-string env values", () => {
    expect(
      aiConfigFromEnv({ VITE_SUPABASE_URL: true, VITE_SUPABASE_PUBLISHABLE_KEY: "pk" }),
    ).toBeNull();
  });
});

describe("AI types", () => {
  it("lists every extractable Offer field once", () => {
    expect(new Set(EXTRACT_FIELD_KEYS).size).toBe(EXTRACT_FIELD_KEYS.length);
    // Type-level check: a record keyed by EXTRACT_FIELD_KEYS satisfies ExtractedFields.
    const all = Object.fromEntries(
      EXTRACT_FIELD_KEYS.map((k) => [k, { source: "missing", value: null, note: `No ${k}.` }]),
    ) as unknown as ExtractedFields;
    expect(Object.keys(all).sort()).toEqual([...EXTRACT_FIELD_KEYS].sort());
    expect(all.salary.source).toBe("missing");
    expect(all.salary.value).toBeNull();
  });

  it("unbuilt client methods reject with a directive AIError instead of faking success", async () => {
    const http = new HttpAIClient({ supabaseUrl: URL, publishableKey: "pk" });
    await expect(http.extractOffer()).rejects.toBeInstanceOf(AIError);
    await expect(http.extractOffer()).rejects.toThrow(/by hand/);
    for (const c of [new MockAIClient(), http]) {
      await expect(c.explainStub()).rejects.toBeInstanceOf(AIError);
      await expect(c.explainStub()).rejects.toThrow(/Read the stubs/);
    }
  });
});
