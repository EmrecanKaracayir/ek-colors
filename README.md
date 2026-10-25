# EK Colors

Accessible color palettes that are solved, not picked. EK Colors builds a palette from a handful of
rules: hues and any extra colors, for light and dark, on six contrast tiers, for three kinds of
screen. Every color sits exactly on its contrast, the hues look equally colorful, and each is as
different from its neighbors as they are from theirs.

It ships with **EK Palette**, the palette it was made for: eight hues and brown. Change the settings
and it solves a palette of its own.

**[See it live →](https://emrecankaracayir.github.io/ek-colors/)** The site solves the palette in
the browser. Change any setting and watch it follow; "How it works" walks through every rule with
live demos, "References" lists the research and software it's built on.

What follows describes EK Palette; every number in it is a setting.

## What it makes

- **Hues:** red, orange, yellow, green, mint, blue, purple and pink, evenly spaced.
- **Extra colors:** any number beside the hues, each on its own hue at a share of the colorfulness.
  EK Palette has one, brown.
- **Modes:** light on `#EBEBEB`, dark on `#181818`.
- **Tiers:** one color per APCA contrast against the base:

  | Tier  | For                          |
  | ----- | ---------------------------- |
  | Lc 15 | Dividers and faint fills     |
  | Lc 30 | Icons, outlines and controls |
  | Lc 45 | Headlines and large text     |
  | Lc 60 | Labels and links             |
  | Lc 75 | Body text                    |
  | Lc 90 | Long reading                 |

- **Variants:** default, and muted at just under half the colorfulness, for every color.
- **Screens:** standard (every screen, written as hex), wide (most new phones and computers) and
  ultra (the widest screens), each solved on its own.

WCAG 2 contrast and its level (AAA, AA, AA large) are reported for every color.

## How it is solved

1. **Seen in a room.** Colors are compared in CAM16, a model of color vision, told what the eye
   looks at (the base) and where: light mode in a lit room (200 lux), dark mode in a dim one (64
   lux), sRGB's typical and reference rooms.
2. **Exactly on its tier.** For each hue and tier, lightness is searched until APCA contrast just
   reaches the tier: never below it, only as far above as rounding forces.
3. **Equally colorful.** Every hue aims at one colorfulness. Where the screen can't reach it, the
   whole tier drops to what its least colorful hue can reach, so nothing stands out by accident.
   The color that sets a tier, the colors lowered with it and any the screen still can't reach are
   labeled on the site.
4. **Colorfulness per hue.** A smooth curve over hue adds or takes away colorfulness where the eye
   sees more or less than the model says. A blind test on the site measures it.
5. **Evenly different.** The hues start evenly apart in angle from the anchor, yellow, the same in
   both modes, then move a few degrees each until neighbors are equally different in CAM16-UCS:
   the uniform lineup. The anchor fixes where the lineup sits, since turning the whole lineup
   leaves its differences almost unchanged; it can be the yellow of CAM16, Munsell, NCS, unique-hue
   studies or the World Color Survey's focal colors, or any hue.
6. **Placed by name.** Any hue can be placed where its name fits best, and the rest re-space around
   it, keeping their order. A second blind test finds the middle of each name. How far placing and
   the curve bend the palette from the uniform lineup is measured in gaps between neighbors.
7. **Muted and extra colors.** Muted is the same hue and tier at a share of the colorfulness. Each
   extra color is the most colorful color of its hue, up to its share of the tier's colorfulness,
   exactly on the tier; extras aren't spaced with the hues.

## Use

Requires Node 22 and pnpm.

```sh
pnpm install
pnpm solve
```

Edit `src/config.ts` and solve again. It starts from the defaults in `src/palette/settings.ts`,
which have no extra colors. `CONFIG` is EK Palette: the defaults with its own tuning, its placed
hues, its curve per mode and brown, for example:

```ts
export const CONFIG: Settings = {
  ...DEFAULTS,
  colorfulness: 44,
  anchor: "munsell",
  extras: [{ name: "Brown", hue: 40, share: 0.64 }],
};
```

The palette is written to `out/`:

- `palette.json`: the settings and everything solved
- `palette.csv`: one row per color
- `palette.md`: tables per screen, mode and variant
- `palette.css`: custom properties for a website, light and dark through `light-dark()`, wider
  screens through `@media (color-gamut: …)`

## Site

`site/` is the live site: an overview, every tier, a page per color, how it works, the algorithm
with every formula, references, and settings, with the two blind tests (one finds where each color
looks most like its name, the other how colorful each hue looks), export as JSON, CSV, Markdown or CSS,
and what the site is. After changing `src/`, rebuild it:

```sh
pnpm build
```

Its icon, iPhone home-screen icon and link preview card are drawn from EK Palette in `out/`, with
Chrome; after EK Palette changes, draw them again:

```sh
pnpm art
```

It's published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.

## Built with

- [material-color-utilities](https://github.com/material-foundation/material-color-utilities)
  (Apache 2.0): CAM16, viewing conditions and color difference.
- [Color.js](https://colorjs.io) (MIT): APCA, WCAG 2, color spaces and gamut checks.

The papers, standards and data behind every step are listed on the site's References page.

## License

[MIT](LICENSE) © 2026 Emrecan Karaçayır
