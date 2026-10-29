/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< FORMATS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| A solved palette as files: JSON (settings and everything solved), CSV (one row per swatch),      |
| Markdown (tables per gamut, mode and variant) and CSS (custom properties for a website). The     |
| command line and the site's export both use these.                                               |
\*------------------------------------------------------------------------------------------------*/

import { GRAY, type GamutPalette, type Palette, type Swatch } from "./solve";
import {
  type Gamut,
  GAMUT_NAMES,
  GAMUTS,
  type Mode,
  MODE_NAMES,
  MODES,
  type Settings,
} from "./settings";

/** A neutral as the exports write it: its key and its swatch per mode and tier. */
interface NeutralRow {
  readonly key: string;
  readonly tiers: Readonly<Record<Mode, Readonly<Record<number, Swatch>>>>;
}

/**
 * The neutrals as exported: Gray, then each neutral color. A mode whose base is gray or close to it
 * gives the grays for its neutral colors, so every name holds a color on every gamut, in both modes.
 *
 * @param palette  One gamut's palette.
 * @returns        Gray, then the neutral colors.
 */
function neutralRows(palette: GamutPalette): NeutralRow[] {
  const gray = { key: GRAY, tiers: { light: palette.light.grays, dark: palette.dark.grays } };
  return [
    gray,
    ...palette.light.neutralColors.map((n, i) => ({
      key: n.key,
      tiers: { light: n.tiers, dark: palette.dark.neutralColors[i]!.tiers },
    })),
  ];
}

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
  const row = (where: readonly (string | number)[], key: string, s: Swatch) =>
    [
      ...where,
      key,
      `"${s.color}"`,
      s.hue,
      s.chroma,
      s.colorfulness,
      s.lightness,
      s.name,
      s.apca,
      s.wcag,
      s.wcagLevel,
    ].join(",");
  for (const gamut of GAMUTS) {
    for (const mode of MODES) {
      for (const color of palette[gamut][mode].colors) {
        for (const tier of settings.tiers) {
          for (const variant of ["default", "muted"] as const)
            rows.push(row([gamut, mode, tier, variant], color.key, color.tiers[tier]![variant]));
        }
      }
      for (const neutral of neutralRows(palette[gamut])) {
        for (const tier of settings.tiers)
          rows.push(row([gamut, mode, tier, "default"], neutral.key, neutral.tiers[mode][tier]!));
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
      md.push(`### ${MODE_NAMES[mode]} • base ${palette[gamut][mode].base}`, "");
      for (const variant of ["default", "muted"] as const) {
        md.push(
          `#### ${variant === "default" ? "Default" : "Muted"}`,
          "",
          `| Color | ${settings.tiers.map((t) => `Lc ${String(t)}`).join(" | ")} |`,
          `|---|${settings.tiers.map(() => "---").join("|")}|`,
        );
        const cell = (s: Swatch) => `\`${s.color}\` WCAG ${s.wcag.toFixed(2)}`;
        for (const color of palette[gamut][mode].colors) {
          const cells = settings.tiers.map((t) => color.tiers[t]![variant]);
          md.push(`| ${color.key} | ${cells.map(cell).join(" | ")} |`);
        }
        // The neutrals have no muted version.
        if (variant === "default")
          for (const neutral of neutralRows(palette[gamut]))
            md.push(
              `| ${neutral.key} | ${settings.tiers.map((t) => cell(neutral.tiers[mode][t]!)).join(" | ")} |`,
            );
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
 * version, --gray-60 a gray on it, --sand-60 a neutral color named Sand, and --base the
 * background. Each holds its light and dark color, chosen by color-scheme; a wider screen gets its
 * gamut's colors.
 *
 * @param settings  The settings (for the bases and tiers).
 * @param palette   The solved palette.
 * @returns         CSS.
 */
export function toCss(settings: Settings, palette: Palette): string {
  const block = (gamut: Gamut, indent: string) => {
    const { light, dark } = palette[gamut];
    const darkOf = new Map(dark.colors.map((c) => [c.key, c]));
    // A wider tier writes its base, and its grays below, only where they differ from the standard ones.
    const standard = palette.standard;
    const ownBase =
      gamut === "standard" || MODES.some((m) => palette[gamut][m].base !== standard[m].base);
    const lines = [
      ...(gamut === "standard" ? ["color-scheme: light dark;"] : []),
      ...(ownBase ? [`--base: light-dark(${light.base}, ${dark.base});`, ""] : []),
    ];
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
    // Gray is the same on every screen on the same base, so a wider tier writes it only where its
    // own base makes it differ; the base's neutral colors follow their gamut.
    const sameGrays = MODES.every((m) =>
      settings.tiers.every(
        (t) => palette[gamut][m].grays[t]?.color === standard[m].grays[t]?.color,
      ),
    );
    for (const neutral of neutralRows(palette[gamut])) {
      if (neutral.key === GRAY && gamut !== "standard" && sameGrays) continue;
      for (const tier of settings.tiers)
        lines.push(
          `--${neutral.key}-${String(tier)}: light-dark(${neutral.tiers.light[tier]!.color}, ${neutral.tiers.dark[tier]!.color});`,
        );
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
    ` * ${(settings.name || "Palette").replaceAll("*/", "* /")}, solved with EK Colors.`,
    " * --red-60 is red on Lc 60 against --base, --red-60-muted its muted version and --gray-60 a",
    " * gray on it; each neutral color is named after itself, in its base's hue. Light and dark",
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
