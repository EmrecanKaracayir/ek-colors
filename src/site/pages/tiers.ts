/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< TIERS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The tiers page: every contrast tier with its colors, and the identity tier, picked by hand or    |
| automatically.                                                                                   |
\*------------------------------------------------------------------------------------------------*/

import { type Mode, ROLES } from "../../palette/settings";
import { TEXT_MINIMUM, autoIdentity, identityOf, textScore } from "../../palette/solve";
import { current, onScreen } from "../derived";
import { card, colors, held, label, range } from "../parts";
import { hidePopover, popButton, popSource } from "../popover";
import { write } from "../settings/fields";
import { render } from "../shell";
import { solve } from "../solver";
import { state } from "../state";
import { marksKey } from "./color";

/**
 * A star, the identity tier's mark: filled for the tier in use, an outline for the suggested one
 * when another is in use, and on any other tier's title an outline that shows only under the
 * pointer, as a preview of choosing it.
 */
const star = (kind: "selected" | "suggested" | "slot") =>
  `<svg class="id-star ${kind}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.85 5.95 6.55.85-4.8 4.55 1.2 6.5L12 17.3l-5.8 3.15 1.2-6.5-4.8-4.55 6.55-.85z"/></svg>`;

/**
 * A tier's heading on the Tiers page. Its title is a choice of identity tier: the identity tier's
 * opens what that means; any other's makes it the identity, and the suggested one's, while another
 * is set by hand, goes back to automatic. A star marks the identity tier and an outline the
 * suggestion when it differs; a note at the line's end says which is which and opens the same
 * explanation.
 *
 * @param tier  The tier.
 * @returns     HTML.
 */
function tierHeading(tier: number): string {
  const { mode } = state;
  const settings = onScreen();
  const selected = tier === identityOf(settings, mode);
  const suggested = tier === autoIdentity(settings.bases[mode], settings.tiers);
  const pop = `identity:${mode}:${String(tier)}`;
  const title = `${star(selected ? "selected" : suggested ? "suggested" : "slot")}Lc ${String(tier)} <span class="soft">• ${ROLES[tier] ?? ""}</span>`;
  const pick = selected
    ? popButton(`${pop}:title`, title, `Lc ${String(tier)} is the identity tier, ${identityHow(tier)}: what that means`, "tier-pick chosen", `tier-pick-${String(tier)}`)
    : `<button type="button" class="tier-pick" id="tier-pick-${String(tier)}" data-identity="${suggested ? "auto" : String(tier)}" aria-label="Lc ${String(tier)} • ${ROLES[tier] ?? ""}: ${suggested ? "the suggested identity tier, go back to automatic" : `make it the identity tier for ${mode} mode`}">${title}</button>`;
  const note = selected && suggested ? "Selected • suggested ID" : selected ? "Selected ID" : suggested ? "Suggested ID" : "";
  return `<div class="tier-head"><h2>${pick}</h2>${note ? popButton(`${pop}:note`, note, `${note}: what that means`, "id-note") : ""}</div>`;
}

/**
 * How the identity tier came to be: picked automatically or set by hand.
 *
 * @param tier  The identity tier.
 * @returns     E.g. "automatic".
 */
function identityHow(tier: number): string {
  const { mode } = state;
  const settings = onScreen();
  if (settings.identityTier[mode] === "auto") return "automatic";
  return tier === autoIdentity(settings.bases[mode], settings.tiers) ? "set by hand, also suggested" : "set by hand";
}

/**
 * The identity tier's star on a color's table, opening what the identity tier is.
 *
 * @param tier   The identity tier.
 * @param where  Where it's shown, so each star opens its own popover.
 * @returns      HTML.
 */
export function identityLabel(tier: number, where: string): string {
  return popButton(`identity:${state.mode}:${String(tier)}:${where}`, star("selected"), `Lc ${String(tier)} is the identity tier, ${identityHow(tier)}: what that means`, "id-mark");
}

