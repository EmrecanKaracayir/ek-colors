/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< TECHNICAL >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The algorithm, technically: every step the solver takes, with its formulas, constants and search |
| rules, in the order it runs. The plain-words version is How it works; this page is the           |
| reference.                                                                                       |
\*------------------------------------------------------------------------------------------------*/

import { argbFromHex, lstarFromArgb, ViewingConditions } from "@material/material-color-utilities";

import { hueOf } from "../palette/model";
import { MODES, NAMES, STARTS } from "../palette/settings";
import type { Context } from "./explain";

/* >-----------------------------------------< Values >-----------------------------------------< */

/** Lux to the luminance the eye adapts to: E / π × 0.184, a 20% gray (L* 50) lit by E lux. */
const LUX_TO_ADAPTING = 0.0586;

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
    const vc = ViewingConditions.make(undefined, la, yb, room.surround);
    const f = 0.8 + room.surround / 10;
    return `<tr><th scope="row">${mode === "light" ? "Light" : "Dark"}</th>
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
  const starts = NAMES.map(
    (n) =>
      `<tr><th scope="row">${ctx.label(n)}${n === "yellow" ? " (anchor)" : ""}</th><td class="mono">${STARTS[n]!}</td><td class="mono">${fixed(hueOf(STARTS[n]!), 2)}°</td><td class="mono">${s.homes[n] === undefined ? "—" : `${fixed(s.homes[n], 0)}°`}</td></tr>`,
  ).join("");
  return `<section class="intro">
      <h1>The algorithm</h1>
      <p>Every step the solver takes, with its formulas, constants and search rules, in the order it runs. For the same thing in plain words, see <a href="#how">How it works</a>. Numbers in tables use your current settings.</p>
    </section>

    <section class="step">
      <h2>0. Overview</h2>
<pre class="formula">for each gamut tier g in (standard, wide, ultra):            // solved independently
  for each mode m in (light, dark):
    VC[m]   ← viewing conditions from room[m] and base[m]
    homes   ← each color's home (its name → CAM16 hue, or one you set); yellow is the anchor
    identity tier: T ← target ceiling; hues ← pull(space(homes, ±20°), homes)
    other tiers:   T ← target ceiling; hues ← pull(space(identity hues, ±6°), homes)
    per tier, per hue: default ← strongest(h, T + curve(h))
                       muted   ← strongest(h, M(default) × muted share)
    brown per tier:    strongest(hue of "R 25 Y", T × brown share)</pre>
      <p>Every color is produced by one primitive: <code>strongest(h, M, Lc)</code>, the most colorful color of CAM16 hue h, up to colorfulness M, whose APCA contrast against the mode's base is exactly Lc.</p>
    </section>

    <section class="step">
      <h2>1. Viewing conditions</h2>
      <p>CAM16 (Li et al., 2017), as implemented by Google's material-color-utilities 0.4.0. Each mode gets its own <code>ViewingConditions.make(white, L<sub>A</sub>, Y<sub>b</sub>, surround)</code>:</p>
<pre class="formula">white  = D65
L_A    = E × 0.0586          // cd/m²: E lux on a 20% gray (L* 50): E/π × 0.184
Y_b    = luminance of the base // passed to CAM16 as its L*
F      = 0.8 + surround/10    // surround 0 dark, 1 dim, 2 average → F 0.8, 0.9, 1.0
c      = lerp(0.525…0.59…0.69 by F),  N_c = F
D      = F × (1 − (1/3.6)·e^((−L_A − 42)/92)),  clamped to 0…1
k      = 1/(5·L_A + 1)
F_L    = k⁴·L_A + 0.1·(1 − k⁴)²·∛(5·L_A)
n      = Y_b / Y_w,   z = 1.48 + √n,   N_bb = N_cb = 0.725 / n^0.2</pre>
      <div class="scroll"><table><thead><tr><th>Mode</th><th>Lux</th><th>L<sub>A</sub></th><th>Base L*</th><th>F</th><th>c</th><th>F<sub>L</sub></th><th>F<sub>L</sub><sup>¼</sup></th><th>n</th><th>z</th></tr></thead><tbody>${conditions(ctx)}</tbody></table></div>
    </section>

    <section class="step">
      <h2>2. From appearance to a color</h2>
      <p>The solver works in CAM16 lightness J, colorfulness M and hue h. Colorfulness depends on the room through F<sub>L</sub>; chroma doesn't:</p>
