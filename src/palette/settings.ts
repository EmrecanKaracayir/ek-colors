/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< SETTINGS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Everything a palette is solved from, with EK Colors' defaults: bases, the two viewing rooms, the |
| colorfulness target and its curve over hue, the yellow anchor per mode, how many hues, the       |
| APCA tiers and the muted share.                                                                  |
\*------------------------------------------------------------------------------------------------*/

/* >-----------------------------------------< Types >------------------------------------------< */

export type Mode = "light" | "dark";

export const MODES = ["light", "dark"] as const satisfies readonly Mode[];

/** How much color a screen can show: every screen, most new ones, and the widest. */
export type Gamut = "standard" | "wide" | "ultra";

export const GAMUTS = ["standard", "wide", "ultra"] as const satisfies readonly Gamut[];

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

  /** Yellow's CAM16 hue, the anchor the others are spaced from. */
  readonly yellowHue: Readonly<Record<Mode, number>>;

  /** How many hues share the circle; 8 uses Codemos's names and colors as a start. */
  readonly hues: number;

  /** The APCA contrasts every hue gets a color for. */
  readonly tiers: readonly number[];

  /** Per mode, the tier whose color stands for the hue and sets every tier's hues. */
  readonly identityTier: Readonly<Record<Mode, number>>;

  /** Muted colorfulness, as a share of the default's. */
  readonly muted: number;

  /** Brown's colorfulness, as a share of the target; null leaves brown out. */
  readonly brown: number | null;

  /** How far a hue may move to even out the spacing: on the identity tier, then per tier. */
  readonly hueWindow: Readonly<{ identity: number; tier: number }>;
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
  yellowHue: { light: 100, dark: 100 },
  hues: 8,
  tiers: [15, 30, 45, 60, 75, 90],
  identityTier: { light: 60, dark: 45 },
  muted: 0.5,
  brown: 0.6,
  hueWindow: { identity: 20, tier: 6 },
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

/**
 * Where each hue starts, by its name on CAM16's hue circle: a pure hue (R, Y, G, B) or a mix of two
 * ("R 50 Y" is halfway from red to yellow). Yellow starts at its anchor instead; brown isn't spaced
 * and stays where it starts.
 */
export const STARTS: Readonly<Record<string, string>> = {
  red: "R",
  orange: "R 50 Y",
  green: "G",
  mint: "G 50 B",
  blue: "B",
  purple: "B 33 R",
  pink: "R 33 B",
  brown: "R 25 Y",
};

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

/** Codemos's alternative (now: muted) colors, for the comparison. */
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
