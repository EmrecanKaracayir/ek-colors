/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< CLI >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Solves the palette from config.ts and writes it to out/: palette.json (everything), palette.csv  |
| (one row per swatch) and palette.md (tables per mode and variant).                               |
\*------------------------------------------------------------------------------------------------*/

import { mkdirSync, writeFileSync } from "node:fs";

import { CONFIG } from "./config";
import { toCsv, toJson, toMarkdown } from "./palette/formats";
import { GAMUTS, MODES } from "./palette/settings";
import { solvePalette } from "./palette/solve";

const palette = solvePalette(CONFIG);

mkdirSync("out", { recursive: true });
writeFileSync("out/palette.json", toJson(CONFIG, palette));
writeFileSync("out/palette.csv", toCsv(CONFIG, palette));
writeFileSync("out/palette.md", toMarkdown(CONFIG, palette));

for (const gamut of GAMUTS) {
  console.log(
    `${gamut}: M per tier, light ${JSON.stringify(palette[gamut].light.targets)} dark ${JSON.stringify(palette[gamut].dark.targets)}`,
  );
}
for (const mode of MODES) {
  const tier = CONFIG.identityTier;
  const colors = palette.standard[mode].colors.map((c) => {
    const s = c.tiers[tier]!.default;
    return `${c.key} ${s.color}${s.short ? "*" : ""}`;
  });
  console.log(
    `${mode} Lc ${String(tier)}: ${colors.join(" ")} · ring ${palette.standard[mode].ring[tier]!.join(" ")}`,
  );
}
