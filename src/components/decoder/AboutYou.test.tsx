import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/engine";
import { DecoderProvider, useDecoder } from "@/state/DecoderContext";
import { AboutYou } from "./AboutYou";
import { parseAge, parseDollars, profileSummary } from "./profileFormat";

let latest: Profile | null = null;
let loadSample: (id: string) => void = () => {};
function Probe() {
  const { state, dispatch } = useDecoder();
  latest = state.profile;
  loadSample = (sampleId) => dispatch({ type: "loadSample", sampleId });
  return null;
}

function setup(sample = "chicago-vs-austin") {
  render(
    <DecoderProvider initialSampleId={sample}>
      <AboutYou />
      <Probe />
    </DecoderProvider>,
  );
  return () => latest as Profile;
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe("parsers", () => {
  it("parses dollar amounts", () => {
    expect(parseDollars("$12,000")).toBe(12000);
    expect(parseDollars(" 0 ")).toBe(0);
    expect(parseDollars("1500.50")).toBe(1501);
    expect(parseDollars("")).toBeNull();
    expect(parseDollars("-5")).toBeNull();
    expect(parseDollars("12k")).toBeNull();
  });
  it("parses ages", () => {
    expect(parseAge("27")).toBe(27);
    expect(parseAge("15")).toBeNull();
    expect(parseAge("101")).toBeNull();
    expect(parseAge("2.5")).toBeNull();
  });
  it("summarizes the profile without middle dots", () => {
    const s = profileSummary({
      filingStatus: "mfj",
      otherHouseholdWages: 0,
      coverage: "family",
      expectedMedicalSpend: 6000,
      hasEmergencyFund: true,
      hasHighInterestDebt: false,
      hasDependents: true,
      age: 34,
      currentSavings: 0,
    });
    expect(s).toBe("Married filing jointly, family coverage, $6,000 medical spending");
  });
});

describe("AboutYou", () => {
  it("shows every profile field from the loaded sample", () => {
    setup();
    expect(field("Filing").value).toBe("single");
    expect(field("Coverage").value).toBe("self");
    expect(field("Medical spending this year").value).toBe("2,000");
    expect(field("Emergency fund").value).toBe("yes");
    expect(field("High-interest debt").value).toBe("no");
    expect(field("Someone depends on my income").value).toBe("no");
    expect(field("Age").value).toBe("27");
    expect(field("Current savings").value).toBe("25,000");
  });

  it("shows spouse's wages only when filing jointly", () => {
    const read = setup();
    expect(screen.queryByLabelText("Spouse's wages")).toBeNull();
    act(() => {
      fireEvent.change(field("Filing"), { target: { value: "mfj" } });
    });
    expect(read().filingStatus).toBe("mfj");
    fireEvent.change(field("Spouse's wages"), { target: { value: "80,000" } });
    expect(read().otherHouseholdWages).toBe(80000);
    fireEvent.change(field("Filing"), { target: { value: "single" } });
    expect(screen.queryByLabelText("Spouse's wages")).toBeNull();
  });

  it("commits valid typing live and shows a directive error for invalid typing", () => {
    const read = setup();
    const med = field("Medical spending this year");
    fireEvent.change(med, { target: { value: "12000" } });
    expect(read().expectedMedicalSpend).toBe(12000);
    fireEvent.blur(med);
    expect(med.value).toBe("12,000");

    fireEvent.change(med, { target: { value: "lots" } });
    expect(read().expectedMedicalSpend).toBe(12000); // last good value stays
    expect(med.getAttribute("aria-invalid")).toBe("true");
    const error = screen.getByText("Type your expected medical bills in dollars, or 0.");
    expect(med.getAttribute("aria-describedby")).toBe(error.id);

    fireEvent.change(field("Age"), { target: { value: "12" } });
    expect(screen.getByText("Type your age in whole years, 16 to 100.")).toBeTruthy();
    expect(read().age).toBe(27);
  });

  it("updates booleans and coverage", () => {
    const read = setup();
    fireEvent.change(field("Coverage"), { target: { value: "family" } });
    fireEvent.change(field("Emergency fund"), { target: { value: "no" } });
    fireEvent.change(field("High-interest debt"), { target: { value: "yes" } });
    fireEvent.change(field("Someone depends on my income"), { target: { value: "yes" } });
    const p = read();
    expect([p.coverage, p.hasEmergencyFund, p.hasHighInterestDebt, p.hasDependents]).toEqual([
      "family",
      false,
      true,
      true,
    ]);
  });

  it("follows the store when a new sample loads, clearing errors", () => {
    setup();
    fireEvent.change(field("Age"), { target: { value: "x" } });
    act(() => loadSample("high-earner-family"));
    expect(field("Age").value).toBe("34");
    expect(field("Age").getAttribute("aria-invalid")).toBeNull();
    expect(field("Spouse's wages").value).toBe("120,000");
    expect(field("Medical spending this year").value).toBe("6,000");
  });

  it("toggles the mobile disclosure", () => {
    setup();
    const btn = screen.getByRole("button", { name: "Change your details" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    act(() => btn.click());
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(btn.textContent).toBe("Hide your details");
    expect(document.getElementById(btn.getAttribute("aria-controls") ?? "")).toBeTruthy();
  });
});
