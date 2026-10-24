/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< APP >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The palette site: overview, tiers, one page per color, the comparison with Codemos, how it       |
| works, settings and export. One view at a time, one mode at a time; the page itself is the       |
| mode's base.                                                                                     |
\*------------------------------------------------------------------------------------------------*/

import { CONFIG } from "../config";
import { toCsv, toJson, toMarkdown } from "../palette/formats";
import { apca, makeModel, REFERENCES, wcag, wcagLevel } from "../palette/model";
import { type Gamut, GAMUTS, type Mode, NAMES, type Settings, CODEMOS, CODEMOS_MUTED } from "../palette/settings";
import type { Color, GamutPalette, Palette, Swatch } from "../palette/solve";
import { type Context, explain, updateDemo } from "./explain";
import type { Request, Response } from "./worker";

/* >-----------------------------------------< State >------------------------------------------< */

type Variant = "default" | "muted";
type Format = "json" | "csv" | "md";

const VIEWS = ["overview", "tiers", "compare", "how", "tune", "export"] as const;

const STORE = "ek-colors:settings";

/** Remembers whether the comparison with Codemos is shown. */
const COMPARE = "ek-colors:compare";

/** What each tier is for. */
const ROLES: Readonly<Record<number, string>> = {
  15: "Dividers and faint fills",
  30: "Icons, outlines and controls",
  45: "Large text and the color itself",
  60: "Labels and links",
  75: "Body text",
  90: "Long reading",
};

/** The widest gamut tier this screen covers. */
const SCREEN: Gamut = matchMedia("(color-gamut: rec2020)").matches
  ? "ultra"
  : matchMedia("(color-gamut: p3)").matches
    ? "wide"
    : "standard";

const state = {
  settings: load(),
  mode: (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") as Mode,
  variant: "default" as Variant,
  view: "overview",
  format: "json" as Format,
  gamut: SCREEN,
  palettes: {} as Partial<Record<Gamut, GamutPalette>>,
  solving: false,
  took: 0,
  error: null as string | null,
};

/**
 * The saved settings, or EK Colors'.
 *
 * @returns  Settings.
 */
function load(): Settings {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) return { ...CONFIG, ...(JSON.parse(saved) as Partial<Settings>) };
  } catch {
    // Storage can be blocked; the defaults do.
  }
  return structuredClone(CONFIG);
}

/**
 * Remembers the settings in this browser.
 */
function save(): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(state.settings));
  } catch {
    // Storage can be blocked; the page works without it.
  }
}

/* >-----------------------------------------< Solve >------------------------------------------< */

const worker = new Worker("worker.js", { type: "module" });
let latest = 0;
let timer = 0;

worker.addEventListener("message", (event: MessageEvent<Response>) => {
  const data = event.data;
  if (data.id !== latest) return;
  if ("error" in data) {
    [state.solving, state.error] = [false, data.error];
    status();
    return;
  }
  state.palettes[data.gamut] = data.palette;
  const shown = data.gamut === state.gamut;
  if (shown) [state.solving, state.took, state.error] = [false, data.took, null];
  // The other gamut tiers solve after the one on screen, one at a time, so a newer change can start sooner.
  const next = GAMUTS.find((g) => !state.palettes[g]);
  if (next) post(next);
  if (shown || state.view === "export") {
    if (state.view === "tune") updateTune();
    else render();
  }
  status();
});

/**
 * Asks the worker for one gamut tier of the current settings.
 *
 * @param gamut  The gamut tier.
 */
function post(gamut: Gamut): void {
  worker.postMessage({ id: latest, settings: state.settings, gamut } satisfies Request);
}

/**
 * Solves the current settings, a moment after the last change: the gamut tier on screen first.
 *
 * @param wait  Milliseconds to wait for more changes.
 */
function solve(wait = 0): void {
  clearTimeout(timer);
  state.solving = true;
  status();
  timer = window.setTimeout(() => {
    latest++;
    state.palettes = {};
    post(state.gamut);
  }, wait);
}

/**
 * What the explainer needs to know about the page.
 *
 * @returns  The settings, mode, gamut tier and palette on screen.
 */
function context(): Context {
  return { settings: state.settings, mode: state.mode, gamut: state.gamut, palette: current(), label };
}

/**
 * The palette on screen.
 *
 * @returns  The current gamut tier's palette, or null while it solves.
 */
function current(): GamutPalette | null {
  return state.palettes[state.gamut] ?? null;
}

/* >----------------------------------------< Helpers >-----------------------------------------< */

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;

