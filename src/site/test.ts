/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< TEST >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The blind test: pairs of colors on the same tier, one of them a little more or less colorful     |
| than the palette, shown without names in random order. Picking the one that looks more colorful, |
| over every hue, measures how much each hue needs to look as colorful as the rest; those amounts  |
| fit the curve.                                                                                   |
\*------------------------------------------------------------------------------------------------*/

import { makeModel } from "../palette/model";
import type { Curve, Gamut, Mode, Settings } from "../palette/settings";
import { boost, type GamutPalette, strongest } from "../palette/solve";

/* >----------------------------------------< Context >-----------------------------------------< */

/** What the test needs from the page. */
export interface TestContext {
  readonly settings: Settings;
  readonly mode: Mode;
  readonly gamut: Gamut;
  readonly palette: GamutPalette | null;
  readonly label: (key: string) => string;

  /** Sets a mode's curve. */
  readonly applyCurve: (mode: Mode, curve: Curve) => void;

  /** Draws the page again. */
  readonly redraw: () => void;
}

/** How much more or less colorful the test color is than the palette, in CAM16 M. */
const STEPS = [-8, -4, 0, 4, 8, 12] as const;

/** One answered pair: how much more colorful the test color was, and whether it was picked. */
interface Point {
  readonly key: string;
  readonly hue: number;

  /** The test color's colorfulness minus the other's, as shown. */
  readonly x: number;

  /** 1 when the test color was picked as more colorful, 0 when the other was, ½ when neither. */
  readonly y: number;
}

/** A finished test. */
interface Run {
  readonly mode: Mode;
  readonly gamut: Gamut;
  readonly tier: number;
  readonly when: string;
  readonly points: readonly Point[];
}

interface Trial {
  readonly key: string;
  readonly hue: number;
  readonly test: string;
  readonly other: string;
  readonly x: number;

  /** Whether the test color is on the left. */
  readonly left: boolean;
}

let session: { mode: Mode; gamut: Gamut; tier: number; trials: Trial[]; points: Point[]; resting: boolean } | null = null;

/* >-----------------------------------------< Trials >-----------------------------------------< */

/**
 * Shuffles in place.
 *
 * @param list  The list.
 * @returns     The same list.
 */
function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

/**
 * Every pair of a test: each hue at every step, against another hue at the palette's colorfulness,
 * in random order and on random sides.
 *
 * @param ctx  What the page shows.
 * @returns    The trials, or null before the palette is solved.
 */
function makeTrials(ctx: TestContext): Trial[] | null {
  const palette = ctx.palette?.[ctx.mode];
  if (!palette) return null;
  const tier = ctx.settings.identityTier[ctx.mode];
  const target = palette.targets[tier]!;
  const base = ctx.settings.bases[ctx.mode];
  const model = makeModel(ctx.settings, ctx.gamut);
  const hues = palette.colors.filter((c) => c.key !== "brown").map((c) => ({ key: c.key, hue: c.tiers[tier]!.default.hue }));
  const color = (hue: number, m: number) => strongest(model, base, ctx.mode, hue, Math.max(0, m), tier);
  const trials = hues.flatMap((h) =>
    STEPS.map((step) => {
      const others = hues.filter((o) => o.key !== h.key);
      const other = others[Math.floor(Math.random() * others.length)]!;
      const test = color(h.hue, target + step);
      const ref = color(other.hue, target);
      const x = model.cam(ctx.mode, test).m - model.cam(ctx.mode, ref).m;
      return { key: h.key, hue: h.hue, test, other: ref, x, left: Math.random() < 0.5 };
    }),
  );
  return shuffle(trials);
}

/* >----------------------------------------< Results >-----------------------------------------< */

/**
 * The point where a hue looks as colorful as the others: a logistic curve fitted to its answers,
 * read where either color is equally likely to be picked.
 *
 * @param points  One hue's answers.
 * @returns       How much more colorful it must be to look equal, or null with too few answers.
 */
