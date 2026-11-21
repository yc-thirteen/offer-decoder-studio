/**
 * Decoder app state: one reducer, no React. The engine runs from this state in
 * deriveView(); components read the view and only format it.
 */
import sampleCasesJson from "@/data/sampleCases.json";
import {
  runCase,
  runOffer,
  type CalcResult,
  type Offer,
  type OfferResult,
  type Profile,
  type SampleCase,
} from "@/lib/engine";

// Fixture JSON infers per-case literal unions; cast to the engine's loose types.
export const SAMPLE_CASES: readonly SampleCase[] = (
  sampleCasesJson as unknown as { cases: SampleCase[] }
).cases;

/** Which elections the stubs show: what you get by doing nothing, or what the engine recommends. */
export type ElectionsMode = "default" | "recommended";
/** Amounts per year or per paycheck. */
export type PeriodMode = "annual" | "perPaycheck";
export type OfferSlot = 0 | 1;

export interface DecoderState {
  profile: Profile;
  /** The two stubs. null means the stub is empty. */
  offers: [Offer | null, Offer | null];
  electionsMode: ElectionsMode;
  periodMode: PeriodMode;
  /** The sample last loaded from the picker; null after "Clear offers". Editing an offer keeps it. */
  sampleId: string | null;
}

export type DecoderAction =
  | { type: "loadSample"; sampleId: string }
  | { type: "setProfile"; patch: Partial<Profile> }
  | { type: "setOffer"; slot: OfferSlot; offer: Offer | null }
  | { type: "clearOffers" }
  | { type: "setElectionsMode"; mode: ElectionsMode }
  | { type: "setPeriodMode"; mode: PeriodMode };

/** Profile used when nothing is loaded: the most common new-hire situation. */
export const BLANK_PROFILE: Profile = {
  filingStatus: "single",
  otherHouseholdWages: 0,
  coverage: "self",
  expectedMedicalSpend: 2000,
  hasEmergencyFund: true,
  hasHighInterestDebt: false,
  hasDependents: false,
  age: 25,
  currentSavings: 0,
};

export function findSample(sampleId: string): SampleCase | undefined {
  return SAMPLE_CASES.find((c) => c.id === sampleId);
}

/** State with a sample loaded. Copies, so edits never touch the imported JSON. */
function withSample(state: DecoderState, sample: SampleCase): DecoderState {
  const copy = structuredClone(sample);
  return {
    ...state,
    profile: copy.profile,
    offers: [copy.offers[0] ?? null, copy.offers[1] ?? null],
    sampleId: sample.id,
  };
}

/** First load: the first sample, default elections, annual amounts. */
export function initialDecoderState(
  sampleId: string | null = SAMPLE_CASES[0]?.id ?? null,
): DecoderState {
  const base: DecoderState = {
    profile: { ...BLANK_PROFILE },
    offers: [null, null],
    electionsMode: "default",
    periodMode: "annual",
    sampleId: null,
  };
  const sample = sampleId ? findSample(sampleId) : undefined;
  return sample ? withSample(base, sample) : base;
}

export function decoderReducer(state: DecoderState, action: DecoderAction): DecoderState {
  switch (action.type) {
    case "loadSample": {
      const sample = findSample(action.sampleId);
      return sample ? withSample(state, sample) : state;
    }
    case "setProfile":
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case "setOffer": {
      const offers: DecoderState["offers"] = [...state.offers];
      offers[action.slot] = action.offer;
      return { ...state, offers };
    }
    case "clearOffers":
      return { ...state, offers: [null, null], sampleId: null };
    case "setElectionsMode":
      return { ...state, electionsMode: action.mode };
    case "setPeriodMode":
      return { ...state, periodMode: action.mode };
  }
}

/** One stub's worth of engine output. */
export interface StubView {
  slot: OfferSlot;
  offer: Offer | null;
  /** Full engine output for this offer; null when the stub is empty or the engine rejected it. */
  result: OfferResult | null;
  /** The calculation for the current elections mode. */
  calc: CalcResult | null;
  /** Divide annual amounts by this to display them: 1 annual, payPeriods per paycheck. */
  divisor: number;
  /** The engine's message when it rejected the offer (it states the fix). */
  error: string | null;
}

export interface DecoderView {
  stubs: [StubView, StubView];
  /** Winner offer ids; null unless both stubs have results. */
  winners: { default: string; recommended: string } | null;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Run the engine on the state. Both offers together go through runCase so the winner logic is the engine's. */
export function deriveView(state: DecoderState): DecoderView {
  const { profile, offers, electionsMode, periodMode } = state;
  const results: [OfferResult | null, OfferResult | null] = [null, null];
  const errors: [string | null, string | null] = [null, null];
  let winners: DecoderView["winners"] = null;

  const [a, b] = offers;
  let ranTogether = false;
  if (a && b) {
    try {
      const r = runCase({ id: state.sampleId ?? "custom", profile, offers: [a, b] });
      results[0] = r.offers[0] ?? null;
      results[1] = r.offers[1] ?? null;
      winners = { default: r.winnerBy_default, recommended: r.winnerBy_recommended };
      ranTogether = true;
    } catch {
      // Fall through and run each offer alone so the error lands on the right stub.
    }
  }
  if (!ranTogether) {
    for (const slot of [0, 1] as const) {
      const o = offers[slot];
      if (!o) continue;
      try {
        results[slot] = runOffer(o, profile);
      } catch (e) {
        errors[slot] = message(e);
      }
    }
  }

  const stub = (slot: OfferSlot): StubView => {
    const offer = offers[slot];
    const result = results[slot];
    const periods = offer && offer.payPeriods > 0 ? offer.payPeriods : 1;
    return {
      slot,
      offer,
      result,
      calc: result ? result[electionsMode] : null,
      divisor: periodMode === "perPaycheck" ? periods : 1,
      error: errors[slot],
    };
  };

  return { stubs: [stub(0), stub(1)], winners };
}
