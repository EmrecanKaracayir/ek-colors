/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< BLIND >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the blind tests share: a staircase per color that closes in on where the answers turn, with |
| an easy check question now and then; a logistic fit that reads that point with how sure it is; a |
| color done once it settles or reaches the cap; and finished runs kept in this browser and passed |
| between people as short codes.                                                                   |
\*------------------------------------------------------------------------------------------------*/

import { type Gamut, GAMUTS, type Mode, MODES } from "../../palette/settings";
import { announce, copyText, flash } from "../dom";

/** One answer: where the test stood, and how it was answered (1, 0, or ½ for "can't tell"). */
interface Answer {
  readonly x: number;
  readonly y: number;
}

/** Most answers a color gets in one run. */
export const CAP = 16;

/** Fewest answers before a color can settle. */
const MIN = 8;

/** Every this many questions for a color, one is a check well to one side of where it stands. */
const CHECK_EVERY = 3;

/**
 * One color's staircase: where it is, how big a step it takes, how often it has turned, its answers
 * in this run, and whether it's done.
 */
export interface Stair {
  readonly key: string;
  delta: number;
  step: number;
  turns: number;
  last: number;
  done: boolean;
  readonly answers: Answer[];
}

/** How a color's answers are read: the range searched and how narrow its result must be to settle. */
export interface Fit {
  readonly center: number;
  readonly range: number;
  readonly half: number;
}

/**
 * A staircase starting away from the answer, by `offset` on either side.
 *
 * @param key     The color.
 * @param offset  How far from the start it begins, signed.
 * @returns       The staircase.
 */
export function stair(key: string, offset: number): Stair {
  return { key, delta: offset, step: 4, turns: 0, last: 0, done: false, answers: [] };
}

/**
 * A list in random order, every order equally likely.
 *
 * @param list  The list.
 * @returns     A shuffled copy.
 */
function shuffled<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Which side each staircase starts on: half below, half above, in random order.
 *
 * @param n  How many staircases.
 * @returns  −1 or 1 for each.
 */
export function startSides(n: number): number[] {
  return shuffled(Array.from({ length: n }, (_, i) => (i % 2 ? 1 : -1)));
}

/**
 * The staircase to ask next: one that isn't done, never the one just asked while another is open.
 *
 * @param stairs  Every staircase.
 * @param last    The key asked last, if any.
 * @returns       The staircase, or null when every one is done.
 */
export function nextStair<S extends Stair>(stairs: readonly S[], last?: string): S | null {
  const open = stairs.filter((s) => !s.done);
  const choices = open.length > 1 ? open.filter((s) => s.key !== last) : open;
  return choices[Math.floor(Math.random() * choices.length)] ?? null;
}

/**
 * Where a color's next question stands: at its staircase, or every third time a check `far` to a
 * random side, which a real observer answers easily and a guess doesn't.
 *
 * @param s    The staircase.
 * @param far  How far to one side a check stands.
 * @returns    The offset to show and whether it's a check.
 */
export function ask(s: Stair, far: number): { offset: number; check: boolean } {
  const check = s.answers.length % CHECK_EVERY === CHECK_EVERY - 1;
  return { offset: check ? s.delta + (Math.random() < 0.5 ? -far : far) : s.delta, check };
}

/**
 * Records an answer: a check doesn't move the staircase, the rest do. The color is done at the cap,
 * or sooner once it settles: enough answers, a narrow result, and answers that clearly depend on
 * what was shown (beating a flat guess by 4, stricter than a final result's 1.92, since it's
 * checked after every answer).
 *
 * @param s       The staircase.
 * @param a       The answer, x as the fit reads it.
 * @param check   Whether it was a check.
 * @param reach   How far the staircase may go either way.
 * @param fit     How the answers are read.
 */
export function record(s: Stair, a: Answer, check: boolean, reach: number, fit: Fit): void {
  s.answers.push(a);
  if (!check) climb(s, a.y, reach);
  if (s.answers.length >= CAP) {
    s.done = true;
    return;
  }
  if (s.answers.length < MIN) return;
  const found = balance(s.answers, fit.center, fit.range);
  s.done = Boolean(found?.sure && (found.high - found.low) / 2 <= fit.half && found.gain >= 4);
}

