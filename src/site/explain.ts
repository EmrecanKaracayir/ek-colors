/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< EXPLAIN >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| How it works: the palette solver told step by step, each step with a small live demo that uses   |
| the same code as the solver.                                                                     |
\*------------------------------------------------------------------------------------------------*/

import { apca, composition, makeModel, type Model, parts, wcag, wcagLevel } from "../palette/model";
import { type Gamut, GAMUT_NAMES, GAMUTS, type Mode, MODE_NAMES, MODES, ROLES, type Settings } from "../palette/settings";
import { anchorHue, anchorSource } from "../palette/references";
import { escape, signedWhole, zoneTable } from "./graph";
import { autoIdentity, boost, type GamutPalette, hueKeys, identityOf, lineup, strongest } from "../palette/solve";

/* >----------------------------------------< Context >-----------------------------------------< */

/** What the page is showing. */
export interface Context {
  readonly settings: Settings;
  readonly mode: Mode;
  readonly gamut: Gamut;
  readonly palette: GamutPalette | null;
  readonly label: (key: string) => string;
}

/* >----------------------------------------< Helpers >-----------------------------------------< */

/** What each demo control is set to, kept while the page is drawn again. */
const chosen = new Map<string, string>();

/** What a demo control starts at, before it's moved. */
const STARTS: Readonly<Record<string, (ctx: Context) => string | number>> = {
  "demo-hue": () => 25,
  "demo-lc": () => 60,
  "demo-tier": (ctx) => ctx.settings.tiers.at(-1) ?? 60,
  "demo-a": (ctx) => hues(ctx)[0]?.key ?? "",
  "demo-b": (ctx) => hues(ctx)[1]?.key ?? "",
  "demo-dtier": (ctx) => identityOf(ctx.settings, ctx.mode),
  "demo-amount": (ctx) => Math.max(-12, Math.min(12, ctx.settings.curve[ctx.mode][0]?.amount ?? 6)),
  "demo-center": (ctx) => ctx.settings.curve[ctx.mode][0]?.center ?? 20,
  "demo-width": (ctx) => Math.max(20, Math.min(180, ctx.settings.curve[ctx.mode][0]?.width ?? 60)),
  "demo-color": (ctx) => ctx.palette?.[ctx.mode].colors[0]?.key ?? "",
};

/**
 * What a demo control is set to: as moved, or where it starts.
 *
 * @param ctx  What the page shows.
 * @param id   The control.
 * @returns    Its value.
 */
function setting(ctx: Context, id: string): string {
  return chosen.get(id) ?? String(STARTS[id]?.(ctx) ?? "");
}

/**
 * A tier a demo control is set to, or where it starts when the tier isn't solved any more.
 *
 * @param ctx  What the page shows.
 * @param id   The control.
 * @returns    The tier.
 */
function tierSetting(ctx: Context, id: string): number {
  const tier = Number(setting(ctx, id));
  return ctx.settings.tiers.includes(tier) ? tier : Number(STARTS[id]!(ctx));
}

/**
 * A demo's slider, at what it's set to.
 *
 * @param ctx    What the page shows.
 * @param id     Its id.
 * @param label  Its label.
 * @param range  Min, max and step.
 * @param range.0  Minimum.
 * @param range.1  Maximum.
 * @param range.2  Step.
 * @param demo   The demo it redraws.
 * @returns      HTML.
 */
function slider(ctx: Context, id: string, label: string, [min, max, step]: readonly [number, number, number], demo: string): string {
  return `<label for="${id}">${label} <input id="${id}" type="range" min="${String(min)}" max="${String(max)}" step="${String(step)}" value="${setting(ctx, id)}" data-demo="${demo}"></label>`;
}

/**
 * A demo's choice, with what it's set to selected.
 *
 * @param ctx      What the page shows.
 * @param id       Its id.
 * @param label    Its label.
 * @param options  Each option's value and text.
 * @param demo     The demo it redraws.
 * @returns        HTML.
 */
function choice(ctx: Context, id: string, label: string, options: readonly (readonly [string, string])[], demo: string): string {
  // A choice that isn't offered any more, like a tier switched off, shows where the control starts.
  const set = setting(ctx, id);
  const now = options.some(([v]) => v === set) ? set : String(STARTS[id]?.(ctx) ?? "");
  return `<label for="${id}">${label} <select id="${id}" data-demo="${demo}">${options
    .map(([v, text]) => `<option value="${v}" ${v === now ? "selected" : ""}>${text}</option>`)
    .join("")}</select></label>`;
}

/** The tiers as choices. */
const tierOptions = (ctx: Context) => ctx.settings.tiers.map((t) => [String(t), `Lc ${String(t)}`] as const);

const models = new Map<string, Model>();

/**
 * A color model, kept while its settings stay the same.
 *
 * @param settings  The bases and rooms.
 * @param gamut     The gamut tier.
 * @returns         The model.
 */
function model(settings: Pick<Settings, "bases" | "rooms">, gamut: Gamut): Model {
  const key = JSON.stringify([settings.bases, settings.rooms, gamut]);
  let m = models.get(key);
  if (!m) models.set(key, (m = makeModel(settings, gamut)));
  return m;
}

/**
 * The hues of the palette on screen, with their keys and identity colors.
 *
 * @param ctx  What the page shows.
 * @returns    One entry per hue (extra colors left out).
 */
