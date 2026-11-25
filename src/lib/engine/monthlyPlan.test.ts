import { describe, expect, it } from "vitest";
import { SAMPLE_CASES } from "@/state/decoderState";
import { calculate, runOffer } from "./index";
import {
  blankMonthlyBudget,
  calculateMonthlyPlan,
  editableElections,
  hsaAllowance,
  validateElections,
} from "./monthlyPlan";

const sample = SAMPLE_CASES[0]!;
const offer = sample.offers[0]!;
const profile = sample.profile;
const result = runOffer(offer, profile);
const filled = {
  ...blankMonthlyBudget(),
  livingExpenses: 3000,
  minimumDebtPayments: 200,
  cashSavings: 500,
};

describe("monthly planning accounting", () => {
  it("uses annual net pay divided by 12, with payroll deductions counted once", () => {
    const c = result.recommended;
    const p = calculateMonthlyPlan(c, filled);
    expect(p.monthlyTakeHome).toBeCloseTo(c.netPay / 12, 2);
    expect(p.remaining).toBeCloseTo(c.netPay / 12 - c.expectedOutOfPocket / 12 - 3700, 2);
    expect(p.retirementRate).toBe(15);
    expect(c.netPayPerPaycheck).not.toBe(p.monthlyTakeHome);
  });

  it("missing, negative, or non-finite expenses cannot look affordable; explicit zero is valid", () => {
    for (const value of [null, -1, Infinity, NaN]) {
      const p = calculateMonthlyPlan(result.default, { ...filled, livingExpenses: value });
      expect(p.complete).toBe(false);
      expect(p.remaining).toBeNull();
    }
    const zero = calculateMonthlyPlan(result.default, {
      ...filled,
      livingExpenses: 0,
      cashSavings: 0,
      minimumDebtPayments: 0,
    });
    expect(zero.complete).toBe(true);
    expect(
      calculateMonthlyPlan(result.default, { ...filled, livingExpenses: 20000 }).remaining,
    ).toBeLessThan(0);
  });

  it("moves medical costs from cash to HSA without creating extra savings", () => {
    const c = result.recommended;
    const cash = calculateMonthlyPlan(c, filled);
    const hsa = calculateMonthlyPlan(c, { ...filled, useHsaForMedical: true });
    expect(hsa.medicalFromHsa).toBe(c.expectedOutOfPocket);
    expect(hsa.monthlyCashMedical).toBe(0);
    expect(hsa.hsaRetained).toBe(c.employeeHsa + c.employerHsa - c.expectedOutOfPocket);
    expect((hsa.remaining! - cash.remaining!) * 12).toBeCloseTo(
      cash.hsaRetained - hsa.hsaRetained,
      0,
    );
    // Cash after medical + retained savings is independent of the payment account.
    expect(c.netPay - cash.monthlyCashMedical * 12 + cash.hsaRetained).toBeCloseTo(
      c.netPay - hsa.monthlyCashMedical * 12 + hsa.hsaRetained,
      0,
    );
  });

  it("uses only available yearly HSA contributions and reserves any excess bills in cash", () => {
    const c = {
      ...result.recommended,
      employeeHsa: 100,
      employerHsa: 100,
      expectedOutOfPocket: 800,
    };
    const p = calculateMonthlyPlan(c, { ...filled, useHsaForMedical: true });
    expect(p.medicalFromHsa).toBe(200);
    expect(p.hsaRetained).toBe(0);
    expect(p.monthlyCashMedical).toBe(50);
    const noHsa = calculateMonthlyPlan(result.default, { ...filled, useHsaForMedical: true });
    expect(noHsa.medicalFromHsa).toBe(0);
  });

  it("a lower traditional contribution raises take-home, while retirement savings fall", () => {
    const lower = calculate(offer, profile, { ...result.recommendedElections, employeePct: 6 });
    expect(lower.netPay).toBeGreaterThan(result.recommended.netPay);
    expect(lower.employee401k).toBeLessThan(result.recommended.employee401k);
    expect(lower.employerMatch).toBe(result.recommended.employerMatch);
    const roth = calculate(offer, profile, { ...result.recommendedElections, accountType: "roth" });
    expect(roth.netPay).toBeLessThan(result.recommended.netPay);
  });
});

describe("custom contribution bounds", () => {
  const e = result.recommendedElections;
  it("accepts zero and ordinary settings, and rejects unsupported elections", () => {
    expect(validateElections(offer, profile, e)).toEqual({});
    expect(validateElections(offer, profile, { ...e, employeePct: 0, employeeHsa: 0 })).toEqual({});
    for (const pct of [null, -1, Infinity, 101, 20])
      expect(
        validateElections(offer, profile, { ...e, employeePct: pct }).employeePct,
      ).toBeTruthy();
    for (const hsa of [null, -1, Infinity, 3401])
      expect(
        validateElections(offer, profile, { ...e, employeeHsa: hsa }).employeeHsa,
      ).toBeTruthy();
    expect(validateElections(offer, profile, { ...e, planId: "missing" }).planId).toBeTruthy();
    expect(
      validateElections(
        { ...offer, retirement: { ...offer.retirement, rothAvailable: false } },
        profile,
        { ...e, accountType: "roth" },
      ).accountType,
    ).toBeTruthy();
    expect(
      validateElections(offer, profile, { ...e, planId: offer.defaultPlanId, employeeHsa: 1 })
        .employeeHsa,
    ).toBeTruthy();
  });

  it("subtracts employer HSA deposits from both tier allowances", () => {
    expect(hsaAllowance(offer, profile, e.planId)).toBe(3400);
    expect(hsaAllowance(offer, { ...profile, coverage: "family" }, e.planId)).toBe(7750);
  });

  it("seeds high-income plans within the legal basic cap and catches impossible payroll deductions", () => {
    const high = { ...offer, salary: 520000 };
    const seeded = editableElections(high, e);
    expect(validateElections(high, profile, seeded)).toEqual({});
    expect((high.salary * seeded.employeePct!) / 100).toBeLessThanOrEqual(24500);
    expect(calculate(high, profile, seeded as typeof e).employee401k).toBe(24500);
    expect(calculate(high, profile, seeded as typeof e).netPay).toBe(
      calculate(high, profile, e).netPay,
    );
    expect(
      validateElections({ ...offer, salary: 1000 }, profile, { ...e, employeePct: 0 }).deductions,
    ).toBeTruthy();
  });
});
