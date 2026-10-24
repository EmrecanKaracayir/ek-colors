/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< BLIND >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the blind tests share: a staircase per color that closes in on where the answers turn, a    |
| logistic fit that reads that point with how sure it is, and finished runs kept in this browser   |
| and passed between people as short codes.                                                        |
\*------------------------------------------------------------------------------------------------*/

/** One answer: where the test stood, and how it was answered (1, 0, or ½ for "can't tell"). */
export interface Answer {
  readonly x: number;
  readonly y: number;
}

/** One color's staircase: where it is, how big a step it takes, and how often it has turned. */
export interface Stair {
  readonly key: string;
  delta: number;
  step: number;
  turns: number;
  last: number;
  count: number;
}

/**
 * A staircase starting away from the answer, by `offset` on either side.
 *
 * @param key     The color.
 * @param offset  How far from the start it begins, signed.
 * @returns       The staircase.
 */
export function stair(key: string, offset: number): Stair {
  return { key, delta: offset, step: 4, turns: 0, last: 0, count: 0 };
}

/**
 * Moves a staircase after an answer: down after a 1, up after a 0, in smaller steps once it has
 * turned (4, then 2 after two turns, then 1 after four).
 *
 * @param s       The staircase.
 * @param picked  1, 0 or ½.
 * @param reach   How far it may go either way.
 */
export function climb(s: Stair, picked: number, reach: number): void {
  s.count++;
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
  const sure = low > center - range && high < center + range && peak.likelihood - flat >= 1.92;
  return { at: peak.at, low, high, sure };
}

/**
 * Finished runs kept in this browser.
 *
 * @param key  The storage key.
 * @returns    Reading and saving them.
 */
export function savedRuns<Run>(key: string) {
  let memory: Run[] = [];
  return {
    all(): Run[] {
      try {
        return JSON.parse(localStorage.getItem(key) ?? "[]") as Run[];
      } catch {
        return memory;
      }
    },
    keep(list: Run[]): void {
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
export function toCode(value: unknown): string {
  return btoa(JSON.stringify(value));
}

/**
 * A value from its code.
 *
 * @param code  The code.
 * @returns     The value, or null when it isn't one.
 */
export function fromCode(code: string): unknown {
  try {
    return JSON.parse(atob(code.trim()));
  } catch {
    return null;
  }
}
