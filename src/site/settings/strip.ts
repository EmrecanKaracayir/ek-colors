/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< STRIP >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Settings' strip: each step of the palette as a row, Uniform, Turned, +H and +M, a row shown      |
| alone on hover or pinned, and the strip sticking under the bar.                                  |
\*------------------------------------------------------------------------------------------------*/

import { parts } from "../../palette/model";
import type { Mode } from "../../palette/settings";
import { type Color, type ModePalette, type Swatch, boost, identityOf } from "../../palette/solve";
import { inUse, model, onScreen } from "../derived";
import { inGaps } from "../graph";
import { $, label } from "../parts";
import { popButton } from "../popover";
import { state } from "../state";
import { askVariants, plain, turn, turned, uncurved, upToDate } from "../variants";
import { metrics, turnText } from "./metrics";

/** The rows of the strip: each step of the palette, added one at a time. */
export const STEPS = [
  { name: "Uniform", title: "Uniform: these settings with nothing placed and colorfulness the same for every hue" },
  { name: "Turned", title: "Turned: the uniform lineup turned to best match the placed hues, still uniform" },
  { name: "+H", title: "+H: with colors placed by hand" },
  { name: "+M", title: "+M: with colorfulness per hue too, the palette in use" },
] as const;

/** The even gap last measured per mode, kept while the uniform lineup solves again. */
const evenGaps = new Map<Mode, number>();

/**
 * The palette's own scale: the mean gap between neighbors in the uniform lineup, on the identity
 * tier. While the lineup solves, the last one measured; before any, 9 ΔE.
 *
 * @param mode  The mode.
 * @returns     ΔE.
 */
export function evenGap(mode: Mode): number {
  const ring = plain()?.[mode].ring[identityOf(onScreen(), mode)];
  if (ring?.length) evenGaps.set(mode, ring.reduce((x, y) => x + y, 0) / ring.length);
  return evenGaps.get(mode) ?? 9;
}

/** The last solve of each step, kept until the next arrives so nothing jumps. */
const lastSteps = new Map<string, readonly Color[]>();

/** One color across the strip's rows: Uniform, Turned, +H, +M. */
export interface Change {
  readonly key: string;
  readonly name: string;
  readonly color: string;

  /** Per row, ΔE from its turned version: how far that row bends it. */
  readonly bend: readonly [number, number, number, number];

  /** ΔE from the uniform lineup to the palette in use, turn included. */
  readonly moved: number;

  /** Per row, its colorfulness against the row's target, as a share (0.25 is 25% over). */
  readonly colorful: readonly [number, number, number, number];

  /** Per row, what its bend is made of: hue, colorfulness and lightness shares. */
  readonly splits: readonly [Split, Split, Split, Split];

  /** The edits behind it: degrees placed, colorfulness added. */
  readonly turned: number;
  readonly added: number;
}

/** One row's neighbor gaps, in ring order: gap i is between keys i and i + 1. */
interface Ring {
  readonly gaps: readonly number[];
  readonly keys: readonly string[];
}

/** A difference's hue, colorfulness and lightness shares. */
export type Split = ReturnType<typeof parts>;

/** Rows: the uniform lineup, turned, with placed hues, with colorfulness per hue. */
export type Row = 0 | 1 | 2 | 3;

/** What the strip shows, kept for its column and popovers. */
export let changes: {
  readonly tier: number;
  readonly gap: number;
  readonly turn: number;
  readonly colors: readonly Change[];
  readonly rings: readonly [Ring, Ring, Ring, Ring];
  readonly targets: readonly [number, number, number, number];
} = { tier: 0, gap: 9, turn: 0, colors: [], rings: [0, 1, 2, 3].map(() => ({ gaps: [], keys: [] })) as unknown as [Ring, Ring, Ring, Ring], targets: [0, 0, 0, 0] };

/** The color the column shows instead of the whole palette, while a swatch is pointed at. */
export let focusKey: string | null = null;

/**
 * Draws a mode's palette row by row, each color as a swatch with one band per row, so they touch.
 * Under each, how far it bends from the turned lineup, in gaps; beside them, per row, how bent the
 * palette is, how even and how equally colorful. Each opens its details.
 *
 * @param el    Where to draw.
 * @param mode  The mode.
 */
