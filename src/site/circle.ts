/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< CIRCLE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The hue circle: each color a dot at its hue and colorfulness, named on hover.                    |
\*------------------------------------------------------------------------------------------------*/

import { guides } from "../palette/references";
import { CIRCLE, circleGuides, guidePicker } from "./graph";
import { state } from "./state";

interface Dot {
  readonly hue: number;
  readonly m: number;
  readonly color: string;
  readonly hollow?: boolean;

  /** What the pointer shows on it, e.g. "Red" or "Red, muted". */
  readonly name: string;

  /** A custom color sits among the hues without being spaced, so it's drawn as a diamond to tell it apart. */
  readonly custom?: boolean;
}

/**
 * The hue circle: CAM16 hue around, colorfulness out from the center, with the chosen reference
 * system's hues as spokes (pure hues solid, the rest dashed) and its switch above.
 *
 * @param dots  The colors to place.
 * @returns     SVG.
 */
export function circle(dots: readonly Dot[]): string {
  const R = CIRCLE;
  // Rings every M 20, out to the most colorful dot.
  const max = Math.max(60, Math.ceil(Math.max(0, ...dots.map((d) => d.m)) / 20) * 20);
  const at = (hue: number, r: number) => {
    const a = (hue * Math.PI) / 180;
    return [r * Math.cos(a), -r * Math.sin(a)] as const;
  };
  const rings = Array.from({ length: max / 20 }, (_, i) => (i + 1) * 20).map(
    (m) => `<circle r="${String((m / max) * R)}" class="grid"></circle><text x="4" y="${String(-(m / max) * R - 4)}" class="axis">M ${String(m)}</text>`,
  );
  const marks = dots.map((d) => {
    const [x, y] = at(d.hue, (Math.min(d.m, max) / max) * R);
    const [cx, cy] = [x.toFixed(1), y.toFixed(1)];
    const r = d.custom ? (d.hollow ? 8 : 10) : d.hollow ? 7 : 9;
    const paint = `${d.hollow ? `fill="none" stroke="${d.color}" class="ring"` : `fill="${d.color}" class="mark"`} data-name="${d.name}" data-values="M ${d.m.toFixed(0)} • ${d.hue.toFixed(0)}°" data-at="${cx} ${cy} ${String(r)}"`;
    if (d.custom)
      return `<rect x="${(x - r / Math.SQRT2).toFixed(1)}" y="${(y - r / Math.SQRT2).toFixed(1)}" width="${(r * Math.SQRT2).toFixed(1)}" height="${(r * Math.SQRT2).toFixed(1)}" rx="${String(r / 4)}" transform="rotate(45 ${cx} ${cy})" ${paint}></rect>`;
    return `<circle cx="${cx}" cy="${cy}" r="${String(r)}" ${paint}></circle>`;
  });
  const legend = dots.some((d) => d.custom) ? `<figcaption class="circle-key"><span class="diamond" aria-hidden="true"></span> Custom colors</figcaption>` : "";
  // The same dots as a table, for reading the numbers, and for screen readers in place of the drawing.
  const rows = dots.map((d) => `<tr><th scope="row"><span class="dot" style="--c:${d.color}"></span> ${d.name}</th><td class="mono num">${d.hue.toFixed(1)}°</td><td class="mono num">${d.m.toFixed(1)}</td></tr>`).join("");
  const table = `<details class="circle-table" id="circle-table"><summary>Show as a table</summary><div class="scroll"><table><thead><tr><th scope="col">Color</th><th scope="col" class="num">Hue</th><th scope="col" class="num">Colorfulness <span class="unit">M</span></th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  return `<figure class="circle-block guided" data-guides="circle">${guidePicker(state.settings.guide, "circle")}<svg class="circle" viewBox="-212 -212 424 424" aria-hidden="true">
    ${rings.join("")}<g class="guide-layer">${circleGuides(guides(state.settings))}</g>${marks.join("")}<text class="dot-label" text-anchor="middle"></text></svg>${legend}${table}</figure>`;
}

/** The distance between a dot label's two lines, in the circle's units. */
const LABEL_LINE = 14;

// A dot on the hue circle shows its name above it while the pointer is on it, with its colorfulness
// and hue on a second line.
document.addEventListener("pointerover", (event) => {
  const dot = (event.target as Element).closest<SVGElement>(".circle [data-name]");
  const svg = (event.target as Element).closest(".circle");
  const text = svg?.querySelector<SVGTextElement>(".dot-label");
  if (!text) return;
  if (!dot) return void text.classList.remove("shown");
  const [x, y, r] = dot.dataset.at!.split(" ").map(Number) as [number, number, number];
  // Above the dot, kept inside the circle's box; below it when the dot sits at the top.
  const cx = String(Math.min(Math.max(x, -170), 170));
  const top = y - r - 8 - LABEL_LINE < -200 ? y + r + 16 : y - r - 8 - LABEL_LINE;
  const line = (words: string, at: number, kind: string) => {
    const span = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    span.textContent = words;
    span.setAttribute("x", cx);
    span.setAttribute("y", String(at));
    if (kind) span.setAttribute("class", kind);
    return span;
  };
  text.replaceChildren(line(dot.dataset.name!, top, ""), line(dot.dataset.values!, top + LABEL_LINE, "dot-values"));
  text.classList.add("shown");
});
document.addEventListener("pointerout", (event) => {
  if ((event.target as Element).closest(".circle [data-name]")) document.querySelectorAll(".dot-label.shown").forEach((t) => t.classList.remove("shown"));
});