/**
 * A color key as people read it.
 *
 * @param key  E.g. "red" or "hue-3".
 * @returns    E.g. "Red" or "Hue 3".
 */
function label(key: string): string {
  const text = key.replace("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const LEVELS: Readonly<Record<Swatch["wcagLevel"], string>> = {
  AAA: "AAA",
  AA: "AA",
  "AA large": "AA large",
  below: "Below 3:1",
};

/**
 * A WCAG level as a badge.
 *
 * @param level  The level.
 * @returns      HTML.
 */
function badge(level: Swatch["wcagLevel"]): string {
  return `<span class="badge" data-level="${level.replace(" ", "-")}">${LEVELS[level]}</span>`;
}

/**
 * A swatch as a card: the color, a text sample in it, and its numbers.
 *
 * @param s      The swatch.
 * @param title  Its name on the card.
 * @param href   Where a click goes, if anywhere.
 * @param limit  Whether this color's reach lowered its tier's target.
 * @returns      HTML.
 */
function card(s: Swatch, title: string, href?: string, limit = false): string {
  const tag = href ? "a" : "div";
  return `<${tag} class="card"${href ? ` href="#${href}"` : ""} style="--c:${s.color}">
    <span class="fill"></span>
    <span class="sample">Aa</span>
    <span class="card-name">${title}</span>
    <span class="mono value">${s.color}</span>
    <span class="facts"><span class="mono">Lc ${s.apca.toFixed(1)}</span>${badge(s.wcagLevel)}</span>
    <span class="mono soft">WCAG ${s.wcag.toFixed(2)} · M ${s.colorfulness.toFixed(1)}${s.short ? " ▾" : ""}</span>
    ${limit ? `<span class="limit">▾ Sets this tier's colorfulness</span>` : ""}
  </${tag}>`;
}

/**
 * The colors of the current mode.
 *
 * @returns  Its colors, or none before the first solve.
 */
function colors(): readonly Color[] {
  return current()?.[state.mode].colors ?? [];
}

/**
 * How even a ring of neighbor differences is, in words people can compare.
 *
 * @param ring  Neighbor distances.
 * @returns     E.g. "9.1 to 10.3".
 */
function range(ring: readonly number[]): string {
  return `${Math.min(...ring).toFixed(1)} to ${Math.max(...ring).toFixed(1)}`;
}

/**
 * A tier's colorfulness, and what lowered it.
 *
 * @param tier  The tier.
 * @returns     E.g. "Colorfulness M 12.7, lowered from 40: Red can't reach more".
 */
function held(tier: number): string {
  const p = current()?.[state.mode];
  if (!p) return "Colorfulness …";
  const limit = p.limits[tier];
  return limit
    ? `Colorfulness M ${String(p.targets[tier])}, lowered from ${String(state.settings.colorfulness)}: ${label(limit)} can't reach more`
    : `Colorfulness M ${String(p.targets[tier])}, every color reaches it`;
}

/**
 * Why a color on a tier is less colorful than the target, if it is.
 *
 * @param key   The color.
 * @param tier  The tier.
 * @param s     Its swatch there.
 * @returns     HTML: "sets the tier", "lowered from 40", "screen limit" or nothing.
 */
function lowered(key: string, tier: number, s: Swatch): string {
  const p = current()?.[state.mode];
  if (!p) return "";
  if (p.limits[tier] === key) return ` <span class="limit">▾ sets the tier</span>`;
  if (s.short) return ` <span class="limit">▾ screen limit</span>`;
  if (p.limits[tier]) return ` <span class="soft">lowered from ${String(state.settings.colorfulness)}</span>`;
  return "";
}

/* >---------------------------------------< Hue circle >---------------------------------------< */

interface Dot {
  readonly hue: number;
  readonly m: number;
  readonly color: string;
  readonly hollow?: boolean;

  /** Brown sits among the oranges, so it's drawn as a diamond to tell it apart. */
  readonly brown?: boolean;
}

/**
 * The hue circle: CAM16 hue around, colorfulness out from the center, with CAM16's unique hues
 * (solid) and halfway mixes (dashed) as spokes.
 *
 * @param dots  The colors to place.
 * @returns     SVG.
 */
function circle(dots: readonly Dot[]): string {
  const R = 150;
  const max = 60;
  const at = (hue: number, r: number) => {
    const a = (hue * Math.PI) / 180;
    return [r * Math.cos(a), -r * Math.sin(a)] as const;
  };
  const rings = [20, 40, 60].map(
    (m) => `<circle r="${String((m / max) * R)}" class="grid"></circle><text x="4" y="${String(-(m / max) * R - 4)}" class="axis">M ${String(m)}</text>`,
  );
  const spokes = REFERENCES.map((ref) => {
    const [x, y] = at(ref.hue, R + 6);
    const [lx, ly] = at(ref.hue, R + 24);
    return `<line x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="spoke${ref.unique ? "" : " half"}"></line>
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="axis" text-anchor="middle" dominant-baseline="middle">${ref.label}</text>`;
  });
  const marks = dots.map((d) => {
    const [x, y] = at(d.hue, (Math.min(d.m, max) / max) * R);
    const [cx, cy] = [x.toFixed(1), y.toFixed(1)];
    const paint = d.hollow ? `fill="none" stroke="${d.color}" stroke-width="2.5"` : `fill="${d.color}"`;
    if (d.brown) {
      const r = d.hollow ? 8 : 10;
      return `<rect x="${(x - r / Math.SQRT2).toFixed(1)}" y="${(y - r / Math.SQRT2).toFixed(1)}" width="${(r * Math.SQRT2).toFixed(1)}" height="${(r * Math.SQRT2).toFixed(1)}" rx="${String(r / 4)}" transform="rotate(45 ${cx} ${cy})" ${paint}></rect>`;
    }
    return `<circle cx="${cx}" cy="${cy}" r="${d.hollow ? "7" : "9"}" ${paint}></circle>`;
  });
  const legend = dots.some((d) => d.brown)
    ? `<rect x="152" y="185" width="8" height="8" rx="2" transform="rotate(45 156 189)" class="key-mark"></rect><text x="196" y="193" class="axis" text-anchor="end">Brown</text>`
    : "";
  return `<svg class="circle" viewBox="-200 -200 400 400" role="img" aria-label="Hue circle">
    ${rings.join("")}${spokes.join("")}${marks.join("")}${legend}</svg>`;
}

/* >----------------------------------------< Overview >----------------------------------------< */

/**
 * The identity tier of the current mode, big, with the hue circle.
 *
 * @returns  HTML.
 */
function overview(): string {
  const { settings, mode } = state;
  const tier = settings.identityTier;
  const room = settings.rooms[mode];
  const list = colors();
  const ring = current()?.[mode].ring[tier] ?? [];
  return `<section class="intro">
      <h1>EK Colors</h1>
      <p>${String(list.length)} colors that read the same on the ${mode} base: each sits exactly on its APCA contrast, aims at the same colorfulness, and is as different from its neighbors as they are from theirs.</p>
    </section>
    <section>
      <h2>The colors <span class="soft">· Lc ${String(tier)}, the tier that stands for each hue</span></h2>
      <div class="cards">${list.map((c) => card(c.tiers[tier]!.default, label(c.key), c.key, current()?.[mode].limits[tier] === c.key)).join("")}</div>
      <h3>Muted</h3>
      <div class="cards small">${list
        .filter((c) => c.tiers[tier]!.muted)
        .map((c) => card(c.tiers[tier]!.muted!, label(c.key), c.key))
        .join("")}</div>
    </section>
    <section class="split">
      <div>${circle(list.flatMap((c) => [c.tiers[tier]!.default, ...(c.tiers[tier]!.muted ? [c.tiers[tier]!.muted!] : [])].map((s) => ({ hue: s.hue, m: s.colorfulness, color: s.color, brown: c.key === "brown" }))))}</div>
      <dl class="facts-list">
        <div><dt>Base</dt><dd class="mono">${settings.bases[mode]}</dd></div>
        <div><dt>Room</dt><dd>${String(room.lux)} lux, ${["dark", "dim", "average"][room.surround] ?? ""} surround</dd></div>
        <div><dt>Colorfulness</dt><dd>${held(tier)}; muted at ${String(Math.round(settings.muted * 100))}%</dd></div>
        <div><dt>Yellow</dt><dd>hue ${String(settings.yellowHue[mode])}°</dd></div>
        <div><dt>Neighbor differences</dt><dd>${ring.length ? range(ring) : "…"} (CAM16-UCS)</dd></div>
        <div><dt>▾</dt><dd>The screen held this color below its colorfulness.</dd></div>
      </dl>
    </section>`;
}

/* >-----------------------------------------< Tiers >------------------------------------------< */

/**
 * Every tier of the current mode and variant, one section each.
 *
 * @returns  HTML.
 */
function tiers(): string {
  const { settings, mode, variant } = state;
  return `<section class="intro">
      <h1>Tiers</h1>
      <p>Every color on every APCA contrast against the ${mode} base. Pick the tier by what the color does.</p>
    </section>
    ${settings.tiers
      .map((tier) => {
        const ring = current()?.[mode].ring[tier] ?? [];
        const list = colors().filter((c) => c.tiers[tier]![variant]);
        return `<section>
          <h2>Lc ${String(tier)} <span class="soft">· ${ROLES[tier] ?? ""}</span></h2>
          <p class="soft">${held(tier)} · neighbor differences ${ring.length ? range(ring) : "…"}</p>
          <div class="cards small">${list.map((c) => card(c.tiers[tier]![variant]!, label(c.key), c.key, current()?.[mode].limits[tier] === c.key)).join("")}</div>
        </section>`;
      })
      .join("")}`;
}

/* >-----------------------------------------< Color >------------------------------------------< */

/**
 * One color: every tier, default and muted, with all its numbers.
 *
 * @param key  The color.
 * @returns    HTML.
 */
function color(key: string): string {
  const list = colors();
  const c = list.find((x) => x.key === key);
  if (!c) return `<section class="intro"><h1>${label(key)}</h1><p>Solving…</p></section>`;
  const id = c.tiers[state.settings.identityTier]!.default;
  const table = (variant: Variant) => {
    const rows = state.settings.tiers.filter((t) => c.tiers[t]![variant]);
    if (!rows.length) return "";
    return `<section>
      <h2>${variant === "default" ? "Default" : "Muted"}</h2>
      <div class="scroll"><table>
        <thead><tr><th>Tier</th><th>Sample</th><th>Hex</th><th>APCA</th><th>WCAG 2</th><th>Lightness J</th><th>Chroma C</th><th>Colorfulness M</th><th>Hue</th></tr></thead>
        <tbody>${rows
          .map((t) => {
            const s = c.tiers[t]![variant]!;
            return `<tr>
              <th scope="row">Lc ${String(t)}<span class="soft">${ROLES[t] ?? ""}</span></th>
              <td><span class="pair" style="--c:${s.color}"><span class="fill"></span><span class="sample">Aa</span></span></td>
              <td class="mono">${s.color}</td>
              <td class="mono">${s.apca.toFixed(1)}</td>
              <td><span class="mono">${s.wcag.toFixed(2)}</span> ${badge(s.wcagLevel)}</td>
              <td class="mono">${s.lightness.toFixed(1)}</td>
              <td class="mono">${s.chroma.toFixed(1)}</td>
              <td class="mono">${s.colorfulness.toFixed(1)}${variant === "default" ? lowered(c.key, t, s) : ""}</td>
              <td class="mono">${s.hue.toFixed(1)}° <span class="soft">${s.name}</span></td>
            </tr>`;
          })
          .join("")}</tbody>
      </table></div>
    </section>`;
  };
  return `<nav class="chips" aria-label="Colors">${list
    .map((x) => `<a href="#${x.key}" style="--c:${x.tiers[state.settings.identityTier]!.default.color}"${x.key === key ? ' aria-current="page"' : ""}><span class="dot"></span>${label(x.key)}</a>`)
    .join("")}</nav>
    <section class="intro hero" style="--c:${id.color}">
      <h1>${label(key)}</h1>
      <p>CAM16 hue ${id.hue.toFixed(1)}°, read as ${id.name}. Aims at colorfulness ${c.target.toFixed(0)}${state.settings.offsets[state.mode][key] ? `, ${state.settings.offsets[state.mode][key]! > 0 ? "+" : ""}${String(state.settings.offsets[state.mode][key])} from the target` : ""}.${state.settings.equalTiers ? " A tier lowers it to what its least colorful hue can reach." : ""}</p>
    </section>
    ${table("default")}${table("muted")}`;
}

/* >----------------------------------------< Compare >-----------------------------------------< */

/**
 * Codemos next to EK Colors on the identity tier: the hue circle, each color, and how even the
 * differences between neighbors are.
 *
 * @returns  HTML.
 */
function compare(): string {
  const { settings, mode, variant } = state;
  if (settings.hues !== NAMES.length)
    return `<section class="intro"><h1>Compare with Codemos</h1><p>Codemos has eight hues. Set Hues to 8 in Settings to compare.</p></section>`;
  const model = makeModel(settings);
  const base = settings.bases[mode];
  const tier = settings.identityTier;
  const source = variant === "default" ? CODEMOS[mode] : CODEMOS_MUTED[mode];
  const rows = colors()
    .filter((c) => source[c.key] && c.tiers[tier]![variant])
    .map((c) => {
      const color = source[c.key]!;
      const cam = model.cam(mode, color);
      const ratio = wcag(color, base);
      const old: Swatch = {
        color,
        hue: cam.hue,
        chroma: cam.chroma,
        colorfulness: cam.m,
        lightness: cam.j,
        name: "",
        apca: apca(color, base),
        wcag: ratio,
        wcagLevel: wcagLevel(ratio),
        short: false,
      };
      return { key: c.key, old, now: c.tiers[tier]![variant]! };
    });
  const ring = (list: readonly string[]) => list.map((h, i) => model.distance(mode, h, list[(i + 1) % list.length]!));
  const hues = rows.filter((r) => r.key !== "brown");
  const oldRing = ring(hues.map((r) => r.old.color));
  const newRing = ring(hues.map((r) => r.now.color));
  const most = Math.max(...oldRing, ...newRing);
  const bars = (values: readonly number[]) =>
    values
      .map(
        (d, i) => `<div class="bar-row"><span class="soft">${label(hues[i]!.key)} → ${label(hues[(i + 1) % hues.length]!.key)}</span>
          <span class="bar"><span style="width:${((d / most) * 100).toFixed(1)}%"></span></span><span class="mono">${d.toFixed(1)}</span></div>`,
      )
      .join("");
  return `<section class="intro">
      <h1>Compare with Codemos</h1>
      <p>Codemos's ${variant} colors next to EK Colors' on Lc ${String(tier)}, on the ${mode} base. Codemos was picked by eye; EK Colors is solved.</p>
    </section>
    <section class="split">
      <div>${circle([...rows.map((r) => ({ hue: r.old.hue, m: r.old.colorfulness, color: r.old.color, hollow: true, brown: r.key === "brown" })), ...rows.map((r) => ({ hue: r.now.hue, m: r.now.colorfulness, color: r.now.color, brown: r.key === "brown" }))])}</div>
      <div class="legend">
        <p><span class="key hollow"></span> Codemos <span class="key"></span> EK Colors</p>
        <p class="soft">Distance from the center is colorfulness. EK Colors' dots share one ring; Codemos's scatter, so some of its colors look stronger than others.</p>
      </div>
    </section>
    <section>
      <h2>Each color</h2>
      <div class="pairs">${rows
        .map(
          (r) => `<div class="versus"><h3>${label(r.key)}</h3>${card(r.old, "Codemos")}${card(r.now, "EK Colors", r.key)}</div>`,
        )
        .join("")}</div>
    </section>
    <section>
      <h2>Neighbor differences <span class="soft">· CAM16-UCS</span></h2>
      <p class="soft">How different each color looks from the next one around the circle. Even bars mean no two neighbors are easier to confuse than the rest.</p>
      <div class="split even">
        <div><h3>Codemos <span class="soft">· ${range(oldRing)}</span></h3>${bars(oldRing)}</div>
        <div><h3>EK Colors <span class="soft">· ${range(newRing)}</span></h3>${bars(newRing)}</div>
      </div>
    </section>`;
}

/* >----------------------------------------< Settings >----------------------------------------< */

/**
 * A number control bound to a setting.
 *
 * @param path   The setting, e.g. "colorfulness" or "yellowHue.light".
 * @param title  Its label.
 * @param range  Min, max and step.
 * @param range.0  Minimum.
 * @param range.1  Maximum.
 * @param range.2  Step.
 * @param slider Whether to show a slider too.
 * @returns      HTML.
 */
function number(path: string, title: string, [min, max, step]: readonly [number, number, number], slider = false): string {
  const value = String(read(path) ?? 0);
  const id = `set-${path.replaceAll(".", "-")}`;
  return `<label class="field" for="${id}"><span>${title}</span>
    ${slider ? `<input type="range" data-set="${path}" min="${String(min)}" max="${String(max)}" step="${String(step)}" value="${value}" aria-label="${title}">` : ""}
    <input id="${id}" type="number" data-set="${path}" min="${String(min)}" max="${String(max)}" step="${String(step)}" value="${value}">
  </label>`;
}

/**
 * A setting by its path.
 *
 * @param path  E.g. "rooms.dark.lux".
 * @returns     Its value.
 */
function read(path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], state.settings);
}

