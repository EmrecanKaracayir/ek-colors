/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< SOLVE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Solves a palette from settings: every hue on every APCA tier, default and muted, for light and   |
| dark and every gamut tier, each exactly on its tier, equally colorful and evenly spaced around   |
| the yellow anchor.                                                                               |
\*------------------------------------------------------------------------------------------------*/

import { apca, composition, makeModel, type Model, wcag, wcagLevel } from "./model";
import { type Gamut, GAMUTS, type Mode, MODES, NAMES, type Settings, CODEMOS } from "./settings";

export interface Swatch {
  /** The color as CSS: #RRGGBB on the standard tier, color() on wider ones. */
  readonly color: string;
  readonly hue: number;
  readonly chroma: number;
  readonly colorfulness: number;
  readonly lightness: number;
  readonly name: string;
  readonly apca: number;
  readonly wcag: number;
  readonly wcagLevel: ReturnType<typeof wcagLevel>;

  /** Whether the screen held it below its colorfulness target. */
  readonly short: boolean;
}

export interface Color {
  readonly key: string;
  readonly target: number;
  readonly tiers: Readonly<
    Record<number, { readonly default: Swatch; readonly muted: Swatch | null }>
  >;
}

export interface ModePalette {
  readonly base: string;
  readonly colors: readonly Color[];

  /** Per tier, the colorfulness its colors aim at (before exceptions). */
  readonly targets: Readonly<Record<number, number>>;

  /** Per tier, the color whose reach lowered the target, or null when every color reaches it. */
  readonly limits: Readonly<Record<number, string | null>>;

  /** Per tier, each hue's distance to the next around the circle (CAM16-UCS). */
  readonly ring: Readonly<Record<number, readonly number[]>>;
}

/** Both modes on one gamut tier. */
export type GamutPalette = Readonly<Record<Mode, ModePalette>>;

/** Every gamut tier, each solved on its own. */
export type Palette = Readonly<Record<Gamut, GamutPalette>>;

/* >------------------------------------< Placing a color >-------------------------------------< */

/**
 * The color at a hue and colorfulness that sits exactly on a tier.
 *
 * Its CAM16 lightness is searched until APCA against the base just reaches the tier: the lowest
 * that does in dark mode, the highest in light mode, so it is never below the tier and only as far
 * above as rounding forces.
 *
 * @param model          The color model.
 * @param base           The background.
 * @param mode           The mode.
 * @param hue            CAM16 hue.
 * @param colorfulness  CAM16 colorfulness.
 * @param tier           The APCA contrast to sit on.
 * @returns              The color, or null when no color that colorful reaches the tier.
 */
function place(
  model: Model,
  base: string,
  mode: Mode,
  hue: number,
  colorfulness: number,
  tier: number,
) {
  const dark = mode === "dark";
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 34; i++) {
    const m = (lo + hi) / 2;
    const color = model.colorAt(mode, hue, colorfulness, m);
    const passes = color !== null && apca(color, base) >= tier;
    // Off-screen counts as too far from the base, so the search moves back towards it.
    if (dark) passes || color === null ? (hi = m) : (lo = m);
    else passes || color === null ? (lo = m) : (hi = m);
  }
  const color = model.colorAt(mode, hue, colorfulness, dark ? hi : lo);
  return color !== null && apca(color, base) >= tier ? color : null;
}

/**
 * The most colorfulness, up to a target, a hue can hold on a tier.
 *
 * @param model   The color model.
 * @param base    The background.
 * @param mode    The mode.
 * @param hue     CAM16 hue.
 * @param target  The colorfulness wanted.
 * @param tier    The tier.
 * @returns       The color.
 *
 * @throws        When not even a gray reaches the tier.
 */
export function strongest(
  model: Model,
  base: string,
  mode: Mode,
  hue: number,
  target: number,
  tier: number,
): string {
  const full = place(model, base, mode, hue, target, tier);
  if (full) return full;
  let lo = 0;
  let hi = target;
  for (let i = 0; i < 18; i++) {
    const m = (lo + hi) / 2;
    place(model, base, mode, hue, m, tier) ? (lo = m) : (hi = m);
  }
  const color = place(model, base, mode, hue, lo, tier);
  if (!color) throw new Error(`No ${mode} color at hue ${String(hue)} reaches Lc ${String(tier)}.`);
  return color;
}

