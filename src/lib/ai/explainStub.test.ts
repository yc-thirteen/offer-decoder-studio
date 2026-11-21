import { describe, expect, it } from "vitest";
import sampleCases from "@/data/sampleCases.json";
import { runCase, type Offer, type Profile } from "@/lib/engine";
import {
  AIError,
  INVALID_EXPLAIN_REQUEST,
  MockAIClient,
  buildExplainRequest,
  type ExplainMode,
  type ExplainRequest,
} from "./index";

type CaseJson = { id: string; profile: Profile; offers: Offer[] };
const cases = (sampleCases as unknown as { cases: CaseJson[] }).cases;
const MODES: ExplainMode[] = ["default", "recommended"];
const client = new MockAIClient();

function requestFor(caseId: string, mode: ExplainMode): ExplainRequest {
  const c = cases.find((x) => x.id === caseId)!;
  const r = runCase(c);
  return buildExplainRequest(
    c.offers.map((offer, i) => ({ offer, result: at(r.offers, i) })),
    { default: r.winnerBy_default, recommended: r.winnerBy_recommended },
    mode,
  );
}

/** Index into a fixture array; fails the test instead of returning undefined. */
function at<T>(xs: readonly T[], i: number): T {
  const x = xs[i];
  if (x === undefined) throw new Error(`no item ${i}`);
  return x;
}

const sentences = (s: string) => s.split(/(?<=\.)\s+/).filter(Boolean);

describe("buildExplainRequest", () => {
  it("copies the engine's numbers for the chosen elections", () => {
    const c = cases.find((x) => x.id === "chicago-vs-austin")!;
    const r = runCase(c);
    for (const mode of MODES) {
      const req = requestFor(c.id, mode);
      expect(req.mode).toBe(mode);
      expect(req.winnerByDefault).toBe("lakeshore");
      expect(req.winnerByRecommended).toBe("northfield");
      expect(req.winnerId).toBe(mode === "default" ? "lakeshore" : "northfield");
      req.offers.forEach((o, i) => {
        const calc = at(r.offers, i)[mode];
        const offer = at(c.offers, i);
        expect(o.offerId).toBe(offer.id);
        expect(o.employer).toBe(offer.employer);
        expect(o.planName).toBe(offer.healthPlans.find((p) => p.id === calc.planId)!.name);
        expect(o.bottomLine).toBe(calc.bottomLine);
        expect(o.netPay).toBe(calc.netPay);
        expect(o.employerMatch).toBe(calc.employerMatch);
        expect(o.federalAverageRateOnJob).toBe(calc.federalAverageRateOnJob);
        expect(o.matchCapPct).toBe(at(r.offers, i).matchCapPct);
        expect(o.checklist).toEqual(at(r.offers, i).checklist);
      });
    }
  });
});

