/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< POPOVER >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| One popover for details and explanations: a button with data-pop opens it next to itself, with   |
| content from the source its id starts with, written when it opens. Clicking the button again,    |
| clicking elsewhere or pressing Escape closes it; it follows its button while the page scrolls.   |
\*------------------------------------------------------------------------------------------------*/

/** Writes a popover's content for the rest of its id. */
type Source = (rest: string) => string;

const sources = new Map<string, Source>();

/** The open popover's id, if any. */
let open: string | null = null;

/**
 * Lets popovers whose id starts with `prefix:` take their content from `source`.
 *
 * @param prefix  The id's first part.
 * @param source  Writes the content (HTML) for the rest of the id.
 */
export function popSource(prefix: string, source: Source): void {
  sources.set(prefix, source);
}

/**
 * A button that opens a popover.
 *
 * @param id     The popover's id, "prefix:rest".
 * @param label  The button's content (HTML).
 * @param name   What the button is for, for screen readers.
 * @param kind   Extra classes.
 * @returns      HTML.
 */
export function popButton(id: string, label: string, name: string, kind = ""): string {
  return `<button type="button" class="pop-trigger ${kind}" data-pop="${id}" aria-haspopup="dialog" aria-expanded="${String(open === id)}" aria-label="${name}">${label}</button>`;
}

/* >----------------------------------------< Placing >-----------------------------------------< */

const panel = document.createElement("div");
panel.id = "popover";
panel.setAttribute("role", "dialog");
// It takes the focus when opened from the keyboard, so its links and details can be reached.
panel.tabIndex = -1;
panel.hidden = true;
document.body.append(panel);

/**
 * The button the open popover belongs to; buttons are drawn anew, so it's looked up each time.
 *
 * @returns  The button, or null.
 */
function trigger(): HTMLElement | null {
  return open === null ? null : document.querySelector<HTMLElement>(`[data-pop="${CSS.escape(open)}"]`);
}

/**
 * Puts the popover under its button, or above when there's no room below; always inside the window.
 */
function place(): void {
  const button = trigger();
  if (!button) return close();
  const at = button.getBoundingClientRect();
  const [width, height] = [panel.offsetWidth, panel.offsetHeight];
  const margin = 8;
  const left = Math.min(Math.max(margin, at.left + at.width / 2 - width / 2), innerWidth - width - margin);
  const below = at.bottom + 6;
  const above = at.top - 6 - height;
  // Below when it fits, else above when that fits, else as low as stays inside the window.
  const top = below + height <= innerHeight - margin ? below : above >= margin ? above : Math.max(margin, innerHeight - height - margin);
  panel.style.transform = `translate(${String(Math.round(left))}px, ${String(Math.round(top))}px)`;
}

/**
 * Opens a popover.
 *
 * @param id     Its id.
 * @param focus  Whether it takes the focus: opened from the keyboard.
 */
function show(id: string, focus = false): void {
  const html = sources.get(id.split(":")[0]!)?.(id.slice(id.indexOf(":") + 1));
  // Nothing to say, as for a color that's just been removed: it stays closed.
  if (!html) return;
  trigger()?.setAttribute("aria-expanded", "false");
  open = id;
  panel.innerHTML = html;
  panel.setAttribute("aria-label", trigger()?.getAttribute("aria-label") ?? "Details");
  panel.hidden = false;
  trigger()?.setAttribute("aria-expanded", "true");
  place();
  if (focus) panel.focus({ preventScroll: true });
}

/**
 * Closes the popover.
 *
 * @param focus  Whether its button takes the focus back.
 */
function close(focus = false): void {
  if (open === null) return;
  const button = trigger();
  button?.setAttribute("aria-expanded", "false");
  if (focus) button?.focus();
  open = null;
  panel.hidden = true;
}

/* >-----------------------------------------< Events >-----------------------------------------< */

document.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLElement>("[data-pop]");
  if (button) {
    const id = button.dataset.pop!;
    // A click from the keyboard has no pointer behind it.
    return open === id ? close() : show(id, event.detail === 0);
  }
  if (!panel.contains(event.target as Node)) close();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && open !== null) close(true);
});

let frame = 0;
const follow = () => {
  if (open === null || frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    place();
  });
};
// Captured, so scrolling a table sideways moves it too.
addEventListener("scroll", follow, { passive: true, capture: true });
addEventListener("resize", follow);
addEventListener("hashchange", () => close());
