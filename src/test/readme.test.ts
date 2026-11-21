// Keeps README.md honest: every path, npm script, env var, and model it names must exist.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MODEL } from "../../supabase/functions/_shared/anthropic.ts";
import cases from "@/data/sampleCases.json";

const root = path.resolve(__dirname, "../..");
const readme = readFileSync(path.join(root, "README.md"), "utf8");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("README.md", () => {
  it("names only repo paths that exist", () => {
    const paths = [
      ...readme.matchAll(/`((?:src|harness|supabase|scripts|docs|public)\/[^`\s]*)`/g),
    ].map((m) => m[1] ?? "");
    const links = [...readme.matchAll(/\]\(((?!https?:)[^)]+)\)/g)].map((m) => m[1] ?? "");
    expect(paths.length).toBeGreaterThan(5);
    for (const p of [...paths, ...links]) {
      // Screenshot output is gitignored, so it doesn't exist in a fresh clone.
      if (p.startsWith("harness/shots/")) continue;
      expect(existsSync(path.join(root, p)), p).toBe(true);
    }
  });

  it("names only npm scripts that exist", () => {
    const scripts = [...readme.matchAll(/`npm (?:run )?([a-z:]+)`/g)].map((m) => m[1] ?? "");
    expect(scripts).toContain("verify");
    for (const s of scripts) {
      if (s === "install" || s === "test") continue;
      expect(pkg.scripts[s], s).toBeTruthy();
    }
    expect(pkg.scripts["test"]).toBeTruthy();
  });

  it("matches the AI switch, secret, and model", () => {
    for (const name of [
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "ANTHROPIC_API_KEY",
    ]) {
      expect(readme).toContain(name);
    }
    expect(readme).toContain(MODEL);
  });

  it("lists all six samples by title", () => {
    for (const c of cases.cases) {
      expect(readme).toContain(c.title);
    }
  });

  it("holds no real-looking key", () => {
    expect(readme).not.toMatch(/sk-ant-[A-Za-z0-9_-]{8,}/);
    expect(readme).not.toMatch(/sb_publishable_[A-Za-z0-9_-]{8,}/);
    expect(readme).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });
});
