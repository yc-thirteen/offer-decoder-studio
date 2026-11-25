import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/engine";
import { decoderReducer as reduce, deriveView, initialDecoderState } from "./decoderState";

describe("planning state and the active calculation", () => {
  it("seeds both offers from the viewed preset and keeps edits when visiting another mode", () => {
    const initial = initialDecoderState();
    const base = deriveView(initial);
    let s = reduce(initial, { type: "setElectionsMode", mode: "custom" });
    expect(s.planning[0].custom?.employeePct).toBe(base.stubs[0].calc?.employeePct);
    expect(s.planning[1].custom?.planId).toBe(base.stubs[1].calc?.planId);
    s = reduce(s, { type: "setCustomElections", slot: 0, patch: { employeePct: 5 } });
    expect(s.planning[1].custom).toEqual(initial.offers[1] && base.stubs[1].elections);
    s = reduce(s, { type: "setElectionsMode", mode: "recommended" });
    s = reduce(s, { type: "setElectionsMode", mode: "custom" });
    expect(s.planning[0].custom?.employeePct).toBe(5);
    expect(deriveView(s).stubs[0].calc).toEqual(
      calculate(s.offers[0]!, s.profile, {
        ...base.stubs[0].elections!,
        employeePct: 5,
        employeeHsa: 0,
      }),
    );
  });

  it("keeps budgets separate and computes custom winners from the selected settings", () => {
    let s = reduce(initialDecoderState(), {
      type: "setMonthlyBudget",
      slot: 0,
      patch: { livingExpenses: 2500, minimumDebtPayments: 0, cashSavings: 0 },
    });
    s = reduce(s, { type: "setElectionsMode", mode: "custom" });
    s = reduce(s, { type: "setCustomElections", slot: 0, patch: { employeePct: 0 } });
    const v = deriveView(s);
    expect(v.stubs[0].monthlyPlan?.complete).toBe(true);
    expect(v.stubs[1].monthlyPlan?.complete).toBe(false);
    expect(v.activeWinnerSlot).toBe(
      v.stubs[1].calc!.bottomLine > v.stubs[0].calc!.bottomLine ? 1 : 0,
    );
  });

  it("invalid custom input suppresses results instead of displaying an older valid total", () => {
    const s = reduce(initialDecoderState(), {
      type: "setCustomElections",
      slot: 0,
      patch: { employeePct: null },
    });
    const v = deriveView(s);
    expect(v.stubs[0].calc).toBeNull();
    expect(v.stubs[0].monthlyPlan).toBeNull();
    expect(v.stubs[0].electionErrors.employeePct).toBeTruthy();
    expect(v.activeWinnerSlot).toBeNull();
    expect(v.stubs[1].calc).not.toBeNull();
  });

  it("changing to a non-HSA plan clears the HSA contribution", () => {
    let s = reduce(initialDecoderState(), { type: "setElectionsMode", mode: "recommended" });
    s = reduce(s, {
      type: "setCustomElections",
      slot: 0,
      patch: { planId: s.offers[0]!.defaultPlanId },
    });
    expect(s.planning[0].custom?.employeeHsa).toBe(0);
    expect(deriveView(s).stubs[0].calc?.employeeHsa).toBe(0);
  });

  it("offer edits and coverage changes reset affected choices with an explanation", () => {
    let s = reduce(initialDecoderState(), {
      type: "setCustomElections",
      slot: 0,
      patch: { employeePct: 5 },
    });
    s = reduce(s, { type: "setMonthlyBudget", slot: 0, patch: { livingExpenses: 2000 } });
    const oldOther = s.planning[1];
    s = reduce(s, { type: "setOffer", slot: 0, offer: { ...s.offers[0]!, salary: 140000 } });
    expect(s.planning[0].custom).toBeNull();
    expect(s.planning[0].budget.livingExpenses).toBe(2000);
    expect(s.planning[0].notice).toContain("reset");
    expect(s.planning[1]).toBe(oldOther);
    s = reduce(s, { type: "setProfile", patch: { coverage: "family" } });
    expect(s.planning.every((p) => p.custom === null && p.notice?.includes("Coverage"))).toBe(true);
  });

  it("loading samples or clearing offers clears all private planning drafts", () => {
    let s = reduce(initialDecoderState(), {
      type: "setMonthlyBudget",
      slot: 0,
      patch: { livingExpenses: 2000 },
    });
    s = reduce(s, { type: "loadSample", sampleId: "new-grad-roth" });
    expect(s.planning[0].budget.livingExpenses).toBeNull();
    s = reduce(s, { type: "setCustomElections", slot: 0, patch: { employeePct: 1 } });
    s = reduce(s, { type: "clearOffers" });
    expect(s.planning.every((p) => p.custom === null && p.budget.livingExpenses === null)).toBe(
      true,
    );
  });
});
