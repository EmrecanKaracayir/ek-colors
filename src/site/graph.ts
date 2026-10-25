/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< GRAPH >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the hue graphs share: hue across from 0° to 360° with padding on both sides that holds no   |
| data, the colors around the circle painted behind, the hue scale below, and one reference        |
| system's guides with their exact hues under it, chosen by a switch that previews on hover.       |
\*------------------------------------------------------------------------------------------------*/

import { SYSTEMS } from "../palette/references";
import { popButton, popSource } from "./popover";

/** A reference system's hue, drawn as a guide. */
export interface Guide {
  readonly system: string;
  readonly label: string;
  readonly hue: number;
  readonly unique: boolean;
}

/**
 * Hue runs from 0 to WIDTH; PAD on each side holds no data; LEFT and RIGHT are room for row labels
 * and for labels that reach past the padding.
 */
export const [WIDTH, PAD, LEFT, RIGHT] = [360, 12, 44, 14];

/** How far in from the graph's edges the band starts and ends, for lining things up with it. */
const share = (units: number) => `${((units / (WIDTH + 2 * PAD + LEFT + RIGHT)) * 100).toFixed(3)}%`;
export const INSETS = `--graph-inset:${share(LEFT)};--graph-inset-end:${share(RIGHT)}`;

/**
 * How a color difference looks (CAM16-UCS ΔE), against the palette's own scale: neighboring colors
 * are about 9 to 10 apart. Rough guides, not exact limits.
 *
 * @param difference  ΔE.
 * @returns           Words.
 */
export function visibility(difference: number): string {
  if (difference < 2) return "can't be seen side by side";
  if (difference < 5) return "visible side by side";
  if (difference < 10) return "a different shade";
  return "a different color";
}

/**
 * A difference as a share of the gap between neighboring colors.
 *
 * @param share  The difference divided by the gap.
 * @returns      E.g. "0.5 gap", "1.2 gaps", or "" when it's under 0.05.
 */
export function inGaps(share: number): string {
  const rounded = Math.round(share * 10) / 10;
  if (rounded < 0.1) return share >= 0.05 ? "0.1 gap" : "";
  return `${rounded.toFixed(1)} gap${rounded > 1 ? "s" : ""}`;
}

/**
 * How worrying it is that two neighbors sit closer than the even gap.
 *
 * @param closer  How much closer, as a share of the even gap.
 * @returns       Words.
 */
export function evenness(closer: number): string {
  if (closer < 0.1) return "fine";
  if (closer < 0.25) return "worth watching";
  return "getting confusable";
}

/**
 * A difference with its sign.
 *
 * @param x  The difference.
 * @returns  E.g. "+0.6", "−1.0", "0.0".
 */
export function signed(x: number): string {
  if (Math.abs(x) < 0.05) return "0.0";
  return `${x < 0 ? "−" : "+"}${Math.abs(x).toFixed(1)}`;
}

/**
 * How even a ring of neighbor gaps is: its closest and widest pair against the even gap, with how
 * worrying the closest is.
 *
 * @param ring   The gaps; gap i is between colors i and i + 1.
 * @param names  The colors in the ring's order.
 * @param even   The even gap.
 * @returns      Text.
 */
export function evenText(ring: readonly number[], names: readonly string[], even: number): string {
  if (!ring.length) return "";
  const [low, high] = [ring.indexOf(Math.min(...ring)), ring.indexOf(Math.max(...ring))];
  const pair = (i: number) => `${names[i] ?? ""}–${names[(i + 1) % names.length] ?? ""}`;
  const off = (d: number) => {
    const percent = Math.round(Math.abs(1 - d / even) * 100);
    return percent === 0 ? "even" : `${String(percent)}% ${d < even ? "under" : "over"} even`;
  };
  if (off(ring[low]!) === "even" && off(ring[high]!) === "even") return `Every pair is one even gap apart (${even.toFixed(1)} ΔE).`;
  return `Closest: ${pair(low)}, ${off(ring[low]!)} (${ring[low]!.toFixed(1)} ΔE): ${evenness(Math.max(0, 1 - ring[low]! / even))}. Widest: ${pair(high)}, ${off(ring[high]!)} (${ring[high]!.toFixed(1)} ΔE). Even gap: ${even.toFixed(1)}.`;
}

/* >----------------------------------------< Drawing >-----------------------------------------< */

/** Room above the data, and below it for the hue scale and the guides' labels and degrees. */
const [TOP, BOTTOM] = [6, 42];

/**
 * The view box: the data, its padding, room for row labels on the left and labels around.
 *
 * @param height  The data's height.
 * @returns       The viewBox attribute.
 */
export function viewBox(height: number): string {
  return `${String(-PAD - LEFT)} ${String(-TOP)} ${String(WIDTH + 2 * PAD + LEFT + RIGHT)} ${String(TOP + height + BOTTOM)}`;
}

/**
 * The colors around the circle behind the data, reaching into the padding.
 *
 * @param id      The gradient's id.
 * @param stops   Its stops.
 * @param height  The data's height.
 * @returns       SVG.
 */
export function band(id: string, stops: string, height: number): string {
  return `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" x2="${String(WIDTH)}">${stops}</linearGradient></defs>
    <rect x="${String(-PAD)}" y="0" width="${String(WIDTH + 2 * PAD)}" height="${String(height)}" rx="6" fill="url(#${id})" class="graph-band"></rect>`;
}