function hues(ctx: Context) {
  const tier = identityOf(ctx.settings, ctx.mode);
  return (ctx.palette?.[ctx.mode].colors ?? [])
    .filter((c) => !c.extra)
    .map((c) => ({ key: c.key, hue: c.tiers[tier]!.default.hue, color: c.tiers[tier]!.default.color }));
}

/* >-----------------------------------------< Demos >------------------------------------------< */

/**
 * The room chart: how colorful one screen color looks as the room gets brighter, with the rooms
 * the two modes are solved for marked.
 *
 * @param ctx  What the page shows.
 * @returns    SVG.
 */
function room(ctx: Context): string {
  const first = hues(ctx)[0];
  if (!first) return "Solving…";
  const surround = ctx.settings.rooms[ctx.mode].surround;
  const looks = (lux: number) => {
    const here = { lux, surround };
    return model({ bases: ctx.settings.bases, rooms: { light: here, dark: here } }, ctx.gamut).cam(
      ctx.mode,
      first.color,
    ).m;
  };
  const [left, width, top, height] = [44, 540, 12, 180];
  const [lo, hi] = [0, 4];
  const x = (lux: number) => left + ((Math.log10(lux) - lo) / (hi - lo)) * width;
  const points = Array.from({ length: 41 }, (_, i) => 10 ** (lo + (i / 40) * (hi - lo)));
  const values = points.map(looks);
  const [min, max] = [Math.floor(Math.min(...values) / 10) * 10, Math.ceil(Math.max(...values) / 10) * 10];
  const y = (m: number) => top + height - ((m - min) / (max - min)) * height;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)} ${y(values[i]!).toFixed(1)}`).join(" ");
  const yTicks = Array.from({ length: (max - min) / 10 + 1 }, (_, i) => min + i * 10).map(
    (m) => `<line x1="${String(left)}" x2="${String(left + width)}" y1="${y(m).toFixed(1)}" y2="${y(m).toFixed(1)}" class="grid"></line>
      <text x="${String(left - 8)}" y="${(y(m) + 4).toFixed(1)}" class="axis" text-anchor="end">${String(m)}</text>`,
  );
  const xTicks = [
    [1, "Dark room"],
    [10, "10 lux"],
    [100, "100"],
    [1000, "Office 1 000"],
    [10_000, "Daylight"],
  ] as const;
  const marks = (["dark", "light"] as const).map((mode) => {
    const lux = ctx.settings.rooms[mode].lux;
    const m = looks(lux);
    return `<line x1="${x(lux).toFixed(1)}" x2="${x(lux).toFixed(1)}" y1="${String(top)}" y2="${String(top + height)}" class="target"></line>
      <circle cx="${x(lux).toFixed(1)}" cy="${y(m).toFixed(1)}" r="6" style="fill:${first.color}" class="${mode === ctx.mode ? "" : "other"}"></circle>
      <text x="${(x(lux) + 8).toFixed(1)}" y="${String(top + (mode === "dark" ? 12 : 30))}" class="axis label">${mode === "dark" ? "Dark mode" : "Light mode"} • ${String(lux)} lux</text>`;
  });
  const named = (["dark", "light"] as const).map((mode) => `M ${looks(ctx.settings.rooms[mode].lux).toFixed(0)} in ${mode} mode's ${String(ctx.settings.rooms[mode].lux)} lux`).join(", ");
  return `<svg class="chart" viewBox="0 0 ${String(left + width + 20)} ${String(top + height + 30)}" role="img" aria-label="How colorful ${ctx.label(first.key).toLowerCase()} looks as the room gets brighter: ${named}" aria-describedby="room-note">
      ${yTicks.join("")}
      ${xTicks.map(([lux, text]) => `<text x="${x(lux).toFixed(1)}" y="${String(top + height + 20)}" class="axis" text-anchor="${lux === 1 ? "start" : lux === 10_000 ? "end" : "middle"}">${text}</text>`).join("")}
      <path d="${line}" fill="none" style="stroke:${first.color}" stroke-width="3" stroke-linecap="round"></path>
      ${marks.join("")}
    </svg>
    <p class="soft" id="room-note">How colorful the palette's ${ctx.label(first.key).toLowerCase()} looks (M), from a dark room to daylight. The screen color never changes.</p>`;
}

