/*------------------------------------------------------------------------------------------------*\
| <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< REFERENCES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> |
|*------------------------------------------------------------------------------------------------*|
| The References page: every model, standard, data set, method and library EK Colors is built on,  |
| each with what it's used for here.                                                               |
\*------------------------------------------------------------------------------------------------*/

import project from "../../../package.json";
import { SYSTEMS } from "../../palette/references";
import { escape } from "../graph";

/** One work the site relies on. */
interface Source {
  /** The citation, as HTML. */
  readonly cite: string;

  /** Where to read it, if it's online. */
  readonly link?: string;

  /** What it's used for here. */
  readonly use: string;
}

/** A group of sources under one heading. */
interface Group {
  readonly title: string;
  readonly sources: readonly Source[];
}

/** A paper's DOI as a link. */
const doi = (id: string) => `https://doi.org/${id}`;

const GROUPS: readonly Group[] = [
  {
    title: "Color appearance",
    sources: [
      {
        cite: "Li, C., Li, Z., Wang, Z., Xu, Y., Luo, M. R., Cui, G., Melgosa, M., Brill, M. H. &amp; Pointer, M. <em>Comprehensive color solutions: CAM16, CAT16, and CAM16-UCS.</em> Color Research &amp; Application 42(6), 703–718, 2017.",
        link: doi("10.1002/col.22131"),
        use: "The color model: lightness J, colorfulness M and hue in each mode's viewing conditions, and the hue names (R, Y, G, B and the mixes between them).",
      },
      {
        cite: "Luo, M. R., Cui, G. &amp; Li, C. <em>Uniform colour spaces based on CIECAM02 colour appearance model.</em> Color Research &amp; Application 31(4), 320–330, 2006.",
        link: doi("10.1002/col.20227"),
        use: "The uniform space every difference (ΔE) is measured in, and so the even spacing, bend and evenness.",
      },
      {
        cite: "CIE 159:2004. <em>A colour appearance model for colour management systems: CIECAM02.</em> Commission Internationale de l'Éclairage, 2004.",
        use: "The model CAM16 refines, and its table of unique hues behind the hue names.",
      },
      {
        cite: "IEC 61966-2-1:1999. <em>Multimedia systems and equipment: colour measurement and management, part 2-1: default RGB colour space, sRGB.</em> International Electrotechnical Commission, 1999.",
        use: "The standard screen, and the two rooms: its typical room (200 lux) for light mode and its reference room (64 lux) for dark mode.",
      },
      {
        cite: "Ottosson, B. <em>A perceptual color space for image processing.</em> 2020.",
        link: "https://bottosson.github.io/posts/oklab/",
        use: "Oklab lightness, in which the default light base sits a few just-noticeable steps below white; the dark base mirrors its contrast.",
      },
    ],
  },
  {
    title: "Contrast",
    sources: [
      {
        cite: "Somers, A. <em>APCA, the Accessible Perceptual Contrast Algorithm</em>, version 0.0.98G. Myndex Research.",
        link: "https://github.com/Myndex/apca-w3",
        use: "The contrast every tier is solved to, in Lc, and, after its guidance, what each tier is for.",
      },
      {
        cite: "W3C. <em>Web Content Accessibility Guidelines (WCAG) 2.2.</em> 2023.",
        link: "https://www.w3.org/TR/WCAG22/",
        use: "The contrast ratio and levels reported beside every color: AA and AAA for text, 3:1 for large text and for icons, borders and controls.",
      },
    ],
  },
  {
    title: "Screens",
    sources: [
      {
        cite: "W3C. <em>CSS Color Module Level 4.</em>",
        link: "https://www.w3.org/TR/css-color-4/",
        use: "The color spaces of the three gamuts (sRGB, Display P3, Rec. 2020), the color() values the wide and ultra palettes are written in, the CSS colors a base can be written in, and the gamut mapping that finds the closest color a narrower screen can show to a base.",
      },
      {
        cite: "W3C. <em>CSS Color Module Level 5.</em>",
        link: "https://www.w3.org/TR/css-color-5/",
        use: "light-dark(), which gives each exported color its light and dark value by color-scheme.",
      },
      {
        cite: "Recommendation ITU-R BT.2020-2. <em>Parameter values for ultra-high definition television systems for production and international programme exchange.</em> International Telecommunication Union, 2015.",
        use: "The widest gamut, Ultra.",
      },
      {
        cite: "W3C. <em>Media Queries Level 4</em>, the color-gamut feature.",
        link: "https://www.w3.org/TR/mediaqueries-4/#color-gamut",
        use: "How a page tells which gamut a screen can show.",
      },
    ],
  },
  {
    title: "Hue references",
    sources: [
      ...SYSTEMS.filter((s) => s.id !== "cam16").map((s) => ({ cite: escape(s.source), use: `${s.name}: the guides on the hue graphs, and its yellow as an anchor. ${s.summary}` })),
      {
        cite: "Lam, K. M. <em>Metamerism and colour constancy.</em> PhD thesis, University of Bradford, 1985.",
        use: "The Bradford transform, which adapts the Munsell, Unique hues and World Color Survey colors from illuminant C to D65.",
      },
    ],
  },
  {
    title: "Neutral colors",
    sources: [
      {
        cite: "WorkOS. <em>Radix Colors</em>, slate.",
        link: "https://www.radix-ui.com/colors",
        use: "A tinted neutral the Neutral zone is checked against.",
      },
      {
        cite: "Tailwind Labs. <em>Tailwind CSS</em>, the default palette's zinc and slate.",
        link: "https://tailwindcss.com/docs/colors",
        use: "Tinted neutrals the Neutral zone is checked against; slate sits at its top, where a gray reads blue.",
      },
    ],
  },
  {
    title: "Blind tests",
    sources: [
      {
        cite: "Levitt, H. <em>Transformed up-down methods in psychoacoustics.</em> The Journal of the Acoustical Society of America 49(2B), 467–477, 1971.",
        link: doi("10.1121/1.1912375"),
        use: "The staircases that move each color toward where answers turn over.",
      },
      {
        cite: "Wichmann, F. A. &amp; Hill, N. J. <em>The psychometric function: I. Fitting, sampling, and goodness of fit.</em> Perception &amp; Psychophysics 63(8), 1293–1313, 2001.",
        link: doi("10.3758/BF03194544"),
        use: "Fitting a logistic curve to the answers by maximum likelihood, to find the equal point.",
      },
      {
        cite: "Wilks, S. S. <em>The large-sample distribution of the likelihood ratio for testing composite hypotheses.</em> The Annals of Mathematical Statistics 9(1), 60–62, 1938.",
        link: doi("10.1214/aoms/1177732360"),
        use: "The 95% range around each result (1.92 below the best log-likelihood), and when a result counts as sure.",
      },
    ],
  },
  {
    title: "Software and type",
    sources: [
      {
        cite: `Google. <em>material-color-utilities</em> ${project.dependencies["@material/material-color-utilities"]}. Apache License 2.0.`,
        link: "https://github.com/material-foundation/material-color-utilities",
        use: "CAM16, its viewing conditions and CAM16-UCS, as the palette's model.",
      },
      {
        cite: `Verou, L. &amp; Lilley, C. <em>Color.js</em> ${project.dependencies["colorjs.io"]}. MIT License.`,
        link: "https://colorjs.io",
        use: "APCA, WCAG 2, the color spaces, reading CSS colors, checking which colors a screen can show, and CSS Color 4 gamut mapping.",
      },
      {
        cite: "Instrument. <em>Instrument Sans.</em> SIL Open Font License 1.1.",
        link: "https://fonts.google.com/specimen/Instrument+Sans",
        use: "The site's text.",
      },
      {
        cite: "JetBrains. <em>JetBrains Mono.</em> SIL Open Font License 1.1.",
        link: "https://www.jetbrains.com/lp/mono/",
        use: "The site's numbers and color values.",
      },
      {
        cite: `Microsoft. <em>TypeScript</em> ${project.devDependencies.typescript}. Apache License 2.0.`,
        link: "https://www.typescriptlang.org",
        use: "The language the solver and the site are written in.",
      },
      {
        cite: `Wallace, E. <em>esbuild</em> ${project.devDependencies.esbuild}. MIT License.`,
        link: "https://esbuild.github.io",
        use: "The tool that bundles the solver and the site for the browser.",
      },
    ],
  },
];

/* >------------------------------------------< Page >------------------------------------------< */

/**
 * The References page: the sources in groups, numbered through.
 *
 * @returns  HTML.
 */
export function references(): string {
  let n = 0;
  const groups = GROUPS.map(
    (g) => `<section class="step">
      <h2>${g.title}</h2>
      <ol class="sources" start="${String(n + 1)}">${g.sources
        .map((s) => {
          n++;
          return `<li><p>${s.link ? `${s.cite} <a href="${s.link}">${s.link.replace(/^https:\/\//, "")}</a>` : s.cite}</p><p class="soft">${s.use}</p></li>`;
        })
        .join("")}</ol>
    </section>`,
  );
  return `<section class="intro">
      <h1>References</h1>
      <p>The models, standards, data and methods EK Colors is built on, and the software and type that run it, each with what it's used for here. <a href="#how">How it works</a> tells the whole thing in plain words; <a href="#algorithm">the algorithm</a> gives every formula.</p>
    </section>
    ${groups.join("")}`;
}
