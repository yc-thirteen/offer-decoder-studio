/**
 * Words and the engine-numbers request for the plain-English summary (PlainSummary.tsx).
 */
import { buildExplainRequest, type ExplainRequest } from "@/lib/ai";
import type { DecoderView, ElectionsMode } from "@/state/decoderState";
import { formatMoney } from "@/components/stub";

export const SUMMARY_COPY = {
  heading: "Plain-English summary",
  write: "Write plain-English summary",
  writing: "Writing the summary…",
  prompt:
    "A model words the numbers on the stubs in three or four sentences. It does no math of its own.",
  sampleNote:
    "Sample writer: a fixed template words the engine's numbers until the AI is connected.",
  failed: "The summary writer didn't answer. Ask again, or read the stubs and checklist.",
} as const;

/** A single offer needs no comparison or model call. Only format engine results. */
export function singleOfferSummary(view: DecoderView, mode: ElectionsMode): string | null {
  if (view.stubs.some((s) => s.error)) return null;
  const ready = view.stubs.filter((s) => s.offer && s.result);
  if (ready.length !== 1) return null;
  const stub = ready[0]!;
  const calc = stub.result![mode];
  return (
    `At ${stub.offer!.employer}, estimated annual take-home pay is ${formatMoney(calc.netPay)}. ` +
    `Your retirement and HSA savings, including employer contributions and the assumed future tax adjustment, are ${formatMoney(calc.savingsAfterFutureTax)}. ` +
    `After ${formatMoney(calc.expectedOutOfPocket)} in expected medical bills, the estimated yearly bottom line is ${formatMoney(calc.bottomLine)}. ` +
    "That total includes savings and assumes the full employer match is retained; it is not cash available to spend."
  );
}

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
