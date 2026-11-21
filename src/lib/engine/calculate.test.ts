import { describe, expect, it } from "vitest";
import expectedJson from "../../../harness/fixtures/expected.json";
import sampleCasesJson from "../../data/sampleCases.json";
import { calculate, defaultElections, findPlan, otherWages, r2 } from "./calculate";
import type { CalcResult, Elections, Offer, OfferResult, Profile, SampleCase } from "./types";

// Fixture JSON infers per-case literal unions; cast to the engine types.
const cases = (sampleCasesJson as unknown as { cases: SampleCase[] }).cases;
const expected = (
  expectedJson as unknown as {
    cases: {
      id: string;
      offers: Pick<OfferResult, "offerId" | "recommendedElections" | "default" | "recommended">[];
    }[];
  }
).cases;

const profile: Profile = {
  filingStatus: "single",
  otherHouseholdWages: 0,
  coverage: "self",
  expectedMedicalSpend: 2_000,
  hasEmergencyFund: true,
  hasHighInterestDebt: false,
  hasDependents: false,
  age: 30,
  currentSavings: 0,
};

const offer: Offer = {
  id: "t",
  employer: "Test Co",
  city: "Chicago",
  state: "IL",
  salary: 100_000,
  payPeriods: 26,
  retirement: {
    match: [{ rate: 1, upToPct: 4 }],
    defaultEmployeePct: 0,
    vesting: { type: "immediate" },
    rothAvailable: true,
  },
  healthPlans: [
    {
      id: "hdhp",
      name: "HDHP",
      hsaEligible: true,
      premium: 1_000,
      deductible: 3_000,
      coinsurance: 0.2,
      oopMax: 6_000,
      employerHsa: 500,
    },
    {
      id: "ppo",
      name: "PPO",
      hsaEligible: false,
      premium: 2_000,
      deductible: 500,
      coinsurance: 0.1,
      oopMax: 3_000,
      employerHsa: 500,
    },
  ],
  defaultPlanId: "ppo",
  life: { basicMultiple: 1, supplementalMaxMultiple: 3 },
};

const el = (e: Partial<Elections>): Elections => ({ ...defaultElections(offer), ...e });

describe("calculate (4B pay calculation)", () => {
  it("defaults: default plan, default %, traditional, no HSA", () => {
    expect(defaultElections(offer)).toEqual({
      planId: "ppo",
      employeePct: 0,
      accountType: "traditional",
      employeeHsa: 0,
    });
  });

  it("section 125 cuts income and payroll tax; traditional 401(k) cuts income tax only", () => {
    const r = calculate(offer, profile, el({ employeePct: 6 }));
    // federal wages = 100,000 − 6,000 − 2,000 premium; payroll wages = 98,000
    expect(r.socialSecurity).toBeCloseTo(0.062 * 98_000, 2);
    expect(r.medicare).toBeCloseTo(0.0145 * 98_000, 2);
    expect(r.stateIncomeTax).toBeCloseTo(0.0495 * 92_000, 2);
    expect(r.traditional401k).toBe(6_000);
    expect(r.roth401k).toBe(0);
  });

  it("Roth reduces neither tax", () => {
    const trad = calculate(offer, profile, el({ employeePct: 6 }));
    const roth = calculate(offer, profile, el({ employeePct: 6, accountType: "roth" }));
    expect(roth.socialSecurity).toBe(trad.socialSecurity);
    expect(roth.federalIncomeTax).toBeGreaterThan(trad.federalIncomeTax);
    expect(roth.stateIncomeTax).toBeCloseTo(0.0495 * 98_000, 2);
    expect(roth.roth401k).toBe(6_000);
  });

  it("employee HSA is ignored on a plan that is not HSA-eligible", () => {
    const r = calculate(offer, profile, el({ employeeHsa: 1_000 }));
    expect(r.employeeHsa).toBe(0);
    expect(r.employerHsa).toBe(0);
  });

  it("bottom line = net + savings after future tax − expected out-of-pocket", () => {
    const r = calculate(offer, profile, el({ planId: "hdhp", employeePct: 4, employeeHsa: 3_900 }));
    expect(r.employerMatch).toBe(4_000);
    expect(r.employerHsa).toBe(500);
    expect(r.expectedOutOfPocket).toBe(2_000);
    expect(r.savingsInYourName).toBe(4_000 + 4_000 + 3_900 + 500);
    expect(r.savingsAfterFutureTax).toBeCloseTo(8_000 * 0.85 + 3_900 + 500, 2);
    expect(r.bottomLine).toBeCloseTo(r.netPay + r.savingsAfterFutureTax - 2_000, 1);
    expect(r.netPayPerPaycheck).toBeCloseTo(r.netPay / 26, 1);
  });

  it("caps 401(k) dollars at 24,500 and flags the limit", () => {
    const r = calculate({ ...offer, salary: 300_000 }, profile, el({ employeePct: 10 }));
    expect(r.employee401k).toBe(24_500);
    expect(r.hitsLimit401k).toBe(true);
  });

  it("spouse wages count only when filing jointly", () => {
    expect(otherWages({ ...profile, otherHouseholdWages: 50_000 })).toBe(0);
    expect(otherWages({ ...profile, filingStatus: "mfj", otherHouseholdWages: 50_000 })).toBe(
      50_000,
    );
  });

  it("unknown plan id throws a directive message", () => {
    expect(() => findPlan(offer, "nope")).toThrow(/Choose one of this offer's health plans/);
  });

  it("r2 rounds to cents", () => {
    expect(r2(1.005)).toBe(1.01);
    expect(r2(2.344)).toBe(2.34);
  });
});

const KEYS = Object.keys(expected[0]!.offers[0]!.default) as (keyof CalcResult)[];

function expectCalcMatches(got: CalcResult, want: CalcResult) {
  for (const k of KEYS) {
    const g = got[k];
    const w = want[k];
    if (typeof w === "number") {
      expect(Math.abs((g as number) - w), k).toBeLessThanOrEqual(1);
    } else {
      expect(g, k).toBe(w);
    }
  }
}

describe("calculate vs expected.json", () => {
  for (const c of cases) {
    const exp = expected.find((e) => e.id === c.id)!;
    for (const o of c.offers) {
      const eo = exp.offers.find((x) => x.offerId === o.id)!;
      it(`${c.id} / ${o.id}: default and recommended within $1`, () => {
        expectCalcMatches(calculate(o, c.profile, defaultElections(o)), eo.default);
        expectCalcMatches(calculate(o, c.profile, eo.recommendedElections), eo.recommended);
      });
    }
  }
});