function equalPoint(points: readonly Point[]): number | null {
  if (points.length < 4) return null;
  let best = { likelihood: -Infinity, at: 0 };
  for (let at = -20; at <= 20; at += 0.5) {
    for (const spread of [2, 3, 4, 6]) {
      let likelihood = 0;
      for (const p of points) {
        const chance = Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-(p.x - at) / spread))));
        likelihood += p.y * Math.log(chance) + (1 - p.y) * Math.log(1 - chance);
      }
      if (likelihood > best.likelihood) best = { likelihood, at };
    }
  }
  return best.at;
}

/**
 * Every saved answer for a mode, pooled by hue.
 *
 * @param mode  The mode.
 * @returns     Per hue: its average hue angle, how many answers, and its equal point.
 */
function pooled(mode: Mode) {
  const byKey = new Map<string, Point[]>();
  for (const run of runs().filter((r) => r.mode === mode))
    for (const p of run.points) byKey.set(p.key, [...(byKey.get(p.key) ?? []), p]);
  return [...byKey].map(([key, points]) => ({
    key,
    hue: points.reduce((s, p) => s + p.hue, 0) / points.length,
    count: points.length,
    equal: equalPoint(points),
  }));
}

/* >---------------------------------------< Curve fit >----------------------------------------< */

/**
 * The curve closest to the measured amounts, in steps the editor uses.
 *
 * @param measured  Per hue, how much it needs.
 * @param mode      The mode.
 * @returns         The curve.
 */
function fitCurve(measured: readonly { hue: number; equal: number }[], mode: Mode): Curve {
  let best = { error: Infinity, curve: { amount: 0, center: 0, width: 90 } as Curve };
  for (let center = 0; center < 360; center += 5) {
    for (let width = 20; width <= 180; width += 10) {
      for (let amount = -20; amount <= 20; amount++) {
        const curve = { amount, center, width };
        const settings = { curve: { light: curve, dark: curve } };
        const error = measured.reduce((s, m) => s + (boost(settings, mode, m.hue) - m.equal) ** 2, 0);
        if (error < best.error - 1e-9) best = { error, curve };
      }
    }
  }
  return best.curve;
}

/* >---------------------------------------< Saved runs >---------------------------------------< */

const STORE = "ek-colors:tests";

/**
 * Every finished test in this browser, including ones added from codes.
 *
 * @returns  The runs.
 */
function runs(): Run[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "[]") as Run[];
  } catch {
    return memory;
  }
}

let memory: Run[] = [];

/**
 * Saves the runs.
 *
 * @param list  The runs.
 */
function keep(list: Run[]): void {
  memory = list;
  try {
    localStorage.setItem(STORE, JSON.stringify(list));
  } catch {
    // Storage can be blocked; the runs then last until the page closes.
  }
}

/**
 * A run as a short code to send.
 *
 * @param run  The run.
 * @returns    The code.
 */
function encode(run: Run): string {
  const points = run.points.map((p) => [p.key, Math.round(p.hue), Math.round(p.x * 10) / 10, p.y]);
  return btoa(JSON.stringify([run.mode, run.gamut, run.tier, run.when, points]));
}

/**
 * A run from its code.
 *
 * @param code  The code.
 * @returns     The run, or null when it isn't one.
 */
function decode(code: string): Run | null {
  try {
    const [mode, gamut, tier, when, points] = JSON.parse(atob(code.trim())) as [Mode, Gamut, number, string, [string, number, number, number][]];
    return { mode, gamut, tier, when, points: points.map(([key, hue, x, y]) => ({ key, hue, x, y })) };
  } catch {
    return null;
  }
}

/* >------------------------------------------< Page >------------------------------------------< */

