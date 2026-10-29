/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< FIELDS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Settings' fields: number fields bound to a setting, colorfulness shares with their zones, and    |
| reading and writing a setting by its path.                                                       |
\*------------------------------------------------------------------------------------------------*/

import { keptPicks } from "../../palette/bases";
import type { Settings } from "../../palette/settings";
import { NEUTRAL_BAND, withNeutrals } from "../../palette/solve";
import { flash } from "../dom";
import { baseTint } from "../pages/color";
import { $ } from "../parts";
import { popButton, refreshPopover } from "../popover";
import { save, state } from "../state";

/** Past this many hues, neighbors come too close to tell apart easily. */
const CLOSE_HUES = 16;

/** Past this many hues, solving can take a long time. */
const SLOW_HUES = 32;

/**
 * What a count of hues costs, said under its field: amber once neighbors come too close, red once
 * solving can take a long time.
 *
 * @param hues  How many hues.
 * @returns     HTML, or nothing.
 */
export function huesNote(hues: number): string {
  const notes = [
    hues > CLOSE_HUES ? `<p class="field-note">With more than ${String(CLOSE_HUES)} hues, neighbors come too close to tell apart easily.</p>` : "",
    hues > SLOW_HUES ? `<p class="field-note unmet">With more than ${String(SLOW_HUES)} hues, solving can take a long time, longer on phones.</p>` : "",
  ];
  return notes.join("");
}

/**
 * A number control bound to a setting.
 *
 * @param path   The setting, e.g. "colorfulness" or "rooms.dark.lux".
 * @param title  Its label.
 * @param range  Min, max and step.
 * @param range.0  Minimum.
 * @param range.1  Maximum.
 * @param range.2  Step.
 * @param options            How it's shown.
 * @param options.slider     Whether to show a slider too.
 * @param options.percent    Whether a fraction is shown as a percentage; the range stays a fraction.
 * @param options.sliderMax  The slider's own maximum, when it covers less than the field takes.
 * @param options.band       HTML drawn under the slider, such as the zones.
 * @param options.after      HTML after the field, on its own row.
 * @param options.decimals   How many decimals the values keep.
 * @returns                  HTML.
 */
export function numberField(
  path: string,
  title: string,
  [min, max, step]: readonly [number, number, number],
  { slider = false, percent = false, sliderMax, band, after = "", decimals = 6 }: { slider?: boolean; percent?: boolean; sliderMax?: number; band?: string; after?: string; decimals?: number } = {},
): string {
  const scale = percent ? 100 : 1;
  const shown = (x: number) => String(Math.round(x * scale * 10 ** decimals) / 10 ** decimals);
  const id = `set-${path.replaceAll(".", "-")}`;
  const common = `data-set="${path}"${percent ? ` data-scale="${String(scale)}"` : ""} min="${shown(min)}" value="${shown(Number(read(path) ?? 0))}"`;
  const bound = `${common}${Number.isFinite(max) ? ` max="${shown(max)}"` : ""} step="${shown(step)}"`;
  // A slider with a max of its own moves freely over its range; the field takes any value.
  const sliding = sliderMax === undefined ? bound : `${common} max="${shown(sliderMax)}" step="any"`;
  const field = `<input id="${id}" type="number" ${bound}${percent ? ` aria-label="${title}, percent"` : ""}>`;
  return `<label class="field${after ? " with-after" : ""}" for="${id}"><span>${title}</span>
    ${slider ? (band === undefined ? `<input type="range" ${sliding} aria-label="${title}">` : `<span class="slider-cell"><input type="range" ${sliding} aria-label="${title}">${band}</span>`) : ""}
    ${percent ? `<span class="with-unit">${field}<span aria-hidden="true">%</span></span>` : field}${after}
  </label>`;
}

/**
 * A color's share field: a slider over 0–100% and an exact field that takes any share, to a tenth
 * of a percent, with the colorfulness it gives and where the band, M 4–8, falls.
 *
 * @param path   The setting, e.g. "customColors.0.share".
 * @param title  Its label.
 * @returns      HTML.
 */
export function shareField(path: string, title: string): string {
  const { band, readout } = shareInfo(path);
  return numberField(path, title, [0, Infinity, 0.001], { slider: true, percent: true, sliderMax: 1, band, after: readout, decimals: 1 });
}

/** Where a color's colorfulness puts it, the same for custom and neutral colors. */
export const SHARE_ZONES = [
  { name: "Gray", range: `under M ${String(NEUTRAL_BAND[0])}`, note: "Next to Gray, the tint is hard to see: it reads as gray." },
  { name: "Neutral", range: `M ${String(NEUTRAL_BAND[0])} to ${String(NEUTRAL_BAND[1])}`, note: "The tint shows next to Gray, yet it's still a gray, one in its hue." },
  { name: "Color", range: `over M ${String(NEUTRAL_BAND[1])}`, note: "Past a tinted gray: it reads as a color of its hue." },
] as const;

/**
 * The zone a colorfulness falls in.
 *
 * @param m  CAM16 M.
 * @returns  Its index in SHARE_ZONES.
 */
export function shareZone(m: number): 0 | 1 | 2 {
  return m < NEUTRAL_BAND[0] ? 0 : m <= NEUTRAL_BAND[1] ? 1 : 2;
}

