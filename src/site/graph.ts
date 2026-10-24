/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< GRAPH >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the hue graphs share: hue across from 0° to 360° with padding on both sides that holds no   |
| data, the colors around the circle painted behind, the hue scale below, and one reference        |
| system's guides with their exact hues under it, chosen by a switch that previews on hover.       |
\*------------------------------------------------------------------------------------------------*/

import { SYSTEMS } from "../palette/references";

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

/** How far in from the graph's left edge the band starts, for lining text up with it. */
export const INSET = `${((LEFT / (WIDTH + 2 * PAD + LEFT + RIGHT)) * 100).toFixed(3)}%`;

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
 * Where a system's numbers come from, under a graph.
 *
 * @param id  The system.
 * @returns   HTML.
 */
export function guideSource(id: string): string {
  const system = SYSTEMS.find((s) => s.id === id) ?? SYSTEMS[0]!;
  return `<strong>${system.name}.</strong> ${system.summary} <span class="source">${system.source}</span>`;
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
  return `<div class="segmented guide-picker" role="group" aria-label="Guides">${buttons.join("")}</div>`;
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
    const source = editor.querySelector(".guide-source");
    if (source) source.innerHTML = guideSource(id);
  };
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
