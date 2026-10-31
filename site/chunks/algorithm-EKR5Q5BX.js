import{p as O,q as C}from"./chunk-PCPC6HX2.js";import{a as ne,b as ie,c as he,d as i,e as le,f as ce,g as S}from"./chunk-24WD5XDO.js";import{a as U,b as de,c as ue,d as pe,e as ge,f as me}from"./chunk-5QZZ5YZ2.js";import{A as R,h as b,i as v,j as K,k as E,l as X,p as u,q as k,v as T,w as Z,x as Q,y as p,z as ee}from"./chunk-LCWEN4B2.js";import{a as x}from"./chunk-IY5KID7H.js";import{a as N,b as re,c as ae,d as g,e as n}from"./chunk-VUL3N5CK.js";import{g as _,h as te,i as se,n as oe,s as F}from"./chunk-QZOXVQEK.js";import{B as Y,E as q,H as r,J as A,P as z,Q as W,e as L,f as B,i as f,j as D,k as j,n as J,q as V,z as w}from"./chunk-Z2CNTJJB.js";var t=(o,e=3)=>o.toFixed(e),G=o=>String(o).replace(/\d/g,e=>"\u2070\xB9\xB2\xB3\u2074\u2075\u2076\u2077\u2078\u2079"[Number(e)]).replace("-","\u207B"),fe=o=>{let[e,h]=o.toExponential(0).split("e");return`${e==="1"?"":`${e}\xB7`}10${G(Number(h))}`},I=o=>`${String(Math.round(o*100))}%`;function Se(o){return w.map(e=>{let h=o.settings.rooms[e],y=h.lux*D,l=J(o.settings.bases[e]),c=j(o.settings,e),$=.8+h.surround/10;return`<tr><th scope="row">${Y[e]}</th>
      <td class="mono">${String(h.lux)}</td><td class="mono">${t(y,2)}</td><td class="mono">${t(l,1)}</td>
      <td class="mono">${t($,1)}</td><td class="mono">${t(c.c,3)}</td><td class="mono">${t(c.fl,3)}</td>
      <td class="mono">${t(c.fLRoot,3)}</td><td class="mono">${t(c.n,3)}</td><td class="mono">${t(c.z,3)}</td></tr>`}).join("")}function _e(o){let e=o.settings,h=e.hues===A.length?e.hueReach.identity:Math.min(e.hueReach.identity,180/e.hues),y=z(e),l=o.palette,c=s=>l?.[s].colors.filter(a=>a.kind==="hue")??[],$=l?Math.max(0,...c("light").map((s,a)=>{let d=c("dark")[a],[m,H]=[s.tiers[p(e,"light")]?.default.hue,d?.tiers[p(e,"dark")]?.default.hue];return m===void 0||H===void 0?0:Math.abs(V(m,H))})):null,P=l?Math.max(0,...w.flatMap(s=>l[s].colors.flatMap(a=>e.tiers.flatMap(d=>[a.tiers[d]?.default,a.tiers[d]?.muted].map(m=>m?Math.abs(m.apca)-d:0))))):null,M=l?w.flatMap(s=>e.tiers.map(a=>l[s].grays[a]?.colorfulness??0)):[],we=R(e.hues).map((s,a)=>{let d=a===0?void 0:e.placed[s];return`<tr><th scope="row">${o.label(s)}${a===0?" (anchor)":""}</th><td class="mono">${t((y+a*360/e.hues)%360,1)}\xB0</td><td class="mono">${d===void 0?"\u2014":`${t(d,0)}\xB0`}</td></tr>`}).join(""),be=W(e);return`<section class="intro">
      <h1>The algorithm</h1>
      <p>Every step the solver takes, with its formulas, constants and search rules, in the order it runs. For the same thing in plain words, see <a href="#how">How it works</a>; the papers, standards and libraries named here are listed under <a href="#references">References</a>. Numbers use the current settings.</p>
    </section>

    <section class="step">
      <h2>0. Overview</h2>
<pre class="formula">for each gamut g in (standard, wide, ultra):                 // solved independently
  for each mode m in (light, dark):
    VC[m]   \u2190 viewing conditions from room[m] and base[m]
    starts  \u2190 the circle divided evenly from the anchor (${o.label(R(e.hues)[0]).toLowerCase()}), or where a color is placed
    identity tier: T \u2190 target ceiling; hues \u2190 space(starts, \xB1${t(h,1)}\xB0)   // the tier from step 3
    other tiers:   T \u2190 target ceiling; hues \u2190 space(identity hues, \xB1${String(e.hueReach.tier)}\xB0)
    per tier, per hue: default \u2190 strongest(h, T + curve(h))
                       muted   \u2190 strongest(h, M(default) \xD7 muted share)
    per tier, per custom color: default \u2190 strongest(its hue, T \xD7 its share), muted as above
    per tier: gray \u2190 the 8-bit gray on Lc; per neutral color: strongest(hue(base), M(base) \xD7 its share)
baselines for the H and M switches: the same solve without placed hues, without the curve, or both (step 9)
the hues are kept, so custom colors, neutral colors and the muted share are placed on them anew (step 11)</pre>
      <p>Every color is produced by one primitive: <code>strongest(h, M, Lc)</code>, the most colorful color of CAM16 hue h, up to colorfulness M, whose APCA contrast against the mode's base is exactly Lc.</p>
      <p>Settings from the site, from a paste or from storage are checked first, and older ones brought up to date; the config the command line solves isn't checked:</p>
<pre class="formula">hues ${t(r.hues[0],0)}\u2013${t(r.hues[1],0)} \u2022 M_target ${t(r.colorfulness[0],0)}\u2013${t(r.colorfulness[1],0)} \u2022 muted share ${I(r.mutedShare[0])}\u2013${I(r.mutedShare[1])} \u2022 lux ${t(r.lux[0],0)}\u2013${t(r.lux[1],0)}
curve amount \u2212${t(-r.amount[0],0)}\u2026+${t(r.amount[1],0)} M, width ${t(r.width[0],0)}\u2013${t(r.width[1],0)}\xB0 \u2022 share ${I(r.share[0])} or more, for custom and neutral colors \u2022 hue reach ${t(r.hueReach[0],0)}\u2013${t(r.hueReach[1],0)}\xB0
tiers        at least one, each one of Lc ${Object.keys(q).join(", ")}
identity     set by hand to a tier that isn't solved \u2192 automatic
bases        any CSS color; one set for a gamut must fit it; L*(light base) > L*(dark base) on every gamut
name         at most 60 characters
placed hues  kept only for keys of the current number of hues
neutrals     none while both bases are under M ${String(u[0])}: nothing to follow
older shapes upgraded: one identity tier for both modes \u2192 one per mode; Lc 60 light with Lc 45 dark \u2192 automatic</pre>
    </section>

    <section class="step">
      <h2>1. Viewing conditions</h2>
      <p>CAM16 (Li et al., 2017), as implemented by Google's material-color-utilities ${x.dependencies["@material/material-color-utilities"]}. Each mode gets its own <code>ViewingConditions.make(white, L<sub>A</sub>, Y<sub>b</sub>, surround)</code>:</p>
<pre class="formula">white  = D65
L_A    = E \xD7 0.0586          // cd/m\xB2: E lux on an 18% gray (L* 50): E/\u03C0 \xD7 0.184
Y_b    = the base's L*        // its lightness, as CAM16 takes the background
F      = 0.8 + surround/10    // surround 0 dark, 1 dim, 2 average \u2192 F 0.8, 0.9, 1.0
c      = lerp(0.525\u20260.59\u20260.69 by F),  N_c = F
D      = F \xD7 (1 \u2212 (1/3.6)\xB7e^((\u2212L_A \u2212 42)/92)),  clamped to 0\u20261
k      = 1/(5\xB7L_A + 1)
F_L    = k\u2074\xB7L_A + 0.1\xB7(1 \u2212 k\u2074)\xB2\xB7\u221B(5\xB7L_A)
n      = Y_b / Y_w,   z = 1.48 + \u221An,   N_bb = N_cb = 0.725 / n^0.2</pre>
      <div class="scroll"><table class="symbols"><thead><tr><th>Mode</th><th>Lux</th><th>L<sub>A</sub></th><th>Base L*</th><th>F</th><th>c</th><th>F<sub>L</sub></th><th>F<sub>L</sub><sup>\xBC</sup></th><th>n</th><th>z</th></tr></thead><tbody>${Se(o)}</tbody></table></div>
    </section>

    <section class="step">
      <h2>2. From appearance to a color</h2>
      <p>The solver works in CAM16 lightness J, colorfulness M and hue h. Colorfulness depends on the room through F<sub>L</sub>; chroma doesn't:</p>
<pre class="formula">C = M / F_L^\xBC
(J, C, h) \u2192 CAM16 inverse in VC[m] \u2192 XYZ (D65, 0\u2026100)
XYZ / 100 \u2192 the gamut's RGB space: standard sRGB \u2022 wide Display P3 \u2022 ultra Rec. 2020
in gamut?  every channel within [\u2212${String(L)}, ${String(1+L)}]  (Color.js inGamut, \u03B5 = ${String(L)})
              no  \u2192 off the screen: the search judges it by its contrast (step 3); a final color must be on it
              yes \u2192 standard: 8-bit hex;  wide/ultra: color(\u2026) rounded to ${String(B)} decimals</pre>
      <p>Every reported number is measured again on the rounded color, so what's shown is what's shipped.</p>
    </section>

    <section class="step">
      <h2>3. Contrast: exactly on a tier</h2>
      <p>APCA 0.0.98G (Color.js ${x.dependencies["colorjs.io"]}), always text = the color, background = the base, reported as |Lc|. Luminance is <code>Y = 0.2126729\xB7R<sup>2.4</sup> + 0.7151522\xB7G<sup>2.4</sup> + 0.0721750\xB7B<sup>2.4</sup></code> on sRGB-encoded values; wide-gamut colors use their extended sRGB coordinates.</p>
<pre class="formula">place(h, M, Lc):                       // lightness search at fixed h and M
  lo, hi \u2190 0, 100
  repeat ${String(b)} times:                     // 100 / 2${G(b)} \u2248 ${fe(100/2**b)} in J, far finer than any output shows
    J   \u2190 (lo + hi)/2
    x   \u2190 color(J, M, h)
    ok  \u2190 APCA(x, base) \u2265 Lc        // x as written; off the screen, by its coordinates past the edge
    light base: ok \u2192 lo \u2190 J  else hi \u2190 J   // keep the lightest that passes
    dark base:  ok \u2192 hi \u2190 J  else lo \u2190 J   // keep the darkest that passes
  x \u2190 color(light ? lo : hi, M, h)
  return x if APCA(x, base) \u2265 Lc after rounding, else none</pre>
      <p>So each color sits on its tier from above: never below Lc, and above it only by what rounding to the output format forces${P===null?"":`, here up to ${P.toFixed(2)} Lc`}. A lightness the screen can't show still has a contrast, so the search knows which way to go from it: a color can leave the screen on either side of its tier. A base is dark when its L* is under 50.</p>
      <p><strong>Identity tier.</strong> Unless one is set by hand, each mode's identity tier is the tier where APCA and WCAG 2 together come closest to their minimum for text. It's measured on a gray, so it's known before any color is solved:</p>
<pre class="formula">g(Lc)     = the 8-bit gray nearest the base with APCA(g, base) \u2265 Lc, or the furthest gray if none
score(Lc) = (APCA(g, base) / ${String(T.apca)} + WCAG(g, base) / ${String(T.wcag)}) / 2     // 1: both just at their minimum for text
identity  = the tier with score nearest 1, the lower on a tie
${w.map(s=>`${s.padEnd(10)}${e.tiers.map(a=>`Lc ${String(a)} ${Z(e.bases[s],a).toFixed(2)}`).join(" \u2022 ")}   \u2192 Lc ${String(Q(e.bases[s],e.tiers))}${e.identityTier[s]==="auto"?"":`, set by hand to Lc ${String(p(e,s))}`}`).join(`
`)}</pre>
<pre class="formula">strongest(h, M_target, Lc):            // colorfulness search
  if place(h, M_target, Lc) exists \u2192 return it
  lo, hi \u2190 0, M_target
  repeat ${String(v)} times:                     // M_target / 2${G(v)}
    mid \u2190 (lo + hi)/2
    place(h, mid, Lc) exists \u2192 lo \u2190 mid  else hi \u2190 mid
  return place(h, lo, Lc)              // the most colorful that fits</pre>
    </section>

    <section class="step">
      <h2>4. Equally colorful: the tier ceiling</h2>
<pre class="formula">reach(h, Lc)  = M of strongest(h, ${String(K)}, Lc)               // how far the gamut lets h go
T(Lc)         = min(M_target, min over hues of reach(h, Lc))   // with equal per tier on; before the curve
limit(Lc)     = the hue with the smallest reach, if it's below M_target
target(h, Lc) = max(0, T(Lc) + curve(h))                  // a curve can't go below gray</pre>
      <p>The reach is measured at the hues the tier starts from: the starting hues on the identity tier, the identity tier's spaced hues on every other tier.</p>
      <p>With equal per tier off, T = M<sub>target</sub> and each hue simply goes as far as it can. The ceiling is measured before the curve: a hue the curve asks more of than it can reach on a tier stops at its reach (Gamut limit) rather than the whole tier dropping to make room for it. Each swatch is labeled from these numbers:</p>
<pre class="formula">Gamut limit    measured M &lt; aim \u2212 ${String(X)}                          // the screen holds it below its aim
aim            hue: target(h, Lc)   custom: T(Lc) \xD7 share   muted: M(default) \xD7 muted share
Sets the tier  the color is limit(Lc), default only           // the tier was lowered to its reach
Lowered        limit(Lc) is another color, not Gamut limit, default only
own aim        hue: M_target + curve(h)      custom: M_target \xD7 share   // what Lowered says it would be</pre>
    </section>

    <section class="step">
      <h2>5. The curve</h2>
      <p>A sum of raised-cosine bumps over hue. Point i has amount a<sub>i</sub> (M, may be negative), center c<sub>i</sub> and half-width w<sub>i</sub>; points switched off contribute nothing:</p>
<pre class="formula">d_i(h)   = circular distance between h and c_i            // 0\u2026180\xB0
curve(h) = \u03A3_i  [ d_i(h) &lt; w_i ]  \xB7  a_i \xB7 (1 + cos(\u03C0 \xB7 d_i(h) / w_i)) / 2</pre>
      <p>Each bump is smooth (continuous first derivative) and exactly zero beyond its width, so a point only moves the hues it reaches.</p>
    </section>

    <section class="step">
      <h2>6. Names and starting hues</h2>
      <p>CAM16's unique hues and their eccentricity weights (the hue-quadrature table): R 20.14\xB0 (e 0.8), Y 90\xB0 (0.7), G 164.25\xB0 (1.0), B 237.53\xB0 (1.2), and R again at 380.14\xB0 (0.8). Between two unique hues, a hue's share of the next one is:</p>
<pre class="formula">p(h) = ((h \u2212 h_i)/e_i) / ((h \u2212 h_i)/e_i + (h_(i+1) \u2212 h)/e_(i+1))</pre>
      <p>A name like "R 33 B" (red with 33% blue: a third of the way from R to B, in steps of p) is turned back into an angle by bisecting p(h) on that segment. The same formula names every swatch ("Y 11 G").</p>
      <p>The other reference systems (Munsell, NCS, unique hues, focal colors) give measured colors instead of names: each one's D65 XYZ (Munsell and WCS chips adapted from illuminant C by Bradford, NCS from its sRGB approximations) is taken into CAM16 in each mode's viewing conditions, and its hue is the circular mean of the light and dark hues. They're drawn as guides, and each one's yellow can be the anchor.</p>
<pre class="formula">start_k = anchor + k \xB7 360\xB0 / n     // k = 0 \u2026 n \u2212 1, yellow first with eight hues
start_k = placed_k                  // a color placed by hand starts there instead
order    = named hues by hue, red first; numbered ones by number, Hue 1 at the anchor</pre>
      <p>The anchor is ${t(y,1)}\xB0 (${be}). It's needed because the spacing (step 7) only evens out differences between neighbors, and turning the whole lineup around the circle leaves those almost unchanged; the anchor fixes where it sits. The anchor and placed colors don't move while the others are spaced. With nothing placed, the result is the uniform lineup.</p>
      <div class="scroll"><table class="roles"><thead><tr><th>Color</th><th>Even start</th><th>Placed at</th></tr></thead><tbody>${we}</tbody></table></div>
    </section>

    <section class="step">
      <h2>7. Evenly different: spacing</h2>
      <p>Difference is CAM16-UCS (Luo, Cui &amp; Li 2006, as in material-color-utilities):</p>
<pre class="formula">J*  = 1.7\xB7J / (1 + 0.007\xB7J)
M*  = ln(1 + 0.0228\xB7M) / 0.0228
a*, b* = M*\xB7cos h, M*\xB7sin h
\u0394E\u2032 = \u221A(\u0394J*\xB2 + \u0394a*\xB2 + \u0394b*\xB2)
\u0394E  = 1.41 \xB7 \u0394E\u2032^0.63                      // the distance shown on the site</pre>
<pre class="formula">space(start, reach):                        // coordinate descent
  colors \u2190 strongest(start_i, target(start_i)) for each hue
  score  \u2190 standard deviation of \u0394E(color_i, color_(i+1)) around the circle
  repeat up to ${String(E.passes)} passes, stop early if a pass changes nothing:
    for each hue i except the anchor and placed colors:
      for step in (${E.steps.map(s=>`${s<0?"\u2212":"+"}${String(Math.abs(s))}\xB0`).join(", ")}):
        h \u2190 hue_i + step;  skip if |h \u2212 start_i| &gt; reach
        try color_i \u2190 strongest(h, target(h));  rescore
        keep it if the score drops by more than ${fe(E.gain)}</pre>
      <p>The identity tier (light Lc ${String(p(e,"light"))}, dark Lc ${String(p(e,"dark"))}) is spaced first from the starting hues with a reach of \xB1${String(e.hueReach.identity)}\xB0${e.hues===A.length?"":`, or halfway to the even neighbor (180\xB0 / ${String(e.hues)}) if that's less: \xB1${t(h,1)}\xB0 here`}. Every other tier starts from the identity tier's hues with \xB1${String(e.hueReach.tier)}\xB0, so each tier is even in its own right while hues stay recognizably the same across tiers. Both modes use the same starting hues, so light and dark land close to each other${$===null?"":`, ${$.toFixed(1)}\xB0 apart at most here`}; a placed color sits exactly where it was placed in both.</p>
      <p><strong>Order.</strong> Colors keep their order around the circle: a placed color is held between the colors beside it, at least ${String(ee)}\xB0 from each, only so they can't swap or overlap, and a spacing step that would bring a color closer than that to a neighbor isn't taken. Neighbors under \u0394E ${String(f)} on any tier are marked, not stopped. Dragging the anchor stops before any color it carries would pass a placed one.</p>
      <p><strong>Turn and bend.</strong> Turning every hue by the same angle keeps the lineup uniform, so placed hues are compared with the uniform lineup turned to match them best. In CAM16-UCS a turn is a rotation of a* and b*, so every angle from \u2212${String(O)}\xB0 to ${String(O)}\xB0 in tenths is tried on the uniform colors, keeping the one with the smallest root-mean-square \u0394E to the palette with placed hues; the turned lineup is then solved with the anchor moved by that angle. Bend is each color's \u0394E from its turned version, divided by the even gap, as a root mean square over the colors.</p>
<pre class="formula">gap      = mean \u0394E between neighbors in the uniform lineup, on the identity tier
bend     = \u221A(mean over colors of (\u0394E(color, turned color) / gap)\xB2)
zone     = Uniform &lt; ${String(_)} \u0394E / gap \u2022 Tuned &lt; ${String(f)} \u0394E / gap \u2022 Reshaped &lt; ${String(te)} \u2022 Departed &lt; ${String(se)} \u2022 Distinct
           // here, with a gap of ${C(o.mode).toFixed(1)} \u0394E: Uniform &lt; ${String(F(C(o.mode))[0].upTo)} \u2022 Tuned &lt; ${String(F(C(o.mode))[1].upTo)}
even     = max over neighbors of |\u0394E(neighbors) / gap \u2212 1|     // the strip's Even: the furthest from even, either way
closer   = 1 \u2212 (smallest neighbor \u0394E) / gap                     // how much the tightest pair lost
evenness = fine &lt; ${String(_)} \u0394E / gap \u2022 worth watching &lt; ${String(f)} \u0394E / gap \u2022 getting confusable  // of even and of closer</pre>
      <p>A change between two colors is split into lightness, colorfulness and hue, each as its share of the three added together:</p>
<pre class="formula">lightness    = \u0394J*\xB2
colorfulness = \u0394M*\xB2
hue          = (2 \xB7 \u221A(M*\u2081 \xB7 M*\u2082) \xB7 sin(\u0394h / 2))\xB2      // the chord the turn makes around the circle</pre>
    </section>

    <section class="step">
      <h2>8. Muted, custom and neutral colors</h2>
<pre class="formula">muted(h, Lc) = strongest(h, M(default at h, Lc) \xD7 ${String(e.mutedShare)}, Lc)     // same hue, same tier
custom(c, Lc) = strongest(hue(c), T(Lc) \xD7 share(c), Lc)             // not spaced${e.customColors.map(s=>`
${oe(`  ${s.name}`.padEnd(13))}= strongest(${s.hue.toFixed(1)}\xB0, T(Lc) \xD7 ${String(s.share)}, Lc)`).join("")}</pre>
      <p><strong>Neutrals.</strong> A gray on every tier, found like the identity tier's gray, and on a base with a hue each neutral color, which takes it:</p>
<pre class="formula">gray(Lc)     = the 8-bit gray nearest the base with APCA(g, base) \u2265 Lc, or the furthest gray if none
gray min/max = white and black: min on the base's side (white in light mode), for text on a color
tinted       = M(base) \u2265 ${String(u[0])}                       // a pure gray still has some M in CAM16${M.length?`: ${Math.min(...M).toFixed(1)}\u2013${Math.max(...M).toFixed(1)} here`:""}
neutral(n, Lc) = strongest(hue(base), M(base) \xD7 share(n), Lc)    // only on a tinted base
zones        = Gray under M ${String(u[0])}, Neutral M ${String(u[0])}\u2013${String(u[1])}, Color past it, for custom colors too; a new neutral color starts at M ${String(k)}
from Gray    = \u0394E(a*, b*) to the tier's gray, the tint alone       // on four test bases: M ${String(u[0])} \u2248 \u0394E 2.3\u20133.9, M ${String(u[1])} \u2248 \u0394E 5.5\u20136.4
new share    = min(1, ${String(k)} / M(base)), the more colorful tinted base; 1 when neither is tinted
exported     = a gray mode's neutral colors are its grays, so every name holds a color in both modes
two gray bases = no neutral colors at all; Gray alone</pre>
    </section>

    <section class="step">
      <h2>9. Baselines for the H and M switches</h2>
      <p>The H and M switches in the header, and the rows of the strip in Settings, show the palette without some of its edits. Each baseline is a solve of changed settings, in a second worker so the palette on screen never waits for it:</p>
<pre class="formula">H on,  M on    the palette as set
H on,  M off   without the curve                          // "+H" row
H off, M on    with nothing placed
H off, M off   without the curve, with nothing placed     // "Uniform" row
turned         Uniform, solved with the anchor moved by the turn (step 7)   // "Turned" row</pre>
      <p>Settings, its export and the blind tests always use the palette as set.</p>
    </section>

    <section class="step">
      <h2>10. Three gamuts</h2>
      <p>Steps 2 to 9 run once per gamut, with the gamut check (step 2) and the base changing: sRGB, Display P3, Rec. 2020. Hues and colors are never mapped from one gamut to another: each gamut's ceilings, hues and colors come from its own solve, against its own base. Only the base is mapped. Each mode has one base, any opaque CSS color. A gamut that can show it uses it exactly; a narrower one uses the closest color it can show to the next wider gamut's base, by the CSS Color 4 gamut mapping: hue and lightness kept, colorfulness lowered until it fits, so a color picked for Wide carries down to Standard. That color can be picked by hand, as long as it's no more than \u0394E ${String(f)} further from the base than the closest color is; a further one is a different background, and is refused. On the web, a page serves the widest gamut the screen reports through <code>@media (color-gamut: \u2026)</code>.</p>
    </section>

    <section class="step">
      <h2>11. What's reported per swatch</h2>
<pre class="formula">CAM16 J, C, M, h        in the mode's viewing conditions
name                    hue composition, step 6
labels                  Gamut limit, Sets the tier, Lowered, step 4
APCA Lc                 step 3
WCAG 2 ratio            (L1 + 0.05)/(L2 + 0.05), relative luminance, Color.js
WCAG level              \u2265 7 AAA \u2022 \u2265 4.5 AA \u2022 \u2265 3 AA large \u2022 else below</pre>
      <p>The cost is dominated by <code>strongest</code>: each call is up to about ${String(v+2)} lightness searches of ${String(b)} steps each. A full solve of one gamut (two modes, ${String(e.tiers.length)} tiers, ${String(e.hues+e.customColors.length)} colors, default and muted, plus spacing) takes well under a second in a browser worker with eight hues, and longer with many more; the header shows how long the one on screen took.</p>
      <p>The hues are the costly part, and custom colors, neutral colors and the muted share don't move them. So each worker keeps the hues of its last few solves, keyed by every setting but those, and a change to them only places the colors on the kept hues again: a few milliseconds instead of a whole solve, so they follow a slider as it moves.</p>
    </section>

    <section class="step">
      <h2>12. The blind colorfulness test</h2>
      <p><strong>Pairs.</strong> Per hue, a staircase on \u0394, the test color's offset from the palette (start \xB1${String(ie)}, half of the hues above and half below, in random order; bounded to \xB1${String(ne)}). Each pair shows the test hue at T + \u0394 against a different, randomly chosen hue at T, on the identity tier, sides random, a ${String(he)} ms blank between pairs. Picked as more colorful \u2192 \u0394 \u2212= step; not picked \u2192 \u0394 += step; "can't tell" \u2192 no move. The step is ${String(g.steps[0])}, then ${String(g.steps[1])} after ${String(g.after[0])} reversals, then ${String(g.steps[2])} after ${String(g.after[1])}.</p>
      <p><strong>Checks and stopping.</strong> One pair in ${String(ae)} for a hue is a check at \u0394 \xB1 ${String(le)}, to a random side, which doesn't move the staircase: a real observer answers it easily, a guess doesn't. A hue is done at ${String(N)} answers, or sooner once it settles: at least ${String(re)} answers, a sure result whose range is within \xB1${String(S.half)} either way, and log L(\u03BC\u0302) \u2212 log L\u2080 \u2265 ${String(n.settle)}, stricter than the final ${String(n.sure)} since it's checked after every answer. Progress is the mean over hues of 1 when done, else answers/${String(N)}. In simulation a consistent observer takes about 10 to 13 answers per hue, while answering at random still ends sure for about one hue in twelve, so one run is a rough answer and several pooled are steadier.</p>
      <p><strong>Equal point.</strong> Each answer is (x, y) with x = measured M<sub>test</sub> \u2212 M<sub>other</sub> and y \u2208 {1, \xBD, 0}. Fitted by maximum likelihood to</p>
<pre class="formula">P(test picked | x) = 1 / (1 + e^(\u2212(x \u2212 \u03BC)/s))
\u03BC \u2208 [\u2212${String(S.range)}, ${String(S.range)}] step ${String(n.step)},   s \u2208 {${n.spreads.join(", ")}}
log L(\u03BC) = max over s of \u03A3 y\xB7ln P + (1 \u2212 y)\xB7ln(1 \u2212 P),   P clamped to [${String(n.clamp)}, ${String(1-n.clamp)}]
\u03BC\u0302 = argmax log L;   range = { \u03BC : log L(\u03BC) \u2265 log L(\u03BC\u0302) \u2212 ${String(n.sure)} }   // \u2248 95%
log L\u2080 = \u03A3 y\xB7ln \u0233 + (1 \u2212 y)\xB7ln(1 \u2212 \u0233)   // a flat guess at the answers' average
unsure if the range reaches \xB1${String(S.range)}, or log L(\u03BC\u0302) \u2212 log L\u2080 &lt; ${String(n.sure)}</pre>
      <p><strong>Curve fit.</strong> Hues with a sure result, weighted w = 1/max(1, (range width/${String(ce)})\xB2). Points are added greedily, at most ${String(i.points)}: each is the single bump (center step ${String(i.centerStep)}\xB0, width ${String(i.widths[0])}\u2013${String(i.widths[1])}\xB0 step ${String(i.widths[2])}\xB0, amount \u2212${String(i.amount)}\u2026${String(i.amount)}) that minimizes \u03A3 w\xB7(curve(h) \u2212 \u03BC\u0302)\xB2 on what's left, kept only if it lowers that error by at least ${String(i.gain)}, so a point has to explain clearly more than noise would.</p>
    </section>

    <section class="step">
      <h2>13. The blind hue test</h2>
      <p><strong>Colors.</strong> Per color, a staircase on \u0394, degrees from the palette's hue (start \xB1${String(de)}, half of the colors toward one neighbor and half toward the other, in random order; bounded to \xB1${String(U)}). Each trial shows one color alone at h + \u0394 on the identity tier, at T + curve(h + \u0394), with no name, and asks whether it leans toward the neighbor before it or after it around the circle (named, sides random), or neither; a ${String(pe)} ms blank between trials. The test runs only with the eight named colors, since it asks about each one's neighbors by name. Leans after \u2192 \u0394 \u2212= step; leans before \u2192 \u0394 += step; neither \u2192 no move. Steps, checks (\u0394 \xB1 ${String(ge)}\xB0) and stopping as in step 12, with the range within \xB1${String(me)}\xB0.</p>
      <p><strong>Middle of the name.</strong> Each answer is (x, y) with x = the hue shown and y = 1 for after, \xBD for neither, 0 for before; runs are pooled per color with hues unwrapped next to each other. The same fit as step 12, over \u03BC within \xB1${String(U+ue)}\xB0 of the answers' mean hue, gives the hue where the color leans neither way, its range, and whether it's sure. Sure colors can be placed there; yellow's sets the anchor.</p>
    </section>`}export{_e as algorithmPage};
