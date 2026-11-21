import { describe, expect, it } from "vitest";
import expectedJson from "../../../harness/fixtures/expected.json";
import sampleCasesJson from "../../data/sampleCases.json";
import {
  federalMarginalRate,
  federalTaxOnJob,
  incomeTax,
  marginalRate,
  medicareTax,
  socialSecurityTax,
  stateIncomeTax,
  stateRate,
} from "./tax";
import type { CalcResult, SampleCase } from "./types";

// Fixture JSON infers per-case literal unions; cast to the engine types.
const cases = (sampleCasesJson as unknown as { cases: SampleCase[] }).cases;
const expected = (
  expectedJson as unknown as {
    cases: {
      id: string;
      offers: { offerId: string; default: CalcResult; recommended: CalcResult }[];
    }[];
  }
).cases;

describe("incomeTax", () => {
  it("is zero at or below zero taxable income", () => {
    expect(incomeTax(0, "single")).toBe(0);
    expect(incomeTax(-500, "mfj")).toBe(0);
  });

  it("taxes the first bracket at 10%", () => {
    expect(incomeTax(12_400, "single")).toBeCloseTo(1_240, 6);
    expect(incomeTax(24_800, "mfj")).toBeCloseTo(2_480, 6);
  });

  it("walks every bracket into the 37% band", () => {
    // single: 1240 + 4560 + 12166 + 23058 + 17424 + 134531.25 = 192979.25 at 640,600
    expect(incomeTax(640_600, "single")).toBeCloseTo(192_979.25, 6);
    expect(incomeTax(740_600, "single")).toBeCloseTo(192_979.25 + 37_000, 6);
  });
});

describe("marginalRate", () => {
  it("puts a bracket edge in the lower bracket", () => {
    expect(marginalRate(0, "single")).toBe(0.1);
    expect(marginalRate(50_400, "single")).toBe(0.12);
    expect(marginalRate(50_401, "single")).toBe(0.22);
    expect(marginalRate(100_800, "mfj")).toBe(0.12);
    expect(marginalRate(1_000_000, "mfj")).toBe(0.37);
  });
});

describe("federalTaxOnJob (marginal method)", () => {
  it("equals tax on wages minus the standard deduction when single", () => {
    expect(federalTaxOnJob(66_100, 0, "single")).toBeCloseTo(incomeTax(50_000, "single"), 6);
  });

  it("is the extra tax the job adds on top of the spouse's wages", () => {
    const both = incomeTax(100_000 + 60_000 - 32_200, "mfj");
    const spouseOnly = incomeTax(60_000 - 32_200, "mfj");
    expect(federalTaxOnJob(100_000, 60_000, "mfj")).toBeCloseTo(both - spouseOnly, 6);
  });

  it("floors both taxable incomes at zero", () => {
    expect(federalTaxOnJob(10_000, 0, "single")).toBe(0);
    expect(federalTaxOnJob(20_000, 10_000, "mfj")).toBe(0);
  });
});

describe("payroll taxes", () => {
  it("caps Social Security at the wage base", () => {
    expect(socialSecurityTax(100_000)).toBeCloseTo(6_200, 6);
    expect(socialSecurityTax(300_000)).toBeCloseTo(0.062 * 184_500, 6);
  });

  it("adds the 0.9% surtax only on wages this job pushes over the threshold", () => {
    expect(medicareTax(150_000, 0, "single")).toBeCloseTo(2_175, 6);
    expect(medicareTax(250_000, 0, "single")).toBeCloseTo(3_625 + 450, 6);
    // Spouse already above the joint threshold: every job dollar pays the surtax.
    expect(medicareTax(100_000, 300_000, "mfj")).toBeCloseTo(1_450 + 900, 6);
  });
});

describe("state tax", () => {
  it("uses the flat table rate, or the custom rate for OTHER", () => {
    expect(stateRate("IL")).toBe(0.0495);
    expect(stateRate("TX")).toBe(0);
    expect(stateRate("OTHER", 0.05)).toBe(0.05);
    expect(stateRate("OTHER")).toBe(0);
    expect(stateIncomeTax(100_000, "IL")).toBeCloseTo(4_950, 6);
  });
});

describe("tax lines match expected.json for every fixture offer", () => {
  for (const c of cases) {
    const exp = expected.find((e) => e.id === c.id)!;
    const status = c.profile.filingStatus;
    const other = status === "mfj" ? c.profile.otherHouseholdWages : 0;
    for (const offer of c.offers) {
      const expOffer = exp.offers.find((o) => o.offerId === offer.id)!;
      for (const mode of ["default", "recommended"] as const) {
        const r = expOffer[mode];
        it(`${c.id} / ${offer.id} / ${mode}`, () => {
          const sec125 = r.healthPremium + r.employeeHsa;
          const federalWages = offer.salary - r.traditional401k - sec125;
          const payrollWages = offer.salary - sec125;
          expect(federalTaxOnJob(federalWages, other, status)).toBeCloseTo(r.federalIncomeTax, 0);
          expect(federalMarginalRate(federalWages, other, status)).toBe(r.federalMarginalRate);
          expect(socialSecurityTax(payrollWages)).toBeCloseTo(r.socialSecurity, 0);
          expect(medicareTax(payrollWages, other, status)).toBeCloseTo(r.medicare, 0);
          expect(stateIncomeTax(federalWages, offer.state, offer.customStateRate)).toBeCloseTo(
            r.stateIncomeTax,
            0,
          );
        });
      }
    }
  }
});
