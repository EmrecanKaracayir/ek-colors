/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< HOMES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The homes editor: a strip of the hue circle with each color twice, a hollow ring where it        |
| belongs (its home) and a dot where it lands. Drag a ring to move a home; double-click one to put |
| it back where its name puts it. Yellow is the anchor: it lands exactly on its home, and the      |
| others are spaced around it.                                                                     |
\*------------------------------------------------------------------------------------------------*/

import { composition } from "../palette/model";

/** One color on the strip. */
export interface HomeItem {
  readonly key: string;
  readonly label: string;

  /** Where it belongs. */
  readonly home: number;

  /** Where it lands, and its color there. */
  readonly hue: number;
  readonly color: string;

  /** Whether it's the anchor, which lands exactly on its home. */
  readonly anchor: boolean;
}

/** What the editor shows. */
export interface HomesView {
  readonly items: readonly HomeItem[];
  readonly band: readonly { readonly hue: number; readonly color: string }[];

  /** The neighbor differences on the tier that stands for each hue. */
  readonly ring: readonly number[];
  readonly pull: number;

  /** The reference system's hues, drawn as guides: pure hues solid, mixes dashed. */
  readonly guides: readonly { readonly label: string; readonly hue: number; readonly unique: boolean }[];
}

/** Drawing space: hue across; homes on the upper row, landings on the lower. */
const [WIDTH, HEIGHT, HOME_Y, LAND_Y] = [360, 110, 32, 80];

const wrap = (hue: number) => ((hue % 360) + 360) % 360;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const degrees = (hue: number) => `${hue.toFixed(1)}°`;

/* >----------------------------------------< Drawing >-----------------------------------------< */

/**
 * The parts that move: each color's home ring, where it lands, and a line between them.
 *
 * @param view  What to show.
 * @returns     SVG.
 */
export function homesLayers(view: HomesView): string {
  return view.items
    .map((it) => {
      const link = `<line x1="${it.home.toFixed(1)}" y1="${String(HOME_Y)}" x2="${it.hue.toFixed(1)}" y2="${String(LAND_Y)}" class="home-link"></line>`;
      const landing = `<circle cx="${it.hue.toFixed(1)}" cy="${String(LAND_Y)}" r="6.5" style="fill:${it.color}" class="mark"></circle>`;
      const marker = `<g data-home="${it.key}" class="home-marker" tabindex="0" role="slider" aria-label="${it.label}'s home: ${it.home.toFixed(0)}°" aria-valuenow="${it.home.toFixed(0)}">
        <circle cx="${it.home.toFixed(1)}" cy="${String(HOME_Y)}" r="14" class="hit"></circle>
        <circle cx="${it.home.toFixed(1)}" cy="${String(HOME_Y)}" r="7" style="stroke:${it.color}" class="home-ring"></circle>
      </g>`;
      return link + landing + marker;
    })
    .join("");
}

/**
 * Each color's home and landing as numbers, in hue order.
 *
 * @param view  What to show.
 * @returns     Table rows.
 */
export function homesRows(view: HomesView): string {
  return view.items
    .toSorted((a, b) => a.home - b.home)
    .map((it) => {
      const off = ((((it.hue - it.home) % 360) + 540) % 360) - 180;
      return `<tr>
        <th scope="row"><span class="dot" style="--c:${it.color}"></span> ${it.label}${it.anchor ? ' <span class="soft">anchor</span>' : ""}</th>
        <td class="mono">${degrees(it.home)} <span class="soft">${composition(it.home)}</span></td>
        <td class="mono">${degrees(it.hue)} <span class="soft">${composition(it.hue)}</span></td>
        <td class="mono">${Math.abs(off) < 0.05 ? "on it" : `${off > 0 ? "+" : "−"}${Math.abs(off).toFixed(1)}°`}</td>
      </tr>`;
    })
    .join("");
}

/**
 * The neighbor differences under the strip.
 *
 * @param view  What to show.
 * @returns     Text.
 */
export function homesReadout(view: HomesView): string {
  if (!view.ring.length) return "Solving…";
  return `Neighbor differences ${Math.min(...view.ring).toFixed(1)} to ${Math.max(...view.ring).toFixed(1)}; each color lands at most ${String(view.pull)} from even spacing.`;
}

/**
 * The editor: the strip, the readout, and the numbers.
 *
 * @param view  What to show.
 * @returns     HTML.
 */
