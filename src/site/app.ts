/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< APP >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The palette site: overview, tiers, one page per color, the comparison with Codemos, how it       |
| works, settings and export. One view at a time, one mode at a time; the page itself is the       |
| mode's base.                                                                                     |
\*------------------------------------------------------------------------------------------------*/

import project from "../../package.json";
import { CONFIG } from "../config";
import { toCsv, toJson, toMarkdown } from "../palette/formats";
import { composition, makeModel, type Model, parts } from "../palette/model";
import { anchorHue, anchorSource, guides, SYSTEMS } from "../palette/references";
import { CODEMOS, CODEMOS_MUTED, type CurvePoint, type Extra, type Gamut, GAMUT_NAMES, GAMUTS, type Mode, MODE_NAMES, MODES, NAMES, ROLES, type Settings, SURROUNDS } from "../palette/settings";
import { boost, bounds, type Color, extraKeys, hueKeys, lineup, neighbors, PAGES, swatch, type GamutPalette, type ModePalette, type Palette, strongest, type Swatch } from "../palette/solve";
import { bindCurves, curveEditor, type CurveView, refreshCurve } from "./curve";
import { copyText, flash, refill } from "./dom";
import { type Context, explain, updateDemo } from "./explain";
import { bendMeter, bindGuides, CIRCLE, circleGuides, escape, evenness, guidePicker, evenText, inGaps, signed, THRESHOLDS, visibility, zone, zoneTable } from "./graph";
import { popButton, popSource } from "./popover";
import { bindHues, huesEditor, type HuesView, refreshHues } from "./hues";
import { references } from "./sources";
import { technical } from "./technical";
import { bindHueTest, type HueTestContext, hueTestPage } from "./hue-test";
import { bindTest, type TestContext, testPage } from "./test";
import type { Request, Response } from "./worker";

/* >-----------------------------------------< State >------------------------------------------< */

type Variant = "default" | "muted";
type Format = "json" | "csv" | "md";

/** The pages drawn on their own; "colors" opens the first color, and "export" a section of Settings. */
const VIEWS = PAGES.filter((p) => p !== "colors" && p !== "export");

const STORE = "ek-colors:settings";

/** Remembers whether the comparison with Codemos is shown. */
const COMPARE = "ek-colors:compare";

/** Remembers the Edits switches. */
const EDITS = "ek-colors:edits";

/** The widest gamut tier this screen covers. */
const SCREEN: Gamut = matchMedia("(color-gamut: rec2020)").matches
  ? "ultra"
  : matchMedia("(color-gamut: p3)").matches
    ? "wide"
    : "standard";

const state = {
  settings: load(),
  mode: (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") as Mode,
  variant: "default" as Variant,
  view: "overview",

  /** Whether the pages show placed hues (H) and colorfulness per hue (M); off shows the palette without them. */
  edits: loadEdits(),
  format: "json" as Format,
  gamut: SCREEN,
  palettes: {} as Partial<Record<Gamut, GamutPalette>>,

  /** The gamut tiers solved from the current settings; the others still show their last solve. */
  fresh: new Set<Gamut>(),

  /** Variants of the settings (without the curve, nothing placed, turned), by request: for the Edits switches and the strip. */
  baselines: new Map<number, GamutPalette>(),
  solving: false,
  took: 0,
  error: null as string | null,
};

/**
 * The saved settings, or EK Palette's.
 *
 * @returns  Settings.
 */
function load(): Settings {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) {
      // Settings saved before exceptions became the curve still hold them; they're left out.
      const { offsets: _, ...stored } = JSON.parse(saved) as Partial<Settings> & { offsets?: unknown };
      const settings = { ...CONFIG, ...stored } as { -readonly [K in keyof Settings]: Settings[K] };
      // Settings saved before the anchor held yellow's hue, per mode or as its home; it becomes the anchor.
      const old = stored as { yellowHue?: Record<Mode, number>; homes?: Record<string, number>; start?: number };
      const yellow = old.homes?.yellow ?? old.yellowHue?.light ?? old.start;
      if (yellow !== undefined && stored.anchor === undefined) settings.anchor = yellow;
      // Settings saved before one guide at a time list several; the first is kept.
      const shown = (stored as { guides?: string[] }).guides;
      if (shown?.length && stored.guide === undefined) settings.guide = shown[0]!;
      // Settings saved before extra colors hold brown's share, or null without it; it becomes an extra color.
      const brown = (stored as { brown?: number | null }).brown;
      if (brown !== undefined && stored.extras === undefined) settings.extras = brown === null ? [] : [{ name: "Brown", hue: 40, share: brown }];
      // Anything else from an older version is left out, so only settings that exist are kept.
      for (const key of Object.keys(settings)) if (!(key in CONFIG)) delete (settings as Record<string, unknown>)[key];
      // Settings saved before the identity tier was per mode hold one number.
      const identity = settings.identityTier as Settings["identityTier"] | number;
      if (typeof identity === "number") settings.identityTier = { light: identity, dark: identity };
      // Settings saved before the curve had several points hold one point, flat or not.
      const curve = settings.curve as Record<Mode, unknown>;
      for (const m of MODES) {
        const one = curve[m] as CurvePoint | CurvePoint[] | undefined;
        if (!Array.isArray(one)) curve[m] = one && one.amount !== 0 ? [one] : [];
      }
      // Each mode's identity tier is one of the tiers solved.
      for (const m of MODES) if (!settings.tiers.includes(settings.identityTier[m])) settings.identityTier = { ...settings.identityTier, [m]: settings.tiers.includes(CONFIG.identityTier[m]) ? CONFIG.identityTier[m] : settings.tiers[0]! };
      return structuredClone(settings);
    }
  } catch {
    // Storage can be blocked; the defaults do.
  }
  return structuredClone(CONFIG);
}

/**
 * The Edits switches as last left in this browser, or both on.
 *
 * @returns  Whether placed hues and colorfulness per hue are shown.
 */
function loadEdits(): { h: boolean; m: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(EDITS) ?? "null") as { h?: unknown; m?: unknown } | null;
    return { h: saved?.h !== false, m: saved?.m !== false };
  } catch {
    return { h: true, m: true };
  }
}

/**
 * Remembers the settings in this browser.
 */
function save(): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(state.settings));
  } catch {
    // Storage can be blocked; the page works without it.
  }
}

/* >-----------------------------------------< Solve >------------------------------------------< */

/** The worker, at the same version as this script, so the two always match. */
const WORKER = new URL(`worker.js${new URL(import.meta.url).search}`, import.meta.url);

const worker = new Worker(WORKER, { type: "module" });
let latest = 0;
let timer = 0;

worker.addEventListener("message", (event: MessageEvent<Response>) => {
  const data = event.data;
  if (data.id !== latest) return;
  if ("error" in data) {
    [state.solving, state.error] = [false, data.error];
    status();
    return;
  }
  state.palettes[data.gamut] = data.palette;
  state.fresh.add(data.gamut);
  const shown = data.gamut === state.gamut;
  if (shown) [state.solving, state.took, state.error] = [false, data.took, null];
  // The other gamut tiers solve after the one on screen, one at a time, so a newer change can start sooner.
  const next = state.fresh.has(state.gamut) ? GAMUTS.find((g) => !state.fresh.has(g)) : state.gamut;
  if (next) post(next);
  // Settings shows every gamut tier in its export, so each one that arrives refreshes it.
  if (state.view === "tune") {
    if (shown) updateTune();
    else updateExport();
  } else if (shown) render();
  status();
});

/**
 * Asks the worker for one gamut tier of the current settings.
 *
 * @param gamut  The gamut tier.
 */
function post(gamut: Gamut): void {
  worker.postMessage({ id: latest, settings: state.settings, gamut } satisfies Request);
}

/**
 * Solves the current settings, a moment after the last change: the gamut tier on screen first.
 *
 * @param wait  Milliseconds to wait for more changes.
 */
function solve(wait = 0): void {
  clearTimeout(timer);
  // The palettes on hand are from older settings from now on: late answers are dropped, and the
  // export waits for the new ones.
  latest++;
  state.fresh = new Set();
  state.solving = true;
  status();
  timer = window.setTimeout(() => {
    post(state.gamut);
    askVariants();
  }, wait);
}

/* >-----------------------------------------< Curve >------------------------------------------< */

// A second worker solves variants of the settings, without the curve or with nothing placed, so
// they can be shown beside the palette.
const baseline = new Worker(WORKER, { type: "module" });

baseline.addEventListener("message", (event: MessageEvent<Response>) => {
  const data = event.data;
  nextVariant();
  if ("error" in data) return;
  state.baselines.set(data.id, data.palette);
  for (const [key, id] of asked)
    if (state.baselines.size > KEPT && state.baselines.has(id)) {
      state.baselines.delete(id);
      asked.delete(key);
    }
  if (state.view === "tune") updateTune();
  else if (followsEdits(state.view) && !(state.edits.h && state.edits.m)) render();
  else if (state.view === "how") updateStrip();
});

let asks = 0;
const asked = new Map<string, number>();

/** Variants waiting for the worker, newest last; one is solved at a time. */
const queue: Request[] = [];
let solvingVariant = false;

/** How many variants wait at most: a drag asks for a new one on every move, and only the last few matter. */
const QUEUED = 4;

/** How many solved variants are kept. */
const KEPT = 48;

/**
 * Sends the next waiting variant to the worker, if it's free.
 */
function nextVariant(): void {
  const request = queue.shift();
  solvingVariant = !!request;
  if (request) baseline.postMessage(request);
}

/**
 * The settings with the curve flattened.
 *
 * @returns  Settings.
 */
function flat(): Settings {
  return { ...state.settings, curve: { light: [], dark: [] } };
}

/**
 * Whether the curve changes anything.
 *
 * @returns  True when either mode's curve has an amount.
 */
function curved(): boolean {
  return Object.values(state.settings.curve).some((points) => points.some((p) => !p.off && p.amount !== 0));
}

/**
 * A variant of the settings on the gamut tier on screen, asked for once and kept.
 *
 * @param settings  The variant.
 * @returns         The palette, or null while it solves.
 */
function variant(settings: Settings): GamutPalette | null {
  const key = `${JSON.stringify(solvedPart(settings))}|${state.gamut}`;
  const id = asked.get(key);
  if (id !== undefined) return state.baselines.get(id) ?? null;
  asks++;
  asked.set(key, asks);
  queue.push({ id: asks, settings, gamut: state.gamut });
  // Older waiting variants are given up; they're asked for again if they're still wanted.
  for (const dropped of queue.splice(0, Math.max(0, queue.length - QUEUED)))
    for (const [k, v] of asked) if (v === dropped.id) asked.delete(k);
  if (!solvingVariant) nextVariant();
  return null;
}

/**
 * The palette on screen without the curve. It only depends on settings other than the curve, so
 * moving the curve never has to wait for it.
 *
 * @returns  The palette, or null while it solves.
 */
function uncurved(): GamutPalette | null {
  return curved() ? variant(flat()) : inUse();
}

/**
 * The uniform lineup: the palette on screen with nothing placed.
 *
 * @returns  The palette, or null while it solves.
 */
function uniform(): GamutPalette | null {
  return Object.keys(state.settings.placed).length ? variant({ ...state.settings, placed: {} }) : inUse();
}

/**
 * The palette on screen with nothing placed and no curve: the first step of the strip.
 *
 * @returns  The palette, or null while it solves.
 */
function plain(): GamutPalette | null {
  const placed = Object.keys(state.settings.placed).length > 0;
  if (!curved()) return uniform();
  return placed ? variant({ ...flat(), placed: {} }) : uncurved();
}

/** The turn found for each pair of palettes and tier: exact by construction, and let go with the palettes. */
const turns = new WeakMap<ModePalette, WeakMap<ModePalette, Map<number, number>>>();

/**
 * The turn that brings the uniform lineup nearest the palette with placed hues (without
 * colorfulness per hue): every hue of the lineup turned by the same angle. Turning is a rotation
 * in CAM16-UCS, so each angle from −30° to 30° is tried in tenths of a degree without solving; the
 * one with the smallest root-mean-square difference wins.
 *
 * @param mode  The mode.
 * @returns     Degrees, or null while either palette solves.
 */
function turn(mode: Mode): number | null {
  const tier = state.settings.identityTier[mode];
  const [even, hued] = [plain()?.[mode], uncurved()?.[mode]];
  if (!even || !hued) return null;
  if (!turns.has(even)) turns.set(even, new WeakMap());
  const byHued = turns.get(even)!;
  if (!byHued.has(hued)) byHued.set(hued, new Map());
  const known = byHued.get(hued)!.get(tier);
  if (known !== undefined) return known;
  const pairs = even.colors.flatMap((c) => {
    const [u, h] = [c.tiers[tier]?.default, hued.colors.find((x) => x.key === c.key)?.tiers[tier]?.default];
    return !c.extra && u && h ? [[model().cam(mode, u.color), model().cam(mode, h.color)] as const] : [];
  });
  const off = (degrees: number) => {
    const [cos, sin] = [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];
    const sum = pairs.reduce((total, [u, h]) => {
      const [a, b] = [u.astar * cos - u.bstar * sin, u.astar * sin + u.bstar * cos];
      const distance = 1.41 * Math.hypot(u.jstar - h.jstar, a - h.astar, b - h.bstar) ** 0.63;
      return total + distance ** 2;
    }, 0);
    return Math.sqrt(sum / pairs.length);
  };
  let [best, score] = [0, off(0)];
  for (let tenths = -300; tenths <= 300; tenths++) {
    const value = off(tenths / 10);
    if (value < score - 1e-9) [best, score] = [tenths / 10, value];
  }
  byHued.get(hued)!.set(tier, best);
  return best;
}

