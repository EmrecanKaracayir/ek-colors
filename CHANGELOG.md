# Changelog

All notable changes to EK Colors are written down here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and EK Colors
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A base can be any opaque CSS color, such as hex, `rgb()`, `oklch()` or `color(display-p3 …)`,
  kept as given. Each gamut shows it exactly where it can; a narrower one uses the closest color it
  can show to the next wider one's (CSS Color 4 gamut mapping), so a color picked for Wide carries
  down to Standard. That color can be picked by hand while it's still the same background: no more
  than ΔE 2 further from the base than the closest color is. A further one is refused, with Use it
  as the base. A base changed under a pick takes it back to the closest color, and says so.
- Settings keep the picks under `gamutBases`, per gamut and mode; JSON exports carry it.
- In Settings, Base shows the base as the gamut picked in the header writes it, with its form as a
  hint, an amber mark when it's the closest color and a check when picked; it opens how every gamut
  shows it. Every palette is solved, exported and checked against its gamut's base; `--base` and
  Gray are written per gamut where they differ.
- While the gamut on screen can't show the base, an amber notice under the header gives the closest
  color and leads to Settings. The red notice for a gamut wider than the screen shows on Settings too.

### Changed

- The export in Settings is colored once it comes near the screen, so Settings redraws about
  three times faster.
- Neutral colors are exported on every gamut, as Gray where its base is gray.
- Buttons are named for screen readers starting with what they show, and the main navigation says
  which page is current.

### Fixed

- A palette name with HTML in it was drawn as HTML; it's text now, wherever it shows.
- A base written as anything but hex was read lighter than it is when dark: `rgb(78 78 78)` read
  as L\* 69 rather than 33.
- The Algorithm page broke on a base that isn't hex.
- A readout could keep old text after turning edits back on.
- The exported CSS's opening comment could be ended by the palette's name.
- Name fields of custom and neutral colors were taller than other fields, from a swatch's style.
- Light and Dark fields in Viewing stay side by side on the same rows when one shows a problem.

## [2.3.0] - 2026-10-27

### Added

- Neutrals: Gray on every tier in every palette, its red, green and blue the same, exactly on the
  tier's contrast. Neutral colors take the base's hue at a share of the base's colorfulness, each
  mode following its own base; they can be added with "Add a neutral color" once a base has a hue,
  at M 4 or more. A base under that reads as gray, and two gray bases have no neutral colors. Gray
  and each neutral color have pages beside the colors' and come in every export, as `--gray-60`
  and, when a base has a hue, one per neutral color named after it, such as `--neutral-60`.
- Extra colors are split into custom colors and neutral colors, side by side in Settings, with what
  each is for said above them. New ones are named Custom and Neutral, Custom 2 and Neutral 2, and so on.
- A colorfulness slider has an exact field to a tenth of a percent and a bar of zones under it:
  Gray under M 4, Neutral from M 4 to 12, Color past it. Its readout names the zone, and opens a
  popover with the zones, where they come from, and the color's distance from Gray on every tier.
  At 0% it says Exactly Gray.
- One slider and one checkbox of the site's own for every slider and checkbox: the same in every
  browser, at least 3:1 contrast, a focus ring on the thumb or box, and spoken values that say what
  a share means. High-contrast screens keep the system's own.
- Before the first solve, the strip says Solving and shows dashes for its numbers.

### Changed

- American spelling throughout: gray, not grey. Quoted titles keep their own spelling.
- A custom color's share has no limits: 0 and up, past 100% for a color stronger than the palette's
  colorfulness, as far as the screen allows.
- Custom colors, neutral colors and the muted share reuse the hues already solved: a change to them
  takes milliseconds instead of a whole solve, and follows a slider as it moves.
- The add and measure buttons sit centered over the fields, and names fill their row.
- How it works, the algorithm page and the README describe custom and neutral colors, the zones and
  the kept hues; extra colors are custom colors wherever a color is meant.

### Fixed

- Settings no longer jumps while the palette solves: what's on screen keeps its last result until
  the new one arrives, a redraw keeps the strip as it was, and the browser's own scroll correction,
  which moved the page after a redraw, is off there.
- The value panels beside the hue and curve graphs line up with the top of the graph.
- The algorithm page's list of limits gave the share's as "0%–Infinity%"; it says "0% or more".

## [2.2.4] - 2026-10-26

