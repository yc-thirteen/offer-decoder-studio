import { describe, expect, it } from "vitest";
import expectedJson from "../../../harness/fixtures/expected.json";
import sampleCasesJson from "../../data/sampleCases.json";
import { BRACKETS, HSA_LIMIT, LIMIT_401K, STATE_RATES, STD_DEDUCTION } from "./constants";
import type { CalcResult, LifeResult, OfferResult, Profile } from "./types";

// Compile-time exhaustive key lists: adding or removing a field in types.ts without
// updating these lists fails typecheck, and the tests below tie them to the fixtures.
function keysOf<T>() {
  return <K extends keyof T>(keys: [K, ...K[]] & ([keyof T] extends [K] ? unknown : never)) => keys;
}

const CALC_KEYS = keysOf<CalcResult>()([
  "planId",
  "employeePct",
  "accountType",
  "grossPay",
  "employee401k",
  "hitsLimit401k",
  "traditional401k",
  "roth401k",
  "healthPremium",
  "employeeHsa",
  "federalIncomeTax",
  "socialSecurity",
  "medicare",
  "stateIncomeTax",
  "netPay",
  "netPayPerPaycheck",
  "employerMatch",
  "employerHsa",
  "savingsInYourName",
  "savingsAfterFutureTax",
  "expectedOutOfPocket",
  "bottomLine",
  "federalMarginalRate",
  "federalAverageRateOnJob",
]);
const LIFE_KEYS = keysOf<LifeResult>()([
  "humanCapital",
  "householdWealth",
  "lossShare",
  "fractionEmployer",
  "fractionIndividual",
  "recommendedCoverageEmployer",
  "recommendedCoverageIndividual",
  "basicCoverage",
  "recommendedSupplemental",
  "recommendedIndividualPolicy",
  "totalRecommendedCoverage",
]);
const OFFER_RESULT_KEYS = keysOf<OfferResult>()([
  "offerId",
  "dominatedPlanIds",
  "recommendedElections",
  "default",
  "recommended",
  "matchCapPct",
  "maxMatchPctOfSalary",
  "vestedPctByYear",
  "planCostCurves",
  "lifeInsurance",
  "checklist",
]);
const PROFILE_KEYS = keysOf<Profile>()([
  "filingStatus",
  "otherHouseholdWages",
  "coverage",
  "expectedMedicalSpend",
  "hasEmergencyFund",
  "hasHighInterestDebt",
  "hasDependents",
  "age",
  "currentSavings",
]);

type Loose = Record<string, unknown>;
type LooseOffer = Loose & { default: Loose; recommended: Loose; lifeInsurance: Loose | null };
const expected = expectedJson as unknown as { cases: { offers: LooseOffer[] }[] };
const sampleCases = sampleCasesJson as unknown as {
  cases: { profile: Loose; offers: { state: string; customStateRate?: number }[] }[];
};

const sorted = (xs: readonly string[]) => [...xs].sort();

describe("engine types match the fixtures", () => {
  const offers = expected.cases.flatMap((c) => c.offers);

  it("OfferResult, CalcResult, and LifeResult have exactly the fixture fields", () => {
    for (const o of offers) {
      expect(sorted(Object.keys(o))).toEqual(sorted(OFFER_RESULT_KEYS));
      expect(sorted(Object.keys(o.default))).toEqual(sorted(CALC_KEYS));
      expect(sorted(Object.keys(o.recommended))).toEqual(sorted(CALC_KEYS));
      if (o.lifeInsurance) expect(sorted(Object.keys(o.lifeInsurance))).toEqual(sorted(LIFE_KEYS));
    }
  });

  it("Profile has exactly the fixture fields", () => {
    for (const c of sampleCases.cases)
      expect(sorted(Object.keys(c.profile))).toEqual(sorted(PROFILE_KEYS));
  });

  it("every fixture state has a rate (or OTHER with a custom rate)", () => {
    for (const o of sampleCases.cases.flatMap((c) => c.offers)) {
      if (o.state === "OTHER") expect(typeof o.customStateRate).toBe("number");
      else expect(STATE_RATES).toHaveProperty(o.state);
    }
  });
});

describe("constants (FINANCE_SPEC.md)", () => {
  it("brackets end at Infinity and rise", () => {
    for (const b of Object.values(BRACKETS)) {
      expect(b.at(-1)).toEqual([Infinity, 0.37]);
      const edges = b.map(([upTo]) => upTo);
      expect(edges).toEqual([...edges].sort((x, y) => x - y));
    }
    expect(BRACKETS.mfj[2]).toEqual([211_400, 0.22]);
    expect(BRACKETS.single[0]).toEqual([12_400, 0.1]);
  });

  it("limits and deductions", () => {
    expect(STD_DEDUCTION).toEqual({ single: 16_100, mfj: 32_200 });
    expect(HSA_LIMIT).toEqual({ self: 4_400, family: 8_750 });
    expect(LIMIT_401K).toBe(24_500);
    expect(STATE_RATES.IL).toBe(0.0495);
  });
});
