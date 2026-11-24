/** Shared document envelope. The HTTP contract stays { text: string }; older
 * callers can still send plain letter text. */
export const MAX_LETTER_CHARS = 40_000;
export const DOCUMENT_KIND = "offer-decoder-documents-v1";

export interface OfferDocuments {
  kind: typeof DOCUMENT_KIND;
  coverage: "self" | "family";
  offerLetter: string;
  benefitsGuide: string;
}

export const DOCUMENT_ERRORS = {
  empty: "Add an offer letter or benefits guide, or fill in the offer by hand.",
  long: "These documents are too long to read together. Paste only the offer and relevant benefits sections (up to 40,000 characters combined).",
} as const;

export function buildOfferDocumentText(input: Omit<OfferDocuments, "kind">): string {
  const offerLetter = input.offerLetter.trim();
  const benefitsGuide = input.benefitsGuide.trim();
  if (!offerLetter && !benefitsGuide) throw new Error(DOCUMENT_ERRORS.empty);
  const text = JSON.stringify({
    kind: DOCUMENT_KIND,
    coverage: input.coverage,
    offerLetter,
    benefitsGuide,
  });
  if (text.length > MAX_LETTER_CHARS) throw new Error(DOCUMENT_ERRORS.long);
  return text;
}

export function readOfferDocuments(text: string): OfferDocuments | null {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null) return null;
    const v = value as Partial<Record<keyof OfferDocuments, unknown>>;
    if (
      v.kind !== DOCUMENT_KIND ||
      (v.coverage !== "self" && v.coverage !== "family") ||
      typeof v.offerLetter !== "string" ||
      typeof v.benefitsGuide !== "string"
    )
      return null;
    return {
      kind: DOCUMENT_KIND,
      coverage: v.coverage,
      offerLetter: v.offerLetter,
      benefitsGuide: v.benefitsGuide,
    };
  } catch {
    return null;
  }
}
