import { describe, expect, it } from "vitest";
import checks from "../../../harness/fixtures/lecture-checks.json";
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

  // Added with life.ts (Phase 1): humanCapital100k35yrs, lifeFractionEmployer, lifeFractionIndividual.
  it.todo(`human capital of $100k over 35 years ≈ $1.6M (${checks.humanCapital100k35yrs.slide})`);
  it.todo(
    `life fraction 0.90 through work vs 0.48 individually (${checks.lifeFractionEmployer.slide})`,
  );
});
