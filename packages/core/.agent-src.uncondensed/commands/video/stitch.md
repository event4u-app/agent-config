---
model_tier: inherit
name: video:stitch
tier: 2
cluster: video
sub: stitch
description: Re-stitch existing clips in `<project>/scenes/*/` after operator edits — no re-render. ffmpeg concat driven by manifest.json.
personas: [ai-video-technical-director]
skills: []
suggestion:
  eligible: true
  trigger_description: "re-stitch existing video clips, rebuild final MP4 after edits, ffmpeg concat existing scenes"
  trigger_context: "user has edited clips in `<project>/scenes/*/` and wants the final.mp4 rebuilt without paying for re-renders"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /video:stitch

`/video:stitch <project-slug> [--skip-scene <id>]... [--continue]`

Re-stitches existing clips after operator edits. **No adapter calls.**
Reads `<project>/manifest.json`, runs `scripts/ai-video/stitch.sh`,
writes `<project>/final.mp4`.

**Block-on-ambiguity:** a missing project slug, a missing
`manifest.json`, or a clip path that no longer resolves halts the run
with a precise diff — the operator must say `--skip-scene <id>` or
`--continue` explicitly.

## Steps

### 1. Validate dependencies

```bash
scripts/ai-video/lib/validate-deps.sh .agent-src.uncondensed/commands/video/stitch.md
```

(Lightweight here — only the `ai-video-technical-director` persona is
declared; no skill stack to resolve.)

### 2. Locate the project

Resolve `<project-slug>` against the working directory. If neither
`<slug>/manifest.json` nor `agents/reference/ai-video/projects/<slug>/manifest.json`
exists, fail with the searched paths.

### 3. Honor operator overrides

Read `--skip-scene <id>` (repeatable) and `--continue` (proceed past
the first missing clip) flags. Reject any other flag — this command
does not render, so `--image-provider` / `--video-provider` are
contract bugs.

### 4. Stitch

```bash
scripts/ai-video/stitch.sh <project>/manifest.json <project>/final.mp4 \
  ${SKIP_FLAGS} ${CONTINUE_FLAG}
```

The stitcher fails loud on the first unresolved clip unless
`--continue` is set; on `--skip-scene` it drops the named scene from
the concat list before invoking `ffmpeg`.

### 5. Report

Print: project slug, scenes stitched, scenes skipped, final MP4 path,
audio status (per-clip `audio_embedded` flags from `manifest.json`).
No live cost (no network calls happened). No commit. No push.

## Rules

- **No adapter calls.** This command must refuse any provider flag.
- **No commit, no push, no PR.**
- **Block on missing clips** unless `--continue` is explicitly set.
- **Manifest is source of truth** — never re-order clips by filename
  or timestamp; respect `manifest.json` ordering.

## See also

- [`/video:from-script`](from-script.md) — full pipeline including
  initial stitch
- [`/video:scene`](scene.md) — render one scene
- [`scripts/ai-video/stitch.sh`](../../../scripts/ai-video/stitch.sh) — the underlying tool
