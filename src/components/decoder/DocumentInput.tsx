import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { LETTER_FILE_ACCEPT, LetterFileError, readLetterFile } from "@/lib/letterFile";

/** Replacing one document never clears the other document's text or error. */
export function DocumentInput({
  label,
  value,
  onChange,
  onOpeningChange,
  disabled = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  onOpeningChange: (opening: boolean) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const generation = useRef(0);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (autoFocus) textRef.current?.focus();
    return () => {
      generation.current += 1;
    };
  }, [autoFocus]);

  const clear = () => {
    generation.current += 1;
    setOpening(false);
    onOpeningChange(false);
    setFilename(null);
    setError(null);
    onChange("");
  };

  const loadFiles = async (files: FileList | undefined) => {
    if (!files?.length || disabled || opening) return;
    if (files.length !== 1) {
      setError("Choose one file here. Put the other document in its own input.");
      return;
    }
    const file = files[0]!;
    const ticket = ++generation.current;
    setOpening(true);
    onOpeningChange(true);
    setError(null);
    try {
      const text = await readLetterFile(file);
      if (generation.current !== ticket) return;
      onChange(text);
      setFilename(file.name);
    } catch (e) {
      if (generation.current !== ticket) return;
      setError(
        e instanceof LetterFileError
          ? e.message
          : "This document couldn't be opened. Paste its text instead.",
      );
    } finally {
      if (generation.current === ticket) {
        setOpening(false);
        onOpeningChange(false);
      }
    }
  };

  const drop = (event: DragEvent<HTMLTextAreaElement>) => {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    void loadFiles(event.dataTransfer.files);
  };

  return (
    <fieldset className="m-0 min-w-0 border border-ink p-3">
      <legend className="px-1 font-semibold">{label}</legend>
      <label htmlFor={`${id}-file`} className="block text-xs text-ink-soft">
        {label} file (.txt, PDF, or Word)
      </label>
      <input
        id={`${id}-file`}
        type="file"
        accept={LETTER_FILE_ACCEPT}
        disabled={disabled || opening}
        onChange={(e) => {
          void loadFiles(e.target.files ?? undefined);
          e.target.value = "";
        }}
        className="mt-1 block w-full min-w-0 text-sm file:mr-2 file:h-10 file:border file:border-solid file:border-ink file:bg-stub file:px-2 file:font-semibold file:text-ink"
      />
      {filename && <p className="m-0 mt-2 break-words text-sm text-carbon">Loaded: {filename}</p>}
      <label htmlFor={`${id}-text`} className="mt-3 block text-xs text-ink-soft">
        {label} text (paste or drop a file)
      </label>
      <textarea
        id={`${id}-text`}
        ref={textRef}
        rows={5}
        value={value}
        spellCheck={false}
        disabled={disabled || opening}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => {
          setFilename(null);
          setError(null);
          onChange(e.target.value);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDrop={drop}
        className={`block w-full min-w-0 resize-y border bg-stub p-2 text-carbon ${error ? "border-correction" : "border-ink"}`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="m-0 mt-2 text-sm text-correction">
          {error}
        </p>
      )}
      <p role="status" className="m-0 text-sm text-ink-soft">
        {opening ? "Opening the file…" : ""}
      </p>
      {(value || filename || opening) && (
        <button
          type="button"
          disabled={disabled}
          onClick={clear}
          className="mt-2 min-h-10 border border-ink px-3 text-sm font-semibold"
        >
          Remove {label.toLowerCase().replace(" — optional", "")}
        </button>
      )}
    </fieldset>
  );
}
