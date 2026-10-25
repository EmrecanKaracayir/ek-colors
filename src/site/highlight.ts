/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< HIGHLIGHT >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The export's text in color: each of its four formats split into the parts that matter, keys,     |
| values, numbers and notes, and every color value given a swatch of itself beside it. What it     |
| gives is for showing only; copying takes the plain text.                                         |
\*------------------------------------------------------------------------------------------------*/

import { escape } from "./graph";

/** The export's formats. */
export type Format = "json" | "csv" | "md" | "css";

/** A kind of part, and what it looks like; the kind names its class, t-kind. */
type Rule = readonly [kind: string, pattern: RegExp];

/** Each format's parts, in the order they're tried at each place in the text. */
const RULES: Readonly<Record<Format, readonly Rule[]>> = {
  css: [
    ["comment", /\/\*[\s\S]*?\*\//],
    ["at-rule", /@media\b/],
    ["selector", /:root\b/],
    ["variable", /--[\w-]+(?=:)/],
    ["property", /\b(?:color-gamut|color-scheme)\b/],
    ["function", /\b(?:light-dark|color)(?=\()/],
    ["constant", /\b(?:display-p3|rec2020|srgb|p3|light|dark)\b/],
    ["hex", /#[0-9a-f]{6}\b/],
    ["number", /(?<![\w#.-])\d*\.?\d+(?![\w-])/],
  ],
  json: [
    ["key", /"(?:[^"\\]|\\.)*"(?=\s*:)/],
    ["string", /"(?:[^"\\]|\\.)*"/],
    ["number", /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/],
    ["boolean", /\b(?:true|false|null)\b/],
  ],
  csv: [
    ["header", /^gamut,[^\n]*/],
    ["string", /"[^"\n]*"/],
    ["number", /(?<=,)-?\d+(?:\.\d+)?(?=,|$)/],
    ["punctuation", /,/],
  ],
  md: [
    ["h1", /^# [^\n]*/],
    ["h2", /^## [^\n]*/],
    ["h3", /^### [^\n]*/],
    ["h4", /^#{4,6} [^\n]*/],
    ["punctuation", /^\|[-|]+\|$|\|/],
    ["string", /`[^`\n]*`/],
  ],
};

/** Color values as the export writes them: hex, or color() in a wider color space. */
const COLOR = /#[0-9a-f]{6}\b|color\((?:display-p3|rec2020|srgb) [^)]*\)/gi;

/**
 * A small square of a color, shown before its value.
 *
 * @param color  The color value.
 * @returns      HTML.
 */
const swatch = (color: string) => `<span class="code-swatch" style="--c:${escape(color)}" aria-hidden="true"></span>`;

/**
 * Text with a swatch before each color value in it.
 *
 * @param text  Plain text.
 * @returns     HTML.
 */
function swatched(text: string): string {
  let html = "";
  let last = 0;
  for (const m of text.matchAll(COLOR)) {
    html += `${escape(text.slice(last, m.index))}${swatch(m[0])}${escape(m[0])}`;
    last = m.index + m[0].length;
  }
  return html + escape(text.slice(last));
}

/**
 * An export in color.
 *
 * @param text    The export, as plain text.
 * @param format  Its format.
 * @returns       HTML, for inside a code element.
 */
export function highlight(text: string, format: Format): string {
  const rules = RULES[format];
  const any = new RegExp(rules.map(([, p]) => `(${p.source})`).join("|"), "gim");
  let html = "";
  let last = 0;
  for (const m of text.matchAll(any)) {
    const kind = rules[m.slice(1).findIndex((g) => g !== undefined)]![0];
    // A color() call is named as a function, and its swatch goes before the whole value.
    const value = kind === "function" ? new RegExp(COLOR.source, "iy") : null;
    if (value) value.lastIndex = m.index;
    const call = value?.exec(text)?.[0];
    html += `${swatched(text.slice(last, m.index))}${call ? swatch(call) : ""}<span class="t-${kind}">${swatched(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return html + swatched(text.slice(last));
}
