/**
 * Words and the engine-numbers request for the plain-English summary (PlainSummary.tsx).
 */
import { buildExplainRequest, type ExplainRequest } from "@/lib/ai";
import type { DecoderView, PlanMode } from "@/state/decoderState";
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
export function singleOfferSummary(view: DecoderView, mode: PlanMode): string | null {
  if (view.stubs.some((s) => s.error)) return null;
  const ready = view.stubs.filter((s) => s.offer && s.result);
  if (ready.length !== 1) return null;
  const stub = ready[0]!;
  const calc = mode === "custom" ? stub.calc : stub.result![mode];
  if (!calc) return null;
  return (
    `At ${stub.offer!.employer}, estimated annual take-home pay is ${formatMoney(calc.netPay)}. ` +
    `Your retirement and HSA savings, including employer contributions and the assumed future tax adjustment, are ${formatMoney(calc.savingsAfterFutureTax)}. ` +
    `After ${formatMoney(calc.expectedOutOfPocket)} in expected medical bills, the estimated yearly bottom line is ${formatMoney(calc.bottomLine)}. ` +
    "That total includes savings and assumes the full employer match is retained; it is not cash available to spend."
  );
}

/** The explain request for the current view, or null unless both offers have results. */
export function summaryRequest(view: DecoderView, mode: PlanMode): ExplainRequest | null {
  const [a, b] = view.stubs;
  if (mode === "custom" || !view.winners || !a.offer || !a.result || !b.offer || !b.result)
    return null;
  return buildExplainRequest(
    [
      { offer: a.offer, result: a.result },
      { offer: b.offer, result: b.result },
    ],
    view.winners,
    mode,
  );
}

/** My plan is formatted locally; its mode never goes through the legacy AI contract. */
export function customComparisonSummary(view: DecoderView): string | null {
  const [a, b] = view.stubs;
  if (!a.offer || !b.offer || !a.calc || !b.calc || a.error || b.error) return null;
  const sentences = [a, b].map(
    (s, i) =>
      `At ${s.offer!.employer} (offer ${i + 1}), your selected settings give estimated annual take-home pay of ${formatMoney(s.calc!.netPay)} and a yearly bottom line of ${formatMoney(s.calc!.bottomLine)}.`,
  );
  return (
    sentences.join(" ") +
    " The bottom lines include retirement and HSA savings, assume the full employer match is retained, and subtract expected medical bills. They are not cash available to spend."
  );
}
