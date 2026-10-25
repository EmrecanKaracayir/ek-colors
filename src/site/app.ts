/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< APP >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The palette site: overview, tiers, one page per color, the comparison with Codemos, how it       |
| works, settings and export. One view at a time, one mode at a time; the page itself is the       |
| mode's base.                                                                                     |
\*------------------------------------------------------------------------------------------------*/

import { CONFIG } from "../config";
import { toCsv, toJson, toMarkdown } from "../palette/formats";
import { apca, makeModel, type Model, parts, wcag, wcagLevel } from "../palette/model";
import { anchorHue, guides, SYSTEMS } from "../palette/references";
import { CODEMOS, CODEMOS_MUTED, type CurvePoint, type Gamut, GAMUTS, type Mode, NAMES, type Settings } from "../palette/settings";
import { boost, bounds, type Color, lineup, type GamutPalette, type ModePalette, type Palette, strongest, type Swatch } from "../palette/solve";
import { bandStops, bindCurves, curveEditor, curveLayers, curveReadout, type CurveView } from "./curve";
import { type Context, explain, updateDemo } from "./explain";
import { bindGuides, evenText, inGaps, visibility } from "./graph";
import { popButton, popSource } from "./popover";
import { bindHues, huesEditor, huesLayers, huesPanel, huesReadout, type HuesView } from "./hues";
import { technical } from "./technical";
import { bindHueTest, type HueTestContext, hueTestPage } from "./hue-test";
import { bindTest, type TestContext, testPage } from "./test";
import type { Request, Response } from "./worker";

/* >-----------------------------------------< State >------------------------------------------< */

type Variant = "default" | "muted";
type Format = "json" | "csv" | "md";

const VIEWS = ["overview", "tiers", "compare", "how", "algorithm", "curve-test", "hue-test", "tune", "export"] as const;

const STORE = "ek-colors:settings";

/** Remembers whether the comparison with Codemos is shown. */
const COMPARE = "ek-colors:compare";

/** What each tier is for. */
const ROLES: Readonly<Record<number, string>> = {
  15: "Dividers and faint fills",
  30: "Icons, outlines and controls",
  45: "Large text and the color itself",
  60: "Labels and links",
  75: "Body text",
  90: "Long reading",
};

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
  format: "json" as Format,
  gamut: SCREEN,
  palettes: {} as Partial<Record<Gamut, GamutPalette>>,

  /** The gamut tiers solved from the current settings; the others still show their last solve. */
  fresh: new Set<Gamut>(),

  /** Variants of the settings (without the curve, nothing placed), per settings and gamut tier, for comparing in Settings. */
  baselines: new Map<string, GamutPalette>(),
  solving: false,
  took: 0,
  error: null as string | null,
};

/**
 * The saved settings, or EK Colors'.
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
      for (const gone of ["yellowHue", "homes", "pull", "reference", "start", "guides"]) delete (settings as Record<string, unknown>)[gone];
      // Settings saved before the identity tier was per mode hold one number.
      const identity = settings.identityTier as Settings["identityTier"] | number;
      if (typeof identity === "number") settings.identityTier = { light: identity, dark: identity };
      // Settings saved before the curve had several points hold one point, flat or not.
      const curve = settings.curve as Record<Mode, unknown>;
      for (const m of ["light", "dark"] as const) {
        const one = curve[m] as CurvePoint | CurvePoint[] | undefined;
        if (!Array.isArray(one)) curve[m] = one && one.amount !== 0 ? [one] : [];
      }
      return settings;
    }
  } catch {
    // Storage can be blocked; the defaults do.
  }
  return structuredClone(CONFIG);
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
  const next = GAMUTS.find((g) => !state.fresh.has(g));
  if (next) post(next);
  if (shown || state.view === "export") {
    if (state.view === "tune") updateTune();
    else render();
  }
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
  state.solving = true;
  status();
  timer = window.setTimeout(() => {
    latest++;
    state.fresh = new Set();
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
  if ("error" in data) return;
  state.baselines.set(`${String(data.id)}`, data.palette);
  if (state.view === "tune") updateTune();
});

let asks = 0;
const asked = new Map<string, number>();

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
  return Object.values(state.settings.curve).some((points) => points.some((p) => p.amount !== 0));
}

/**
 * A variant of the settings on the gamut tier on screen, asked for once and kept.
 *
 * @param settings  The variant.
 * @returns         The palette, or null while it solves.
 */
function variant(settings: Settings): GamutPalette | null {
  const key = `${JSON.stringify(settings)}|${state.gamut}`;
  const id = asked.get(key);
  if (id !== undefined) return state.baselines.get(String(id)) ?? null;
  asks++;
  asked.set(key, asks);
  baseline.postMessage({ id: asks, settings, gamut: state.gamut } satisfies Request);
  return null;
}

/**
 * The palette on screen without the curve. It only depends on settings other than the curve, so
 * moving the curve never has to wait for it.
 *
 * @returns  The palette, or null while it solves.
 */
function uncurved(): GamutPalette | null {
  return curved() ? variant(flat()) : current();
}