/**
 * Colors around the circle as gradient stops.
 *
 * @param colors  Hue and color pairs.
 * @returns       SVG stops.
 */
export function stops(colors: readonly { readonly hue: number; readonly color: string }[]): string {
  return colors.map((b) => `<stop offset="${(b.hue / 360).toFixed(4)}" stop-color="${b.color}"></stop>`).join("");
}

/**
 * The hue scale under the data, every 30°.
 *
 * @param height  The data's height.
 * @returns       SVG.
 */
export function hueScale(height: number): string {
  return Array.from({ length: 13 }, (_, k) => k * 30)
    .map((h) => `<text x="${String(h)}" y="${String(height + 13)}" class="axis" text-anchor="middle">${String(h)}°</text>`)
    .join("");
}

/**
 * One system's guides: a faint line through the data for each, and under the hue scale its label
 * with its exact hue.
 *
 * @param guides  The guides.
 * @param height  The data's height.
 * @returns       SVG.
 */
export function guideLayer(guides: readonly Guide[], height: number): string {
  return guides
    .map((g) => {
      const x = g.hue.toFixed(1);
      return `<line x1="${x}" x2="${x}" y1="0" y2="${String(height)}" class="guide${g.unique ? "" : " half"}"></line>
      <text x="${x}" y="${String(height + 28)}" class="axis guide-label" text-anchor="middle">${g.label}</text>
      <text x="${x}" y="${String(height + 37)}" class="axis guide-degree" text-anchor="middle">${g.hue.toFixed(0)}°</text>`;
    })
    .join("");
}

/**
 * What a system is and where its numbers come from, for the guides' popover.
 *
 * @param id  The system.
 * @returns   HTML.
 */
export function guideSource(id: string): string {
  const system = SYSTEMS.find((s) => s.id === id) ?? SYSTEMS[0]!;
  return `<h3>${system.name}</h3><p>${system.summary}</p><p class="pop-how">${system.source}</p><p class="pop-how">Solid lines are pure hues, dashed ones the hues between; each label shows its exact hue. Point at another system above to preview it; click it to keep it.</p>`;
}

/**
 * The guide switch above a graph: one system at a time; pointing at another shows its guides
 * until the pointer leaves.
 *
 * @param chosen  The chosen system.
 * @returns       HTML.
 */
export function guidePicker(chosen: string): string {
  const buttons = SYSTEMS.map(
    (s) => `<button type="button" data-guide-pick="${s.id}" aria-pressed="${String(s.id === chosen)}">${s.name}</button>`,
  );
  return `<div class="guide-row"><div class="segmented guide-picker" role="group" aria-label="Guides">${buttons.join("")}</div>${popButton("guide:chosen", "ⓘ", "About these guides", "guide-info")}</div>`;
}

/**
 * Makes every guide switch on the page respond: pointing previews a system on its own graph,
 * clicking chooses it for all of them.
 *
 * @param guidesOf  A system's guides.
 * @param chosen    The chosen system.
 * @param choose    Chooses a system.
 */
export function bindGuides(guidesOf: (id: string) => readonly Guide[], chosen: () => string, choose: (id: string) => void): void {
  const show = (editor: Element, id: string) => {
    const svg = editor.querySelector<SVGSVGElement>("svg[data-height]");
    const layer = editor.querySelector(".guide-layer");
    if (svg && layer) layer.innerHTML = guideLayer(guidesOf(id), Number(svg.dataset.height));
  };
  popSource("guide", () => guideSource(chosen()));
  const button = (target: EventTarget | null) => (target as Element | null)?.closest?.<HTMLElement>("[data-guide-pick]") ?? null;

  document.addEventListener("pointerover", (event) => {
    const b = button(event.target);
    const editor = b?.closest(".graph-editor");
    if (b && editor && event.pointerType === "mouse") show(editor, b.dataset.guidePick!);
  });
  document.addEventListener("pointerout", (event) => {
    const picker = (event.target as Element).closest?.(".guide-picker");
    const editor = picker?.closest(".graph-editor");
    if (!picker || !editor || picker.contains(event.relatedTarget as Node | null)) return;
    show(editor, chosen());
  });
  document.addEventListener("click", (event) => {
    const b = button(event.target);
    if (!b) return;
    choose(b.dataset.guidePick!);
    for (const editor of document.querySelectorAll(".graph-editor")) show(editor, chosen());
    for (const other of document.querySelectorAll<HTMLElement>("[data-guide-pick]"))
      other.setAttribute("aria-pressed", String(other.dataset.guidePick === chosen()));
  });
}

/* >-----------------------------------------< Input >------------------------------------------< */

/**
 * Where a pointer is in the data: its hue and height, or null in the padding.
 *
 * @param svg    The graph.
 * @param event  The pointer.
 * @returns      Hue (0–360) and height, or null.
 */
export function pointAt(svg: SVGSVGElement, event: { clientX: number; clientY: number }): { x: number; y: number } | null {
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
  return p.x < 0 || p.x > WIDTH ? null : { x: p.x, y: p.y };
}

/**
 * The hue under a pointer, held to the data while dragging into the padding.
 *
 * @param svg    The graph.
 * @param event  The pointer.
 * @returns      Hue (whole degrees, 0–359).
 */
export function hueAt(svg: SVGSVGElement, event: { clientX: number; clientY: number }): number {
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
  return Math.round(Math.min(WIDTH, Math.max(0, p.x))) % 360;
}
