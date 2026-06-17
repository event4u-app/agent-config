---
model_tier: inherit
name: video-from-script
pack: ai-video
tier: 2
visibility: internal
cluster: video
sub: from-script
description: Drive a script end-to-end through the AI video pipeline — scenes → blueprint → image → operator pick → motion → video → stitch. Preview default; --mode commit spends behind the cost gate.
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
---

# /video:from-script

`/video:from-script <path-to-script.md> [--mode preview|commit] [--max-spend-usd <usd>] [--image-provider <id>] [--video-provider <id>]`

Drives a Markdown script through the full pipeline. Provider flags
override the `<default-image-provider>` / `<default-video-provider>`
from [`agents/.ai-video.xml`](../../../agents/templates/.ai-video.xml.example);
absent flags fall back to the XML defaults.

**Mode — visible intent, not a silent mock.** `--mode preview`
(default) runs the whole pipeline **strictly offline**: adapter
`dry-run` fixtures, no network, and a per-scene plan table with the
summed **modeled** cost (`cost_estimate` — labeled as modeled; preview
never calls a pricing API). `--mode commit` is the spend path: the
Step 5 safety gate fires, and only after explicit confirmation does the
run set `AIV_DRYRUN=false`. The resolved mode is echoed as the **first
line of the report** — when no flag was passed, the report says
`mode: preview (default — no spend; pass --mode commit to render
live)` so a defaulted run can never read as a failed live run.

**Block-on-ambiguity:** a missing scene heading, an unparseable
character-lock block, or a contradictory provider flag halts the run
with a precise diff — no silent best-guess.

## Steps

### 1. Validate dependencies

```bash
scripts/ai-video/lib/validate-deps.sh .agent-src.uncondensed/commands/video/from-script.md
```

Fails fast with the missing-id list if any declared persona / skill is
absent from `dist/agent-src/personas/` or `dist/agent-src/skills/`. No network
call has happened yet.

### 2. Load config + resolve providers

Source `scripts/media/lib/load-config.sh`. Resolve image / video
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
2. **Safety gate (Phase 5 Step 6).** In commit mode (`--mode commit`
   resolves to `AIV_DRYRUN=false`), print the adapter, model, scene
   count, and estimated cost; refuse to continue without an explicit
   operator confirmation **in this turn**. Mirrors
   [`non-destructive-by-default`](../../rules/non-destructive-by-default.md).
   Estimated cost sums each scene's dry-run `cost_estimate` (adapter
   contract v2); an unpriceable scene shows `unknown` (never counted as
   `0`). When `--max-spend-usd` is set and the summed estimate exceeds
   it, hard-block before the first live call — confirmation does not
   override the cap.
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

First line: the resolved **mode** (`mode: commit` or `mode: preview
(default — no spend; pass --mode commit to render live)`). Then:
project slug, final MP4 path, scenes rendered, scenes skipped, actual
cost (commit) or summed modeled `cost_estimate` labeled *modeled*
(preview). No commit. No push.

## Rules

- **No commit, no push, no PR.** Pipeline produces artefacts; the
  operator chooses what to ship.
- **Preview is the default.** `--mode commit` is the only spend path,
  and every live network call still needs explicit per-turn
  confirmation at the safety gate. Preview is strictly offline
  (`AIV_DRYRUN=true`); its costs are modeled, never quotes.
- **The mode line is mandatory.** Every report opens with the resolved
  mode so a defaulted preview can never be mistaken for a live render
  that produced nothing.
- **Block on ambiguity** — never silently best-guess scene splits or
  provider mismatches.
- **One project per invocation.** Re-running on the same project
  resumes from existing artefacts (skips completed scenes) via the
  ADR-059 resume scan: `scripts/ai-video/lib/resume-scan.sh scan
  <project> --plan <project>/plan.json` — `green` reused, `stale` /
  `missing` re-render, `failed` surfaces its `error.json`. State =
  per-scene sentinel set (`prompt.json` with `input_sha256`, the clip,
  `error.json`, `cost.json`) — no central checkpoint file.

## See also

- [`/video:scene`](scene.md) — single-scene iteration
- [`/video:storyboard`](storyboard.md) — image-only contact sheet
- [`/video:stitch`](stitch.md) — re-stitch after operator edits
- [`scripts/media/lib/adapter-contract.md`](../../../scripts/media/lib/adapter-contract.md)
