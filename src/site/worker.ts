/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< WORKER >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Solves palettes off the page: settings and a gamut tier in, palette out, so the page stays       |
| responsive while a slider moves.                                                                 |
\*------------------------------------------------------------------------------------------------*/

import type { Gamut, Settings } from "../palette/settings";
import { type GamutCore, type GamutPalette, solveGamut } from "../palette/solve";

export interface Request {
  readonly id: number;
  readonly settings: Settings;
  readonly gamut: Gamut;
}

export type Response =
  | { readonly id: number; readonly gamut: Gamut; readonly palette: GamutPalette; readonly took: number }
  | { readonly id: number; readonly error: string };

// The hues of recent settings, so a change to a custom or neutral color reuses them.
const cores = new Map<string, GamutCore>();

addEventListener("message", (event: MessageEvent<Request>) => {
  const { id, settings, gamut } = event.data;
  const start = performance.now();
  let response: Response;
  try {
    response = { id, gamut, palette: solveGamut(settings, gamut, cores), took: performance.now() - start };
  } catch (error) {
    response = { id, error: error instanceof Error ? error.message : String(error) };
  }
  postMessage(response);
});
