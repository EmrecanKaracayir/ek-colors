/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< HUES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The hue graph: every color on two rows, the uniform lineup (evenly different, nothing placed)   |
| and the current one (with colors placed by hand). Click a color to see its values beside the    |
| graph; drag it on the current row to place it; double-click it to let it go. Dragging the anchor |
| moves the whole lineup. Reference systems are drawn as guides and can be shown or hidden.        |
\*------------------------------------------------------------------------------------------------*/

import { composition } from "../palette/model";
import { band, type Guide, guideLayer, hueAt, hueScale, stops, viewBox } from "./graph";

/** One color, on both rows. */
export interface HueRow {
  readonly key: string;
  readonly label: string;
  readonly uniform: { readonly hue: number; readonly color: string } | null;
  readonly current: { readonly hue: number; readonly color: string };

  /** Whether it's placed by hand, or the anchor, which the lineup is divided from. */
  readonly placed: boolean;
  readonly anchor: boolean;
}

/** What the graph shows. */
export interface HuesView {
  readonly rows: readonly HueRow[];
  readonly band: readonly { readonly hue: number; readonly color: string }[];
  readonly guides: readonly Guide[];

  /** Every system, whether it's shown, and where its numbers come from. */
  readonly systems: readonly { readonly id: string; readonly name: string; readonly shown: boolean; readonly source: string }[];

  /** Neighbor differences of the current lineup on the tier that stands for each hue. */
  readonly ring: readonly number[];
}

/** Drawing space: hue across, the two rows down. */
const HEIGHT = 96;
const ROWS = { uniform: 28, current: 68 } as const;

const wrap = (hue: number) => ((hue % 360) + 360) % 360;
const degrees = (hue: number) => `${hue.toFixed(1)}°`;

/** The color whose values are shown beside the graph. */
let selected = "";

/* >----------------------------------------< Drawing >-----------------------------------------< */

/**
 * The parts that move: each color on both rows, joined by a line.
 *
 * @param view  What to show.
 * @returns     SVG.
 */
export function huesLayers(view: HuesView): string {
  return view.rows
    .map((r) => {
      const uniform = r.uniform ?? r.current;
      const [u, c] = [uniform.hue.toFixed(1), r.current.hue.toFixed(1)];
      const link = `<line x1="${u}" y1="${String(ROWS.uniform)}" x2="${c}" y2="${String(ROWS.current)}" class="hue-path"></line>`;
      const even = `<circle cx="${u}" cy="${String(ROWS.uniform)}" r="5" style="fill:${uniform.color}" class="mark"></circle>`;
      const note = r.anchor ? ", the anchor" : r.placed ? ", placed" : "";
      const point = `<g data-hue-point="${r.key}" class="hue-point${r.key === selected ? " selected" : ""}" tabindex="0" role="slider" aria-label="${r.label}: ${r.current.hue.toFixed(0)}°${note}" aria-valuenow="${r.current.hue.toFixed(0)}">
        <circle cx="${c}" cy="${String(ROWS.current)}" r="14" class="hit"></circle>
        <circle cx="${c}" cy="${String(ROWS.current)}" r="${r.key === selected ? "8" : "7"}" style="fill:${r.current.color}" class="dot-fill"></circle>
        ${r.placed || r.anchor ? `<circle cx="${c}" cy="${String(ROWS.current)}" r="2.25" class="pin"></circle>` : ""}
      </g>`;
      return link + even + point;
    })
    .join("");
}

/**
 * The selected color's values.
 *
 * @param view  What to show.
 * @returns     HTML.
 */
