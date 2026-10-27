/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< BASES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Each gamut tier's base: set by hand for that tier, or worked out from one that is. A narrower     |
| tier's base is the same color on a wider one; a wider tier's base is brought into a narrower one |
| as the closest color it can show, by CSS Color 4's gamut mapping.                                 |
\*------------------------------------------------------------------------------------------------*/

import {
  ColorSpace,
  getColor,
  inGamut,
  OKLab,
  OKLCH,
  P3,
  REC_2020,
  serialize,
  sRGB,
  to,
  toGamutCSS,
} from "colorjs.io/fn";

import { type Gamut, GAMUTS, type Mode, MODES, type Settings } from "./settings";

for (const space of [sRGB, P3, REC_2020, OKLab, OKLCH]) ColorSpace.register(space);

/** The color space each gamut tier's colors are written in. */
const SPACES = { standard: sRGB, wide: P3, ultra: REC_2020 } as const satisfies Record<
  Gamut,
  unknown
>;

/** How a gamut tier came by its base. */
export type BaseHow = "set" | "same" | "closest";

/** A mode's base on one gamut tier. */
export interface BaseIn {
  /** What the tier is solved against: the color as entered, when it's the same color. */
  readonly color: string;

  /** It written for the tier: hex on standard screens, color(display-p3 …) or color(rec2020 …) on wider ones. */
  readonly written: string;

  /** Set by hand for this tier, the same color as a narrower tier's, or the closest to a wider tier's. */
  readonly how: BaseHow;

  /** The tier it was set on. */
  readonly from: Gamut;
}

/**
 * Whether a color can be parsed as CSS.
 *
 * @param color  The color.
 * @returns      True when it's a CSS color.
 */
export function isColor(color: string): boolean {
  try {
    getColor(color);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether a gamut tier's screens can show a color.
 *
 * @param color  The color.
 * @param gamut  The tier.
 * @returns      True when it fits.
 */
export function fits(color: string, gamut: Gamut): boolean {
  return inGamut(getColor(color), SPACES[gamut], { epsilon: 0.0005 });
}

/**
 * The narrowest gamut tier that can show a color: the one it's set on when it's entered.
 *
 * @param color  The color.
 * @returns      The tier; ultra for a color past every screen's.
 */
export function home(color: string): Gamut {
  return GAMUTS.find((g) => fits(color, g)) ?? "ultra";
}

/**
 * A color written for a gamut tier, as that tier's colors are: hex on standard screens, four
 * decimals in the tier's color space on wider ones.
 *
 * @param color  A color the tier can show.
 * @param gamut  The tier.
 * @returns      CSS.
 */
export function writtenFor(color: string, gamut: Gamut): string {
  const inSpace = to(getColor(color), SPACES[gamut]);
  if (gamut === "standard")
    return serialize(inSpace, { format: "hex", collapse: false }).toUpperCase();
  const coords = inSpace.coords.map(
    (c) => Math.round(Math.min(1, Math.max(0, c ?? 0)) * 10_000) / 10_000,
  );
  return serialize({ ...inSpace, coords: coords as [number, number, number] });
}

/**
 * The closest color a gamut tier can show, by CSS Color 4: hue and lightness kept, colorfulness
 * lowered until it fits.
 *
 * @param color  The color.
 * @param gamut  The tier.
 * @returns      It written for the tier.
 */
export function closestIn(color: string, gamut: Gamut): string {
  return writtenFor(serialize(toGamutCSS(getColor(color), { space: SPACES[gamut] })), gamut);
}

/**
 * A mode's base on a gamut tier. It's set by hand on a tier when a base is given for that tier, or
 * when it's the base entered and that is the narrowest tier showing it. Otherwise it comes from the
 * nearest tier set by hand: the widest narrower one, as the same color, or else the narrowest wider
 * one, as the closest color this tier can show.
 *
 * @param settings  The bases.
 * @param mode      The mode.
 * @param gamut     The tier.
 * @returns         The base, how it came, and from which tier.
 */
export function baseIn(
  settings: Pick<Settings, "bases" | "gamutBases">,
  mode: Mode,
  gamut: Gamut,
): BaseIn {
  const set = new Map<Gamut, string>();
  const entered = settings.bases[mode];
  set.set(home(entered), entered);
  for (const g of GAMUTS) {
    const given = settings.gamutBases[g]?.[mode];
    if (given) set.set(g, given);
  }
  const own = set.get(gamut);
  if (own) return { color: own, written: writtenFor(own, gamut), how: "set", from: gamut };
  const at = GAMUTS.indexOf(gamut);
  const narrower = GAMUTS.slice(0, at)
    .toReversed()
    .find((g) => set.has(g));
  if (narrower) {
    const color = set.get(narrower)!;
    return { color, written: writtenFor(color, gamut), how: "same", from: narrower };
  }
  const wider = GAMUTS.slice(at + 1).find((g) => set.has(g))!;
  const color = closestIn(set.get(wider)!, gamut);
  return { color, written: color, how: "closest", from: wider };
}

/**
 * The settings as a gamut tier solves them: each mode's base resolved for that tier.
 *
 * @param settings  The settings.
 * @param gamut     The tier.
 * @returns         The same settings with that tier's bases.
 */
export function forGamut<T extends Pick<Settings, "bases" | "gamutBases">>(
  settings: T,
  gamut: Gamut,
): T {
  const bases = Object.fromEntries(
    MODES.map((m) => [m, baseIn(settings, m, gamut).color]),
  ) as Record<Mode, string>;
  return { ...settings, bases };
}
