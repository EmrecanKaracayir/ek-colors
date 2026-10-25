/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< FORMATS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| A solved palette as files: JSON (settings and everything solved), CSV (one row per swatch),      |
| Markdown (tables per gamut, mode and variant) and CSS (custom properties for a website). The     |
| command line and the site's export both use these.                                               |
\*------------------------------------------------------------------------------------------------*/

import type { Palette } from "./solve";
import { type Gamut, GAMUT_NAMES, GAMUTS, MODE_NAMES, MODES, type Settings } from "./settings";

/**
 * The palette and what it was solved from, as JSON.
 *
 * @param settings  The settings.
 * @param palette   The solved palette.
 * @returns         Indented JSON.
 */
export function toJson(settings: Settings, palette: Palette): string {
  return `${JSON.stringify({ settings, palette }, null, 2)}\n`;
}

/**
 * Every swatch as a CSV row.
 *
 * @param settings  The settings (for the tiers).
 * @param palette   The solved palette.
 * @returns         CSV with a header row.
 */
export function toCsv(settings: Settings, palette: Palette): string {
  const rows = [
    "gamut,mode,tier,variant,name,value,cam16_hue,cam16_chroma,cam16_colorfulness,cam16_lightness,cam16_name,apca,wcag2,wcag2_level",
  ];
  for (const gamut of GAMUTS) {
    for (const mode of MODES) {
      for (const color of palette[gamut][mode].colors) {
        for (const tier of settings.tiers) {
          const cell = color.tiers[tier]!;
          for (const variant of ["default", "muted"] as const) {
            const s = cell[variant];
            rows.push(
              [
                gamut,
                mode,
                tier,
                variant,
                color.key,
                `"${s.color}"`,
                s.hue,
                s.chroma,
                s.colorfulness,
                s.lightness,
                s.name,
                s.apca,
                s.wcag,
                s.wcagLevel,
              ].join(","),
            );
          }
        }
      }
    }
  }
  return `${rows.join("\n")}\n`;
}

/**
 * Tables per gamut tier, mode and variant, a color per row and a tier per column.
 *
 * @param settings  The settings (for the bases and tiers).
 * @param palette   The solved palette.
 * @returns         Markdown.
 */
export function toMarkdown(settings: Settings, palette: Palette): string {
  const md = [`# ${settings.name || "Palette"}, solved with EK Colors`, ""];
  for (const gamut of GAMUTS) {
    md.push(`## ${GAMUT_NAMES[gamut]} gamut`, "");
    for (const mode of MODES) {
      md.push(`### ${MODE_NAMES[mode]} · base ${settings.bases[mode]}`, "");
      for (const variant of ["default", "muted"] as const) {
        md.push(
          `#### ${variant === "default" ? "Default" : "Muted"}`,
          "",
          `| Color | ${settings.tiers.map((t) => `Lc ${String(t)}`).join(" | ")} |`,
          `|---|${settings.tiers.map(() => "---").join("|")}|`,
        );
        for (const color of palette[gamut][mode].colors) {
          const cells = settings.tiers.map((t) => color.tiers[t]![variant]);
          md.push(
            `| ${color.key} | ${cells.map((s) => `\`${s.color}\` WCAG ${s.wcag.toFixed(2)}`).join(" | ")} |`,
          );
        }
        md.push("");
      }
    }
  }
  return `${md.join("\n")}\n`;
}

/** The media query that picks each gamut's colors; Standard's need none. */
const GAMUT_QUERIES: Readonly<Record<Gamut, string | null>> = {
  standard: null,
  wide: "(color-gamut: p3)",
  ultra: "(color-gamut: rec2020)",
};

/**
 * Every color as a CSS custom property: --red-60 is red on Lc 60, --red-60-muted its muted
 * version, and --base the background. Each holds its light and dark color, chosen by
 * color-scheme; a wider screen gets its gamut's colors.
 *
 * @param settings  The settings (for the bases and tiers).
 * @param palette   The solved palette.
 * @returns         CSS.
 */
export function toCss(settings: Settings, palette: Palette): string {
  const block = (gamut: Gamut, indent: string) => {
    const { light, dark } = palette[gamut];
    const darkOf = new Map(dark.colors.map((c) => [c.key, c]));
    const lines =
      gamut === "standard"
        ? [
            "color-scheme: light dark;",
            `--base: light-dark(${settings.bases.light}, ${settings.bases.dark});`,
            "",
          ]
        : [];
    for (const color of light.colors) {
      for (const tier of settings.tiers) {
        for (const variant of ["default", "muted"] as const) {
          const name = `--${color.key}-${String(tier)}${variant === "muted" ? "-muted" : ""}`;
          lines.push(
            `${name}: light-dark(${color.tiers[tier]![variant].color}, ${darkOf.get(color.key)!.tiers[tier]![variant].color});`,
          );
        }
      }
      lines.push("");
    }
    lines.pop();
    return [
      `${indent}:root {`,
      ...lines.map((l) => (l ? `${indent}  ${l}` : "")),
      `${indent}}`,
    ].join("\n");
  };
  const css = [
    "/*",
    ` * ${settings.name || "Palette"}, solved with EK Colors.`,
    " * --red-60 is red on Lc 60 against --base, --red-60-muted its muted version. Light and dark",
    " * follow color-scheme: the system's, or color-scheme: light or dark set on the page. Screens",
    " * that show a wider gamut get its colors.",
    " */",
    "",
    block("standard", ""),
  ];
  for (const gamut of GAMUTS) {
    const query = GAMUT_QUERIES[gamut];
    if (query) css.push("", `@media ${query} {`, block(gamut, "  "), "}");
  }
  return `${css.join("\n")}\n`;
}
