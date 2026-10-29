/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< CURVE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The colorfulness curve editor: the curve over the hue circle, drawn on the colors it changes,    |
| made of points that add up. Double-click the graph to add a point; double-click a point, or      |
| press Backspace, to remove the selected one; Option-click a point to switch it off and on; drag  |
| a point to move its hue and amount; drag the selected point's edges, or hold Option and scroll,  |
| to set its width. The selected point's values can be typed in too.                               |
\*------------------------------------------------------------------------------------------------*/

import { hueTurn, wrapHue } from "../../palette/model";
import type { Guide } from "../../palette/references";
import { type CurvePoint, LIMITS, type Mode } from "../../palette/settings";
import { boost } from "../../palette/solve";
import { refill, steadyReadout } from "../dom";
import { band, inGaps, INSETS, visibility, guideLayer, guidePicker, hueAt, hueScale, pointAt, signedWhole, stops, viewBox, WIDTH } from "../graph";

/** What one mode's editor shows. */
export interface CurveView {
  /** Whether everything shown comes from the current settings; until then the readout keeps its last text. */
  readonly settled: boolean;

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

/** The amount runs from −LIMIT to +LIMIT, its scale marked every STEP; the width runs from MIN_WIDTH to MAX_WIDTH. */
const LIMIT = LIMITS.amount[1];
const STEP = 8;
const [MIN_WIDTH, MAX_WIDTH] = LIMITS.width;

/** The Alt key's name on this device: Option on Apple's. */
const ALT = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "Option" : "Alt";

/** Drawing space: hue across, amount up, zero in the middle. */
const HEIGHT = 120;
const MIDDLE = HEIGHT / 2;
const SCALE = (HEIGHT / 2 - 8) / LIMIT;

const away = (a: number, b: number) => Math.abs(hueTurn(b, a));
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
function curveLayers(view: CurveView): string {
  const { mode, points } = view;
  const settings = { colorfulnessPerHue: { light: points, dark: points } };
  const at = (hue: number) => MIDDLE - boost(settings, mode, hue) * SCALE;
  const line = Array.from({ length: 181 }, (_, i) => i * 2)
    .map((h, i) => `${i ? "L" : "M"}${String(h)} ${at(h).toFixed(1)}`)
    .join(" ");
  const chosen = points[selected[mode]];
  const edges = !chosen
    ? []
    : chosen.width >= 180
      ? [wrapHue(chosen.center + 180)]
      : [wrapHue(chosen.center - chosen.width), wrapHue(chosen.center + chosen.width)];
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
    return `<g data-drag="point" data-index="${String(i)}" class="curve-point${i === selected[mode] ? " selected" : ""}${p.off ? " off" : ""}" tabindex="0" role="slider" aria-label="Point ${String(i + 1)}${p.off ? ", switched off" : ""}: hue ${String(p.center)}°, width ${String(p.width)}°" aria-valuemin="${String(-LIMIT)}" aria-valuemax="${String(LIMIT)}" aria-valuenow="${String(p.amount)}" aria-valuetext="${p.amount > 0 ? "+" : p.amount < 0 ? "−" : ""}${String(Math.abs(p.amount))} M">
      <circle cx="${String(p.center)}" cy="${y}" r="16" class="hit"></circle>
      <circle cx="${String(p.center)}" cy="${y}" r="${i === selected[mode] ? "7" : "5.5"}"></circle>
    </g>`;
  });
  return `<path d="${line}" class="curve-line"></path>${dots.join("")}${handles.join("")}${nodes.join("")}`;
}

/** A plus in a circle, like the ⓘ beside it. */
const PLUS = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6.75" fill="none" stroke="currentColor" stroke-width="1.25"></circle><path d="M8 4.75v6.5M4.75 8h6.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"></path></svg>`;

/**
 * Whether the curve has as many points as hues: past that, a point has no color of its own to
 * adjust. While the hues are still solving, it isn't.
 *
 * @param view  What the editor shows.
 * @returns     True when no more points fit.
 */
