# Image prompts

Offer Decoder looks finished without any images. Each slot below is optional, and the site picks up a file automatically once it is in `public/` and the site is rebuilt (a Lovable publish rebuilds it). Until then each slot falls back on its own, as the table shows.

| Slot | File | Size | Without the file |
|---|---|---|---|
| Social share card | `public/og-image.png` | 1200×630 | Link previews show the title and description, with no image. |
| App icon | `public/icon-512.png` | 512×512 | The SVG favicon drawn in code (`public/favicon.svg`). |
| Favicon | `public/favicon.ico` | 16, 32, and 48 px in one file | The SVG favicon drawn in code (`public/favicon.svg`). |
| Paper fiber texture | `public/paper-texture.png` | 1024×1024, tileable | The guilloché wave pattern drawn in code, alone. |

The wiring is in `src/lib/siteImages.ts`.

## The palette (use only these colors)

| Name | Hex | Role |
|---|---|---|
| Paper | `#E4ECE1` | pale check-paper green, the background |
| Stub | `#F6F8F4` | the near-white surface of a pay stub |
| Ink | `#1E3A2B` | deep green-black for lines, rules, and text |
| Ink soft | `#4F6B5B` | muted green for fine secondary lines |
| Carbon | `#2B4C9B` | carbon-copy blue, used sparingly |
| Correction | `#B3261E` | correction red, used sparingly |

The style for every image is a pay stub printed on security paper: flat, printed, engraved, and official. Corners are square, and there are no shadows, gradients, glow, gloss, or 3D. There are no people, hands, desks, coins, dollar signs, or emoji. No image has any text except the share card's title.

Paste each prompt below as is. If a tool adds text, letters, or numbers anyway, regenerate. A share card whose title is misspelled can't be used.

## 1. Social share card: `public/og-image.png`

Export at exactly 1200×630 px, PNG.

```
A flat, printed, top-down illustration, 1200 by 630 pixels, of two blank pay stubs lying side by side on security paper, in the style of an engraved bank check.

Background: solid pale check-paper green #E4ECE1, covered edge to edge with very fine overlapping sine-wave guilloché lines in #1E3A2B at about 5% opacity, like the anti-forgery print on a check.

Two tall rectangular stubs in #F6F8F4 with square corners and a thin 1 px #1E3A2B border, no shadow. A vertical column of small round perforation holes runs between them, and the paper color #E4ECE1 shows through the holes. Small semicircular notches are cut into the top and bottom edges where the perforation meets the stubs.

Each stub has rows of thin horizontal #1E3A2B rules where line items would go. The amounts are abstract short bars aligned to a clean right edge, not readable numbers. Near the bottom of each stub there is a heavy 2 px rule and a boxed total, also an abstract bar. On the left stub, one amount bar has a thin straight #B3261E line struck through it, with a short #2B4C9B bar just to its right, like a corrected amount.

Leave the top-left quarter of the image clear of stubs. In that space, set the title "Offer Decoder" exactly once, in a plain bold grotesque sans serif similar to Public Sans, weight 800, in #1E3A2B, sentence case, left-aligned, about 72 px tall. Spell it exactly: O-f-f-e-r D-e-c-o-d-e-r.

There is no other text anywhere: no numbers, no labels, no logos, no watermark. Use only these six colors: #E4ECE1, #F6F8F4, #1E3A2B, #4F6B5B, #2B4C9B, #B3261E. No gradients, no drop shadows, no glow, no 3D, no rounded corners, no people, no hands, no money, no icons.
```

## 2. App icon: `public/icon-512.png`

Export at exactly 512×512 px, PNG.

```
A flat, printed app icon, 512 by 512 pixels, square with square corners, showing a single small pay stub.

Background: solid pale check-paper green #E4ECE1 filling the whole square, edge to edge, with no border and no rounded corners.

Centered, a tall rectangular pay stub in #F6F8F4 with square corners and a 12 px #1E3A2B border, about 60% of the icon's height. One semicircular notch is cut into its top edge and one into its bottom edge, both centered.

Inside the stub, three thick horizontal #1E3A2B rules for line items, with short bars aligned to a clean right edge. Then a heavier #1E3A2B rule, and below it one short bar in carbon blue #2B4C9B. The shapes are bold enough to read at 16 px.

No text, no letters, no numbers. Use only these colors: #E4ECE1, #F6F8F4, #1E3A2B, #2B4C9B. No gradients, no shadows, no glow, no 3D, no outline around the square, no fine detail that disappears when small.
```

## 3. Favicon: `public/favicon.ico`

You don't need a separate prompt. Make it from `icon-512.png` so the two match:

- With any "PNG to ICO" converter, include the 16, 32, and 48 px sizes.
- Or, with ImageMagick: `magick public/icon-512.png -define icon:auto-resize=48,32,16 public/favicon.ico`

Once either `icon-512.png` or `favicon.ico` exists, the site links your icons in place of the SVG.

## 4. Paper fiber texture (optional): `public/paper-texture.png`

Export at exactly 1024×1024 px, PNG. It must tile seamlessly in both directions.

```
A seamless, tileable, flat texture, 1024 by 1024 pixels, of pale green security paper seen straight on under even light.

Base color: solid #E4ECE1. Over it, very sparse, short, fine paper fibers and faint mottling in #4F6B5B and #1E3A2B, at 3 to 6% opacity, evenly spread with no clusters, so the paper reads as nearly flat. The left edge must match the right edge and the top must match the bottom, with no visible seam when tiled.

No lines, no waves, no pattern, no text, no letters, no numbers, no stains, no folds, no creases, no vignette, no gradients, no lighting falloff, no shadows. Use only #E4ECE1, #4F6B5B, and #1E3A2B.
```

The site tiles it at 512 px (sharp on 2x screens), at 60% opacity, under the guilloché waves. It never sits behind the text on a stub, because stubs and panels are solid `#F6F8F4`.

## After you add the files

1. Put each file in `public/` with the exact name above.
2. Rebuild or republish. The build finds the files on its own, so you don't need to change any code.
3. For the share card, set `VITE_SITE_URL` to the published address, for example `https://your-site.lovable.app`. Some sites, like X, only show a preview image when its URL is absolute. Without it, the image URL stays root-relative (`/og-image.png`).
4. To check: in the page source, `/` should have an `og:image` tag, and the tab should show your icon.