describe("MockAIClient.explainStub", () => {
  it("words chicago-vs-austin with the defaults, including the flip", async () => {
    const { summary } = await client.explainStub(requestFor("chicago-vs-austin", "default"));
    const s = sentences(summary);
    expect(s[0]).toBe(
      "With the defaults, Lakeshore Systems leaves you $109,790 a year after taxes, benefits, and expected medical bills, $3,205 more than Northfield Health.",
    );
    expect(s[3]).toBe(
      "Elect correctly and Northfield Health comes out ahead instead, so follow the checklist before you choose.",
    );
  });

  it("words chicago-vs-austin with the recommended elections", async () => {
    const req = requestFor("chicago-vs-austin", "recommended");
    const { summary } = await client.explainStub(req);
    const s = sentences(summary);
    expect(s[0]).toMatch(
      /^With the recommended elections, Northfield Health leaves you \$[\d,]+ a year/,
    );
    expect(s[0]).toContain("$1,894 more than Lakeshore Systems");
    expect(s[3]).toBe(
      "With the defaults, Lakeshore Systems looked better, so your elections, not the salaries, decide this choice.",
    );
  });

  it.each(cases.flatMap((c) => MODES.map((m) => [c.id, m] as const)))(
    "%s (%s): 3–4 sentences using only the request's numbers",
    async (caseId, mode) => {
      const req = requestFor(caseId, mode);
      const { summary } = await client.explainStub(req);
      const s = sentences(summary);
      expect(s.length).toBeGreaterThanOrEqual(3);
      expect(s.length).toBeLessThanOrEqual(4);
      expect(summary).not.toMatch(/undefined|NaN|Infinity|null/);

      const a = at(req.offers, 0);
      const b = at(req.offers, 1);
      const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
      const allowed = new Set<string>([money(a.bottomLine - b.bottomLine)]);
      for (const o of req.offers) {
        for (const n of [o.netPay, o.employerMatch, o.expectedOutOfPocket, o.bottomLine]) {
          allowed.add(money(n));
        }
        allowed.add(`${o.employeePct}%`);
        allowed.add(`${Math.round(o.federalMarginalRate * 100)}%`);
        allowed.add(`${o.federalAverageRateOnJob.toFixed(1)}%`);
      }
      const planWords = req.offers.map((o) => o.planName).join(" ");
      for (const m of summary.match(/\$[\d,]+/g) ?? []) expect(allowed).toContain(m);
      for (const m of summary.match(/\d+(\.\d+)?%/g) ?? []) {
        if (!planWords.includes(m)) expect(allowed).toContain(m);
      }
      // The winner it names is the engine's winner.
      const winner = req.offers.find((o) => o.offerId === req.winnerId)!;
      expect(s[0]).toContain(winner.employer.replace(/\s*\([^)]*\)\s*$/, ""));
    },
  );

  it("drops the parenthetical from employer names", async () => {
    const { summary } = await client.explainStub(requestFor("university-staff", "recommended"));
    expect(summary).toContain("Midway University");
    expect(summary).not.toContain("(staff plan)");
  });

  it("says the offers come out even and never calls it a flip", async () => {
    const req = requestFor("chicago-vs-austin", "default");
    req.offers[1] = { ...at(req.offers, 1), bottomLine: at(req.offers, 0).bottomLine + 0.4 };
    const { summary } = await client.explainStub(req);
    expect(summary).toMatch(
      /^With the defaults, the two offers come out even at about \$[\d,]+ a year/,
    );
    expect(summary).not.toContain("comes out ahead instead");
  });

  it("rephrases a zero match, zero medical bills, and a 0% contribution", async () => {
    const req = requestFor("new-grad-roth", "default");
    const w = req.offers.findIndex((o) => o.offerId === req.winnerId);
    req.offers[w] = {
      ...at(req.offers, w),
      employerMatch: 0,
      expectedOutOfPocket: 0,
      employeePct: 0,
    };
    req.winnerByRecommended = req.winnerByDefault;
    const { summary } = await client.explainStub(req);
    expect(summary).toContain("and the employer adds nothing to your 401(k).");
    expect(summary).not.toContain("medical bills on the");
    expect(summary).toContain("These are the defaults: nothing to the 401(k) and the");
    expect(summary).not.toContain("$0");
  });

  it("rejects bad requests with a directive AIError instead of inventing a summary", async () => {
    const good = requestFor("chicago-vs-austin", "default");
    const bad: ExplainRequest[] = [
      { ...good, offers: [at(good.offers, 0)] },
      { ...good, winnerId: "nobody" },
      { ...good, winnerId: good.winnerByRecommended },
      { ...good, offers: [at(good.offers, 0), { ...at(good.offers, 1), netPay: Number.NaN }] },
      { ...good, offers: [at(good.offers, 0), at(good.offers, 0)] },
    ];
    for (const req of bad) {
      await expect(client.explainStub(req)).rejects.toBeInstanceOf(AIError);
      await expect(client.explainStub(req)).rejects.toThrow(INVALID_EXPLAIN_REQUEST);
    }
  });

  it("rejects when the signal is already aborted", async () => {
    const ctl = new AbortController();
    ctl.abort();
    await expect(
      client.explainStub(requestFor("chicago-vs-austin", "default"), ctl.signal),
    ).rejects.toThrow(/Ask for it again/);
  });
});
