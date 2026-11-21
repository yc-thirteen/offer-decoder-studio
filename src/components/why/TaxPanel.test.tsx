import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClearOffersButton, RecommendedSwitch } from "@/components/decoder/DecoderHeader";
import { BRACKETS, federalTaxOnJob, marginalRate, type CalcResult } from "@/lib/engine";
import { SAMPLE_CASES, deriveView, initialDecoderState } from "@/state/decoderState";
import { DecoderProvider } from "@/state/DecoderContext";
import { taxChartData } from "./taxData";
import { TaxPanel } from "./TaxPanel";

function setup(sampleId: string, mode: "default" | "recommended" = "default") {
  const s = { ...initialDecoderState(sampleId), electionsMode: mode };
  return { s, view: deriveView(s) };
}

function dataFor(sampleId: string, slot: 0 | 1, mode: "default" | "recommended" = "default") {
  const { s, view } = setup(sampleId, mode);
  return taxChartData(view.stubs[slot].calc!, s.profile);
}

const sum = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);

describe("taxChartData", () => {
  it("states the chicago-vs-austin conclusion and works the tax out bracket by bracket", () => {
    const d = dataFor("chicago-vs-austin", 0);
    expect(d.sentence).toBe(
      "Only the part of your taxable income above $105,700 is taxed at 24%. Everything below " +
        "it keeps the lower rates, so the federal tax on this job is $23,078, an average of " +
        "15.4% of your pay.",
    );
    expect(d.raiseSentence).toBe(
      "A raise is taxed only on the new dollars: another $1,000 of pay adds about $240 of " +
        "federal tax, and the rest of your income keeps its rates.",
    );
    expect(d.taxable).toBe(127000);
    expect(d.incomeRows).toEqual([
      { label: "Wages after pre-tax deductions", amount: 143100 },
      { label: "Standard deduction", amount: -16100 },
    ]);
    expect(d.bracketRows).toEqual([
      { label: "10% on the first $12,400", amount: 1240 },
      { label: "12% on $12,400 to $50,400", amount: 4560 },
      { label: "22% on $50,400 to $105,700", amount: 12166 },
      { label: "24% on $105,700 to $127,000", amount: 5112 },
    ]);
    expect(d.spouseRows).toEqual([]);
    expect(d.total).toEqual({ label: "Federal income tax on this job", amount: 23078 });
    // The window runs past your income into the next brackets, ending on a round tick.
    expect(d.xMax).toBe(300000);
    expect(d.steps.map((s) => [s.rate, s.yours])).toEqual([
      [0.1, false],
      [0.12, false],
      [0.22, false],
      [0.24, true],
      [0.32, false],
      [0.35, false],
    ]);
  });

  it("follows the elections: the recommended 401(k) and HSA lower taxable income", () => {
    const d = dataFor("chicago-vs-austin", 0, "recommended");
    expect(d.taxable).toBe(111900);
    expect(d.sentence).toContain("the federal tax on this job is $19,454, an average of 13%");
  });

  it("explains a joint return with a working spouse by the marginal method", () => {
    const d = dataFor("high-earner-family", 0);
    expect(d.sentence).toBe(
      "Only the part of your household's taxable income above $211,400 is taxed at 24%. " +
        "Everything below it keeps the lower rates, so the federal tax on this job is $53,444, " +
        "an average of 20.6% of your pay.",
    );
    expect(d.incomeRows).toEqual([
      { label: "Wages after pre-tax deductions", amount: 238400 },
      { label: "Spouse's wages", amount: 120000 },
      { label: "Standard deduction", amount: -32200 },
    ]);
    expect(d.spouseRows).toEqual([
      { label: "Household federal income tax", amount: 63484 },
      { label: "Tax on your spouse's wages alone", amount: -10040 },
    ]);
    expect(d.total.amount).toBe(53444);
  });

  it("agrees with the engine for every offer of every sample under both elections", () => {
    for (const c of SAMPLE_CASES) {
      for (const mode of ["default", "recommended"] as const) {
        const { s, view } = setup(c.id, mode);
        const status = s.profile.filingStatus;
        const spouse = status === "mfj" ? s.profile.otherHouseholdWages : 0;
        for (const stub of view.stubs) {
          const calc = stub.calc!;
          const d = taxChartData(calc, s.profile);
          const where = `${c.id} ${mode} ${stub.slot}`;
          expect(federalTaxOnJob(d.federalWages, spouse, status), where).toBeCloseTo(
            calc.federalIncomeTax,
            1,
          );
          expect(marginalRate(d.taxable, status), where).toBe(calc.federalMarginalRate);
          expect(d.marginalRate, where).toBe(calc.federalMarginalRate);
          expect(d.averagePct, where).toBe(calc.federalAverageRateOnJob);
          expect(sum(d.incomeRows), where).toBeCloseTo(d.taxable, 2);
          // Bracket rows add up to the household tax; minus the spouse's alone, to the job's.
          const household = sum(d.bracketRows);
          if (d.spouseRows.length) {
            expect(d.spouseRows[0]!.amount, where).toBeCloseTo(household, 2);
            expect(household + d.spouseRows[1]!.amount, where).toBeCloseTo(d.total.amount, 1);
          } else {
            expect(household, where).toBeCloseTo(d.total.amount, 1);
          }
          expect(d.total.amount, where).toBe(calc.federalIncomeTax);
          // Steps are the filing status's brackets, in order, covering the window.
          const edges = BRACKETS[status].map(([hi]) => hi);
          d.steps.forEach((st, i) => {
            expect(st.hi).toBe(edges[i]);
            expect(st.lo).toBe(i === 0 ? 0 : edges[i - 1]);
          });
          expect(d.steps.filter((st) => st.yours)).toHaveLength(1);
          expect(d.xMax, where).toBeGreaterThan(d.taxable);
          expect(d.steps[d.steps.length - 1]!.hi, where).toBeGreaterThanOrEqual(d.xMax);
        }
      }
    }
  });

  it("rephrases for pay in the lowest bracket and pay under the standard deduction", () => {
    const { s, view } = setup("new-grad-roth");
    const base = view.stubs[0].calc!;
    const low: CalcResult = {
      ...base,
      grossPay: 20000,
      traditional401k: 0,
      healthPremium: 0,
      employeeHsa: 0,
      federalIncomeTax: 390,
      federalMarginalRate: 0.1,
      federalAverageRateOnJob: 1.95,
    };
    expect(taxChartData(low, s.profile).sentence).toBe(
      "All of your taxable income, $3,900, is in the lowest bracket, 10%, so the federal tax " +
        "on this job is $390, 1.9% of your pay.",
    );
    const none: CalcResult = {
      ...low,
      grossPay: 15000,
      federalIncomeTax: 0,
      federalAverageRateOnJob: 0,
    };
    const d = taxChartData(none, s.profile);
    expect(d.sentence).toBe(
      "Your pay is under the $16,100 standard deduction, so this job owes no federal income tax.",
    );
    expect(d.taxable).toBe(0);
    expect(d.bracketRows).toEqual([]);
  });
});

