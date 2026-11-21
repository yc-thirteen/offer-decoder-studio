import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClearOffersButton } from "@/components/decoder/DecoderHeader";
import { insuredFraction, lifeInsurance } from "@/lib/engine";
import { SAMPLE_CASES, deriveView, initialDecoderState } from "@/state/decoderState";
import { DecoderProvider } from "@/state/DecoderContext";
import { LECTURE_SETTINGS, MARKUP_X_MAX, lifeChartData, type LifeSettings } from "./lifeData";
import { LifeInsurancePanel } from "./LifeInsurancePanel";

function dataFor(sampleId: string, slot: 0 | 1, settings: LifeSettings = LECTURE_SETTINGS) {
  const s = initialDecoderState(sampleId);
  const stub = deriveView(s).stubs[slot];
  return lifeChartData(stub.offer!, stub.result!, s.profile, settings);
}

describe("lifeChartData", () => {
  it("states the high-earner-family conclusions at the lecture values", () => {
    const harbor = dataFor("high-earner-family", 0)!;
    expect(harbor.sentence).toBe(
      "Get $2,080,000 of term life coverage: keep the free $520,000 and add $1,560,000 " +
        "through work. Term, not whole life.",
    );
    expect(harbor.reason).toBe(
      "Your pay to age 67 is worth $4,079,810 today, 67% of your household's wealth. Insure " +
        "90% of it through work, at a 20% markup, but only 50% on your own, where coverage " +
        "costs a 100% markup.",
    );
    expect(harbor.markers.map((m) => [m.label, m.markupPct])).toEqual([
      ["Through work: 90%", 20],
      ["On your own: 50%", 100],
    ]);
    expect(harbor.total.amount).toBe(2080000);
    const evergreen = dataFor("high-earner-family", 1)!;
    expect(evergreen.sentence).toBe(
      "Get $1,885,295 of term life coverage: keep the free $245,000, add $1,225,000 through " +
        "work, and buy $415,295 on your own only if needed. Term, not whole life.",
    );
  });

  it("drops $0 parts: Riverbend has no coverage through work", () => {
    const riverbend = dataFor("one-income-family", 1)!;
    expect(riverbend.sentence).toBe(
      "Buy $896,823 of term life coverage on your own. Term, not whole life.",
    );
    expect(riverbend.rows.find((r) => r.label === "Free basic coverage")!.amount).toBe(0);
  });

  it("is null when nobody depends on your income", () => {
    expect(dataFor("chicago-vs-austin", 0)).toBeNull();
  });

  it("matches the engine for every dependents offer, and the line is the formula", () => {
    let checked = 0;
    for (const sample of SAMPLE_CASES) {
      const s = initialDecoderState(sample.id);
      if (!s.profile.hasDependents) continue;
      for (const stub of deriveView(s).stubs) {
        for (const settings of [LECTURE_SETTINGS, { riskAversion: 5.5, employerMarkup: 0.45 }]) {
          const d = lifeChartData(stub.offer!, stub.result!, s.profile, settings)!;
          const engine = lifeInsurance(stub.offer!, s.profile, settings)!;
          expect(d.life).toEqual(engine);
          if (settings === LECTURE_SETTINGS) expect(d.life).toEqual(stub.result!.lifeInsurance);
          const share = engine.humanCapital / engine.householdWealth;
          expect(d.points[0]).toEqual([0, 100]);
          expect(d.points[d.points.length - 1]![0]).toBe(MARKUP_X_MAX);
          for (const [m, f] of d.points) {
            expect(f).toBeCloseTo(insuredFraction(m / 100, settings.riskAversion, share) * 100, 6);
          }
          for (const mk of d.markers) {
            const f = insuredFraction(mk.markupPct / 100, settings.riskAversion, share) * 100;
            expect(Math.abs(mk.fractionPct - f)).toBeLessThan(0.5);
          }
          expect(d.markers[0]!.fractionPct).toBeCloseTo(engine.fractionEmployer * 100, 6);
          expect(d.markers[1]!.fractionPct).toBeCloseTo(engine.fractionIndividual * 100, 6);
          expect(d.sentence + d.reason).not.toMatch(/undefined|NaN|Infinity|\$0\b/);
          checked++;
        }
      }
    }
    expect(checked).toBe(8);
  });

  it("rephrases when the markup outweighs the protection", () => {
    const harsh = { riskAversion: 1, employerMarkup: 1 };
    const summit = dataFor("one-income-family", 0, harsh)!;
    expect(summit.sentence).toBe(
      "Keep the free $88,000 of term life coverage through work and skip buying more. Term, " +
        "not whole life.",
    );
    expect(summit.reason).toMatch(
      /At a 100% markup, even coverage through work costs more than it protects, so keep only what is free\.$/,
    );
    expect(summit.zeroAtPct).toBeCloseTo(97.28, 1);
    expect(dataFor("one-income-family", 1, harsh)!.sentence).toBe(
      "At these settings, life insurance costs more than it protects, so buy none.",
    );
  });
});

