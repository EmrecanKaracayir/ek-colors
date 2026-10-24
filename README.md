# EK Colors

An accessible color palette that is solved, not picked. Eight hues and brown, for light and dark,
on six contrast tiers, for three kinds of screen. Every color sits exactly on its contrast, looks as
colorful as the others, and is as different from its neighbors as they are from theirs.

**[See it live →](https://emrecankaracayir.github.io/ek-colors/)** The site solves the palette in
your browser. Change any setting and watch it follow; the "How it works" page walks through every
step with live demos.

## What it makes

- **Hues:** red, orange, yellow, green, mint, blue, purple and pink, plus brown.
- **Modes:** light on `#EBEBEB`, dark on `#181818`.
- **Tiers:** one color per APCA contrast against the base:

  | Tier  | For                             |
  | ----- | ------------------------------- |
  | Lc 15 | Dividers and faint fills        |
  | Lc 30 | Icons, outlines and controls    |
  | Lc 45 | Large text and the color itself |
  | Lc 60 | Labels and links                |
  | Lc 75 | Body text                       |
  | Lc 90 | Long reading                    |

- **Variants:** default, and muted at half the colorfulness.
- **Screens:** standard (every screen, written as hex), wide (most new phones and computers) and
  ultra (the widest screens), each solved on its own.

WCAG 2 contrast and its level (AAA, AA, AA large) are reported for every color.

## How it is solved

1. **Seen in a room.** Colors are compared in CAM16, a model of color vision, told what the eye
   looks at (the base) and where: light mode in a lit room (200 lux), dark mode in a dim one (64
   lux), sRGB's typical and reference rooms.
2. **Exactly on its tier.** For each hue and tier, lightness is searched until APCA contrast just
   reaches the tier: never below it, only as far above as rounding forces.
3. **Equally colorful.** Every color aims at one colorfulness. Where the screen can't reach it,
   the whole tier drops to what its least colorful hue can reach, so nothing stands out by
   accident.
4. **Evenly different.** Each hue starts where its name puts it on CAM16's hue circle (red at pure
   red, orange halfway to yellow…), the same in both modes. Yellow stays fixed, a few degrees toward
   green from CAM16's pure yellow; every other hue moves within its name until neighbors are equally
   different in CAM16-UCS.

## Use

Requires Node 22 and pnpm.

```sh
pnpm install
pnpm solve
```

Edit `src/config.ts` (it starts from the defaults in `src/palette/settings.ts`) and solve again. The
palette is written to `out/`:

- `palette.json`: the settings and everything solved
- `palette.csv`: one row per color
- `palette.md`: tables per screen, mode and variant

## Site

`site/` is the live site: an overview, every tier, a page per color, how it works, a blind test
that measures how colorful each hue looks to you and fits the curve, all the settings, and export. After changing `src/`, rebuild it:

```sh
pnpm build
```

It's published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.

## Built with

- [material-color-utilities](https://github.com/material-foundation/material-color-utilities)
  (Apache 2.0): CAM16, viewing conditions and color difference.
- [Color.js](https://colorjs.io) (MIT): APCA, WCAG 2, color spaces and gamut checks.

## License

[MIT](LICENSE) © Emrecan Karaçayır
