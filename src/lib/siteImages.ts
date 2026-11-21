/**
 * The three image slots in harness/DESIGN.md "Images". The user generates these files from
 * IMAGE_PROMPTS.md and drops them into public/. The site must look finished without them, so
 * each slot is wired only when its file is really there, and otherwise falls back:
 *
 * - public/og-image.png (1200×630): no preview image; link previews use the title and text.
 * - public/icon-512.png and public/favicon.ico: the SVG favicon drawn in code (public/favicon.svg).
 * - public/paper-texture.png (1024×1024, tileable): the guilloché SVG alone.
 *
 * The glob runs at build time, so adding a file and rebuilding is all it takes. Nothing is
 * imported at runtime: only the keys are read, and the files are served from public/ as-is.
 */
const PRESENT = Object.keys(
  import.meta.glob("/public/{og-image.png,icon-512.png,favicon.ico,paper-texture.png}", {
    query: "?url",
    import: "default",
  }),
).map((key) => key.replace(/^\/public/, ""));

export type SiteImageFiles = readonly string[];

/** The public URLs of the slot files that exist in this build, e.g. ["/og-image.png"]. */
export const PRESENT_IMAGES: SiteImageFiles = PRESENT;

export const OG_IMAGE = { path: "/og-image.png", width: 1200, height: 630 } as const;
export const OG_IMAGE_ALT =
  "Two pay stubs side by side on pale green security paper, with the title Offer Decoder.";
export const PAPER_TEXTURE = { path: "/paper-texture.png", tile: 512 } as const;

/** One head tag, in the shape TanStack Router's head() takes. */
export type HeadTag = Partial<
  Record<"name" | "property" | "content" | "rel" | "href" | "type" | "sizes", string>
>;

/**
 * Optional absolute origin for the share image (crawlers such as X want an absolute og:image).
 * Set VITE_SITE_URL to the published URL; without it the image path stays root-relative.
 */
function absolute(path: string, siteUrl: string | undefined): string {
  const origin = (siteUrl ?? "").trim().replace(/\/+$/, "");
  return origin ? `${origin}${path}` : path;
}

/**
 * Meta tags for a content route's link preview. With the share card present: og:image, its
 * size and alt text, and a large Twitter card. Without it: a plain summary card and no image.
 */
export function shareImageMeta(
  files: SiteImageFiles = PRESENT_IMAGES,
  siteUrl: string | undefined = import.meta.env["VITE_SITE_URL"] as string | undefined,
): HeadTag[] {
  if (!files.includes(OG_IMAGE.path)) return [{ name: "twitter:card", content: "summary" }];
  const url = absolute(OG_IMAGE.path, siteUrl);
  return [
    { property: "og:image", content: url },
    { property: "og:image:width", content: String(OG_IMAGE.width) },
    { property: "og:image:height", content: String(OG_IMAGE.height) },
    { property: "og:image:alt", content: OG_IMAGE_ALT },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: url },
    { name: "twitter:image:alt", content: OG_IMAGE_ALT },
  ];
}

/**
 * Icon links. The generated icons replace the code-drawn SVG when they exist: icon-512.png as
 * the PNG icon and the home-screen icon, favicon.ico for browsers that ask for it. With
 * neither, the SVG is the only icon.
 */
export function iconLinks(files: SiteImageFiles = PRESENT_IMAGES): HeadTag[] {
  const links: HeadTag[] = [];
  if (files.includes("/favicon.ico")) {
    links.push({ rel: "icon", href: "/favicon.ico", sizes: "32x32" });
  }
  if (files.includes("/icon-512.png")) {
    links.push({ rel: "icon", href: "/icon-512.png", type: "image/png", sizes: "512x512" });
    links.push({ rel: "apple-touch-icon", href: "/icon-512.png" });
  }
  if (links.length === 0) {
    links.push({ rel: "icon", href: "/favicon.svg", type: "image/svg+xml", sizes: "any" });
  }
  return links;
}

/** The paper fiber texture's URL when the file exists, else null (the guilloché stands alone). */
export function paperTextureUrl(files: SiteImageFiles = PRESENT_IMAGES): string | null {
  return files.includes(PAPER_TEXTURE.path) ? PAPER_TEXTURE.path : null;
}
