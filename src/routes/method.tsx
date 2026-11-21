import { Link, createFileRoute } from "@tanstack/react-router";
import { MethodPage } from "@/components/method/MethodPage";
import { GuillocheBackground } from "@/components/stub";

export const Route = createFileRoute("/method")({
  head: () => ({
    meta: [
      { title: "How the numbers work | Offer Decoder" },
      {
        name: "description",
        content:
          "Every tax, benefit, and retirement rule Offer Decoder uses, the 2026 numbers with their lecture slides, and what the site leaves out.",
      },
      { property: "og:title", content: "How the numbers work | Offer Decoder" },
      {
        property: "og:description",
        content: "The rules, the 2026 numbers, and the simplifications behind Offer Decoder.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Method,
});

function Method() {
  return (
    <>
      <GuillocheBackground />
      <div className="mx-auto min-h-screen max-w-page px-4 py-6 md:px-6">
        <header className="border-b-2 border-ink pb-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <Link to="/" className="text-xl font-extrabold text-ink no-underline hover:underline">
              Offer Decoder
            </Link>
            <Link
              to="/"
              className="text-sm text-ink underline underline-offset-3 hover:decoration-2"
            >
              Back to the decoder
            </Link>
          </div>
        </header>
        <main className="pb-12">
          <MethodPage />
        </main>
      </div>
    </>
  );
}
