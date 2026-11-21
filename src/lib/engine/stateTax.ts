/**
 * State income tax for tax year 2026, for all 50 states and DC.
 *
 * Source: Tax Foundation, "2026 State Income Tax Rates and Brackets" (Janelle Fritts and
 * Katherine Loughead, February 17, 2026), table as of January 1, 2026, from its data file
 * 2026-State-Individual-Income-Tax-Rates-Brackets.xlsx. Brackets, standard deductions,
 * personal exemptions, and exemption credits are copied from that file. Phase-outs and the
 * other special rules come from its footnotes, cited by letter beside each state. Not from
 * the course lectures, except Illinois (Lecture 4B).
 *
 * What is left out is listed on the Method page (STATE_TAX_LEFT_OUT): local income taxes,
 * dependents, recapture, a few high-income phase-outs, and payroll taxes like California SDI.
 */
import type { FilingStatus, StateCode } from "./types";

export type TaxedState = Exclude<StateCode, "OTHER">;

/** [lower edge of the bracket, marginal rate], starting at 0. */
export type StateBracket = readonly [number, number];

export interface StateSchedule {
  brackets: readonly StateBracket[];
  standardDeduction: number;
  personalExemption: number;
  /** A tax credit rather than a deduction: exemption credits, and Utah's standard deduction. */
  exemptionCredit: number;
}

/** How an amount shrinks as household income rises. */
export type PhaseOut =
  /** Full at `from`, zero at `to`, a straight line between. */
  | { kind: "linear"; from: number; to: number }
  /** Shrinks by `rate` per dollar above `from`. */
  | { kind: "perDollar"; from: number; rate: number }
  /** Shrinks by `by` for each `every` dollars above `from` (a part counts when round is "up"). */
  | {
      kind: "steps";
      from: number;
      every: number;
      by: number;
      floor: number;
      round: "up" | "down";
    }
  /** Gone above `above`. */
  | { kind: "cliff"; above: number }
  /** [up to this income, the amount]; zero above the last tier. */
  | { kind: "tiers"; tiers: readonly (readonly [number, number])[] };

type ByStatus<T> = Readonly<Record<FilingStatus, T>>;

export interface StateTaxRule {
  name: string;
  single: StateSchedule;
  mfj: StateSchedule;
  phaseOuts?: Partial<
    Record<"standardDeduction" | "personalExemption" | "exemptionCredit", ByStatus<PhaseOut>>
  >;
  /** A separate table used when taxable income is at most `upTo` (Arkansas). */
  lowIncome?: { upTo: number; brackets: readonly StateBracket[] };
  /** Above `above` of income, the tax is at least `rate` × income (Vermont). */
  minimumTax?: { above: number; rate: number };
  /** The state taxes traditional 401(k) contributions (Pennsylvania). */
  taxes401k?: boolean;
  /** The state taxes employee HSA contributions (California, New Jersey). */
  taxesHsa?: boolean;
}

