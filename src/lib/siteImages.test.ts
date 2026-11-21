// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GuillocheBackground } from "@/components/stub";
import { Route as IndexRoute } from "@/routes/index";
import { Route as MethodRoute } from "@/routes/method";
import {
  type HeadTag,
  OG_IMAGE_ALT,
  PRESENT_IMAGES,
  iconLinks,
  paperTextureUrl,
  shareImageMeta,
} from "./siteImages";

const ROOT = path.resolve(__dirname, "../..");
const SLOTS = ["/og-image.png", "/icon-512.png", "/favicon.ico", "/paper-texture.png"];
const TOKENS = ["#E4ECE1", "#F6F8F4", "#1E3A2B", "#4F6B5B", "#2B4C9B", "#B3261E"];

const headMeta = (route: { options: { head?: unknown } }) =>
  (route.options.head as (c: unknown) => { meta?: HeadTag[] })({}).meta ?? [];

describe("image slot detection", () => {
  it("finds exactly the slot files that exist in public/", () => {
    const onDisk = SLOTS.filter((s) => existsSync(path.join(ROOT, "public", s)));
    expect([...PRESENT_IMAGES].sort()).toEqual(onDisk.sort());
  });

  it("no longer ships the template's favicon.ico as if it were the site's icon", () => {
    // The generated favicon.ico comes from icon-512.png (IMAGE_PROMPTS.md), so one without
    // the other is the old Lovable template icon coming back.
    if (existsSync(path.join(ROOT, "public/favicon.ico"))) {
      expect(existsSync(path.join(ROOT, "public/icon-512.png"))).toBe(true);
    }
  });
});

describe("share card", () => {
  it("falls back to a plain summary card with no image", () => {
    expect(shareImageMeta([], undefined)).toEqual([{ name: "twitter:card", content: "summary" }]);
  });

  it("adds og:image, its size and alt text, and a large card once the file exists", () => {
    const meta = shareImageMeta(["/og-image.png"], undefined);
    const by = (k: string) => meta.find((m) => m.property === k || m.name === k)?.content;
    expect(by("og:image")).toBe("/og-image.png");
    expect(by("og:image:width")).toBe("1200");
    expect(by("og:image:height")).toBe("630");
    expect(by("og:image:alt")).toBe(OG_IMAGE_ALT);
    expect(by("twitter:card")).toBe("summary_large_image");
    expect(by("twitter:image")).toBe("/og-image.png");
  });

  it("makes the image URL absolute when VITE_SITE_URL is set", () => {
    const meta = shareImageMeta(["/og-image.png"], " https://example.test/ ");
    expect(meta.find((m) => m.property === "og:image")?.content).toBe(
      "https://example.test/og-image.png",
    );
  });

  it("is what the decoder and the Method page put in their heads, with one twitter:card", () => {
    for (const route of [IndexRoute, MethodRoute]) {
      const meta = headMeta(route);
      for (const tag of shareImageMeta()) expect(meta).toContainEqual(tag);
      expect(meta.filter((m) => m.name === "twitter:card")).toHaveLength(1);
    }
  });
});

describe("icons", () => {
  it("falls back to the SVG favicon drawn in code", () => {
    expect(iconLinks([])).toEqual([
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
    ]);
    expect(existsSync(path.join(ROOT, "public/favicon.svg"))).toBe(true);
  });

  it("links the generated icons in place of the SVG once they exist", () => {
    const links = iconLinks(["/icon-512.png", "/favicon.ico"]);
    expect(links.map((l) => [l.rel, l.href])).toEqual([
      ["icon", "/favicon.ico"],
      ["icon", "/icon-512.png"],
      ["apple-touch-icon", "/icon-512.png"],
    ]);
    expect(links.some((l) => l.href === "/favicon.svg")).toBe(false);
  });
});

describe("paper texture", () => {
  it("is null without the file, so the guilloché stands alone", () => {
    expect(paperTextureUrl([])).toBeNull();
    const { container } = render(createElement(GuillocheBackground, { textureUrl: null }));
    expect(container.querySelector("[data-testid=paper-texture]")).toBeNull();
    expect(container.querySelector("svg pattern")).not.toBeNull();
  });

  it("tiles under the waves at 512px when the file exists", () => {
    const url = paperTextureUrl(["/paper-texture.png"]);
    expect(url).toBe("/paper-texture.png");
    const { container } = render(createElement(GuillocheBackground, { textureUrl: url }));
    const layer = container.querySelector<HTMLElement>("[data-testid=paper-texture]");
    expect(layer).not.toBeNull();
    expect(layer!.getAttribute("aria-hidden")).toBe("true");
    expect(layer!.style.backgroundImage).toContain("/paper-texture.png");
    expect(layer!.style.backgroundSize).toBe("512px 512px");
    // Texture first, waves after: the guilloché draws on top.
    expect(layer!.nextElementSibling?.tagName.toLowerCase()).toBe("svg");
  });
});

describe("IMAGE_PROMPTS.md", () => {
  const doc = readFileSync(path.join(ROOT, "IMAGE_PROMPTS.md"), "utf8");
  const prompts = [...doc.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1] ?? "");

  it("names every slot with its exact file and size", () => {
    for (const s of SLOTS) expect(doc).toContain(`public${s}`);
    for (const size of ["1200×630", "512×512", "1024×1024"]) expect(doc).toContain(size);
    expect(doc).toMatch(/tileable/);
  });

  it("has a ready-to-paste prompt for the share card, icon, and texture", () => {
    expect(prompts).toHaveLength(3);
    const [og = "", icon = "", texture = ""] = prompts;
    expect(og).toMatch(/1200 by 630/);
    expect(icon).toMatch(/512 by 512/);
    expect(texture).toMatch(/1024 by 1024/);
    expect(texture).toMatch(/seamless/i);
  });

  it("uses only the design tokens, and names every one", () => {
    const colors = doc.match(/#[0-9a-f]{6}\b/gi) ?? [];
    for (const c of colors) expect(TOKENS).toContain(c.toUpperCase());
    for (const t of TOKENS) expect(doc).toContain(t);
    for (const p of prompts) {
      for (const c of p.match(/#[0-9a-f]{6}\b/gi) ?? []) expect(TOKENS).toContain(c.toUpperCase());
    }
  });

  it("allows text only in the share card, and only its title", () => {
    const [og = "", icon = "", texture = ""] = prompts;
    expect(og).toContain('"Offer Decoder"');
    expect(og).toMatch(/no other text/i);
    expect(icon).toMatch(/no text/i);
    expect(texture).toMatch(/no text/i);
    expect(icon).not.toMatch(/"[A-Z]/);
    expect(texture).not.toMatch(/"[A-Z]/);
  });

  it("asks for the security-paper pay stub style and rules out the banned look", () => {
    expect(doc).toMatch(/pay stub printed on security paper/);
    for (const p of prompts) {
      expect(p).toMatch(/no gradients/i);
      expect(p).toMatch(/shadow/i);
    }
    expect(prompts[0]).toMatch(/guilloché/);
    expect(prompts[0]).toMatch(/perforation/);
  });
});
