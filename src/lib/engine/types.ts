/**
 * Engine types. Field names mirror harness/fixtures/cases.json (inputs) and
 * harness/fixtures/expected.json (outputs) exactly, so fixtures load without mapping.
 * Rules: harness/FINANCE_SPEC.md. Oracle: harness/reference/engine.py.
 * All dollar amounts are annual unless the name says otherwise.
 */

/** Single or married filing jointly. Head of household is out of scope for v1. */
export type FilingStatus = "single" | "mfj";

/** Health coverage tier; also selects the HSA limit. */
export type CoverageTier = "self" | "family";

export type AccountType = "traditional" | "roth";

/**
 * Two-letter code for one of the 50 states or DC (each has 2026 rules in stateTax.ts), or
 * OTHER, which uses Offer.customStateRate as a flat rate on wages.
 */
export type StateCode =
  | "AK"
  | "AL"
  | "AR"
  | "AZ"
  | "CA"
  | "CO"
  | "CT"
  | "DC"
  | "DE"
  | "FL"
  | "GA"
  | "HI"
  | "IA"
  | "ID"
  | "IL"
  | "IN"
  | "KS"
  | "KY"
  | "LA"
  | "MA"
  | "MD"
  | "ME"
  | "MI"
  | "MN"
  | "MO"
  | "MS"
  | "MT"
  | "NC"
  | "ND"
  | "NE"
  | "NH"
  | "NJ"
  | "NM"
  | "NV"
  | "NY"
  | "OH"
  | "OK"
  | "OR"
  | "PA"
  | "RI"
  | "SC"
  | "SD"
  | "TN"
  | "TX"
  | "UT"
  | "VA"
  | "VT"
  | "WA"
  | "WI"
  | "WV"
  | "WY"
  | "OTHER";

export interface Profile {
  filingStatus: FilingStatus;
  /** Spouse's wages, already net of their own pre-tax deductions. Used only when filing jointly. */
  otherHouseholdWages: number;
  coverage: CoverageTier;
  /** Expected total medical spending for the year (before insurance). */
  expectedMedicalSpend: number;
  /** Has a 3–6 month emergency fund. */
  hasEmergencyFund: boolean;
  hasHighInterestDebt: boolean;
  /** Anyone depends on your income. */
  hasDependents: boolean;
  age: number;
  currentSavings: number;
}

export interface HealthPlan {
  id: string;
  name: string;
  hsaEligible: boolean;
  /** Employee premium per year for the profile's coverage tier. */
  premium: number;
  deductible: number;
  /** Employee's share after the deductible, 0–1. */
  coinsurance: number;
  oopMax: number;
  /** Employer HSA deposit per year; counts only when hsaEligible. */
  employerHsa: number;
}

/**
 * One cumulative band of pay. [{rate:1, upToPct:3}, {rate:0.5, upToPct:5}] means
 * 100% on the first 3% of pay and 50% on the next 2%.
 */
export interface MatchTier {
  /** Employer dollars per employee dollar in this band (1 = 100%). */
  rate: number;
  /** Upper edge of the band, in percent of salary. */
  upToPct: number;
}

export interface GradedStep {
  /** Years of service. */
  year: number;
  /** Vested percent from that year on, 0–100. */
  pct: number;
}

export type Vesting =
  | { type: "immediate" }
  | { type: "cliff"; years: number }
  | { type: "graded"; schedule: GradedStep[] };

export interface Retirement {
  match: MatchTier[];
  /** Percent of salary you contribute if you elect nothing. */
  defaultEmployeePct: number;
  vesting: Vesting;
  rothAvailable: boolean;
}

export interface LifeBenefit {
  /** Free basic coverage, as a multiple of salary. */
  basicMultiple: number;
  /** Maximum supplemental coverage you can buy through work, as a multiple of salary. */
  supplementalMaxMultiple: number;
}

export interface Offer {
  id: string;
  employer: string;
  city: string;
  state: StateCode;
  /** Flat state rate (0–1), used only when state is OTHER. */
  customStateRate?: number;
  salary: number;
  payPeriods: number;
  retirement: Retirement;
  healthPlans: HealthPlan[];
  /** The plan you get if you elect nothing. */
  defaultPlanId: string;
  life: LifeBenefit;
}

export interface Elections {
  planId: string;
  /** Employee 401(k) contribution, percent of salary. Dollars are capped at LIMIT_401K. */
  employeePct: number;
  accountType: AccountType;
  /** Employee HSA payroll contribution per year; ignored unless the plan is HSA-eligible. */
  employeeHsa: number;
}

/** Output of the full pay calculation for one offer under one set of elections. */
export interface CalcResult {
  planId: string;
  employeePct: number;
  accountType: AccountType;
  grossPay: number;
  employee401k: number;
  hitsLimit401k: boolean;
  traditional401k: number;
  roth401k: number;
  healthPremium: number;
  employeeHsa: number;
  federalIncomeTax: number;
  socialSecurity: number;
  medicare: number;
  stateIncomeTax: number;
  netPay: number;
  netPayPerPaycheck: number;
  employerMatch: number;
  employerHsa: number;
  savingsInYourName: number;
  savingsAfterFutureTax: number;
  expectedOutOfPocket: number;
  /** net pay + savings after future tax − expected out-of-pocket. UI: "Your yearly bottom line". */
  bottomLine: number;
  /** Federal marginal bracket rate, 0–1. */
  federalMarginalRate: number;
  /** Federal tax attributed to this job ÷ salary, in percent (e.g. 15.39). */
  federalAverageRateOnJob: number;
}

/** Life insurance sizing (7A slides 27–28). Null when nobody depends on your income. */
export interface LifeResult {
  humanCapital: number;
  householdWealth: number;
  lossShare: number;
  fractionEmployer: number;
  fractionIndividual: number;
  recommendedCoverageEmployer: number;
  recommendedCoverageIndividual: number;
  basicCoverage: number;
  recommendedSupplemental: number;
  recommendedIndividualPolicy: number;
  totalRecommendedCoverage: number;
}

/** Stable checklist ids; the UI writes the words. */
export type ChecklistId =
  | "raise-401k"
  | "unclaimed-match"
  | "pay-high-interest-debt"
  | "build-emergency-fund"
  | "switch-health-plan"
  | "default-plan-dominated"
  | "open-hsa"
  | "choose-roth"
  | "choose-traditional"
  | "life-insurance"
  | "skip-extra-life-insurance"
  | "check-w4"
  | "note-vesting-date";

/** [total medical spending, plan cost] at one breakpoint. */
export type CostPoint = [spend: number, cost: number];

export interface OfferResult {
  offerId: string;
  dominatedPlanIds: string[];
  recommendedElections: Elections;
  default: CalcResult;
  recommended: CalcResult;
  matchCapPct: number;
  maxMatchPctOfSalary: number;
  /** Vested percent at years 0 through 6. */
  vestedPctByYear: number[];
  /** Plan id → cost at every breakpoint of the offer's plans. */
  planCostCurves: Record<string, CostPoint[]>;
  lifeInsurance: LifeResult | null;
  checklist: ChecklistId[];
}

export interface CaseResult {
  id: string;
  offers: OfferResult[];
  winnerBy_default: string;
  winnerBy_recommended: string;
}

/** A sample scenario as stored in cases.json. */
export interface SampleCase {
  id: string;
  title: string;
  teaches: string[];
  profile: Profile;
  offers: Offer[];
}
