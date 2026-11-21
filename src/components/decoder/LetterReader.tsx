/**
 * The "Upload offer letter" panel (harness/DESIGN.md "AI elements"), set like an inbox tray
 * inside the stub: paste the letter's text or drop a .txt, PDF, or Word file (its text is
 * pulled out in the browser, src/lib/letterFile.ts), then the reader fills a
 * review draft for the editor. When it can read nothing, the panel says so and opens no
 * form; it never fakes success. On the mock client a note says it only reads the samples.
 */
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import cascadeLetter from "@/data/letters/cascade.txt?raw";
import lakeshoreLetter from "@/data/letters/lakeshore.txt?raw";
import northfieldLetter from "@/data/letters/northfield.txt?raw";
import { AIError } from "@/lib/ai";
import { LETTER_FILE_ACCEPT, LetterFileError, readLetterFile } from "@/lib/letterFile";
import { useAIClient } from "@/state/AIClientContext";
import { draftFromLetter, type LetterReview } from "./letterDraft";

/** The edge function's limit (supabase/functions/_shared/decodeOffer.ts MAX_LETTER_CHARS). */
export const MAX_LETTER_CHARS = 40_000;

export const READER_COPY = {
  sampleNote: "Sample reader: works on the three sample letters until the AI is connected.",
  empty: "The letter is empty. Paste its text or drop the letter's file.",
  long: "This letter is too long to read. Paste only the offer and benefits sections.",
  nothingFound:
    "Nothing in this text reads as an offer letter. Paste the letter itself, or fill in the offer by hand.",
  failed: "The letter couldn't be read. Read it again, or fill in the offer by hand.",
  reading: "Reading the letter…",
  opening: "Opening the file…",
} as const;

const SAMPLE_LETTERS = [
  { name: "Northfield Health", text: northfieldLetter },
  { name: "Lakeshore Systems", text: lakeshoreLetter },
  { name: "Cascade Robotics", text: cascadeLetter },
];

const BUTTON = "h-10 border border-ink bg-stub px-3 font-semibold disabled:text-ink-soft";

export function LetterReader({
  slot,
  onRead,
  onCancel,
}: {
  slot: 0 | 1;
  onRead: (review: LetterReview) => void;
  onCancel: () => void;
}) {
  const client = useAIClient();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const textId = useId();
  const fileId = useId();
  const errorId = useId();
  const headingId = useId();
  const samplesId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    textRef.current?.focus();
    return () => abort.current?.abort();
  }, []);

  const loadFile = async (file: File | undefined) => {
    if (!file || opening) return;
    setOpening(true);
    try {
      setText(await readLetterFile(file));
      setError(null);
    } catch (e) {
      setError(e instanceof LetterFileError ? e.message : READER_COPY.failed);
    } finally {
      setOpening(false);
    }
  };

  const read = async () => {
    if (busy || opening) return;
    if (!text.trim()) return setError(READER_COPY.empty);
    if (text.length > MAX_LETTER_CHARS) return setError(READER_COPY.long);
    setError(null);
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const { fields } = await client.extractOffer({ text }, controller.signal);
      if (controller.signal.aborted) return;
      const review = draftFromLetter(fields, slot);
      if (review) return onRead(review);
      // Nothing came from the letter. The mock's note says it reads only the samples.
      const notes = new Set(
        Object.values(fields).map((f) => (f.source === "missing" ? f.note : "")),
      );
      const [only] = [...notes];
      setError(notes.size === 1 && only ? only : READER_COPY.nothingFound);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof AIError ? e.message : READER_COPY.failed);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    e.preventDefault();
    void loadFile(file);
  };

  return (
    <section aria-labelledby={headingId} className="border border-ink border-t-2 p-3 sm:p-4">
      <h3 id={headingId} className="m-0 text-base font-semibold">
        Upload offer letter
      </h3>
      <p className="m-0 mt-1 text-sm text-ink-soft">
        The reader fills this stub with what the letter states, and you check it before saving.
      </p>
      {client.kind === "mock" ? <p className="m-0 mt-2 text-sm">{READER_COPY.sampleNote}</p> : null}

      <form
        noValidate
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void read();
        }}
      >
        <label htmlFor={textId} className="text-xs text-ink-soft">
          Letter text (paste it, or drop a .txt, PDF, or Word file here)
        </label>
        <textarea
          id={textId}
          ref={textRef}
          rows={8}
          value={text}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setText(e.target.value)}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDrop={onDrop}
          className={[
            "block w-full min-w-0 resize-y border bg-stub p-2 text-carbon",
            error ? "border-correction border-b-2" : "border-ink",
          ].join(" ")}
        />

        <div className="mt-3 flex min-w-0 flex-col">
          <label htmlFor={fileId} className="text-xs text-ink-soft">
            Or choose a file (.txt, PDF, or Word)
          </label>
          <input
            id={fileId}
            type="file"
            accept={LETTER_FILE_ACCEPT}
            disabled={opening}
            onChange={(e) => {
              void loadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
            className="mt-1 w-full min-w-0 text-sm file:mr-3 file:h-10 file:border file:border-solid file:border-ink file:bg-stub file:px-3 file:font-semibold file:text-ink"
          />
        </div>

        <div className="mt-3" role="group" aria-labelledby={samplesId}>
          <p id={samplesId} className="m-0 text-xs text-ink-soft">
            Or paste a sample letter
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {SAMPLE_LETTERS.map((l) => (
              <button
                key={l.name}
                type="button"
                className={BUTTON}
                onClick={() => {
                  setText(l.text);
                  setError(null);
                }}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p id={errorId} role="alert" className="m-0 mt-3 text-correction">
            {error}
          </p>
        ) : null}
        <p role="status" className="m-0 text-sm text-ink-soft">
          {busy || opening ? (
            <span className="mt-3 block">{busy ? READER_COPY.reading : READER_COPY.opening}</span>
          ) : null}
        </p>

        <div className="mt-4 flex flex-wrap gap-3 border-t-2 border-ink pt-4">
          <button
            type="submit"
            disabled={busy || opening}
            className="h-10 border border-ink bg-ink px-4 font-semibold text-stub underline-offset-3 hover:underline disabled:bg-ink-soft"
          >
            Upload offer letter
          </button>
          <button type="button" onClick={onCancel} className={BUTTON}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