export function huesPanel(view: HuesView): string {
  const r = view.rows.find((row) => row.key === selected) ?? view.rows.find((row) => row.anchor);
  if (!r) return `<p class="soft">Solving…</p>`;
  selected = r.key;
  const state = r.anchor ? "the anchor" : r.placed ? "placed" : "spaced";
  return `<p class="hue-name"><span class="dot" style="--c:${r.current.color}"></span> ${r.label} <span class="soft">${state}</span></p>
    <label class="field" for="hue-at"><span>Hue</span><input id="hue-at" type="number" data-hue-at min="0" max="359" step="1" value="${r.current.hue.toFixed(0)}"></label>
    ${r.anchor ? "" : `<label class="field graph-check" for="hue-placed"><span>Placed</span><input id="hue-placed" type="checkbox" data-hue-placed ${r.placed ? "checked" : ""}></label>`}
    <dl class="hue-facts">
      <div><dt>Name</dt><dd class="mono">${composition(r.current.hue)}</dd></div>
      <div><dt>Uniform</dt><dd class="mono">${r.uniform ? degrees(r.uniform.hue) : "…"}</dd></div>
      <div><dt>Moved</dt><dd class="mono">${r.uniform ? `${(((r.current.hue - r.uniform.hue + 540) % 360) - 180).toFixed(1)}°` : "…"}</dd></div>
    </dl>`;
}

/**
 * Each color's hue on both rows, in hue order.
 *
 * @param view  What to show.
 * @returns     Table rows.
 */
export function huesTable(view: HuesView): string {
  const cell = (hue: number) => `<td class="mono">${degrees(hue)} <span class="soft">${composition(hue)}</span></td>`;
  return view.rows
    .toSorted((a, b) => a.current.hue - b.current.hue)
    .map(
      (r) => `<tr>
        <th scope="row"><span class="dot" style="--c:${r.current.color}"></span> ${r.label}${r.anchor ? ' <span class="soft">anchor</span>' : r.placed ? ' <span class="soft">placed</span>' : ""}</th>
        ${r.uniform ? cell(r.uniform.hue) : '<td class="soft">…</td>'}${cell(r.current.hue)}
      </tr>`,
    )
    .join("");
}

/**
 * The neighbor differences under the graph.
 *
 * @param view  What to show.
 * @returns     Text.
 */
export function huesReadout(view: HuesView): string {
  if (!view.ring.length) return "Solving…";
  return `Current lineup: neighbor differences ${Math.min(...view.ring).toFixed(1)} to ${Math.max(...view.ring).toFixed(1)}.`;
}

/**
 * The guide switches: one per system, each with its line style.
 *
 * @param view  What to show.
 * @returns     HTML.
 */
export function guideSwitches(view: HuesView): string {
  const switches = view.systems.map(
    (s) => `<label class="guide-switch" for="guide-${s.id}"><input id="guide-${s.id}" type="checkbox" data-guide="${s.id}" ${s.shown ? "checked" : ""}>
      <svg viewBox="0 0 18 6" aria-hidden="true"><line x1="0" x2="18" y1="3" y2="3" class="guide guide-${s.id}"></line></svg> ${s.name}</label>`,
  );
  return `<div class="guide-switches"><span class="soft">Guides</span>${switches.join("")}</div>`;
}

/**
 * The graph with the selected color's values beside it, its caption, readout and numbers.
 *
 * @param view  What to show.
 * @returns     HTML.
 */
export function huesEditor(view: HuesView): string {
  const labels = (
    [
      [ROWS.uniform, "Uniform"],
      [ROWS.current, "Current"],
    ] as const
  ).map(([y, text]) => `<text x="-18" y="${String(y + 3)}" class="axis row-label" text-anchor="end">${text}</text>`);
  const { svg: guides, top } = guideLayer(view.guides, HEIGHT);
  const sources = view.systems
    .filter((s) => s.shown)
    .map((s) => `<li><strong>${s.name}:</strong> ${s.source}</li>`)
    .join("");
  return `<div class="graph-editor hues-editor">
    <div class="graph-values hues-values">${huesPanel(view)}</div>
    <svg viewBox="${viewBox(top, HEIGHT)}" role="group" aria-label="Where the uniform lineup puts each color, and where the current one does">
      ${band("hues-band", stops(view.band), HEIGHT)}${guides}${labels.join("")}${hueScale(HEIGHT)}
      <g class="hues-layers">${huesLayers(view)}</g>
    </svg>
    <p class="graph-caption soft">Uniform is the lineup evenly different by perception, with nothing placed; Current is the one in use. Click a color to see its values. Drag it on the Current row to place it there, and the others re-space around it; double-click it to let it go. Dragging the anchor moves the whole lineup. Arrow keys move the selected color by 1°, with Shift by 10°. A dot in the middle marks a color that stays put.</p>
    <p class="graph-caption soft hues-readout">${huesReadout(view)}</p>
  </div>
  <div class="scroll"><table class="hues-table"><thead><tr><th>Color</th><th>Uniform</th><th>Current</th></tr></thead><tbody>${huesTable(view)}</tbody></table></div>
  ${sources ? `<ul class="guide-sources soft">${sources}</ul>` : ""}`;
}

