/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< MODEL >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Colour as it appears on each base in its room: CAM16 under that mode's viewing conditions        |
| (Google's material-color-utilities), contrast by WCAG 2 and APCA (Color.js), and CAM16's hue     |
| names.                                                                                           |
\*------------------------------------------------------------------------------------------------*/

import {
  argbFromHex,
  Cam16,
  lstarFromArgb,
  ViewingConditions,
} from "@material/material-color-utilities";
import {
  ColorSpace,
  contrastAPCA,
  contrastWCAG21,
  getColor,
  inGamut,
  serialize,
  sRGB,
  to,
  XYZ_D65,
} from "colorjs.io/fn";

import type { Mode, Settings } from "./settings";

ColorSpace.register(sRGB);
ColorSpace.register(XYZ_D65);

/* >-----------------------------------< Viewing conditions >-----------------------------------< */

/** Lux to the luminance the eye adapts to (cd/m²), as material-color-utilities documents it. */
const LUX_TO_ADAPTING = 0.0586;

export interface Model {
  /** The colour in CAM16 as it appears in a mode. */
  readonly cam: (mode: Mode, hex: string) => Cam16;

  /** The colour with a CAM16 lightness, colourfulness and hue, or null off-screen. */
  readonly colorAt: (mode: Mode, hue: number, colourfulness: number, j: number) => string | null;

  /** How different two colours look (CAM16-UCS). */
  readonly distance: (mode: Mode, a: string, b: string) => number;
}

/**
 * The colour model for a set of settings: CAM16 told what each mode's eye looks at (its base as
 * the background) and where (its room).
 *
 * @param settings  The bases and rooms.
 * @returns         CAM16 conversions and distance for both modes.
 */
export function makeModel(settings: Pick<Settings, "bases" | "rooms">): Model {
  const viewing = (mode: Mode) =>
    ViewingConditions.make(
      undefined,
      settings.rooms[mode].lux * LUX_TO_ADAPTING,
      lstarFromArgb(argbFromHex(settings.bases[mode])),
      settings.rooms[mode].surround,
    );
  const conditions: Record<Mode, ViewingConditions> = {
    light: viewing("light"),
    dark: viewing("dark"),
  };
  const cam = (mode: Mode, hex: string) =>
    Cam16.fromIntInViewingConditions(argbFromHex(hex), conditions[mode]);
  return {
    cam,
    colorAt: (mode, hue, colourfulness, j) => colorAt(conditions[mode], hue, colourfulness, j),
    distance: (mode, a, b) => cam(mode, a).distance(cam(mode, b)),
  };
}

/* >----------------------------------------< Colours >-----------------------------------------< */

/**
 * The colour with a CAM16 lightness, colourfulness and hue in viewing conditions.
 *
 * Colourfulness depends on the room as well as the colour; chroma is colourfulness with the room
 * taken out (M divided by the fourth root of the luminance adaptation).
 *
 * @param conditions     Where it is seen.
 * @param hue            CAM16 hue (degrees).
 * @param colourfulness  CAM16 colourfulness (M).
 * @param j              CAM16 lightness (0 to 100).
 * @returns              It as #RRGGBB, or null when a screen can't show it.
 */
function colorAt(
  conditions: ViewingConditions,
  hue: number,
  colourfulness: number,
  j: number,
): string | null {
  const chroma = colourfulness / conditions.fLRoot;
  const [x, y, z] = Cam16.fromJchInViewingConditions(
    j,
    chroma,
    hue,
    conditions,
  ).xyzInViewingConditions(conditions) as [number, number, number];
  const color = {
    space: XYZ_D65,
    coords: [x / 100, y / 100, z / 100] as [number, number, number],
    alpha: 1,
  };
  if (!inGamut(color, sRGB, { epsilon: 0.0005 })) return null;
  return serialize(to(color, sRGB), { format: "hex", collapse: false }).toUpperCase();
}

/* >----------------------------------------< Contrast >----------------------------------------< */

/**
 * APCA contrast of text on a background.
 *
 * @param text        The text colour.
 * @param background  The colour behind it.
 * @returns           Lc, in either polarity.
 */
export function apca(text: string, background: string): number {
  return Math.abs(contrastAPCA(getColor(background), getColor(text)));
}

/**
 * WCAG 2 contrast between two colours.
 *
 * @param a  One colour.
 * @param b  The other.
 * @returns  The ratio, 1 to 21.
 */
export function wcag(a: string, b: string): number {
  return contrastWCAG21(getColor(a), getColor(b));
}

/**
 * What a WCAG 2 contrast is enough for.
 *
 * @param ratio  The contrast.
 * @returns      "AAA" (7), "AA" (4.5, normal text), "AA large" (3, large text and non-text) or "below".
 */
export function wcagLevel(ratio: number): "AAA" | "AA" | "AA large" | "below" {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA large";
  return "below";
}

/* >-----------------------------------------< Names >------------------------------------------< */

/** CAM16's unique hues: the ones that look pure (red, yellow, green, blue). */
const UNIQUE = {
  h: [20.14, 90, 164.25, 237.53, 380.14],
  e: [0.8, 0.7, 1, 1.2, 0.8],
  name: ["R", "Y", "G", "B", "R"],
} as const;

/**
 * A hue as a mix of its two neighbouring unique hues.
 *
 * @param hue  CAM16 hue (degrees).
 * @returns    E.g. "Y 10 G": yellow with 10% green; a single letter for a unique hue.
 */
export function composition(hue: number): string {
  const h = hue < UNIQUE.h[0] ? hue + 360 : hue;
  let i = 0;
  while (i < 3 && h >= UNIQUE.h[i + 1]!) i++;
  const a = (h - UNIQUE.h[i]!) / UNIQUE.e[i]!;
  const b = (UNIQUE.h[i + 1]! - h) / UNIQUE.e[i + 1]!;
  const share = Math.round((100 * a) / (a + b));
  const [from, next] = [UNIQUE.name[i]!, UNIQUE.name[i + 1]!];
  if (share <= 0) return from;
  if (share >= 100) return next;
  return share <= 50
    ? `${from} ${String(share)} ${next}`
    : `${next} ${String(100 - share)} ${from}`;
}

/** CAM16's reference hues: the unique ones and the halfway mixes, for the hue circle. */
export const REFERENCES = [
  { label: "R", hue: 20.14, unique: true },
  { label: "R 50 Y", hue: 57.4, unique: false },
  { label: "Y", hue: 90, unique: true },
  { label: "G", hue: 164.25, unique: true },
  { label: "G 50 B", hue: 197.6, unique: false },
  { label: "B", hue: 237.53, unique: true },
  { label: "B 50 R", hue: 323.1, unique: false },
] as const;
