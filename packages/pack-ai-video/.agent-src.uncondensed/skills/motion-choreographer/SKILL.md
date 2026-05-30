---
model_tier: inherit
name: motion-choreographer
description: "Use when turning a locked still + blueprint into a provider-tuned motion prompt — camera, primary + secondary motion, physics, native-audio sync. Triggers 'motion prompt for Veo/Kling/Sora'."
personas:
  - ai-video-technical-director
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

# motion-choreographer

> Turn an approved still + the 12-block scene blueprint into a
> provider-tuned **motion prompt** that the target video adapter
> consumes. Camera choreography, primary subject motion, secondary
> environment motion, physics constraints, and — when the adapter
> declares `audio: native` — a synchronized audio direction block.
> Reads adapter capabilities from
> [`adapter-contract.md`](../../../scripts/ai-video/lib/adapter-contract.md);
> never speaks to a network API.

## When to use

- An image is locked (operator picked one candidate via
  `operator-pick.sh`) and the next step is motion + audio direction
  for the video adapter.
- The blueprint exists in `scenes/<id>/blueprint.json` but the
  motion prompt has not been emitted yet.
- A provider switch (Veo → Kling, Sora → Higgsfield) requires the
  same scene retuned for the new adapter's capability profile.

Do NOT use when:

- The blueprint is still prose only — run
  [`scene-expander`](../scene-expander/SKILL.md) → `parse-blueprint.sh`
  first.
- No still has been locked — the operator-selection checkpoint
  must complete first.
- The output is a still graphic — `canvas-design`.

## Procedure

### Step 0: Inspect

1. Read `scenes/<id>/blueprint.json` — fail loud if missing.
2. Read `scenes/<id>/selection.json` — fail loud if missing; the
   locked image path is required as the motion anchor.
3. Read the target adapter's capability via
   `scripts/ai-video/adapters/<id>.sh capability`. Cache `audio=*`
   for Step 3.
4. If a `character.json` lock exists, load it verbatim — identity
   tokens are immutable.

### Step 1: Camera choreography

Emit a `CAMERA MOTION` block with the move type, distance, speed
in seconds, and start-end framing.

- Move types: lock-off, pan, tilt, dolly-in, dolly-out, truck,
  pedestal, push, pull, handheld, gimbal-glide, crane, whip.
- Speed in seconds per beat (`0.4s push, hold 1.6s, 0.4s pull`).
- Start and end framing named (`MS → CU`, `WS → MS`).

Adapter quirks:

- **Veo** — accepts named moves; prefers ≤ 8s clips.
- **Kling** — motion intensity 0–1 token; map our speed to that.
- **Sora** — natural-language move + duration; no token.
- **Higgsfield** — preset-driven; pick the preset that matches the
  move; record the preset id in the motion prompt.

### Step 2: Primary + secondary motion

Two blocks:

1. **PRIMARY MOTION** — what the subject does, beat-counted, with
   physics anchors (mass, contact points, momentum). Reuse `ACTION`
   from the blueprint; refine for the adapter's preferred verb
   density.
2. **SECONDARY MOTION** — what the world does (hair, fabric,
   foliage, water, dust, particles, breath). One layer per line.

### Step 3: Audio direction (conditional)

If adapter capability is `audio: native` AND the blueprint's
`audio.enable_native_audio` is `true`:

Emit an `AUDIO DIRECTION` block with:

- `DIALOGUE TIMING` — `speaker @ 0.4s: "line"` per dialogue entry.
- `AMBIENT LAYERS` — copy from blueprint; one layer per line.
- `SYNC CUES` — which action beat maps to which audio cue
  (`footstep @ 1.2s`, `door close @ 2.1s`).

If adapter capability is `audio: none`:

- Emit a `# AUDIO: ffmpeg-mux fallback` comment with the
  blueprint's audio paths queued for stitch-time mux.
- Set `enable_native_audio: false` in the motion-prompt JSON.

### Step 4: Physics constraints

Emit `PHYSICS` — a short list of what the model must respect:
gravity direction, contact friction, fluid behavior, hair / cloth
inertia, lens parallax. Single line per constraint.

### Step 5: Emit motion-prompt JSON

Write `scenes/<id>/motion-prompt.json` with the adapter-contract
stdin shape. The orchestrator pipes this into the video adapter's
`submit` subcommand.

### Step 6: Validate

1. JSON parses (`jq .`).
2. `requires.audio_native` is consistent with the chosen adapter's
   capability.
3. Duration in the motion prompt matches blueprint duration ±0.
4. Identity tokens (if `character.json` exists) are verbatim.

## Output format

1. **`scenes/<id>/motion-prompt.json`** — adapter-contract stdin.
2. **`scenes/<id>/motion-prompt.txt`** — labeled prose blocks
   (CAMERA MOTION · PRIMARY MOTION · SECONDARY MOTION · AUDIO
   DIRECTION · PHYSICS) for operator review.
3. **`scenes/<id>/adapter-notes.md`** — which adapter, which
   capability, which preset / model, with rationale.

## Gotcha

- The model wants to "improve" the blueprint's `SUBJECT` block —
  identity tokens are immutable; refuse the temptation.
- Picking `audio: native` on an adapter that returns `audio: none`
  produces silent video — always read capability first, never
  guess from the adapter name.
- Higgsfield preset id must be recorded; otherwise the rerun
  drifts to whichever preset the model picks on the next call.
- Sora durations > 8s often degrade — clamp at the adapter table
  limit; surface the clamp to the operator.

## Do NOT

- Do NOT emit motion prompts for an adapter whose capability you
  did not query this turn.
- Do NOT skip the still-locked check — motion direction without an
  anchored image diverges on every call.
- Do NOT paraphrase identity tokens from `character.json`.
- Do NOT call any network API — this skill is provider-tuning
  prose only.

## Policies

Motion prompts inherit every constraint the upstream blueprint carries. Before emitting provider-tuned prose:

- [`agents/settings/policies/media/disclosure.md`](../../../agents/settings/policies/media/disclosure.md) — every distributed clip carries the non-removable AI-generation disclosure; refuse adapter flags that would suppress it.
- [`agents/settings/policies/media/transparency.md`](../../../agents/settings/policies/media/transparency.md) — provider provenance (C2PA / SynthID) is preserved; refuse re-encode flags whose effect is to strip provenance.
- [`agents/settings/policies/media/voice-cloning.md`](../../../agents/settings/policies/media/voice-cloning.md) — when the motion prompt requests `audio: native` narration in a named voice.
- [`agents/settings/policies/media/brand-impersonation.md`](../../../agents/settings/policies/media/brand-impersonation.md) — when the motion prompt copies a recognised brand's chyron / mascot / signature transition.

Refuse-and-surface; the motion prompt cannot launder a policy gap upstream skills should have caught.

