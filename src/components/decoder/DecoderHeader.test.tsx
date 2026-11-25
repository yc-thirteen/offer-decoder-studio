import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecoderProvider, useDecoder } from "@/state/DecoderContext";
import { SAMPLE_CASES } from "@/state/decoderState";
import { DecoderControls, DecoderHeader } from "./DecoderHeader";

function Probe() {
  const { state } = useDecoder();
  return (
    <p data-testid="state">
      {[state.sampleId ?? "none", state.periodMode, state.electionsMode].join("|")}
    </p>
  );
}

function setup(initialSampleId: string | null = "chicago-vs-austin") {
  render(
    <DecoderProvider initialSampleId={initialSampleId}>
      <DecoderHeader />
      <DecoderControls />
      <Probe />
    </DecoderProvider>,
  );
  return () => screen.getByTestId("state").textContent;
}

describe("DecoderHeader and controls", () => {
  it("shows the brand and the pay period", () => {
    setup();
    expect(screen.getByText("Offer Decoder")).toBeTruthy();
    expect(screen.getByText("Pay period: your first year")).toBeTruthy();
  });

  it("lists all six samples and loads the chosen one with Load sample", () => {
    const read = setup();
    const picker = screen.getByLabelText("Load a sample") as HTMLSelectElement;
    expect(Array.from(picker.options).map((o) => o.value)).toEqual(SAMPLE_CASES.map((c) => c.id));
    expect(picker.value).toBe("chicago-vs-austin");
    fireEvent.change(picker, { target: { value: "plan-crossover" } });
    expect(read()).toMatch(/^chicago-vs-austin\|/); // nothing loads until the button
    act(() => screen.getByRole("button", { name: "Load sample" }).click());
    expect(read()).toMatch(/^plan-crossover\|/);
  });

  it("can load a sample when starting empty", () => {
    const read = setup(null);
    expect(read()).toMatch(/^none\|/);
    act(() => screen.getByRole("button", { name: "Load sample" }).click());
    expect(read()).toMatch(/^chicago-vs-austin\|/);
  });

  it("toggles annual and per paycheck", () => {
    const read = setup();
    const annual = screen.getByRole("radio", { name: "Annual" }) as HTMLInputElement;
    const per = screen.getByRole("radio", { name: "Per paycheck" }) as HTMLInputElement;
    expect(annual.checked).toBe(true);
    act(() => per.click());
    expect(read()).toContain("|perPaycheck|");
    expect(per.checked).toBe(true);
    act(() => annual.click());
    expect(read()).toContain("|annual|");
  });

  it("selects defaults, suggested settings, or My plan", () => {
    const read = setup();
    fireEvent.click(screen.getByRole("radio", { name: "Suggested plan" }));
    expect(read()).toMatch(/\|recommended$/);
    fireEvent.click(screen.getByRole("radio", { name: "My plan" }));
    expect(read()).toMatch(/\|custom$/);
    fireEvent.click(screen.getByRole("radio", { name: "Employer defaults" }));
    expect(read()).toMatch(/\|default$/);
  });
});