describe("LifeInsurancePanel", () => {
  it("is not shown when nobody depends on your income", () => {
    const { container } = render(
      <DecoderProvider initialSampleId="chicago-vs-austin">
        <LifeInsurancePanel />
      </DecoderProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("draws both markers, the dollars, and recomputes live from the sliders", () => {
    render(
      <DecoderProvider initialSampleId="one-income-family">
        <LifeInsurancePanel />
      </DecoderProvider>,
    );
    expect(screen.getByRole("heading", { name: "Life insurance" })).toBeInTheDocument();
    const chart = screen.getByRole("img", { name: /^Summit Logistics: share of your human/ });
    expect(chart.querySelector("[data-life-line]")!.getAttribute("stroke")).toBe("var(--ink)");
    expect(chart.querySelector('[data-life-marker="work"]')!.getAttribute("fill")).toBe(
      "var(--carbon)",
    );
    expect(chart.querySelector('[data-life-marker="own"]')!.getAttribute("fill")).toBe(
      "var(--ink)",
    );
    expect(chart.textContent).toContain("Through work: 93%");
    expect(chart.textContent).toContain("On your own: 66%");
    expect(chart.textContent).toContain("Markup on the coverage");
    expect(chart.querySelectorAll("rect")).toHaveLength(0);

    const summit = document.querySelector<HTMLElement>('[data-life-offer="0"]')!;
    const sentence = () => summit.querySelector("[data-life-sentence]")!.textContent;
    expect(sentence()).toBe(
      "Get $940,164 of term life coverage: keep the free $88,000, add $440,000 through work, " +
        "and buy $412,164 on your own only if needed. Term, not whole life.",
    );
    expect(within(summit).getByText("Human capital").nextSibling!.textContent).toBe("$1,430,245");
    expect(screen.queryByText(/The checklist still uses/)).toBeNull();

    const risk = screen.getByRole("slider", { name: "Risk aversion" });
    const markup = screen.getByRole("slider", { name: "Markup on coverage through work" });
    expect(risk).toHaveValue("3");
    expect(markup).toHaveValue("20");
    expect(markup).toHaveAttribute("aria-valuetext", "20%");
    fireEvent.change(risk, { target: { value: "6" } });
    fireEvent.change(markup, { target: { value: "40" } });

    const s = initialDecoderState("one-income-family");
    const stub = deriveView(s).stubs[0];
    const live = lifeChartData(stub.offer!, stub.result!, s.profile, {
      riskAversion: 6,
      employerMarkup: 0.4,
    })!;
    expect(sentence()).toBe(live.sentence);
    expect(sentence()).not.toBe(dataFor("one-income-family", 0)!.sentence);
    expect(chart.textContent).toContain(live.markers[0]!.label);
    expect(screen.getByText(/The checklist still uses the lecture values/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use lecture values" }));
    expect(risk).toHaveValue("3");
    expect(markup).toHaveValue("20");
    expect(sentence()).toBe(dataFor("one-income-family", 0)!.sentence);
  });

  it("gives direction when there are no offers", () => {
    render(
      <DecoderProvider initialSampleId="high-earner-family">
        <ClearOffersButton />
        <LifeInsurancePanel />
      </DecoderProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear offers" }));
    expect(
      screen.getByText("Load a sample or fill in an offer to see how much life insurance to get."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("slider")).toBeNull();
  });
});
