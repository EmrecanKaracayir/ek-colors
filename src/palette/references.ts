/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< REFERENCES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Reference systems: where a body of color science puts its hues, drawn as guides on the hue       |
| graphs (pure hues solid, the rest dashed), one system at a time. Each system's hues are CAM16    |
| names or measured colors.                                                                        |
\*------------------------------------------------------------------------------------------------*/

import { hueOf, makeModel } from "./model";
import type { Settings } from "./settings";

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

  readonly guides: readonly Guide[];

  /** Its yellow, which the lineup can be anchored on. */
  readonly yellow: string;
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
    guides: CAM16_GUIDES,
    yellow: "Y",
  },
  {
    id: "munsell",
    name: "Munsell",
    summary:
      "Munsell's principal hues, spaced to look evenly different by observers in the 1930s and 40s: red 5R, orange 5YR, yellow 5Y, green 5G, mint 5BG, blue 5PB, purple 5P, pink 5RP.",
    source:
      "Newhall, Nickerson & Judd, Final report of the OSA subcommittee on the spacing of the Munsell colors, JOSA, 1943 (renotation data, value 5, chroma 10).",
    guides: (Object.entries(MUNSELL) as [string, string][]).map(([label, at]) => ({
      label,
      at,
      unique: label.length === 2,
    })),
    yellow: MUNSELL["5Y"],
  },
  {
    id: "ncs",
    name: "NCS",
    summary:
      "The Natural Color System's four elementary hues, as painters and architects use them: the yellow, red, blue and green with no trace of their neighbors.",
    source:
      "NCS Colour AB; screen approximations of NCS 0580-Y, S 1080-R, 2060-B and 2060-G from its NCS Navigator, as listed on Wikipedia. The measured values are in the paid standard SS 19104.",
    guides: [
      { label: "Y", at: "#FFD300", unique: true },
      { label: "R", at: "#C40233", unique: true },
      { label: "B", at: "#0087BD", unique: true },
      { label: "G", at: "#009F6B", unique: true },
    ],
    yellow: "#FFD300",
  },
  {
    id: "unique",
    name: "Unique hues",
    summary:
      "Where observers in lab studies set pure red, yellow, green and blue, averaged. Unique green varies the most between people.",
    source:
      "Kuehni, Determination of unique hues using Munsell color chips, Color Research & Application, 2001 (mean chips 3R, 3.5Y, 2.5BG, 2.75PB), as reported by Wright, Prime colors and the hues; converted at Munsell value 5, chroma 10.",
    guides: [
      { label: "R", at: "color(xyz-d65 0.27986 0.19176 0.13411)", unique: true },
      { label: "Y", at: "color(xyz-d65 0.19312 0.19324 0.01482)", unique: true },
      { label: "G", at: "color(xyz-d65 0.10069 0.19372 0.21758)", unique: true },
      { label: "B", at: "color(xyz-d65 0.17438 0.19184 0.50820)", unique: true },
    ],
    yellow: "color(xyz-d65 0.19312 0.19324 0.01482)",
  },
  {
    id: "focal",
    name: "Focal colors",
    summary:
      "The best examples of red, yellow, green, blue and purple chosen by speakers of over a hundred languages in the World Color Survey.",
    source:
      "World Color Survey chips G1 (2.5R 4/14), C9 (2.5Y 8/16), F17 (2.5G 5/12), F29 (2.5PB 5/12) and H34 (5P 3/10), CIELAB under illuminant C; focal hues after MacLaury 1997 and Regier, Kay & Cook, PNAS 2005.",
    guides: [
      { label: "Red", at: "color(xyz-d65 0.22536 0.11883 0.07142)", unique: true },
      { label: "Yellow", at: "color(xyz-d65 0.59992 0.59263 0.02931)", unique: true },
      { label: "Green", at: "color(xyz-d65 0.08950 0.19929 0.09208)", unique: true },
      { label: "Blue", at: "color(xyz-d65 0.17627 0.19649 0.60571)", unique: true },
      { label: "Purple", at: "color(xyz-d65 0.10249 0.06463 0.19475)", unique: false },
    ],
    yellow: "color(xyz-d65 0.59992 0.59263 0.02931)",
  },
];

/* >---------------------------------------< Resolving >----------------------------------------< */

const NAME = /^[RYGB]( \d+ [RYGB])?$/;
const cache = new Map<string, number>();

/**
 * A guide as a CAM16 hue. A name is exact; a measured color's hue depends a little on the
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
 * A system's guides as hues.
 *
 * @param settings  The bases and rooms.
 * @param id        The system; the settings' chosen one when left out.
 * @returns         Each guide's system, label, hue and whether it's a pure hue.
 */
export function guides(settings: Pick<Settings, "bases" | "rooms" | "guide">, id = settings.guide) {
  const system = SYSTEMS.find((s) => s.id === id) ?? SYSTEMS[0]!;
  return system.guides.map((g) => ({
    system: system.id,
    label: g.label,
    hue: hueAt(settings, g.at),
    unique: g.unique,
  }));
}

/**
 * The hue the lineup is anchored on.
 *
 * @param settings  The settings.
 * @returns         CAM16 hue (degrees).
 */
export function anchorHue(settings: Pick<Settings, "bases" | "rooms" | "anchor">): number {
  if (typeof settings.anchor === "number") return settings.anchor;
  const system = SYSTEMS.find((s) => s.id === settings.anchor) ?? SYSTEMS[0]!;
  return hueAt(settings, system.yellow);
}