/**
 * The uniform lineup turned to best match the palette with placed hues: solved, or while that
 * solves, the uniform colors with their hues turned.
 *
 * @param mode  The mode.
 * @returns     Per color: its hue, colorfulness and color on the identity tier; null while the turn
 *              is found. The ring is the solved one's, or null, with its keys in its own order: a turn
 *              past 0° changes which color comes first.
 */
function turned(mode: Mode): {
  colors: Record<string, { hue: number; colorfulness: number; color: string }>;
  ring: readonly number[] | null;
  keys: readonly string[] | null;
} | null {
  const angle = turn(mode);
  const even = plain()?.[mode];
  if (angle === null || !even) return null;
  const s = state.settings;
  const tier = s.identityTier[mode];
  const solved = angle === 0 ? even : variant({ ...flat(), placed: {}, anchor: Math.round((anchorHue(s) + angle) * 10) / 10 })?.[mode];
  const colors = Object.fromEntries(
    even.colors.flatMap((c) => {
      const exact = solved?.colors.find((x) => x.key === c.key)?.tiers[tier]?.default;
      if (exact) return [[c.key, { hue: exact.hue, colorfulness: exact.colorfulness, color: exact.color }]];
      const u = c.tiers[tier]?.default;
      if (!u) return [];
      const hue = (((u.hue + angle) % 360) + 360) % 360;
      try {
        return [[c.key, { hue, colorfulness: u.colorfulness, color: strongest(model(), s.bases[mode], mode, hue, u.colorfulness, tier) }]];
      } catch {
        return [];
      }
    }),
  );
  const ring = solved?.ring[tier] ?? null;
  return { colors, ring, keys: solved && ring ? solved.colors.slice(0, ring.length).map((c) => c.key) : null };
}

/**
 * Asks for the variants Settings compares with.
 */
function askVariants(): void {
  uncurved();
  uniform();
  plain();
  turned(state.mode);
}

const bands = new Map<string, CurveView["band"]>();
const models = new Map<string, Model>();

/**
 * The color model of the settings on screen, made once per bases, rooms and gamut tier.
 *
 * @returns  The model.
 */
function model(): Model {
  const s = state.settings;
  const key = JSON.stringify([s.bases, s.rooms, state.gamut]);
  let made = models.get(key);
  if (!made) models.set(key, (made = makeModel(s, state.gamut)));
  return made;
}

/**
 * What placing costs in evenness, on the identity tier and without the curve: the uniform
 * lineup's mean gap between neighbors, and each color's gaps as differences from it.
 *
 * @param mode  The mode.
 * @returns     The cost, or null while it solves.
 */
function spacingCost(mode: Mode): HuesView["cost"] {
  const tier = state.settings.identityTier[mode];
  const [hued, even] = [uncurved()?.[mode], plain()?.[mode]];
  const ring = hued?.ring[tier];
  const evenRing = even?.ring[tier];
  if (!hued || !ring?.length || !evenRing?.length) return null;
  const uniform = evenRing.reduce((a, b) => a + b, 0) / evenRing.length;
  const n = ring.length;
  const gaps = Object.fromEntries(
    hued.colors.slice(0, n).map((c, i) => [c.key, [ring[(i - 1 + n) % n]! - uniform, ring[i]! - uniform] as const]),
  );
  return { uniform, gaps, ring, keys: hued.colors.slice(0, n).map((c) => c.key) };
}

/**
 * What the curve costs: each color with and without it on the identity tier, as colorfulness
 * added and as a color difference.
 *
 * @param mode  The mode.
 * @returns     The cost, or null while it solves.
 */
function colorfulnessCost(mode: Mode): CurveView["cost"] {
  const tier = state.settings.identityTier[mode];
  const [before, after] = [uncurved()?.[mode], current()?.[mode]];
  if (!before || !after) return null;
  return after.colors
    .filter((c) => !c.extra)
    .flatMap((c) => {
      const [a, b] = [c.tiers[tier]?.default, before.colors.find((o) => o.key === c.key)?.tiers[tier]?.default];
      if (!a || !b) return [];
      return [{ label: label(c.key), added: Math.round(a.colorfulness - b.colorfulness), difference: model().distance(mode, a.color, b.color) }];
    })
    .map((c) => ({ ...c, gap: evenGaps.get(mode) ?? 9 }));
}

/**
 * One mode's curve editor contents: the curve, the palette's hues on it, and the colors around the
 * circle at the identity tier's colorfulness.
 *
 * @param mode  The mode.
 * @returns     The view.
 */
function curveView(mode: Mode): CurveView {
  const s = state.settings;
  const tier = s.identityTier[mode];
  const palette = current()?.[mode];
  const target = palette?.targets[tier] ?? s.colorfulness;
  const key = JSON.stringify([s.bases, s.rooms, state.gamut, mode, tier, target]);
  let band = bands.get(key);
  if (!band) {
    band = Array.from({ length: 37 }, (_, i) => i * 10).flatMap((hue) => {
      try {
        return [{ hue, color: strongest(model(), s.bases[mode], mode, hue % 360, target, tier) }];
      } catch {
        return [];
      }
    });
    bands.set(key, band);
  }
  const dots = (palette?.colors ?? [])
    .filter((c) => !c.extra && c.tiers[tier])
    .map((c) => ({ hue: c.tiers[tier]!.default.hue, color: c.tiers[tier]!.default.color }));
  return { mode, points: s.curve[mode], dots, band, cost: colorfulnessCost(mode), guide: s.guide, guides: guides(s) };
}

/**
 * The color that stays on the anchor.
 *
 * @returns  Its key.
 */
function anchored(): string {
  return hueKeys(state.settings.hues)[0]!;
}

/**
 * The gaps between neighbors on a palette's identity tier, each placed halfway between the two.
 *
 * @param palette  The mode's palette.
 * @param tier     The identity tier.
 * @returns        The gaps, or none while it solves.
 */
function gapsOf(palette: ModePalette | undefined, tier: number): HuesView["gaps"]["current"] {
  const ring = palette?.ring[tier] ?? [];
  const hues = (palette?.colors ?? []).slice(0, ring.length).map((c) => c.tiers[tier]?.default.hue ?? 0);
  return ring.map((gap, i) => {
    const [a, b] = [hues[i]!, hues[(i + 1) % hues.length]!];
    return { hue: (a + (((b - a + 360) % 360) / 2)) % 360, gap };
  });
}

/**
 * The hue graph's contents: every color in the uniform lineup and the current one, without the
 * curve, on the identity tier of the mode on screen. Placed colors and the anchor are drawn where
 * they're set, so a drag follows the pointer before the palette solves again.
 *
 * @returns  The view.
 */
function huesView(): HuesView {
  const s = state.settings;
  const mode = state.mode;
  const tier = s.identityTier[mode];
  const palette = uncurved()?.[mode] ?? current()?.[mode];
  const even = plain()?.[mode];
  // Placed colors where the lineup holds them, in order.
  const line = lineup(s);
  const held = Object.fromEntries(line.keys.map((key, k) => [key, line.hues[k]! % 360]));
  const twist = turned(mode);
  const gap = evenGaps.get(mode) ?? 9;
  const rows = (palette?.colors ?? [])
    .filter((c) => !c.extra && c.tiers[tier])
    .map((c) => {
      const now = c.tiers[tier]!.default;
      const set = c.key === anchored() ? anchorHue(s) : s.placed[c.key] === undefined ? undefined : held[c.key];
      return {
        key: c.key,
        label: label(c.key),
        uniform: even?.colors.find((e) => e.key === c.key)?.tiers[tier]?.default ?? null,
        turned: twist?.colors[c.key] ?? null,
        bend: twist?.colors[c.key] ? model().distance(mode, twist.colors[c.key]!.color, now.color) / gap : null,
        current: { hue: set ?? now.hue, color: now.color },
        placed: s.placed[c.key] !== undefined,
        anchor: c.key === anchored(),
      };
    });
  const gaps = { uniform: gapsOf(even, tier), current: gapsOf(palette, tier) };
  const bends = rows.flatMap((r) => (r.bend === null ? [] : [r.bend]));
  const bend = twist && bends.length ? Math.sqrt(bends.reduce((sum, b) => sum + b ** 2, 0) / bends.length) : null;
  // What the bend is made of: each color's shares, weighted by its share of the sum of squares.
  let [weight, hue, colorful] = [0, 0, 0];
  for (const r of rows) {
    const spot = twist?.colors[r.key];
    if (!spot || r.bend === null) continue;
    const w = ((r.bend * gap) / 1.41) ** (2 / 0.63);
    const split = parts(model().cam(mode, spot.color), model().cam(mode, r.current.color));
    [weight, hue, colorful] = [weight + w, hue + w * split.hue, colorful + w * split.colorfulness];
  }
  const split = weight ? { hue: hue / weight, colorfulness: colorful / weight } : null;
  return { rows, gaps, band: curveView(mode).band, guide: s.guide, guides: guides(s), cost: spacingCost(mode), turn: turn(mode), bend, split };
}

/**
 * Shows the anchor's hue in its fields, and that it's set by hand once it's been moved.
 */
function syncAnchor(): void {
  const from = document.querySelector<HTMLSelectElement>("#set-anchor");
  if (from) from.value = typeof state.settings.anchor === "number" ? "hand" : state.settings.anchor;
  const hue = String(Math.round(anchorHue(state.settings)));
  for (const el of document.querySelectorAll<HTMLInputElement>("[data-anchor-hue]")) if (el !== document.activeElement) el.value = hue;
}

/**
 * The hue a color may be placed at, nearest the one asked for: held between its neighbors, so the
 * lineup keeps its order.
 *
 * @param key  The color.
 * @param hue  The hue asked for.
 * @returns    The hue allowed (degrees, 0–360).
 */
function allowed(key: string, hue: number): number {
  const [low, high] = bounds(state.settings, key);
  const middle = (low + high) / 2;
  const near = middle + ((((hue - middle) % 360) + 540) % 360) - 180;
  const held = ((Math.min(high, Math.max(low, near)) % 360) + 360) % 360;
  return Math.round(held * 10) / 10;
}

bindHues(
  huesView,
  (key, wanted) => {
    const hue = allowed(key, wanted);
    if (key === anchored()) {
      write("anchor", hue);
      syncAnchor();
    } else write(`placed.${key}`, hue);
    solve(150);
  },
  (key) => {
    if (key === anchored()) {
      write("anchor", CONFIG.anchor);
      syncAnchor();
    } else {
      const { [key]: _, ...rest } = state.settings.placed;
      write("placed", rest);
    }
    solve(150);
  },
);

bindGuides(
  (id) => guides(state.settings, id),
  () => state.settings.guide,
  (id) => write("guide", id),
);

bindCurves(curveView, (mode, points) => {
  write(`curve.${mode}`, points);
  updateStrip();
  solve(150);
});

/**
 * What the explainer needs to know about the page.
 *
 * @returns  The settings, mode, gamut tier and palette on screen.
 */
function context(): Context {
  return { settings: state.settings, mode: state.mode, gamut: state.gamut, palette: current(), label };
}

/**
 * What the blind test needs from the page.
 *
 * @returns  The settings, mode, gamut tier and palette on screen, and ways to change the curve and
 *           redraw.
 */
function testContext(): TestContext {
  return {
    ...context(),
    applyCurve: (mode, points) => {
      write(`curve.${mode}`, points);
      solve();
    },
    redraw: render,
  };
}

bindTest(testContext);

/**
 * What the blind hue test needs from the page.
 *
 * @returns  The settings, mode, gamut tier and palette on screen, and ways to place colors and
 *           redraw.
 */
function hueTestContext(): HueTestContext {
  return {
    ...context(),
    applyHues: (hues) => {
      for (const [key, hue] of Object.entries(hues)) {
        if (key === anchored()) write("anchor", hue);
        else write(`placed.${key}`, hue);
      }
      solve();
    },
    redraw: render,
  };
}

bindHueTest(hueTestContext);

/**
 * The palette on screen.
 *
 * @returns  The current gamut tier's palette, or null while it solves.
 */
function inUse(): GamutPalette | null {
  return state.palettes[state.gamut] ?? null;
}

/**
 * Whether a page follows the Edits switches. Settings and the blind tests work on the palette in
 * use, and Export exports it.
 *
 * @param view  The page.
 * @returns     True when it does.
 */
function followsEdits(view: string): boolean {
  return !["tune", "references", "curve-test", "hue-test"].includes(view);
}

/**
 * The palette the page shows: the one in use, or, where the Edits switches apply and one is off,
 * the same settings without placed hues, without colorfulness per hue, or without both.
 *
 * @returns  The palette, or null while it solves.
 */
function current(): GamutPalette | null {
  const { h, m } = state.edits;
  if (!followsEdits(state.view) || (h && m)) return inUse();
  return h ? uncurved() : m ? uniform() : plain();
}

/* >----------------------------------------< Helpers >-----------------------------------------< */

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;

/**
 * Whether the settings are EK Palette's as it ships, whatever order their keys were saved in.
 *
 * @returns  True when nothing has been changed.
 */
function isPreset(): boolean {
  const sorted = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sorted)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sorted(x)]))
        : v;
  return JSON.stringify(sorted(solvedPart(state.settings))) === JSON.stringify(sorted(solvedPart(CONFIG)));
}

