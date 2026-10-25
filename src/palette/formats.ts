/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< FORMATS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| A solved palette as files: JSON (settings and everything solved), CSV (one row per swatch) and   |
| Markdown (tables per gamut tier, mode and variant). The command line and the site's export both  |
| use these.                                                                                       |
\*------------------------------------------------------------------------------------------------*/

import type { Palette } from "./solve";
import { GAMUT_NAMES, GAMUTS, MODE_NAMES, MODES, type Settings } from "./settings";

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
  const md = ["# Palette, solved with EK Colors", ""];
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