/**
 * How far a run is, from 0 to 1: a done color counts in full, the others by their answers so far.
 *
 * @param stairs  Every color's staircase.
 * @returns       The share done.
 */
function progress(stairs: readonly Stair[]): number {
  return stairs.reduce((sum, s) => sum + (s.done ? 1 : s.answers.length / CAP), 0) / stairs.length;
}

/**
 * The progress bar shown during a run.
 *
 * @param stairs  Every color's staircase.
 * @returns       HTML.
 */
export function progressBar(stairs: readonly Stair[]): string {
  const share = progress(stairs);
  const done = stairs.filter((s) => s.done).length;
  return `<div class="test-progress" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${String(Math.round(share * 100))}">
      <span style="--p:${share.toFixed(4)}"></span></div>
    <p class="soft">${String(Math.round(share * 100))}% • ${String(done)} of ${String(stairs.length)} colors done</p>`;
}

/**
 * Moves a staircase after an answer: down after a 1, up after a 0, in smaller steps once it has
 * turned (4, then 2 after two turns, then 1 after four).
 *
 * @param s       The staircase.
 * @param picked  1, 0 or ½.
 * @param reach   How far it may go either way.
 */
function climb(s: Stair, picked: number, reach: number): void {
  if (picked === 0.5) return;
  const direction = picked === 1 ? -1 : 1;
  if (s.last && direction !== s.last) {
    s.turns++;
    s.step = s.turns >= 4 ? 1 : s.turns >= 2 ? 2 : 4;
  }
  s.last = direction;
  s.delta = Math.max(-reach, Math.min(reach, s.delta + direction * s.step));
}

/**
 * Where the answers turn, and how sure that is: a logistic curve fitted to them, read where either
 * answer is equally likely, with the range the answers can't tell apart from it (a likelihood drop
 * of 1.92, about 95%). It's only sure when that range is pinned down and the curve explains the
 * answers clearly better than a flat guess at their average does, by the same 1.92.
 *
 * @param answers  One color's answers.
 * @param center   The middle of the range searched.
 * @param range    How far either side of the middle to search.
 * @returns        The point with a low and high bound, and whether the range is pinned down.
 */
export function balance(answers: readonly Answer[], center: number, range: number) {
  if (answers.length < 4) return null;
  const profile: { at: number; likelihood: number }[] = [];
  for (let at = center - range; at <= center + range; at += 0.5) {
    let best = -Infinity;
    // Wide spreads let answers that barely depend on x (guessing) come out unsure.
    for (const spread of [1.5, 2.5, 4, 6, 10, 20, 40]) {
      let likelihood = 0;
      for (const a of answers) {
        const chance = Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-(a.x - at) / spread))));
        likelihood += a.y * Math.log(chance) + (1 - a.y) * Math.log(1 - chance);
      }
      best = Math.max(best, likelihood);
    }
    profile.push({ at, likelihood: best });
  }
  const peak = profile.reduce((a, b) => (b.likelihood > a.likelihood ? b : a));
  const inside = profile.filter((p) => p.likelihood >= peak.likelihood - 1.92).map((p) => p.at);
  const [low, high] = [Math.min(...inside), Math.max(...inside)];
  // Answers that don't depend on x (guessing) are explained as well by their average alone.
  const mean = Math.min(0.99, Math.max(0.01, answers.reduce((s, a) => s + a.y, 0) / answers.length));
  const flat = answers.reduce((s, a) => s + a.y * Math.log(mean) + (1 - a.y) * Math.log(1 - mean), 0);
  // A range that runs off the end can't be pinned down either.
  const gain = peak.likelihood - flat;
  const sure = low > center - range && high < center + range && gain >= 1.92;
  return { at: peak.at, low, high, sure, gain };
}

/* >-----------------------------------------< Runs >-------------------------------------------< */

/** A finished run: where it was taken and its answers. */
export interface Run<P> {
  readonly mode: Mode;
  readonly gamut: Gamut;
  readonly tier: number;
  readonly when: string;
  readonly points: readonly P[];
}

/**
 * A run's answers pooled by color, from every saved run of a mode.
 *
 * @param runs  The saved runs.
 * @param mode  The mode.
 * @returns     Each color's answers.
 */
