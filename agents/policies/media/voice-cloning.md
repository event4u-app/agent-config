# Media Policy — Voice Cloning

## Iron Law

```
DO NOT GENERATE A SPECIFIC PERSON'S VOICE WITHOUT A CITED VOCAL-LIKENESS
RELEASE. SYNTHETIC GENERIC VOICES ARE ALLOWED. WHEN UNSURE, ASK.
```

"Voice cloning" means producing audio that a reasonable listener could attribute to a specific real person — by timbre, accent, cadence, signature phrasing, or named context (e.g., *"in the voice of [HOST]"*, *"clone [CEO]'s narration"*). Generic synthetic voices (provider defaults, anonymous presenter voices) are out of scope.

> This roadmap **writes** the policy. It does not authorise voice-cloning *implementation*. The five shipped video adapters do not currently render voice clones (see `Bounds` in `agents/roadmaps/archive/universal-platform-refinement.md`). This file gates the surface for when an `/audio:*` or voice-capable adapter lands.

## Triggers

The agent consults this policy when any of the following fires:

- A `/video:*` prompt requests narration *"in the voice of [PERSON]"* or *"sounding like [PERSON]"*.
- A future `/audio:*` invocation supplies a voice sample as a cloning reference.
- `motion-choreographer` or `video-director` emits an audio cue referencing a named real person's voice.
- The prompt contains *"voice clone"*, *"deepfake voice"*, *"sound like [PERSON]"*, or *"copy [PERSON]'s narration"*.

## Required when consent is cited

The prompt must include one of:

- *"Vocal-likeness release signed by [PERSON] on YYYY-MM-DD"*
- *"Voice-cloning rights cleared via [AGENCY] on YYYY-MM-DD"*
- *"Public-domain — [PERSON] died [YEAR > public-domain threshold for jurisdiction]"* — historical figures only; modern recordings remain copyrighted even when the speaker is deceased.

A generic "publicity rights" clearance is **not sufficient** for voice cloning. Vocal likeness is a separate right in most jurisdictions; the agent treats it as load-bearing.

## Forbidden

- Cloning a public figure's voice without a vocal-likeness release on file — refuse even with a written-content publicity-rights clearance.
- Cloning a private individual's voice without explicit, dated written consent.
- Producing voice-clone audio of a public figure in a context they would credibly object to (endorsement they did not make, criminal admission, medical claim) — refuse without exception.
- Stripping the AI-generation disclosure from voice-clone output (see [`disclosure.md`](disclosure.md)).

## Allowed

- Generic synthetic voices from the adapter's default voice pool.
- Anonymous AI presenter / narrator voices that are not attributable to a specific real person.
- Voice clones of the user themselves, when the prompt explicitly states *"clone my own voice — [USER] on YYYY-MM-DD"* and the voice sample is the user's own recorded audio.

## Refusal path

When consent is missing or ambiguous:

1. Refuse to render.
2. Surface this file path (`agents/policies/media/voice-cloning.md`) and [`public-figures.md`](public-figures.md) if the subject is a public figure.
3. Emit **one** clarifying question (per [`ask-when-uncertain`](../../../.augment/rules/ask-when-uncertain.md)) — typically: *"This prompt requests a voice clone of [PERSON]. Do you have a dated vocal-likeness release on file? Note: a written-content publicity-rights clearance is not sufficient."*
4. Record refusal, question, and surfaced policy files in the session transcript.

## Enforcement model

LLM-readable decision framework. The agent consults this file; the human in the session is the decision point; the session transcript is the audit log. No automated voice-fingerprint check today — this is a policy-layer gate, not a runtime classifier. See [`README.md § Enforcement model`](README.md).

## See also

- [`likeness.md`](likeness.md) — visual-likeness analogue.
- [`public-figures.md`](public-figures.md) — additional gates when the subject is a public figure.
- [`disclosure.md`](disclosure.md) — mandatory disclosure on AI-generated voice output.
- [`transparency.md`](transparency.md) — provenance metadata in the rendered audio artifact.
