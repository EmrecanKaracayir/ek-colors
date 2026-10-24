/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< MODEL >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Colour as seen on each base: CAM16 under that base's viewing conditions (Google's                |
| material-color-utilities), contrast by WCAG 2 and APCA (Color.js), and CAM16's hue names.        |
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

import { BASES, type Mode } from "./config.js";

ColorSpace.register(sRGB);
ColorSpace.register(XYZ_D65);

/* >-----------------------------------< Viewing conditions >-----------------------------------< */

/*
 * CAM16 told what the eye is looking at: the base's lightness as the background, with Material's
 * defaults for the rest (a screen in a 200 lux room, an average surround).
 */
const VIEWING: Record<Mode, ViewingConditions> = {
  light: ViewingConditions.make(undefined, undefined, lstarFromArgb(argbFromHex(BASES.light))),
  dark: ViewingConditions.make(undefined, undefined, lstarFromArgb(argbFromHex(BASES.dark))),
};

/* >----------------------------------------< Colours >-----------------------------------------< */

/**
 * A colour in CAM16 as seen on a mode's base.
 *
 * @param mode  The mode.
 * @param hex   The colour, #RRGGBB.
 * @returns     Its CAM16 description.
 */
export function cam(mode: Mode, hex: string): Cam16 {
  return Cam16.fromIntInViewingConditions(argbFromHex(hex), VIEWING[mode]);
}

/**
 * The colour with a CAM16 lightness, chroma and hue on a mode's base.
 *
 * @param mode    The mode.
 * @param hue     CAM16 hue (degrees).
 * @param chroma  CAM16 chroma.
 * @param j       CAM16 lightness (0 to 100).
 * @returns       It as #RRGGBB, or null when a screen can't show it.
 */
export function colorAt(mode: Mode, hue: number, chroma: number, j: number): string | null {
  const [x, y, z] = Cam16.fromJchInViewingConditions(
    j,
    chroma,
    hue,
    VIEWING[mode],
  ).xyzInViewingConditions(VIEWING[mode]) as [number, number, number];
  const color = {
    space: XYZ_D65,
    coords: [x / 100, y / 100, z / 100] as [number, number, number],
    alpha: 1,
  };
  if (!inGamut(color, sRGB, { epsilon: 0.0005 })) return null;
  return serialize(to(color, sRGB), { format: "hex", collapse: false }).toUpperCase();
}

/**
 * How different two colours look on a mode's base.
 *
 * @param mode  The mode.
 * @param a     One colour.
 * @param b     The other.
 * @returns     Their CAM16-UCS distance.
 */
export function distance(mode: Mode, a: string, b: string): number {
  return cam(mode, a).distance(cam(mode, b));
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

/* >------------------------------------< Hue composition >-------------------------------------< */

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
  const [from, toName] = [UNIQUE.name[i]!, UNIQUE.name[i + 1]!];
  if (share <= 0) return from;
  if (share >= 100) return toName;
  return share <= 50
    ? `${from} ${String(share)} ${toName}`
    : `${toName} ${String(100 - share)} ${from}`;
}
