import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { DecoderProvider } from "../state/DecoderContext";
import { LoadErrorNotice, NotFoundNotice } from "../components/site/SiteNotice";
import { SITE_DESCRIPTION, SITE_NAME } from "../lib/siteMeta";
import { iconLinks } from "../lib/siteImages";

function NotFoundComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return <NotFoundNotice path={pathname} />;
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <LoadErrorNotice
      onRetry={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Site-wide defaults (src/lib/siteMeta.ts). Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_NAME },
      { name: "description", content: SITE_DESCRIPTION },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: SITE_NAME },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#E4ECE1" },
    ],
    links: [
      // Public Sans, weights 400/600/800 only (harness/DESIGN.md "Type").
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      // The generated icons when they exist in public/, else the SVG favicon drawn in code
      // (harness/DESIGN.md "Images"; see src/lib/siteImages.ts and IMAGE_PROMPTS.md).
      ...iconLinks(),
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* The decoder's state lives above the routes, so a visit to /method and back keeps
          the offers and profile you typed. */}
      <DecoderProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </DecoderProvider>
    </QueryClientProvider>
  );
}
