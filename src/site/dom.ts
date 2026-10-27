/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< DOM >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| What the pages share with the document: drawing a part of the page again without losing the      |
| focus, copying text, a status line that says something for a moment, and the sliders' fill.      |
\*------------------------------------------------------------------------------------------------*/

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
 * @param action   A way forward after the problem, as HTML; none when there isn't one.
 */
export function markField(el: HTMLInputElement, problem: string, action = ""): void {
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
    // A way forward, when there is one, follows the problem.
    if (action) note.insertAdjacentHTML("beforeend", ` ${action}`);
    el.setAttribute("aria-describedby", note.id);
  }
}

/* >----------------------------------------< Sliders >-----------------------------------------< */

/**
 * Brings every slider's look and spoken value up to date: the track fills up to the thumb, and a
 * slider with a readout under it is announced with its field's value and that readout, so a screen
 * reader hears what the value means, not only the number.
 */
export function syncSliders(): void {
  for (const slider of document.querySelectorAll<HTMLInputElement>('input[type="range"]')) {
    const [min, max] = [Number(slider.min || 0), Number(slider.max || 100)];
    slider.style.setProperty("--p", String(max > min ? (Number(slider.value) - min) / (max - min) : 0));
    const field = slider.closest(".field");
    const readout = field?.querySelector("[data-readout]");
    if (!readout) continue;
    const exact = field!.querySelector<HTMLInputElement>('input[type="number"]')?.value ?? slider.value;
    const unit = field!.querySelector(".with-unit > span")?.textContent ?? "";
    slider.setAttribute("aria-valuetext", `${exact}${unit}, ${readout.textContent ?? ""}`);
  }
}

/** Each readout as last written from settled results, kept while new ones arrive. */
const steadyReadouts = new Map<string, string>();

/**
 * A readout that holds still while results arrive: written anew once everything shown is settled,
 * otherwise the last one, so it never mixes old and new results or changes length mid-solve.
 *
 * @param key      Which readout.
 * @param settled  Whether everything it reads is settled.
 * @param make     Writes it anew.
 * @returns        HTML.
 */
export function steadyReadout(key: string, settled: boolean, make: () => string): string {
  const kept = steadyReadouts.get(key);
  if (!settled && kept !== undefined) return kept;
  const text = make();
  if (settled) steadyReadouts.set(key, text);
  return text;
}

// Sliders change by hand, by script (a field's twin) and by being drawn anew; each is caught, and
// the pass runs once right after the change, before the page is painted.
let pending = false;
const later = () => {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    syncSliders();
  });
};
document.addEventListener("input", later);
new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
