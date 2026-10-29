/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< COLOR >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| A color's page: its tables, one row per tier, and what each column means; a neutral color's page |
| with its share of the base's tint.                                                               |
\*------------------------------------------------------------------------------------------------*/

import { deltaE, JUST_VISIBLE } from "../../palette/model";
import { GAMUT_NAMES, type Mode, ROLES } from "../../palette/settings";
import { GRAY, NEUTRAL_BAND, type Swatch, colorKeys, customKeys, identityOf, tinted } from "../../palette/solve";
import { current, model, onScreen } from "../derived";
import { measured, signed } from "../graph";
import { FLAG, type Place, badge, colors, copyable, customOf, isLowered, label, lowered, neutralOf, ownTarget, setsTier } from "../parts";
import { popButton, popSource } from "../popover";
import { SHARE_ZONES, read, shareMeter, shareZone } from "../settings/fields";
import { type Variant, state } from "../state";
import { identityLabel } from "./tiers";

/** A color table's column: its key, its name, its unit and what it means. */
interface Column {
  readonly key: string;
  readonly name: () => string;
  readonly unit?: string;
  readonly what: () => string;
}

const COLUMNS: readonly Column[] = [
  { key: "tier", name: () => "Tier", what: () => "The contrast step the row sits on, with what it's for. Every color on a tier has the same APCA contrast against the background." },
  { key: "sample", name: () => "Sample", what: () => "The color as a fill and as text on the background." },
  {
    key: "value",
    // Named for the format the gamut gives: hex codes on Standard, CSS color() wider.
    name: () => (state.gamut === "standard" ? "Hex" : "CSS"),
    what: () =>
      state.gamut === "standard"
        ? "The color as a hex code, for every screen."
        : `The color as a CSS color() for ${GAMUT_NAMES[state.gamut]} screens. A screen that can't show it falls back to the nearest color it can; the Standard gamut gives hex codes.`,
  },
  { key: "apca", name: () => "APCA", unit: "Lc", what: () => {
      const [low, high] = [Math.min(...state.settings.tiers), Math.max(...state.settings.tiers)];
      const role = (t: number) => (ROLES[t] ?? "").toLowerCase();
      return `Contrast against the background as APCA's Lc, here from ${measured(String(low))} for ${role(low)} to ${measured(String(high))} for ${role(high)}. Each color is solved to land exactly on its tier.`;
    },
  },
  { key: "wcag", name: () => "WCAG 2", what: () => "Contrast against the background as WCAG 2's ratio, from 1:1 to 21:1, with the level it reaches. Each level's badge explains what it allows." },
  { key: "lightness", name: () => "Lightness", unit: "J", what: () => "How light the color looks, from 0 for black to 100 for white. The tier's contrast fixes it." },
  { key: "chroma", name: () => "Chroma", unit: "C", what: () => "How far the color is from gray, measured against a white under the same light." },
  {
    key: "colorfulness",
    name: () => "Colorfulness",
    unit: "M",
    what: () =>
      `How much color the eye sees, on its own scale rather than against white. ${state.settings.equalTiers ? "With Equal per tier on, a tier's colors aim at the same M so they look equally vivid" : "Each color aims at the target M, as far as the screen allows"}; a chip says when a color falls short of its own aim.`,
  },
  { key: "hue", name: () => "Hue", what: () => "The hue angle around the color wheel, 0 to 360°, and how it reads as a mix of the four unique hues: R 4 B is red with 4% blue." },
];

/**
 * A column heading as a button that opens what the column means.
 *
 * @param col    The column.
 * @param table  Which table it heads, so each heading opens its own popover.
 * @returns      HTML.
 */
function heading(col: Column, table: string): string {
  const name = col.name();
  const unit = col.unit ? `<span class="unit"> ${col.unit}</span>` : "";
  return popButton(`column:${col.key}:${table}`, `${name}${unit}`, `What ${name} means`, "metric");
}

popSource("columns", () => `<h3>The columns</h3>
    <dl class="pop-facts words">${COLUMNS.map((c) => `<div><dt>${c.name()}${c.unit ? ` <span class="unit">${c.unit}</span>` : ""}</dt><dd>${c.what()}</dd></div>`).join("")}</dl>`);

popSource("column", (which) => {
  const col = COLUMNS.find((c) => c.key === which.split(":")[0]);
  return col ? `<h3>${col.name()}${col.unit ? ` <span class="unit">${col.unit}</span>` : ""}</h3><p>${col.what()}</p>` : "";
});

/**
 * A cell of a color's table, named by its column so a phone can show the name beside the value.
 *
 * @param col   Its column.
 * @param html  Its contents.
 * @returns     HTML.
 */
