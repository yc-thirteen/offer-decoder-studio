import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import expectedJson from "../../../harness/fixtures/expected.json";
import { formatMoney } from "@/components/stub";
import type { CalcResult, CaseResult } from "@/lib/engine";
import { DecoderProvider } from "@/state/DecoderContext";
import { DecoderControls } from "./DecoderHeader";
import { OfferStubs } from "./OfferStub";
import { pct, placeText, stateTaxRowLabel, vestingNote } from "./stubFormat";

const expected = (expectedJson as unknown as { cases: CaseResult[] }).cases.find(
  (c) => c.id === "chicago-vs-austin",
)!;
const [north, lake] = expected.offers as [CaseResult["offers"][0], CaseResult["offers"][0]];

function setup(initialSampleId: string | null = "chicago-vs-austin") {
  render(
    <DecoderProvider initialSampleId={initialSampleId}>
      <DecoderControls />
      <OfferStubs />
    </DecoderProvider>,
  );
  return {
    stub: (name: RegExp) => screen.getByRole("region", { name }),
    switchOn: () => fireEvent.click(screen.getByRole("switch", { name: /recommended/i })),
  };
}

/** The <dd> amount text on the row whose label matches. */
function rowAmount(stub: HTMLElement, label: RegExp): string {
  const dt = within(stub)
    .getAllByRole("term")
    .find((el) => label.test(el.textContent ?? ""));
  if (!dt) throw new Error(`no row ${label}`);
  return dt.parentElement!.querySelector("dd")!.textContent!;
}

/** Row label → CalcResult field, in stub order. */
const ROWS: [RegExp, keyof CalcResult, number?][] = [
  [/^Gross pay/, "grossPay"],
  [/^401\(k\), /, "employee401k"],
  [/^Health plan/, "healthPremium"],
  [/^Federal income tax/, "federalIncomeTax"],
  [/^Social Security/, "socialSecurity"],
  [/^Medicare/, "medicare"],
  [/^(?!Federal).*income tax$/, "stateIncomeTax"],
  [/^Net pay/, "netPay"],
  [/^401\(k\) match/, "employerMatch"],
  [/^Savings in your name/, "savingsAfterFutureTax"],
  [/^Expected medical bills/, "expectedOutOfPocket", -1],
  [/bottom line/, "bottomLine"],
];