export const STATE_TAX: Readonly<Record<TaxedState, StateTaxRule>> = {
  AL: {
    // (c) The standard deduction drops $25 (joint $175) per $500 of income above $25,499
    // (joint $25,999), to no less than $2,500 (joint $5,000).
    name: "Alabama",
    single: {
      brackets: [
        [0, 0.02],
        [500, 0.04],
        [3000, 0.05],
      ],
      standardDeduction: 3000,
      personalExemption: 1500,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.02],
        [1000, 0.04],
        [6000, 0.05],
      ],
      standardDeduction: 8500,
      personalExemption: 3000,
      exemptionCredit: 0,
    },
    phaseOuts: {
      standardDeduction: {
        single: { kind: "steps", from: 25499, every: 500, by: 25, floor: 2500, round: "down" },
        mfj: { kind: "steps", from: 25999, every: 500, by: 175, floor: 5000, round: "down" },
      },
    },
  },
  AK: {
    name: "Alaska",
    single: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
    mfj: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
  },
  AZ: {
    name: "Arizona",
    single: {
      brackets: [[0, 0.025]],
      standardDeduction: 8350,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [[0, 0.025]],
      standardDeduction: 16700,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  AR: {
    // (g) Income up to $92,300 uses a separate, lower table (2025 figures; 2026 not published).
    name: "Arkansas",
    single: {
      brackets: [
        [0, 0.02],
        [4600, 0.039],
      ],
      standardDeduction: 2470,
      personalExemption: 0,
      exemptionCredit: 29,
    },
    mfj: {
      brackets: [
        [0, 0.02],
        [4600, 0.039],
      ],
      standardDeduction: 4940,
      personalExemption: 0,
      exemptionCredit: 58,
    },
    lowIncome: {
      upTo: 92300,
      brackets: [
        [0, 0],
        [5500, 0.02],
        [10900, 0.03],
        [15600, 0.034],
        [25700, 0.039],
      ],
    },
  },
  CA: {
    // (k) The exemption credit shrinks $6 (joint $12) per $2,500 of income above $252,203
    // (joint $504,411). California also taxes HSA contributions.
    name: "California",
    single: {
      brackets: [
        [0, 0.01],
        [11079, 0.02],
        [26264, 0.04],
        [41452, 0.06],
        [57542, 0.08],
        [72724, 0.093],
        [371479, 0.103],
        [445771, 0.113],
        [742953, 0.123],
        [1000000, 0.133],
      ],
      standardDeduction: 5540,
      personalExemption: 0,
      exemptionCredit: 153,
    },
    mfj: {
      brackets: [
        [0, 0.01],
        [22158, 0.02],
        [52528, 0.04],
        [82904, 0.06],
        [115084, 0.08],
        [145448, 0.093],
        [742958, 0.103],
        [891542, 0.113],
        [1000000, 0.123],
        [1485906, 0.133],
      ],
      standardDeduction: 11080,
      personalExemption: 0,
      exemptionCredit: 306,
    },
    phaseOuts: {
      exemptionCredit: {
        single: { kind: "steps", from: 252203, every: 2500, by: 6, floor: 0, round: "up" },
        mfj: { kind: "steps", from: 504411, every: 2500, by: 12, floor: 0, round: "up" },
      },
    },
    taxesHsa: true,
  },
  CO: {
    name: "Colorado",
    single: {
      brackets: [[0, 0.044]],
      standardDeduction: 16100,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [[0, 0.044]],
      standardDeduction: 32200,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  CT: {
    // (r) The exemption drops $1,000 per $1,000 (or part) of income above $30,000 (joint $48,000).
    name: "Connecticut",
    single: {
      brackets: [
        [0, 0.02],
        [10000, 0.045],
        [50000, 0.055],
        [100000, 0.06],
        [200000, 0.065],
        [250000, 0.069],
        [500000, 0.0699],
      ],
      standardDeduction: 0,
      personalExemption: 15000,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.02],
        [20000, 0.045],
        [100000, 0.055],
        [200000, 0.06],
        [400000, 0.065],
        [500000, 0.069],
        [1000000, 0.0699],
      ],
      standardDeduction: 0,
      personalExemption: 24000,
      exemptionCredit: 0,
    },
    phaseOuts: {
      personalExemption: {
        single: { kind: "steps", from: 30000, every: 1000, by: 1000, floor: 0, round: "up" },
        mfj: { kind: "steps", from: 48000, every: 1000, by: 1000, floor: 0, round: "up" },
      },
    },
  },
  DE: {
    name: "Delaware",
    single: {
      brackets: [
        [0, 0],
        [2000, 0.022],
        [5000, 0.039],
        [10000, 0.048],
        [20000, 0.052],
        [25000, 0.0555],
        [60000, 0.066],
      ],
      standardDeduction: 3250,
      personalExemption: 0,
      exemptionCredit: 110,
    },
    mfj: {
      brackets: [
        [0, 0],
        [2000, 0.022],
        [5000, 0.039],
        [10000, 0.048],
        [20000, 0.052],
        [25000, 0.0555],
        [60000, 0.066],
      ],
      standardDeduction: 6500,
      personalExemption: 0,
      exemptionCredit: 220,
    },
  },
  DC: {
    name: "District of Columbia",
    single: {
      brackets: [
        [0, 0.04],
        [10000, 0.06],
        [40000, 0.065],
        [60000, 0.085],
        [250000, 0.0925],
        [500000, 0.0975],
        [1000000, 0.1075],
      ],
      standardDeduction: 16100,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.04],
        [10000, 0.06],
        [40000, 0.065],
        [60000, 0.085],
        [250000, 0.0925],
        [500000, 0.0975],
        [1000000, 0.1075],
      ],
      standardDeduction: 32200,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  FL: {
    name: "Florida",
    single: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
    mfj: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
  },
  GA: {
    name: "Georgia",
    single: {
      brackets: [[0, 0.0519]],
      standardDeduction: 12000,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [[0, 0.0519]],
      standardDeduction: 24000,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  HI: {
    name: "Hawaii",
    single: {
      brackets: [
        [0, 0.014],
        [9600, 0.032],
        [14400, 0.055],
        [19200, 0.064],
        [24000, 0.068],
        [36000, 0.072],
        [48000, 0.076],
        [125000, 0.079],
        [175000, 0.0825],
        [225000, 0.09],
        [275000, 0.1],
        [325000, 0.11],
      ],
      standardDeduction: 4400,
      personalExemption: 1144,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.014],
        [19200, 0.032],
        [28800, 0.055],
        [38400, 0.064],
        [48000, 0.068],
        [72000, 0.072],
        [96000, 0.076],
        [250000, 0.079],
        [350000, 0.0825],
        [450000, 0.09],
        [550000, 0.1],
        [650000, 0.11],
      ],
      standardDeduction: 8800,
      personalExemption: 2288,
      exemptionCredit: 0,
    },
  },
  ID: {
    name: "Idaho",
    single: {
      brackets: [
        [0, 0],
        [4811, 0.053],
      ],
      standardDeduction: 16100,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0],
        [9622, 0.053],
      ],
      standardDeduction: 32200,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  IL: {
    // The course lecture (4B) sets Illinois at a flat 4.95% of wages, and the sample fixtures
    // depend on it, so the table's $2,925 exemption (joint $5,850) is left out.
    name: "Illinois",
    single: {
      brackets: [[0, 0.0495]],
      standardDeduction: 0,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [[0, 0.0495]],
      standardDeduction: 0,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  IN: {
    name: "Indiana",
    single: {
      brackets: [[0, 0.0295]],
      standardDeduction: 0,
      personalExemption: 1000,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [[0, 0.0295]],
      standardDeduction: 0,
      personalExemption: 2000,
      exemptionCredit: 0,
    },
  },
  IA: {
    name: "Iowa",
    single: {
      brackets: [[0, 0.038]],
      standardDeduction: 16100,
      personalExemption: 0,
      exemptionCredit: 40,
    },
    mfj: {
      brackets: [[0, 0.038]],
      standardDeduction: 32200,
      personalExemption: 0,
      exemptionCredit: 80,
    },
  },
  KS: {
    name: "Kansas",
    single: {
      brackets: [
        [0, 0.052],
        [23000, 0.0558],
      ],
      standardDeduction: 3605,
      personalExemption: 9160,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.052],
        [46000, 0.0558],
      ],
      standardDeduction: 8240,
      personalExemption: 18320,
      exemptionCredit: 0,
    },
  },
  KY: {
    name: "Kentucky",
    single: {
      brackets: [[0, 0.035]],
      standardDeduction: 3360,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [[0, 0.035]],
      standardDeduction: 3360,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  LA: {
    name: "Louisiana",
    single: {
      brackets: [[0, 0.03]],
      standardDeduction: 12875,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [[0, 0.03]],
      standardDeduction: 25750,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  ME: {
    name: "Maine",
    single: {
      brackets: [
        [0, 0.058],
        [27399, 0.0675],
        [64849, 0.0715],
      ],
      standardDeduction: 8350,
      personalExemption: 5300,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.058],
        [54849, 0.0675],
        [129749, 0.0715],
      ],
      standardDeduction: 16700,
      personalExemption: 10600,
      exemptionCredit: 0,
    },
  },
  MD: {
    // (aa) The exemption phases out between $100,000 and $150,000 of income (joint $150,000
    // and $200,000), modeled as a straight line.
    name: "Maryland",
    single: {
      brackets: [
        [0, 0.02],
        [1000, 0.03],
        [2000, 0.04],
        [3000, 0.0475],
        [100000, 0.05],
        [125000, 0.0525],
        [150000, 0.055],
        [250000, 0.0575],
        [500000, 0.0625],
        [1000000, 0.065],
      ],
      standardDeduction: 3350,
      personalExemption: 3200,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.02],
        [1000, 0.03],
        [2000, 0.04],
        [3000, 0.0475],
        [150000, 0.05],
        [175000, 0.0525],
        [225000, 0.055],
        [300000, 0.0575],
        [600000, 0.0625],
        [1200000, 0.065],
      ],
      standardDeduction: 6700,
      personalExemption: 6400,
      exemptionCredit: 0,
    },
    phaseOuts: {
      personalExemption: {
        single: { kind: "linear", from: 100000, to: 150000 },
        mfj: { kind: "linear", from: 150000, to: 200000 },
      },
    },
  },
  MA: {
    name: "Massachusetts",
    single: {
      brackets: [
        [0, 0.05],
        [1083150, 0.09],
      ],
      standardDeduction: 0,
      personalExemption: 4400,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.05],
        [1083150, 0.09],
      ],
      standardDeduction: 0,
      personalExemption: 8800,
      exemptionCredit: 0,
    },
  },
  MI: {
    name: "Michigan",
    single: {
      brackets: [[0, 0.0425]],
      standardDeduction: 0,
      personalExemption: 5900,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [[0, 0.0425]],
      standardDeduction: 0,
      personalExemption: 11800,
      exemptionCredit: 0,
    },
  },
  MN: {
    name: "Minnesota",
    single: {
      brackets: [
        [0, 0.0535],
        [33310, 0.068],
        [109430, 0.0785],
        [203150, 0.0985],
      ],
      standardDeduction: 15300,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.0535],
        [48700, 0.068],
        [193480, 0.0785],
        [337930, 0.0985],
      ],
      standardDeduction: 30600,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  MS: {
    name: "Mississippi",
    single: {
      brackets: [
        [0, 0],
        [10000, 0.04],
      ],
      standardDeduction: 2300,
      personalExemption: 6000,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0],
        [10000, 0.04],
      ],
      standardDeduction: 4600,
      personalExemption: 12000,
      exemptionCredit: 0,
    },
  },
  MO: {
    name: "Missouri",
    single: {
      brackets: [
        [0, 0],
        [1348, 0.02],
        [2696, 0.025],
        [4044, 0.03],
        [5392, 0.035],
        [6740, 0.04],
        [8088, 0.045],
        [9436, 0.047],
      ],
      standardDeduction: 16100,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0],
        [1348, 0.02],
        [2696, 0.025],
        [4044, 0.03],
        [5392, 0.035],
        [6740, 0.04],
        [8088, 0.045],
        [9436, 0.047],
      ],
      standardDeduction: 32200,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  MT: {
    name: "Montana",
    single: {
      brackets: [
        [0, 0.047],
        [47500, 0.0565],
      ],
      standardDeduction: 16100,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.047],
        [95000, 0.0565],
      ],
      standardDeduction: 32200,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  NE: {
    name: "Nebraska",
    single: {
      brackets: [
        [0, 0.0246],
        [4130, 0.0351],
        [24760, 0.0455],
      ],
      standardDeduction: 8850,
      personalExemption: 0,
      exemptionCredit: 176,
    },
    mfj: {
      brackets: [
        [0, 0.0246],
        [8250, 0.0351],
        [49530, 0.0455],
      ],
      standardDeduction: 17700,
      personalExemption: 0,
      exemptionCredit: 352,
    },
  },
  NV: {
    name: "Nevada",
    single: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
    mfj: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
  },
  NH: {
    name: "New Hampshire",
    single: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
    mfj: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
  },
  NJ: {
    // New Jersey taxes HSA contributions.
    name: "New Jersey",
    single: {
      brackets: [
        [0, 0.014],
        [20000, 0.0175],
        [35000, 0.035],
        [40000, 0.05525],
        [75000, 0.0637],
        [500000, 0.0897],
        [1000000, 0.1075],
      ],
      standardDeduction: 0,
      personalExemption: 1000,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.014],
        [20000, 0.0175],
        [50000, 0.0245],
        [70000, 0.035],
        [80000, 0.05525],
        [150000, 0.0637],
        [500000, 0.0897],
        [1000000, 0.1075],
      ],
      standardDeduction: 0,
      personalExemption: 2000,
      exemptionCredit: 0,
    },
    taxesHsa: true,
  },
  NM: {
    name: "New Mexico",
    single: {
      brackets: [
        [0, 0.015],
        [5500, 0.032],
        [16500, 0.043],
        [33500, 0.047],
        [66500, 0.049],
        [210000, 0.059],
      ],
      standardDeduction: 16100,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.015],
        [8000, 0.032],
        [25000, 0.043],
        [50000, 0.047],
        [100000, 0.049],
        [315000, 0.059],
      ],
      standardDeduction: 32200,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  NY: {
    name: "New York",
    single: {
      brackets: [
        [0, 0.039],
        [8500, 0.044],
        [11700, 0.0515],
        [13900, 0.054],
        [80650, 0.059],
        [215400, 0.0685],
        [1077550, 0.0965],
        [5000000, 0.103],
        [25000000, 0.109],
      ],
      standardDeduction: 8000,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.039],
        [17150, 0.044],
        [23600, 0.0515],
        [27900, 0.054],
        [161550, 0.059],
        [323200, 0.0685],
        [2155350, 0.0965],
        [5000000, 0.103],
        [25000000, 0.109],
      ],
      standardDeduction: 16050,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  NC: {
    name: "North Carolina",
    single: {
      brackets: [[0, 0.0399]],
      standardDeduction: 12750,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [[0, 0.0399]],
      standardDeduction: 25500,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  ND: {
    name: "North Dakota",
    single: {
      brackets: [
        [0, 0],
        [48475, 0.0195],
        [244825, 0.025],
      ],
      standardDeduction: 16100,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0],
        [80975, 0.0195],
        [298075, 0.025],
      ],
      standardDeduction: 32200,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  OH: {
    // (dd) The exemption is $2,400 up to $40,000 of income, $2,150 up to $80,000, $1,900 below
    // $500,000, and none above (per person).
    name: "Ohio",
    single: {
      brackets: [
        [0, 0],
        [26050, 0.0275],
      ],
      standardDeduction: 0,
      personalExemption: 2400,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0],
        [26050, 0.0275],
      ],
      standardDeduction: 0,
      personalExemption: 4800,
      exemptionCredit: 0,
    },
    phaseOuts: {
      personalExemption: {
        single: {
          kind: "tiers",
          tiers: [
            [40000, 2400],
            [80000, 2150],
            [500000, 1900],
          ],
        },
        mfj: {
          kind: "tiers",
          tiers: [
            [40000, 4800],
            [80000, 4300],
            [500000, 3800],
          ],
        },
      },
    },
  },
  OK: {
    name: "Oklahoma",
    single: {
      brackets: [
        [0, 0],
        [3750, 0.025],
        [4900, 0.035],
        [7200, 0.045],
      ],
      standardDeduction: 6350,
      personalExemption: 1000,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0],
        [7500, 0.025],
        [9800, 0.035],
        [14400, 0.045],
      ],
      standardDeduction: 12700,
      personalExemption: 2000,
      exemptionCredit: 0,
    },
  },
  OR: {
    // (ee) No exemption credit above $100,000 of income (joint $200,000).
    name: "Oregon",
    single: {
      brackets: [
        [0, 0.0475],
        [4550, 0.0675],
        [11400, 0.0875],
        [125000, 0.099],
      ],
      standardDeduction: 2910,
      personalExemption: 0,
      exemptionCredit: 256,
    },
    mfj: {
      brackets: [
        [0, 0.0475],
        [9100, 0.0675],
        [22800, 0.0875],
        [250000, 0.099],
      ],
      standardDeduction: 5820,
      personalExemption: 0,
      exemptionCredit: 512,
    },
    phaseOuts: {
      exemptionCredit: {
        single: { kind: "cliff", above: 100000 },
        mfj: { kind: "cliff", above: 200000 },
      },
    },
  },
  PA: {
    // Pennsylvania taxes 401(k) contributions, so traditional dollars stay in its wages.
    name: "Pennsylvania",
    single: {
      brackets: [[0, 0.0307]],
      standardDeduction: 0,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [[0, 0.0307]],
      standardDeduction: 0,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    taxes401k: true,
  },
  RI: {
    // (ff) The standard deduction and exemption phase out between $261,000 and $290,800.
    name: "Rhode Island",
    single: {
      brackets: [
        [0, 0.0375],
        [82050, 0.0475],
        [186450, 0.0599],
      ],
      standardDeduction: 11200,
      personalExemption: 5250,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.0375],
        [82050, 0.0475],
        [186450, 0.0599],
      ],
      standardDeduction: 22400,
      personalExemption: 10500,
      exemptionCredit: 0,
    },
    phaseOuts: {
      standardDeduction: {
        single: { kind: "linear", from: 261000, to: 290800 },
        mfj: { kind: "linear", from: 261000, to: 290800 },
      },
      personalExemption: {
        single: { kind: "linear", from: 261000, to: 290800 },
        mfj: { kind: "linear", from: 261000, to: 290800 },
      },
    },
  },
  SC: {
    name: "South Carolina",
    single: {
      brackets: [
        [0, 0.0],
        [3640, 0.03],
        [18230, 0.06],
      ],
      standardDeduction: 8350,
      personalExemption: 0,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.0],
        [3640, 0.03],
        [18230, 0.06],
      ],
      standardDeduction: 16700,
      personalExemption: 0,
      exemptionCredit: 0,
    },
  },
  SD: {
    name: "South Dakota",
    single: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
    mfj: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
  },
  TN: {
    name: "Tennessee",
    single: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
    mfj: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
  },
  TX: {
    name: "Texas",
    single: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
    mfj: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
  },
  UT: {
    // (gg) The standard deduction is a credit that shrinks 1.3 cents per dollar of income above
    // $18,213 (joint $36,426), 2025 thresholds.
    name: "Utah",
    single: {
      brackets: [[0, 0.045]],
      standardDeduction: 0,
      personalExemption: 0,
      exemptionCredit: 966,
    },
    mfj: {
      brackets: [[0, 0.045]],
      standardDeduction: 0,
      personalExemption: 0,
      exemptionCredit: 1932,
    },
    phaseOuts: {
      exemptionCredit: {
        single: { kind: "perDollar", from: 18213, rate: 0.013 },
        mfj: { kind: "perDollar", from: 36426, rate: 0.013 },
      },
    },
  },
  VT: {
    // (hh) Above $150,000 of income, the tax is at least 3% of income.
    name: "Vermont",
    single: {
      brackets: [
        [0, 0.0335],
        [49400, 0.066],
        [119700, 0.076],
        [249700, 0.0875],
      ],
      standardDeduction: 7650,
      personalExemption: 5300,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.0335],
        [82500, 0.066],
        [199450, 0.076],
        [304000, 0.0875],
      ],
      standardDeduction: 15300,
      personalExemption: 10600,
      exemptionCredit: 0,
    },
    minimumTax: { above: 150000, rate: 0.03 },
  },
  VA: {
    name: "Virginia",
    single: {
      brackets: [
        [0, 0.02],
        [3000, 0.03],
        [5000, 0.05],
        [17000, 0.0575],
      ],
      standardDeduction: 8750,
      personalExemption: 930,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.02],
        [3000, 0.03],
        [5000, 0.05],
        [17000, 0.0575],
      ],
      standardDeduction: 17500,
      personalExemption: 1860,
      exemptionCredit: 0,
    },
  },
  WA: {
    name: "Washington",
    single: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
    mfj: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
  },
  WV: {
    name: "West Virginia",
    single: {
      brackets: [
        [0, 0.0222],
        [10000, 0.0296],
        [25000, 0.0333],
        [40000, 0.0444],
        [60000, 0.0482],
      ],
      standardDeduction: 0,
      personalExemption: 2000,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.0222],
        [10000, 0.0296],
        [25000, 0.0333],
        [40000, 0.0444],
        [60000, 0.0482],
      ],
      standardDeduction: 0,
      personalExemption: 4000,
      exemptionCredit: 0,
    },
  },
  WI: {
    // (ii) The standard deduction phases out from $20,119 to zero at $136,453 of income
    // (joint $29,039 to $159,690).
    name: "Wisconsin",
    single: {
      brackets: [
        [0, 0.035],
        [15110, 0.044],
        [51950, 0.053],
        [332720, 0.0765],
      ],
      standardDeduction: 13960,
      personalExemption: 700,
      exemptionCredit: 0,
    },
    mfj: {
      brackets: [
        [0, 0.035],
        [20150, 0.044],
        [69260, 0.053],
        [443630, 0.0765],
      ],
      standardDeduction: 25840,
      personalExemption: 1400,
      exemptionCredit: 0,
    },
    phaseOuts: {
      standardDeduction: {
        single: { kind: "linear", from: 20119, to: 136453 },
        mfj: { kind: "linear", from: 29039, to: 159690 },
      },
    },
  },
  WY: {
    name: "Wyoming",
    single: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
    mfj: { brackets: [[0, 0]], standardDeduction: 0, personalExemption: 0, exemptionCredit: 0 },
  },
};

