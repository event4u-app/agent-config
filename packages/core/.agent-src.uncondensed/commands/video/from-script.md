---
name: video:from-script
tier: 2
cluster: video
sub: from-script
description: Drive a script end-to-end through the AI video pipeline — scenes → blueprint → image → operator pick → motion → video → stitch. Dry-run default; network calls require explicit per-turn confirmation.
disable-model-invocation: true
personas: [hollywood-director, ai-video-technical-director]
skills: [scene-expander, video-director, pixar-storyteller, character-consistency, motion-choreographer]
suggestion:
  eligible: true
  trigger_description: "render a video from a script, full AI video pipeline, multi-scene generation"
  trigger_context: "user supplies a Markdown script with `## Scene N` headings and wants a final MP4"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# /video:from-script

`/video:from-script <path-to-script.md> [--image-provider <id>] [--video-provider <id>]`

Drives a Markdown script through the full pipeline. Provider flags
override the `<default-image-provider>` / `<default-video-provider>`
from [`agents/.ai-video.xml`](../../../agents/templates/.ai-video.xml.example);
absent flags fall back to the XML defaults.

**Block-on-ambiguity:** a missing scene heading, an unparseable
character-lock block, or a contradictory provider flag halts the run
with a precise diff — no silent best-guess.

## Steps

### 1. Validate dependencies

```bash
scripts/ai-video/lib/validate-deps.sh .agent-src.uncondensed/commands/video/from-script.md
```

Fails fast with the missing-id list if any declared persona / skill is
absent from `.agent-src/personas/` or `.agent-src/skills/`. No network
call has happened yet.

### 2. Load config + resolve providers

Source `scripts/ai-video/lib/load-config.sh`. Resolve image / video
provider in this order: command flag → `agents/.ai-video.xml` default
→ fail with the available-providers list.

### 3. Parse the script

Run the `scene-expander` skill: split on `## Scene N` headings, extract
dialogue / action / ambient blocks, and emit one `scene-blueprint.yaml`
per scene under `<project>/scenes/<id>/`. Schema:
[`scene-blueprint.schema.yaml`](../../skills/scene-expander/scene-blueprint.schema.yaml).

### 4. Character lock

Run `character-consistency` once for the whole project. Writes
`<project>/character.json` (subject, palette, wardrobe, prop, seed)
that every later prompt must reuse verbatim.

### 5. Per-scene image render

For each scene blueprint:

1. Compose the eight-block image prompt via `video-director`
   (style · subject · environment · action · camera · lens · lighting · mood).
2. **Safety gate (Phase 5 Step 6).** If `AIV_DRYRUN=false`, print the
   adapter, model, scene count, and estimated cost; refuse to continue
   without an explicit operator confirmation **in this turn**. Mirrors
   [`non-destructive-by-default`](../../rules/non-destructive-by-default.md).
3. Call the image adapter (`run` subcommand) N times where N =
   `<tuning/best-of-n>` (default 1).

### 6. Operator pick (best-of-N checkpoint)

```bash
scripts/ai-video/lib/operator-pick.sh <project> <scene-id>
```

Renders the candidate contact-sheet PNG, pauses, and waits for the
operator to write `<project>/scenes/<id>/selection.json`. In dry-run
mode the helper auto-selects the first candidate so the smoke test
stays unattended.

### 7. Motion + video render

Pass the locked image into `motion-choreographer` (per-provider profile)
→ build the motion prompt → call the video adapter (`submit` / `poll` /
`fetch`). Same safety gate as Step 5 fires before each live call.

### 8. Stitch

Build `<project>/manifest.json` (ordered `{scene_id, clip_path,
audio_embedded, audio_path?, duration}`) and run:

```bash
scripts/ai-video/stitch.sh <project>/manifest.json <project>/final.mp4
```

Fail loud on missing clips; offer `--skip-scene <id>` or `--continue`
per the stitcher contract.

### 9. Report

Print: project slug, final MP4 path, scenes rendered, scenes skipped,
estimated cost (live mode) or `dry-run` marker. No commit. No push.

## Rules

- **No commit, no push, no PR.** Pipeline produces artefacts; the
  operator chooses what to ship.
- **Dry-run is the default.** Every live network call needs explicit
  per-turn confirmation.
- **Block on ambiguity** — never silently best-guess scene splits or
  provider mismatches.
- **One project per invocation.** Re-running on the same project
  resumes from existing artefacts (skips completed scenes).

## See also

- [`/video:scene`](scene.md) — single-scene iteration
- [`/video:storyboard`](storyboard.md) — image-only contact sheet
- [`/video:stitch`](stitch.md) — re-stitch after operator edits
- [`scripts/ai-video/lib/adapter-contract.md`](../../../scripts/ai-video/lib/adapter-contract.md)
