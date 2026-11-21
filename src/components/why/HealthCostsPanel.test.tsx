import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { breakpoints, planCost, worstCaseCost } from "@/lib/engine";
import { SAMPLE_CASES, deriveView, initialDecoderState } from "@/state/decoderState";
import { DecoderProvider } from "@/state/DecoderContext";
import { niceTicks, spreadLabels, tickMoney, yAxisLeft } from "./chartKit";
import { healthChartData, lineLabel, spendWindow } from "./healthChart";
import { HealthCostsPanel } from "./HealthCostsPanel";

function dataFor(sampleId: string, slot: 0 | 1) {
  const s = initialDecoderState(sampleId);
  const stub = deriveView(s).stubs[slot];
  return healthChartData(stub.offer!, stub.result!, s.profile);
}

describe("chartKit", () => {
  it("makes nice ticks that cover the range", () => {
    expect(niceTicks(0, 5832, 5)).toEqual([0, 2000, 4000, 6000]);
    expect(niceTicks(-400, 5832, 5)).toEqual([-2000, 0, 2000, 4000, 6000]);
    expect(niceTicks(0, 15000, 3)).toEqual([0, 5000, 10000, 15000]);
  });

  it("spreads labels apart without reordering them", () => {
    expect(spreadLabels([100, 104], 16, 0, 300)).toEqual([100, 116]);
    expect(spreadLabels([104, 100], 16, 0, 300)).toEqual([116, 100]);
    expect(spreadLabels([295, 298], 16, 0, 300)).toEqual([284, 300]);
  });

  it("formats axis money with a true minus", () => {
    expect(tickMoney(-1000)).toBe("−$1,000");
    expect(tickMoney(15000)).toBe("$15,000");
  });

  it("starts the plot far enough right for the widest y label", () => {
    // 6 characters fit the 62px default; "$10,000" and "−$2,000" (59px at 13px) need more.
    expect(yAxisLeft(["$0", "$2,000", "$6,000"])).toBe(62);
    const wide = yAxisLeft(["−$2,000", "$0", "$10,000"]);
    expect(wide).toBeGreaterThanOrEqual(59 + 8 + 1);
    expect(yAxisLeft(["$100,000"])).toBeGreaterThan(wide);
  });
});

describe("healthChartData", () => {
  it("states the chicago-vs-austin conclusions", () => {
    expect(dataFor("chicago-vs-austin", 0).sentence).toBe(
      "Choose HSA Plan 3000: at your expected $2,000 of medical spending it costs $1,600 a year, " +
        "$1,600 less than the default PPO 500, which costs more at every level of spending.",
    );
    expect(dataFor("chicago-vs-austin", 1).sentence).toBe(
      "Lakeshore Systems offers one plan, PPO 1000: at your expected $2,000 of medical spending " +
        "it costs $3,000 a year, and never more than $5,800.",
    );
  });

  it("compares worst cases when there is no emergency fund", () => {
    expect(dataFor("new-grad-roth", 1).sentence).toBe(
      "Keep the default PPO 750: with no emergency fund, the lowest worst case wins, and it tops " +
        "out at $5,000 a year against $6,300 for HSA Plan 3200.",
    );
  });

  it("names a non-dominated default without calling it dominated", () => {
    expect(dataFor("plan-crossover", 0).sentence).toBe(
      "Choose PPO 250: at your expected $12,000 of medical spending it costs $5,025 a year, " +
        "$1,425 less than the default HSA Plan 3500.",
    );
  });

  it("follows the engine for every plan of every sample", () => {
    const s0 = initialDecoderState();
    for (const sample of SAMPLE_CASES) {
      const s = initialDecoderState(sample.id);
      for (const stub of deriveView(s).stubs) {
        const offer = stub.offer!;
        const r = stub.result!;
        const d = healthChartData(offer, r, s.profile);
        expect(d.lines.map((l) => l.plan.id)).toEqual(offer.healthPlans.map((p) => p.id));
        const bps = breakpoints(offer.healthPlans);
        // The window shows every bend and your expected spending.
        expect(d.xMax).toBeGreaterThanOrEqual(bps[bps.length - 2]!);
        expect(d.xMax).toBeGreaterThan(s.profile.expectedMedicalSpend);
        for (const l of d.lines) {
          const kind =
            l.plan.id === r.recommendedElections.planId
              ? "recommended"
              : r.dominatedPlanIds.includes(l.plan.id)
                ? "dominated"
                : "other";
          expect(l.kind).toBe(kind);
          expect(l.costAtSpend).toBe(planCost(l.plan, s.profile.expectedMedicalSpend));
          expect(l.worstCase).toBe(worstCaseCost(l.plan));
          // Every drawn point is on the engine's curve, ending at the window edge.
          for (const [x, c] of l.points) expect(c).toBeCloseTo(planCost(l.plan, x), 2);
          expect(l.points[l.points.length - 1]![0]).toBe(d.xMax);
        }
        expect(d.sentence).not.toMatch(/undefined|NaN/);
      }
    }
    expect(s0.sampleId).toBe("chicago-vs-austin");
  });

  it("rounds the spending window up past the last bend", () => {
    const curves = {
      a: [
        [0, 0],
        [500, 1],
        [13000, 2],
        [20500, 2],
      ] as [number, number][],
    };
    expect(spendWindow(curves, 2000)).toBe(16000);
    expect(spendWindow(curves, 30000)).toBe(35000);
  });

  it("tags lines only when there is a choice", () => {
    const [ppo, hdhp] = dataFor("chicago-vs-austin", 0).lines;
    expect(lineLabel(ppo!, 2)).toBe("PPO 500, dominated");
    expect(lineLabel(hdhp!, 2)).toBe("HSA Plan 3000, recommended");
    expect(lineLabel(dataFor("chicago-vs-austin", 1).lines[0]!, 1)).toBe("PPO 1000");
  });
});

