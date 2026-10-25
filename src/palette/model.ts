/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< MODEL >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Color as it appears on each base in its room, for one gamut tier: CAM16 under that mode's        |
| viewing conditions (Google's material-color-utilities), contrast by WCAG 2 and APCA (Color.js),  |
| and CAM16's hue names.                                                                           |
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
  P3,
  REC_2020,
  serialize,
  sRGB,
  to,
  XYZ_D65,
} from "colorjs.io/fn";

import type { Gamut, Mode, Settings } from "./settings";

for (const space of [sRGB, P3, REC_2020, XYZ_D65]) ColorSpace.register(space);

/** The color space each gamut tier's colors are written in. */
const SPACES = { standard: sRGB, wide: P3, ultra: REC_2020 } as const satisfies Record<
  Gamut,
  unknown
>;

/* >-----------------------------------< Viewing conditions >-----------------------------------< */

/** Lux to the luminance the eye adapts to (cd/m²): E / π × 0.184, a 20% gray (L* 50) lit by E lux. */
export const LUX_TO_ADAPTING = 0.0586;

/**
 * Where a mode's colors are seen, as CAM16 needs it: the room's light, the base as the background,
 * and the surround.
 *
 * @param settings  The bases and rooms.
 * @param mode      The mode.
 * @returns         CAM16 viewing conditions.
 */
export function viewingConditions(
  settings: Pick<Settings, "bases" | "rooms">,
  mode: Mode,
): ViewingConditions {
  return ViewingConditions.make(
    undefined,
    settings.rooms[mode].lux * LUX_TO_ADAPTING,
    lstarFromArgb(argbFromHex(settings.bases[mode])),
    settings.rooms[mode].surround,
  );
}

export interface Model {
  /** The color in CAM16 as it appears in a mode. */
  readonly cam: (mode: Mode, color: string) => Cam16;

  /** The color with a CAM16 lightness, colorfulness and hue, or null when the gamut can't show it. */
  readonly colorAt: (mode: Mode, hue: number, colorfulness: number, j: number) => string | null;

  /** How different two colors look (CAM16-UCS). */
  readonly distance: (mode: Mode, a: string, b: string) => number;
}

/**
 * The color model for a set of settings and a gamut: CAM16 told what each mode's eye looks at
 * (its base as the background) and where (its room), and which screens the colors are for.
 *
 * @param settings  The bases and rooms.
 * @param gamut     The gamut tier colors must fit.
 * @returns         CAM16 conversions and distance for both modes.
 */
export function makeModel(
  settings: Pick<Settings, "bases" | "rooms">,
  gamut: Gamut = "standard",
): Model {
  const conditions: Record<Mode, ViewingConditions> = {
    light: viewingConditions(settings, "light"),
    dark: viewingConditions(settings, "dark"),
  };
  const cam = (mode: Mode, color: string) => {
    const [x, y, z] = to(getColor(color), XYZ_D65).coords as [number, number, number];
    return Cam16.fromXyzInViewingConditions(x * 100, y * 100, z * 100, conditions[mode]);
  };
  return {
    cam,
    colorAt: (mode, hue, colorfulness, j) => colorAt(conditions[mode], gamut, hue, colorfulness, j),
    distance: (mode, a, b) => cam(mode, a).distance(cam(mode, b)),
  };
}

/**
 * Whether a base is dark: then its colors are lighter than it, and the search for one on a tier
 * looks above it.
 *
 * @param base  The background.
 * @returns     True when its lightness (L*) is under 50.
 */
export function darkBase(base: string): boolean {
  return lstarFromArgb(argbFromHex(base)) < 50;
}

/* >-----------------------------------------< Colors >-----------------------------------------< */

/**
 * The color with a CAM16 lightness, colorfulness and hue in viewing conditions.
 *
 * Colorfulness depends on the room as well as the color; chroma is colorfulness with the room
 * taken out (M divided by the fourth root of the luminance adaptation).
 *
 * @param conditions     Where it is seen.
 * @param gamut          The gamut tier it must fit.
 * @param hue            CAM16 hue (degrees).
 * @param colorfulness  CAM16 colorfulness (M).
 * @param j              CAM16 lightness (0 to 100).
 * @returns              It as CSS (#RRGGBB on the standard tier), or null when the gamut can't show it.
 */
function colorAt(
  conditions: ViewingConditions,
  gamut: Gamut,
  hue: number,
  colorfulness: number,
  j: number,
): string | null {
  const chroma = colorfulness / conditions.fLRoot;
  const [x, y, z] = Cam16.fromJchInViewingConditions(
    j,
    chroma,
    hue,
    conditions,
  ).xyzInViewingConditions(conditions) as [number, number, number];
  const space = SPACES[gamut];
  const color = {
    space: XYZ_D65,
    coords: [x / 100, y / 100, z / 100] as [number, number, number],
    alpha: 1,
  };
  if (!inGamut(color, space, { epsilon: 0.0005 })) return null;
  const inSpace = to(color, space);
  if (gamut === "standard")
    return serialize(inSpace, { format: "hex", collapse: false }).toUpperCase();
  const coords = inSpace.coords.map(
    (c) => Math.round(Math.min(1, Math.max(0, c ?? 0)) * 10_000) / 10_000,
  );
  return serialize({ ...inSpace, coords: coords as [number, number, number] });
}

