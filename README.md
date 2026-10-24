# EK Palette

An accessible colour palette that is solved, not picked. Eight hues and brown, for light and dark,
on six contrast tiers, for three kinds of screen. Every colour sits exactly on its contrast, looks as
colourful as the others, and is as different from its neighbours as they are from theirs.

**[See it live →](https://emrecankaracayir.github.io/ek-palette/)** The site solves the palette in
your browser. Change any setting and watch it follow; the "How it works" page walks through every
step with live demos.

## What it makes

- **Hues:** red, orange, yellow, green, mint, blue, purple and pink, plus brown.
- **Modes:** light on `#EBEBEB`, dark on `#181818`.
- **Tiers:** one colour per APCA contrast against the base:

  | Tier  | For                              |
  | ----- | -------------------------------- |
  | Lc 15 | Dividers and faint fills         |
  | Lc 30 | Icons, outlines and controls     |
  | Lc 45 | Large text and the colour itself |
  | Lc 60 | Labels and links                 |
  | Lc 75 | Body text                        |
  | Lc 90 | Long reading                     |

- **Variants:** default, and muted at half the colourfulness.
- **Screens:** standard (every screen, written as hex), wide (most new phones and computers) and
  ultra (the widest screens), each solved on its own.

WCAG 2 contrast and its level (AAA, AA, AA large) are reported for every colour.

## How it is solved

1. **Seen in a room.** Colours are compared in CAM16, a model of colour vision, told what the eye
   looks at (the base) and where: light mode in a lit room (200 lux), dark mode in a dim one (64
   lux), sRGB's typical and reference rooms.
2. **Exactly on its tier.** For each hue and tier, lightness is searched until APCA contrast just
   reaches the tier: never below it, only as far above as rounding forces.
3. **Equally colourful.** Every colour aims at one colourfulness. Where the screen can't reach it,
   the whole tier drops to what its least colourful hue can reach, so nothing stands out by
   accident.
4. **Evenly different.** Yellow stays fixed, a little warmer than pure yellow so dark yellows don't
   turn olive. Every other hue moves within its name until neighbours are equally different in
   CAM16-UCS.

## Use

Requires Node 22 and pnpm.

```sh
pnpm install
pnpm solve
```

Edit `src/config.ts` (it starts from the defaults in `src/palette/settings.ts`) and solve again. The
palette is written to `out/`:

- `palette.json`: the settings and everything solved
- `palette.csv`: one row per colour
- `palette.md`: tables per screen, mode and variant

## Site

`site/` is the live site: an overview, every tier, a page per colour, how it works, all the
settings, and export. After changing `src/`, rebuild it:

```sh
pnpm build
```

It's published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.

## Built with

- [material-color-utilities](https://github.com/material-foundation/material-color-utilities)
  (Apache 2.0): CAM16, viewing conditions and colour difference.
- [Color.js](https://colorjs.io) (MIT): APCA, WCAG 2, colour spaces and gamut checks.

## License

[MIT](LICENSE) © Emrecan Karaçayır
