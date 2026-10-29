/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< METRICS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the strip measures: how far each step bends from the uniform palette, how even neighbors    |
| are, and the popovers that explain them.                                                         |
\*------------------------------------------------------------------------------------------------*/

import { parts, plainSquared } from "../../palette/model";
import { GAMUT_NAMES } from "../../palette/settings";
import { bendMeter, evenLimits, evenText, evenness, inGaps, signed, thresholds, visibility, zone, zoneTable } from "../graph";
import { label } from "../parts";
import { popButton, popSource } from "../popover";
import { SCREEN, state } from "../state";
import { type Row, STEPS, type Split, changes, focusKey } from "./strip";

/**
 * A share as a signed percentage.
 *
 * @param share  E.g. 0.25.
 * @returns      E.g. "+25%", "−8%", "0%".
 */
function percent(share: number): string {
  const value = Math.round(share * 100);
  return value === 0 ? "0%" : `${value > 0 ? "+" : "−"}${String(Math.abs(value))}%`;
}

/**
 * How bent a row's palette is: each color's difference from its turned version, in gaps, averaged
 * as a root mean square, so one large difference isn't hidden among small ones.
 *
 * @param row  The row.
 * @returns    Gaps.
 */
function averageBend(row: Row): number {
  const { colors, gap } = changes;
  if (!colors.length) return 0;
  return Math.sqrt(colors.reduce((sum, c) => sum + (c.bend[row] / gap) ** 2, 0) / colors.length);
}

/**
 * What a row's bend is made of, over every color: each color's shares weighted by how much it
 * bends (its share of the whole sum of squares, in CAM16-UCS's plain distance).
 *
 * @param row  The row.
 * @returns    Hue, colorfulness and lightness shares.
 */
function bendSplit(row: Row): Split {
  let [weight, hue, colorfulness, lightness] = [0, 0, 0, 0];
  for (const c of changes.colors) {
    const w = plainSquared(c.bend[row]);
    [weight, hue, colorfulness, lightness] = [weight + w, hue + w * c.splits[row].hue, colorfulness + w * c.splits[row].colorfulness, lightness + w * c.splits[row].lightness];
  }
  return weight ? { hue: hue / weight, colorfulness: colorfulness / weight, lightness: lightness / weight } : { hue: 0, colorfulness: 0, lightness: 0 };
}

/**
 * A row's neighbor gaps against the even gap, as shares (−0.08 is 8% closer).
 *
 * @param row  The row.
 * @returns    Each pair's names and how far off even it is.
 */
function offsets(row: Row): { pair: string; keys: [string, string]; off: number }[] {
  const { rings, gap } = changes;
  const ring = rings[row];
  return ring.gaps.map((g, i) => {
    const keys: [string, string] = [ring.keys[i]!, ring.keys[(i + 1) % ring.keys.length]!];
    return { pair: `${label(keys[0])}–${label(keys[1])}`, keys, off: g / gap - 1 };
  });
}

/**
 * The value furthest from zero.
 *
 * @param values  Shares.
 * @returns       The one with the largest size, or 0.
 */
function furthest(values: readonly number[]): number {
  return values.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
}

/**
 * The column beside the strip: per row from Turned on, how bent the palette is, how even and how
 * equally colorful; or, while a swatch is pointed at, the same for that color.
 *
 * @returns  HTML.
 */