/**
 * The same hue at the same colorfulness on the same tier, solved for each mode on its own base and
 * in its own room, with how much color the screen gives each.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function modes(ctx: Context): string {
  const first = hues(ctx)[0];
  if (!first) return "Solving…";
  const lc = identityOf(ctx.settings, "light");
  const m = model(ctx.settings, ctx.gamut);
  const reach = (mode: Mode) => {
    try {
      return m.cam(mode, strongest(m, ctx.settings.bases[mode], mode, first.hue, 200, lc)).m;
    } catch {
      return 0;
    }
  };
  // As colorful as both modes can be here, so each sits exactly on it.
  const target = Math.floor(Math.min(30, reach("light"), reach("dark")));
  let colors: Record<Mode, string>;
  try {
    colors = { light: strongest(m, ctx.settings.bases.light, "light", first.hue, target, lc), dark: strongest(m, ctx.settings.bases.dark, "dark", first.hue, target, lc) };
  } catch {
    return `<p class="soft">No color at this hue reaches Lc ${String(lc)} on both bases.</p>`;
  }
  const pair = MODES.map((mode) => {
    const color = colors[mode];
    const cam = m.cam(mode, color);
    return `<figure class="on-base" style="--base:${ctx.settings.bases[mode]};--c:${color};--ink:var(--fg-${mode})">
      <span class="demo-swatch"></span><span class="on-base-sample">Aa</span>
      <figcaption><strong>${MODE_NAMES[mode]} mode</strong><span>Looks M ${cam.m.toFixed(0)} • chroma C ${cam.chroma.toFixed(0)}</span></figcaption>
    </figure>`;
  });
  return `<div class="demo-pair">${pair.join("")}</div><p class="soft">${ctx.label(first.key)}'s hue at M ${String(target)} on Lc ${String(lc)}, in each mode's room.</p>`;
}

/**
 * The tier demo: a hue placed exactly on a contrast.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function tier(ctx: Context): string {
  const hue = Number(setting(ctx, "demo-hue"));
  const lc = Number(setting(ctx, "demo-lc"));
  const base = ctx.settings.bases[ctx.mode];
  let color: string;
  try {
    color = strongest(model(ctx.settings, ctx.gamut), base, ctx.mode, hue, ctx.settings.colorfulness, lc);
  } catch {
    return `<p class="soft">No color at this hue reaches Lc ${String(lc)} on this base.</p>`;
  }
  const cam = model(ctx.settings, ctx.gamut).cam(ctx.mode, color);
  const ratio = wcag(color, base);
  return `<span class="demo-swatch" style="--c:${color}"></span>
    <span class="demo-sample" style="color:${color}">Aa Palette</span>
    <dl class="demo-numbers">
      <div><dt>APCA</dt><dd class="mono">Lc ${apca(color, base).toFixed(1)}</dd></div>
      <div><dt>WCAG 2</dt><dd class="mono">${ratio.toFixed(2)} • ${wcagLevel(ratio)}</dd></div>
      <div><dt>Lightness J</dt><dd class="mono">${cam.j.toFixed(1)}</dd></div>
      <div><dt>Colorfulness M</dt><dd class="mono">${cam.m.toFixed(1)}</dd></div>
      <div><dt>Hue</dt><dd class="mono">${cam.hue.toFixed(0)}° • ${composition(cam.hue)}</dd></div>
    </dl>`;
}

/**
 * A color as a gamut tier's bar: quieter for standard, as is for wide, stronger for ultra.
 *
 * @param color  The hue's color.
 * @param gamut  The gamut tier.
 * @returns      A CSS color.
 */
function shade(color: string, gamut: Gamut): string {
  if (gamut === "standard") return `color-mix(in oklch, ${color} 45%, var(--soft))`;
  if (gamut === "ultra") return `oklch(from ${color} l calc(c * 1.6) h)`;
  return color;
}

/**
 * The reach chart: how colorful each hue can be on a tier, on each gamut tier, with the hue that
 * sets the tier picked out.
 *
 * @param ctx  What the page shows.
 * @returns    SVG and its legend.
 */
function reach(ctx: Context): string {
  const list = hues(ctx);
  if (!list.length) return "Solving…";
  const lc = tierSetting(ctx, "demo-tier");
  const base = ctx.settings.bases[ctx.mode];
  const rows = list.map((h) => ({
    ...h,
    reach: GAMUTS.map((g) => {
      const m = model(ctx.settings, g);
      try {
        return m.cam(ctx.mode, strongest(m, base, ctx.mode, h.hue, 200, lc)).m;
      } catch {
        return 0;
      }
    }),
  }));
  const shown = GAMUTS.indexOf(ctx.gamut);
  const target = ctx.settings.colorfulness;
  const least = rows.reduce((a, r) => (r.reach[shown]! < a.reach[shown]! ? r : a));
  // Only with Equal per tier does the tier stop at its least colorful hue.
  const limited = ctx.settings.equalTiers && least.reach[shown]! < target;
  const ceiling = limited ? least.reach[shown]! : target;
  const most = Math.ceil(Math.max(target, ...rows.flatMap((r) => r.reach)) / 20) * 20;
  const [left, width, row] = [96, 504, 34];
  const x = (m: number) => left + (Math.min(m, most) / most) * width;
  const height = rows.length * row + 40;
  const ticks = Array.from({ length: most / 20 + 1 }, (_, i) => i * 20).map(
    (m) => `<line x1="${String(x(m))}" x2="${String(x(m))}" y1="0" y2="${String(height - 24)}" class="grid"></line>
      <text x="${String(x(m))}" y="${String(height - 8)}" class="axis" text-anchor="middle">${String(m)}</text>`,
  );
  const bars = rows.map((r, i) => {
    const y = i * row + 6;
    const limit = limited && r === least;
    return `<g class="${limit ? "limiter" : limited ? "follower" : ""}">
      <text x="0" y="${String(y + 15)}" class="axis label">${ctx.label(r.key)}${limited && !limit ? " ↓" : ""}</text>
      ${r.reach
        .map(
          (m, g) =>
            `<rect x="${String(left)}" y="${String(y + g * 8)}" width="${(x(m) - left).toFixed(1)}" height="6" rx="3" fill="${r.color}" style="fill:${shade(r.color, GAMUTS[g]!)}"></rect>`,
        )
        .join("")}</g>`;
  });
  const key = (g: Gamut) =>
    `<span><i class="bar-key" style="background:${shade(least.color, g)}"></i>${GAMUT_NAMES[g]}</span>`;
  return `<svg class="chart" viewBox="0 0 ${String(left + width + 20)} ${String(height)}" role="img" aria-label="How colorful each hue can be on Lc ${String(lc)} in ${ctx.mode} mode, on Standard, Wide and Ultra" aria-describedby="reach-note">
      ${ticks.join("")}${bars.join("")}
      <line x1="${String(x(target))}" x2="${String(x(target))}" y1="0" y2="${String(height - 24)}" class="target"></line>
      <line x1="${x(ceiling).toFixed(1)}" x2="${x(ceiling).toFixed(1)}" y1="0" y2="${String(height - 24)}" class="ceiling"></line>
    </svg>
    <p class="demo-verdict" id="reach-note">${
      limited
        ? `On ${GAMUT_NAMES[ctx.gamut]}, <strong>${ctx.label(least.key)}</strong> can only reach M ${ceiling.toFixed(1)} on Lc ${String(lc)}, so every color on this tier stops there.`
        : least.reach[shown]! < target
          ? `On ${GAMUT_NAMES[ctx.gamut]}, <strong>${ctx.label(least.key)}</strong> can only reach M ${least.reach[shown]!.toFixed(1)} on Lc ${String(lc)}; with Equal per tier off, each color goes as far as it can.`
          : `On ${GAMUT_NAMES[ctx.gamut]}, every hue reaches the target on Lc ${String(lc)}.`
    }</p>
    <p class="legend-row soft">${GAMUTS.map(key).join("")}
      <span><i class="line-key target"></i>Target M ${String(target)}</span><span><i class="line-key ceiling"></i>This tier on ${GAMUT_NAMES[ctx.gamut]}</span>${limited ? "<span>↓ Lowered</span>" : ""}</p>`;
}

