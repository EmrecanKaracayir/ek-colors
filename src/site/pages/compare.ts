/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< COMPARE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The compare page: the palette beside EK Palette or Codemos, tier by tier, with both circles.     |
\*------------------------------------------------------------------------------------------------*/

import { CONFIG } from "../../config";
import { hueTurn } from "../../palette/model";
import { CODEMOS, CODEMOS_MUTED, MODES, NAMES } from "../../palette/settings";
import { type Swatch, identityOf, neighbors, swatch } from "../../palette/solve";
import { circle } from "../circle";
import { model, onScreen } from "../derived";
import { signedWhole } from "../graph";
import { card, colors, isPreset, label, paletteName, range } from "../parts";
import { comparing } from "../shell";
import { state } from "../state";
import { variant } from "../variants";
import { marksKey } from "./color";

/** One side of a comparison: a palette's colors on a tier, and how different each hue is from the next. */
interface Side {
  readonly name: string;
  readonly colors: readonly { readonly key: string; readonly custom: boolean; readonly swatch: Swatch }[];
}

/**
 * The comparison page: the palette in use next to EK Palette, or, with Shift+C, next to Codemos.
 *
 * @returns  HTML.
 */
export function compare(): string {
  return comparing() ? compareCodemos() : compareEk();
}

/**
 * How EK Palette was made, for the comparison with it.
 *
 * @returns  HTML.
 */
function ekMade(): string {
  const placed = Object.keys(CONFIG.placed).length;
  // Each curve point is named by the placed color nearest its center.
  const nearest = (hue: number) => label(Object.entries(CONFIG.placed).reduce((best, [key, h]) => (Math.abs(hueTurn(h, hue)) < Math.abs(hueTurn(CONFIG.placed[best]!, hue)) ? key : best), Object.keys(CONFIG.placed)[0]!));
  const lifts = MODES.flatMap((m) => CONFIG.curve[m].map((p) => `M ${signedWhole(p.amount)} around ${nearest(p.center).toLowerCase()} in ${m} mode`));
  return `<p>EK Palette is the palette EK Colors was made for, and almost all of it is solved: every color sits exactly on its contrast, as colorful as its tier allows and evenly different from its neighbors, by the rules in <a href="#how">How it works</a>. The rest is a person's eye: ${String(placed)} of its ${String(CONFIG.hues)} hues are placed where their names fit best${lifts.length ? `, and colorfulness is added where it looks weaker than the model says: ${lifts.join(", ")}` : ""}.</p>`;
}

/**
 * The palette in use next to EK Palette; with EK Palette's own settings, there's nothing to compare.
 *
 * @returns  HTML.
 */
function compareEk(): string {
  const { mode } = state;
  if (isPreset())
    return `<section class="intro"><h1>Compare</h1>${ekMade()}<p class="notice" role="note">There's nothing to compare yet: these are EK Palette's own settings. Change anything in <a href="#tune">Settings</a>, and the custom palette appears here next to EK Palette.</p></section>`;
  const tier = identityOf(onScreen(), mode);
  const ek = variant(CONFIG, "EK Palette")?.[mode];
  const intro = `<h1>Compare with EK Palette</h1>${ekMade()}<p>Here are EK Palette's ${state.variant} colors next to ${paletteName()}'s on Lc ${String(tier)}, on the ${mode} base.</p>`;
  if (!ek) return `<section class="intro">${intro}<p class="soft">Solving EK Palette…</p></section>`;
  const other: Side = { name: "EK Palette", colors: ek.colors.filter((c) => c.tiers[tier]).map((c) => ({ key: c.key, custom: c.custom, swatch: c.tiers[tier]![state.variant] })) };
  return comparison(other, tier, intro, "");
}

/**
 * The palette in use next to Codemos, its predecessor.
 *
 * @returns  HTML.
 */
