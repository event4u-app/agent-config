---
recommended_model: inherit
name: video:scene
tier: 2
cluster: video
sub: scene
description: Render a single scene from a one-line idea — scene-expander → blueprint → image → operator pick → motion → video. Dry-run default; live calls require explicit per-turn confirmation.
personas: [hollywood-director, ai-video-technical-director]
skills: [scene-expander, video-director, character-consistency, motion-choreographer]
suggestion:
  eligible: true
  trigger_description: "render a single video scene, iterate on one shot, test a prompt without a full script"
  trigger_context: "user supplies a one-line scene idea and wants a single clip, no multi-scene stitching"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /video:scene

`/video:scene "<idea>" [--image-provider <id>] [--video-provider <id>] [--project <slug>]`

Single-scene generation for iteration. Same pipeline as
[`/video:from-script`](from-script.md) but skips the script parser and
the stitch step — produces one clip under
`<project>/scenes/<auto-id>/`.

**Block-on-ambiguity:** an idea string under 12 characters, a
contradictory provider flag, or a missing project slug on resume halts
the run with a precise diff.

## Steps

### 1. Validate dependencies

```bash
scripts/ai-video/lib/validate-deps.sh .agent-src.uncondensed/commands/video/scene.md
```

### 2. Load config + resolve providers

Source `scripts/ai-video/lib/load-config.sh`. Resolve image / video
provider: flag → `agents/.ai-video.xml` default → fail with the
available-providers list.

### 3. Expand the idea

Run `scene-expander` on the single idea string. Emit one
`scene-blueprint.yaml` under `<project>/scenes/<id>/`. Project slug
defaults to `scene-$(date +%Y%m%d-%H%M%S)` when `--project` is absent.

### 4. Character lock (if `<project>/character.json` absent)

First run on a fresh project → `character-consistency` builds
`character.json`. Re-runs reuse the locked descriptor verbatim.

### 5. Image render + operator pick

Compose the eight-block image prompt via `video-director`. Safety gate
fires before any live call (`AIV_DRYRUN=false` requires explicit
per-turn confirmation). Render `<tuning/best-of-n>` candidates, then:

```bash
scripts/ai-video/lib/operator-pick.sh <project> <scene-id>
```

Dry-run auto-selects candidate 1.

### 6. Motion + video render

`motion-choreographer` builds the motion prompt for the resolved video
provider; safety gate fires again; adapter `submit` / `poll` / `fetch`
runs the call.

### 7. Report

Print: project slug, scene id, clip path, audio status
(`embedded` / `muxed` / `none`), live cost or `dry-run` marker. No
stitch step; no commit; no push.

## Rules

- **No commit, no push, no PR.**
- **Dry-run is the default.** Live calls need explicit per-turn
  confirmation.
- **Block on ambiguity** — refuse to invent a project slug, scene id,
  or character descriptor on resume.
- **Single scene per invocation.** For multi-scene work use
  [`/video:from-script`](from-script.md).

## See also

- [`/video:from-script`](from-script.md) — multi-scene pipeline
- [`/video:storyboard`](storyboard.md) — image-only sheet
- [`/video:stitch`](stitch.md) — combine existing clips
