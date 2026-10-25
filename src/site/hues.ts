/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< HUES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The hue graph: every color on two rows, the uniform lineup (evenly different, nothing placed)   |
| and the current one (with colors placed by hand). Click a color on either row to see its values |
| beside the graph; drag it on the current row to place it; double-click it to let it go. Dragging |
| the anchor moves the whole lineup.                                                               |
\*------------------------------------------------------------------------------------------------*/

import type { Guide } from "../palette/references";
import { composition, hueTurn, wrapHue } from "../palette/model";
import { refill } from "./dom";
import { band, evenText, INSETS, signed, zone, guideLayer, guidePicker, hueAt, hueScale, stops, viewBox } from "./graph";

/** One color, on every row. */
export interface HueRow {
  readonly key: string;
  readonly label: string;
  readonly uniform: { readonly hue: number; readonly color: string } | null;
  readonly turned: { readonly hue: number; readonly color: string } | null;
  readonly current: { readonly hue: number; readonly color: string };

  /** How far the current color is from the turned one, in gaps, or null while it solves. */
  readonly bend: number | null;

  /** Whether it's placed by hand, or the anchor, which the lineup is divided from. */
  readonly placed: boolean;
  readonly anchor: boolean;
}

/** A gap between neighbors, labeled halfway between them. */
export interface HueGap {
  readonly hue: number;
  readonly gap: number;
}

/** What the graph shows. */
export interface HuesView {
  readonly rows: readonly HueRow[];

  /** The gaps between neighbors on the uniform and current rows (CAM16-UCS ΔE). */
  readonly gaps: Readonly<Record<"uniform" | "current", readonly HueGap[]>>;

  /** The turn that brings the uniform lineup nearest the current one, and how bent the current one is from it (gaps, root mean square); null while they solve. */
  readonly turn: number | null;
  readonly bend: number | null;

  /** What the bend is made of: hue and colorfulness shares, or null while it solves. */
  readonly split: { readonly hue: number; readonly colorfulness: number } | null;
  readonly band: readonly { readonly hue: number; readonly color: string }[];

  /** The chosen reference system and its guides. */
  readonly guide: string;
  readonly guides: readonly Guide[];

  /**
   * What placing costs in evenness, on the tier that stands for each hue and without the curve:
   * the uniform lineup's gap between neighbors, each color's gaps to its neighbors as differences
   * from it, and the gaps themselves. Null while it solves.
   */
  readonly cost: {
    readonly uniform: number;
    readonly gaps: Readonly<Record<string, readonly [number, number]>>;
    readonly ring: readonly number[];

    /** The colors in the ring's order: gap i is between keys i and i + 1. */
    readonly keys: readonly string[];
  } | null;
}

export type Row = "uniform" | "turned" | "current";

/** Drawing space: hue across, the rows down. */
const HEIGHT = 116;
const ROWS: Readonly<Record<Row, number>> = { uniform: 26, turned: 60, current: 94 };
const NAMES: Readonly<Record<Row, string>> = { uniform: "Uniform", turned: "Turned", current: "Current" };

const degrees = (hue: number) => `${hue.toFixed(1)}°`;

/** The color whose values are shown beside the graph, and on which row. */
let selected: { key: string; row: Row } = { key: "", row: "current" };

/* >----------------------------------------< Drawing >-----------------------------------------< */

/**
 * The parts that move: each color on every row, joined by a line, and the gaps between neighbors.
 *
 * @param view  What to show.
 * @returns     SVG.
 */