function full(view: CurveView): boolean {
  return view.dots.length > 0 && view.points.length >= view.dots.length;
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
  const add = `<button type="button" class="icon-button" data-curve-add aria-label="Add a point" title="${full(view) ? "As many points as hues" : "Add a point"}"${full(view) ? " disabled" : ""}>${PLUS}</button>`;
  if (!points[i]) return `<p class="soft point-count">No points: the curve is flat.${add}</p>`;
  return `<p class="soft point-count">Point ${String(i + 1)} of ${String(points.length)}${add}</p>
    <label class="field graph-check" for="curve-on-${mode}"><span>On</span><input id="curve-on-${mode}" type="checkbox" data-curve-on ${points[i].off ? "" : "checked"}></label>
    ${field(`colorfulnessPerHue.${mode}.${String(i)}.amount`, "Amount", [-LIMIT, LIMIT, 1])}
    ${field(`colorfulnessPerHue.${mode}.${String(i)}.center`, "Center", [0, 359, 1])}
    ${field(`colorfulnessPerHue.${mode}.${String(i)}.width`, "Width", [MIN_WIDTH, MAX_WIDTH, 5])}`;
}

/**
 * What the curve costs, under the graph.
 *
 * @param view  What to show.
 * @returns     Text.
 */
function curveReadout(view: CurveView): string {
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
 * Draws one mode's editor's moving parts again: the curve and its points, the band behind it, its
 * readout, and the selected point's values, the panel whole or, while a value is being typed, the
 * other values. Focus stays where it was.
 *
 * @param view   What to show.
 * @param panel  Whether the values beside the graph need drawing again (a different point).
 */
export function refreshCurve(view: CurveView, panel = false): void {
  const { mode, points } = view;
  const editor = document.querySelector(`[data-curve="${mode}"]`);
  if (!editor) return;
  refill(editor.querySelector(".curve-layers")!, curveLayers(view));
  editor.querySelector("linearGradient")!.innerHTML = stops(view.band);
  editor.querySelector(".curve-readout")!.innerHTML = steadyReadout(`curve ${view.mode}`, view.settled, () => curveReadout(view));
  if (panel) return refill(editor.querySelector(".curve-values")!, valuesPanel(view));
  const chosen = points[selected[mode]];
  if (!chosen) return;
  for (const key of ["amount", "center", "width"] as const) {
    const input = editor.querySelector<HTMLInputElement>(`[data-set="colorfulnessPerHue.${mode}.${String(selected[mode])}.${key}"]`);
    if (input && input !== document.activeElement) input.value = String(chosen[key]);
  }
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
      <text x="-16" y="${String(MIDDLE - m * SCALE + 3)}" class="axis" text-anchor="end">${signedWhole(m)}</text>`,
  );
  return `<div class="graph-editor guided curve-editor" data-curve="${mode}" style="${INSETS}">
    ${guidePicker(view.guide, `curve-${view.mode}`)}
    <div class="graph-values curve-values">${valuesPanel(view)}</div>
    <svg viewBox="${viewBox(HEIGHT)}" data-height="${String(HEIGHT)}" role="group" aria-label="Colorfulness curve, ${mode} mode">
      ${band(`band-${mode}`, stops(view.band), HEIGHT)}
      ${levels.join("")}<g class="guide-layer">${guideLayer(view.guides, HEIGHT)}</g>
      <line x1="0" x2="${String(WIDTH)}" y1="${String(MIDDLE)}" y2="${String(MIDDLE)}" class="zero"></line>
      ${hueScale(HEIGHT)}
      <g class="curve-layers">${curveLayers(view)}</g>
    </svg>
    <p class="graph-caption readout curve-readout">${steadyReadout(`curve ${view.mode}`, view.settled, () => curveReadout(view))}</p>
    <p class="graph-caption hint">Each point adds colorfulness around its center, easing to none at its width; drag a point to move it.</p>
    <details class="graph-caption hint graph-help" id="curve-help-${mode}"><summary>Keyboard and mouse</summary><ul>
      <li>Add a point: the + button, or double-click the graph.</li>
      <li>Remove it: double-click it, or focus it and press Backspace.</li>
      <li>Switch it off and on: the On box, or ${ALT}-click it.</li>
      <li>Move it: drag it, or focus it and press the arrow keys, with Shift by 10° across.</li>
      <li>Set its width: drag its edges, hold ${ALT} and scroll, or press [ and ].</li>
    </ul></details>
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
    refreshCurve(get(mode), panel);
  };
  const change = (mode: Mode, update: (p: CurvePoint) => CurvePoint, panel = false) => {
    const points = [...get(mode).points];
    const i = selected[mode];
    if (!points[i]) return;
    const next = update(points[i]);
    // A press without movement changes nothing, so the point isn't redrawn under the pointer.
    if (next.amount === points[i].amount && next.center === points[i].center && next.width === points[i].width) return;
    points[i] = next;
    apply(mode, points, panel);
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
      if (full(get(mode))) return;
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
  // A new point goes where the curve is furthest from any, at a small amount, and is selected.
  document.addEventListener("click", (event) => {
    const button = (event.target as Element).closest?.<HTMLButtonElement>("[data-curve-add]");
    const editor = editorOf(button ?? null);
    if (!button || !editor) return;
    const mode = editor.dataset.curve as Mode;
    const points = [...get(mode).points];
    if (full(get(mode))) return;
    const gap = (h: number) => Math.min(...points.map((p) => away(h, p.center)), 360);
    const center = Array.from({ length: 360 }, (_, h) => h).reduce((best, h) => (gap(h) > gap(best) ? h : best), 0);
    points.push({ amount: 4, center, width: 60 });
    selected[mode] = points.length - 1;
    apply(mode, points, true);
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
    else change(drag.mode, (p) => ({ ...p, width: clamp(Math.round(away(hue, p.center)), MIN_WIDTH, MAX_WIDTH) }));
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
      // A degree per 40 pixels scrolled: a few per mouse-wheel notch; a trackpad's many small steps add up as finely.
      wheel -= (event.deltaMode === 0 ? event.deltaY : event.deltaY * 40) / 40;
      const steps = Math.trunc(wheel);
      if (!steps) return;
      wheel -= steps;
      change(editor.dataset.curve as Mode, (p) => ({ ...p, width: clamp(p.width + steps, MIN_WIDTH, MAX_WIDTH) }));
    },
    { passive: false },
  );

  document.addEventListener("keydown", (event) => {
    // Backspace and Delete remove the selected point of the focused editor, never from elsewhere.
    const typing = (event.target as Element).closest?.("input, select, textarea, button");
    const target = (editorOf(event.target)?.dataset.curve as Mode | undefined) ?? null;
    if ((event.key === "Backspace" || event.key === "Delete") && target && !typing && get(target).points.length) {
      event.preventDefault();
      return remove(target, selected[target]);
    }
    const editor = editorOf(event.target);
    const node = (event.target as Element).closest?.<SVGElement>('[data-drag="point"]');
    if (!editor || !node) return;
    const mode = editor.dataset.curve as Mode;
    const index = Number(node.dataset.index);
    const other = index !== selected[mode];
    selected[mode] = index;
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, (p: CurvePoint) => CurvePoint> = {
      ArrowLeft: (p) => ({ ...p, center: wrapHue(p.center - step) }),
      ArrowRight: (p) => ({ ...p, center: wrapHue(p.center + step) }),
      ArrowUp: (p) => ({ ...p, amount: clamp(p.amount + 1, -LIMIT, LIMIT) }),
      ArrowDown: (p) => ({ ...p, amount: clamp(p.amount - 1, -LIMIT, LIMIT) }),
      "[": (p) => ({ ...p, width: clamp(p.width - 5, MIN_WIDTH, MAX_WIDTH) }),
      "]": (p) => ({ ...p, width: clamp(p.width + 5, MIN_WIDTH, MAX_WIDTH) }),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    change(mode, move, other);
  });
}
