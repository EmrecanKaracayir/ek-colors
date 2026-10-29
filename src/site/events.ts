/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< EVENTS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What clicks, typing and changes do: the bar's switches, Settings' actions and fields.            |
\*------------------------------------------------------------------------------------------------*/

import { CONFIG } from "../config";
import { baseIn, fits, home, isBaseColor, pickCheck } from "../palette/bases";
import { lightness } from "../palette/model";
import { anchorHue } from "../palette/references";
import { GAMUTS, GAMUT_NAMES, type Gamut, MODES, type Mode } from "../palette/settings";
import { NEUTRAL_START, withNeutrals } from "../palette/solve";
import { allowed, anchored, context, onScreen, syncAnchor } from "./derived";
import { announce, copyText, flash, markField } from "./dom";
import type { Format } from "./highlight";
import { baseTint } from "./pages/color";
import { $, copying, shownValue } from "./parts";
import { BASE_EXAMPLES, baseLabel, normalColor, setBase, updateBaseNote } from "./settings/base";
import { exportText, updateExport } from "./settings/export";
import { huesNote, updateShares, write } from "./settings/fields";
import { anyTinted, automaticName, hueNote, pasteSettings, updateTune } from "./settings/page";
import { later, render, status } from "./shell";
import { solve } from "./solver";
import { EDITS, MODE, type Variant, save, state } from "./state";

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
  if (mode) {
    state.mode = mode as Mode;
    try {
      localStorage.setItem(MODE, mode);
    } catch {
      // Storage can be blocked; the page works without it.
    }
  }
  if (variant) state.variant = variant as Variant;
  if (format) {
    // Only the export changes: its text and which format is pressed.
    state.format = format as Format;
    for (const b of document.querySelectorAll<HTMLElement>("[data-format]")) b.setAttribute("aria-pressed", String(b.dataset.format === format));
    return updateExport();
  }
  if (action === "reset") {
    state.settings = structuredClone(CONFIG);
    state.undo = null;
    save();
    solve();
  }
  if (action === "paste-settings") {
    // Opening it goes to the box; closing it goes back to the button.
    state.paste = { open: !state.paste.open, text: "", problem: "" };
    render();
    return $<HTMLElement>(state.paste.open ? "#paste-text" : '[data-action="paste-settings"]').focus();
  }
  if (action === "use-paste") {
    const pasted = pasteSettings(state.paste.text);
    if (typeof pasted === "string") state.paste = { ...state.paste, problem: pasted };
    else {
      state.undo = state.settings;
      state.settings = withNeutrals(pasted);
      state.paste = { open: false, text: "", problem: "" };
      save();
      solve();
      render();
      return flash($("#copied"), "Settings pasted");
    }
  }
  if (action === "undo-paste" && state.undo) {
    state.settings = state.undo;
    state.undo = null;
    save();
    solve();
    render();
    return flash($("#copied"), "Paste undone");
  }
  if (action === "copy") {
    // The plain text, not what's drawn: swatches and colors stay behind.
    copyText(exportText(), (copied) => {
      if (!copied) getSelection()?.selectAllChildren($("#export-text code"));
      flash($("#export-copied"), copied ? "Copied" : "Selected; copy it with the keyboard");
    });
    return;
  }
  if (action === "copy-value") {
    // The value reads "Copied" for a moment, marked done so its underline is solid, then shows itself
    // again; another click starts the moment over.
    const value = el.dataset.value!;
    copyText(value, (copied) => {
      el.textContent = copied ? "Copied" : "Copying isn't allowed here";
      el.dataset.done = "";
      announce(el.textContent);
      clearTimeout(copying.get(el));
      copying.set(
        el,
        window.setTimeout(() => {
          el.innerHTML = shownValue(value);
          delete el.dataset.done;
        }, 1500),
      );
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
  if (action === "add-custom") {
    const names = new Set(state.settings.customColors.map((e) => e.name));
    // The first free name: Custom, Custom 2, …
    let n = 1;
    const name = (k: number) => (k === 1 ? "Custom" : `Custom ${String(k)}`);
    while (names.has(name(n))) n++;
    write("customColors", [...state.settings.customColors, { name: name(n), hue: 0, share: 0.6 }]);
    solve();
  }
  if (action === "remove-custom") {
    write("customColors", state.settings.customColors.filter((_, i) => i !== Number(el.dataset.index)));
    solve();
  }
  if (action === "add-neutral") {
    const names = new Set(state.settings.neutralColors.map((n) => n.name));
    let n = 1;
    const name = (k: number) => (k === 1 ? "Neutral" : `Neutral ${String(k)}`);
    while (names.has(name(n))) n++;
    // It starts at M 8 on the more colorful tinted base, or all of a fainter tint.
    const strongest = Math.max(...MODES.map(baseTint));
    write("neutralColors", [...state.settings.neutralColors, { name: name(n), share: strongest > 0 ? Math.min(1, Math.floor((NEUTRAL_START / strongest) * 1000) / 1000) : 1 }]);
    solve();
  }
  if (action === "remove-neutral") {
    write("neutralColors", state.settings.neutralColors.filter((_, i) => i !== Number(el.dataset.index)));
    solve();
  }
  render();
});

/**
 * Whether a number field holds no number, or one outside its range, and marks it so with its
 * range. Values between its steps are fine: a drag can set any whole degree.
 *
 * @param el  The field.
 * @returns   True when its value should wait.
 */
function outOfRange(el: HTMLInputElement): boolean {
  const bad = el.value === "" || el.validity.badInput || el.validity.rangeUnderflow || el.validity.rangeOverflow;
  const unit = el.dataset.scale ? "%" : "";
  if (el.type === "number") markField(el, bad ? (el.max ? `From ${el.min}${unit} to ${el.max}${unit}` : `${el.min}${unit} or more`) : "");
  return bad;
}

document.addEventListener("input", (event) => {
  const el = event.target as HTMLInputElement;
  if (el.dataset.demo) return void later.how?.updateDemo(context(), el);
  // The name changes nothing solved: only what the palette is called, and the export's title.
  if (el.dataset.name !== undefined) {
    write("name", el.value.slice(0, 60));
    return updateExport();
  }
  // What's in the paste box is kept, so drawing Settings again doesn't lose it.
  if (el.dataset.paste !== undefined) {
    state.paste = { ...state.paste, text: el.value, problem: "" };
    $(".paste-problem").textContent = "";
    return;
  }
  if (el.dataset.tier) {
    const checked = [...document.querySelectorAll<HTMLInputElement>("[data-tier]")].filter((c) => c.checked).map((c) => Number(c.dataset.tier));
    if (!checked.length) return void (el.checked = true);
    write("tiers", checked);
    // A tier set by hand that's no longer solved gives the choice back to the palette.
    for (const m of MODES) {
      const set = state.settings.identityTier[m];
      if (set !== "auto" && !checked.includes(set)) write(`identityTier.${m}`, "auto");
    }
    // The identity choices list the tiers, so they're drawn again.
    render();
    solve(150);
    return;
  }
  if (el.dataset.anchor === "from") {
    // A system's yellow that would carry colors past placed ones is held back, as set by hand.
    const wanted = el.value === "hand" ? anchorHue(onScreen()) : anchorHue({ ...onScreen(), anchor: el.value });
    const hue = allowed(anchored(), wanted);
    write("anchor", el.value !== "hand" && Math.abs(hue - wanted) < 0.05 ? el.value : Math.round(hue * 10) / 10);
    syncAnchor();
    updateTune();
    solve();
    return;
  }
  if (el.hasAttribute("data-anchor-hue")) {
    if (outOfRange(el)) return;
    write("anchor", allowed(anchored(), Number(el.value)));
    syncAnchor();
    updateTune();
    solve(150);
    return;
  }
  const path = el.dataset.set;
  if (!path) return;
  if (path.startsWith("bases.")) {
    // A base is a color the tier on screen can show, lighter than the dark base in light mode and
    // darker than the light one in dark mode, as that tier shows them.
    const mode = path.split(".")[1] as Mode;
    const gamut = state.gamut;
    const color = normalColor(el.value);
    const other = baseIn(state.settings, mode === "light" ? "dark" : "light", gamut).written;
    const valid = isBaseColor(color) && fits(color, gamut);
    const ordered = valid && (mode === "light" ? lightness(color) > lightness(other) : lightness(color) < lightness(other));
    // On a tier that shows the base exactly, typing changes the base; on a narrower one it picks
    // the tier's color, which has to stay the same background.
    const ownTier = GAMUTS.indexOf(gamut) >= GAMUTS.indexOf(home(state.settings.bases[mode]));
    const check = ordered && !ownTier ? pickCheck(state.settings, mode, gamut, color) : null;
    markField(
      el,
      !valid ? `${GAMUT_NAMES[gamut]} screens take any CSS color they can show, like ${BASE_EXAMPLES[mode][gamut]}`
      : !ordered ? `${mode === "light" ? "Lighter" : "Darker"} than the ${mode === "light" ? "dark" : "light"} base, ${other}`
      : check && !check.same ? `That's a different color from the ${mode} base: ΔE ${check.off.toFixed(1)} from it, where the closest color is ΔE ${check.loss.toFixed(1)}.`
      : "",
      check && !check.same ? `<button type="button" class="link" data-base-use="${mode}">Use it as the base</button>` : "",
    );
    if (!ordered || (check && !check.same)) return;
    if (ownTier) setBase(mode, color);
    else write(`pickedBases.${gamut}.${mode}`, color);
    document.documentElement.style.setProperty(`--base-${mode}`, onScreen().bases[mode]);
    for (const m of MODES) document.querySelector(`#set-base-${m}`)?.closest(".field")?.querySelector("span")?.replaceChildren(document.createRange().createContextualFragment(baseLabel(m)));
    updateBaseNote()
  } else {
    // A value outside its field's range waits: it may be half typed.
    if (outOfRange(el)) return;
    // A share is kept to a tenth of a percent, however the slider lands.
    const exact = path.endsWith(".share") ? String(Math.round(Number(el.value) * 10) / 10) : el.value;
    write(path, exact === "auto" ? "auto" : Number(exact) / Number(el.dataset.scale ?? 1));
    for (const twin of document.querySelectorAll<HTMLInputElement>(`[data-set="${path}"]`)) if (twin !== el) twin.value = exact;
  }
  // A system's yellow is measured in the rooms, on the bases, so its hue can move with them; the
  // automatic identity tier is measured on the bases.
  if (path.startsWith("bases.") || path.startsWith("rooms.")) syncAnchor();
  if (path.startsWith("bases.")) for (const m of MODES) $(`#set-identity-${m} option[value="auto"]`).textContent = automaticName(m);
  // Neutral colors can be added once a base is tinted; on gray bases there are none.
  if (path.startsWith("bases.")) {
    $<HTMLElement>("#neutrals-untinted").hidden = anyTinted();
    $<HTMLButtonElement>('[data-action="add-neutral"]').disabled = !anyTinted();
    // Two gray bases have no neutral colors, so their blocks go with them.
    if (!state.settings.neutralColors.length) document.querySelectorAll("[data-neutral]").forEach((el) => el.remove());
  }
  if (path.startsWith("colorfulnessPerHue.")) updateTune();
  // A custom color's hue reads right away; its color, the strip and the export follow the solve.
  if (path.startsWith("customColors.")) for (const note of document.querySelectorAll<HTMLElement>("[data-hue-note]")) note.textContent = hueNote(Number(note.dataset.hueNote));
  if (path === "hues") $("#hues-note").innerHTML = huesNote(state.settings.hues);
  if (path.endsWith(".share") || path === "colorfulness" || path.startsWith("bases.")) updateShares();
  // Custom and neutral colors and the muted share sit on the hues already solved, so they solve at
  // once, even mid-drag; anything that moves the hues waits for the slider to rest.
  solve(path.startsWith("customColors.") || path.startsWith("neutralColors.") || path === "mutedShare" ? 0 : 150);
});

// The palette's name loses its outer spaces once it's done being typed.
document.addEventListener("change", (event) => {
  const el = event.target as HTMLInputElement;
  if (el.dataset.name === undefined || el.value === el.value.trim()) return;
  el.value = el.value.trim();
  write("name", el.value);
  updateExport();
});

// A neutral color's name, likewise, is taken when it's done being typed.
document.addEventListener("change", (event) => {
  const el = event.target as HTMLInputElement;
  if (el.dataset.neutralName === undefined) return;
  const i = Number(el.dataset.neutralName);
  el.value = el.value.trim() || (i === 0 ? "Neutral" : `Neutral ${String(i + 1)}`);
  write(`neutralColors.${String(i)}.name`, el.value);
  updateTune();
  solve();
});

// A custom color's name is taken when it's done being typed, so its key doesn't change on every letter.
document.addEventListener("change", (event) => {
  const el = event.target as HTMLInputElement;
  if (el.dataset.customName === undefined) return;
  const i = Number(el.dataset.customName);
  el.value = el.value.trim() || (i === 0 ? "Custom" : `Custom ${String(i + 1)}`);
  write(`customColors.${String(i)}.name`, el.value);
  updateTune();
  solve();
});
