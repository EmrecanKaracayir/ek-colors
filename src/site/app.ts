/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< APP >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The palette site: overview, tiers, one page per color, the comparison with EK Palette (or        |
| Codemos), how it works, settings and export. One view at a time, one mode at a time; the page    |
| itself is the mode's base. This file starts it; each part of the site has its own file.          |
\*------------------------------------------------------------------------------------------------*/

import { route } from "./shell";
import { solve } from "./solver";
import "./state";
import "./solver";
import "./variants";
import "./derived";
import "./parts";
import "./circle";
import "./pages/overview";
import "./pages/tiers";
import "./pages/color";
import "./pages/compare";
import "./settings/page";
import "./settings/fields";
import "./settings/base";
import "./settings/strip";
import "./settings/metrics";
import "./settings/export";
import "./shell";
import "./events";

route();
solve();
