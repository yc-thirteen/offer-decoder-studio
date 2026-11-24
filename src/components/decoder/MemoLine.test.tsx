import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import expectedJson from "../../../harness/fixtures/expected.json";
import { formatMoney } from "@/components/stub";
import type { CaseResult } from "@/lib/engine";
import {
  SAMPLE_CASES,
  decoderReducer,
  deriveView,
  initialDecoderState,
  type ElectionsMode,
} from "@/state/decoderState";
import { DecoderProvider } from "@/state/DecoderContext";
import { DecoderControls } from "./DecoderHeader";
import { MemoLine } from "./MemoLine";
import { memoName, memoText } from "./memoText";

const cases = (expectedJson as unknown as { cases: CaseResult[] }).cases;

function gap(c: CaseResult, mode: ElectionsMode): number {
  const [a, b] = c.offers;
  return Math.abs(Math.round(a![mode].bottomLine - b![mode].bottomLine));
}

describe("memoText", () => {
  it("matches the DESIGN.md example for chicago-vs-austin in both modes", () => {
    const s = initialDecoderState("chicago-vs-austin");
    expect(memoText(deriveView(s), "default")).toBe(
      "With the defaults, Lakeshore Systems looks $3,205 better a year. " +
        "Elect correctly and Northfield Health is worth $1,894 more a year.",
    );
    const on = decoderReducer(s, { type: "setElectionsMode", mode: "recommended" });
    expect(memoText(deriveView(on), "recommended")).toBe(
      "With the recommended elections, Northfield Health is worth $1,894 more a year. " +
        "With the defaults, Lakeshore Systems looks $3,205 better a year.",
    );
  });

  it("names the engine's winner and the fixture gap for every sample", () => {
    for (const sample of SAMPLE_CASES) {
      const want = cases.find((c) => c.id === sample.id)!;
      const view = deriveView(initialDecoderState(sample.id));
      const flips = want.winnerBy_default !== want.winnerBy_recommended;
      for (const mode of ["default", "recommended"] as const) {
        const text = memoText(view, mode);
        const winner = sample.offers.find((o) => o.id === want[`winnerBy_${mode}`])!;
        expect(
          text.startsWith(mode === "default" ? "With the defaults, " : "With the recommended"),
        ).toBe(true);
        expect(text).toContain(`${memoName(winner.employer, 0)} `);
        expect(text).toContain(formatMoney(gap(want, mode)));
        // A second sentence only when the winner flips between the two sets of elections.
        expect(text.split(". ").length).toBe(flips ? 2 : 1);
      }
    }
  });

  it("flips in exactly the two samples DESIGN.md promises", () => {
    const flipping = SAMPLE_CASES.filter((s) =>
      memoText(deriveView(initialDecoderState(s.id)), "default").includes("Elect correctly"),
    ).map((s) => s.id);
    expect(flipping).toEqual(["chicago-vs-austin", "university-staff"]);
  });

  it("drops the parenthetical from employer names", () => {
    expect(memoName("Midway University (staff plan)", 0)).toBe("Midway University");
    expect(memoName("Brightline Software (remote)", 1)).toBe("Brightline Software");
    expect(memoName("", 1)).toBe("Offer 2");
  });

  it("calls two identical offers even", () => {
    const s0 = initialDecoderState("chicago-vs-austin");
    const s = decoderReducer(s0, { type: "setOffer", slot: 1, offer: { ...s0.offers[0]! } });
    expect(memoText(deriveView(s), "default")).toBe(
      "With the defaults, the two offers come out even.",
    );
    expect(memoText(deriveView(s), "recommended")).toBe(
      "With the recommended elections, the two offers come out even.",
    );
  });

  it("gives direction when there is nothing to compare", () => {
    const empty = initialDecoderState(null);
    expect(memoText(deriveView(empty), "default")).toMatch(/^Load a sample or enter one offer/);
    const s0 = initialDecoderState("chicago-vs-austin");
    const lone = decoderReducer(s0, { type: "setOffer", slot: 1, offer: null });
    expect(memoText(deriveView(lone), "default")).toMatch(
      /^Northfield Health has an estimated yearly bottom line/,
    );
    const bad = { ...s0.offers[1]!, defaultPlanId: "missing" };
    const broken = decoderReducer(s0, { type: "setOffer", slot: 1, offer: bad });
    expect(memoText(deriveView(broken), "default")).toMatch(/^Fix the offer marked in red/);
  });
});

describe("<MemoLine />", () => {
  it("reads Memo: and follows the recommended switch", () => {
    render(
      <DecoderProvider initialSampleId="chicago-vs-austin">
        <DecoderControls />
        <MemoLine />
      </DecoderProvider>,
    );
    const memo = screen.getByTestId("memo-line");
    expect(screen.getByRole("region", { name: "Memo" })).toContainElement(memo);
    expect(memo).toHaveTextContent(/^Memo:\s*With the defaults, Lakeshore Systems looks \$3,205/);
    fireEvent.click(screen.getByRole("switch", { name: /recommended/i }));
    expect(memo).toHaveTextContent(/^Memo:\s*With the recommended elections, Northfield Health/);
  });

  it("keeps yearly amounts in per-paycheck mode", () => {
    render(
      <DecoderProvider initialSampleId="chicago-vs-austin">
        <DecoderControls />
        <MemoLine />
      </DecoderProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /per paycheck/i }));
    expect(screen.getByTestId("memo-line")).toHaveTextContent("$3,205 better a year");
  });
});
