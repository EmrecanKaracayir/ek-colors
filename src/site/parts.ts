/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< PARTS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Pieces every page uses: the palette's and the colors' names, values to copy, contrast badges,    |
| swatch cards and the marks on them.                                                              |
\*------------------------------------------------------------------------------------------------*/

import { CONFIG } from "../config";
import { type CurvePoint, type Custom, GAMUT_NAMES, type Neutral, type Settings } from "../palette/settings";
import { type Color, type Swatch, colorKeys, customKeys } from "../palette/solve";
import { current } from "./derived";
import { escape, signed } from "./graph";
import { popButton, popSource } from "./popover";
import { type Variant, state } from "./state";

export const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;

/**
 * Whether the settings are EK Palette's as it ships, whatever order their keys were saved in.
 *
 * @returns  True when nothing has been changed.
 */
export function isPreset(): boolean {
  const sorted = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sorted)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sorted(x)]))
        : v;
  return JSON.stringify(sorted(solvedPart(state.settings))) === JSON.stringify(sorted(solvedPart(CONFIG)));
}

/**
 * What the palette is called: the name it's given, or else EK Palette as it ships and Custom
 * palette once anything is changed.
 *
 * @returns  Its name, as HTML.
 */
export function paletteName(): string {
  return escape(paletteNameText());
}

/**
 * The palette's name as plain text, for the export.
 *
 * @returns  Its name.
 */
export function paletteNameText(): string {
  return state.settings.name || defaultName();
}

/**
 * The palette's name when it isn't given one.
 *
 * @returns  EK Palette or Custom palette.
 */
export function defaultName(): string {
  return isPreset() ? "EK Palette" : "Custom palette";
}

/**
 * The settings without what only changes how the site looks: the guide shown, and curve points
 * marked as on, which is the same as not marked.
 *
 * @param settings  The settings.
 * @returns         What the palette is solved from.
 */
export function solvedPart(settings: Settings): Settings {
  const points = (list: readonly CurvePoint[]) => list.map(({ off, ...p }) => (off ? { ...p, off } : p));
  return { ...settings, guide: "", name: "", curve: { light: points(settings.curve.light), dark: points(settings.curve.dark) } };
}

/**
 * The custom color a key stands for, if it's one.
 *
 * @param key  A color's key.
 * @returns    The custom color, or undefined for a hue.
 */
export function customOf(key: string): Custom | undefined {
  return state.settings.custom[customKeys(state.settings).indexOf(key)];
}

/**
 * A neutral color by its key.
 *
 * @param key  The key.
 * @returns    The neutral color's settings, or undefined for any other color.
 */
export function neutralOf(key: string): Neutral | undefined {
  return state.settings.neutrals[colorKeys(state.settings).neutrals.indexOf(key)];
}

/**
 * A color key as people read it: a custom or neutral color by its own name.
 *
 * @param key  E.g. "red" or "hue-3".
 * @returns    HTML, e.g. "Red" or "Hue 3".
 */
export function label(key: string): string {
  return escape(labelText(key));
}

/**
 * A color's name as plain text, for the browser's title.
 *
 * @param key  The color's key.
 * @returns    E.g. "Red", "Hue 3", or a custom color's own name.
 */
