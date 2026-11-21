import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Route as RootRoute } from "@/routes/__root";
import { Route as IndexRoute } from "@/routes/index";
import { HOME_TITLE, SITE_DESCRIPTION } from "@/lib/siteMeta";
import { iconLinks } from "@/lib/siteImages";
import { LOAD_ERROR_TITLE, LoadErrorNotice, NOT_FOUND_TITLE, NotFoundNotice } from "./SiteNotice";

const TOKENS = ["#E4ECE1", "#F6F8F4", "#1E3A2B", "#4F6B5B", "#2B4C9B", "#B3261E"];

type Tag = Partial<Record<"name" | "content" | "property" | "title" | "rel" | "href", string>>;
type HeadFn = (ctx: unknown) => { meta?: Tag[]; links?: Tag[] };

function headOf(route: { options: { head?: unknown } }) {
  return (route.options.head as HeadFn)({});
}

describe("NotFoundNotice", () => {
  it("names the address, says what to do, and links to both pages", () => {
    render(<NotFoundNotice path="/offers/2" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "No page at this address" }),
    ).toBeVisible();
    expect(screen.getByText("/offers/2")).toBeVisible();
    expect(screen.getByText(/check the address, or go to the decoder/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to the decoder" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Read how the numbers work" })).toHaveAttribute(
      "href",
      "/method",
    );
    expect(document.title).toBe(NOT_FOUND_TITLE);
  });

  it("reads naturally without a path", () => {
    render(<NotFoundNotice />);
    expect(screen.getByText(/has no page at this address\. Check the address/)).toBeVisible();
  });
});

describe("LoadErrorNotice", () => {
  it("states the problem and the fix, and retries", () => {
    const onRetry = vi.fn();
    render(<LoadErrorNotice onRetry={onRetry} />);
    expect(screen.getByRole("heading", { level: 1, name: "This page didn't load" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Go to the decoder" })).toHaveAttribute("href", "/");
    expect(document.title).toBe(LOAD_ERROR_TITLE);
  });

  it("follows the copy rules on both notices", () => {
    const { container } = render(
      <>
        <NotFoundNotice path="/x" />
        <LoadErrorNotice onRetry={() => {}} />
      </>,
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/sorry|oops|apolog|!|→/i);
  });
});

describe("page metadata", () => {
  it("gives the root and the decoder a real title and description", () => {
    for (const route of [RootRoute, IndexRoute]) {
      const meta = headOf(route).meta ?? [];
      const description = meta.find((m) => m.name === "description")?.content;
      expect(description).toBe(SITE_DESCRIPTION);
      expect(meta.find((m) => m.property === "og:description")?.content).toBe(SITE_DESCRIPTION);
      // The template's Lovable author and twitter:site tags are gone. (A share image URL may
      // live on a lovable.app address, so image tags are left out of this check.)
      const nonImage = meta.filter((m) => !/image/.test(m.property ?? m.name ?? ""));
      expect(JSON.stringify(nonImage)).not.toMatch(/lovable/i);
    }
    const title = headOf(IndexRoute).meta?.find((m) => "title" in m)?.title;
    expect(title).toBe(HOME_TITLE);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });

  it("links the icons from siteImages, with the SVG favicon drawn only in the design tokens", () => {
    const links = headOf(RootRoute).links ?? [];
    expect(links.filter((l) => /icon/.test(l.rel ?? ""))).toEqual(iconLinks());
    const svg = readFileSync(path.resolve(__dirname, "../../../public/favicon.svg"), "utf8");
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    const colors = svg.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    expect(colors.length).toBeGreaterThan(0);
    for (const c of colors) expect(TOKENS).toContain(c.toUpperCase());
  });
});