<pre class="formula">C = M / F_L^¼
(J, C, h) → CAM16 inverse in VC[m] → XYZ (D65, 0…100)
XYZ / 100 → the tier's RGB space:  standard sRGB · wide Display P3 · ultra Rec. 2020
in gamut?  every channel within [−0.0005, 1.0005]  (Color.js inGamut, ε = 0.0005)
              no  → no color (counts as "too far" in the searches below)
              yes → standard: 8-bit hex;  wide/ultra: color(…) rounded to 4 decimals</pre>
      <p>Every reported number is measured again on the rounded color, so what's shown is what's shipped.</p>
    </section>

    <section class="step">
      <h2>3. Contrast: exactly on a tier</h2>
      <p>APCA 0.0.98G (Color.js 0.7.1), always text = the color, background = the base, reported as |Lc|. Luminance is <code>Y = 0.2126729·R<sup>2.4</sup> + 0.7151522·G<sup>2.4</sup> + 0.0721750·B<sup>2.4</sup></code> on sRGB-encoded values; wide-gamut colors use their extended sRGB coordinates.</p>
<pre class="formula">place(h, M, Lc):                       // lightness search at fixed h and M
  lo, hi ← 0, 100
  repeat 34 times:                     // 100 / 2³⁴ ≈ 6·10⁻⁹ in J
    J   ← (lo + hi)/2
    x   ← color(J, M, h)
    ok  ← x exists and APCA(x, base) ≥ Lc
    light mode: ok or x missing → lo ← J  else hi ← J   // keep the lightest that passes
    dark mode:  ok or x missing → hi ← J  else lo ← J   // keep the darkest that passes
  x ← color(light ? lo : hi, M, h)
  return x if APCA(x, base) ≥ Lc after rounding, else none</pre>
      <p>So each color sits on its tier from above: never below Lc, and above it only by what rounding to the output format forces, typically a few tenths of an Lc.</p>
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
T(Lc)         = min(M_target, min over hues of reach(h, Lc))   // with equal per tier on
limit(Lc)     = the hue with the smallest reach, if it's below M_target
target(h, Lc) = T(Lc) + curve(h)</pre>
      <p>With equal per tier off, T = M<sub>target</sub> and each hue simply goes as far as it can. A swatch is flagged as held back when its measured M &lt; target − 1.</p>
    </section>

    <section class="step">
      <h2>5. The curve</h2>
      <p>A sum of raised-cosine bumps over hue. Point i has amount a<sub>i</sub> (M, may be negative), center c<sub>i</sub> and half-width w<sub>i</sub>; points switched off contribute nothing:</p>
<pre class="formula">d_i(h)   = circular distance between h and c_i            // 0…180°
curve(h) = Σ_i  [ d_i(h) &lt; w_i ]  ·  a_i · (1 + cos(π · d_i(h) / w_i)) / 2</pre>
      <p>Each bump is smooth (continuous first derivative) and exactly zero beyond its width, so a point only moves the hues it reaches.</p>
    </section>

    <section class="step">
      <h2>6. Homes: names to angles</h2>
      <p>CAM16's unique hues and their eccentricity weights (the hue-quadrature table): R 20.14° (e 0.8), Y 90° (0.7), G 164.25° (1.0), B 237.53° (1.2), and R again at 380.14° (0.8). Between two unique hues, a hue's share of the next one is:</p>
