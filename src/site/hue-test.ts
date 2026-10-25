/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< HUE TEST >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The blind hue test: one color at a time, without its name, a few degrees either side of where    |
| the palette puts it, and the question which of its two neighbors it leans toward. Each color has |
| its own staircase that closes in on the hue where it leans neither way, the middle of its name;  |
| those hues, with how sure each one is, can be placed.                                            |
\*------------------------------------------------------------------------------------------------*/

import { hueTurn, makeModel, type Model, wrapHue } from "../palette/model";
import { type Gamut, type Mode, NAMES, type Settings } from "../palette/settings";
import { boost, type GamutPalette, identityOf, strongest } from "../palette/solve";
import {
  ask,
  balance,
  bindBlind,
  CAP,
  decodeRun,
  encodeRun,
  nextStair,
  type Pick,
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
} from "./blind";
import { signed } from "./graph";

/* >----------------------------------------< Context >-----------------------------------------< */

/** What the test needs from the page. */
export interface HueTestContext {
  readonly settings: Settings;
  readonly mode: Mode;
  readonly gamut: Gamut;
  readonly palette: GamutPalette | null;
  readonly label: (key: string) => string;

  /** Places colors at hues; the anchor's sets the anchor. */
  readonly applyHues: (hues: Readonly<Record<string, number>>) => void;

  /** Draws the page again. */
  readonly redraw: () => void;
}

/** How far the test color may move from the palette, in degrees. */
const REACH = 30;

/** How far to one side a check stands, in degrees. */
const FAR = 12;

/** How wide a color's settled result may be, either way, in degrees. */
const HALF = 5;

/** One answer: the hue shown, and whether it leaned toward the next neighbor around the circle. */
interface Point {
  readonly key: string;

  /** The hue shown (CAM16), unwrapped to sit near the color's own. */
  readonly x: number;

  /** 1 when it leaned toward the neighbor after it, 0 toward the one before, ½ neither. */
  readonly y: number;
}

/** A finished test. */
type Run = Saved<Point>;

/** One color's staircase: its hue in the palette and the neighbors it can lean toward. */
interface Stair extends Staircase {
  readonly hue: number;
  readonly before: string;
  readonly after: string;
}

/** The color on screen. */
interface Trial {
  readonly stair: Stair;
  readonly color: string;
  readonly hue: number;

  /** Whether the neighbor after it is offered on the left. */
  readonly afterLeft: boolean;

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
  readonly settings: Settings;
  readonly stairs: Stair[];
  trial: Trial;
  readonly points: Point[];
  resting: boolean;
}

let session: Session | null = null;

/* >-----------------------------------------< Trials >-----------------------------------------< */

/**
 * The next color: one that isn't done, never the same twice in a row, at the tier that stands for
 * each hue and the colorfulness the palette gives that hue.
 *
 * @param s     The test so far.
 * @param last  The color before, if any.
 * @returns     The trial, or null when every staircase is done.
 */
function nextTrial(s: Omit<Session, "trial">, last?: string): Trial | null {
  const chosen = nextStair(s.stairs, last);
  if (!chosen) return null;
  const { offset, check } = ask(chosen, FAR);
  const hue = chosen.hue + offset;
  const at = wrapHue(hue);
  const color = strongest(s.model, s.base, s.mode, at, s.target + boost(s.settings, s.mode, at), s.tier);
  return { stair: chosen, color, hue, afterLeft: Math.random() < 0.5, check };
}

/**
 * Starts a test of the mode on screen. Every staircase starts away from the palette, half of them
 * toward one neighbor and half toward the other.
 *
 * @param ctx  What the page shows.
 * @returns    Whether it started (the palette has to be solved, with the eight named colors).
 */
function start(ctx: HueTestContext): boolean {
  const palette = ctx.palette?.[ctx.mode];
  if (!palette || ctx.settings.hues !== NAMES.length) return false;
  const tier = identityOf(ctx.settings, ctx.mode);
  const colors = palette.colors
    .filter((c) => !c.extra)
    .map((c) => ({ key: c.key, hue: c.tiers[tier]!.default.hue }))
    .toSorted((a, b) => a.hue - b.hue);
  const signs = startSides(colors.length);
  const base = {
    mode: ctx.mode,
    gamut: ctx.gamut,
    tier,
    target: palette.targets[tier]!,
    base: ctx.settings.bases[ctx.mode],
    model: makeModel(ctx.settings, ctx.gamut),
    settings: ctx.settings,
    stairs: colors.map((c, i) => ({
      ...stair(c.key, 10 * signs[i]!),
      hue: c.hue,
      before: colors[(i - 1 + colors.length) % colors.length]!.key,
      after: colors[(i + 1) % colors.length]!.key,
    })),
    points: [],
    resting: false,
  };
  session = { ...base, trial: nextTrial(base)! };
  return true;
}

