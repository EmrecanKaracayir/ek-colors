/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< SOLVE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Solves a palette from settings: every hue on every APCA tier, default and muted, for light and   |
| dark and every gamut tier, each exactly on its tier, equally colorful and evenly spaced around   |
| the yellow anchor.                                                                               |
\*------------------------------------------------------------------------------------------------*/

import {
  apca,
  composition,
  darkBase,
  grayLevel,
  hueTurn,
  makeModel,
  type Model,
  wcag,
  wcagLevel,
  wrapHue,
} from "./model";
import { forGamut } from "./bases";
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

  /** The colorfulness it aims at before any tier lowers it and before the curve: a custom color's share of the target, or the target. */
  readonly target: number;

  /** Whether it's a custom color: on its own hue, not spaced with the others. */
  readonly custom: boolean;
  readonly tiers: Readonly<Record<number, { readonly default: Swatch; readonly muted: Swatch }>>;
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

  /** Per tier, the gray on it: no color at all, its red, green and blue the same. */
  readonly grays: Readonly<Record<number, Swatch>>;

  /** Whether the base is tinted: at least M 4, the band's bottom. */
  readonly tinted: boolean;

  /** Each neutral color per tier: on a tinted base it follows the base, on a gray base it's the grays. */
  readonly neutrals: readonly NeutralColor[];
}

/** A neutral color as solved: its key, its share of the base's tint, and its swatch per tier. */
export interface NeutralColor {
  readonly key: string;
  readonly share: number;
  readonly tiers: Readonly<Record<number, Swatch>>;
}

/** Both modes on one gamut tier. */
export type GamutPalette = Readonly<Record<Mode, ModePalette>>;

/** Every gamut tier, each solved on its own. */
export type Palette = Readonly<Record<Gamut, GamutPalette>>;

/* >------------------------------------< Placing a color >-------------------------------------< */

const darkness = new Map<string, boolean>();

/**
 * Whether a base is dark, worked out once per base: the search asks it every time.
 *
 * @param base  The background.
 * @returns     True for a dark base.
 */
function isDark(base: string): boolean {
  let dark = darkness.get(base);
  if (dark === undefined) darkness.set(base, (dark = darkBase(base)));
  return dark;
}

/**
 * The color at a hue and colorfulness that sits exactly on a tier.
 *
 * Its CAM16 lightness is searched until APCA against the base just reaches the tier: the lowest
 * that does on a dark base, the highest on a light one, so it is never below the tier and only as
 * far above as rounding forces.
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
): string | null {
  const dark = isDark(base);
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 32; i++) {
    const m = (lo + hi) / 2;
    // A color the screen shows is judged as it's written, so the one found passes as written; one
    // it can't show is judged by its contrast all the same, since it can be off the screen on either
    // side of the tier, and being off it says nothing about which way to go.
    const color = model.colorAt(mode, hue, colorfulness, m);
    const passes =
      (color === null ? model.contrastAt(mode, hue, colorfulness, m, base) : apca(color, base)) >=
      tier;
    if (dark) passes ? (hi = m) : (lo = m);
    else passes ? (lo = m) : (hi = m);
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
    const away = Math.abs(hueTurn(center, hue));
    return away >= width ? sum : sum + (amount * (1 + Math.cos((Math.PI * away) / width))) / 2;
  }, 0);
}

/* >----------------------------------------< Spacing >-----------------------------------------< */

/**
 * How different each color looks from the next one around the circle.
 *
 * @param model   The color model.
 * @param mode    The mode.
 * @param colors  The colors, in order around the circle.
 * @returns       Each color's distance to the next (CAM16-UCS), the last to the first.
 */
