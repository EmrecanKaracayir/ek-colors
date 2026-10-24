/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< CURVE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The colorfulness curve editor: the curve over the hue circle, drawn on the colors it changes.    |
| Drag the point to move its hue and amount, drag either edge to set its width, or scroll over it  |
| to widen and narrow it. The values beside it can be typed in too.                                |
\*------------------------------------------------------------------------------------------------*/

import type { Curve, Mode } from "../palette/settings";
import { boost } from "../palette/solve";

/** What one mode's editor shows. */
export interface CurveView {
  readonly mode: Mode;
  readonly curve: Curve;

  /** The palette's hues, marked on the curve. */
  readonly dots: readonly { readonly hue: number; readonly color: string }[];

  /** Colors around the circle, painted behind the curve. */
  readonly band: readonly { readonly hue: number; readonly color: string }[];
}

/** The amount runs from −LIMIT to +LIMIT; the width from MIN_WIDTH to 180°. */
const LIMIT = 20;
const MIN_WIDTH = 10;

/** Drawing space: hue across, amount up, zero in the middle. */
const [WIDTH, HEIGHT] = [360, 120];
const MIDDLE = HEIGHT / 2;
const SCALE = (HEIGHT / 2 - 8) / LIMIT;

const wrap = (hue: number) => ((hue % 360) + 360) % 360;
const away = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/* >----------------------------------------< Drawing >-----------------------------------------< */

/**
 * The parts of the graph that move: the curve, its point and edges, and the palette's hues.
 *
 * @param view  What to show.
 * @returns     SVG.
 */
export function curveLayers(view: CurveView): string {
  const { mode, curve } = view;
  const at = (hue: number) => MIDDLE - boost({ curve: { [mode]: curve } as Record<Mode, Curve> }, mode, hue) * SCALE;
  const line = Array.from({ length: 181 }, (_, i) => i * 2)
    .map((h, i) => `${i ? "L" : "M"}${String(h)} ${at(h).toFixed(1)}`)
    .join(" ");
  const edges = curve.width >= 180 ? [wrap(curve.center + 180)] : [wrap(curve.center - curve.width), wrap(curve.center + curve.width)];
  const handles = edges.map(
    (x, i) => `<g data-drag="${i ? "right" : "left"}" class="curve-edge">
      <rect x="${(x - 8).toFixed(1)}" y="${String(MIDDLE - 16)}" width="16" height="32" class="hit"></rect>
      <rect x="${(x - 2.5).toFixed(1)}" y="${String(MIDDLE - 9)}" width="5" height="18" rx="2.5"></rect>
    </g>`,
  );
  const dots = view.dots.map(
    (d) => `<circle cx="${d.hue.toFixed(1)}" cy="${at(d.hue).toFixed(1)}" r="4.5" style="fill:${d.color}" class="mark"></circle>`,
  );
  const y = MIDDLE - curve.amount * SCALE;
  return `<path d="${line}" class="curve-line"></path>${dots.join("")}${handles.join("")}
    <g data-drag="point" class="curve-point" tabindex="0" role="slider" aria-label="Curve point: hue ${String(curve.center)}°, amount ${String(curve.amount)}" aria-valuenow="${String(curve.amount)}">
      <circle cx="${String(curve.center)}" cy="${y.toFixed(1)}" r="16" class="hit"></circle>
      <circle cx="${String(curve.center)}" cy="${y.toFixed(1)}" r="7"></circle>
    </g>`;
}

/**
 * The colors painted behind the curve, as gradient stops.
 *
 * @param view  What to show.
 * @returns     SVG stops.
 */
export function bandStops(view: CurveView): string {
  return view.band.map((b) => `<stop offset="${(b.hue / 360).toFixed(4)}" stop-color="${b.color}"></stop>`).join("");
}

/**
 * One mode's editor: its values beside the graph.
 *
 * @param view   What to show.
 * @param field  Draws a number field bound to a setting.
 * @returns      HTML.
 */
export function curveEditor(view: CurveView, field: (path: string, title: string, range: readonly [number, number, number]) => string): string {
  const { mode } = view;
  const guides = [-LIMIT, -LIMIT / 2, LIMIT / 2, LIMIT].map(
    (m) => `<line x1="0" x2="${String(WIDTH)}" y1="${String(MIDDLE - m * SCALE)}" y2="${String(MIDDLE - m * SCALE)}" class="grid"></line>
      <text x="-4" y="${String(MIDDLE - m * SCALE + 3)}" class="axis" text-anchor="end">${m > 0 ? "+" : ""}${String(m)}</text>`,
  );
  const hues = [0, 90, 180, 270, 360].map(
    (h) => `<text x="${String(h)}" y="${String(HEIGHT + 14)}" class="axis" text-anchor="middle">${String(h)}°</text>`,
  );
  return `<div class="curve-editor" data-curve="${mode}">
    <div class="curve-values">
      ${field(`curve.${mode}.amount`, "Amount", [-LIMIT, LIMIT, 1])}
      ${field(`curve.${mode}.center`, "Hue", [0, 359, 1])}
      ${field(`curve.${mode}.width`, "Width", [MIN_WIDTH, 180, 5])}
    </div>
    <svg viewBox="-22 -4 396 ${String(HEIGHT + 22)}" role="group" aria-label="Colorfulness curve, ${mode} mode">
      <defs><linearGradient id="band-${mode}">${bandStops(view)}</linearGradient></defs>
      <rect x="0" y="0" width="${String(WIDTH)}" height="${String(HEIGHT)}" rx="6" fill="url(#band-${mode})" class="curve-band"></rect>
      ${guides.join("")}
      <line x1="0" x2="${String(WIDTH)}" y1="${String(MIDDLE)}" y2="${String(MIDDLE)}" class="zero"></line>
      ${hues.join("")}
      <g class="curve-layers">${curveLayers(view)}</g>
    </svg>
  </div>`;
}

