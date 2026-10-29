/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< CHECK >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Settings that come from outside, saved by an older version of the site or pasted in: older       |
| shapes brought up to date, then every field checked, so a palette is only solved from settings   |
| that make sense. A field that's missing takes its default.                                       |
\*------------------------------------------------------------------------------------------------*/

import { forGamut, isBaseColor, pickProblem } from "./bases";
import { lightness } from "./model";
import { SYSTEMS } from "./references";
import {
  isOwnName,
  OWN_NAME,
  type CurvePoint,
  type CustomColor,
  GAMUTS,
  type NeutralColor,
  LIMITS,
  type Mode,
  MODES,
  ROLES,
  type Room,
  type Settings,
} from "./settings";
import { hueKeys } from "./solve";

/* >-----------------------------------------< Errors >-----------------------------------------< */

/** Why settings can't be used, in words. */
export class SettingsError extends Error {}

/**
 * Stops the check with what's wrong.
 *
 * @param text  What's wrong, as a sentence.
 */
function fail(text: string): never {
  throw new SettingsError(text);
}

/* >-----------------------------------------< Fields >-----------------------------------------< */

/** A number as people write it, with a true minus. */
const shown = (x: number) => (x < 0 ? `−${String(-x)}` : String(x));

/**
 * A number within its limits.
 *
 * @param value   The value.
 * @param name    What it is, for the message.
 * @param limits  The lowest and highest it may be.
 * @param whole   Whether it must be a whole number.
 * @returns       The number.
 */
function number(
  value: unknown,
  name: string,
  [low, high]: readonly [number, number],
  whole = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < low ||
    value > high ||
    (whole && !Number.isInteger(value))
  )
    fail(
      `${name} must be ${whole ? "a whole number" : "a number"} ${high === Infinity ? `of ${shown(low)} or more` : `from ${shown(low)} to ${shown(high)}`}.`,
    );
  return value;
}

/**
 * A hue in degrees.
 *
 * @param value  The value.
 * @param name   What it is, for the message.
 * @returns      The hue.
 */
const hue = (value: unknown, name: string) => number(value, name, [0, 360]);

/**
 * An object, as a record of its fields.
 *
 * @param value  The value.
 * @param name   What it is, for the message.
 * @returns      Its fields.
 */
function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${name} must be a set of named values.`);
  return value as Record<string, unknown>;
}

/**
 * A list.
 *
 * @param value  The value.
 * @param name   What it is, for the message.
 * @returns      Its items.
 */
function list(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) fail(`${name} must be a list.`);
  return value;
}

/**
 * A yes or no.
 *
 * @param value  The value.
 * @param name   What it is, for the message.
 * @returns      It.
 */
function flag(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") fail(`${name} must be true or false.`);
  return value;
}

/**
 * One value per mode.
 *
 * @param value  The value.
 * @param name   What it is, for the message.
 * @param each   Reads one mode's value, given its name.
 * @returns      Both modes' values.
 */
function perMode<T>(
  value: unknown,
  name: string,
  each: (v: unknown, mode: Mode) => T,
): Record<Mode, T> {
  const r = record(value, name);
  return { light: each(r.light, "light"), dark: each(r.dark, "dark") };
}

/**
 * A base: any CSS color.
 *
 * @param value  The value.
 * @param mode   Its mode.
 * @returns      It trimmed, six-digit hex in capitals.
 */
function base(value: unknown, mode: Mode): string {
  if (typeof value !== "string" || !isBaseColor(value.trim()))
    fail(
      `The ${mode} base must be a CSS color, like ${mode === "light" ? "#EBEBEB or color(display-p3 0.92 0.92 0.92)" : "#181818 or color(display-p3 0.09 0.09 0.09)"}.`,
    );
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : color;
}

/**
 * The colors picked per gamut tier for a base it can't show exactly: each one the tier's screens
 * can show, and still the same background as the base.
 *
 * @param value     The value.
 * @param settings  The bases and rooms, already checked.
 * @returns         The colors picked.
 */
function pickedBases(
  value: unknown,
  settings: Pick<Settings, "bases" | "rooms">,
): Settings["pickedBases"] {
  const given = record(value ?? {}, "The colors picked per gamut");
  return Object.fromEntries(
    GAMUTS.flatMap((g) => {
      if (given[g] === undefined) return [];
      const per = record(given[g], `The ${g} bases`);
      const modes = MODES.flatMap((m) => {
        if (per[m] === undefined) return [];
        const color = base(per[m], m);
        const problem = pickProblem(settings, m, g, color);
        if (problem) fail(problem);
        return [[m, color]];
      });
      return modes.length ? [[g, Object.fromEntries(modes)]] : [];
    }),
  );
}

/**
 * A room.
 *
 * @param value  The value.
 * @param mode   Its mode.
 * @returns      The room.
 */
function room(value: unknown, mode: Mode): Room {
  const r = record(value, `The ${mode} room`);
  const surround = r.surround;
  if (surround !== 0 && surround !== 1 && surround !== 2)
    fail(`The ${mode} surround must be 0 (dark), 1 (dim) or 2 (average).`);
  return { lux: number(r.lux, `The ${mode} room lux`, LIMITS.lux), surround };
}

/**
 * A point of the curve.
 *
 * @param value  The value.
 * @param name   Which point, for the message.
 * @returns      The point.
 */
function point(value: unknown, name: string): CurvePoint {
  const p = record(value, name);
  const checked = {
    amount: number(p.amount, `${name}: its amount`, LIMITS.amount),
    center: hue(p.center, `${name}: its center`),
    width: number(p.width, `${name}: its width`, LIMITS.width),
  };
  return p.off === undefined
    ? checked
    : { ...checked, off: flag(p.off, `${name}: whether it's off`) };
}