function drawComparison(el: Element, mode: Mode): void {
  const tier = identityOf(onScreen(), mode);
  // Always the palette as set, whatever the H and M switches show: the strip is what they compare.
  const now = inUse()?.[mode].colors ?? [];
  const palettes = [plain()?.[mode], uncurved()?.[mode], inUse()?.[mode]];
  const steps = palettes.slice(0, 2).map((palette, i) => {
    if (palette) lastSteps.set(`${mode}|${String(i)}`, palette.colors);
    return lastSteps.get(`${mode}|${String(i)}`) ?? now;
  });
  const gap = evenGap(mode);
  const twist = turned(mode);
  const angle = turn(mode) ?? 0;
  const target = (p: ModePalette | undefined) => p?.targets[tier] ?? state.settings.colorfulness;
  const targets: [number, number, number, number] = [target(palettes[0]), target(palettes[0]), target(palettes[1]), target(palettes[2])];
  const ringOf = (p: ModePalette | undefined): Ring => {
    const gaps = p?.ring[tier] ?? [];
    return { gaps, keys: (p?.colors ?? []).slice(0, gaps.length).map((c) => c.key) };
  };
  const evenRing = ringOf(palettes[0]);
  const rings: [Ring, Ring, Ring, Ring] = [evenRing, twist?.ring ? { gaps: twist.ring, keys: twist.keys ?? evenRing.keys } : evenRing, ringOf(palettes[1]), ringOf(palettes[2])];
  const colors: Change[] = [];
  const items = now.map((c) => {
    if (c.custom) return "";
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
      splits: [first, turnedOne, hued, last].map((sw) => parts(model().cam(mode, turnedOne.color), model().cam(mode, sw.color))) as unknown as [Split, Split, Split, Split],
      turned: Math.round((((hued.hue - turnedOne.hue + 540) % 360) - 180)),
      added: Math.round(boost(state.settings, mode, last.hue)),
    };
    colors.push(change);
    const fills = swatches.map((sw, i) => `<span class="fill" data-row="${String(i)}" style="--f:${sw.color}"></span>`).join("");
    const rows = swatches.map((sw, i) => `--f${String(i)}:${sw.color}`).join(";");
    const amountText = inGaps(change.bend[3] / gap) || "0.0 gap";
    const amount = amountText.replace(/ gaps?$/, (unit) => `<span class="unit">${unit}</span>`);
    // "Hue" before a number can go when the row is crowded; the number stays, as "#3".
    const name = change.name.replace(/^Hue (?=\d)/, `<span class="hue-word">Hue </span><span class="hash">#</span>`);
    return `<span class="strip-item${change.bend[3] >= 2 ? " changed" : ""}" data-key="${c.key}" style="--c:${last.color};${rows}">
      ${fills}<span class="cover" aria-hidden="true"></span>${popButton(`change:${c.key}`, `<span class="name${name === change.name ? "" : " numbered"}">${name}</span><span class="sep" aria-hidden="true"> • </span><span class="amount">${amount}</span>`, `${change.name} ${amountText}: how it changed`, "strip-gap mono")}</span>`;
  });
  // While new results arrive, a strip that can't be drawn whole keeps what it showed, so it never
  // falls back to empty and moves what's below it.
  const whole = colors.length === now.filter((c) => !c.custom).length;
  // A palette with nothing on this tier is from older settings, even before the new solve starts.
  const current = now.length > 0 && now.every((c) => c.custom || c.tiers[tier]);
  if (!whole && (!upToDate() || !current) && el.querySelector(".strip-items")) return;
  changes = { tier, gap, turn: angle, colors, rings, targets };
  if (focusKey && !colors.some((c) => c.key === focusKey)) focusKey = null;
  // The turn's angle stays off the row's name, which would widen the names' column for one row.
  const names = STEPS.map((step, i) => {
    const turn = i === 1 ? turnText(angle) : "";
    return `<button type="button" data-row="${String(i)}" aria-pressed="${String(pinned === i)}" aria-label="${step.title}${turn ? `, ${turn}` : ""}"${turn ? ` title="${step.name} ${turn}"` : ""}>${step.name}</button>`;
  }).join("");
  // Drawn again, the row keeps where it was scrolled to.
  const scrolled = el.querySelector(".strip-items")?.scrollLeft ?? 0;
  el.innerHTML = `<span class="strip-labels">${names}</span><div class="strip-items">${colors.length ? items.join("") : `<span class="strip-solving">Solving…</span>`}</div><div class="strip-metrics mono">${metrics()}</div>`;
  const row = el.querySelector<HTMLElement>(".strip-items")!;
  row.scrollLeft = scrolled;
  fadeEdges(row);
  fitLabels(row);
  if (pinned !== null && !el.classList.contains("focused")) showRow(pinned);
}

/**
 * Shortens the strip's labels until every one fits its color's width: first without the word
 * "gap", then without the word "Hue" before a number. The whole row shortens together.
 *
 * @param row  The row.
 */
function fitLabels(row: HTMLElement): void {
  row.classList.remove("tight", "tighter");
  const crowded = () => [...row.querySelectorAll<HTMLElement>(".strip-gap")].some((b) => b.scrollWidth > b.clientWidth);
  if (crowded()) row.classList.add("tight");
  if (crowded()) row.classList.add("tighter");
}

/**
 * Marks which sides of the strip's row have more colors to scroll to, so those sides fade.
 *
 * @param row  The row.
 */
function fadeEdges(row: HTMLElement): void {
  const rest = row.scrollWidth - row.clientWidth - row.scrollLeft;
  row.classList.toggle("more-start", row.scrollLeft > 1);
  row.classList.toggle("more-end", rest > 1);
}

document.addEventListener(
  "scroll",
  (event) => {
    if (event.target instanceof HTMLElement && event.target.classList.contains("strip-items")) fadeEdges(event.target);
  },
  { capture: true, passive: true },
);
window.addEventListener("resize", () =>
  document.querySelectorAll<HTMLElement>(".strip-items").forEach((row) => {
    fadeEdges(row);
    fitLabels(row);
  }),
);

