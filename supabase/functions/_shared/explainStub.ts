/**
 * explain-stub: words a 3–4 sentence plain-English summary from engine numbers
 * (the ExplainRequest shape in src/lib/ai/types.ts). The model does no math: every
 * figure it may use is written out for it, and a summary with any other dollar
 * amount or percent is rejected.
 */
import { callModel, FunctionError, serve, type FailureCopy } from "./anthropic.ts";

export const EXPLAIN_COPY: FailureCopy & {
  badJson: string;
  failed: string;
  badRequest: string;
  offStub: string;
} = {
  badJson: "Send the two offers' numbers as JSON.",
  badRequest: "Load two offers to get a plain-English summary.",
  notConnected:
    "The summary writer isn't connected yet. Turn on Lovable AI for this project, or read the stubs and checklist.",
  timeout: "The summary took too long. Ask for it again, or read the stubs and checklist.",
  upstream:
    "The summary writer couldn't reach the model. Ask again, or read the stubs and checklist.",
  refused: "The summary writer declined. Read the stubs and checklist.",
  invalid:
    "The summary writer sent back something unreadable. Ask again, or read the stubs and checklist.",
  offStub:
    "The summary writer used a number that isn't on your stubs, so it wasn't shown. Ask again, or read the stubs and checklist.",
  failed: "The summary writer failed. Ask again, or read the stubs and checklist.",
};

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
const TEXT_KEYS = ["offerId", "employer", "city", "planName"] as const;

type NumberKey = (typeof NUMBER_KEYS)[number];
type TextKey = (typeof TEXT_KEYS)[number];
export type ExplainOffer = Record<NumberKey, number> &
  Record<TextKey, string> & { accountType: "traditional" | "roth"; checklist: string[] };
export interface ExplainRequest {
  mode: "default" | "recommended";
  offers: [ExplainOffer, ExplainOffer];
  winnerId: string;
  winnerByDefault: string;
  winnerByRecommended: string;
}

const MAX_TEXT = 120;
const isRec = (v: unknown): v is Partial<Record<string, unknown>> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function readOffer(v: unknown): ExplainOffer | null {
  if (!isRec(v)) return null;
  for (const k of NUMBER_KEYS) if (typeof v[k] !== "number" || !Number.isFinite(v[k])) return null;
  for (const k of TEXT_KEYS) {
    const s = v[k];
    if (typeof s !== "string" || s.length > MAX_TEXT) return null;
  }
  if (typeof v["offerId"] !== "string" || !v["offerId"]) return null;
  if (v["accountType"] !== "traditional" && v["accountType"] !== "roth") return null;
  const list = v["checklist"];
  if (
    !Array.isArray(list) ||
    !list.every((id) => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id))
  )
    return null;
  return v as ExplainOffer;
}

/** The request, or a 400 FunctionError. Same rules as assertExplainRequest in the app. */
export function readExplainRequest(body: unknown): ExplainRequest {
  const bad = () => new FunctionError(400, EXPLAIN_COPY.badRequest);
  if (!isRec(body)) throw bad();
  const { mode, offers, winnerId, winnerByDefault, winnerByRecommended } = body;
  if (mode !== "default" && mode !== "recommended") throw bad();
  if (!Array.isArray(offers) || offers.length !== 2) throw bad();
  const a = readOffer(offers[0]);
  const b = readOffer(offers[1]);
  if (!a || !b || a.offerId === b.offerId) throw bad();
  const ids = [a.offerId, b.offerId];
  const winners = [winnerId, winnerByDefault, winnerByRecommended];
  if (!winners.every((id) => typeof id === "string" && ids.includes(id))) throw bad();
  if (winnerId !== (mode === "default" ? winnerByDefault : winnerByRecommended)) throw bad();
  return {
    mode,
    offers: [a, b],
    winnerId: winnerId as string,
    winnerByDefault: winnerByDefault as string,
    winnerByRecommended: winnerByRecommended as string,
  };
}

/** Whole dollars with thousands separators, as on the stubs. */
export const money = (n: number) => {
  const r = Math.round(Math.abs(n));
  return `${n < 0 && r > 0 ? "-" : ""}$${r.toLocaleString("en-US")}`;
};
/** 15.39 → "15.4%", 24 → "24%". */
export const percent = (n: number) => `${Number(n.toFixed(1))}%`;

/** "Midway University (staff plan)" → "Midway University", like the memo line. */
const shortName = (o: ExplainOffer, slot: number) =>
  o.employer.replace(/\s*\([^)]*\)\s*$/, "").trim() || `Offer ${slot + 1}`;

/** The gap between the winner's and the other offer's bottom line, as on the memo line. */
export function gap(req: ExplainRequest): number {
  const w = req.offers.find((o) => o.offerId === req.winnerId)!;
  const l = req.offers.find((o) => o.offerId !== req.winnerId)!;
  return Math.round(w.bottomLine - l.bottomLine);
}

