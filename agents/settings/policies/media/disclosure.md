# Media Policy — Disclosure

## Iron Law

```
AI-GENERATED VIDEO, IMAGE, OR VOICE THAT COULD BE MISTAKEN FOR REAL
HUMAN-AUTHORED CONTENT CARRIES A MANDATORY, NON-REMOVABLE DISCLOSURE.
NO --no-disclosure FLAG. NO --internal FLAG. NO OPT-OUT.
```

Working precedent: the `/ghostwriter:*` and `/post-as:ghostwriter` cluster already enforces a mandatory non-removable disclosure footer when writing in a public figure's voice (see [`commands/post-as/ghostwriter.md`](../../../.agent-src.uncondensed/commands/post-as/ghostwriter.md) and the `write-engine` contract in [`docs/contracts/write-engine.md`](../../../docs/contracts/write-engine.md)). This policy **extends that contract from prose to image / video / voice** and binds it to every adapter-side render path the agent invokes.

## Triggers

The agent consults this policy when any of the following fires:

- `/video:from-script`, `/video:from-song`, `/video:storyboard`, `/video:scene`, or `/video:stitch` produces a clip intended for any audience beyond the prompt author (internal review, share, publish, embed).
- `/image:create` produces a still intended for the same audiences.
- A `character-consistency`, `scene-expander`, `video-director`, `pixar-storyteller`, or `motion-choreographer` blueprint references a real person or recognisable public figure (in which case [`likeness.md`](likeness.md) and [`public-figures.md`](public-figures.md) also fire).
- A future `/audio:*` invocation, or any later `/image:*` sub-command that emits a medium, produces an artifact that depicts or speaks as a recognisable real person.

## Required disclosure

Every disclosed output carries:

- The phrase *"AI-generated content"* or jurisdiction-specific equivalent (e.g., *"Künstlich generierter Inhalt"*, *"Contenu généré par IA"*).
- The model / provider name (e.g., *"Veo 3 via gemini-veo"*), kept in the artifact metadata at minimum and surfaced in human-readable form when the output references a real person or a named style.
- For voice / video referencing a real person: an on-screen / in-audio disclosure that is **not removable** by a `--no-disclosure` flag.

The form of the disclosure (caption, opening-frame card, watermark, audio bumper) is provider-dependent and surface-dependent. The Iron Law is that it is *present* and *non-removable*, not that it is identical across surfaces.

For edited material the phrase follows the assertion: *"AI-modified content"* (`ai_edited`), never *"AI-generated content"*. The full vocabulary — label, sidecar assertion, C2PA source type — is one table in [`transparency.md § Vocabulary`](transparency.md#vocabulary--one-table-for-label-sidecar-and-c2pa).

## Carriers — what each one really guarantees

A disclosure travels on one or more carriers. Only one of them survives a plain copy of the file:

| Carrier | What it is | Survives a stream copy / re-encode? | Counts as non-removable? |
|---|---|---|---|
| `visible` | Burned into the picture or the audio (caption, card, watermark, bumper) | Yes — it is part of the frames / samples | **Yes — the only one** |
| `embedded` | Container metadata tags (mp4 `comment` / `description`) and a C2PA manifest | No — `ffmpeg -map_metadata -1 -c copy` removes the tags; any re-encode drops tags and signature | No |
| `sidecar` | `<artifact>.provenance.json` next to the file, carrying the sha256 of the final bytes | No — it is a separate file; it stops matching once the bytes change | No |
| `platform-field` | The distributing platform's own AI-content field or label, set at upload | Only on that platform | No — the platform owns it |

"Non-removable" in this policy means the `visible` carrier. `embedded`, `sidecar` and `platform-field` are provenance, not disclosure: they are always written where the pipeline can write them, and none of them alone discharges a non-removable obligation. The agent never reports an embedded or sidecar carrier as the non-removable disclosure.

**State today, stated honestly.** The mechanical finish step (`scripts/ai-video/lib/embed-provenance.sh finish`) writes `embedded`, `sidecar` and C2PA (when the operator installed `c2patool`). The `visible` slot is reserved and reported `not-applied (rule pending)` until the burn-in rule and label form are decided. Until then, an output that this policy requires to carry a non-removable disclosure has that obligation **open**, and the run report says so in those words — it is never reported as met.

## Principles

```
PROVENANCE AND DISCLOSURE ARE REPORTED, NEVER REMOVED — ON THE PRODUCTION
SIDE AND ON THE ANALYSIS SIDE ALIKE.
NO QUALITY, POLISH, OR OPTIMISATION LOOP TAKES DETECTABILITY AS AN OBJECTIVE,
OR KEEPS A CHANGE WHOSE EFFECT IS TO MAKE AI MEDIA LESS RECOGNISABLE AS AI.
```

- **Reported, never removed.** Production writes every carrier it can and reports each one's state (`written`, `container-tags`, `sidecar-only`, `not-applied (rule pending)`, skipped with reason). Analysis of existing media reports the provenance signals it finds and reports their absence as "no provenance signal found" — never as "human-made" — and never strips what it found.
- **No loop toward lower detectability.** A score → revise → re-score loop may optimise quality, timing, fidelity or brand fit. It may not use "harder to detect as AI" as a score, a tie-breaker or an acceptance criterion, and a revision whose effect is to weaken a carrier or the recognisability of AI media is rejected. This mirrors the text-side exclusion of any detector-evasion mode in the [`humanizer`](../../../../src/skills/humanizer/SKILL.md) skill.

## Forbidden

- `--no-disclosure`, `--internal`, `--silent`, or any flag whose effect is to suppress the disclosure on AI-generated media referencing real people, public figures, or named styles. The agent refuses such flags and surfaces this file.
- Producing AI-generated content that *imitates* a known journalism / broadcaster / news brand's visual identity (chyron, logo, ticker) without an additional disclosure card — even fictional satire requires the disclosure.
- Stripping `C2PA` / provenance metadata from the output (see [`transparency.md`](transparency.md)).
- Any polish, quality or optimisation loop that takes detectability as an objective (see § Principles).
- Reporting an `embedded`, `sidecar` or `platform-field` carrier as the non-removable disclosure.

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

- [`commands/post-as/ghostwriter.md`](../../../.agent-src.uncondensed/commands/post-as/ghostwriter.md) — the prose disclosure precedent.
- [`public-figures.md`](public-figures.md) · [`likeness.md`](likeness.md) · [`voice-cloning.md`](voice-cloning.md) — what triggers the disclosure surface.
- [`transparency.md`](transparency.md) — provenance metadata layer (C2PA, EXIF) that complements human-readable disclosure.