/**
 * A share on a bar of the zones, in the slider's own proportions, with a mark where it falls, like
 * the Bend meter. A zone past the slider's end isn't drawn.
 *
 * @param share  The share, 0 to 1 on the slider.
 * @param of     The colorfulness the share is of, M.
 * @returns      HTML.
 */
export function shareMeter(share: number, of: number): string {
  const edges = [0, ...NEUTRAL_BAND.map((e) => Math.min(e / of, 1)), 1].map((e) => e * 100);
  const shown = SHARE_ZONES.map((z, i) => ({ z, i, width: edges[i + 1]! - edges[i]! })).filter((x) => x.width > 0);
  const parts = shown.map(({ i, width }) => `<span class="zone-${String(i)}" style="flex-basis:${width.toFixed(2)}%"></span>`).join("");
  // A zone too narrow for its name goes unnamed; the zones are listed under the meter anyway.
  const names = shown
    .filter(({ width }) => width >= 14)
    .map(({ z, i }) => `<span style="left:${((edges[i]! + edges[i + 1]!) / 2).toFixed(2)}%">${z.name}</span>`)
    .join("");
  const m = share * of;
  return `<span class="bend-meter large share-meter" role="img" aria-label="M ${m.toFixed(1)}: ${SHARE_ZONES[shareZone(m)].name}"><span class="meter-zones">${parts}</span><span class="meter-mark" style="left:${(Math.min(share, 1) * 100).toFixed(2)}%"></span><span class="meter-names">${names}</span></span>`;
}

/**
 * What a share gives: its colorfulness and the zone it's in, and under the slider, the zones.
 * A custom color's share is of the palette's colorfulness; a neutral color's, of the mode's base.
 *
 * @param path  The share's setting.
 * @returns     The zones' bar, for under the slider, and the readout, for under the field; HTML.
 */
function shareInfo(path: string): { band: string; readout: string } {
  const share = Number(read(path) ?? 0);
  const neutral = path.startsWith("neutralColors.");
  const of = neutral ? baseTint(state.mode) : state.settings.colorfulness;
  if (of <= 0)
    return { band: "", readout: `<span class="share-m soft" data-readout="${path}">The ${state.mode} base is gray or nearly, so this is Gray here.</span>` };
  const m = share * of;
  // The zones as shares of this slider, each from where its limit falls; one past the slider's end
  // isn't drawn.
  const edges = [0, ...NEUTRAL_BAND.map((e) => e / of), Infinity];
  const segments = SHARE_ZONES.map((_, i) => {
    const [from, to] = [edges[i]!, Math.min(edges[i + 1]!, 1)];
    if (from >= to) return "";
    const ends = `${i === 0 ? " start" : ""}${edges[i + 1]! >= 1 ? " end" : ""}`;
    return `<span class="zone-${String(i)}${ends}" style="--from:${from.toFixed(4)};--to:${to.toFixed(4)}"></span>`;
  });
  const band = `<span class="share-zones" aria-hidden="true">${segments.join("")}</span>`;
  // At 0 it's Gray itself, and a neutral color past the range has stopped being one: both amber.
  const same = share === 0;
  const zone = SHARE_ZONES[shareZone(m)];
  const warn = same || (neutral && zone.name === "Color");
  const text = `M ${m.toFixed(1)} • ${same ? "Exactly Gray" : zone.name}`;
  return { band, readout: `<span class="share-m soft${warn ? " tint-strong" : ""}" data-readout="${path}">${popButton(`share:${path}`, text, `${text}: what it means`, "metric")}</span>` };
}

/**
 * Brings every share's colorfulness and band up to date, after a share, the colorfulness, a base or
 * the mode changes.
 */
export function updateShares(): void {
  for (const field of document.querySelectorAll<HTMLElement>(".field.with-after")) {
    const path = field.querySelector<HTMLInputElement>("[data-set]")?.dataset.set;
    if (!path?.endsWith(".share")) continue;
    field.querySelectorAll(".share-zones, .share-m").forEach((el) => el.remove());
    const { band, readout } = shareInfo(path);
    field.querySelector(".slider-cell")?.insertAdjacentHTML("beforeend", band);
    field.insertAdjacentHTML("beforeend", readout);
  }
  refreshPopover("share");
}

/**
 * A setting by its path.
 *
 * @param path  E.g. "rooms.dark.lux".
 * @returns     Its value.
 */
export function read(path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], state.settings);
}

/**
 * Changes a setting by its path.
 *
 * @param path   E.g. "rooms.dark.lux".
 * @param value  The new value.
 */
export function write(path: string, value: unknown): void {
  const next = structuredClone(state.settings) as unknown as Record<string, unknown>;
  const keys = path.split(".");
  let o = next;
  // A number in the path is an index into a list; a missing step is made as a list or an object to match.
  keys.slice(0, -1).forEach((k, i) => (o = (o[k] ??= /^\d+$/.test(keys[i + 1]!) ? [] : {}) as Record<string, unknown>));
  o[keys.at(-1)!] = value;
  const kept = keptPicks(withNeutrals(next as unknown as Settings));
  state.settings = kept.settings;
  if (kept.dropped.length) {
    const what = kept.dropped.join(" and ");
    flash($("#copied"), `${what.charAt(0).toUpperCase()}${what.slice(1)} no longer matched its base, so it's the closest color again`);
  }
  // A change after a paste keeps it: there's nothing left to undo.
  if (state.undo) {
    state.undo = null;
    document.querySelector('[data-action="undo-paste"]')?.remove();
  }
  save();
}