/* >----------------------------------------< Spacing >-----------------------------------------< */

/**
 * How unevenly spaced a ring of distances is.
 *
 * @param distances  Neighbor distances.
 * @returns          Their standard deviation.
 */
function spread(distances: readonly number[]): number {
  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  return Math.sqrt(distances.reduce((a, d) => a + (d - mean) ** 2, 0) / distances.length);
}

interface Spacing {
  readonly model: Model;
  readonly base: string;
  readonly mode: Mode;
  readonly tier: number;
  readonly start: readonly number[];
  readonly anchor: number;
  readonly window: number;
  readonly targets: readonly number[];
}

/**
 * Hues moved, each within a window of its start, until neighbors are equally different.
 *
 * The anchor (yellow) stays where it is.
 *
 * @param spacing  What to space, where, and how far hues may move.
 * @returns        The hues, their colors and the neighbor distances.
 */
function space({ model, base, mode, tier, start, anchor, window, targets }: Spacing) {
  const ring = (cs: readonly string[]) =>
    cs.map((c, i) => model.distance(mode, c, cs[(i + 1) % cs.length]!));
  const hues = [...start];
  const colors = hues.map((h, i) => strongest(model, base, mode, h, targets[i]!, tier));
  let best = spread(ring(colors));
  for (let pass = 0; pass < 8; pass++) {
    let improved = false;
    for (let i = 0; i < hues.length; i++) {
      if (i === anchor) continue;
      for (const step of [-3, 3, -1, 1]) {
        const hue = hues[i]! + step;
        if (Math.abs(hue - start[i]!) > window) continue;
        const trial = [...colors];
        trial[i] = strongest(model, base, mode, hue, targets[i]!, tier);
        const score = spread(ring(trial));
        if (score < best - 1e-4)
          [best, hues[i], colors[i], improved] = [score, hue, trial[i]!, true];
      }
    }
    if (!improved) break;
  }
  return { hues, colors, ring: ring(colors) };
}

/* >----------------------------------------< Palette >-----------------------------------------< */

/**
 * The hues a mode starts from, in hue order, with which one is yellow.
 *
 * Eight hues start from Codemos and keep its names; any other count is spread evenly around the
 * circle from yellow and named later by CAM16.
 *
 * @param settings  The settings.
 * @param model     The color model.
 * @param mode      The mode.
 * @returns         The keys, starting hues and the anchor's index.
 */
function seeds(settings: Settings, model: Model, mode: Mode) {
  if (settings.hues === NAMES.length) {
    const start = NAMES.map((n) =>
      n === "yellow" ? settings.yellowHue[mode] : model.cam(mode, CODEMOS[mode][n]!).hue,
    );
    return { keys: [...NAMES] as string[], start, anchor: NAMES.indexOf("yellow") };
  }
  const step = 360 / settings.hues;
  const start = Array.from(
    { length: settings.hues },
    (_, k) => (settings.yellowHue[mode] + k * step) % 360,
  );
  const order = start.map((h, i) => [h, i] as const).toSorted((a, b) => a[0] - b[0]);
  return {
    keys: order.map(([, i]) => `hue-${String(i + 1)}`),
    start: order.map(([h]) => h),
    anchor: order.findIndex(([, i]) => i === 0),
  };
}

/**
 * A color described for output and display.
 *
 * @param model   The color model.
 * @param base    The background.
 * @param mode    The mode.
 * @param color   The color.
 * @param target  The colorfulness it aimed at.
 * @returns       Its CAM16 description, name and contrasts.
 */
function swatch(model: Model, base: string, mode: Mode, color: string, target: number): Swatch {
  const c = model.cam(mode, color);
  const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
  const ratio = wcag(color, base);
  return {
    color,
    hue: round(c.hue),
    chroma: round(c.chroma),
    colorfulness: round(c.m),
    lightness: round(c.j),
    name: composition(c.hue),
    apca: round(apca(color, base)),
    wcag: round(ratio, 2),
    wcagLevel: wcagLevel(ratio),
    short: c.m < target - 1,
  };
}

