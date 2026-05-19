---
type: "auto"
tier: "2a"
description: "When generating AI video/image/voice — surface project-local media policies (likeness, style, public-figures, voice-cloning, disclosure)"
source: package
triggers:
  - keyword: "/video:"
  - keyword: "/image:"
  - keyword: "/audio:"
  - keyword: "deepfake"
  - keyword: "voice clone"
  - keyword: "voice cloning"
  - keyword: "likeness"
  - keyword: "brand impersonation"
  - phrase: "in the style of"
  - phrase: "in the voice of"
  - phrase: "as [public figure]"
  - phrase: "impersonate"
applies_to_user_types:
  - "creator"
  - "marketing"
  - "gtm"
validator_ignore:
  - type: "substring"
    pattern: "../../agents/"
    reason: "Routing rule whose subject matter is the project-local agents/policies/media/ tree; every body link points there by design."
  - type: "substring"
    pattern: ".agent-src.uncompressed/"
    reason: "Rule contrasts project-local placement with the .agent-src.uncompressed/rules/ alternative — mentioning the path is the argument."
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Media Governance Routing

## Iron Law

```
WHEN AI VIDEO, IMAGE, OR VOICE GENERATION FIRES, CONSULT THE PROJECT-LOCAL
MEDIA POLICIES IN agents/policies/media/ BEFORE EMITTING THE PROMPT TO
THE PROVIDER. REFUSE-AND-SURFACE OVER GUESS-AND-RENDER.
```

This rule routes the agent to the **project-local** media governance policy layer at [`agents/policies/media/`](../../agents/policies/media/) whenever a video / image / voice surface fires. The policies themselves are LLM-readable decision frameworks consulted in-session, not Python-enforced gates — see [`agents/policies/media/README.md § Enforcement model`](../../agents/policies/media/README.md) for the full agent-in-the-loop contract.

## What this rule surfaces

When any trigger above matches in the user prompt or in a tool invocation, the agent loads into context:

- [`agents/policies/media/likeness.md`](../../agents/policies/media/likeness.md) — real person's visual likeness.
- [`agents/policies/media/style.md`](../../agents/policies/media/style.md) — named living artist's distinctive style.
- [`agents/policies/media/public-figures.md`](../../agents/policies/media/public-figures.md) — recognised public figures.
- [`agents/policies/media/voice-cloning.md`](../../agents/policies/media/voice-cloning.md) — vocal likeness.
- [`agents/policies/media/disclosure.md`](../../agents/policies/media/disclosure.md) — mandatory non-removable AI-generation disclosure.
- [`agents/policies/media/brand-impersonation.md`](../../agents/policies/media/brand-impersonation.md) — brand / broadcaster identity imitation.
- [`agents/policies/media/transparency.md`](../../agents/policies/media/transparency.md) — provenance metadata (C2PA, SynthID).

Each policy carries its own trigger block, so within the active context the agent narrows from this superset to the policies whose specific patterns actually fired (e.g., a prompt naming a public figure activates `public-figures.md` and `disclosure.md`; a prompt requesting `--no-disclosure` activates `disclosure.md` standalone).

## Why project-local, not `.agent-src.uncompressed/rules/`

The seven media policies live under [`agents/policies/media/`](../../agents/policies/media/), not as `.agent-src.uncompressed/rules/domain-safety-media-*.md`, for three reasons:

1. **They are consumed by skills and adapters**, not surfaced as standalone always-loaded prose. The cost is non-trivial (7 × ~80 lines = ~560 lines into the always-context if hoisted to rules), and most sessions never touch a video / image / voice surface.
2. **The enforcement model is project-local** — the working precedent (`/ghostwriter:*` mandatory footer in `write-engine.md`) and the audit log (session transcripts) are project artifacts. Rules under `.agent-src.uncompressed/` are tool-portable governance; these policies are domain-specific bindings.
3. **Extraction to a reusable domain pack is explicitly deferred** until a second non-video domain (audio, image, docs, exports) lands with overlapping execution surfaces. Until then, a one-domain abstraction is structurally premature — the policies stay project-local and the routing rule is the on-demand bridge.

This routing rule is the bridge: it sits in the always-loaded rule set so the trigger keywords surface the project-local policies into context on demand, without paying the full always-loaded cost.

## CI reachability guarantee

[`scripts/lint_media_policy_linkage.py`](../../scripts/lint_media_policy_linkage.py) fails the build if any policy file under `agents/policies/media/` is not linked from:

- this routing rule, **or**
- a skill's `## Policies` see-also block, **or**
- another policy file's `## See also` block.

A policy that no skill, rule, or sibling policy references is a silent policy. The CI check is the structural reachability guarantee that the agent-in-the-loop model rests on.

## See also

- [`agents/policies/media/README.md`](../../agents/policies/media/README.md) — the full enforcement-model contract.
- [`.augment/rules/ask-when-uncertain.md`](../../.augment/rules/ask-when-uncertain.md) — the single-question refusal-path discipline every policy depends on.
- [`docs/contracts/write-engine.md`](../../docs/contracts/write-engine.md) — the prose-disclosure precedent extended to media by [`disclosure.md`](../../agents/policies/media/disclosure.md).