/**
 * Changes a setting by its path.
 *
 * @param path   E.g. "rooms.dark.lux".
 * @param value  The new value.
 */
function write(path: string, value: unknown): void {
  const next = structuredClone(state.settings) as unknown as Record<string, unknown>;
  const keys = path.split(".");
  let o = next;
  for (const k of keys.slice(0, -1)) o = (o[k] ??= {}) as Record<string, unknown>;
  o[keys.at(-1)!] = value;
  state.settings = next as unknown as Settings;
  save();
}

/**
 * The settings, a group at a time, with a live strip of the identity tier.
 *
 * @returns  HTML.
 */
function tune(): string {
  const s = state.settings;
  const keys = colors()
    .map((c) => c.key)
    .filter((k) => k !== "brown");
  const offsets = (mode: Mode) =>
    keys.map((k) => number(`offsets.${mode}.${k}`, label(k), [-30, 30, 1])).join("");
  return `<section class="intro">
      <h1>Settings</h1>
      <p>Change a setting and the palette solves again. Changes stay in this browser.</p>
      <p><button type="button" data-action="reset">Reset to EK Colors</button></p>
    </section>
    <div id="tune-preview" class="strip"></div>
    <section class="group">
      <h2>Colorfulness</h2>
      <p class="soft">One CAM16 colorfulness every color aims at, in both modes. A color the screen can't make that colorful goes as far as it can.</p>
      ${number("colorfulness", "Target M", [10, 80, 1], true)}
      ${number("muted", "Muted share", [0.1, 0.9, 0.05], true)}
      <label class="field" for="set-equal"><span>Equal per tier</span><input id="set-equal" type="checkbox" data-action="equal" ${s.equalTiers ? "checked" : ""}></label>
      <p class="soft">On: a tier aims at what its least colorful hue can reach, so every color on it is equally colorful. Off: each color goes as far as the screen allows.</p>
      <label class="field" for="set-brown-on"><span>Brown</span><input id="set-brown-on" type="checkbox" data-action="brown" ${s.brown === null ? "" : "checked"}></label>
      ${s.brown === null ? "" : number("brown", "Brown share", [0.1, 1, 0.05], true)}
    </section>
    <section class="group">
      <h2>Exceptions</h2>
      <p class="soft">A color's change to the target, per mode. Keep these rare, each with a reason.</p>
      <div class="split even"><div><h3>Light</h3>${offsets("light")}</div><div><h3>Dark</h3>${offsets("dark")}</div></div>
    </section>
    <section class="group">
      <h2>Hues</h2>
      <p class="soft">Yellow stays put; every other hue moves to even out the differences. CAM16's pure yellow is 90°.</p>
      ${number("yellowHue.light", "Yellow, light", [80, 120, 1], true)}
      ${number("yellowHue.dark", "Yellow, dark", [80, 120, 1], true)}
      ${number("hues", "How many hues", [4, 16, 1])}
    </section>
    <section class="group">
      <h2>Tiers</h2>
      <p class="soft">The APCA contrasts every color gets. The identity tier stands for the hue and sets every tier's starting hues.</p>
      <div class="checks">${[15, 30, 45, 60, 75, 90]
        .map((t) => `<label for="tier-${String(t)}"><input id="tier-${String(t)}" type="checkbox" data-tier="${String(t)}" ${s.tiers.includes(t) ? "checked" : ""}> Lc ${String(t)}</label>`)
        .join("")}</div>
      <label class="field" for="set-identity"><span>Identity tier</span><select id="set-identity" data-set="identityTier">${s.tiers
        .map((t) => `<option value="${String(t)}" ${t === s.identityTier ? "selected" : ""}>Lc ${String(t)}</option>`)
        .join("")}</select></label>
    </section>
    <section class="group">
      <h2>Viewing</h2>
      <p class="soft">The backgrounds and the rooms colors are seen in. Surround is how bright the room is around the screen.</p>
      <div class="split even">${(["light", "dark"] as const)
        .map(
          (m) => `<div><h3>${label(m)}</h3>
            <label class="field" for="set-base-${m}"><span>Base</span><input id="set-base-${m}" type="text" data-set="bases.${m}" value="${s.bases[m]}" spellcheck="false" pattern="#[0-9A-Fa-f]{6}"></label>
            ${number(`rooms.${m}.lux`, "Room lux", [1, 1000, 1])}
            <label class="field" for="set-surround-${m}"><span>Surround</span><select id="set-surround-${m}" data-set="rooms.${m}.surround">${["Dark", "Dim", "Average"]
              .map((name, i) => `<option value="${String(i)}" ${i === s.rooms[m].surround ? "selected" : ""}>${name}</option>`)
              .join("")}</select></label></div>`,
        )
        .join("")}</div>
    </section>`;
}

