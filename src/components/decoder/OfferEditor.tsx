/**
 * Edit offer mode: the stub's lines become inline fields, typed in carbon like a carbon copy.
 * Health plans and match tiers can be added and removed, vesting picks its type, and "Save
 * offer" validates the draft (offerDraft.ts). Errors appear under each field in correction
 * red, state the fix, and focus moves to the first one. Nothing reaches the store until the
 * draft is valid. Opened from "Read offer letter", it is the review state: fields the letter
 * filled carry a carbon "from letter" marker until edited or saved, and fields it left blank
 * are underlined in correction red with the reader's note on what is missing.
 */
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { NO_MARKS, markCounts, touchMarks, type LetterMarks } from "./letterDraft";

const CONTROL = "h-10 w-full min-w-0 border bg-stub px-2";
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

interface MarksValue {
  marks: LetterMarks;
  touch: (key: string) => void;
}
const MarksContext = createContext<MarksValue>({ marks: NO_MARKS, touch: () => {} });

/** A field's review marks: the "from letter" marker, or the note on what the letter lacks. */
function useFieldMarks(name: string | undefined, id: string) {
  const { marks, touch } = useContext(MarksContext);
  const fromLetter = name !== undefined && marks.fromLetter.has(name);
  const missing = name !== undefined ? marks.missing[name] : undefined;
  return {
    fromLetter,
    missing,
    markId: `${id}-mark`,
    touch: () => {
      if (name !== undefined) touch(name);
    },
  };
}

