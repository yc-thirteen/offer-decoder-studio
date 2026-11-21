/**
 * "Plain-English summary" under the memo line (DESIGN.md "AI elements": Explain my stub).
 * The request holds only engine numbers for the current elections; the client words them.
 * On the mock client the template runs on every change, since it costs nothing. On the
 * HTTP client each summary is a paid model call, so it waits for "Write plain-English
 * summary", and any change to the offers, profile, or elections clears the old summary.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AIError } from "@/lib/ai";
import { useAIClient } from "@/state/AIClientContext";
import { useDecoder } from "@/state/DecoderContext";
import { SUMMARY_COPY, summaryRequest } from "./summaryText";

type Status =
  | { key: string; kind: "writing" }
  | { key: string; kind: "done"; text: string }
  | { key: string; kind: "error"; message: string };

const BUTTON = "h-10 border border-ink bg-stub px-3 font-semibold disabled:text-ink-soft";

export function PlainSummary() {
  const { state, view } = useDecoder();
  const client = useAIClient();
  const headingId = useId();
  const request = useMemo(
    () => summaryRequest(view, state.electionsMode),
    [view, state.electionsMode],
  );
  const key = request ? JSON.stringify(request) : null;
  const [status, setStatus] = useState<Status | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const auto = client.kind === "mock";

  const write = useCallback(() => {
    if (!request || !key) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // The mock answers within a tick, so it keeps the last summary up instead of flashing.
    if (!auto) setStatus({ key, kind: "writing" });
    client.explainStub(request, controller.signal).then(
      (res) => {
        if (!controller.signal.aborted) setStatus({ key, kind: "done", text: res.summary });
      },
      (e: unknown) => {
        if (controller.signal.aborted) return;
        const message = e instanceof AIError ? e.message : SUMMARY_COPY.failed;
        setStatus({ key, kind: "error", message });
      },
    );
  }, [client, request, key, auto]);
  const writeRef = useRef(write);
  writeRef.current = write;

  // Only a new request (not a re-render or the per-paycheck toggle) makes a summary stale.
  // The mock writes the new one at once; an HTTP call in flight is cancelled.
  useEffect(() => {
    if (auto && key) writeRef.current();
    return () => abortRef.current?.abort();
  }, [auto, key]);

  if (!request) return null;
  const current = status?.key === key || (auto && status?.kind === "done") ? status : null;

  return (
    <section aria-labelledby={headingId} className="mt-6 max-w-prose" data-testid="plain-summary">
      <h2 id={headingId} className="m-0 text-[15px] font-semibold leading-normal">
        {SUMMARY_COPY.heading}
      </h2>
      <div aria-live={auto ? undefined : "polite"}>
        {current?.kind === "done" ? (
          <p className="m-0 mt-1">{current.text}</p>
        ) : current?.kind === "writing" ? (
          <p className="m-0 mt-1 text-ink-soft">{SUMMARY_COPY.writing}</p>
        ) : !auto && !current ? (
          <p className="m-0 mt-1 text-ink-soft">{SUMMARY_COPY.prompt}</p>
        ) : null}
      </div>
      {current?.kind === "error" ? (
        <p role="alert" className="m-0 mt-1 text-correction">
          {current.message}
        </p>
      ) : null}
      {!auto && current?.kind !== "done" ? (
        <button
          type="button"
          className={`${BUTTON} mt-3`}
          onClick={write}
          disabled={current?.kind === "writing"}
        >
          {SUMMARY_COPY.write}
        </button>
      ) : null}
      {auto ? (
        <p className="m-0 mt-2 text-[15px] text-ink-soft">{SUMMARY_COPY.sampleNote}</p>
      ) : null}
    </section>
  );
}
