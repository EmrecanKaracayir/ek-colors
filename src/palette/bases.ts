/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< BASES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Each mode has one base, a color of any gamut. Every gamut tier shows it as well as its screens   |
| can: exactly where they can show it, else as the closest color they can, by CSS Color 4's gamut  |
| mapping. A narrower tier's color can be picked by hand, as long as it's still the same           |
| background: no further from the base than the closest color is, by a just-visible step.         |
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

import { makeModel, type Model } from "./model";
import { type Gamut, GAMUTS, type Mode, MODES, type Settings } from "./settings";

for (const space of [sRGB, P3, REC_2020, OKLab, OKLCH]) ColorSpace.register(space);

/** The color space each gamut tier's colors are written in. */
const SPACES = { standard: sRGB, wide: P3, ultra: REC_2020 } as const satisfies Record<
  Gamut,
  unknown
>;

/** How far a picked color may be from the base past the closest color's distance: a just-visible step, ΔE. */
export const PICK_MARGIN = 2;

/** How a gamut tier shows its base. */
export type BaseHow = "exact" | "closest" | "picked";

/** A mode's base on one gamut tier. */
export interface BaseIn {
  /** What the tier is solved against: the base as given, where the tier shows it exactly. */
  readonly color: string;

  /** It written for the tier: hex on standard screens, color(display-p3 …) or color(rec2020 …) on wider ones. */
  readonly written: string;

  /** The base itself, the closest color the tier can show to it, or one picked by hand. */
  readonly how: BaseHow;

  /** How far it is from the base, ΔE: 0 when exact. */
  readonly off: number;
}

/** The bases' settings, and the rooms they're seen in. */
type BaseSettings = Pick<Settings, "bases" | "gamutBases" | "rooms">;

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
 * The narrowest gamut tier that can show a color: from there up, it's shown exactly.
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

const models = new Map<string, Model>();

/**
 * How far two colors are apart as seen on a mode's base, in its room: CAM16-UCS ΔE, the scale the
 * palette's differences are told in.
 *
 * @param settings  The bases and rooms.
 * @param mode      The mode.
 * @param a         One color.
 * @param b         The other.
 * @returns         ΔE.
 */
export function apart(settings: BaseSettings, mode: Mode, a: string, b: string): number {
  const key = JSON.stringify([settings.bases, settings.rooms]);
  let model = models.get(key);
  if (!model) models.set(key, (model = makeModel(settings)));
  return model.distance(mode, a, b);
}

/**
 * Whether a color picked for a gamut tier is still the mode's background: no further from the base
 * than the closest color the tier can show is, by a just-visible step.
 *
 * @param settings  The bases and rooms.
 * @param mode      The mode.
 * @param gamut     The tier.
 * @param color     The color picked.
 * @returns         How far it is, how far the closest is, and whether it's the same background.
 */
export function pickCheck(settings: BaseSettings, mode: Mode, gamut: Gamut, color: string) {
  const base = settings.bases[mode];
  const off = apart(settings, mode, base, color);
  const loss = apart(settings, mode, base, closestIn(base, gamut));
  return { off, loss, same: off <= loss + PICK_MARGIN };
}

/**
 * A mode's base on a gamut tier: the base itself where the tier's screens show it; below that, a
 * color picked by hand for the tier while it's still the same background, or else the closest the
 * tier can show to the next wider tier's, so a pick on a wider tier carries down.
 *
 * @param settings  The bases, the colors picked and the rooms.
 * @param mode      The mode.
 * @param gamut     The tier.
 * @returns         The base on the tier, and how it got there.
 */
export function baseIn(settings: BaseSettings, mode: Mode, gamut: Gamut): BaseIn {
  const base = settings.bases[mode];
  const from = GAMUTS.indexOf(home(base));
  const at = GAMUTS.indexOf(gamut);
  if (at >= from) return { color: base, written: writtenFor(base, gamut), how: "exact", off: 0 };
  let above = base;
  let shown: BaseIn = { color: base, written: base, how: "exact", off: 0 };
  for (let i = from - 1; i >= at; i--) {
    const g = GAMUTS[i]!;
    const picked = settings.gamutBases[g]?.[mode];
    const check = picked ? pickCheck(settings, mode, g, picked) : null;
    shown =
      picked && check!.same
        ? { color: picked, written: writtenFor(picked, g), how: "picked", off: check!.off }
        : (() => {
            const closest = closestIn(above, g);
            return {
              color: closest,
              written: closest,
              how: "closest" as const,
              off: apart(settings, mode, base, closest),
            };
          })();
    above = shown.color;
  }
  return shown;
}

/**
 * The settings as a gamut tier solves them: each mode's base as that tier shows it.
 *
 * @param settings  The settings.
 * @param gamut     The tier.
 * @returns         The same settings with that tier's bases.
 */
export function forGamut<T extends BaseSettings>(settings: T, gamut: Gamut): T {
  const bases = Object.fromEntries(
    MODES.map((m) => [m, baseIn(settings, m, gamut).color]),
  ) as Record<Mode, string>;
  return { ...settings, bases };
}

/**
 * The settings with only the picks that still count: for a tier narrower than the base's, and
 * still the same background. A base changed under a pick takes it back to the closest color.
 *
 * @param settings  The settings.
 * @returns         The settings, and the picks let go, e.g. "the light color for standard screens".
 */
export function keptPicks<T extends BaseSettings>(settings: T): { settings: T; dropped: string[] } {
  const dropped: string[] = [];
  const gamutBases = Object.fromEntries(
    GAMUTS.flatMap((g) => {
      const kept = MODES.flatMap((m) => {
        const picked = settings.gamutBases[g]?.[m];
        if (!picked) return [];
        const narrower = GAMUTS.indexOf(g) < GAMUTS.indexOf(home(settings.bases[m]));
        if (narrower && fits(picked, g) && pickCheck(settings, m, g, picked).same)
          return [[m, picked]];
        dropped.push(`the ${m} color for ${g} screens`);
        return [];
      });
      return kept.length ? [[g, Object.fromEntries(kept)]] : [];
    }),
  );
  return { settings: dropped.length ? { ...settings, gamutBases } : settings, dropped };
}