/**
 * The difference demo: how different two colors of the palette look, and what the difference is
 * made of.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function difference(ctx: Context): string {
  const colors = (ctx.palette?.[ctx.mode].colors ?? []).filter((c) => !c.extra);
  if (colors.length < 2) return "Solving…";
  const lc = tierSetting(ctx, "demo-dtier");
  const pick = (id: string, fallback: number) => colors.find((c) => c.key === setting(ctx, id)) ?? colors[fallback]!;
  const [a, b] = [pick("demo-a", 0), pick("demo-b", 1)];
  const [ca, cb] = [a.tiers[lc]!.default.color, b.tiers[lc]!.default.color];
  const m = model(ctx.settings, ctx.gamut);
  const [x, y] = [m.cam(ctx.mode, ca), m.cam(ctx.mode, cb)];
  const total = x.distance(y);
  const share = parts(x, y);
  const percent = (part: number) => `${String(Math.round(part * 100))}%`;
  const ring = ctx.palette?.[ctx.mode].ring[lc] ?? [];
  const typical = ring.length ? ring.reduce((s, d) => s + d, 0) / ring.length : 0;
  const scale = Math.max(30, Math.ceil(total / 10) * 10);
  const at = (d: number) => `${((Math.min(d, scale) / scale) * 100).toFixed(1)}%`;
  return `<div class="demo-touch"><span style="--c:${ca}"></span><span style="--c:${cb}"></span></div>
    <p class="demo-sample"><span style="color:${ca}">${ctx.label(a.key)}</span> <span style="color:${cb}">${ctx.label(b.key)}</span></p>
    <dl class="demo-numbers">
      <div><dt>Difference</dt><dd class="mono">${total.toFixed(1)}</dd></div>
      <div><dt>From lightness</dt><dd class="mono">${percent(share.lightness)}</dd></div>
      <div><dt>From colorfulness</dt><dd class="mono">${percent(share.colorfulness)}</dd></div>
      <div><dt>From hue</dt><dd class="mono">${percent(share.hue)}</dd></div>
    </dl>
    <div class="scale">
      <span class="scale-fill" style="width:${at(total)}"></span>
      <span class="scale-mark" style="left:${at(1.5)}"><span>Just visible</span></span>
      ${typical ? `<span class="scale-mark" style="left:${at(typical)}"><span>Neighbors on this tier</span></span>` : ""}
    </div>
    <p class="soft">CAM16-UCS distance, and the share of it each part makes up. Around 1 to 2 is the smallest difference most people see with two colors side by side. On a tier, every color solves to sit about the same distance from its neighbors, which is why the circle below stays even.</p>`;
}

/**
 * The spacing chart: how different each color is from the next on the identity tier.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function spacing(ctx: Context): string {
  const list = hues(ctx);
  const ring = ctx.palette?.[ctx.mode].ring[identityOf(ctx.settings, ctx.mode)] ?? [];
  if (!ring.length) return "Solving…";
  const most = Math.max(...ring);
  return ring
    .map(
      (d, i) => `<div class="bar-row"><span class="soft">${ctx.label(list[i]!.key)} → ${ctx.label(list[(i + 1) % list.length]!.key)}</span>
        <span class="bar"><span style="width:${((d / most) * 100).toFixed(1)}%"></span></span><span class="mono">${d.toFixed(1)}</span></div>`,
    )
    .join("");
}

/**
 * The curve demo: one bump of colorfulness over hue, shaped by its controls, with what it does to
 * each hue on the identity tier. It changes nothing in the palette.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function bump(ctx: Context): string {
  const list = hues(ctx);
  const tierLc = identityOf(ctx.settings, ctx.mode);
  const target = ctx.palette?.[ctx.mode].targets[tierLc];
  if (!list.length || target === undefined) return "Solving…";
  const point = { amount: Number(setting(ctx, "demo-amount")), center: Number(setting(ctx, "demo-center")), width: Number(setting(ctx, "demo-width")) };
  const added = (hue: number) => boost({ curve: { light: [point], dark: [point] } }, ctx.mode, hue);
  const [left, width, top, height, most] = [36, 564, 10, 120, 12];
  const x = (hue: number) => left + (hue / 360) * width;
  const y = (m: number) => top + height / 2 - (Math.max(-most, Math.min(most, m)) / most) * (height / 2);
  const line = Array.from({ length: 181 }, (_, i) => `${i ? "L" : "M"}${x(i * 2).toFixed(1)} ${y(added(i * 2)).toFixed(1)}`).join(" ");
  const grid = [-12, -6, 0, 6, 12].map(
    (m) => `<line x1="${String(left)}" x2="${String(left + width)}" y1="${y(m).toFixed(1)}" y2="${y(m).toFixed(1)}" class="${m === 0 ? "target" : "grid"}"></line>
      <text x="${String(left - 6)}" y="${(y(m) + 4).toFixed(1)}" class="axis" text-anchor="end">${signedWhole(m)}</text>`,
  );
  const ticks = [0, 90, 180, 270, 360].map((h) => `<text x="${x(h).toFixed(1)}" y="${String(top + height + 16)}" class="axis" text-anchor="middle">${String(h)}°</text>`);
  const dots = list.map((h) => `<circle cx="${x(h.hue).toFixed(1)}" cy="${y(added(h.hue)).toFixed(1)}" r="6" style="fill:${h.color}" class="mark"></circle>`);
  const m = model(ctx.settings, ctx.gamut);
  const base = ctx.settings.bases[ctx.mode];
  const swatch = (hue: number, aim: number) => {
    try {
      return strongest(m, base, ctx.mode, hue, aim, tierLc);
    } catch {
      return "transparent";
    }
  };
  const row = (aim: (hue: number) => number) => `<div class="demo-touch short">${list.map((h) => `<span style="--c:${swatch(h.hue, aim(h.hue))}"></span>`).join("")}</div>`;
  return `<svg class="chart" viewBox="0 0 ${String(left + width + 12)} ${String(top + height + 24)}" role="img" aria-label="Colorfulness added over hue: ${signedWhole(point.amount)} at ${String(point.center)}°, easing to none ${String(point.width)}° away" aria-describedby="bump-note">
      ${grid.join("")}${ticks.join("")}<path d="${line}" fill="none" class="curve-line"></path>${dots.join("")}
    </svg>
    <div class="swatch-rows"><span class="soft">Without</span>${row(() => target)}<span class="soft">With</span>${row((hue) => target + added(hue))}</div>
    <p class="soft" id="bump-note">Lc ${String(tierLc)}, aiming at M ${target.toFixed(1)}. The colors move only where the bump reaches; this is a sandbox and changes nothing in the palette.</p>`;
}

/**
 * The placing chart: where each color would start evenly from the anchor, and where it sits in the
 * palette, placed colors ringed.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function placing(ctx: Context): string {
  const s = ctx.settings;
  const list = hues(ctx);
  if (!list.length) return "Solving…";
  const { keys } = lineup(s);
  const anchor = anchorHue(s);
  const [left, width] = [12, 576];
  const x = (hue: number) => left + ((((hue % 360) + 360) % 360) / 360) * width;
  const rows = keys.flatMap((key, k) => {
    const color = list.find((h) => h.key === key);
    if (!color) return [];
    const even = anchor + (k * 360) / keys.length;
    const placed = k > 0 && s.placed[key] !== undefined;
    return [{ key, color: color.color, even, landed: color.hue, placed, anchor: k === 0 }];
  });
  const marks = rows
    .map((r, i) => {
      const [from, to] = [x(r.even), x(r.landed)];
      // Moves that wrap past 0° are drawn the short way, off the edge.
      const across = Math.abs(to - from) > width / 2 ? (to < from ? to + width : to - width) : to;
      return `<line x1="${from.toFixed(1)}" y1="34" x2="${across.toFixed(1)}" y2="76" class="grid"></line>
        <line x1="${from.toFixed(1)}" x2="${from.toFixed(1)}" y1="26" y2="40" class="tick"></line>
        <circle cx="${to.toFixed(1)}" cy="80" r="7" style="fill:${r.color}" class="${r.placed || r.anchor ? "pinned" : "mark"}"></circle>
        <text x="${to.toFixed(1)}" y="${String(i % 2 ? 116 : 102)}" class="axis" text-anchor="middle">${ctx.label(r.key)}${r.anchor ? " • anchor" : ""}</text>`;
    })
    .join("");
  const axis = [0, 90, 180, 270, 360].map((h) => `<text x="${x(h === 360 ? 359.99 : h).toFixed(1)}" y="16" class="axis" text-anchor="middle">${String(h)}°</text>`).join("");
  return `<svg class="chart" viewBox="0 0 600 124" role="img" aria-label="Even starting hues and where each color sits" aria-describedby="starts-key">
      ${axis}<line x1="${String(left)}" x2="${String(left + width)}" y1="33" y2="33" class="grid"></line>${marks}
    </svg>
    <p class="legend-row soft" id="starts-key"><span><i class="tick-key"></i>Even start from the anchor</span><span><i class="dot-key"></i>Where it sits</span><span><i class="dot-key pinned"></i>Placed by hand, or the anchor</span></p>`;
}

/**
 * The tier ladder: one color on every tier, default and muted, with its contrast and colorfulness.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function ladder(ctx: Context): string {
  const colors = ctx.palette?.[ctx.mode].colors ?? [];
  if (!colors.length) return "Solving…";
  const c = colors.find((x) => x.key === setting(ctx, "demo-color")) ?? colors[0]!;
  const tiers = ctx.settings.tiers;
  const cells = (variant: "default" | "muted") =>
    tiers
      .map((t) => {
        const s = c.tiers[t]![variant];
        return s ? `<span class="ladder-cell"><span class="ladder-swatch" style="--c:${s.color}"></span><span class="mono">Lc ${String(t)}</span><span class="mono soft">M ${s.colorfulness.toFixed(1)}</span></span>` : `<span></span>`;
      })
      .join("");
  return `<div class="ladder" style="--n:${String(tiers.length)}"><span class="soft">Default</span>${cells("default")}<span class="soft">Muted</span>${cells("muted")}</div>`;
}

const DEMOS = { tier, reach, difference, bump, ladder } as const;

/**
 * Redraws one demo after its controls change.
 *
 * @param ctx   What the page shows.
 * @param name  The demo.
 */
