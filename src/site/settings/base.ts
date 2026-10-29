/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< BASE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Settings' base fields: what each gamut tier shows for a mode's base, the notice when it can't    |
| show it, and picking its color by hand.                                                          |
\*------------------------------------------------------------------------------------------------*/

import { type BaseIn, baseIn } from "../../palette/bases";
import { JUST_VISIBLE } from "../../palette/model";
import { GAMUTS, GAMUT_NAMES, type Gamut, type Mode, type Settings } from "../../palette/settings";
import { hidePopover, popButton, popSource } from "../popover";
import { render, route } from "../shell";
import { solve } from "../solver";
import { state } from "../state";
import { write } from "./fields";
import { jumpTo } from "./page";

/** How each gamut tier writes a base, for the field's hint and its problems. */
export const BASE_EXAMPLES: Record<Gamut, string> = {
  standard: "#EBEBEB",
  wide: "color(display-p3 0.92 0.92 0.92)",
  ultra: "color(rec2020 0.93 0.93 0.93)",
};

/**
 * How a gamut tier shows a mode's base, in a few words.
 *
 * @param base  The tier's base.
 * @returns     Text.
 */
function baseHowText(base: BaseIn): string {
  return base.how === "exact"
    ? "the base itself"
    : base.how === "picked"
      ? `picked by hand, ΔE ${base.off.toFixed(1)} from the base`
      : `the closest color these screens can show, ΔE ${base.off.toFixed(1)} from the base`;
}

/**
 * A base's label: it opens what the base is and how each gamut tier shows it, and a mark says how
 * the tier on screen does: a check when its color is picked by hand, an amber mark when it's the
 * closest color, none when it's the base itself.
 *
 * @param mode  The mode.
 * @returns     HTML.
 */
export function baseLabel(mode: Mode): string {
  const base = baseIn(state.settings, mode, state.gamut);
  const mark =
    base.how === "picked" ? `<span class="base-state set" aria-hidden="true">✓</span>`
    : base.how === "closest" ? `<span class="base-state closest" aria-hidden="true">!</span>`
    : "";
  return popButton(`base:${mode}`, `Base${mark}`, `Base, ${mode} mode, on ${GAMUT_NAMES[state.gamut].toLowerCase()} screens: ${baseHowText(base)}. What it means`, "metric");
}

popSource("base", (which) => {
  const mode = which as Mode;
  const rows = GAMUTS.map((g) => {
    const base = baseIn(state.settings, mode, g);
    return `<div><dt>${GAMUT_NAMES[g]}</dt><dd><span class="mono">${base.written}</span>${g === state.gamut ? ` <span class="base-how soft">• shown</span>` : ""}<br><span class="base-how${base.how === "closest" ? " base-closest" : " soft"}">${baseHowText(base)}</span></dd></div>`;
  }).join("");
  const shown = baseIn(state.settings, mode, state.gamut);
  const screens = `${GAMUT_NAMES[state.gamut].toLowerCase()} screens`;
  const action =
    shown.how === "picked" ? `<p><button type="button" data-base-closest="${mode}">Back to the closest color</button></p>`
    : shown.how === "closest" ? `<p><button type="button" data-base-go="${mode}">Pick the color for ${screens}</button></p>`
    : "";
  return `<h3>Base, ${mode} mode</h3>
    <p>The background the ${mode} mode's colors sit on. Every contrast is measured against it, the identity tier is chosen on it, and the neutral colors take their hue from it.</p>
    <dl class="pop-facts">${rows}</dl>
    <p class="pop-how">The base is one color, shown by every kind of screen as well as it can: exactly where it can, else as the closest color it can show. That color can be picked by hand, as long as it's still the same background: no more than ΔE ${String(JUST_VISIBLE)} further from the base than the closest color is.</p>
    ${action}`;
});

/**
 * The notice under the header while the gamut tier on screen can't show the base: the closest
 * color it uses instead, and where to pick one.
 */
export function updateBaseNote(): void {
  const note = document.querySelector<HTMLElement>("#auto-base");
  if (!note) return;
  const base = baseIn(state.settings, state.mode, state.gamut);
  note.hidden = base.how !== "closest" || state.view === "references";
  if (note.hidden) return;
  note.innerHTML = `${GAMUT_NAMES[state.gamut]} screens can't show the ${state.mode} base, so they use the closest color they can, <span class="mono">${base.written}</span>, ΔE ${base.off.toFixed(1)} from it. To pick one by hand, <a href="#tune" data-base-go="${state.mode}">go to Settings, under Viewing</a>.`;
}

/**
 * Puts the cursor in a mode's base field, in Settings under Viewing, opening Settings first.
 *
 * @param mode  The mode.
 */
function goToBase(mode: Mode): void {
  if (state.view !== "tune") {
    history.pushState(null, "", "#tune");
    route();
  }
  jumpTo("viewing-section");
  const field = document.querySelector<HTMLInputElement>(`#set-base-${mode}`);
  field?.focus({ preventScroll: true });
  field?.select();
}

/**
 * The colors picked per gamut tier, with one mode's on one tier left out.
 *
 * @param gamut  The tier.
 * @param mode   The mode.
 * @returns      The picks.
 */
function withoutPick(gamut: Gamut, mode: Mode): Settings["pickedBases"] {
  const { [mode]: _gone, ...rest } = state.settings.pickedBases[gamut] ?? {};
  const { [gamut]: _tier, ...others } = state.settings.pickedBases;
  return Object.keys(rest).length ? { ...others, [gamut]: rest } : others;
}

/**
 * Makes a color a mode's base, the one every gamut tier shows as well as it can.
 *
 * @param mode   The mode.
 * @param color  The color.
 */
export function setBase(mode: Mode, color: string): void {
  write(`bases.${mode}`, color);
}

document.addEventListener("click", (event) => {
  const el = (event.target as Element).closest<HTMLElement>("[data-base-go],[data-base-closest],[data-base-use]");
  if (!el) return;
  event.preventDefault();
  hidePopover();
  const { baseGo, baseClosest, baseUse } = el.dataset;
  if (baseGo) return goToBase(baseGo as Mode);
  if (baseUse) {
    // A color too different to be picked becomes the base itself.
    const field = document.querySelector<HTMLInputElement>(`#set-base-${baseUse}`);
    if (field) setBase(baseUse as Mode, normalColor(field.value));
  } else write("pickedBases", withoutPick(state.gamut, baseClosest as Mode));
  solve();
  render();
});

/**
 * A color as the settings keep it: hex in capitals, anything else as typed.
 *
 * @param value  The color typed.
 * @returns      The color.
 */
export function normalColor(value: string): string {
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : color;
}