popSource("identity", (which) => {
  const [mode, tierText] = which.split(":") as [Mode, string];
  const settings = onScreen();
  const tier = Number(tierText);
  const base = settings.bases[mode];
  const auto = autoIdentity(base, settings.tiers);
  const score = (t: number) => textScore(base, t).toFixed(2);
  if (tier !== identityOf(settings, mode))
    return `<h3>${star("suggested")}Suggested identity tier</h3>
      <p>Lc ${String(tier)} is where APCA and WCAG 2 together come closest to their minimum for text in ${mode} mode, Lc ${String(TEXT_MINIMUM.apca)} and ${String(TEXT_MINIMUM.wcag)}:1, with a score of ${score(tier)}; 1 is exactly at the minimum. It's the identity tier when it's left automatic.</p>
      <p>Lc ${String(identityOf(settings, mode))} is set by hand instead, with a score of ${score(identityOf(settings, mode))}.</p>
      <p><button type="button" data-identity="auto">Back to automatic</button></p>`;
  const picked =
    settings.identityTier[mode] === "auto"
      ? `<p>Picked automatically: it's where APCA and WCAG 2 together come closest to their minimum for text, Lc ${String(TEXT_MINIMUM.apca)} and ${String(TEXT_MINIMUM.wcag)}:1, with a score of ${score(tier)} here; 1 is exactly at the minimum.</p>`
      : `<p>Set by hand. Automatic would be Lc ${String(auto)}, where APCA and WCAG 2 together come closest to their minimum for text (a score of ${score(auto)}, against ${score(tier)} here).</p>
        <p><button type="button" data-identity="auto">Back to automatic</button></p>`;
  return `<h3>${star("selected")}Identity tier</h3>
    <p>Lc ${String(tier)} stands for each hue in ${mode} mode: the Overview shows it, every tier's hues start from it, and the blind tests use it.</p>
    ${picked}
    <p class="pop-how">On the Tiers page, clicking a tier's title makes it the identity; that solves the whole palette again, since every tier's hues start from this one. Settings → Tiers sets it for both modes.</p>`;
});

/**
 * Makes a tier the identity for a mode, or gives the choice back to the palette. Choosing the
 * automatic pick is the same as automatic.
 *
 * @param mode    The mode.
 * @param choice  A tier, or "auto".
 */
function setIdentity(mode: Mode, choice: number | "auto"): void {
  const { bases, tiers } = onScreen();
  write(`identityTier.${mode}`, choice === autoIdentity(bases[mode], tiers) ? "auto" : choice);
  hidePopover();
  render();
  solve();
}

document.addEventListener("click", (event) => {
  const el = (event.target as Element).closest<HTMLElement>("[data-identity]");
  if (!el) return;
  setIdentity(state.mode, el.dataset.identity === "auto" ? "auto" : Number(el.dataset.identity));
});

/**
 * Every tier of the current mode and variant, one section each.
 *
 * @returns  HTML.
 */
export function tiersPage(): string {
  const { settings, mode, variant } = state;
  return `<section class="intro">
      <h1>Tiers</h1>
      <p>Every color on every APCA contrast against the ${mode} base. Pick the tier by what the color does.</p>
    </section>
    ${settings.tiers
      .map((tier) => {
        const ring = current()?.[mode].ring[tier] ?? [];
        const list = colors(tier);
        return `<section>
          ${tierHeading(tier)}
          <p class="soft">Colorfulness ${held(tier)} • neighbor differences ${range(ring)}</p>
          <div class="cards small">${list.map((c) => card(c.tiers[tier]![variant], label(c.key), c.key, { key: c.key, tier, variant })).join("")}</div>
          ${marksKey(list.map((c) => ({ s: c.tiers[tier]![variant], at: { key: c.key, tier, variant } })))}
        </section>`;
      })
      .join("")}`;
}
