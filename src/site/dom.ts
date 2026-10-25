/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< DOM >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the pages share with the document: drawing a part of the page again without losing the      |
| focus, copying text, and a status line that says something for a moment.                         |
\*------------------------------------------------------------------------------------------------*/

/**
 * Draws an element's contents again. Whatever control had the focus inside it gets it back, found
 * by its id and data attributes, so redrawing never sends a keyboard user to the top of the page.
 *
 * @param el    The element.
 * @param html  Its new contents.
 */
export function refill(el: Element, html: string): void {
  const active = document.activeElement;
  const selector =
    active && active !== el && el.contains(active)
      ? [...active.attributes]
          .filter((a) => a.name === "id" || a.name.startsWith("data-"))
          .map((a) => `[${a.name}="${CSS.escape(a.value)}"]`)
          .join("")
      : "";
  el.innerHTML = html;
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