describe("TaxPanel", () => {
  it("draws the brackets with your income marked, both rates written, and the tax rows", () => {
    render(
      <DecoderProvider initialSampleId="chicago-vs-austin">
        <TaxPanel />
      </DecoderProvider>,
    );
    expect(screen.getByRole("heading", { name: "Marginal vs average tax" })).toBeInTheDocument();
    const figure = document.querySelector<HTMLElement>("[data-tax-offer='0']")!;
    const f = within(figure);
    expect(f.getByRole("heading", { name: "Northfield Health" })).toBeInTheDocument();
    expect(figure.querySelector("[data-tax-sentence]")).toHaveTextContent(
      /^Only the part of your taxable income above \$105,700 is taxed at 24%/,
    );
    const chart = f.getByRole("img", {
      name: /^Northfield Health: federal tax rate on each dollar/,
    });
    expect(chart.querySelectorAll("rect")).toHaveLength(0);
    const marker = chart.querySelector("[data-marker]")!;
    expect(marker).toHaveAttribute("data-marker", "127000");
    expect(marker).toHaveAttribute("stroke", "var(--carbon)");
    expect(chart).toHaveTextContent("Your taxable income, $127,000");
    expect(chart).toHaveTextContent("Average 15.4% of your pay");
    expect(chart.querySelector("[data-rate-label='yours']")).toHaveTextContent(/^24%( marginal)?$/);
    expect(chart.querySelector("[data-stairs='taxed']")).toHaveAttribute("stroke", "var(--ink)");
    expect(chart.querySelector("[data-stairs='above']")).toHaveAttribute("stroke-dasharray", "4 3");
    expect(chart.querySelector("[data-taxed]")).not.toBeNull();
    expect(f.getByText(/in the 24% bracket, your marginal rate/).closest("ul")).toHaveClass(
      "sr-only",
    );
    expect(f.getByText("24% on $105,700 to $127,000")).toBeInTheDocument();
    expect(f.getByText("Federal income tax on this job")).toBeInTheDocument();
    expect(f.getByText("$23,078")).toBeInTheDocument();
    expect(screen.getByText(/^Figures use the default elections\./)).toBeInTheDocument();
  });

  it("recomputes when the recommended switch turns on, and gives direction when empty", () => {
    render(
      <DecoderProvider initialSampleId="chicago-vs-austin">
        <RecommendedSwitch />
        <ClearOffersButton />
        <TaxPanel />
      </DecoderProvider>,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Use recommended elections" }));
    const figure = document.querySelector<HTMLElement>("[data-tax-offer='0']")!;
    expect(within(figure).getByRole("img")).toHaveTextContent("Your taxable income, $111,900");
    expect(screen.getByText(/^Figures use the recommended elections\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear offers" }));
    expect(
      screen.getByText(
        "Load a sample or fill in an offer to see how its federal tax is worked out.",
      ),
    ).toBeInTheDocument();
  });

  it("labels the household's income on a joint return with a working spouse", () => {
    render(
      <DecoderProvider initialSampleId="high-earner-family">
        <TaxPanel />
      </DecoderProvider>,
    );
    const figure = document.querySelector<HTMLElement>("[data-tax-offer='0']")!;
    expect(within(figure).getByRole("img")).toHaveTextContent("Household taxable income, $326,200");
    expect(within(figure).getByText("Tax on your spouse's wages alone")).toBeInTheDocument();
  });
});