function compareCodemos(): string {
  const { mode } = state;
  const settings = onScreen();
  if (settings.hues !== NAMES.length)
    return `<section class="intro"><h1>Compare with Codemos</h1><p>Codemos has eight hues. Set Hues to 8 in Settings to compare.</p></section>`;
  const m = model();
  const base = settings.bases[mode];
  const tier = identityOf(settings, mode);
  const source = state.variant === "default" ? CODEMOS[mode] : CODEMOS_MUTED[mode];
  // Codemos's colors described like the palette's, each aiming at what it is.
  const other: Side = {
    name: "Codemos",
    colors: colors(tier)
      .filter((c) => source[c.key])
      .map((c) => ({ key: c.key, custom: c.custom, swatch: swatch(m, base, mode, source[c.key]!, m.cam(mode, source[c.key]!).m) })),
  };
  const intro = `<h1>Compare with Codemos</h1>
      <p>Codemos is the palette of <a href="https://github.com/EmrecanKaracayir/Codemos-Modern#readme">Codemos Modern</a>, an extension for theming VS Code, and EK Palette's predecessor: the first attempt at a uniform palette, and the one this project grew from. Its colors were set by hand, each worked out with the same measures used here; EK Colors solves them instead. Here are Codemos's ${state.variant} colors next to ${paletteName()}'s on Lc ${String(tier)}, on the ${mode} base.</p>`;
  return comparison(other, tier, intro, "; Codemos's scatter, so some of its colors look stronger than others");
}

/**
 * Another palette next to the one in use on a tier: the hue circle, each color they share, and how
 * even the differences between neighbors are in each.
 *
 * @param other    The other palette.
 * @param tier     The tier.
 * @param intro    The page's title and introduction.
 * @param scatter  What the circle shows of the other palette, after what it shows of this one.
 * @returns        HTML.
 */
function comparison(other: Side, tier: number, intro: string, scatter: string): string {
  const { mode, variant: kind } = state;
  const m = model();
  const name = paletteName();
  const mine: Side = { name, colors: colors(tier).map((c) => ({ key: c.key, custom: c.custom, swatch: c.tiers[tier]![kind] })) };
  const theirs = new Map(other.colors.map((c) => [c.key, c.swatch]));
  const pairs = mine.colors.filter((c) => theirs.has(c.key));
  const hues = (side: Side) => side.colors.filter((c) => !c.custom);
  const ring = (side: Side) => neighbors(m, mode, hues(side).map((c) => c.swatch.color));
  const [otherRing, myRing] = [ring(other), ring(mine)];
  const most = Math.max(...otherRing, ...myRing);
  const reached = hues(mine).map((c) => c.swatch.colorfulness);
  const offRing = Math.max(...reached) - Math.min(...reached) >= 0.5;
  const bars = (side: Side, values: readonly number[]) => {
    const keys = hues(side).map((c) => c.key);
    return values
      .map(
        (d, i) => `<div class="bar-row"><span class="soft">${label(keys[i]!)} → ${label(keys[(i + 1) % keys.length]!)}</span>
          <span class="bar"><span style="width:${((d / most) * 100).toFixed(1)}%"></span></span><span class="mono">${d.toFixed(1)}</span></div>`,
      )
      .join("");
  };
  const dots = (side: Side, hollow: boolean) => side.colors.map((c) => ({ hue: c.swatch.hue, m: c.swatch.colorfulness, color: c.swatch.color, hollow, custom: c.custom, name: `${label(c.key)}, ${side.name}` }));
  return `<section class="intro">${intro}</section>
    <section class="split">
      <div>${circle([...dots(other, true), ...dots(mine, false)])}</div>
      <div class="legend">
        <p><span class="key hollow"></span> ${other.name} <span class="key"></span> ${name}</p>
        <p class="soft">Distance from the center is colorfulness. ${name}'s hues share one ring${offRing ? ", apart from those colorfulness per hue moves on purpose" : ""}${mine.colors.some((c) => c.custom) ? ", and its custom colors sit at their share of it" : ""}${scatter}.</p>
      </div>
    </section>
    ${
      pairs.length
        ? `<section>
      <h2>Each color</h2>
      <div class="pairs">${pairs.map((c) => `<div class="versus"><h3>${label(c.key)}</h3>${card(theirs.get(c.key)!, other.name)}${card(c.swatch, name, c.key, { key: c.key, tier, variant: kind })}</div>`).join("")}</div>
      ${marksKey(pairs.map((c) => ({ s: c.swatch, at: { key: c.key, tier, variant: kind } })))}
    </section>`
        : ""
    }
    <section>
      <h2>Neighbor differences <span class="soft">• CAM16-UCS</span></h2>
      <p class="soft">How different each color looks from the next one around the circle. Even bars mean no two neighbors are easier to confuse than the rest.</p>
      <div class="split even">
        <div><h3>${other.name} <span class="soft">• ${range(otherRing)}</span></h3>${bars(other, otherRing)}</div>
        <div><h3>${name} <span class="soft">• ${range(myRing)}</span></h3>${bars(mine, myRing)}</div>
      </div>
    </section>`;
}