/**
 * Refreshes the live strip without redrawing the controls.
 */
function updateTune(): void {
  const strip = document.querySelector("#tune-preview");
  if (!strip) return;
  const tier = state.settings.identityTier;
  strip.innerHTML = colors()
    .map((c) => {
      const s = c.tiers[tier]?.default;
      return s ? `<span class="strip-item" style="--c:${s.color}" title="${label(c.key)} ${s.color}"><span class="fill"></span><span class="mono">${s.color.startsWith("#") ? s.color : label(c.key)}</span></span>` : "";
    })
    .join("");
  // A new hue count brings new colors, so their exceptions need drawing.
  const shown = document.querySelectorAll('[data-set^="offsets.light."]').length;
  if (shown !== colors().filter((c) => c.key !== "brown").length) render();
}

/* >-----------------------------------------< Export >-----------------------------------------< */

/**
 * The palette as text to copy.
 *
 * @returns  HTML.
 */
function exporting(): string {
  const p = GAMUTS.every((g) => state.palettes[g]) ? (state.palettes as Palette) : null;
  const text = p ? { json: toJson, csv: toCsv, md: toMarkdown }[state.format](state.settings, p) : "Solving every gamut tier…";
  const tab = (f: Format, t: string) => `<button type="button" data-format="${f}" aria-pressed="${String(state.format === f)}">${t}</button>`;
  return `<section class="intro">
      <h1>Export</h1>
      <p>Every gamut tier, both modes, every tier, default and muted. JSON keeps the settings too, so the palette can be solved again.</p>
    </section>
    <section>
      <div class="row"><div class="segmented">${tab("json", "JSON")}${tab("csv", "CSV")}${tab("md", "Markdown")}</div>
      <button type="button" data-action="copy">Copy</button><span id="copied" class="soft" role="status"></span></div>
      <textarea id="export-text" readonly spellcheck="false">${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</textarea>
    </section>`;
}

