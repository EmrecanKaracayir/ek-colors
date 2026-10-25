/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< RELEASE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| Releases a version: pnpm release 2.2.0. It checks that the version is a semantic version newer   |
| than package.json's and every tag, that it runs on main with the tag still free, and that the    |
| changelog has something under Unreleased. Then it dates that section as the version, opens a new |
| Unreleased, points the changelog's links at the new tag, sets package.json's version, checks,    |
| builds and solves, and commits and tags everything. Pushing is left to git push origin main and  |
| the tag.                                                                                         |
\*------------------------------------------------------------------------------------------------*/

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import semver from "semver";

/**
 * Stops the release before anything is written, saying why.
 *
 * @param text  What's wrong.
 */
function stop(text: string): never {
  console.error(`Not released: ${text}`);
  process.exit(1);
}

/**
 * Runs a command, its output shown.
 *
 * @param command  The program.
 * @param args     Its arguments.
 * @param input    What to give it on standard input, if anything.
 */
function run(command: string, args: readonly string[], input?: string): void {
  execFileSync(
    command,
    args,
    input === undefined ? { stdio: "inherit" } : { input, stdio: ["pipe", "inherit", "inherit"] },
  );
}

/**
 * A git command's output.
 *
 * @param args  Its arguments.
 * @returns     The output, trimmed.
 */
const git = (args: readonly string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();

// The version: a semantic version newer than the current one and than every tag.
const given = process.argv[2] ?? stop("say which version, e.g. pnpm release 2.2.0.");
const version = semver.valid(given) ?? stop(`${given} isn't a semantic version like 2.2.0.`);
const project = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
  repository: { url: string };
};
if (!semver.gt(version, project.version))
  stop(`${version} isn't newer than ${project.version}, the version now.`);
const tags = git(["tag", "--list", "v*"]).split("\n").filter(Boolean);
const newest = semver.rsort(tags.map((t) => t.slice(1)).filter((t) => semver.valid(t)))[0];
if (newest && !semver.gt(version, newest))
  stop(`${version} isn't newer than v${newest}, the newest tag.`);
if (tags.includes(`v${version}`)) stop(`the tag v${version} is taken.`);
const branch = git(["branch", "--show-current"]);
if (branch !== "main") stop(`releases are made on main, not ${branch || "a detached head"}.`);

// The changelog: what's under Unreleased becomes the version's section.
const log = readFileSync("CHANGELOG.md", "utf8");
const start = log.indexOf("## [Unreleased]");
if (start < 0) stop("CHANGELOG.md has no ## [Unreleased] section.");
const after = log.indexOf("\n## [", start + 1);
const notes = log.slice(log.indexOf("\n", start) + 1, after < 0 ? undefined : after + 1).trim();
if (!notes) stop("nothing is written under Unreleased in CHANGELOG.md.");
const repo = project.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");
const unreleased = /^\[Unreleased\]: .*$/m;
if (!unreleased.test(log)) stop("CHANGELOG.md has no [Unreleased] link at its end.");
const previous = `v${project.version}`;
const today = new Date().toLocaleDateString("sv");
const dated = log
  .replace("## [Unreleased]", `## [Unreleased]\n\n## [${version}] - ${today}`)
  .replace(
    unreleased,
    `[Unreleased]: ${repo}/compare/v${version}...HEAD\n[${version}]: ${repo}/compare/${previous}...v${version}`,
  );

const manifest = readFileSync("package.json", "utf8");
const bumped = manifest.replace(`"version": "${project.version}"`, `"version": "${version}"`);
if (bumped === manifest) stop(`package.json's version line isn't "version": "${project.version}".`);

// Written, checked, built and solved, then committed and tagged. A step that fails puts the
// changelog and package.json back as they were.
writeFileSync("CHANGELOG.md", dated);
writeFileSync("package.json", bumped);
try {
  run("pnpm", ["format"]);
  run("pnpm", ["check"]);
  run("pnpm", ["build"]);
  run("pnpm", ["solve"]);
} catch {
  writeFileSync("CHANGELOG.md", log);
  writeFileSync("package.json", manifest);
  stop("a check or the build failed; the changelog and package.json are as they were.");
}
run("git", ["add", "-A"]);
run("git", ["commit", "--quiet", "--file", "-"], `EK Colors ${version}\n\n${notes}\n`);
run("git", ["tag", "--annotate", `v${version}`, "--message", `EK Colors ${version}`]);
console.log(`Released ${version}. Publish it with: git push origin main v${version}`);
