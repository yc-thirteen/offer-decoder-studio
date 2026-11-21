/**
 * "Explain my stub" without a model (DESIGN.md "AI elements"). buildExplainRequest copies
 * engine numbers into an ExplainRequest; explainTemplate words them in 3–4 sentences.
 * The template only formats the request's numbers (plus the gap between the two bottom
 * lines, the same subtraction the memo line makes), so the mock never does the engine's math.
 */
import type { Offer, OfferResult } from "@/lib/engine";
import { AIError, type ExplainMode, type ExplainOffer, type ExplainRequest } from "./types";

export interface ExplainInput {
  offer: Offer;
  result: OfferResult;
}

/** Engine numbers for both offers under `mode`, in stub order. */
export function buildExplainRequest(
  inputs: readonly ExplainInput[],
  winners: { default: string; recommended: string },
  mode: ExplainMode,
): ExplainRequest {
  const offers: ExplainOffer[] = inputs.map(({ offer, result }) => {
    const calc = result[mode];
    const plan = offer.healthPlans.find((p) => p.id === calc.planId);
    return {
      offerId: result.offerId,
      employer: offer.employer,
      city: offer.city,
      planName: plan?.name ?? calc.planId,
      employeePct: calc.employeePct,
      accountType: calc.accountType,
      grossPay: calc.grossPay,
      netPay: calc.netPay,
      employerMatch: calc.employerMatch,
      expectedOutOfPocket: calc.expectedOutOfPocket,
      bottomLine: calc.bottomLine,
      federalMarginalRate: calc.federalMarginalRate,
      federalAverageRateOnJob: calc.federalAverageRateOnJob,
      matchCapPct: result.matchCapPct,
      checklist: [...result.checklist],
    };
  });
  return {
    mode,
    offers,
    winnerId: winners[mode],
    winnerByDefault: winners.default,
    winnerByRecommended: winners.recommended,
  };
}

const NUMBER_KEYS = [
  "employeePct",
  "grossPay",
  "netPay",
  "employerMatch",
  "expectedOutOfPocket",
  "bottomLine",
  "federalMarginalRate",
  "federalAverageRateOnJob",
  "matchCapPct",
] as const;

export const INVALID_EXPLAIN_REQUEST = "Load two offers to get a plain-English summary.";

/** Throws a directive AIError unless the request has two offers and known winners. */
export function assertExplainRequest(req: ExplainRequest): void {
  const ok =
    !!req &&
    (req.mode === "default" || req.mode === "recommended") &&
    Array.isArray(req.offers) &&
    req.offers.length === 2 &&
    req.offers[0]?.offerId !== req.offers[1]?.offerId &&
    req.offers.every(
      (o) =>
        typeof o.offerId === "string" &&
        NUMBER_KEYS.every((k) => typeof o[k] === "number" && Number.isFinite(o[k])),
    ) &&
    [req.winnerId, req.winnerByDefault, req.winnerByRecommended].every((id) =>
      req.offers.some((o) => o.offerId === id),
    ) &&
    req.winnerId === (req.mode === "default" ? req.winnerByDefault : req.winnerByRecommended);
  if (!ok) throw new AIError(INVALID_EXPLAIN_REQUEST);
}

/** Whole dollars with thousands separators, as on the stubs. */
export function explainMoney(n: number): string {
  const r = Math.round(Math.abs(n));
  return `${n < 0 && r > 0 ? "−" : ""}$${r.toLocaleString("en-US")}`;
}

/** "Midway University (staff plan)" → "Midway University", like the memo line. */
function shortName(employer: string, slot: number): string {
  const name = (employer ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  return name || `Offer ${slot + 1}`;
}

function retirementText(o: ExplainOffer): string {
  if (o.employeePct <= 0) return "nothing to the 401(k)";
  const type = o.accountType === "roth" ? "Roth" : "traditional";
  return `${o.employeePct}% of pay to a ${type} 401(k)`;
}

/** The 3–4 sentence plain-English summary for a valid request. */
export function explainTemplate(req: ExplainRequest): string {
  assertExplainRequest(req);
  let names = req.offers.map((o, i) => shortName(o.employer, i));
  if (names[0] === names[1]) names = names.map((n, i) => `${n} (offer ${i + 1})`);
  const nameOf = (id: string) => names[req.offers.findIndex((o) => o.offerId === id)];

  const w = req.offers.find((o) => o.offerId === req.winnerId)!;
  const l = req.offers.find((o) => o.offerId !== req.winnerId)!;
  const W = nameOf(w.offerId);
  const L = nameOf(l.offerId);
  const lead = req.mode === "default" ? "With the defaults" : "With the recommended elections";
  const gap = Math.round(w.bottomLine - l.bottomLine);
  const sentences: string[] = [];

  sentences.push(
    gap === 0
      ? `${lead}, the two offers come out even at about ${explainMoney(w.bottomLine)} a year after taxes, benefits, and expected medical bills.`
      : `${lead}, ${W} leaves you ${explainMoney(w.bottomLine)} a year after taxes, benefits, and expected medical bills, ${explainMoney(gap)} more than ${L}.`,
  );

  const parts = [`you take home ${explainMoney(w.netPay)} in net pay`];
  parts.push(
    w.employerMatch > 0
      ? `the employer adds ${explainMoney(w.employerMatch)} to your 401(k)`
      : "the employer adds nothing to your 401(k)",
  );
  if (Math.round(w.expectedOutOfPocket) > 0) {
    parts.push(
      `you can expect ${explainMoney(w.expectedOutOfPocket)} of medical bills on the ${w.planName}`,
    );
  }
  const last = parts.pop()!;
  sentences.push(`At ${W}, ${parts.join(", ")}${parts.length > 1 ? "," : ""} and ${last}.`);

  const avg = w.federalAverageRateOnJob.toFixed(1);
  const bracket = Math.round(w.federalMarginalRate * 100);
  sentences.push(
    Number(avg) === 0
      ? "The salary there owes no federal income tax once the standard deduction comes off."
      : `Federal tax takes ${avg}% of the salary there on average; only its top dollars are taxed at the ${bracket}% bracket rate.`,
  );

  const flips = req.winnerByDefault !== req.winnerByRecommended && gap !== 0;
  if (req.mode === "default") {
    sentences.push(
      flips
        ? `Elect correctly and ${nameOf(req.winnerByRecommended)} comes out ahead instead, so follow the checklist before you choose.`
        : `These are the defaults: ${retirementText(w)} and the ${w.planName}, and the checklist shows what to change on day one.`,
    );
  } else {
    sentences.push(
      flips
        ? `With the defaults, ${nameOf(req.winnerByDefault)} looked better, so your elections, not the salaries, decide this choice.`
        : `That assumes ${retirementText(w)} and the ${w.planName} at ${W}, as the checklist lists.`,
    );
  }
  return sentences.join(" ");
}
