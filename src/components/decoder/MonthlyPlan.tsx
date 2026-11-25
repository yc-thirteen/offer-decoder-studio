import { useEffect, useId, useState } from "react";
import { formatMoney } from "@/components/stub";
import { fullMatchDollars, hsaAllowance, isReady, LIMIT_401K } from "@/lib/engine";
import { useDecoder } from "@/state/DecoderContext";
import type { OfferSlot } from "@/state/decoderState";
import { memoName } from "./memoText";

/** Keep a typed draft (including invalid text) while calculations receive number or null. */
function parseAmount(text: string, precision = 2): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!new RegExp(`^\\d+(\\.\\d{0,${precision}})?$`).test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function NumberField({
  label,
  value,
  onChange,
  disabled = false,
  error,
  suffix = "",
  precision = 2,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  error?: string | undefined;
  suffix?: string;
  precision?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setDraft((old) =>
      parseAmount(old, precision) === value ? old : value === null ? "" : String(value),
    );
  }, [value, precision]);
  const invalidDraft = draft.trim() !== "" && parseAmount(draft, precision) === null;
  const message = invalidDraft
    ? `Enter zero or a positive number${precision === 2 ? ", with up to two decimal places" : ""}.`
    : error;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <div
        className={`mt-1 flex min-w-0 items-center border bg-stub ${message ? "border-correction" : "border-ink"}`}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          disabled={disabled}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id}-error` : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange(parseAmount(event.target.value, precision));
          }}
          className="h-10 w-full min-w-0 bg-transparent px-2 text-carbon disabled:text-ink-soft"
        />
        {suffix && <span className="shrink-0 pr-2 text-sm text-ink-soft">{suffix}</span>}
      </div>
      {message && (
        <p id={`${id}-error`} className="m-0 mt-1 text-sm text-correction">
          {message}
        </p>
      )}
    </div>
  );
}

const BUTTON = "min-h-10 border border-ink bg-stub px-3 font-semibold";
const SELECT =
  "mt-1 h-10 w-full min-w-0 border border-ink bg-stub px-2 text-carbon disabled:text-ink-soft";

export function MonthlyPlan() {
  const { state, view, dispatch } = useDecoder();
  const [selected, setSelected] = useState<OfferSlot>(0);
  const id = useId();
  const slots = view.stubs.filter((s) => s.offer).map((s) => s.slot);
  const slot = slots.includes(selected) ? selected : slots[0];
  const stub = slot === undefined ? undefined : view.stubs[slot];
  if (!stub?.offer || slot === undefined) return null;
  const { offer, calc, elections: e, electionErrors: errors, monthlyPlan: monthly, result } = stub;
  const planning = state.planning[slot];
  const custom = state.electionsMode === "custom";
  const plan = offer.healthPlans.find((p) => p.id === e?.planId);
  const allowance = e ? hsaAllowance(offer, state.profile, e.planId) : 0;
  const names = view.stubs.map((s) => memoName(s.offer?.employer, s.slot));
  if (names[0] === names[1]) names.forEach((name, i) => (names[i] = `${name} (offer ${i + 1})`));
  const recommended = result?.recommendedElections;
  const forgone = calc ? Math.max(0, fullMatchDollars(offer) - calc.employerMatch) : 0;
  const patchElection = (patch: Parameters<typeof dispatch>[0] & { type: "setCustomElections" }) =>
    dispatch(patch);
  const setBudget = (patch: Partial<typeof planning.budget>) =>
    dispatch({ type: "setMonthlyBudget", slot, patch });
  const amount = (n: number) => formatMoney(n, { cents: true });

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="mb-12 border-t-2 border-ink pt-6"
      data-testid="monthly-plan"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`${id}-heading`} className="m-0">
            Your monthly plan
          </h2>
          <p className="m-0 mt-1 text-sm text-ink-soft">
            Average month, based on a full year of this job.
          </p>
        </div>
        {slots.length > 1 && (
          <div className="min-w-0 max-w-full">
            <label htmlFor={`${id}-offer`} className="block text-xs text-ink-soft">
              Plan for offer
            </label>
            <select
              id={`${id}-offer`}
              value={slot}
              onChange={(event) => setSelected(Number(event.target.value) as OfferSlot)}
              className={SELECT}
            >
              {slots.map((s) => (
                <option key={s} value={s}>
                  {names[s]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <p className="m-0 mb-4 max-w-prose">
        Plan for <strong>{names[slot]}</strong>. Enter the expenses this job needs to cover.
        Spouse&apos;s wages affect the tax estimate; they are not added to this spending budget.
      </p>
      {planning.notice && (
        <p role="status" className="mb-4 border-l-2 border-carbon pl-3 text-sm">
          {planning.notice}
        </p>
      )}
      <div key={`${slot}-${planning.revision}`} className="grid min-w-0 gap-5 lg:grid-cols-2">
        <div className="min-w-0 border border-ink bg-stub p-4 sm:p-5">
          <h3 className="m-0 text-base font-semibold">Contributions</h3>
          <p className="mt-2 text-sm text-ink-soft">
            About you:{" "}
            {state.profile.hasEmergencyFund ? "emergency fund in place" : "no emergency fund"};{" "}
            {state.profile.hasHighInterestDebt ? "high-interest debt" : "no high-interest debt"}.
          </p>
          {recommended && (
            <p className="text-sm">
              Suggested: <strong>{recommended.employeePct}% to your 401(k)</strong> and{" "}
              <strong>{formatMoney(recommended.employeeHsa)} a year to your HSA</strong>.
              {isReady(state.profile)
                ? " The starting retirement target is 15% of salary including the employer match; HSA contributions are additional."
                : " The starting priority is the employer match, then high-interest debt and a cash buffer."}
            </p>
          )}
          <p className="text-sm text-ink-soft">
            Check the monthly balance below to see whether these amounts fit your expenses.
          </p>
          {!custom && (
            <button
              type="button"
              className={`${BUTTON} mb-4`}
              onClick={() => dispatch({ type: "setElectionsMode", mode: "custom" })}
            >
              Customize contributions
            </button>
          )}
          {e && (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <label htmlFor={`${id}-health`} className="block text-sm font-semibold">
                  Health plan for my plan
                </label>
                <select
                  id={`${id}-health`}
                  value={e.planId}
                  disabled={!custom}
                  className={SELECT}
                  onChange={(event) =>
                    patchElection({
                      type: "setCustomElections",
                      slot,
                      patch: { planId: event.target.value },
                    })
                  }
                >
                  {offer.healthPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {errors.planId && <p className="text-sm text-correction">{errors.planId}</p>}
              </div>
              <NumberField
                label="My 401(k) contribution"
                precision={16}
                suffix="% of pay"
                value={e.employeePct}
                disabled={!custom}
                error={errors.employeePct}
                onChange={(employeePct) =>
                  patchElection({ type: "setCustomElections", slot, patch: { employeePct } })
                }
              />
              <div className="min-w-0">
                <label htmlFor={`${id}-account`} className="block text-sm font-semibold">
                  401(k) tax treatment
                </label>
                <select
                  id={`${id}-account`}
                  value={e.accountType}
                  disabled={!custom}
                  className={SELECT}
                  onChange={(event) =>
                    patchElection({
                      type: "setCustomElections",
                      slot,
                      patch: { accountType: event.target.value as "traditional" | "roth" },
                    })
                  }
                >
                  <option value="traditional">Traditional</option>
                  {offer.retirement.rothAvailable && <option value="roth">Roth</option>}
                </select>
                {errors.accountType && (
                  <p className="text-sm text-correction">{errors.accountType}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <NumberField
                  label="My payroll HSA contribution per year"
                  suffix="$/year"
                  value={e.employeeHsa}
                  disabled={!custom || !plan?.hsaEligible}
                  error={errors.employeeHsa}
                  onChange={(employeeHsa) =>
                    patchElection({ type: "setCustomElections", slot, patch: { employeeHsa } })
                  }
                />
                <p className="m-0 mt-1 text-sm text-ink-soft">
                  {plan?.hsaEligible
                    ? `Up to ${formatMoney(allowance)} after the employer deposit, assuming full-year eligibility.`
                    : "This health plan is not HSA-eligible; your HSA contribution is zero."}
                </p>
              </div>
            </div>
          )}
          {errors.deductions && (
            <p role="alert" className="text-sm text-correction">
              {errors.deductions}
            </p>
          )}
          {custom && (
            <button
              type="button"
              className={`${BUTTON} mt-4`}
              onClick={() => dispatch({ type: "resetCustomElections", slot })}
            >
              Reset this offer to suggested settings
            </button>
          )}
          {calc && (
            <>
              <p className="mb-0 text-sm">
                Your payroll contributions: {amount(calc.employee401k / 12)} to the 401(k) and{" "}
                {amount(calc.employeeHsa / 12)} to the HSA per average month.
              </p>
              <p className="text-sm">
                Employer adds {formatMoney(calc.employerMatch)} to retirement and{" "}
                {formatMoney(calc.employerHsa)} to the HSA per year. Employer match shown assumes
                you retain it through vesting.
              </p>
              {forgone > 0.5 && (
                <p className="text-sm text-correction">
                  These settings leave {formatMoney(forgone)} of the stated employer match unclaimed
                  per year
                  {calc.hitsLimit401k ? "; the basic employee contribution cap applies" : ""}.
                </p>
              )}
            </>
          )}
          <p className="mb-0 mt-4 text-xs text-ink-soft">
            2026 annual estimate. Basic employee 401(k) cap: {formatMoney(LIMIT_401K)}. Assumes
            full-year HSA eligibility, with no contributions allocated elsewhere. Age-based
            catch-ups and remaining-year payroll planning are not included.
          </p>
        </div>
        <div className="min-w-0 border border-ink bg-stub p-4 sm:p-5">
          <h3 className="m-0 text-base font-semibold">Monthly spending and cash savings</h3>
          <p className="mt-2 text-sm text-ink-soft">
            Leave a field blank while you work it out, or enter 0. Exclude payroll deductions and
            medical bills from living expenses.
          </p>
          <div className="grid min-w-0 gap-4">
            <NumberField
              label="Living expenses per month"
              suffix="$/month"
              value={planning.budget.livingExpenses}
              onChange={(livingExpenses) => setBudget({ livingExpenses })}
            />
            <NumberField
              label="Minimum debt payments per month"
              suffix="$/month"
              value={planning.budget.minimumDebtPayments}
              onChange={(minimumDebtPayments) => setBudget({ minimumDebtPayments })}
            />
            <NumberField
              label="Additional cash savings per month"
              suffix="$/month"
              value={planning.budget.cashSavings}
              onChange={(cashSavings) => setBudget({ cashSavings })}
            />
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-carbon"
              disabled={!plan?.hsaEligible}
              checked={planning.budget.useHsaForMedical && !!plan?.hsaEligible}
              onChange={(event) => setBudget({ useHsaForMedical: event.target.checked })}
            />
            Use this year&apos;s HSA contributions for expected eligible medical bills
          </label>
          <p className="mt-2 text-xs text-ink-soft">
            This averages medical costs and HSA deposits across a year. It does not predict when
            bills arrive or when deposits become available.
          </p>
          {!monthly ? (
            <p role="status" className="mt-4 text-correction">
              {stub.error ?? "Finish the offer details to calculate your monthly plan."}
            </p>
          ) : (
            <>
              <dl className="m-0 mt-5 border-t border-ink pt-3 text-sm">
                <div className="flex justify-between gap-3 py-1">
                  <dt>Average monthly take-home</dt>
                  <dd className="m-0 shrink-0 font-semibold">{amount(monthly.monthlyTakeHome)}</dd>
                </div>
                <div className="flex justify-between gap-3 py-1">
                  <dt>Medical bills reserved from cash</dt>
                  <dd className="m-0 shrink-0">−{amount(monthly.monthlyCashMedical)}</dd>
                </div>
              </dl>
              {monthly.complete ? (
                <div
                  role="status"
                  className={`mt-3 border-2 p-3 ${monthly.remaining! < 0 ? "border-correction text-correction" : "border-ink"}`}
                >
                  <p className="m-0 text-sm font-semibold">
                    {monthly.remaining! < 0 ? "Monthly shortfall" : "Monthly amount remaining"}
                  </p>
                  <p className="m-0 mt-1 text-2xl font-extrabold" data-testid="monthly-remaining">
                    {amount(Math.abs(monthly.remaining!))}
                  </p>
                  <p className="m-0 mt-2 text-sm">
                    {monthly.remaining! < 0
                      ? "These expenses and savings exceed this job's estimated take-home pay. Adjust contributions, spending, or the cash savings goal to see what fits."
                      : "After the expenses, debt payments, cash savings, and medical reserve entered above."}
                  </p>
                </div>
              ) : (
                <p role="status" className="mt-4 font-semibold">
                  Enter all three monthly amounts to check affordability. Zero is a valid amount.
                </p>
              )}
              <div className="mt-4 border-t border-ink pt-3 text-sm">
                <p className="m-0">
                  Retirement contributions including employer match:{" "}
                  <strong>{monthly.retirementRate}% of salary</strong> (
                  {amount(monthly.monthlyRetirement)} per average month, before future tax).
                </p>
                <p className="mb-0 mt-2">
                  HSA used for expected bills:{" "}
                  <strong>{formatMoney(monthly.medicalFromHsa)} a year</strong>. HSA retained after
                  those bills: <strong>{formatMoney(monthly.hsaRetained)} a year</strong>.
                </p>
              </div>
              <p className="mb-0 mt-3 text-xs text-ink-soft">
                401(k), payroll HSA contributions, and health premiums are already deducted from
                take-home pay. Employer contributions are savings, not spending income. The annual
                bottom line above also includes savings.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
