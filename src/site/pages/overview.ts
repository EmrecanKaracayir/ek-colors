/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< OVERVIEW >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The overview page: the palette on the identity tier, its circle, and the colors as cards.        |
\*------------------------------------------------------------------------------------------------*/

import { anchorHue, anchorSource } from "../../palette/references";
import { SURROUNDS } from "../../palette/settings";
import { identityOf } from "../../palette/solve";
import { circle } from "../circle";
import { anchored, current, onScreen } from "../derived";
import { measured } from "../graph";
import { iconSvg } from "../icon";
import { card, colors, held, label, paletteName, range } from "../parts";
import { popButton } from "../popover";
import { state } from "../state";
import { marksKey } from "./color";

/**
 * The identity tier of the current mode, big, with the hue circle.
 *
 * @returns  HTML.
 */
export function overviewPage(): string {
  const { mode } = state;
  const settings = onScreen();
  const tier = identityOf(settings, mode);
  const room = settings.rooms[mode];
  const list = colors(tier);
  if (!list.length) return `<section class="intro"><h1>${paletteName()}</h1><p>Solving…</p></section>`;
  const custom = list.filter((c) => c.kind === "custom");
  const hues = list.length - custom.length;
  const ring = current()?.[mode].ring[tier] ?? [];
  // The palette's own icon, its hues on this mode's identity tier.
  const icon = iconSvg(settings.bases.light, settings.bases.dark, list.filter((c) => c.kind === "hue").map((c) => c.tiers[tier]!.default), 'class="palette-icon" aria-hidden="true"');
  return `<section class="intro">
      <h1 class="named">${icon}<span>${paletteName()}</span></h1>
      <p>${custom.length ? `${measured(String(hues))} + ${measured(String(custom.length))} colors that read the same on the ${mode} base: each sits exactly on its APCA contrast. The ${measured(String(hues))} hues aim to look equally colorful and evenly different, ${range(ring)} ΔE between neighbors; the custom ${custom.length === 1 ? "color stays on its" : "colors stay on their"} own hue.` : `${measured(String(list.length))} colors that read the same on the ${mode} base: each sits exactly on its APCA contrast and aims to look as colorful as the rest, evenly different from its neighbors: ${range(ring)} ΔE apart.`}</p>
    </section>
    <section class="glance">
      <h2>At a glance <span class="soft">• Lc ${String(tier)}, ${popButton(`identity:${mode}:${String(tier)}:glance`, "the identity tier", "What the identity tier is", "metric")}</span></h2>
      <div class="split">
      <div>${circle(list.flatMap((c) => [c.tiers[tier]!.default, c.tiers[tier]!.muted].map((s, i) => ({ hue: s.hue, m: s.colorfulness, color: s.color, custom: c.kind === "custom", name: i ? `${label(c.key)}, muted` : label(c.key) }))))}</div>
      <dl class="facts-list">
        <div><dt>Base</dt><dd class="mono">${settings.bases[mode]}</dd></div>
        <div><dt>Room</dt><dd>${measured(`${String(room.lux)} lux`)}, ${(SURROUNDS[room.surround] ?? "").toLowerCase()} surround</dd></div>
        <div><dt>Colorfulness</dt><dd>${held(tier)}; muted at ${measured(`${String(Math.round(settings.mutedShare * 100))}%`)}</dd></div>
        <div><dt>Anchor</dt><dd>${label(anchored())} at hue ${measured(`${anchorHue(settings).toFixed(0)}°`)}, ${anchorSource(settings)}</dd></div>
        <div><dt>Neighbor differences</dt><dd>${range(ring)} (CAM16-UCS)</dd></div>
      </dl>
      </div>
    </section>
    <section>
      <h2>The colors <span class="soft">• Lc ${String(tier)}</span></h2>
      <div class="cards">${list.map((c) => card(c.tiers[tier]!.default, label(c.key), c.key, { key: c.key, tier, variant: "default" })).join("")}</div>
      <h3>Muted</h3>
      <div class="cards small">${list.map((c) => card(c.tiers[tier]!.muted, label(c.key), c.key, { key: c.key, tier, variant: "muted" })).join("")}</div>
      ${marksKey(list.flatMap((c) => (["default", "muted"] as const).map((variant) => ({ s: c.tiers[tier]![variant], at: { key: c.key, tier, variant } }))))}
    </section>`;
}