/**
 * The settings without what only changes how the site looks: the guide shown, and curve points
 * marked as on, which is the same as not marked.
 *
 * @param settings  The settings.
 * @returns         What the palette is solved from.
 */
function solvedPart(settings: Settings): Settings {
  const points = (list: readonly CurvePoint[]) => list.map(({ off, ...p }) => (off ? { ...p, off } : p));
  return { ...settings, guide: "", curve: { light: points(settings.curve.light), dark: points(settings.curve.dark) } };
}

/**
 * The extra color a key stands for, if it's one.
 *
 * @param key  A color's key.
 * @returns    The extra color, or undefined for a hue.
 */
function extraOf(key: string): Extra | undefined {
  return state.settings.extras[extraKeys(state.settings).indexOf(key)];
}

/**
 * A color key as people read it: an extra color by its own name.
 *
 * @param key  E.g. "red" or "hue-3".
 * @returns    HTML, e.g. "Red" or "Hue 3".
 */
function label(key: string): string {
  const extra = extraOf(key);
  const text = extra ? extra.name : key.replace("-", " ");
  return escape(extra ? text : text.charAt(0).toUpperCase() + text.slice(1));
}

const LEVELS: Readonly<Record<Swatch["wcagLevel"], string>> = {
  AAA: "AAA",
  AA: "AA",
  "AA large": "AA large",
  below: "Below 3:1",
};

/**
 * A color value that copies itself when clicked.
 *
 * @param value  The CSS color.
 * @returns      HTML.
 */
function copyable(value: string): string {
  return `<button type="button" class="mono copy" data-action="copy-value" data-value="${value}" title="${value}" aria-label="Copy ${value}">${value}</button>`;
}

/**
 * A swatch's WCAG level as a badge that opens what the level means. Its color keeps the popover's
 * id apart from the other badges on the page.
 *
 * @param s  The swatch.
 * @returns  HTML.
 */
function badge(s: Swatch): string {
  const level = s.wcagLevel;
  return popButton(`wcag:${level}:${s.wcag.toFixed(2)}:${s.color}`, LEVELS[level], `What WCAG 2 ${LEVELS[level]} means`, `badge ${level.replace(" ", "-")}`);
}

/** What each WCAG 2 level allows. */
const MEANINGS: Readonly<Record<Swatch["wcagLevel"], string>> = {
  AAA: "At least 7:1, the enhanced level. Passes for text of any size, body text included.",
  AA: "From 4.5:1 to 7:1, the minimum for normal text. Passes for text of any size; large text reaches the enhanced level too, which asks 4.5:1 of it.",
  "AA large":
    "From 3:1 to 4.5:1. Passes the minimum only for large text: 24px and up, or 18.66px and up in bold. Also enough for icons, borders and controls, which need 3:1. Not enough for normal text.",
  below:
    "Under 3:1, below every minimum. Fine for dividers, fills and decoration that carry no meaning, and for disabled controls, which are exempt; not for text or icons that must be read.",
};

popSource("wcag", (which) => {
  const [level, ratio] = which.split(":") as [Swatch["wcagLevel"], string];
  return `<h3 class="level ${level.replace(" ", "-")}">WCAG 2 ${LEVELS[level]} · ${ratio}:1</h3>
    <p>${MEANINGS[level]}</p>
    <p class="pop-how">WCAG 2 compares the two colors' luminance as a ratio from 1:1 to 21:1. The palette is built on APCA's Lc instead, which follows how text reads on light and dark backgrounds; WCAG 2 is shown for audits that ask for it.</p>`;
});

/** Where a swatch sits, for the popovers that explain it. */
interface Place {
  readonly key: string;
  readonly tier: number;
  readonly variant: Variant;
}

/**
 * Why a swatch is less colorful than asked, as chips that open the reason: it sets its tier's
 * colorfulness, or the gamut can't reach its target.
 *
 * @param s       The swatch.
 * @param at      Where it sits.
 * @param limits  Whether it sets its tier.
 * @returns       HTML, or nothing.
 */
function chips(s: Swatch, at: Place, limits: boolean): string {
  const id = `${at.key}:${String(at.tier)}:${at.variant}`;
  return [
    s.short ? popButton(`why:gamut:${id}`, "Gamut limit", `Why ${label(at.key)} is held back`, "chip gamut") : "",
    limits ? popButton(`why:tier:${id}`, "Sets the tier", `Why ${label(at.key)} sets the tier`, "chip") : "",
    isLowered(s, at) ? popButton(`why:lowered:${id}`, "Lowered", `Why ${label(at.key)} is lowered`, "chip lowered") : "",
  ].join("");
}

/**
 * Whether another color setting the tier holds this one below its own target.
 *
 * @param s   The swatch.
 * @param at  Where it sits.
 * @returns   True when lowered by the tier, not by the gamut.
 */
function isLowered(s: Swatch, at: Place): boolean {
  const limit = current()?.[state.mode].limits[at.tier];
  return at.variant === "default" && !s.short && !!limit && limit !== at.key;
}

/**
 * A color's own target before its tier was lowered: an extra color aims at its share of the
 * colorfulness, every other color at the colorfulness plus its M edit.
 *
 * @param key         The color.
 * @param s           Its swatch.
 * @param tierTarget  The tier's lowered target.
 * @returns           Its own target.
 */
function ownTarget(key: string, s: Swatch, tierTarget: number): number {
  const { colorfulness } = state.settings;
  const extra = extraOf(key);
  return Math.round((extra ? colorfulness * extra.share : s.target + colorfulness - tierTarget) * 10) / 10;
}

/**
 * What a default swatch aims at, in words: an extra color's share of the tier's colorfulness, or
 * the tier's colorfulness with its colorfulness per hue.
 *
 * @param key         The color.
 * @param s           Its swatch.
 * @param tierTarget  The tier's target.
 * @returns           E.g. "the tier's M 36.8 + 7.8 from colorfulness per hue".
 */
function aimText(key: string, s: Swatch, tierTarget: number): string {
  const tierM = `the tier's M ${tierTarget.toFixed(1)}`;
  const extra = extraOf(key);
  if (extra) return `${String(Math.round(extra.share * 100))}% of ${tierM}`;
  const edit = s.target - tierTarget;
  return Math.abs(edit) >= 0.5 ? `${tierM} ${signed(edit)} from colorfulness per hue` : tierM;
}

/**
 * A swatch as a card: the color, a text sample in it, and its numbers. A link covers the card; the
 * buttons that explain its colorfulness sit above it.
 *
 * @param s      The swatch.
 * @param title  Its name on the card.
 * @param href   Where a click goes, if anywhere.
 * @param at     Where it sits, for its chips; none for colors from elsewhere.
 * @returns      HTML.
 */
function card(s: Swatch, title: string, href?: string, at?: Place): string {
  const limits = at ? current()?.[state.mode].limits[at.tier] === at.key && at.variant === "default" : false;
  const id = at ? `${at.key}:${String(at.tier)}:${at.variant}` : "";
  // Nothing covers the color: held back by the gamut, the colorfulness itself turns red and opens
  // why; lowered by the tier, it stays grey and opens why; setting the tier is a small amber tag
  // beside the name.
  const value = `M ${s.colorfulness.toFixed(1)}`;
  const m =
    at && s.short
      ? popButton(`why:gamut:${id}`, value, `${title} is held back by the gamut: why`, "wanted")
      : at && isLowered(s, at)
        ? popButton(`why:lowered:${id}`, value, `${title} is lowered by the tier: why`, "wanted lowered")
        : value;
  const tag = limits ? popButton(`why:tier:${id}`, "sets tier", `Why ${title} sets the tier`, "chip") : "";
  return `<div class="card${href ? " linked" : ""}" style="--c:${s.color}">
    ${href ? `<a class="card-link" href="#${href}" aria-label="${title}"></a>` : ""}
    <span class="fill"></span>
    <span class="sample">Aa</span>
    <span class="card-name">${title}${tag}</span>
    ${copyable(s.color)}
    <span class="facts"><span class="mono">Lc ${s.apca.toFixed(1)}</span>${badge(s)}</span>
    <span class="mono soft">WCAG ${s.wcag.toFixed(2)} · ${m}</span>
  </div>`;
}

popSource("why", (which) => {
  const [kind, key, tierText, variant] = which.split(":") as [string, string, string, Variant];
  const tier = Number(tierText);
  const palette = current()?.[state.mode];
  const s = palette?.colors.find((c) => c.key === key)?.tiers[tier]?.[variant];
  if (!palette || !s) return "";
  const name = label(key);
  const gamut = GAMUT_NAMES[state.gamut];
  const tierTarget = palette.targets[tier] ?? s.target;
  if (kind === "tier")
    return `<h3>Sets the tier</h3>
      <p>On Lc ${String(tier)}, ${name.toLowerCase()} can't be more colorful than M ${s.colorfulness.toFixed(1)} on ${gamut} screens. <strong>Equal per tier</strong> is on, so every color on this tier is held to M ${tierTarget.toFixed(1)} to match it, though most could go further.</p>
      <p class="pop-how">Turn off Equal per tier in Settings → Colorfulness to let each color go as far as the screen allows; the tier is then no longer equally colorful.</p>`;
  if (kind === "lowered") {
    const limit = label(palette.limits[tier]!);
    const own = ownTarget(key, s, tierTarget);
    const share = aimText(key, s, tierTarget);
    return `<h3>Lowered</h3>
      <p>${name} would be M ${own.toFixed(1)} here. On Lc ${String(tier)}, ${limit.toLowerCase()} can't be more colorful than M ${tierTarget.toFixed(1)} on ${gamut} screens, and <strong>Equal per tier</strong> holds every color on the tier to that, so ${name.toLowerCase()} shows M ${s.colorfulness.toFixed(1)} (${share}).</p>
      <p class="pop-how">Turn off Equal per tier in Settings → Colorfulness to let each color go as far as the screen allows; the tier is then no longer equally colorful.</p>`;
  }
  const reason = variant === "muted" ? `${String(Math.round(state.settings.muted * 100))}% of the default's colorfulness` : aimText(key, s, tierTarget);
  return `<h3>Gamut limit</h3>
    <p>${name} would be M ${s.target.toFixed(1)} here (${reason}), but on Lc ${String(tier)} no ${name.toLowerCase()} that colorful exists on ${gamut} screens. It shows M ${s.colorfulness.toFixed(1)}, the most it can.</p>
    <p class="pop-how">A color's contrast fixes its lightness, and at that lightness a screen can only show so much colorfulness in each hue. ${state.gamut === "ultra" ? "This is already the widest gamut." : "A wider gamut can reach further."}</p>`;
});

/**
 * The colors of the current mode.
 *
 * @param tier  A tier every color returned has, if any: a palette from older settings may lack it.
 * @returns     Its colors, or none before the first solve.
 */
function colors(tier?: number): readonly Color[] {
  const list = current()?.[state.mode].colors ?? [];
  return tier === undefined ? list : list.filter((c) => c.tiers[tier]);
}

/**
 * How even a ring of neighbor differences is, in words people can compare.
 *
 * @param ring  Neighbor distances.
 * @returns     E.g. "9.1 to 10.3", or "…" for none.
 */
function range(ring: readonly number[]): string {
  return ring.length ? `${Math.min(...ring).toFixed(1)} to ${Math.max(...ring).toFixed(1)}` : "…";
}

/**
 * A tier's colorfulness, and what lowered it.
 *
 * @param tier  The tier.
 * @returns     E.g. "Colorfulness M 12.7, lowered from 40: Red can't reach more".
 */
function held(tier: number): string {
  const p = current()?.[state.mode];
  if (!p) return "Colorfulness …";
  const limit = p.limits[tier];
  return limit
    ? `Colorfulness M ${String(p.targets[tier])}, lowered from ${String(state.settings.colorfulness)}: ${label(limit)} can't reach more`
    : `Colorfulness M ${String(p.targets[tier])}, every color reaches it`;
}

/**
 * Why a color on a tier is less colorful than the target, if it is.
 *
 * @param key   The color.
 * @param tier  The tier.
 * @param s     Its swatch there.
 * @returns     HTML: "Gamut limit", "Sets the tier" or "Lowered" chips, or nothing.
 */
function lowered(key: string, tier: number, s: Swatch): string {
  const p = current()?.[state.mode];
  if (!p) return "";
  const html = chips(s, { key, tier, variant: "default" }, p.limits[tier] === key);
  return html ? `<span class="chips stack">${html}</span>` : "";
}

/* >---------------------------------------< Hue circle >---------------------------------------< */

interface Dot {
  readonly hue: number;
  readonly m: number;
  readonly color: string;
  readonly hollow?: boolean;

  /** What the pointer shows on it, e.g. "Red" or "Red, muted". */
  readonly name: string;

  /** An extra color sits among the hues without being spaced, so it's drawn as a diamond to tell it apart. */
  readonly extra?: boolean;
}

/**
 * The hue circle: CAM16 hue around, colorfulness out from the center, with the chosen reference
 * system's hues as spokes (pure hues solid, the rest dashed) and its switch above.
 *
 * @param dots  The colors to place.
 * @returns     SVG.
 */
