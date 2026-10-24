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
  45: "Large text and the colour itself",
  60: "Labels and links",
  75: "Body text",
  90: "Long reading",
};

const GAMUT_NAMES: Readonly<Record<Gamut, string>> = { standard: "Standard", wide: "Wide", ultra: "Ultra" };

/* >----------------------------------------< Helpers >-----------------------------------------< */

const value = (id: string) => (document.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "");

const models = new Map<string, Model>();

/**
 * A colour model, kept while its settings stay the same.
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
 * The hues of the palette on screen, with their keys and identity colours.
 *
 * @param ctx  What the page shows.
 * @returns    One entry per hue (brown left out).
 */
function hues(ctx: Context) {
  const tier = ctx.settings.identityTier;
  return (ctx.palette?.[ctx.mode].colours ?? [])
    .filter((c) => c.key !== "brown")
    .map((c) => ({ key: c.key, hue: c.tiers[tier]!.default.hue, color: c.tiers[tier]!.default.color }));
}

/* >-----------------------------------------< Demos >------------------------------------------< */

/**
 * The room demo: the palette's colour, and the colour that would look the same, in another room.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function room(ctx: Context): string {
  const first = hues(ctx)[0];
  if (!first) return "Solving…";
  const solvedIn = ctx.settings.rooms[ctx.mode];
  const here = {
    lux: Number(value("demo-lux") || solvedIn.lux),
    surround: Number(value("demo-surround") || solvedIn.surround),
  };
  const there = model({ bases: ctx.settings.bases, rooms: { light: here, dark: here } }, ctx.gamut);
  const look = model(ctx.settings, ctx.gamut).cam(ctx.mode, first.color);
  const seen = there.cam(ctx.mode, first.color);
  const same = there.colorAt(ctx.mode, look.hue, look.m, look.j);
  return `<div class="demo-pair">
      <figure><span class="demo-swatch" style="--c:${first.color}"></span>
        <figcaption><strong>The palette's ${ctx.label(first.key).toLowerCase()}</strong><span class="soft">Looks M ${seen.m.toFixed(1)} here, M ${look.m.toFixed(1)} in its own room</span></figcaption></figure>
      <figure>${same ? `<span class="demo-swatch" style="--c:${same}"></span>` : `<span class="demo-swatch empty"></span>`}
        <figcaption><strong>Looks the same here</strong><span class="soft">${same ? `M ${look.m.toFixed(1)}, as in its own room` : "The screen can't show it"}</span></figcaption></figure>
    </div>
    <p class="soft">${String(here.lux)} lux, ${["dark", "dim", "average"][here.surround] ?? ""} surround. The palette was solved for ${String(solvedIn.lux)} lux. In a brighter room the same screen colour looks stronger, so a colour that looks the same is a quieter one; in a darker room it's the other way round.</p>`;
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
    color = strongest(model(ctx.settings, ctx.gamut), base, ctx.mode, hue, ctx.settings.colourfulness, lc);
  } catch {
    return `<p class="soft">No colour at this hue reaches Lc ${String(lc)} on this base.</p>`;
  }
  const cam = model(ctx.settings, ctx.gamut).cam(ctx.mode, color);
  const ratio = wcag(color, base);
  return `<span class="demo-swatch" style="--c:${color}"></span>
    <span class="demo-sample" style="color:${color}">Aa Codemos</span>
    <dl class="demo-numbers">
      <div><dt>APCA</dt><dd class="mono">Lc ${apca(color, base).toFixed(1)}</dd></div>
      <div><dt>WCAG 2</dt><dd class="mono">${ratio.toFixed(2)} · ${wcagLevel(ratio)}</dd></div>
      <div><dt>Lightness J</dt><dd class="mono">${cam.j.toFixed(1)}</dd></div>
      <div><dt>Colourfulness M</dt><dd class="mono">${cam.m.toFixed(1)}</dd></div>
      <div><dt>Hue</dt><dd class="mono">${cam.hue.toFixed(0)}° · ${composition(cam.hue)}</dd></div>
    </dl>`;
}

/**
 * A colour as a gamut tier's bar: quieter for standard, as is for wide, stronger for ultra.
 *
 * @param color  The hue's colour.
 * @param gamut  The gamut tier.
 * @returns      A CSS colour.
 */