export function huesLayers(view: HuesView): string {
  const on = (key: string, row: Row) => selected.key === key && selected.row === row;
  // The gaps: above the uniform row, below the current one; each row's shortest and longest bold,
  // unless they're all the same.
  const gaps = (Object.entries(view.gaps) as ["uniform" | "current", readonly HueGap[]][]).flatMap(([row, list]) => {
    const values = list.map((g) => Math.round(g.gap * 10));
    const [low, high] = [Math.min(...values), Math.max(...values)];
    return list.map((g, i) => {
      const extreme = high > low && (values[i] === low || values[i] === high);
      return `<text x="${g.hue.toFixed(1)}" y="${String(row === "uniform" ? ROWS.uniform - 10 : ROWS.current + 18)}" class="axis hue-gap${extreme ? " extreme" : ""}" text-anchor="middle">${g.gap.toFixed(1)}</text>`;
    });
  });
  return gaps.join("") + view.rows
    .map((r) => {
      const uniform = r.uniform ?? r.current;
      const turned = r.turned ?? uniform;
      const [u, t, c] = [uniform.hue.toFixed(1), turned.hue.toFixed(1), r.current.hue.toFixed(1)];
      const link = `<polyline points="${u},${String(ROWS.uniform)} ${t},${String(ROWS.turned)} ${c},${String(ROWS.current)}" class="hue-path"></polyline>`;
      // The uniform and turned rows can be selected to read their values, not moved.
      const fixed = (row: "uniform" | "turned", spot: { hue: number; color: string }, what: string) => `<g data-hue-point="${r.key}" data-row="${row}" class="hue-point uniform${on(r.key, row) ? " selected" : ""}" tabindex="0" role="button" aria-label="${r.label} ${what}: ${spot.hue.toFixed(0)}°">
        <circle cx="${spot.hue.toFixed(1)}" cy="${String(ROWS[row])}" r="12" class="hit"></circle>
        <circle cx="${spot.hue.toFixed(1)}" cy="${String(ROWS[row])}" r="${on(r.key, row) ? "6.5" : "5"}" style="fill:${spot.color}" class="dot-fill"></circle>
      </g>`;
      const even = fixed("uniform", uniform, "in the uniform lineup") + fixed("turned", turned, "in the turned lineup");
      const note = r.anchor ? ", the anchor" : r.placed ? ", placed" : "";
      const point = `<g data-hue-point="${r.key}" data-row="current" class="hue-point current${on(r.key, "current") ? " selected" : ""}" tabindex="0" role="slider" aria-label="${r.label}: ${r.current.hue.toFixed(0)}°${note}" aria-valuenow="${r.current.hue.toFixed(0)}">
        <circle cx="${c}" cy="${String(ROWS.current)}" r="14" class="hit"></circle>
        <circle cx="${c}" cy="${String(ROWS.current)}" r="${on(r.key, "current") ? "8" : "7"}" style="fill:${r.current.color}" class="dot-fill"></circle>
        ${r.placed || r.anchor ? `<circle cx="${c}" cy="${String(ROWS.current)}" r="2.25" class="pin"></circle>` : ""}
      </g>`;
      return link + even + point;
    })
    .join("");
}

/**
 * The selected color's values: on the current row, its hue can be changed; on the uniform row, it's
 * only shown.
 *
 * @param view  What to show.
 * @returns     HTML.
 */
export function huesPanel(view: HuesView): string {
  const r = view.rows.find((row) => row.key === selected.key) ?? view.rows.find((row) => row.anchor);
  if (!r) return `<p class="soft">Solving…</p>`;
  selected = { key: r.key, row: r.key === selected.key ? selected.row : "current" };
  const off = r.turned ? `${signed(hueTurn(r.turned.hue, r.current.hue))}°` : "…";
  if (selected.row !== "current") {
    const spot = (selected.row === "uniform" ? r.uniform : r.turned) ?? r.current;
    const note =
      selected.row === "uniform"
        ? "Evenly different, with nothing placed. It follows the anchor and can't be moved."
        : `The uniform lineup turned ${view.turn === null ? "…" : `${signed(view.turn)}°`} to best match the placed hues: still evenly different. It can't be moved.`;
    return `<p class="hue-name"><span class="dot" style="--c:${spot.color}"></span> ${r.label} <span class="soft">${selected.row}</span></p>
      <dl class="hue-facts">
        <div><dt>Hue</dt><dd class="mono">${degrees(spot.hue)}</dd></div>
        <div><dt>Name</dt><dd class="mono">${composition(spot.hue)}</dd></div>
        <div><dt>Current</dt><dd class="mono">${degrees(r.current.hue)}</dd></div>
      </dl>
      <p class="soft hue-note">${note}</p>`;
  }
  const gaps = view.cost?.gaps[r.key];
  const state = r.anchor ? "the anchor" : r.placed ? "placed" : "spaced";
  return `<p class="hue-name"><span class="dot" style="--c:${r.current.color}"></span> ${r.label} <span class="soft">${state}</span></p>
    <label class="field" for="hue-at"><span>Hue</span><input id="hue-at" type="number" data-hue-at min="0" max="359" step="1" value="${r.current.hue.toFixed(0)}"></label>
    ${r.anchor ? "" : `<label class="field graph-check" for="hue-placed"><span>Placed</span><input id="hue-placed" type="checkbox" data-hue-placed ${r.placed ? "checked" : ""}></label>`}
    <dl class="hue-facts">
      <div><dt>Name</dt><dd class="mono">${composition(r.current.hue)}</dd></div>
      <div><dt>Turned</dt><dd class="mono">${r.turned ? degrees(r.turned.hue) : "…"}</dd></div>
      <div><dt>Off by</dt><dd class="mono">${off}</dd></div>
      <div><dt>Bend</dt><dd class="mono">${r.bend === null ? "…" : `${r.bend.toFixed(2)} gap`}</dd></div>
      <div><dt>Gaps</dt><dd class="mono">${gaps ? `${signed(gaps[0])} / ${signed(gaps[1])}` : "…"}</dd></div>
    </dl>`;
}

/**
 * What placing costs in evenness, under the graph.
 *
 * @param view  What to show.
 * @returns     Text.
 */