function circle(dots: readonly Dot[]): string {
  const R = CIRCLE;
  // Rings every M 20, out to the most colorful dot.
  const max = Math.max(60, Math.ceil(Math.max(0, ...dots.map((d) => d.m)) / 20) * 20);
  const at = (hue: number, r: number) => {
    const a = (hue * Math.PI) / 180;
    return [r * Math.cos(a), -r * Math.sin(a)] as const;
  };
  const rings = Array.from({ length: max / 20 }, (_, i) => (i + 1) * 20).map(
    (m) => `<circle r="${String((m / max) * R)}" class="grid"></circle><text x="4" y="${String(-(m / max) * R - 4)}" class="axis">M ${String(m)}</text>`,
  );
  const marks = dots.map((d) => {
    const [x, y] = at(d.hue, (Math.min(d.m, max) / max) * R);
    const [cx, cy] = [x.toFixed(1), y.toFixed(1)];
    const r = d.extra ? (d.hollow ? 8 : 10) : d.hollow ? 7 : 9;
    const paint = `${d.hollow ? `fill="none" stroke="${d.color}" class="ring"` : `fill="${d.color}" class="mark"`} data-name="${d.name}" data-at="${cx} ${cy} ${String(r)}"`;
    if (d.extra)
      return `<rect x="${(x - r / Math.SQRT2).toFixed(1)}" y="${(y - r / Math.SQRT2).toFixed(1)}" width="${(r * Math.SQRT2).toFixed(1)}" height="${(r * Math.SQRT2).toFixed(1)}" rx="${String(r / 4)}" transform="rotate(45 ${cx} ${cy})" ${paint}></rect>`;
    return `<circle cx="${cx}" cy="${cy}" r="${String(r)}" ${paint}></circle>`;
  });
  const legend = dots.some((d) => d.extra)
    ? `<rect x="152" y="185" width="8" height="8" rx="2" transform="rotate(45 156 189)" class="key-mark"></rect><text x="196" y="193" class="axis" text-anchor="end">Extra</text>`
    : "";
  return `<figure class="circle-block guided" data-guides="circle">${guidePicker(state.settings.guide, "circle")}<svg class="circle" viewBox="-212 -212 424 424" role="img" aria-label="Hue circle">
    ${rings.join("")}<g class="guide-layer">${circleGuides(guides(state.settings))}</g>${marks.join("")}${legend}<text class="dot-label" text-anchor="middle"></text></svg></figure>`;
}

// A dot on the hue circle shows its name above it while the pointer is on it.
document.addEventListener("pointerover", (event) => {
  const dot = (event.target as Element).closest<SVGElement>(".circle [data-name]");
  const svg = (event.target as Element).closest(".circle");
  const text = svg?.querySelector<SVGTextElement>(".dot-label");
  if (!text) return;
  if (!dot) return void text.classList.remove("shown");
  const [x, y, r] = dot.dataset.at!.split(" ").map(Number) as [number, number, number];
  // Above the dot, kept inside the circle's box; below it when the dot sits at the top.
  text.textContent = dot.dataset.name!;
  text.setAttribute("x", String(Math.min(Math.max(x, -170), 170)));
  text.setAttribute("y", String(y - r - 8 < -200 ? y + r + 16 : y - r - 8));
  text.classList.add("shown");
});
document.addEventListener("pointerout", (event) => {
  if ((event.target as Element).closest(".circle [data-name]")) document.querySelectorAll(".dot-label.shown").forEach((t) => t.classList.remove("shown"));
});

/* >----------------------------------------< Overview >----------------------------------------< */

/**
 * The identity tier of the current mode, big, with the hue circle.
 *
 * @returns  HTML.
 */
function overview(): string {
  const { settings, mode } = state;
  const tier = settings.identityTier[mode];
  const room = settings.rooms[mode];
  const list = colors(tier);
  if (!list.length) return `<section class="intro"><h1>${isPreset() ? "EK Palette" : "Custom palette"}</h1><p>Solving…</p></section>`;
  const extras = list.filter((c) => c.extra);
  const hues = list.length - extras.length;
  const ring = current()?.[mode].ring[tier] ?? [];
  return `<section class="intro">
      <h1>${isPreset() ? "EK Palette" : "Custom palette"}</h1>
      <p>${extras.length ? `${String(hues)} + ${String(extras.length)} colors that read the same on the ${mode} base: each sits exactly on its APCA contrast. The ${String(hues)} hues aim at the same colorfulness and are as different from their neighbors as they are from theirs; the extra ${extras.length === 1 ? "color stays on its" : "colors stay on their"} own hue.` : `${String(list.length)} colors that read the same on the ${mode} base: each sits exactly on its APCA contrast, aims at the same colorfulness, and is as different from its neighbors as they are from theirs.`}</p>
    </section>
    <section class="glance">
      <h2>At a glance <span class="soft">· Lc ${String(tier)}, the tier that stands for each hue</span></h2>
      <div class="split">
      <div>${circle(list.flatMap((c) => [c.tiers[tier]!.default, c.tiers[tier]!.muted].map((s, i) => ({ hue: s.hue, m: s.colorfulness, color: s.color, extra: c.extra, name: i ? `${label(c.key)}, muted` : label(c.key) }))))}</div>
      <dl class="facts-list">
        <div><dt>Base</dt><dd class="mono">${settings.bases[mode]}</dd></div>
        <div><dt>Room</dt><dd>${String(room.lux)} lux, ${(SURROUNDS[room.surround] ?? "").toLowerCase()} surround</dd></div>
        <div><dt>Colorfulness</dt><dd>${held(tier)}; muted at ${String(Math.round(settings.muted * 100))}%</dd></div>
        <div><dt>Anchor</dt><dd>${label(anchored())} at hue ${anchorHue(settings).toFixed(0)}°, ${anchorSource(settings)}</dd></div>
        <div><dt>Neighbor differences</dt><dd>${range(ring)} (CAM16-UCS)</dd></div>
      </dl>
      </div>
    </section>
    <section>
      <h2>The colors <span class="soft">· Lc ${String(tier)}</span></h2>
      <div class="cards">${list.map((c) => card(c.tiers[tier]!.default, label(c.key), c.key, { key: c.key, tier, variant: "default" })).join("")}</div>
      <h3>Muted</h3>
      <div class="cards small">${list.map((c) => card(c.tiers[tier]!.muted, label(c.key), c.key, { key: c.key, tier, variant: "muted" })).join("")}</div>
    </section>`;
}

/* >-----------------------------------------< Tiers >------------------------------------------< */

/**
 * Every tier of the current mode and variant, one section each.
 *
 * @returns  HTML.
 */
function tiers(): string {
  const { settings, mode, variant } = state;
  return `<section class="intro">
      <h1>Tiers</h1>
      <p>Every color on every APCA contrast against the ${mode} base. Pick the tier by what the color does.</p>
    </section>
    ${settings.tiers
      .map((tier) => {
        const ring = current()?.[mode].ring[tier] ?? [];
        const list = colors(tier);
        return `<section>
          <h2>Lc ${String(tier)} <span class="soft">· ${ROLES[tier] ?? ""}</span></h2>
          <p class="soft">${held(tier)} · neighbor differences ${range(ring)}</p>
          <div class="cards small">${list.map((c) => card(c.tiers[tier]![variant], label(c.key), c.key, { key: c.key, tier, variant })).join("")}</div>
        </section>`;
      })
      .join("")}`;
}

/* >-----------------------------------------< Color >------------------------------------------< */

/** A color table's column: its name, its unit, hidden when the table would scroll sideways, and what it means. */
interface Column {
  readonly key: string;
  readonly name: () => string;
  readonly unit?: string;
  readonly what: () => string;
}

const COLUMNS: readonly Column[] = [
  { key: "tier", name: () => "Tier", what: () => "The contrast step the row sits on, with what it's for. Every color on a tier has the same APCA contrast against the background." },
  { key: "sample", name: () => "Sample", what: () => "The color as a fill and as text on the background." },
  {
    key: "value",
    // Named for the format the gamut gives: hex codes on Standard, CSS color() wider.
    name: () => (state.gamut === "standard" ? "Hex" : "CSS"),
    what: () =>
      state.gamut === "standard"
        ? "The color as a hex code, for every screen."
        : `The color as a CSS color() for ${GAMUT_NAMES[state.gamut]} screens. A screen that can't show it falls back to the nearest color it can; the Standard gamut gives hex codes.`,
  },
  { key: "apca", name: () => "APCA", unit: "Lc", what: () => "Contrast against the background as APCA's Lc, from 15 for faint fills to 90 for long reading. Each color is solved to land exactly on its tier." },
  { key: "wcag", name: () => "WCAG 2", what: () => "Contrast against the background as WCAG 2's ratio, from 1:1 to 21:1, with the level it reaches. Each level's badge explains what it allows." },
  { key: "lightness", name: () => "Lightness", unit: "J", what: () => "How light the color looks, from 0 for black to 100 for white. The tier's contrast fixes it." },
  { key: "chroma", name: () => "Chroma", unit: "C", what: () => "How far the color is from grey, measured against a white under the same light." },
  {
    key: "colorfulness",
    name: () => "Colorfulness",
    unit: "M",
    what: () => "How much color the eye sees, on its own scale rather than against white. The palette aims a tier's colors at the same M so they look equally vivid; a chip says when a color falls short of its own aim.",
  },
  { key: "hue", name: () => "Hue", what: () => "The hue angle around the color wheel, 0 to 360°, and how it reads as a mix of the four unique hues: R 4 B is red with 4% blue." },
];

/**
 * A column heading as a button that opens what the column means.
 *
 * @param col    The column.
 * @param table  Which table it heads, so each heading opens its own popover.
 * @returns      HTML.
 */
function heading(col: Column, table: string): string {
  const name = col.name();
  const unit = col.unit ? `<span class="unit"> ${col.unit}</span>` : "";
  return popButton(`column:${col.key}:${table}`, `${name}${unit}`, `What ${name} means`, "metric");
}

popSource("column", (which) => {
  const col = COLUMNS.find((c) => c.key === which.split(":")[0]);
  return col ? `<h3>${col.name()}${col.unit ? ` ${col.unit}` : ""}</h3><p>${col.what()}</p>` : "";
});

/**
 * Hides the column units of tables that would scroll sideways with them.
 */
function fitTables(): void {
  for (const box of document.querySelectorAll<HTMLElement>(".scroll.units")) {
    box.classList.remove("compact");
    box.classList.toggle("compact", box.scrollWidth > box.clientWidth);
  }
}

/**
 * One color: every tier, default and muted, with all its numbers.
 *
 * @param key  The color.
 * @returns    HTML.
 */
function color(key: string): string {
  const tier = state.settings.identityTier[state.mode];
  const list = colors(tier);
  const c = list.find((x) => x.key === key);
  if (!c) return `<section class="intro"><h1>${label(key)}</h1><p>${list.length ? "There's no such color in this palette." : "Solving…"}</p></section>`;
  const identity = c.tiers[tier]!.default;
  const table = (variant: Variant) => {
    const rows = state.settings.tiers.filter((t) => c.tiers[t]);
    return `<section>
      <h2>${variant === "default" ? "Default" : "Muted"}</h2>
      <div class="scroll units"><table>
        <thead><tr>${COLUMNS.map((col) => `<th scope="col">${heading(col, variant)}</th>`).join("")}</tr></thead>
        <tbody>${rows
          .map((t) => {
            const s = c.tiers[t]![variant];
            return `<tr>
              <th scope="row">Lc ${String(t)}<span class="soft">${ROLES[t] ?? ""}</span></th>
              <td><span class="pair" style="--c:${s.color}"><span class="fill"></span><span class="sample">Aa</span></span></td>
              <td class="mono">${copyable(s.color)}</td>
              <td class="mono">${s.apca.toFixed(1)}</td>
              <td><span class="facts"><span class="mono">${s.wcag.toFixed(2)}</span>${badge(s)}</span></td>
              <td class="mono">${s.lightness.toFixed(1)}</td>
              <td class="mono">${s.chroma.toFixed(1)}</td>
              <td class="mono"><span class="facts">${s.colorfulness.toFixed(1)}${variant === "default" ? lowered(c.key, t, s) : ""}</span></td>
              <td class="mono">${s.hue.toFixed(1)}° <span class="soft">${s.name}</span></td>
            </tr>`;
          })
          .join("")}</tbody>
      </table></div>
    </section>`;
  };
  return `<nav class="chips" aria-label="Colors">${list
    .map((x) => `<a href="#${x.key}" style="--c:${x.tiers[tier]!.default.color}"${x.key === key ? ' aria-current="page"' : ""}><span class="dot"></span>${label(x.key)}</a>`)
    .join("")}</nav>
    <section class="intro hero" style="--c:${identity.color}">
      <h1>${label(key)}</h1>
      <p>CAM16 hue ${identity.hue.toFixed(1)}°, read as ${identity.name}. Aims at colorfulness ${c.target.toFixed(0)}${state.settings.equalTiers ? ". A tier lowers it to what its least colorful hue can reach." : "."}</p>
    </section>
    ${table("default")}${table("muted")}`;
}

/* >----------------------------------------< Compare >-----------------------------------------< */

/**
 * Codemos next to EK Palette on the identity tier: the hue circle, each color, and how even the
 * differences between neighbors are.
 *
 * @returns  HTML.
 */
