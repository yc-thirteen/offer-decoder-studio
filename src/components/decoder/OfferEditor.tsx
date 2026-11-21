/**
 * Edit offer mode: the stub's lines become inline fields, typed in carbon like a carbon copy.
 * Health plans and match tiers can be added and removed, vesting picks its type, and "Save
 * offer" validates the draft (offerDraft.ts). Errors appear under each field in correction
 * red, state the fix, and focus moves to the first one. Nothing reaches the store until the
 * draft is valid.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Offer, StateCode } from "@/lib/engine";
import {
  blankPlan,
  blankStep,
  blankTier,
  validateDraft,
  type DraftErrors,
  type OfferDraft,
  type PlanDraft,
  type StepDraft,
  type TierDraft,
  type VestingType,
} from "./offerDraft";
import { STATE_NAMES } from "./stubFormat";

const CONTROL = "h-10 w-full min-w-0 border border-ink bg-stub px-2";
const SMALL_BUTTON = "h-10 border border-ink bg-stub px-3 font-semibold";

const STATES: { value: StateCode; label: string }[] = [
  ...(Object.entries(STATE_NAMES) as [StateCode, string][]).map(([value, label]) => ({
    value,
    label,
  })),
  { value: "OTHER", label: "Another state (flat rate)" },
];
const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
const VESTING: { value: VestingType; label: string }[] = [
  { value: "immediate", label: "Right away" },
  { value: "cliff", label: "All at once (cliff)" },
  { value: "graded", label: "In steps (graded)" },
];

function FieldShell({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={["flex min-w-0 flex-col", className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className="text-xs text-ink-soft">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="m-0 pt-1 text-xs text-correction">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  prefix,
  suffix,
  numeric = true,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  prefix?: string | undefined;
  suffix?: string | undefined;
  numeric?: boolean;
  className?: string | undefined;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} className={className}>
      <div
        className={[
          "flex h-10 items-center border bg-stub",
          error ? "border-correction border-b-2" : "border-ink",
        ].join(" ")}
      >
        {prefix ? (
          <span aria-hidden="true" className="pl-2 text-carbon">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          type="text"
          inputMode={numeric ? "decimal" : undefined}
          autoComplete="off"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={[
            "h-full w-full min-w-0 border-0 bg-transparent px-2",
            numeric ? "amount" : "",
          ].join(" ")}
        />
        {suffix ? (
          <span aria-hidden="true" className="pr-2 text-carbon">
            {suffix}
          </span>
        ) : null}
      </div>
    </FieldShell>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  error?: string | undefined;
  className?: string | undefined;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} className={className}>
      <select
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value as T)}
        className={CONTROL}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 mt-5 min-w-0 border-0 border-t border-ink p-0 pt-3">
      <legend className="float-left mb-2 w-full p-0 text-base font-semibold">{title}</legend>
      <div className="clear-left grid gap-x-4 gap-y-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** A removable group inside a section (one plan, one tier, one vesting step). */
function Group({
  title,
  onRemove,
  removeLabel,
  children,
}: {
  title: string;
  onRemove?: (() => void) | undefined;
  removeLabel: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="m-0 min-w-0 border border-ink p-3 sm:col-span-2">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">{children}</div>
      {onRemove ? (
        <button type="button" onClick={onRemove} className={`${SMALL_BUTTON} mt-3`}>
          {removeLabel}
        </button>
      ) : null}
    </fieldset>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <div className="sm:col-span-2">
      <button type="button" onClick={onClick} className={SMALL_BUTTON}>
        {children}
      </button>
    </div>
  );
}