export function labelText(key: string): string {
  const named = customOf(key) ?? neutralOf(key);
  const text = named ? named.name : key.replace("-", " ");
  return named ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** A WCAG 2 level as a class name: "AA large" is "AA-large". */
const levelClass = (level: Swatch["wcagLevel"]) => level.replace(" ", "-");

const LEVELS: Readonly<Record<Swatch["wcagLevel"], string>> = {
  AAA: "AAA",
  AA: "AA",
  "AA large": "AA large",
  below: "Below 3:1",
};

/**
 * A color value that copies itself when clicked. A color() value breaks after its color space, so
 * its numbers read on one line wherever it's shown.
 *
 * @param value  The CSS color.
 * @returns      HTML.
 */
export function copyable(value: string): string {
  return `<button type="button" class="mono copy" data-action="copy-value" data-value="${value}" title="${value}" aria-label="Copy ${value}">${shownValue(value)}</button>`;
}

/**
 * A color value as a copy button shows it: a CSS color() breaks after its color space.
 *
 * @param value  The value.
 * @returns      HTML.
 */
export function shownValue(value: string): string {
  return value.replace(/^(color\([\w-]+) /, "$1<br>");
}

/** Each copy button's pending return from "Copied" to its value. */
export const copying = new WeakMap<Element, number>();

/**
 * A swatch's WCAG level as a badge that opens what the level means. Its color keeps the popover's
 * id apart from the other badges on the page.
 *
 * @param s  The swatch.
 * @returns  HTML.
 */
export function badge(s: Swatch): string {
  const level = s.wcagLevel;
  return popButton(`wcag:${level}:${s.wcag.toFixed(2)}:${s.color}`, LEVELS[level], `What WCAG 2 ${LEVELS[level]} means`, `badge ${levelClass(level)}`);
}

/** What each WCAG 2 level allows. */
const MEANINGS: Readonly<Record<Swatch["wcagLevel"], string>> = {
  AAA: "At least 7:1, the enhanced level. Passes for text of any size, body text included.",
  AA: "From 4.5:1 to 7:1, the minimum for normal text. Passes for text of any size; large text reaches the enhanced level too, which asks 4.5:1 of it.",
  "AA large":
    "From 3:1 to 4.5:1. Passes the minimum only for large text: 24px and up, or 18.66px and up in bold. Also enough for icons, borders and controls, which need 3:1. Not enough for normal text.",
  below:
    "Under 3:1, below every minimum. Fine for dividers, fills and decoration that carry no meaning, and for disabled controls, which are exempt; not for text or icons that must be read.",
};

popSource("wcag", (which) => {
  const [level, ratio] = which.split(":") as [Swatch["wcagLevel"], string];
  return `<h3 class="level ${levelClass(level)}">WCAG 2 ${LEVELS[level]} • ${ratio}:1</h3>
    <p>${MEANINGS[level]}</p>
    <p class="pop-how">WCAG 2 compares the two colors' luminance as a ratio from 1:1 to 21:1. The palette is built on APCA's Lc instead, which follows how text reads on light and dark backgrounds; WCAG 2 is shown for audits that ask for it.</p>`;
});

/** Where a swatch sits, for the popovers that explain it. */
export interface Place {
  readonly key: string;
  readonly tier: number;
  readonly variant: Variant;
}

/** The mark of the color that sets its tier's colorfulness: a flag. */
export const FLAG = `<svg class="flag" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1h1.25v10H2zM3.25 1.5H10L8.25 4 10 6.5H3.25z"/></svg>`;

/**
 * A place as the end of a popover's id: what the "why" popovers read back.
 *
 * @param at  Where it sits.
 * @returns   E.g. "red:45:default".
 */
const placeId = (at: Place) => `${at.key}:${String(at.tier)}:${at.variant}`;

/**
 * Why a swatch is less colorful than asked, as chips that open the reason: it sets its tier's
 * colorfulness, or the gamut can't reach its target. Held back by the gamut and lowered by the tier
 * are marked as on the cards: !, a flag and ↓.
 *
 * @param s   The swatch.
 * @param at  Where it sits.
 * @returns   HTML, or nothing.
 */
export function chips(s: Swatch, at: Place): string {
  const id = placeId(at);
  return [
    s.short ? popButton(`why:gamut:${id}`, "!", `Gamut limit: why ${label(at.key)} is held back`, "chip gamut mark") : "",
    setsTier(at) ? popButton(`why:tier:${id}`, FLAG, `Sets the tier: why ${label(at.key)} sets the tier`, "chip mark") : "",
    isLowered(s, at) ? popButton(`why:lowered:${id}`, "↓", `Lowered: why ${label(at.key)} is lowered`, "chip lowered mark") : "",
  ].join("");
}

/**
 * Whether another color setting the tier holds this one below its own target.
 *
 * @param s   The swatch.
 * @param at  Where it sits.
 * @returns   True when lowered by the tier, not by the gamut.
 */
export function isLowered(s: Swatch, at: Place): boolean {
  const limit = current()?.[state.mode].limits[at.tier];
  return at.variant === "default" && !s.short && !!limit && limit !== at.key;
}

/**
 * Whether a color's reach is what its tier was lowered to.
 *
 * @param at  Where it sits.
 * @returns   True for the default swatch of the color that sets the tier.
 */
export function setsTier(at: Place): boolean {
  return at.variant === "default" && current()?.[state.mode].limits[at.tier] === at.key;
}

/**
 * A color's own target before its tier was lowered: a custom color aims at its share of the
 * colorfulness, every other color at the colorfulness plus its M edit.
 *
 * @param key         The color.
 * @param s           Its swatch.
 * @param tierTarget  The tier's lowered target.
 * @returns           Its own target.
 */
export function ownTarget(key: string, s: Swatch, tierTarget: number): number {
  const { colorfulness } = state.settings;
  const custom = customOf(key);
  return Math.round((custom ? colorfulness * custom.share : s.target + colorfulness - tierTarget) * 10) / 10;
}

/**
 * What a default swatch aims at, in words: a custom color's share of the tier's colorfulness, or
 * the tier's colorfulness with its colorfulness per hue.
 *
 * @param key         The color.
 * @param s           Its swatch.
 * @param tierTarget  The tier's target.
 * @returns           E.g. "the tier's M 36.8 + 7.8 from colorfulness per hue".
 */
function aimText(key: string, s: Swatch, tierTarget: number): string {
  const tierM = `the tier's M ${tierTarget.toFixed(1)}`;
  const custom = customOf(key);
  if (custom) return `${String(Math.round(custom.share * 100))}% of ${tierM}`;
  const edit = s.target - tierTarget;
  return Math.abs(edit) >= 0.5 ? `${tierM} ${signed(edit)} from colorfulness per hue` : tierM;
}

/**
 * A swatch as a card: the color, a text sample in it, and its numbers. A link covers the card; the
 * buttons that explain its colorfulness sit above it.
 *
 * @param s      The swatch.
 * @param title  Its name on the card.
 * @param href   Where a click goes, if anywhere.
 * @param at     Where it sits, for its chips; none for colors from elsewhere.
 * @returns      HTML.
 */
export function card(s: Swatch, title: string, href?: string, at?: Place): string {
  const id = at ? placeId(at) : "";
  // Nothing covers the color: held back by the gamut, the colorfulness itself turns red and opens
  // why; lowered by the tier, it stays gray and opens why; setting the tier is a small amber flag
  // beside the name.
  // A mark beside the value, not only its color, says it's held back: ! by the screen, ↓ by the tier.
  const value = `M ${s.colorfulness.toFixed(1)}`;
  // A thin space, not a margin, before the mark, so the underline runs on under it.
  const mark = (sign: string) => `${value}<span class="held" aria-hidden="true">\u2009${sign}</span>`;
  const m =
    at && s.short
      ? popButton(`why:gamut:${id}`, mark("!"), `${title} is held back by the gamut: why`, "wanted")
      : at && isLowered(s, at)
        ? popButton(`why:lowered:${id}`, mark("↓"), `${title} is lowered by the tier: why`, "wanted lowered")
        : value;
  const tag = at && setsTier(at) ? popButton(`why:tier:${id}`, FLAG, `${title} sets the tier: why`, "chip mark") : "";
  return `<div class="card${href ? " linked" : ""}" style="--c:${s.color}">
    ${href ? `<a class="card-link" href="#${href}" aria-label="${title}"></a>` : ""}
    <span class="fill"></span>
    <span class="sample">Aa</span>
    <span class="card-name">${title}${tag}</span>
    ${copyable(s.color)}
    <span class="facts"><span class="mono">Lc ${s.apca.toFixed(1)}</span>${badge(s)}</span>
    <span class="mono soft">WCAG ${s.wcag.toFixed(2)} • ${m}</span>
  </div>`;
}

/** What turning Equal per tier off does, under the popovers it explains. */
const EQUAL_OFF = `<p class="pop-how">Turn off Equal per tier in Settings → Colorfulness to let each color go as far as the screen allows; the tier is then no longer equally colorful.</p>`;

popSource("why", (which) => {
  const [kind, key, tierText, variant] = which.split(":") as [string, string, string, Variant];
  const tier = Number(tierText);
  const palette = current()?.[state.mode];
  const s = palette?.colors.find((c) => c.key === key)?.tiers[tier]?.[variant];
  if (!palette || !s) return "";
  const name = label(key);
  const gamut = GAMUT_NAMES[state.gamut];
  const tierTarget = palette.targets[tier] ?? s.target;
  if (kind === "tier")
    return `<h3 class="why tier">Sets the tier</h3>
      <p>On Lc ${String(tier)}, ${name.toLowerCase()} can't be more colorful than M ${s.colorfulness.toFixed(1)} on ${gamut} screens. <strong>Equal per tier</strong> is on, so every color on this tier is held to M ${tierTarget.toFixed(1)} to match it, though most could go further.</p>
      ${EQUAL_OFF}`;
  if (kind === "lowered") {
    const limit = label(palette.limits[tier]!);
    const own = ownTarget(key, s, tierTarget);
    const share = aimText(key, s, tierTarget);
    return `<h3>Lowered</h3>
      <p>${name} would be M ${own.toFixed(1)} here. On Lc ${String(tier)}, ${limit.toLowerCase()} can't be more colorful than M ${tierTarget.toFixed(1)} on ${gamut} screens, and <strong>Equal per tier</strong> holds every color on the tier to that, so ${name.toLowerCase()} shows M ${s.colorfulness.toFixed(1)} (${share}).</p>
      ${EQUAL_OFF}`;
  }
  const reason = variant === "muted" ? `${String(Math.round(state.settings.muted * 100))}% of the default's colorfulness` : aimText(key, s, tierTarget);
  return `<h3 class="why gamut">Gamut limit</h3>
    <p>${name} would be M ${s.target.toFixed(1)} here (${reason}), but on Lc ${String(tier)} no ${name.toLowerCase()} that colorful exists on ${gamut} screens. It shows M ${s.colorfulness.toFixed(1)}, the most it can.</p>
    <p class="pop-how">A color's contrast fixes its lightness, and at that lightness a screen can only show so much colorfulness in each hue. ${state.gamut === "ultra" ? "This is already the widest gamut." : "A wider gamut can reach further."}</p>`;
});

/**
 * The colors of the current mode.
 *
 * @param tier  A tier every color returned has, if any: a palette from older settings may lack it.
 * @returns     Its colors, or none before the first solve.
 */
export function colors(tier?: number): readonly Color[] {
  const list = current()?.[state.mode].colors ?? [];
  return tier === undefined ? list : list.filter((c) => c.tiers[tier]);
}

/**
 * How even a ring of neighbor differences is, in words people can compare.
 *
 * @param ring  Neighbor distances.
 * @returns     E.g. "9.1 to 10.3", or "…" for none.
 */
export function range(ring: readonly number[]): string {
  return ring.length ? `${Math.min(...ring).toFixed(1)} to ${Math.max(...ring).toFixed(1)}` : "…";
}

/**
 * A tier's colorfulness, and what lowered it.
 *
 * @param tier  The tier.
 * @returns     E.g. "M 12.7, lowered from 40: Red can't reach more".
 */
export function held(tier: number): string {
  const p = current()?.[state.mode];
  if (!p) return "…";
  const limit = p.limits[tier];
  return limit
    ? `M ${(p.targets[tier] ?? 0).toFixed(1)}, lowered from ${String(state.settings.colorfulness)}: ${label(limit)} can't reach more`
    : `M ${(p.targets[tier] ?? 0).toFixed(1)}, every color reaches it`;
}

/**
 * Why a color on a tier is less colorful than the target, if it is.
 *
 * @param key   The color.
 * @param tier  The tier.
 * @param s     Its swatch there.
 * @returns     HTML: !, flag or ↓ chips, or nothing.
 */
export function lowered(key: string, tier: number, s: Swatch): string {
  const p = current()?.[state.mode];
  if (!p) return "";
  const html = chips(s, { key, tier, variant: "default" });
  return html ? `<span class="chips">${html}</span>` : "";
}
