/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< SOLVE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Solves the palette from config.ts and writes it to out/: every hue on every tier, default and    |
| muted, for light and dark, with JSON, CSV and Markdown for Figma.                                |
\*------------------------------------------------------------------------------------------------*/

import { mkdirSync, writeFileSync } from "node:fs";

import {
  BASES,
  BROWN,
  CHROMA,
  CHROMA_OVERRIDES,
  HUE_WINDOW,
  IDENTITY_TIER,
  type Mode,
  MODES,
  MUTED,
  type Name,
  NAMES,
  type Tier,
  TIERS,
  V1,
  YELLOW_HUE,
} from "./config.js";
import { apca, cam, colorAt, composition, distance, wcag } from "./model.js";

/* >------------------------------------< Placing a colour >------------------------------------< */

/**
 * The colour at a hue and chroma that sits exactly on a tier.
 *
 * Its CAM16 lightness is searched until APCA against the base just reaches the tier: the lowest
 * that does in dark mode, the highest in light mode, so it is never below the tier and only as far
 * above as hex rounding forces.
 *
 * @param mode    The mode.
 * @param hue     CAM16 hue.
 * @param chroma  CAM16 chroma.
 * @param tier    The APCA contrast to sit on.
 * @returns       The colour, or null when no colour of that chroma reaches the tier.
 */
function place(mode: Mode, hue: number, chroma: number, tier: Tier): string | null {
  const base = BASES[mode];
  const dark = mode === "dark";
  const meets = (hex: string) => apca(hex, base) >= tier;
  const ok = (j: number) => {
    const hex = colorAt(mode, hue, chroma, j);
    return hex !== null && meets(hex);
  };
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 34; i++) {
    const m = (lo + hi) / 2;
    const hex = colorAt(mode, hue, chroma, m);
    const passes = hex !== null && meets(hex);
    // Out of gamut counts as "too far" from the base, so the search moves back towards it.
    if (dark) passes || hex === null ? (hi = m) : (lo = m);
    else passes || hex === null ? (lo = m) : (hi = m);
  }
  const j = dark ? hi : lo;
  return ok(j) ? colorAt(mode, hue, chroma, j) : null;
}

/**
 * The most chroma, up to a target, a hue can hold on a tier.
 *
 * @param mode    The mode.
 * @param hue     CAM16 hue.
 * @param target  The chroma wanted.
 * @param tier    The tier.
 * @returns       The colour.
 *
 * @throws        When not even a grey reaches the tier.
 */
function strongest(mode: Mode, hue: number, target: number, tier: Tier): string {
  const full = place(mode, hue, target, tier);
  if (full) return full;
  let lo = 0;
  let hi = target;
  for (let i = 0; i < 18; i++) {
    const m = (lo + hi) / 2;
    place(mode, hue, m, tier) ? (lo = m) : (hi = m);
  }
  const color = place(mode, hue, lo, tier);
  if (!color)
    throw new Error(`No ${mode} colour at hue ${String(hue)} reaches tier ${String(tier)}.`);
  return color;
}

/* >----------------------------------------< Spacing >-----------------------------------------< */

/**
 * The distances between neighbours around the circle.
 *
 * @param mode    The mode.
 * @param colors  The colours, in hue order.
 * @returns       Each colour's distance to the next, the last to the first.
 */
function ring(mode: Mode, colors: readonly string[]): number[] {
  return colors.map((c, i) => distance(mode, c, colors[(i + 1) % colors.length]!));
}

/**
 * How unevenly spaced the colours are.
 *
 * @param distances  Neighbour distances.
 * @returns          Their standard deviation.
 */
function spread(distances: readonly number[]): number {
  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  return Math.sqrt(distances.reduce((a, d) => a + (d - mean) ** 2, 0) / distances.length);
}

/**
 * Hues moved, each within a window of its start, until neighbours are equally different.
 *
 * Yellow, the anchor, stays where it is.
 *
 * @param mode     The mode.
 * @param tier     The tier being spaced.
 * @param start    Each hue's starting angle.
 * @param window   How far a hue may move (degrees).
 * @param targets  Each colour's chroma target.
 * @returns        The hues and their colours.
 */
function space(
  mode: Mode,
  tier: Tier,
  start: readonly number[],
  window: number,
  targets: readonly number[],
) {
  const hues = [...start];
  const colors = hues.map((h, i) => strongest(mode, h, targets[i]!, tier));
  let best = spread(ring(mode, colors));
  for (let pass = 0; pass < 8; pass++) {
    let improved = false;
    for (let i = 0; i < NAMES.length; i++) {
      if (NAMES[i] === "yellow") continue;
      for (const step of [-3, 3, -1, 1]) {
        const hue = hues[i]! + step;
        if (Math.abs(hue - start[i]!) > window) continue;
        const trial = [...colors];
        trial[i] = strongest(mode, hue, targets[i]!, tier);
        const score = spread(ring(mode, trial));
        if (score < best - 1e-4)
          [best, hues[i], colors[i], improved] = [score, hue, trial[i]!, true];
      }
    }
    if (!improved) break;
  }
  return { hues, colors };
}

