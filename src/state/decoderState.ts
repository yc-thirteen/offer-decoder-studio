/**
 * Decoder app state: one reducer, no React. The engine runs from this state in
 * deriveView(); components read the view and only format it.
 */
import sampleCasesJson from "@/data/sampleCases.json";
import {
  calculate,
  calculateMonthlyPlan,
  blankMonthlyBudget,
  editableElections,
  hsaAllowance,
  validateElections,
  runCase,
  runOffer,
  type CalcResult,
  type Elections,
  type CustomElections,
  type ElectionErrors,
  type MonthlyBudget,
  type MonthlyPlanResult,
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
export type PlanMode = ElectionsMode | "custom";

export interface OfferPlanning {
  budget: MonthlyBudget;
  custom: CustomElections | null;
  revision: number;
  notice: string | null;
}

function emptyPlanning(revision = 0): OfferPlanning {
  return { budget: blankMonthlyBudget(), custom: null, revision, notice: null };
}
/** Amounts per year or per paycheck. */
export type PeriodMode = "annual" | "perPaycheck";
export type OfferSlot = 0 | 1;

export interface DecoderState {
  profile: Profile;
  /** The two stubs. null means the stub is empty. */
  offers: [Offer | null, Offer | null];
  electionsMode: PlanMode;
  planning: [OfferPlanning, OfferPlanning];
  periodMode: PeriodMode;
  /** The sample last loaded from the picker; null after "Clear offers". Editing an offer keeps it. */
  sampleId: string | null;
}

export type DecoderAction =
  | { type: "loadSample"; sampleId: string }
  | { type: "setProfile"; patch: Partial<Profile> }
  | { type: "setOffer"; slot: OfferSlot; offer: Offer | null }
  | { type: "clearOffers" }
  | { type: "setElectionsMode"; mode: PlanMode }
  | { type: "setCustomElections"; slot: OfferSlot; patch: Partial<CustomElections> }
  | { type: "resetCustomElections"; slot: OfferSlot }
  | { type: "setMonthlyBudget"; slot: OfferSlot; patch: Partial<MonthlyBudget> }
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
    planning: [
      emptyPlanning(state.planning[0].revision + 1),
      emptyPlanning(state.planning[1].revision + 1),
    ],
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
    planning: [emptyPlanning(), emptyPlanning()],
    periodMode: "annual",
    sampleId: null,
  };
  const sample = sampleId ? findSample(sampleId) : undefined;
  return sample ? withSample(base, sample) : base;
}

/** Start My plan from the last viewed preset; retain edits when switching back. */
function customPlanning(state: DecoderState): DecoderState["planning"] {
  return state.planning.map((p, slot) => {
    const offer = state.offers[slot];
    if (p.custom || !offer) return p;
    try {
      const result = runOffer(offer, state.profile);
      const preset = state.electionsMode === "default" ? result.default : result.recommended;
      return {
        ...p,
        custom: editableElections(offer, {
          planId: preset.planId,
          employeePct: preset.employeePct,
          accountType: preset.accountType,
          employeeHsa: preset.employeeHsa,
        }),
      };
    } catch {
      return p;
    }
  }) as DecoderState["planning"];
}

function updatePlanning(state: DecoderState, slot: OfferSlot, next: OfferPlanning): DecoderState {
  const planning: DecoderState["planning"] = [...state.planning];
  planning[slot] = next;
  return { ...state, planning };
}

