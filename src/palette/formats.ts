/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< FORMATS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| A solved palette as files: JSON (settings and everything solved), CSV (one row per swatch),      |
| Markdown (tables per gamut, mode and variant) and CSS (custom properties for a website). The     |
| command line and the site's export both use these.                                               |
\*------------------------------------------------------------------------------------------------*/

import type { GamutPalette, Palette, Swatch } from "./solve";
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
 * The neutrals as exported: gray always, and each neutral color whenever either mode's base is
 * tinted. A mode whose base is gray or close to it gives the grays for its neutrals, so every name holds a
 * color in both modes.
 *
 * @param palette  One gamut's palette.
 * @returns        Gray, then the neutral colors, if any follow a tint.
 */
function neutralRows(palette: GamutPalette): NeutralRow[] {
  const gray = { key: "gray", tiers: { light: palette.light.grays, dark: palette.dark.grays } };
  if (!MODES.some((m) => palette[m].tinted)) return [gray];
  return [
    gray,
    ...palette.light.neutrals.map((n, i) => ({
      key: n.key,
      tiers: { light: n.tiers, dark: palette.dark.neutrals[i]!.tiers },
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
      for (const neutral of neutralRows(palette[gamut])) {
        for (const tier of settings.tiers) {
          const s = neutral.tiers[mode][tier]!;
          rows.push(
            [
              gamut,
              mode,
              tier,
              "default",
              neutral.key,
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
      md.push(`### ${MODE_NAMES[mode]} • base ${settings.bases[mode]}`, "");
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
 * version, --gray-60 and --neutral-60 the neutrals on it, and --base the background. Each holds its light and dark color, chosen by
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
    // Gray is the same on every screen, so it's written once; the base's neutral follows its gamut.
    for (const neutral of neutralRows(palette[gamut])) {
      if (neutral.key === "gray" && gamut !== "standard") continue;
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
    ` * ${settings.name || "Palette"}, solved with EK Colors.`,
    " * --red-60 is red on Lc 60 against --base, --red-60-muted its muted version, --gray-60 a gray",
    " * on it, and --neutral-60, when a base is tinted, a neutral that follows its tint. Light and dark",
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
