# `banana-arc` — golden reference project for `/video:*`

> Three-scene reference covering the three named complexity tiers
> (simple · dialogue + native-audio · edge-duration). The smoke test
> `scripts/ai-video/test-pipeline.sh` runs the full pipeline against
> this project in dry-run mode and asserts contract compliance.

## Tiers

| Tier | Scene | Adapter audio | Purpose |
|---|---|---|---|
| **simple** | `01-simple` | `audio: none` | single character, static camera, no dialogue — baseline character-lock |
| **dialogue + native-audio** | `02-dialogue-native-audio` | `audio: native` (Veo / Sora) | dialogue line + ambient layer, character-lock under expression change |
| **edge-duration** | `03-edge-duration` | `audio: none` | max-duration clip, fast camera move, motion-coherence stress |

## Per-scene contents

Each scene ships:

- `script.md` — the operator-authored scene script in `## Scene N`
  heading form, parsed by `scene-expander`.
- `character.json` — the project's locked character (shared across
  scenes via project root, but each scene also carries a copy for
  self-contained testing).
- `expected-blueprint.yaml` — the expected `scene-blueprint.yaml`
  output from `scene-expander` after parsing the script. The smoke
  test diffs the actual output against this.
- `fixtures/frames/locked.png` — a reference frame for the visual-
  regression assertion (`NCC ≥ 0.95`).

## Project-level

- `character.json` — the shared character lock for `Banana`.
- `manifest.json` — the expected scene manifest after a full dry-run,
  used to assert stitch ordering.

## Running the smoke test

```bash
scripts/ai-video/test-pipeline.sh
```

Runs entirely offline against this directory. No adapter calls. All
fixtures are committed; no network access required.

## Why three tiers

Phase 6 Step 2 of the roadmap (council Finding #10) names three
complexity tiers as the minimum coverage: undifferentiated golden runs
let regressions slip through because they exercise only one path
through the pipeline. The three tiers force the smoke test to exercise
the adapter contract's `audio_embedded` branching, the character-lock
verbatim-substring assertion under expression change, and the duration-
clamping path in `motion-choreographer`.
