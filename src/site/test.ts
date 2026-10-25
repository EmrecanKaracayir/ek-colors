/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< TEST >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The blind colorfulness test: pairs of colors on the same tier, one a little more or less         |
| colorful than the palette, shown without names in random order. Each hue has its own staircase   |
| that closes in on the point where it looks as colorful as the others; those points, with how     |
| sure each one is, fit the curve.                                                                 |
\*------------------------------------------------------------------------------------------------*/

import { makeModel, meanHue, type Model } from "../palette/model";
import type { CurvePoint, Gamut, Mode, Settings } from "../palette/settings";
import { boost, type GamutPalette, identityOf, strongest } from "../palette/solve";
import {
  ask,
  balance,
  bindBlind,
  CAP,
  decodeRun,
  encodeRun,
  type Fit,
  nextStair,
  plainAnswer,
  pool,
  progressBar,
  record,
  type Run as Saved,
  runItem,
  runsSection,
  type Stair as Staircase,
  savedRuns,
  stair,
  startSides,
  type Pick,
} from "./blind";
import { signed } from "./graph";

/* >----------------------------------------< Context >-----------------------------------------< */

/** What the test needs from the page. */
export interface TestContext {
  readonly settings: Settings;
  readonly mode: Mode;
  readonly gamut: Gamut;
  readonly palette: GamutPalette | null;
  readonly label: (key: string) => string;

  /** Sets a mode's curve. */
  readonly applyCurve: (mode: Mode, points: CurvePoint[]) => void;

  /** Draws the page again. */
  readonly redraw: () => void;
}

/** How far the test color may move from the palette, in CAM16 M. */
const REACH = 16;

/** How far to one side a check stands, in CAM16 M. */
const FAR = 12;

/** How a hue's answers are read: equal colorfulness within ±24 M, settled within ±5. */
const FIT: Fit = { center: 0, range: 24, half: 5 };

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
type Run = Saved<Point>;

/** One hue's staircase, and the hue it tests. */
interface Stair extends Staircase {
  readonly hue: number;
}

/** The pair on screen. */
interface Pair {
  readonly stair: Stair;
  readonly test: string;
  readonly other: string;
  readonly x: number;

  /** Whether the test color is on the left. */
  readonly left: boolean;

  /** Whether it's a check, well to one side, which doesn't move the staircase. */
  readonly check: boolean;
}

interface Session {
  readonly mode: Mode;
  readonly gamut: Gamut;
  readonly tier: number;
  readonly target: number;
  readonly base: string;
  readonly model: Model;
  readonly stairs: Stair[];
  pair: Pair;
  readonly points: Point[];
  resting: boolean;
}

let session: Session | null = null;

/* >-----------------------------------------< Trials >-----------------------------------------< */

/**
 * The next pair: a hue that isn't done, never the same hue twice in a row, against another hue at
 * the palette's colorfulness, on a random side.
 *
 * @param s     The test so far.
 * @param last  The hue of the pair before, if any.
 * @returns     The pair, or null when every staircase is done.
 */
function nextPair(s: Omit<Session, "pair">, last?: string): Pair | null {
  const stair = nextStair(s.stairs, last);
  if (!stair) return null;
  const others = s.stairs.filter((t) => t.key !== stair.key);
  const other = others[Math.floor(Math.random() * others.length)]!;
  const color = (hue: number, m: number) => strongest(s.model, s.base, s.mode, hue, Math.max(0, m), s.tier);
  const { offset, check } = ask(stair, FAR);
  const test = color(stair.hue, s.target + offset);
  const ref = color(other.hue, s.target);
  const x = s.model.cam(s.mode, test).m - s.model.cam(s.mode, ref).m;
  return { stair, test, other: ref, x, left: Math.random() < 0.5, check };
}

/**
 * Starts a test of the mode on screen. Every staircase starts away from the palette, half of them
 * above and half below, and moves toward where the answers turn.
 *
 * @param ctx  What the page shows.
 * @returns    Whether it started (the palette has to be solved first).
 */