/* >-----------------------------------------< Views >------------------------------------------< */

/**
 * Draws the current view.
 */
function render(): void {
  const view = state.view;
  document.documentElement.dataset.theme = state.mode;
  document.documentElement.style.setProperty("--base-light", state.settings.bases.light);
  document.documentElement.style.setProperty("--base-dark", state.settings.bases.dark);
  const isColor = !(VIEWS as readonly string[]).includes(view);
  for (const a of document.querySelectorAll<HTMLAnchorElement>(".nav a")) {
    const target = a.getAttribute("href")!.slice(1);
    a.toggleAttribute("aria-current", target === view || (target === "colors" && isColor));
  }
  // On phones the views scroll sideways; keep the current one in sight.
  document.querySelector(".nav a[aria-current]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode));
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-gamut]")) {
    b.setAttribute("aria-pressed", String(b.dataset.gamut === state.gamut));
    b.title = b.dataset.gamut === SCREEN ? "Your screen" : "";
  }
  const beyond = GAMUTS.indexOf(state.gamut) > GAMUTS.indexOf(SCREEN);
  $<HTMLElement>("#beyond").hidden = !beyond || view === "tune" || view === "export";
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-variant]")) b.setAttribute("aria-pressed", String(b.dataset.variant === state.variant));
  $<HTMLElement>("#variant").hidden = view !== "tiers" && view !== "compare";
  const main = $<HTMLElement>("main");
  const first = colors()[0]?.key ?? "red";
  main.innerHTML =
    view === "overview" ? overview()
    : view === "tiers" ? tiers()
    : view === "compare" ? compare()
    : view === "tune" ? tune()
    : view === "export" ? exporting()
    : view === "how" ? explain(context())
    : color(view === "colors" ? first : view);
  if (view === "tune") updateTune();
}