/** Every figure the model may use, already formatted, so it has nothing to compute. */
export function factsText(req: ExplainRequest): string {
  let names = req.offers.map(shortName);
  if (names[0] === names[1]) names = names.map((n, i) => `${n} (offer ${i + 1})`);
  const name = (id: string) => names[req.offers.findIndex((o) => o.offerId === id)];
  const lines = req.offers.map((o, i) =>
    [
      `Offer: ${names[i]}, in ${o.city}.`,
      `- Health plan: ${o.planName}.`,
      `- 401(k): ${o.employeePct > 0 ? `${percent(o.employeePct)} of pay to a ${o.accountType === "roth" ? "Roth" : "traditional"} 401(k)` : "nothing to the 401(k)"}. The employer match tops out at ${percent(o.matchCapPct)} of pay contributed.`,
      `- Gross pay: ${money(o.grossPay)} a year.`,
      `- Net pay (take-home): ${money(o.netPay)} a year.`,
      `- Employer 401(k) match: ${money(o.employerMatch)} a year.`,
      `- Expected medical bills on this plan: ${money(o.expectedOutOfPocket)} a year.`,
      `- Bottom line (what the offer is worth to you after taxes and benefits): ${money(o.bottomLine)} a year.`,
      `- Federal tax: ${percent(o.federalAverageRateOnJob)} of pay on average; the last dollar is taxed at ${percent(o.federalMarginalRate * 100)}.`,
      `- Day-one checklist items: ${o.checklist.join(", ") || "none"}.`,
    ].join("\n"),
  );
  const g = gap(req);
  const elections =
    req.mode === "default"
      ? "the default elections (what you get if you elect nothing)"
      : "the recommended elections";
  const winnerLine =
    g === 0
      ? `Under ${elections}, the two offers come out even.`
      : `Under ${elections}, ${name(req.winnerId)} comes out ahead by ${money(g)} a year.`;
  const flip =
    req.winnerByDefault === req.winnerByRecommended
      ? `The same offer wins with the default elections and with the recommended ones.`
      : `With the default elections ${name(req.winnerByDefault)} looks better; with the recommended elections ${name(req.winnerByRecommended)} comes out ahead. Your elections, not the salaries, decide this choice.`;
  return [...lines, "", winnerLine, flip].join("\n");
}

export const EXPLAIN_SYSTEM = `You write the "Plain-English summary" on Offer Decoder, which compares two job offers after taxes and benefits for a new hire.

Write 3 or 4 sentences, as one paragraph of plain text, from the new hire's point of view ("you"). Say which offer comes out ahead and by how much, what drives the difference (take-home pay, the employer match, expected medical bills, taxes), and whether the elections change the winner.

Use only the facts given. Copy every dollar amount and percent exactly as written in the facts. Do not add, subtract, round, estimate, or compute any new number, and do not mention any number that isn't in the facts. Refer to checklist items in words, never by their ids.

Plain, active voice. No exclamation points, no headings, no lists, no markdown, and no marketing words such as "unlock", "supercharge", "seamless", or "empower".`;

/** Dollar amounts and percents the summary may contain. */
function allowed(req: ExplainRequest) {
  const dollars = new Set<number>([Math.abs(gap(req))]);
  const pcts: number[] = [];
  for (const o of req.offers) {
    for (const k of [
      "grossPay",
      "netPay",
      "employerMatch",
      "expectedOutOfPocket",
      "bottomLine",
    ] as const)
      dollars.add(Math.round(Math.abs(o[k])));
    pcts.push(o.employeePct, o.matchCapPct, o.federalMarginalRate * 100, o.federalAverageRateOnJob);
  }
  return { dollars, pcts };
}

/**
 * The summary, or null when it's empty, too long, or uses a dollar amount or
 * percent that isn't one of the request's numbers.
 */
export function checkExplainOutput(out: unknown, req: ExplainRequest): { summary: string } | null {
  if (!isRec(out) || typeof out["summary"] !== "string") return null;
  const summary = out["summary"].replace(/\s+/g, " ").trim();
  if (!summary || summary.length > 1200) return null;

  const { dollars, pcts } = allowed(req);
  for (const m of summary.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)) {
    const n = Math.round(Number(m[1]!.replace(/,/g, "")));
    if (![n - 1, n, n + 1].some((d) => dollars.has(d))) return null;
  }
  // Bare thousands like "58,000" count as dollar amounts too.
  for (const m of summary.matchAll(/(?<![$\d,.])(\d{1,3}(?:,\d{3})+)(?![\d,]*%)/g)) {
    if (!dollars.has(Number(m[1]!.replace(/,/g, "")))) return null;
  }
  for (const m of summary.matchAll(/(\d+(?:\.\d+)?)\s?(?:%|percent)/g)) {
    const n = Number(m[1]);
    if (!pcts.some((p) => Math.abs(p - n) < 0.051 || Math.round(p) === n)) return null;
  }
  return { summary };
}

export interface ExplainDeps {
  apiKey: string | undefined;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** The whole explain-stub request handler. */
export function handleExplainStub(req: Request, deps: ExplainDeps): Promise<Response> {
  return serve(req, EXPLAIN_COPY, async (body) => {
    const request = readExplainRequest(body);
    const out = await callModel({
      apiKey: deps.apiKey,
      system: EXPLAIN_SYSTEM,
      user: `Write the summary from these facts.\n\n<facts>\n${factsText(request)}\n</facts>\n\nAnswer as JSON: {"summary": "..."}.`,
      schema: {
        type: "object",
        properties: { summary: { type: "string" } },
        required: ["summary"],
        additionalProperties: false,
      },
      copy: EXPLAIN_COPY,
      ...(deps.fetch ? { fetch: deps.fetch } : {}),
      ...(deps.timeoutMs ? { timeoutMs: deps.timeoutMs } : {}),
    });
    const result = checkExplainOutput(out, request);
    if (!result) throw new FunctionError(502, EXPLAIN_COPY.offStub);
    return result;
  });
}