describe("OfferStubs bound to the engine (chicago-vs-austin)", () => {
  it("shows every default amount from expected.json on both stubs", () => {
    const { stub } = setup();
    for (const [offer, name] of [
      [north, /Northfield Health/],
      [lake, /Lakeshore Systems/],
    ] as const) {
      const s = stub(name);
      for (const [label, key, sign = 1] of ROWS) {
        const v = offer.default[key] as number;
        if (key === "stateIncomeTax" && v === 0) continue; // checked by label below
        expect(rowAmount(s, label), `${offer.offerId} ${key}`).toBe(formatMoney(sign * v));
      }
    }
    expect(rowAmount(stub(/Northfield/), /^Net pay/)).toBe("$101,647");
    expect(rowAmount(stub(/Northfield/), /bottom line/)).toBe("$106,585");
    expect(rowAmount(stub(/Lakeshore/), /bottom line/)).toBe("$109,790");
  });

  it("labels, notes, places, and stamps with default elections", () => {
    const { stub } = setup();
    const n = stub(/Northfield Health/);
    const l = stub(/Lakeshore Systems/);
    expect(within(n).getByText("Offer 1 of 2")).toBeTruthy();
    expect(within(l).getByText("Offer 2 of 2")).toBeTruthy();
    expect(within(n).getByText("Chicago, IL")).toBeTruthy();
    expect(within(n).getByText("Illinois income tax")).toBeTruthy();
    expect(within(l).getByText("Texas has no state income tax")).toBeTruthy();
    expect(rowAmount(l, /Texas has no state income tax/)).toBe("$0");
    expect(within(n).getByText(/^401\(k\), traditional 3%$/)).toBeTruthy();
    expect(within(n).getByText(/^Health plan: PPO 500/)).toBeTruthy();
    expect(within(n).getByText("Federal marginal rate 24%, average 15.4%")).toBeTruthy();
    expect(
      within(n).getByText("Match vests after 3 years. Leave sooner and you forfeit it."),
    ).toBeTruthy();
    // PPO 500 is dominated and 3% is under the 6% match cap.
    expect(n.querySelector('[data-stamp="dominated"]')).not.toBeNull();
    expect(n.querySelector('[data-stamp="match-not-claimed"]')).not.toBeNull();
    // Lakeshore: no dominated plan, the 4% default already claims the full match, no HSA.
    expect(l.querySelectorAll("[data-stamp]")).toHaveLength(0);
    expect(within(l).queryByText("HSA contribution")).toBeNull();
    expect(n.querySelectorAll("[data-stamp]").length).toBeLessThanOrEqual(2);
  });

  it("recommended: strikes each changed amount and writes the new one, totals included", () => {
    const { stub, switchOn } = setup();
    switchOn();
    const n = stub(/Northfield Health/);
    const was = (k: keyof CalcResult) => formatMoney(north.default[k] as number);
    const now = (k: keyof CalcResult) => formatMoney(north.recommended[k] as number);
    for (const k of ["employee401k", "healthPremium", "netPay", "bottomLine"] as const) {
      expect(within(n).getByText(`was ${was(k)}, now ${now(k)}`)).toHaveClass("sr-only");
    }
    expect(within(n).getByText("was $106,585, now $112,566")).toBeTruthy();
    expect(within(n).getByText("was $0, now $3,400")).toBeTruthy(); // HSA contribution
    // Gross pay doesn't change, so it isn't corrected.
    expect(rowAmount(n, /^Gross pay/)).toBe("$150,000");
    // Labels follow the elections; the changed parts are carbon.
    expect(within(n).getByText("12%")).toHaveClass("text-carbon");
    expect(within(n).getByText("HSA Plan 3000")).toHaveClass("text-carbon");
    expect(n.querySelectorAll("[data-stamp]")).toHaveLength(0);
    expect(n.querySelectorAll('[data-state="corrected"]').length).toBeGreaterThan(5);
    // Lakeshore's recommended net and bottom line.
    const l = stub(/Lakeshore Systems/);
    expect(
      within(l).getByText(`was $109,790, now ${formatMoney(lake.recommended.bottomLine)}`),
    ).toBeTruthy();
  });

  it("per paycheck: divides by pay periods and shows cents", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: /per paycheck/i }));
    const n = screen.getByRole("region", { name: /Northfield Health/ });
    expect(rowAmount(n, /^Net pay/)).toBe(
      formatMoney(north.default.netPayPerPaycheck, { cents: true }),
    );
    expect(rowAmount(n, /^Net pay/)).toBe("$3,909.51");
    expect(within(n).getByText("Your bottom line per paycheck")).toBeTruthy();
    expect(within(n).getByText("Per paycheck, 26 paychecks a year")).toBeTruthy();
  });

  it("empty stubs give direction", () => {
    setup(null);
    expect(
      screen.getAllByText("Load a sample or read an offer letter to fill this stub."),
    ).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Offer 1 of 2" })).toBeTruthy();
  });

  it("empty stubs show the line labels with blank amounts", () => {
    setup(null);
    const empty = screen.getByRole("region", { name: "Offer 1 of 2" });
    const labels = within(empty)
      .getAllByRole("term")
      .map((t) => t.textContent);
    expect(labels).toEqual([
      "Gross pay",
      "401(k)",
      "Health plan",
      "Federal income tax",
      "Social Security",
      "Medicare",
      "State income tax",
      "Net pay",
      "401(k) match",
      "Expected medical bills",
      "Your yearly bottom line",
    ]);
    for (const dd of within(empty).getAllByRole("definition")) {
      expect(dd.textContent).toBe("");
    }
    expect(within(empty).queryByText(/\$/)).toBeNull();
    expect(within(empty).getByRole("button", { name: "Fill in offer" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /per paycheck/i }));
    expect(within(empty).getByText("Your bottom line per paycheck")).toBeTruthy();
  });

  it("each stub's buttons are described by that stub's heading", () => {
    setup();
    const edits = screen.getAllByRole("button", { name: "Edit offer" });
    expect(edits.map((b) => b.getAttribute("aria-describedby"))).toEqual([
      "offer-stub-1",
      "offer-stub-2",
    ]);
    expect(edits[0]).toHaveAccessibleDescription("Northfield Health");
    expect(
      screen.getAllByRole("button", { name: "Read offer letter" })[1],
    ).toHaveAccessibleDescription("Lakeshore Systems");
    fireEvent.click(screen.getByRole("button", { name: "Clear offers" }));
    expect(screen.getAllByRole("button", { name: "Fill in offer" })[0]).toHaveAccessibleDescription(
      "Offer 1 of 2",
    );
  });

  it("Clear offers empties both stubs and Load sample fills them again", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Clear offers" }));
    expect(screen.queryByRole("region", { name: /Northfield Health/ })).toBeNull();
    expect(
      screen.getAllByText("Load a sample or read an offer letter to fill this stub."),
    ).toHaveLength(2);
    expect(screen.getAllByTestId("empty-stub-lines")).toHaveLength(2);
    // Clearing again is harmless, and the picker still remembers the sample.
    fireEvent.click(screen.getByRole("button", { name: "Clear offers" }));
    fireEvent.click(screen.getByRole("button", { name: "Load sample" }));
    const n = screen.getByRole("region", { name: /Northfield Health/ });
    expect(rowAmount(n, /^Net pay/)).toBe(formatMoney(north.default.netPay));
  });
});

describe("stub words", () => {
  it("formats rates, places, state rows and vesting", () => {
    expect(pct(15.39)).toBe("15.4%");
    expect(pct(24)).toBe("24%");
    expect(placeText({ city: "Remote", state: "OTHER" })).toBe("Remote");
    expect(stateTaxRowLabel({ state: "OTHER", customStateRate: 0.05 }, 6000)).toBe(
      "State income tax",
    );
    expect(stateTaxRowLabel({ state: "WA" }, 0)).toBe("Washington has no state income tax");
    expect(vestingNote({ type: "immediate" })).toBe("The match is yours from day one.");
    expect(vestingNote({ type: "cliff", years: 1 })).toBe(
      "Match vests after 1 year. Leave sooner and you forfeit it.",
    );
    expect(
      vestingNote({
        type: "graded",
        schedule: [
          { year: 2, pct: 50 },
          { year: 3, pct: 100 },
        ],
      }),
    ).toBe(
      "Match vests 50% after 2 years, fully after 3 years. Leave sooner and you forfeit the unvested part.",
    );
  });
});