/**
 * The test page: the intro, a pair while a test runs, or the results.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
export function testPage(ctx: TestContext): string {
  if (session && session.mode === ctx.mode) return stage();
  const mode = ctx.label(ctx.mode).toLowerCase();
  const done = runs().filter((r) => r.mode === ctx.mode);
  const hues = ctx.palette?.[ctx.mode].colors.filter((c) => c.key !== "brown").length ?? 8;
  return `<section class="intro">
      <h1>Blind test</h1>
      <p>Pairs of ${mode}-mode colors, one at a time, without names. Pick the one that looks more colorful. ${String(STEPS.length * hues)} pairs, about three minutes. Your answers show how much each hue needs to look as colorful as the rest.</p>
      <ul class="soft checklist">
        <li>Turn off True Tone and Night Shift, and use your usual brightness.</li>
        <li>Look straight at the screen, in the room you usually work in.</li>
        <li>Go with your first impression. If you truly can't tell, pick "Can't tell".</li>
      </ul>
      <p><button type="button" data-test="start" ${ctx.palette ? "" : "disabled"}>${ctx.palette ? (done.length ? "Take the test again" : "Start the test") : "Solving the palette…"}</button> <span class="soft">Uses the ${mode} mode; switch Light and Dark above for the other.</span></p>
    </section>
    ${done.length ? results(ctx) : ""}`;
}

/**
 * The pair on screen.
 *
 * @returns  HTML.
 */
function stage(): string {
  const s = session!;
  const at = s.points.length;
  const trial = s.trials[at]!;
  const [a, b] = trial.left ? [trial.test, trial.other] : [trial.other, trial.test];
  return `<section class="test-stage" id="test-stage">
      <p class="soft">Pair ${String(at + 1)} of ${String(s.trials.length)}. Which looks more colorful?</p>
      <div class="test-pair${s.resting ? " resting" : ""}">
        <button type="button" class="test-swatch" data-test="left" style="--c:${a}" aria-label="Left"></button>
        <button type="button" class="test-swatch" data-test="right" style="--c:${b}" aria-label="Right"></button>
      </div>
      <div class="row test-answers">
        <button type="button" data-test="left">Left</button>
        <button type="button" data-test="same">Can't tell</button>
        <button type="button" data-test="right">Right</button>
      </div>
      <p class="soft">Keys: ← left, ↓ can't tell, → right. <button type="button" data-test="stop" class="link">Stop the test</button></p>
    </section>`;
}

/**
 * The results so far for the mode on screen: per hue how much it needs, the curve that fits, and
 * the runs they come from.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function results(ctx: TestContext): string {
  const tier = ctx.settings.identityTier[ctx.mode];
  const colorOf = (key: string) => ctx.palette?.[ctx.mode].colors.find((c) => c.key === key)?.tiers[tier]?.default.color ?? "transparent";
  const measured = pooled(ctx.mode).toSorted((a, b) => a.hue - b.hue);
  const usable = measured.filter((m): m is typeof m & { equal: number } => m.equal !== null);
  const curve = usable.length >= 3 ? fitCurve(usable, ctx.mode) : null;
  const list = runs();
  const rows = measured
    .map((m) => {
      const fitted = curve ? boost({ curve: { light: curve, dark: curve } }, ctx.mode, m.hue) : null;
      const sign = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
      return `<tr>
        <th scope="row"><span class="dot" style="--c:${colorOf(m.key)}"></span> ${ctx.label(m.key)}</th>
        <td class="mono">${String(m.count)}</td>
        <td class="mono">${m.equal === null ? "—" : sign(m.equal)}</td>
        <td class="mono">${fitted === null ? "—" : sign(fitted)}</td>
      </tr>`;
    })
    .join("");
  const mine = list
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.mode === ctx.mode)
    .map(
      ({ r, i }) => `<li><span class="mono">${new Date(r.when).toLocaleString()}</span> · ${String(r.points.length)} pairs · ${r.gamut}, Lc ${String(r.tier)}
        <button type="button" data-test="copy" data-run="${String(i)}">Copy code</button>
        <button type="button" data-test="remove" data-run="${String(i)}">Remove</button></li>`,
    )
    .join("");
  return `<section>
      <h2>Results, ${ctx.label(ctx.mode).toLowerCase()} mode</h2>
      <p class="soft">How much colorfulness (M) each hue needs to look as colorful as the others, from every run below together. A positive number means it looked weaker than the model says.</p>
      <div class="scroll"><table class="test-results"><thead><tr><th>Color</th><th>Answers</th><th>Measured</th><th>Curve</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${
        curve
          ? `<p>The curve that fits: <strong class="mono">amount ${curve.amount > 0 ? "+" : ""}${String(curve.amount)}, hue ${String(curve.center)}°, width ${String(curve.width)}°</strong>.
             <button type="button" data-test="apply" data-amount="${String(curve.amount)}" data-center="${String(curve.center)}" data-width="${String(curve.width)}">Use it for the ${ctx.label(ctx.mode).toLowerCase()} curve</button></p>
             <p class="soft">One run is a rough answer. Two or three runs, or a few people's, make it steadier.</p>`
          : `<p class="soft">Not enough answers to fit a curve yet.</p>`
      }
    </section>
    <section>
      <h2>Runs</h2>
      <ul class="test-runs">${mine}</ul>
      <p class="soft">Send someone the link; when they finish, they copy their code and send it to you. Paste it here to add their answers.</p>
      <div class="row"><input id="test-code" type="text" placeholder="Paste a code" spellcheck="false"><button type="button" data-test="add">Add</button><span id="test-message" class="soft" role="status"></span></div>
    </section>`;
}

/* >-----------------------------------------< Events >-----------------------------------------< */