/** Every built-in state code, in the order of the state names (Alabama first). */
export const STATE_CODES = Object.keys(STATE_TAX) as TaxedState[];

/** True when a state taxes wages at all (false for Texas, Florida, Washington, and the rest). */
export function hasWageIncomeTax(state: TaxedState): boolean {
  return STATE_TAX[state].single.brackets.some(([, rate]) => rate > 0);
}

/** What is left of `amount` at this household income after its phase-out, if any. */
export function phasedAmount(amount: number, income: number, rule?: PhaseOut): number {
  if (!rule || amount <= 0) return amount;
  switch (rule.kind) {
    case "linear": {
      if (income <= rule.from) return amount;
      if (income >= rule.to) return 0;
      return (amount * (rule.to - income)) / (rule.to - rule.from);
    }
    case "perDollar":
      return Math.max(0, amount - rule.rate * Math.max(0, income - rule.from));
    case "steps": {
      const over = Math.max(0, income - rule.from);
      const n = rule.round === "up" ? Math.ceil(over / rule.every) : Math.floor(over / rule.every);
      return Math.max(rule.floor, amount - n * rule.by);
    }
    case "cliff":
      return income > rule.above ? 0 : amount;
    case "tiers": {
      const tier = rule.tiers.find(([upTo]) => income <= upTo);
      return tier ? tier[1] : 0;
    }
  }
}