export function huesReadout(view: HuesView): string {
  const cost = view.cost;
  if (!cost) return "Solving…";
  const names = cost.keys.map((key) => view.rows.find((r) => r.key === key)?.label ?? "");
  const made = view.split ? ` (hue ${String(Math.round(view.split.hue * 100))}%${view.split.colorfulness >= 0.005 ? `, colorfulness ${String(Math.round(view.split.colorfulness * 100))}%` : ""})` : "";
  const turn = view.turn === null || view.bend === null ? "" : `${zone(view.bend).name}: bend ${view.bend.toFixed(2)} gap${view.bend >= 0.005 ? made : ""}, turned ${signed(view.turn)}°. `;
  return turn + evenText(cost.ring, names, cost.uniform);
}

/**
 * The graph with its guide switch above, the selected color's values beside it, and its caption.
 *
 * @param view  What to show.
 * @returns     HTML.
 */
export function huesEditor(view: HuesView): string {
  const labels = (Object.entries(ROWS) as [Row, number][]).map(
    ([row, y]) => `<text x="-18" y="${String(y + 3)}" class="axis row-label" text-anchor="end">${NAMES[row]}</text>`,
  );
  return `<div class="graph-editor guided hues-editor" style="${INSETS}">
    ${guidePicker(view.guide, "hues")}
    <div class="graph-values hues-values">${huesPanel(view)}</div>
    <svg viewBox="${viewBox(HEIGHT)}" data-height="${String(HEIGHT)}" role="group" aria-label="Where the uniform lineup puts each color, and where the current one does">
      ${band("hues-band", stops(view.band), HEIGHT)}<g class="guide-layer">${guideLayer(view.guides, HEIGHT)}</g>${labels.join("")}${hueScale(HEIGHT)}
      <g class="hues-layers">${huesLayers(view)}</g>
    </svg>
    <p class="graph-caption readout hues-readout">${huesReadout(view)}</p>
    <p class="graph-caption hint">These rows leave out colorfulness per hue, so they show placing alone: Uniform is the lineup evenly different by perception, with nothing placed; Turned is that lineup turned to best match the placed hues, still evenly different; Current has the placed hues. Bend is how far Current is from Turned. Click a color on either row to see its values. Drag it on the Current row to place it there, and the others re-space around it; double-click it to let it go. Dragging the anchor moves the whole lineup. Arrow keys move the selected color by 1°, with Shift by 10°. A dot in the middle marks a color that stays put.</p>
  </div>`;
}

/**
 * Draws the graph's moving parts again: its points, its band, its readout and the selected color's
 * values. The values aren't redrawn while one is being typed, unless a different color is chosen.
 * Focus stays where it was.
 *
 * @param view   What to show.
 * @param panel  Whether the values must be redrawn even while focused.
 */
export function refreshHues(view: HuesView, panel = false): void {
  const editor = document.querySelector(".hues-editor");
  if (!editor) return;
  refill(editor.querySelector(".hues-layers")!, huesLayers(view));
  editor.querySelector("linearGradient")!.innerHTML = stops(view.band);
  editor.querySelector(".hues-readout")!.innerHTML = huesReadout(view);
  const values = editor.querySelector(".hues-values")!;
  if (panel || !values.contains(document.activeElement)) refill(values, huesPanel(view));
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

  const redraw = (panel = false) => refreshHues(get(), panel);

  document.addEventListener("pointerdown", (event) => {
    const point = (event.target as Element).closest<SVGElement>("[data-hue-point]");
    const svg = point?.closest<SVGSVGElement>(".hues-editor svg");
    if (!point || !svg) return;
    event.preventDefault();
    const key = point.dataset.huePoint!;
    const row = point.dataset.row as Row;
    selected = { key, row };
    if (row !== "current") return redraw(true);
    // Double-clicks are told apart here: the first click redraws the point.
    const twice = event.timeStamp - lastPress.time < 400 && lastPress.key === key;
    lastPress = twice ? { time: 0, key: "" } : { time: event.timeStamp, key };
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
      place(selected.key, wrapHue(Math.round(Number(el.value))));
      redraw();
      // The panel isn't redrawn while its field is being typed in, so it's marked placed here.
      const box = document.querySelector<HTMLInputElement>("[data-hue-placed]");
      if (box) box.checked = true;
      const state = document.querySelector(".hues-values .hue-name .soft");
      if (state && box) state.textContent = "placed";
    } else if (el.matches("[data-hue-placed]")) {
      const row = get().rows.find((r) => r.key === selected.key);
      if (!row) return;
      if (el.checked) place(selected.key, Math.round(row.current.hue));
      else release(selected.key);
      redraw(true);
    }
  });

  document.addEventListener("keydown", (event) => {
    const point = (event.target as Element).closest?.<SVGElement>("[data-hue-point]");
    if (!point) return;
    const key = point.dataset.huePoint!;
    const row = point.dataset.row as Row;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selected = { key, row };
      redraw(true);
    }
    if (row !== "current" || !(event.key === "ArrowLeft" || event.key === "ArrowRight")) return;
    event.preventDefault();
    const color = get().rows.find((r) => r.key === key);
    if (!color) return;
    selected = { key, row };
    place(key, wrapHue(Math.round(color.current.hue) + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1)));
    redraw(true);
  });
}