export function pool<P extends { readonly key: string }>(runs: readonly Run<P>[], mode: Mode): Map<string, P[]> {
  const byKey = new Map<string, P[]>();
  for (const run of runs) if (run.mode === mode) for (const p of run.points) byKey.set(p.key, [...(byKey.get(p.key) ?? []), p]);
  return byKey;
}

/**
 * Finished runs kept in this browser. Only whole, plain runs are read back.
 *
 * @param key    The storage key.
 * @param plain  Whether one answer is plain.
 * @returns      Reading and saving them.
 */
export function savedRuns<P>(key: string, plain: (point: P) => boolean) {
  let memory: Run<P>[] = [];
  return {
    all(): Run<P>[] {
      try {
        const list = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
        return Array.isArray(list) ? (list as Run<P>[]).filter((r) => plainRun(r) && r.points.every(plain)) : [];
      } catch {
        return memory;
      }
    },
    keep(list: Run<P>[]): void {
      memory = list;
      try {
        localStorage.setItem(key, JSON.stringify(list));
      } catch {
        // Storage can be blocked; the runs then last until the page closes.
      }
    },
  };
}

/**
 * A value as a short code to send.
 *
 * @param value  Plain JSON.
 * @returns      The code.
 */
function toCode(value: unknown): string {
  return btoa(JSON.stringify(value));
}

/**
 * A run from its code, checked through: codes come from other people, so anything that isn't a
 * whole, plain run is refused rather than shown or kept.
 *
 * @param code   The code.
 * @param tag    The test's tag, the code's first entry.
 * @param point  Reads one answer, or null when it isn't one.
 * @returns      The run, or null when the code isn't one.
 */
export function decodeRun<P>(code: string, tag: string, point: (value: unknown) => P | null): Run<P> | null {
  let value: unknown;
  try {
    value = JSON.parse(atob(code.trim()));
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length !== 6 || value[0] !== tag || !Array.isArray(value[5])) return null;
  const [, mode, gamut, tier, when, list] = value as [unknown, Mode, Gamut, number, string, unknown[]];
  const points = list.map(point);
  if (points.some((p) => p === null)) return null;
  const run = { mode, gamut, tier, when, points: points as P[] };
  return plainRun(run) ? run : null;
}

/**
 * Whether a run is a whole, plain one: a mode, a gamut tier, a tier, a time, and answers. Runs
 * saved in this browser are read through it too.
 *
 * @param run  The run, as read.
 * @returns    True when it is.
 */
function plainRun(run: Run<unknown>): boolean {
  return (
    MODES.includes(run.mode) &&
    GAMUTS.includes(run.gamut) &&
    typeof run.tier === "number" &&
    Number.isFinite(run.tier) &&
    typeof run.when === "string" &&
    !Number.isNaN(Date.parse(run.when)) &&
    Array.isArray(run.points) &&
    run.points.length > 0
  );
}

/**
 * A run as a code: its tag first, then where it was taken, then its answers.
 *
 * @param tag     The test's tag.
 * @param run     The run.
 * @param points  Its answers as plain lists.
 * @returns       The code.
 */
export function encodeRun(tag: string, run: Run<unknown>, points: readonly unknown[]): string {
  return toCode([tag, run.mode, run.gamut, run.tier, run.when, points]);
}

/**
 * Whether an answer's parts are what codes hold: a color's key, finite numbers, and 0, ½ or 1.
 *
 * @param key      The color's key.
 * @param numbers  Its numbers.
 * @param y        The answer.
 * @returns        True when they are.
 */
export function plainAnswer(key: unknown, numbers: readonly unknown[], y: unknown): boolean {
  return typeof key === "string" && /^[a-z0-9-]+$/.test(key) && numbers.every((n) => typeof n === "number" && Number.isFinite(n)) && (y === 0 || y === 0.5 || y === 1);
}

/* >-----------------------------------------< Page >-------------------------------------------< */

/** How an answer is given: one side, the other, or neither. */
export type Pick = "left" | "right" | "same";

/**
 * The answer a key gives, if any: ←, → and ↓, pressed on their own.
 *
 * @param event  The key press.
 * @returns      The answer, or null.
 */
