# Media Policy — Disclosure

## Iron Law

```
AI-GENERATED VIDEO, IMAGE, OR VOICE THAT COULD BE MISTAKEN FOR REAL
HUMAN-AUTHORED CONTENT CARRIES A MANDATORY, NON-REMOVABLE DISCLOSURE.
NO --no-disclosure FLAG. NO --internal FLAG. NO OPT-OUT.
```

Working precedent: the `/ghostwriter:*` and `/post-as:ghostwriter` cluster already enforces a mandatory non-removable disclosure footer when writing in a public figure's voice (see [`commands/post-as/ghostwriter.md`](../../../.agent-src.uncompressed/commands/post-as/ghostwriter.md) and the `write-engine` contract in [`docs/contracts/write-engine.md`](../../../docs/contracts/write-engine.md)). This policy **extends that contract from prose to image / video / voice** and binds it to every adapter-side render path the agent invokes.

## Triggers

The agent consults this policy when any of the following fires:

- `/video:from-script`, `/video:storyboard`, `/video:scene`, or `/video:stitch` produces a clip intended for any audience beyond the prompt author (internal review, share, publish, embed).
- A `character-consistency`, `scene-expander`, `video-director`, `pixar-storyteller`, or `motion-choreographer` blueprint references a real person or recognisable public figure (in which case [`likeness.md`](likeness.md) and [`public-figures.md`](public-figures.md) also fire).
- A future `/image:*` or `/audio:*` invocation produces an artifact that depicts or speaks as a recognisable real person.

## Required disclosure

Every disclosed output carries:

- The phrase *"AI-generated content"* or jurisdiction-specific equivalent (e.g., *"Künstlich generierter Inhalt"*, *"Contenu généré par IA"*).
- The model / provider name (e.g., *"Veo 3 via gemini-veo"*), kept in the artifact metadata at minimum and surfaced in human-readable form when the output references a real person or a named style.
- For voice / video referencing a real person: an on-screen / in-audio disclosure that is **not removable** by a `--no-disclosure` flag.

The form of the disclosure (caption, opening-frame card, watermark, audio bumper) is provider-dependent and surface-dependent. The Iron Law is that it is *present* and *non-removable*, not that it is identical across surfaces.

## Forbidden

- `--no-disclosure`, `--internal`, `--silent`, or any flag whose effect is to suppress the disclosure on AI-generated media referencing real people, public figures, or named styles. The agent refuses such flags and surfaces this file.
- Producing AI-generated content that *imitates* a known journalism / broadcaster / news brand's visual identity (chyron, logo, ticker) without an additional disclosure card — even fictional satire requires the disclosure.
- Stripping `C2PA` / provenance metadata from the output (see [`transparency.md`](transparency.md)).

## Allowed (no disclosure required)

- Fully synthetic characters with no real-person reference, no named-style attribution, no brand impersonation — generic-genre output (e.g., a cartoon dragon in a "watercolour" style).
- Pre-production internal artifacts that never leave the author's local environment **and** never reference a real person, public figure, or named style. The agent flags this as a narrow exception and surfaces the policy.

## Refusal path

When a flag attempts to suppress the disclosure or the prompt requests disclosure removal:

1. Refuse to render with the suppression in place.
2. Surface this file path (`agents/settings/policies/media/disclosure.md`).
3. Emit **one** clarifying question (per [`ask-when-uncertain`](../../../.augment/rules/ask-when-uncertain.md)) — typically: *"This output references [PERSON / STYLE / BRAND], so the AI-generation disclosure is non-removable. Do you want to (a) keep the disclosure and proceed, or (b) revise the prompt so no real reference is named?"*
4. Record refusal, surfaced policy, and the user's choice in the session transcript.

## Enforcement model

LLM-readable decision framework + the existing `write-engine` mandatory-footer pattern as the working precedent. The agent consults this file; the human cannot opt out at the prompt level for triggering outputs. See [`README.md § Enforcement model`](README.md).

## See also

- [`commands/post-as/ghostwriter.md`](../../../.agent-src.uncompressed/commands/post-as/ghostwriter.md) — the prose disclosure precedent.
- [`public-figures.md`](public-figures.md) · [`likeness.md`](likeness.md) · [`voice-cloning.md`](voice-cloning.md) — what triggers the disclosure surface.
- [`transparency.md`](transparency.md) — provenance metadata layer (C2PA, EXIF) that complements human-readable disclosure.
