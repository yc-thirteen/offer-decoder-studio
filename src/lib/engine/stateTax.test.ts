import { describe, expect, it } from "vitest";
import {
  STATE_CODES,
  STATE_TAX,
  bracketTax,
  hasWageIncomeTax,
  phasedAmount,
  stateTaxOnIncome,
} from "./stateTax";
import { stateIncomeTax, stateWages } from "./tax";

const NO_WAGE_TAX = ["AK", "FL", "NH", "NV", "SD", "TN", "TX", "WA", "WY"];

describe("the 2026 table (Tax Foundation)", () => {
  it("covers all 50 states and DC, in name order", () => {
    expect(STATE_CODES).toHaveLength(51);
    expect(STATE_CODES).toContain("DC");
    const names = STATE_CODES.map((c) => STATE_TAX[c].name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("starts every bracket list at 0, with rising edges and rates between 0 and 14%", () => {
    for (const code of STATE_CODES) {
      for (const status of ["single", "mfj"] as const) {
        const b = STATE_TAX[code][status].brackets;
        expect(b[0]![0], code).toBe(0);
        for (let i = 1; i < b.length; i++) {
          expect(b[i]![0], code).toBeGreaterThan(b[i - 1]![0]);
          expect(b[i]![1], code).toBeGreaterThanOrEqual(b[i - 1]![1]);
        }
        for (const [, rate] of b) expect(rate).toBeLessThan(0.14);
      }
    }
  });

  it("knows which states don't tax wages", () => {
    expect(STATE_CODES.filter((c) => !hasWageIncomeTax(c)).sort()).toEqual(NO_WAGE_TAX);
    for (const c of NO_WAGE_TAX) {
      expect(stateIncomeTax(150_000, 0, "single", c as "TX")).toBe(0);
    }
  });

  it("copies the published figures", () => {
    expect(STATE_TAX.CA.single.brackets.at(-1)).toEqual([1_000_000, 0.133]);
    expect(STATE_TAX.CA.mfj.standardDeduction).toBe(11_080);
    expect(STATE_TAX.NY.single.brackets[4]).toEqual([80_650, 0.059]);
    expect(STATE_TAX.NJ.single.brackets[3]).toEqual([40_000, 0.05525]);
    expect(STATE_TAX.MA.single.personalExemption).toBe(4_400);
    expect(STATE_TAX.KY.mfj.standardDeduction).toBe(3_360); // not doubled for joint filers (z)
    expect(STATE_TAX.UT.single.exemptionCredit).toBe(966); // standard deduction as a credit (gg)
    expect(STATE_TAX.OH.single.brackets).toEqual([
      [0, 0],
      [26_050, 0.0275],
    ]);
  });
});

describe("phasedAmount", () => {
  it("handles each kind of phase-out", () => {
    const linear = { kind: "linear", from: 100, to: 200 } as const;
    expect(phasedAmount(1000, 100, linear)).toBe(1000);
    expect(phasedAmount(1000, 150, linear)).toBe(500);
    expect(phasedAmount(1000, 250, linear)).toBe(0);
    expect(phasedAmount(966, 60_000, { kind: "perDollar", from: 18_213, rate: 0.013 })).toBeCloseTo(
      966 - 0.013 * (60_000 - 18_213),
      6,
    );
    const up = {
      kind: "steps",
      from: 30_000,
      every: 1000,
      by: 1000,
      floor: 0,
      round: "up",
    } as const;
    expect(phasedAmount(15_000, 30_000, up)).toBe(15_000);
    expect(phasedAmount(15_000, 30_001, up)).toBe(14_000);
    expect(phasedAmount(15_000, 50_000, up)).toBe(0);
    const down = {
      kind: "steps",
      from: 25_499,
      every: 500,
      by: 25,
      floor: 2500,
      round: "down",
    } as const;
    expect(phasedAmount(3000, 26_498, down)).toBe(2975);
    expect(phasedAmount(3000, 60_000, down)).toBe(2500);
    expect(phasedAmount(256, 100_000, { kind: "cliff", above: 100_000 })).toBe(256);
    expect(phasedAmount(256, 100_001, { kind: "cliff", above: 100_000 })).toBe(0);
    const tiers = {
      kind: "tiers",
      tiers: [
        [40_000, 2400],
        [80_000, 2150],
        [500_000, 1900],
      ],
    } as const;
    expect(phasedAmount(2400, 40_000, tiers)).toBe(2400);
    expect(phasedAmount(2400, 60_000, tiers)).toBe(2150);
    expect(phasedAmount(2400, 600_000, tiers)).toBe(0);
  });
});

describe("state tax by hand", () => {
  it("Illinois is the lecture's flat 4.95% of wages, with no exemption", () => {
    expect(stateIncomeTax(100_000, 0, "single", "IL")).toBeCloseTo(4_950, 6);
    expect(stateIncomeTax(100_000, 80_000, "mfj", "IL")).toBeCloseTo(4_950, 6);
  });

  it("California, single, $100,000: brackets after the standard deduction, less the credit", () => {
    const taxable = 100_000 - 5_540;
    const byHand =
      11_079 * 0.01 +
      (26_264 - 11_079) * 0.02 +
      (41_452 - 26_264) * 0.04 +
      (57_542 - 41_452) * 0.06 +
      (72_724 - 57_542) * 0.08 +
      (taxable - 72_724) * 0.093 -
      153;
    expect(stateIncomeTax(100_000, 0, "single", "CA")).toBeCloseTo(byHand, 6);
    expect(byHand).toBeCloseTo(5_070.42, 2);
  });

  it("Connecticut loses its exemption $1,000 per $1,000 above $30,000 (r)", () => {
    // $35,500: 6 steps (a part counts), so $9,000 of the $15,000 exemption is left.
    expect(stateTaxOnIncome("CT", "single", 35_500)).toBeCloseTo(
      10_000 * 0.02 + (26_500 - 10_000) * 0.045,
      6,
    );
    // $60,000: none left.
    expect(stateTaxOnIncome("CT", "single", 60_000)).toBeCloseTo(
      200 + 40_000 * 0.045 + 10_000 * 0.055,
      6,
    );
  });

  it("Wisconsin's standard deduction shrinks in a straight line to $0 at $136,453 (ii)", () => {
    const sd = (13_960 * (136_453 - 80_000)) / (136_453 - 20_119);
    expect(stateTaxOnIncome("WI", "single", 80_000)).toBeCloseTo(
      bracketTax(80_000 - sd - 700, STATE_TAX.WI.single.brackets),
      6,
    );
  });

  it("Utah's credit shrinks 1.3 cents per dollar above $18,213 (gg)", () => {
    expect(stateTaxOnIncome("UT", "single", 60_000)).toBeCloseTo(
      60_000 * 0.045 - (966 - 0.013 * (60_000 - 18_213)),
      6,
    );
  });

  it("Oregon's exemption credit stops above $100,000 (ee)", () => {
    const at = stateTaxOnIncome("OR", "single", 100_000);
    const over = stateTaxOnIncome("OR", "single", 100_001);
    expect(over - at).toBeCloseTo(256 + 0.0875, 6);
  });

  it("Ohio's exemption steps down by income, and nothing is taxed below $26,050 (dd)", () => {
    expect(stateTaxOnIncome("OH", "single", 60_000)).toBeCloseTo(
      (60_000 - 2_150 - 26_050) * 0.0275,
      6,
    );
    expect(stateTaxOnIncome("OH", "single", 25_000)).toBe(0);
  });

  it("Arkansas uses its lower table up to $92,300 of taxable income (g)", () => {
    const low = 50_000 - 2_470;
    expect(stateTaxOnIncome("AR", "single", 50_000)).toBeCloseTo(
      (10_900 - 5_500) * 0.02 +
        (15_600 - 10_900) * 0.03 +
        (25_700 - 15_600) * 0.034 +
        (low - 25_700) * 0.039 -
        29,
      6,
    );
    expect(stateTaxOnIncome("AR", "single", 120_000)).toBeCloseTo(
      4_600 * 0.02 + (120_000 - 2_470 - 4_600) * 0.039 - 29,
      6,
    );
  });

  it("Alabama's standard deduction steps down to $2,500 (c)", () => {
    expect(stateTaxOnIncome("AL", "single", 60_000)).toBeCloseTo(
      bracketTax(60_000 - 2_500 - 1_500, STATE_TAX.AL.single.brackets),
      6,
    );
  });

  it("Vermont charges at least 3% of income above $150,000 (hh)", () => {
    expect(stateTaxOnIncome("VT", "single", 200_000)).toBeGreaterThanOrEqual(6_000);
  });

  it("never goes below zero when the credit beats the tax", () => {
    expect(stateTaxOnIncome("CA", "single", 6_000)).toBe(0);
    expect(stateTaxOnIncome("NE", "mfj", 10_000)).toBe(0);
  });

  it("a joint return counts only what this job adds to the household's state tax", () => {
    const job = 100_000;
    const spouse = 60_000;
    expect(stateIncomeTax(job, spouse, "mfj", "CA")).toBeCloseTo(
      stateTaxOnIncome("CA", "mfj", job + spouse) - stateTaxOnIncome("CA", "mfj", spouse),
      6,
    );
    expect(stateIncomeTax(job, spouse, "mfj", "CA")).toBeGreaterThan(
      stateIncomeTax(job, 0, "mfj", "CA"),
    );
  });

  it("a custom-rate offer is the flat rate times wages", () => {
    expect(stateIncomeTax(80_000, 0, "single", "OTHER", 0.05)).toBeCloseTo(4_000, 6);
    expect(stateIncomeTax(80_000, 0, "single", "OTHER")).toBe(0);
  });
});

describe("stateWages", () => {
  it("adds back the pre-tax dollars a state taxes", () => {
    expect(stateWages("PA", 90_000, 6_000, 1_000)).toBe(96_000); // 401(k) taxed
    expect(stateWages("CA", 90_000, 6_000, 1_000)).toBe(91_000); // HSA taxed
    expect(stateWages("NJ", 90_000, 6_000, 1_000)).toBe(91_000); // HSA taxed
    expect(stateWages("NY", 90_000, 6_000, 1_000)).toBe(90_000);
    expect(stateWages("OTHER", 90_000, 6_000, 1_000)).toBe(90_000);
  });
});
