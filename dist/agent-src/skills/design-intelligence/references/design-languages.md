# Design languages — rich prose specs (on-demand reference)

> Sixteen complete design-language specifications (philosophy → token
> system → component styling), adopted from
> `nextlevelbuilder/ui-ux-pro-max-skill` `design.csv`
> @ `b7e3af80f6e331f6fb456667b82b12cade7c9d35` (MIT, last checked
> 2026-06-07). Chinese titles/intros translated to English; the full
> English spec bodies live verbatim in
> [`../data/design-languages/`](../data/design-languages/) — one `.txt`
> per style, ready to paste into a design brief or generation prompt.
>
> This is **reference** material (mid-action lookup), not the grounding
> corpus — style *selection* runs through the engine
> (`corpus-grounding` + `styles.csv`); open a spec here only after a
> style is chosen.

| Style | Essence (translated) | Spec file |
|---|---|---|
| **Bauhaus** | Bold geometric modernism — circles, squares, triangles; primary palette (red/blue/yellow), crisp edges, hard shadows; functional yet artistic with constructivist asymmetry. | [`bauhaus.txt`](../data/design-languages/bauhaus.txt) |
| **Monochrome** | Editorial system built on pure black & white — no accent color, only dramatic contrast, oversized serifs, precise geometric layout; high-fashion / architecture-portfolio feel. | [`monochrome.txt`](../data/design-languages/monochrome.txt) |
| **Modern Dark** | Cinematic, high-precision dark mode — animated gradient blobs, cursor-tracking spotlight, layered ambient lighting and crafted micro-interactions; feels like premium software. | [`modern-dark.txt`](../data/design-languages/modern-dark.txt) |
| **SaaS** | Bold minimalist modern visual system — signature electric-blue gradients, sophisticated dual-font pairing, dynamic execution. | [`saas.txt`](../data/design-languages/saas.txt) |
| **Terminal** | Raw, functional retro-futurist command-line aesthetic — high contrast, monospace precision, blinking cursor. | [`terminal.txt`](../data/design-languages/terminal.txt) |
| **Kinetic** | Motion-first design with typography as the primary visual medium — infinite marquees, viewport-scaled text, scroll-triggered animation, aggressive uppercase; rhythmic brutalist energy. | [`kinetic.txt`](../data/design-languages/kinetic.txt) |
| **Flat Design** | Depth cues removed (no shadows/bevels/gradients) in favor of solid color, typography and layout — clean, two-dimensional, geometric, bold color blocking. | [`flat-design.txt`](../data/design-languages/flat-design.txt) |
| **Material Design** | Playful dynamic color extraction, pill buttons, distinct elevation states — Google Material 3 with enhanced depth and micro-interactions. | [`material-design.txt`](../data/design-languages/material-design.txt) |
| **Neo Brutalism** | Raw high-contrast aesthetic echoing print design and DIY punk — cream backgrounds, thick 4px black borders, zero-blur hard offset shadows. | [`neo-brutalism.txt`](../data/design-languages/neo-brutalism.txt) |
| **Bold Typography** | Type-led design with huge headlines as the main visual element — extreme contrast and dramatic negative space create poster-like compositions where text becomes the art. | [`bold-typography.txt`](../data/design-languages/bold-typography.txt) |
| **Academia** | Collegiate aesthetic — old libraries, warm paper textures, traditional serifs, gold/crimson tones. | [`academia.txt`](../data/design-languages/academia.txt) |
| **Cyberpunk** | High-contrast neon on black, glitch animation, terminal/monospace type, tech ornamentation — dystopian digital aesthetic from 80s sci-fi and hacker culture. | [`cyberpunk.txt`](../data/design-languages/cyberpunk.txt) |
| **Claymorphism** | Surreal 3D aesthetic of soft inflated clay objects — multi-layer shadow stacking, vibrant candy-shop colors, tactile micro-interactions, organic floating elements. | [`claymorphism.txt`](../data/design-languages/claymorphism.txt) |
| **Enterprise** | Modern SaaS aesthetic balancing professionalism and approachability — vivid indigo/violet gradients, soft shadows, isometric depth, clean geometric sans-serifs. | [`enterprise.txt`](../data/design-languages/enterprise.txt) |
| **Sketch** | Organic wobbly borders, handwritten typography, paper texture, playful imperfection — every element looks marker-and-pencil drawn on textured paper. | [`sketch.txt`](../data/design-languages/sketch.txt) |
| **Neumorphism** | Extruded and inset elements via dual shadows on a monochromatic background — soft, tactile, physically grounded; mind the accessibility limits. | [`neumorphism.txt`](../data/design-languages/neumorphism.txt) |

## How to use

1. Select the style through the grounding engine first:
   `python3 <skills-root>/corpus-grounding/scripts/ground.py search
   --manifest <skills-root>/design-intelligence/data/manifest.json
   --domain style "<product + mood>"`.
2. Open the matching spec file and lift its token system (colors,
   typography, radius/border, shadows) into the design brief.
3. Use-case lists inside each spec stay source-language where upstream
   mixed languages; the spec bodies (the load-bearing part) are English.
