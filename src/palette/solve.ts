/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< SOLVE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Solves a palette from settings: every hue on every APCA tier, default and muted, for light and   |
| dark and every gamut tier, each exactly on its tier, equally colorful and evenly spaced around   |
| the yellow anchor.                                                                               |
\*------------------------------------------------------------------------------------------------*/

import { apca, composition, makeModel, type Model, wcag, wcagLevel } from "./model";
import { anchorHue } from "./references";
import { type Gamut, GAMUTS, type Mode, MODES, NAMES, type Settings } from "./settings";

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

  /** The colorfulness it aimed at, and whether the screen held it below that. */
  readonly target: number;
  readonly short: boolean;
}

export interface Color {
  readonly key: string;
  readonly target: number;

  /** Whether it's an extra color: on its own hue, not spaced with the others. */
  readonly extra: boolean;
  readonly tiers: Readonly<
    Record<number, { readonly default: Swatch; readonly muted: Swatch | null }>
  >;
}

export interface ModePalette {
  readonly base: string;
  readonly colors: readonly Color[];

  /** Per tier, the colorfulness its colors aim at (before the curve). */
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

/**
 * The colorfulness a mode's curve adds at a hue.
 *
 * @param settings  The settings.
 * @param mode      The mode.
 * @param hue       CAM16 hue.
 * @returns         Every point's addition there, added up.
 */
export function boost(settings: Pick<Settings, "curve">, mode: Mode, hue: number): number {
  return settings.curve[mode].reduce((sum, { amount, center, width, off }) => {
    if (off) return sum;
    const away = Math.abs(((((hue - center) % 360) + 540) % 360) - 180);
    return away >= width ? sum : sum + (amount * (1 + Math.cos((Math.PI * away) / width))) / 2;
  }, 0);
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
  /** The colors that don't move: the placed ones. */
  readonly fixed: readonly number[];
  readonly window: number;

  /** How close neighbors may come, in degrees: no color passes another. */
  readonly sep: number;

  /** The colorfulness a hue aims at. */
  readonly target: (hue: number) => number;
}

/**
 * Hues moved, each within a window of its start, until neighbors are equally different.
 *
 * Placed colors stay where they are, and no color comes closer than `sep` to a neighbor, so the
 * lineup keeps its order.
 *
 * @param spacing  What to space, where, and how far hues may move.
 * @returns        The hues, their colors and the neighbor distances.
 */
function space({ model, base, mode, tier, start, fixed, window, sep, target }: Spacing) {
  const ring = (cs: readonly string[]) =>
    cs.map((c, i) => model.distance(mode, c, cs[(i + 1) % cs.length]!));
  const hues = [...start];
  const colors = hues.map((h) => strongest(model, base, mode, h, target(h), tier));
  let best = spread(ring(colors));
  for (let pass = 0; pass < 8; pass++) {
    let improved = false;
    for (let i = 0; i < hues.length; i++) {
      if (fixed.includes(i)) continue;
      for (const step of [-3, 3, -1, 1]) {
        const hue = hues[i]! + step;
        if (Math.abs(hue - start[i]!) > window) continue;
        const [before, after] = [
          hues[(i - 1 + hues.length) % hues.length]!,
          hues[(i + 1) % hues.length]!,
        ];
        if ((((hue - before) % 360) + 360) % 360 < sep || (((after - hue) % 360) + 360) % 360 < sep)
          continue;
        const trial = [...colors];
        trial[i] = strongest(model, base, mode, hue, target(hue), tier);
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

/** How close neighbors may come, as a share of the even step between them. */
export const CLOSEST = 0.25;

/**
 * The lineup: every color in order around the circle from the anchor (yellow, with eight, then
 * green, mint, blue, purple, pink, red, orange), with the hue it starts from, unwrapped so they rise
 * from the anchor. A color starts where it's placed, or else where the circle divided evenly puts
 * it. Placed colors are kept in order: each stays at least a quarter of the even step from the
 * colors beside it.
 *
 * @param settings  The settings.
 * @returns         The keys, their hues (rising from the anchor), which stay put, and the closest
 *                  neighbors may come.
 */
export function lineup(settings: Pick<Settings, "hues" | "placed" | "anchor" | "bases" | "rooms">) {
  const n = settings.hues;
  const first = NAMES.indexOf("yellow");
  const keys = Array.from({ length: n }, (_, k) =>
    n === NAMES.length ? NAMES[(first + k) % n]! : `hue-${String(k + 1)}`,
  );
  const anchor = anchorHue(settings);
  const step = 360 / n;
  const sep = step * CLOSEST;
  const held = keys.map((key, k) => k === 0 || settings.placed[key] !== undefined);
  const hues = keys.map((key, k) => {
    const placed = k === 0 ? undefined : settings.placed[key];
    return placed === undefined
      ? anchor + k * step
      : anchor + ((((placed - anchor) % 360) + 360) % 360);
  });
  // A placed color that passed the next one is brought back before it; then one that fell behind
  // the color before it is brought up.
  for (let k = n - 1; k >= 1; k--)
    if (held[k]) hues[k] = Math.min(hues[k]!, (k === n - 1 ? anchor + 360 : hues[k + 1]!) - sep);
  for (let k = 1; k < n; k++) if (held[k]) hues[k] = Math.max(hues[k]!, hues[k - 1]! + sep);
  return { keys, hues, held, sep };
}

/**
 * Where a held color may go without passing a neighbor: a placed color between the colors beside
 * it; the anchor as far as the colors it carries can go without passing a placed one.
 *
 * @param settings  The settings.
 * @param key       The color.
 * @returns         The lowest and highest hue, unwrapped (high may pass 360).
 */
export function bounds(
  settings: Pick<Settings, "hues" | "placed" | "anchor" | "bases" | "rooms">,
  key: string,
): [number, number] {
  const { keys, hues, held, sep } = lineup(settings);
  const n = keys.length;
  const k = keys.indexOf(key);
  if (k > 0) return [hues[k - 1]! + sep, (k === n - 1 ? hues[0]! + 360 : hues[k + 1]!) - sep];
  // The anchor carries every color that isn't placed; each must stay between the placed ones.
  const placed = hues.flatMap((h, j) => (j > 0 && held[j] ? [h] : []));
  if (!placed.length) return [hues[0]! - 180, hues[0]! + 180];
  let [low, high] = [-Infinity, Infinity];
  for (let j = 0; j < n; j++) {
    if (j > 0 && held[j]) continue;
    const below = Math.max(...placed.filter((h) => h < hues[j]!), Math.max(...placed) - 360);
    const above = Math.min(...placed.filter((h) => h > hues[j]!), Math.min(...placed) + 360);
    low = Math.max(low, below + sep - hues[j]!);
    high = Math.min(high, above - sep - hues[j]!);
  }
  return [hues[0]! + low, hues[0]! + high];
}

/**
 * The hues both modes start from, in hue order, and which of them stay put: the lineup, wrapped
 * onto the circle. The anchor and placed colors stay; the rest are spaced.
 *
 * @param settings  The settings.
 * @returns         The keys, starting hues, the indexes of the colors that stay put, and the closest
 *                  neighbors may come.
 */
function seeds(settings: Settings) {
  const { keys, hues, held, sep } = lineup(settings);
  const order = hues.map((h, k) => [h % 360, k] as const).toSorted((a, b) => a[0] - b[0]);
  return {
    keys: order.map(([, k]) => keys[k]!),
    start: order.map(([h]) => h),
    fixed: order.flatMap(([, k], i) => (held[k] ? [i] : [])),
    sep,
  };
}

/** Words the site's pages use in its address, so no color's key can take one. */
const TAKEN = [
  "overview",
  "tiers",
  "colors",
  "compare",
  "how",
  "algorithm",
  "curve-test",
  "hue-test",
  "tune",
  "export",
  "references",
];

/**
 * The extra colors' keys: each name in lowercase words joined by hyphens, numbered when it would
 * repeat a hue's key, another extra's or a page's.
 *
 * @param settings  The settings.
 * @returns         One key per extra color, in order.
 */
export function extraKeys(settings: Settings): string[] {
  const used = new Set([...TAKEN, ...lineup(settings).keys]);
  return settings.extras.map((extra) => {
    const word =
      extra.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "extra";
    let key = word;
    for (let n = 2; used.has(key); n++) key = `${word}-${String(n)}`;
    used.add(key);
    return key;
  });
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
    target: round(target),
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
  const { keys, start, fixed, sep } = seeds(settings);
  const extras = extraKeys(settings);
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
    const aim = (hue: number) => target + boost(settings, mode, hue);
    const spaced = space({ model, base, mode, fixed, tier, start: hues, window, sep, target: aim });
    return { target, limit, targets: spaced.hues.map(aim), ...spaced };
  };

  const identity = solveTier(settings.identityTier[mode], start, window);
  const tiers: Record<number, Record<string, { default: Swatch; muted: Swatch | null }>> = {};
  const targets: Record<number, number> = {};
  const limits: Record<number, string | null> = {};
  const ring: Record<number, number[]> = {};
  for (const tier of settings.tiers) {
    const solved =
      tier === settings.identityTier[mode]
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
    settings.extras.forEach((extra, i) => {
      const target = solved.target * extra.share;
      const def = swatch(
        model,
        base,
        mode,
        strongest(model, base, mode, extra.hue, target, tier),
        target,
      );
      const quiet = def.colorfulness * settings.muted;
      const muted = swatch(
        model,
        base,
        mode,
        strongest(model, base, mode, extra.hue, quiet, tier),
        quiet,
      );
      tiers[tier]![extras[i]!] = { default: def, muted };
    });
  }
  const colors = [
    ...keys.map((key) => ({ key, target: settings.colorfulness, extra: false })),
    ...settings.extras.map((e, i) => ({
      key: extras[i]!,
      target: settings.colorfulness * e.share,
      extra: true,
    })),
  ].map((c) => ({
    ...c,
    tiers: Object.fromEntries(settings.tiers.map((t) => [t, tiers[t]![c.key]!])),
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
