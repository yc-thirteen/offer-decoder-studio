/**
 * Words and the engine-numbers request for the plain-English summary (PlainSummary.tsx).
 */
import { buildExplainRequest, type ExplainRequest } from "@/lib/ai";
import type { DecoderView, ElectionsMode } from "@/state/decoderState";

export const SUMMARY_COPY = {
  heading: "Plain-English summary",
  write: "Write plain-English summary",
  writing: "Writing the summary…",
  prompt:
    "A model words the numbers on the stubs in three or four sentences. It does no math of its own.",
  sampleNote:
    "Sample writer: a fixed template words the engine's numbers until an API key is connected.",
  failed: "The summary writer didn't answer. Ask again, or read the stubs and checklist.",
} as const;

/** The explain request for the current view, or null unless both offers have results. */
export function summaryRequest(view: DecoderView, mode: ElectionsMode): ExplainRequest | null {
  const [a, b] = view.stubs;
  if (!view.winners || !a.offer || !a.result || !b.offer || !b.result) return null;
  return buildExplainRequest(
    [
      { offer: a.offer, result: a.result },
      { offer: b.offer, result: b.result },
    ],
    view.winners,
    mode,
  );
}