export function homesEditor(view: HomesView): string {
  const stops = view.band.map((b) => `<stop offset="${(b.hue / 360).toFixed(4)}" stop-color="${b.color}"></stop>`).join("");
  const scale = Array.from({ length: 13 }, (_, k) => k * 30).map(
    (h) => `<line x1="${String(h)}" x2="${String(h)}" y1="0" y2="${String(HEIGHT)}" class="grid"></line>
      <text x="${String(h)}" y="${String(HEIGHT + 13)}" class="axis" text-anchor="middle">${String(h)}°</text>`,
  );
  const references = view.guides.map(
    (r) => `<line x1="${r.hue.toFixed(1)}" x2="${r.hue.toFixed(1)}" y1="0" y2="${String(HEIGHT)}" class="reference${r.unique ? "" : " half"}"></line>
      <text x="${r.hue.toFixed(1)}" y="-5" class="axis" text-anchor="middle">${r.label}</text>`,
  );
  const rows = [
    [HOME_Y, "Home"],
    [LAND_Y, "Lands"],
  ].map(([y, text]) => `<text x="-8" y="${String(Number(y) + 3)}" class="axis row-label" text-anchor="end">${String(text)}</text>`);
  return `<div class="homes-editor">
    <svg viewBox="-40 -18 410 ${String(HEIGHT + 34)}" role="group" aria-label="Where each color belongs and where it lands">
      <defs><linearGradient id="homes-band">${stops}</linearGradient></defs>
      <rect x="0" y="0" width="${String(WIDTH)}" height="${String(HEIGHT)}" rx="6" fill="url(#homes-band)" class="curve-band"></rect>
      ${scale.join("")}${references.join("")}${rows.join("")}
      <g class="homes-layers">${homesLayers(view)}</g>
    </svg>
    <p class="homes-readout soft">${homesReadout(view)}</p>
    <p class="curve-caption soft">Rings are where colors belong, dots are where they land; a line joins each pair. Drag a ring sideways to move a color's home, or double-click it to put it back where the reference system puts it.</p>
    <div class="scroll"><table class="homes-table"><thead><tr><th>Color</th><th>Home</th><th>Lands</th><th>Off by</th></tr></thead><tbody>${homesRows(view)}</tbody></table></div>
  </div>`;
}

/* >----------------------------------------< Dragging >----------------------------------------< */

/**
 * Makes the editor respond to dragging, double-clicks and keys.
 *
 * @param get    The current view.
 * @param set    Moves a color's home.
 * @param reset  Puts a color's home back where its name puts it.
 */
export function bindHomes(get: () => HomesView, set: (key: string, hue: number) => void, reset: (key: string) => void): void {
  let drag: { key: string; svg: SVGSVGElement } | null = null;
  let lastPress = { time: 0, key: "" };

  const redraw = () => {
    const layers = document.querySelector(".homes-layers");
    if (layers) layers.innerHTML = homesLayers(get());
    const rows = document.querySelector(".homes-table tbody");
    if (rows) rows.innerHTML = homesRows(get());
  };
  const hueAt = (svg: SVGSVGElement, event: PointerEvent) =>
    wrap(Math.round(clamp(new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse()).x, 0, WIDTH)));

  document.addEventListener("pointerdown", (event) => {
    const marker = (event.target as Element).closest<SVGElement>("[data-home]");
    const svg = marker?.closest<SVGSVGElement>(".homes-editor svg");
    if (!marker || !svg) return;
    const key = marker.dataset.home!;
    // Double-clicks are told apart here: the first click may redraw the marker.
    const twice = event.timeStamp - lastPress.time < 400 && lastPress.key === key;
    lastPress = twice ? { time: 0, key: "" } : { time: event.timeStamp, key };
    event.preventDefault();
    if (twice) {
      reset(key);
      return redraw();
    }
    drag = { key, svg };
    svg.setPointerCapture(event.pointerId);
  });
  document.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const hue = hueAt(drag.svg, event);
    if (get().items.find((it) => it.key === drag!.key)?.home === hue) return;
    set(drag.key, hue);
    redraw();
  });
  document.addEventListener("pointerup", () => (drag = null));
  document.addEventListener("pointercancel", () => (drag = null));

  document.addEventListener("keydown", (event) => {
    const marker = (event.target as Element).closest?.<SVGElement>("[data-home]");
    if (!marker || !(event.key === "ArrowLeft" || event.key === "ArrowRight")) return;
    event.preventDefault();
    const key = marker.dataset.home!;
    const item = get().items.find((it) => it.key === key);
    if (!item) return;
    set(key, wrap(Math.round(item.home) + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1)));
    redraw();
    document.querySelector<SVGElement>(`[data-home="${key}"]`)?.focus();
  });
}
