import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecoderControls } from "./DecoderHeader";
import { OfferStubs } from "./OfferStub";
import { DecoderProvider } from "@/state/DecoderContext";

function setup(initialSampleId: string | null = "chicago-vs-austin") {
  render(
    <DecoderProvider initialSampleId={initialSampleId}>
      <DecoderControls />
      <OfferStubs />
    </DecoderProvider>,
  );
}

const stub = (n: 1 | 2) => screen.getAllByRole("region")[n - 1]!;
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

function rowAmount(region: HTMLElement, label: RegExp): string {
  const dt = within(region)
    .getAllByRole("term")
    .find((el) => label.test(el.textContent ?? ""));
  if (!dt) throw new Error(`no row ${label}`);
  return dt.parentElement!.querySelector("dd")!.textContent!;
}

describe("Edit offer mode", () => {
  it("opens with the offer's values as inline fields and saves an edit", () => {
    setup();
    const s = stub(1);
    const gross = rowAmount(s, /^Gross pay/);
    expect(gross).toBe("$150,000");
    fireEvent.click(within(s).getByRole("button", { name: "Edit offer" }));

    const salary = within(s).getByLabelText("Yearly salary") as HTMLInputElement;
    expect(salary.value).toBe("150,000");
    expect((within(s).getByLabelText("Employer") as HTMLInputElement).value).toBe(
      "Northfield Health",
    );
    expect(within(s).queryByRole("term")).toBeNull();

    type(salary, "160,000");
    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));

    expect(rowAmount(s, /^Gross pay/)).toBe("$160,000");
    expect(within(s).getByRole("status")).toHaveTextContent("Offer saved");
    expect(within(s).getByRole("button", { name: "Edit offer" })).toHaveFocus();
    // The other stub is untouched.
    expect(within(stub(2)).getByRole("status")).toHaveTextContent("");
  });

  it("blocks a bad save with directive errors and focuses the first one", () => {
    setup();
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Edit offer" }));
    const salary = within(s).getByLabelText("Yearly salary");
    type(salary, "a lot");
    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));

    expect(salary).toHaveAttribute("aria-invalid", "true");
    expect(salary).toHaveAccessibleDescription("Type the yearly salary in dollars.");
    expect(salary).toHaveFocus();
    expect(within(s).getByRole("alert")).toHaveTextContent(
      "Fix the field marked in red, then save the offer.",
    );
    // Still editing, nothing saved.
    expect(within(s).queryByRole("button", { name: "Edit offer" })).toBeNull();

    // The error clears as soon as the field is fixed.
    type(salary, "150000");
    expect(salary).not.toHaveAttribute("aria-invalid");
    expect(within(s).queryByRole("alert")).toBeNull();
  });

  it("adds and removes health plans and match tiers", () => {
    setup();
    const s = stub(2); // Lakeshore: one plan, one tier
    fireEvent.click(within(s).getByRole("button", { name: "Edit offer" }));
    expect(within(s).queryByRole("button", { name: /^Remove PPO 1000/ })).toBeNull();

    fireEvent.click(within(s).getByRole("button", { name: "Add health plan" }));
    const plan2 = within(s).getByRole("group", { name: "Plan 2" });
    type(within(plan2).getByLabelText("Plan name"), "HSA Plan 3000");
    const named = within(s).getByRole("group", { name: "HSA Plan 3000" });
    type(within(named).getByLabelText("Your premium per year"), "300");
    type(within(named).getByLabelText("Deductible"), "3,000");
    type(within(named).getByLabelText("Out-of-pocket max"), "6000");
    fireEvent.change(within(named).getByLabelText("Works with an HSA"), {
      target: { value: "yes" },
    });
    type(within(named).getByLabelText("Employer HSA deposit"), "800");

    fireEvent.click(within(s).getByRole("button", { name: "Add match tier" }));
    const tier2 = within(s).getByRole("group", { name: "Match tier 2" });
    type(within(tier2).getByLabelText("Employer match rate"), "50");
    type(within(tier2).getByLabelText("On pay up to"), "6");
    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));

    // The new HSA plan is the one the engine recommends; the stub still shows the default.
    expect(within(s).getByRole("status")).toHaveTextContent("Offer saved");
    fireEvent.click(within(s).getByRole("button", { name: "Edit offer" }));
    expect(within(s).getByRole("group", { name: "Match tier 2" })).toBeInTheDocument();
    fireEvent.click(within(s).getByRole("button", { name: "Remove match tier 2" }));
    fireEvent.click(within(s).getByRole("button", { name: "Remove HSA Plan 3000" }));
    expect(within(s).queryByRole("group", { name: "Match tier 2" })).toBeNull();
    expect(within(s).queryByRole("group", { name: "HSA Plan 3000" })).toBeNull();
  });

  it("chooses the vesting type and shows the fields that type needs", () => {
    setup();
    const s = stub(1); // Northfield: 3-year cliff
    fireEvent.click(within(s).getByRole("button", { name: "Edit offer" }));
    const vests = within(s).getByLabelText("The match vests") as HTMLSelectElement;
    expect(vests.value).toBe("cliff");
    expect((within(s).getByLabelText("Years until it vests") as HTMLInputElement).value).toBe("3");

    fireEvent.change(vests, { target: { value: "graded" } });
    expect(within(s).queryByLabelText("Years until it vests")).toBeNull();
    const step1 = within(s).getByRole("group", { name: "Vesting step 1" });
    type(within(step1).getByLabelText("After years"), "2");
    type(within(step1).getByLabelText("Share vested"), "100");
    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));
    expect(within(s).getByText(/^Match vests 100% after 2 years\./)).toBeInTheDocument();

    fireEvent.click(within(s).getByRole("button", { name: "Edit offer" }));
    fireEvent.change(within(s).getByLabelText("The match vests"), {
      target: { value: "immediate" },
    });
    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));
    expect(within(s).getByText("The match is yours from day one.")).toBeInTheDocument();
  });

  it("asks for a flat rate only for another state", () => {
    setup();
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Edit offer" }));
    expect(within(s).queryByLabelText("State income tax rate")).toBeNull();
    fireEvent.change(within(s).getByLabelText("State"), { target: { value: "OTHER" } });
    type(within(s).getByLabelText("State income tax rate"), "5");
    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));
    expect(rowAmount(s, /^State income tax/)).not.toBe("$0");
    expect(within(s).getByText(/^A flat 5% on wages/)).toBeInTheDocument();
    expect(within(s).getByText("Chicago")).toBeInTheDocument(); // city alone for another state
  });

  it("cancel leaves the offer as it was", () => {
    setup();
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Edit offer" }));
    type(within(s).getByLabelText("Yearly salary"), "1");
    fireEvent.click(within(s).getByRole("button", { name: "Cancel" }));
    expect(rowAmount(s, /^Gross pay/)).toBe("$150,000");
    expect(within(s).getByRole("status")).toHaveTextContent("");
    expect(within(s).getByRole("button", { name: "Edit offer" })).toHaveFocus();
  });

  it("loading a sample closes the editor without saving", () => {
    setup();
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Edit offer" }));
    fireEvent.click(screen.getByRole("button", { name: "Load sample" }));
    expect(within(s).queryByRole("button", { name: "Save offer" })).toBeNull();
    expect(rowAmount(s, /^Gross pay/)).toBe("$150,000");
  });

  it("fills in an empty stub from a blank form", () => {
    setup(null);
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Fill in offer" }));
    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));
    expect(within(s).getByRole("alert")).toHaveTextContent(/^Fix the 7 fields marked in red/);
    expect(within(s).getByLabelText("Employer")).toHaveFocus();

    type(within(s).getByLabelText("Employer"), "Prairie Labs");
    type(within(s).getByLabelText("City"), "Chicago");
    type(within(s).getByLabelText("Yearly salary"), "90000");
    type(within(s).getByLabelText("Plan name"), "PPO 1000");
    type(within(s).getByLabelText("Your premium per year"), "1,200");
    type(within(s).getByLabelText("Deductible"), "1000");
    type(within(s).getByLabelText("Out-of-pocket max"), "4000");
    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));

    expect(within(s).getByRole("heading", { name: "Prairie Labs" })).toBeInTheDocument();
    expect(rowAmount(s, /^Gross pay/)).toBe("$90,000");
    expect(within(s).getByRole("status")).toHaveTextContent("Offer saved");
  });
});
