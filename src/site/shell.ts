/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< SHELL >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The page around the views: drawing the view the address names, its title, the status, the bar    |
| and its phone menu, and the switch to compare with Codemos.                                      |
\*------------------------------------------------------------------------------------------------*/

import { baseIn } from "../palette/bases";
import { GAMUTS } from "../palette/settings";
import { context, followsEdits, hueTestContext, onScreen, testContext } from "./derived";
import { refill } from "./dom";
import { colorPage } from "./pages/color";
import { comparePage } from "./pages/compare";
import { overviewPage } from "./pages/overview";
import { tiersPage } from "./pages/tiers";
import { $, colors, labelText } from "./parts";
import { updateBaseNote } from "./settings/base";
import { jumpTo, settingsPage, updateTune } from "./settings/page";
import { evenGap, updateStrip, watchDock } from "./settings/strip";
import { COMPARE, SCREEN, VIEWS, state } from "./state";

/** Each page's name in the browser's title; a color page's is the color's. */
const PAGE_NAMES: Readonly<Record<string, string>> = {
  overview: "",
  tiers: "Tiers",
  compare: "Compare",
  how: "How it works",
  algorithm: "The algorithm",
  references: "References",
  tune: "Settings",
  "curve-test": "Blind colorfulness test",
  "hue-test": "Blind hue test",
};

/**
 * The browser's title for a page.
 *
 * @param view  The page, or a color's key.
 * @returns     E.g. "Tiers • EK Colors"; the Overview is just "EK Colors".
 */
function pageTitle(view: string): string {
  const name = PAGE_NAMES[view] ?? labelText(view);
  return name ? `${name} • EK Colors` : "EK Colors";
}

/** The pages loaded the first time they're opened, so the first page loads without them. */
export const later: {
  how?: typeof import("./pages/how");
  algorithm?: typeof import("./pages/algorithm");
  references?: typeof import("./pages/references");
  curveTest?: typeof import("./pages/curve-test");
  hueTest?: typeof import("./pages/hue-test");
} = {};

/** How each of those pages loads, once. */
const LOADS: Readonly<Record<string, () => Promise<unknown>>> = {
  how: () => import("./pages/how").then((page) => (later.how = page)),
  algorithm: () => import("./pages/algorithm").then((page) => (later.algorithm = page)),
  references: () => import("./pages/references").then((page) => (later.references = page)),
  "curve-test": () =>
    import("./pages/curve-test").then((page) => {
      page.bindTest(testContext);
      later.curveTest = page;
    }),
  "hue-test": () =>
    import("./pages/hue-test").then((page) => {
      page.bindHueTest(hueTestContext);
      later.hueTest = page;
    }),
};

/** The pages loading now. */
const loading = new Set<string>();

/** Whether the title waits for its page to load before it takes the focus. */
let focusWaiting = false;

/**
 * Loads a page the first time it's opened, then draws it if it's still the one asked for.
 *
 * @param view  The page.
 */
function loadPage(view: string): void {
  if (loading.has(view)) return;
  loading.add(view);
  void LOADS[view]!().then(() => {
    if (state.view !== view) return;
    render();
    if (focusWaiting) focusTitle();
  });
}

/** The even gap the page's text was drawn with, ΔE: How it works and the algorithm quote it. */
export let drawnGap = 0;

/**
 * Draws the current view.
 */
export function render(): void {
  const view = state.view;
  drawnGap = evenGap(state.mode);
  document.documentElement.dataset.theme = state.mode;
  document.documentElement.style.setProperty("--base-light", onScreen().bases.light);
  document.documentElement.style.setProperty("--base-dark", onScreen().bases.dark);
  // The phone's address bar takes the page's own base, whichever mode is on.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.setAttribute("content", baseIn(state.settings, state.mode, "standard").written);
  const onColorPage = !(VIEWS as readonly string[]).includes(view);
  for (const a of document.querySelectorAll<HTMLAnchorElement>(".nav a")) {
    const target = a.getAttribute("href")!.slice(1);
    const here = target === view || (target === "colors" && onColorPage) || (target === "tune" && (view === "curve-test" || view === "hue-test")) || (target === "how" && view === "algorithm");
    if (here) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode));
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-gamut]")) {
    b.setAttribute("aria-pressed", String(b.dataset.gamut === state.gamut));
    b.title = b.dataset.gamut === SCREEN ? "This screen" : "";
  }
  const beyond = GAMUTS.indexOf(state.gamut) > GAMUTS.indexOf(SCREEN);
  $<HTMLElement>("#beyond").hidden = !beyond || view === "references";
  updateBaseNote();
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-variant]")) b.setAttribute("aria-pressed", String(b.dataset.variant === state.variant));
  $<HTMLElement>("#variant").hidden = view !== "tiers" && view !== "compare";
  $<HTMLElement>("#edits").hidden = !followsEdits(view);
  fitHeader();
  for (const b of document.querySelectorAll<HTMLElement>("[data-edit]")) b.setAttribute("aria-pressed", String(state.edits[b.dataset.edit as "h" | "m"]));
  const first = colors()[0]?.key ?? "red";
  // Settings drawn again keeps its strip as it is, drawn, pinned and with its margin, rather than an
  // empty one that grows back and moves the page below it.
  const keptStrip = view === "tune" && document.querySelector("#tiers-section") ? document.querySelector("#palette-strip") : null;
  const page =
    view === "overview" ? overviewPage()
    : view === "tiers" ? tiersPage()
    : view === "compare" ? comparePage()
    : view === "tune" ? settingsPage()
    : view === "references" ? later.references?.referencesPage()
    : view === "how" ? later.how?.howPage(context())
    : view === "algorithm" ? later.algorithm?.algorithmPage(context())
    : view === "curve-test" ? later.curveTest?.curveTestPage(testContext())
    : view === "hue-test" ? later.hueTest?.hueTestPage(hueTestContext())
    : colorPage(view === "colors" ? first : view);
  // A page loaded on its first visit is drawn once it's there.
  if (page === undefined) loadPage(view);
  refill($("main"), page ?? "");
  if (keptStrip) document.querySelector("#palette-strip")?.replaceWith(keptStrip);
  if (view === "tune") updateTune();
  if (view === "how") updateStrip();
  document.title = pageTitle(view === "colors" ? first : view);
  watchDock();
}