/**
 * Shows whether the palette is being solved.
 */
function status(): void {
  const el = $<HTMLElement>("#status");
  el.dataset.state = state.error ? "error" : state.solving ? "busy" : "done";
  el.textContent = state.error ?? (state.solving ? "Solving…" : `Solved in ${(state.took / 1000).toFixed(1)} s`);
}

/* >-----------------------------------< Hidden comparison >------------------------------------< */

/**
 * Whether the comparison with Codemos is shown. It's hidden until Shift+C, or five quick taps on
 * the name, shows it.
 *
 * @returns  Whether it's shown in this browser.
 */
function comparing(): boolean {
  try {
    return localStorage.getItem(COMPARE) === "on";
  } catch {
    return shown;
  }
}

let shown = false;

/**
 * Shows or hides the comparison with Codemos, and says which.
 */
function toggleCompare(): void {
  shown = !comparing();
  try {
    localStorage.setItem(COMPARE, shown ? "on" : "off");
  } catch {
    // Storage can be blocked; it then lasts until the page closes.
  }
  $<HTMLElement>("#nav-compare").hidden = !shown;
  const el = $<HTMLElement>("#status");
  el.textContent = shown ? "Compare with Codemos shown" : "Compare with Codemos hidden";
  window.setTimeout(status, 2000);
  if (!shown && state.view === "compare") location.hash = "overview";
}

