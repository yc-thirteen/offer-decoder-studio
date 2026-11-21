import { describe, expect, it } from "vitest";
import expectedJson from "../../../harness/fixtures/expected.json";
import sampleCasesJson from "../../data/sampleCases.json";
import { calculate, defaultElections } from "./calculate";
import { checklist } from "./checklist";
import { recommend } from "./recommend";
import type { ChecklistId, Offer, OfferResult, Profile, SampleCase } from "./types";

// Fixture JSON infers per-case literal unions; cast to the engine types.
const cases = (sampleCasesJson as unknown as { cases: SampleCase[] }).cases;
const expected = (
  expectedJson as unknown as {
    cases: { id: string; offers: Pick<OfferResult, "offerId" | "checklist">[] }[];
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

const baseOffer: Offer = {
  id: "t",
  employer: "Test Co",
  city: "Austin",
  state: "TX",
  salary: 80_000,
  payPeriods: 26,
  retirement: {
    match: [{ rate: 1, upToPct: 4 }],
    defaultEmployeePct: 4,
    vesting: { type: "immediate" },
    rothAvailable: false,
  },
  healthPlans: [
    {
      id: "ppo",
      name: "PPO",
      hsaEligible: false,
      premium: 1_200,
      deductible: 500,
      coinsurance: 0.2,
      oopMax: 3_000,
      employerHsa: 0,
    },
  ],
  defaultPlanId: "ppo",
  life: { basicMultiple: 1, supplementalMaxMultiple: 5 },
};

const ORDER: ChecklistId[] = [
  "raise-401k",
  "unclaimed-match",
  "pay-high-interest-debt",
  "build-emergency-fund",
  "switch-health-plan",
  "default-plan-dominated",
  "open-hsa",
  "choose-roth",
  "choose-traditional",
  "life-insurance",
  "skip-extra-life-insurance",
  "check-w4",
  "note-vesting-date",
];

describe("checklist", () => {
  it("always includes an account type, a life item, and check-w4", () => {
    expect(checklist(baseOffer, profile)).toEqual([
      "raise-401k",
      "choose-traditional",
      "skip-extra-life-insurance",
      "check-w4",
    ]);
  });

  it("flags an unclaimed match when the default is below the cap", () => {
    const offer = { ...baseOffer, retirement: { ...baseOffer.retirement, defaultEmployeePct: 0 } };
    expect(checklist(offer, profile)).toContain("unclaimed-match");
  });

  it("puts debt and buffer first when not ready, and notes non-immediate vesting", () => {
    const offer: Offer = {
      ...baseOffer,
      retirement: {
        ...baseOffer.retirement,
        defaultEmployeePct: 0,
        vesting: { type: "cliff", years: 3 },
      },
    };
    const items = checklist(offer, {
      ...profile,
      hasEmergencyFund: false,
      hasHighInterestDebt: true,
      hasDependents: true,
    });
    expect(items).toEqual([
      "raise-401k",
      "unclaimed-match",
      "pay-high-interest-debt",
      "build-emergency-fund",
      "choose-traditional",
      "life-insurance",
      "check-w4",
      "note-vesting-date",
    ]);
  });

  it("gives the same answer with precomputed inputs", () => {
    const d = defaultElections(baseOffer);
    const r = recommend(baseOffer, profile);
    const dc = calculate(baseOffer, profile, d);
    expect(checklist(baseOffer, profile, { defaults: d, recommended: r, defaultCalc: dc })).toEqual(
      checklist(baseOffer, profile),
    );
  });

  describe("matches expected.json for all 12 offers (exact ids, exact order)", () => {
    for (const c of cases) {
      const exp = expected.find((e) => e.id === c.id)!;
      for (const o of c.offers) {
        it(`${c.id} / ${o.id}`, () => {
          const got = checklist(o, c.profile);
          expect(got).toEqual(exp.offers.find((e) => e.offerId === o.id)!.checklist);
          // Funds-hierarchy order: indices strictly increase.
          const idx = got.map((id) => ORDER.indexOf(id));
          expect(idx).toEqual([...idx].sort((a, b) => a - b));
        });
      }
    }
  });
});
