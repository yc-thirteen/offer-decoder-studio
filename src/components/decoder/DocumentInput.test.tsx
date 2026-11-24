import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readLetterFile } from "@/lib/letterFile";
import { DocumentInput } from "./DocumentInput";

vi.mock("@/lib/letterFile", async (original) => ({
  ...(await original<typeof import("@/lib/letterFile")>()),
  readLetterFile: vi.fn(),
}));

describe("document file loading", () => {
  it("ignores an unfinished read after the document is removed", async () => {
    let finish!: (text: string) => void;
    vi.mocked(readLetterFile).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const change = vi.fn();
    const opening = vi.fn();
    render(
      <DocumentInput label="Offer letter" value="" onChange={change} onOpeningChange={opening} />,
    );
    fireEvent.change(screen.getByLabelText(/Offer letter file/), {
      target: { files: [new File(["x"], "offer.pdf")] },
    });
    expect(opening).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove offer letter" }));
    expect(change).toHaveBeenLastCalledWith("");
    await act(async () => finish("stale salary"));
    expect(change).toHaveBeenCalledTimes(1);
    expect(opening).toHaveBeenLastCalledWith(false);
  });

  it("rejects a multi-file drop instead of silently discarding another document", () => {
    const change = vi.fn();
    render(
      <DocumentInput
        label="Offer letter"
        value="already typed"
        onChange={change}
        onOpeningChange={vi.fn()}
      />,
    );
    fireEvent.drop(screen.getByLabelText(/Offer letter text/), {
      dataTransfer: { files: [new File(["a"], "a.txt"), new File(["b"], "b.txt")] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose one file here");
    expect(change).not.toHaveBeenCalled();
  });
});
