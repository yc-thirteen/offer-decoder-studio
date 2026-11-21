import { describe, expect, it } from "vitest";
import expectedJson from "../../../harness/fixtures/expected.json";
import sampleCasesJson from "../../data/sampleCases.json";
import {
  employee401kDollars,
  employerMatch,
  fullMatchDollars,
  hitsLimit401k,
  matchCapPct,
  maxMatchPct,
  vestedPct,
  vestedPctByYear,
} from "./retirement";
import type { CalcResult, MatchTier, Offer, OfferResult, SampleCase } from "./types";

// Fixture JSON infers per-case literal unions; cast to the engine types.
const cases = (sampleCasesJson as unknown as { cases: SampleCase[] }).cases;
const expected = (
  expectedJson as unknown as {
    cases: {
      id: string;
      offers: (Pick<
        OfferResult,
        "offerId" | "matchCapPct" | "maxMatchPctOfSalary" | "vestedPctByYear"
      > & {
        default: CalcResult;
        recommended: CalcResult;
      })[];
    }[];
  }
).cases;

const offerWith = (match: MatchTier[], salary = 100_000): Offer =>
  ({
    id: "o",
    salary,
    retirement: {
      match,
      defaultEmployeePct: 0,
      vesting: { type: "immediate" },
      rothAvailable: false,
    },
  }) as unknown as Offer;

describe("match tiers", () => {
  it("7B example: 50% match up to 6% of pay, so 6% in gets 9% total", () => {
    const o = offerWith([{ rate: 0.5, upToPct: 6 }]);
    const mine = employee401kDollars(o, 6);
    const match = employerMatch(o, mine);
    expect(mine).toBe(6_000);
    expect(match).toBeCloseTo(3_000, 6);
    expect((100 * (mine + match)) / o.salary).toBeCloseTo(9, 6);
    expect(maxMatchPct(o)).toBeCloseTo(3, 6);
  });

  it("cumulative bands: 100% on the first 3% and 50% on the next 2%", () => {
    const o = offerWith([
      { rate: 0.5, upToPct: 5 },
      { rate: 1, upToPct: 3 },
    ]); // deliberately unsorted
    expect(matchCapPct(o)).toBe(5);
    expect(employerMatch(o, 2_000)).toBeCloseTo(2_000, 6); // 2% in, all in the 100% band
    expect(employerMatch(o, 3_000)).toBeCloseTo(3_000, 6);
    expect(employerMatch(o, 4_000)).toBeCloseTo(3_500, 6); // 3% at 100% + 1% at 50%
    expect(employerMatch(o, 5_000)).toBeCloseTo(4_000, 6);
    expect(employerMatch(o, 10_000)).toBeCloseTo(4_000, 6); // nothing above the cap
    expect(fullMatchDollars(o)).toBeCloseTo(4_000, 6);
    expect(maxMatchPct(o)).toBeCloseTo(4, 6);
  });

  it("no contribution, no match; no tiers, no match", () => {
    expect(employerMatch(offerWith([{ rate: 1, upToPct: 4 }]), 0)).toBe(0);
    const none = offerWith([]);
    expect(matchCapPct(none)).toBe(0);
    expect(employerMatch(none, 5_000)).toBe(0);
    expect(maxMatchPct(none)).toBe(0);
  });

  it("the match is on capped dollars, so a high earner at the 401(k) limit gets less than the % implies", () => {
    const o = offerWith([{ rate: 1, upToPct: 10 }], 300_000);
    expect(employee401kDollars(o, 10)).toBe(24_500);
    expect(hitsLimit401k(o, 10)).toBe(true);
    expect(employerMatch(o, employee401kDollars(o, 10))).toBeCloseTo(24_500, 6);
    expect(fullMatchDollars(o)).toBeCloseTo(30_000, 6);
  });

  it("the 401(k) limit binds only strictly above 24,500", () => {
    const o = offerWith([], 245_000);
    expect(employee401kDollars(o, 10)).toBe(24_500);
    expect(hitsLimit401k(o, 10)).toBe(false);
    expect(hitsLimit401k(o, 10.01)).toBe(true);
  });
});

describe("vesting", () => {
  it("immediate is always 100%", () => {
    expect(vestedPctByYear({ type: "immediate" })).toEqual([100, 100, 100, 100, 100, 100, 100]);
  });

  it("cliff jumps from 0 to 100 at the cliff year", () => {
    expect(vestedPctByYear({ type: "cliff", years: 3 })).toEqual([0, 0, 0, 100, 100, 100, 100]);
    expect(vestedPct({ type: "cliff", years: 3 }, 2.99)).toBe(0);
  });

  it("graded steps hold their percent until the next step", () => {
    const v = {
      type: "graded" as const,
      schedule: [
        { year: 2, pct: 20 },
        { year: 3, pct: 40 },
        { year: 4, pct: 60 },
        { year: 5, pct: 80 },
        { year: 6, pct: 100 },
      ],
    };
    expect(vestedPctByYear(v)).toEqual([0, 0, 20, 40, 60, 80, 100]);
  });
});

describe("fixtures (harness/fixtures/expected.json)", () => {
  for (const c of cases) {
    const exp = expected.find((e) => e.id === c.id)!;
    for (const offer of c.offers) {
      const eo = exp.offers.find((o) => o.offerId === offer.id)!;

      it(`${c.id} / ${offer.id}: match cap, max match %, vesting, match dollars`, () => {
        expect(matchCapPct(offer)).toBe(eo.matchCapPct);
        expect(Math.abs(maxMatchPct(offer) - eo.maxMatchPctOfSalary)).toBeLessThanOrEqual(0.01);
        expect(vestedPctByYear(offer.retirement.vesting)).toEqual(eo.vestedPctByYear);
        for (const calc of [eo.default, eo.recommended]) {
          const dollars = employee401kDollars(offer, calc.employeePct);
          expect(Math.abs(dollars - calc.employee401k)).toBeLessThanOrEqual(1);
          expect(hitsLimit401k(offer, calc.employeePct)).toBe(calc.hitsLimit401k);
          expect(Math.abs(employerMatch(offer, dollars) - calc.employerMatch)).toBeLessThanOrEqual(
            1,
          );
        }
      });
    }
  }
});
