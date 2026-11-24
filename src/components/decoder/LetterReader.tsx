/** Read an offer letter and optional benefits guide into the existing review form. */
import { useEffect, useId, useRef, useState } from "react";
import cascadeLetter from "@/data/letters/cascade.txt?raw";
import lakeshoreLetter from "@/data/letters/lakeshore.txt?raw";
import northfieldLetter from "@/data/letters/northfield.txt?raw";
import sampleOffer from "@/data/documents/northfield-offer.txt?raw";
import sampleBenefits from "@/data/documents/northfield-benefits.txt?raw";
import { AIError } from "@/lib/ai";
import type { CoverageTier } from "@/lib/engine";
import { buildOfferDocumentText, DOCUMENT_ERRORS } from "@/lib/offerDocuments";
import { useAIClient } from "@/state/AIClientContext";
import { DocumentInput } from "./DocumentInput";
import { draftFromLetter, type LetterReview } from "./letterDraft";

export { MAX_LETTER_CHARS } from "@/lib/offerDocuments";
export const READER_COPY = {
  sampleNote: "Sample reader: works on the three sample letters until the AI is connected.",
  empty: DOCUMENT_ERRORS.empty,
  long: DOCUMENT_ERRORS.long,
  nothingFound: "No offer details were found. Check the documents or fill in the offer by hand.",
  failed: "The documents couldn't be read. Try again, or fill in the offer by hand.",
  reading: "Reading the documents…",
} as const;

const SAMPLE_LETTERS = [
  { name: "Northfield Health", text: northfieldLetter },
  { name: "Lakeshore Systems", text: lakeshoreLetter },
  { name: "Cascade Robotics", text: cascadeLetter },
];
const BUTTON = "h-10 border border-ink bg-stub px-3 font-semibold disabled:text-ink-soft";

export function LetterReader({
  slot,
  coverage = "self",
  onRead,
  onCancel,
}: {
  slot: 0 | 1;
  coverage?: CoverageTier;
  onRead: (review: LetterReview) => void;
  onCancel: () => void;
}) {
  const client = useAIClient();
  const [offerLetter, setOfferLetter] = useState("");
  const [benefitsGuide, setBenefitsGuide] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openingOffer, setOpeningOffer] = useState(false);
  const [openingBenefits, setOpeningBenefits] = useState(false);
  const [sampleVersion, setSampleVersion] = useState(0);
  const headingId = useId();
  const samplesId = useId();
  const abort = useRef<AbortController | null>(null);
  const opening = openingOffer || openingBenefits;

  // Changing coverage while reading must not apply costs for the old tier.
  useEffect(() => {
    abort.current?.abort();
    setBusy(false);
    return () => abort.current?.abort();
  }, [coverage]);

  const read = async () => {
    if (busy || opening) return;
    let text: string;
    try {
      text = buildOfferDocumentText({ offerLetter, benefitsGuide, coverage });
    } catch (e) {
      setError(e instanceof Error ? e.message : READER_COPY.failed);
      return;
    }
    setError(null);
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const { fields } = await client.extractOffer({ text }, controller.signal);
      if (controller.signal.aborted) return;
      const review = draftFromLetter(fields, slot);
      if (review) return onRead(review);
      const notes = new Set(
        Object.values(fields).map((f) => (f.source === "missing" ? f.note : "")),
      );
      const [only] = [...notes];
      setError(notes.size === 1 && only ? only : READER_COPY.nothingFound);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof AIError ? e.message : READER_COPY.failed);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <section aria-labelledby={headingId} className="border border-ink border-t-2 p-3 sm:p-4">
      <h3 id={headingId} className="m-0 text-base font-semibold">
        Upload offer documents
      </h3>
      <p className="m-0 mt-1 text-sm text-ink-soft">
        Add the offer letter and a benefits guide if you have one. Check the filled fields before
        saving.
      </p>
      <p className="m-0 mt-2 text-sm">
        Coverage: <strong>{coverage === "self" ? "employee only" : "family"}</strong>. The reader
        uses this tier for health-plan costs. Change it in About you before filling.
      </p>
      <p className="m-0 mt-2 text-sm text-ink-soft">
        Files are read in your browser. Only their text is sent to the reader when you choose Fill
        from documents.
      </p>
      {client.kind === "mock" && <p className="m-0 mt-2 text-sm">{READER_COPY.sampleNote}</p>}
      <form
        noValidate
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void read();
        }}
      >
        <div className="grid min-w-0 gap-4">
          <DocumentInput
            key={`offer-${sampleVersion}`}
            label="Offer letter"
            value={offerLetter}
            autoFocus
            disabled={busy}
            onChange={(text) => {
              setOfferLetter(text);
              setError(null);
            }}
            onOpeningChange={setOpeningOffer}
          />
          <DocumentInput
            key={`benefits-${sampleVersion}`}
            label="Benefits guide — optional"
            value={benefitsGuide}
            disabled={busy}
            onChange={(text) => {
              setBenefitsGuide(text);
              setError(null);
            }}
            onOpeningChange={setOpeningBenefits}
          />
        </div>
        <div className="mt-4" role="group" aria-labelledby={samplesId}>
          <p id={samplesId} className="m-0 text-xs text-ink-soft">
            Or try a sample letter (employee-only benefits)
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              className={BUTTON}
              disabled={busy || opening}
              onClick={() => {
                setOfferLetter(sampleOffer);
                setBenefitsGuide(sampleBenefits);
                setSampleVersion((v) => v + 1);
                setError(null);
              }}
            >
              Try two sample documents
            </button>
            {SAMPLE_LETTERS.map((letter) => (
              <button
                key={letter.name}
                type="button"
                className={BUTTON}
                disabled={busy || opening}
                onClick={() => {
                  setOfferLetter(letter.text);
                  setBenefitsGuide("");
                  setSampleVersion((v) => v + 1);
                  setError(null);
                }}
              >
                {letter.name}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p role="alert" className="m-0 mt-3 text-correction">
            {error}
          </p>
        )}
        <p role="status" className="m-0 text-sm text-ink-soft">
          {busy ? READER_COPY.reading : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 border-t-2 border-ink pt-4">
          <button
            type="submit"
            disabled={busy || opening}
            className="h-10 border border-ink bg-ink px-4 font-semibold text-stub disabled:bg-ink-soft"
          >
            Fill from documents
          </button>
          <button type="button" onClick={onCancel} className={BUTTON}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
