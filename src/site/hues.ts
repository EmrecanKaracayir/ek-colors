/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< HUES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The hue graph: every color on two rows, the uniform lineup (evenly different, nothing placed)   |
| and the current one (with colors placed by hand). Drag a color on the current row to place it;   |
| double-click it to let it go. Dragging the anchor moves the whole lineup. Reference systems are  |
| drawn as guides and can be shown or hidden.                                                      |
\*------------------------------------------------------------------------------------------------*/

import { composition } from "../palette/model";

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

/** A reference system's hue, drawn as a guide. */
export interface HueGuide {
  readonly system: string;
  readonly label: string;
  readonly hue: number;
  readonly unique: boolean;
}

/** What the graph shows. */
export interface HuesView {
  readonly rows: readonly HueRow[];
  readonly band: readonly { readonly hue: number; readonly color: string }[];
  readonly guides: readonly HueGuide[];

  /** Every system, whether it's shown, and where its numbers come from. */
  readonly systems: readonly { readonly id: string; readonly name: string; readonly shown: boolean; readonly source: string }[];

  /** Neighbor differences of the current lineup on the tier that stands for each hue. */
  readonly ring: readonly number[];
}

/** Drawing space: hue across, the two rows down. */
const [WIDTH, HEIGHT] = [360, 100];
const ROWS = { uniform: 28, current: 72 } as const;

const wrap = (hue: number) => ((hue % 360) + 360) % 360;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const degrees = (hue: number) => `${hue.toFixed(1)}°`;

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
      const even = `<circle cx="${u}" cy="${String(ROWS.uniform)}" r="6.5" style="fill:${uniform.color}" class="mark"></circle>`;
      const note = r.anchor ? ", the anchor" : r.placed ? ", placed" : "";
      const point = `<g data-hue-point="${r.key}" class="hue-point${r.placed ? " placed" : ""}" tabindex="0" role="slider" aria-label="${r.label}: ${r.current.hue.toFixed(0)}°${note}" aria-valuenow="${r.current.hue.toFixed(0)}">
        <circle cx="${c}" cy="${String(ROWS.current)}" r="15" class="hit"></circle>
        <circle cx="${c}" cy="${String(ROWS.current)}" r="8.5" style="fill:${r.current.color}" class="dot-fill"></circle>
        ${r.placed || r.anchor ? `<circle cx="${c}" cy="${String(ROWS.current)}" r="2.5" class="pin"></circle>` : ""}
      </g>`;
      return link + even + point;
    })
    .join("");
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
 * The guides: each shown system gets its own label row above the graph, and its own line style.
 *
 * @param view  What to show.
 * @returns     SVG and how much room the label rows need.
 */
function guideLayer(view: HuesView) {
  const shown = view.systems.filter((s) => s.shown);
  const lines = view.guides.map((g) => {
    const row = shown.findIndex((s) => s.id === g.system);
    const y = -6 - row * 12;
    return `<line x1="${g.hue.toFixed(1)}" x2="${g.hue.toFixed(1)}" y1="${String(y + 3)}" y2="${String(HEIGHT)}" class="guide guide-${g.system}${g.unique ? "" : " half"}"></line>
      <text x="${g.hue.toFixed(1)}" y="${String(y)}" class="axis" text-anchor="middle">${g.label}</text>`;
  });
  const names = shown.map(
    (s, row) => `<text x="-8" y="${String(-6 - row * 12)}" class="axis system-name" text-anchor="end">${s.name}</text>`,
  );
  return { svg: lines.join("") + names.join(""), top: 12 * Math.max(1, shown.length) + 6 };
}

/**
 * The graph, its switches, readout and numbers.
 *
 * @param view  What to show.
 * @returns     HTML.
 */
