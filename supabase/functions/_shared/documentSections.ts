/** Cover every source character; overlap helps keep paragraphs and benefit tables together. */
export const MODEL_SECTION_CHARS = 20_000;
export const SECTION_OVERLAP_CHARS = 1_200;
export const MAX_SECTIONS = 32;
export const DOCUMENT_READ_TIMEOUT_MS = 135_000;
export const LONG_READER_TIMEOUT_MS = 145_000;
export const SINGLE_READ_CHARS = 40_000;

export function documentSections(text: string): string[] {
  if (!text.trim()) return [];
  const sections: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + MODEL_SECTION_CHARS, text.length);
    // JSON escaping, including control characters, must also fit the per-call budget.
    while (JSON.stringify(text.slice(start, end)).length > 30_000)
      end = start + Math.floor((end - start) / 2);
    if (end < text.length) {
      const paragraph = text.lastIndexOf("\n", end);
      if (paragraph > start + (end - start) / 2) end = paragraph + 1;
    }
    sections.push(text.slice(start, end));
    if (end === text.length) break;
    start = Math.max(
      start + 1,
      end - Math.min(SECTION_OVERLAP_CHARS, Math.floor((end - start) / 4)),
    );
  }
  return sections;
}

/** A failed read cancels the other workers through the caller's shared signal. */
export async function readSections<T>(
  sections: readonly string[],
  read: (section: string, index: number) => Promise<T>,
  signal: AbortSignal,
): Promise<T[]> {
  const results: T[] = new Array(sections.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, sections.length) }, async () => {
      while (next < sections.length) {
        if (signal.aborted) throw new Error("Document read cancelled");
        const index = next++;
        results[index] = await read(sections[index]!, index);
      }
    }),
  );
  return results;
}

/** Stable equality for object values whose keys the model may emit in a different order. */
export function canonicalValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalValue((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
