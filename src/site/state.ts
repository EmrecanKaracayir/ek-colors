/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< STATE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the site holds: the settings, the mode, the gamut tier and the page on screen, the palettes |
| solved, and what's kept in the browser between visits.                                           |
\*------------------------------------------------------------------------------------------------*/

import { CONFIG } from "../config";
import { readSettings } from "../palette/check";
import { SYSTEMS } from "../palette/references";
import type { Gamut, Mode, Settings } from "../palette/settings";
import { type GamutPalette, PAGES, withNeutrals } from "../palette/solve";
import type { Format } from "./highlight";

/** A color's default version, or its muted one. */
export type Variant = "default" | "muted";

/** The pages drawn on their own; "colors" opens the first color, and "export" a section of Settings. */
export const VIEWS = PAGES.filter((p) => p !== "colors" && p !== "export");

/** Remembers the settings. */
const STORE = "ek-colors:settings";

/** Remembers whether the comparison with Codemos is shown. */
export const COMPARE = "ek-colors:compare";

/** Remembers the Edits switches. */
export const EDITS = "ek-colors:edits";

/** Remembers Light or Dark, once chosen. */
export const MODE = "ek-colors:mode";

/** Remembers which reference system the graphs draw as guides. */
const GUIDE = "ek-colors:guide";

/** Remembers the last palette solved for the gamut tier on screen, drawn at once on the next visit. */
const PALETTE = "ek-colors:palette";

/** This script's build, so a palette another build solved isn't drawn. */
const BUILD = new URLSearchParams(new URL(import.meta.url).search).get("v") ?? "";

/** The widest gamut tier this screen covers. */
export const SCREEN: Gamut = matchMedia("(color-gamut: rec2020)").matches
  ? "ultra"
  : matchMedia("(color-gamut: p3)").matches
    ? "wide"
    : "standard";

export const state = {
  settings: load(),
  mode: loadMode(),

  /** The reference system the graphs draw as guides: a way of looking, not part of the palette. */
  guide: loadGuide(),
  variant: "default" as Variant,
  view: "overview",

  /** Whether the pages show placed hues (H) and colorfulness per hue (M); off shows the palette without them. */
  edits: loadEdits(),
  format: "json" as Format,
  gamut: SCREEN,
  palettes: {} as Partial<Record<Gamut, GamutPalette>>,

  /** The gamut tiers solved from the current settings; the others still show their last solve. */
  fresh: new Set<Gamut>(),

  /** The settings solved again without the curve, with nothing placed or turned, by request: for the Edits switches and the strip. */
  baselines: new Map<number, GamutPalette>(),
  solving: false,
  took: 0,
  error: null as string | null,

  /** Settings' paste box: whether it's open, what's in it, and what's wrong with it, if anything. */
  paste: { open: false, text: "", problem: "" },

  /** The settings before the last paste, until anything else changes them. */
  undo: null as Settings | null,
};

// The palette last solved for these settings and this screen shows until they solve again.
Object.assign(state.palettes, keptPalette());

/**
 * The saved settings, or EK Palette's.
 *
 * @returns  Settings.
 */
function load(): Settings {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) return withNeutrals(readSettings(JSON.parse(saved), CONFIG));
  } catch {
    // Storage can be blocked, and settings that no longer make sense are dropped; the defaults do.
  }
  return structuredClone(CONFIG);
}

/**
 * Light or Dark as last chosen in this browser, or the system's.
 *
 * @returns  The mode.
 */
function loadMode(): Mode {
  try {
    const saved = localStorage.getItem(MODE);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage can be blocked; the system's choice does.
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * The guides last chosen in this browser, or CAM16's.
 *
 * @returns  The reference system's id.
 */
function loadGuide(): string {
  try {
    const saved = localStorage.getItem(GUIDE);
    if (saved && SYSTEMS.some((s) => s.id === saved)) return saved;
  } catch {
    // Storage can be blocked; CAM16's do.
  }
  return "cam16";
}

/**
 * Draws another reference system's guides, and remembers it in this browser.
 *
 * @param id  The system.
 */
export function setGuide(id: string): void {
  state.guide = id;
  try {
    localStorage.setItem(GUIDE, id);
  } catch {
    // Storage can be blocked; it then lasts until the page closes.
  }
}

/**
 * The Edits switches as last left in this browser, or both on.
 *
 * @returns  Which edits are shown.
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
export function save(): void {
  // A drag writes on every move, so the settings are stored once it rests, or as the page closes.
  clearTimeout(saving);
  saving = window.setTimeout(storeNow, 300);
}

/** The settings waiting to be stored. */
let saving = 0;

/** Stores the settings now. */
function storeNow(): void {
  clearTimeout(saving);
  try {
    localStorage.setItem(STORE, JSON.stringify(state.settings));
  } catch {
    // Storage can be blocked; the page works without it.
  }
}

/**
 * Settings as text that's the same whatever order their keys were written in.
 *
 * @param value  The settings, or a part of them.
 * @returns      JSON with every object's keys sorted.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .toSorted()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

/** A palette kept in this browser, with what it was solved from. */
interface Kept {
  readonly build: string;
  readonly gamut: Gamut;
  readonly settings: string;
  readonly palette: GamutPalette;
}

/**
 * The palette kept from the last visit, if this build solved it from these settings for this
 * screen's gamut tier.
 *
 * @returns  It by its gamut tier, or nothing.
 */
function keptPalette(): Partial<Record<Gamut, GamutPalette>> {
  try {
    const kept = JSON.parse(localStorage.getItem(PALETTE) ?? "null") as Kept | null;
    if (kept?.build === BUILD && kept.gamut === state.gamut && kept.settings === canonical(state.settings)) return { [kept.gamut]: kept.palette };
  } catch {
    // Storage can be blocked, or hold something else; the palette then waits for its solve.
  }
  return {};
}

/** The palette waiting to be kept. */
let keeping = 0;

/**
 * Keeps the palette on screen for the next visit, once solving rests.
 */
export function keepPalette(): void {
  clearTimeout(keeping);
  keeping = window.setTimeout(keepNow, 1000);
}

/** Keeps the palette on screen now, if it's solved from the current settings. */
function keepNow(): void {
  clearTimeout(keeping);
  const palette = state.palettes[state.gamut];
  if (!palette || !state.fresh.has(state.gamut)) return;
  const kept: Kept = { build: BUILD, gamut: state.gamut, settings: canonical(state.settings), palette };
  try {
    localStorage.setItem(PALETTE, JSON.stringify(kept));
  } catch {
    // Storage can be blocked or full; the next visit then waits for its solve.
  }
}

window.addEventListener("pagehide", () => {
  storeNow();
  keepNow();
});
