/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< STATE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the site holds: the settings, the mode, the gamut tier and the page on screen, the palettes |
| solved, and what's kept in the browser between visits.                                           |
\*------------------------------------------------------------------------------------------------*/

import { CONFIG } from "../config";
import { readSettings } from "../palette/check";
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

/** The widest gamut tier this screen covers. */
export const SCREEN: Gamut = matchMedia("(color-gamut: rec2020)").matches
  ? "ultra"
  : matchMedia("(color-gamut: p3)").matches
    ? "wide"
    : "standard";

export const state = {
  settings: load(),
  mode: loadMode(),
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

  /** Settings' paste box: whether it's open, what's in it, and what's wrong with it, if anything. */
  paste: { open: false, text: "", problem: "" },

  /** The settings before the last paste, until anything else changes them. */
  undo: null as Settings | null,
};

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

window.addEventListener("pagehide", storeNow);
