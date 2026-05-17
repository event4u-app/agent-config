# Media Governance Policies

Project-local policy layer for AI-generated media (video, image, voice). These files are **LLM-readable decision frameworks** consulted by skills, commands, and adapters in the AI video pipeline (and future image / audio pipelines). They sit alongside, not under, the always-active rule set.

## Enforcement model — agent-in-the-loop

These policies are **not** runtime gates enforced by a Python `PolicyEngine`. The enforcement model is:

1. **The agent reads the policy** when its triggers fire (see each file's `## Triggers` block).
2. **The agent surfaces the policy file path** to the human in the session — every refusal cites the exact file.
3. **The human in the session is the decision point** — provides consent evidence, transformative-intent rationale, or accepts the refusal.
4. **The session transcript is the audit log** — refusals, surfaced policies, clarifying questions, and the user's answer are recorded.
5. **Structural reachability is CI-enforced** — `scripts/lint_media_policy_linkage.py` fails the build if any policy file in this directory is not linked from at least one skill or command. A policy that no skill references is a silent policy and a silent policy is a failed policy.

There is no Python `PolicyEngine` by design. A runtime classifier that decides *"is this prompt a deepfake?"* would be a category error: the questions these policies ask (is consent on file, is intent transformative, is the figure recognised in this jurisdiction) are judgment calls the LLM in-session is qualified to surface and the human is qualified to answer. Encoding them as deterministic Python would harden the wrong dimension. See the AI Council debate in `agents/council-responses/universal-platform-refinement.json/` (rounds 1–3) for the full reasoning.

## Files

| Policy | Scope |
|---|---|
| [`likeness.md`](likeness.md) | Real person's visual likeness — consent + refusal path. |
| [`style.md`](style.md) | Named living artist's / studio's distinctive style. |
| [`public-figures.md`](public-figures.md) | Recognised public figures — likeness + voice + disclosure overlap. |
| [`voice-cloning.md`](voice-cloning.md) | Vocal-likeness analogue of [`likeness.md`](likeness.md). |
| [`disclosure.md`](disclosure.md) | Mandatory non-removable AI-generation disclosure on triggering outputs. |
| [`brand-impersonation.md`](brand-impersonation.md) | Brand / broadcaster / regulated-industry visual identity imitation. |
| [`transparency.md`](transparency.md) | Machine-readable provenance metadata (C2PA, SynthID, EXIF). |

## Standard policy structure

Every file in this directory carries:

- **Iron Law block** — the one-sentence rule, in caps, no exceptions inferred.
- **Triggers** — keyword / phrase / invocation-context patterns that wake the policy.
- **Required when consent / use-right is cited** — what the prompt must include for the policy to clear.
- **Forbidden** — actions the policy refuses even with consent (the contextual no-go list).
- **Allowed** — the safe paths so refusals are not over-broad.
- **Refusal path** — the four-step pattern (refuse → surface file path → ask one question → record).
- **Enforcement model** — confirms agent-in-the-loop, not Python.
- **See also** — sibling policies and the upstream rule / skill citations.

## Triggers integration

The `.agent-src.uncompressed/rules/media-governance-routing.md` tier-2 rule auto-loads these policies into context when video / image / audio commands fire. Individual skills (`character-consistency`, `motion-choreographer`, `pixar-storyteller`, `scene-expander`, `video-director`) carry a `## Policies` see-also block that surfaces the relevant subset.

## Not in scope today

- Image-only and audio-only pipelines (`/image:*`, `/audio:*`) are pre-implementation. The policies are pre-wired in this directory; the rules and skill see-also blocks land when the surfaces ship.
- Runtime voice-fingerprint detection, runtime face-detection on real-person matches, automated C2PA verification on user-uploaded reference material — out of scope by design (category error per the agent-in-the-loop model).
- Domain-pack extraction of this policy set into a reusable downstream artifact — deferred until a second non-video domain demonstrates the pattern (see the Phase 6 ADR placeholder in `agents/roadmaps/universal-platform-refinement.md`).

## See also

- [`agents/roadmaps/universal-platform-refinement.md`](../../roadmaps/universal-platform-refinement.md) — the roadmap that introduced this policy layer.
- [`agents/council-responses/universal-platform-refinement.json/`](../../council-responses/) — the AI Council debate that anchored the agent-in-the-loop model.
- [`docs/contracts/write-engine.md`](../../../docs/contracts/write-engine.md) — the prose disclosure precedent (`/ghostwriter:*` mandatory footer).
- [`.agent-src.uncompressed/rules/media-governance-routing.md`](../../../.agent-src.uncompressed/rules/media-governance-routing.md) — the tier-2 routing rule that surfaces these policies into context.
- [`scripts/lint_media_policy_linkage.py`](../../../scripts/lint_media_policy_linkage.py) — the CI-enforced reachability check.
