/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< BUILD >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Builds the site: app.js and worker.js, with what they share and the pages loaded on their first  |
| visit in site/chunks, named by their content so a browser never keeps an old one.                |
\*------------------------------------------------------------------------------------------------*/

import { rmSync } from "node:fs";

import { build } from "esbuild";

/** Where Material's color utilities live, whose package doesn't say they have no side effects. */
const MATERIAL = "@material/material-color-utilities";

/**
 * Marks Material's color utilities as free of side effects, which they are, so the parts EK Colors
 * doesn't use, such as dynamic color schemes, are left out.
 */
const pureMaterial = {
  name: "pure-material",
  setup(context) {
    context.onResolve({ filter: /.*/ }, async (args) => {
      if (args.pluginData?.resolving) return undefined;
      if (!args.path.startsWith(MATERIAL) && !args.importer.includes(`/${MATERIAL}/`))
        return undefined;
      const found = await context.resolve(args.path, {
        kind: args.kind,
        importer: args.importer,
        resolveDir: args.resolveDir,
        pluginData: { resolving: true },
      });
      return found.errors.length ? found : { ...found, sideEffects: false };
    });
  },
};

rmSync("site/chunks", { recursive: true, force: true });
await build({
  entryPoints: ["src/site/app.ts", "src/site/worker.ts"],
  bundle: true,
  format: "esm",
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  minify: true,
  target: "es2023",
  outdir: "site",
  plugins: [pureMaterial],
  logLevel: "info",
});