function start(ctx: TestContext): boolean {
  const palette = ctx.palette?.[ctx.mode];
  if (!palette) return false;
  const tier = identityOf(ctx.settings, ctx.mode);
  const hues = palette.colors.filter((c) => !c.extra).map((c) => ({ key: c.key, hue: c.tiers[tier]!.default.hue }));
  const signs = startSides(hues.length);
  const base = {
    mode: ctx.mode,
    gamut: ctx.gamut,
    tier,
    target: palette.targets[tier]!,
    base: ctx.settings.bases[ctx.mode],
    model: makeModel(ctx.settings, ctx.gamut),
    stairs: hues.map((h, i) => ({ ...stair(h.key, 8 * signs[i]!), hue: h.hue })),
    points: [],
    resting: false,
  };
  session = { ...base, pair: nextPair(base)! };
  return true;
}

/* >----------------------------------------< Results >-----------------------------------------< */

/**
 * Where a hue looks as colorful as the others: how much more colorful it must be, with the range
 * its answers can't rule out.
 *
 * @param points  One hue's answers.
 * @returns       The point, or null with too few answers.
 */
function equal(points: readonly Point[]) {
  const found = balance(points, FIT.center, FIT.range);
  return found && { equal: found.at, low: found.low, high: found.high, sure: found.sure };
}

/**
 * Every saved answer for a mode, pooled by hue.
 *
 * @param mode  The mode.
 * @returns     Per hue: its average hue angle, how many answers, and where it looks equal.
 */
function pooled(mode: Mode) {
  return [...pool(runs(), mode)].map(([key, points]) => ({
    key,
    // Around the circle: a hue measured at 359° and at 1° is at 0°, not 180°.
    hue: meanHue(points.map((p) => p.hue)),
    count: points.length,
    result: equal(points),
  }));
}

/* >---------------------------------------< Curve fit >----------------------------------------< */

interface Measured {
  readonly hue: number;
  readonly equal: number;

  /** How much a hue counts: the surer its result, the more. */
  readonly weight: number;
}

/**
 * The one point that best explains what's left, in steps the editor uses.
 *
 * @param left  Per hue, what the curve still has to add.
 * @param mode  The mode.
 * @returns     The point and the weighted error left after it.
 */
function bestPoint(left: readonly Measured[], mode: Mode) {
  let best = { error: Infinity, point: { amount: 0, center: 0, width: 90 } as CurvePoint };
  for (let center = 0; center < 360; center += 5) {
    for (let width = 30; width <= 180; width += 10) {
      for (let amount = -24; amount <= 24; amount++) {
        const point = { amount, center, width };
        const settings = { curve: { light: [point], dark: [point] } };
        const error = left.reduce((s, m) => s + m.weight * (boost(settings, mode, m.hue) - m.equal) ** 2, 0);
        if (error < best.error - 1e-9) best = { error, point };
      }
    }
  }
  return best;
}

/**
 * The curve that fits the measurements: points added one at a time, each where it explains the
 * most of what's left, until another point would mostly fit noise.
 *
 * @param measured  Per hue, how much it needs and how sure that is.
 * @param mode      The mode.
 * @returns         The curve's points.
 */
function fitCurve(measured: readonly Measured[], mode: Mode): CurvePoint[] {
  const points: CurvePoint[] = [];
  let left = [...measured];
  let error = left.reduce((s, m) => s + m.weight * m.equal ** 2, 0);
  for (let i = 0; i < 3; i++) {
    const next = bestPoint(left, mode);
    // A point has three numbers; it has to explain clearly more than chance would.
    if (next.point.amount === 0 || error - next.error < 6) break;
    points.push(next.point);
    const settings = { curve: { light: [next.point], dark: [next.point] } };
    left = left.map((m) => ({ ...m, equal: m.equal - boost(settings, mode, m.hue) }));
    error = next.error;
  }
  return points;
}

/* >---------------------------------------< Saved runs >---------------------------------------< */

/** The test's name: its data attribute, ids and the tag its codes start with. */
const NAME = "test";

/** Whether an answer is plain: a key, its hue and x as numbers, and 0, ½ or 1. */
const plain = (p: Point) => plainAnswer(p.key, [p.hue, p.x], p.y);

const saved = savedRuns<Point>("ek-colors:tests", plain);
const runs = () => saved.all();
const keep = (list: Run[]) => saved.keep(list);