/**
 * The uniform lineup: the palette on screen with nothing placed.
 *
 * @returns  The palette, or null while it solves.
 */
function uniform(): GamutPalette | null {
  return Object.keys(state.settings.placed).length ? variant({ ...state.settings, placed: {} }) : current();
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

/** The turn found for each palette, searched once per settings, gamut tier and mode. */
const turns = new Map<string, number>();

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
  const s = state.settings;
  const tier = s.identityTier[mode];
  const [even, hued] = [plain()?.[mode], uncurved()?.[mode]];
  if (!even || !hued) return null;
  const key = JSON.stringify([s.bases, s.rooms, s.colorfulness, s.equalTiers, s.hues, s.tiers, s.identityTier, s.hueWindow, s.anchor, s.placed, state.gamut, mode]);
  const known = turns.get(key);
  if (known !== undefined) return known;
  const pairs = even.colors.flatMap((c) => {
    const [u, h] = [c.tiers[tier]?.default, hued.colors.find((x) => x.key === c.key)?.tiers[tier]?.default];
    return c.key !== "brown" && u && h ? [[model().cam(mode, u.color), model().cam(mode, h.color)] as const] : [];
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
  turns.set(key, best);
  return best;
}

/**
 * The uniform lineup turned to best match the palette with placed hues: solved, or while that
 * solves, the uniform colors with their hues turned.
 *
 * @param mode  The mode.
 * @returns     Per color: its hue, colorfulness and color on the identity tier; null while the turn
 *              is found. The ring is the solved one's, or null.
 */
function turned(mode: Mode): { colors: Record<string, { hue: number; colorfulness: number; color: string }>; ring: readonly number[] | null } | null {
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
  return { colors, ring: solved?.ring[tier] ?? null };
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
    .filter((c) => c.key !== "brown")
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
    .filter((c) => c.key !== "brown")
    .map((c) => ({ hue: c.tiers[tier]!.default.hue, color: c.tiers[tier]!.default.color }));
  return { mode, points: s.curve[mode], dots, band, cost: colorfulnessCost(mode), guide: s.guide, guides: guides(s) };
}

/**
 * The color that stays on the anchor.
 *
 * @returns  Its key.
 */
function anchored(): string {
  return state.settings.hues === NAMES.length ? "yellow" : "hue-1";
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
  const hues = (palette?.colors ?? []).slice(0, ring.length).map((c) => c.tiers[tier]!.default.hue);
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
    .filter((c) => c.key !== "brown")
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
  return { rows, gaps, band: curveView(mode).band, guide: s.guide, guides: guides(s), cost: spacingCost(mode), turn: turn(mode), bend };
}

/**
 * Shows the anchor's hue in its fields, and that it's set by hand once it's been moved.
 */
function syncAnchor(): void {
  const from = document.querySelector<HTMLSelectElement>("#set-anchor");
  if (from) from.value = typeof state.settings.anchor === "number" ? "hand" : state.settings.anchor;
  const hue = String(Math.round(anchorHue(state.settings)));
  for (const el of document.querySelectorAll<HTMLInputElement>("[data-anchor-hue]")) el.value = hue;
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
function current(): GamutPalette | null {
  return state.palettes[state.gamut] ?? null;
}

/* >----------------------------------------< Helpers >-----------------------------------------< */

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;

/**
 * A color key as people read it.
 *
 * @param key  E.g. "red" or "hue-3".
 * @returns    E.g. "Red" or "Hue 3".
 */
function label(key: string): string {
  const text = key.replace("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const LEVELS: Readonly<Record<Swatch["wcagLevel"], string>> = {
  AAA: "AAA",
  AA: "AA",
  "AA large": "AA large",
  below: "Below 3:1",
};

/**
 * A WCAG level as a badge.
 *
 * @param level  The level.
 * @returns      HTML.
 */
function badge(level: Swatch["wcagLevel"]): string {
  return `<span class="badge" data-level="${level.replace(" ", "-")}">${LEVELS[level]}</span>`;
}

/**
 * A swatch as a card: the color, a text sample in it, and its numbers.
 *
 * @param s      The swatch.
 * @param title  Its name on the card.
 * @param href   Where a click goes, if anywhere.
 * @param limit  Whether this color's reach lowered its tier's target.
 * @returns      HTML.
 */
function card(s: Swatch, title: string, href?: string, limit = false): string {
  const tag = href ? "a" : "div";
  return `<${tag} class="card"${href ? ` href="#${href}"` : ""} style="--c:${s.color}">
    <span class="fill"></span>
    <span class="sample">Aa</span>
    <span class="card-name">${title}</span>
    <span class="mono value">${s.color}</span>
    <span class="facts"><span class="mono">Lc ${s.apca.toFixed(1)}</span>${badge(s.wcagLevel)}</span>
    <span class="mono soft">WCAG ${s.wcag.toFixed(2)} · M ${s.colorfulness.toFixed(1)}${s.short ? " ▾" : ""}</span>
    ${limit ? `<span class="limit">▾ Sets this tier's colorfulness</span>` : ""}
  </${tag}>`;
}

/**
 * The colors of the current mode.
 *
 * @returns  Its colors, or none before the first solve.
 */
function colors(): readonly Color[] {
  return current()?.[state.mode].colors ?? [];
}

/**
 * How even a ring of neighbor differences is, in words people can compare.
 *
 * @param ring  Neighbor distances.
 * @returns     E.g. "9.1 to 10.3".
 */
function range(ring: readonly number[]): string {
  return `${Math.min(...ring).toFixed(1)} to ${Math.max(...ring).toFixed(1)}`;
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
 * @returns     HTML: "sets the tier", "lowered from 40", "screen limit" or nothing.
 */
function lowered(key: string, tier: number, s: Swatch): string {
  const p = current()?.[state.mode];
  if (!p) return "";
  if (p.limits[tier] === key) return ` <span class="limit">▾ sets the tier</span>`;
  if (s.short) return ` <span class="limit">▾ screen limit</span>`;
  if (p.limits[tier]) return ` <span class="soft">lowered from ${String(state.settings.colorfulness)}</span>`;
  return "";
}

/* >---------------------------------------< Hue circle >---------------------------------------< */

interface Dot {
  readonly hue: number;
  readonly m: number;
  readonly color: string;
  readonly hollow?: boolean;

  /** Brown sits among the oranges, so it's drawn as a diamond to tell it apart. */
  readonly brown?: boolean;
}

/**
 * The hue circle: CAM16 hue around, colorfulness out from the center, with CAM16's unique hues
 * (solid) and halfway mixes (dashed) as spokes.
 *
 * @param dots  The colors to place.
 * @returns     SVG.
 */
function circle(dots: readonly Dot[]): string {
  const R = 150;
  const max = 60;
  const at = (hue: number, r: number) => {
    const a = (hue * Math.PI) / 180;
    return [r * Math.cos(a), -r * Math.sin(a)] as const;
  };
  const rings = [20, 40, 60].map(
    (m) => `<circle r="${String((m / max) * R)}" class="grid"></circle><text x="4" y="${String(-(m / max) * R - 4)}" class="axis">M ${String(m)}</text>`,
  );
  const spokes = guides(state.settings).map((ref) => {
    const [x, y] = at(ref.hue, R + 6);
    const [lx, ly] = at(ref.hue, R + 24);
    return `<line x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="spoke${ref.unique ? "" : " half"}"></line>
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="axis" text-anchor="middle" dominant-baseline="middle">${ref.label}</text>`;
  });
  const marks = dots.map((d) => {
    const [x, y] = at(d.hue, (Math.min(d.m, max) / max) * R);
    const [cx, cy] = [x.toFixed(1), y.toFixed(1)];
    const paint = d.hollow ? `fill="none" stroke="${d.color}" stroke-width="2.5"` : `fill="${d.color}" class="mark"`;
    if (d.brown) {
      const r = d.hollow ? 8 : 10;
      return `<rect x="${(x - r / Math.SQRT2).toFixed(1)}" y="${(y - r / Math.SQRT2).toFixed(1)}" width="${(r * Math.SQRT2).toFixed(1)}" height="${(r * Math.SQRT2).toFixed(1)}" rx="${String(r / 4)}" transform="rotate(45 ${cx} ${cy})" ${paint}></rect>`;
    }
    return `<circle cx="${cx}" cy="${cy}" r="${d.hollow ? "7" : "9"}" ${paint}></circle>`;
  });
  const legend = dots.some((d) => d.brown)
    ? `<rect x="152" y="185" width="8" height="8" rx="2" transform="rotate(45 156 189)" class="key-mark"></rect><text x="196" y="193" class="axis" text-anchor="end">Brown</text>`
    : "";
  return `<svg class="circle" viewBox="-200 -200 400 400" role="img" aria-label="Hue circle">
    ${rings.join("")}${spokes.join("")}${marks.join("")}${legend}</svg>`;
}

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
  const list = colors();
  const ring = current()?.[mode].ring[tier] ?? [];
  return `<section class="intro">
      <h1>EK Colors</h1>
      <p>${String(list.length)} colors that read the same on the ${mode} base: each sits exactly on its APCA contrast, aims at the same colorfulness, and is as different from its neighbors as they are from theirs.</p>
    </section>
    <section>
      <h2>The colors <span class="soft">· Lc ${String(tier)}, the tier that stands for each hue</span></h2>
      <div class="cards">${list.map((c) => card(c.tiers[tier]!.default, label(c.key), c.key, current()?.[mode].limits[tier] === c.key)).join("")}</div>
      <h3>Muted</h3>
      <div class="cards small">${list
        .filter((c) => c.tiers[tier]!.muted)
        .map((c) => card(c.tiers[tier]!.muted!, label(c.key), c.key))
        .join("")}</div>
    </section>
    <section class="split">
      <div>${circle(list.flatMap((c) => [c.tiers[tier]!.default, ...(c.tiers[tier]!.muted ? [c.tiers[tier]!.muted!] : [])].map((s) => ({ hue: s.hue, m: s.colorfulness, color: s.color, brown: c.key === "brown" }))))}</div>
      <dl class="facts-list">
        <div><dt>Base</dt><dd class="mono">${settings.bases[mode]}</dd></div>
        <div><dt>Room</dt><dd>${String(room.lux)} lux, ${["dark", "dim", "average"][room.surround] ?? ""} surround</dd></div>
        <div><dt>Colorfulness</dt><dd>${held(tier)}; muted at ${String(Math.round(settings.muted * 100))}%</dd></div>
        <div><dt>Anchor</dt><dd>${label(anchored())} at hue ${anchorHue(settings).toFixed(0)}°, ${typeof settings.anchor === "number" ? "set by hand" : `${SYSTEMS.find((r) => r.id === settings.anchor)?.name ?? ""} yellow`}</dd></div>
        <div><dt>Neighbor differences</dt><dd>${ring.length ? range(ring) : "…"} (CAM16-UCS)</dd></div>
        <div><dt>▾</dt><dd>The screen held this color below its colorfulness.</dd></div>
      </dl>
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
        const list = colors().filter((c) => c.tiers[tier]![variant]);
        return `<section>
          <h2>Lc ${String(tier)} <span class="soft">· ${ROLES[tier] ?? ""}</span></h2>
          <p class="soft">${held(tier)} · neighbor differences ${ring.length ? range(ring) : "…"}</p>
          <div class="cards small">${list.map((c) => card(c.tiers[tier]![variant]!, label(c.key), c.key, current()?.[mode].limits[tier] === c.key)).join("")}</div>
        </section>`;
      })
      .join("")}`;
}

/* >-----------------------------------------< Color >------------------------------------------< */

/**
 * One color: every tier, default and muted, with all its numbers.
 *
 * @param key  The color.
 * @returns    HTML.
 */
function color(key: string): string {
  const list = colors();
  const c = list.find((x) => x.key === key);
  if (!c) return `<section class="intro"><h1>${label(key)}</h1><p>Solving…</p></section>`;
  const id = c.tiers[state.settings.identityTier[state.mode]]!.default;
  const table = (variant: Variant) => {
    const rows = state.settings.tiers.filter((t) => c.tiers[t]![variant]);
    if (!rows.length) return "";
    return `<section>
      <h2>${variant === "default" ? "Default" : "Muted"}</h2>
      <div class="scroll"><table>
        <thead><tr><th>Tier</th><th>Sample</th><th>Hex</th><th>APCA</th><th>WCAG 2</th><th>Lightness J</th><th>Chroma C</th><th>Colorfulness M</th><th>Hue</th></tr></thead>
        <tbody>${rows
          .map((t) => {
            const s = c.tiers[t]![variant]!;
            return `<tr>
              <th scope="row">Lc ${String(t)}<span class="soft">${ROLES[t] ?? ""}</span></th>
              <td><span class="pair" style="--c:${s.color}"><span class="fill"></span><span class="sample">Aa</span></span></td>
              <td class="mono">${s.color}</td>
              <td class="mono">${s.apca.toFixed(1)}</td>
              <td><span class="mono">${s.wcag.toFixed(2)}</span> ${badge(s.wcagLevel)}</td>
              <td class="mono">${s.lightness.toFixed(1)}</td>
              <td class="mono">${s.chroma.toFixed(1)}</td>
              <td class="mono">${s.colorfulness.toFixed(1)}${variant === "default" ? lowered(c.key, t, s) : ""}</td>
              <td class="mono">${s.hue.toFixed(1)}° <span class="soft">${s.name}</span></td>
            </tr>`;
          })
          .join("")}</tbody>
      </table></div>
    </section>`;
  };
  return `<nav class="chips" aria-label="Colors">${list
    .map((x) => `<a href="#${x.key}" style="--c:${x.tiers[state.settings.identityTier[state.mode]]!.default.color}"${x.key === key ? ' aria-current="page"' : ""}><span class="dot"></span>${label(x.key)}</a>`)
    .join("")}</nav>
    <section class="intro hero" style="--c:${id.color}">
      <h1>${label(key)}</h1>
      <p>CAM16 hue ${id.hue.toFixed(1)}°, read as ${id.name}. Aims at colorfulness ${c.target.toFixed(0)}${state.settings.equalTiers ? ". A tier lowers it to what its least colorful hue can reach." : "."}</p>
    </section>
    ${table("default")}${table("muted")}`;
}

/* >----------------------------------------< Compare >-----------------------------------------< */

/**
 * Codemos next to EK Colors on the identity tier: the hue circle, each color, and how even the
 * differences between neighbors are.
 *
 * @returns  HTML.
 */
function compare(): string {
  const { settings, mode, variant } = state;
  if (settings.hues !== NAMES.length)
    return `<section class="intro"><h1>Compare with Codemos</h1><p>Codemos has eight hues. Set Hues to 8 in Settings to compare.</p></section>`;
  const model = makeModel(settings);
  const base = settings.bases[mode];
  const tier = settings.identityTier[mode];
  const source = variant === "default" ? CODEMOS[mode] : CODEMOS_MUTED[mode];
  const rows = colors()
    .filter((c) => source[c.key] && c.tiers[tier]![variant])
    .map((c) => {
      const color = source[c.key]!;
      const cam = model.cam(mode, color);
      const ratio = wcag(color, base);
      const old: Swatch = {
        color,
        hue: cam.hue,
        chroma: cam.chroma,
        colorfulness: cam.m,
        lightness: cam.j,
        name: "",
        apca: apca(color, base),
        wcag: ratio,
        wcagLevel: wcagLevel(ratio),
        short: false,
      };
      return { key: c.key, old, now: c.tiers[tier]![variant]! };
    });
  const ring = (list: readonly string[]) => list.map((h, i) => model.distance(mode, h, list[(i + 1) % list.length]!));
  const hues = rows.filter((r) => r.key !== "brown");
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
      <p>Codemos's ${variant} colors next to EK Colors' on Lc ${String(tier)}, on the ${mode} base. Codemos was picked by eye; EK Colors is solved.</p>
    </section>
    <section class="split">
      <div>${circle([...rows.map((r) => ({ hue: r.old.hue, m: r.old.colorfulness, color: r.old.color, hollow: true, brown: r.key === "brown" })), ...rows.map((r) => ({ hue: r.now.hue, m: r.now.colorfulness, color: r.now.color, brown: r.key === "brown" }))])}</div>
      <div class="legend">
        <p><span class="key hollow"></span> Codemos <span class="key"></span> EK Colors</p>
        <p class="soft">Distance from the center is colorfulness. EK Colors' dots share one ring; Codemos's scatter, so some of its colors look stronger than others.</p>
      </div>
    </section>
    <section>
      <h2>Each color</h2>
      <div class="pairs">${rows
        .map(
          (r) => `<div class="versus"><h3>${label(r.key)}</h3>${card(r.old, "Codemos")}${card(r.now, "EK Colors", r.key)}</div>`,
        )
        .join("")}</div>
    </section>
    <section>
      <h2>Neighbor differences <span class="soft">· CAM16-UCS</span></h2>
      <p class="soft">How different each color looks from the next one around the circle. Even bars mean no two neighbors are easier to confuse than the rest.</p>
      <div class="split even">
        <div><h3>Codemos <span class="soft">· ${range(oldRing)}</span></h3>${bars(oldRing)}</div>
        <div><h3>EK Colors <span class="soft">· ${range(newRing)}</span></h3>${bars(newRing)}</div>
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
  for (const k of keys.slice(0, -1)) o = (o[k] ??= {}) as Record<string, unknown>;
  o[keys.at(-1)!] = value;
  state.settings = next as unknown as Settings;
  save();
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
      <p class="row"><button type="button" data-action="reset">Reset to EK Colors</button><button type="button" data-action="copy-settings">Copy settings</button><span id="copied" class="soft" role="status"></span></p>
    </section>
    <div id="tune-preview" class="strip"></div>
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
      <label class="field" for="set-brown-on"><span>Brown</span><input id="set-brown-on" type="checkbox" data-action="brown" ${s.brown === null ? "" : "checked"}></label>
      ${s.brown === null ? "" : number("brown", "Brown share", [0.1, 1, 0.05], true)}
      <h3>Per hue</h3>
      <p class="soft">${label(state.mode)} mode's curve; switch Light and Dark above to edit the other. Colorfulness added or taken away smoothly over hue, for parts of the circle that look weaker or stronger than the model says. Its points add up.</p>
      <p><a href="#curve-test" class="button">Measure it with the blind colorfulness test</a></p>
      ${curveEditor(curveView(state.mode), (path, title, range) => number(path, title, range))}
    </section>
    <section class="group">
      <h2>Tiers</h2>
      <p class="soft">The APCA contrasts every color gets. The identity tier stands for the hue and sets every tier's starting hues.</p>
      <div class="checks">${[15, 30, 45, 60, 75, 90]
        .map((t) => `<label for="tier-${String(t)}"><input id="tier-${String(t)}" type="checkbox" data-tier="${String(t)}" ${s.tiers.includes(t) ? "checked" : ""}> Lc ${String(t)}</label>`)
        .join("")}</div>
      ${(["light", "dark"] as const)
        .map(
          (m) => `<label class="field" for="set-identity-${m}"><span>Identity, ${m}</span><select id="set-identity-${m}" data-set="identityTier.${m}">${s.tiers
            .map((t) => `<option value="${String(t)}" ${t === s.identityTier[m] ? "selected" : ""}>Lc ${String(t)}</option>`)
            .join("")}</select></label>`,
        )
        .join("")}
    </section>
    <section class="group">
      <h2>Viewing</h2>
      <p class="soft">The backgrounds and the rooms colors are seen in. Surround is how bright the room is around the screen.</p>
      <div class="split even">${(["light", "dark"] as const)
        .map(
          (m) => `<div><h3>${label(m)}</h3>
            <label class="field" for="set-base-${m}"><span>Base</span><input id="set-base-${m}" type="text" data-set="bases.${m}" value="${s.bases[m]}" spellcheck="false" pattern="#[0-9A-Fa-f]{6}"></label>
            ${number(`rooms.${m}.lux`, "Room lux", [1, 1000, 1])}
            <label class="field" for="set-surround-${m}"><span>Surround</span><select id="set-surround-${m}" data-set="rooms.${m}.surround">${["Dark", "Dim", "Average"]
              .map((name, i) => `<option value="${String(i)}" ${i === s.rooms[m].surround ? "selected" : ""}>${name}</option>`)
              .join("")}</select></label></div>`,
        )
        .join("")}</div>
    </section>`;
}

/** The rows of the strip: each step of the palette, added one at a time. */
const STEPS = [
  { name: "Uniform", title: "Uniform: these settings with nothing placed and colorfulness the same for every hue" },
  { name: "Turned", title: "Turned: the uniform lineup turned to best match your placed hues, still uniform" },
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

  /** What its bend in use is made of, and the edits behind it: degrees placed, colorfulness added. */
  readonly split: ReturnType<typeof parts>;
  readonly turned: number;
  readonly added: number;
}

/** One row's neighbor gaps, in ring order: gap i is between keys i and i + 1. */
interface Ring {
  readonly gaps: readonly number[];
  readonly keys: readonly string[];
}

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
  const now = current()?.[mode].colors ?? [];
  const palettes = [plain()?.[mode], uncurved()?.[mode], current()?.[mode]];
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
  const rings: [Ring, Ring, Ring, Ring] = [evenRing, twist?.ring ? { gaps: twist.ring, keys: evenRing.keys } : evenRing, ringOf(palettes[1]), ringOf(palettes[2])];
  const colors: Change[] = [];
  const items = now.map((c) => {
    if (c.key === "brown") return "";
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
      split: parts(model().cam(mode, turnedOne.color), model().cam(mode, last.color)),
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
  const scope = color
    ? `<span class="metric-scope"><span class="dot" style="--c:${color.color}"></span><span class="scope-text"> ${color.name}</span></span>`
    : popButton("metric:scope", `<span class="scope-text">All colors </span>ⓘ`, "How to read the strip", "metric-scope");
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
  const column = document.querySelector("#tune-preview .strip-metrics");
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

popSource("change", (key) => {
  const c = changes.colors.find((x) => x.key === key);
  if (!c) return "";
  const { gap, tier, turn: angle } = changes;
  return `<h3><span class="dot" style="--c:${c.color}"></span> ${c.name}</h3>
    <p class="pop-lead">Bends <strong>${inGaps(c.bend[3] / gap) || "nothing"}</strong> from the turned lineup: ${visibility(c.bend[3])}.</p>
    ${c.bend[3] >= 0.05 ? splitBar(c.split) : ""}
    <dl class="pop-facts">
      <div><dt>+H</dt><dd>${inGaps(c.bend[2] / gap) || "no bend"}${c.turned ? ` · ${c.turned > 0 ? "+" : ""}${String(c.turned)}° from turned` : ""}</dd></div>
      <div><dt>+M</dt><dd>${inGaps(c.bend[3] / gap) || "no bend"} in all${c.added ? ` · ${c.added > 0 ? "+" : ""}${String(c.added)} M, ${percent(c.colorful[3])} of the target` : ""}</dd></div>
      <div><dt>Uniform</dt><dd>${inGaps(c.moved / gap) || "no change"} from the lineup at your anchor, turn ${turnText(angle)} included</dd></div>
    </dl>
    <p class="pop-how">${c.name} in the turned lineup (the uniform lineup turned ${turnText(angle)}, still uniform) is compared with ${c.name} in use, on Lc ${String(tier)}, as CAM16-UCS ΔE (${c.bend[3].toFixed(1)}), then divided by the even gap (${gap.toFixed(1)}). The bar shows the bend's hue, colorfulness and lightness parts.</p>`;
});

popSource("metric", (which) => {
  const { gap, targets, turn: angle } = changes;
  const [kind, which2] = which.split(":") as [string, string | undefined];
  if (kind === "scope")
    return `<h3>Reading the strip</h3>
      <p>Rows: <strong>Uniform</strong> is the scientific lineup for these settings at your anchor; <strong>Turned</strong> is that lineup turned ${turnText(angle)} to best match your placed hues, still perfectly uniform; <strong>+H</strong> adds your placed hues; <strong>+M</strong> adds colorfulness per hue, the palette in use.</p>
      <p>Beside them, per row: <strong>Bend</strong>, how far the colors are from the turned lineup; <strong>Even</strong>, how evenly spaced neighbors are; <strong>M</strong>, how equally colorful the colors are. Point at a swatch to see them for that color.</p>
      <p class="pop-how">Bends are in gaps: one gap is the even distance between neighbors, ${gap.toFixed(1)} ΔE here. Under 0.2 can't be seen side by side, 0.2 to 0.5 is visible side by side, 0.5 to 1 a different shade, over 1 a different color. Click a row's name to keep it shown; ↑ and ↓ then switch rows.</p>`;
  const heads: Record<string, string> = {
    bend: `<h3>Bend</h3><p>How far the colors are from the nearest uniform lineup. Turning the whole lineup keeps it uniform, so the uniform lineup is first turned to best match your placed hues (${turnText(angle)}); what's left is the bend. Each color's difference, in gaps, averaged as a root mean square, so one large difference isn't hidden among small ones.</p><p class="pop-how">One gap is ${gap.toFixed(1)} ΔE. Under 0.2 can't be seen side by side, 0.2 to 0.5 is visible side by side, 0.5 to 1 a different shade, over 1 a different color.</p>`,
    even: `<h3>Even</h3><p>How evenly spaced neighbors are: the gap furthest from the even gap, as a share of it. This is the uniform lineup's main promise: every pair of neighbors equally easy to tell apart.</p><p class="pop-how">Under 10% is fine, 10 to 25% worth watching, over 25% two colors are getting confusable (or, over even, a hole in the palette).</p>`,
    colorful: `<h3>M</h3><p>How equally colorful the colors are: the color furthest from the target colorfulness (M ${targets[3].toFixed(1)} on this tier), as a share of it. The uniform lineup makes every color equally colorful; colorfulness per hue changes that on purpose, so this says how far you've pushed.</p>`,
  };
  if (which2 === "head") return heads[kind] ?? "";
  const row = Number(which2) as Row;
  const title = `${STEPS[row].name}: ${{ bend: "bend", even: "evenness", colorful: "colorfulness" }[kind] ?? ""}`;
  if (kind === "bend") {
    const list = [...changes.colors]
      .toSorted((a, b) => b.bend[row] - a.bend[row])
      .map((c) => `<div><dt><span class="dot" style="--c:${c.color}"></span> ${c.name}</dt><dd>${(c.bend[row] / gap).toFixed(2)} gap</dd></div>`)
      .join("");
    return `<h3>${title}</h3><p class="pop-lead">Average ${averageBend(row).toFixed(2)} gap from the turned lineup.</p><dl class="pop-facts">${list}</dl>`;
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
  const strip = document.querySelector<HTMLElement>("#tune-preview");
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
  const strip = document.querySelector("#tune-preview");
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
  const strip = document.querySelector("#tune-preview");
  if (!strip?.contains(event.target as Node) || strip.contains(event.relatedTarget as Node | null)) return;
  clearTimeout(settling);
  clearTimeout(swatching);
  showRow(pinned);
  showMetrics(null);
});

// Clicking a row's name pins it, clicking it again clears it; while pinned, ↑ and ↓ move the pin.
document.addEventListener("click", (event) => {
  const name = (event.target as Element).closest<HTMLElement>("#tune-preview .strip-labels [data-row]");
  if (!name) return;
  const row = Number(name.dataset.row);
  pinned = pinned === row ? null : row;
  showRow(pinned);
});
document.addEventListener("keydown", (event) => {
  if (pinned === null || state.view !== "tune" || !(event.key === "ArrowUp" || event.key === "ArrowDown")) return;
  if ((event.target as Element).closest?.("input, select, textarea, svg")) return;
  event.preventDefault();
  pinned = Math.min(STEPS.length - 1, Math.max(0, pinned + (event.key === "ArrowUp" ? -1 : 1)));
  showRow(pinned);
  // Focus follows the pin, so the focus ring doesn't stay on the name clicked first.
  document.querySelector<HTMLElement>(`#tune-preview .strip-labels [data-row="${String(pinned)}"]`)?.focus({ preventScroll: true });
});

let dock: IntersectionObserver | null = null;
let barHeight = 0;

/**
 * Marks the strip at the top of Settings as docked once it sticks under the bar, so it shows a
 * border. Docked, it sits 1px up under the bar, so it's no longer wholly below it.
 */
function watchDock(): void {
  dock?.disconnect();
  const strip = document.querySelector("#tune-preview");
  if (!strip) return;
  dock = new IntersectionObserver(
    ([entry]) => strip.classList.toggle("docked", entry!.intersectionRatio < 1 && entry!.boundingClientRect.top < entry!.rootBounds!.top),
    // The page's own viewport, not the outer page's when it's shown in a frame, which would ignore
    // the margin for the bar.
    { root: document, rootMargin: `${String(-barHeight)}px 0px 0px 0px`, threshold: 1 },
  );
  dock.observe(strip);
}

/**
 * Draws the strip at the top of Settings.
 */
function updateStrip(): void {
  askVariants();
  const strip = document.querySelector("#tune-preview");
  if (strip) drawComparison(strip, state.mode);
}

/**
 * Refreshes the strip and the curve editors without redrawing the controls.
 */
function updateTune(): void {
  updateStrip();
  const layers = document.querySelector(".hues-layers");
  if (layers) {
    const view = huesView();
    layers.innerHTML = huesLayers(view);
    document.querySelector(".hues-readout")!.textContent = huesReadout(view);
    const values = document.querySelector(".hues-values")!;
    if (!values.contains(document.activeElement)) values.innerHTML = huesPanel(view);
  }
  for (const m of ["light", "dark"] as const) {
    const editor = document.querySelector(`[data-curve="${m}"]`);
    if (!editor) continue;
    const view = curveView(m);
    editor.querySelector(".curve-layers")!.innerHTML = curveLayers(view);
    editor.querySelector("linearGradient")!.innerHTML = bandStops(view);
    editor.querySelector(".curve-readout")!.textContent = curveReadout(view);
  }
}

/* >-----------------------------------------< Export >-----------------------------------------< */

/**
 * The palette as text to copy.
 *
 * @returns  HTML.
 */
function exporting(): string {
  const p = GAMUTS.every((g) => state.fresh.has(g)) ? (state.palettes as Palette) : null;
  const text = p ? { json: toJson, csv: toCsv, md: toMarkdown }[state.format](state.settings, p) : "Solving every gamut tier…";
  const tab = (f: Format, t: string) => `<button type="button" data-format="${f}" aria-pressed="${String(state.format === f)}">${t}</button>`;
  return `<section class="intro">
      <h1>Export</h1>
      <p>Every gamut tier, both modes, every tier, default and muted. JSON keeps the settings too, so the palette can be solved again.</p>
    </section>
    <section>
      <div class="row"><div class="segmented">${tab("json", "JSON")}${tab("csv", "CSV")}${tab("md", "Markdown")}</div>
      <button type="button" data-action="copy">Copy</button><span id="copied" class="soft" role="status"></span></div>
      <textarea id="export-text" readonly spellcheck="false">${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</textarea>
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
    b.title = b.dataset.gamut === SCREEN ? "Your screen" : "";
  }
  const beyond = GAMUTS.indexOf(state.gamut) > GAMUTS.indexOf(SCREEN);
  $<HTMLElement>("#beyond").hidden = !beyond || view === "tune" || view === "export";
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-variant]")) b.setAttribute("aria-pressed", String(b.dataset.variant === state.variant));
  $<HTMLElement>("#variant").hidden = view !== "tiers" && view !== "compare";
  const main = $<HTMLElement>("main");
  const first = colors()[0]?.key ?? "red";
  main.innerHTML =
    view === "overview" ? overview()
    : view === "tiers" ? tiers()
    : view === "compare" ? compare()
    : view === "tune" ? tune()
    : view === "export" ? exporting()
    : view === "how" ? explain(context())
    : view === "algorithm" ? technical(context())
    : view === "curve-test" ? testPage(testContext())
    : view === "hue-test" ? hueTestPage(hueTestContext())
    : color(view === "colors" ? first : view);
  if (view === "tune") updateTune();
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
  state.view = location.hash.slice(1) || "overview";
  if (state.view === "compare" && !comparing()) {
    location.replace("#overview");
    return;
  }
  render();
  window.scrollTo(0, 0);
}

/* >-----------------------------------------< Events >-----------------------------------------< */

document.addEventListener("click", (event) => {
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
  if (format) state.format = format as Format;
  if (action === "reset") {
    state.settings = structuredClone(CONFIG);
    save();
    solve();
  }
  if (action === "copy") {
    const area = $<HTMLTextAreaElement>("#export-text");
    navigator.clipboard.writeText(area.value).then(
      () => ($("#copied").textContent = "Copied"),
      () => {
        area.select();
        $("#copied").textContent = "Selected; press Copy on your keyboard";
      },
    );
    return;
  }
  if (action === "copy-settings") {
    navigator.clipboard.writeText(JSON.stringify(state.settings, null, 2)).then(
      () => ($("#copied").textContent = "Settings copied"),
      () => ($("#copied").textContent = "Copying isn't allowed here; use Export → JSON"),
    );
    return;
  }
  if (action === "equal") {
    write("equalTiers", (el as HTMLInputElement).checked);
    solve();
  }
  if (action === "brown") {
    write("brown", (el as HTMLInputElement).checked ? (CONFIG.brown ?? 0.6) : null);
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
    for (const m of ["light", "dark"] as const)
      if (!checked.includes(state.settings.identityTier[m]))
        write(`identityTier.${m}`, checked.includes(CONFIG.identityTier[m]) ? CONFIG.identityTier[m] : checked[0]);
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
    if (el.value === "" || Number.isNaN(Number(el.value))) return;
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
    if (el.value === "" || Number.isNaN(Number(el.value))) return;
    write(path, Number(el.value));
    for (const twin of document.querySelectorAll<HTMLInputElement>(`[data-set="${path}"]`)) if (twin !== el) twin.value = el.value;
  }
  if (path.startsWith("curve.")) updateTune();
  solve(150);
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
  if (!(event.target as Element).closest("#menu-toggle, #views")) openMenu(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") openMenu(false);
});
addEventListener("hashchange", () => openMenu(false));

for (const row of document.querySelectorAll(".tools")) {
  row.addEventListener("scroll", () => fadeEdges(row), { passive: true });
  new ResizeObserver(() => fadeEdges(row)).observe(row);
}

addEventListener("hashchange", route);
route();
solve();