### Changed

- On phones the strip keeps its bend numbers and leaves out the meter and verdict, which overflowed
  there.
- Pinned on a phone, the strip's colors take the whole width instead of leaving room for the row
  names and numbers it hides.
- Tablets keep the full strip, with its row names, numbers and meter; its compact form is for
  phones only, below 36rem.

### Fixed

- The bar and the pinned strip cover the side gutters, so nothing scrolls by beside them on phones.
- In browsers that keep a band above the page, such as X's, the strip now shows it's pinned, and
  "Skip to content" stays out of sight until it has the focus.

## [2.2.3] - 2026-10-26

### Changed

- The compact bar's switch groups sit a little closer together, 0.75rem apart instead of 1rem.
- The bend meter has a faint hairline around it, so its darkest zones stay visible.

### Fixed

- The status keeps a time and its unit together, so "0.8 s" never breaks before the "s".
- The strip's bend meter is no longer cut off at its edges, its marker at Uniform included.
- Underlines run unbroken under the strip's labels and under a card's colorfulness with its mark,
  which are now spaced with text instead of gaps and margins.

## [2.2.2] - 2026-10-26

### Changed

- All clickable text shares one underline: dotted, links and copy values included, and solid while
  its popover is open, its state is on, or a value shows "Copied".
- The strip's row names (Uniform, Turned, +H, +M) are text buttons: dotted underlines, lit by the
  pointer without a background, and a solid underline while a row is kept shown.
- The strip's labels read as one line from the left, the name and its gap with a bullet between,
  as in "Hue 1 • 0.0 gap"; crowded, they still shorten to "Hue 1 • 0.0", then "#1 • 0.0".
- The strip's bend verdict has no ⓘ; its dotted underline already says it opens what it means.
- The strip's Bend, Even and M columns hug their numbers, at least four characters each, and sit
  closer together, so the block beside the colors is narrower and its meter starts under Bend. A
  verdict or color name too long for it is cut short, and a color's dot sits closer to its name.

### Fixed

- A color() value keeps its line break after being copied, and copying again while it shows
  "Copied" no longer leaves it stuck there.

## [2.2.1] - 2026-10-26

### Changed

- The Settings strip, and the one in How it works, keeps its colors in one row however many there
  are. With more than fit, the row scrolls sideways and fades on each side with more to see, so the
  pinned strip never grows. Each color is at least 6rem wide on desktop and 3.5rem on phones.
- The strip's labels put the name on the left and the gap on the right. Crowded, the word "gap" goes
  first, then "Hue" becomes "#", as in "#3"; on phones a numbered hue shows "#3" and its gap, a
  named one its gap alone.
- The bar switches to the menu button below 54rem, and there puts the switches between the name and
  the status whenever they fit on one line.
- The status may wrap onto a second line, set closer together.

### Fixed

- The name in the bar no longer wraps onto two lines at in-between widths.
- In the compact bar, each ⓘ sits by its own switch, and the switches stand apart from each other,
  so it's clear which ⓘ explains which.

## [2.2.0] - 2026-10-26

### Added

- This changelog, linked from the version line in Settings' About.
- `pnpm release <version>`: checks the version is a newer semantic version, dates the changelog's
  Unreleased section as it, sets package.json, checks, builds, solves, commits and tags.
- Any number of hues from 2 up. Past 16 an amber note says neighbors come too close to tell apart
  easily; past 32 a red one says solving can take a long time.

### Changed

- Numbered hues are listed from Hue 1 everywhere, the strip, the Overview, the tables and the
  exports; named hues still start at red. The colors themselves don't change.
- The Settings strip puts each color's name and its gap on lines of their own.

### Fixed

- A long solve for settings that have since changed is stopped, instead of holding up the next one.

## [2.1.4] - 2026-10-26

### Changed

- The page description, the link preview and the preview card say "evenly different" instead of
  "evenly spaced": the hues are spaced to look equally different, and most of EK Palette's are
  placed by name.

## [2.1.3] - 2026-10-26

### Changed

- The algorithm page: the target stops at grey, where each tier's reach is measured, the identity
  grey when none reaches the tier, what each mark is measured against, and a new list of how
  settings are checked.
- How it works: the live gap between neighbors, Lowered, the screen's dot on the Gamut switch and
  the note for a wider gamut, the order of the bases, and everything Settings does.
