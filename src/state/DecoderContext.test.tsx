import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecoderProvider, useDecoder } from "./DecoderContext";

function Probe() {
  const { state, view, dispatch } = useDecoder();
  return (
    <div>
      <p data-testid="sample">{state.sampleId ?? "none"}</p>
      <p data-testid="winner">
        {view.activeWinnerSlot === null ? "none" : view.stubs[view.activeWinnerSlot].offer?.id}
      </p>
      <button onClick={() => dispatch({ type: "setElectionsMode", mode: "recommended" })}>
        rec
      </button>
      <button onClick={() => dispatch({ type: "clearOffers" })}>clear</button>
    </div>
  );
}

describe("DecoderProvider", () => {
  it("serves state and the engine view, and updates on dispatch", () => {
    render(
      <DecoderProvider>
        <Probe />
      </DecoderProvider>,
    );
    expect(screen.getByTestId("sample").textContent).toBe("chicago-vs-austin");
    expect(screen.getByTestId("winner").textContent).toBe("lakeshore");
    act(() => screen.getByText("rec").click());
    expect(screen.getByTestId("winner").textContent).toBe("northfield");
    act(() => screen.getByText("clear").click());
    expect(screen.getByTestId("sample").textContent).toBe("none");
    expect(screen.getByTestId("winner").textContent).toBe("none");
  });

  it("can start empty", () => {
    render(
      <DecoderProvider initialSampleId={null}>
        <Probe />
      </DecoderProvider>,
    );
    expect(screen.getByTestId("sample").textContent).toBe("none");
  });

  it("throws a directive error outside the provider", () => {
    expect(() => render(<Probe />)).toThrow(/inside <DecoderProvider>/);
  });
});