export function updateDemo(ctx: Context, control: HTMLInputElement | HTMLSelectElement): void {
  chosen.set(control.id, control.value);
  const name = control.dataset.demo!;
  const out = document.querySelector(`#demo-${name}-out`);
  if (out && name in DEMOS) out.innerHTML = DEMOS[name as keyof typeof DEMOS](ctx);
}

/* >------------------------------------------< Page >------------------------------------------< */

/**
 * The whole explainer.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
export function explain(ctx: Context): string {
  const s = ctx.settings;
  const count = hues(ctx).length;
  const extras = s.extras.length;
  const swatches = (count + extras) * s.tiers.length * 2 * 2 * GAMUTS.length;
  const anchor = anchorSource(s);
  const hueOptions = hues(ctx).map((h) => [h.key, ctx.label(h.key)] as const);
  // The even difference between neighbors on the identity tier, as the strip measures gaps.
  const ring = ctx.palette?.[ctx.mode].ring[identityOf(s, ctx.mode)] ?? [];
  const gap = ring.length ? ring.reduce((x, y) => x + y, 0) / ring.length : 0;
  return `<section class="intro">
      <h1>How it works</h1>
      <p><strong>EK Colors</strong> solves color palettes instead of picking them by eye. A small program builds a palette from a handful of rules, so every color can be explained, and solved again when a rule changes. It starts from <strong>EK Palette</strong>, the palette it was made for; change the settings and it solves a palette of its own. This page walks through the rules one at a time; every demo runs the same code as the solver.</p>
      <p class="soft">This is the plain-words version. For every formula, constant and search rule, see <a href="#algorithm">the algorithm</a>; for the research and software it's built on, see <a href="#references">References</a>.</p>
    </section>

    <section class="step">
      <h2>What it makes</h2>
      <p>${String(count)} hues${extras ? ` and ${String(extras)} extra ${extras === 1 ? "color" : "colors"}` : ""}, each on ${String(s.tiers.length)} contrast tiers, in a default and a muted version, for light and dark, for three kinds of screen: ${String(swatches)} colors in all. They all follow the same rules, so the rules only have to be learned once.</p>
    </section>

    <section class="step">
      <h2>Color depends on the room</h2>
      <p>The same red looks stronger in a bright room than in a dim one, and different on a light page than on a dark one. To compare colors fairly, the solver uses <strong>CAM16</strong>, a model of human color vision. It's told what the eye is looking at and where: the page's base color as the background, and the room's light. The light mode's base is always lighter than the dark mode's.</p>
      <p>Light mode is seen at ${String(s.rooms.light.lux)} lux, a normal lit room. Dark mode is seen at ${String(s.rooms.dark.lux)} lux, a dim room. Both come from the sRGB standard: its typical room and its reference room. CAM16 then gives three numbers people can feel: <em>lightness</em> (J), <em>colorfulness</em> (M) and <em>hue</em>.</p>
      <div class="demo"><div class="demo-out wide">${room(ctx)}</div></div>
      <p>So the same target needs different screen colors in each mode. Both of these aim at the same colorfulness. The dark-mode one gets more color on the screen, because a dim room makes colors look quieter.</p>
      <div class="demo"><div class="demo-out wide">${modes(ctx)}</div></div>
    </section>

    <section class="step">
      <h2>Contrast decides lightness</h2>
      <p>Every color has a job, and the job decides how much it must stand out from the background. The solver measures that with <strong>APCA</strong>, a contrast method proposed for the next version of the web's accessibility guidelines. APCA reads light-on-dark and dark-on-light differently, the way eyes do. Its unit is Lc.</p>
      <div class="scroll"><table class="roles"><tbody>${s.tiers
        .map((t) => `<tr><th scope="row" class="mono">Lc ${String(t)}</th><td>${ROLES[t] ?? ""}</td></tr>`)
        .join("")}</tbody></table></div>
      <p>For each hue and tier, the solver searches lightness until the color sits exactly on the tier: never below it, and only as far above as rounding forces. The older WCAG 2 contrast is reported beside every color too, because laws still point to it. Its badge says what that ratio allows: AAA and AA pass for text, AA large only for large text and for icons, borders and controls, and below 3:1 for nothing that must be read. Each badge opens its level.</p>
      <p>One tier stands for each hue: the <strong>identity tier</strong>. It's where the colors look most like themselves: clear enough to read, neither faint nor heavy. The solver picks it as the tier where APCA and WCAG 2, taken together, are just at their minimum for text: Lc ${String(autoIdentity(s.bases.light, s.tiers))} on the light base and Lc ${String(autoIdentity(s.bases.dark, s.tiers))} on the dark one, since WCAG 2 rates colors on a dark base as more contrasty than APCA does.${MODES.filter((m) => s.identityTier[m] !== "auto")
        .map((m) => ` Here, ${m} mode's is set by hand to Lc ${String(identityOf(s, m))}.`)
        .join("")} Any tier can be made the identity on the Tiers page, or in Settings.</p>
      <div class="demo">
        <div class="demo-controls">
          ${slider(ctx, "demo-hue", "Hue", [0, 359, 1], "tier")}
          ${slider(ctx, "demo-lc", "Contrast", [15, 90, 1], "tier")}
        </div>
        <div id="demo-tier-out" class="demo-out">${tier(ctx)}</div>
      </div>
    </section>

    <section class="step">
      <h2>Equally colorful</h2>
      <p>Every hue aims at the same colorfulness: M ${String(s.colorfulness)}, apart from what colorfulness per hue (below) adds or takes away. The screen doesn't always allow it. Near white, a screen can show a strong yellow but only a pale red; near black, the opposite. With <strong>Equal per tier</strong> on, each tier's target drops to what its least colorful hue can reach, and every color on the tier follows, so nothing stands out by accident. Switched off in Settings, each color goes as far as the screen allows instead, and a tier is no longer equally colorful.</p>
      <p>The chart shows how far each hue could go on one tier, on each kind of screen.</p>
      <div class="demo">
        <div class="demo-controls">
          ${choice(ctx, "demo-tier", "Tier", tierOptions(ctx), "reach")}
        </div>
        <div id="demo-reach-out" class="demo-out wide">${reach(ctx)}</div>
      </div>
      <p>Small marks say what happened to a color. <strong>Sets the tier</strong>, an amber flag, marks the color whose reach the tier was lowered to. <strong>Lowered</strong>, a grey ↓, marks a color held below its own aim because of it. <strong>Gamut limit</strong>, a red !, marks a color the screen can't make as colorful as it should be at all. Tables show them in small chips beside the M value; on cards the flag sits beside the name, and a Lowered or Gamut limit color shows its M value in grey or red with its mark. A key under the colors says which is which, and each mark opens why, with the numbers.</p>
    </section>

    <section class="step">
      <h2>Colorfulness per hue (M)</h2>
      <p>The model isn't perfect: some parts of the circle can look weaker or stronger to the eye than CAM16 says. <strong>Colorfulness per hue</strong> adds or takes away colorfulness smoothly over the circle, as a few points that each ease to nothing on either side, so neighbors never jump. Light and dark each have their own curve.</p>
      <div class="demo">
        <div class="demo-controls">
          ${slider(ctx, "demo-amount", "Amount", [-12, 12, 1], "bump")}
          ${slider(ctx, "demo-center", "Center", [0, 359, 1], "bump")}
          ${slider(ctx, "demo-width", "Width", [20, 180, 5], "bump")}
        </div>
        <div id="demo-bump-out" class="demo-out wide">${bump(ctx)}</div>
      </div>
      <p>The <strong>blind colorfulness test</strong> in Settings measures where it's needed. It shows two colors at a time, without names, and asks which looks more colorful, nudging the color it's testing after each answer, apart from the occasional easy check, until it finds where each hue looks as colorful as the others. Its result can be applied as the curve.</p>
    </section>

    <section class="step">
      <h2>Evenly different</h2>
      <p>Two neighboring colors should be as easy to tell apart as any other two. CAM16 has a uniform space, CAM16-UCS, where distance matches how different colors look. The hues start evenly apart in angle, ${String(count)} hues ${(360 / count).toFixed(count === 8 ? 0 : 1)}° apart. Angles aren't how differences are seen, though, so the solver nudges each one, a few degrees at a time, until the differences around the circle are as even as they can be. That's the <strong>uniform lineup</strong>.</p>
      <p>Evening out the differences doesn't say where the lineup sits, since turning all of it around the circle keeps them almost the same. So one hue, ${ctx.label(hueKeys(s.hues)[0]!).toLowerCase()}, is the <strong>anchor</strong>, and every other hue is spaced from it. It sits at ${anchorHue(s).toFixed(0)}° here, ${anchor}. It can be the yellow of CAM16, Munsell, NCS, unique-hue studies or the World Color Survey's focal colors, or any hue; the same systems can be drawn as guides on the hue graphs, to see where each puts its hues.</p>
      <div class="demo">
        <div class="demo-controls">
          ${choice(ctx, "demo-a", "First color", hueOptions, "difference")}
          ${choice(ctx, "demo-b", "Second color", hueOptions, "difference")}
          ${choice(ctx, "demo-dtier", "Tier", tierOptions(ctx), "difference")}
        </div>
        <div id="demo-difference-out" class="demo-out wide">${difference(ctx)}</div>
      </div>
      <p>Around the circle on the tier that stands for each hue:</p>
      <div class="demo"><div class="demo-out wide">${spacing(ctx)}</div></div>
    </section>

    <section class="step">
      <h2>Placing hues (H)</h2>
      <p>A name fits some hues better than others: an even red can lean pink, an even blue can lean cyan. So any color can be <strong>placed</strong> by hand where its name fits best, by dragging it on the hue graph in Settings, and the others re-space evenly around it. Colors keep their order around the circle: a placed color stays between its neighbors, at least a quarter of the even step from each.</p>
      <div class="demo"><div class="demo-out wide">${placing(ctx)}</div></div>
      <p>The <strong>blind hue test</strong> in Settings measures where each name fits. It shows one color at a time, without its name, and asks whether it leans toward the color before it or the one after it; the hue where it leans neither way is the middle of its name, and a color can be placed there.</p>
    </section>

    <section class="step">
      <h2>Reading changes</h2>
      <p>Placed hues and colorfulness per hue are edits on top of the uniform lineup. The <strong>H</strong> and <strong>M</strong> switches in the header turn them off and on across the pages, so the palette can be seen with and without them.</p>
      <p>At the top of Settings, a strip shows the palette a step at a time. <strong>Uniform</strong> is the evenly spaced lineup. <strong>Turned</strong> is the same lineup turned around the circle to best match the placed hues; turning keeps it uniform. <strong>+H</strong> adds the placed hues, and <strong>+M</strong> colorfulness per hue. How far the edits take the palette from the turned lineup is its <strong>bend</strong>, in gaps: one gap is the even difference between neighbors${gap ? `, ${gap.toFixed(1)} ΔE in ${ctx.mode} mode here` : ""}, ΔE being how different two colors look in CAM16-UCS. Here's the strip for this palette; point at a swatch or a row for its numbers, and click a number for what it means.</p>
      <div class="demo"><div id="palette-strip" class="strip"></div></div>
      ${zoneTable()}
      <p>Bending colors is what placing is for, so bend isn't the risk in itself. Evenness is: when two neighbors end up closer than the even gap, they're easier to confuse. Under 10% closer is fine, 10 to 25% is worth watching, and over 25% they're getting confusable. A change is also split into what it's made of, hue, colorfulness and lightness, as shares that add up to the whole.</p>
    </section>

    <section class="step">
      <h2>Muted and extra colors</h2>
      <p>Muted colors are the same hue on the same tier, at ${String(Math.round(s.muted * 100))}% of the default's colorfulness: quieter, never weaker in contrast. Every tier of one color:</p>
      <div class="demo">
        <div class="demo-controls">
          ${choice(
            ctx,
            "demo-color",
            "Color",
            (ctx.palette?.[ctx.mode].colors ?? []).map((c) => [c.key, ctx.label(c.key)] as const),
            "ladder",
          )}
        </div>
        <div id="demo-ladder-out" class="demo-out wide">${ladder(ctx)}</div>
      </div>
      <p><strong>Extra colors</strong> sit beside the hues${extras ? `, like ${s.extras.map((e) => escape(e.name)).join(" and ")} here` : ""}. Each has a name, its own hue and a share of the colorfulness: on every tier it's the most colorful color of that hue, up to its share of the tier's target, exactly on the tier's contrast, with a muted version too. Extra colors aren't spaced with the hues and aren't measured by the blind tests; on the hue circle they're drawn as diamonds. Settings adds as many as needed.</p>
    </section>

    <section class="step">
      <h2>Three kinds of screen</h2>
      <p>Screens differ in how much color they can show, their gamut; the Gamut switch in the header picks one of the three. <strong>Standard</strong> is what every screen shows. <strong>Wide</strong> is what most new phones and computers show, iPhones and Macs included. <strong>Ultra</strong> is the widest, which few screens fully reach yet.</p>
      <p>The palette is solved once per kind, each on its own. A wider screen keeps more color on the tiers where the standard one runs out, as the chart above shows. A website gives every screen the widest palette it can show.</p>
      <p>A dot on the Gamut switch marks the kind this screen shows. Picking a wider one still shows its palette, as closely as this screen can, with a note in red that the colors aren't exact.</p>
    </section>

    <section class="step">
      <h2>Every rule is a setting</h2>
      <p>The bases and rooms, the number of hues, the anchor and placed hues, the target colorfulness, whether tiers are equally colorful and the curve per hue, the tiers and the identity tier per mode, the muted share and the extra colors are all settings. Change one in Settings and watch the palette follow; the changes stay in this browser.</p>
      <p>Settings also names the palette, resets it to EK Palette, and copies its settings to paste elsewhere. Compare shows a changed palette next to EK Palette. Export, near the end of Settings, gives the palette as JSON, CSV, Markdown or CSS, titled with its name.</p>
    </section>`;
}