- README: placed hues, the identity tier, hue windows, what `pnpm solve` doesn't check, named
  outputs, Compare and Settings, and what `pnpm art` needs.

## [2.1.2] - 2026-10-26

### Fixed

- Reset, Copy settings and Paste settings stay on the right on narrow screens.

## [2.1.1] - 2026-10-26

### Added

- A dot on the hue circle shows its colorfulness and hue under its name, as in "M 44 • 96°".

### Changed

- Separators are bullets (•); formulas keep the middle dot.
- The link preview card shows the eight hues, without brown.

## [2.1.0] - 2026-10-25

### Added

- Palettes have names, shown on the Overview and in the Markdown and CSS exports.
- An icon drawn from the palette: its two bases as halves of a circle inside a ring of its hues.
  The Overview shows the palette on screen's; the site uses EK Palette's.
- `pnpm art` draws the site icon, the iPhone home-screen icon and the link preview card.
- Link previews, a canonical address, theme colors for phone browsers, structured data and a short
  description for crawlers that don't run JavaScript.
- Exports are syntax colored, in EK Palette's own colors.
- Compare is always there, against EK Palette, and says how EK Palette was made; Shift+C compares
  with Codemos instead.
- The hue circle can be shown as a table.
- A button to add a curve point.
- The light base must be lighter than the dark base.

### Changed

- Color tables right-align their values, with each badge, mark or hue name to its left.
- Gamut limit, Sets the tier and Lowered are marks everywhere (!, a flag and ↓), with a key under
  every group of colors that has them.
- The note that the screen can't show the chosen gamut is red.
- Settings has its actions on the right, and dropdowns keep their chevrons off the edge.
- The fonts no longer hold up the first paint.
- Accessibility: the focus stays put when a part of the page is drawn again, fields say what's wrong
  with their value, popovers belong to their buttons, a live region announces changes, small
  controls are at least 24 px, and graph values are written out in words.

### Fixed

- The browser no longer asks for a missing icon.
- Scrollbars on dark pages have a dark track.

## [2.0.0] - 2026-10-25

The first release as EK Colors, the project Codemos palette grew into.

### Added

- The solver: every color exactly on its APCA contrast tier, equally colorful in CAM16, and evenly
  different from its neighbors in CAM16-UCS, for light and dark and for three kinds of screen.
- EK Palette: eight hues and brown, each placed where its name fits best.
- Extra colors, colorfulness per hue as a curve, placed hues, and an anchor from CAM16, Munsell,
  NCS, unique hues or the World Color Survey's focal colors.
- Automatic identity tiers: the tier where APCA and WCAG 2 together are just at their minimum for
  text, which can also be set by hand on the Tiers page or in Settings.
- The site: Overview, Tiers, a page per color, Compare, How it works, the algorithm, References and
  Settings, with two blind tests, one for colorfulness per hue and one for where each name fits.
- Export as JSON, CSV, Markdown or CSS, the CSS with `light-dark()` custom properties per gamut.
- Settings can be copied, and pasted back in with each field checked, with Undo paste.

[Unreleased]: https://github.com/EmrecanKaracayir/ek-colors/compare/v2.3.0...HEAD
[2.3.0]: https://github.com/EmrecanKaracayir/ek-colors/compare/v2.2.4...v2.3.0
[2.2.4]: https://github.com/EmrecanKaracayir/ek-colors/compare/v2.2.3...v2.2.4
[2.2.3]: https://github.com/EmrecanKaracayir/ek-colors/compare/v2.2.2...v2.2.3
[2.2.2]: https://github.com/EmrecanKaracayir/ek-colors/compare/v2.2.1...v2.2.2
[2.2.1]: https://github.com/EmrecanKaracayir/ek-colors/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/EmrecanKaracayir/ek-colors/compare/v2.1.4...v2.2.0
[2.1.4]: https://github.com/EmrecanKaracayir/ek-colors/compare/v2.1.3...v2.1.4
[2.1.3]: https://github.com/EmrecanKaracayir/ek-colors/compare/v2.1.2...v2.1.3
[2.1.2]: https://github.com/EmrecanKaracayir/ek-colors/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/EmrecanKaracayir/ek-colors/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/EmrecanKaracayir/ek-colors/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/EmrecanKaracayir/ek-colors/releases/tag/v2.0.0