function compare(): string {
  const { settings, mode, variant } = state;
  if (settings.hues !== NAMES.length)
    return `<section class="intro"><h1>Compare with Codemos</h1><p>Codemos has eight hues. Set Hues to 8 in Settings to compare.</p></section>`;
  const m = model();
  const base = settings.bases[mode];
  const tier = settings.identityTier[mode];
  const source = variant === "default" ? CODEMOS[mode] : CODEMOS_MUTED[mode];
  const rows = colors(tier)
    .filter((c) => source[c.key])
    .map((c) => {
      // Codemos's color described like the palette's, aiming at what it is.
      const color = source[c.key]!;
      const old = swatch(m, base, mode, color, m.cam(mode, color).m);
      return { key: c.key, extra: c.extra, old, now: c.tiers[tier]![variant] };
    });
  const ring = (list: readonly string[]) => neighbors(m, mode, list);
  const hues = rows.filter((r) => !r.extra);
  const oldRing = ring(hues.map((r) => r.old.color));
  const newRing = ring(hues.map((r) => r.now.color));
  const most = Math.max(...oldRing, ...newRing);
  const bars = (values: readonly number[]) =>
    values
      .map(
        (d, i) => `<div class="bar-row"><span class="soft">${label(hues[i]!.key)} → ${label(hues[(i + 1) % hues.length]!.key)}</span>
          <span class="bar"><span style="width:${((d / most) * 100).toFixed(1)}%"></span></span><span class="mono">${d.toFixed(1)}</span></div>`,
      )
      .join("");
  return `<section class="intro">
      <h1>Compare with Codemos</h1>
      <p>Codemos's ${variant} colors next to EK Palette's on Lc ${String(tier)}, on the ${mode} base. Codemos was picked by eye; EK Palette is solved.</p>
    </section>
    <section class="split">
      <div>${circle([...rows.map((r) => ({ hue: r.old.hue, m: r.old.colorfulness, color: r.old.color, hollow: true, extra: r.extra, name: `${label(r.key)}, Codemos` })), ...rows.map((r) => ({ hue: r.now.hue, m: r.now.colorfulness, color: r.now.color, extra: r.extra, name: `${label(r.key)}, EK Palette` }))])}</div>
      <div class="legend">
        <p><span class="key hollow"></span> Codemos <span class="key"></span> EK Palette</p>
        <p class="soft">Distance from the center is colorfulness. EK Palette's dots share one ring; Codemos's scatter, so some of its colors look stronger than others.</p>
      </div>
    </section>
    <section>
      <h2>Each color</h2>
      <div class="pairs">${rows
        .map(
          (r) => `<div class="versus"><h3>${label(r.key)}</h3>${card(r.old, "Codemos")}${card(r.now, "EK Palette", r.key, { key: r.key, tier, variant })}</div>`,
        )
        .join("")}</div>
    </section>
    <section>
      <h2>Neighbor differences <span class="soft">· CAM16-UCS</span></h2>
      <p class="soft">How different each color looks from the next one around the circle. Even bars mean no two neighbors are easier to confuse than the rest.</p>
      <div class="split even">
        <div><h3>Codemos <span class="soft">· ${range(oldRing)}</span></h3>${bars(oldRing)}</div>
        <div><h3>EK Palette <span class="soft">· ${range(newRing)}</span></h3>${bars(newRing)}</div>
      </div>
    </section>`;
}

/* >----------------------------------------< Settings >----------------------------------------< */

/**
 * A number control bound to a setting.
 *
 * @param path   The setting, e.g. "colorfulness" or "rooms.dark.lux".
 * @param title  Its label.
 * @param range  Min, max and step.
 * @param range.0  Minimum.
 * @param range.1  Maximum.
 * @param range.2  Step.
 * @param slider Whether to show a slider too.
 * @returns      HTML.
 */
function number(path: string, title: string, [min, max, step]: readonly [number, number, number], slider = false): string {
  const value = String(read(path) ?? 0);
  const id = `set-${path.replaceAll(".", "-")}`;
  return `<label class="field" for="${id}"><span>${title}</span>
    ${slider ? `<input type="range" data-set="${path}" min="${String(min)}" max="${String(max)}" step="${String(step)}" value="${value}" aria-label="${title}">` : ""}
    <input id="${id}" type="number" data-set="${path}" min="${String(min)}" max="${String(max)}" step="${String(step)}" value="${value}">
  </label>`;
}

/**
 * A setting by its path.
 *
 * @param path  E.g. "rooms.dark.lux".
 * @returns     Its value.
 */
function read(path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], state.settings);
}

/**
 * Changes a setting by its path.
 *
 * @param path   E.g. "rooms.dark.lux".
 * @param value  The new value.
 */
function write(path: string, value: unknown): void {
  const next = structuredClone(state.settings) as unknown as Record<string, unknown>;
  const keys = path.split(".");
  let o = next;
  // A number in the path is an index into a list; a missing step is made as a list or an object to match.
  keys.slice(0, -1).forEach((k, i) => (o = (o[k] ??= /^\d+$/.test(keys[i + 1]!) ? [] : {}) as Record<string, unknown>));
  o[keys.at(-1)!] = value;
  state.settings = next as unknown as Settings;
  save();
}

/**
 * One extra color's settings: its name, hue and share of the colorfulness, under a title showing
 * its color on the identity tier and how its hue reads.
 *
 * @param i  Which extra color.
 * @returns  HTML.
 */
function extraFields(i: number): string {
  const name = escape(state.settings.extras[i]!.name);
  return `<div class="extra" data-extra="${String(i)}">
    <h3 class="extra-title">${extraTitle(i)}<button type="button" class="link" data-action="remove-extra" data-index="${String(i)}">Remove</button></h3>
    <label class="field wide" for="set-extras-${String(i)}-name"><span>Name</span><input id="set-extras-${String(i)}-name" type="text" data-extra-name="${String(i)}" value="${name}" spellcheck="false"></label>
    ${number(`extras.${String(i)}.hue`, "Hue", [0, 359.9, 0.1], true)}
    ${number(`extras.${String(i)}.share`, "Colorfulness share", [0.1, 1, 0.05], true)}
  </div>`;
}

/**
 * An extra color's title: a dot of its color on the identity tier, its name, and its hue's reading.
 *
 * @param i  Which extra color.
 * @returns  HTML.
 */
function extraTitle(i: number): string {
  const extra = state.settings.extras[i]!;
  const key = extraKeys(state.settings)[i]!;
  const tier = state.settings.identityTier[state.mode];
  const color = current()?.[state.mode].colors.find((c) => c.key === key)?.tiers[tier]?.default.color ?? "transparent";
  return `<span class="extra-name"><span class="dot" style="--c:${color}"></span>${label(key)}<span class="soft">${extra.hue.toFixed(1)}° · ${composition(extra.hue)}</span></span>`;
}

/**
 * The settings, a group at a time, with a live strip of the identity tier.
 *
 * @returns  HTML.
 */
function tune(): string {
  const s = state.settings;
  return `<section class="intro">
      <h1>Settings</h1>
      <p>Change a setting and the palette solves again. Changes stay in this browser.</p>
      <p class="row"><button type="button" data-action="reset">Reset to EK Palette</button><button type="button" data-action="copy-settings">Copy settings</button><span id="copied" class="soft" role="status"></span></p>
    </section>
    <div id="palette-strip" class="strip"></div>
    <section class="group">
      <h2>Hue (H)</h2>
      ${number("hues", "How many hues", [4, 16, 1])}
      <p class="soft">The uniform lineup divides the circle evenly from the anchor, then evens out the differences between neighbors as they're seen rather than as numbers. From there, colors can be placed where their names fit best: drag one on the Current row and the others re-space around it.</p>
      <p class="soft">The anchor fixes where the lineup sits: the differences between neighbors barely change if the whole lineup turns, so something has to hold it. ${label(anchored())} stays exactly on it.</p>
      <p><a href="#hue-test" class="button">Measure it with the blind hue test</a></p>
      <label class="field wide" for="set-anchor"><span>Anchor</span><select id="set-anchor" data-anchor="from">${[
        ...SYSTEMS.map((r) => [r.id, `${r.name} yellow`] as const),
        ["hand", "Set by hand"] as const,
      ]
        .map(([id, name]) => `<option value="${id}" ${(typeof s.anchor === "number" ? "hand" : s.anchor) === id ? "selected" : ""}>${name}</option>`)
        .join("")}</select></label>
      <label class="field" for="set-anchor-hue"><span>Anchor hue</span>
        <input type="range" data-anchor-hue min="0" max="359" step="1" value="${String(Math.round(anchorHue(s)))}" aria-label="Anchor hue">
        <input id="set-anchor-hue" type="number" data-anchor-hue min="0" max="359" step="1" value="${String(Math.round(anchorHue(s)))}">
      </label>
      ${huesEditor(huesView())}
    </section>
    <section class="group">
      <h2>Colorfulness (M)</h2>
      <p class="soft">One CAM16 colorfulness every color aims at, in both modes. A color the screen can't make that colorful goes as far as it can.</p>
      ${number("colorfulness", "Target M", [10, 80, 1], true)}
      ${number("muted", "Muted share", [0.1, 0.9, 0.05], true)}
      <label class="field" for="set-equal"><span>Equal per tier</span><input id="set-equal" type="checkbox" data-action="equal" ${s.equalTiers ? "checked" : ""}></label>
      <p class="soft">On: a tier aims at what its least colorful hue can reach, so every color on it is equally colorful. Off: each color goes as far as the screen allows.</p>
      <h3>Per hue</h3>
      <p class="soft">${MODE_NAMES[state.mode]} mode's curve; switch Light and Dark above to edit the other. Colorfulness added or taken away smoothly over hue, for parts of the circle that look weaker or stronger than the model says. Its points add up.</p>
      <p><a href="#curve-test" class="button">Measure it with the blind colorfulness test</a></p>
      ${curveEditor(curveView(state.mode), (path, title, range) => number(path, title, range))}
    </section>
    <section class="group">
      <h2>Extra colors</h2>
      <p class="soft">Colors beside the evenly spaced hues. Each stays on its own hue at a share of the tier's colorfulness, on every tier, with a muted version too. They aren't spaced with the hues or measured by the blind tests.</p>
      ${s.extras.map((_, i) => extraFields(i)).join("")}
      <p><button type="button" data-action="add-extra">Add an extra color</button></p>
    </section>
    <section class="group">
      <h2>Tiers</h2>
      <p class="soft">The APCA contrasts every color gets. The identity tier stands for the hue and sets every tier's starting hues.</p>
      <div class="checks">${Object.keys(ROLES)
        .map(Number)
        .map((t) => `<label for="tier-${String(t)}"><input id="tier-${String(t)}" type="checkbox" data-tier="${String(t)}" ${s.tiers.includes(t) ? "checked" : ""}> Lc ${String(t)}</label>`)
        .join("")}</div>
      ${MODES.map(
          (m) => `<label class="field" for="set-identity-${m}"><span>Identity, ${m}</span><select id="set-identity-${m}" data-set="identityTier.${m}">${s.tiers
            .map((t) => `<option value="${String(t)}" ${t === s.identityTier[m] ? "selected" : ""}>Lc ${String(t)}</option>`)
            .join("")}</select></label>`,
        )
        .join("")}
    </section>
    <section class="group">
      <h2>Viewing</h2>
      <p class="soft">Where the colors are seen. The same screen color looks different on a light page and a dark one, and in a bright room and a dim one, so each mode is solved for its own background and room; <a href="#how">How it works</a> shows the difference.</p>
      <dl class="facts-list">
        <div><dt>Base</dt><dd>The background the mode's colors sit on. Every contrast is measured against it, so set it to the page the colors will be used on.</dd></div>
        <div><dt>Room lux</dt><dd>How much light is in the room. The brighter it is, the more colorful colors look, so a dim room needs more color on the screen for the same look. Light mode is seen in a lit room (200), dark mode in a dim one (64), as the sRGB standard has them.</dd></div>
        <div><dt>Surround</dt><dd>How bright the room around the screen is, next to the screen itself: Average for a lit office, Dim for a dim living room in the evening, Dark for a dark room, like a cinema. A darker surround makes colors look less contrasty and less colorful.</dd></div>
      </dl>
      <div class="split even">${(["light", "dark"] as const)
        .map(
          (m) => `<div><h3>${MODE_NAMES[m]}</h3>
            <label class="field" for="set-base-${m}"><span>Base</span><input id="set-base-${m}" type="text" data-set="bases.${m}" value="${s.bases[m]}" spellcheck="false" pattern="#[0-9A-Fa-f]{6}"></label>
            ${number(`rooms.${m}.lux`, "Room lux", [1, 1000, 1])}
            <label class="field" for="set-surround-${m}"><span>Surround</span><select id="set-surround-${m}" data-set="rooms.${m}.surround">${SURROUNDS.map((name, i) => `<option value="${String(i)}" ${i === s.rooms[m].surround ? "selected" : ""}>${name}</option>`)
              .join("")}</select></label></div>`,
        )
        .join("")}</div>
    </section>
    ${exportSection()}
    ${about()}`;
}

/** The rows of the strip: each step of the palette, added one at a time. */
const STEPS = [
  { name: "Uniform", title: "Uniform: these settings with nothing placed and colorfulness the same for every hue" },
  { name: "Turned", title: "Turned: the uniform lineup turned to best match the placed hues, still uniform" },
  { name: "+H", title: "+H: with colors placed by hand" },
  { name: "+M", title: "+M: with colorfulness per hue too, the palette in use" },
] as const;

/** The even gap between neighbors of the uniform lineup, per mode, kept until the next solve. */
const evenGaps = new Map<Mode, number>();

/** The last solve of each step, kept until the next arrives so nothing jumps. */
const lastSteps = new Map<string, readonly Color[]>();

/** One color across the strip's rows: Uniform, Turned, +H, +M. */
interface Change {
  readonly key: string;
  readonly name: string;
  readonly color: string;

  /** Per row, ΔE from its turned version: how far that row bends it. */
  readonly bend: readonly [number, number, number, number];

  /** ΔE from the uniform lineup to the palette in use, turn included. */
  readonly moved: number;

  /** Per row, its colorfulness against the row's target, as a share (0.25 is 25% over). */
  readonly colorful: readonly [number, number, number, number];

