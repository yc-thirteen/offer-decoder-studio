import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AIError,
  MISSING_NOTES,
  MockAIClient,
  parseLetter,
  type AIClient,
  type ExtractedFields,
} from "@/lib/ai";
import { UNKNOWN_LETTER_NOTE } from "@/lib/ai/letterParser";
import { FILE_COPY, LETTER_FILE_ACCEPT } from "@/lib/letterFile";
import { AIClientProvider } from "@/state/AIClientContext";
import { DecoderProvider } from "@/state/DecoderContext";
import { DecoderControls } from "./DecoderHeader";
import { MAX_LETTER_CHARS, READER_COPY } from "./LetterReader";
import { OfferStubs } from "./OfferStub";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    destroy: async () => {},
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getTextContent: async () => ({
          items: [{ str: "Acme Corp offers you $135,000 a year.", hasEOL: true }],
        }),
      }),
    }),
  }),
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/pdf.worker.js" }));
vi.mock("mammoth", () => ({
  extractRawText: async () => ({ value: "A Word letter from Birch Labs.", messages: [] }),
}));

/** A PDF or Word file; the mocked libraries ignore its bytes. */
function binaryFile(name: string, type: string): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "arrayBuffer", { value: async () => new ArrayBuffer(1) });
  return f;
}

const letterText = (file: string) =>
  readFileSync(path.resolve(__dirname, "../../data/letters", file), "utf8");

function setup(client: AIClient = new MockAIClient(), sampleId: string | null = null) {
  render(
    <AIClientProvider client={client}>
      <DecoderProvider initialSampleId={sampleId}>
        <DecoderControls />
        <OfferStubs />
      </DecoderProvider>
    </AIClientProvider>,
  );
}

const stub = (n: 1 | 2) => screen.getAllByRole("region")[n - 1]!;
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const letterBox = (s: HTMLElement) => within(s).getByLabelText(/^Letter text/);
const submit = (s: HTMLElement) =>
  fireEvent.click(within(s).getAllByRole("button", { name: "Upload offer letter" }).at(-1)!);

function rowAmount(region: HTMLElement, label: RegExp): string {
  const dt = within(region)
    .getAllByRole("term")
    .find((el) => label.test(el.textContent ?? ""));
  if (!dt) throw new Error(`no row ${label}`);
  return dt.parentElement!.querySelector("dd")!.textContent!;
}

/** A client whose reader returns the northfield letter with some fields missing. */
function partialClient(...missing: (keyof ExtractedFields)[]): AIClient {
  const mock = new MockAIClient();
  return {
    kind: "http",
    explainStub: (req) => mock.explainStub(req),
    extractOffer: async () => {
      const fields = { ...parseLetter(letterText("northfield.txt")) };
      for (const k of missing) {
        (fields as Record<string, unknown>)[k] = {
          source: "missing",
          value: null,
          note: MISSING_NOTES[k],
        };
      }
      return { fields };
    },
  };
}