export function OfferEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: OfferDraft;
  onSave: (offer: Offer) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [attempts, setAttempts] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryId = useId();

  // After the first failed save, errors follow the draft so they clear as you fix them.
  const errors: DraftErrors = attempts > 0 ? validateDraft(draft).errors : {};
  const errorCount = Object.keys(errors).length;

  useEffect(() => {
    if (attempts === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [attempts]);

  const set = (patch: Partial<OfferDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setPlan = (id: string, patch: Partial<PlanDraft>) =>
    setDraft((d) => ({ ...d, plans: d.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const setTier = (key: string, patch: Partial<TierDraft>) =>
    setDraft((d) => ({
      ...d,
      tiers: d.tiers.map((t) => (t.key === key ? { ...t, ...patch } : t)),
    }));
  const setStep = (key: string, patch: Partial<StepDraft>) =>
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    }));
  const removePlan = (id: string) =>
    setDraft((d) => {
      const plans = d.plans.filter((p) => p.id !== id);
      const defaultPlanId = d.defaultPlanId === id ? (plans[0]?.id ?? "") : d.defaultPlanId;
      return { ...d, plans, defaultPlanId };
    });

  const save = () => {
    const { offer } = validateDraft(draft);
    if (offer) onSave(offer);
    else setAttempts((n) => n + 1);
  };

  const planLabel = (p: PlanDraft, i: number) => p.name.trim() || `Plan ${i + 1}`;

  return (
    <form
      ref={formRef}
      noValidate
      aria-describedby={errorCount > 0 ? summaryId : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p className="m-0 text-sm text-ink-soft">
        Type what the offer letter says. Amounts are yearly; the stub updates when you save.
      </p>

      <Section title="The job">
        <TextField
          label="Employer"
          numeric={false}
          value={draft.employer}
          onChange={(employer) => set({ employer })}
          error={errors["employer"]}
        />
        <TextField
          label="City"
          numeric={false}
          value={draft.city}
          onChange={(city) => set({ city })}
          error={errors["city"]}
        />
        <SelectField
          label="State"
          value={draft.state}
          options={STATES}
          onChange={(state) => set({ state })}
        />
        {draft.state === "OTHER" ? (
          <TextField
            label="State income tax rate"
            suffix="%"
            value={draft.customStatePct}
            onChange={(customStatePct) => set({ customStatePct })}
            error={errors["customStatePct"]}
          />
        ) : null}
        <TextField
          label="Yearly salary"
          prefix="$"
          value={draft.salary}
          onChange={(salary) => set({ salary })}
          error={errors["salary"]}
        />
        <TextField
          label="Paychecks a year"
          value={draft.payPeriods}
          onChange={(payPeriods) => set({ payPeriods })}
          error={errors["payPeriods"]}
        />
      </Section>

      <Section title="401(k)">
        <TextField
          label="Default contribution"
          suffix="%"
          value={draft.defaultEmployeePct}
          onChange={(defaultEmployeePct) => set({ defaultEmployeePct })}
          error={errors["defaultEmployeePct"]}
        />
        <SelectField
          label="Roth 401(k) offered"
          value={draft.rothAvailable ? "yes" : "no"}
          options={YES_NO}
          onChange={(v) => set({ rothAvailable: v === "yes" })}
        />
        {draft.tiers.length === 0 ? (
          <p className="m-0 text-sm text-ink-soft sm:col-span-2">
            No employer match. Add a tier if the letter promises one.
          </p>
        ) : null}
        {draft.tiers.map((t, i) => (
          <Group
            key={t.key}
            title={`Match tier ${i + 1}`}
            removeLabel={`Remove match tier ${i + 1}`}
            onRemove={() => set({ tiers: draft.tiers.filter((x) => x.key !== t.key) })}
          >
            <TextField
              label="Employer match rate"
              suffix="%"
              value={t.ratePct}
              onChange={(ratePct) => setTier(t.key, { ratePct })}
              error={errors[`tier.${t.key}.ratePct`]}
            />
            <TextField
              label="On pay up to"
              suffix="%"
              value={t.upToPct}
              onChange={(upToPct) => setTier(t.key, { upToPct })}
              error={errors[`tier.${t.key}.upToPct`]}
            />
          </Group>
        ))}
        <AddButton onClick={() => set({ tiers: [...draft.tiers, blankTier()] })}>
          Add match tier
        </AddButton>
        <SelectField
          label="The match vests"
          value={draft.vestingType}
          options={VESTING}
          onChange={(vestingType) =>
            set({
              vestingType,
              steps:
                vestingType === "graded" && draft.steps.length === 0 ? [blankStep()] : draft.steps,
            })
          }
        />
        {draft.vestingType === "cliff" ? (
          <TextField
            label="Years until it vests"
            value={draft.cliffYears}
            onChange={(cliffYears) => set({ cliffYears })}
            error={errors["cliffYears"]}
          />
        ) : null}
        {draft.vestingType === "graded" ? (
          <>
            {errors["steps"] ? (
              <p className="m-0 text-xs text-correction sm:col-span-2">{errors["steps"]}</p>
            ) : null}
            {draft.steps.map((s, i) => (
              <Group
                key={s.key}
                title={`Vesting step ${i + 1}`}
                removeLabel={`Remove vesting step ${i + 1}`}
                onRemove={() => set({ steps: draft.steps.filter((x) => x.key !== s.key) })}
              >
                <TextField
                  label="After years"
                  value={s.year}
                  onChange={(year) => setStep(s.key, { year })}
                  error={errors[`step.${s.key}.year`]}
                />
                <TextField
                  label="Share vested"
                  suffix="%"
                  value={s.pct}
                  onChange={(pct) => setStep(s.key, { pct })}
                  error={errors[`step.${s.key}.pct`]}
                />
              </Group>
            ))}
            <AddButton onClick={() => set({ steps: [...draft.steps, blankStep()] })}>
              Add vesting step
            </AddButton>
          </>
        ) : null}
      </Section>

      <Section title="Health plans">
        {draft.plans.map((p, i) => (
          <Group
            key={p.id}
            title={planLabel(p, i)}
            removeLabel={`Remove ${planLabel(p, i)}`}
            onRemove={draft.plans.length > 1 ? () => removePlan(p.id) : undefined}
          >
            <TextField
              label="Plan name"
              numeric={false}
              value={p.name}
              onChange={(name) => setPlan(p.id, { name })}
              error={errors[`plan.${p.id}.name`]}
            />
            <TextField
              label="Your premium per year"
              prefix="$"
              value={p.premium}
              onChange={(premium) => setPlan(p.id, { premium })}
              error={errors[`plan.${p.id}.premium`]}
            />
            <TextField
              label="Deductible"
              prefix="$"
              value={p.deductible}
              onChange={(deductible) => setPlan(p.id, { deductible })}
              error={errors[`plan.${p.id}.deductible`]}
            />
            <TextField
              label="Your share after the deductible"
              suffix="%"
              value={p.coinsurancePct}
              onChange={(coinsurancePct) => setPlan(p.id, { coinsurancePct })}
              error={errors[`plan.${p.id}.coinsurancePct`]}
            />
            <TextField
              label="Out-of-pocket max"
              prefix="$"
              value={p.oopMax}
              onChange={(oopMax) => setPlan(p.id, { oopMax })}
              error={errors[`plan.${p.id}.oopMax`]}
            />
            <SelectField
              label="Works with an HSA"
              value={p.hsaEligible ? "yes" : "no"}
              options={YES_NO}
              onChange={(v) => setPlan(p.id, { hsaEligible: v === "yes" })}
            />
            {p.hsaEligible ? (
              <TextField
                label="Employer HSA deposit"
                prefix="$"
                value={p.employerHsa}
                onChange={(employerHsa) => setPlan(p.id, { employerHsa })}
                error={errors[`plan.${p.id}.employerHsa`]}
              />
            ) : null}
          </Group>
        ))}
        <AddButton
          onClick={() => {
            const plan = blankPlan();
            setDraft((d) => ({ ...d, plans: [...d.plans, plan] }));
          }}
        >
          Add health plan
        </AddButton>
        <SelectField
          label="Plan you get if you elect nothing"
          value={draft.defaultPlanId}
          options={draft.plans.map((p, i) => ({ value: p.id, label: planLabel(p, i) }))}
          onChange={(defaultPlanId) => set({ defaultPlanId })}
          error={errors["defaultPlanId"]}
        />
      </Section>

      <Section title="Life insurance">
        <TextField
          label="Free coverage, times salary"
          suffix="×"
          value={draft.basicMultiple}
          onChange={(basicMultiple) => set({ basicMultiple })}
          error={errors["basicMultiple"]}
        />
        <TextField
          label="Extra you can buy, times salary"
          suffix="×"
          value={draft.supplementalMaxMultiple}
          onChange={(supplementalMaxMultiple) => set({ supplementalMaxMultiple })}
          error={errors["supplementalMaxMultiple"]}
        />
      </Section>

      <div className="mt-6 border-t-2 border-ink pt-4">
        {errorCount > 0 ? (
          <p id={summaryId} role="alert" className="m-0 mb-3 text-correction">
            {errorCount === 1
              ? "Fix the field marked in red, then save the offer."
              : `Fix the ${errorCount} fields marked in red, then save the offer.`}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="h-10 border border-ink bg-ink px-4 font-semibold text-stub underline-offset-3 hover:underline"
          >
            Save offer
          </button>
          <button type="button" onClick={onCancel} className={SMALL_BUTTON}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
