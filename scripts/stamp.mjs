/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< STAMP >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Stamps the built site with a version: index.html loads app.js?v=<hash>, and the app loads        |
| worker.js with the same query, so a browser never pairs a new page with an old cached worker.    |
| The chunks app.js imports are named in the page's head too, so they load alongside it.           |
\*------------------------------------------------------------------------------------------------*/

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const hash = createHash("sha256");
for (const file of ["site/app.js", "site/worker.js"]) hash.update(readFileSync(file));
const version = hash.digest("hex").slice(0, 10);

const page = readFileSync("site/index.html", "utf8");
const stamped = page.replace(/src="app\.js(\?v=\w+)?"/, `src="app.js?v=${version}"`);
if (!stamped.includes(`app.js?v=${version}`))
  throw new Error("site/index.html has no app.js script to stamp.");
// The chunks app.js starts with load as soon as the page does, not once app.js has arrived.
const chunks = [
  ...new Set(
    readFileSync("site/app.js", "utf8")
      .matchAll(/from\s*"\.\/(chunks\/[\w-]+\.js)"/g)
      .map((m) => m[1]),
  ),
];
const preloads = chunks.map((chunk) => `<link rel="modulepreload" href="${chunk}">`).join("\n");
const headed = stamped
  .replace(/<link rel="modulepreload" href="chunks\/[\w-]+\.js">\n/g, "")
  .replace("</head>", `${preloads}${preloads ? "\n" : ""}</head>`);
writeFileSync("site/index.html", headed);