export function metrics(): string {
  const color = focusKey ? changes.colors.find((c) => c.key === focusKey) : undefined;
  const rows: Row[] = [1, 2, 3];
  const heads = [
    popButton("metric:bend:head", "Bend", "What Bend means", "metric head"),
    popButton("metric:even:head", "Even", "What Even means", "metric head even"),
    popButton("metric:colorful:head", "M", "What M means", "metric head colorful"),
  ];
  // Before the first solve there's nothing to measure: dashes, and the bar with no mark.
  if (!changes.colors.length) {
    const dash = (kind: string) => `<span class="metric${kind}">–</span>`;
    const cells = rows.flatMap(() => [dash(""), dash(" even"), dash(" colorful")]);
    return `${heads.join("")}${cells.join("")}<span class="metric-scope">${bendMeter(null, changes.gap)}<span class="scope-text">–</span></span>`;
  }
  const cells = rows.flatMap((row) => {
    if (color) {
      const mine = offsets(row).filter((o) => o.keys.includes(color.key)).map((o) => o.off);
      return [
        `<span class="metric">${(color.bend[row] / changes.gap).toFixed(2)}</span>`,
        `<span class="metric even">${percent(furthest(mine))}</span>`,
        `<span class="metric colorful">${percent(color.colorful[row])}</span>`,
      ];
    }
    const even = Math.max(0, ...offsets(row).map((o) => Math.abs(o.off)));
    return [
      popButton(`metric:bend:${String(row)}`, averageBend(row).toFixed(2), `How bent ${STEPS[row].name} is`, "metric"),
      popButton(`metric:even:${String(row)}`, `±${String(Math.round(even * 100))}%`, `How even ${STEPS[row].name} is`, "metric even"),
      popButton(`metric:colorful:${String(row)}`, percent(furthest(changes.colors.map((c) => c.colorful[row]))), `How equally colorful ${STEPS[row].name} is`, "metric colorful"),
    ];
  });
  // Below, the palette's bend on its zones; or the color pointed at, on the same scale.
  const bend = color ? color.bend[3] / changes.gap : averageBend(3);
  const scope = color
    ? `<span class="metric-scope">${bendMeter(bend, changes.gap)}<span class="scope-text"><span class="dot" style="--c:${color.color}"></span>${color.name}</span></span>`
    : popButton("metric:verdict", `${bendMeter(bend, changes.gap)}<span class="scope-text">${zone(bend, changes.gap).name}</span>`, `Bend ${bend.toFixed(2)} gap: ${zone(bend, changes.gap).name}. What it means`, "metric-scope");
  return heads.join("") + cells.join("") + scope;
}

/**
 * A change split into hue, colorfulness and lightness, as a bar with its shares.
 *
 * @param split  The shares.
 * @returns      HTML.
 */
function splitBar(split: ReturnType<typeof parts>): string {
  const whole = (x: number) => `${String(Math.round(x * 100))}%`;
  const kinds = [
    ["hue", "Hue", split.hue],
    ["colorfulness", "Colorfulness", split.colorfulness],
    ["lightness", "Lightness", split.lightness],
  ] as const;
  return `<div class="pop-split" aria-hidden="true">${kinds.map(([kind, , share]) => `<span class="${kind}" style="flex-grow:${share.toFixed(4)}"></span>`).join("")}</div>
    <p class="pop-legend">${kinds.map(([kind, name, share]) => `<span><i class="${kind}"></i>${name} ${whole(share)}</span>`).join("")}</p>`;
}

/**
 * A turn in degrees, signed.
 *
 * @param degrees  The turn.
 * @returns        E.g. "+8.3°".
 */
export function turnText(degrees: number): string {
  return `${degrees > 0 ? "+" : degrees < 0 ? "−" : ""}${Math.abs(degrees).toFixed(1)}°`;
}

