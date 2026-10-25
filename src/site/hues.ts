/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< HUES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The hue graph: every color on two rows, the uniform lineup (evenly different, nothing placed)   |
| and the current one (with colors placed by hand). Click a color on either row to see its values |
| beside the graph; drag it on the current row to place it; double-click it to let it go. Dragging |
| the anchor moves the whole lineup.                                                               |
\*------------------------------------------------------------------------------------------------*/

import { composition } from "../palette/model";
import { band, evenness, INSETS, signed, type Guide, guideLayer, guidePicker, guideSource, hueAt, hueScale, stops, viewBox } from "./graph";

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

/** A gap between neighbors, labeled halfway between them. */
export interface HueGap {
  readonly hue: number;
  readonly gap: number;
}

/** What the graph shows. */
export interface HuesView {
  readonly rows: readonly HueRow[];

  /** The gaps between neighbors on each row (CAM16-UCS ΔE). */
  readonly gaps: Readonly<Record<Row, readonly HueGap[]>>;
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

export type Row = "uniform" | "current";

/** Drawing space: hue across, the two rows down. */
const HEIGHT = 96;
const ROWS: Readonly<Record<Row, number>> = { uniform: 28, current: 68 };

const wrap = (hue: number) => ((hue % 360) + 360) % 360;
const degrees = (hue: number) => `${hue.toFixed(1)}°`;

/** The color whose values are shown beside the graph, and on which row. */
let selected: { key: string; row: Row } = { key: "", row: "current" };

/* >----------------------------------------< Drawing >-----------------------------------------< */

/**
 * The parts that move: each color on both rows, joined by a line, and the gaps between neighbors.
 *
 * @param view  What to show.
 * @returns     SVG.
 */
export function huesLayers(view: HuesView): string {
  const on = (key: string, row: Row) => selected.key === key && selected.row === row;
  // The gaps: above the uniform row, below the current one; each row's shortest and longest bold,
  // unless they're all the same.
  const gaps = (Object.entries(view.gaps) as [Row, readonly HueGap[]][]).flatMap(([row, list]) => {
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
      const [u, c] = [uniform.hue.toFixed(1), r.current.hue.toFixed(1)];
      const link = `<line x1="${u}" y1="${String(ROWS.uniform)}" x2="${c}" y2="${String(ROWS.current)}" class="hue-path"></line>`;
      const even = `<g data-hue-point="${r.key}" data-row="uniform" class="hue-point uniform${on(r.key, "uniform") ? " selected" : ""}" tabindex="0" role="button" aria-label="${r.label} in the uniform lineup: ${uniform.hue.toFixed(0)}°">
        <circle cx="${u}" cy="${String(ROWS.uniform)}" r="12" class="hit"></circle>
        <circle cx="${u}" cy="${String(ROWS.uniform)}" r="${on(r.key, "uniform") ? "6.5" : "5"}" style="fill:${uniform.color}" class="dot-fill"></circle>
      </g>`;
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
  const moved = r.uniform ? `${signed((((r.current.hue - r.uniform.hue + 540) % 360) - 180))}°` : "…";
  if (selected.row === "uniform") {
    return `<p class="hue-name"><span class="dot" style="--c:${(r.uniform ?? r.current).color}"></span> ${r.label} <span class="soft">uniform</span></p>
      <dl class="hue-facts">
        <div><dt>Hue</dt><dd class="mono">${r.uniform ? degrees(r.uniform.hue) : "…"}</dd></div>
        <div><dt>Name</dt><dd class="mono">${r.uniform ? composition(r.uniform.hue) : "…"}</dd></div>
        <div><dt>Current</dt><dd class="mono">${degrees(r.current.hue)}</dd></div>
      </dl>
      <p class="soft hue-note">Evenly different, with nothing placed. It follows the anchor and can't be moved.</p>`;
  }
  const gaps = view.cost?.gaps[r.key];
  const state = r.anchor ? "the anchor" : r.placed ? "placed" : "spaced";
  return `<p class="hue-name"><span class="dot" style="--c:${r.current.color}"></span> ${r.label} <span class="soft">${state}</span></p>
    <label class="field" for="hue-at"><span>Hue</span><input id="hue-at" type="number" data-hue-at min="0" max="359" step="1" value="${r.current.hue.toFixed(0)}"></label>
    ${r.anchor ? "" : `<label class="field graph-check" for="hue-placed"><span>Placed</span><input id="hue-placed" type="checkbox" data-hue-placed ${r.placed ? "checked" : ""}></label>`}
    <dl class="hue-facts">
      <div><dt>Name</dt><dd class="mono">${composition(r.current.hue)}</dd></div>
      <div><dt>Uniform</dt><dd class="mono">${r.uniform ? degrees(r.uniform.hue) : "…"}</dd></div>
      <div><dt>Moved</dt><dd class="mono">${moved}</dd></div>
      <div><dt>Gaps</dt><dd class="mono" title="Its gaps to the neighbors before and after it, against the uniform gap (ΔE)">${gaps ? `${signed(gaps[0])} / ${signed(gaps[1])}` : "…"}</dd></div>
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
  const i = cost.ring.indexOf(Math.min(...cost.ring));
  const name = (key: string | undefined) => view.rows.find((r) => r.key === key)?.label ?? "";
  const closer = 1 - cost.ring[i]! / cost.uniform;
  const pair = `${name(cost.keys[i])}–${name(cost.keys[(i + 1) % cost.keys.length])}`;
  return closer > 0.005
    ? `Evenness from placing alone, before colorfulness per hue: the closest pair, ${pair}, is ${cost.ring[i]!.toFixed(1)} ΔE apart, ${String(Math.round(closer * 100))}% closer than the even gap of ${cost.uniform.toFixed(1)}: ${evenness(closer)}.`
    : `Evenness from placing alone: every pair is as far apart as the even gap of ${cost.uniform.toFixed(1)} ΔE.`;
}

/**
 * The graph with its guide switch above, the selected color's values beside it, and its caption.
 *
 * @param view  What to show.
 * @returns     HTML.
 */
export function huesEditor(view: HuesView): string {
  const labels = (Object.entries(ROWS) as [Row, number][]).map(
    ([row, y]) => `<text x="-18" y="${String(y + 3)}" class="axis row-label" text-anchor="end">${row === "uniform" ? "Uniform" : "Current"}</text>`,
  );
  return `<div class="graph-editor hues-editor" style="${INSETS}">
    ${guidePicker(view.guide)}
    <div class="graph-values hues-values">${huesPanel(view)}</div>
    <svg viewBox="${viewBox(HEIGHT)}" data-height="${String(HEIGHT)}" role="group" aria-label="Where the uniform lineup puts each color, and where the current one does">
      ${band("hues-band", stops(view.band), HEIGHT)}<g class="guide-layer">${guideLayer(view.guides, HEIGHT)}</g>${labels.join("")}${hueScale(HEIGHT)}
      <g class="hues-layers">${huesLayers(view)}</g>
    </svg>
    <p class="graph-caption soft">Uniform is the lineup evenly different by perception, with nothing placed; Current is the one in use. Click a color on either row to see its values. Drag it on the Current row to place it there, and the others re-space around it; double-click it to let it go. Dragging the anchor moves the whole lineup. Arrow keys move the selected color by 1°, with Shift by 10°. A dot in the middle marks a color that stays put.</p>
    <p class="graph-caption soft hues-readout">${huesReadout(view)}</p>
    <p class="graph-caption soft guide-source">${guideSource(view.guide)}</p>
  </div>`;
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
    const values = document.querySelector(".hues-values");
    if (values && (panel || !values.contains(document.activeElement))) values.innerHTML = huesPanel(view);
  };

  document.addEventListener("pointerdown", (event) => {
    const point = (event.target as Element).closest<SVGElement>("[data-hue-point]");
    const svg = point?.closest<SVGSVGElement>(".hues-editor svg");
    if (!point || !svg) return;
    event.preventDefault();
    const key = point.dataset.huePoint!;
    const row = point.dataset.row as Row;
    selected = { key, row };
    if (row === "uniform") return redraw(true);
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
      place(selected.key, wrap(Math.round(Number(el.value))));
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
    place(key, wrap(Math.round(color.current.hue) + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1)));
    redraw(true);
    document.querySelector<SVGElement>(`[data-hue-point="${key}"][data-row="current"]`)?.focus();
  });
}