  /** Per row, what its bend is made of: hue, colorfulness and lightness shares. */
  readonly splits: readonly [Split, Split, Split, Split];

  /** The edits behind it: degrees placed, colorfulness added. */
  readonly turned: number;
  readonly added: number;
}

/** One row's neighbor gaps, in ring order: gap i is between keys i and i + 1. */
interface Ring {
  readonly gaps: readonly number[];
  readonly keys: readonly string[];
}

/** A difference's hue, colorfulness and lightness shares. */
type Split = ReturnType<typeof parts>;

/** Rows: the uniform lineup, turned, with placed hues, with colorfulness per hue. */
type Row = 0 | 1 | 2 | 3;

/** What the strip shows, kept for its column and popovers. */
let changes: {
  readonly tier: number;
  readonly gap: number;
  readonly turn: number;
  readonly colors: readonly Change[];
  readonly rings: readonly [Ring, Ring, Ring, Ring];
  readonly targets: readonly [number, number, number, number];
} = { tier: 0, gap: 9, turn: 0, colors: [], rings: [0, 1, 2, 3].map(() => ({ gaps: [], keys: [] })) as unknown as [Ring, Ring, Ring, Ring], targets: [0, 0, 0, 0] };

/** The color the column shows instead of the whole palette, while a swatch is pointed at. */
let focusKey: string | null = null;

/**
 * Draws a mode's palette row by row, each color as a swatch with one band per row, so they touch.
 * Under each, how far it bends from the turned lineup, in gaps; beside them, per row, how bent the
 * palette is, how even and how equally colorful. Each opens its details.
 *
 * @param el    Where to draw.
 * @param mode  The mode.
 */
function drawComparison(el: Element, mode: Mode): void {
  const tier = state.settings.identityTier[mode];
  // Always the palette as set, whatever the H and M switches show: the strip is what they compare.
  const now = inUse()?.[mode].colors ?? [];
  const palettes = [plain()?.[mode], uncurved()?.[mode], inUse()?.[mode]];
  const steps = palettes.slice(0, 2).map((palette, i) => {
    if (palette) lastSteps.set(`${mode}|${String(i)}`, palette.colors);
    return lastSteps.get(`${mode}|${String(i)}`) ?? now;
  });
  // The palette's own scale: the even gap between neighbors in the uniform lineup.
  const uniformRing = palettes[0]?.ring[tier];
  if (uniformRing?.length) evenGaps.set(mode, uniformRing.reduce((x, y) => x + y, 0) / uniformRing.length);
  const gap = evenGaps.get(mode) ?? 9;
  const twist = turned(mode);
  const angle = turn(mode) ?? 0;
  const target = (p: ModePalette | undefined) => p?.targets[tier] ?? state.settings.colorfulness;
  const targets: [number, number, number, number] = [target(palettes[0]), target(palettes[0]), target(palettes[1]), target(palettes[2])];
  const ringOf = (p: ModePalette | undefined): Ring => {
    const gaps = p?.ring[tier] ?? [];
    return { gaps, keys: (p?.colors ?? []).slice(0, gaps.length).map((c) => c.key) };
  };
  const evenRing = ringOf(palettes[0]);
  const rings: [Ring, Ring, Ring, Ring] = [evenRing, twist?.ring ? { gaps: twist.ring, keys: twist.keys ?? evenRing.keys } : evenRing, ringOf(palettes[1]), ringOf(palettes[2])];
  const colors: Change[] = [];
  const items = now.map((c) => {
    if (c.extra) return "";
    const found = [...steps, now].map((list) => list.find((b) => b.key === c.key)?.tiers[tier]?.default ?? c.tiers[tier]?.default);
    if (found.some((x) => !x)) return "";
    const [first, hued, last] = found as [Swatch, Swatch, Swatch];
    const turnedOne = twist?.colors[c.key] ?? first;
    const swatches = [first, turnedOne, hued, last];
    const from = (color: string) => model().distance(mode, turnedOne.color, color);
    const change: Change = {
      key: c.key,
      name: label(c.key),
      color: last.color,
      bend: [from(first.color), 0, from(hued.color), from(last.color)],
      moved: model().distance(mode, first.color, last.color),
      colorful: [first.colorfulness / targets[0] - 1, turnedOne.colorfulness / targets[1] - 1, hued.colorfulness / targets[2] - 1, last.colorfulness / targets[3] - 1],
      splits: [first, turnedOne, hued, last].map((sw) => parts(model().cam(mode, turnedOne.color), model().cam(mode, sw.color))) as unknown as [Split, Split, Split, Split],
      turned: Math.round((((hued.hue - turnedOne.hue + 540) % 360) - 180)),
      added: Math.round(boost(state.settings, mode, last.hue)),
    };
    colors.push(change);
    const fills = swatches.map((sw, i) => `<span class="fill" data-row="${String(i)}" style="--f:${sw.color}"></span>`).join("");
    const rows = swatches.map((sw, i) => `--f${String(i)}:${sw.color}`).join(";");
    const amount = inGaps(change.bend[3] / gap).replace(/ gaps?$/, (unit) => `<span class="unit">${unit}</span>`);
    return `<span class="strip-item${change.bend[3] >= 2 ? " changed" : ""}" data-key="${c.key}" style="--c:${last.color};${rows}">
      ${fills}<span class="cover" aria-hidden="true"></span>${popButton(`change:${c.key}`, `<span class="name">${change.name}</span> ${amount}`, `How ${change.name} changed`, "strip-gap mono")}</span>`;
  });
  changes = { tier, gap, turn: angle, colors, rings, targets };
  if (focusKey && !colors.some((c) => c.key === focusKey)) focusKey = null;
  const names = STEPS.map((step, i) => {
    const text = i === 1 ? `${step.name} ${angle > 0 ? "+" : angle < 0 ? "−" : ""}${Math.abs(angle).toFixed(1)}°` : step.name;
    return `<button type="button" data-row="${String(i)}" aria-pressed="${String(pinned === i)}" aria-label="${step.title}">${text}</button>`;
  }).join("");
  el.innerHTML = `<span class="strip-labels">${names}</span><div class="strip-items">${items.join("")}</div><div class="strip-metrics mono">${metrics()}</div>`;
  if (pinned !== null && !el.classList.contains("focused")) showRow(pinned);
}

/* >----------------------------------------< Metrics >-----------------------------------------< */

/**
 * A share as a signed percentage.
 *
 * @param share  E.g. 0.25.
 * @returns      E.g. "+25%", "−8%", "0%".
 */
function percent(share: number): string {
  const value = Math.round(share * 100);
  return value === 0 ? "0%" : `${value > 0 ? "+" : "−"}${String(Math.abs(value))}%`;
}

/**
 * How bent a row's palette is: each color's difference from its turned version, in gaps, averaged
 * as a root mean square, so one large difference isn't hidden among small ones.
 *
 * @param row  The row.
 * @returns    Gaps.
 */
function averageBend(row: Row): number {
  const { colors, gap } = changes;
  if (!colors.length) return 0;
  return Math.sqrt(colors.reduce((sum, c) => sum + (c.bend[row] / gap) ** 2, 0) / colors.length);
}

/**
 * What a row's bend is made of, over every color: each color's shares weighted by how much it
 * bends (its share of the whole sum of squares, in CAM16-UCS's plain distance).
 *
 * @param row  The row.
 * @returns    Hue, colorfulness and lightness shares.
 */
function bendSplit(row: Row): Split {
  let [weight, hue, colorfulness, lightness] = [0, 0, 0, 0];
  for (const c of changes.colors) {
    const w = (c.bend[row] / 1.41) ** (2 / 0.63);
    [weight, hue, colorfulness, lightness] = [weight + w, hue + w * c.splits[row].hue, colorfulness + w * c.splits[row].colorfulness, lightness + w * c.splits[row].lightness];
  }
  return weight ? { hue: hue / weight, colorfulness: colorfulness / weight, lightness: lightness / weight } : { hue: 0, colorfulness: 0, lightness: 0 };
}

/**
 * A row's neighbor gaps against the even gap, as shares (−0.08 is 8% closer).
 *
 * @param row  The row.
 * @returns    Each pair's names and how far off even it is.
 */
function offsets(row: Row): { pair: string; keys: [string, string]; off: number }[] {
  const { rings, gap } = changes;
  const ring = rings[row];
  return ring.gaps.map((g, i) => {
    const keys: [string, string] = [ring.keys[i]!, ring.keys[(i + 1) % ring.keys.length]!];
    return { pair: `${label(keys[0])}–${label(keys[1])}`, keys, off: g / gap - 1 };
  });
}

/**
 * The value furthest from zero.
 *
 * @param values  Shares.
 * @returns       The one with the largest size, or 0.
 */
function furthest(values: readonly number[]): number {
  return values.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
}

/**
 * The column beside the strip: per row from Turned on, how bent the palette is, how even and how
 * equally colorful; or, while a swatch is pointed at, the same for that color.
 *
 * @returns  HTML.
 */
function metrics(): string {
  const color = focusKey ? changes.colors.find((c) => c.key === focusKey) : undefined;
  const rows: Row[] = [1, 2, 3];
  const cells = rows.flatMap((row) => {
    if (color) {
      const mine = offsets(row).filter((o) => o.keys.includes(color.key)).map((o) => o.off);
      return [
        `<span class="metric">${(color.bend[row] / changes.gap).toFixed(2)}</span>`,
        `<span class="metric even">${percent(furthest(mine))}</span>`,
        `<span class="metric colorful">${percent(color.colorful[row])}</span>`,
      ];
    }
    const even = Math.max(0, ...offsets(row).map((o) => Math.abs(o.off)));
    return [
      popButton(`metric:bend:${String(row)}`, averageBend(row).toFixed(2), `How bent ${STEPS[row].name} is`, "metric"),
      popButton(`metric:even:${String(row)}`, `±${String(Math.round(even * 100))}%`, `How even ${STEPS[row].name} is`, "metric even"),
      popButton(`metric:colorful:${String(row)}`, percent(furthest(changes.colors.map((c) => c.colorful[row]))), `How equally colorful ${STEPS[row].name} is`, "metric colorful"),
    ];
  });
  const heads = [
    popButton("metric:bend:head", "Bend", "What Bend means", "metric head"),
    popButton("metric:even:head", "Even", "What Even means", "metric head even"),
    popButton("metric:colorful:head", "M", "What M means", "metric head colorful"),
  ];
  // Below, the palette's bend on its zones; or the color pointed at, on the same scale.
  const bend = color ? color.bend[3] / changes.gap : averageBend(3);
  const scope = color
    ? `<span class="metric-scope">${bendMeter(bend)}<span class="scope-text"><span class="dot" style="--c:${color.color}"></span> ${color.name}</span></span>`
    : popButton("metric:verdict", `${bendMeter(bend)}<span class="scope-text">${zone(bend).name} ⓘ</span>`, `Bend ${bend.toFixed(2)} gap: ${zone(bend).name}. What it means`, "metric-scope");
  return heads.join("") + cells.join("") + scope;
}

/**
 * Shows the column for one color, or for the whole palette.
 *
 * @param key  The color, or null.
 */
function showMetrics(key: string | null): void {
  if (key === focusKey) return;
  focusKey = key;
  const column = document.querySelector("#palette-strip .strip-metrics");
  if (column) column.innerHTML = metrics();
}

/**
 * A change split into hue, colorfulness and lightness, as a bar with its shares.
 *
 * @param split  The shares.
 * @returns      HTML.
 */
function splitBar(split: ReturnType<typeof parts>): string {
  const whole = (x: number) => `${String(Math.round(x * 100))}%`;
  const kinds = [
    ["hue", "Hue", split.hue],
    ["colorfulness", "Colorfulness", split.colorfulness],
    ["lightness", "Lightness", split.lightness],
  ] as const;
  return `<div class="pop-split" aria-hidden="true">${kinds.map(([kind, , share]) => `<span class="${kind}" style="flex-grow:${share.toFixed(4)}"></span>`).join("")}</div>
    <p class="pop-legend">${kinds.map(([kind, name, share]) => `<span><i class="${kind}"></i>${name} ${whole(share)}</span>`).join("")}</p>`;
}

/**
 * A turn in degrees, signed.
 *
 * @param degrees  The turn.
 * @returns        E.g. "+8.3°".
 */
function turnText(degrees: number): string {
  return `${degrees > 0 ? "+" : degrees < 0 ? "−" : ""}${Math.abs(degrees).toFixed(1)}°`;
}

popSource("tools", (which) => {
  const { bases } = state.settings;
  if (which === "palette")
    return `<h3>Palette: Light and Dark</h3>
      <p>Two palettes, each made for its own background: <span class="mono">${bases.light}</span> for light and <span class="mono">${bases.dark}</span> for dark. Every color sits exactly on its contrast against that background, so a light-mode color and its dark-mode twin differ.</p>
      <p class="pop-how">Switching also turns this page into that background, so you see the colors where they're meant to be used. It isn't a separate theme for the site.</p>`;
  if (which === "edits")
    return `<h3>Edits: H and M</h3>
      <p>Switch edits off to see the pages without them: <strong>H</strong> is the placed hues, <strong>M</strong> colorfulness per hue. With both off, the pages show the uniform palette for these settings. The edits themselves stay as they are; this only changes what the pages show.</p>
      <p class="pop-how">Settings, the blind tests and Export always use the palette with every edit.</p>`;
  if (which === "variant")
    return `<h3>Variant: Default and Muted</h3>
      <p>Every color comes in two strengths on every tier: <strong>Default</strong> at the palette's colorfulness, and <strong>Muted</strong> at ${String(Math.round(state.settings.muted * 100))}% of it, for quieter uses like backgrounds and borders. Both keep the same hue and contrast.</p>`;
  return `<h3>Gamut: how many colors a screen can show</h3>
    <dl class="pop-facts words">
      <div><dt>Standard</dt><dd>What every screen can show.</dd></div>
      <div><dt>Wide</dt><dd>Most phones, tablets and Macs from recent years; more vivid colors.</dd></div>
      <div><dt>Ultra</dt><dd>The widest screens, mostly future and HDR ones.</dd></div>
    </dl>
    <p>Each one gets its own palette: a wider screen can reach more colorfulness, so the same hue can be more vivid there. This screen shows <strong>${GAMUT_NAMES[SCREEN]}</strong>, marked with a dot.</p>
    <p class="pop-how">On a screen narrower than the one chosen, the page shows the closest colors it can, and says so.</p>`;
});

