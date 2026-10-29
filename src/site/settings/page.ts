/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< SETTINGS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The settings page: its sections and their fields, the custom and neutral colors, the paste box,  |
| and the about section.                                                                           |
\*------------------------------------------------------------------------------------------------*/

import project from "../../../package.json";
import { CONFIG } from "../../config";
import { baseIn } from "../../palette/bases";
import { SettingsError, readSettings } from "../../palette/check";
import { composition } from "../../palette/model";
import { SYSTEMS, anchorHue } from "../../palette/references";
import { LIMITS, MODES, MODE_NAMES, type Mode, ROLES, SURROUNDS, type Settings } from "../../palette/settings";
import { NEUTRAL_BAND, autoIdentity, baseHasHue, colorKeys, customKeys, identityOf } from "../../palette/solve";
import { anchored, current, curveView, huesView, onScreen } from "../derived";
import { escape } from "../graph";
import { currentMode } from "../pages/color";
import { defaultName, label } from "../parts";
import { state } from "../state";
import { BASE_EXAMPLES, baseLabel } from "./base";
import { curveEditor, refreshCurve } from "./curve";
import { exportSection, updateExport } from "./export";
import { huesNote, number, shareField, updateShares } from "./fields";
import { huesEditor, refreshHues } from "./hues";
import { updateStrip } from "./strip";

/**
 * The automatic identity tier's choice in Settings, with the tier it picks on the mode's base.
 *
 * @param mode  The mode.
 * @returns     E.g. "Automatic (Lc 60)".
 */
export function automaticName(mode: Mode): string {
  const { bases, tiers } = onScreen();
  return `Automatic (Lc ${String(autoIdentity(bases[mode], tiers))})`;
}

/** Settings' sections, by their ids, for the links under its title. */
const JUMPS = [
  ["hue-section", "Hue"],
  ["colorfulness-section", "Colorfulness"],
  ["extras-section", "Extra colors"],
  ["tiers-section", "Tiers"],
  ["viewing-section", "Viewing"],
  ["export-section", "Export"],
  ["about", "About"],
] as const;

/**
 * Scrolls a section of Settings into view below the bar and the strip, which both stick, and
 * gives its title the focus.
 *
 * @param id  The section's id.
 */