/**
 * A custom color.
 *
 * @param value  The value.
 * @param name   Which one, for the message.
 * @returns      The custom color.
 */
function custom(value: unknown, name: string): CustomColor {
  const e = record(value, name);
  if (typeof e.name !== "string" || !e.name.trim()) fail(`${name} needs a name.`);
  return {
    name: e.name.trim(),
    hue: hue(e.hue, `${name}: its hue`),
    share: number(e.share, `${name}: its colorfulness share`, LIMITS.share),
  };
}

/**
 * A neutral color.
 *
 * @param value  The value.
 * @param name   Which one, for the message.
 * @returns      The neutral color.
 */
function neutral(value: unknown, name: string): NeutralColor {
  const n = record(value, name);
  if (typeof n.name !== "string" || !n.name.trim()) fail(`${name} needs a name.`);
  return {
    name: n.name.trim(),
    share: number(n.share, `${name}: its share of the base's tint`, LIMITS.share),
  };
}

/* >--------------------------------------< Older shapes >--------------------------------------< */

/**
 * Settings saved by an older version, in today's shape, with defaults for what's missing and
 * nothing that no longer exists.
 *
 * @param given     The settings as given.
 * @param defaults  What a missing field takes.
 * @returns         Every field, not yet checked.
 */
function upgrade(given: Record<string, unknown>, defaults: Settings): Record<string, unknown> {
  const s: Record<string, unknown> = { ...defaults, ...given };
  // The anchor once held yellow's hue, per mode or as its home.
  const old = given as {
    yellowHue?: { light?: unknown };
    homes?: { yellow?: unknown };
    start?: unknown;
  };
  const yellow = old.homes?.yellow ?? old.yellowHue?.light ?? old.start;
  if (yellow !== undefined && given.anchor === undefined) s.anchor = yellow;
  // The identity tier was once one number for both modes.
  if (typeof s.identityTier === "number")
    s.identityTier = { light: s.identityTier, dark: s.identityTier };
  // Before it could be automatic, it defaulted to Lc 60 light and Lc 45 dark, which the automatic
  // choice gives on the default bases.
  const identity = s.identityTier as { light?: unknown; dark?: unknown } | undefined;
  if (identity?.light === 60 && identity.dark === 45)
    s.identityTier = { light: "auto", dark: "auto" };
  // Anything else from an older version is left out.
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, s[key]]));
}

