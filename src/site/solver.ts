/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< SOLVER >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The worker that solves the palette: one solve per gamut tier, the screen's own first, a newer    |
| change replacing the solve under way.                                                            |
\*------------------------------------------------------------------------------------------------*/

import { forGamut } from "../palette/bases";
import { GAMUTS, type Gamut } from "../palette/settings";
import { huesKey } from "../palette/solve";
import { updateExport } from "./settings/export";
import { updateTune } from "./settings/page";
import { render, status } from "./shell";
import { state } from "./state";
import { LONG_VARIANT, askVariants, restartVariants, solvingVariant, variantSince } from "./variants";
import type { Request, Response } from "./worker";

/**
 * Starts a worker, at the same version as this script, so the two always match. Its address is
 * worked out on each call, as the variants' worker starts before this file has run.
 *
 * @param answer  What to do with each answer.
 * @returns       The worker.
 */
export function spawn(answer: (event: MessageEvent<Response>) => void): Worker {
  const url = new URL(`worker.js${new URL(import.meta.url).search}`, import.meta.url);
  const started = new Worker(url, { type: "module" });
  started.addEventListener("message", answer);
  return started;
}

let worker = spawn(solved);
let latest = 0;
let timer = 0;

/** Whether the worker is solving a request that hasn't answered yet. */
export let busy = false;

/** The hues the worker's request in hand depends on: a newer change with the same ones is quick to wait for. */
let busyHues = "";

/** The gamut tier of the worker's request in hand. */
let busyGamut: Gamut = "standard";

/**
 * Takes a solved gamut tier from the worker, and asks for the next one.
 *
 * @param event  The worker's answer.
 */
export function solved(event: MessageEvent<Response>): void {
  busy = false;
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
}

/**
 * Asks the worker for one gamut tier of the current settings.
 *
 * @param gamut  The gamut tier.
 */
function post(gamut: Gamut): void {
  busy = true;
  busyHues = huesKey(forGamut(state.settings, gamut));
  busyGamut = gamut;
  worker.postMessage({ id: latest, settings: state.settings, gamut } satisfies Request);
}

/**
 * Solves the current settings, a moment after the last change: the gamut tier on screen first.
 *
 * @param wait  Milliseconds to wait for more changes.
 */
export function solve(wait = 0): void {
  clearTimeout(timer);
  // The palettes on hand are from older settings from now on: late answers are dropped, and the
  // export waits for the new ones.
  latest++;
  state.fresh = new Set();
  state.solving = true;
  status();
  timer = window.setTimeout(() => {
    // A solve still running is for older settings: it's stopped rather than waited for, so many
    // hues never hold up the next change. One with the same hues only places colors on them, which
    // takes milliseconds; stopping it would also lose the hues the worker keeps.
    if (busy && busyHues !== huesKey(forGamut(state.settings, busyGamut))) {
      worker.terminate();
      worker = spawn(solved);
    }
    if (solvingVariant && performance.now() - variantSince > LONG_VARIANT) restartVariants();
    post(state.gamut);
    askVariants();
  }, wait);
}
