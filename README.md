# Codemos palette v2

Eight hues (red, orange, yellow, green, mint, blue, purple, pink) plus brown, for light and dark, solved
rather than picked.

## How it is solved

- **Bases.** Light `#EBEBEB`, dark `#181818`. 8px of height is one just-noticeable step (OKLab
  lightness 0.01) below white; the dark base is the light one's contrast mirror.
- **Tiers.** Every hue has one colour per APCA tier against the base, sitting exactly on it (never
  below, only as far above as hex rounding forces): 15 dividers, 30 icons and outlines, 45 large text
  and the colour itself, 60 labels and links, 75 body text, 90 long reading. WCAG 2 is reported too.
- **Colourfulness.** All colours aim at one CAM16 colourfulness (M), each mode seen in its own room:
  light at 200 lux in a lit room, dark at 64 lux in a dim one (sRGB's typical and reference
  environments). Equal numbers look equally colourful. A colour can take a written exception per
  mode; where the screen can't reach a target, it goes as far as it can.
- **Hues.** Yellow is the anchor, one hue per mode, set a little warmer than pure yellow so a darkened yellow doesn't
  turn olive. Every other hue moves within its name until neighbours are equally different in
  CAM16-UCS, first on the identity tier (45), then a little on each tier.
- **Gamut tiers.** Every palette is solved three times, each on its own: standard (every screen,
  written as hex), wide (most new phones and computers) and ultra (the widest screens). Wider tiers
  reach more colourfulness on the tiers where the standard one runs out.
- **Muted.** The same hue on the same tier at half the default's colourfulness. Brown is default only.

The colour model is Google's
[material-color-utilities](https://github.com/material-foundation/material-color-utilities)
(CAM16, viewing conditions, UCS distance); contrast, APCA and gamut come from
[Color.js](https://colorjs.io).

## Use

```sh
pnpm install
pnpm solve
```

Edit `src/config.ts` (it starts from the defaults in `src/palette/settings.ts`) and solve again. The
palette is written to `out/`: `palette.json` (settings and everything solved), `palette.csv` (one row
per swatch) and `palette.md` (tables per mode and variant).

## Site

`site/` solves the palette live in the browser, in a worker: an overview, every tier, one page per
colour, the comparison with v1, all the settings, and export. After changing `src/`, rebuild it:

```sh
pnpm build
```
