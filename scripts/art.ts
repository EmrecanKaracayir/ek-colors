/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ART >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Draws the site's pictures from EK Palette as solved in out/: the icon (icon.svg, its hues on the |
| dark identity tier), the iPhone home-screen icon (apple-touch-icon.png) and the link preview     |
| card (preview.png). The two PNGs are small pages rendered by headless Chrome; CHROME names       |
| Chrome when it isn't in the usual place. Run it after EK Palette changes: pnpm art.              |
\*------------------------------------------------------------------------------------------------*/

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { forGamut } from "../src/palette/bases";
import { identityOf, type Palette } from "../src/palette/solve";
import type { Settings } from "../src/palette/settings";
import { iconSvg } from "../src/site/icon";

const { settings, palette } = JSON.parse(readFileSync("out/palette.json", "utf8")) as {
  settings: Settings;
  palette: Palette;
};
const dark = palette.standard.dark;
const tier = identityOf(forGamut(settings, "standard"), "dark");
const hues = dark.colors.filter((c) => !c.extra).map((c) => c.tiers[tier]!.default);
const [light, base] = [palette.standard.light.base, dark.base];

/**
 * Renders a page to a PNG with headless Chrome, once its font has had time to load.
 *
 * @param html    The page.
 * @param width   Its width in px.
 * @param height  Its height in px.
 * @param out     Where the PNG goes.
 */
function render(html: string, width: number, height: number, out: string): void {
  const dir = mkdtempSync(join(tmpdir(), "ek-art-"));
  writeFileSync(join(dir, "page.html"), html);
  const chrome =
    process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--virtual-time-budget=10000",
      `--window-size=${width},${height}`,
      `--screenshot=${resolve(out)}`,
      `file://${join(dir, "page.html")}`,
    ],
    { stdio: "ignore" },
  );
  rmSync(dir, { recursive: true, force: true });
}

const svg = iconSvg(light, base, hues);
writeFileSync("site/icon.svg", `${svg}\n`);
const page = (body: string, style: string) =>
  `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@500;600&display=swap"><style>*{margin:0}body{background:${base};${style}}</style>${body}`;
render(
  page(
    svg.replace("<svg ", '<svg width="148" height="148" '),
    "display:grid;place-items:center;width:180px;height:180px",
  ),
  180,
  180,
  "site/apple-touch-icon.png",
);
const swatches = hues
  .map((h) => h.color)
  .map((c) => `<span style="flex:1;height:56px;border-radius:12px;background:${c}"></span>`)
  .join("");
render(
  page(
    `<main style="display:grid;gap:56px;align-content:center;height:630px;padding:0 88px;box-sizing:border-box">
      <div style="display:flex;gap:48px;align-items:center">${svg.replace("<svg ", '<svg width="200" height="200" ')}
        <div style="display:grid;gap:16px"><h1 style="font-size:96px;font-weight:600;letter-spacing:-0.03em;color:#E7E8EA">EK Colors</h1>
        <p style="font-size:34px;line-height:1.35;color:#9C9EA4;max-width:740px">Accessible color palettes, solved: every color exactly on its APCA contrast, equally colorful, evenly different.</p></div></div>
      <div style="display:flex;gap:16px">${swatches}</div></main>`,
    `width:1200px;height:630px;font-family:"Instrument Sans",system-ui,sans-serif`,
  ),
  1200,
  630,
  "site/preview.png",
);
