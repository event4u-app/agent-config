# Cinematic Scene Blueprint — 12-block prompt

> Provider-agnostic scaffold for a single live-action or
> photoreal cinematic scene. Skill: [`scene-expander`](../../../.agent-src/skills/scene-expander/SKILL.md).
> Adapter contract: [`adapter-contract.md`](../../../scripts/ai-video/lib/adapter-contract.md).

## Why this shape

A scene that produces a usable clip is a scene where lens, lighting,
blocking, motion, and negatives are *named* — not implied. The 12-block
form forces the operator (or the agent) to make each decision explicit
before any provider sees the prompt. Each block maps to one tunable
adapter parameter via `motion-choreographer`.

## The 12 blocks

```
SUBJECT:          who/what is in frame (1 sentence)
ACTION:           what the subject does this beat (1 sentence)
SETTING:          where the scene takes place (1 sentence)
LENS:             focal length + aperture (e.g. "35mm f/2.0")
LIGHTING:         key + fill + accent direction (e.g. "low-key, top-left key, rim from camera-right")
COMPOSITION:      framing + rule of thirds + depth layer (e.g. "MS, subject on left third, soft bokeh background")
CAMERA_MOTION:    static / dolly-in / pan-left / handheld / crane (one verb + magnitude)
COLOR_PALETTE:    3-5 named hues + temperature (e.g. "warm amber, deep navy, ivory; 3200K")
DURATION:         seconds (integer; respect adapter max)
NATIVE_AUDIO:     dialogue + ambient blocks (omit for non-audio adapters)
NEGATIVES:        what NOT to render (e.g. "no lens flare, no text overlay, no extra characters")
STYLE_REFERENCE:  optional named look (e.g. "Roger Deakins, 1917-era; Wong Kar-wai, In the Mood for Love")
```

## Authoring rules

- **One verb per CAMERA_MOTION.** "Slow dolly-in + slight pan-left" is two
  motions and breaks character lock — split into two scenes instead.
- **NEGATIVES is not optional.** Even a one-item list ("no text overlay")
  prevents adapter drift. Empty negatives = adapter free-fires.
- **Character descriptors MUST be injected verbatim** from `character.json`
  into SUBJECT. The verbatim assertion is the load-bearing test in
  Phase 6 Step 3.
- **DURATION caps per provider** live in `motion-choreographer`'s tuning
  table — never embed provider names in the blueprint.

## Adapter mapping

| Block | OpenAI Images | Veo | Sora | Kling | Higgsfield |
|---|---|---|---|---|---|
| SUBJECT + ACTION | `prompt` | `prompt` | `prompt` | `prompt` | `prompt` |
| LENS + COMPOSITION | `prompt` suffix | `prompt` suffix | structural | `prompt` | preset hint |
| CAMERA_MOTION | n/a (still) | `camera_motion` | structural | `motion_intensity` | preset |
| DURATION | n/a | `duration` | `duration` | `duration` (≤max) | `duration` |
| NATIVE_AUDIO | n/a | `audio.dialogue` / `audio.ambient` | structural | n/a (ffmpeg mux) | n/a (ffmpeg mux) |
| NEGATIVES | `negative_prompt` | `negative_prompt` | prompt suffix | `negative_prompt` | `negative_prompt` |
| STYLE_REFERENCE | `prompt` suffix | `prompt` suffix | structural | `prompt` | preset |

## Attribution

Distilled from the operator-vetted scene templates in the upstream
`pixar-storyteller` and `video-director` skills. The 12-block form is
this package's synthesis, not an upstream import; the underlying ideas
(lens-first authoring, negatives-as-contract) are common to cinematography
practice.
