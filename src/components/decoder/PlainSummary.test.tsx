import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AIError,
  MockAIClient,
  explainTemplate,
  type AIClient,
  type ExplainRequest,
  type ExplainResult,
} from "@/lib/ai";
import { AIClientProvider } from "@/state/AIClientContext";
import { DecoderProvider, useDecoder } from "@/state/DecoderContext";
import { SAMPLE_CASES, deriveView, initialDecoderState } from "@/state/decoderState";
import { DecoderControls } from "./DecoderHeader";
import { MemoLine } from "./MemoLine";
import { SUMMARY_COPY, singleOfferSummary, summaryRequest } from "./summaryText";

function setup(client: AIClient, sampleId: string | null = "chicago-vs-austin") {
  render(
    <AIClientProvider client={client}>
      <DecoderProvider initialSampleId={sampleId}>
        <DecoderControls />
        <MemoLine />
      </DecoderProvider>
    </AIClientProvider>,
  );
}

const summary = () => screen.queryByTestId("plain-summary");
const toggleRecommended = () =>
  fireEvent.click(screen.getByRole("switch", { name: /use recommended elections/i }));

/** An HTTP-like client whose answers the test releases by hand. */
function manualClient() {
  const calls: {
    req: ExplainRequest;
    signal: AbortSignal | undefined;
    resolve: (r: ExplainResult) => void;
    reject: (e: unknown) => void;
  }[] = [];
  const client: AIClient = {
    kind: "http",
    extractOffer: () => Promise.reject(new Error("not used")),
    explainStub: (req, signal) =>
      new Promise((resolve, reject) => calls.push({ req, signal, resolve, reject })),
  };
  return { client, calls };
}

describe("summaryRequest", () => {
  it("formats either single-offer slot in both modes and keeps its amounts annual", () => {
    for (const sample of SAMPLE_CASES) {
      for (const slot of [0, 1] as const) {
        const state = initialDecoderState(sample.id);
        state.offers[slot === 0 ? 1 : 0] = null;
        state.periodMode = "perPaycheck";
        const view = deriveView(state);
        for (const mode of ["default", "recommended"] as const) {
          const calc = view.stubs[slot].result![mode];
          const text = singleOfferSummary(view, mode)!;
          expect(text).toContain(state.offers[slot]!.employer);
          expect(text).toContain(Math.round(calc.netPay).toLocaleString("en-US"));
          expect(text).toContain(Math.round(calc.savingsAfterFutureTax).toLocaleString("en-US"));
          expect(text).toContain(Math.round(calc.bottomLine).toLocaleString("en-US"));
          expect(text).toContain("not cash available to spend");
        }
        expect(summaryRequest(view, "default")).toBeNull();
      }
    }
  });
  it("is null until both offers have results", () => {
    expect(summaryRequest(deriveView(initialDecoderState(null)), "default")).toBeNull();
  });

  it("carries the engine's numbers and winners for every sample", () => {
    for (const s of SAMPLE_CASES) {
      const view = deriveView(initialDecoderState(s.id));
      for (const mode of ["default", "recommended"] as const) {
        const req = summaryRequest(view, mode)!;
        expect(req.mode).toBe(mode);
        expect(req.winnerId).toBe(view.winners![mode]);
        req.offers.forEach((o, i) => {
          expect(o.bottomLine).toBe(view.stubs[i]!.result![mode].bottomLine);
          expect(o.netPay).toBe(view.stubs[i]!.result![mode].netPay);
        });
      }
    }
  });
});

function LoadOneOffer() {
  const { dispatch } = useDecoder();
  return (
    <button
      onClick={() => dispatch({ type: "setOffer", slot: 1, offer: SAMPLE_CASES[0]!.offers[0]! })}
    >
      Load one offer
    </button>
  );
}

