/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< BASES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Each mode has one base, a color of any gamut. Every gamut tier shows it as well as its screens   |
| can: exactly where they can show it, else as the closest color they can, by CSS Color 4's gamut  |
| mapping. A narrower tier's color can be picked by hand, as long as it's still the same           |
| background: no further from the base than the closest color is, by a just-visible step.         |
\*------------------------------------------------------------------------------------------------*/

import { getColor, serialize, toGamutCSS } from "colorjs.io/fn";

import { fits, JUST_VISIBLE, makeModel, type Model, SPACES, writtenFor } from "./model";
import { type Gamut, GAMUTS, type Mode, MODES, type Settings } from "./settings";

export { fits, writtenFor };

/** How a gamut tier shows its base. */
export type BaseHow = "exact" | "closest" | "picked";

/** A mode's base on one gamut tier. */
export interface BaseIn {
  /** What the tier is solved against: the base as given where the tier shows it exactly, else the closest or the picked color. */
  readonly color: string;

  /** That color as the tier writes it: hex on standard screens, color(display-p3 …) or color(rec2020 …) on wider ones. */
  readonly written: string;

  /** The base itself, the closest color the tier can show to it, or one picked by hand. */
  readonly how: BaseHow;

  /** How far it is from the base, ΔE: 0 when exact. */
  readonly off: number;
}

/** The bases and the rooms they're seen in. */
type Viewing = Pick<Settings, "bases" | "rooms">;

/** The bases, the colors picked for them and the rooms they're seen in. */
type BaseSettings = Viewing & Pick<Settings, "pickedBases">;

/**
 * Whether a color can be a base: a CSS color, fully opaque, as a background is.
 *
 * @param color  The color.
 * @returns      True when it's an opaque CSS color.
 */
export function isBaseColor(color: string): boolean {
  if (/[<>"'&]/.test(color)) return false;
  try {
    const parsed = getColor(color);
    return (
      (parsed.alpha ?? 1) === 1 && parsed.coords.every((c) => c === null || Number.isFinite(c))
    );
  } catch {
    return false;
  }
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
export function apart(settings: Viewing, mode: Mode, a: string, b: string): number {
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
export function pickCheck(settings: Viewing, mode: Mode, gamut: Gamut, color: string) {
  const base = settings.bases[mode];
  const off = apart(settings, mode, base, color);
  const loss = apart(settings, mode, base, closestIn(base, gamut));
  return { off, loss, same: off <= loss + JUST_VISIBLE };
}

/**
 * What's wrong with a color picked for a gamut tier, if anything: the tier has to be one that can't
 * show the base, able to show the color, and the color still the same background.
 *
 * @param settings  The bases and rooms.
 * @param mode      The mode.
 * @param gamut     The tier.
 * @param color     The color picked.
 * @returns         The problem as a sentence, or null when the pick holds.
 */
export function pickProblem(
  settings: Viewing,
  mode: Mode,
  gamut: Gamut,
  color: string,
): string | null {
  if (!fits(color, gamut))
    return `The ${mode} color picked for ${gamut} screens is one they can't show.`;
  if (GAMUTS.indexOf(gamut) >= GAMUTS.indexOf(home(settings.bases[mode])))
    return `${gamut[0]!.toUpperCase()}${gamut.slice(1)} screens show the ${mode} base exactly, so no color is picked for them.`;
  const check = pickCheck(settings, mode, gamut, color);
  return check.same
    ? null
    : `The ${mode} color picked for ${gamut} screens is a different background from the ${mode} base: ΔE ${check.off.toFixed(1)} from it, where the closest color is ΔE ${check.loss.toFixed(1)}.`;
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
  let shown: BaseIn | undefined;
  for (let i = from - 1; i >= at; i--) {
    const g = GAMUTS[i]!;
    const picked = settings.pickedBases[g]?.[mode];
    const check = picked ? pickCheck(settings, mode, g, picked) : null;
    if (picked && check?.same) {
      shown = { color: picked, written: writtenFor(picked, g), how: "picked", off: check.off };
    } else {
      const closest = closestIn(above, g);
      shown = {
        color: closest,
        written: closest,
        how: "closest",
        off: apart(settings, mode, base, closest),
      };
    }
    above = shown.color;
  }
  return shown!;
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
  const pickedBases = Object.fromEntries(
    GAMUTS.flatMap((g) => {
      const kept = MODES.flatMap((m) => {
        const picked = settings.pickedBases[g]?.[m];
        if (!picked) return [];
        if (!pickProblem(settings, m, g, picked)) return [[m, picked]];
        dropped.push(`the ${m} color for ${g} screens`);
        return [];
      });
      return kept.length ? [[g, Object.fromEntries(kept)]] : [];
    }),
  );
  return { settings: dropped.length ? { ...settings, pickedBases } : settings, dropped };
}