export function neighbors(model: Model, mode: Mode, colors: readonly string[]): number[] {
  return colors.map((c, i) => model.distance(mode, c, colors[(i + 1) % colors.length]!));
}

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

  /** How far, in degrees, a hue may move from its start. */
  readonly reach: number;

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
function space({ model, base, mode, tier, start, fixed, reach, sep, target }: Spacing) {
  const ring = (cs: readonly string[]) => neighbors(model, mode, cs);
  const hues = [...start];
  const colors = hues.map((h) => strongest(model, base, mode, h, target(h), tier));
  let best = spread(ring(colors));
  for (let pass = 0; pass < 8; pass++) {
    let improved = false;
    for (let i = 0; i < hues.length; i++) {
      if (fixed.includes(i)) continue;
      for (const step of [-3, 3, -1, 1]) {
        const hue = hues[i]! + step;
        if (Math.abs(hue - start[i]!) > reach) continue;
        const [before, after] = [
          hues[(i - 1 + hues.length) % hues.length]!,
          hues[(i + 1) % hues.length]!,
        ];
        // A step that comes too close to a neighbor, or passes it, is left out.
        if (hueTurn(before, hue) < sep || hueTurn(hue, after) < sep) continue;
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

/* >----------------------------------------< Neutrals >----------------------------------------< */

/**
 * The colorfulness, in CAM16 M, where a color reads as a neutral: under it the tint hardly shows
 * next to Gray (CAM16 sees M 1–2 even in a pure gray), past it the color reads as a color.
 */
export const NEUTRAL_BAND = [4, 12] as const;

/** Where a new neutral color starts: well inside the neutral range. */
export const NEUTRAL_START = 8;

/**
 * The gray that sits on a tier: the 8-bit gray nearest the base that reaches it, searched on the
 * side away from the base, so it's on the tier from above, as every color is. When none reaches it,
 * the furthest gray.
 *
 * @param base  The background.
 * @param tier  The tier.
 * @returns     The gray, as hex.
 */
export function grayOn(base: string, tier: number): string {
  const dark = isDark(base);
  const gray = (v: number) => `#${v.toString(16).padStart(2, "0").repeat(3).toUpperCase()}`;
  // On a dark base the first lighter gray that reaches the tier; on a light base the one before
  // the first darker gray that doesn't.
  let [lo, hi] = dark ? [grayLevel(base), 256] : [0, grayLevel(base) + 1];
  while (lo < hi) {
    const v = Math.floor((lo + hi) / 2);
    if (apca(gray(v), base) >= tier === dark) hi = v;
    else lo = v + 1;
  }
  return gray(dark ? Math.min(255, lo) : Math.max(0, lo - 1));
}

/**
 * Whether a base has a tint its neutral colors can follow: it's at least as colorful as the band's
 * bottom. A fainter base, a pure gray among them, reads as gray, and so do its neutral colors.
 *
 * @param model  The color model.
 * @param mode   The base's mode, for its room.
 * @param base   The background, as hex.
 * @returns      True when it's tinted.
 */
export function tinted(model: Model, mode: Mode, base: string): boolean {
  return model.cam(mode, base).m >= NEUTRAL_BAND[0];
}

/**
 * The settings with neutral colors only while a base is tinted. On two gray bases a neutral color
 * would be the grays, so there are none.
 *
 * @param settings  The palette's settings.
 * @returns         The same settings, without neutral colors when neither base is tinted.
 */
export function withNeutrals(settings: Settings): Settings {
  if (settings.neutrals.length === 0) return settings;
  return baseHasHue(settings) ? settings : { ...settings, neutrals: [] };
}

/**
 * Whether any base, in either mode on any gamut tier, has a hue its neutral colors can follow.
 *
 * @param settings  The settings.
 * @returns         True when one does.
 */
export function baseHasHue(settings: Settings): boolean {
  return GAMUTS.some((g) => {
    const on = forGamut(settings, g);
    const model = makeModel(on, g);
    return MODES.some((m) => tinted(model, m, on.bases[m]));
  });
}

/** The grays' key, as their page and exports name them; no other color can take it. */
export const GRAY = "gray";

/* >-------------------------------------< Identity tier >--------------------------------------< */

/** The contrast each rule asks of ordinary text: APCA's Lc and WCAG 2's ratio for AA. */
export const TEXT_MINIMUM = { apca: 60, wcag: 4.5 } as const;

/**
 * How near a tier is to reading as text by both contrast rules at once: a gray on the tier, its
 * APCA Lc over APCA's minimum and its WCAG 2 ratio over WCAG's, averaged. At 1, the two rules
 * together are just at their minimum; below, too faint; above, more than text needs.
 *
 * @param base  The background.
 * @param tier  The tier.
 * @returns     The score.
 */
export function textScore(base: string, tier: number): number {
  const gray = grayOn(base, tier);
  return (apca(gray, base) / TEXT_MINIMUM.apca + wcag(gray, base) / TEXT_MINIMUM.wcag) / 2;
}

const automatic = new Map<string, number>();

/**
 * The tier that stands for each hue on a base, when it's left to the palette: the one whose text
 * score is nearest 1, the lower one on a tie.
 *
 * @param base   The background.
 * @param tiers  The tiers solved.
 * @returns      The tier.
 */
export function autoIdentity(base: string, tiers: readonly number[]): number {
  const key = `${base} ${tiers.join(",")}`;
  let tier = automatic.get(key);
  if (tier === undefined) {
    const off = tiers.map((t) => Math.abs(textScore(base, t) - 1));
    tier = tiers[off.indexOf(Math.min(...off))]!;
    automatic.set(key, tier);
  }
  return tier;
}

/**
 * A mode's identity tier: the one set by hand, or the automatic one.
 *
 * @param settings  The bases, tiers and identity tiers.
 * @param mode      The mode.
 * @returns         The tier.
 */
export function identityOf(
  settings: Pick<Settings, "bases" | "tiers" | "identityTier">,
  mode: Mode,
): number {
  const set = settings.identityTier[mode];
  return set === "auto" ? autoIdentity(settings.bases[mode], settings.tiers) : set;
}

/* >----------------------------------------< Palette >-----------------------------------------< */

/** How close neighbors may come, as a share of the even step between them. */
export const CLOSEST = 0.25;

/**
 * The hues' keys in lineup order: with eight, their names from yellow, the anchor; with any other
 * number, hue-1 (the anchor), hue-2 and so on.
 *
 * @param n  How many hues.
 * @returns  The keys.
 */
export function hueKeys(n: number): string[] {
  const first = NAMES.indexOf("yellow");
  return Array.from({ length: n }, (_, k) =>
    n === NAMES.length ? NAMES[(first + k) % n]! : `hue-${String(k + 1)}`,
  );
}

/**
 * The lineup: every color in order around the circle from the anchor (yellow, with eight, then
 * green, mint, blue, purple, pink, red, orange), with the hue it starts from, unwrapped so they rise
 * from the anchor. A color starts where it's placed, or else where the circle divided evenly puts
 * it. Placed colors are kept in order: each stays at least CLOSEST of the even step from the colors
 * beside it.
 *
 * @param settings  The settings.
 * @returns         The keys, their hues (rising from the anchor), which stay put, and the closest
 *                  neighbors may come.
 */
export function lineup(settings: Pick<Settings, "hues" | "placed" | "anchor" | "bases" | "rooms">) {
  const n = settings.hues;
  const keys = hueKeys(n);
  const anchor = anchorHue(settings);
  const step = 360 / n;
  const sep = step * CLOSEST;
  const held = keys.map((key, k) => k === 0 || settings.placed[key] !== undefined);
  const hues = keys.map((key, k) => {
    const placed = k === 0 ? undefined : settings.placed[key];
    return placed === undefined ? anchor + k * step : anchor + wrapHue(placed - anchor);
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
  if (k < 0) throw new Error(`"${key}" isn't one of the hues.`);
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
 * The hues both modes start from, in the order they're listed, and which of them stay put: the
 * lineup, wrapped onto the circle. The anchor and placed colors stay; the rest are spaced.
 *
 * @param settings  The settings.
 * @returns         The keys, starting hues, the indexes of the colors that stay put, and the closest
 *                  neighbors may come.
 */
function seeds(settings: Settings) {
  const { keys, hues, held, sep } = lineup(settings);
  // Named hues go in hue order, red first; numbered ones in number order, from the anchor.
  const lined = hues.map((h, k) => [h % 360, k] as const);
  const order = keys.length === NAMES.length ? lined.toSorted((a, b) => a[0] - b[0]) : lined;
  return {
    keys: order.map(([, k]) => keys[k]!),
    start: order.map(([h]) => h),
    fixed: order.flatMap(([, k], i) => (held[k] ? [i] : [])),
    sep,
  };
}

/** The site's pages, by the word in its address; colors share the address, so no color's key can take one. */
export const PAGES = [
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
 * The custom and neutral colors' keys: each name in lowercase words joined by hyphens, numbered
 * when it would repeat a hue's key, the grays', another color's or a page's.
 *
 * @param settings  The settings.
 * @returns         One key per custom color and per neutral color, in order.
 */
export function colorKeys(settings: Pick<Settings, "hues" | "custom" | "neutrals">): {
  custom: string[];
  neutrals: string[];
} {
  const used = new Set<string>([...PAGES, GRAY, ...hueKeys(settings.hues)]);
  const keyOf = (name: string, fallback: string) => {
    // Accents are dropped and a dotless ı is an i, so "Çivit" becomes "civit".
    const word =
      name
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .replace(/ı/g, "i")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || fallback;
    let key = word;
    for (let n = 2; used.has(key); n++) key = `${word}-${String(n)}`;
    used.add(key);
    return key;
  };
  return {
    custom: settings.custom.map((e) => keyOf(e.name, "custom")),
    neutrals: settings.neutrals.map((n) => keyOf(n.name, "neutral")),
  };
}

/**
 * The custom colors' keys.
 *
 * @param settings  The settings.
 * @returns         One key per custom color, in order.
 */
export const customKeys = (settings: Pick<Settings, "hues" | "custom" | "neutrals">) =>
  colorKeys(settings).custom;

/**
 * A number rounded to a few decimals.
 *
 * @param x  The number.
 * @param d  Decimals.
 * @returns  It rounded.
 */
const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

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
export function swatch(
  model: Model,
  base: string,
  mode: Mode,
  color: string,
  target: number,
): Swatch {
  const c = model.cam(mode, color);
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

/** What the hues decide on one tier: where each hue sits, its color and colorfulness, and the tier's. */
interface HueTier {
  readonly hues: readonly number[];
  readonly colors: readonly string[];
  readonly targets: readonly number[];
  readonly target: number;
  readonly limit: string | null;
  readonly ring: readonly number[];
}

/** The hues of one mode on every tier: the costly part of a palette, which colors placed on top reuse. */
type HueCore = Readonly<Record<number, HueTier>>;

/** Both modes' hues on one gamut tier. */
export type GamutCore = Readonly<Record<Mode, HueCore>>;

/**
 * The hues of one mode on every tier.
 *
 * The identity tier is spaced first; every other tier starts from its hues and may move them a
 * little, so each tier is evenly spaced in its own right. With equal tiers, every color on a tier
 * is equally colorful.
 *
 * @param settings  The settings.
 * @param model     The color model.
 * @param mode      The mode.
 * @returns         Each tier's hues.
 */
function solveHues(settings: Settings, model: Model, mode: Mode): HueCore {
  const base = settings.bases[mode];
  const { keys, start, fixed, sep } = seeds(settings);
  // With other than eight hues, the identity tier may move each only up to halfway to its even neighbor.
  const identityReach =
    settings.hues === NAMES.length
      ? settings.hueWindow.identity
      : Math.min(settings.hueWindow.identity, 180 / settings.hues);

  // On an equal tier, the target drops to what its least colorful hue can reach. It's measured
  // before the curve: a hue the curve asks more of than it can reach there stops at its reach,
  // rather than every color on the tier dropping to make room for it.
  const ceiling = (tier: number, hues: readonly number[]) => {
    if (!settings.equalTiers) return { target: settings.colorfulness, limit: null };
    const reach = hues.map((h) => model.cam(mode, strongest(model, base, mode, h, 200, tier)).m);
    const least = reach.indexOf(Math.min(...reach));
    return reach[least]! < settings.colorfulness
      ? { target: reach[least]!, limit: keys[least]! }
      : { target: settings.colorfulness, limit: null };
  };
  const solveTier = (tier: number, hues: readonly number[], reach: number): HueTier => {
    const { target, limit } = ceiling(tier, hues);
    // A curve that takes away more than the tier has stops at gray.
    const aim = (hue: number) => Math.max(0, target + boost(settings, mode, hue));
    const spaced = space({ model, base, mode, fixed, tier, start: hues, reach, sep, target: aim });
    return { target, limit, targets: spaced.hues.map(aim), ...spaced };
  };

  const identityTier = identityOf(settings, mode);
  const identity = solveTier(identityTier, start, identityReach);
  return Object.fromEntries(
    settings.tiers.map((tier) => [
      tier,
      tier === identityTier ? identity : solveTier(tier, identity.hues, settings.hueWindow.tier),
    ]),
  );
}

/**
 * One mode's palette from its hues: each hue's color and muted version on every tier, and the
 * colors placed on top, the custom colors, Gray and the neutral colors. None of these move the
 * hues, so a change to them needs only this part.
 *
 * @param settings  The settings.
 * @param model     The color model.
 * @param mode      The mode.
 * @param core      The mode's hues on every tier.
 * @returns         The mode's colors on every tier.
 */
function finishMode(settings: Settings, model: Model, mode: Mode, core: HueCore): ModePalette {
  const base = settings.bases[mode];
  const { keys } = seeds(settings);
  const customKeyOf = customKeys(settings);
  const tiers: Record<number, Record<string, { default: Swatch; muted: Swatch }>> = {};
  const targets: Record<number, number> = {};
  const limits: Record<number, string | null> = {};
  const ring: Record<number, number[]> = {};
  for (const tier of settings.tiers) {
    const solved = core[tier]!;
    tiers[tier] = {};
    targets[tier] = round(solved.target);
    limits[tier] = solved.limit;
    ring[tier] = solved.ring.map((d) => round(d));
    // A color on this tier, and its muted version: the same hue at a share of its colorfulness.
    const pair = (hue: number, color: string, target: number) => {
      const def = swatch(model, base, mode, color, target);
      const quiet = def.colorfulness * settings.muted;
      return {
        default: def,
        muted: swatch(model, base, mode, strongest(model, base, mode, hue, quiet, tier), quiet),
      };
    };
    keys.forEach((key, i) => {
      tiers[tier]![key] = pair(solved.hues[i]!, solved.colors[i]!, solved.targets[i]!);
    });
    settings.custom.forEach((custom, i) => {
      const target = solved.target * custom.share;
      tiers[tier]![customKeyOf[i]!] = pair(
        custom.hue,
        strongest(model, base, mode, custom.hue, target, tier),
        target,
      );
    });
  }
  const colors = [
    ...keys.map((key) => ({ key, target: settings.colorfulness, custom: false })),
    ...settings.custom.map((e, i) => ({
      key: customKeyOf[i]!,
      target: settings.colorfulness * e.share,
      custom: true,
    })),
  ].map((c) => ({
    ...c,
    tiers: Object.fromEntries(settings.tiers.map((t) => [t, tiers[t]![c.key]!])),
  }));
  // The neutrals: a gray on every tier, and each neutral color, which follows a tinted base.
  const onTiers = (make: (tier: number) => Swatch) =>
    Object.fromEntries(settings.tiers.map((t) => [t, make(t)]));
  const grays = onTiers((t) => swatch(model, base, mode, grayOn(base, t), 0));
  const tint = tinted(model, mode, base) ? model.cam(mode, base) : null;
  const neutralKeys = colorKeys(settings).neutrals;
  const neutrals = settings.neutrals.map((n, i) => ({
    key: neutralKeys[i]!,
    share: n.share,
    tiers: tint
      ? onTiers((t) => {
          const m = tint.m * n.share;
          return swatch(model, base, mode, strongest(model, base, mode, tint.hue, m, t), m);
        })
      : grays,
  }));
  return { base, colors, targets, limits, ring, grays, tinted: tint !== null, neutrals };
}

/**
 * What the hues depend on: every setting but the custom and neutral colors, the muted share, the
 * names, the guide and the colors picked per gamut. Settings with the same key share their hues.
 * It's meant for one gamut tier's settings (forGamut), whose bases already hold the picks.
 *
 * @param settings  One gamut tier's settings.
 * @returns         A key.
 */
export function huesKey(settings: Settings): string {
  const {
    custom: _custom,
    neutrals: _neutrals,
    muted: _muted,
    name: _name,
    guide: _guide,
    gamutBases: _gamutBases,
    ...rest
  } = settings;
  return JSON.stringify(rest);
}

/** How many gamut tiers' hues a cache keeps: the latest few settings, in every gamut tier. */
const KEPT_CORES = 24;

/**
 * Both modes on one gamut tier. Given a cache, hues already solved for the same hue settings are
 * reused, so a change to the colors placed on top takes milliseconds rather than a whole solve.
 *
 * @param given     What to solve from; each tier takes its own bases from it.
 * @param gamut     The gamut tier colors must fit.
 * @param cache     Hues solved before, by hue settings and gamut tier; kept up to date.
 * @returns         The palette for that tier.
 */
export function solveGamut(
  given: Settings,
  gamut: Gamut,
  cache?: Map<string, GamutCore>,
): GamutPalette {
  // The tier is solved against its own bases.
  const settings = forGamut(given, gamut);
  const model = makeModel(settings, gamut);
  const key = `${huesKey(settings)}|${gamut}`;
  let core = cache?.get(key);
  if (!core) {
    core = Object.fromEntries(
      MODES.map((mode) => [mode, solveHues(settings, model, mode)]),
    ) as GamutCore;
    cache?.set(key, core);
  } else {
    // Used again, so it's the last to be let go.
    cache!.delete(key);
    cache!.set(key, core);
  }
  if (cache && cache.size > KEPT_CORES) cache.delete(cache.keys().next().value!);
  return Object.fromEntries(
    MODES.map((mode) => [mode, finishMode(settings, model, mode, core[mode])]),
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