it("shows a single-offer summary without calling the HTTP summary writer", () => {
  const { client, calls } = manualClient();
  render(
    <AIClientProvider client={client}>
      <DecoderProvider initialSampleId={null}>
        <LoadOneOffer />
        <DecoderControls />
        <MemoLine />
      </DecoderProvider>
    </AIClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Load one offer" }));
  expect(screen.getByRole("region", { name: SUMMARY_COPY.heading })).toHaveTextContent(
    "estimated annual take-home pay is $101,647",
  );
  expect(screen.getByTestId("memo-line")).toHaveTextContent("$106,585, including savings");
  expect(screen.queryByRole("button", { name: SUMMARY_COPY.write })).toBeNull();
  expect(calls).toHaveLength(0);
  fireEvent.click(screen.getByRole("switch", { name: /recommended/i }));
  expect(screen.getByRole("region", { name: SUMMARY_COPY.heading })).toHaveTextContent("$112,566");
  expect(calls).toHaveLength(0);
});

describe("PlainSummary on the mock client", () => {
  it("shows the template summary under the memo, labeled, with the sample-writer note", async () => {
    setup(new MockAIClient());
    const want = explainTemplate(
      summaryRequest(deriveView(initialDecoderState("chicago-vs-austin")), "default")!,
    );
    const region = await screen.findByRole("region", { name: SUMMARY_COPY.heading });
    expect(await within(region).findByText(want)).toBeTruthy();
    expect(within(region).getByText(SUMMARY_COPY.sampleNote)).toBeTruthy();
    expect(within(region).queryByRole("button")).toBeNull();
    // It follows the memo line inside the memo section.
    const memo = screen.getByRole("region", { name: "Memo" });
    expect(memo.contains(region)).toBe(true);
  });

  it("rewrites the summary when the elections switch flips", async () => {
    setup(new MockAIClient());
    const view = deriveView(initialDecoderState("chicago-vs-austin"));
    const rec = explainTemplate(summaryRequest(view, "recommended")!);
    toggleRecommended();
    expect(await screen.findByText(rec)).toBeTruthy();
    expect(rec).toContain("With the recommended elections, Northfield Health");
  });

  it("renders nothing without two offers", () => {
    setup(new MockAIClient(), null);
    expect(summary()).toBeNull();
  });

  it("shows the client's directive error", async () => {
    const client = new MockAIClient();
    vi.spyOn(client, "explainStub").mockRejectedValue(new AIError("Fix this, then ask again."));
    setup(client);
    expect((await screen.findByRole("alert")).textContent).toBe("Fix this, then ask again.");
  });
});

describe("PlainSummary on the HTTP client", () => {
  it("waits for the button, shows progress, then the summary", async () => {
    const { client, calls } = manualClient();
    setup(client);
    expect(screen.getByText(SUMMARY_COPY.prompt)).toBeTruthy();
    expect(screen.queryByText(SUMMARY_COPY.sampleNote)).toBeNull();
    expect(calls).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: SUMMARY_COPY.write }));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.req.mode).toBe("default");
    expect(screen.getByText(SUMMARY_COPY.writing)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: SUMMARY_COPY.write }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await act(async () => calls[0]!.resolve({ summary: "Northfield wins once you elect." }));
    expect(screen.getByText("Northfield wins once you elect.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: SUMMARY_COPY.write })).toBeNull();
  });

  it("clears the summary and cancels a call in flight when the elections change", async () => {
    const { client, calls } = manualClient();
    setup(client);
    fireEvent.click(screen.getByRole("button", { name: SUMMARY_COPY.write }));
    toggleRecommended();
    expect(calls[0]!.signal?.aborted).toBe(true);
    await act(async () => calls[0]!.resolve({ summary: "Stale words." }));
    expect(screen.queryByText("Stale words.")).toBeNull();
    expect(screen.getByText(SUMMARY_COPY.prompt)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: SUMMARY_COPY.write }));
    expect(calls[1]!.req.mode).toBe("recommended");
    await act(async () => calls[1]!.resolve({ summary: "Fresh words." }));
    expect(screen.getByText("Fresh words.")).toBeTruthy();
    toggleRecommended();
    expect(screen.queryByText("Fresh words.")).toBeNull();
  });

  it("keeps a call in flight when only the per-paycheck toggle changes", async () => {
    const { client, calls } = manualClient();
    setup(client);
    fireEvent.click(screen.getByRole("button", { name: SUMMARY_COPY.write }));
    fireEvent.click(screen.getByRole("radio", { name: /per paycheck/i }));
    expect(calls[0]!.signal?.aborted).toBe(false);
    await act(async () => calls[0]!.resolve({ summary: "Same numbers." }));
    expect(screen.getByText("Same numbers.")).toBeTruthy();
  });

  it("shows a directive error and lets you ask again", async () => {
    const { client, calls } = manualClient();
    setup(client);
    fireEvent.click(screen.getByRole("button", { name: SUMMARY_COPY.write }));
    await act(async () => calls[0]!.reject(new Error("boom")));
    expect(screen.getByRole("alert").textContent).toBe(SUMMARY_COPY.failed);
    fireEvent.click(screen.getByRole("button", { name: SUMMARY_COPY.write }));
    expect(calls).toHaveLength(2);
  });
});
