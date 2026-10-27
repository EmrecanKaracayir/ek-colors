# EK Colors

Accessible color palettes that are solved, not picked. EK Colors builds a palette from a handful of
rules: hues, custom colors and neutrals, for light and dark, on six contrast tiers, for three kinds of
screen. Every color sits exactly on its contrast, the hues look equally colorful, and each is as
different from its neighbors as they are from theirs.

It ships with **EK Palette**, the palette it was made for: eight hues and brown. Change the settings
and it solves a palette of its own.

**[See it live →](https://emrecankaracayir.github.io/ek-colors/)** The site solves the palette in
the browser. Change any setting and watch it follow; "How it works" walks through every rule with
live demos, "References" lists the research and software it's built on.

What follows describes EK Palette; every number in it is a setting.

## What it makes

- **Hues:** red, orange, yellow, green, mint, blue, purple and pink. They start evenly different,
  then seven of them are placed where their names fit best.
- **Custom colors:** any number beside the hues, each on its own hue at a share of the colorfulness.
  EK Palette has one, brown.
- **Neutrals:** Gray on every tier, and neutral colors that take the base's hue at a share of its
  colorfulness. EK Palette's bases are gray, so it has Gray alone.
- **Modes:** light on `#EBEBEB`, dark on `#181818`. A base can be any opaque CSS color, such as
  hex, `rgb()`, `oklch()` or `color(display-p3 …)`. Each screen gamut shows it exactly where it
  can; a narrower one uses the closest color it can show to the next wider one's, which can be
  picked by hand while it's still the same background.
- **Tiers:** one color per APCA contrast against the base:

  | Tier  | For                          |
  | ----- | ---------------------------- |
  | Lc 15 | Dividers and faint fills     |
  | Lc 30 | Icons, outlines and controls |
  | Lc 45 | Headlines and large text     |
  | Lc 60 | Labels and links             |
  | Lc 75 | Body text                    |
  | Lc 90 | Long reading                 |

- **Variants:** default, and muted at just under half the colorfulness, for every hue and custom
  color; Gray and the neutral colors have one version.
- **Screens:** standard (every screen, written as hex), wide (most new phones and computers) and
  ultra (the widest screens), each solved on its own.

WCAG 2 contrast and its level (AAA, AA, AA large or below) are reported for every color.

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
   the uniform lineup. They're spaced on the identity tier first, up to 20° each, then on every
   other tier, up to 6° from there. The identity tier is the one that stands for each hue: the
   tier where APCA and WCAG 2 together are just at their minimum for text (Lc 60 on the light
   base, Lc 45 on the dark one), or one set by hand. The anchor fixes where the lineup sits, since turning the whole lineup
   leaves its differences almost unchanged; it can be the yellow of CAM16, Munsell, NCS, unique-hue
   studies or the World Color Survey's focal colors, or any hue.
6. **Placed by name.** Any hue can be placed where its name fits best, and the rest re-space around
   it, keeping their order. A second blind test finds the middle of each name. How far placing and
   the curve bend the palette from the uniform lineup is measured in gaps between neighbors.
7. **Muted and custom colors.** Muted is the same hue and tier at a share of the colorfulness. Each
   custom color is the most colorful color of its hue, up to its share of the tier's colorfulness,
   exactly on the tier; custom colors aren't spaced with the hues.
8. **Neutrals.** Gray on every tier, its red, green and blue the same, exactly on the tier. Each
   neutral color takes its mode's base's hue at a share of the base's colorfulness; a base needs
   at least M 4 to have a hue to give. A color's colorfulness puts it in a zone: under M 4 it reads
   as gray, from M 4 to 12 as a neutral, past that as a color.

## Use

Requires Node 22 and pnpm.

```sh
pnpm install
pnpm solve
```

Edit `src/config.ts` and solve again. It starts from the defaults in `src/palette/settings.ts`,
which have no custom or neutral colors. The site checks every setting against its range (`LIMITS`
there) and that the light base is lighter than the dark one; `pnpm solve` doesn't, so keep to them.
`CONFIG` is EK Palette: the defaults with its own tuning, its placed hues, its curve per mode and
brown, for example:

```ts
export const CONFIG: Settings = {
  ...DEFAULTS,
  colorfulness: 44,
  anchor: "munsell",
  extras: [{ name: "Brown", hue: 40, share: 0.64 }],
};
```

The palette is written to `out/`, the Markdown and CSS titled with its `name`:

- `palette.json`: the settings and everything solved
- `palette.csv`: one row per swatch (gamut, mode, tier and variant), with CAM16, APCA and WCAG 2
  values
- `palette.md`: tables per screen, mode and variant
- `palette.css`: custom properties for a website, such as `--red-60`, `--red-60-muted`,
  `--gray-60` and one per neutral color named after it; light and dark through `light-dark()`,
  wider screens through `@media (color-gamut: …)`, where `--base` and Gray are written again only
  when they differ

Custom and neutral colors are named in exports from their own names: lowercased, accents dropped,
and other characters turned into dashes, with a number added when one would clash with another
color, `gray` or a page of the site. With a hue count other than 8, the hues are `hue-1` to
`hue-n`. A JSON export can be pasted back into Settings.

## Site

`site/` is the live site: an overview, every tier, a page per color, the comparison with EK Palette
(or with Codemos, its predecessor, on Shift+C), how it works, the algorithm with every formula,
references, and settings. Settings names the palette, resets it to EK Palette, copies and pastes
its settings, and holds the two blind tests (one finds where each color looks most like its name,
the other how colorful each hue looks), export as JSON, CSV, Markdown or CSS, and what the site is.
Changes stay in the browser. After changing `src/`, rebuild it:

```sh
pnpm build
```

Its icon, iPhone home-screen icon and link preview card are drawn from EK Palette in `out/`, with
Google Chrome (`CHROME` names it when it isn't in the usual place on a Mac); after EK Palette
changes, solve and draw them again:

```sh
pnpm solve
pnpm art
```

It's published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.

What changed in each version is in [CHANGELOG.md](CHANGELOG.md): every change goes under
Unreleased, and a release, from a clean `main`, dates it as the new version, sets `package.json`,
formats, checks, builds, solves, commits and tags:

```sh
pnpm release 2.4.0
git push origin main v2.4.0
```

## Built with

- [material-color-utilities](https://github.com/material-foundation/material-color-utilities)
  (Apache 2.0): CAM16, viewing conditions and color difference.
- [Color.js](https://colorjs.io) (MIT): APCA, WCAG 2, color spaces, reading CSS colors, gamut
  checks and CSS Color 4 gamut mapping.

The papers, standards and data behind every step are listed on the site's References page.

## License

[MIT](LICENSE) © 2026 Emrecan Karaçayır
