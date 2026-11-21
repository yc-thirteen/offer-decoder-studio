// Keeps docs/AI_SETUP_LOVABLE.md honest: every message, name, and path it quotes
// must match the code, and it must hold no real-looking key.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { READER_COPY } from "@/components/decoder/LetterReader";
import { SUMMARY_COPY } from "@/components/decoder/summaryText";
import { MockAIClient, READER_ERRORS, aiConfigFromEnv } from "@/lib/ai";
import { MODEL } from "../../supabase/functions/_shared/anthropic.ts";
import { DECODE_COPY } from "../../supabase/functions/_shared/decodeOffer.ts";
import { EXPLAIN_COPY } from "../../supabase/functions/_shared/explainStub.ts";

const root = path.resolve(__dirname, "../..");
const doc = readFileSync(path.join(root, "docs/AI_SETUP_LOVABLE.md"), "utf8");

describe("docs/AI_SETUP_LOVABLE.md", () => {
  it("quotes the app's own messages exactly", () => {
    for (const msg of [
      READER_COPY.sampleNote,
      DECODE_COPY.notConnected,
      EXPLAIN_COPY.notConnected,
      DECODE_COPY.empty,
      SUMMARY_COPY.write,
      SUMMARY_COPY.heading,
    ]) {
      expect(doc).toContain(msg);
    }
    expect(doc).toContain(READER_ERRORS.timeout.slice(0, 40));
    expect(doc).toContain(EXPLAIN_COPY.offStub.slice(0, 60));
    expect(doc).toContain(MODEL);
  });

  it("names the functions, secret, and env vars the code uses", () => {
    for (const fn of ["decode-offer", "explain-stub"]) {
      expect(existsSync(path.join(root, "supabase/functions", fn, "index.ts"))).toBe(true);
      const src = readFileSync(path.join(root, "supabase/functions", fn, "index.ts"), "utf8");
      expect(src).toContain('Deno.env.get("LOVABLE_API_KEY")');
      expect(doc).toContain(`supabase/functions/${fn}`);
    }
    expect(doc).toContain("LOVABLE_API_KEY");
    expect(
      aiConfigFromEnv({
        VITE_SUPABASE_URL: "https://x.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "k",
      }),
    ).not.toBeNull();
    expect(doc).toContain("VITE_SUPABASE_URL");
    expect(doc).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
  });

  it("holds no real-looking key", () => {
    expect(doc).not.toMatch(/sk-ant-[A-Za-z0-9_-]{8,}/);
    expect(doc).not.toMatch(/sb_publishable_[A-Za-z0-9_-]{8,}/);
    expect(doc).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });

  it("uses a test letter the sample reader doesn't recognize", async () => {
    const letter = doc.match(/```text\n(Dear Jordan,[\s\S]*?)```/)?.[1];
    expect(letter).toBeTruthy();
    const res = await new MockAIClient().extractOffer({ text: letter! });
    expect(Object.values(res.fields).every((f) => f.source === "missing")).toBe(true);
  });
});
