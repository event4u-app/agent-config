# Media Policy — Transparency (Provenance Metadata)

## Iron Law

```
EVERY AI-GENERATED VIDEO, IMAGE, OR VOICE ARTIFACT CARRIES MACHINE-
READABLE PROVENANCE METADATA WHERE THE PROVIDER SUPPORTS IT.
DO NOT STRIP IT. DO NOT FORGE IT.
```

"Transparency" here means machine-readable provenance: who generated the artifact (provider, model, version), when (timestamp), with which prompt (hash, not raw — secrets stay redacted), and what the artifact claims to depict (AI-generated, AI-edited, real source with AI modifications). The C2PA (Coalition for Content Provenance and Authenticity) manifest is the canonical surface; provider-specific equivalents (Google SynthID, OpenAI metadata, EXIF AI-generated tags) count where they exist.

## Triggers

The agent consults this policy when any of the following fires:

- `/video:from-script`, `/video:from-song`, `/video:storyboard`, `/video:scene`, `/video:stitch` produces a clip or still that will be distributed (any audience beyond the local prompt author).
- `/image:create` produces a still that will be distributed.
- A `character-consistency` or `scene-expander` blueprint produces a still image intended for embed, share, or publish.
- A future `/audio:*` invocation, or any later `/image:*` sub-command that emits a medium, produces an artifact intended for the same surfaces.
- The user requests removal or alteration of provenance metadata (e.g., *"strip the C2PA"*, *"remove the SynthID"*, *"make it look human-authored"*).

## Required

Every distributed AI-generated artifact carries, at minimum:

- The **AI-generated** assertion (C2PA `actions.created` claim with `c2pa.ai_generated` or provider equivalent).
  For modified material the assertion is `c2pa.ai_edited` with the `c2pa.edited` action — see § Vocabulary.
- The **model + provider** identifier (e.g., `veo-3.0` via `gemini-veo`).
- The **timestamp** of generation.
- A **prompt-hash** reference (SHA-256 of the prompt with secrets redacted via `lib/redact.sh`), so the artifact can be tied back to the session transcript without exposing prompt content.

Where the provider does not support C2PA today, the agent emits a sidecar `.provenance.json` file alongside the artifact carrying the same fields and notes which provider is the gap (`provider_lifecycle` interaction — `experimental` adapters are most likely to lack native C2PA).

The sidecar also carries `artifact_sha256`, the SHA-256 of the **final** bytes — computed after every other carrier has touched the file — so it can be tied to exactly one file. A sidecar whose hash does not match the file next to it describes a different file.

## Carriers — what each one really guarantees

| Carrier | What it is | Survives a stream copy / re-encode? | Counts as non-removable? |
|---|---|---|---|
| `visible` | Burned into the picture or the audio (caption, card, watermark, bumper) | Yes — it is part of the frames / samples | **Yes — the only one** |
| `embedded` | Container metadata tags (mp4 `comment` / `description`) and a C2PA manifest | No — `ffmpeg -map_metadata -1 -c copy` removes the tags; any re-encode drops tags and signature | No |
| `sidecar` | `<artifact>.provenance.json` next to the file, carrying the sha256 of the final bytes | No — it is a separate file; it stops matching once the bytes change | No |
| `platform-field` | The distributing platform's own AI-content field or label, set at upload | Only on that platform | No — the platform owns it |

Machine-readable provenance lives on `embedded` and `sidecar`; it is removable by construction, which is why it is written always and reported always, and why "non-removable" is reserved for `visible` (see [`disclosure.md § Carriers`](disclosure.md)). Container keys are limited to ones the muxer keeps (`comment`, `description`): a custom key such as `ai_generated` is silently dropped by the mp4 muxer and therefore never written.

## Vocabulary — one table for label, sidecar and C2PA

| Human label (disclosure) | Assertion (sidecar `assertion`, finish input) | C2PA action | IPTC `digitalSourceType` (C2PA + sidecar `digital_source_type`) |
|---|---|---|---|
| `generated` — *"AI-generated content"* | `ai_generated` (`c2pa.ai_generated`) | `c2pa.created` | `trainedAlgorithmicMedia` |
| `modified` — *"AI-modified content"* | `ai_edited` (`c2pa.ai_edited`) | `c2pa.edited` | `compositeWithTrainedAlgorithmicMedia` |

Every carrier reads its wording from this one row: the container comment, the sidecar, the C2PA manifest and the visible label never disagree about whether material was generated or modified. Edited material is never labelled "AI-generated".

## Principles

```
PROVENANCE AND DISCLOSURE ARE REPORTED, NEVER REMOVED — ON THE PRODUCTION
SIDE AND ON THE ANALYSIS SIDE ALIKE.
NO QUALITY, POLISH, OR OPTIMISATION LOOP TAKES DETECTABILITY AS AN OBJECTIVE,
OR KEEPS A CHANGE WHOSE EFFECT IS TO MAKE AI MEDIA LESS RECOGNISABLE AS AI.
```

