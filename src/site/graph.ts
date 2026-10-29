/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< GRAPH >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the hue graphs share: hue across from 0° to 360° with padding on both sides that holds no   |
| data, the colors around the circle painted behind, the hue scale below, and one reference        |
| system's guides with their exact hues under it, chosen by a switch that previews on hover.       |
\*------------------------------------------------------------------------------------------------*/

import { JUST_VISIBLE } from "../palette/model";
import { type Guide, system, SYSTEMS } from "../palette/references";
import { popButton, popSource } from "./popover";

/**
 * Hue runs from 0 to WIDTH; PAD on each side holds no data; LEFT and RIGHT are room for row labels
 * and for labels that reach past the padding.
 */
const [PAD, LEFT, RIGHT] = [12, 44, 14];
export const WIDTH = 360;

/** How far in from the graph's edges the band starts and ends, for lining things up with it. */
const share = (units: number) => `${((units / (WIDTH + 2 * PAD + LEFT + RIGHT)) * 100).toFixed(3)}%`;
export const INSETS = `--graph-inset:${share(LEFT)};--graph-inset-end:${share(RIGHT)}`;

/** The smallest difference careful observers notice under ideal conditions, ΔE: half a just-visible step. */
export const BARELY_VISIBLE = JUST_VISIBLE / 2;

/**
 * How a color difference looks (CAM16-UCS ΔE), against the palette's own scale, the gap between
 * neighbors: half of it is a different shade, all of it a different color. Rough guides, not exact
 * limits.
 *
 * @param difference  ΔE.
 * @param gap         The palette's even gap between neighbors, ΔE.
 * @returns           Words.
 */