/* >----------------------------------------< Palette >-----------------------------------------< */

interface Swatch {
  readonly hex: string;
  readonly hue: number;
  readonly chroma: number;
  readonly lightness: number;
  readonly name: string;
  readonly apca: number;
  readonly wcag: number;
}

/**
 * A colour described for the output.
 *
 * @param mode  The mode.
 * @param hex   The colour.
 * @returns     Its CAM16 hue, chroma and lightness on the base, CAM16 hue name and contrasts.
 */
function swatch(mode: Mode, hex: string): Swatch {
  const c = cam(mode, hex);
  const round = (x: number) => Math.round(x * 10) / 10;
  return {
    hex,
    hue: round(c.hue),
    chroma: round(c.chroma),
    lightness: round(c.j),
    name: composition(c.hue),
    apca: round(apca(hex, BASES[mode])),
    wcag: Math.round(wcag(hex, BASES[mode]) * 100) / 100,
  };
}

type Set = Record<Name, Swatch> & { brown?: Swatch };

/**
 * Every tier of one mode.
 *
 * The identity tier is spaced from v1's hues; every other tier starts from its hues and may move
 * them a little, so each tier is evenly spaced in its own right.
 *
 * @param mode  The mode.
 * @returns     Per tier, the default and muted colours, with brown in the default.
 */
function solveMode(mode: Mode) {
  const targets = NAMES.map((n) => CHROMA_OVERRIDES[mode]?.[n] ?? CHROMA);
  const seeds = NAMES.map((n) => (n === "yellow" ? YELLOW_HUE[mode] : cam(mode, V1[mode][n]).hue));
  const identity = space(mode, IDENTITY_TIER, seeds, HUE_WINDOW.identity, targets);
  const tiers = {} as Record<Tier, { default: Set; muted: Set; ring: number[] }>;
  for (const tier of TIERS) {
    const { hues, colors } =
      tier === IDENTITY_TIER
        ? identity
        : space(mode, tier, identity.hues, HUE_WINDOW.tier, targets);
    const def = Object.fromEntries(NAMES.map((n, i) => [n, swatch(mode, colors[i]!)])) as Set;
    def.brown = swatch(mode, strongest(mode, cam(mode, V1[mode].brown).hue, CHROMA * BROWN, tier));
    const muted = Object.fromEntries(
      NAMES.map((n, i) => [
        n,
        swatch(mode, strongest(mode, hues[i]!, def[n].chroma * MUTED, tier)),
      ]),
    ) as Set;
    tiers[tier] = {
      default: def,
      muted,
      ring: ring(mode, colors).map((d) => Math.round(d * 10) / 10),
    };
  }
  return { base: BASES[mode], tiers };
}

/* >-----------------------------------------< Output >-----------------------------------------< */

const palette = Object.fromEntries(MODES.map((mode) => [mode, solveMode(mode)])) as Record<
  Mode,
  ReturnType<typeof solveMode>
>;

mkdirSync("out", { recursive: true });
writeFileSync(
  "out/palette.json",
  `${JSON.stringify({ config: { CHROMA, CHROMA_OVERRIDES, MUTED, BROWN, YELLOW_HUE }, palette }, null, 2)}\n`,
);

const rows = [
  "mode,tier,variant,colour,hex,cam16_hue,cam16_chroma,cam16_lightness,cam16_name,apca,wcag2",
];
const md: string[] = ["# Codemos palette v2", ""];
for (const mode of MODES) {
  md.push(`## ${mode === "light" ? "Light" : "Dark"} · base ${BASES[mode]}`, "");
  for (const variant of ["default", "muted"] as const) {
    md.push(`### ${variant === "default" ? "Default" : "Muted"}`, "");
    const names = variant === "default" ? [...NAMES, "brown" as const] : [...NAMES];
    md.push(
      `| Colour | ${TIERS.map((t) => `Lc ${String(t)}`).join(" | ")} |`,
      `|---|${TIERS.map(() => "---").join("|")}|`,
    );
    for (const n of names) {
      const cells = TIERS.map((t) => palette[mode].tiers[t][variant][n]);
      md.push(
        `| ${n} | ${cells.map((s) => (s ? `\`${s.hex}\` WCAG ${s.wcag.toFixed(2)}` : "")).join(" | ")} |`,
      );
      for (const [i, s] of cells.entries()) {
        if (s)
          rows.push(
            [
              mode,
              TIERS[i],
              variant,
              n,
              s.hex,
              s.hue,
              s.chroma,
              s.lightness,
              s.name,
              s.apca,
              s.wcag,
            ].join(","),
          );
      }
    }
    md.push("");
  }
}
writeFileSync("out/palette.csv", `${rows.join("\n")}\n`);
writeFileSync("out/palette.md", `${md.join("\n")}\n`);

for (const mode of MODES) {
  const id = palette[mode].tiers[IDENTITY_TIER];
  console.log(
    `${mode} Lc ${String(IDENTITY_TIER)}: ${NAMES.map((n) => `${n} ${id.default[n].hex}`).join(" ")} · ring ${id.ring.join(" ")}`,
  );
}
