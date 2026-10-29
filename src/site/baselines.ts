/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< BASELINES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| A second worker solves the settings again as baselines to compare with: without the curve, with  |
| nothing placed, turned. The Edits switches and the strip show them beside the palette in use.    |
\*------------------------------------------------------------------------------------------------*/

import { deltaE } from "../palette/model";
import { anchorHue } from "../palette/references";
import type { Mode, Settings } from "../palette/settings";
import { type GamutPalette, type ModePalette, identityOf, strongest } from "../palette/solve";
import { followsEdits, inUse, model, onScreen } from "./derived";
import { solvedPart } from "./parts";
import { updateTune } from "./settings/page";
import { evenGap, updateStrip } from "./settings/strip";
import { drawnGap, render } from "./shell";
import { spawn } from "./solver";
import { state } from "./state";
import type { Request, Response } from "./worker";

/** The worker that solves the baselines. */
let baselineWorker = spawn(baselineSolved);

/**
 * Keeps a solved baseline, and sends the next one waiting.
 *
 * @param event  The worker's answer.
 */
function baselineSolved(event: MessageEvent<Response>): void {
  const data = event.data;
  nextBaseline();
  if ("error" in data) return;
  state.baselines.set(data.id, data.palette);
  for (const [key, id] of asked)
    if (state.baselines.size > KEPT && state.baselines.has(id)) {
      state.baselines.delete(id);
      asked.delete(key);
    }
  if (state.view === "tune") updateTune();
  else if (state.view === "compare") render();
  else if (followsEdits(state.view) && !(state.edits.h && state.edits.m)) render();
  // How it works and the algorithm quote the even gap, so they're drawn again once it's measured.
  else if ((state.view === "how" || state.view === "algorithm") && Math.abs(evenGap(state.mode) - drawnGap) > 0.05) render();
  else if (state.view === "how") updateStrip();
}

let asks = 0;
const asked = new Map<string, number>();

/** Baselines waiting for the worker, newest last; one is solved at a time. */
const queue: Request[] = [];
export let solvingBaseline = false;

/** How many baselines wait at most: a drag asks for a new one on every move, and only the last few matter. */
const QUEUED = 4;

/** How many solved baselines are kept. */
const KEPT = 48;

/** The baseline being solved, and since when. */
let baselineId = 0;
export let baselineSince = 0;

/** How long a baseline may run, in ms, before a change of settings stops it. */
export const LONG_BASELINE = 1000;

/**
 * Sends the next waiting baseline to the worker, if it's free.
 */
function nextBaseline(): void {
  const request = queue.shift();
  solvingBaseline = !!request;
  if (!request) return;
  [baselineId, baselineSince] = [request.id, performance.now()];
  baselineWorker.postMessage(request);
}

/**
 * Stops the baseline being solved and those waiting, so they're asked for again if still wanted.
 */
export function restartBaselines(): void {
  baselineWorker.terminate();
  baselineWorker = spawn(baselineSolved);
  const dropped = new Set([baselineId, ...queue.map((r) => r.id)]);
  for (const [key, id] of asked) if (dropped.has(id)) asked.delete(key);
  queue.length = 0;
  solvingBaseline = false;
}

/**
 * The settings with the curve flattened.
 *
 * @returns  Settings.
 */
function flat(): Settings {
  return { ...state.settings, colorfulnessPerHue: { light: [], dark: [] } };
}

/**
 * Whether the curve changes anything.
 *
 * @returns  True when either mode's curve has an amount.
 */
function curved(): boolean {
  return Object.values(state.settings.colorfulnessPerHue).some((points) => points.some((p) => !p.off && p.amount !== 0));
}

/** The last solved palette for each use of a baseline, shown while that use's new one solves. */
const lastSolved = new Map<string, GamutPalette>();

/** The uses showing a stand-in right now. */
const standingIn = new Set<string>();

/**
 * Whether everything on screen comes from the current settings: the palette and every baseline
 * shown. Until then a comparison would mix old and new results, so readouts keep their last text.
 *
 * @returns  True when nothing is solving or standing in.
 */
export function upToDate(): boolean {
  return !state.solving && standingIn.size === 0;
}

/**
 * A baseline of the settings on the gamut tier on screen, asked for once and kept. While it solves,
 * the last one solved for the same use stands in, so nothing that was drawn goes back to waiting
 * and nothing below it moves; only the very first time is there nothing yet.
 *
 * @param settings  The settings to solve.
 * @param use       What it's for, e.g. "plain"; each use has its own stand-in.
 * @returns         The palette, its stand-in while it solves, or null before either exists.
 */
