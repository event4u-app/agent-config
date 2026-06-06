---
model_tier: inherit
name: pixar-storyteller
description: "Use when turning an idea into a Pixar-style animation prompt — character sheet, scene, image, video — anchored in emotional beat, want, obstacle. Triggers 'Pixar prompt', 'animated scene'."
domain: product
workspaces:
  - small-business
packs:
  - ai-video
lifecycle: experimental
trust:
  level: experimental
install:
  default: false
  removable: true
---

# pixar-storyteller

> Turn an animation beat into the **four-block storyboard**:
> CHARACTER SHEET · SCENE PROMPT · IMAGE PROMPT · VIDEO PROMPT.
> Output is provider-agnostic; provider tuning is
> [`motion-choreographer`](../motion-choreographer/SKILL.md).
>
> The acting / storyboard lens is enforced inline by the procedure
> and self-review below.

## When to use

- A scene is animated / stylized (not photoreal) and needs an
  emotional read, not a film-set read.
- The character must want something and the environment must
  respond — flat poses fail.
- Live-action / photoreal beats → [`video-director`](../video-director/SKILL.md).

Do NOT use when:

- The deliverable is provider-tuned token grammar →
  `motion-choreographer` after this skill.
- A character must be re-used across scenes → run
  [`character-consistency`](../character-consistency/SKILL.md) first
  to lock the CHARACTER SHEET, then call this skill.
- The brief is a static graphic / poster → `canvas-design`.

## Procedure

### Step 0: Inspect

1. Confirm the input is an animated / stylized beat.
2. If `character.json` exists under `agents/reference/ai-video/<project>/characters/`,
   read identity tokens — reused verbatim in CHARACTER SHEET.
3. Read the beat once. Name the *want* and the *obstacle* in one
   sentence each before drafting.

### Step 1: Draft the four blocks

Emit each block under a labeled heading. Blocks are mandatory and
in this order:

1. **CHARACTER SHEET** — silhouette, palette, wardrobe, signature
   prop, posture default, eye behavior. Verbatim from `character.json`
   when a lock exists.
2. **SCENE PROMPT** — single emotional beat, want, obstacle,
   stylistic anchor (specific film + year — "Up (2009)", not
   "Pixar-style"), environment reaction.
3. **IMAGE PROMPT** — one still at the peak of the beat. Names
   composition, eye line, palette. No motion verbs.
4. **VIDEO PROMPT** — decomposes the moment into
   `anticipation Xs · action Ys · reaction Zs` with explicit beat
   counts. Names which secondary motion (hair, cloth, dust) reacts
   on which beat.

### Step 2: Self-review

1. Exactly one emotional beat in SCENE PROMPT? Compound moods fail.
2. Stylistic anchor is a specific film + year? Generic style → fail.
3. VIDEO PROMPT names beat counts per phase?
4. IMAGE PROMPT names eye line?
5. CHARACTER SHEET matches `character.json` byte-for-byte when a
   lock exists?

Any "no" → revise that block.

### Step 3: Validate

1. Output is plain text, one labeled block per heading, ready for
   `scripts/ai-video/lib/parse-blueprint.sh`.
2. No provider tokens — that is `motion-choreographer`.
3. No lens / focal-length prescriptions — that is `video-director`'s
   block, not this one.

## Output format

1. **`scenes/<id>/prompt.txt`** — four labeled blocks, ready for
   the blueprint parser.
2. **`scenes/<id>/review.md`** — one-paragraph rationale per
   non-obvious choice (stylistic anchor, environment reaction,
   beat decomposition).

## Gotcha

- The model defaults to "Pixar-style" with no film anchor — that
  reads as a wishlist. Force a specific title + year.
- Neutral faces are the AI default — every beat names a feeling
  the face is doing, including eye line direction.
- Environment-as-backdrop is the silent failure mode — name what
  the world *does* in response to the character.
- Collapsing anticipation and action into one verb makes motion
  look teleported. Both phases or the prompt fails review.
- When `character.json` exists, paraphrasing breaks Character Lock —
  copy identity tokens verbatim.

## Do NOT

- Do NOT prescribe lenses or focal lengths — that is `video-director`.
- Do NOT emit provider-specific tokens — that is `motion-choreographer`.
- Do NOT cite "Pixar-style" without a specific film + year.
- Do NOT compound emotional beats ("sad but hopeful and tired").

## Policies

The Pixar-storyteller skill anchors prompts to named films and studios by design — the policy surface is the largest in the video cluster:

- [`agents/settings/policies/media/style.md`](../../../agents/settings/policies/media/style.md) — naming a film + year as the *primary* anchor crosses the "in the style of [STUDIO]" trigger; surface and refuse without a transformative-intent rationale.
- [`agents/settings/policies/media/likeness.md`](../../../agents/settings/policies/media/likeness.md) — when a beat references a named animator's signature character (real-person extension of style).
- [`agents/settings/policies/media/public-figures.md`](../../../agents/settings/policies/media/public-figures.md) — when the storyteller's character is a recognised public figure rendered in Pixar shape.
- [`agents/settings/policies/media/disclosure.md`](../../../agents/settings/policies/media/disclosure.md) — every Pixar-style output ships with the AI-generation disclosure; parody / commentary cases are flagged for human review.

Refuse-and-surface when style ⇒ primary signature, not one influence among several.

