# Pixar Emotional Beat — animation scene prompt

> Provider-agnostic scaffold for a single Pixar-style animated scene.
> Skill: [`pixar-storyteller`](../../../.agent-src/skills/pixar-storyteller/SKILL.md).

## Why this shape

Pixar scenes work because every frame carries an **emotional beat**
anchored in want, obstacle, decision. A prompt that names the beat
(*"yearning"*, *"reluctant courage"*, *"private grief"*) produces a clip
where character expression and camera framing reinforce each other.
A prompt that lists actions without a beat produces a clip that looks
animated but feels hollow.

## The 8-block form

```
CHARACTER:        verbatim from character.json (silhouette + palette + wardrobe + prop)
WANT:             what the character is reaching for, this beat (1 sentence)
OBSTACLE:         what blocks them (1 sentence; physical or internal)
EMOTIONAL_BEAT:   one named feeling (yearning, reluctant courage, private grief, ...)
EXPRESSION:       face + body cue tied to the beat (e.g. "eyes half-lidded, shoulders forward, hand half-extended")
CAMERA:           framing + motion (e.g. "MCU, slight push-in to mark the choice")
PALETTE:          3 hues that carry the beat (e.g. "muted teal background, warm amber rim on character, cream skin tone")
STYLE:            "Pixar feature, soft global illumination, subsurface scattering on skin, painterly background"
```

## Authoring rules

- **One beat per scene.** A scene that tries to land "fear and resolve"
  in 4 seconds lands neither. Split into two scenes; let the cut do
  the work.
- **EXPRESSION must be specific.** "Sad" is not specific; "eyes
  half-lidded, mouth set, gaze unfocused on middle distance" is.
- **STYLE is constant across scenes.** Every scene in a project shares
  the same STYLE block verbatim; that's how the look stays Pixar
  instead of drifting into generic 3D.
- **CHARACTER descriptors are verbatim from `character.json`.** Same
  contract as the cinematic blueprint — load-bearing for character
  lock.

## When to use

| Use this shape | Use cinematic-blueprint instead |
|---|---|
| Stylized animation, Pixar / DreamWorks lineage | Live-action, photoreal, documentary |
| Single emotional beat is the point of the scene | Action / motion is the point of the scene |
| Character is anthropomorphic or stylized | Character is a real person or photoreal stand-in |
| Style consistency matters more than camera mechanics | Camera mechanics matter more than character interiority |

## Attribution

The "want / obstacle / decision" frame is standard Pixar story-craft
(Pete Docter's storytelling rules, Andrew Stanton's *Clues to a Great
Story* TED talk). The 8-block prompt shape is this package's
operator-facing distillation. STYLE phrasing draws on the upstream
`pixar-storyteller` skill's vetted templates.
