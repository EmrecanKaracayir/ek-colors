/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< DERIVED >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the pages read: the settings as the gamut tier on screen sees them, its color model, the    |
| palette shown, and what the hue and curve editors, the explainers and the blind tests are given. |
\*------------------------------------------------------------------------------------------------*/

import { CONFIG } from "../config";
import { forGamut } from "../palette/bases";
import { type Model, makeModel, parts, plainSquared } from "../palette/model";
import { anchorHue, guides } from "../palette/references";
import type { Gamut, Mode, Settings } from "../palette/settings";
import { type GamutPalette, type ModePalette, bounds, hueKeys, identityOf, lineup, strongest } from "../palette/solve";
import { bindGuides } from "./graph";
import { type TestContext, bindTest } from "./pages/curve-test";
import type { Context } from "./pages/how";
import { type HueTestContext, bindHueTest } from "./pages/hue-test";
import { label } from "./parts";
import { type CurveView, bindCurves } from "./settings/curve";
import { write } from "./settings/fields";
import { type HuesView, bindHues } from "./settings/hues";
import { evenGap, updateStrip } from "./settings/strip";
import { render } from "./shell";
import { solve } from "./solver";
import { state } from "./state";
import { edited, plain, turn, turned, uncurved, upToDate } from "./variants";

const bands = new Map<string, CurveView["band"]>();
const models = new Map<string, Model>();

/** The settings as each gamut tier sees them, made once per settings and tier. */
export const seen = new WeakMap<Settings, Map<Gamut, Settings>>();

/**
 * The settings as the gamut tier on screen sees them: each mode's base resolved for it. Everything
 * the page shows reads these; changes are written to the settings as entered.
 *
 * @returns  The settings.
 */
export function onScreen(): Settings {
  let byGamut = seen.get(state.settings);
  if (!byGamut) seen.set(state.settings, (byGamut = new Map()));
  let made = byGamut.get(state.gamut);
  if (!made) byGamut.set(state.gamut, (made = forGamut(state.settings, state.gamut)));
  return made;
}

/**
 * The color model of the settings on screen, made once per bases, rooms and gamut tier.
 *
 * @returns  The model.
 */
export function model(): Model {
  const s = onScreen();
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
  const tier = identityOf(onScreen(), mode);
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
  const tier = identityOf(onScreen(), mode);
  const [before, after] = [uncurved()?.[mode], current()?.[mode]];
  if (!before || !after) return null;
  return after.colors
    .filter((c) => !c.custom)
    .flatMap((c) => {
      const [a, b] = [c.tiers[tier]?.default, before.colors.find((o) => o.key === c.key)?.tiers[tier]?.default];
      if (!a || !b) return [];
      return [{ label: label(c.key), added: Math.round(a.colorfulness - b.colorfulness), difference: model().distance(mode, a.color, b.color) }];
    })
    .map((c) => ({ ...c, gap: evenGap(mode) }));
}

/**
 * The colors around the circle at the identity tier's colorfulness, painted behind the graphs: one
 * every 10°, made once per bases, rooms, gamut tier, tier and target.
 *
 * @param mode  The mode.
 * @returns     The band.
 */
function bandOf(mode: Mode): CurveView["band"] {
  const s = state.settings;
  const tier = identityOf(s, mode);
  const target = current()?.[mode].targets[tier] ?? s.colorfulness;
  const key = JSON.stringify([onScreen().bases, s.rooms, state.gamut, mode, tier, target]);
  let band = bands.get(key);
  if (!band) {
    band = Array.from({ length: 37 }, (_, i) => i * 10).flatMap((hue) => {
      try {
        return [{ hue, color: strongest(model(), onScreen().bases[mode], mode, hue % 360, target, tier) }];
      } catch {
        return [];
      }
    });
    bands.set(key, band);
  }
  return band;
}

/**
 * One mode's curve editor contents: the curve, the palette's hues on it, and the colors around the
 * circle at the identity tier's colorfulness.
 *
 * @param mode  The mode.
 * @returns     The view.
 */
export function curveView(mode: Mode): CurveView {
  const s = state.settings;
  const tier = identityOf(s, mode);
  const palette = current()?.[mode];
  const band = bandOf(mode);
  const dots = (palette?.colors ?? [])
    .filter((c) => !c.custom && c.tiers[tier])
    .map((c) => ({ hue: c.tiers[tier]!.default.hue, color: c.tiers[tier]!.default.color }));
  return {
    settled: upToDate(), mode, points: s.curve[mode], dots, band, cost: colorfulnessCost(mode), guide: s.guide, guides: guides(s) };
}

/**
 * The color that stays on the anchor.
 *
 * @returns  Its key.
 */
export function anchored(): string {
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
export function huesView(): HuesView {
  const s = state.settings;
  const mode = state.mode;
  const tier = identityOf(s, mode);
  const palette = uncurved()?.[mode] ?? current()?.[mode];
  const even = plain()?.[mode];
  // Placed colors where the lineup holds them, in order.
  const line = lineup(s);
  const held = Object.fromEntries(line.keys.map((key, k) => [key, line.hues[k]! % 360]));
  const twist = turned(mode);
  const gap = evenGap(mode);
  const rows = (palette?.colors ?? [])
    .filter((c) => !c.custom && c.tiers[tier])
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
    const w = plainSquared(r.bend * gap);
    const split = parts(model().cam(mode, spot.color), model().cam(mode, r.current.color));
    [weight, hue, colorful] = [weight + w, hue + w * split.hue, colorful + w * split.colorfulness];
  }
  const split = weight ? { hue: hue / weight, colorfulness: colorful / weight } : null;
  return {
    settled: upToDate(), rows, gaps, band: bandOf(mode), guide: s.guide, guides: guides(s), cost: spacingCost(mode), turn: turn(mode), bend, split };
}

/**
 * Shows the anchor's hue in its fields, and that it's set by hand once it's been moved.
 */
export function syncAnchor(): void {
  const from = document.querySelector<HTMLSelectElement>("#set-anchor");
  if (from) from.value = typeof state.settings.anchor === "number" ? "hand" : state.settings.anchor;
  const hue = String(Math.round(anchorHue(onScreen())));
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
export function allowed(key: string, hue: number): number {
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
export function context(): Context {
  return { settings: onScreen(), mode: state.mode, gamut: state.gamut, palette: current(), label };
}

/**
 * What the blind test needs from the page.
 *
 * @returns  The settings, mode, gamut tier and palette on screen, and ways to change the curve and
 *           redraw.
 */
export function testContext(): TestContext {
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
export function hueTestContext(): HueTestContext {
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
export function inUse(): GamutPalette | null {
  return state.palettes[state.gamut] ?? null;
}

/**
 * Whether a page follows the Edits switches. Settings and the blind tests work on the palette in
 * use, and Export exports it.
 *
 * @param view  The page.
 * @returns     True when it does.
 */
export function followsEdits(view: string): boolean {
  return !["tune", "references", "curve-test", "hue-test"].includes(view);
}

/**
 * The palette the page shows: the one in use, or, where the Edits switches apply and one is off,
 * the same settings without placed hues, without colorfulness per hue, or without both.
 *
 * @returns  The palette, or null while it solves.
 */
export function current(): GamutPalette | null {
  return followsEdits(state.view) ? edited(state.edits.h, state.edits.m) : inUse();
}
