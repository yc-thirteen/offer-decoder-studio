import { describe, expect, it } from "vitest";
import expectedJson from "../../harness/fixtures/expected.json";
import {
  SAMPLE_CASES,
  decoderReducer,
  deriveView,
  initialDecoderState,
  type DecoderState,
} from "./decoderState";

const expected = expectedJson as unknown as {
  cases: {
    id: string;
    winnerBy_default: string;
    winnerBy_recommended: string;
    offers: { offerId: string; default: { netPay: number }; recommended: { netPay: number } }[];
  }[];
};

describe("decoder state", () => {
  it("starts on the first sample with default elections and annual amounts", () => {
    const s = initialDecoderState();
    expect(s.sampleId).toBe("chicago-vs-austin");
    expect(s.offers.map((o) => o?.id)).toEqual(["northfield", "lakeshore"]);
    expect(s.electionsMode).toBe("default");
    expect(s.periodMode).toBe("annual");
  });

  it("can start empty", () => {
    const s = initialDecoderState(null);
    expect(s.offers).toEqual([null, null]);
    expect(s.sampleId).toBeNull();
    const v = deriveView(s);
    expect(v.winners).toBeNull();
    expect(v.stubs.map((x) => x.calc)).toEqual([null, null]);
  });

  it("loads every sample, and the view matches expected.json", () => {
    let s: DecoderState = initialDecoderState(null);
    expect(SAMPLE_CASES).toHaveLength(6);
    for (const c of SAMPLE_CASES) {
      s = decoderReducer(s, { type: "loadSample", sampleId: c.id });
      const want = expected.cases.find((e) => e.id === c.id)!;
      expect(s.sampleId).toBe(c.id);
      expect(s.profile).toEqual(c.profile);
      for (const mode of ["default", "recommended"] as const) {
        const v = deriveView({ ...s, electionsMode: mode });
        expect(v.winners).toEqual({
          default: want.winnerBy_default,
          recommended: want.winnerBy_recommended,
        });
        v.stubs.forEach((stub, i) => {
          const w = want.offers[i]!;
          expect(stub.result?.offerId).toBe(w.offerId);
          expect(stub.calc?.netPay).toBeCloseTo(w[mode].netPay, 0);
          expect(stub.error).toBeNull();
        });
      }
    }
  });

  it("ignores an unknown sample id", () => {
    const s = initialDecoderState();
    expect(decoderReducer(s, { type: "loadSample", sampleId: "nope" })).toBe(s);
  });

  it("never mutates the imported sample data", () => {
    let s = initialDecoderState();
    const salary = SAMPLE_CASES[0]!.offers[0]!.salary;
    s = decoderReducer(s, { type: "setOffer", slot: 0, offer: { ...s.offers[0]!, salary: 1 } });
    s.offers[1]!.salary = 2;
    expect(SAMPLE_CASES[0]!.offers[0]!.salary).toBe(salary);
    expect(initialDecoderState().offers[1]!.salary).not.toBe(2);
  });

  it("recomputes from profile edits", () => {
    const s = initialDecoderState();
    const before = deriveView(s).stubs[0].calc!.expectedOutOfPocket;
    const s2 = decoderReducer(s, { type: "setProfile", patch: { expectedMedicalSpend: 20000 } });
    expect(s2.profile.filingStatus).toBe(s.profile.filingStatus);
    expect(deriveView(s2).stubs[0].calc!.expectedOutOfPocket).toBeGreaterThan(before);
  });

  it("switches elections and period modes", () => {
    let s = initialDecoderState();
    s = decoderReducer(s, { type: "setElectionsMode", mode: "recommended" });
    s = decoderReducer(s, { type: "setPeriodMode", mode: "perPaycheck" });
    const v = deriveView(s);
    expect(v.stubs[0].calc).toBe(v.stubs[0].result!.recommended);
    expect(v.stubs[0].divisor).toBe(s.offers[0]!.payPeriods);
    expect(deriveView({ ...s, periodMode: "annual" }).stubs[0].divisor).toBe(1);
  });

  it("clears offers and forgets the sample", () => {
    const s = decoderReducer(initialDecoderState(), { type: "clearOffers" });
    expect(s.offers).toEqual([null, null]);
    expect(s.sampleId).toBeNull();
  });

  it("runs a lone offer without a winner", () => {
    const s = decoderReducer(initialDecoderState(), { type: "setOffer", slot: 1, offer: null });
    const v = deriveView(s);
    expect(v.winners).toBeNull();
    expect(v.stubs[0].calc).not.toBeNull();
    expect(v.stubs[1].calc).toBeNull();
  });

  it("puts an engine error on the offer that caused it and still runs the other", () => {
    const s0 = initialDecoderState();
    const bad = { ...s0.offers[1]!, defaultPlanId: "missing" };
    const v = deriveView(decoderReducer(s0, { type: "setOffer", slot: 1, offer: bad }));
    expect(v.winners).toBeNull();
    expect(v.stubs[0].error).toBeNull();
    expect(v.stubs[0].calc).not.toBeNull();
    expect(v.stubs[1].result).toBeNull();
    expect(v.stubs[1].error).toMatch(/health plans/);
  });
});
