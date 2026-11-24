/**
 * The back of the stub: the day-one checklist for the offer chosen with the tabs
 * (harness/DESIGN.md "Back of the stub"). Real checkboxes; what you tick is kept in memory
 * only and shows in carbon, since it is your input. The engine picks the items; the words
 * come from checklistText.
 */
import { useId, useState, type KeyboardEvent } from "react";
import type { OfferSlot } from "@/state/decoderState";
import { useDecoder } from "@/state/DecoderContext";
import { checklistItems } from "./checklistText";
import { memoName } from "./memoText";

export function Checklist() {
  const { state, view } = useDecoder();
  const baseId = useId();
  const [selected, setSelected] = useState<OfferSlot>(0);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  const slots = view.stubs.filter((s) => s.offer).map((s) => s.slot);
  const current: OfferSlot | undefined = slots.includes(selected) ? selected : slots[0];

  let names = view.stubs.map((s) => memoName(s.offer?.employer, s.slot));
  if (names[0] === names[1]) names = names.map((n, i) => `${n} (offer ${i + 1})`);

  const tabId = (slot: OfferSlot) => `${baseId}-tab-${slot}`;
  const panelId = `${baseId}-panel`;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (current === undefined || slots.length < 2) return;
    const i = slots.indexOf(current);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % slots.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + slots.length) % slots.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = slots.length - 1;
    if (next === null) return;
    e.preventDefault();
    const slot = slots[next]!;
    setSelected(slot);
    document.getElementById(tabId(slot))?.focus();
  };

  const stub = current === undefined ? undefined : view.stubs[current];

  return (
    <section aria-labelledby={`${baseId}-heading`} className="border-t border-ink pt-6 pb-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 id={`${baseId}-heading`} className="m-0">
          Back of the stub: what to elect on day one
        </h2>
        {slots.length > 0 && (
          <div role="tablist" aria-label="Checklist for offer" className="flex w-full sm:w-auto">
            {slots.map((slot, i) => {
              const on = slot === current;
              return (
                <button
                  key={slot}
                  id={tabId(slot)}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={panelId}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setSelected(slot)}
                  onKeyDown={onKeyDown}
                  className={[
                    "min-h-10 min-w-0 flex-1 border border-ink px-3 py-1 leading-tight sm:flex-none",
                    i > 0 ? "-ml-px" : "",
                    on ? "border-carbon bg-carbon font-semibold text-stub" : "bg-stub text-ink",
                  ].join(" ")}
                >
                  {names[slot]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!stub || !stub.offer ? (
        <p className="m-0 max-w-prose">
          Add an offer or load a sample to see what to elect on day one.
        </p>
      ) : (
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId(stub.slot)}
          className="border border-ink bg-stub p-4 md:p-6"
        >
          {stub.error || !stub.result ? (
            <p className="m-0 max-w-prose text-correction">
              {stub.error ?? "Fix this offer to see its checklist."}
            </p>
          ) : (
            <ul className="m-0 flex max-w-prose list-none flex-col gap-3 p-0">
              {checklistItems(stub.offer, stub.result, state.profile).map((item) => {
                const key = `${state.sampleId ?? "custom"}:${stub.slot}:${stub.offer!.id}:${item.id}`;
                const on = !!ticked[key];
                return (
                  <li key={item.id} data-checklist-id={item.id}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => setTicked((t) => ({ ...t, [key]: e.target.checked }))}
                        className="mt-1 size-5 shrink-0 accent-carbon"
                      />
                      <span className={on ? "text-carbon" : undefined}>{item.text}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