/** Ids for aria-describedby: the error wins over the missing note; the marker always counts. */
function describedBy(
  id: string,
  error: string | undefined,
  m: ReturnType<typeof useFieldMarks>,
): string | undefined {
  const ids = [
    m.fromLetter ? m.markId : null,
    error ? `${id}-error` : m.missing ? `${id}-missing` : null,
  ].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function FieldShell({
  id,
  label,
  error,
  marks,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  marks: ReturnType<typeof useFieldMarks>;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={["flex min-w-0 flex-col", className].filter(Boolean).join(" ")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <label htmlFor={id} className="text-xs text-ink-soft">
          {label}
        </label>
        {marks.fromLetter ? (
          <span id={marks.markId} className="text-xs text-carbon">
            from letter
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="m-0 pt-1 text-xs text-correction">
          {error}
        </p>
      ) : marks.missing ? (
        <p id={`${id}-missing`} className="m-0 pt-1 text-xs text-correction">
          {marks.missing}
        </p>
      ) : null}
    </div>
  );
}

/** A red underline: a field with an error, or one the letter left blank. */
const flagged = (error: string | undefined, missing: string | undefined) =>
  error !== undefined || missing !== undefined;

function TextField({
  name,
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
  /** The draft field key, for review marks (same keys as the errors). */
  name?: string | undefined;
}) {
  const id = useId();
  const marks = useFieldMarks(name, id);
  return (
    <FieldShell id={id} label={label} error={error} marks={marks} className={className}>
      <div
        className={[
          "flex h-10 items-center border bg-stub",
          flagged(error, marks.missing) ? "border-correction border-b-2" : "border-ink",
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
          aria-describedby={describedBy(id, error, marks)}
          onChange={(e) => {
            marks.touch();
            onChange(e.target.value);
          }}
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
  name,
  label,
  value,
  options,
  onChange,
  error,
  placeholder,
  className,
}: {
  label: string;
  /** "" shows the placeholder until something is chosen. */
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  error?: string | undefined;
  /** Shown when nothing is chosen yet, e.g. "Choose a state". */
  placeholder?: string | undefined;
  className?: string | undefined;
  name?: string | undefined;
}) {
  const id = useId();
  const marks = useFieldMarks(name, id);
  return (
    <FieldShell id={id} label={label} error={error} marks={marks} className={className}>
      <select
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, marks)}
        onChange={(e) => {
          marks.touch();
          onChange(e.target.value as T);
        }}
        className={[
          CONTROL,
          flagged(error, marks.missing) ? "border-correction border-b-2" : "border-ink",
        ].join(" ")}
      >
        {value === "" ? (
          <option value="" disabled>
            {placeholder ?? "Choose one"}
          </option>
        ) : null}
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

/** The review state's opening sentence: what the reader filled and what is left to you. */
function reviewSentence({ filled, missing }: { filled: number; missing: number }): string {
  const marked = `Check the ${filled === 1 ? "field" : `${filled} fields`} marked "from letter"`;
  return missing === 0
    ? `${marked}, then save the offer.`
    : `${marked} and fill in what the letter left out, underlined in red. Then save the offer.`;
}

/** A section-level note from the letter reader (no match tiers, no plan details). */
function SectionNote({ name }: { name: string }) {
  const { marks } = useContext(MarksContext);
  const note = marks.missing[name];
  if (!note) return null;
  return (
    <p className="m-0 border-b-2 border-correction pb-1 text-sm text-correction sm:col-span-2">
      {note}
    </p>
  );
}

export function OfferEditor({
  initial,
  marks: initialMarks,
  onSave,
  onCancel,
}: {
  initial: OfferDraft;
  /** Present when the draft came from "Read offer letter": the review state. */
  marks?: LetterMarks | undefined;
  onSave: (offer: Offer) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [attempts, setAttempts] = useState(0);
  const [marks, setMarks] = useState<LetterMarks>(initialMarks ?? NO_MARKS);
  const formRef = useRef<HTMLFormElement>(null);
  const introRef = useRef<HTMLParagraphElement>(null);
  const summaryId = useId();
  const review = initialMarks !== undefined;
  const counts = markCounts(initialMarks ?? NO_MARKS);

  useEffect(() => {
    // Straight from the reader: start at the review sentence, not back at the top of the page.
    if (review) introRef.current?.focus();
  }, [review]);

  const touch = (key: string) => setMarks((m) => touchMarks(m, key));

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
      <MarksContext.Provider value={{ marks, touch }}>
        {review ? (
          <p ref={introRef} tabIndex={-1} className="m-0 text-sm">
            {reviewSentence(counts)}
          </p>
        ) : (
          <p className="m-0 text-sm text-ink-soft">
            Type what the offer letter says. Amounts are yearly; the stub updates when you save.
          </p>
        )}

        <Section title="The job">
          <TextField
            name={"employer"}
            label="Employer"
            numeric={false}
            value={draft.employer}
            onChange={(employer) => set({ employer })}
            error={errors["employer"]}
          />
          <TextField
            name={"city"}
            label="City"
            numeric={false}
            value={draft.city}
            onChange={(city) => set({ city })}
            error={errors["city"]}
          />
          <SelectField
            name="state"
            label="State"
            value={draft.state}
            options={STATES}
            placeholder="Choose a state"
            onChange={(state) => set({ state })}
            error={errors["state"]}
          />
          {draft.state === "OTHER" ? (
            <TextField
              name={"customStatePct"}
              label="State income tax rate"
              suffix="%"
              value={draft.customStatePct}
              onChange={(customStatePct) => set({ customStatePct })}
              error={errors["customStatePct"]}
            />
          ) : null}
          <TextField
            name={"salary"}
            label="Yearly salary"
            prefix="$"
            value={draft.salary}
            onChange={(salary) => set({ salary })}
            error={errors["salary"]}
          />
          <TextField
            name={"payPeriods"}
            label="Paychecks a year"
            value={draft.payPeriods}
            onChange={(payPeriods) => set({ payPeriods })}
            error={errors["payPeriods"]}
          />
        </Section>

        <Section title="401(k)">
          <TextField
            name={"defaultEmployeePct"}
            label="Default contribution"
            suffix="%"
            value={draft.defaultEmployeePct}
            onChange={(defaultEmployeePct) => set({ defaultEmployeePct })}
            error={errors["defaultEmployeePct"]}
          />
          <SelectField
            name="rothAvailable"
            label="Roth 401(k) offered"
            value={draft.rothAvailable === null ? "" : draft.rothAvailable ? "yes" : "no"}
            options={YES_NO}
            placeholder="Choose yes or no"
            onChange={(v) => set({ rothAvailable: v === "yes" })}
            error={errors["rothAvailable"]}
          />
          <SectionNote name="tiers" />
          {draft.tiers.length === 0 && !marks.missing["tiers"] ? (
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
                name={`tier.${t.key}.ratePct`}
                label="Employer match rate"
                suffix="%"
                value={t.ratePct}
                onChange={(ratePct) => setTier(t.key, { ratePct })}
                error={errors[`tier.${t.key}.ratePct`]}
              />
              <TextField
                name={`tier.${t.key}.upToPct`}
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
            name="vestingType"
            label="The match vests"
            value={draft.vestingType}
            options={VESTING}
            placeholder="Choose when it vests"
            error={errors["vestingType"]}
            onChange={(vestingType) =>
              set({
                vestingType,
                steps:
                  vestingType === "graded" && draft.steps.length === 0
                    ? [blankStep()]
                    : draft.steps,
              })
            }
          />
          {draft.vestingType === "cliff" ? (
            <TextField
              name={"cliffYears"}
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
                    name={`step.${s.key}.year`}
                    label="After years"
                    value={s.year}
                    onChange={(year) => setStep(s.key, { year })}
                    error={errors[`step.${s.key}.year`]}
                  />
                  <TextField
                    name={`step.${s.key}.pct`}
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
          <SectionNote name="plans" />
          {draft.plans.map((p, i) => (
            <Group
              key={p.id}
              title={planLabel(p, i)}
              removeLabel={`Remove ${planLabel(p, i)}`}
              onRemove={draft.plans.length > 1 ? () => removePlan(p.id) : undefined}
            >
              <TextField
                name={`plan.${p.id}.name`}
                label="Plan name"
                numeric={false}
                value={p.name}
                onChange={(name) => setPlan(p.id, { name })}
                error={errors[`plan.${p.id}.name`]}
              />
              <TextField
                name={`plan.${p.id}.premium`}
                label="Your premium per year"
                prefix="$"
                value={p.premium}
                onChange={(premium) => setPlan(p.id, { premium })}
                error={errors[`plan.${p.id}.premium`]}
              />
              <TextField
                name={`plan.${p.id}.deductible`}
                label="Deductible"
                prefix="$"
                value={p.deductible}
                onChange={(deductible) => setPlan(p.id, { deductible })}
                error={errors[`plan.${p.id}.deductible`]}
              />
              <TextField
                name={`plan.${p.id}.coinsurancePct`}
                label="Your share after the deductible"
                suffix="%"
                value={p.coinsurancePct}
                onChange={(coinsurancePct) => setPlan(p.id, { coinsurancePct })}
                error={errors[`plan.${p.id}.coinsurancePct`]}
              />
              <TextField
                name={`plan.${p.id}.oopMax`}
                label="Out-of-pocket max"
                prefix="$"
                value={p.oopMax}
                onChange={(oopMax) => setPlan(p.id, { oopMax })}
                error={errors[`plan.${p.id}.oopMax`]}
              />
              <SelectField
                name={`plan.${p.id}.hsaEligible`}
                label="Works with an HSA"
                value={p.hsaEligible ? "yes" : "no"}
                options={YES_NO}
                onChange={(v) => setPlan(p.id, { hsaEligible: v === "yes" })}
              />
              {p.hsaEligible ? (
                <TextField
                  name={`plan.${p.id}.employerHsa`}
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
            name={"defaultPlanId"}
            label="Plan you get if you elect nothing"
            placeholder="Choose a plan"
            value={draft.defaultPlanId}
            options={draft.plans.map((p, i) => ({ value: p.id, label: planLabel(p, i) }))}
            onChange={(defaultPlanId) => set({ defaultPlanId })}
            error={errors["defaultPlanId"]}
          />
        </Section>

        <Section title="Life insurance">
          <TextField
            name={"basicMultiple"}
            label="Free coverage, times salary"
            suffix="×"
            value={draft.basicMultiple}
            onChange={(basicMultiple) => set({ basicMultiple })}
            error={errors["basicMultiple"]}
          />
          <TextField
            name={"supplementalMaxMultiple"}
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
      </MarksContext.Provider>
    </form>
  );
}
