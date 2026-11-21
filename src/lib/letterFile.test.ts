import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_READERS,
  FILE_COPY,
  LETTER_FILE_ACCEPT,
  letterFileKind,
  readLetterFile,
  tidyLetterText,
  type LetterFileReaders,
} from "./letterFile";

const pdf = vi.hoisted(() => ({
  pages: [] as { str: string; hasEOL: boolean }[][],
  fail: null as Error | null,
  workerSrc: "",
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {
    set workerSrc(v: string) {
      pdf.workerSrc = v;
    },
  },
  getDocument: () => ({
    destroy: async () => {},
    promise: pdf.fail
      ? Promise.reject(pdf.fail)
      : Promise.resolve({
          numPages: pdf.pages.length,
          getPage: async (n: number) => ({
            getTextContent: async () => ({ items: pdf.pages[n - 1] }),
          }),
        }),
  }),
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/pdf.worker.js" }));

const docx = vi.hoisted(() => ({ text: "", fail: false }));
vi.mock("mammoth", () => ({
  extractRawText: async () => {
    if (docx.fail) throw new Error("not a zip");
    return { value: docx.text, messages: [] };
  },
}));

/** A File whose arrayBuffer works in jsdom (the mocks ignore the bytes). */
function file(name: string, type = "", body = "x"): File {
  const f = new File([body], name, { type });
  Object.defineProperty(f, "arrayBuffer", { value: async () => new ArrayBuffer(1) });
  return f;
}

beforeEach(() => {
  pdf.pages = [];
  pdf.fail = null;
  docx.text = "";
  docx.fail = false;
});

describe("letterFileKind", () => {
  it("knows .txt, PDF, and .docx by extension or MIME type, and nothing else", () => {
    expect(letterFileKind(file("Offer.TXT"))).toBe("txt");
    expect(letterFileKind(file("offer.pdf"))).toBe("pdf");
    expect(letterFileKind(file("offer.docx"))).toBe("docx");
    expect(letterFileKind(file("download", "application/pdf"))).toBe("pdf");
    expect(
      letterFileKind(
        file("x", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      ),
    ).toBe("docx");
    expect(letterFileKind(file("notes", "text/plain"))).toBe("txt");
    expect(letterFileKind(file("offer.doc", "application/msword"))).toBeNull();
    expect(letterFileKind(file("scan.png", "image/png"))).toBeNull();
    expect(letterFileKind(file("offer.pages"))).toBeNull();
  });

  it("lists the same kinds for the file picker", () => {
    expect(LETTER_FILE_ACCEPT.split(",")).toEqual(
      expect.arrayContaining([".txt", ".pdf", ".docx", "text/plain", "application/pdf"]),
    );
  });
});

describe("readLetterFile", () => {
  it("reads a .txt file as is", async () => {
    const text = "Dear Sam,\r\n\r\n\r\nWelcome.  ";
    expect(await readLetterFile(new File([text], "offer.txt", { type: "text/plain" }))).toBe(text);
  });

  it("joins a PDF's text items into lines and its pages with a blank line", async () => {
    pdf.pages = [
      [
        { str: "Dear Sam,", hasEOL: true },
        { str: "Your base salary will be ", hasEOL: false },
        { str: "$135,000", hasEOL: false },
        { str: " per year.", hasEOL: true },
      ],
      [{ str: "401(k): we match 50% of the first 6%.", hasEOL: true }],
    ];
    expect(await readLetterFile(file("offer.pdf"))).toBe(
      "Dear Sam,\nYour base salary will be $135,000 per year.\n\n401(k): we match 50% of the first 6%.",
    );
    expect(pdf.workerSrc).toBe("/pdf.worker.js");
  });

  it("says a PDF with no text layer may be a scan", async () => {
    pdf.pages = [[{ str: " ", hasEOL: true }], []];
    await expect(readLetterFile(file("scan.pdf"))).rejects.toThrow(FILE_COPY.noText);
  });

  it("says a password-protected PDF must be opened first", async () => {
    pdf.fail = Object.assign(new Error("No password given"), { name: "PasswordException" });
    await expect(readLetterFile(file("locked.pdf"))).rejects.toThrow(FILE_COPY.locked);
  });

  it("says a broken PDF couldn't be opened", async () => {
    pdf.fail = Object.assign(new Error("Invalid PDF structure"), { name: "InvalidPDFException" });
    await expect(readLetterFile(file("broken.pdf"))).rejects.toThrow(FILE_COPY.unreadable);
  });

  it("reads a Word .docx file's text", async () => {
    docx.text = "Dear Sam,\n\n\n\nYour base salary will be $135,000.\n";
    expect(await readLetterFile(file("offer.docx"))).toBe(
      "Dear Sam,\n\nYour base salary will be $135,000.",
    );
  });

  it("says a broken or empty .docx couldn't be read", async () => {
    docx.fail = true;
    await expect(readLetterFile(file("broken.docx"))).rejects.toThrow(FILE_COPY.unreadable);
    docx.fail = false;
    docx.text = "  \n ";
    await expect(readLetterFile(file("blank.docx"))).rejects.toThrow(FILE_COPY.noText);
  });

  it("refuses other files without opening them", async () => {
    const readers: LetterFileReaders = {
      ...DEFAULT_READERS,
      txt: vi.fn(),
      pdf: vi.fn(),
      docx: vi.fn(),
    };
    await expect(readLetterFile(file("offer.doc"), readers)).rejects.toThrow(FILE_COPY.unsupported);
    await expect(readLetterFile(file("scan.jpg", "image/jpeg"), readers)).rejects.toThrow(
      FILE_COPY.unsupported,
    );
    expect(readers.pdf).not.toHaveBeenCalled();
  });
});

describe("tidyLetterText", () => {
  it("normalizes line breaks, trims line ends, and keeps at most one blank line", () => {
    expect(tidyLetterText("  A\r\nB \u00a0\r\rC\n\n\n\nD\t\n")).toBe("A\nB\n\nC\n\nD");
  });
});
