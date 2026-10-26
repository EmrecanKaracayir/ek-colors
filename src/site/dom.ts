/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< DOM >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the pages share with the document: drawing a part of the page again without losing the      |
| focus, copying text, and a status line that says something for a moment.                         |
\*------------------------------------------------------------------------------------------------*/

/**
 * Writes a readout, except while the palette solves: then its last text stays, dimmed, so it
 * keeps its height and nothing below it moves.
 *
 * @param el       The readout.
 * @param html     Its new contents.
 * @param solving  Whether the palette is still solving.
 */
export function readout(el: Element, html: string, solving: boolean): void {
  if (solving && el.textContent) {
    el.classList.add("stale");
    return;
  }
  el.classList.remove("stale");
  el.innerHTML = html;
}

/**
 * Draws an element's contents again. Whatever control had the focus inside it gets it back, found
 * by its id, or else by its data attributes, so redrawing never sends a keyboard user to the top of
 * the page; a disclosure that was open, found by its id, stays open.
 *
 * @param el    The element.
 * @param html  Its new contents.
 */
export function refill(el: Element, html: string): void {
  const active = document.activeElement;
  const inside = active && active !== el && el.contains(active);
  const selector = !inside
    ? ""
    : active.id
      ? `#${CSS.escape(active.id)}`
      : [...active.attributes]
          .filter((a) => a.name.startsWith("data-"))
          .map((a) => `[${a.name}="${CSS.escape(a.value)}"]`)
          .join("");
  const open = [...el.querySelectorAll("details[open][id]")].map((d) => d.id);
  el.innerHTML = html;
  for (const id of open) el.querySelector<HTMLDetailsElement>(`#${CSS.escape(id)}`)?.setAttribute("open", "");
  if (selector) el.querySelector<HTMLElement | SVGElement>(selector)?.focus({ preventScroll: true });
}

/**
 * Copies text, saying whether it worked. Some pages and browsers don't allow it at all.
 *
 * @param text  What to copy.
 * @param done  Told true when copied, false when copying isn't allowed.
 */
export function copyText(text: string, done: (copied: boolean) => void): void {
  if (!navigator.clipboard) return done(false);
  navigator.clipboard.writeText(text).then(
    () => done(true),
    () => done(false),
  );
}

const shown = new WeakMap<Element, number>();

/**
 * Puts a message in a status line for a few seconds, so saying the same thing twice is read out
 * twice.
 *
 * @param el    The status line.
 * @param text  The message.
 */
export function flash(el: Element | null, text: string): void {
  if (!el) return;
  clearTimeout(shown.get(el));
  el.textContent = text;
  shown.set(
    el,
    window.setTimeout(() => (el.textContent = ""), 3000),
  );
}

/**
 * Says something to screen readers, through the page's one live region.
 *
 * @param text  What to say.
 */
export function announce(text: string): void {
  const el = document.querySelector("#announce");
  if (!el) return;
  // Emptied first, so the same words twice are read out twice.
  el.textContent = "";
  requestAnimationFrame(() => (el.textContent = text));
}

/**
 * Marks a field as holding a value that can't be used, with what it takes said under it; or clears
 * that once it can.
 *
 * @param el       The field.
 * @param problem  What it takes, e.g. "From 10 to 80"; empty when the value is fine.
 */
export function markField(el: HTMLInputElement, problem: string): void {
  const box = el.closest(".field");
  const id = `${el.id || "field"}-problem`;
  let note = box?.querySelector<HTMLElement>(".field-problem") ?? null;
  if (!problem) {
    el.removeAttribute("aria-invalid");
    el.removeAttribute("aria-describedby");
    note?.remove();
    return;
  }
  el.setAttribute("aria-invalid", "true");
  if (!note && box) {
    note = document.createElement("span");
    note.className = "field-problem";
    note.id = id;
    box.append(note);
  }
  if (note) {
    note.textContent = problem;
    el.setAttribute("aria-describedby", note.id);
  }
}
