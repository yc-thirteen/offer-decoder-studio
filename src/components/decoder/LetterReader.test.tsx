import { readFileSync } from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
import { readOfferDocuments } from "@/lib/offerDocuments";
import { AIClientProvider } from "@/state/AIClientContext";
import { DecoderProvider, useDecoder } from "@/state/DecoderContext";
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
        <CoverageControl />
        <OfferStubs />
      </DecoderProvider>
    </AIClientProvider>,
  );
}

function CoverageControl() {
  const { dispatch } = useDecoder();
  return (
    <button onClick={() => dispatch({ type: "setProfile", patch: { coverage: "family" } })}>
      Switch to family
    </button>
  );
}

const stub = (n: 1 | 2) => screen.getAllByRole("region")[n - 1]!;
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const letterBox = (s: HTMLElement) => within(s).getByLabelText(/^Offer letter text/);
const submit = (s: HTMLElement) =>
  fireEvent.click(within(s).getByRole("button", { name: "Fill from documents" }));

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

describe("Upload documents", () => {
  it("combines the sample letter and guide into one editable offer", async () => {
    const client = new MockAIClient();
    const extract = vi.spyOn(client, "extractOffer");
    setup(client);
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Upload documents" }));
    fireEvent.click(within(s).getByRole("button", { name: "Try two sample documents" }));
    const guide = within(s).getByLabelText(/^Benefits guide.*text/);
    expect((guide as HTMLTextAreaElement).value).toContain("PPO 500");
    expect((letterBox(s) as HTMLTextAreaElement).value).not.toContain("PPO 500");
    submit(s);
    const salary = await within(s).findByLabelText("Yearly salary");
    expect(salary).toHaveValue("150,000");
    expect(within(s).getAllByLabelText("Your premium per year")[0]).toHaveValue("2,400");
    const documents = readOfferDocuments(extract.mock.calls[0]![0].text)!;
    expect(documents.coverage).toBe("self");
    expect(documents.benefitsGuide).toContain("HSA Plan 3000");
    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));
    expect(rowAmount(s, /^Gross pay/)).toBe("$150,000");
    expect(rowAmount(s, /yearly bottom line/)).toBe("$106,585");
  });

  it("keeps the offer when a benefits file fails, and replaces or removes either document independently", async () => {
    setup();
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Upload documents" }));
    type(letterBox(s), "Offer salary stays here");
    const input = within(s).getByLabelText(/^Benefits guide.*file \(/);
    fireEvent.change(input, { target: { files: [new File(["bad"], "benefits.doc")] } });
    expect(await within(s).findByRole("alert")).toHaveTextContent(FILE_COPY.unsupported);
    expect(letterBox(s)).toHaveValue("Offer salary stays here");
    fireEvent.change(input, {
      target: { files: [new File(["First guide"], "benefits.txt", { type: "text/plain" })] },
    });
    const guide = await within(s).findByDisplayValue("First guide");
    fireEvent.change(input, {
      target: { files: [new File(["Revised guide"], "revised.txt", { type: "text/plain" })] },
    });
    await within(s).findByDisplayValue("Revised guide");
    fireEvent.click(within(s).getByRole("button", { name: "Remove benefits guide" }));
    expect(guide).toHaveValue("");
    expect(letterBox(s)).toHaveValue("Offer salary stays here");
  });

  it("cancels an in-flight extraction if the profile coverage changes", async () => {
    let finish!: (value: { fields: ExtractedFields }) => void;
    let signal: AbortSignal | undefined;
    const client: AIClient = {
      kind: "http",
      explainStub: vi.fn(),
      extractOffer: (_req, s) => {
        signal = s;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    };
    setup(client);
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Upload documents" }));
    type(letterBox(s), "Offer text");
    submit(s);
    expect(within(s).getByRole("button", { name: "Fill from documents" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Switch to family" }));
    expect(signal?.aborted).toBe(true);
    await act(async () => finish({ fields: parseLetter(letterText("northfield.txt")) }));
    expect(within(s).queryByLabelText("Yearly salary")).toBeNull();
    expect(within(s).getByRole("button", { name: "Fill from documents" })).toBeEnabled();
    expect(within(s).getByText("family", { selector: "strong" })).toBeVisible();
  });
  it("opens an inbox-tray panel with the sample-reader note and focuses the letter box", () => {
    setup();
    const s = stub(2);
    fireEvent.click(within(s).getByRole("button", { name: "Upload documents" }));
    expect(within(s).getByRole("heading", { name: "Upload offer documents" })).toBeInTheDocument();
    expect(within(s).getByText(READER_COPY.sampleNote)).toBeInTheDocument();
    expect(letterBox(s)).toHaveFocus();
    expect(within(s).getByLabelText("Offer letter file (.txt, PDF, or Word)")).toHaveAttribute(
      "accept",
      LETTER_FILE_ACCEPT,
    );
    // The header buttons step aside while the panel is open.
    expect(within(s).queryByRole("button", { name: "Fill in offer" })).toBeNull();
  });

  it("hides the sample-reader note once a real client is connected", () => {
    setup(partialClient());
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Upload documents" }));
    expect(within(s).queryByText(READER_COPY.sampleNote)).toBeNull();
  });

  it("reads a pasted sample letter into the review state, then saves it to the stub", async () => {
    setup();
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Upload documents" }));
    type(letterBox(s), letterText("lakeshore.txt"));
    submit(s);

    const salary = (await within(s).findByLabelText("Yearly salary")) as HTMLInputElement;
    expect(salary.value).toBe("140,000");
    expect((within(s).getByLabelText("Employer") as HTMLInputElement).value).toBe(
      "Lakeshore Systems",
    );
    expect(
      within(s).getByText(/^Check the \d+ fields marked "from documents", then save/),
    ).toHaveFocus();
    const markers = within(s).getAllByText("from documents");
    expect(markers.length).toBeGreaterThan(10);
    // The salary's own marker is part of its description.
    const markId = (salary.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .find((id) => id.endsWith("-mark"));
    expect(markId && document.getElementById(markId)).toHaveTextContent("from documents");

    // Editing a field confirms it: its marker goes.
    const before = markers.length;
    type(salary, "141,000");
    expect(within(s).getAllByText("from documents")).toHaveLength(before - 1);
    type(salary, "140,000");

    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));
    expect(within(s).getByRole("heading", { name: "Lakeshore Systems" })).toBeInTheDocument();
    expect(rowAmount(s, /^Gross pay/)).toBe("$140,000");
    expect(within(s).getByRole("status", { name: "" })).toHaveTextContent("Offer saved");
    expect(within(s).queryByText("from documents")).toBeNull();
    expect(within(s).getByRole("button", { name: "Upload documents" })).toHaveFocus();
  });

  it("fills the box from a sample letter button and reads it", async () => {
    setup();
    const s = stub(2);
    fireEvent.click(within(s).getByRole("button", { name: "Upload documents" }));
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
    fireEvent.click(within(s).getByRole("button", { name: "Upload documents" }));
    const input = within(s).getByLabelText("Offer letter file (.txt, PDF, or Word)");
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
    fireEvent.click(within(s).getByRole("button", { name: "Upload documents" }));
    submit(s);
    expect(within(s).getByRole("alert")).toHaveTextContent(READER_COPY.empty);

    type(letterBox(s), "x".repeat(MAX_LETTER_CHARS + 1));
    submit(s);
    expect(within(s).getByRole("alert")).toHaveTextContent(READER_COPY.long);

    type(letterBox(s), "Dear Sam, we are pleased to offer you a job at Acme for $90,000.");
    submit(s);
    expect(await within(s).findByText(UNKNOWN_LETTER_NOTE)).toBeInTheDocument();
    expect(within(s).queryByLabelText("Yearly salary")).toBeNull();
    expect(letterBox(s)).toHaveValue(
      "Dear Sam, we are pleased to offer you a job at Acme for $90,000.",
    );
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
    fireEvent.click(within(s).getByRole("button", { name: "Upload documents" }));
    type(letterBox(s), "Some letter");
    submit(s);
    expect(await within(s).findByRole("alert")).toHaveTextContent(
      "Couldn't reach the letter reader. Check your connection.",
    );
  });

  it("underlines missing fields with the reader's note and won't save until they're typed", async () => {
    setup(partialClient("salary", "rothAvailable"));
    const s = stub(1);
    fireEvent.click(within(s).getByRole("button", { name: "Upload documents" }));
    type(letterBox(s), "Northfield Health letter");
    submit(s);

    const salary = (await within(s).findByLabelText("Yearly salary")) as HTMLInputElement;
    expect(salary.value).toBe("");
    const note = within(s).getByText("No salary in these documents. Type it here.");
    expect(note).toHaveClass("text-correction");
    expect(salary.getAttribute("aria-describedby")).toContain(note.id);
    expect(salary.parentElement).toHaveClass("border-correction", "border-b-2");
    expect(
      within(s).getByText(/fill in what the documents left out, underlined in red/),
    ).toBeVisible();
    const roth = within(s).getByLabelText("Roth 401(k) offered") as HTMLSelectElement;
    expect(roth.value).toBe("");
    expect(roth).toHaveClass("border-correction");

    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));
    expect(within(s).getByRole("alert")).toHaveTextContent("Fix the 2 fields marked in red");
    expect(within(s).getByText("Type the yearly salary in dollars.")).toBeInTheDocument();

    type(salary, "150,000");
    fireEvent.change(roth, { target: { value: "yes" } });
    expect(within(s).queryByText("No salary in these documents. Type it here.")).toBeNull();
    fireEvent.click(within(s).getByRole("button", { name: "Save offer" }));
    expect(rowAmount(s, /^Gross pay/)).toBe("$150,000");
  });

  it("cancel leaves the stub as it was and returns focus to the button", () => {
    setup(new MockAIClient(), "chicago-vs-austin");
    const s = stub(1);
    const open = within(s).getByRole("button", { name: "Upload documents" });
    fireEvent.click(open);
    fireEvent.click(within(s).getByRole("button", { name: "Cancel" }));
    expect(rowAmount(s, /^Gross pay/)).toBe("$150,000");
    expect(within(s).getByRole("button", { name: "Upload documents" })).toHaveFocus();
  });
});

it("accepts a realistic long guide with an HTTP reader and makes demo mode explicit", async () => {
  const client = partialClient();
  const extract = vi.spyOn(client, "extractOffer");
  setup(client);
  const s = stub(1);
  fireEvent.click(within(s).getByRole("button", { name: "Upload documents" }));
  type(letterBox(s), "Fictional offer text. ".repeat(1000));
  type(within(s).getByLabelText(/^Benefits guide.*text/), "Fictional benefits text. ".repeat(4000));
  expect(within(s).getByText("Cloud AI reader configured")).toBeTruthy();
  submit(s);
  await within(s).findByLabelText("Yearly salary");
  expect(extract.mock.calls[0]![0].text.length).toBeGreaterThan(40000);
});