popSource("change", (key) => {
  const c = changes.colors.find((x) => x.key === key);
  if (!c) return "";
  const { gap, tier, turn: angle } = changes;
  return `<h3><span class="dot" style="--c:${c.color}"></span> ${c.name}</h3>
    <p class="pop-lead">Bends <strong>${inGaps(c.bend[3] / gap) || "nothing"}</strong> from the turned lineup: ${visibility(c.bend[3])}.</p>
    ${c.bend[3] >= 0.05 ? splitBar(c.splits[3]) : ""}
    <dl class="pop-facts">
      <div><dt>+H</dt><dd>${inGaps(c.bend[2] / gap) || "no bend"}${c.turned ? ` · ${turnText(c.turned)} from turned` : ""}</dd></div>
      <div><dt>+M</dt><dd>${inGaps(c.bend[3] / gap) || "no bend"} in all${c.added ? ` · ${signed(c.added)} M, ${percent(c.colorful[3])} of the target` : ""}</dd></div>
      <div><dt>Uniform</dt><dd>${inGaps(c.moved / gap) || "no change"} from the lineup at the anchor, turn ${turnText(angle)} included</dd></div>
    </dl>
    <p class="pop-how">${c.name} in the turned lineup (the uniform lineup turned ${turnText(angle)}, still uniform) is compared with ${c.name} in use, on Lc ${String(tier)}, as CAM16-UCS ΔE (${c.bend[3].toFixed(1)}), then divided by the even gap (${gap.toFixed(1)}). The bar shows the bend's hue, colorfulness and lightness parts.</p>`;
});

popSource("metric", (which) => {
  const { gap, targets, turn: angle } = changes;
  const [kind, which2] = which.split(":") as [string, string | undefined];
  if (kind === "verdict") {
    const bend = averageBend(3);
    const split = bendSplit(3);
    const evenOff = Math.max(0, ...offsets(3).map((o) => Math.abs(o.off)));
    const vivid = [...changes.colors].sort((a, b) => Math.abs(b.colorful[3]) - Math.abs(a.colorful[3]))[0];
    return `<h3>${zone(bend).name}: bend ${bend.toFixed(2)} gap</h3>
      ${bendMeter(bend, true)}
      <p>${zone(bend).note}</p>
      ${bend >= 0.005 ? splitBar(split) : ""}
      <dl class="pop-facts">
        <div><dt>Even</dt><dd>±${String(Math.round(evenOff * 100))}%: ${evenness(evenOff)}</dd></div>
        <div><dt>M</dt><dd>${vivid && Math.abs(vivid.colorful[3]) >= 0.005 ? `${percent(vivid.colorful[3])} (${vivid.name})` : "equal"}</dd></div>
        <div><dt>Turned</dt><dd>${turnText(angle)}, which costs nothing</dd></div>
      </dl>
      <p class="pop-how">You're on safe ground while Bend stays within Tuned or Reshaped and Even under 10%: deliberate adjustments, with every pair of neighbors still about equally easy to tell apart. It gets risky when Even passes 25% (two colors getting confusable) or Bend passes 0.5, where the palette is no longer honestly uniform.</p>
      ${zoneTable()}`;
  }
  const heads: Record<string, string> = {
    bend: `<h3>Bend</h3><p>How far the colors are from the nearest uniform lineup. Turning the whole lineup keeps it uniform, so the uniform lineup is first turned to best match the placed hues (${turnText(angle)}); what's left is the bend. Each color's difference, in gaps (one gap is ${gap.toFixed(1)} ΔE), averaged as a root mean square, so one large difference isn't hidden among small ones.</p>${zoneTable()}<p class="pop-how">Rows: Uniform is the lineup at the anchor; Turned is it turned to match; +H adds placed hues; +M adds colorfulness per hue. Point at a swatch for that color; click a row's name to keep it shown, then ↑ and ↓ switch rows.</p>`,
    even: `<h3>Even</h3><p>How evenly spaced neighbors are: the gap furthest from the even gap, as a share of it. This is the uniform lineup's main promise: every pair of neighbors equally easy to tell apart.</p><p class="pop-how">Under 10% is fine, 10 to 25% worth watching, over 25% two colors are getting confusable (or, over even, a hole in the palette).</p>${THRESHOLDS}`,
    colorful: `<h3>M</h3><p>How equally colorful the colors are: the color furthest from the target colorfulness (M ${targets[3].toFixed(1)} on this tier), as a share of it. The uniform lineup makes every color equally colorful; colorfulness per hue changes that on purpose, so this says how far you've pushed.</p>`,
  };
  if (which2 === "head") return heads[kind] ?? "";
  const row = Number(which2) as Row;
  const title = `${STEPS[row].name}: ${{ bend: "bend", even: "evenness", colorful: "colorfulness" }[kind] ?? ""}`;
  if (kind === "bend") {
    const split = bendSplit(row);
    const list = [...changes.colors]
      .toSorted((a, b) => b.bend[row] - a.bend[row])
      .map((c) => `<div><dt><span class="dot" style="--c:${c.color}"></span> ${c.name}</dt><dd>${(c.bend[row] / gap).toFixed(2)} gap</dd></div>`)
      .join("");
    return `<h3>${title}</h3><p class="pop-lead">Average ${averageBend(row).toFixed(2)} gap from the turned lineup: ${zone(averageBend(row)).name}.</p>${bendMeter(averageBend(row), true)}${averageBend(row) >= 0.005 ? splitBar(split) : ""}<dl class="pop-facts">${list}</dl>`;
  }
  if (kind === "even") {
    const ring = changes.rings[row];
    const list = offsets(row)
      .map((o) => `<div><dt>${o.pair}</dt><dd>${percent(o.off)}</dd></div>`)
      .join("");
    return `<h3>${title}</h3><p class="pop-lead">${evenText(ring.gaps, ring.keys.map(label), gap)}</p><dl class="pop-facts">${list}</dl>`;
  }
  const list = [...changes.colors]
    .toSorted((a, b) => Math.abs(b.colorful[row]) - Math.abs(a.colorful[row]))
    .map((c) => `<div><dt><span class="dot" style="--c:${c.color}"></span> ${c.name}</dt><dd>${percent(c.colorful[row])}</dd></div>`)
    .join("");
  return `<h3>${title}</h3><p class="pop-lead">Against the target M ${targets[row].toFixed(1)}.</p><dl class="pop-facts">${list}</dl>`;
});

/** The strip row pinned by clicking its name, for comparing one step with another. */
let pinned: number | null = null;

/**
 * Shows one of the strip's rows alone, every swatch filled with it, or all three. The row stays set
 * while the cover fades out, so it fades in that row's colors.
 *
 * @param row  The row, or null for all three.
 */
function showRow(row: number | null): void {
  const strip = document.querySelector<HTMLElement>("#palette-strip");
  if (!strip) return;
  if (row !== null) strip.dataset.shown = String(row);
  strip.classList.toggle("focused", row !== null);
  for (const b of strip.querySelectorAll<HTMLElement>(".strip-labels [data-row]")) b.setAttribute("aria-pressed", String(Number(b.dataset.row) === pinned));
}

/** How long the pointer rests on a swatch's band before that row shows, so passing over one doesn't. */
const SETTLE = 150;

let settling = 0;
let swatching = 0;

// Pointing at a row shows it: a row's name at once, a swatch's band once the pointer rests on it.
// Leaving shows the pinned row again, if any.
document.addEventListener("pointerover", (event) => {
  const strip = document.querySelector("#palette-strip");
  if (!strip?.contains(event.target as Node)) return;
  clearTimeout(settling);
  // The column follows the swatch pointed at, once the pointer rests there; elsewhere, the palette.
  clearTimeout(swatching);
  const swatch = (event.target as Element).closest<HTMLElement>(".strip-item[data-key]");
  if (!(event.target as Element).closest(".strip-metrics")) swatching = window.setTimeout(() => showMetrics(swatch?.dataset.key ?? null), SETTLE);
  const target = (event.target as Element).closest<HTMLElement>("[data-row]");
  if (!target) return showRow(pinned);
  const row = Number(target.dataset.row);
  if (target.closest(".strip-labels")) return showRow(row);
  settling = window.setTimeout(() => showRow(row), SETTLE);
});
document.addEventListener("pointerout", (event) => {
  const strip = document.querySelector("#palette-strip");
  if (!strip?.contains(event.target as Node) || strip.contains(event.relatedTarget as Node | null)) return;
  clearTimeout(settling);
  clearTimeout(swatching);
  showRow(pinned);
  showMetrics(null);
});

// Clicking a row's name pins it, clicking it again clears it; while a name has the focus, ↑ and ↓
// move the pin.
document.addEventListener("click", (event) => {
  const name = (event.target as Element).closest<HTMLElement>("#palette-strip .strip-labels [data-row]");
  if (!name) return;
  const row = Number(name.dataset.row);
  pinned = pinned === row ? null : row;
  showRow(pinned);
});
document.addEventListener("keydown", (event) => {
  if (pinned === null || !(event.key === "ArrowUp" || event.key === "ArrowDown")) return;
  if (!(event.target as Element).closest?.("#palette-strip .strip-labels")) return;
  event.preventDefault();
  pinned = Math.min(STEPS.length - 1, Math.max(0, pinned + (event.key === "ArrowUp" ? -1 : 1)));
  showRow(pinned);
  // Focus follows the pin, so the focus ring doesn't stay on the name clicked first.
  document.querySelector<HTMLElement>(`#palette-strip .strip-labels [data-row="${String(pinned)}"]`)?.focus({ preventScroll: true });
});

let dock: IntersectionObserver | null = null;
let barHeight = 0;

/**
 * Marks the strip at the top of Settings as docked once it sticks under the bar, so it shows a
 * border. Docked, it sits 1px up under the bar, so it's no longer wholly below it.
 */
function watchDock(): void {
  dock?.disconnect();
  const strip = document.querySelector("#palette-strip");
  if (!strip || state.view !== "tune") return;
  dock = new IntersectionObserver(
    ([entry]) => strip.classList.toggle("docked", entry!.intersectionRatio < 1 && entry!.boundingClientRect.top < entry!.rootBounds!.top),
    // The page's own viewport, not the outer page's when it's shown in a frame, which would ignore
    // the margin for the bar.
    { root: document, rootMargin: `${String(-barHeight)}px 0px 0px 0px`, threshold: 1 },
  );
  dock.observe(strip);
}

/**
 * Draws the strip, at the top of Settings and in How it works.
 */
function updateStrip(): void {
  askVariants();
  const strip = document.querySelector("#palette-strip");
  if (strip) drawComparison(strip, state.mode);
}

/**
 * Refreshes what Settings shows from the palette without redrawing its controls: the strip, the
 * export, the extra colors' titles, the hue graph and the curve editor.
 */
function updateTune(): void {
  updateStrip();
  updateExport();
  for (const title of document.querySelectorAll(".extra-title")) {
    const i = Number(title.closest<HTMLElement>("[data-extra]")!.dataset.extra);
    title.querySelector(".extra-name")!.outerHTML = extraTitle(i);
  }
  if (document.querySelector(".hues-editor")) refreshHues(huesView());
  for (const m of MODES) refreshCurve(curveView(m));
}

/* >-----------------------------------------< Export >-----------------------------------------< */

/**
 * The palette as text to copy, once every gamut tier is solved.
 *
 * @returns  The text in the chosen format.
 */
function exportText(): string {
  const p = GAMUTS.every((g) => state.fresh.has(g)) ? (state.palettes as Palette) : null;
  return p ? { json: toJson, csv: toCsv, md: toMarkdown }[state.format](state.settings, p) : "Solving every gamut tier…";
}

/**
 * The export section of Settings: the palette in a format to copy.
 *
 * @returns  HTML.
 */
function exportSection(): string {
  const tab = (f: Format, t: string) => `<button type="button" data-format="${f}" aria-pressed="${String(state.format === f)}">${t}</button>`;
  return `<section class="group" id="export-section">
      <h2>Export</h2>
      <p class="soft">Every gamut tier, both modes, every tier, default and muted, extra colors included. JSON keeps the settings too, so the palette can be solved again.</p>
      <div class="row"><div class="segmented">${tab("json", "JSON")}${tab("csv", "CSV")}${tab("md", "Markdown")}</div>
      <button type="button" data-action="copy">Copy</button><span id="export-copied" class="soft" role="status"></span></div>
      <textarea id="export-text" readonly spellcheck="false">${escape(exportText())}</textarea>
    </section>`;
}

/**
 * Writes the export again, as gamut tiers arrive.
 */