document.addEventListener("keydown", (event) => {
  const typing = event.target instanceof Element && event.target.closest("input, textarea, select");
  if (event.shiftKey && event.code === "KeyC" && !event.metaKey && !event.ctrlKey && !typing) toggleCompare();
});

let taps: number[] = [];
$("#brand").addEventListener("click", () => {
  const now = performance.now();
  taps = [...taps.filter((t) => now - t < 2000), now];
  if (taps.length >= 5) {
    taps = [];
    toggleCompare();
  }
});

$<HTMLElement>("#nav-compare").hidden = !comparing();

/**
 * Opens the view the address names.
 */
function route(): void {
  state.view = location.hash.slice(1) || "overview";
  if (state.view === "compare" && !comparing()) {
    location.replace("#overview");
    return;
  }
  render();
  window.scrollTo(0, 0);
}

/* >-----------------------------------------< Events >-----------------------------------------< */

document.addEventListener("click", (event) => {
  const el = (event.target as Element).closest<HTMLElement>("[data-mode],[data-variant],[data-gamut],[data-format],[data-action]");
  if (!el) return;
  const { mode, variant, gamut, format, action } = el.dataset;
  if (gamut) {
    state.gamut = gamut as Gamut;
    if (!state.palettes[state.gamut]) {
      state.solving = true;
      status();
    }
  }
  if (mode) state.mode = mode as Mode;
  if (variant) state.variant = variant as Variant;
  if (format) state.format = format as Format;
  if (action === "reset") {
    state.settings = structuredClone(CONFIG);
    save();
    solve();
  }
  if (action === "copy") {
    const area = $<HTMLTextAreaElement>("#export-text");
    navigator.clipboard.writeText(area.value).then(
      () => ($("#copied").textContent = "Copied"),
      () => {
        area.select();
        $("#copied").textContent = "Selected; press Copy on your keyboard";
      },
    );
    return;
  }
  if (action === "equal") {
    write("equalTiers", (el as HTMLInputElement).checked);
    solve();
  }
  if (action === "brown") {
    write("brown", (el as HTMLInputElement).checked ? (CONFIG.brown ?? 0.6) : null);
    solve();
  }
  render();
});