/** The pending read-out of a finished solve. */
let settled = 0;

/**
 * Shows whether the palette is being solved.
 */
export function status(): void {
  const el = $<HTMLElement>("#status");
  el.dataset.state = state.error ? "error" : state.solving ? "busy" : "done";
  // A no-break space keeps the time and its unit on one line.
  el.textContent = state.error ?? (state.solving ? "Solving…" : `Solved in ${(state.took / 1000).toFixed(1)}\u00A0s`);
  // Read out once the changes settle: an error at once, a solve a moment after the last one.
  clearTimeout(settled);
  if (state.error) $("#announce").textContent = state.error;
  else if (!state.solving) settled = window.setTimeout(() => ($("#announce").textContent = el.textContent ?? ""), 1000);
}

/* >---------------------------------< Comparing with Codemos >---------------------------------< */

/**
 * Whether Compare sets the palette next to Codemos rather than EK Palette: once Shift+C, or five
 * quick taps on the name, switches it.
 *
 * @returns  Whether it does in this browser.
 */
export function comparing(): boolean {
  try {
    return localStorage.getItem(COMPARE) === "on";
  } catch {
    return shown;
  }
}

let shown = false;

/**
 * Switches Compare between EK Palette and Codemos, and says which.
 */
function toggleCompare(): void {
  shown = !comparing();
  try {
    localStorage.setItem(COMPARE, shown ? "on" : "off");
  } catch {
    // Storage can be blocked; it then lasts until the page closes.
  }
  const el = $<HTMLElement>("#status");
  el.textContent = shown ? "Comparing with Codemos" : "Comparing with EK Palette";
  window.setTimeout(status, 2000);
  if (state.view === "compare") render();
}

document.addEventListener("keydown", (event) => {
  const typing = event.target instanceof Element && event.target.closest("input, textarea, select");
  if (event.shiftKey && event.code === "KeyC" && !event.metaKey && !event.ctrlKey && !typing) toggleCompare();
});

let taps: number[] = [];
$("#brand").addEventListener("click", () => {
  const now = performance.now();
  taps = [...taps.filter((t) => now - t < 2000), now];
  if (taps.length >= 5) {
    taps = [];
    toggleCompare();
  }
});

/**
 * Opens the view the address names.
 */
export function route(): void {
  // Export is a section of Settings; its own address still opens it there.
  const hash = location.hash.slice(1) || "overview";
  state.view = hash === "export" ? "tune" : hash;
  render();
  // The section's id isn't "export", so the browser's own jump to it doesn't undo this.
  if (hash === "export") jumpTo("export-section");
  else window.scrollTo(0, 0);
}

/**
 * Puts the switches between the name and the status when the bar has the menu button and they fit
 * there on one line; otherwise they go on a row of their own below.
 */
function fitHeader(): void {
  const header = $("header");
  const tools = $<HTMLElement>(".tools");
  header.classList.remove("one-row");
  // The bar has the menu button below 54rem, as in the page's styles.
  if (!matchMedia("(max-width: 54rem)").matches) return;
  header.classList.add("one-row");
  if (tools.scrollWidth > tools.clientWidth) header.classList.remove("one-row");
}

window.addEventListener("resize", fitHeader);

// The phone menu: the button opens the views; choosing one, Escape, or a tap elsewhere closes it.
const toggle = $<HTMLButtonElement>("#menu-toggle");
const openMenu = (open: boolean) => {
  $("header").classList.toggle("menu-open", open);
  toggle.setAttribute("aria-expanded", String(open));
};
toggle.addEventListener("click", () => openMenu(toggle.getAttribute("aria-expanded") !== "true"));
document.addEventListener("click", (event) => {
  // A view chosen closes it, the one already open too, as does a tap outside.
  const target = event.target as Element;
  if (!target.closest("#menu-toggle, #views") || target.closest("#views a")) openMenu(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true") return;
  openMenu(false);
  toggle.focus();
});
addEventListener("hashchange", () => openMenu(false));

/**
 * Gives the page's title the focus, so the keyboard and screen readers start there.
 */
function focusTitle(): void {
  const title = document.querySelector<HTMLElement>("main h1");
  focusWaiting = !title;
  if (!title) return;
  title.tabIndex = -1;
  title.focus({ preventScroll: true });
}

addEventListener("hashchange", () => {
  route();
  if (location.hash !== "#export") focusTitle();
});
$("#skip").addEventListener("click", focusTitle);