export function huesEditor(view: HuesView): string {
  const stops = view.band.map((b) => `<stop offset="${(b.hue / 360).toFixed(4)}" stop-color="${b.color}"></stop>`).join("");
  const scale = Array.from({ length: 13 }, (_, k) => k * 30).map(
    (h) => `<line x1="${String(h)}" x2="${String(h)}" y1="0" y2="${String(HEIGHT)}" class="grid"></line>
      <text x="${String(h)}" y="${String(HEIGHT + 13)}" class="axis" text-anchor="middle">${String(h)}°</text>`,
  );
  const labels = (
    [
      [ROWS.uniform, "Uniform"],
      [ROWS.current, "Current"],
    ] as const
  ).map(([y, text]) => `<text x="-8" y="${String(y + 3)}" class="axis row-label" text-anchor="end">${text}</text>`);
  const { svg: guidesSvg, top } = guideLayer(view);
  const switches = view.systems
    .map(
      (s) => `<label class="guide-switch" for="guide-${s.id}"><input id="guide-${s.id}" type="checkbox" data-guide="${s.id}" ${s.shown ? "checked" : ""}> ${s.name}</label>`,
    )
    .join("");
  const sources = view.systems
    .filter((s) => s.shown)
    .map((s) => `<li><strong>${s.name}:</strong> ${s.source}</li>`)
    .join("");
  return `<div class="hues-editor">
    <div class="guide-switches"><span class="soft">Guides</span>${switches}</div>
    <svg viewBox="-56 ${String(-top)} 424 ${String(HEIGHT + top + 20)}" role="group" aria-label="Where the uniform lineup puts each color, and where the current one does">
      <defs><linearGradient id="hues-band">${stops}</linearGradient></defs>
      <rect x="0" y="0" width="${String(WIDTH)}" height="${String(HEIGHT)}" rx="6" fill="url(#hues-band)" class="curve-band"></rect>
      ${scale.join("")}${guidesSvg}${labels.join("")}
      <g class="hues-layers">${huesLayers(view)}</g>
    </svg>
    <p class="hues-readout soft">${huesReadout(view)}</p>
    <p class="hues-caption soft">The uniform lineup is evenly different by perception, with nothing placed. Drag a color on the Current row to place it there; the others re-space around it, and double-click it to let it go. Dragging the anchor moves the whole lineup. A dot in the middle marks a color that stays put.</p>
    <div class="scroll"><table class="hues-table"><thead><tr><th>Color</th><th>Uniform</th><th>Current</th></tr></thead><tbody>${huesTable(view)}</tbody></table></div>
    ${sources ? `<ul class="guide-sources soft">${sources}</ul>` : ""}
  </div>`;
}

/* >----------------------------------------< Dragging >----------------------------------------< */

/**
 * Makes the graph respond to dragging, double-clicks and keys.
 *
 * @param get      The current view.
 * @param place    Places a color at a hue.
 * @param release  Lets a placed color go.
 */
export function bindHues(get: () => HuesView, place: (key: string, hue: number) => void, release: (key: string) => void): void {
  let drag: { key: string; svg: SVGSVGElement } | null = null;
  let lastPress = { time: 0, key: "" };

  const redraw = () => {
    const layers = document.querySelector(".hues-layers");
    if (layers) layers.innerHTML = huesLayers(get());
    const rows = document.querySelector(".hues-table tbody");
    if (rows) rows.innerHTML = huesTable(get());
  };
  const hueAt = (svg: SVGSVGElement, event: PointerEvent) =>
    wrap(Math.round(clamp(new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse()).x, 0, WIDTH)));

  document.addEventListener("pointerdown", (event) => {
    const point = (event.target as Element).closest<SVGElement>("[data-hue-point]");
    const svg = point?.closest<SVGSVGElement>(".hues-editor svg");
    if (!point || !svg) return;
    const key = point.dataset.huePoint!;
    // Double-clicks are told apart here: the first click may redraw the point.
    const twice = event.timeStamp - lastPress.time < 400 && lastPress.key === key;
    lastPress = twice ? { time: 0, key: "" } : { time: event.timeStamp, key };
    event.preventDefault();
    if (twice) {
      release(key);
      return redraw();
    }
    drag = { key, svg };
    svg.setPointerCapture(event.pointerId);
  });
  document.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const hue = hueAt(drag.svg, event);
    if (get().rows.find((r) => r.key === drag!.key)?.current.hue === hue) return;
    place(drag.key, hue);
    redraw();
  });
  document.addEventListener("pointerup", () => (drag = null));
  document.addEventListener("pointercancel", () => (drag = null));

  document.addEventListener("keydown", (event) => {
    const point = (event.target as Element).closest?.<SVGElement>("[data-hue-point]");
    if (!point || !(event.key === "ArrowLeft" || event.key === "ArrowRight")) return;
    event.preventDefault();
    const key = point.dataset.huePoint!;
    const row = get().rows.find((r) => r.key === key);
    if (!row) return;
    place(key, wrap(Math.round(row.current.hue) + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1)));
    redraw();
    document.querySelector<SVGElement>(`[data-hue-point="${key}"]`)?.focus();
  });
}
