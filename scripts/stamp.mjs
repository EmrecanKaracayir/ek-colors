/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< STAMP >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Stamps the built site with a version: index.html loads app.js?v=<hash>, and the app loads        |
| worker.js with the same query, so a browser never pairs a new page with an old cached worker.    |
\*------------------------------------------------------------------------------------------------*/

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const hash = createHash("sha256");
for (const file of ["site/app.js", "site/worker.js"]) hash.update(readFileSync(file));
const version = hash.digest("hex").slice(0, 10);

const page = readFileSync("site/index.html", "utf8");
writeFileSync(
  "site/index.html",
  page.replace(/src="app\.js(\?v=\w+)?"/, `src="app.js?v=${version}"`),
);
