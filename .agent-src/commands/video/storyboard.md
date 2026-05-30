---
model_tier: inherit
name: video:storyboard
tier: 2
cluster: video
sub: storyboard
description: Image-only storyboard — script → scenes → blueprint → image render → contact-sheet PNG via ffmpeg montage. No video calls.
personas: [hollywood-director]
skills: [scene-expander, video-director, character-consistency]
suggestion:
  eligible: true
  trigger_description: "build a storyboard, contact sheet of scenes, image-only preview, validate a script visually before video render"
  trigger_context: "user wants to see all scenes as stills before committing to motion calls"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /video:storyboard

`/video:storyboard <path-to-script.md> [--image-provider <id>]`

Renders one locked image per scene, then composes them into a single
contact-sheet PNG via `ffmpeg` montage. **No video calls.** Useful as a
cheap pre-flight before [`/video:from-script`](from-script.md).

**Block-on-ambiguity:** a missing scene heading, an unparseable
character-lock block, or a `--video-provider` flag (rejected — this
command does not call video adapters) halts the run with a precise
diff.

## Steps

### 1. Validate dependencies

```bash
scripts/ai-video/lib/validate-deps.sh .agent-src.uncondensed/commands/video/storyboard.md
```

### 2. Load config + resolve image provider

Source `scripts/ai-video/lib/load-config.sh`. Resolve image provider:
`--image-provider` flag → `agents/.ai-video.xml` default → fail. Reject
`--video-provider` (this command produces no clips).

### 3. Parse the script

`scene-expander` splits on `## Scene N`, writes
`<project>/scenes/<id>/scene-blueprint.yaml` per scene.

### 4. Character lock

Single `character-consistency` pass writes `<project>/character.json`.
Re-runs on the same project reuse it verbatim.

### 5. Per-scene image render

For each scene:

1. `video-director` builds the eight-block image prompt.
2. **Safety gate (Phase 5 Step 6).** Live mode requires `AIV_DRYRUN=false`
   AND explicit per-turn confirmation; otherwise the run stops.
3. Image adapter `run` → write the locked still under
   `<project>/scenes/<id>/locked.png`.

### 6. Build the contact sheet

```bash
ffmpeg -y \
  -pattern_type glob -i '<project>/scenes/*/locked.png' \
  -filter_complex "tile=<cols>x<rows>:padding=8:margin=16" \
  <project>/storyboard.png
```

`<cols>` defaults to `ceil(sqrt(N))`; `<rows>` to `ceil(N/cols)`. The
helper script `scripts/ai-video/lib/operator-pick.sh` is **not**
invoked — this command emits a single sheet, not per-scene candidate
picks.

### 7. Report

Print: project slug, scenes rendered, contact-sheet path, live cost or
`dry-run` marker.

## Rules

- **No video adapter calls.** This command must refuse any path that
  would invoke a video provider.
- **No commit, no push, no PR.**
- **Dry-run is the default.** Live image calls need explicit per-turn
  confirmation.
- **Reject `--video-provider`.** Surfacing the flag is a contract bug.

## See also

- [`/video:from-script`](from-script.md) — full pipeline including video
- [`/video:scene`](scene.md) — single-scene iteration
- [`/video:stitch`](stitch.md) — re-stitch existing clips
