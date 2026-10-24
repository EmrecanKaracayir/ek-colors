/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< EXPLAIN >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| How it works: the palette solver told step by step, each step with a small live demo that uses   |
| the same code as the solver.                                                                     |
\*------------------------------------------------------------------------------------------------*/

import { apca, composition, makeModel, type Model, wcag, wcagLevel } from "../palette/model";
import { type Gamut, GAMUTS, type Mode, type Settings } from "../palette/settings";
import { type GamutPalette, strongest } from "../palette/solve";

/* >----------------------------------------< Context >-----------------------------------------< */

/** What the page is showing. */
export interface Context {
  readonly settings: Settings;
  readonly mode: Mode;
  readonly gamut: Gamut;
  readonly palette: GamutPalette | null;
  readonly label: (key: string) => string;
}

/** What each tier is for. */
const ROLES: Readonly<Record<number, string>> = {
  15: "Dividers and faint fills",
  30: "Icons, outlines and controls",
  45: "Large text and the color itself",
  60: "Labels and links",
  75: "Body text",
  90: "Long reading",
};

const GAMUT_NAMES: Readonly<Record<Gamut, string>> = { standard: "Standard", wide: "Wide", ultra: "Ultra" };

/* >----------------------------------------< Helpers >-----------------------------------------< */

const value = (id: string) => (document.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "");

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
 * @returns    One entry per hue (brown left out).
 */
function hues(ctx: Context) {
  const tier = ctx.settings.identityTier[ctx.mode];
  return (ctx.palette?.[ctx.mode].colors ?? [])
    .filter((c) => c.key !== "brown")
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
      <text x="${(x(lux) + 8).toFixed(1)}" y="${String(top + (mode === "dark" ? 12 : 30))}" class="axis label">${mode === "dark" ? "Dark mode" : "Light mode"} · ${String(lux)} lux</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${String(left + width + 20)} ${String(top + height + 30)}" role="img" aria-label="How colorful ${ctx.label(first.key)} looks as the room gets brighter">
      ${yTicks.join("")}
      ${xTicks.map(([lux, text]) => `<text x="${x(lux).toFixed(1)}" y="${String(top + height + 20)}" class="axis" text-anchor="${lux === 1 ? "start" : lux === 10_000 ? "end" : "middle"}">${text}</text>`).join("")}
      <path d="${line}" fill="none" style="stroke:${first.color}" stroke-width="3" stroke-linecap="round"></path>
      ${marks.join("")}
    </svg>
    <p class="soft">How colorful the palette's ${ctx.label(first.key).toLowerCase()} looks (M), from a dark room to daylight. The screen color never changes.</p>`;
}

