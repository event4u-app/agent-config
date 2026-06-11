---
model_tier: inherit
name: video-scene
pack: ai-video
tier: 2
cluster: video
sub: scene
description: Render a single scene from a one-line idea — scene-expander → blueprint → image → operator pick → motion → video. Preview mode default (no spend); --mode commit renders live behind the cost gate.
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

`/video:scene "<idea>" [--mode preview|commit] [--image-provider <id>] [--video-provider <id>] [--project <slug>]`

Single-scene generation for iteration. Same pipeline as
[`/video:from-script`](from-script.md) but skips the script parser and
the stitch step — produces one clip under
`<project>/scenes/<auto-id>/`.

**Mode — visible intent, not a silent mock.** `--mode preview`
(default) runs the whole pipeline **strictly offline**: adapter
`dry-run` fixtures, no network, and a plan summary with the **modeled**
cost (`cost_estimate`, labeled as modeled — preview never calls a
pricing API). `--mode commit` is the spend path: the safety gate below
fires, and only after explicit confirmation does the run set
`AIV_DRYRUN=false` for the adapter calls. The resolved mode is echoed
as the **first line of the report** — when no flag was passed, the
report says `mode: preview (default — no spend; pass --mode commit to
render live)` so a defaulted run can never read as a failed live run.

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

Compose the eight-block image prompt via `video-director`. In commit
mode the safety gate fires before any live call (explicit per-turn
confirmation, then `AIV_DRYRUN=false`). Render `<tuning/best-of-n>`
candidates, then:

```bash
scripts/ai-video/lib/operator-pick.sh <project> <scene-id>
```

Preview mode auto-selects candidate 1.

### 6. Audio pre-flight gate

When the blueprint's `requires.audio_native` is `true` and the
resolved video provider declares `capability.audio = none`: STOP
before any submit (preview AND commit) and surface the mismatch with
numbered options — 1) switch to an audio-native provider, 2) proceed
without dialogue (ambient mux only), 3) drop audio intentionally,
4) override and attempt anyway (operator-owned cost risk — check the
dry-run's `audio_embedded` first). Record the picked option; the
encoder writes the matching `AUDIO DOWNGRADE` block. Contract:
adapter-contract.md § Audio ownership. Silent dialogue loss is a
contract violation.

### 7. Motion + video render

`motion-choreographer` builds the motion prompt for the resolved video
provider; in commit mode the safety gate fires again; adapter
`submit` / `poll` / `fetch` runs the call.

### 8. Report

First line: the resolved **mode** (`mode: commit` or `mode: preview
(default — no spend; pass --mode commit to render live)`). Then:
project slug, scene id, clip path, audio status
(`embedded` / `muxed` / `none`), live cost (commit) or modeled
`cost_estimate` labeled *modeled* (preview). No stitch step; no commit;
no push.

## Rules

- **No commit, no push, no PR.**
- **Preview is the default.** `--mode commit` is the only spend path,
  and it still needs explicit per-turn confirmation at the safety gate.
  Preview is strictly offline (`AIV_DRYRUN=true`); its costs are
  modeled, never quotes.
- **The mode line is mandatory.** Every report opens with the resolved
  mode so a defaulted preview can never be mistaken for a live render
  that produced nothing.
- **Block on ambiguity** — refuse to invent a project slug, scene id,
  or character descriptor on resume.
- **Single scene per invocation.** For multi-scene work use
  [`/video:from-script`](from-script.md).

## See also

- [`/video:from-script`](from-script.md) — multi-scene pipeline
- [`/video:storyboard`](storyboard.md) — image-only sheet
- [`/video:stitch`](stitch.md) — combine existing clips
