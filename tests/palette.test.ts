/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< TESTS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the solver promises: EK Palette solves to the palette in out/, every color sits on its      |
| tier, settings read back from their export, and bases are read the same in any CSS form.         |
\*------------------------------------------------------------------------------------------------*/

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { CONFIG } from "../src/config";
import { forGamut, isBaseColor, keptPicks, pickProblem } from "../src/palette/bases";
import { readSettings } from "../src/palette/check";
import { toCss, toJson } from "../src/palette/formats";
import { lightness } from "../src/palette/model";
import { DEFAULTS, GAMUTS, MODES } from "../src/palette/settings";
import { colorKeys, solvePalette } from "../src/palette/solve";

const palette = solvePalette(CONFIG);

describe("EK Palette", () => {
  it("solves to the palette in out/", () => {
    // After a change that moves a color on purpose, solve again with pnpm solve.
    assert.equal(toJson(CONFIG, palette), readFileSync("out/palette.json", "utf8"));
  });

  it("puts every color on its tier's contrast, or just past it", () => {
    for (const gamut of GAMUTS)
      for (const mode of MODES)
        for (const color of palette[gamut][mode].colors)
          for (const tier of CONFIG.tiers)
            for (const variant of ["default", "muted"] as const) {
              const lc = Math.abs(color.tiers[tier]![variant].apca);
              assert.ok(
                lc >= tier - 0.05 && lc < tier + 1,
                `${gamut} ${mode} ${color.key} Lc ${String(tier)} ${variant}: ${String(lc)}`,
              );
            }
  });
});

describe("Settings", () => {
  it("read back from their JSON export", () => {
    const exported = JSON.parse(toJson(CONFIG, palette)) as unknown;
    assert.deepEqual(readSettings(exported, DEFAULTS), CONFIG);
  });

  it("take up to 64 hues", () => {
    assert.equal(readSettings({ ...CONFIG, hues: 64 }, DEFAULTS).hues, 64);
    assert.throws(() => readSettings({ ...CONFIG, hues: 65 }, DEFAULTS));
  });

  it("name custom colors apart from Gray and the hues", () => {
    const keys = colorKeys({
      ...CONFIG,
      customColors: [
        { name: "Gray", hue: 0, share: 0.5 },
        { name: "Red", hue: 10, share: 0.5 },
      ],
    });
    assert.ok(!keys.custom.includes("gray") && !keys.custom.includes("red"), keys.custom.join(" "));
  });
});

describe("Bases", () => {
  it("are as light in any CSS form as in hex", () => {
    for (let v = 0; v <= 255; v += 15) {
      const hex = `#${v.toString(16).padStart(2, "0").repeat(3)}`;
      assert.ok(
        Math.abs(lightness(hex) - lightness(`rgb(${String(v)} ${String(v)} ${String(v)})`)) < 0.01,
        hex,
      );
    }
  });

  it("take every CSS Color 4 form, opaque only", () => {
    for (const color of [
      "#EBEBEB",
      "rgb(235 235 235)",
      "hsl(0 0% 92%)",
      "hwb(0 92% 8%)",
      "lab(93 0 0)",
      "lch(93 0 0)",
      "oklab(0.94 0 0)",
      "oklch(0.94 0 0)",
      "color(display-p3 0.92 0.92 0.92)",
      "color(rec2020 0.9 0.9 0.9)",
      "color(a98-rgb 0.9 0.9 0.9)",
      "color(xyz-d50 0.8 0.83 0.7)",
    ])
      assert.ok(isBaseColor(color), color);
    for (const color of [
      "rgb(235 235 235 / 0.5)",
      "rgb(240 240 240 / <b>)",
      "oklch(0.95 0 0 / x)",
      "#EBEBEB80",
      "<img>",
      "not a color",
    ])
      assert.ok(!isBaseColor(color), color);
  });

  it("let a pick stand only while it's the same background", () => {
    const settings = {
      ...CONFIG,
      bases: { light: "color(display-p3 1 0.9 0.62)", dark: CONFIG.bases.dark },
    };
    const closest = forGamut(settings, "standard").bases.light;
    assert.equal(pickProblem(settings, "light", "standard", closest), null);
    assert.match(
      pickProblem(settings, "light", "standard", "#C8E6FF") ?? "",
      /different background/,
    );
    assert.match(pickProblem(settings, "light", "wide", "#FFE59A") ?? "", /exactly/);
  });

  it("let go of a pick that's no longer the same background", () => {
    const settings = {
      ...CONFIG,
      bases: { light: "color(display-p3 1 0.9 0.62)", dark: CONFIG.bases.dark },
      pickedBases: { standard: { light: "#C8E6FF" } },
    };
    const kept = keptPicks(settings);
    assert.deepEqual(kept.settings.pickedBases, {});
    assert.deepEqual(kept.dropped, ["the light color for standard screens"]);
  });
});

describe("Exports", () => {
  it("keep the CSS comment closed whatever the name", () => {
    const css = toCss({ ...CONFIG, name: "Ends */ here" }, palette);
    assert.equal(css.indexOf("*/"), css.indexOf("\n */\n") + 2);
  });
});
