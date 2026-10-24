/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< WORKER >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Solves palettes off the page: settings in, palette out, so the page stays responsive while a     |
| slider moves.                                                                                    |
\*------------------------------------------------------------------------------------------------*/

import type { Settings } from "../palette/settings";
import { type Palette, solvePalette } from "../palette/solve";

export interface Request {
  readonly id: number;
  readonly settings: Settings;
}

export type Response =
  | { readonly id: number; readonly palette: Palette; readonly took: number }
  | { readonly id: number; readonly error: string };

addEventListener("message", (event: MessageEvent<Request>) => {
  const { id, settings } = event.data;
  const start = performance.now();
  let response: Response;
  try {
    response = { id, palette: solvePalette(settings), took: performance.now() - start };
  } catch (error) {
    response = { id, error: error instanceof Error ? error.message : String(error) };
  }
  postMessage(response);
});