/**
 * A run as a short code to send.
 *
 * @param run  The run.
 * @returns    The code.
 */
function encode(run: Run): string {
  return encodeRun(
    NAME,
    run,
    run.points.map((p) => [p.key, Math.round(p.hue), Math.round(p.x * 10) / 10, p.y]),
  );
}

/**
 * A run from its code. Codes made before they carried the test's name start with the mode, and
 * still read.
 *
 * @param code  The code.
 * @returns     The run, or null when it isn't one.
 */
function decode(code: string): Run | null {
  let tagged = code;
  try {
    const value = JSON.parse(atob(code.trim())) as unknown;
    if (Array.isArray(value) && value.length === 5) tagged = btoa(JSON.stringify([NAME, ...value]));
  } catch {
    return null;
  }
  return decodeRun(tagged, NAME, (value) => {
    if (!Array.isArray(value)) return null;
    const [key, hue, x, y] = value as [string, number, number, number];
    const p = { key, hue, x, y };
    return plain(p) ? p : null;
  });
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
  const mode = ctx.mode;
  const done = runs().filter((r) => r.mode === ctx.mode);
  const hues = ctx.palette?.[ctx.mode].colors.filter((c) => !c.extra).length ?? 8;
  return `<section class="intro">
      <h1>Blind colorfulness test</h1>
      <p>Measures how colorful each ${mode}-mode hue looks to you, to set colorfulness per hue. Pairs of colors, one at a time, without names: pick the one that looks more colorful. Up to ${String(CAP * hues)} pairs, fewer once the answers settle; usually about five minutes. Each hue's pairs close in on the point where it looks as colorful as the rest, with an easy pair now and then to check the answers depend on what's shown.</p>
      <ul class="soft checklist">
        <li>Turn off True Tone, Night Shift, Night Light or any blue-light filter, and use the usual brightness.</li>
        <li>Look straight at the screen, in the room you usually work in.</li>
        <li>Go with the first impression. If you truly can't tell, pick "Can't tell".</li>
      </ul>
      <p class="row"><button type="button" data-test="start" ${ctx.palette ? "" : "disabled"}>${ctx.palette ? (done.length ? "Take it again" : "Start") : "Solving the palette…"}</button><a href="#tune">Back to colorfulness</a><span class="soft">Tests ${mode} mode; switch Light and Dark above for the other.</span></p>
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
  const pair = s.pair;
  const [a, b] = pair.left ? [pair.test, pair.other] : [pair.other, pair.test];
  return `<section class="test-stage" id="test-stage">
      <h1 class="visually-hidden">Blind colorfulness test</h1>
      ${progressBar(s.stairs)}
      <p>Which looks more colorful?</p>
      <div class="test-pair${s.resting ? " resting" : ""}">
        <button type="button" class="test-swatch" data-test="left" style="--c:${a}" tabindex="-1" aria-hidden="true"></button>
        <button type="button" class="test-swatch" data-test="right" style="--c:${b}" tabindex="-1" aria-hidden="true"></button>
      </div>
      <div class="row test-answers">
        <button type="button" id="answer-left" data-test="left">Left</button>
        <button type="button" id="answer-same" data-test="same">Can't tell</button>
        <button type="button" id="answer-right" data-test="right">Right</button>
      </div>
      <p class="soft">Keys: ← left, ↓ can't tell, → right. <button type="button" data-test="stop" class="link">Stop the test</button></p>
    </section>`;
}

/**
 * The results so far for the mode on screen: per hue how much it needs and how sure that is, the
 * curve that fits, and the runs they come from.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function results(ctx: TestContext): string {
  const tier = identityOf(ctx.settings, ctx.mode);
  const colorOf = (key: string) => ctx.palette?.[ctx.mode].colors.find((c) => c.key === key)?.tiers[tier]?.default.color ?? "transparent";
  const measured = pooled(ctx.mode).toSorted((a, b) => a.hue - b.hue);
  const usable = measured.flatMap((m) =>
    m.result?.sure ? [{ hue: m.hue, equal: m.result.equal, weight: 1 / Math.max(1, ((m.result.high - m.result.low) / 3.92) ** 2) }] : [],
  );
  const curve = usable.length >= 3 ? fitCurve(usable, ctx.mode) : null;
  const settings = { curve: { light: curve ?? [], dark: curve ?? [] } };
  const sign = signed;
  const rows = measured
    .map((m) => {
      const r = m.result;
      const clear = r?.sure && (r.low > 0 || r.high < 0);
      return `<tr${clear ? ' class="clear"' : ""}>
        <th scope="row"><span class="dot" style="--c:${colorOf(m.key)}"></span> ${ctx.label(m.key)}</th>
        <td class="mono num">${String(m.count)}</td>
        <td class="mono num">${r ? sign(r.equal) : "—"}</td>
        <td class="mono soft num">${r ? (r.sure ? `${sign(r.low)} to ${sign(r.high)}` : "unsure") : "—"}</td>
        <td class="mono num">${curve ? sign(boost(settings, ctx.mode, m.hue)) : "—"}</td>
      </tr>`;
    })
    .join("");
  const describe = (points: readonly CurvePoint[]) =>
    points.map((p) => `${signed(p.amount)} at ${String(p.center)}°, width ${String(p.width)}°`).join("; ");
  const mine = runs()
    .flatMap((r, i) => (r.mode === ctx.mode ? [runItem(NAME, r, i, "pairs")] : []))
    .join("");
  const name = ctx.mode;
  return `<section>
      <h2>Results, ${name} mode</h2>
      <p class="soft">How much colorfulness (M) each hue needs to look as colorful as the others, from every run below together. "Could be" is the range the answers can't rule out; a hue in bold is clearly off, since its whole range is on one side of zero.</p>
      <div class="scroll"><table class="test-results"><thead><tr><th scope="col">Color</th><th scope="col" class="num">Answers</th><th scope="col" class="num">Measured</th><th scope="col" class="num">Could be</th><th scope="col" class="num">Curve</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${
        curve === null
          ? `<p class="soft">Not enough answers to fit a curve yet.</p>`
          : curve.length === 0
            ? `<p>The answers don't show any hue clearly needing a change, so the curve that fits is flat. <button type="button" data-test="apply" data-points="[]">Flatten the ${name} curve</button></p>`
            : `<p>The curve that fits: <strong class="mono">${describe(curve)}</strong>. <button type="button" data-test="apply" data-points='${JSON.stringify(curve)}'>Use it for the ${name} curve</button></p>`
      }
      <p class="soft">It only adds a point where the answers clearly need one. One run is a rough answer; two or three, or a few people's, make it steadier.</p>
    </section>
    ${runsSection(NAME, mine)}`;
}

/* >-----------------------------------------< Events >-----------------------------------------< */

/**
 * Records an answer, moves that hue's staircase, and shows the next pair after a short blank, so
 * one pair's afterimage doesn't color the next.
 *
 * @param ctx     What the page shows.
 * @param answer  Which side was picked.
 */
function answer(ctx: TestContext, answer: Pick): void {
  const s = session;
  if (!s || s.resting) return;
  const pair = s.pair;
  const picked = answer === "same" ? 0.5 : (answer === "left") === pair.left ? 1 : 0;
  s.points.push({ key: pair.stair.key, hue: pair.stair.hue, x: pair.x, y: picked });
  record(pair.stair, { x: pair.x, y: picked }, pair.check, REACH, FIT);
  const next = nextPair(s, pair.stair.key);
  if (!next) {
    keep([...runs(), { mode: s.mode, gamut: s.gamut, tier: s.tier, when: new Date().toISOString(), points: s.points }]);
    session = null;
    ctx.redraw();
    return;
  }
  s.pair = next;
  s.resting = true;
  ctx.redraw();
  window.setTimeout(() => {
    // Stopped, or another test started, in the meantime: nothing to show.
    if (session !== s) return;
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
  bindBlind(get, {
    name: NAME,
    code: "test",
    runs: saved as { all(): Saved<unknown>[]; keep(list: Saved<unknown>[]): void },
    encode,
    decode,
    start,
    stop: () => (session = null),
    answer,
    apply: (ctx, el) => ctx.applyCurve(ctx.mode, JSON.parse(el.dataset.points ?? "[]") as CurvePoint[]),
    asking: () => Boolean(session && document.querySelector("#test-stage .test-pair")),
  });
}
