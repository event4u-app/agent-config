---
name: video
tier: 2
cluster: video
description: Video-creation orchestrator — Hollywood-level AI video pipeline. Routes to from-script, scene, storyboard, stitch.
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "create a video from a script, render a single scene, build a storyboard, re-stitch existing clips, AI video pipeline"
  trigger_context: "user mentions video generation, scene rendering, storyboard, ffmpeg stitch, or a `.ai-video.xml` config"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /video

Top-level orchestrator for the `/video:*` family — multi-provider AI
video creation. Reads provider keys + defaults from
[`agents/.ai-video.xml`](../../agents/templates/.ai-video.xml.example) (gitignored
real file; example shipped). Every subcommand is **dry-run by default**;
network calls require explicit per-turn confirmation per the adapter
contract under [`scripts/ai-video/lib/adapter-contract.md`](../../scripts/ai-video/lib/adapter-contract.md).

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/video:from-script <path>` | `commands/video/from-script.md` | Full pipeline: script → scenes → blueprint → images → operator pick → motion → video → stitch |
| `/video:scene "<idea>"` | `commands/video/scene.md` | Single-scene iteration without a full script |
| `/video:storyboard <path>` | `commands/video/storyboard.md` | Image-only output; contact-sheet storyboard PNG via `ffmpeg` montage |
| `/video:stitch <slug>` | `commands/video/stitch.md` | Re-stitches existing clips after operator edits, no re-render |

## Dispatch

1. Parse `/video <sub-command> [args]`.
2. Look up the sub-command in the table above and execute its file
   verbatim with the remaining args.
3. Unknown / missing sub-command → print the table and ask:

   > 1. from-script — full script → final video
   > 2. scene — single-scene iteration
   > 3. storyboard — image-only contact sheet
   > 4. stitch — re-stitch existing clips

## Rules

- **Do NOT commit, push, or open a PR** — subcommands never do this.
- **Do NOT chain subcommands.** One `/video <sub>` per turn.
- **`AIV_DRYRUN=true` is the default.** A live (paid) call requires
  `AIV_DRYRUN=false` AND an explicit operator confirmation in the same
  turn; mirrors [`non-destructive-by-default`](../rules/non-destructive-by-default.md).
- **Run `validate-deps.sh` first.** Every subcommand calls
  `scripts/ai-video/lib/validate-deps.sh` before any adapter; fails
  fast on missing personas / skills.
- **Edit `.agent-src.uncondensed/` only.** Generated mirrors regenerate.

## See also

- [`scripts/ai-video/lib/adapter-contract.md`](../../scripts/ai-video/lib/adapter-contract.md) — provider adapter v1 contract
- [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md) — `video` cluster registration
