/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< SETTINGS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Everything a palette is solved from, with EK Colors' defaults: the bases and the room each mode  |
| is seen in, the colorfulness target, whether tiers are equally colorful, the curve over hue per  |
| mode, how many hues and where they're anchored and placed, the APCA tiers and the identity tier  |
| per mode, how far hues may move, the muted share, any extra colors, and the reference system     |
| drawn as guides.                                                                                 |
\*------------------------------------------------------------------------------------------------*/

/* >-----------------------------------------< Types >------------------------------------------< */

export const MODES = ["light", "dark"] as const;

export type Mode = (typeof MODES)[number];

/** How much color a screen can show: every screen, most new ones, and the widest. */
export const GAMUTS = ["standard", "wide", "ultra"] as const;

export type Gamut = (typeof GAMUTS)[number];

/* >-----------------------------------------< Names >------------------------------------------< */

/** Each mode as people read it. */
export const MODE_NAMES: Readonly<Record<Mode, string>> = { light: "Light", dark: "Dark" };

/** Each gamut tier as people read it. */
export const GAMUT_NAMES: Readonly<Record<Gamut, string>> = {
  standard: "Standard",
  wide: "Wide",
  ultra: "Ultra",
};

/** Each CAM16 surround, by its number. */
export const SURROUNDS = ["Dark", "Dim", "Average"] as const;

/** What each tier is for. */
export const ROLES: Readonly<Record<number, string>> = {
  15: "Dividers and faint fills",
  30: "Icons, outlines and controls",
  45: "Large text and the color itself",
  60: "Labels and links",
  75: "Body text",
  90: "Long reading",
};

/** Where a mode's colors are seen: how bright the room is, and how bright its surround is. */
export interface Room {
  /** Ambient light in lux. */
  readonly lux: number;

  /** CAM16 surround: 0 dark, 1 dim, 2 average (lit room). */
  readonly surround: number;
}

/** One point of the curve: colorfulness added around a hue, easing to none on either side. */
export interface CurvePoint {
  /** Colorfulness added at the center; below zero takes some away. */
  readonly amount: number;

  /** CAM16 hue where the most is added. */
  readonly center: number;

  /** How far from the center, in degrees, the addition reaches none. */
  readonly width: number;

  /** Whether it's switched off for now: kept, but adding nothing. */
  readonly off?: boolean;
}

/** A color outside the evenly spaced hues: it stays on its own hue at a share of the colorfulness. */
export interface Extra {
  /** What it's called. */
  readonly name: string;

  /** The CAM16 hue it stays on. */
  readonly hue: number;

  /** Its colorfulness, as a share of the tier's target. */
  readonly share: number;
}

export interface Settings {
  /** The backgrounds colors are read on. */
  readonly bases: Readonly<Record<Mode, string>>;

  /** The room each mode is seen in. */
  readonly rooms: Readonly<Record<Mode, Room>>;

  /** CAM16 colorfulness (M) every color aims at, in both modes. */
  readonly colorfulness: number;

  /** Whether a tier lowers its target to what its least colorful hue can reach. */
  readonly equalTiers: boolean;

  /**
   * Per mode, colorfulness added or taken away smoothly over hue, for colors that look weaker or
   * stronger than the model says: the sum of its points.
   */
  readonly curve: Readonly<Record<Mode, readonly CurvePoint[]>>;

  /** How many hues share the circle; 8 are named red to pink, any other number Hue 1, Hue 2 and so on. */
  readonly hues: number;

  /** The APCA contrasts every hue gets a color for. */
  readonly tiers: readonly number[];

  /** Per mode, the tier whose color stands for the hue and sets every tier's hues. */
  readonly identityTier: Readonly<Record<Mode, number>>;

  /** Muted colorfulness, as a share of the default's. */
  readonly muted: number;

  /** Colors added beside the hues, each on its own hue; they aren't spaced. */
  readonly extras: readonly Extra[];

  /** How far a hue may move to even out the spacing: on the identity tier, then per tier. */
  readonly hueWindow: Readonly<{ identity: number; tier: number }>;

  /**
   * Where the lineup sits: the first color (yellow, with eight) stays exactly on this hue, and the
   * circle is divided evenly from there. A reference system's id uses that system's yellow; a
   * number is a CAM16 hue.
   */
  readonly anchor: string | number;

  /**
   * Colors placed by hand at a CAM16 hue, shared by both modes. A placed color stays exactly where
   * it is; the others are spaced evenly around the placed ones.
   */
  readonly placed: Readonly<Record<string, number>>;

  /** The reference system whose hues are drawn as guides (see references.ts). */
  readonly guide: string;
}

/* >----------------------------------------< Defaults >----------------------------------------< */

/*
 * The bases come from depth (8px of height is one just-noticeable OKLab lightness step below
 * white; dark is the light base's contrast mirror). The rooms are sRGB's: its typical environment
 * (200 lux, a lit room) for light mode and its reference environment (64 lux, dim) for dark mode.
 */
export const DEFAULTS: Settings = {
  bases: { light: "#EBEBEB", dark: "#181818" },
  rooms: { light: { lux: 200, surround: 2 }, dark: { lux: 64, surround: 1 } },
  colorfulness: 40,
  equalTiers: true,
  curve: { light: [], dark: [] },
  hues: 8,
  tiers: [15, 30, 45, 60, 75, 90],
  identityTier: { light: 60, dark: 45 },
  muted: 0.5,
  extras: [],
  hueWindow: { identity: 20, tier: 6 },
  anchor: "ncs",
  placed: {},
  guide: "cam16",
};

/** The eight hues' names, in hue order. */
export const NAMES = [
  "red",
  "orange",
  "yellow",
  "green",
  "mint",
  "blue",
  "purple",
  "pink",
] as const;

/* >----------------------------------------< Codemos >-----------------------------------------< */

/** Codemos's colors, the palette this one replaces, for the comparison. */
export const CODEMOS: Readonly<Record<Mode, Readonly<Record<string, string>>>> = {
  light: {
    red: "#B70004",
    orange: "#9F5500",
    yellow: "#7D7000",
    green: "#006904",
    mint: "#006560",
    blue: "#0052C6",
    purple: "#7700EE",
    pink: "#AC0074",
    brown: "#784F3F",
  },
  dark: {
    red: "#EF6363",
    orange: "#D28342",
    yellow: "#BFAF40",
    green: "#45AA41",
    mint: "#46A598",
    blue: "#4B9ECD",
    purple: "#9B87EA",
    pink: "#ED63BA",
    brown: "#CB8569",
  },
};

/** Codemos's muted colors, for the comparison. */
export const CODEMOS_MUTED: Readonly<Record<Mode, Readonly<Record<string, string>>>> = {
  light: {
    red: "#C35354",
    orange: "#8D7252",
    yellow: "#7D7852",
    green: "#528256",
    mint: "#567E7C",
    blue: "#5B79A2",
    purple: "#8E64B9",
    pink: "#AF5A92",
  },
  dark: {
    red: "#D19797",
    orange: "#C59E7F",
    yellow: "#ADA77F",
    green: "#80B27F",
    mint: "#83AEA8",
    blue: "#87ABC0",
    purple: "#A9A0CB",
    pink: "#CD95B8",
  },
};
