# Motion Choreography — per-adapter motion tuning

> Provider-specific tuning of the cinematic blueprint's `CAMERA_MOTION`
> block. Skill: [`motion-choreographer`](../../../.agent-src/skills/motion-choreographer/SKILL.md).
> Adapter contract: [`adapter-contract.md`](../../../scripts/ai-video/lib/adapter-contract.md).

## Why this file exists

`scene-expander` emits provider-agnostic motion intent ("slow dolly-in",
"handheld pan-left"). Each adapter understands a different vocabulary,
respects different magnitude scales, and has different ceilings on
duration + intensity. Without this tuning table, the same intent
produces wildly different results across providers.

## Motion verbs (provider-agnostic)

The blueprint uses a small fixed vocabulary:

| Verb | Meaning | Magnitude scale |
|---|---|---|
| `static` | tripod-locked, no camera move | n/a |
| `dolly-in` / `dolly-out` | camera moves along the lens axis | slow / medium / fast |
| `pan-left` / `pan-right` | camera rotates horizontally | slow / medium / fast |
| `tilt-up` / `tilt-down` | camera rotates vertically | slow / medium / fast |
| `crane-up` / `crane-down` | camera changes height | slow / medium / fast |
| `handheld` | continuous low-amplitude jitter | low / medium / high |
| `whip-pan` | fast horizontal sweep to transition | n/a (always fast) |
| `orbit-left` / `orbit-right` | circular path around subject | slow / medium / fast |

## Per-adapter tuning

| Verb / Magnitude | Veo | Sora | Kling | Higgsfield | OpenAI Images |
|---|---|---|---|---|---|
| `static` | `camera_motion: "static"` | structural `motion: none` | `motion_intensity: 0.0` | preset `static` | n/a (still) |
| `dolly-in slow` | `"slow dolly forward"` | `motion: dolly_in, intensity: 0.3` | `motion_intensity: 0.3`, prompt `"slow dolly in"` | preset `subtle_dolly` | n/a |
| `dolly-in medium` | `"dolly forward"` | `motion: dolly_in, intensity: 0.6` | `motion_intensity: 0.6` | preset `dolly` | n/a |
| `dolly-in fast` | `"fast dolly forward"` (often clips at adapter cap) | `motion: dolly_in, intensity: 0.9` | `motion_intensity: 0.85` (caps at 0.85) | preset `aggressive_push` | n/a |
| `pan-left medium` | `"medium pan left"` | `motion: pan_left, intensity: 0.6` | `motion_intensity: 0.5`, prompt suffix | preset `pan_l` | n/a |
| `handheld low` | `"handheld, subtle"` | `motion: handheld, intensity: 0.3` | prompt only — Kling ignores intensity on handheld | preset `documentary` | n/a |
| `handheld high` | `"handheld, energetic"` | `motion: handheld, intensity: 0.85` | `motion_intensity: 0.85` | preset `chaotic` | n/a |
| `whip-pan` | not supported — split into two scenes | `motion: whip_pan` | not supported | preset `whip` | n/a |
| `orbit-left slow` | `"slow orbit"` | `motion: orbit, intensity: 0.4, direction: left` | not supported | preset `orbit_l` | n/a |

## Duration ceilings

| Adapter | Max single-clip seconds | Notes |
|---|---|---|
| Veo (3.0) | 8 | longer = predictLongRunning + multi-shot mode (out of scope) |
| Sora | 20 | sweet spot 6–10s; > 12s loses motion coherence |
| Kling | 10 | `motion_intensity > 0.85` halves the ceiling |
| Higgsfield | 6 | preset-driven; some presets cap at 4 |
| OpenAI Images | n/a | still images |

`motion-choreographer` clamps `DURATION` to the active adapter's
ceiling and emits a warning to the operator surface when clamping fires.

## Anti-patterns

- **Two motion verbs in one scene.** Split into two scenes; let the cut
  carry the second verb.
- **Verbal magnitude without a value.** "Slow" is fine in the blueprint;
  adapters need the mapped intensity number, which is this table's job.
- **Fast magnitude on a long duration.** A 10-second fast dolly-in
  produces motion blur and character drift; clamp to medium or shorten
  the clip.

## Attribution

Tuning values calibrated against operator-vetted runs of `banana-arc`
(see [`agents/ai-video/examples/banana-arc/`](../examples/banana-arc/)).
The verb vocabulary is this package's synthesis; the per-adapter
mappings are empirical.