export function baseline(settings: Settings, use: string): GamutPalette | null {
  const key = `${JSON.stringify(solvedPart(settings))}|${state.gamut}`;
  const standIn = lastSolved.get(`${use}|${state.gamut}`) ?? null;
  const id = asked.get(key);
  if (id !== undefined) {
    // Used again, so it moves to the back of the line for letting go: the least used go first.
    asked.delete(key);
    asked.set(key, id);
    const solved = state.baselines.get(id);
    if (solved) lastSolved.set(`${use}|${state.gamut}`, solved);
    if (solved) standingIn.delete(use);
    else if (standIn) standingIn.add(use);
    return solved ?? standIn;
  }
  asks++;
  asked.set(key, asks);
  queue.push({ id: asks, settings, gamut: state.gamut });
  // Older waiting baselines are given up; they're asked for again if they're still wanted.
  for (const dropped of queue.splice(0, Math.max(0, queue.length - QUEUED)))
    for (const [k, v] of asked) if (v === dropped.id) asked.delete(k);
  if (!solvingBaseline) nextBaseline();
  if (standIn) standingIn.add(use);
  return standIn;
}

/**
 * The palette on screen with or without its edits: placed hues (H) and colorfulness per hue (M).
 * An edit that changes nothing is left in, so the palette in use is shared where it can be.
 *
 * @param h  Whether placed hues are kept.
 * @param m  Whether colorfulness per hue is kept.
 * @returns  The palette, or null while it solves.
 */
export function edited(h: boolean, m: boolean): GamutPalette | null {
  const [noCurve, noPlaced] = [!m && curved(), !h && Object.keys(state.settings.placed).length > 0];
  const use = `edited ${String(h)} ${String(m)}`;
  // The palette in use needs no baseline, so this use stands in for nothing.
  if (!noCurve && !noPlaced) {
    standingIn.delete(use);
    return inUse();
  }
  return baseline({ ...(noCurve ? flat() : state.settings), ...(noPlaced ? { placed: {} } : {}) }, use);
}

/** Without the curve: it only depends on settings other than the curve, so moving the curve never waits for it. */
export function uncurved(): GamutPalette | null {
  return edited(true, false);
}

/** Nothing placed and no curve: the first step of the strip. */
export function plain(): GamutPalette | null {
  return edited(false, false);
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
export function turn(mode: Mode): number | null {
  const tier = identityOf(onScreen(), mode);
  const [even, hued] = [plain()?.[mode], uncurved()?.[mode]];
  if (!even || !hued) return null;
  if (!turns.has(even)) turns.set(even, new WeakMap());
  const byHued = turns.get(even)!;
  if (!byHued.has(hued)) byHued.set(hued, new Map());
  const known = byHued.get(hued)!.get(tier);
  if (known !== undefined) return known;
  const pairs = even.colors.flatMap((c) => {
    const [u, h] = [c.tiers[tier]?.default, hued.colors.find((x) => x.key === c.key)?.tiers[tier]?.default];
    return c.kind === "hue" && u && h ? [[model().cam(mode, u.color), model().cam(mode, h.color)] as const] : [];
  });
  const off = (degrees: number) => {
    const [cos, sin] = [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];
    const sum = pairs.reduce((total, [u, h]) => {
      const [a, b] = [u.astar * cos - u.bstar * sin, u.astar * sin + u.bstar * cos];
      const distance = deltaE(Math.hypot(u.jstar - h.jstar, a - h.astar, b - h.bstar));
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
export function turned(mode: Mode): {
  colors: Record<string, { hue: number; colorfulness: number; color: string }>;
  ring: readonly number[] | null;
  keys: readonly string[] | null;
} | null {
  const angle = turn(mode);
  const even = plain()?.[mode];
  if (angle === null || !even) return null;
  const s = state.settings;
  const tier = identityOf(s, mode);
  // No turn needs no baseline, so nothing stands in for it.
  if (angle === 0) standingIn.delete("turned");
  const solved = angle === 0 ? even : baseline({ ...flat(), placed: {}, anchor: Math.round((anchorHue(s) + angle) * 10) / 10 }, "turned")?.[mode];
  const colors = Object.fromEntries(
    even.colors.flatMap((c) => {
      const exact = solved?.colors.find((x) => x.key === c.key)?.tiers[tier]?.default;
      if (exact) return [[c.key, { hue: exact.hue, colorfulness: exact.colorfulness, color: exact.color }]];
      const u = c.tiers[tier]?.default;
      if (!u) return [];
      const hue = (((u.hue + angle) % 360) + 360) % 360;
      try {
        return [[c.key, { hue, colorfulness: u.colorfulness, color: strongest(model(), onScreen().bases[mode], mode, hue, u.colorfulness, tier) }]];
      } catch {
        return [];
      }
    }),
  );
  const ring = solved?.ring[tier] ?? null;
  return { colors, ring, keys: solved && ring ? solved.colors.slice(0, ring.length).map((c) => c.key) : null };
}

/**
 * Asks for the baselines the strip compares; the page asks for any other it shows.
 */
export function askBaselines(): void {
  uncurved();
  plain();
  turned(state.mode);
}
