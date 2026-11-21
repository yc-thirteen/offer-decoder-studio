/**
 * The decoder's header and controls row, set like the employer block on a pay stub:
 * brand left, "Pay period: your first year" right, a 2px ink rule beneath, then the
 * sample picker, the Annual/Per paycheck toggle, and the recommended switch.
 */
import { useEffect, useId, useState } from "react";
import { SAMPLE_CASES, type PeriodMode } from "@/state/decoderState";
import { useDecoder } from "@/state/DecoderContext";

const PERIODS: { mode: PeriodMode; label: string }[] = [
  { mode: "annual", label: "Annual" },
  { mode: "perPaycheck", label: "Per paycheck" },
];

export function DecoderHeader() {
  return (
    <header className="border-b-2 border-ink pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="m-0 text-xl font-extrabold">Offer Decoder</p>
        <p className="m-0 text-sm text-ink-soft">Pay period: your first year</p>
      </div>
    </header>
  );
}

export function SamplePicker() {
  const { state, dispatch } = useDecoder();
  const selectId = useId();
  const [choice, setChoice] = useState(state.sampleId ?? SAMPLE_CASES[0]?.id ?? "");
  // Follow the store when something else loads a sample; keep the choice after "Clear offers".
  useEffect(() => {
    if (state.sampleId) setChoice(state.sampleId);
  }, [state.sampleId]);

  return (
    <form
      className="flex w-full min-w-0 items-end gap-2 sm:w-auto"
      onSubmit={(e) => {
        e.preventDefault();
        if (choice) dispatch({ type: "loadSample", sampleId: choice });
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <label htmlFor={selectId} className="text-xs text-ink-soft">
          Load a sample
        </label>
        <select
          id={selectId}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="h-10 w-full min-w-0 border border-ink px-2 sm:w-96 lg:w-64"
        >
          {SAMPLE_CASES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="h-10 shrink-0 border border-ink bg-ink px-4 font-semibold text-stub underline-offset-3 hover:underline"
      >
        Load sample
      </button>
    </form>
  );
}

/**
 * Empties both stubs and forgets the sample (the profile stays). Always enabled, so focus
 * never drops to the page when it empties; the memo line announces the empty state.
 */
export function ClearOffersButton() {
  const { dispatch } = useDecoder();
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "clearOffers" })}
      className="h-10 shrink-0 self-end border border-ink bg-stub px-4 font-semibold underline-offset-3 hover:underline"
    >
      Clear offers
    </button>
  );
}

export function PeriodToggle() {
  const { state, dispatch } = useDecoder();
  const name = useId();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
      <legend className="p-0 text-xs text-ink-soft">Show amounts</legend>
      <div className="flex">
        {PERIODS.map(({ mode, label }, i) => {
          const on = state.periodMode === mode;
          return (
            <label
              key={mode}
              className={[
                "flex h-10 cursor-pointer items-center border border-ink px-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-carbon",
                i > 0 ? "-ml-px" : "",
                on ? "bg-carbon border-carbon text-stub font-semibold" : "bg-stub",
              ].join(" ")}
            >
              <input
                type="radio"
                name={name}
                value={mode}
                checked={on}
                onChange={() => dispatch({ type: "setPeriodMode", mode })}
                className="sr-only"
              />
              {label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function RecommendedSwitch() {
  const { state, dispatch } = useDecoder();
  const on = state.electionsMode === "recommended";
  return (
    <label className="flex h-10 cursor-pointer items-center gap-2 self-end">
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) =>
          dispatch({
            type: "setElectionsMode",
            mode: e.target.checked ? "recommended" : "default",
          })
        }
        className="size-5 accent-carbon"
      />
      <span className={on ? "font-semibold text-carbon" : undefined}>
        Use recommended elections
      </span>
    </label>
  );
}

export function DecoderControls() {
  return (
    <div
      role="group"
      aria-label="Decoder controls"
      className="flex flex-wrap items-end gap-x-6 gap-y-3 py-4 lg:gap-x-5"
    >
      <SamplePicker />
      <ClearOffersButton />
      <PeriodToggle />
      <RecommendedSwitch />
    </div>
  );
}