function updateExport(): void {
  const area = document.querySelector<HTMLTextAreaElement>("#export-text");
  if (area) area.value = exportText();
}

/**
 * The last section of Settings: what this site is, who made it, and under which license.
 *
 * @returns  HTML.
 */
function about(): string {
  const build = new URLSearchParams(new URL(import.meta.url).search).get("v");
  const source = project.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");
  return `<section class="group" id="about">
      <h2>About</h2>
      <dl class="facts-list">
        <div><dt>Name</dt><dd>EK Colors</dd></div>
        <div><dt>Version</dt><dd><span class="mono">${project.version}</span>${build ? ` <span class="soft">· build <span class="mono">${build}</span></span>` : ""}</dd></div>
        <div><dt>Made by</dt><dd>${project.author}, 2026</dd></div>
        <div><dt>License</dt><dd>${project.license}</dd></div>
        <div><dt>Source</dt><dd><a href="${source}">${source.replace(/^https:\/\//, "")}</a></dd></div>
      </dl>
      <p class="soft">What it's built on, from the color model to the fonts, is listed under <a href="#references">References</a>.</p>
    </section>`;
}

/* >-----------------------------------------< Views >------------------------------------------< */

/**
 * Draws the current view.
 */
function render(): void {
  const view = state.view;
  document.documentElement.dataset.theme = state.mode;
  document.documentElement.style.setProperty("--base-light", state.settings.bases.light);
  document.documentElement.style.setProperty("--base-dark", state.settings.bases.dark);
  const isColor = !(VIEWS as readonly string[]).includes(view);
  for (const a of document.querySelectorAll<HTMLAnchorElement>(".nav a")) {
    const target = a.getAttribute("href")!.slice(1);
    a.toggleAttribute("aria-current", target === view || (target === "colors" && isColor) || (target === "tune" && (view === "curve-test" || view === "hue-test")) || (target === "how" && view === "algorithm"));
  }
  for (const row of document.querySelectorAll(".tools")) fadeEdges(row);
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode));
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-gamut]")) {
    b.setAttribute("aria-pressed", String(b.dataset.gamut === state.gamut));
    b.title = b.dataset.gamut === SCREEN ? "This screen" : "";
  }
  const beyond = GAMUTS.indexOf(state.gamut) > GAMUTS.indexOf(SCREEN);
  $<HTMLElement>("#beyond").hidden = !beyond || view === "tune" || view === "references";
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-variant]")) b.setAttribute("aria-pressed", String(b.dataset.variant === state.variant));
  $<HTMLElement>("#variant").hidden = view !== "tiers" && view !== "compare";
  $<HTMLElement>("#edits").hidden = !followsEdits(view);
  for (const b of document.querySelectorAll<HTMLElement>("[data-edit]")) b.setAttribute("aria-pressed", String(state.edits[b.dataset.edit as "h" | "m"]));
  const first = colors()[0]?.key ?? "red";
  refill(
    $("main"),
    view === "overview" ? overview()
    : view === "tiers" ? tiers()
    : view === "compare" ? compare()
    : view === "tune" ? tune()
    : view === "references" ? references()
    : view === "how" ? explain(context())
    : view === "algorithm" ? technical(context())
    : view === "curve-test" ? testPage(testContext())
    : view === "hue-test" ? hueTestPage(hueTestContext())
    : color(view === "colors" ? first : view),
  );
  if (view === "tune") updateTune();
  if (view === "how") updateStrip();
  fitTables();
  watchDock();
}

/**
 * Shows whether the palette is being solved.
 */
function status(): void {
  const el = $<HTMLElement>("#status");
  el.dataset.state = state.error ? "error" : state.solving ? "busy" : "done";
  el.textContent = state.error ?? (state.solving ? "Solving…" : `Solved in ${(state.took / 1000).toFixed(1)} s`);
}

/* >-----------------------------------< Hidden comparison >------------------------------------< */

/**
 * Whether the comparison with Codemos is shown. It's hidden until Shift+C, or five quick taps on
 * the name, shows it.
 *
 * @returns  Whether it's shown in this browser.
 */
function comparing(): boolean {
  try {
    return localStorage.getItem(COMPARE) === "on";
  } catch {
    return shown;
  }
}

let shown = false;

/**
 * Shows or hides the comparison with Codemos, and says which.
 */
function toggleCompare(): void {
  shown = !comparing();
  try {
    localStorage.setItem(COMPARE, shown ? "on" : "off");
  } catch {
    // Storage can be blocked; it then lasts until the page closes.
  }
  $<HTMLElement>("#nav-compare").hidden = !shown;
  const el = $<HTMLElement>("#status");
  el.textContent = shown ? "Compare with Codemos shown" : "Compare with Codemos hidden";
  window.setTimeout(status, 2000);
  if (!shown && state.view === "compare") location.hash = "overview";
}

document.addEventListener("keydown", (event) => {
  const typing = event.target instanceof Element && event.target.closest("input, textarea, select");
  if (event.shiftKey && event.code === "KeyC" && !event.metaKey && !event.ctrlKey && !typing) toggleCompare();
});

let taps: number[] = [];
$("#brand").addEventListener("click", () => {
  const now = performance.now();
  taps = [...taps.filter((t) => now - t < 2000), now];
  if (taps.length >= 5) {
    taps = [];
    toggleCompare();
  }
});

$<HTMLElement>("#nav-compare").hidden = !comparing();

/**
 * Opens the view the address names.
 */
function route(): void {
  // Export is a section of Settings; its own address still opens it there.
  const hash = location.hash.slice(1) || "overview";
  state.view = hash === "export" ? "tune" : hash;
  if (state.view === "compare" && !comparing()) {
    location.replace("#overview");
    return;
  }
  render();
  if (hash === "export") {
    // Clear of the bar and the strip, which both stick to the top of Settings. The section's id
    // isn't "export", so the browser's own jump to it doesn't undo this.
    document.querySelector("#export-section")?.scrollIntoView();
    window.scrollBy(0, -(document.querySelector("#palette-strip")?.getBoundingClientRect().bottom ?? 0) - 16);
  } else window.scrollTo(0, 0);
}

/* >-----------------------------------------< Events >-----------------------------------------< */

document.addEventListener("click", (event) => {
  const edit = (event.target as Element).closest<HTMLElement>("[data-edit]")?.dataset.edit as "h" | "m" | undefined;
  if (edit) {
    state.edits = { ...state.edits, [edit]: !state.edits[edit] };
    try {
      localStorage.setItem(EDITS, JSON.stringify(state.edits));
    } catch {
      // Storage can be blocked; the switches then last until the page closes.
    }
    render();
    return;
  }
  const el = (event.target as Element).closest<HTMLElement>("[data-mode],[data-variant],[data-gamut],[data-format],[data-action]");
  if (!el) return;
  const { mode, variant, gamut, format, action } = el.dataset;
  if (gamut) {
    state.gamut = gamut as Gamut;
    if (!state.fresh.has(state.gamut)) {
      state.solving = true;
      status();
    }
  }
  if (mode) state.mode = mode as Mode;
  if (variant) state.variant = variant as Variant;
  if (format) {
    // Only the export changes: its text and which format is pressed.
    state.format = format as Format;
    for (const b of document.querySelectorAll<HTMLElement>("[data-format]")) b.setAttribute("aria-pressed", String(b.dataset.format === format));
    return updateExport();
  }
  if (action === "reset") {
    state.settings = structuredClone(CONFIG);
    save();
    solve();
  }
  if (action === "copy") {
    const area = $<HTMLTextAreaElement>("#export-text");
    copyText(area.value, (copied) => {
      if (!copied) area.select();
      flash($("#export-copied"), copied ? "Copied" : "Selected; copy it with the keyboard");
    });
    return;
  }
  if (action === "copy-value") {
    // The value reads "Copied" for a moment, then shows itself again.
    const value = el.dataset.value!;
    copyText(value, (copied) => {
      el.textContent = copied ? "Copied" : "Copying isn't allowed here";
      window.setTimeout(() => (el.textContent = value), 1500);
    });
    return;
  }
  if (action === "copy-settings") {
    copyText(JSON.stringify(state.settings, null, 2), (copied) => flash($("#copied"), copied ? "Settings copied" : "Copying isn't allowed here; use Export below, as JSON"));
    return;
  }
  if (action === "equal") {
    write("equalTiers", (el as HTMLInputElement).checked);
    return solve();
  }
  if (action === "add-extra") {
    const names = new Set(state.settings.extras.map((e) => e.name));
    let n = state.settings.extras.length + 1;
    while (names.has(`Extra ${String(n)}`)) n++;
    write("extras", [...state.settings.extras, { name: `Extra ${String(n)}`, hue: 0, share: 0.6 }]);
    solve();
  }
  if (action === "remove-extra") {
    write("extras", state.settings.extras.filter((_, i) => i !== Number(el.dataset.index)));
    solve();
  }
  render();
});

document.addEventListener("input", (event) => {
  const el = event.target as HTMLInputElement;
  if (el.dataset.demo) return void updateDemo(context(), el.dataset.demo);
  if (el.dataset.tier) {
    const checked = [...document.querySelectorAll<HTMLInputElement>("[data-tier]")].filter((c) => c.checked).map((c) => Number(c.dataset.tier));
    if (!checked.length) return void (el.checked = true);
    write("tiers", checked);
    for (const m of MODES)
      if (!checked.includes(state.settings.identityTier[m]))
        write(`identityTier.${m}`, checked.includes(CONFIG.identityTier[m]) ? CONFIG.identityTier[m] : checked[0]);
    // The identity choices list the tiers, so they're drawn again.
    render();
    solve(150);
    return;
  }
  if (el.dataset.anchor === "from") {
    // A system's yellow that would carry colors past placed ones is held back, as set by hand.
    const wanted = el.value === "hand" ? anchorHue(state.settings) : anchorHue({ ...state.settings, anchor: el.value });
    const hue = allowed(anchored(), wanted);
    write("anchor", el.value !== "hand" && Math.abs(hue - wanted) < 0.05 ? el.value : Math.round(hue * 10) / 10);
    syncAnchor();
    updateTune();
    solve();
    return;
  }
  if (el.hasAttribute("data-anchor-hue")) {
    if (el.value === "" || !el.checkValidity()) return;
    write("anchor", allowed(anchored(), Number(el.value)));
    syncAnchor();
    updateTune();
    solve(150);
    return;
  }
  const path = el.dataset.set;
  if (!path) return;
  if (path.startsWith("bases.")) {
    if (!/^#[0-9a-f]{6}$/i.test(el.value)) return;
    write(path, el.value.toUpperCase());
    document.documentElement.style.setProperty(`--base-${path.split(".")[1]!}`, el.value);
  } else {
    // A value outside its field's range or step waits: it may be half typed.
    if (el.value === "" || !el.checkValidity()) return;
    write(path, Number(el.value));
    for (const twin of document.querySelectorAll<HTMLInputElement>(`[data-set="${path}"]`)) if (twin !== el) twin.value = el.value;
  }
  // A system's yellow is measured in the rooms, on the bases, so its hue can move with them.
  if (path.startsWith("bases.") || path.startsWith("rooms.")) syncAnchor();
  if (path.startsWith("curve.") || path.startsWith("extras.")) updateTune();
  solve(150);
});

// An extra color's name is taken when it's done being typed, so its key doesn't change on every letter.
document.addEventListener("change", (event) => {
  const el = event.target as HTMLInputElement;
  if (el.dataset.extraName === undefined) return;
  const i = Number(el.dataset.extraName);
  el.value = el.value.trim() || `Extra ${String(i + 1)}`;
  write(`extras.${String(i)}.name`, el.value);
  updateTune();
  solve();
});

// Settings' color strip sticks just below the bar, whose height changes as it wraps.
new ResizeObserver(([entry]) => {
  // The exact height, fractions included, so the strip meets the bar without a gap.
  const height = entry!.borderBoxSize[0]?.blockSize ?? (entry!.target as HTMLElement).offsetHeight;
  document.documentElement.style.setProperty("--header-height", `${String(height)}px`);
  barHeight = height;
  watchDock();
}).observe($("header"));

/**
 * Marks a row that scrolls sideways with which of its ends have more to scroll to.
 *
 * @param row  The switches.
 */
function fadeEdges(row: Element): void {
  const more = row.scrollWidth - row.clientWidth;
  row.classList.toggle("fade-start", more > 1 && row.scrollLeft > 1);
  row.classList.toggle("fade-end", more > 1 && row.scrollLeft < more - 1);
}

// The phone menu: the button opens the views; choosing one, Escape, or a tap elsewhere closes it.
const toggle = $<HTMLButtonElement>("#menu-toggle");
const openMenu = (open: boolean) => {
  $("header").classList.toggle("menu-open", open);
  toggle.setAttribute("aria-expanded", String(open));
};
toggle.addEventListener("click", () => openMenu(toggle.getAttribute("aria-expanded") !== "true"));
document.addEventListener("click", (event) => {
  // A view chosen closes it, the one already open too, as does a tap outside.
  const target = event.target as Element;
  if (!target.closest("#menu-toggle, #views") || target.closest("#views a")) openMenu(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true") return;
  openMenu(false);
  toggle.focus();
});
addEventListener("hashchange", () => openMenu(false));

new ResizeObserver(fitTables).observe($("main"));

for (const row of document.querySelectorAll(".tools")) {
  row.addEventListener("scroll", () => fadeEdges(row), { passive: true });
  new ResizeObserver(() => fadeEdges(row)).observe(row);
}

addEventListener("hashchange", route);
route();
solve();
