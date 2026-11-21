import { describe, expect, it } from "vitest";
import checks from "../../../harness/fixtures/lecture-checks.json";
import { humanCapital, insuredFraction } from "./life";
import { incomeTax } from "./tax";

// Numbers printed on the lecture slides (harness/fixtures/lecture-checks.json).
describe("lecture-checks", () => {
  it(`MFJ tax on $150,000 taxable is $22,424 (${checks.mfjTaxOn150kTaxable.slide})`, () => {
    expect(incomeTax(150_000, "mfj")).toBeCloseTo(checks.mfjTaxOn150kTaxable.expected, 2);
  });

  it(`MFJ average rate on $150,000 is 15% (${checks.mfjAverageRateOn150k.slide})`, () => {
    const avg = Math.round((incomeTax(150_000, "mfj") / 150_000) * 100) / 100;
    expect(avg).toBe(checks.mfjAverageRateOn150k.expected);
  });

  it(`MFJ tax at the top of the 22% bracket is $35,932 (${checks.mfjTaxAtTopOf22Bracket.slide})`, () => {
    expect(incomeTax(211_400, "mfj")).toBeCloseTo(checks.mfjTaxAtTopOf22Bracket.expected, 2);
  });

  it(`single tax on $9,525 is $952.50 (${checks.singleTaxOn9525.slide})`, () => {
    expect(incomeTax(9_525, "single")).toBeCloseTo(checks.singleTaxOn9525.expected, 2);
  });

  // 7A slide 27: $100k growing 5%, discounted 10%, over 35 years.
  const L = humanCapital(100_000, 35, 0.05, 0.1);
  // 7A slide 28: spouse earns $50k over the same horizon, plus $100k of savings.
  const W = L + humanCapital(50_000, 35, 0.05, 0.1) + 100_000;

  it(`human capital of $100k over 35 years ≈ $1.6M (${checks.humanCapital100k35yrs.slide})`, () => {
    const c = checks.humanCapital100k35yrs;
    // The oracle's own value (1,607,435.08) sits $7,435 from 1.6M, outside the fixture's
    // ±5,000, so that tolerance can't be met by engine.py either. Assert the stricter
    // thing — the oracle's number within $1 — and that it reads "$1.6M" at the slide's
    // printed precision (nearest $0.1M).
    expect(Math.abs(L - c.got)).toBeLessThanOrEqual(1);
    expect(Math.round(L / 100_000) * 100_000).toBe(c.expected);
  });

  it(`life fraction 0.90 through work vs 0.48 individually (${checks.lifeFractionEmployer.slide})`, () => {
    const fe = insuredFraction(0.2, 3, L / W);
    const fi = insuredFraction(1, 3, L / W);
    expect(Math.abs(fe - checks.lifeFractionEmployer.expected)).toBeLessThanOrEqual(
      checks.lifeFractionEmployer.tolerance,
    );
    expect(Math.abs(fi - checks.lifeFractionIndividual.expected)).toBeLessThanOrEqual(
      checks.lifeFractionIndividual.tolerance,
    );
  });
});
