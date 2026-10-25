/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< TECHNICAL >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The algorithm, technically: every step the solver takes, with its formulas, constants and search |
| rules, in the order it runs. The plain-words version is How it works; this page is the           |
| reference.                                                                                       |
\*------------------------------------------------------------------------------------------------*/

import { argbFromHex, lstarFromArgb } from "@material/material-color-utilities";

import { LUX_TO_ADAPTING, viewingConditions } from "../palette/model";
import { anchorHue, anchorSource } from "../palette/references";
import { MODE_NAMES, MODES, NAMES } from "../palette/settings";
import project from "../../package.json";
import { autoIdentity, CLOSEST, hueKeys, identityOf, TEXT_MINIMUM, textScore } from "../palette/solve";
import type { Context } from "./explain";
import { escape } from "./graph";

/* >-----------------------------------------< Values >-----------------------------------------< */

const fixed = (x: number, d = 3) => x.toFixed(d);

/**
 * The CAM16 viewing parameters each mode is solved under, for the table.
 *
 * @param ctx  What the page shows.
 * @returns    HTML rows.
 */
function conditions(ctx: Context): string {
  return MODES.map((mode) => {
    const room = ctx.settings.rooms[mode];
    const la = room.lux * LUX_TO_ADAPTING;
    const yb = lstarFromArgb(argbFromHex(ctx.settings.bases[mode]));
    const vc = viewingConditions(ctx.settings, mode);
    const f = 0.8 + room.surround / 10;
    return `<tr><th scope="row">${MODE_NAMES[mode]}</th>
      <td class="mono">${String(room.lux)}</td><td class="mono">${fixed(la, 2)}</td><td class="mono">${fixed(yb, 1)}</td>
      <td class="mono">${fixed(f, 1)}</td><td class="mono">${fixed(vc.c, 3)}</td><td class="mono">${fixed(vc.fl, 3)}</td>
      <td class="mono">${fixed(vc.fLRoot, 3)}</td><td class="mono">${fixed(vc.n, 3)}</td><td class="mono">${fixed(vc.z, 3)}</td></tr>`;
  }).join("");
}

/* >------------------------------------------< Page >------------------------------------------< */

