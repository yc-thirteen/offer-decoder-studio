import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import expectedJson from "../../../harness/fixtures/expected.json";
import type { CaseResult } from "@/lib/engine";
import { SAMPLE_CASES, deriveView, initialDecoderState } from "@/state/decoderState";
import { DecoderProvider } from "@/state/DecoderContext";
import { Checklist } from "./Checklist";
import { checklistItems, vestingDateText } from "./checklistText";

const cases = (expectedJson as unknown as { cases: CaseResult[] }).cases;

function itemsFor(caseId: string, slot: 0 | 1) {
  const s = initialDecoderState(caseId);
  const stub = deriveView(s).stubs[slot];
  return checklistItems(stub.offer!, stub.result!, s.profile);
}

function text(caseId: string, slot: 0 | 1, id: string) {
  return itemsFor(caseId, slot).find((i) => i.id === id)?.text;
}

describe("checklistItems", () => {
  it("writes the DESIGN.md copy for Northfield with the engine's values", () => {
    expect(itemsFor("chicago-vs-austin", 0)).toEqual([
      { id: "raise-401k", text: "Raise your 401(k) from 3% to 12% of pay." },
      {
        id: "unclaimed-match",
        text: "At 3% you'd leave $2,250 of free match on the table each year.",
      },
      { id: "switch-health-plan", text: "Choose HSA Plan 3000 instead of the default PPO 500." },
      {
        id: "default-plan-dominated",
        text: "The default PPO 500 costs more than HSA Plan 3000 at every level of medical spending.",
      },
      {
        id: "open-hsa",
        text:
          "Open the HSA and contribute $3,400 a year through payroll. With the employer's $1,000 " +
          "you reach the $4,400 limit, and payroll contributions skip Social Security and Medicare tax.",
      },
      {
        id: "choose-traditional",
        text: "Pick traditional. At a 24% federal bracket, deducting now is worth more.",
      },
      {
        id: "skip-extra-life-insurance",
        text: "No one depends on your income, so keep the free coverage and skip buying more.",
      },
      {
        id: "check-w4",
        text:
          "Fill out your W-4 so you don't over-withhold. A big refund is an interest-free loan " +
          "to the government.",
      },
      {
        id: "note-vesting-date",
        text: "Put your vesting date in your calendar: the match is fully yours after 3 years of service.",
      },
    ]);
  });

  it("keeps the engine's ids and order for all 12 offers, with no $0 amounts or blanks", () => {
    for (const c of cases) {
      c.offers.forEach((expected, slot) => {
        const items = itemsFor(c.id, slot as 0 | 1);
        expect(items.map((i) => i.id)).toEqual(expected.checklist);
        for (const i of items) {
          expect(i.text).not.toMatch(/\$0(?![\d,])/);
          expect(i.text).not.toMatch(/\{|undefined|NaN|null/);
          expect(i.text).toMatch(/^[A-Z].*\.$/);
        }
      });
    }
  });

  it("omits life insurance parts that are $0 and rephrases", () => {
    expect(text("high-earner-family", 0, "life-insurance")).toBe(
      "Get $2,080,000 of term life coverage: keep the free $520,000 and add $1,560,000 " +
        "through work. Term, not whole life.",
    );
    expect(text("high-earner-family", 1, "life-insurance")).toBe(
      "Get $1,885,295 of term life coverage: keep the free $245,000, add $1,225,000 through " +
        "work, and buy $415,295 on your own only if needed. Term, not whole life.",
    );
    expect(text("one-income-family", 1, "life-insurance")).toBe(
      "Buy $896,823 of term life coverage on your own. Term, not whole life.",
    );
  });

  it("rephrases a 0% default and names the Roth bracket the engine compared", () => {
    expect(text("new-grad-roth", 0, "raise-401k")).toBe("Start your 401(k) at 5% of pay.");
    expect(text("new-grad-roth", 0, "choose-roth")).toBe(
      "Pick Roth. Your federal bracket is 12%, likely lower than it will be later.",
    );
  });

  it("writes vesting dates for each vesting type", () => {
    expect(vestingDateText({ type: "immediate" })).toBe("the match is yours from day one");
    expect(vestingDateText({ type: "cliff", years: 1 })).toBe(
      "the match is fully yours after 1 year of service",
    );
    expect(
      vestingDateText({
        type: "graded",
        schedule: [
          { year: 3, pct: 100 },
          { year: 2, pct: 50 },
        ],
      }),
    ).toBe("50% of the match is yours after 2 years, rising to 100% after 3 years");
  });
});

describe("<Checklist />", () => {
  it("shows the first offer's checklist and switches with the tabs", () => {
    render(
      <DecoderProvider initialSampleId="chicago-vs-austin">
        <Checklist />
      </DecoderProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Back of the stub: what to elect on day one" }),
    ).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Northfield Health", "Lakeshore Systems"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getAllByRole("checkbox")).toHaveLength(9);

    fireEvent.keyDown(tabs[0]!, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Lakeshore Systems" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(screen.getByRole("tabpanel")).getAllByRole("checkbox")).toHaveLength(4);
    expect(screen.getByLabelText("Raise your 401(k) from 4% to 11% of pay.")).toBeInTheDocument();
  });

  it("keeps ticks in memory per offer and shows them in carbon", () => {
    render(
      <DecoderProvider initialSampleId="chicago-vs-austin">
        <Checklist />
      </DecoderProvider>,
    );
    const box = screen.getByLabelText("Raise your 401(k) from 3% to 12% of pay.");
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(box.nextElementSibling).toHaveClass("text-carbon");
    fireEvent.click(screen.getByRole("tab", { name: "Lakeshore Systems" }));
    expect(screen.getByLabelText("Raise your 401(k) from 4% to 11% of pay.")).not.toBeChecked();
    fireEvent.click(screen.getByRole("tab", { name: "Northfield Health" }));
    expect(screen.getByLabelText("Raise your 401(k) from 3% to 12% of pay.")).toBeChecked();
  });

  it("gives direction when no offer is loaded", () => {
    render(
      <DecoderProvider initialSampleId={null}>
        <Checklist />
      </DecoderProvider>,
    );
    expect(screen.queryByRole("tab")).toBeNull();
    expect(
      screen.getByText("Load a sample or upload an offer letter to see what to elect on day one."),
    ).toBeInTheDocument();
  });

  it("has a sample for every case", () => {
    expect(SAMPLE_CASES.map((c) => c.id)).toEqual(cases.map((c) => c.id));
  });
});