export function visibility(difference: number, gap: number): string {
  if (difference < JUST_VISIBLE) return "can't be seen side by side";
  if (difference < gap / 2) return "visible side by side";
  if (difference < gap) return "a different shade";
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
 * Where Even's words change, as percentages of the even gap: up to a barely visible difference is
 * fine, up to a just-visible one worth watching.
 *
 * @param gap  The even gap, ΔE.
 * @returns    The two limits, %.
 */
export function evenLimits(gap: number): [number, number] {
  return [Math.round((BARELY_VISIBLE / gap) * 100), Math.round((JUST_VISIBLE / gap) * 100)];
}

/**
 * How worrying it is that two neighbors sit closer than the even gap: fine while what they lost is
 * barely visible, worth watching up to a just-visible step.
 *
 * @param closer  How much closer, as a share of the even gap.
 * @param gap     The even gap, ΔE.
 * @returns       Words.
 */
export function evenness(closer: number, gap: number): string {
  if (closer * gap < BARELY_VISIBLE) return "fine";
  if (closer * gap < JUST_VISIBLE) return "worth watching";
  return "getting confusable";
}

/**
 * Text someone typed, safe to put in a page: in its text or in an attribute.
 *
 * @param text  E.g. a custom color's name.
 * @returns     The text with &, <, >, " and ' written as entities.
 */
export function escape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
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
 * A whole number with its sign, for an axis of amounts added or taken away.
 *
 * @param x  The number.
 * @returns  E.g. "+8", "−8", "0".
 */
export function signedWhole(x: number): string {
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${String(Math.abs(x))}`;
}

/**
 * A gap between neighbors against the even gap.
 *
 * @param gap   The gap.
 * @param even  The even gap.
 * @returns     E.g. "8% under even", "9% over even", or "even".
 */
export function againstEven(gap: number, even: number): string {
  const percent = Math.round(Math.abs(1 - gap / even) * 100);
  return percent === 0 ? "even" : `${String(percent)}% ${gap < even ? "under" : "over"} even`;
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
  const off = (d: number) => againstEven(d, even);
  if (off(ring[low]!) === "even" && off(ring[high]!) === "even") return `Every pair is one even gap apart (${even.toFixed(1)} ΔE).`;
  return `Closest: ${pair(low)}, ${off(ring[low]!)} (${ring[low]!.toFixed(1)} ΔE): ${evenness(Math.max(0, 1 - ring[low]! / even), even)}. Widest: ${pair(high)}, ${off(ring[high]!)} (${ring[high]!.toFixed(1)} ΔE). Even gap: ${even.toFixed(1)}.`;
}

/** A zone of Bend: its name and what a palette in it is like. */
interface Zone {
  readonly upTo: number;
  readonly name: string;
  readonly note: string;
}

/**
 * How far a palette bends from the nearest uniform one, in zones, each up to a limit in gaps. The
 * first two are differences anyone could see, so they're in ΔE and take the palette's own gap: a
 * barely visible difference and a just-visible one. The others are shares of the gap itself: half
 * of it, a different shade, and all of it, a different color.
 *
 * @param gap  The palette's even gap between neighbors, ΔE.
 * @returns    The zones, in order.
 */
export function zones(gap: number): readonly Zone[] {
  const [uniform, tuned] = [BARELY_VISIBLE / gap, JUST_VISIBLE / gap].map((g) => Math.min(round(g), 0.5));
  return [
    { upTo: uniform!, name: "Uniform", note: "No difference from the uniform palette anyone could see, even side by side." },
    { upTo: tuned!, name: "Tuned", note: "A typical color differs by about a just-visible step side by side: still the uniform palette, adjusted." },
    { upTo: 0.5, name: "Reshaped", note: "Colors differ clearly side by side: deliberate design choices on top of the uniform palette." },
    { upTo: 1, name: "Departed", note: "A typical color is a different shade of its uniform one; the uniformity no longer quite holds." },
    { upTo: Infinity, name: "Distinct", note: "Colors moved more than a whole gap: a palette of its own, not a tuned uniform one." },
  ];
}

/** A limit as the zones show it, to two decimals. */
const round = (x: number) => Math.round(x * 100) / 100;

/**
 * The zone a bend falls in.
 *
 * @param bend  Gaps.
 * @param gap   The palette's even gap between neighbors, ΔE.
 * @returns     The zone.
 */
export function zone(bend: number, gap: number): Zone {
  const all = zones(gap);
  return all.find((z) => bend < z.upTo) ?? all[all.length - 1]!;
}

/** Where the meter puts a bend: a square-root scale up to 1.5 gaps, so the small zones get room. */
const along = (bend: number) => Math.sqrt(Math.min(bend, 1.5) / 1.5) * 100;

/**
 * A bend on a bar of its zones, with a mark where it falls; with no bend yet, the bar alone.
 *
 * @param bend   Gaps, or null before there's one.
 * @param gap    The palette's even gap between neighbors, ΔE.
 * @param large  Whether it's the large one, with the zones named under it.
 * @returns      HTML.
 */
export function bendMeter(bend: number | null, gap: number, large = false): string {
  const all = zones(gap);
  const edges = [0, ...all.map((z) => along(z.upTo))];
  const parts = all.map((_, i) => `<span style="flex-basis:${(edges[i + 1]! - edges[i]!).toFixed(2)}%"></span>`).join("");
  const names = large
    ? `<span class="meter-names">${all.map((z, i) => `<span style="left:${((edges[i]! + edges[i + 1]!) / 2).toFixed(2)}%">${z.name}</span>`).join("")}</span>`
    : "";
  if (bend === null) return `<span class="bend-meter${large ? " large" : ""}" aria-hidden="true"><span class="meter-zones">${parts}</span>${names}</span>`;
  return `<span class="bend-meter${large ? " large" : ""}" role="img" aria-label="Bend ${bend.toFixed(2)} gap: ${zone(bend, gap).name}"><span class="meter-zones">${parts}</span><span class="meter-mark" style="left:${along(bend).toFixed(2)}%"></span>${names}</span>`;
}

/**
 * The zones as a table, with where their limits come from.
 *
 * @param gap  The palette's even gap between neighbors, ΔE.
 * @returns    HTML.
 */
export function zoneTable(gap: number): string {
  const all = zones(gap);
  const rows = all.map((z, i) => {
    const from = i === 0 ? "under" : `${String(all[i - 1]!.upTo)} to`;
    return `<div><dt>${z.name}</dt><dd><span class="mono">${z.upTo === Infinity ? `over ${String(all[i - 1]!.upTo)}` : `${from} ${String(z.upTo)}`}</span> ${z.note}</dd></div>`;
  });
  return `<dl class="pop-facts zones">${rows.join("")}</dl>${thresholds(gap)}`;
}

/**
 * Where the zones' and evenness limits come from, in this palette's own gap.
 *
 * @param gap  The palette's even gap between neighbors, ΔE.
 * @returns    HTML.
 */
export function thresholds(gap: number): string {
  const [uniform, tuned] = zones(gap);
  const [fine, watch] = evenLimits(gap);
  return `<details class="pop-sources"><summary>Where these thresholds come from</summary>
  <p>ΔE (CAM16-UCS) is built so that equal numbers look equally different. About ${String(BARELY_VISIBLE)} is the smallest difference careful observers notice under ideal conditions; about ${String(JUST_VISIBLE)} is what most people notice with two colors side by side on a screen, which is also where color tolerances in print and manufacturing usually sit (1 to 3). This palette's own gap between neighbors, ${gap.toFixed(1)} ΔE on the identity tier, is what it treats as a different color; it changes with the number of hues, the colorfulness and the bases.</p>
  <p>The zones put Bend on that scale, in gaps: under ${String(uniform!.upTo)} (${String(BARELY_VISIBLE)} ΔE here) nothing is visible; up to ${String(tuned!.upTo)} (${String(JUST_VISIBLE)} ΔE) differences are around the visible step; 0.5 is half the way to a neighbor, a different shade; 1 is a whole gap, a different color. Evenness uses the same reasoning: ${String(fine)}% of the gap is ${String(BARELY_VISIBLE)} ΔE, hard to notice; ${String(watch)}% is ${String(JUST_VISIBLE)} ΔE, a visible imbalance between pairs of neighbors.</p>
  <p>The ΔE figures come from color science; the zone limits are judgment built on them, not results of a study. Eyes and screens differ.</p></details>`;
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
    .map((h) => `<text x="${String(h)}" y="${String(height + 13)}" class="axis${h % 90 ? " minor" : ""}" text-anchor="middle">${String(h)}°</text>`)
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
      <text x="${x}" y="${String(height + 28)}" class="axis guide-label${g.unique ? "" : " half"}" text-anchor="middle">${g.label}</text>
      <text x="${x}" y="${String(height + 37)}" class="axis guide-degree" text-anchor="middle">${g.hue.toFixed(0)}°</text>`;
    })
    .join("");
}

