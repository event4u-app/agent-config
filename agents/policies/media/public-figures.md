# Media Policy — Public Figures

## Iron Law

```
NAMING A PUBLIC FIGURE IN AI-GENERATED VIDEO, IMAGE, OR VOICE
REQUIRES CITED CONSENT OR A TRANSFORMATIVE-INTENT RATIONALE.
WHEN MISSING, ASK ONE QUESTION; DO NOT RENDER.
```

A "public figure" is a person whose identity is widely recognised in the relevant jurisdiction: heads of state, named CEOs of public companies, celebrities, named athletes, named artists. Recognition is jurisdiction-dependent — the agent treats this as load-bearing and surfaces the policy on every named reference.

Working precedent: the `/ghostwriter:*` and `/post-as:ghostwriter` cluster already enforces a **mandatory, non-removable disclosure footer** when writing in a public figure's voice (see [`commands/post-as/ghostwriter.md`](../../../.agent-src.uncompressed/commands/post-as/ghostwriter.md) and [`disclosure.md`](disclosure.md)). This policy extends that contract from prose to image / video / voice.

## Triggers

The agent consults this policy when any of the following fires:

- A `/video:*` prompt names a public figure as the on-screen subject or off-screen narrator.
- A `character-consistency`, `scene-expander`, `video-director`, or `pixar-storyteller` blueprint references a public figure by name.
- A `/ghostwriter:*` or `/post-as:ghostwriter` invocation produces text that will be embedded in or attached to AI-generated video / audio (the disclosure footer survives — surfaces this policy to confirm).
- The prompt contains *"deepfake"*, *"impersonate"*, *"as [PUBLIC_FIGURE]"*, or *"in the voice of [PUBLIC_FIGURE]"*.

## Required when consent or intent is cited

The prompt must include one of:

- *"Publicity rights cleared via [AGENCY] on YYYY-MM-DD"*
- *"Likeness release signed by [PERSON] on YYYY-MM-DD"* (see [`likeness.md`](likeness.md))
- *"Transformative-intent rationale: [PARODY / COMMENTARY / EDUCATION / JOURNALISM] — [JURISDICTION]"* — limited to genuinely transformative work; load-bearing fair-use claims are flagged for human review.
- *"Public press release / publicly available quote — [URL]"* — only sufficient for verbatim re-use of already-public material, not for new synthetic rendering.

## Forbidden

- Rendering a public figure in a context they would credibly object to (criminal, sexual, medical, political-endorsement) — refuse even with a generic likeness release.
- Producing political endorsement content (a public figure endorsing a candidate / party / policy they have not actually endorsed) — refuse without exception; this is the hardest line.
- Stripping the AI-generation disclosure from any output that references a public figure (see [`disclosure.md`](disclosure.md)) — never silent.
- Generating voice-clone audio of a public figure without consent (see [`voice-cloning.md`](voice-cloning.md)).

## Refusal path

When consent / intent is missing or ambiguous:

1. Refuse to render.
2. Surface this file path (`agents/policies/media/public-figures.md`).
3. Emit **one** clarifying question (single-question fidelity per [`ask-when-uncertain`](../../../.augment/rules/ask-when-uncertain.md)) — typically: *"This prompt references [PUBLIC_FIGURE]. Do you have a publicity-rights clearance, a likeness release, or a transformative-intent rationale on file?"*
4. Record refusal, question, and surfaced policy files in the session transcript — that is the audit log.

The `prompt_optimization` module enforces this refusal path in code (see `tests/test_prompt_optimization.py` — the public-figure refusal-path test in Phase 4 of the universal-platform-refinement roadmap).

## Enforcement model

LLM-readable decision framework + a code-side refusal-path test. The agent consults this file; the human in the session is the decision point; `prompt_optimization` ensures the policy file is reachable from code; the session transcript is the audit log. See [`README.md § Enforcement model`](README.md).

## See also

- [`likeness.md`](likeness.md) — visual-likeness layer.
- [`voice-cloning.md`](voice-cloning.md) — vocal-likeness layer.
- [`disclosure.md`](disclosure.md) — the mandatory disclosure footer extended to AI-generated media.
- [`brand-impersonation.md`](brand-impersonation.md) — when the public figure is acting in a brand capacity.
- [`transparency.md`](transparency.md) — provenance metadata in the rendered artifact.