/**
 * Every tier of one mode.
 *
 * The identity tier is spaced first; every other tier starts from its hues and may move them a
 * little, so each tier is evenly spaced in its own right. With equal tiers, every color on a tier
 * is equally colorful.
 *
 * @param settings  The settings.
 * @param model     The color model.
 * @param mode      The mode.
 * @returns         The mode's colors on every tier.
 */
function solveMode(settings: Settings, model: Model, mode: Mode): ModePalette {
  const base = settings.bases[mode];
  const { keys, start, anchor } = seeds(settings, model, mode);
  const offsets = keys.map((k) => settings.offsets[mode][k] ?? 0);
  const window =
    settings.hues === NAMES.length
      ? settings.hueWindow.identity
      : Math.min(settings.hueWindow.identity, 180 / settings.hues);

  // On an equal tier, the target drops to what its least colorful hue can reach.
  const ceiling = (tier: number, hues: readonly number[]) => {
    if (!settings.equalTiers) return { target: settings.colorfulness, limit: null };
    const reach = hues.map((h) => model.cam(mode, strongest(model, base, mode, h, 200, tier)).m);
    const least = reach.indexOf(Math.min(...reach));
    return reach[least]! < settings.colorfulness
      ? { target: reach[least]!, limit: keys[least]! }
      : { target: settings.colorfulness, limit: null };
  };
  const solveTier = (tier: number, hues: readonly number[], window: number) => {
    const { target, limit } = ceiling(tier, hues);
    const targets = offsets.map((o) => target + o);
    return {
      target,
      limit,
      targets,
      ...space({ model, base, mode, anchor, tier, start: hues, window, targets }),
    };
  };

  const identity = solveTier(settings.identityTier, start, window);
  const tiers: Record<number, Record<string, { default: Swatch; muted: Swatch | null }>> = {};
  const targets: Record<number, number> = {};
  const limits: Record<number, string | null> = {};
  const ring: Record<number, number[]> = {};
  for (const tier of settings.tiers) {
    const solved =
      tier === settings.identityTier
        ? identity
        : solveTier(tier, identity.hues, settings.hueWindow.tier);
    tiers[tier] = {};
    targets[tier] = Math.round(solved.target * 10) / 10;
    limits[tier] = solved.limit;
    ring[tier] = solved.ring.map((d) => Math.round(d * 10) / 10);
    keys.forEach((key, i) => {
      const def = swatch(model, base, mode, solved.colors[i]!, solved.targets[i]!);
      const quiet = def.colorfulness * settings.muted;
      const muted = swatch(
        model,
        base,
        mode,
        strongest(model, base, mode, solved.hues[i]!, quiet, tier),
        quiet,
      );
      tiers[tier]![key] = { default: def, muted };
    });
    if (settings.brown !== null) {
      const target = solved.target * settings.brown;
      const hue = model.cam(mode, CODEMOS[mode]["brown"]!).hue;
      tiers[tier]!["brown"] = {
        default: swatch(model, base, mode, strongest(model, base, mode, hue, target, tier), target),
        muted: null,
      };
    }
  }
  const allKeys = settings.brown === null ? keys : [...keys, "brown"];
  const colors = allKeys.map((key) => ({
    key,
    target:
      key === "brown"
        ? settings.colorfulness * (settings.brown ?? 0)
        : settings.colorfulness + offsets[keys.indexOf(key)]!,
    tiers: Object.fromEntries(settings.tiers.map((t) => [t, tiers[t]![key]!])),
  }));
  return { base, colors, targets, limits, ring };
}

/**
 * Both modes on one gamut tier.
 *
 * @param settings  What to solve from.
 * @param gamut     The gamut tier colors must fit.
 * @returns         The palette for that tier.
 */
export function solveGamut(settings: Settings, gamut: Gamut): GamutPalette {
  const model = makeModel(settings, gamut);
  return Object.fromEntries(
    MODES.map((mode) => [mode, solveMode(settings, model, mode)]),
  ) as GamutPalette;
}

/**
 * A whole palette: every gamut tier, both modes, every tier, default and muted.
 *
 * @param settings  What to solve from.
 * @returns         The palette.
 */
export function solvePalette(settings: Settings): Palette {
  return Object.fromEntries(GAMUTS.map((gamut) => [gamut, solveGamut(settings, gamut)])) as Palette;
}
