/**
 * Turns a dropped or chosen offer-letter file into plain text for the letter box.
 * Reads .txt directly, PDFs with pdf.js, and Word .docx files with mammoth. Both
 * libraries load only when such a file arrives, so they stay out of the page bundle
 * and out of server rendering. Everything runs in the browser; the file is never
 * uploaded. Only the text reaches the reader, after the user chooses "Read offer letter".
 */

export type LetterFileKind = "txt" | "pdf" | "docx";

export const FILE_COPY = {
  unsupported:
    "Only .txt, PDF, and Word (.docx) files can be read. Open the letter, copy its text, and paste it here.",
  unreadable: "That file couldn't be opened. Paste the letter's text instead.",
  noText:
    "This file has no text to copy, so it may be a scanned image. Paste the letter's text instead, or fill in the offer by hand.",
  locked: "This PDF is password-protected. Open it, copy its text, and paste it here.",
} as const;

/** A file problem whose message the panel shows as is. */
export class LetterFileError extends Error {}

const PDF_TYPES = new Set(["application/pdf"]);
const DOCX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** What the file input accepts: the same three kinds letterFileKind recognizes. */
export const LETTER_FILE_ACCEPT = [
  ".txt",
  ".pdf",
  ".docx",
  "text/plain",
  ...PDF_TYPES,
  ...DOCX_TYPES,
].join(",");

/** The kind of letter file, by extension first and then MIME type, or null. */
export function letterFileKind(file: Pick<File, "name" | "type">): LetterFileKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt")) return "txt";
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (file.type === "text/plain") return "txt";
  if (PDF_TYPES.has(file.type)) return "pdf";
  if (DOCX_TYPES.has(file.type)) return "docx";
  return null;
}

/** Reads one kind of file to text. Swappable so tests don't need the real libraries. */
export type LetterFileReaders = Record<LetterFileKind, (file: File) => Promise<string>>;

async function readPdf(file: File): Promise<string> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    let doc;
    try {
      doc = await task.promise;
    } catch (e) {
      if (e instanceof Error && e.name === "PasswordException") {
        throw new LetterFileError(FILE_COPY.locked);
      }
      throw e;
    }
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str + (item.hasEOL ? "\n" : "");
      }
      pages.push(text);
    }
    return pages.join("\n\n");
  } finally {
    void task.destroy();
  }
}

async function readDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export const DEFAULT_READERS: LetterFileReaders = {
  txt: readTextFile,
  pdf: readPdf,
  docx: readDocx,
};

/** Tidies extracted text: one kind of line break, no trailing spaces, at most one blank line. */
export function tidyLetterText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The letter's text, or a LetterFileError with a message to show. */
export async function readLetterFile(
  file: File,
  readers: LetterFileReaders = DEFAULT_READERS,
): Promise<string> {
  const kind = letterFileKind(file);
  if (!kind) throw new LetterFileError(FILE_COPY.unsupported);
  let raw: string;
  try {
    raw = await readers[kind](file);
  } catch (e) {
    if (e instanceof LetterFileError) throw e;
    throw new LetterFileError(FILE_COPY.unreadable);
  }
  const text = kind === "txt" ? raw : tidyLetterText(raw);
  if (kind !== "txt" && !text) throw new LetterFileError(FILE_COPY.noText);
  return text;
}
