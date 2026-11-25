/**
 * AI feature contracts (DESIGN.md "AI elements"). The model never does the math:
 * the reader only copies what a letter states, and the explainer only words numbers
 * the engine produced. Both the mock client and the HTTP client (Lovable Cloud edge
 * functions) implement AIClient, and the edge functions validate against these shapes.
 */
import type {
  AccountType,
  ChecklistId,
  HealthPlan,
  MatchTier,
  StateCode,
  Vesting,
} from "@/lib/engine";

/* ---------- Upload documents ---------- */

export interface ExtractRequest {
  /** Plain letter text or a versioned offer/benefits envelope in a string. Never logged. */
  text: string;
}

/** Where a field's value came from. "missing" means the letter does not state it. */
export type FieldSource = "letter" | "missing";

/**
 * One extracted field. A missing field has no value and says what is missing in
 * directive words ("No salary in these documents. Type it here."), never a guess.
 */
export type ExtractedField<T> =
  { source: "letter"; value: T } | { source: "missing"; value: null; note: string };

/** The Offer fields a letter can state, each with its own source. */
export interface ExtractedOfferValues {
  employer: string;
  city: string;
  state: StateCode;
  /** Flat state rate (0–1), only meaningful when state is OTHER. */
  customStateRate: number;
  salary: number;
  payPeriods: number;
  match: MatchTier[];
  defaultEmployeePct: number;
  vesting: Vesting;
  rothAvailable: boolean;
  healthPlans: HealthPlan[];
  defaultPlanId: string;
  lifeBasicMultiple: number;
  lifeSupplementalMaxMultiple: number;
}

export type ExtractFieldKey = keyof ExtractedOfferValues;

export const EXTRACT_FIELD_KEYS: readonly ExtractFieldKey[] = [
  "employer",
  "city",
  "state",
  "customStateRate",
  "salary",
  "payPeriods",
  "match",
  "defaultEmployeePct",
  "vesting",
  "rothAvailable",
  "healthPlans",
  "defaultPlanId",
  "lifeBasicMultiple",
  "lifeSupplementalMaxMultiple",
];

export type ExtractedFields = {
  [K in ExtractFieldKey]: ExtractedField<ExtractedOfferValues[K]>;
};

export interface ExtractResult {
  fields: ExtractedFields;
}

/* ---------- Explain my stub ---------- */

export type ExplainMode = "default" | "recommended";

/** Engine numbers for one offer under the chosen elections. Dollars are annual. */
export interface ExplainOffer {
  offerId: string;
  employer: string;
  city: string;
  planName: string;
  employeePct: number;
  accountType: AccountType;
  grossPay: number;
  netPay: number;
  employerMatch: number;
  expectedOutOfPocket: number;
  bottomLine: number;
  /** 0–1. */
  federalMarginalRate: number;
  /** Percent, e.g. 15.39. */
  federalAverageRateOnJob: number;
  matchCapPct: number;
  checklist: ChecklistId[];
}

export interface ExplainRequest {
  mode: ExplainMode;
  offers: ExplainOffer[];
  /** Offer id that wins on bottom line under `mode`. */
  winnerId: string;
  winnerByDefault: string;
  winnerByRecommended: string;
}

export interface ExplainResult {
  /** 3–4 plain-English sentences, built only from the request's numbers. */
  summary: string;
}

/* ---------- Client ---------- */

export type AIClientKind = "mock" | "http";

export interface AIClient {
  readonly kind: AIClientKind;
  extractOffer(req: ExtractRequest, signal?: AbortSignal): Promise<ExtractResult>;
  explainStub(req: ExplainRequest, signal?: AbortSignal): Promise<ExplainResult>;
}

/** A failure the UI can show as is: it states the problem and the fix. */
export class AIError extends Error {
  override readonly name = "AIError";
}
