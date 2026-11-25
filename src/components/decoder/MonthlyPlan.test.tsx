import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatMoney } from "@/components/stub";
import type { AIClient } from "@/lib/ai";
import { AIClientProvider } from "@/state/AIClientContext";
import { DecoderProvider, useDecoder } from "@/state/DecoderContext";
import { DecoderControls } from "./DecoderHeader";
import { OfferStubs } from "./OfferStub";
import { MemoLine } from "./MemoLine";
import { MonthlyPlan } from "./MonthlyPlan";

function Probe() {
  const { view, dispatch } = useDecoder();
  return (
    <>
      <span data-testid="active-net">{view.stubs[0].calc?.netPay ?? "invalid"}</span>
      <span data-testid="expected-remaining">
        {view.stubs[0].monthlyPlan?.remaining ?? "incomplete"}
      </span>
      <button onClick={() => dispatch({ type: "setOffer", slot: 1, offer: null })}>
        Remove second offer for test
      </button>
    </>
  );
}

function setup() {
  const explain = vi.fn().mockResolvedValue({ summary: "Cloud comparison." });
  const client: AIClient = { kind: "http", extractOffer: vi.fn(), explainStub: explain };
  render(
    <AIClientProvider client={client}>
      <DecoderProvider>
        <DecoderControls />
        <OfferStubs />
        <MemoLine />
        <MonthlyPlan />
        <Probe />
      </DecoderProvider>
    </AIClientProvider>,
  );
  return { explain, panel: () => screen.getByTestId("monthly-plan") };
}

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function budget(living = "3000") {
  change("Living expenses per month", living);
  change("Minimum debt payments per month", "0");
  change("Additional cash savings per month", "500");
}

describe("monthly plan workflow", () => {
  it("requires explicit expenses, accepts zero, shows shortfalls, and stays monthly in paycheck mode", () => {
    setup();
    expect(screen.queryByTestId("monthly-remaining")).toBeNull();
    budget();
    const remaining = screen.getByTestId("monthly-remaining").textContent;
    expect(remaining).toBe(
      formatMoney(Number(screen.getByTestId("expected-remaining").textContent), { cents: true }),
    );
    fireEvent.click(screen.getByRole("radio", { name: "Per paycheck" }));
    expect(screen.getByTestId("monthly-remaining")).toHaveTextContent(remaining!);
    change("Living expenses per month", "20000");
    expect(screen.getByText("Monthly shortfall")).toBeTruthy();
    change("Living expenses per month", "-100");
    expect(screen.queryByTestId("monthly-remaining")).toBeNull();
    expect(screen.getByLabelText("Living expenses per month")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    change("Living expenses per month", "0");
    expect(screen.getByText("Monthly amount remaining")).toBeTruthy();
  });

  it("custom edits update stub, summary and budget together, with no cloud request", () => {
    const { explain } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Remove second offer for test" }));
    budget();
    fireEvent.click(screen.getByRole("radio", { name: "Suggested plan" }));
    const before = Number(screen.getByTestId("active-net").textContent);
    fireEvent.click(screen.getByRole("button", { name: "Customize contributions" }));
    change("My 401(k) contribution", "6");
    const net = Number(screen.getByTestId("active-net").textContent);
    expect(net).toBeGreaterThan(before);
    const stub = screen.getByRole("region", { name: "Northfield Health" });
    expect(
      within(stub).getByText(
        new RegExp(`now ${formatMoney(net).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("plain-summary")).toHaveTextContent(formatMoney(net));
    expect(screen.getByTestId("monthly-remaining")).toHaveTextContent(
      formatMoney(Number(screen.getByTestId("expected-remaining").textContent), { cents: true }),
    );
    expect(explain).not.toHaveBeenCalled();
    change("My payroll HSA contribution per year", "3401");
    expect(screen.getByTestId("active-net")).toHaveTextContent("invalid");
    expect(screen.queryByTestId("monthly-remaining")).toBeNull();
    expect(screen.queryByTestId("plain-summary")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset this offer to suggested settings" }));
    expect(screen.getByLabelText("My payroll HSA contribution per year")).toHaveValue("3400");
  });

  it("keeps offer budgets independent, and HSA use reduces the cash reserve", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "Suggested plan" }));
    budget();
    const cashRemaining = Number(screen.getByTestId("expected-remaining").textContent);
    fireEvent.click(screen.getByRole("checkbox", { name: /Use this year's HSA contributions/ }));
    expect(Number(screen.getByTestId("expected-remaining").textContent)).toBeGreaterThan(
      cashRemaining,
    );
    expect(screen.getByText(/HSA retained after those bills/)).toHaveTextContent("$2,400");
    change("Plan for offer", "1");
    expect(screen.getByLabelText("Living expenses per month")).toHaveValue("");
    expect(screen.queryByTestId("monthly-remaining")).toBeNull();
    change("Plan for offer", "0");
    expect(screen.getByLabelText("Living expenses per month")).toHaveValue("3000");
  });

  it("replaces a completed cloud summary when switching to My plan and formats both offers locally", async () => {
    const { explain } = setup();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Write plain-English summary" })),
    );
    expect(screen.getByText("Cloud comparison.")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "My plan" }));
    expect(screen.queryByText("Cloud comparison.")).toBeNull();
    expect(screen.getByTestId("plain-summary")).toHaveTextContent("your selected settings");
    expect(explain).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Write plain-English summary" })).toBeNull();
  });
});
