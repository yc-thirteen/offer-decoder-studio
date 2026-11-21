import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClearOffersButton, RecommendedSwitch } from "@/components/decoder/DecoderHeader";
import { BRACKETS, federalTaxOnJob, marginalRate, type CalcResult } from "@/lib/engine";
import { SAMPLE_CASES, deriveView, initialDecoderState } from "@/state/decoderState";
import { DecoderProvider } from "@/state/DecoderContext";
import { CHAR_PX, haloTextBox, haloTextWidth, type Box } from "./chartKit";
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

describe("the labels on the tax chart", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Make every chart measure `width` px, as a ResizeObserver would in a browser. */
  function stubWidth(width: number) {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private cb: (e: { contentRect: { width: number } }[]) => void) {}
        observe() {
          this.cb([{ contentRect: { width } }]);
        }
        disconnect() {}
      },
    );
  }

  /**
   * The estimated box of a 13px label, as the chart lays it out: rate labels by their drawn
   * width with the halo (haloTextBox), the average label by CHAR_PX.
   */
  function boxOf(t: Element): Box {
    const text = t.textContent!;
    const x = Number(t.getAttribute("x"));
    const y = Number(t.getAttribute("y"));
    const anchor = (t.getAttribute("text-anchor") ?? "start") as "start" | "middle" | "end";
    if (t.hasAttribute("data-rate-label")) return haloTextBox(text, x, y, anchor);
    const w = text.length * CHAR_PX;
    const l = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    return [l, y - 13, l + w, y + 3];
  }

  it("sizes rate labels at least as wide as they render, halo included", () => {
    // "12%" measures 30.2px at 13px/600 in the browser, before its 4px halo stroke.
    for (const r of ["10%", "12%", "22%", "24%", "32%", "35%", "37%"]) {
      expect(haloTextWidth(r)).toBeGreaterThanOrEqual(30);
    }
    expect(haloTextWidth("22% marginal")).toBeGreaterThanOrEqual(87.6);
    const [l, , rr] = haloTextBox("12%", 100, 50, "middle");
    expect(rr - l).toBeCloseTo(haloTextWidth("12%"));
    expect((l + rr) / 2).toBeCloseTo(100);
  });

  type Seg = [number, number, number, number];

  /** The straight runs of an "M x y L x y …" path, risers included. */
  function segments(d: string): Seg[] {
    const pts = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    const out: Seg[] = [];
    for (let k = 1; k < pts.length; k++) out.push([...pts[k - 1]!, ...pts[k]!] as Seg);
    return out;
  }

  /** Whether an axis-aligned line, drawn ~2px wide, touches the box. */
  function touches([ax, ay, bx, by]: Seg, [l, t, r, b]: Box): boolean {
    const [lx, hx] = [Math.min(ax, bx), Math.max(ax, bx)];
    const [ly, hy] = [Math.min(ay, by), Math.max(ay, by)];
    return lx < r + 1 && hx > l - 1 && ly < b + 1 && hy > t - 1;
  }

  for (const width of [300, 420, 560, 700]) {
    it(`keeps every rate and the average off the lines at ${width}px`, () => {
      stubWidth(width);
      for (const sample of SAMPLE_CASES) {
        for (const mode of ["default", "recommended"] as const) {
          const { unmount, container } = render(
            <DecoderProvider initialSampleId={sample.id}>
              {mode === "recommended" && <RecommendedSwitch />}
              <TaxPanel />
            </DecoderProvider>,
          );
          if (mode === "recommended") {
            fireEvent.click(screen.getByRole("switch", { name: "Use recommended elections" }));
          }
          const charts = [...container.querySelectorAll("svg[role=img]")];
          expect(charts.length).toBeGreaterThan(0);
          charts.forEach((svg, n) => {
            const where = `${sample.id} ${mode} offer ${n + 1} at ${width}px`;
            const lines: [string, Seg][] = [];
            svg.querySelectorAll("[data-stairs]").forEach((p) => {
              for (const sg of segments(p.getAttribute("d")!)) lines.push(["a step", sg]);
            });
            const marker = svg.querySelector("[data-marker]")!;
            const mx = Number(marker.getAttribute("x1"));
            lines.push([
              "the marker",
              [mx, Number(marker.getAttribute("y1")), mx, Number(marker.getAttribute("y2"))],
            ]);
            const avgLine = svg.querySelector("[data-average] line");
            if (avgLine) {
              const ay = Number(avgLine.getAttribute("y1"));
              lines.push([
                "the average line",
                [Number(avgLine.getAttribute("x1")), ay, Number(avgLine.getAttribute("x2")), ay],
              ]);
            }
            const labels = [
              ...svg.querySelectorAll("[data-rate-label]"),
              ...svg.querySelectorAll("[data-average] text"),
            ];
            expect(labels.length, where).toBeGreaterThan(0);
            // Your own rate is always written.
            expect(svg.querySelector("[data-rate-label='yours']"), where).not.toBeNull();
            for (const t of labels) {
              const box = boxOf(t);
              for (const [what, sg] of lines) {
                expect(touches(sg, box), `${where}: "${t.textContent}" on ${what}`).toBe(false);
              }
            }
          });
          unmount();
        }
      }
    });
  }
});
