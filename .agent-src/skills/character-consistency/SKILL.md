---
model_tier: inherit
name: character-consistency
description: "Use when a character must stay visually identical across AI video scenes — locks identity tokens (silhouette, palette, wardrobe, prop) in JSON. Triggers 'character lock', 'same character'."
personas:
  - hollywood-director
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

# character-consistency

> Lock a character's visual identity into
> `agents/reference/ai-video/<project>/characters/<id>.json` so every scene
> reuses the **exact same tokens** verbatim. Downstream skills
> ([`video-director`](../video-director/SKILL.md),
> [`pixar-storyteller`](../pixar-storyteller/SKILL.md),
> [`motion-choreographer`](../motion-choreographer/SKILL.md)) read
> this file and never paraphrase. Verified by visual regression
> (pixel similarity ≥ 95%, Phase 6 Step 3).

## When to use

- A multi-scene run names the same character on screen more than
  once — Character Lock is mandatory before the second scene drafts.
- A character drift bug landed (face / outfit / prop changed between
  scenes) — re-lock and rerun the affected scenes.
- A series, episode, or recurring ad uses the same on-screen identity.

Do NOT use when:

- One-shot scene with no recurring character — overhead is wasted.
- The "character" is an object or environment, not a person /
  creature — use a `style.json` lock pattern in the project's notes
  instead.

## Procedure

### Step 0: Inspect

1. Check `agents/reference/ai-video/<project>/characters/` — if a lock already
   exists for this id, **read it, do not redraft**. Edits require an
   explicit revision note (Phase 6 visual regression must rerun).
2. Confirm the character will appear in ≥ 2 scenes; one-shot → skip.

### Step 1: Draft identity tokens

Emit a JSON file at
`agents/reference/ai-video/<project>/characters/<character-id>.json` with the
following fields. Every field is mandatory; missing field → fail
the lock.

```json
{
  "id": "kebab-case-id",
  "name": "Display Name",
  "silhouette": "one-line read of the body shape from 30m",
  "palette": ["#hex1", "#hex2", "#hex3"],
  "wardrobe": "garment list, materials, era",
  "signature_prop": "the one object that travels with them",
  "posture_default": "how they stand when not acting",
  "eye_behavior": "blink rhythm, glance habit",
  "face": "age band, skin tone, hair (length / color / texture), distinguishing marks",
  "voice_note": "timbre + cadence for native-audio adapters; null if N/A",
  "reference_frame": "scenes/<id>/frames/<n>.png or null",
  "version": 1
}
```

### Step 2: Reference frame

1. After the first scene renders, copy the highest-quality frame
   showing the character full-face and full-body to
   `agents/reference/ai-video/<project>/characters/<id>.ref.png`.
2. Update `reference_frame` in the JSON to point at it.
3. Phase 6 visual regression compares every subsequent scene's
   character frame against this reference (ImageMagick `compare`
   ≥ 95% similarity).

### Step 3: Validate

1. JSON parses (`jq . characters/<id>.json` exits 0).
2. All mandatory fields present and non-empty.
3. Palette has ≥ 2 and ≤ 5 hex values.
4. Downstream skills cite this file by path, never paraphrase its
   contents.

## Output format

1. **`agents/reference/ai-video/<project>/characters/<id>.json`** — locked
   identity tokens, schema above.
2. **`agents/reference/ai-video/<project>/characters/<id>.ref.png`** —
   reference frame (added after first render).
3. **`agents/reference/ai-video/<project>/characters/CHANGELOG.md`** — one
   line per revision: `v<n> · YYYY-MM-DD · reason · scenes-to-rerun`.

## Gotcha

- The model wants to "improve" identity tokens on each scene —
  this is the silent drift failure. Tokens are immutable until a
  revision note bumps `version`.
- Palette without a count fails downstream — adapters need a small
  closed set (2–5 hex).
- `voice_note: null` is explicit; missing the key entirely breaks
  the schema validator.
- Reference frame is captured *after* the first successful render,
  not before — bootstrap scenes have no reference and only the
  JSON locks them.
- A revision (`version` bumped) requires Phase 6 visual regression
  to rerun against every prior scene that used the old version.

## Do NOT

- Do NOT paraphrase identity tokens when drafting scene prompts —
  copy verbatim or break the lock.
- Do NOT edit a locked JSON in place without bumping `version` and
  adding a CHANGELOG line.
- Do NOT skip the reference frame after the first render — visual
  regression has nothing to compare against.
- Do NOT lock a character that appears in only one scene.

## Policies

When a character lock would identify or render a real person, consult before emitting the JSON:

- [`agents/settings/policies/media/likeness.md`](../../../agents/settings/policies/media/likeness.md) — real-person identity tokens require a cited likeness release.
- [`agents/settings/policies/media/public-figures.md`](../../../agents/settings/policies/media/public-figures.md) — recognised public figures carry the harder gate (publicity rights + transformative-intent).
- [`agents/settings/policies/media/voice-cloning.md`](../../../agents/settings/policies/media/voice-cloning.md) — when `voice_note` references a real person's voice.
- [`agents/settings/policies/media/disclosure.md`](../../../agents/settings/policies/media/disclosure.md) — outputs carrying a real-person lock require the non-removable AI-generation disclosure downstream.

Refuse-and-surface the file path; do not silently sanitise the prompt.

