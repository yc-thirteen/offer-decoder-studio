/**
 * The memo line under the stubs, set like the memo line of a check: "Memo:" and the
 * sentence sitting on a 1px ink underline. It is the page's punchline, so it gets room.
 * The plain-English summary sits under it.
 */
import { useDecoder } from "@/state/DecoderContext";
import { memoText } from "./memoText";
import { PlainSummary } from "./PlainSummary";

export function MemoLine() {
  const { state, view } = useDecoder();
  const text = memoText(view, state.electionsMode);
  return (
    <section aria-label="Memo" className="mt-10 mb-12 max-w-prose">
      <p
        className="m-0 flex items-baseline gap-x-3 text-xl md:text-2xl"
        aria-live="polite"
        data-testid="memo-line"
      >
        <span className="shrink-0 font-semibold">Memo:</span>
        <span className="min-w-0 flex-1 border-b border-ink pb-1 font-semibold">{text}</span>
      </p>
      <PlainSummary />
    </section>
  );
}
