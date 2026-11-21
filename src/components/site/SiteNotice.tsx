/**
 * The site's two notice pages, set as a single stub on the check paper: the 404 page and the
 * page-load error. Both say what happened and what to do next, without apologizing
 * (harness/DESIGN.md "Empty and error states"). The headline is 28/800, since 40/800 is
 * reserved for the Method page.
 */
import { useEffect, type ReactNode } from "react";
import { GuillocheBackground, StubShell } from "@/components/stub";

export const NOT_FOUND_TITLE = "Page not found | Offer Decoder";
export const LOAD_ERROR_TITLE = "Page didn't load | Offer Decoder";

const linkClass = "text-sm text-ink underline underline-offset-3 hover:decoration-2";
const primaryClass =
  "inline-flex h-10 items-center border border-ink bg-ink px-4 font-semibold text-stub no-underline underline-offset-3 hover:underline";
const secondaryClass =
  "inline-flex h-10 items-center border border-ink bg-stub px-4 font-semibold text-ink no-underline underline-offset-3 hover:underline";

function NoticeShell({
  title,
  heading,
  children,
  actions,
}: {
  title: string;
  heading: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  // The root head() can't tell a missing page from a real one, so the notice names the tab.
  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <>
      <GuillocheBackground />
      <div className="mx-auto min-h-screen max-w-page px-4 py-6 md:px-6">
        <header className="border-b-2 border-ink pb-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <a href="/" className="text-xl font-extrabold text-ink no-underline hover:underline">
              Offer Decoder
            </a>
            <a href="/method" className={linkClass}>
              How the numbers work
            </a>
          </div>
        </header>
        <main className="py-8">
          <StubShell className="max-w-2xl">
            <h1 className="m-0 text-2xl font-extrabold">{heading}</h1>
            <div className="mt-3 space-y-3">{children}</div>
            <div className="mt-6 flex flex-wrap gap-3">{actions}</div>
          </StubShell>
        </main>
      </div>
    </>
  );
}

/** The 404 page. `path` is the address that matched nothing. */
export function NotFoundNotice({ path }: { path?: string }) {
  return (
    <NoticeShell
      title={NOT_FOUND_TITLE}
      heading="No page at this address"
      actions={
        <>
          <a href="/" className={primaryClass}>
            Go to the decoder
          </a>
          <a href="/method" className={secondaryClass}>
            Read how the numbers work
          </a>
        </>
      }
    >
      <p className="m-0">
        {path ? (
          <>
            Offer Decoder has no page at{" "}
            <span className="font-semibold [overflow-wrap:anywhere]">{path}</span>.
          </>
        ) : (
          "Offer Decoder has no page at this address."
        )}{" "}
        Check the address, or go to the decoder to compare your two offers.
      </p>
    </NoticeShell>
  );
}

/** The page-load error. `onRetry` re-runs the route; reloading is the fallback. */
export function LoadErrorNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <NoticeShell
      title={LOAD_ERROR_TITLE}
      heading="This page didn't load"
      actions={
        <>
          <button type="button" onClick={onRetry} className={primaryClass}>
            Try again
          </button>
          <a href="/" className={secondaryClass}>
            Go to the decoder
          </a>
        </>
      }
    >
      <p className="m-0">
        Something failed while the page was being drawn. Try again, and if it fails a second time,
        reload the page.
      </p>
    </NoticeShell>
  );
}
