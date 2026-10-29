/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< EXPORT >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The export: the palette as JSON, CSS, CSV or Markdown, colored once it comes near the screen.    |
\*------------------------------------------------------------------------------------------------*/

import { toCss, toCsv, toJson, toMarkdown } from "../../palette/formats";
import { GAMUTS } from "../../palette/settings";
import type { Palette } from "../../palette/solve";
import { type Format, highlight } from "../highlight";
import { paletteNameText } from "../parts";
import { state } from "../state";

/**
 * The palette as text to copy, once every gamut tier is solved.
 *
 * @returns  The text in the chosen format.
 */
export function exportText(): string {
  const p = GAMUTS.every((g) => state.fresh.has(g)) ? (state.palettes as Palette) : null;
  if (!p) return "Solving every gamut…";
  // Markdown and CSS are titled with the palette's name, its own or the one it goes by.
  const named = { ...state.settings, name: paletteNameText() };
  return { json: () => toJson(state.settings, p), csv: () => toCsv(state.settings, p), md: () => toMarkdown(named, p), css: () => toCss(named, p) }[state.format]();
}

/**
 * The export section of Settings: the palette in a format to copy.
 *
 * @returns  HTML.
 */
export function exportSection(): string {
  const tab = (f: Format, t: string) => `<button type="button" data-format="${f}" aria-pressed="${String(state.format === f)}">${t}</button>`;
  return `<section class="group" id="export-section">
      <h2>Export</h2>
      <p class="soft">Every gamut, both modes, every tier, default and muted, custom colors, Gray and neutral colors included. JSON keeps the settings too, so they can be pasted back into Settings.</p>
      <div class="row"><div class="segmented" role="group" aria-label="Format">${tab("json", "JSON")}${tab("csv", "CSV")}${tab("md", "Markdown")}${tab("css", "CSS")}</div>
      <button type="button" data-action="copy">Copy</button><span id="export-copied" class="soft" role="status"></span></div>
      <pre id="export-text" class="code-view" tabindex="0" role="region" aria-label="The export"><code></code></pre>
    </section>`;
}

/** Colors the export once it comes near the screen: its thousands of parts cost every redraw. */
const exportInView = new IntersectionObserver(
  (entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    exportInView.disconnect();
    const code = document.querySelector("#export-text code");
    if (code) code.innerHTML = highlight(exportText(), state.format);
  },
  { rootMargin: "50% 0px" },
);

/**
 * Writes the export again, as gamut tiers arrive: as plain text at once, the same size, and in color
 * once it's near the screen.
 */
export function updateExport(): void {
  const code = document.querySelector("#export-text code");
  if (!code) return;
  code.textContent = exportText();
  exportInView.disconnect();
  exportInView.observe(code);
}