function pickOf(event: KeyboardEvent): Pick | null {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return null;
  return ({ ArrowLeft: "left", ArrowRight: "right", ArrowDown: "same" } as const)[event.key as "ArrowLeft"] ?? null;
}

/**
 * A run in a test's list of runs, with a button to copy its code and one to remove it.
 *
 * @param name  The test's name: its data attribute and ids.
 * @param run   The run.
 * @param i     Its place among the saved runs.
 * @param unit  What its answers are, e.g. "pairs".
 * @returns     HTML.
 */
export function runItem(name: string, run: Run<unknown>, i: number, unit: string): string {
  const when = new Date(run.when).toLocaleString();
  return `<li><span class="mono">${when}</span> • ${String(run.points.length)} ${unit} • ${run.gamut}, Lc ${String(run.tier)}<button type="button" data-${name}="copy" data-run="${String(i)}" aria-label="Copy the code of the run from ${when}">Copy code</button><button type="button" data-${name}="remove" data-run="${String(i)}" aria-label="Remove the run from ${when}">Remove</button></li>`;
}

/**
 * The Runs section: the runs so far and a field to add someone else's by its code.
 *
 * @param name   The test's name: its data attribute and ids.
 * @param items  The runs, as list items.
 * @returns      HTML.
 */
export function runsSection(name: string, items: string): string {
  return `<section>
      <h2>Runs</h2>
      <ul class="test-runs">${items}</ul>
      <p class="soft">Send someone the link; when they finish, they copy their code and send it to you. Paste it here to add their answers.</p>
      <div class="row"><input id="${name}-code" class="test-code" type="text" placeholder="Paste a code" aria-label="A run's code" spellcheck="false"><button type="button" data-${name}="add">Add</button><span id="${name}-message" class="soft" role="status"></span></div>
    </section>`;
}

/** What a test gives the page's clicks and keys. */
interface Controls<C> {
  /** Its name: its data attribute and ids. */
  readonly name: string;

  /** What its codes are called, for the message when one isn't. */
  readonly code: string;

  readonly runs: { all(): Run<unknown>[]; keep(list: Run<unknown>[]): void };
  readonly encode: (run: Run<never>) => string;
  readonly decode: (code: string) => Run<unknown> | null;
  readonly start: (ctx: C) => boolean;
  readonly stop: () => void;
  readonly answer: (ctx: C, pick: Pick) => void;
  readonly apply: (ctx: C, el: HTMLElement) => void;

  /** Whether its question is on screen, so its keys answer it. */
  readonly asking: () => boolean;
}

/**
 * Makes a test's page respond to clicks and keys: answering, starting and stopping, applying the
 * result, and copying, removing and adding runs.
 *
 * @param get   What the page shows now, and how to draw it again.
 * @param test  The test.
 */
export function bindBlind<C extends { readonly redraw: () => void }>(get: () => C, test: Controls<C>): void {
  document.addEventListener("click", (event) => {
    const el = (event.target as Element).closest<HTMLElement>(`[data-${test.name}]`);
    if (!el) return;
    const ctx = get();
    const action = el.getAttribute(`data-${test.name}`)!;
    if (action === "left" || action === "right" || action === "same") return test.answer(ctx, action);
    if (action === "start" && !test.start(ctx)) return;
    if (action === "stop") test.stop();
    if (action === "apply") test.apply(ctx, el);
    if (action === "remove") test.runs.keep(test.runs.all().filter((_, i) => i !== Number(el.dataset.run)));
    if (action === "copy") {
      const run = test.runs.all()[Number(el.dataset.run)];
      if (run)
        copyText(test.encode(run as Run<never>), (copied) => {
          el.textContent = copied ? "Copied" : "Copying isn't allowed here";
          announce(el.textContent);
        });
      return;
    }
    if (action === "add") {
      const run = test.decode(document.querySelector<HTMLInputElement>(`#${test.name}-code`)?.value ?? "");
      if (!run) return flash(document.querySelector(`#${test.name}-message`), `That isn't a ${test.code} code. Copy it again and paste the whole code.`);
      test.runs.keep([...test.runs.all(), run]);
    }
    ctx.redraw();
  });
  document.addEventListener("keydown", (event) => {
    const pick = pickOf(event);
    if (!pick || !test.asking()) return;
    event.preventDefault();
    test.answer(get(), pick);
  });
}
