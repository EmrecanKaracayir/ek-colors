/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< GRAPH >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the hue graphs share: hue across from 0° to 360° with padding on both sides that holds no   |
| data, the colors around the circle painted behind, the hue scale below, and the reference        |
| systems' guides, one label row per system above.                                                 |
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
 * Hue runs from 0 to WIDTH; PAD on each side holds no data; LEFT and RIGHT are room for row names
 * and for labels that reach past the padding.
 */
export const [WIDTH, PAD, LEFT, RIGHT] = [360, 12, 54, 14];

/** Height of one guide label row. */
const ROW = 12;

/* >----------------------------------------< Drawing >-----------------------------------------< */

/**
 * The view box: the data, its padding, room for row names on the left and labels around.
 *
 * @param top     Room above the data.
 * @param height  The data's height.
 * @returns       The viewBox attribute.
 */
export function viewBox(top: number, height: number): string {
  return `${String(-PAD - LEFT)} ${String(-top)} ${String(WIDTH + 2 * PAD + LEFT + RIGHT)} ${String(top + height + 20)}`;
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
 * The guides: a faint line through the data for each, and above it one label row per system,
 * named on the left.
 *
 * @param guides  The guides of the shown systems.
 * @param height  The data's height.
 * @returns       SVG and the room the label rows need above the data.
 */
export function guideLayer(guides: readonly Guide[], height: number): { svg: string; top: number } {
  const shown = SYSTEMS.filter((s) => guides.some((g) => g.system === s.id));
  const rowOf = (system: string) => shown.length - 1 - shown.findIndex((s) => s.id === system);
  const lines = guides.map((g) => {
    const y = -6 - rowOf(g.system) * ROW;
    const x = g.hue.toFixed(1);
    return `<line x1="${x}" x2="${x}" y1="0" y2="${String(height)}" class="guide guide-${g.system}${g.unique ? "" : " half"}"></line>
      <text x="${x}" y="${String(y)}" class="axis guide-label" text-anchor="middle">${g.label}</text>`;
  });
  const names = shown.map(
    (s) => `<text x="${String(-PAD - 6)}" y="${String(-6 - rowOf(s.id) * ROW)}" class="axis system-name" text-anchor="end">${s.name.split(" ")[0]!}</text>`,
  );
  return { svg: lines.join("") + names.join(""), top: ROW * Math.max(1, shown.length) + 4 };
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
