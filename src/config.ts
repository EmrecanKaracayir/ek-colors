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
  // Reds look weaker than the model says, more so in a dim room: colorfulness added around red.
  colorfulnessPerHue: {
    light: [{ amount: 4, center: 12, width: 40 }],
    dark: [{ amount: 8, center: 12, width: 40 }],
  },
  // Yellow sits on Munsell's 5Y, and every other color where its name fits best.
  anchor: "munsell",
  placed: { red: 16, orange: 56, green: 148, mint: 196, blue: 240, purple: 284, pink: 332 },
  // Brown belongs in EK Palette as much as red and orange do, a little less colorful than them.
  customColors: [{ name: "Brown", hue: 40, share: 0.64 }],
};
