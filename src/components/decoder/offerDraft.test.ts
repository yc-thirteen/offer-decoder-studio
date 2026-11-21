import { describe, expect, it } from "vitest";
import { SAMPLE_CASES } from "@/state/decoderState";
import {
  blankDraft,
  blankPlan,
  blankStep,
  blankTier,
  draftFromOffer,
  parseMoney,
  parseNumber,
  rateToPct,
  validateDraft,
  type OfferDraft,
} from "./offerDraft";

const ALL_OFFERS = SAMPLE_CASES.flatMap((c) => c.offers);
const northfield = SAMPLE_CASES[0]!.offers[0]!;

function draft(patch: Partial<OfferDraft> = {}): OfferDraft {
  return { ...draftFromOffer(northfield), ...patch };
}

describe("offer draft", () => {
  it("round-trips every sample offer unchanged, including the 4/3 match rate", () => {
    expect(ALL_OFFERS).toHaveLength(12);
    for (const offer of ALL_OFFERS) {
      const { offer: back, errors } = validateDraft(draftFromOffer(offer));
      expect(errors).toEqual({});
      expect(back).toEqual(offer);
    }
  });

  it("shows rates as percents without float noise", () => {
    expect(rateToPct(0.07)).toBe("7");
    expect(rateToPct(0.2)).toBe("20");
    expect(rateToPct(4 / 3)).toBe("133.33");
    const d = draftFromOffer(northfield);
    expect(d.salary).toBe("150,000");
    expect(d.tiers.map((t) => [t.ratePct, t.upToPct])).toEqual([["50", "6"]]);
    expect(d.plans.map((p) => p.coinsurancePct)).toEqual(["20", "20"]);
  });

  it("parses typed numbers and money", () => {
    expect(parseNumber("12.5%")).toBe(12.5);
    expect(parseNumber(" 6 ")).toBe(6);
    expect(parseNumber("-1")).toBeNull();
    expect(parseNumber("six")).toBeNull();
    expect(parseMoney("$1,200")).toBe(1200);
    expect(parseMoney("")).toBeNull();
  });

  it("applies edits: a changed rate is the typed percent", () => {
    const d = draft();
    d.tiers[0] = { ...d.tiers[0]!, ratePct: "100" };
    const { offer } = validateDraft({ ...d, salary: "$160,000" });
    expect(offer?.salary).toBe(160_000);
    expect(offer?.retirement.match).toEqual([{ rate: 1, upToPct: 6 }]);
  });

  it("gives a directive error for each bad field and returns no offer", () => {
    const d = draft({ employer: " ", salary: "lots", payPeriods: "0", basicMultiple: "x" });
    const { offer, errors } = validateDraft(d);
    expect(offer).toBeNull();
    expect(errors["employer"]).toBe("Type the employer's name.");
    expect(errors["salary"]).toBe("Type the yearly salary in dollars.");
    expect(errors["payPeriods"]).toMatch(/^Type paychecks a year/);
    expect(errors["basicMultiple"]).toMatch(/^Type the free coverage/);
    for (const msg of Object.values(errors)) expect(msg).not.toMatch(/sorry/i);
  });

  it("checks match tiers rise and plans make sense", () => {
    const d = draft();
    const second = { ...blankTier(), ratePct: "50", upToPct: "4" };
    const plan = d.plans[0]!;
    const { errors } = validateDraft({
      ...d,
      tiers: [...d.tiers, second],
      plans: [{ ...plan, oopMax: "100", deductible: "500" }, d.plans[1]!],
    });
    expect(errors[`tier.${second.key}.upToPct`]).toMatch(/higher percent of pay.*more than 6%/);
    expect(errors[`plan.${plan.id}.oopMax`]).toMatch(/can't be below the deductible/);
  });

  it("builds each vesting type and checks graded steps", () => {
    expect(validateDraft(draft({ vestingType: "immediate" })).offer?.retirement.vesting).toEqual({
      type: "immediate",
    });
    expect(
      validateDraft(draft({ vestingType: "cliff", cliffYears: "2" })).offer?.retirement.vesting,
    ).toEqual({ type: "cliff", years: 2 });
    expect(validateDraft(draft({ vestingType: "cliff", cliffYears: "0" })).errors).toHaveProperty(
      "cliffYears",
    );

    const a = { ...blankStep(), year: "1", pct: "50" };
    const b = { ...blankStep(), year: "2", pct: "100" };
    expect(
      validateDraft(draft({ vestingType: "graded", steps: [a, b] })).offer?.retirement.vesting,
    ).toEqual({
      type: "graded",
      schedule: [
        { year: 1, pct: 50 },
        { year: 2, pct: 100 },
      ],
    });
    const short = validateDraft(draft({ vestingType: "graded", steps: [a] })).errors;
    expect(short[`step.${a.key}.pct`]).toBe("The last step must reach 100%.");
    const backwards = validateDraft(
      draft({ vestingType: "graded", steps: [b, { ...a, year: "1", pct: "100" }] }),
    ).errors;
    expect(Object.values(backwards).join(" ")).toMatch(/each a later year/);
    expect(validateDraft(draft({ vestingType: "graded", steps: [] })).errors).toHaveProperty(
      "steps",
    );
  });

  it("needs a custom rate only for another state, and a valid default plan", () => {
    expect(validateDraft(draft({ state: "OTHER", customStatePct: "" })).errors).toHaveProperty(
      "customStatePct",
    );
    const other = validateDraft(draft({ state: "OTHER", customStatePct: "4.5" })).offer;
    expect(other?.customStateRate).toBe(0.045);
    expect(validateDraft(draft({ state: "TX" })).offer).not.toHaveProperty("customStateRate");
    expect(validateDraft(draft({ defaultPlanId: "gone" })).errors).toHaveProperty("defaultPlanId");
  });

  it("drops the employer HSA deposit on a plan that can't use an HSA", () => {
    const d = draft();
    const hdhp = d.plans[1]!;
    const { offer } = validateDraft({
      ...d,
      plans: [d.plans[0]!, { ...hdhp, hsaEligible: false }],
    });
    expect(offer?.healthPlans[1]?.employerHsa).toBe(0);
  });

  it("starts an empty stub blank, and asks for what the letter would say", () => {
    const d = blankDraft(1);
    const id = d.plans[0]!.id;
    const { offer, errors } = validateDraft(d);
    expect(offer).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(
      [
        "city",
        "employer",
        "salary",
        `plan.${id}.deductible`,
        `plan.${id}.name`,
        `plan.${id}.oopMax`,
        `plan.${id}.premium`,
      ].sort(),
    );
    expect(blankPlan().id).not.toBe(blankPlan().id);
  });
});
