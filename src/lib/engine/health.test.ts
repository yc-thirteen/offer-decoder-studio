import { describe, expect, it } from "vitest";
import expectedJson from "../../../harness/fixtures/expected.json";
import sampleCasesJson from "../../data/sampleCases.json";
import {
  breakpoints,
  dominatedPlanIds,
  employerHsaDeposit,
  outOfPocket,
  planCost,
  planCostCurves,
  recommendedPlan,
  worstCaseCost,
} from "./health";
import type { Elections, HealthPlan, OfferResult, SampleCase } from "./types";

// Fixture JSON infers per-case literal unions; cast to the engine types.
const cases = (sampleCasesJson as unknown as { cases: SampleCase[] }).cases;
const expected = (
  expectedJson as unknown as {
    cases: {
      id: string;
      offers: (Pick<OfferResult, "offerId" | "dominatedPlanIds" | "planCostCurves"> & {
        recommendedElections: Elections;
      })[];
    }[];
  }
).cases;

const plan = (over: Partial<HealthPlan>): HealthPlan => ({
  id: "p",
  name: "Plan",
  hsaEligible: false,
  premium: 0,
  deductible: 0,
  coinsurance: 0.2,
  oopMax: 0,
  employerHsa: 0,
  ...over,
});

// Northfield's plans from chicago-vs-austin (7A slides 36–37 style).
const ppo = plan({ id: "ppo", premium: 2400, deductible: 500, oopMax: 3000 });
const hdhp = plan({
  id: "hdhp",
  hsaEligible: true,
  premium: 600,
  deductible: 3000,
  oopMax: 5000,
  employerHsa: 1000,
});

describe("outOfPocket", () => {
  it("pays everything up to the deductible", () => {
    expect(outOfPocket(ppo, 0)).toBe(0);
    expect(outOfPocket(ppo, 500)).toBe(500);
  });

  it("pays the coinsurance share above the deductible", () => {
    expect(outOfPocket(ppo, 1500)).toBeCloseTo(500 + 0.2 * 1000, 9);
  });

  it("stops at the out-of-pocket max", () => {
    expect(outOfPocket(ppo, 13_000)).toBeCloseTo(3000, 9);
    expect(outOfPocket(ppo, 100_000)).toBe(3000);
  });
});

describe("employer HSA deposit and plan cost", () => {
  it("counts the employer HSA deposit only on an HSA-eligible plan", () => {
    expect(employerHsaDeposit(hdhp)).toBe(1000);
    expect(employerHsaDeposit({ ...ppo, employerHsa: 700 })).toBe(0);
  });

  it("is premium + out-of-pocket − employer HSA", () => {
    expect(planCost(hdhp, 2000)).toBe(600 + 2000 - 1000);
    expect(planCost(ppo, 2000)).toBeCloseTo(2400 + 800, 9);
  });

  it("has a worst case of premium + out-of-pocket max − employer HSA", () => {
    expect(worstCaseCost(hdhp)).toBe(4600);
    expect(worstCaseCost(ppo)).toBe(5400);
  });
});

describe("breakpoints", () => {
  it("includes 0, every deductible, every out-of-pocket-max kink, and one point past the last", () => {
    // ppo hits its max at 500 + 2500/0.2 = 13,000; hdhp at 3000 + 2000/0.2 = 13,000.
    expect(breakpoints([ppo, hdhp])).toEqual([0, 500, 3000, 13_000, 20_500]);
  });

  it("skips the max kink when coinsurance is 0", () => {
    expect(breakpoints([plan({ deductible: 1000, coinsurance: 0, oopMax: 1000 })])).toEqual([
      0, 1000, 2500,
    ]);
  });
});

describe("dominatedPlanIds", () => {
  it("flags a plan that costs at least as much everywhere and more somewhere", () => {
    expect(dominatedPlanIds([ppo, hdhp])).toEqual(["ppo"]);
  });

  it("does not flag plans whose curves cross", () => {
    const lowPrem = plan({
      id: "a",
      premium: 900,
      deductible: 3500,
      coinsurance: 0.3,
      oopMax: 7000,
    });
    const highPrem = plan({
      id: "b",
      premium: 3600,
      deductible: 250,
      coinsurance: 0.1,
      oopMax: 2000,
    });
    expect(dominatedPlanIds([lowPrem, highPrem])).toEqual([]);
  });

  it("does not flag identical plans (no strict improvement)", () => {
    expect(dominatedPlanIds([ppo, { ...ppo, id: "ppo2" }])).toEqual([]);
  });

  it("never flags a single plan", () => {
    expect(dominatedPlanIds([ppo])).toEqual([]);
  });
});

describe("recommendedPlan", () => {
  const lowPrem = plan({
    id: "hd",
    premium: 900,
    deductible: 3500,
    coinsurance: 0.3,
    oopMax: 7000,
  });
  const highPrem = plan({
    id: "lo",
    premium: 3600,
    deductible: 250,
    coinsurance: 0.1,
    oopMax: 2000,
  });

  it("never picks a dominated plan", () => {
    expect(recommendedPlan([ppo, hdhp], 0, true).id).toBe("hdhp");
    expect(recommendedPlan([ppo, hdhp], 50_000, false).id).toBe("hdhp");
  });

  it("with an emergency fund, picks the lowest cost at expected spending", () => {
    expect(recommendedPlan([lowPrem, highPrem], 500, true).id).toBe("hd");
    expect(recommendedPlan([lowPrem, highPrem], 12_000, true).id).toBe("lo");
  });

  it("without an emergency fund, picks the lowest worst-case cost", () => {
    // worst cases: hd 7,900 vs lo 5,600, even though hd is cheaper at $500 spending.
    expect(recommendedPlan([lowPrem, highPrem], 500, false).id).toBe("lo");
  });

  it("breaks ties with the lower premium", () => {
    const a = plan({ id: "a", premium: 1000, deductible: 2000, oopMax: 4000 });
    const b = plan({ id: "b", premium: 500, deductible: 2000, oopMax: 4500 });
    // Same worst case (5,000); b has the lower premium.
    expect(recommendedPlan([a, b], 0, false).id).toBe("b");
  });

  it("throws a clear error with no plans", () => {
    expect(() => recommendedPlan([], 0, true)).toThrow(/at least one health plan/);
  });
});

describe("fixtures (harness/fixtures/expected.json)", () => {
  for (const c of cases) {
    const exp = expected.find((e) => e.id === c.id)!;
    for (const offer of c.offers) {
      const eo = exp.offers.find((o) => o.offerId === offer.id)!;

      it(`${c.id} / ${offer.id}: dominated plans, recommended plan, cost curves`, () => {
        expect(dominatedPlanIds(offer.healthPlans)).toEqual(eo.dominatedPlanIds);
        expect(
          recommendedPlan(
            offer.healthPlans,
            c.profile.expectedMedicalSpend,
            c.profile.hasEmergencyFund,
          ).id,
        ).toBe(eo.recommendedElections.planId);

        const curves = planCostCurves(offer.healthPlans);
        expect(Object.keys(curves).sort()).toEqual(Object.keys(eo.planCostCurves).sort());
        for (const [id, points] of Object.entries(eo.planCostCurves)) {
          const got = curves[id] ?? [];
          expect(got).toHaveLength(points.length);
          points.forEach(([s, cost], k) => {
            const [gs, gc] = got[k] ?? [NaN, NaN];
            expect(Math.abs(gs - s)).toBeLessThanOrEqual(1);
            expect(Math.abs(gc - cost)).toBeLessThanOrEqual(1);
          });
        }
      });
    }
  }
});
