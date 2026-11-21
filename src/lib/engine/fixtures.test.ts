import { describe, expect, it } from "vitest";
import expectedJson from "../../../harness/fixtures/expected.json";
import sampleCasesJson from "../../data/sampleCases.json";
import { runCase } from "./index";
import type { SampleCase } from "./types";

// Fixture JSON infers per-case literal unions; cast to loose types.
const cases = (sampleCasesJson as unknown as { cases: SampleCase[] }).cases;
const expected = expectedJson as unknown as {
  toleranceDollars: number;
  cases: ({ id: string } & Record<string, unknown>)[];
};
const DOLLARS = expected.toleranceDollars; // $1

/**
 * Ratios get a tolerance that fits their scale; $1 would accept any rate at all.
 * Fractions (0–1) to 0.0001, percents to 0.01 (they are stored at 2 dp).
 */
const TOLERANCE: Record<string, number> = {
  federalMarginalRate: 1e-4,
  lossShare: 1e-4,
  fractionEmployer: 1e-4,
  fractionIndividual: 1e-4,
  federalAverageRateOnJob: 0.01,
  maxMatchPctOfSalary: 0.01,
  matchCapPct: 0.01,
  employeePct: 0.01,
};

/** Every difference between got and want, as "path: got … want …". Keys must match exactly. */
function diff(got: unknown, want: unknown, path: string, key = ""): string[] {
  if (typeof want === "number") {
    if (typeof got !== "number" || !Number.isFinite(got))
      return [`${path}: got ${got}, want ${want}`];
    const tol = TOLERANCE[key] ?? DOLLARS;
    return Math.abs(got - want) <= tol ? [] : [`${path}: got ${got}, want ${want} (±${tol})`];
  }
  if (want === null || typeof want !== "object") {
    // Strings (ids, account types) and booleans are exact.
    return got === want
      ? []
      : [`${path}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`];
  }
  if (Array.isArray(want)) {
    if (!Array.isArray(got)) return [`${path}: got ${JSON.stringify(got)}, want an array`];
    if (got.length !== want.length) return [`${path}: length ${got.length}, want ${want.length}`];
    return want.flatMap((w, i) => diff(got[i], w, `${path}[${i}]`, key));
  }
  if (got === null || typeof got !== "object" || Array.isArray(got)) {
    return [`${path}: got ${JSON.stringify(got)}, want an object`];
  }
  const g = got as Record<string, unknown>;
  const w = want as Record<string, unknown>;
  const out: string[] = [];
  for (const k of Object.keys(g)) if (!(k in w)) out.push(`${path}.${k}: unexpected key`);
  for (const k of Object.keys(w)) {
    if (!(k in g)) out.push(`${path}.${k}: missing`);
    else out.push(...diff(g[k], w[k], `${path}.${k}`, k));
  }
  return out;
}

describe("fixtures: runCase matches harness/fixtures/expected.json", () => {
  it("has the same 6 cases in the same order", () => {
    expect(cases.map((c) => c.id)).toEqual(expected.cases.map((c) => c.id));
    expect(cases).toHaveLength(6);
    expect(cases.flatMap((c) => c.offers)).toHaveLength(12);
  });

  for (const want of expected.cases) {
    it(`${want.id}: every field of every offer`, () => {
      const c = cases.find((x) => x.id === want.id);
      expect(c, `sample case ${want.id}`).toBeDefined();
      const got = runCase(c as SampleCase);
      expect(diff(got, want, want.id)).toEqual([]);
    });
  }

  it("the comparer catches a wrong number, a wrong id and a missing key", () => {
    const want = { a: 10, id: "x", ok: true, xs: [1, 2], rate: 0.22 };
    expect(diff({ a: 10.9, id: "x", ok: true, xs: [1, 2], rate: 0.22 }, want, "t")).toEqual([]);
    expect(diff({ a: 11.5, id: "x", ok: true, xs: [1, 2], rate: 0.22 }, want, "t")).toHaveLength(1);
    expect(diff({ a: 10, id: "y", ok: true, xs: [1, 2], rate: 0.22 }, want, "t")).toHaveLength(1);
    expect(diff({ a: 10, id: "x", ok: false, xs: [1, 2], rate: 0.22 }, want, "t")).toHaveLength(1);
    expect(diff({ a: 10, id: "x", ok: true, xs: [1], rate: 0.22 }, want, "t")).toHaveLength(1);
    expect(diff({ a: 10, id: "x", ok: true, xs: [1, 2] }, want, "t")).toHaveLength(1);
    expect(diff({ federalMarginalRate: 0.24 }, { federalMarginalRate: 0.22 }, "t")).toHaveLength(1);
  });
});
