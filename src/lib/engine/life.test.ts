import { describe, expect, it } from "vitest";
import expectedJson from "../../../harness/fixtures/expected.json";
import sampleCasesJson from "../../data/sampleCases.json";
import { humanCapital, insuredFraction, lifeInsurance } from "./life";
import type { LifeResult, Offer, OfferResult, Profile, SampleCase } from "./types";

// Fixture JSON infers per-case literal unions; cast to the engine types.
const cases = (sampleCasesJson as unknown as { cases: SampleCase[] }).cases;
const expected = (
  expectedJson as unknown as {
    cases: { id: string; offers: Pick<OfferResult, "offerId" | "lifeInsurance">[] }[];
  }
).cases;

const profile: Profile = {
  filingStatus: "mfj",
  otherHouseholdWages: 50_000,
  coverage: "family",
  expectedMedicalSpend: 2_000,
  hasEmergencyFund: true,
  hasHighInterestDebt: false,
  hasDependents: true,
  age: 32,
  currentSavings: 100_000,
};

const offer = (salary: number, basicMultiple = 1, supplementalMaxMultiple = 5): Offer => ({
  id: "t",
  employer: "Test Co",
  city: "Chicago",
  state: "IL",
  salary,
  payPeriods: 26,
  retirement: {
    match: [],
    defaultEmployeePct: 0,
    vesting: { type: "immediate" },
    rothAvailable: false,
  },
  healthPlans: [
    {
      id: "p",
      name: "P",
      hsaEligible: false,
      premium: 0,
      deductible: 0,
      coinsurance: 0,
      oopMax: 0,
      employerHsa: 0,
    },
  ],
  defaultPlanId: "p",
  life: { basicMultiple, supplementalMaxMultiple },
});

describe("humanCapital", () => {
  it("is 0 with no years or no salary", () => {
    expect(humanCapital(100_000, 0, 0.05, 0.1)).toBe(0);
    expect(humanCapital(0, 35, 0.05, 0.1)).toBe(0);
    expect(humanCapital(100_000, -3, 0.05, 0.1)).toBe(0);
  });

  it("one year is one discounted salary", () => {
    expect(humanCapital(100_000, 1, 0.05, 0.1)).toBeCloseTo(100_000 / 1.1, 6);
  });

  it("uses the limit when growth equals the discount rate", () => {
    expect(humanCapital(100_000, 10, 0.1, 0.1)).toBeCloseTo(1_000_000 / 1.1, 6);
  });
});

describe("insuredFraction", () => {
  it("is floored at 0 and is 0 with nothing to insure", () => {
    expect(insuredFraction(1, 3, 0.2)).toBe(0);
    expect(insuredFraction(0.2, 3, 0)).toBe(0);
  });
});

describe("lifeInsurance", () => {
  it("is null without dependents", () => {
    expect(lifeInsurance(offer(100_000), { ...profile, hasDependents: false })).toBeNull();
  });

  it("caps supplemental at the work maximum and tops up individually only to fi × L", () => {
    const res = lifeInsurance(offer(100_000, 1, 2), profile) as LifeResult;
    expect(res.basicCoverage).toBe(100_000);
    expect(res.recommendedSupplemental).toBe(200_000);
    const individual = Math.max(0, res.recommendedCoverageIndividual - 300_000);
    expect(res.recommendedIndividualPolicy).toBeCloseTo(individual, 1);
    expect(res.totalRecommendedCoverage).toBeCloseTo(300_000 + individual, 1);
  });

  it("ignores spouse wages when filing single", () => {
    const single = lifeInsurance(offer(100_000), {
      ...profile,
      filingStatus: "single",
    }) as LifeResult;
    expect(single.householdWealth).toBeCloseTo(single.humanCapital + 100_000, 1);
  });

  it("is 0 coverage, not NaN, at or past retirement age", () => {
    const res = lifeInsurance(offer(100_000), { ...profile, age: 70 }) as LifeResult;
    expect(res.humanCapital).toBe(0);
    expect(res.fractionEmployer).toBe(0);
    expect(res.recommendedSupplemental).toBe(0);
    expect(res.recommendedIndividualPolicy).toBe(0);
  });

  it("recomputes with slider overrides (higher risk aversion → more coverage)", () => {
    const base = lifeInsurance(offer(100_000), profile) as LifeResult;
    const cautious = lifeInsurance(offer(100_000), profile, { riskAversion: 6 }) as LifeResult;
    expect(cautious.fractionEmployer).toBeGreaterThan(base.fractionEmployer);
    const cheap = lifeInsurance(offer(100_000), profile, { individualMarkup: 0.2 }) as LifeResult;
    expect(cheap.fractionIndividual).toBe(base.fractionEmployer);
  });

  describe("matches expected.json for all 12 offers (within $1)", () => {
    for (const c of cases) {
      const exp = expected.find((e) => e.id === c.id)!;
      for (const o of c.offers) {
        it(`${c.id} / ${o.id}`, () => {
          const want = exp.offers.find((e) => e.offerId === o.id)!.lifeInsurance;
          const got = lifeInsurance(o, c.profile);
          if (want === null) {
            expect(got).toBeNull();
            return;
          }
          expect(got).not.toBeNull();
          for (const [k, v] of Object.entries(want)) {
            expect(Math.abs((got as LifeResult)[k as keyof LifeResult] - v), k).toBeLessThanOrEqual(
              1,
            );
          }
        });
      }
    }
  });
});
