/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< CURVE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The colorfulness curve editor: the curve over the hue circle, drawn on the colors it changes,    |
| made of points that add up. Double-click the graph to add a point; double-click a point, or      |
| press Backspace, to remove the selected one; Option-click a point to switch it off and on; drag  |
| a point to move its hue and amount; drag the selected point's edges, or hold Option and scroll,  |
| to set its width. The selected point's values can be typed in too.                               |
\*------------------------------------------------------------------------------------------------*/

import type { CurvePoint, Mode } from "../palette/settings";
import type { Guide } from "../palette/references";
import { boost } from "../palette/solve";
import { band, inGaps, INSETS, visibility, guideLayer, guidePicker, hueAt, hueScale, pointAt, stops, viewBox, WIDTH } from "./graph";

/** What one mode's editor shows. */
export interface CurveView {
  readonly mode: Mode;
  readonly points: readonly CurvePoint[];

  /** The palette's hues, marked on the curve. */
  readonly dots: readonly { readonly hue: number; readonly color: string }[];

  /** Colors around the circle, painted behind the curve. */
  readonly band: readonly { readonly hue: number; readonly color: string }[];

  /**
   * What the curve costs: how far each color moved from equal colorfulness on the tier that stands
   * for each hue, in colorfulness and as a color difference. Null while it solves.
   */
  readonly cost: readonly { readonly label: string; readonly added: number; readonly difference: number; readonly gap: number }[] | null;

  /** The chosen reference system and its guides. */
  readonly guide: string;
  readonly guides: readonly Guide[];
}

/** Draws a number field bound to a setting. */
type Field = (path: string, title: string, range: readonly [number, number, number]) => string;

/** The amount runs from −LIMIT to +LIMIT; the width from MIN_WIDTH to 180°. */
const LIMIT = 24;

/** The amount scale's step. */
const STEP = 8;
const MIN_WIDTH = 10;


/** Drawing space: hue across, amount up, zero in the middle. */
const HEIGHT = 120;
const MIDDLE = HEIGHT / 2;
const SCALE = (HEIGHT / 2 - 8) / LIMIT;

const wrap = (hue: number) => ((hue % 360) + 360) % 360;
const away = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Which point each mode's editor has selected. */
const selected: Record<Mode, number> = { light: 0, dark: 0 };

let field: Field = () => "";

/* >----------------------------------------< Drawing >-----------------------------------------< */

/**
 * The parts of the graph that move: the summed curve, every point, the selected point's edges,
 * and the palette's hues.
 *
 * @param view  What to show.
 * @returns     SVG.
 */
export function curveLayers(view: CurveView): string {
  const { mode, points } = view;
  const settings = { curve: { light: points, dark: points } };
  const at = (hue: number) => MIDDLE - boost(settings, mode, hue) * SCALE;
  const line = Array.from({ length: 181 }, (_, i) => i * 2)
    .map((h, i) => `${i ? "L" : "M"}${String(h)} ${at(h).toFixed(1)}`)
    .join(" ");
  const chosen = points[selected[mode]];
  const edges = !chosen
    ? []
    : chosen.width >= 180
      ? [wrap(chosen.center + 180)]
      : [wrap(chosen.center - chosen.width), wrap(chosen.center + chosen.width)];
  const handles = edges.map(
    (x) => `<g data-drag="edge" class="curve-edge">
      <rect x="${(x - 8).toFixed(1)}" y="${String(MIDDLE - 16)}" width="16" height="32" class="hit"></rect>
      <rect x="${(x - 2.5).toFixed(1)}" y="${String(MIDDLE - 9)}" width="5" height="18" rx="2.5"></rect>
    </g>`,
  );
  const dots = view.dots.map(
    (d) => `<circle cx="${d.hue.toFixed(1)}" cy="${at(d.hue).toFixed(1)}" r="4.5" style="fill:${d.color}" class="mark"></circle>`,
  );
  const nodes = points.map((p, i) => {
    const y = (MIDDLE - p.amount * SCALE).toFixed(1);
    return `<g data-drag="point" data-index="${String(i)}" class="curve-point${i === selected[mode] ? " selected" : ""}${p.off ? " off" : ""}" tabindex="0" role="slider" aria-label="Point ${String(i + 1)}${p.off ? ", switched off" : ""}: hue ${String(p.center)}°, amount ${String(p.amount)}, width ${String(p.width)}°" aria-valuenow="${String(p.amount)}">
      <circle cx="${String(p.center)}" cy="${y}" r="16" class="hit"></circle>
      <circle cx="${String(p.center)}" cy="${y}" r="${i === selected[mode] ? "7" : "5.5"}"></circle>
    </g>`;
  });
  return `<path d="${line}" class="curve-line"></path>${dots.join("")}${handles.join("")}${nodes.join("")}`;
}