/**
 * Records an answer and moves to the next pair, with a short blank between so one pair's
 * afterimage doesn't color the next.
 *
 * @param ctx     What the page shows.
 * @param answer  Which side was picked.
 */
function answer(ctx: TestContext, answer: "left" | "right" | "same"): void {
  const s = session;
  if (!s || s.resting) return;
  const trial = s.trials[s.points.length]!;
  const picked = answer === "same" ? 0.5 : (answer === "left") === trial.left ? 1 : 0;
  s.points.push({ key: trial.key, hue: trial.hue, x: trial.x, y: picked });
  if (s.points.length === s.trials.length) {
    keep([...runs(), { mode: s.mode, gamut: s.gamut, tier: s.tier, when: new Date().toISOString(), points: s.points }]);
    session = null;
    ctx.redraw();
    return;
  }
  s.resting = true;
  ctx.redraw();
  window.setTimeout(() => {
    s.resting = false;
    ctx.redraw();
  }, 300);
}

/**
 * Makes the test page respond to clicks and keys.
 *
 * @param get  What the page shows now.
 */
export function bindTest(get: () => TestContext): void {
  document.addEventListener("click", (event) => {
    const el = (event.target as Element).closest<HTMLElement>("[data-test]");
    if (!el) return;
    const ctx = get();
    const action = el.dataset.test!;
    if (action === "left" || action === "right" || action === "same") return answer(ctx, action);
    if (action === "start") {
      const trials = makeTrials(ctx);
      if (!trials) return;
      session = { mode: ctx.mode, gamut: ctx.gamut, tier: ctx.settings.identityTier[ctx.mode], trials, points: [], resting: false };
    }
    if (action === "stop") session = null;
    if (action === "apply")
      ctx.applyCurve(ctx.mode, { amount: Number(el.dataset.amount), center: Number(el.dataset.center), width: Number(el.dataset.width) });
    if (action === "remove") keep(runs().filter((_, i) => i !== Number(el.dataset.run)));
    if (action === "copy") {
      const run = runs()[Number(el.dataset.run)];
      if (run)
        navigator.clipboard.writeText(encode(run)).then(
          () => (el.textContent = "Copied"),
          () => (el.textContent = "Copying isn't allowed here"),
        );
      return;
    }
    if (action === "add") {
      const input = document.querySelector<HTMLInputElement>("#test-code");
      const run = decode(input?.value ?? "");
      if (!run) {
        const message = document.querySelector("#test-message");
        if (message) message.textContent = "That isn't a test code. Copy it again and paste the whole code.";
        return;
      }
      keep([...runs(), run]);
    }
    ctx.redraw();
  });

  document.addEventListener("keydown", (event) => {
    if (!session || !document.querySelector("#test-stage")) return;
    const keys: Record<string, "left" | "right" | "same"> = { ArrowLeft: "left", ArrowRight: "right", ArrowDown: "same" };
    const picked = keys[event.key];
    if (!picked) return;
    event.preventDefault();
    answer(get(), picked);
  });
}