/* >------------------------------------------< Hues >------------------------------------------< */

/**
 * A hue on the circle.
 *
 * @param hue  Degrees, any number.
 * @returns    The same hue from 0 up to 360.
 */
export function wrapHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

/**
 * The shorter way around the circle from one hue to another.
 *
 * @param from  Degrees.
 * @param to    Degrees.
 * @returns     Degrees from −180 to 180: positive the way hues rise.
 */
export function hueTurn(from: number, to: number): number {
  return wrapHue(to - from + 180) - 180;
}

/**
 * The average of hues around the circle: 350° and 10° average to 0°, not 180°.
 *
 * @param hues  Degrees.
 * @returns     Degrees from 0 up to 360; 0 for none.
 */
export function meanHue(hues: readonly number[]): number {
  const [x, y] = hues.reduce(
    ([a, b], h) => [a + Math.cos((h * Math.PI) / 180), b + Math.sin((h * Math.PI) / 180)],
    [0, 0],
  );
  return wrapHue((Math.atan2(y, x) * 180) / Math.PI);
}

/* >---------------------------------------< Difference >---------------------------------------< */

/**
 * The difference shown, ΔE, from CAM16-UCS's plain distance ΔE′: 1.41 · ΔE′^0.63.
 *
 * @param plain  ΔE′.
 * @returns      ΔE.
 */
export function deltaE(plain: number): number {
  return 1.41 * plain ** 0.63;
}

/**
 * ΔE′ squared from ΔE, so differences can be added up the way they combine.
 *
 * @param shown  ΔE.
 * @returns      ΔE′².
 */
export function plainSquared(shown: number): number {
  return (shown / 1.41) ** (2 / 0.63);
}

/**
 * What a color difference is made of: lightness, colorfulness and hue, as shares of the whole. In
 * CAM16-UCS's plain distance the three parts combine exactly, √(ΔJ² + ΔM² + ΔH²); the ΔE shown
 * compresses that distance, so its parts are given as shares rather than amounts.
 *
 * @param a  One color.
 * @param b  The other.
 * @returns  Each part's share, adding up to 1; all 0 for the same color.
 */
export function parts(
  a: Cam16,
  b: Cam16,
): { lightness: number; colorfulness: number; hue: number } {
  const [ma, mb] = [Math.hypot(a.astar, a.bstar), Math.hypot(b.astar, b.bstar)];
  const turn = hueTurn(a.hue, b.hue) * (Math.PI / 180);
  const lightness = (b.jstar - a.jstar) ** 2;
  const colorfulness = (mb - ma) ** 2;
  const hue = (2 * Math.sqrt(ma * mb) * Math.sin(turn / 2)) ** 2;
  const whole = lightness + colorfulness + hue || 1;
  return { lightness: lightness / whole, colorfulness: colorfulness / whole, hue: hue / whole };
}

/* >----------------------------------------< Contrast >----------------------------------------< */

/**
 * APCA contrast of text on a background.
 *
 * @param text        The text color.
 * @param background  The color behind it.
 * @returns           Lc, in either polarity.
 */
export function apca(text: string, background: string): number {
  return Math.abs(contrastAPCA(getColor(background), getColor(text)));
}

/**
 * WCAG 2 contrast between two colors.
 *
 * @param a  One color.
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
 * A hue as a mix of its two neighboring unique hues.
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

/**
 * A hue from its name: the reverse of composition.
 *
 * @param name  E.g. "R", "R 50 Y" (halfway from red to yellow) or "B 33 R".
 * @returns     CAM16 hue (degrees).
 *
 * @throws      When the name isn't a pure hue or a mix of two neighboring ones.
 */
export function hueOf(name: string): number {
  const [from, share, next] = name.split(" ");
  const at = (letter: string | undefined) => ["R", "Y", "G", "B"].indexOf(letter ?? "");
  if (share === undefined) {
    if (at(from) < 0) throw new Error(`"${name}" isn't a CAM16 hue name.`);
    return UNIQUE.h[at(from)]!;
  }
  // "A n B" is n% of the way from A to B; the four pure hues go round R, Y, G, B and back to R.
  const forward = (at(from) + 1) % 4 === at(next);
  const backward = (at(next) + 1) % 4 === at(from);
  if (at(from) < 0 || at(next) < 0 || (!forward && !backward))
    throw new Error(`"${name}" isn't a CAM16 hue name.`);
  const i = forward ? at(from) : at(next);
  if (!Number.isFinite(Number(share))) throw new Error(`"${name}" isn't a CAM16 hue name.`);
  const toward = (forward ? Number(share) : 100 - Number(share)) / 100;
  let lo: number = UNIQUE.h[i]!;
  let hi: number = UNIQUE.h[i + 1]!;
  for (let k = 0; k < 50; k++) {
    const h = (lo + hi) / 2;
    const a = (h - UNIQUE.h[i]!) / UNIQUE.e[i]!;
    const b = (UNIQUE.h[i + 1]! - h) / UNIQUE.e[i + 1]!;
    if (a / (a + b) < toward) lo = h;
    else hi = h;
  }
  return ((lo + hi) / 2) % 360;
}