function shade(color: string, gamut: Gamut): string {
  if (gamut === "standard") return `color-mix(in oklch, ${color} 45%, var(--soft))`;
  if (gamut === "ultra") return `oklch(from ${color} l calc(c * 1.6) h)`;
  return color;
}

/**
 * The reach chart: how colourful each hue can be on a tier, on each gamut tier, with the hue that
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
  const target = ctx.settings.colourfulness;
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
  return `<svg class="chart" viewBox="0 0 ${String(left + width + 20)} ${String(height)}" role="img" aria-label="How colourful each hue can be on Lc ${String(lc)}">
      ${ticks.join("")}${bars.join("")}
      <line x1="${String(x(target))}" x2="${String(x(target))}" y1="0" y2="${String(height - 24)}" class="target"></line>
      <line x1="${x(ceiling).toFixed(1)}" x2="${x(ceiling).toFixed(1)}" y1="0" y2="${String(height - 24)}" class="ceiling"></line>
    </svg>
    <p class="demo-verdict">${
      limited
        ? `On ${GAMUT_NAMES[ctx.gamut]}, <strong>${ctx.label(least.key)}</strong> can only reach M ${ceiling.toFixed(1)} on Lc ${String(lc)}, so every colour on this tier stops there.`
        : `On ${GAMUT_NAMES[ctx.gamut]}, every hue reaches the target on Lc ${String(lc)}.`
    }</p>
    <p class="legend-row soft">${GAMUTS.map(key).join("")}
      <span><i class="line-key target"></i>Target M ${String(target)}</span><span><i class="line-key ceiling"></i>This tier on ${GAMUT_NAMES[ctx.gamut]}</span></p>`;
}

/**
 * The difference demo: how different two colours of the palette look, and what the difference is
 * made of.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function difference(ctx: Context): string {
  const colours = (ctx.palette?.[ctx.mode].colours ?? []).filter((c) => c.key !== "brown");
  if (colours.length < 2) return "Solving…";
  const lc = Number(value("demo-dtier") || ctx.settings.identityTier);
  const pick = (id: string, fallback: number) =>
    colours.find((c) => c.key === value(id)) ?? colours[fallback]!;
  const [a, b] = [pick("demo-a", 0), pick("demo-b", 1)];
  const [ca, cb] = [a.tiers[lc]!.default.color, b.tiers[lc]!.default.color];
  const m = model(ctx.settings, ctx.gamut);
  const [x, y] = [m.cam(ctx.mode, ca), m.cam(ctx.mode, cb)];
  const total = x.distance(y);
  const lightness = Math.abs(x.jstar - y.jstar);
  const colourfulness = Math.abs(Math.hypot(x.astar, x.bstar) - Math.hypot(y.astar, y.bstar));
  const hue = Math.sqrt(Math.max(0, total ** 2 - lightness ** 2 - colourfulness ** 2));
  const ring = ctx.palette?.[ctx.mode].ring[lc] ?? [];
  const typical = ring.length ? ring.reduce((s, d) => s + d, 0) / ring.length : 0;
  const scale = Math.max(30, Math.ceil(total / 10) * 10);
  const at = (d: number) => `${((Math.min(d, scale) / scale) * 100).toFixed(1)}%`;
  return `<div class="demo-touch"><span style="--c:${ca}"></span><span style="--c:${cb}"></span></div>
    <p class="demo-sample"><span style="color:${ca}">${ctx.label(a.key)}</span> <span style="color:${cb}">${ctx.label(b.key)}</span></p>
    <dl class="demo-numbers">
      <div><dt>Difference</dt><dd class="mono">${total.toFixed(1)}</dd></div>
      <div><dt>From lightness</dt><dd class="mono">${lightness.toFixed(1)}</dd></div>
      <div><dt>From colourfulness</dt><dd class="mono">${colourfulness.toFixed(1)}</dd></div>
      <div><dt>From hue</dt><dd class="mono">${hue.toFixed(1)}</dd></div>
    </dl>
    <div class="scale">
      <span class="scale-fill" style="width:${at(total)}"></span>
      <span class="scale-mark" style="left:${at(1.5)}"><span>Just visible</span></span>
      ${typical ? `<span class="scale-mark" style="left:${at(typical)}"><span>Neighbours on this tier</span></span>` : ""}
    </div>
    <p class="soft">CAM16-UCS distance. Around 1 to 2 is the smallest difference most people see with two colours side by side. On a tier, every colour solves to sit about the same distance from its neighbours, which is why the circle below stays even.</p>`;
}

/**
 * The spacing chart: how different each colour is from the next on the identity tier.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function spacing(ctx: Context): string {
  const list = hues(ctx);
  const ring = ctx.palette?.[ctx.mode].ring[ctx.settings.identityTier] ?? [];
  if (!ring.length) return "Solving…";
  const most = Math.max(...ring);
  return ring
    .map(
      (d, i) => `<div class="bar-row"><span class="soft">${ctx.label(list[i]!.key)} → ${ctx.label(list[(i + 1) % list.length]!.key)}</span>
        <span class="bar"><span style="width:${((d / most) * 100).toFixed(1)}%"></span></span><span class="mono">${d.toFixed(1)}</span></div>`,
    )
    .join("");
}

const DEMOS = { room, tier, reach, difference } as const;

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
      <p>Codemos v2 isn't picked by eye. A small program solves it from a handful of rules, so every colour can be explained and solved again when a rule changes. This page walks through those rules one at a time. Every demo runs the same code as the solver.</p>
    </section>

    <section class="step">
      <h2>What it makes</h2>
      <p>${String(count)} hues, each on ${String(s.tiers.length)} contrast tiers, in a default and a muted version, for light and dark, for three kinds of screen. That's ${String(swatches)} colours, plus brown. They all follow the same rules, so you only have to learn the rules once.</p>
    </section>

    <section class="step">
      <h2>Colour depends on the room</h2>
      <p>The same red looks stronger in a bright room than in a dim one, and different on a light page than on a dark one. To compare colours fairly, the solver uses <strong>CAM16</strong>, a model of human colour vision. You tell it what the eye is looking at and where: the page's base colour as the background, and the room's light.</p>
      <p>Light mode is seen at ${String(s.rooms.light.lux)} lux, a normal lit room. Dark mode is seen at ${String(s.rooms.dark.lux)} lux, a dim room. Both come from the sRGB standard: its typical room and its reference room. CAM16 then gives three numbers people can feel: <em>lightness</em> (J), <em>colourfulness</em> (M) and <em>hue</em>.</p>
      <div class="demo">
        <div class="demo-controls">
          <label for="demo-lux">Room light <input id="demo-lux" type="range" min="1" max="1000" step="1" value="${String(seen.lux)}" data-demo="room"></label>
          <label for="demo-surround">Surround <select id="demo-surround" data-demo="room">
            ${["Dark", "Dim", "Average"].map((n, i) => `<option value="${String(i)}" ${i === seen.surround ? "selected" : ""}>${n}</option>`).join("")}
          </select></label>
        </div>
        <div id="demo-room-out" class="demo-out">${room(ctx)}</div>
      </div>
    </section>

    <section class="step">
      <h2>Contrast decides lightness</h2>
      <p>Every colour has a job, and the job decides how much it must stand out from the background. The solver measures that with <strong>APCA</strong>, the contrast method written for the next version of the web's accessibility guidelines. APCA reads light-on-dark and dark-on-light differently, the way eyes do. Its unit is Lc.</p>
      <div class="scroll"><table class="roles"><tbody>${s.tiers
        .map((t) => `<tr><th scope="row" class="mono">Lc ${String(t)}</th><td>${ROLES[t] ?? ""}</td></tr>`)
        .join("")}</tbody></table></div>
      <p>For each hue and tier, the solver searches lightness until the colour sits exactly on the tier: never below it, and only as far above as rounding forces. The older WCAG 2 contrast is reported next to every colour too, because laws still point to it.</p>
      <div class="demo">
        <div class="demo-controls">
          <label for="demo-hue">Hue <input id="demo-hue" type="range" min="0" max="359" step="1" value="25" data-demo="tier"></label>
          <label for="demo-lc">Contrast <input id="demo-lc" type="range" min="15" max="90" step="1" value="60" data-demo="tier"></label>
        </div>
        <div id="demo-tier-out" class="demo-out">${tier(ctx)}</div>
      </div>
    </section>

    <section class="step">
      <h2>Equally colourful</h2>
      <p>Every colour aims at the same colourfulness: M ${String(s.colourfulness)}. The screen doesn't always allow it. Near white, a screen can show a strong yellow but only a pale red; near black, the opposite. So on each tier, the target drops to what the least colourful hue can reach, and every colour on the tier follows. Nothing stands out by accident.</p>
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
      <p>Two neighbouring colours should be as easy to tell apart as any other two. CAM16 has a uniform space (CAM16-UCS) where distance matches how different colours look. The solver nudges each hue, a few degrees at a time and never out of its name, until the distances around the circle are as even as they can be.</p>
      <p>Yellow is the one hue that never moves. It is set a little warmer than pure yellow (${String(s.yellowHue[ctx.mode])}° rather than 90°), so a darkened yellow doesn't turn olive. Every other hue is spaced from it.</p>
      <div class="demo">
        <div class="demo-controls">
          <label for="demo-a">First colour <select id="demo-a" data-demo="difference">${hues(ctx).map((h, i) => `<option value="${h.key}" ${i === 0 ? "selected" : ""}>${ctx.label(h.key)}</option>`).join("")}</select></label>
          <label for="demo-b">Second colour <select id="demo-b" data-demo="difference">${hues(ctx).map((h, i) => `<option value="${h.key}" ${i === 1 ? "selected" : ""}>${ctx.label(h.key)}</option>`).join("")}</select></label>
          <label for="demo-dtier">Tier <select id="demo-dtier" data-demo="difference">${s.tiers.map((t) => `<option value="${String(t)}" ${t === s.identityTier ? "selected" : ""}>Lc ${String(t)}</option>`).join("")}</select></label>
        </div>
        <div id="demo-difference-out" class="demo-out wide">${difference(ctx)}</div>
      </div>
      <p>Around the circle on the tier that stands for each hue:</p>
      <div class="demo"><div class="demo-out wide">${spacing(ctx)}</div></div>
    </section>

    <section class="step">
      <h2>Muted and brown</h2>
      <p>Muted colours are the same hue on the same tier, at ${String(Math.round(s.muted * 100))}% of the default's colourfulness: quieter, never weaker in contrast. ${s.brown === null ? "" : `Brown is a warm orange at ${String(Math.round(s.brown * 100))}% colourfulness and has no muted version.`}</p>
    </section>

    <section class="step">
      <h2>Three kinds of screen</h2>
      <p>Screens differ in how much colour they can show. <strong>Standard</strong> is what every screen shows. <strong>Wide</strong> is what most new phones and computers show, iPhones and Macs included. <strong>Ultra</strong> is the widest, which few screens fully reach yet.</p>
      <p>The palette is solved once per kind, each on its own. A wider screen keeps more colour on the tiers where the standard one runs out, as the chart above shows. A website gives every screen the widest palette it can show.</p>
    </section>

    <section class="step">
      <h2>What it's built with</h2>
      <dl class="facts-list">
        <div><dt>CAM16</dt><dd>Google's <a href="https://github.com/material-foundation/material-color-utilities">material-color-utilities</a>: viewing conditions, colourfulness, and distance in CAM16-UCS. Material Design builds its colours on the same model.</dd></div>
        <div><dt>Contrast and screens</dt><dd><a href="https://colorjs.io">Color.js</a>: APCA, WCAG 2, colour spaces for the three kinds of screen, and checking which colours a screen can show.</dd></div>
        <div><dt>The solver</dt><dd>TypeScript: settings, model, solve and formats. It runs in the browser in a background worker, and on the command line to write JSON, CSV and Markdown.</dd></div>
        <div><dt>Settings</dt><dd>Everything above is a setting: bases, rooms, target, exceptions, yellow, number of hues, tiers, muted share. Change one in Settings and watch the palette follow.</dd></div>
      </dl>
    </section>`;
}
