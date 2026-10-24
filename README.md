# Codemos palette v2

Eight hues (red, orange, yellow, green, mint, blue, purple, pink) plus brown, for light and dark, solved
rather than picked.

## How it is solved

- **Bases.** Light `#EBEBEB`, dark `#181818`. 8px of height is one just-noticeable step (OKLab
  lightness 0.01) below white; the dark base is the light one's contrast mirror.
- **Tiers.** Every hue has one colour per APCA tier against the base, sitting exactly on it (never
  below, only as far above as hex rounding forces): 15 dividers, 30 icons and outlines, 45 large text
  and the colour itself, 60 labels and links, 75 body text, 90 long reading. WCAG 2 is reported too.
- **Chroma.** All colours aim at one CAM16 chroma as seen on their own base (CAM16 under that base's
  viewing conditions), so equal numbers look equally colourful there. A colour can take its own
  target; where the screen can't reach one, it goes as far as it can.
- **Hues.** Yellow is the anchor, set a little warmer than pure yellow so a darkened yellow doesn't
  turn olive. Every other hue moves within its name until neighbours are equally different in
  CAM16-UCS, first on the identity tier (45), then a little on each tier.
- **Muted.** The same hue on the same tier at half the default's chroma. Brown is default only.

The colour model is Google's
[material-color-utilities](https://github.com/material-foundation/material-color-utilities)
(CAM16, viewing conditions, UCS distance); contrast, APCA and gamut come from
[Color.js](https://colorjs.io).

## Use

```sh
pnpm install
pnpm solve
```

Edit `src/config.ts` (bases, tiers, chroma, per-colour overrides, yellow's hue) and solve again. The
palette is written to `out/`: `palette.json` (everything), `palette.csv` (one row per swatch) and
`palette.md` (tables per mode and variant).

`site/index.html` compares the identity tier with Codemos v1, solved live in the browser.
