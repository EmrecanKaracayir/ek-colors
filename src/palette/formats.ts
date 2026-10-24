/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< FORMATS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| A solved palette as files: JSON (settings and everything solved), CSV (one row per swatch) and   |
| Markdown (tables per mode and variant). The command line and the site's export both use these.  |
\*------------------------------------------------------------------------------------------------*/

import type { Palette } from "./solve";
import { MODES, type Settings } from "./settings";

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
    "mode,tier,variant,colour,hex,cam16_hue,cam16_chroma,cam16_colourfulness,cam16_lightness,cam16_name,apca,wcag2,wcag2_level",
  ];
  for (const mode of MODES) {
    for (const colour of palette[mode].colours) {
      for (const tier of settings.tiers) {
        const cell = colour.tiers[tier]!;
        for (const variant of ["default", "muted"] as const) {
          const s = cell[variant];
          if (!s) continue;
          rows.push(
            [
              mode,
              tier,
              variant,
              colour.key,
              s.hex,
              s.hue,
              s.chroma,
              s.colourfulness,
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
 * Tables per mode and variant, a colour per row and a tier per column.
 *
 * @param settings  The settings (for the bases and tiers).
 * @param palette   The solved palette.
 * @returns         Markdown.
 */
export function toMarkdown(settings: Settings, palette: Palette): string {
  const md = ["# Codemos palette v2", ""];
  for (const mode of MODES) {
    md.push(`## ${mode === "light" ? "Light" : "Dark"} · base ${settings.bases[mode]}`, "");
    for (const variant of ["default", "muted"] as const) {
      md.push(
        `### ${variant === "default" ? "Default" : "Muted"}`,
        "",
        `| Colour | ${settings.tiers.map((t) => `Lc ${String(t)}`).join(" | ")} |`,
        `|---|${settings.tiers.map(() => "---").join("|")}|`,
      );
      for (const colour of palette[mode].colours) {
        const cells = settings.tiers.map((t) => colour.tiers[t]![variant]);
        if (cells.every((s) => !s)) continue;
        md.push(
          `| ${colour.key} | ${cells.map((s) => (s ? `\`${s.hex}\` WCAG ${s.wcag.toFixed(2)}` : "")).join(" | ")} |`,
        );
      }
      md.push("");
    }
  }
  return `${md.join("\n")}\n`;
}
