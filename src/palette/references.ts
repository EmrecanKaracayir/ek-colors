/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< REFERENCES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Reference systems: where each color belongs according to a body of color science. Each system    |
| gives homes for the colors it defines (as CAM16 names or as measured colors) and the hues it     |
| draws as guides; a color a system doesn't define falls back to CAM16. CAM16 is the default.      |
\*------------------------------------------------------------------------------------------------*/

import { hueOf, makeModel } from "./model";
import { type Settings, STARTS } from "./settings";

/** A hue a system draws as a guide: a pure hue (solid) or an in-between one (dashed). */
export interface Guide {
  readonly label: string;

  /** A CAM16 name ("R", "R 50 Y") or a measured color (CSS, e.g. color(xyz-d65 …)). */
  readonly at: string;
  readonly unique: boolean;
}

export interface ReferenceSystem {
  readonly id: string;
  readonly name: string;

  /** One sentence on what it is. */
  readonly summary: string;

  /** Where its numbers come from. */
  readonly source: string;

  /** Per color, where it belongs: a CAM16 name or a measured color. */
  readonly homes: Readonly<Record<string, string>>;
  readonly guides: readonly Guide[];
}

/* >----------------------------------------< Systems >-----------------------------------------< */

const CAM16_GUIDES: readonly Guide[] = [
  { label: "R", at: "R", unique: true },
  { label: "R 50 Y", at: "R 50 Y", unique: false },
  { label: "Y", at: "Y", unique: true },
  { label: "Y 50 G", at: "Y 50 G", unique: false },
  { label: "G", at: "G", unique: true },
  { label: "G 50 B", at: "G 50 B", unique: false },
  { label: "B", at: "B", unique: true },
  { label: "B 50 R", at: "B 50 R", unique: false },
];

/** Munsell's principal hues at value 5, chroma 10 (renotation, illuminant C, adapted to D65 by Bradford). */
const MUNSELL = {
  "5R": "color(xyz-d65 0.28518 0.19682 0.11430)",
  "5YR": "color(xyz-d65 0.24680 0.19756 0.03507)",
  "5Y": "color(xyz-d65 0.19025 0.19834 0.01357)",
  "5GY": "color(xyz-d65 0.13856 0.19897 0.02026)",
  "5G": "color(xyz-d65 0.10211 0.19902 0.14098)",
  "5BG": "color(xyz-d65 0.10562 0.19855 0.27053)",
  "5B": "color(xyz-d65 0.13706 0.19752 0.45911)",
  "5PB": "color(xyz-d65 0.19154 0.19663 0.52362)",
  "5P": "color(xyz-d65 0.25389 0.19617 0.42675)",
  "5RP": "color(xyz-d65 0.28442 0.19641 0.24124)",
} as const;

export const SYSTEMS: readonly ReferenceSystem[] = [
  {
    id: "cam16",
    name: "CAM16",
    summary:
      "Unique hues from vision research, as built into the color model: pure red, yellow, green and blue, and the mixes between them.",
    source:
      "Li et al., Comprehensive color solutions: CAM16, CAT16 and CAM16-UCS, Color Research & Application, 2017 (hue quadrature).",
    homes: STARTS,
    guides: CAM16_GUIDES,
  },
  {
    id: "munsell",
    name: "Munsell",
    summary:
      "Munsell's principal hues, spaced to look evenly different by observers in the 1930s and 40s: red 5R, orange 5YR, yellow 5Y, green 5G, mint 5BG, blue 5PB, purple 5P, pink 5RP.",
    source:
      "Newhall, Nickerson & Judd, Final report of the OSA subcommittee on the spacing of the Munsell colors, JOSA, 1943 (renotation data, value 5, chroma 10).",
    homes: {
      red: MUNSELL["5R"],
      orange: MUNSELL["5YR"],
      yellow: MUNSELL["5Y"],
      green: MUNSELL["5G"],
      mint: MUNSELL["5BG"],
      blue: MUNSELL["5PB"],
      purple: MUNSELL["5P"],
      pink: MUNSELL["5RP"],
    },
    guides: (Object.entries(MUNSELL) as [string, string][]).map(([label, at]) => ({
      label,
      at,
      unique: label.length === 2,
    })),
  },
];

/** Not a system: each color is pulled toward whichever system's home is closest to it. */
export const NEAREST = "nearest";

/* >---------------------------------------< Resolving >----------------------------------------< */

const NAME = /^[RYGB]( \d+ [RYGB])?$/;
const cache = new Map<string, number>();

/**
 * A home or guide as a CAM16 hue. A name is exact; a measured color's hue depends a little on the
 * room and base, so it's the average of light and dark.
 *
 * @param settings  The bases and rooms.
 * @param at        A CAM16 name or a measured color.
 * @returns         CAM16 hue (degrees).
 */
export function hueAt(settings: Pick<Settings, "bases" | "rooms">, at: string): number {
  if (NAME.test(at)) return hueOf(at);
  const key = JSON.stringify([settings.bases, settings.rooms, at]);
  let hue = cache.get(key);
  if (hue === undefined) {
    const model = makeModel(settings);
    const [light, dark] = [model.cam("light", at).hue, model.cam("dark", at).hue];
    hue = (light + (((dark - light + 540) % 360) - 180) / 2 + 360) % 360;
    cache.set(key, hue);
  }
  return hue;
}

/**
 * The reference system settings point at.
 *
 * @param settings  The settings.
 * @returns         The system; CAM16 when unknown.
 */
export function system(settings: Pick<Settings, "reference">): ReferenceSystem {
  return SYSTEMS.find((s) => s.id === settings.reference) ?? SYSTEMS[0]!;
}

/**
 * Where a color belongs by default under the settings' reference system, falling back to CAM16.
 *
 * @param settings  The settings.
 * @param key       The color.
 * @returns         CAM16 hue (degrees).
 */
export function systemHome(
  settings: Pick<Settings, "bases" | "rooms" | "reference">,
  key: string,
): number {
  return hueAt(settings, system(settings).homes[key] ?? STARTS[key] ?? "R");
}

/**
 * Where a color may belong: under one system, its home there; under "nearest", its home in every
 * system, so the closest one can be chosen.
 *
 * @param settings  The settings.
 * @param key       The color.
 * @returns         CAM16 hues (degrees).
 */
export function systemHomes(
  settings: Pick<Settings, "bases" | "rooms" | "reference">,
  key: string,
): number[] {
  if (settings.reference !== NEAREST) return [systemHome(settings, key)];
  return [...new Set(SYSTEMS.map((s) => hueAt(settings, s.homes[key] ?? STARTS[key] ?? "R")))];
}

/**
 * The guides the settings' reference system draws, as hues.
 *
 * @param settings  The settings.
 * @returns         Each guide's label, hue and whether it's a pure hue.
 */
export function guides(settings: Pick<Settings, "bases" | "rooms" | "reference">) {
  return system(settings).guides.map((g) => ({
    label: g.label,
    hue: hueAt(settings, g.at),
    unique: g.unique,
  }));
}
