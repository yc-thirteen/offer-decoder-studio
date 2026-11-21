import { describe, expect, it } from "vitest";
import expectedJson from "../../../harness/fixtures/expected.json";
import sampleCasesJson from "../../data/sampleCases.json";
import { isReady, recommend } from "./recommend";
import type { Offer, OfferResult, Profile, SampleCase } from "./types";

// Fixture JSON infers per-case literal unions; cast to the engine types.
const cases = (sampleCasesJson as unknown as { cases: SampleCase[] }).cases;
const expected = (
  expectedJson as unknown as {
    cases: { id: string; offers: Pick<OfferResult, "offerId" | "recommendedElections">[] }[];
  }
).cases;

const profile: Profile = {
  filingStatus: "single",
  otherHouseholdWages: 0,
  coverage: "self",
  expectedMedicalSpend: 1_000,
  hasEmergencyFund: true,
  hasHighInterestDebt: false,
  hasDependents: false,
  age: 30,
  currentSavings: 0,
};

const makeOffer = (salary: number, over: Partial<Offer["retirement"]> = {}): Offer => ({
  id: "t",
  employer: "Test Co",
  city: "Austin",
  state: "TX",
  salary,
  payPeriods: 24,
  retirement: {
    match: [
      { rate: 1, upToPct: 3 },
      { rate: 0.5, upToPct: 5 },
    ],
    defaultEmployeePct: 0,
    vesting: { type: "immediate" },
    rothAvailable: true,
    ...over,
  },
  healthPlans: [
    {
      id: "hdhp",
      name: "HDHP",
      hsaEligible: true,
      premium: 600,
      deductible: 3_000,
      coinsurance: 0.2,
      oopMax: 5_000,
      employerHsa: 1_000,
    },
  ],
  defaultPlanId: "hdhp",
  life: { basicMultiple: 1, supplementalMaxMultiple: 3 },
});

describe("recommend (7B funds hierarchy)", () => {
  it("ready means an emergency fund and no high-interest debt", () => {
    expect(isReady(profile)).toBe(true);
    expect(isReady({ ...profile, hasHighInterestDebt: true })).toBe(false);
    expect(isReady({ ...profile, hasEmergencyFund: false })).toBe(false);
  });

  it("ready: ceil(15 − match % at the cap), HSA filled to the limit minus the employer deposit", () => {
    const r = recommend(makeOffer(150_000), profile);
    // full match is 4% of pay → 15 − 4 = 11%
    expect(r.employeePct).toBe(11);
    expect(r.employeeHsa).toBe(4_400 - 1_000);
    expect(r.accountType).toBe("traditional"); // 150k single is in the 24% bracket
  });

  it("not ready: stop at the full match, no HSA", () => {
    const r = recommend(makeOffer(150_000), { ...profile, hasHighInterestDebt: true });
    expect(r.employeePct).toBe(5);
    expect(r.employeeHsa).toBe(0);
  });

  it("never less than the default %", () => {
    const r = recommend(makeOffer(150_000, { defaultEmployeePct: 13 }), profile);
    expect(r.employeePct).toBe(13);
  });

  it("Roth when offered and the marginal rate is at most 12%", () => {
    expect(recommend(makeOffer(50_000), profile).accountType).toBe("roth");
    expect(recommend(makeOffer(50_000, { rothAvailable: false }), profile).accountType).toBe(
      "traditional",
    );
  });

  it("no match and ready: 15% of pay", () => {
    expect(recommend(makeOffer(150_000, { match: [] }), profile).employeePct).toBe(15);
  });
});

describe("recommend vs expected.json", () => {
  for (const c of cases) {
    const exp = expected.find((e) => e.id === c.id)!;
    for (const o of c.offers) {
      it(`${c.id} / ${o.id}: recommended elections match exactly`, () => {
        const want = exp.offers.find((x) => x.offerId === o.id)!.recommendedElections;
        expect(recommend(o, c.profile)).toEqual(want);
      });
    }
  }
});