/* >----------------------------------------< Dragging >----------------------------------------< */

/**
 * Makes every editor on the page respond to pointer, wheel and keys.
 *
 * @param get  The current view of a mode.
 * @param set  Applies a changed curve.
 */
export function bindCurves(get: (mode: Mode) => CurveView, set: (mode: Mode, curve: Curve) => void): void {
  let drag: { mode: Mode; part: string; svg: SVGSVGElement } | null = null;

  const point = (svg: SVGSVGElement, event: PointerEvent) => {
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { hue: wrap(Math.round(clamp(p.x, 0, WIDTH))), amount: Math.round(clamp((MIDDLE - p.y) / SCALE, -LIMIT, LIMIT)) };
  };
  const apply = (mode: Mode, curve: Curve) => {
    set(mode, curve);
    const editor = document.querySelector(`[data-curve="${mode}"]`);
    if (!editor) return;
    editor.querySelector(".curve-layers")!.innerHTML = curveLayers(get(mode));
    for (const key of ["amount", "center", "width"] as const) {
      const input = editor.querySelector<HTMLInputElement>(`[data-set="curve.${mode}.${key}"]`);
      if (input && input !== document.activeElement) input.value = String(curve[key]);
    }
  };
  const move = (event: PointerEvent) => {
    if (!drag) return;
    const { hue, amount } = point(drag.svg, event);
    const curve = get(drag.mode).curve;
    if (drag.part === "point") apply(drag.mode, { ...curve, center: hue, amount });
    else apply(drag.mode, { ...curve, width: clamp(Math.round(away(hue, curve.center)), MIN_WIDTH, 180) });
  };

  document.addEventListener("pointerdown", (event) => {
    const svg = (event.target as Element).closest<SVGSVGElement>("[data-curve] svg");
    if (!svg) return;
    const mode = svg.closest<HTMLElement>("[data-curve]")!.dataset.curve as Mode;
    // A press on the graph itself picks up the point there, so it can be placed in one move.
    const part = (event.target as Element).closest<SVGElement>("[data-drag]")?.dataset.drag ?? "point";
    drag = { mode, part, svg };
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
    move(event);
  });
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", () => (drag = null));
  document.addEventListener("pointercancel", () => (drag = null));

  document.addEventListener(
    "wheel",
    (event) => {
      const editor = (event.target as Element).closest<HTMLElement>("[data-curve]");
      if (!editor || !(event.target as Element).closest("svg")) return;
      event.preventDefault();
      const mode = editor.dataset.curve as Mode;
      const curve = get(mode).curve;
      apply(mode, { ...curve, width: clamp(curve.width + (event.deltaY > 0 ? -5 : 5), MIN_WIDTH, 180) });
    },
    { passive: false },
  );

  document.addEventListener("dblclick", (event) => {
    const editor = (event.target as Element).closest<HTMLElement>("[data-curve]");
    if (!editor || !(event.target as Element).closest('[data-drag="point"]')) return;
    const mode = editor.dataset.curve as Mode;
    apply(mode, { ...get(mode).curve, amount: 0 });
  });

  document.addEventListener("keydown", (event) => {
    const editor = (event.target as Element).closest<HTMLElement>("[data-curve]");
    if (!editor || !(event.target as Element).closest('[data-drag="point"]')) return;
    const mode = editor.dataset.curve as Mode;
    const curve = get(mode).curve;
    const step = event.shiftKey ? 10 : 1;
    const next: Record<string, Curve> = {
      ArrowLeft: { ...curve, center: wrap(curve.center - step) },
      ArrowRight: { ...curve, center: wrap(curve.center + step) },
      ArrowUp: { ...curve, amount: clamp(curve.amount + 1, -LIMIT, LIMIT) },
      ArrowDown: { ...curve, amount: clamp(curve.amount - 1, -LIMIT, LIMIT) },
      "[": { ...curve, width: clamp(curve.width - 5, MIN_WIDTH, 180) },
      "]": { ...curve, width: clamp(curve.width + 5, MIN_WIDTH, 180) },
    };
    const changed = next[event.key];
    if (!changed) return;
    event.preventDefault();
    apply(mode, changed);
    // The point is drawn anew, so focus goes back to it.
    editor.querySelector<SVGElement>('[data-drag="point"]')?.focus();
  });
}
