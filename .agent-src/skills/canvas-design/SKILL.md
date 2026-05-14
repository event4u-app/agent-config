---
name: canvas-design
description: "Use when creating static visual art — posters, marketing visuals, brand assets, PDF/PNG design pieces — even if the user just says 'design a poster' or 'mach uns ein Visual'."
source: package
domain: product
---

# canvas-design

## When to use

Use when:

* User asks for a poster, marketing visual, brand asset, social-media graphic, cover art
* Output is a static `.pdf` or `.png` design piece (not a UI mockup, not a wireframe)
* The deliverable is the visual artifact itself

Do NOT use when:

* Designing a UI component or app screen → `fe-design`, `ui-component-architect`, `react-shadcn-ui`, `blade-ui`, `flux`
* Tailwind / shadcn / Flux component styling → `tailwind-engineer`
* Brand voice / tone definition → `voice-and-tone-design`
* Release announcement copy → `release-comms`

## Goal

Produce one finished visual artifact (`.pdf` or `.png`) backed by an original design philosophy. Both files ship together.

The work emphasizes: visual expression over text · original direction (no artist mimicry) · composition that looks deliberated, not generated.

## Preconditions

* Brief from user (theme, intent, occasion, target medium, size constraint)
* Output directory: `agents/design-assets/{slug}/` — create if missing
* Image-generation tooling available (Python with Pillow / matplotlib / cairo, SVG → PNG conversion, or whatever the environment ships)

## Procedure

### 1. Brief intake

One numbered-options block surfaces: theme / occasion · target medium + dimensions (web 1200×630? print A3? square 1080×1080?) · color & mood direction · hard constraints (logo required? color to avoid?) · single page or series.

If the brief says "in the style of [living artist]", flag the copyright risk and propose an original direction.

### 2. Design philosophy

Author `agents/design-assets/{slug}/philosophy.md` — 4–6 paragraphs naming:

* **Movement name** — 1–2 words ("Chromatic Silence", "Brutalist Joy", "Analog Meditation")
* **Visual language** — how the philosophy manifests through space, form, color, scale, composition, rhythm
* **Text role** — sparse, accent only; never paragraphs
* **Craftsmanship anchor** — visible deliberation, not template polish

Stay aesthetically specific but leave interpretive room for the canvas execution.

### 3. Subtle conceptual thread

Identify a single niche reference embedded in the work — not announced, woven into form / color / composition. A jazz musician quoting another song: those who know catch it, others enjoy the music.

Document it in `philosophy.md` under `## Subtle reference`.

### 4. Canvas execution

Produce `agents/design-assets/{slug}/{slug}.{pdf|png}`:

1. Pick the execution tool (Pillow, matplotlib, SVG, or framework-native)
2. Limited palette — 2–5 colors, intentional and cohesive
3. Geometric or organic forms per philosophy
4. Text — sparse, design-forward, integrated as visual element; never overlapping, never falling off canvas
5. Margins — every element contained, breathing room
6. Repeating patterns, layered elements, systematic markers as the philosophy permits

### 5. Refinement pass

After the first render, **do not add more graphics**. Refine what exists:

* Tighten composition cohesion
* Adjust spacing, alignment, color balance
* Replace fonts if they fight the philosophy
* Remove any element that doesn't earn its place

Render the refined version. Overwrite the artifact.

### 6. Multi-page (optional)

If the user requests a series, treat each page as a story beat — distinct but philosophically continuous. Bundle as a multi-page PDF or numbered PNGs (`{slug}-01.png`, `{slug}-02.png`, …).

### 7. Validation

* `philosophy.md` exists with movement name + 4–6 paragraphs + subtle-reference section
* Artifact file exists at the expected path
* Open and verify: nothing falls off canvas, no overlapping text, palette ≤ 5 distinct colors, every element has margin
* Original work — no traceable artist-style copy

## Output format

1. `agents/design-assets/{slug}/philosophy.md`
2. `agents/design-assets/{slug}/{slug}.{pdf|png}` (or numbered series for multi-page)
3. One concluding line stating both file paths

## Gotcha

* **No artist mimicry** — copying a living artist's signature style is copyright risk and breaks the original-work mandate. Propose an original direction.
* **Text discipline** — most pieces fail because text creeps in as paragraphs. Words are visual accents, not explanation.
* **One canvas** — single page unless multi-page is explicitly requested.
* **Font availability** — the environment may not ship your target font. Pick a fallback before render time, or download into the working dir first.
* **Output location** — always `agents/design-assets/{slug}/`. Never write binary artifacts to the repo root or to source-of-truth dirs.
* **Refinement loop is real** — first render is the draft, not the deliverable.

## Frugality Standards

Apply the [Frugality Charter](../../contexts/contracts/frugality-charter.md).

* Per the default-terse rule, `philosophy.md` opens with the movement name — no "In this document I will describe …" frame.
* Per the cheap-question check, numbered-options blocks only at brief intake (where consequences differ).
* Per the post-action summary suppression, ship the files; skip an "## Artist statement" wrapper.

**Pre-save self-check:**

1. Does `philosophy.md` carry filler superlatives ("absolute pinnacle", "transcendent")?
2. Does the canvas include explanatory text instead of visual-accent text?
3. Are more than 5 distinct colors present without justification in the philosophy?
4. Is the subtle reference announced explicitly in the visual, breaking the "those who know" principle?

## Do NOT

* Copy a living artist's signature visual style
* Generate cartoony / amateur / template-store output
* Add paragraphs of text — visuals communicate, words accent
* Skip the philosophy file — the artifact without it is just an image
* Skip the refinement pass
* Write binary artifacts to the repo root or to source-of-truth dirs