/**
 * The technical page.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
export function technical(ctx: Context): string {
  const s = ctx.settings;
  const identityReach = s.hues === NAMES.length ? s.hueWindow.identity : Math.min(s.hueWindow.identity, 180 / s.hues);
  const anchor = anchorHue(s);
  const starts = hueKeys(s.hues).map((key, k) => {
    const placed = k === 0 ? undefined : s.placed[key];
    return `<tr><th scope="row">${ctx.label(key)}${k === 0 ? " (anchor)" : ""}</th><td class="mono">${fixed((anchor + (k * 360) / s.hues) % 360, 1)}°</td><td class="mono">${placed === undefined ? "—" : `${fixed(placed, 0)}°`}</td></tr>`;
  }).join("");
  const from = anchorSource(s);
  return `<section class="intro">
      <h1>The algorithm</h1>
      <p>Every step the solver takes, with its formulas, constants and search rules, in the order it runs. For the same thing in plain words, see <a href="#how">How it works</a>; the papers, standards and libraries named here are listed under <a href="#references">References</a>. Numbers use the current settings.</p>
    </section>

    <section class="step">
      <h2>0. Overview</h2>
<pre class="formula">for each gamut g in (standard, wide, ultra):                 // solved independently
  for each mode m in (light, dark):
    VC[m]   ← viewing conditions from room[m] and base[m]
    starts  ← the circle divided evenly from the anchor (${ctx.label(hueKeys(s.hues)[0]!).toLowerCase()}), or where a color is placed
    identity tier: T ← target ceiling; hues ← space(starts, ±${fixed(identityReach, 1)}°)   // the tier from step 3
    other tiers:   T ← target ceiling; hues ← space(identity hues, ±${String(s.hueWindow.tier)}°)
    per tier, per hue: default ← strongest(h, T + curve(h))
                       muted   ← strongest(h, M(default) × muted share)
    per tier, per extra: default ← strongest(its hue, T × its share), muted as above
variants for the H and M switches: the same solve without placed hues, without the curve, or both (step 9)</pre>
      <p>Every color is produced by one primitive: <code>strongest(h, M, Lc)</code>, the most colorful color of CAM16 hue h, up to colorfulness M, whose APCA contrast against the mode's base is exactly Lc.</p>
    </section>

    <section class="step">
      <h2>1. Viewing conditions</h2>
      <p>CAM16 (Li et al., 2017), as implemented by Google's material-color-utilities ${project.dependencies["@material/material-color-utilities"]}. Each mode gets its own <code>ViewingConditions.make(white, L<sub>A</sub>, Y<sub>b</sub>, surround)</code>:</p>
<pre class="formula">white  = D65
L_A    = E × 0.0586          // cd/m²: E lux on an 18% gray (L* 50): E/π × 0.184
Y_b    = luminance of the base // passed to CAM16 as its L*
F      = 0.8 + surround/10    // surround 0 dark, 1 dim, 2 average → F 0.8, 0.9, 1.0
c      = lerp(0.525…0.59…0.69 by F),  N_c = F
D      = F × (1 − (1/3.6)·e^((−L_A − 42)/92)),  clamped to 0…1
k      = 1/(5·L_A + 1)
F_L    = k⁴·L_A + 0.1·(1 − k⁴)²·∛(5·L_A)
n      = Y_b / Y_w,   z = 1.48 + √n,   N_bb = N_cb = 0.725 / n^0.2</pre>
      <div class="scroll"><table class="symbols"><thead><tr><th>Mode</th><th>Lux</th><th>L<sub>A</sub></th><th>Base L*</th><th>F</th><th>c</th><th>F<sub>L</sub></th><th>F<sub>L</sub><sup>¼</sup></th><th>n</th><th>z</th></tr></thead><tbody>${conditions(ctx)}</tbody></table></div>
    </section>

    <section class="step">
      <h2>2. From appearance to a color</h2>
      <p>The solver works in CAM16 lightness J, colorfulness M and hue h. Colorfulness depends on the room through F<sub>L</sub>; chroma doesn't:</p>
<pre class="formula">C = M / F_L^¼
(J, C, h) → CAM16 inverse in VC[m] → XYZ (D65, 0…100)
XYZ / 100 → the gamut's RGB space: standard sRGB · wide Display P3 · ultra Rec. 2020
in gamut?  every channel within [−0.0005, 1.0005]  (Color.js inGamut, ε = 0.0005)
              no  → off the screen: the search judges it by its contrast (step 3); a final color must be on it
              yes → standard: 8-bit hex;  wide/ultra: color(…) rounded to 4 decimals</pre>
      <p>Every reported number is measured again on the rounded color, so what's shown is what's shipped.</p>
    </section>

    <section class="step">
      <h2>3. Contrast: exactly on a tier</h2>
      <p>APCA 0.0.98G (Color.js ${project.dependencies["colorjs.io"]}), always text = the color, background = the base, reported as |Lc|. Luminance is <code>Y = 0.2126729·R<sup>2.4</sup> + 0.7151522·G<sup>2.4</sup> + 0.0721750·B<sup>2.4</sup></code> on sRGB-encoded values; wide-gamut colors use their extended sRGB coordinates.</p>
<pre class="formula">place(h, M, Lc):                       // lightness search at fixed h and M
  lo, hi ← 0, 100
  repeat 32 times:                     // 100 / 2³² ≈ 2·10⁻⁸ in J, far finer than any output shows
    J   ← (lo + hi)/2
    x   ← color(J, M, h)
    ok  ← APCA(x, base) ≥ Lc        // x as written; off the screen, by its coordinates past the edge
    light base: ok → lo ← J  else hi ← J   // keep the lightest that passes
    dark base:  ok → hi ← J  else lo ← J   // keep the darkest that passes
  x ← color(light ? lo : hi, M, h)
  return x if APCA(x, base) ≥ Lc after rounding, else none</pre>
      <p>So each color sits on its tier from above: never below Lc, and above it only by what rounding to the output format forces, typically a few tenths of an Lc. A lightness the screen can't show still has a contrast, so the search knows which way to go from it: a color can leave the screen on either side of its tier. A base is dark when its L* is under 50.</p>
      <p><strong>Identity tier.</strong> Unless one is set by hand, each mode's identity tier is the tier where APCA and WCAG 2 together are just at their minimum for text. It's measured on a grey, so it's known before any color is solved:</p>
<pre class="formula">g(Lc)     = the 8-bit grey nearest the base with APCA(g, base) ≥ Lc
score(Lc) = (APCA(g, base) / ${String(TEXT_MINIMUM.apca)} + WCAG(g, base) / ${String(TEXT_MINIMUM.wcag)}) / 2     // 1: both just at their minimum for text
identity  = the tier with score nearest 1, the lower on a tie
${MODES.map((m) => `${m.padEnd(10)}${s.tiers.map((t) => `Lc ${String(t)} ${textScore(s.bases[m], t).toFixed(2)}`).join(" · ")}   → Lc ${String(autoIdentity(s.bases[m], s.tiers))}${s.identityTier[m] === "auto" ? "" : `, set by hand to Lc ${String(identityOf(s, m))}`}`).join("\n")}</pre>
<pre class="formula">strongest(h, M_target, Lc):            // colorfulness search
  if place(h, M_target, Lc) exists → return it
  lo, hi ← 0, M_target
  repeat 18 times:                     // M_target / 2¹⁸
    mid ← (lo + hi)/2
    place(h, mid, Lc) exists → lo ← mid  else hi ← mid
  return place(h, lo, Lc)              // the most colorful that fits</pre>
    </section>

    <section class="step">
      <h2>4. Equally colorful: the tier ceiling</h2>
<pre class="formula">reach(h, Lc)  = M of strongest(h, 200, Lc)               // how far the gamut lets h go
T(Lc)         = min(M_target, min over hues of reach(h, Lc))   // with equal per tier on; before the curve
limit(Lc)     = the hue with the smallest reach, if it's below M_target
target(h, Lc) = T(Lc) + curve(h)</pre>
      <p>With equal per tier off, T = M<sub>target</sub> and each hue simply goes as far as it can. The ceiling is measured before the curve: a hue the curve asks more of than it can reach on a tier stops at its reach (Gamut limit) rather than the whole tier dropping to make room for it. Each swatch is labeled from these numbers:</p>
<pre class="formula">Gamut limit    measured M &lt; target − 1                       // the screen holds it below its own aim
Sets the tier  the color is limit(Lc)                          // the tier was lowered to its reach
Lowered        limit(Lc) is another color, and not Gamut limit
own aim        hue: M_target + curve(h)      extra: M_target × share</pre>
    </section>

    <section class="step">
      <h2>5. The curve</h2>
      <p>A sum of raised-cosine bumps over hue. Point i has amount a<sub>i</sub> (M, may be negative), center c<sub>i</sub> and half-width w<sub>i</sub>; points switched off contribute nothing:</p>
<pre class="formula">d_i(h)   = circular distance between h and c_i            // 0…180°
curve(h) = Σ_i  [ d_i(h) &lt; w_i ]  ·  a_i · (1 + cos(π · d_i(h) / w_i)) / 2</pre>
      <p>Each bump is smooth (continuous first derivative) and exactly zero beyond its width, so a point only moves the hues it reaches.</p>
    </section>

    <section class="step">
      <h2>6. Names and starting hues</h2>
      <p>CAM16's unique hues and their eccentricity weights (the hue-quadrature table): R 20.14° (e 0.8), Y 90° (0.7), G 164.25° (1.0), B 237.53° (1.2), and R again at 380.14° (0.8). Between two unique hues, a hue's share of the next one is:</p>
<pre class="formula">p(h) = ((h − h_i)/e_i) / ((h − h_i)/e_i + (h_(i+1) − h)/e_(i+1))</pre>
      <p>A name like "R 33 B" (red with 33% blue: a third of the way from R to B, in steps of p) is turned back into an angle by bisecting p(h) on that segment. The same formula names every swatch ("Y 11 G").</p>
      <p>The other reference systems (Munsell, NCS, unique hues, focal colors) give measured colors instead of names: each one's D65 XYZ (Munsell and WCS chips adapted from illuminant C by Bradford, NCS from its sRGB approximations) is taken into CAM16 in each mode's viewing conditions, and its hue is the circular mean of the light and dark hues. They're drawn as guides, and each one's yellow can be the anchor.</p>
<pre class="formula">start_k = anchor + k · 360° / n     // k = 0 … n − 1, yellow first with eight hues
start_k = placed_k                  // a color placed by hand starts there instead</pre>
      <p>The anchor is ${fixed(anchor, 1)}° (${from}). It's needed because the spacing (step 7) only evens out differences between neighbors, and turning the whole lineup around the circle leaves those almost unchanged; the anchor fixes where it sits. The anchor and placed colors don't move while the others are spaced. With nothing placed, the result is the uniform lineup.</p>
      <div class="scroll"><table class="roles"><thead><tr><th>Color</th><th>Even start</th><th>Placed at</th></tr></thead><tbody>${starts}</tbody></table></div>
    </section>

    <section class="step">
      <h2>7. Evenly different: spacing</h2>
      <p>Difference is CAM16-UCS (Luo, Cui &amp; Li 2006, as in material-color-utilities):</p>
<pre class="formula">J*  = 1.7·J / (1 + 0.007·J)
M*  = ln(1 + 0.0228·M) / 0.0228
a*, b* = M*·cos h, M*·sin h
ΔE′ = √(ΔJ*² + Δa*² + Δb*²)
ΔE  = 1.41 · ΔE′^0.63                      // the distance shown on the site</pre>
<pre class="formula">space(start, window):                       // coordinate descent
  colors ← strongest(start_i, target(start_i)) for each hue
  score  ← standard deviation of ΔE(color_i, color_(i+1)) around the circle
  repeat up to 8 passes, stop early if a pass changes nothing:
    for each hue i except the anchor and placed colors:
      for step in (−3°, +3°, −1°, +1°):
        h ← hue_i + step;  skip if |h − start_i| &gt; window
        try color_i ← strongest(h, target(h));  rescore
        keep it if the score drops by more than 10⁻⁴</pre>
      <p>The identity tier (light Lc ${String(identityOf(s, "light"))}, dark Lc ${String(identityOf(s, "dark"))}) is spaced first from the starting hues with a window of ±${String(s.hueWindow.identity)}°${s.hues === NAMES.length ? "" : `, or halfway to the even neighbor (180° / ${String(s.hues)}) if that's less: ±${fixed(identityReach, 1)}° here`}. Every other tier starts from the identity tier's hues with ±${String(s.hueWindow.tier)}°, so each tier is even in its own right while hues stay recognizably the same across tiers. Both modes use the same starting hues, so light and dark land within about a degree of each other; a placed color sits exactly where it was placed in both.</p>
      <p><strong>Order.</strong> Colors keep their order around the circle: a placed color is held between the colors beside it, at least ${String(CLOSEST * 100)}% of the even step from each (${fixed((360 / s.hues) * CLOSEST, 2)}° here), and a spacing step that would bring a color closer than that to a neighbor isn't taken. Dragging the anchor stops before any color it carries would pass a placed one.</p>
      <p><strong>Turn and bend.</strong> Turning every hue by the same angle keeps the lineup uniform, so placed hues are compared with the uniform lineup turned to match them best. In CAM16-UCS a turn is a rotation of a* and b*, so every angle from −30° to 30° in tenths is tried on the uniform colors, keeping the one with the smallest root-mean-square ΔE to the palette with placed hues; the turned lineup is then solved with the anchor moved by that angle. Bend is each color's ΔE from its turned version, divided by the even gap, as a root mean square over the colors.</p>
<pre class="formula">gap      = mean ΔE between neighbors in the uniform lineup, on the identity tier
bend     = √(mean over colors of (ΔE(color, turned color) / gap)²)
zone     = Uniform &lt; 0.1 · Tuned &lt; 0.25 · Reshaped &lt; 0.5 · Departed &lt; 1 · Different palette
even     = max over neighbors of |ΔE(neighbors) / gap − 1|     // the strip's Even: the furthest from even, either way
closer   = 1 − (smallest neighbor ΔE) / gap                     // how much the tightest pair lost
evenness = fine &lt; 10% · worth watching &lt; 25% · getting confusable  // of even and of closer</pre>
      <p>A change between two colors is split into lightness, colorfulness and hue, each as its share of the three added together:</p>
<pre class="formula">lightness    = ΔJ*²
colorfulness = ΔM*²
hue          = (2 · √(M*₁ · M*₂) · sin(Δh / 2))²      // the chord the turn makes around the circle</pre>
    </section>

    <section class="step">
      <h2>8. Muted and extra colors</h2>
<pre class="formula">muted(h, Lc) = strongest(h, M(default at h, Lc) × ${String(s.muted)}, Lc)     // same hue, same tier
extra(e, Lc) = strongest(hue(e), T(Lc) × share(e), Lc)               // not spaced${s.extras.map((e) => `\n${escape(`  ${e.name}`.padEnd(13))}= strongest(${e.hue.toFixed(1)}°, T(Lc) × ${String(e.share)}, Lc)`).join("")}</pre>
    </section>

    <section class="step">
      <h2>9. Variants for the H and M switches</h2>
      <p>The H and M switches in the header, and the rows of the strip in Settings, show the palette without some of its edits. Each variant is a full solve of changed settings, in a second worker so the palette on screen never waits for it:</p>
<pre class="formula">H on,  M on    the palette as set
H on,  M off   without the curve                          // "+H" row
H off, M on    with nothing placed
H off, M off   without the curve, with nothing placed     // "Uniform" row
turned         Uniform, solved with the anchor moved by the turn (step 7)   // "Turned" row</pre>
      <p>Settings, its export and the blind tests always use the palette as set.</p>
    </section>

    <section class="step">
      <h2>10. Three gamuts</h2>
      <p>Steps 2 to 9 run once per gamut, with only the gamut check (step 2) changing: sRGB, Display P3, Rec. 2020. Nothing is mapped from one gamut to another; each gamut's ceilings, hues and colors come from its own solve. On the web, a page serves the widest gamut the screen reports through <code>@media (color-gamut: …)</code>.</p>
    </section>

    <section class="step">
      <h2>11. What's reported per swatch</h2>
<pre class="formula">CAM16 J, C, M, h        in the mode's viewing conditions
name                    hue composition, step 6
labels                  Gamut limit, Sets the tier, Lowered, step 4
APCA Lc                 step 3
WCAG 2 ratio            (L1 + 0.05)/(L2 + 0.05), relative luminance, Color.js
WCAG level              ≥ 7 AAA · ≥ 4.5 AA · ≥ 3 AA large · else below</pre>
      <p>The cost is dominated by <code>strongest</code>: each call is up to about 20 lightness searches of 32 steps each. A full solve of one gamut (two modes, ${String(s.tiers.length)} tiers, ${String(s.hues + s.extras.length)} colors, default and muted, plus spacing) takes well under a second in a browser worker; the header shows how long the one on screen took.</p>
    </section>

    <section class="step">
      <h2>12. The blind colorfulness test</h2>
      <p><strong>Pairs.</strong> Per hue, a staircase on Δ, the test color's offset from the palette (start ±8, half of the hues above and half below, in random order; bounded to ±16). Each pair shows the test hue at T + Δ against a different, randomly chosen hue at T, on the identity tier, sides random, a 300 ms blank between pairs. Picked as more colorful → Δ −= step; not picked → Δ += step; "can't tell" → no move. The step is 4, then 2 after two reversals, then 1 after four.</p>
      <p><strong>Checks and stopping.</strong> Every third pair for a hue is a check at Δ ± 12, to a random side, which doesn't move the staircase: a real observer answers it easily, a guess doesn't. A hue is done at 16 answers, or sooner once it settles: at least 8 answers, a sure result whose range is within ±5 either way, and log L(μ̂) − log L₀ ≥ 4, stricter than the final 1.92 since it's checked after every answer. Progress is the mean over hues of 1 when done, else answers/16. In simulation a consistent observer takes about 10 to 13 answers per hue, while answering at random still ends sure for about one hue in twelve, so one run is a rough answer and several pooled are steadier.</p>
      <p><strong>Equal point.</strong> Each answer is (x, y) with x = measured M<sub>test</sub> − M<sub>other</sub> and y ∈ {1, ½, 0}. Fitted by maximum likelihood to</p>
<pre class="formula">P(test picked | x) = 1 / (1 + e^(−(x − μ)/s))
μ ∈ [−24, 24] step 0.5,   s ∈ {1.5, 2.5, 4, 6, 10, 20, 40}
log L(μ) = max over s of Σ y·ln P + (1 − y)·ln(1 − P),   P clamped to [0.01, 0.99]
μ̂ = argmax log L;   range = { μ : log L(μ) ≥ log L(μ̂) − 1.92 }   // ≈ 95%
log L₀ = Σ y·ln ȳ + (1 − y)·ln(1 − ȳ)   // a flat guess at the answers' average
unsure if the range reaches ±24, or log L(μ̂) − log L₀ &lt; 1.92</pre>
      <p><strong>Curve fit.</strong> Hues with a sure result, weighted w = 1/max(1, (range width/3.92)²). Points are added greedily, at most three: each is the single bump (center step 5°, width 30–180° step 10°, amount −24…24) that minimizes Σ w·(curve(h) − μ̂)² on what's left, kept only if it lowers that error by at least 6, so a point has to explain clearly more than noise would.</p>
    </section>

    <section class="step">
      <h2>13. The blind hue test</h2>
      <p><strong>Colors.</strong> Per color, a staircase on Δ, degrees from the palette's hue (start ±10, half of the colors toward one neighbor and half toward the other, in random order; bounded to ±30). Each trial shows one color alone at h + Δ on the identity tier, at T + curve(h + Δ), with no name, and asks whether it leans toward the neighbor before it or after it around the circle (named, sides random), or neither; a 300 ms blank between trials. The test runs only with the eight named colors, since it asks about each one's neighbors by name. Leans after → Δ −= step; leans before → Δ += step; neither → no move. Steps, checks (Δ ± 12°) and stopping as in step 12, with the range within ±5°.</p>
      <p><strong>Middle of the name.</strong> Each answer is (x, y) with x = the hue shown and y = 1 for after, ½ for neither, 0 for before; runs are pooled per color with hues unwrapped next to each other. The same fit as step 12, over μ within ±40° of the answers' mean hue, gives the hue where the color leans neither way, its range, and whether it's sure. Sure colors can be placed there; yellow's sets the anchor.</p>
    </section>`;
}