/** Tax on taxable income, walking the brackets. */
export function bracketTax(taxable: number, brackets: readonly StateBracket[]): number {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const [lo, rate] = brackets[i]!;
    const hi = brackets[i + 1]?.[0] ?? Infinity;
    if (taxable <= lo) break;
    tax += (Math.min(taxable, hi) - lo) * rate;
  }
  return tax;
}

/**
 * A household's state income tax on `income` (its state wages): subtract the standard
 * deduction and exemption after their phase-outs, walk the brackets, then take off the
 * exemption credit. Never below zero.
 */
export function stateTaxOnIncome(state: TaxedState, status: FilingStatus, income: number): number {
  const rule = STATE_TAX[state];
  const s = rule[status];
  const p = rule.phaseOuts;
  const income0 = Math.max(0, income);
  const sd = phasedAmount(s.standardDeduction, income0, p?.standardDeduction?.[status]);
  const pe = phasedAmount(s.personalExemption, income0, p?.personalExemption?.[status]);
  const credit = phasedAmount(s.exemptionCredit, income0, p?.exemptionCredit?.[status]);
  const taxable = Math.max(0, income0 - sd - pe);
  const brackets =
    rule.lowIncome && taxable <= rule.lowIncome.upTo ? rule.lowIncome.brackets : s.brackets;
  let tax = Math.max(0, bracketTax(taxable, brackets) - credit);
  if (rule.minimumTax && income0 > rule.minimumTax.above) {
    tax = Math.max(tax, rule.minimumTax.rate * income0);
  }
  return tax;
}

/** What this module leaves out, for the Method page's list of simplifications. */
export const STATE_TAX_LEFT_OUT =
  "State income tax follows each state's 2026 brackets, standard deduction, and exemptions, but leaves out dependents and other state credits, New York and Connecticut recapture at high incomes, Connecticut's phase-down of its 2% bracket, Maine's and Minnesota's standard deduction phase-outs at high incomes, and state payroll taxes such as California's 1.3% disability insurance. Illinois skips its personal exemption, because the site uses the lecture's flat 4.95% of wages.";