popSource("tools", (which) => {
  const { bases } = state.settings;
  if (which === "mode")
    return `<h3>Mode: Light and Dark</h3>
      <p>Two palettes, each made for its own background: <span class="mono">${bases.light}</span> for light and <span class="mono">${bases.dark}</span> for dark. Every color sits exactly on its contrast against that background, so a light-mode color and its dark-mode twin differ.</p>
      <p class="pop-how">Switching also turns this page into that background, so you see the colors where they're meant to be used. It isn't a separate theme for the site.</p>`;
  if (which === "edits")
    return `<h3>Edits: H and M</h3>
      <p>Switch edits off to see the pages without them: <strong>H</strong> is the placed hues, <strong>M</strong> colorfulness per hue. With both off, the pages show the uniform palette for these settings. The edits themselves stay as they are; this only changes what the pages show.</p>
      <p class="pop-how">Settings, the blind tests and Export always use the palette with every edit.</p>`;
  if (which === "variant")
    return `<h3>Variant: Default and Muted</h3>
      <p>Every color comes in two strengths on every tier: <strong>Default</strong> at the palette's colorfulness, and <strong>Muted</strong> at ${String(Math.round(state.settings.mutedShare * 100))}% of it, for quieter uses like backgrounds and borders. Both keep the same hue and contrast.</p>`;
  return `<h3>Gamut: how many colors a screen can show</h3>
    <dl class="pop-facts words">
      <div><dt>Standard</dt><dd>What every screen can show.</dd></div>
      <div><dt>Wide</dt><dd>Most phones, tablets and Macs from recent years; more vivid colors.</dd></div>
      <div><dt>Ultra</dt><dd>The widest screens, mostly future and HDR ones.</dd></div>
    </dl>
    <p>Each one gets its own palette: a wider screen can reach more colorfulness, so the same hue can be more vivid there. This screen shows <strong>${GAMUT_NAMES[SCREEN]}</strong>, marked with a dot.</p>
    <p class="pop-how">On a screen narrower than the one chosen, the page shows the closest colors it can, and says so.</p>`;
});

popSource("change", (key) => {
  const c = changes.colors.find((x) => x.key === key);
  if (!c) return "";
  const { gap, tier, turn: angle } = changes;
  return `<h3><span class="dot" style="--c:${c.color}"></span> ${c.name}</h3>
    <p class="pop-lead">Bends <strong>${inGaps(c.bend[3] / gap) || "nothing"}</strong> from the turned lineup: ${visibility(c.bend[3], gap)}.</p>
    ${c.bend[3] >= 0.05 ? splitBar(c.splits[3]) : ""}
    <dl class="pop-facts">
      <div><dt>+H</dt><dd>${inGaps(c.bend[2] / gap) || "no bend"}${c.turned ? ` • ${turnText(c.turned)} from turned` : ""}</dd></div>
      <div><dt>+M</dt><dd>${inGaps(c.bend[3] / gap) || "no bend"} in all${c.added ? ` • ${signed(c.added)} M, ${percent(c.colorful[3])} of the target` : ""}</dd></div>
      <div><dt>Uniform</dt><dd>${inGaps(c.moved / gap) || "no change"} from the lineup at the anchor, turn ${turnText(angle)} included</dd></div>
    </dl>
    <p class="pop-how">${c.name} in the turned lineup (the uniform lineup turned ${turnText(angle)}, still uniform) is compared with ${c.name} in use, on Lc ${String(tier)}, as CAM16-UCS ΔE (${c.bend[3].toFixed(1)}), then divided by the even gap (${gap.toFixed(1)}). The bar shows the bend's hue, colorfulness and lightness parts.</p>`;
});