/**
 * The same hue solved for each mode, each on its own base, with how much color the screen gives
 * it.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function modes(ctx: Context): string {
  // A tier where neither mode was lowered, so both sit exactly on the target.
  const tier =
    ctx.settings.tiers.find((t) => !ctx.palette?.light.limits[t] && !ctx.palette?.dark.limits[t]) ??
    ctx.settings.identityTier[ctx.mode];
  const ink = { light: "#1C1D20", dark: "#E7E8EA" } as const;
  const pair = (["light", "dark"] as const).map((mode) => {
    const c = ctx.palette?.[mode].colors[0];
    if (!c) return "";
    const s = c.tiers[tier]!.default;
    return `<figure class="on-base" style="--base:${ctx.settings.bases[mode]};--c:${s.color};--ink:${ink[mode]}">
      <span class="demo-swatch"></span><span class="on-base-sample">Aa</span>
      <figcaption><strong>${mode === "light" ? "Light mode" : "Dark mode"}</strong><span>Looks M ${s.colorfulness.toFixed(0)} · screen chroma ${s.chroma.toFixed(0)}</span></figcaption>
    </figure>`;
  });
  return `<div class="demo-pair">${pair.join("")}</div><p class="soft">${ctx.label(ctx.palette?.light.colors[0]?.key ?? "")} on Lc ${String(tier)}.</p>`;
}

/**
 * The tier demo: a hue placed exactly on a contrast.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function tier(ctx: Context): string {
  const hue = Number(value("demo-hue") || 25);
  const lc = Number(value("demo-lc") || 60);
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
      <div><dt>WCAG 2</dt><dd class="mono">${ratio.toFixed(2)} · ${wcagLevel(ratio)}</dd></div>
      <div><dt>Lightness J</dt><dd class="mono">${cam.j.toFixed(1)}</dd></div>
      <div><dt>Colorfulness M</dt><dd class="mono">${cam.m.toFixed(1)}</dd></div>
      <div><dt>Hue</dt><dd class="mono">${cam.hue.toFixed(0)}° · ${composition(cam.hue)}</dd></div>
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
  const lc = Number(value("demo-tier") || ctx.settings.tiers.at(-1));
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
  const limited = least.reach[shown]! < target;
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
      <text x="0" y="${String(y + 15)}" class="axis label">${ctx.label(r.key)}${limit ? " ▾" : ""}</text>
      ${r.reach
        .map(
          (m, g) =>
            `<rect x="${String(left)}" y="${String(y + g * 8)}" width="${(x(m) - left).toFixed(1)}" height="6" rx="3" fill="${r.color}" style="fill:${shade(r.color, GAMUTS[g]!)}"></rect>`,
        )
        .join("")}</g>`;
  });
  const key = (g: Gamut) =>
    `<span><i class="bar-key" style="background:${shade(least.color, g)}"></i>${GAMUT_NAMES[g]}</span>`;
  return `<svg class="chart" viewBox="0 0 ${String(left + width + 20)} ${String(height)}" role="img" aria-label="How colorful each hue can be on Lc ${String(lc)}">
      ${ticks.join("")}${bars.join("")}
      <line x1="${String(x(target))}" x2="${String(x(target))}" y1="0" y2="${String(height - 24)}" class="target"></line>
      <line x1="${x(ceiling).toFixed(1)}" x2="${x(ceiling).toFixed(1)}" y1="0" y2="${String(height - 24)}" class="ceiling"></line>
    </svg>
    <p class="demo-verdict">${
      limited
        ? `On ${GAMUT_NAMES[ctx.gamut]}, <strong>${ctx.label(least.key)}</strong> can only reach M ${ceiling.toFixed(1)} on Lc ${String(lc)}, so every color on this tier stops there.`
        : `On ${GAMUT_NAMES[ctx.gamut]}, every hue reaches the target on Lc ${String(lc)}.`
    }</p>
    <p class="legend-row soft">${GAMUTS.map(key).join("")}
      <span><i class="line-key target"></i>Target M ${String(target)}</span><span><i class="line-key ceiling"></i>This tier on ${GAMUT_NAMES[ctx.gamut]}</span></p>`;
}

/**
 * The difference demo: how different two colors of the palette look, and what the difference is
 * made of.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function difference(ctx: Context): string {
  const colors = (ctx.palette?.[ctx.mode].colors ?? []).filter((c) => c.key !== "brown");
  if (colors.length < 2) return "Solving…";
  const lc = Number(value("demo-dtier") || ctx.settings.identityTier[ctx.mode]);
  const pick = (id: string, fallback: number) =>
    colors.find((c) => c.key === value(id)) ?? colors[fallback]!;
  const [a, b] = [pick("demo-a", 0), pick("demo-b", 1)];
  const [ca, cb] = [a.tiers[lc]!.default.color, b.tiers[lc]!.default.color];
  const m = model(ctx.settings, ctx.gamut);
  const [x, y] = [m.cam(ctx.mode, ca), m.cam(ctx.mode, cb)];
  const total = x.distance(y);
  const lightness = Math.abs(x.jstar - y.jstar);
  const colorfulness = Math.abs(Math.hypot(x.astar, x.bstar) - Math.hypot(y.astar, y.bstar));
  const hue = Math.sqrt(Math.max(0, total ** 2 - lightness ** 2 - colorfulness ** 2));
  const ring = ctx.palette?.[ctx.mode].ring[lc] ?? [];
  const typical = ring.length ? ring.reduce((s, d) => s + d, 0) / ring.length : 0;
  const scale = Math.max(30, Math.ceil(total / 10) * 10);
  const at = (d: number) => `${((Math.min(d, scale) / scale) * 100).toFixed(1)}%`;
  return `<div class="demo-touch"><span style="--c:${ca}"></span><span style="--c:${cb}"></span></div>
    <p class="demo-sample"><span style="color:${ca}">${ctx.label(a.key)}</span> <span style="color:${cb}">${ctx.label(b.key)}</span></p>
    <dl class="demo-numbers">
      <div><dt>Difference</dt><dd class="mono">${total.toFixed(1)}</dd></div>
      <div><dt>From lightness</dt><dd class="mono">${lightness.toFixed(1)}</dd></div>
      <div><dt>From colorfulness</dt><dd class="mono">${colorfulness.toFixed(1)}</dd></div>
      <div><dt>From hue</dt><dd class="mono">${hue.toFixed(1)}</dd></div>
    </dl>
    <div class="scale">
      <span class="scale-fill" style="width:${at(total)}"></span>
      <span class="scale-mark" style="left:${at(1.5)}"><span>Just visible</span></span>
      ${typical ? `<span class="scale-mark" style="left:${at(typical)}"><span>Neighbors on this tier</span></span>` : ""}
    </div>
    <p class="soft">CAM16-UCS distance. Around 1 to 2 is the smallest difference most people see with two colors side by side. On a tier, every color solves to sit about the same distance from its neighbors, which is why the circle below stays even.</p>`;
}

/**
 * The spacing chart: how different each color is from the next on the identity tier.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function spacing(ctx: Context): string {
  const list = hues(ctx);
  const ring = ctx.palette?.[ctx.mode].ring[ctx.settings.identityTier[ctx.mode]] ?? [];
  if (!ring.length) return "Solving…";
  const most = Math.max(...ring);
  return ring
    .map(
      (d, i) => `<div class="bar-row"><span class="soft">${ctx.label(list[i]!.key)} → ${ctx.label(list[(i + 1) % list.length]!.key)}</span>
        <span class="bar"><span style="width:${((d / most) * 100).toFixed(1)}%"></span></span><span class="mono">${d.toFixed(1)}</span></div>`,
    )
    .join("");
}

const DEMOS = { tier, reach, difference } as const;

/**
 * Redraws one demo after its controls change.
 *
 * @param ctx   What the page shows.
 * @param name  The demo.
 */
