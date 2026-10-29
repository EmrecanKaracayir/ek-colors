/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< CONFIG >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| EK Palette: the settings it is solved from, and where EK Colors starts. Each change from the     |
| defaults says why.                                                                               |
\*------------------------------------------------------------------------------------------------*/

import { DEFAULTS, type Settings } from "./palette/settings";

export const CONFIG: Settings = {
  ...DEFAULTS,
  // A little more colorful than the defaults, with muted just under half of it.
  colorfulness: 44,
  mutedShare: 0.48,
  // Set by eye, side by side: red looks fainter than the model says and orange a little stronger,
  // each by the same share of its tier's colorfulness in both modes, more M in the dim room.
  colorfulnessPerHue: {
    light: [
      { amount: 2.8, center: 16, width: 32 },
      { amount: -1.2, center: 56, width: 32 },
    ],
    dark: [
      { amount: 5.2, center: 16, width: 32 },
      { amount: -2, center: 56, width: 32 },
    ],
  },
  // Yellow at 96°, Munsell's 5Y (95.6°) rounded, and every other color where its name fits best.
  anchor: 96,
  placed: { red: 16, orange: 56, green: 148, mint: 196, blue: 240, purple: 284, pink: 328 },
  // Brown belongs in EK Palette as much as red and orange do, a little less colorful than them.
  customColors: [{ name: "Brown", hue: 40, share: 0.64 }],
};