/**
 * Shows the column for one color, or for the whole palette.
 *
 * @param key  The color, or null.
 */
function showMetrics(key: string | null): void {
  if (key === focusKey) return;
  focusKey = key;
  const column = document.querySelector("#palette-strip .strip-metrics");
  if (column) column.innerHTML = metrics();
}

/** The strip row pinned by clicking its name, for comparing one step with another. */
let pinned: number | null = null;

/**
 * Shows one of the strip's rows alone, every swatch filled with it, or all three. The row stays set
 * while the cover fades out, so it fades in that row's colors.
 *
 * @param row  The row, or null for all three.
 */
function showRow(row: number | null): void {
  const strip = document.querySelector<HTMLElement>("#palette-strip");
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
  const strip = document.querySelector("#palette-strip");
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
  const strip = document.querySelector("#palette-strip");
  if (!strip?.contains(event.target as Node) || strip.contains(event.relatedTarget as Node | null)) return;
  clearTimeout(settling);
  clearTimeout(swatching);
  showRow(pinned);
  showMetrics(null);
});
// The keyboard gets the same: a color's numbers while its bend has the focus, the palette's after.
document.addEventListener("focusin", (event) => {
  const swatch = (event.target as Element).closest?.<HTMLElement>("#palette-strip .strip-item[data-key]");
  if (swatch) showMetrics(swatch.dataset.key ?? null);
});
document.addEventListener("focusout", (event) => {
  const strip = document.querySelector("#palette-strip");
  if (!strip?.contains(event.target as Node) || strip.contains(event.relatedTarget as Node | null)) return;
  showMetrics(null);
});

// Clicking a row's name pins it, clicking it again clears it; while a name has the focus, ↑ and ↓
// move the pin.
document.addEventListener("click", (event) => {
  const name = (event.target as Element).closest<HTMLElement>("#palette-strip .strip-labels [data-row]");
  if (!name) return;
  const row = Number(name.dataset.row);
  pinned = pinned === row ? null : row;
  showRow(pinned);
});
document.addEventListener("keydown", (event) => {
  if (pinned === null || !(event.key === "ArrowUp" || event.key === "ArrowDown")) return;
  if (!(event.target as Element).closest?.("#palette-strip .strip-labels")) return;
  event.preventDefault();
  pinned = Math.min(STEPS.length - 1, Math.max(0, pinned + (event.key === "ArrowUp" ? -1 : 1)));
  showRow(pinned);
  // Focus follows the pin, so the focus ring doesn't stay on the name clicked first.
  document.querySelector<HTMLElement>(`#palette-strip .strip-labels [data-row="${String(pinned)}"]`)?.focus({ preventScroll: true });
});

let dock: IntersectionObserver | null = null;
let barHeight = 0;

/**
 * How far down the bar sticks: below the band a phone's browser may keep at the top of the page.
 *
 * @returns  Pixels.
 */
const barTop = () => parseFloat(getComputedStyle($("header")).top) || 0;

/**
 * Marks the strip at the top of Settings as docked once it sticks under the bar, so it shows a
 * border, and thins on phones. Docked, it sits 1px up under the bar, so it's no longer wholly below
 * it. A margin makes up for the height it loses, so the page below doesn't jump.
 */
export function watchDock(): void {
  dock?.disconnect();
  const strip = document.querySelector("#palette-strip");
  if (!strip || state.view !== "tune") return;
  dock = new IntersectionObserver(
    ([entry]) => {
      const docked = entry!.intersectionRatio < 1 && entry!.boundingClientRect.top < entry!.rootBounds!.top;
      if (docked === strip.classList.contains("docked")) return;
      const before = strip.getBoundingClientRect().height;
      strip.classList.toggle("docked", docked);
      (strip as HTMLElement).style.marginBottom = docked ? `${String(before - strip.getBoundingClientRect().height)}px` : "";
      // Pinned on a phone, the row gets wider, so its fades and labels are measured again.
      const row = strip.querySelector<HTMLElement>(".strip-items");
      if (row) {
        fadeEdges(row);
        fitLabels(row);
      }
    },
    // The page's own viewport, not the outer page's when it's shown in a frame, which would ignore
    // the margin for the bar. The bar sticks below the band a phone's browser may keep at the top.
    { root: document, rootMargin: `${String(-(barTop() + barHeight))}px 0px 0px 0px`, threshold: 1 },
  );
  dock.observe(strip);
}

/**
 * Draws the strip, at the top of Settings and in How it works.
 */
export function updateStrip(): void {
  askVariants();
  const strip = document.querySelector("#palette-strip");
  if (strip) drawComparison(strip, state.mode);
}

// Settings' color strip sticks just below the bar, whose height changes as it wraps.
new ResizeObserver(([entry]) => {
  // The exact height, fractions included, so the strip meets the bar without a gap.
  const height = entry!.borderBoxSize[0]?.blockSize ?? (entry!.target as HTMLElement).offsetHeight;
  document.documentElement.style.setProperty("--header-height", `${String(height)}px`);
  barHeight = height;
  watchDock();
}).observe($("header"));
