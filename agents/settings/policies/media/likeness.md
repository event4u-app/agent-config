# Media Policy — Likeness

## Iron Law

```
DO NOT RENDER A REAL PERSON'S LIKENESS WITHOUT A CITED CONSENT RECORD
IN THE PROMPT. WHEN UNCERTAIN, ASK — DO NOT GUESS.
```

A "likeness" is any rendering — image or video — where a viewer could reasonably identify a specific real person from face, body, voice timbre, signature wardrobe, or named context (e.g., "the CEO of Acme on a TED stage"). Synthetic-only characters and non-identifying silhouettes are out of scope.

## Triggers

The agent consults this policy before proceeding when any of the following fires:

- `/video:*`, `/ghostwriter:*`, or future `/image:*` / `/audio:*` invocation references a named real person, a recognised public figure, or a private individual identifiable from prompt context.
- `character-consistency`, `scene-expander`, `video-director`, `motion-choreographer`, or `pixar-storyteller` produces a character sheet that names a real person.
- The prompt contains a verbatim phrase such as *"in the style of [PERSON]"*, *"as [PERSON]"*, *"deepfake of"*, *"replace face with"*, or *"impersonate"*.

## Required when consent is cited

The prompt must include one of:

- *"Likeness release signed by [PERSON] on YYYY-MM-DD"*
- *"Publicity rights cleared via [AGENCY] on YYYY-MM-DD"*
- *"Public-figure parody / commentary — fair use — [JURISDICTION]"* (limited to genuinely transformative satire; the agent flags load-bearing fair-use claims for human review)

Without one of these, the agent does not render. It asks one clarifying question (per [`ask-when-uncertain`](../../../.augment/rules/ask-when-uncertain.md)) and surfaces this file path so the policy is provably reachable.

## Forbidden

- Rendering a private individual's likeness without explicit consent recorded in the prompt.
- Generating a "deepfake-style" face-swap onto another body, even with consent for the target face, unless both subjects' likeness releases are cited.
- Producing content that places a real person in a context they would credibly object to (criminal, sexual, medical, political-endorsement) — refuse even with a generic likeness release; this requires context-specific written approval.

## Allowed

- Generic crowd / extra figures with no identifying features.
- Synthetic characters generated from `character-consistency` identity tokens where the prompt does not reference a real person.
- Documented public-figure references in editorial / commentary contexts where the [`public-figures.md`](public-figures.md) consent and disclosure rules are satisfied.

## Refusal path

When consent is missing or ambiguous:

1. Refuse to render.
2. Surface this file path (`agents/settings/policies/media/likeness.md`) and [`public-figures.md`](public-figures.md) if the subject is a public figure.
3. Emit **one** clarifying question (single-question fidelity per [`ask-when-uncertain`](../../../.augment/rules/ask-when-uncertain.md)) — typically: *"Do you have a likeness release on file for [PERSON]? If yes, please cite the date and source."*
4. Record the refusal and the question in the session transcript — that is the audit log.

## Enforcement model

This file is an LLM-readable decision framework. The agent consults it; the human in the session is the policy decision point; the transcript is the audit log. There is no Python `PolicyEngine` by design — see [`README.md § Enforcement model`](README.md).

## See also

- [`public-figures.md`](public-figures.md) — additional gates for recognised public figures.
- [`brand-impersonation.md`](brand-impersonation.md) — likeness applied to a brand / mascot rather than a person.
- [`disclosure.md`](disclosure.md) — when likeness is allowed, when the output must carry an AI-generation disclosure.
- [`voice-cloning.md`](voice-cloning.md) — vocal-likeness analogue.