function columnCell(col: Column, html: string): string {
  const classes = [col.key === "sample" || col.key === "wcag" ? "" : "mono", NUMERIC.has(col.key) ? "num" : ""].filter(Boolean).join(" ");
  return `<td${classes ? ` class="${classes}"` : ""} data-label="${col.name()}${col.unit ? ` ${col.unit}` : ""}">${html}</td>`;
}

/** The columns of numbers, which line up on their right. */
const NUMERIC = new Set(["apca", "wcag", "lightness", "chroma", "colorfulness", "hue"]);

/** A swatch and where it sits, for saying which marks it carries. */
interface Marked {
  readonly s: Swatch;
  readonly at: Place;
}

/**
 * What the marks on a group of colors mean, for the ones it shows.
 *
 * @param list  The colors.
 * @returns     HTML, or nothing when none is marked.
 */
export function marksKey(list: readonly Marked[]): string {
  const marks = [
    list.some((m) => m.s.short) ? `<span class="gamut">!</span> Gamut limit` : "",
    list.some((m) => setsTier(m.at)) ? `<span class="sets">${FLAG}</span> Sets the tier` : "",
    list.some((m) => isLowered(m.s, m.at)) ? `<span class="lowered">↓</span> Lowered` : "",
  ].filter(Boolean);
  // Each mark is a button named in full, so the key is for the eye only.
  return marks.length ? `<p class="marks-key" aria-hidden="true">${marks.join(" • ")}</p>` : "";
}

/**
 * A swatch on a tier as a row of its color's table.
 *
 * @param s         The swatch.
 * @param tier      Its tier.
 * @param identity  The identity tier, starred.
 * @param variant   Default or muted.
 * @param marks     What it's marked with beside its colorfulness, if anything.
 * @param hueless   Whether it has no hue to speak of: a gray.
 * @returns         HTML.
 */
function tierRow(s: Swatch, tier: number, identity: number, variant: Variant, marks: string, hueless = false): string {
  const cells = [
    `<span class="pair" style="--c:${s.color}"><span class="fill"></span><span class="sample">Aa</span></span>`,
    copyable(s.color),
    s.apca.toFixed(1),
    `<span class="facts">${badge(s)}<span class="mono">${s.wcag.toFixed(2)}</span></span>`,
    s.lightness.toFixed(1),
    s.chroma.toFixed(1),
    `<span class="facts">${marks}<span>${s.colorfulness.toFixed(1)}</span></span>`,
    hueless ? `<span class="soft">No hue</span>` : `<span class="facts"><span class="soft">${s.name}</span><span>${s.hue.toFixed(1)}°</span></span>`,
  ];
  return `<tr>
    <th scope="row">${tier === identity ? identityLabel(tier, variant) : ""}Lc ${String(tier)}<span class="soft">${ROLES[tier] ?? ""}</span></th>
    ${cells.map((html, i) => columnCell(COLUMNS[i + 1]!, html)).join("")}
  </tr>`;
}

/**
 * A color's table, one row per tier, with what its columns mean.
 *
 * @param title    Its heading.
 * @param variant  Default or muted, which keeps its popovers apart from the other table's.
 * @param rows     The rows.
 * @param after    What follows it, such as the key to its marks.
 * @returns        HTML.
 */