document.addEventListener("input", (event) => {
  const el = event.target as HTMLInputElement;
  if (el.dataset.demo) return void updateDemo(context(), el.dataset.demo);
  if (el.dataset.tier) {
    const checked = [...document.querySelectorAll<HTMLInputElement>("[data-tier]")].filter((c) => c.checked).map((c) => Number(c.dataset.tier));
    if (!checked.length) return void (el.checked = true);
    write("tiers", checked);
    if (!checked.includes(state.settings.identityTier)) write("identityTier", checked.includes(45) ? 45 : checked[0]);
    solve(150);
    return;
  }
  const path = el.dataset.set;
  if (!path) return;
  if (path.startsWith("bases.")) {
    if (!/^#[0-9a-f]{6}$/i.test(el.value)) return;
    write(path, el.value.toUpperCase());
    document.documentElement.style.setProperty(`--base-${path.split(".")[1]!}`, el.value);
  } else {
    if (el.value === "" || Number.isNaN(Number(el.value))) return;
    write(path, Number(el.value));
    for (const twin of document.querySelectorAll<HTMLInputElement>(`[data-set="${path}"]`)) if (twin !== el) twin.value = el.value;
  }
  solve(150);
});

// Settings' color strip sticks just below the bar, whose height changes as it wraps.
new ResizeObserver(([entry]) => {
  const height = (entry!.target as HTMLElement).offsetHeight;
  document.documentElement.style.setProperty("--header-height", `${String(height)}px`);
}).observe($("header"));

addEventListener("hashchange", route);
route();
solve();
