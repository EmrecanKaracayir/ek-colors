/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ICON >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The EK Colors icon, drawn from any palette: its two bases as halves of a circle, light on the    |
| right, inside a ring of its hues, one arc each in hue order from the top. The site's own icon is |
| EK Palette's; the Overview draws the palette on screen.                                          |
\*------------------------------------------------------------------------------------------------*/

/** A hue on the ring: where it sits on the hue circle, and its color. */
export interface RingHue {
  readonly hue: number;
  readonly color: string;
}

/**
 * The icon, on a 32 by 32 grid: the ring's arcs are even, a small gap apart, with the lowest hue
 * centered at the top and the rest clockwise in hue order.
 *
 * @param light  The light base, the right half.
 * @param dark   The dark base, the left half.
 * @param ring   The hues.
 * @param attrs  More attributes for the svg element, e.g. a class or a size.
 * @returns      SVG.
 */
export function iconSvg(light: string, dark: string, ring: readonly RingHue[], attrs = ""): string {
  const at = (deg: number) =>
    [16 + 14 * Math.cos((deg * Math.PI) / 180), 16 + 14 * Math.sin((deg * Math.PI) / 180)]
      .map((v) => v.toFixed(2))
      .join(" ");
  const step = 360 / ring.length;
  const arcs = [...ring]
    .sort((a, b) => a.hue - b.hue)
    .map((h, i) => {
      const from = -90 - step / 2 + i * step;
      return `<path d="M${at(from + 1.5)}A14 14 0 0 1 ${at(from + step - 1.5)}" fill="none" stroke="${h.color}" stroke-width="3.5"/>`;
    });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"${attrs ? ` ${attrs}` : ""}>${arcs.join("")}<path d="M16 5.5a10.5 10.5 0 0 0 0 21z" fill="${dark}"/><path d="M16 5.5a10.5 10.5 0 0 1 0 21z" fill="${light}"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="#808080" stroke-width="0.75"/></svg>`;
}