function tierTable(title: string, variant: Variant, rows: string, after = ""): string {
  return `<section>
    <h2>${title}</h2>
    ${popButton(`columns:${variant}`, "What the columns mean", "What the columns mean", "metric columns-help")}
    <div class="scroll"><table class="swatch-table">
      <thead><tr>${COLUMNS.map((col) => `<th scope="col"${NUMERIC.has(col.key) ? ' class="num"' : ""}>${heading(col, variant)}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>${after}
  </section>`;
}

/**
 * The chips that lead to each color's page, then the neutrals': gray, and the neutral colors when
 * the base is tinted.
 *
 * @param current  The page on screen.
 * @returns        HTML.
 */
function colorChips(current: string): string {
  const tier = identityOf(onScreen(), state.mode);
  const p = currentMode();
  const chip = (key: string, color: string) =>
    `<a href="#${key}" style="--c:${color}"${key === current ? ' aria-current="page"' : ""}><span class="dot"></span>${label(key)}</a>`;
  const hues = colors(tier).map((x) => chip(x.key, x.tiers[tier]!.default.color));
  // A mode whose base is gray or close to it has only the grays: its neutral colors would be the same.
  const neutrals = p ? [chip(GRAY, p.grays[tier]!.color), ...(p.tinted ? p.neutralColors.map((n) => chip(n.key, n.tiers[tier]!.color)) : [])] : [];
  return `<nav class="chips" aria-label="Colors">${hues.join("")}${neutrals.length ? `<span class="chips-gap" aria-hidden="true"></span>${neutrals.join("")}` : ""}</nav>`;
}

/** The mode on screen's palette, or null while it solves. */
export function currentMode() {
  return current()?.[state.mode] ?? null;
}

/**
 * A color's page: its tiers, default and muted, in tables. The neutrals have pages of their own.
 *
 * @param key  The color.
 * @returns    HTML.
 */
export function colorPage(key: string): string {
  if (key === GRAY || neutralOf(key)) return neutralPage(key);
  const tier = identityOf(onScreen(), state.mode);
  const list = colors(tier);
  const c = list.find((x) => x.key === key);
  if (!c) return `<section class="intro"><h1>${label(key)}</h1><p>${list.length ? "There's no such color in this palette." : "Solving…"}</p></section>`;
  const identity = c.tiers[tier]!.default;
  const { colorfulness, equalTiers } = state.settings;
  const own = ownTarget(key, identity, current()?.[state.mode].targets[tier] ?? identity.target);
  const custom = customOf(key);
  const aim = custom
    ? `${measured(own.toFixed(1))} (${measured(`${String(Math.round(custom.share * 100))}%`)} of ${measured(String(colorfulness))})`
    : Math.abs(own - colorfulness) >= 0.05
      ? `${measured(own.toFixed(1))} (${measured(String(colorfulness))}, ${measured(signed(own - colorfulness))} from colorfulness per hue)`
      : measured(String(colorfulness));
  const table = (variant: Variant) => {
    const rows = state.settings.tiers.filter((t) => c.tiers[t]);
    const html = rows.map((t) => tierRow(c.tiers[t]![variant], t, tier, variant, variant === "default" ? lowered(c.key, t, c.tiers[t]!.default) : "")).join("");
    const key = variant === "default" ? marksKey(rows.map((t) => ({ s: c.tiers[t]!.default, at: { key: c.key, tier: t, variant: "default" } }))) : "";
    return tierTable(variant === "default" ? "Default" : "Muted", variant, html, key);
  };
  return `${colorChips(key)}
    <section class="intro hero" style="--c:${identity.color}">
      <h1>${label(key)}</h1>
      <p>CAM16 hue ${measured(`${identity.hue.toFixed(1)}°`)}, read as ${identity.name}. Aims at colorfulness ${aim}.${equalTiers ? ` On a tier whose least colorful hue falls short of ${measured(String(colorfulness))}, the ${measured(String(colorfulness))} drops to that hue's reach.` : ""}</p>
    </section>
    ${table("default")}${table("muted")}`;
}

/**
 * A neutral's page: gray, the same red, green and blue on every tier, or a neutral color, which
 * follows a tinted base's hue at a share of its colorfulness.
 *
 * @param key  "gray" or a neutral color's key.
 * @returns    HTML.
 */
function neutralPage(key: string): string {
  const p = currentMode();
  const tier = identityOf(onScreen(), state.mode);
  const { mode } = state;
  if (!p) return `<section class="intro"><h1>${label(key)}</h1><p>Solving…</p></section>`;
  const neutral = p.neutralColors.find((n) => n.key === key);
  if (neutral && !p.tinted)
    return `${colorChips(key)}
      <section class="intro"><h1>${label(key)}</h1><p>The ${mode} base, ${p.base}, is gray or nearly, under M ${String(NEUTRAL_BAND[0])}, so it has no hue to follow and ${label(key)} is <a href="#gray">Gray</a> here. On a base with a hue, ${label(key)} takes that hue.</p></section>`;
  const tiers = neutral ? neutral.tiers : p.grays;
  const identity = tiers[tier]!;
  const base = baseTint(mode);
  const intro = neutral
    ? `A neutral color on every tier: the ${mode} base's hue, ${measured(`${identity.hue.toFixed(0)}°`)}, at ${measured(percent1(neutral.share))} of the base's colorfulness, ${measured(`M ${base.toFixed(1)}`)}, so ${measured(`M ${(base * neutral.share).toFixed(1)}`)}. ${tintNote(base * neutral.share)}`
    : `A gray on every tier, in every palette: no hue at all, exactly on each tier's contrast against the ${mode} base, as every color is. CAM16 still sees a little colorfulness in a pure gray, which is why the table shows some.`;
  const rows = state.settings.tiers.filter((t) => tiers[t]).map((t) => tierRow(tiers[t]!, t, tier, "default", "", !neutral)).join("");
  return `${colorChips(key)}
    <section class="intro hero" style="--c:${identity.color}">
      <h1>${label(key)}</h1>
      <p>${intro}</p>
    </section>
    ${tierTable("On every tier", "default", rows)}`;
}

