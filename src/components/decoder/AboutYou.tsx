/**
 * "About you": the profile, set like the employee information block on a pay stub.
 * One compact row of labeled fields (labels above, 13px ink-soft). Every change goes
 * straight to the store, so the stubs recompute as you type. Below md the fields
 * collapse behind a "Change your details" disclosure with a one-line summary.
 *
 * Head of household isn't offered (FINANCE_SPEC: the lectures don't give its standard
 * deduction), and a note under Filing says so. Its link to the Method page's
 * simplifications comes in through `simplificationsLink`, the way DecoderHeader takes
 * `nav`, so the component stays router-free; without one it falls back to a plain link.
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import type { CoverageTier, FilingStatus, Profile } from "@/lib/engine";
import { groupDigits, parseAge, parseDollars, profileSummary } from "./profileFormat";
import { useDecoder } from "@/state/DecoderContext";
import { LINK_CLASS, SIMPLIFICATIONS_HREF, SIMPLIFICATIONS_LINK_TEXT } from "./simplificationsLink";

const CONTROL = "h-10 border border-ink bg-stub px-2";
const ERROR_ID = (id: string) => `${id}-error`;
const NOTE_ID = (id: string) => `${id}-note`;

function Field({
  id,
  label,
  error,
  note,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start">
      <label htmlFor={id} className="text-xs text-ink-soft">
        {label}
      </label>
      {children}
      {note ? (
        <p id={NOTE_ID(id)} className="m-0 max-w-[14rem] pt-1 text-xs text-ink-soft">
          {note}
        </p>
      ) : null}
      {error ? (
        <p id={ERROR_ID(id)} className="m-0 max-w-[16rem] pt-1 text-xs text-correction">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  note,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  note?: ReactNode;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} note={note}>
      <select
        id={id}
        value={value}
        aria-describedby={note ? NOTE_ID(id) : undefined}
        onChange={(e) => onChange(e.target.value as T)}
        className={CONTROL}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <SelectField
      label={label}
      value={value ? "yes" : "no"}
      options={[...YES_NO]}
      onChange={(v) => onChange(v === "yes")}
    />
  );
}

/**
 * A text field that keeps its own draft so typing never fights the store. Valid drafts
 * commit on every keystroke; an invalid draft shows a directive error and leaves the
 * last good value in the store until fixed.
 */
function DraftField({
  label,
  value,
  format,
  parse,
  error,
  prefix,
  onCommit,
  width,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  parse: (s: string) => number | null;
  error: string;
  prefix?: string;
  onCommit: (n: number) => void;
  width: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(() => format(value));
  const [invalid, setInvalid] = useState(false);
  // Follow the store when something else changes it (loading a sample).
  useEffect(() => {
    setDraft((d) => (parse(d) === value ? d : format(value)));
    setInvalid(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the stored value
  }, [value]);

  return (
    <Field id={id} label={label} error={invalid ? error : null}>
      <div
        className={[
          "flex h-10 items-center border bg-stub",
          invalid ? "border-correction border-b-2" : "border-ink",
          width,
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
          inputMode="numeric"
          autoComplete="off"
          value={draft}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? ERROR_ID(id) : undefined}
          onChange={(e) => {
            const text = e.target.value;
            setDraft(text);
            const n = parse(text);
            setInvalid(n === null);
            if (n !== null && n !== value) onCommit(n);
          }}
          onBlur={() => {
            const n = parse(draft);
            if (n !== null) setDraft(format(n));
          }}
          className="amount h-full w-full min-w-0 border-0 bg-transparent px-2"
        />
      </div>
    </Field>
  );
}

function MoneyField(props: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  error: string;
}) {
  return (
    <DraftField {...props} prefix="$" format={groupDigits} parse={parseDollars} width="w-36" />
  );
}

const FILING: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "mfj", label: "Married filing jointly" },
];
const COVERAGE: { value: CoverageTier; label: string }[] = [
  { value: "self", label: "Just me" },
  { value: "family", label: "My family" },
];

export function AboutYou({ simplificationsLink }: { simplificationsLink?: ReactNode } = {}) {
  const { state, dispatch } = useDecoder();
  const p = state.profile;
  const set = (patch: Partial<Profile>) => dispatch({ type: "setProfile", patch });
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="border-b border-ink py-4 md:flex md:items-start md:gap-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 md:block md:w-24 md:shrink-0 md:pt-6">
        <h2 id={headingId} className="m-0 text-base font-semibold">
          About you
        </h2>
        <p className="m-0 min-w-0 text-sm text-ink-soft md:hidden">{profileSummary(p)}</p>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="mt-2 h-10 border border-ink bg-stub px-4 font-semibold md:hidden"
      >
        {open ? "Hide your details" : "Change your details"}
      </button>
      <div
        id={panelId}
        className={[
          open ? "flex" : "hidden",
          "mt-3 flex-wrap items-start gap-x-5 gap-y-3 md:mt-0 md:flex md:flex-1",
        ].join(" ")}
      >
        <SelectField
          label="Filing"
          value={p.filingStatus}
          options={FILING}
          onChange={(filingStatus) => set({ filingStatus })}
          note={
            <>
              Head of household isn't supported.{" "}
              {simplificationsLink ?? (
                <a href={SIMPLIFICATIONS_HREF} className={LINK_CLASS}>
                  {SIMPLIFICATIONS_LINK_TEXT}
                </a>
              )}
            </>
          }
        />
        {p.filingStatus === "mfj" ? (
          <MoneyField
            label="Spouse's wages"
            value={p.otherHouseholdWages}
            onCommit={(otherHouseholdWages) => set({ otherHouseholdWages })}
            error="Type your spouse's yearly wages in dollars, or 0."
          />
        ) : null}
        <SelectField
          label="Coverage"
          value={p.coverage}
          options={COVERAGE}
          onChange={(coverage) => set({ coverage })}
        />
        <MoneyField
          label="Medical spending this year"
          value={p.expectedMedicalSpend}
          onCommit={(expectedMedicalSpend) => set({ expectedMedicalSpend })}
          error="Type your expected medical bills in dollars, or 0."
        />
        <YesNoField
          label="Emergency fund"
          value={p.hasEmergencyFund}
          onChange={(hasEmergencyFund) => set({ hasEmergencyFund })}
        />
        <YesNoField
          label="High-interest debt"
          value={p.hasHighInterestDebt}
          onChange={(hasHighInterestDebt) => set({ hasHighInterestDebt })}
        />
        <YesNoField
          label="Someone depends on my income"
          value={p.hasDependents}
          onChange={(hasDependents) => set({ hasDependents })}
        />
        <DraftField
          label="Age"
          value={p.age}
          format={String}
          parse={parseAge}
          onCommit={(age) => set({ age })}
          error="Type your age in whole years, 16 to 100."
          width="w-20"
        />
        <MoneyField
          label="Current savings"
          value={p.currentSavings}
          onCommit={(currentSavings) => set({ currentSavings })}
          error="Type your savings in dollars, or 0."
        />
      </div>
    </section>
  );
}