/* >----------------------------------------< Results >-----------------------------------------< */

/**
 * Every saved answer for a mode, pooled by color, with the hue where each leans neither way.
 *
 * @param mode  The mode.
 * @returns     Per color: how many answers, and the hue with its range, or null.
 */
function pooled(mode: Mode) {
  return [...pool(runs(), mode)].map(([key, points]) => {
    // Runs can sit on either side of 0°; every answer is brought next to the first.
    const near = points[0]!.x;
    const unwrapped = points.map((p) => ({ ...p, x: near + hueTurn(near, p.x) }));
    const center = unwrapped.reduce((s, p) => s + p.x, 0) / unwrapped.length;
    const found = balance(unwrapped, Math.round(center), REACH + 10);
    // The range is kept as distances from the result, which mean the same on either side of 0°.
    return { key, count: points.length, result: found && { hue: wrapHue(found.at), below: found.at - found.low, above: found.high - found.at, sure: found.sure } };
  });
}

/* >---------------------------------------< Saved runs >---------------------------------------< */

/** The test's name: its data attribute and ids. */
const NAME = "hue-test";

/** The tag its codes start with. */
const TAG = "hue";

/** Whether an answer is plain: a key, the hue as a number, and 0, ½ or 1. */
const plain = (p: Point) => plainAnswer(p.key, [p.x], p.y);

const saved = savedRuns<Point>("ek-colors:hue-tests", plain);
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
    TAG,
    run,
    run.points.map((p) => [p.key, Math.round(p.x * 10) / 10, p.y]),
  );
}

/**
 * A run from its code.
 *
 * @param code  The code.
 * @returns     The run, or null when it isn't one.
 */
function decode(code: string): Run | null {
  return decodeRun(code, TAG, (value) => {
    if (!Array.isArray(value)) return null;
    const [key, x, y] = value as [string, number, number];
    const p = { key, x, y };
    return plain(p) ? p : null;
  });
}

/* >------------------------------------------< Page >------------------------------------------< */

/**
 * The test page: the intro, a color while a test runs, or the results.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
export function hueTestPage(ctx: HueTestContext): string {
  if (session && session.mode === ctx.mode) return stage(ctx);
  const mode = ctx.mode;
  const done = runs().filter((r) => r.mode === ctx.mode);
  const named = ctx.settings.hues === NAMES.length;
  const ready = Boolean(ctx.palette) && named;
  return `<section class="intro">
      <h1>Blind hue test</h1>
      <p>Measures where each ${mode}-mode color looks most like its name, to place it. One color at a time, without its name: say which of its two neighbors it leans toward, or neither. Up to ${String(CAP * NAMES.length)} colors, fewer once the answers settle; usually about five minutes. Each color's answers close in on the hue where it leans neither way, the middle of its name, with an easy one now and then to check the answers depend on what's shown.</p>
      <ul class="soft checklist">
        <li>Turn off True Tone, Night Shift, Night Light or any blue-light filter, and use the usual brightness.</li>
        <li>Look straight at the screen, in the room you usually work in.</li>
        <li>Go with the first impression. If it leans neither way, pick "Neither".</li>
      </ul>
      ${named ? "" : `<p class="soft">The test needs the eight named colors; set How many hues to 8.</p>`}
      <p class="row"><button type="button" data-hue-test="start" ${ready ? "" : "disabled"}>${!named ? "Needs eight colors" : ctx.palette ? (done.length ? "Take it again" : "Start") : "Solving the palette…"}</button><a href="#tune">Back to hue</a><span class="soft">Tests ${mode} mode; switch Light and Dark above for the other.</span></p>
    </section>
    ${done.length ? results(ctx) : ""}`;
}

/**
 * The color on screen and the question.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function stage(ctx: HueTestContext): string {
  const s = session!;
  const t = s.trial;
  const [left, right] = t.afterLeft ? [t.stair.after, t.stair.before] : [t.stair.before, t.stair.after];
  const name = (key: string) => ctx.label(key).toLowerCase();
  return `<section class="test-stage" id="test-stage">
      ${progressBar(s.stairs)}
      <p>Does it lean more ${name(left)} or more ${name(right)}?</p>
      <div class="test-single${s.resting ? " resting" : ""}" style="--c:${t.color}" role="img" aria-label="The color to judge"></div>
      <div class="row test-answers">
        <button type="button" data-hue-test="left">More ${name(left)}</button>
        <button type="button" data-hue-test="same">Neither</button>
        <button type="button" data-hue-test="right">More ${name(right)}</button>
      </div>
      <p class="soft">Keys: ← ${name(left)}, ↓ neither, → ${name(right)}. <button type="button" data-hue-test="stop" class="link">Stop the test</button></p>
    </section>`;
}

/**
 * The results so far for the mode on screen: per color the hue where it leans neither way, how sure
 * that is, and how far it is from the palette's.
 *
 * @param ctx  What the page shows.
 * @returns    HTML.
 */
