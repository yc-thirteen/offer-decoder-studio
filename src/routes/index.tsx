import { createFileRoute } from "@tanstack/react-router";
import { AboutYou, DecoderControls, DecoderHeader } from "@/components/decoder";
import { GuillocheBackground } from "@/components/stub";
import { DecoderProvider } from "@/state/DecoderContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Offer Decoder" },
      { name: "description", content: "Offer Decoder" },
      { property: "og:title", content: "Offer Decoder" },
      { property: "og:description", content: "Offer Decoder" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <DecoderProvider>
      <GuillocheBackground />
      <div className="mx-auto min-h-screen max-w-page px-4 py-6 md:px-6">
        <DecoderHeader />
        <main>
          <h1 className="sr-only">Compare two job offers after taxes and benefits</h1>
          <DecoderControls />
          <AboutYou />
        </main>
      </div>
    </DecoderProvider>
  );
}
