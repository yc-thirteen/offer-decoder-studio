import { createFileRoute } from "@tanstack/react-router";

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
  return <main className="min-h-screen bg-background" />;
}