/* >----------------------------------------< Dragging >----------------------------------------< */

/**
 * Makes the graph respond to clicks, dragging, double-clicks, keys and its values.
 *
 * @param get      The current view.
 * @param place    Places a color at a hue.
 * @param release  Lets a placed color go.
 */
export function bindHues(get: () => HuesView, place: (key: string, hue: number) => void, release: (key: string) => void): void {
  let drag: { key: string; svg: SVGSVGElement } | null = null;
  let lastPress = { time: 0, key: "" };

  const redraw = (panel = false) => {
    const view = get();
    const layers = document.querySelector(".hues-layers");
    if (layers) layers.innerHTML = huesLayers(view);
    const rows = document.querySelector(".hues-table tbody");
    if (rows) rows.innerHTML = huesTable(view);
    const values = document.querySelector(".hues-values");
    if (values && (panel || !values.contains(document.activeElement))) values.innerHTML = huesPanel(view);
  };

  document.addEventListener("pointerdown", (event) => {
    const point = (event.target as Element).closest<SVGElement>("[data-hue-point]");
    const svg = point?.closest<SVGSVGElement>(".hues-editor svg");
    if (!point || !svg) return;
    const key = point.dataset.huePoint!;
    // Double-clicks are told apart here: the first click redraws the point.
    const twice = event.timeStamp - lastPress.time < 400 && lastPress.key === key;
    lastPress = twice ? { time: 0, key: "" } : { time: event.timeStamp, key };
    event.preventDefault();
    selected = key;
    if (twice) {
      release(key);
      return redraw(true);
    }
    drag = { key, svg };
    svg.setPointerCapture(event.pointerId);
    redraw(true);
  });
  document.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const hue = hueAt(drag.svg, event);
    if (Math.round(get().rows.find((r) => r.key === drag!.key)?.current.hue ?? -1) === hue) return;
    place(drag.key, hue);
    redraw();
  });
  document.addEventListener("pointerup", () => (drag = null));
  document.addEventListener("pointercancel", () => (drag = null));

  document.addEventListener("input", (event) => {
    const el = event.target as HTMLInputElement;
    if (el.matches("[data-hue-at]")) {
      if (el.value === "" || Number.isNaN(Number(el.value))) return;
      place(selected, wrap(Math.round(Number(el.value))));
      redraw();
    } else if (el.matches("[data-hue-placed]")) {
      const row = get().rows.find((r) => r.key === selected);
      if (!row) return;
      if (el.checked) place(selected, Math.round(row.current.hue));
      else release(selected);
      redraw(true);
    }
  });

  document.addEventListener("keydown", (event) => {
    const point = (event.target as Element).closest?.<SVGElement>("[data-hue-point]");
    if (!point || !(event.key === "ArrowLeft" || event.key === "ArrowRight")) return;
    event.preventDefault();
    const key = point.dataset.huePoint!;
    const row = get().rows.find((r) => r.key === key);
    if (!row) return;
    selected = key;
    place(key, wrap(Math.round(row.current.hue) + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1)));
    redraw(true);
    document.querySelector<SVGElement>(`[data-hue-point="${key}"]`)?.focus();
  });
}