/* >----------------------------------------< Settings >----------------------------------------< */

/**
 * Settings from outside, brought up to date and checked. The JSON export works too: its settings
 * are read.
 *
 * @param given     The settings, as parsed JSON.
 * @param defaults  What a missing field takes.
 * @returns         The settings.
 * @throws          {SettingsError} Saying what's wrong, when something is.
 */
export function readSettings(given: unknown, defaults: Settings): Settings {
  let outer = record(given, "The settings");
  if ("settings" in outer && "palette" in outer)
    outer = record(outer.settings, "The export's settings");
  const s = upgrade(outer, defaults);
  const systems = SYSTEMS.map((r) => r.id);
  const hues = number(s.hues, "How many hues", LIMITS.hues, true);
  const tiers = list(s.tiers, "The tiers").map((t) => {
    if (typeof t !== "number" || !(t in ROLES))
      fail(`Each tier must be one of Lc ${Object.keys(ROLES).join(", ")}.`);
    return t;
  });
  if (!tiers.length) fail("At least one tier is needed.");
  const solved = [...new Set(tiers)].toSorted((a, b) => a - b);
  // A mode's identity tier set by hand that isn't solved is left to the palette.
  const identityTier = perMode(s.identityTier, "The identity tier", (t) =>
    typeof t === "number" && solved.includes(t) ? t : "auto",
  );
  const anchor = s.anchor;
  const isHue = typeof anchor === "number" && anchor >= 0 && anchor <= 360;
  if (!isHue && !(typeof anchor === "string" && systems.includes(anchor)))
    fail(`The anchor must be one of ${systems.join(", ")}, or a hue from 0 to 360.`);
  // Hues placed under a count of hues that's since changed are kept out.
  const keys = hueKeys(hues);
  const placed = Object.fromEntries(
    Object.entries(record(s.placed, "The placed hues"))
      .filter(([key]) => keys.includes(key))
      .map(([key, h]) => [key, hue(h, `Where ${key} is placed`)]),
  );
  const reach = record(s.hueReach, "The hue reach");
  const bases = perMode(s.bases, "The bases", base);
  const rooms = perMode(s.rooms, "The rooms", room);
  const perGamut = pickedBases(s.pickedBases, { bases, rooms });
  for (const g of GAMUTS) {
    const on = forGamut({ bases, pickedBases: perGamut, rooms }, g).bases;
    if (lightness(on.light) <= lightness(on.dark))
      fail(
        `The light base must be lighter than the dark base${g === "standard" ? "" : ` on ${g} screens`}.`,
      );
  }
  if (typeof s.name !== "string" || s.name.trim().length > 60)
    fail("The name must be text of at most 60 characters.");
  const name = s.name.trim();
  if (isOwnName(name)) fail(`${OWN_NAME} is EK Colors' own palette; the name must be another.`);
  return {
    bases,
    pickedBases: perGamut,
    rooms,
    colorfulness: number(s.colorfulness, "Target M", LIMITS.colorfulness),
    equalTiers: flag(s.equalTiers, "Equal per tier"),
    colorfulnessPerHue: perMode(s.colorfulnessPerHue, "Colorfulness per hue", (c, m) =>
      list(c, `The ${m} curve`).map((p, i) => point(p, `Point ${String(i + 1)} of the ${m} curve`)),
    ),
    hues,
    tiers: solved,
    identityTier,
    mutedShare: number(s.mutedShare, "Muted share", LIMITS.mutedShare),
    customColors: list(s.customColors, "The custom colors").map((e, i) =>
      custom(e, `Custom color ${String(i + 1)}`),
    ),
    neutralColors: list(s.neutralColors, "The neutral colors").map((n, i) =>
      neutral(n, `Neutral color ${String(i + 1)}`),
    ),
    hueReach: {
      identity: number(reach.identity, "The identity tier's hue reach", LIMITS.hueReach),
      tier: number(reach.tier, "The other tiers' hue reach", LIMITS.hueReach),
    },
    anchor: anchor as string | number,
    placed,
    name,
  };
}
