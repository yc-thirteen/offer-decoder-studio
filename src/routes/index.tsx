import { Link, createFileRoute } from "@tanstack/react-router";
import { shareImageMeta } from "@/lib/siteImages";
import {
  AboutYou,
  Checklist,
  DecoderControls,
  DecoderHeader,
  MemoLine,
  MonthlyPlan,
  OfferStubs,
} from "@/components/decoder";
import { GuillocheBackground } from "@/components/stub";
import { WhyElections } from "@/components/why";
import { LINK_CLASS, SIMPLIFICATIONS_LINK_TEXT } from "@/components/decoder/simplificationsLink";
import { HOME_TITLE, SITE_DESCRIPTION } from "@/lib/siteMeta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      ...shareImageMeta(),
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <GuillocheBackground />
      <div className="mx-auto min-h-screen max-w-page px-4 py-6 md:px-6">
        <DecoderHeader
          nav={
            <Link
              to="/method"
              className="text-sm text-ink underline underline-offset-3 hover:decoration-2"
            >
              How the numbers work
            </Link>
          }
        />
        <main>
          <h1 className="sr-only">Compare two job offers after taxes and benefits</h1>
          <DecoderControls />
          <AboutYou
            simplificationsLink={
              <Link to="/method" hash="simplifications" className={LINK_CLASS}>
                {SIMPLIFICATIONS_LINK_TEXT}
              </Link>
            }
          />
          <OfferStubs />
          <MemoLine />
          <MonthlyPlan />
          <Checklist />
          <WhyElections />
        </main>
      </div>
    </>
  );
}