<pre class="formula">p(h) = ((h − h_i)/e_i) / ((h − h_i)/e_i + (h_(i+1) − h)/e_(i+1))</pre>
      <p>A name like "R 33 B" (33% toward the other hue, from B's side) is turned back into an angle by bisecting p(h) on that segment. The same formula names every swatch ("Y 11 G").</p>
      <p>Under another reference system (Munsell, NCS, unique hues, focal colors), a home is a measured color instead of a name: its D65 XYZ (Munsell and WCS chips adapted from illuminant C by Bradford, NCS from its sRGB approximations) is taken into CAM16 in each mode's viewing conditions, and the home is the circular mean of the light and dark hues. A color the system doesn't define keeps its CAM16 home. Under <em>Nearest</em>, every system's home is a candidate and the pull (step 7) goes toward the one closest to the spaced hue.</p>
      <div class="scroll"><table class="roles"><thead><tr><th>Color</th><th>Name</th><th>Home by name</th><th>Your home</th></tr></thead><tbody>${starts}</tbody></table></div>
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
    for each hue i except the anchor (yellow):
      for step in (−3°, +3°, −1°, +1°):
        h ← hue_i + step;  skip if |h − start_i| &gt; window
        try color_i ← strongest(h, target(h));  rescore
        keep it if the score drops by more than 10⁻⁴</pre>
<pre class="formula">pull(colors, homes, most = ${String(s.pull)}):            // after spacing, per tier
  for each color i except the anchor:
    Δh ← signed hue distance from its spaced hue to its home
    find the largest t in [0, 1] (12 bisection steps) with
      ΔE(strongest(h_i + t·Δh, target), spaced color_i) ≤ most
    color_i ← that color</pre>
      <p>So every color stays within <code>most</code> (CAM16-UCS ΔE) of perfectly even spacing, and uses that room to sit as close to its home as it can. With the default of 2, about the smallest difference people see side by side, the departure from even spacing is meant to stay below notice.</p>
      <p>The identity tier (light Lc ${String(s.identityTier.light)}, dark Lc ${String(s.identityTier.dark)}) is spaced first from the starting hues with a window of ±${String(s.hueWindow.identity)}°. Every other tier starts from the identity tier's hues with ±${String(s.hueWindow.tier)}°, so each tier is even in its own right while hues stay recognizably the same across tiers. Both modes use the same starting hues, so light and dark land within about a degree of each other.</p>
    </section>

    <section class="step">
      <h2>8. Muted and brown</h2>
<pre class="formula">muted(h, Lc) = strongest(h, M(default at h, Lc) × ${String(s.muted)}, Lc)     // same hue, same tier
brown(Lc)    = strongest(hue of "${STARTS.brown!}", T(Lc) × ${String(s.brown ?? 0)}, Lc)   // not spaced, no muted</pre>
    </section>

    <section class="step">
      <h2>9. Three gamut tiers</h2>
      <p>Steps 2 to 8 run once per tier, with only the gamut check (step 2) changing: sRGB, Display P3, Rec. 2020. Nothing is mapped from one tier to another; each tier's ceilings, hues and colors come from its own solve. On the web, a page serves the widest tier the screen reports through <code>@media (color-gamut: …)</code>.</p>
    </section>

    <section class="step">
      <h2>10. What's reported per swatch</h2>
<pre class="formula">CAM16 J, C, M, h        in the mode's viewing conditions
name                    hue composition, step 6
APCA Lc                 step 3
WCAG 2 ratio            (L1 + 0.05)/(L2 + 0.05), relative luminance, Color.js
WCAG level              ≥ 7 AAA · ≥ 4.5 AA · ≥ 3 AA large · else below</pre>
      <p>The cost is dominated by <code>strongest</code>: each call is up to about 20 lightness searches of 34 steps each. A full solve of one gamut tier (two modes, six tiers, nine colors, default and muted, plus spacing) takes about a second in a browser worker.</p>
    </section>

    <section class="step">
      <h2>11. The blind curve test</h2>
      <p><strong>Pairs.</strong> Per hue, a staircase on Δ, the test color's offset from the palette (start ±8, alternating; bounded to ±16). Each pair shows the test hue at T + Δ against a different, randomly chosen hue at T, on the identity tier, sides random, a 300 ms blank between pairs, 12 pairs per hue. Picked as more colorful → Δ −= step; not picked → Δ += step; "can't tell" → no move. The step is 4, then 2 after two reversals, then 1 after four.</p>
      <p><strong>Equal point.</strong> Each answer is (x, y) with x = measured M<sub>test</sub> − M<sub>other</sub> and y ∈ {1, ½, 0}. Fitted by maximum likelihood to</p>
<pre class="formula">P(test picked | x) = 1 / (1 + e^(−(x − μ)/s))
μ ∈ [−24, 24] step 0.5,   s ∈ {1.5, 2.5, 4, 6, 10, 20, 40}
log L(μ) = max over s of Σ y·ln P + (1 − y)·ln(1 − P),   P clamped to [0.01, 0.99]
μ̂ = argmax log L;   range = { μ : log L(μ) ≥ log L(μ̂) − 1.92 }   // ≈ 95%
unsure if the range reaches ±24</pre>
      <p><strong>Curve fit.</strong> Hues with a sure result, weighted w = 1/max(1, (range width/3.92)²). Points are added greedily, at most three: each is the single bump (center step 5°, width 30–180° step 10°, amount −20…20) that minimizes Σ w·(curve(h) − μ̂)² on what's left, kept only if it lowers that error by at least 6, so a point has to explain clearly more than noise would.</p>
    </section>`;
}
