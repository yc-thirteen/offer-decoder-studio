import { describe, expect, it } from "vitest";
import {
  canonicalValue,
  documentSections,
  readSections,
} from "../../supabase/functions/_shared/documentSections";

describe("complete document sections", () => {
  it("covers an eight-page letter and 38-page guide through the last character", () => {
    for (const pages of [8, 38]) {
      const text =
        Array.from(
          { length: pages },
          (_, i) => `PAGE ${i + 1}\n${"Fictional policy details. ".repeat(150)}\nEND ${i + 1}\n`,
        ).join("\n") + "LAST BENEFIT VALUE";
      const sections = documentSections(text);
      let covered = 0;
      for (const section of sections) {
        const start = text.indexOf(section);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(start).toBeLessThanOrEqual(covered);
        covered = Math.max(covered, start + section.length);
        expect(JSON.stringify(section).length).toBeLessThanOrEqual(30000);
      }
      expect(covered).toBe(text.length);
      expect(sections.at(-1)).toContain("LAST BENEFIT VALUE");
    }
  });

  it("bounds escaped input too, and deduplicates objects irrespective of key order", () => {
    expect(documentSections(" ")).toEqual([]);
    const sections = documentSections('quoted"\u0001\\\n'.repeat(6000));
    expect(sections.every((s) => JSON.stringify(s).length <= 30000)).toBe(true);
    expect(canonicalValue({ x: 1, y: [2, 3] })).toBe(canonicalValue({ y: [2, 3], x: 1 }));
    expect(canonicalValue({ x: 1 })).not.toBe(canonicalValue({ x: 2 }));
  });

  it("uses at most three workers and preserves source order", async () => {
    let active = 0;
    let maximum = 0;
    const result = await readSections(
      ["a", "b", "c", "d", "e"],
      async (s, i) => {
        maximum = Math.max(maximum, ++active);
        await Promise.resolve();
        active--;
        return `${i}:${s}`;
      },
      new AbortController().signal,
    );
    expect(maximum).toBe(3);
    expect(result).toEqual(["0:a", "1:b", "2:c", "3:d", "4:e"]);
    const controller = new AbortController();
    controller.abort();
    await expect(readSections(["a"], async () => "wrong", controller.signal)).rejects.toThrow(
      "cancelled",
    );
  });
});
