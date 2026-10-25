/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< HUE TEST >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The blind hue test: one color at a time, without its name, a few degrees either side of where    |
| the palette puts it, and the question which of its two neighbors it leans toward. Each color has |
| its own staircase that closes in on the hue where it leans neither way, the middle of its name;  |
| those hues, with how sure each one is, can be placed.                                            |
\*------------------------------------------------------------------------------------------------*/

import { makeModel, type Model } from "../palette/model";
import { type Gamut, type Mode, NAMES, type Settings } from "../palette/settings";
import { boost, type GamutPalette, strongest } from "../palette/solve";
import { ask, balance, CAP, fromCode, progressBar, record, type Stair as Staircase, savedRuns, stair, toCode } from "./blind";

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
interface Run {
  readonly mode: Mode;
  readonly gamut: Gamut;
  readonly tier: number;
  readonly when: string;
  readonly points: readonly Point[];
}

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
  const open = s.stairs.filter((t) => !t.done);
  if (!open.length) return null;
  const choices = open.length > 1 ? open.filter((t) => t.key !== last) : open;
  const chosen = choices[Math.floor(Math.random() * choices.length)]!;
  const { offset, check } = ask(chosen, FAR);
  const hue = chosen.hue + offset;
  const at = ((hue % 360) + 360) % 360;
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
  const tier = ctx.settings.identityTier[ctx.mode];
  const colors = palette.colors
    .filter((c) => !c.extra)
    .map((c) => ({ key: c.key, hue: c.tiers[tier]!.default.hue }))
    .toSorted((a, b) => a.hue - b.hue);
  const signs = colors.map((_, i) => (i % 2 ? 1 : -1)).toSorted(() => Math.random() - 0.5);
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
  const byKey = new Map<string, Point[]>();
  for (const run of runs().filter((r) => r.mode === mode))
    for (const p of run.points) byKey.set(p.key, [...(byKey.get(p.key) ?? []), p]);
  return [...byKey].map(([key, points]) => {
    // Runs can sit on either side of 0°; every answer is brought next to the first.
    const near = points[0]!.x;
    const unwrapped = points.map((p) => ({ ...p, x: near + ((((p.x - near) % 360) + 540) % 360) - 180 }));
    const center = unwrapped.reduce((s, p) => s + p.x, 0) / unwrapped.length;
    const found = balance(unwrapped, Math.round(center), REACH + 10);
    const wrap = (h: number) => ((h % 360) + 360) % 360;
    return { key, count: points.length, result: found && { hue: wrap(found.at), low: found.low, high: found.high, sure: found.sure } };
  });
}

/* >---------------------------------------< Saved runs >---------------------------------------< */

const saved = savedRuns<Run>("ek-colors:hue-tests");
const runs = () => saved.all();
const keep = (list: Run[]) => saved.keep(list);

/**
 * A run as a short code to send.
 *
 * @param run  The run.
 * @returns    The code.
 */
function encode(run: Run): string {
  const points = run.points.map((p) => [p.key, Math.round(p.x * 10) / 10, p.y]);
  return toCode(["hue", run.mode, run.gamut, run.tier, run.when, points]);
}

/**
 * A run from its code.
 *
 * @param code  The code.
 * @returns     The run, or null when it isn't one.
 */
