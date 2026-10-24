/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< CONFIG >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Everything the palette is solved from: the two bases, the APCA tiers, the chroma targets and the |
| yellow anchor. Change a value here and run pnpm solve.                                           |
\*------------------------------------------------------------------------------------------------*/

/* >-----------------------------------------< Bases >------------------------------------------< */

/*
 * The backgrounds every colour is read on. 8px of height is one just-noticeable step (OKLab
 * lightness 0.01) below white in light mode; dark mode's base is its contrast mirror.
 */
export const BASES = { light: "#EBEBEB", dark: "#181818" } as const;

export type Mode = keyof typeof BASES;

export const MODES = ["light", "dark"] as const satisfies readonly Mode[];

/* >-----------------------------------------< Tiers >------------------------------------------< */

/*
 * Each hue gets one colour per tier, exactly on that APCA contrast against the base, and never below
 * WCAG_MIN; where WCAG asks for more, the colour sits on WCAG instead:
 *   15 dividers, faint fills · 30 icons, outlines · 45 large text, the colour itself
 *   60 labels, links · 75 body text · 90 long reading
 */
export const TIERS = [15, 30, 45, 60, 75, 90] as const;

export type Tier = (typeof TIERS)[number];

/** The WCAG 2 contrast every colour reaches on its base, whatever its tier. */
export const WCAG_MIN = 4.5;

/** The tier whose colour stands for the hue: it sets every tier's hues. */
export const IDENTITY_TIER: Tier = 45;

/* >-----------------------------------------< Chroma >-----------------------------------------< */

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

export type Name = (typeof NAMES)[number];

/** CAM16 chroma, as seen on the base, that every colour aims at. */
export const CHROMA = 50;

/** A colour's own chroma target, per mode, in place of CHROMA. */
export const CHROMA_OVERRIDES: Partial<Record<Mode, Partial<Record<Name, number>>>> = {};

/** The muted colours' chroma, as a share of their default's. */
export const MUTED = 0.5;

/** Brown's chroma, as a share of CHROMA; brown has no muted version. */
export const BROWN = 0.6;

/* >------------------------------------------< Hues >------------------------------------------< */

/*
 * Yellow anchors the spacing; a darkened yellow looks greener, so it sits a little warmer than
 * pure yellow (CAM16 111°; unique yellow is 90°).
 */
export const YELLOW_HUE: Record<Mode, number> = { light: 100, dark: 100 };

/** Codemos v1's colours: where every other hue starts, and the comparison. */
export const V1: Record<Mode, Record<Name | "brown", string>> = {
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

/** How far a hue may move from v1's at the identity tier, and from there on other tiers. */
export const HUE_WINDOW = { identity: 20, tier: 6 } as const;