export function decoderReducer(state: DecoderState, action: DecoderAction): DecoderState {
  switch (action.type) {
    case "loadSample": {
      const sample = findSample(action.sampleId);
      return sample ? withSample(state, sample) : state;
    }
    case "setProfile": {
      const coverageChanged =
        action.patch.coverage !== undefined && action.patch.coverage !== state.profile.coverage;
      return {
        ...state,
        profile: { ...state.profile, ...action.patch },
        planning: coverageChanged
          ? (state.planning.map((p) => ({
              ...p,
              custom: null,
              revision: p.revision + 1,
              notice:
                "Coverage changed. My plan has been reset to the suggested settings; check this tier's benefits before continuing.",
            })) as DecoderState["planning"])
          : state.planning,
      };
    }
    case "setOffer": {
      const offers: DecoderState["offers"] = [...state.offers];
      const previous = offers[action.slot];
      offers[action.slot] = action.offer;
      const p = state.planning[action.slot];
      const next =
        !action.offer || action.offer.id !== previous?.id
          ? emptyPlanning(p.revision + 1)
          : {
              ...p,
              custom: null,
              revision: p.revision + 1,
              notice:
                "Offer details changed. My plan has been reset to the suggested settings; your monthly expenses were kept.",
            };
      return updatePlanning({ ...state, offers }, action.slot, next);
    }
    case "clearOffers":
      return {
        ...state,
        offers: [null, null],
        sampleId: null,
        planning: [
          emptyPlanning(state.planning[0].revision + 1),
          emptyPlanning(state.planning[1].revision + 1),
        ],
      };
    case "setElectionsMode":
      return {
        ...state,
        electionsMode: action.mode,
        planning: action.mode === "custom" ? customPlanning(state) : state.planning,
      };
    case "setCustomElections": {
      const base = { ...state, planning: customPlanning(state), electionsMode: "custom" as const };
      const p = base.planning[action.slot];
      if (!p.custom) return state;
      const custom = { ...p.custom, ...action.patch };
      const offer = state.offers[action.slot];
      if (offer && action.patch.planId !== undefined) {
        const allowance = hsaAllowance(offer, state.profile, custom.planId);
        custom.employeeHsa = Math.min(custom.employeeHsa ?? 0, allowance);
      }
      return updatePlanning(base, action.slot, { ...p, custom, notice: null });
    }
    case "resetCustomElections": {
      const offer = state.offers[action.slot];
      if (!offer) return state;
      try {
        const p = state.planning[action.slot];
        const custom = editableElections(
          offer,
          runOffer(offer, state.profile).recommendedElections,
        );
        const base = {
          ...state,
          planning: customPlanning(state),
          electionsMode: "custom" as const,
        };
        return updatePlanning(base, action.slot, {
          ...p,
          custom,
          revision: p.revision + 1,
          notice: "My plan now uses the suggested contribution settings.",
        });
      } catch {
        return state;
      }
    }
    case "setMonthlyBudget": {
      const p = state.planning[action.slot];
      return updatePlanning(state, action.slot, { ...p, budget: { ...p.budget, ...action.patch } });
    }
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
  elections: CustomElections | null;
  electionErrors: ElectionErrors;
  monthlyPlan: MonthlyPlanResult | null;
  /** Divide annual amounts by this to display them: 1 annual, payPeriods per paycheck. */
  divisor: number;
  /** The engine's message when it rejected the offer (it states the fix). */
  error: string | null;
}

export interface DecoderView {
  stubs: [StubView, StubView];
  /** Winner offer ids; null unless both stubs have results. */
  winners: { default: string; recommended: string } | null;
  activeWinnerSlot: OfferSlot | null;
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
    const planning = state.planning[slot];
    const elections: CustomElections | null = !result
      ? null
      : electionsMode === "custom"
        ? (planning.custom ??
          (offer ? editableElections(offer, result.recommendedElections) : null))
        : electionsMode === "recommended"
          ? result.recommendedElections
          : {
              planId: result.default.planId,
              employeePct: result.default.employeePct,
              accountType: result.default.accountType,
              employeeHsa: result.default.employeeHsa,
            };
    const electionErrors =
      offer && elections && electionsMode === "custom"
        ? validateElections(offer, profile, elections)
        : {};
    let calc: CalcResult | null = null;
    let error = errors[slot];
    if (Object.keys(electionErrors).length)
      error = "Fix the contribution fields in Your monthly plan to see updated results.";
    else if (result && offer) {
      try {
        calc =
          electionsMode === "custom"
            ? calculate(offer, profile, elections as Elections)
            : result[electionsMode];
      } catch (e) {
        error = message(e);
      }
    }
    return {
      slot,
      offer,
      result,
      calc,
      elections,
      electionErrors,
      monthlyPlan: calc ? calculateMonthlyPlan(calc, planning.budget) : null,
      divisor: periodMode === "perPaycheck" ? periods : 1,
      error,
    };
  };
  const stubs: DecoderView["stubs"] = [stub(0), stub(1)];
  const [first, second] = stubs;
  const activeWinnerSlot =
    first.calc && second.calc ? (second.calc.bottomLine > first.calc.bottomLine ? 1 : 0) : null;
  return { stubs, winners, activeWinnerSlot };
}