export function updateDemo(ctx: Context, name: string): void {
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
  const seen = s.rooms[ctx.mode];
  const swatches = count * s.tiers.length * 2 * 2 * GAMUTS.length;
  return `<section class="intro">
      <h1>How it works</h1>
      <p>EK Colors isn't picked by eye. A small program solves it from a handful of rules, so every color can be explained and solved again when a rule changes. This page walks through those rules one at a time. Every demo runs the same code as the solver.</p>
    </section>

    <section class="step">
      <h2>What it makes</h2>
      <p>${String(count)} hues, each on ${String(s.tiers.length)} contrast tiers, in a default and a muted version, for light and dark, for three kinds of screen. That's ${String(swatches)} colors, plus brown. They all follow the same rules, so you only have to learn the rules once.</p>
    </section>

    <section class="step">
      <h2>Color depends on the room</h2>
      <p>The same red looks stronger in a bright room than in a dim one, and different on a light page than on a dark one. To compare colors fairly, the solver uses <strong>CAM16</strong>, a model of human color vision. You tell it what the eye is looking at and where: the page's base color as the background, and the room's light.</p>
      <p>Light mode is seen at ${String(s.rooms.light.lux)} lux, a normal lit room. Dark mode is seen at ${String(s.rooms.dark.lux)} lux, a dim room. Both come from the sRGB standard: its typical room and its reference room. CAM16 then gives three numbers people can feel: <em>lightness</em> (J), <em>colorfulness</em> (M) and <em>hue</em>.</p>
      <div class="demo"><div class="demo-out wide">${room(ctx)}</div></div>
      <p>So the same target needs different screen colors in each mode. Both of these are meant to look equally colorful. The dark-mode one gets more color on the screen, because a dim room makes colors look quieter.</p>
      <div class="demo"><div class="demo-out wide">${modes(ctx)}</div></div>
    </section>

    <section class="step">
      <h2>Contrast decides lightness</h2>
      <p>Every color has a job, and the job decides how much it must stand out from the background. The solver measures that with <strong>APCA</strong>, the contrast method written for the next version of the web's accessibility guidelines. APCA reads light-on-dark and dark-on-light differently, the way eyes do. Its unit is Lc.</p>
      <div class="scroll"><table class="roles"><tbody>${s.tiers
        .map((t) => `<tr><th scope="row" class="mono">Lc ${String(t)}</th><td>${ROLES[t] ?? ""}</td></tr>`)
        .join("")}</tbody></table></div>
      <p>For each hue and tier, the solver searches lightness until the color sits exactly on the tier: never below it, and only as far above as rounding forces. The older WCAG 2 contrast is reported next to every color too, because laws still point to it.</p>
      <div class="demo">
        <div class="demo-controls">
          <label for="demo-hue">Hue <input id="demo-hue" type="range" min="0" max="359" step="1" value="25" data-demo="tier"></label>
          <label for="demo-lc">Contrast <input id="demo-lc" type="range" min="15" max="90" step="1" value="60" data-demo="tier"></label>
        </div>
        <div id="demo-tier-out" class="demo-out">${tier(ctx)}</div>
      </div>
    </section>

    <section class="step">
      <h2>Equally colorful</h2>
      <p>Every color aims at the same colorfulness: M ${String(s.colorfulness)}. The screen doesn't always allow it. Near white, a screen can show a strong yellow but only a pale red; near black, the opposite. So on each tier, the target drops to what the least colorful hue can reach, and every color on the tier follows. Nothing stands out by accident.</p>
      <p>Where a part of the circle still looks weaker to the eye than the model says, a curve adds colorfulness smoothly over hue: a few points, each easing to none on either side. Smooth, so neighbors never jump; the blind curve test in Settings measures where it's needed.</p>
      <p>The chart shows how far each hue could go on one tier, on each kind of screen.</p>
      <div class="demo">
        <div class="demo-controls">
          <label for="demo-tier">Tier <select id="demo-tier" data-demo="reach">
            ${s.tiers.map((t) => `<option value="${String(t)}" ${t === s.tiers.at(-1) ? "selected" : ""}>Lc ${String(t)}</option>`).join("")}
          </select></label>
        </div>
        <div id="demo-reach-out" class="demo-out wide">${reach(ctx)}</div>
      </div>
    </section>

    <section class="step">
      <h2>Evenly different</h2>
      <p>Two neighboring colors should be as easy to tell apart as any other two. CAM16 has a uniform space (CAM16-UCS) where distance matches how different colors look. Each hue starts where its name puts it on CAM16's hue circle: red at pure red, orange halfway between red and yellow, pink a third of the way from red to blue. Then the solver nudges each one, a few degrees at a time and never out of its name, until the distances around the circle are as even as they can be.</p>
      <p>Yellow is the one hue that never moves. It sits at ${String(s.yellowHue[ctx.mode])}°, chosen by eye a few degrees toward green from CAM16's pure yellow (90°). Every other hue is spaced from it, so moving yellow moves its neighbors too.</p>
      <div class="demo">
        <div class="demo-controls">
          <label for="demo-a">First color <select id="demo-a" data-demo="difference">${hues(ctx).map((h, i) => `<option value="${h.key}" ${i === 0 ? "selected" : ""}>${ctx.label(h.key)}</option>`).join("")}</select></label>
          <label for="demo-b">Second color <select id="demo-b" data-demo="difference">${hues(ctx).map((h, i) => `<option value="${h.key}" ${i === 1 ? "selected" : ""}>${ctx.label(h.key)}</option>`).join("")}</select></label>
          <label for="demo-dtier">Tier <select id="demo-dtier" data-demo="difference">${s.tiers.map((t) => `<option value="${String(t)}" ${t === s.identityTier[ctx.mode] ? "selected" : ""}>Lc ${String(t)}</option>`).join("")}</select></label>
        </div>
        <div id="demo-difference-out" class="demo-out wide">${difference(ctx)}</div>
      </div>
      <p>Around the circle on the tier that stands for each hue:</p>
      <div class="demo"><div class="demo-out wide">${spacing(ctx)}</div></div>
    </section>

    <section class="step">
      <h2>Muted and brown</h2>
      <p>Muted colors are the same hue on the same tier, at ${String(Math.round(s.muted * 100))}% of the default's colorfulness: quieter, never weaker in contrast. ${s.brown === null ? "" : `Brown is a warm orange at ${String(Math.round(s.brown * 100))}% colorfulness and has no muted version.`}</p>
    </section>

    <section class="step">
      <h2>Three kinds of screen</h2>
      <p>Screens differ in how much color they can show. <strong>Standard</strong> is what every screen shows. <strong>Wide</strong> is what most new phones and computers show, iPhones and Macs included. <strong>Ultra</strong> is the widest, which few screens fully reach yet.</p>
      <p>The palette is solved once per kind, each on its own. A wider screen keeps more color on the tiers where the standard one runs out, as the chart above shows. A website gives every screen the widest palette it can show.</p>
    </section>

    <section class="step">
      <h2>What it's built with</h2>
      <dl class="facts-list">
        <div><dt>CAM16</dt><dd>Google's <a href="https://github.com/material-foundation/material-color-utilities">material-color-utilities</a>: viewing conditions, colorfulness, and distance in CAM16-UCS. Material Design builds its colors on the same model.</dd></div>
        <div><dt>Contrast and screens</dt><dd><a href="https://colorjs.io">Color.js</a>: APCA, WCAG 2, color spaces for the three kinds of screen, and checking which colors a screen can show.</dd></div>
        <div><dt>The solver</dt><dd>TypeScript: settings, model, solve and formats. It runs in the browser in a background worker, and on the command line to write JSON, CSV and Markdown.</dd></div>
        <div><dt>Settings</dt><dd>Everything above is a setting: bases, rooms, target, curve, yellow, number of hues, tiers, muted share. Change one in Settings and watch the palette follow.</dd></div>
      </dl>
    </section>`;
}