describe("HealthCostsPanel", () => {
  it("draws dominated dashed red, recommended solid carbon, with direct labels and the marker", () => {
    render(
      <DecoderProvider initialSampleId="chicago-vs-austin">
        <HealthCostsPanel />
      </DecoderProvider>,
    );
    expect(screen.getByRole("heading", { name: "Health plan costs" })).toBeInTheDocument();
    const chart = screen.getByRole("img", { name: /^Northfield Health: yearly cost/ });
    // The HSA deposit takes the HDHP below $0, so "−$2,000" is a y label; the axis must clear it.
    const yLabels = [...chart.querySelectorAll('text[text-anchor="end"]')].filter((t) =>
      /^−?\$[\d,]+$/.test(t.textContent ?? ""),
    );
    expect(yLabels.map((t) => t.textContent)).toContain("−$2,000");
    for (const t of yLabels) expect(Number(t.getAttribute("x"))).toBeGreaterThanOrEqual(59);
    const ppo = chart.querySelector('[data-plan-id="ppo"]')!;
    const hdhp = chart.querySelector('[data-plan-id="hdhp"]')!;
    expect(ppo.getAttribute("stroke")).toBe("var(--correction)");
    expect(ppo.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(hdhp.getAttribute("stroke")).toBe("var(--carbon)");
    expect(hdhp.getAttribute("stroke-dasharray")).toBeNull();
    const text = chart.textContent ?? "";
    expect(text).toContain("PPO 500, dominated, at most $5,400");
    expect(text).toContain("HSA Plan 3000, recommended, at most $4,600");
    expect(text).toContain("Your spending, $2,000");
    expect(text).toContain("$3,200");
    expect(text).toContain("$1,600");
    expect(text).toContain("Medical spending this year");
    // No legend boxes: nothing but lines, dots, and text.
    expect(chart.querySelectorAll("rect")).toHaveLength(0);
    // Both offers get a chart, and the values are listed for screen readers.
    expect(
      screen.getByRole("img", { name: /^Lakeshore Systems: yearly cost/ }),
    ).toBeInTheDocument();
    const figure = chart.closest("figure")!;
    expect(
      within(figure).getByText(/PPO 500, dominated: \$3,200 a year at \$2,000/),
    ).toBeInTheDocument();
  });

  it("gives direction when there are no offers", () => {
    render(
      <DecoderProvider initialSampleId={null}>
        <HealthCostsPanel />
      </DecoderProvider>,
    );
    expect(
      screen.getByText("Load a sample or fill in an offer to compare its health plans."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