popSource("metric", (which) => {
  const { gap, targets, turn: angle } = changes;
  const [kind, which2] = which.split(":") as [string, string | undefined];
  if (kind === "verdict") {
    const bend = averageBend(3);
    const split = bendSplit(3);
    const evenOff = Math.max(0, ...offsets(3).map((o) => Math.abs(o.off)));
    const vivid = [...changes.colors].sort((a, b) => Math.abs(b.colorful[3]) - Math.abs(a.colorful[3]))[0];
    return `<h3>${zone(bend, changes.gap).name}: bend ${bend.toFixed(2)} gap</h3>
      ${bendMeter(bend, gap, true)}
      <p>${zone(bend, gap).note}</p>
      ${bend >= 0.005 ? splitBar(split) : ""}
      <dl class="pop-facts">
        <div><dt>Even</dt><dd>±${String(Math.round(evenOff * 100))}%: ${evenness(evenOff, gap)}</dd></div>
        <div><dt>M</dt><dd>${vivid && Math.abs(vivid.colorful[3]) >= 0.005 ? `${percent(vivid.colorful[3])} (${vivid.name})` : "equal"}</dd></div>
        <div><dt>Turned</dt><dd>${turnText(angle)}, which keeps the lineup uniform</dd></div>
      </dl>
      <p class="pop-how">You're on safe ground while Bend stays within Tuned or Reshaped and Even under ${String(evenLimits(gap)[0])}%: deliberate adjustments, with every pair of neighbors still about equally easy to tell apart. It gets risky when Even passes ${String(evenLimits(gap)[1])}% (two colors getting confusable) or Bend passes 0.5, where the palette is no longer honestly uniform.</p>
      ${zoneTable(gap)}`;
  }
  const heads: Record<string, string> = {
    bend: `<h3>Bend</h3><p>How far the colors are from the nearest uniform lineup. Turning the whole lineup keeps it uniform, so the uniform lineup is first turned to best match the placed hues (${turnText(angle)}); what's left is the bend. Each color's difference, in gaps (one gap is ${gap.toFixed(1)} ΔE), averaged as a root mean square, so one large difference isn't hidden among small ones.</p>${zoneTable(gap)}<p class="pop-how">Rows: Uniform is the lineup at the anchor; Turned is it turned to match; +H adds placed hues; +M adds colorfulness per hue. Point at a swatch for that color; click a row's name to keep it shown, then ↑ and ↓ switch rows.</p>`,
    even: `<h3>Even</h3><p>How evenly spaced neighbors are: the gap furthest from the even gap, as a share of it. This is the uniform lineup's main promise: every pair of neighbors equally easy to tell apart.</p><p class="pop-how">Under ${String(evenLimits(gap)[0])}% is fine, ${String(evenLimits(gap)[0])} to ${String(evenLimits(gap)[1])}% worth watching, over ${String(evenLimits(gap)[1])}% two colors are getting confusable (or, over even, a hole in the palette).</p>${thresholds(gap)}`,
    colorful: `<h3>M</h3><p>How equally colorful the colors are: the color furthest from the target colorfulness (M ${targets[3].toFixed(1)} on this tier), as a share of it. The uniform lineup aims every color at the same colorfulness, as far as the screen allows; colorfulness per hue changes that on purpose, so this says how far you've pushed.</p>`,
  };
  if (which2 === "head") return heads[kind] ?? "";
  const row = Number(which2) as Row;
  const title = `${STEPS[row].name}: ${{ bend: "bend", even: "evenness", colorful: "colorfulness" }[kind] ?? ""}`;
  if (kind === "bend") {
    const split = bendSplit(row);
    const list = [...changes.colors]
      .toSorted((a, b) => b.bend[row] - a.bend[row])
      .map((c) => `<div><dt><span class="dot" style="--c:${c.color}"></span> ${c.name}</dt><dd>${(c.bend[row] / gap).toFixed(2)} gap</dd></div>`)
      .join("");
    return `<h3>${title}</h3><p class="pop-lead">Average ${averageBend(row).toFixed(2)} gap from the turned lineup: ${zone(averageBend(row), gap).name}.</p>${bendMeter(averageBend(row), gap, true)}${averageBend(row) >= 0.005 ? splitBar(split) : ""}<dl class="pop-facts">${list}</dl>`;
  }
  if (kind === "even") {
    const ring = changes.rings[row];
    const list = offsets(row)
      .map((o) => `<div><dt>${o.pair}</dt><dd>${percent(o.off)}</dd></div>`)
      .join("");
    return `<h3>${title}</h3><p class="pop-lead">${evenText(ring.gaps, ring.keys.map(label), gap)}</p><dl class="pop-facts">${list}</dl>`;
  }
  const list = [...changes.colors]
    .toSorted((a, b) => Math.abs(b.colorful[row]) - Math.abs(a.colorful[row]))
    .map((c) => `<div><dt><span class="dot" style="--c:${c.color}"></span> ${c.name}</dt><dd>${percent(c.colorful[row])}</dd></div>`)
    .join("");
  return `<h3>${title}</h3><p class="pop-lead">Against the target M ${targets[row].toFixed(1)}.</p><dl class="pop-facts">${list}</dl>`;
});