export function jumpTo(id: string): void {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView();
  window.scrollBy(0, -(document.querySelector("#palette-strip")?.getBoundingClientRect().bottom ?? 0) - 16);
  const title = section.querySelector<HTMLElement>("h2");
  if (title) {
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}

document.addEventListener("click", (event) => {
  const link = (event.target as Element).closest<HTMLElement>("[data-jump]");
  if (!link) return;
  jumpTo(link.dataset.jump!);
  // A link to a field puts the cursor in it.
  if (link.dataset.focus) document.getElementById(link.dataset.focus)?.focus({ preventScroll: true });
});

/**
 * One custom color's settings: its name, hue and share of the colorfulness, under a title showing
 * its color on the identity tier and how its hue reads.
 *
 * @param i  Which custom color.
 * @returns  HTML.
 */
function customFields(i: number): string {
  const name = escape(state.settings.custom[i]!.name);
  return `<div class="extra" data-custom="${String(i)}">
    <h3 class="extra-title"><span class="extra-name">${customDot(i)}${label(customKeys(state.settings)[i]!)}</span><button type="button" class="link" data-action="remove-custom" data-index="${String(i)}" aria-label="Remove ${label(customKeys(state.settings)[i]!)}">Remove</button></h3>
    <label class="field grow" for="set-custom-${String(i)}-name"><span>Name</span><input id="set-custom-${String(i)}-name" type="text" data-custom-name="${String(i)}" value="${name}" spellcheck="false"></label>
    ${number(`custom.${String(i)}.hue`, "Hue", [0, 359.9, 0.1], { slider: true, after: `<span class="share-m soft" data-hue-note="${String(i)}">${hueNote(i)}</span>` })}
    ${shareField(`custom.${String(i)}.share`, "Colorfulness")}
  </div>`;
}

/**
 * One neutral color's settings: its name and its share of the base's tint, under a title showing
 * its color on the identity tier.
 *
 * @param i  Which neutral color.
 * @returns  HTML.
 */
function neutralFields(i: number): string {
  const name = escape(state.settings.neutrals[i]!.name);
  return `<div class="extra" data-neutral="${String(i)}">
    <h3 class="extra-title"><span class="extra-name">${neutralDot(i)}${label(colorKeys(state.settings).neutrals[i]!)}</span><button type="button" class="link" data-action="remove-neutral" data-index="${String(i)}" aria-label="Remove ${label(colorKeys(state.settings).neutrals[i]!)}">Remove</button></h3>
    <label class="field grow" for="set-neutrals-${String(i)}-name"><span>Name</span><input id="set-neutrals-${String(i)}-name" type="text" data-neutral-name="${String(i)}" value="${name}" spellcheck="false"></label>
    ${shareField(`neutrals.${String(i)}.share`, "Colorfulness")}
  </div>`;
}

/**
 * A neutral color's dot: its color on the identity tier.
 *
 * @param i  Which neutral color.
 * @returns  HTML.
 */
function neutralDot(i: number): string {
  const key = colorKeys(state.settings).neutrals[i]!;
  const tier = identityOf(onScreen(), state.mode);
  const color = currentMode()?.neutrals.find((n) => n.key === key)?.tiers[tier]?.color ?? "transparent";
  return `<span class="dot" style="--c:${color}"></span>`;
}

/**
 * Whether either base is tinted, so neutral colors would differ from the grays.
 *
 * @returns  True when a base is tinted.
 */
export function anyTinted(): boolean {
  return baseHasHue(state.settings);
}

/**
 * The gray that every palette has, shown first among the neutral colors; it has no Remove.
 *
 * @returns  HTML.
 */
function grayRow(): string {
  const tier = identityOf(onScreen(), state.mode);
  const color = currentMode()?.grays[tier]?.color ?? "transparent";
  return `<h3 class="extra-title gray-row"><span class="extra-name"><span class="dot" style="--c:${color}"></span>Gray</span></h3>`;
}

/**
 * A custom color's dot: its color on the identity tier.
 *
 * @param i  Which custom color.
 * @returns  HTML.
 */
function customDot(i: number): string {
  const key = customKeys(state.settings)[i]!;
  const tier = identityOf(onScreen(), state.mode);
  const color = current()?.[state.mode].colors.find((c) => c.key === key)?.tiers[tier]?.default.color ?? "transparent";
  return `<span class="dot" style="--c:${color}"></span>`;
}

/**
 * How a custom color's hue reads.
 *
 * @param i  Which custom color.
 * @returns  Text.
 */
export function hueNote(i: number): string {
  return composition(state.settings.custom[i]!.hue);
}

/**
 * The settings, a group at a time, with a live strip of the identity tier.
 *
 * @returns  HTML.
 */
export function tune(): string {
  const s = state.settings;
  return `<section class="intro settings-head">
      <div class="settings-lead">
        <h1>Settings</h1>
        <p>Change a setting and the palette solves again. Changes stay in this browser.</p>
        <nav class="row jumps" aria-label="Settings sections">${JUMPS.map(([id, name]) => `<button type="button" class="link" data-jump="${id}">${name}</button>`).join("")}</nav>
      </div>
      <div class="settings-actions">
        <label class="field palette-name" for="set-name"><span>Name</span><input id="set-name" type="text" data-name maxlength="60" spellcheck="false" placeholder="${defaultName()}" value="${escape(s.name)}"></label>
        <p class="row"><button type="button" data-action="reset">Reset to EK Palette</button><button type="button" data-action="copy-settings">Copy settings</button><button type="button" data-action="paste-settings" aria-expanded="${String(state.paste.open)}" aria-controls="paste-box">Paste settings</button>${state.undo ? `<button type="button" class="link" data-action="undo-paste">Undo paste</button>` : ""}</p>
        <span id="copied" class="soft" role="status"></span>
      </div>
      ${pasteBox()}
    </section>
    <div id="palette-strip" class="strip"></div>
    <section class="group" id="hue-section">
      <h2>Hue (H)</h2>
      ${number("hues", "How many hues", [...LIMITS.hues, 1])}<div id="hues-note">${huesNote(state.settings.hues)}</div>
      <p class="soft">The uniform lineup divides the circle evenly from the anchor, then evens out the differences between neighbors as they're seen rather than as numbers. From there, colors can be placed where their names fit best: drag one on the Current row and the others re-space around it.</p>
      <p class="soft">The anchor fixes where the lineup sits: the differences between neighbors barely change if the whole lineup turns, so something has to hold it. ${label(anchored())} stays exactly on it.</p>
      <div class="action-row"><p><a href="#hue-test" class="button">Measure it with the blind hue test</a></p></div>
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
    <section class="group" id="colorfulness-section">
      <h2>Colorfulness (M)</h2>
      <p class="soft">One CAM16 colorfulness every hue aims at, in both modes, before colorfulness per hue adds or takes away; custom colors aim at their share of it. A color the screen can't make that colorful goes as far as it can.</p>
      ${number("colorfulness", "Target M", [...LIMITS.colorfulness, 1], { slider: true })}
      ${number("muted", "Muted share", [...LIMITS.muted, 0.05], { slider: true, percent: true })}
      <label class="field" for="set-equal"><span>Equal per tier</span><input id="set-equal" type="checkbox" data-action="equal" ${s.equalTiers ? "checked" : ""}></label>
      <p class="soft">On: a tier aims at what its least colorful hue can reach, so every color on it is equally colorful. Off: each color goes as far as the screen allows.</p>
      <h3>Per hue</h3>
      <p class="soft">${MODE_NAMES[state.mode]} mode's curve; switch Light and Dark above to edit the other. Colorfulness added or taken away smoothly over hue, for parts of the circle that look weaker or stronger than the model says. Its points add up.</p>
      <div class="action-row"><p><a href="#curve-test" class="button">Measure it with the blind colorfulness test</a></p></div>
      ${curveEditor(curveView(state.mode), (path, title, range) => number(path, title, range))}
    </section>
    <section class="group" id="extras-section">
      <h2>Extra colors</h2>
      <p class="soft">Colors beside the evenly spaced hues, on every tier. Neutral colors follow each mode's own base, so light and dark can differ. The bar under each colorfulness slider shows where a color reads as gray (under M ${String(NEUTRAL_BAND[0])}), as a neutral (M ${String(NEUTRAL_BAND[0])}–${String(NEUTRAL_BAND[1])}) or as a color.</p>
      <div class="color-columns">
        <div class="color-column">
          <div class="column-head">
            <h3>Custom colors</h3>
            <p class="soft">Each keeps a hue of its own, such as a brand color, at a share of the palette's colorfulness, with a muted version.</p>
          </div>
          ${s.custom.map((_, i) => customFields(i)).join("")}
          <div class="action-row">
            <p><button type="button" data-action="add-custom">Add a custom color</button></p>
          </div>
        </div>
        <div class="color-column">
          <div class="column-head">
            <h3>Neutral colors</h3>
            <p class="soft">Mostly for text. Gray is in every palette; each neutral color takes the base's hue at a share of the base's colorfulness.</p>
          </div>
          ${grayRow()}
          ${s.neutrals.map((_, i) => neutralFields(i)).join("")}
          <div class="action-row">
            <p><button type="button" data-action="add-neutral"${anyTinted() ? "" : " disabled"}>Add a neutral color</button></p>
            <p class="soft" id="neutrals-untinted"${anyTinted() ? " hidden" : ""}>Both bases are gray or nearly, so there's no hue to follow. Give a base a hue in <button type="button" class="link" data-jump="viewing-section" data-focus="set-base-${state.mode}">Viewing</button> to add one.</p>
          </div>
        </div>
      </div>
    </section>
    <section class="group" id="tiers-section">
      <h2>Tiers</h2>
      <p class="soft">The APCA contrasts every color gets. The identity tier stands for the hue and sets every tier's starting hues. Automatic picks the tier where APCA and WCAG 2 together are just at their minimum for text; choose a tier to set it by hand, here or on the Tiers page.</p>
      <div class="checks">${Object.keys(ROLES)
        .map(Number)
        .map((t) => `<label for="tier-${String(t)}"><input id="tier-${String(t)}" type="checkbox" data-tier="${String(t)}" ${s.tiers.includes(t) ? "checked" : ""}> Lc ${String(t)}</label>`)
        .join("")}</div>
      ${MODES.map(
          (m) => `<label class="field wide" for="set-identity-${m}"><span>Identity, ${m}</span><select id="set-identity-${m}" data-set="identityTier.${m}"><option value="auto" ${s.identityTier[m] === "auto" ? "selected" : ""}>${automaticName(m)}</option>${s.tiers
            .map((t) => `<option value="${String(t)}" ${t === s.identityTier[m] ? "selected" : ""}>Lc ${String(t)}</option>`)
            .join("")}</select></label>`,
        )
        .join("")}
    </section>
    <section class="group" id="viewing-section">
      <h2>Viewing</h2>
      <p class="soft">Where the colors are seen. The same screen color looks different on a light page and a dark one, and in a bright room and a dim one, so each mode is solved for its own background and room; <a href="#how">How it works</a> shows the difference.</p>
      <dl class="facts-list">
        <div><dt>Base</dt><dd>The background the mode's colors sit on. Every contrast is measured against it, so set it to the page the colors will be used on. Any CSS color works, such as hex, rgb(), oklch() or color(display-p3 …). Each kind of screen shows it its own way: hex on standard screens, color(display-p3 …) on wide ones and color(rec2020 …) on ultra ones; a screen that can't show it uses the closest color it can, which can also be picked by hand. Base shows the one for the gamut picked in the header.</dd></div>
        <div><dt>Room lux</dt><dd>How much light is in the room. The brighter it is, the more colorful colors look, so a dim room needs more color on the screen for the same look. Light mode is seen in a lit room (200), dark mode in a dim one (64), as the sRGB standard has them.</dd></div>
        <div><dt>Surround</dt><dd>How bright the room around the screen is, next to the screen itself: Average for a lit office, Dim for a dim living room in the evening, Dark for a dark room, like a cinema. A darker surround makes colors look less contrasty and less colorful.</dd></div>
      </dl>
      <div class="split even rows">${(["light", "dark"] as const)
        .map(
          (m) => `<div><h3>${MODE_NAMES[m]}</h3>
            <label class="field grow base-field" for="set-base-${m}"><span>${baseLabel(m)}</span><input id="set-base-${m}" type="text" data-set="bases.${m}" value="${baseIn(s, m, state.gamut).written}" placeholder="${BASE_EXAMPLES[state.gamut]}" spellcheck="false" aria-label="Base, ${m} mode"></label>
            ${number(`rooms.${m}.lux`, "Room lux", [...LIMITS.lux, 1])}
            <label class="field" for="set-surround-${m}"><span>Surround</span><select id="set-surround-${m}" data-set="rooms.${m}.surround">${SURROUNDS.map((name, i) => `<option value="${String(i)}" ${i === s.rooms[m].surround ? "selected" : ""}>${name}</option>`)
              .join("")}</select></label></div>`,
        )
        .join("")}</div>
    </section>
    ${exportSection()}
    ${about()}`;
}

/**
 * Refreshes what Settings shows from the palette without redrawing its controls: the strip, the
 * export, the custom colors' titles, the hue graph and the curve editor.
 */
export function updateTune(): void {
  const name = document.querySelector<HTMLInputElement>("#set-name");
  if (name) name.placeholder = defaultName();
  updateStrip();
  updateExport();
  for (const block of document.querySelectorAll<HTMLElement>("[data-neutral]")) {
    const i = Number(block.dataset.neutral);
    block.querySelector(".extra-name")!.innerHTML = `${neutralDot(i)}${label(colorKeys(state.settings).neutrals[i]!)}`;
  }
  document.querySelector(".gray-row")?.replaceWith(document.createRange().createContextualFragment(grayRow()));
  updateShares();
  for (const block of document.querySelectorAll<HTMLElement>("[data-custom]")) {
    const i = Number(block.dataset.custom);
    block.querySelector(".extra-name")!.innerHTML = `${customDot(i)}${label(customKeys(state.settings)[i]!)}`;
    block.querySelector("[data-hue-note]")!.textContent = hueNote(i);
  }
  if (document.querySelector(".hues-editor")) refreshHues(huesView());
  for (const m of MODES) refreshCurve(curveView(m));
}

/**
 * Settings' paste box, when it's open: a place to paste settings or a JSON export, and what's
 * wrong with them, if anything.
 *
 * @returns  HTML.
 */
function pasteBox(): string {
  const { open, text, problem } = state.paste;
  if (!open) return "";
  return `<div id="paste-box" class="paste">
      <label for="paste-text">Settings, or the JSON export. They replace these settings; Undo paste brings these back.</label>
      <textarea id="paste-text" spellcheck="false" data-paste>${escape(text)}</textarea>
      <p class="row"><button type="button" data-action="use-paste">Use these settings</button><button type="button" class="link" data-action="paste-settings">Cancel</button><span class="paste-problem" role="alert">${escape(problem)}</span></p>
    </div>`;
}

/**
 * Pasted settings, checked.
 *
 * @param text  What was pasted.
 * @returns     The settings, or what's wrong with them.
 */
export function pasteSettings(text: string): Settings | string {
  if (!text.trim()) return "Paste the copied settings or the JSON export first.";
  try {
    return readSettings(JSON.parse(text), CONFIG);
  } catch (error) {
    if (error instanceof SettingsError) return error.message;
    return "That isn't JSON. Paste the copied settings or the JSON export as they are.";
  }
}

/**
 * The last section of Settings: what this site is, who made it, and under which license.
 *
 * @returns  HTML.
 */
export function about(): string {
  const build = new URLSearchParams(new URL(import.meta.url).search).get("v");
  const source = project.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");
  return `<section class="group" id="about">
      <h2>About</h2>
      <dl class="facts-list">
        <div><dt>Name</dt><dd>EK Colors</dd></div>
        <div><dt>Version</dt><dd><span class="mono">${project.version}</span>${build ? ` <span class="soft">• build <span class="mono">${build}</span></span>` : ""} <span class="soft">•</span> <a href="${source}/blob/main/CHANGELOG.md">Changelog</a></dd></div>
        <div><dt>Made by</dt><dd>${project.author}, 2026</dd></div>
        <div><dt>License</dt><dd>${project.license}</dd></div>
        <div><dt>Source</dt><dd><a href="${source}">${source.replace(/^https:\/\//, "")}</a></dd></div>
      </dl>
      <p class="soft">What it's built on, from the color model to the fonts, is listed under <a href="#references">References</a>.</p>
    </section>`;
}
