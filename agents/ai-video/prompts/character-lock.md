# Character Lock — descriptor contract

> The load-bearing pattern of this pipeline. Skill:
> [`character-consistency`](../../../.agent-src/skills/character-consistency/SKILL.md).
> Tested by Phase 6 Step 3 visual regression (`NCC ≥ 0.95`).

## Why this matters

Every adapter call is independent. The provider has no memory of
previous scenes. The only way the *same character* appears in scene 2
that appeared in scene 1 is if the **exact same descriptor tokens**
land in both prompts. Drift one word, get a different face.

This file is the contract for those tokens.

## The 5-field descriptor

`character.json` per project, one entry per named character:

```json
{
  "name": "Banana",
  "silhouette": "small upright cartoon banana, ~30cm tall, slightly curved",
  "palette": "ripe-yellow skin (#F4D03F) with three brown freckles, ivory peel-base",
  "wardrobe": "tiny red bowtie, no other clothing",
  "prop": "always carries a small leather-bound notebook in left peel",
  "voice": "warm tenor, slight drawl, mid-tempo"
}
```

Field-by-field rules:

- **`silhouette`** — outline + scale + posture. Adapters latch onto
  silhouette first; this is the strongest lock signal.
- **`palette`** — named hues with hex codes where it matters. Hex
  codes survive translation between adapters better than English color
  names.
- **`wardrobe`** — specific. "Tiny red bowtie" locks; "red accessory"
  drifts.
- **`prop`** — at most one prop, always carried. Two props compete for
  attention and adapters drop one.
- **`voice`** — only consumed by native-audio adapters (Veo, Sora).
  Non-audio adapters ignore the field; `ffmpeg` mux uses an operator-
  supplied bed.

## Injection contract

Every per-scene prompt MUST contain the silhouette, palette, wardrobe,
and prop strings **verbatim** (exact substring match). The test in
Phase 6 Step 3 asserts this via grep, not paraphrase tolerance.

Wrong:

```
A small yellow banana with a bowtie, looking thoughtful.
```

Right:

```
SUBJECT: small upright cartoon banana, ~30cm tall, slightly curved;
ripe-yellow skin (#F4D03F) with three brown freckles, ivory peel-base;
tiny red bowtie, no other clothing; always carries a small leather-bound
notebook in left peel. The character looks thoughtful.
```

The first form will drift. The second won't.

## Multi-character scenes

`character.json` allows multiple entries:

```json
{ "characters": [ { "name": "Banana", ... }, { "name": "Apple", ... } ] }
```

In the prompt, inject each character's descriptors in turn, separated
by a sentence break. Adapters tolerate 2-3 named characters per scene;
beyond that, silhouettes blur. Split into staggered scenes.

## Adapter quirks

| Adapter | Lock strength | Notes |
|---|---|---|
| OpenAI Images | Strong | seed reuse + ref-image bring lock to ~0.97 |
| Veo | Strong | descriptor verbatim is enough; ref-image is bonus |
| Sora | Medium | structural-prompt path handles silhouette well, wardrobe drifts |
| Kling | Weak-Medium | needs ref-image; descriptor alone drifts at scene 3+ |
| Higgsfield | Medium | preset hints help; descriptor verbatim still required |

## Attribution

The 5-field shape is this package's synthesis from operator practice
across the five adapters. The `verbatim-substring` test is the
load-bearing assertion called out in the roadmap's §Notes (line 135).