- **Reported, never removed.** Production writes every carrier it can and reports each one's state. Analysis of existing media reports the provenance signals it finds (container AI tags, a C2PA manifest, a neighbouring sidecar) and reports their absence as "no provenance signal found" — never as "human-made" — and never strips what it found.
- **No loop toward lower detectability.** A quality or polish loop may optimise fidelity, timing or brand fit. It may not score, rank or accept a revision by how hard the result is to recognise as AI, and a revision that weakens a carrier is rejected. Same law as the text side's exclusion of any detector-evasion mode in the [`humanizer`](../../../../src/skills/humanizer/SKILL.md) skill.

## Forbidden

- Stripping C2PA, SynthID, EXIF AI-generated tags, or sidecar `.provenance.json` from any distributed AI-generated artifact.
- Forging provenance metadata to claim the artifact is human-authored, sourced from a real camera / microphone, or generated by a different provider than the one that produced it.
- Re-encoding the artifact specifically to strip provenance (e.g., screen-recording the output, re-rendering through a non-C2PA pipeline) — when the agent is asked to re-render, it preserves or regenerates the provenance manifest with the new render's data.
- Any quality, polish or optimisation loop that takes detectability as an objective (see § Principles).
- Shipping a re-cut or re-encoded file with the sidecar of the previous bytes — its `artifact_sha256` no longer matches.

## Allowed

- Re-encoding for legitimate distribution constraints (size, format) **followed by a re-finish** on the new bytes: `embed-provenance.sh finish` re-tags the container, rewrites the sidecar with the new `artifact_sha256`, and re-signs C2PA where available. Re-cut means re-finish.

**What a re-encode loses.** Any re-encode or metadata-dropping copy outside this pipeline — including a distributing platform's own transcode — loses the `embedded` carriers (container tags) and invalidates the C2PA signature, and the sidecar stops matching the bytes. The run report states this for every deliverable; only a `visible` carrier survives that step.
- Adding additional, non-conflicting provenance fields (editor information, distribution channel, accessibility metadata).
- Disclosing more than required (full prompt content) when the user explicitly opts in and no secrets are present.

## Refusal path

When the user requests provenance removal or forgery:

1. Refuse the modification.
2. Surface this file path (`agents/settings/policies/media/transparency.md`).
3. Emit **one** clarifying question (per [`ask-when-uncertain`](../../../.augment/rules/ask-when-uncertain.md)) — typically: *"Provenance metadata cannot be stripped from a distributed AI-generated artifact. Do you want to (a) keep provenance and proceed, (b) restrict distribution to a context where provenance is preserved, or (c) discuss the specific re-encode constraint?"*
4. Record refusal and surfaced policy in the session transcript.

## Enforcement model

LLM-readable decision framework + provider-side technical capability where it exists. The agent consults this file; provider adapters emit native provenance when supported; sidecar fallback covers the gap. The session transcript is the audit log. See [`README.md § Enforcement model`](README.md).

**Mechanical surface:** `scripts/ai-video/lib/embed-provenance.sh finish` implements the Required fields in code, in a fixed carrier order: (1) the `visible` slot — reserved, reported `not-applied (rule pending)` until the burn-in rule lands; (2) container tags on mp4-family files (`comment` + `description`, wording per § Vocabulary, stream copy); (3) the sidecar `.provenance.json` with the sha256 of the final bytes; (4) a C2PA manifest last, when the operator installed `c2patool` with signing configured (`C2PATOOL_SIGN_ARGS`) — the sidecar hash is re-bound to the signed bytes. `embed` is the legacy entry and runs the same step. `embed-provenance.sh manifest <sidecar>` prints the C2PA manifest definition read-only. Every render end calls `finish` (`/video:from-script`, `/video:from-song`, `/video:stitch`, `/image:create`); `src/scripts/lint_media_policy_linkage.ts` fails the build when a command that emits a deliverable medium is missing from either trigger list or never calls `finish`. `/video:scene` and `/video:storyboard` write intermediates (a scene clip, a contact sheet) and are not render ends; an intermediate that leaves for an audience is run through `finish` first, like any deliverable. The script only *adds* provenance; it ships no strip/remove path by design.

## See also

- [`disclosure.md`](disclosure.md) — human-readable disclosure layer (caption, opening card) that complements machine-readable provenance.
- [`docs/contracts/provider-lifecycle.md`](../../../docs/contracts/provider-lifecycle.md) — which adapters carry which provenance surface today.
- [`likeness.md`](likeness.md) · [`public-figures.md`](public-figures.md) · [`voice-cloning.md`](voice-cloning.md) · [`brand-impersonation.md`](brand-impersonation.md) — the surfaces where provenance matters most.