describe("Upload offer letter", () => {
  it("opens an inbox-tray panel with the sample-reader note and focuses the letter box", () => {
    setup();
    const s = stub(2);
    fireEvent.click(within(s).getByRole("button", { name: "Upload offer letter" }));
    expect(within(s).getByRole("heading", { name: "Upload offer letter" })).toBeInTheDocument();
    expect(within(s).getByText(READER_COPY.sampleNote)).toBeInTheDocument();
    expect(letterBox(s)).toHaveFocus();
    expect(within(s).getByLabelText("Or choose a file (.txt, PDF, or Word)")).toHaveAttribute(
      "accept",
      LETTER_FILE_ACCEPT,
    );
    // The header buttons step aside while the panel is open.
    expect(within(s).queryByRole("button", { name: "Fill in offer" })).toBeNull();
  });

  it("hides the sample-reader note once a real client is connected", () => {
    setup(partialClient());
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Upload offer letter" }));
    expect(within(s).queryByText(READER_COPY.sampleNote)).toBeNull();
  });

  it("reads a pasted sample letter into the review state, then saves it to the stub", async () => {
    setup();
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Upload offer letter" }));
    type(letterBox(s), letterText("lakeshore.txt"));
    submit(s);

    const salary = (await within(s).findByLabelText("Yearly salary")) as HTMLInputElement;
    expect(salary.value).toBe("140,000");
    expect((within(s).getByLabelText("Employer") as HTMLInputElement).value).toBe(
      "Lakeshore Systems",
    );
    expect(
      within(s).getByText(/^Check the \d+ fields marked "from letter", then save/),
    ).toHaveFocus();
    const markers = within(s).getAllByText("from letter");
    expect(markers.length).toBeGreaterThan(10);
    // The salary's own marker is part of its description.
    const markId = (salary.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .find((id) => id.endsWith("-mark"));
    expect(markId && document.getElementById(markId)).toHaveTextContent("from letter");

    // Editing a field confirms it: its marker goes.
    const before = markers.length;
    type(salary, "141,000");
    expect(within(s).getAllByText("from letter")).toHaveLength(before - 1);
    type(salary, "140,000");

    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));
    expect(within(s).getByRole("heading", { name: "Lakeshore Systems" })).toBeInTheDocument();
    expect(rowAmount(s, /^Gross pay/)).toBe("$140,000");
    expect(within(s).getByRole("status", { name: "" })).toHaveTextContent("Offer saved");
    expect(within(s).queryByText("from letter")).toBeNull();
    expect(within(s).getByRole("button", { name: "Upload offer letter" })).toHaveFocus();
  });

  it("fills the box from a sample letter button and reads it", async () => {
    setup();
    const s = stub(2);
    fireEvent.click(within(s).getByRole("button", { name: "Upload offer letter" }));
    fireEvent.click(within(s).getByRole("button", { name: "Cascade Robotics" }));
    expect((letterBox(s) as HTMLTextAreaElement).value).toBe(letterText("cascade.txt"));
    submit(s);
    expect(((await within(s).findByLabelText("Employer")) as HTMLInputElement).value).toBe(
      "Cascade Robotics",
    );
  });

  it("reads a dropped or chosen .txt, PDF, or Word file into the box, and refuses other files", async () => {
    setup();
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Upload offer letter" }));
    const input = within(s).getByLabelText("Or choose a file (.txt, PDF, or Word)");
    const text = letterText("northfield.txt");
    fireEvent.change(input, {
      target: { files: [new File([text], "offer.txt", { type: "text/plain" })] },
    });
    await within(s).findByDisplayValue(/Northfield Health/);
    expect((letterBox(s) as HTMLTextAreaElement).value).toBe(text);

    fireEvent.change(input, {
      target: { files: [new File(["{\\rtf1"], "offer.doc", { type: "application/msword" })] },
    });
    expect(await within(s).findByRole("alert")).toHaveTextContent(FILE_COPY.unsupported);
    expect((letterBox(s) as HTMLTextAreaElement).value).toBe(text);

    fireEvent.change(input, { target: { files: [binaryFile("offer.pdf", "application/pdf")] } });
    await within(s).findByDisplayValue(/Acme Corp/);
    expect(within(s).queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { files: [binaryFile("offer.docx", "")] } });
    await within(s).findByDisplayValue(/Word letter from Birch Labs/);

    type(letterBox(s), "");
    fireEvent.drop(letterBox(s), {
      dataTransfer: { files: [new File([text], "dropped.txt", { type: "" })], types: ["Files"] },
    });
    await within(s).findByDisplayValue(/Northfield Health/);
  });

  it("says what went wrong and opens no form for empty, too-long, or unknown text", async () => {
    setup();
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Upload offer letter" }));
    submit(s);
    expect(within(s).getByRole("alert")).toHaveTextContent(READER_COPY.empty);

    type(letterBox(s), "x".repeat(MAX_LETTER_CHARS + 1));
    submit(s);
    expect(within(s).getByRole("alert")).toHaveTextContent(READER_COPY.long);

    type(letterBox(s), "Dear Sam, we are pleased to offer you a job at Acme for $90,000.");
    submit(s);
    expect(await within(s).findByText(UNKNOWN_LETTER_NOTE)).toBeInTheDocument();
    expect(within(s).queryByLabelText("Yearly salary")).toBeNull();
    expect(letterBox(s)).toHaveAttribute("aria-invalid", "true");
  });

  it("shows the client's directive error when the reader fails", async () => {
    const failing: AIClient = {
      kind: "http",
      explainStub: () => Promise.reject(new Error("unused")),
      extractOffer: () =>
        Promise.reject(new AIError("Couldn't reach the letter reader. Check your connection.")),
    };
    setup(failing);
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Upload offer letter" }));
    type(letterBox(s), "Some letter");
    submit(s);
    expect(await within(s).findByRole("alert")).toHaveTextContent(
      "Couldn't reach the letter reader. Check your connection.",
    );
  });

  it("underlines missing fields with the reader's note and won't save until they're typed", async () => {
    setup(partialClient("salary", "rothAvailable"));
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Upload offer letter" }));
    type(letterBox(s), "Northfield Health letter");
    submit(s);

    const salary = (await within(s).findByLabelText("Yearly salary")) as HTMLInputElement;
    expect(salary.value).toBe("");
    const note = within(s).getByText("No salary in this letter. Type it here.");
    expect(note).toHaveClass("text-correction");
    expect(salary.getAttribute("aria-describedby")).toContain(note.id);
    expect(salary.parentElement).toHaveClass("border-correction", "border-b-2");
    expect(
      within(s).getByText(/fill in what the letter left out, underlined in red/),
    ).toBeVisible();
    const roth = within(s).getByLabelText("Roth 401(k) offered") as HTMLSelectElement;
    expect(roth.value).toBe("");
    expect(roth).toHaveClass("border-correction");

    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));
    expect(within(s).getByRole("alert")).toHaveTextContent("Fix the 2 fields marked in red");
    expect(within(s).getByText("Type the yearly salary in dollars.")).toBeInTheDocument();

    type(salary, "150,000");
    fireEvent.change(roth, { target: { value: "yes" } });
    expect(within(s).queryByText("No salary in this letter. Type it here.")).toBeNull();
    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));
    expect(rowAmount(s, /^Gross pay/)).toBe("$150,000");
  });

  it("cancel leaves the stub as it was and returns focus to the button", () => {
    setup(new MockAIClient(), "chicago-vs-austin");
    const s = stub(1);
    const open = within(s).getByRole("button", { name: "Upload offer letter" });
    fireEvent.click(open);
    fireEvent.click(within(s).getByRole("button", { name: "Cancel" }));
    expect(rowAmount(s, /^Gross pay/)).toBe("$150,000");
    expect(within(s).getByRole("button", { name: "Upload offer letter" })).toHaveFocus();
  });
});