/**
 * The selected point's values.
 *
 * @param view  What to show.
 * @returns     HTML.
 */
function valuesPanel(view: CurveView): string {
  const { mode, points } = view;
  const i = selected[mode];
  if (!points[i]) return `<p class="soft">No points: the curve is flat.</p>`;
  return `<p class="soft">Point ${String(i + 1)} of ${String(points.length)}</p>
    <label class="field graph-check" for="curve-on-${mode}"><span>On</span><input id="curve-on-${mode}" type="checkbox" data-curve-on ${points[i].off ? "" : "checked"}></label>
    ${field(`curve.${mode}.${String(i)}.amount`, "Amount", [-LIMIT, LIMIT, 1])}
    ${field(`curve.${mode}.${String(i)}.center`, "Hue", [0, 359, 1])}
    ${field(`curve.${mode}.${String(i)}.width`, "Width", [MIN_WIDTH, 180, 5])}`;
}

/**
 * What the curve costs, under the graph.
 *
 * @param view  What to show.
 * @returns     Text.
 */
export function curveReadout(view: CurveView): string {
  if (!view.cost) return "Solving…";
  const moved = view.cost.filter((c) => c.difference >= 0.05).toSorted((a, b) => b.difference - a.difference);
  if (!moved.length) return "Every color is equally colorful, as the model says.";
  const most = moved[0]!;
  // A color the curve doesn't touch can still move: the others re-space around the ones it does.
  const each = moved
    .map((c) => `${c.label} ${c.added ? `${c.added > 0 ? "+" : "−"}${String(Math.abs(c.added))} M` : "re-spaced"} → ${c.difference.toFixed(1)}`)
    .join(", ");
  return `Moves ${most.label} most: ${most.difference.toFixed(1)} ΔE, ${inGaps(most.difference / most.gap) || "under 0.1 gap"}, ${visibility(most.difference)}. Each (ΔE): ${each}.`;
}

/**
 * The colors painted behind the curve, as gradient stops.
 *
 * @param view  What to show.
 * @returns     SVG stops.
 */
export function bandStops(view: CurveView): string {
  return stops(view.band);
}

/**
 * One mode's editor: the selected point's values beside the graph.
 *
 * @param view       What to show.
 * @param drawField  Draws a number field bound to a setting.
 * @returns          HTML.
 */
export function curveEditor(view: CurveView, drawField: Field): string {
  field = drawField;
  const { mode } = view;
  selected[mode] = clamp(selected[mode], 0, Math.max(0, view.points.length - 1));
  const levels = Array.from({ length: (2 * LIMIT) / STEP + 1 }, (_, k) => k * STEP - LIMIT).map(
    (m) => `${m ? `<line x1="0" x2="${String(WIDTH)}" y1="${String(MIDDLE - m * SCALE)}" y2="${String(MIDDLE - m * SCALE)}" class="grid"></line>` : ""}
      <text x="-16" y="${String(MIDDLE - m * SCALE + 3)}" class="axis" text-anchor="end">${String(m)}</text>`,
  );
  return `<div class="graph-editor guided curve-editor" data-curve="${mode}" style="${INSETS}">
    ${guidePicker(view.guide, `curve-${view.mode}`)}
    <div class="graph-values curve-values">${valuesPanel(view)}</div>
    <svg viewBox="${viewBox(HEIGHT)}" data-height="${String(HEIGHT)}" role="group" aria-label="Colorfulness curve, ${mode} mode">
      ${band(`band-${mode}`, bandStops(view), HEIGHT)}
      ${levels.join("")}<g class="guide-layer">${guideLayer(view.guides, HEIGHT)}</g>
      <line x1="0" x2="${String(WIDTH)}" y1="${String(MIDDLE)}" y2="${String(MIDDLE)}" class="zero"></line>
      ${hueScale(HEIGHT)}
      <g class="curve-layers">${curveLayers(view)}</g>
    </svg>
    <p class="graph-caption readout curve-readout">${curveReadout(view)}</p>
    <p class="graph-caption hint">Double-click the graph to add a point; double-click a point, or press Backspace, to remove it; Option-click a point to switch it off and on. Drag a point to move it, and drag its edges, or hold Option and scroll, to set its width.</p>
  </div>`;
}