/**
 * How colorful a mode's base is, which a neutral color takes its share of; 0 for a gray base.
 *
 * @param mode  The mode.
 * @returns     CAM16 M.
 */
export function baseTint(mode: Mode): number {
  const base = onScreen().bases[mode];
  return tinted(model(), mode, base) ? model().cam(mode, base).m : 0;
}

/**
 * How a neutral's colorfulness reads: its zone, Gray, Neutral or Color, and what that means.
 *
 * @param m  CAM16 M.
 * @returns  A sentence.
 */
function tintNote(m: number): string {
  const zone = SHARE_ZONES[shareZone(m)];
  return `That's ${zone.name}, ${zone.range}: ${zone.note.charAt(0).toLowerCase()}${zone.note.slice(1)}`;
}

popSource("share", (path) => {
  const share = Number(read(path) ?? 0);
  const neutral = path.startsWith("neutralColors.");
  const { mode } = state;
  const of = neutral ? baseTint(mode) : state.settings.colorfulness;
  const m = share * of;
  const zone = SHARE_ZONES[shareZone(m)];
  const p = currentMode();
  const tier = identityOf(onScreen(), mode);
  const i = Number(path.split(".")[1]);
  const key = neutral ? colorKeys(state.settings).neutrals[i] : customKeys(state.settings)[i];
  // Its distance from Gray on each tier, counting only the tint, not any lightness between them.
  const colorOn = (t: number) => (neutral ? p?.neutralColors.find((n) => n.key === key)?.tiers[t]?.color : p?.colors.find((c) => c.key === key)?.tiers[t]?.default.color);
  const fromGray = (t: number) => {
    const [color, gray] = [colorOn(t), p?.grays[t]?.color];
    if (!color || !gray) return undefined;
    const [a, b] = [model().cam(mode, color), model().cam(mode, gray)];
    return deltaE(Math.hypot(a.astar - b.astar, a.bstar - b.bstar));
  };
  const all = state.settings.tiers.map(fromGray).filter((d) => d !== undefined);
  const here = fromGray(tier);
  const distance =
    state.solving || here === undefined || !all.length
      ? "Solving…"
      : `ΔE ${here.toFixed(1)} on Lc ${String(tier)}, the identity tier; ${Math.min(...all).toFixed(1)}–${Math.max(...all).toFixed(1)} across the tiers`;
  const whole = neutral ? `the ${mode} base's colorfulness, M ${of.toFixed(1)}` : `the palette's colorfulness, M ${of.toFixed(1)}, before a tier lowers it`;
  const rows = SHARE_ZONES.map((z) => `<div><dt>${z.name}</dt><dd><span class="mono">${z.range}</span> ${z.note}</dd></div>`).join("");
  return `<h3>${share === 0 ? "Exactly Gray" : zone.name}: M ${m.toFixed(1)}</h3>
    ${shareMeter(share, of)}
    <p>${share === 0 ? "At 0% there's no tint at all: it's Gray." : zone.note}</p>
    <dl class="pop-facts">
      <div><dt>Share</dt><dd>${percent1(share)} of ${whole}</dd></div>
      <div><dt>From Gray</dt><dd>${distance}</dd></div>
    </dl>
    <p class="pop-how">The bar under the slider shows the same zones, lined up with the thumb.</p>
    <dl class="pop-facts zones">${rows}</dl>
    <details class="pop-sources"><summary>Where these limits come from</summary>
      <p>ΔE (CAM16-UCS) is built so that equal numbers look equally different. About ${String(JUST_VISIBLE)} is what most people notice with two colors side by side on a screen; about 5, half the gap between neighbors in a palette of eight hues, reads as a different shade. Measured against Gray on four bases, two light and two dark, at every tier: M ${String(NEUTRAL_BAND[0])} is ΔE 2.3–3.9 from it, just past the visible step, and M ${String(NEUTRAL_BAND[1])} is ΔE 5.5–6.4, a little past a different shade.</p>
      <p>Established tinted neutrals sit inside the range: Radix's slate and Tailwind's zinc peak around M 5–7, and Tailwind's slate, around M 9–14, is at its top, where a gray reads blue.</p>
      <p>The ΔE figures come from color science; the limits are judgment built on them, not results of a study. Eyes and screens differ.</p></details>`;
});

/** A share as a percent with one decimal when it has one, e.g. "13.5%" or "100%". */
const percent1 = (share: number) => `${String(Math.round(share * 1000) / 10)}%`;