function decode(code: string): Run | null {
  const value = fromCode(code);
  if (!Array.isArray(value) || value[0] !== "hue" || !Array.isArray(value[5])) return null;
  const [, mode, gamut, tier, when, points] = value as [string, Mode, Gamut, number, string, [string, number, number][]];
  return { mode, gamut, tier, when, points: points.map(([key, x, y]) => ({ key, x, y })) };
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
  const mode = ctx.label(ctx.mode).toLowerCase();
  const done = runs().filter((r) => r.mode === ctx.mode);
  const named = ctx.settings.hues === NAMES.length;
  const ready = Boolean(ctx.palette) && named;
  return `<section class="intro">
      <h1>Blind hue test</h1>
      <p>Measures where each ${mode}-mode color looks most like its name, to place it. One color at a time, without its name: say which of its two neighbors it leans toward, or neither. Up to ${String(CAP * NAMES.length)} colors, fewer once the answers settle; usually about five minutes. Each color's answers close in on the hue where it leans neither way, the middle of its name, with an easy one now and then to check the answers depend on what's shown.</p>
      <ul class="soft checklist">
        <li>Turn off True Tone and Night Shift, and use the usual brightness.</li>
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
  const tier = ctx.settings.identityTier[ctx.mode];
  const now = (key: string) => ctx.palette?.[ctx.mode].colors.find((c) => c.key === key)?.tiers[tier]?.default;
  const measured = pooled(ctx.mode).toSorted((a, b) => (now(a.key)?.hue ?? 0) - (now(b.key)?.hue ?? 0));
  const sign = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
  const rows = measured
    .map((m) => {
      const r = m.result;
      const current = now(m.key);
      const off = r && current ? ((((r.hue - current.hue) % 360) + 540) % 360) - 180 : null;
      const clear = r?.sure && current && (r.low > current.hue || r.high < current.hue);
      return `<tr${clear ? ' class="clear"' : ""}>
        <th scope="row"><span class="dot" style="--c:${current?.color ?? "transparent"}"></span> ${ctx.label(m.key)}</th>
        <td class="mono">${String(m.count)}</td>
        <td class="mono">${r ? `${r.hue.toFixed(1)}°` : "—"}</td>
        <td class="mono soft">${r ? (r.sure ? `±${((r.high - r.low) / 2).toFixed(1)}°` : "unsure") : "—"}</td>
        <td class="mono">${current ? `${current.hue.toFixed(1)}°` : "—"}</td>
        <td class="mono">${off === null ? "—" : `${sign(off)}°`}</td>
      </tr>`;
    })
    .join("");
  const sure = Object.fromEntries(measured.flatMap((m) => (m.result?.sure ? [[m.key, Math.round(m.result.hue)]] : [])));
  const mine = runs()
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.mode === ctx.mode)
    .map(
      ({ r, i }) => `<li><span class="mono">${new Date(r.when).toLocaleString()}</span> · ${String(r.points.length)} colors · ${r.gamut}, Lc ${String(r.tier)}
        <button type="button" data-hue-test="copy" data-run="${String(i)}">Copy code</button>
        <button type="button" data-hue-test="remove" data-run="${String(i)}">Remove</button></li>`,
    )
    .join("");
  const name = ctx.label(ctx.mode).toLowerCase();
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
    <section>
      <h2>Runs</h2>
      <ul class="test-runs">${mine}</ul>
      <p class="soft">Send someone the link; when they finish, they copy their code and send it to you. Paste it here to add their answers.</p>
      <div class="row"><input id="hue-test-code" class="test-code" type="text" placeholder="Paste a code" spellcheck="false"><button type="button" data-hue-test="add">Add</button><span id="hue-test-message" class="soft" role="status"></span></div>
    </section>`;
}

/* >-----------------------------------------< Events >-----------------------------------------< */

/**
 * Records an answer, moves that color's staircase, and shows the next color after a short blank,
 * so one color's afterimage doesn't tint the next.
 *
 * @param ctx     What the page shows.
 * @param answer  Which button was picked.
 */
function answer(ctx: HueTestContext, answer: "left" | "right" | "same"): void {
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
  document.addEventListener("click", (event) => {
    const el = (event.target as Element).closest<HTMLElement>("[data-hue-test]");
    if (!el) return;
    const ctx = get();
    const action = el.dataset.hueTest!;
    if (action === "left" || action === "right" || action === "same") return answer(ctx, action);
    if (action === "start" && !start(ctx)) return;
    if (action === "stop") session = null;
    if (action === "apply") ctx.applyHues(JSON.parse(el.dataset.hues ?? "{}") as Record<string, number>);
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
      const run = decode(document.querySelector<HTMLInputElement>("#hue-test-code")?.value ?? "");
      if (!run) {
        const message = document.querySelector("#hue-test-message");
        if (message) message.textContent = "That isn't a hue test code. Copy it again and paste the whole code.";
        return;
      }
      keep([...runs(), run]);
    }
    ctx.redraw();
  });

  document.addEventListener("keydown", (event) => {
    if (!session || !document.querySelector("#test-stage .test-single")) return;
    const keys: Record<string, "left" | "right" | "same"> = { ArrowLeft: "left", ArrowRight: "right", ArrowDown: "same" };
    const picked = keys[event.key];
    if (!picked) return;
    event.preventDefault();
    answer(get(), picked);
  });
}
