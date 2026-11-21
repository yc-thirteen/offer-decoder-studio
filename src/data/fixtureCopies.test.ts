import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The app bundles copies of the harness fixtures (src/ cannot import from
// harness/ at runtime). These tests keep the copies byte-identical.
const root = path.resolve(__dirname, "../..");
const fixtures = path.join(root, "harness/fixtures");
const data = path.join(root, "src/data");

function sameBytes(a: string, b: string) {
  return readFileSync(a).equals(readFileSync(b));
}

describe("fixture copies in src/data", () => {
  it("sampleCases.json is byte-identical to harness/fixtures/cases.json", () => {
    expect(sameBytes(path.join(fixtures, "cases.json"), path.join(data, "sampleCases.json"))).toBe(
      true,
    );
  });

  const letterFiles = readdirSync(path.join(fixtures, "letters")).sort();

  it("src/data/letters holds exactly the fixture letter files", () => {
    expect(letterFiles.length).toBeGreaterThan(0);
    expect(readdirSync(path.join(data, "letters")).sort()).toEqual(letterFiles);
  });

  it.each(letterFiles)("letters/%s is byte-identical", (file) => {
    expect(sameBytes(path.join(fixtures, "letters", file), path.join(data, "letters", file))).toBe(
      true,
    );
  });
});