/** The hue circle's radius in its drawing space, where colorfulness 60 sits. */
export const CIRCLE = 150;

/**
 * One system's guides on the hue circle: a spoke for each, and past its end the label with its
 * exact hue on the circle's side of it.
 *
 * @param guides  The guides.
 * @returns       SVG.
 */
export function circleGuides(guides: readonly Guide[]): string {
  const at = (hue: number, r: number) => [r * Math.cos((hue * Math.PI) / 180), -r * Math.sin((hue * Math.PI) / 180)] as const;
  return guides
    .map((g) => {
      const [x, y] = at(g.hue, CIRCLE + 6);
      const [lx, ly] = at(g.hue, CIRCLE + 28);
      // The degree sits on the circle's side of the name: below it in the top half, above in the bottom.
      const dy = ly + (ly < 0 ? 12 : -12);
      return `<line x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="spoke${g.unique ? "" : " half"}"></line>
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="axis" text-anchor="middle" dominant-baseline="middle">${g.label}</text>
      <text x="${lx.toFixed(1)}" y="${dy.toFixed(1)}" class="axis guide-degree" text-anchor="middle" dominant-baseline="middle">${g.hue.toFixed(0)}°</text>`;
    })
    .join("");
}

/**
 * What a system is and where its numbers come from, for the guides' popover.
 *
 * @param id  The system.
 * @returns   HTML.
 */
function guideSource(id: string): string {
  const chosen = system(id);
  return `<h3>${chosen.name}</h3><p>${chosen.summary}</p><p class="pop-how">${chosen.source}</p><p class="pop-how">Solid lines are pure hues, dashed ones the hues between; each label shows its exact hue. Point at another system above to preview it; click it to keep it.</p>`;
}

/**
 * The guide switch above a graph: one system at a time; pointing at another shows its guides
 * until the pointer leaves.
 *
 * @param chosen  The chosen system.
 * @param where   Which graph it's above, so each one's ⓘ opens its own popover.
 * @returns       HTML.
 */
export function guidePicker(chosen: string, where: string): string {
  const buttons = SYSTEMS.map(
    (s) => `<button type="button" data-guide-pick="${s.id}" aria-pressed="${String(s.id === chosen)}">${s.name}</button>`,
  );
  return `<div class="guide-row"><div class="segmented guide-picker" role="group" aria-label="Guides">${buttons.join("")}</div>${popButton(`guide:${where}`, "ⓘ", "About these guides", "guide-info")}</div>`;
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
  // A guided graph is straight (hue across) or round (the hue circle); each draws guides its way.
  const show = (editor: Element, id: string) => {
    const layer = editor.querySelector(".guide-layer");
    if (!layer) return;
    if ((editor as HTMLElement).dataset.guides === "circle") return void (layer.innerHTML = circleGuides(guidesOf(id)));
    const svg = editor.querySelector<SVGSVGElement>("svg[data-height]");
    if (svg) layer.innerHTML = guideLayer(guidesOf(id), Number(svg.dataset.height));
  };
  popSource("guide", () => guideSource(chosen()));
  const button = (target: EventTarget | null) => (target as Element | null)?.closest?.<HTMLElement>("[data-guide-pick]") ?? null;

  document.addEventListener("pointerover", (event) => {
    const b = button(event.target);
    const editor = b?.closest(".guided");
    if (b && editor && event.pointerType === "mouse") show(editor, b.dataset.guidePick!);
  });
  document.addEventListener("pointerout", (event) => {
    const picker = (event.target as Element).closest?.(".guide-picker");
    const editor = picker?.closest(".guided");
    if (!picker || !editor || picker.contains(event.relatedTarget as Node | null)) return;
    show(editor, chosen());
  });
  document.addEventListener("click", (event) => {
    const b = button(event.target);
    if (!b) return;
    choose(b.dataset.guidePick!);
    for (const editor of document.querySelectorAll(".guided")) show(editor, chosen());
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