function results(ctx: HueTestContext): string {
  const tier = identityOf(ctx.settings, ctx.mode);
  const now = (key: string) => ctx.palette?.[ctx.mode].colors.find((c) => c.key === key)?.tiers[tier]?.default;
  const measured = pooled(ctx.mode).toSorted((a, b) => (now(a.key)?.hue ?? 0) - (now(b.key)?.hue ?? 0));
  const rows = measured
    .map((m) => {
      const r = m.result;
      const current = now(m.key);
      const off = r && current ? hueTurn(current.hue, r.hue) : null;
      // Clearly off: the palette's hue is outside the range, both measured from the result.
      const clear = r?.sure && off !== null && (off - r.below > 0 || off + r.above < 0);
      return `<tr${clear ? ' class="clear"' : ""}>
        <th scope="row"><span class="dot" style="--c:${current?.color ?? "transparent"}"></span> ${ctx.label(m.key)}</th>
        <td class="mono">${String(m.count)}</td>
        <td class="mono">${r ? `${r.hue.toFixed(1)}°` : "—"}</td>
        <td class="mono soft">${r ? (r.sure ? `±${((r.below + r.above) / 2).toFixed(1)}°` : "unsure") : "—"}</td>
        <td class="mono">${current ? `${current.hue.toFixed(1)}°` : "—"}</td>
        <td class="mono">${off === null ? "—" : `${signed(off)}°`}</td>
      </tr>`;
    })
    .join("");
  const sure = Object.fromEntries(measured.flatMap((m) => (m.result?.sure ? [[m.key, Math.round(m.result.hue)]] : [])));
  const mine = runs()
    .flatMap((r, i) => (r.mode === ctx.mode ? [runItem(NAME, r, i, "colors")] : []))
    .join("");
  const name = ctx.mode;
  const count = Object.keys(sure).length;
  return `<section>
      <h2>Results, ${name} mode</h2>
      <p class="soft">The hue where each color leans toward neither neighbor, from every run below together. "Could be" is how far either way the answers can't rule out; a color in bold is clearly off, since the palette's hue is outside that range.</p>
      <div class="scroll"><table class="test-results"><thead><tr><th>Color</th><th>Answers</th><th>Measured</th><th>Could be</th><th>Palette</th><th>Off by</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${
        count
          ? `<p>Place the ${String(count)} color${count === 1 ? "" : "s"} with a sure result at the measured hue${count === 1 ? "" : "s"}; yellow's moves the anchor. <button type="button" data-hue-test="apply" data-hues='${JSON.stringify(sure)}'>Place them</button></p>`
          : `<p class="soft">No color has a sure result yet.</p>`
      }
      <p class="soft">Hues apply to both modes. One run is a rough answer; two or three, or a few people's, make it steadier.</p>
    </section>
    ${runsSection(NAME, mine)}`;
}

/* >-----------------------------------------< Events >-----------------------------------------< */

/**
 * Records an answer, moves that color's staircase, and shows the next color after a short blank,
 * so one color's afterimage doesn't tint the next.
 *
 * @param ctx     What the page shows.
 * @param answer  Which button was picked.
 */
function answer(ctx: HueTestContext, answer: Pick): void {
  const s = session;
  if (!s || s.resting) return;
  const t = s.trial;
  const picked = answer === "same" ? 0.5 : (answer === "left") === t.afterLeft ? 1 : 0;
  s.points.push({ key: t.stair.key, x: t.hue, y: picked });
  record(t.stair, { x: t.hue, y: picked }, t.check, REACH, { center: t.stair.hue, range: REACH + 10, half: HALF });
  const next = nextTrial(s, t.stair.key);
  if (!next) {
    keep([...runs(), { mode: s.mode, gamut: s.gamut, tier: s.tier, when: new Date().toISOString(), points: s.points }]);
    session = null;
    ctx.redraw();
    return;
  }
  s.trial = next;
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
export function bindHueTest(get: () => HueTestContext): void {
  bindBlind(get, {
    name: NAME,
    code: "hue test",
    runs: saved as { all(): Saved<unknown>[]; keep(list: Saved<unknown>[]): void },
    encode,
    decode,
    start,
    stop: () => (session = null),
    answer,
    apply: (ctx, el) => ctx.applyHues(JSON.parse(el.dataset.hues ?? "{}") as Record<string, number>),
    asking: () => Boolean(session && document.querySelector("#test-stage .test-single")),
  });
}