/* >----------------------------------------< Dragging >----------------------------------------< */

/**
 * Makes every editor on the page respond to pointer, wheel and keys.
 *
 * @param get  The current view of a mode.
 * @param set  Applies a mode's changed points.
 */
export function bindCurves(get: (mode: Mode) => CurveView, set: (mode: Mode, points: CurvePoint[]) => void): void {
  let drag: { mode: Mode; part: string; svg: SVGSVGElement } | null = null;
  let wheel = 0;

  /** The editor last pressed in, whose selected point Backspace and Delete remove. */
  let active: Mode | null = null;

  const point = (svg: SVGSVGElement, event: { clientX: number; clientY: number }) => {
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { hue: hueAt(svg, event), amount: Math.round(clamp((MIDDLE - p.y) / SCALE, -LIMIT, LIMIT)) };
  };
  /**
   * Applies new points and redraws the editor.
   *
   * @param mode    The mode.
   * @param points  Its points.
   * @param panel   Whether the values beside the graph need drawing again (a different point).
   */
  const apply = (mode: Mode, points: CurvePoint[], panel = false) => {
    set(mode, points);
    const editor = document.querySelector(`[data-curve="${mode}"]`);
    if (!editor) return;
    const view = get(mode);
    editor.querySelector(".curve-layers")!.innerHTML = curveLayers(view);
    if (panel) editor.querySelector(".curve-values")!.innerHTML = valuesPanel(view);
    const chosen = points[selected[mode]];
    if (!chosen || panel) return;
    for (const key of ["amount", "center", "width"] as const) {
      const input = editor.querySelector<HTMLInputElement>(`[data-set="curve.${mode}.${String(selected[mode])}.${key}"]`);
      if (input && input !== document.activeElement) input.value = String(chosen[key]);
    }
  };
  const change = (mode: Mode, update: (p: CurvePoint) => CurvePoint) => {
    const points = [...get(mode).points];
    const i = selected[mode];
    if (!points[i]) return;
    const next = update(points[i]);
    // A press without movement changes nothing, so the point isn't redrawn under the pointer.
    if (next.amount === points[i].amount && next.center === points[i].center && next.width === points[i].width) return;
    points[i] = next;
    apply(mode, points);
  };
  const remove = (mode: Mode, index: number) => {
    const points = [...get(mode).points];
    points.splice(index, 1);
    selected[mode] = Math.max(0, Math.min(selected[mode], points.length - 1));
    apply(mode, points, true);
  };
  const editorOf = (target: EventTarget | null) => (target as Element | null)?.closest<HTMLElement>("[data-curve]") ?? null;

  // Double-clicks are told apart here, not by the browser: the first click redraws the point, so the
  // second lands on a new element and the browser wouldn't see a double-click on it.
  let lastPress = { time: 0, on: "" };

  document.addEventListener("pointerdown", (event) => {
    active = (editorOf(event.target)?.dataset.curve as Mode | undefined) ?? null;
    const svg = (event.target as Element).closest<SVGSVGElement>("[data-curve] svg");
    if (!svg) return;
    const part = (event.target as Element).closest<SVGElement>("[data-drag]");
    const mode = editorOf(svg)!.dataset.curve as Mode;
    const on = part?.dataset.drag === "point" ? `point ${part.dataset.index!}` : part ? "edge" : "graph";
    const twice = event.timeStamp - lastPress.time < 400 && on === lastPress.on;
    lastPress = twice ? { time: 0, on: "" } : { time: event.timeStamp, on };
    // Option-click (Alt-click) switches a point off and on, keeping it where it is.
    if (event.altKey && part?.dataset.drag === "point") {
      lastPress = { time: 0, on: "" };
      const index = Number(part.dataset.index);
      const points = [...get(mode).points];
      points[index] = { ...points[index]!, off: !points[index]!.off };
      selected[mode] = index;
      return apply(mode, points, true);
    }
    if (twice && part?.dataset.drag === "point") {
      drag = null;
      return remove(mode, Number(part.dataset.index));
    }
    // The padding around the data takes no new points.
    if (twice && !part && pointAt(svg, event)) {
      const points = [...get(mode).points];
      // No more points than hues: past that, a point has no color of its own to adjust.
      if (points.length >= get(mode).dots.length) return;
      const { hue, amount } = point(svg, event);
      points.push({ amount: amount || 4, center: hue, width: 60 });
      selected[mode] = points.length - 1;
      return apply(mode, points, true);
    }
    if (!part) return;
    if (part.dataset.drag === "point" && Number(part.dataset.index) !== selected[mode]) {
      selected[mode] = Number(part.dataset.index);
      apply(mode, [...get(mode).points], true);
    }
    drag = { mode, part: part.dataset.drag!, svg };
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  document.addEventListener("change", (event) => {
    const box = event.target as HTMLInputElement;
    const editor = editorOf(box);
    if (!editor || !box.matches("[data-curve-on]")) return;
    const mode = editor.dataset.curve as Mode;
    const points = [...get(mode).points];
    const i = selected[mode];
    if (!points[i]) return;
    points[i] = { ...points[i], off: !box.checked };
    apply(mode, points, true);
  });
  document.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const { hue, amount } = point(drag.svg, event);
    if (drag.part === "point") change(drag.mode, (p) => ({ ...p, center: hue, amount }));
    else change(drag.mode, (p) => ({ ...p, width: clamp(Math.round(away(hue, p.center)), MIN_WIDTH, 180) }));
  });
  document.addEventListener("pointerup", () => (drag = null));
  document.addEventListener("pointercancel", () => (drag = null));

  document.addEventListener(
    "wheel",
    (event) => {
      // Only with Option (Alt) held, so scrolling the page over the graph still scrolls the page.
      const editor = editorOf(event.target);
      if (!event.altKey || !editor || !(event.target as Element).closest("svg")) return;
      event.preventDefault();
      // About a degree per notch of a mouse wheel; a trackpad's many small steps add up as finely.
      wheel -= (event.deltaMode === 0 ? event.deltaY : event.deltaY * 40) / 40;
      const steps = Math.trunc(wheel);
      if (!steps) return;
      wheel -= steps;
      change(editor.dataset.curve as Mode, (p) => ({ ...p, width: clamp(p.width + steps, MIN_WIDTH, 180) }));
    },
    { passive: false },
  );

  document.addEventListener("keydown", (event) => {
    // Backspace and Delete remove the selected point of the focused editor, or the one last pressed
    // in, unless typing.
    const typing = (event.target as Element).closest?.("input, select, textarea");
    const target = (editorOf(event.target)?.dataset.curve as Mode | undefined) ?? active;
    if ((event.key === "Backspace" || event.key === "Delete") && target && !typing && get(target).points.length) {
      event.preventDefault();
      return remove(target, selected[target]);
    }
    const editor = editorOf(event.target);
    const node = (event.target as Element).closest?.<SVGElement>('[data-drag="point"]');
    if (!editor || !node) return;
    const mode = editor.dataset.curve as Mode;
    selected[mode] = Number(node.dataset.index);
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, (p: CurvePoint) => CurvePoint> = {
      ArrowLeft: (p) => ({ ...p, center: wrap(p.center - step) }),
      ArrowRight: (p) => ({ ...p, center: wrap(p.center + step) }),
      ArrowUp: (p) => ({ ...p, amount: clamp(p.amount + 1, -LIMIT, LIMIT) }),
      ArrowDown: (p) => ({ ...p, amount: clamp(p.amount - 1, -LIMIT, LIMIT) }),
      "[": (p) => ({ ...p, width: clamp(p.width - 5, MIN_WIDTH, 180) }),
      "]": (p) => ({ ...p, width: clamp(p.width + 5, MIN_WIDTH, 180) }),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    change(mode, move);
    // The point is drawn anew, so focus goes back to it.
    editor.querySelector<SVGElement>(`[data-drag="point"][data-index="${String(selected[mode])}"]`)?.focus();
  });
}
