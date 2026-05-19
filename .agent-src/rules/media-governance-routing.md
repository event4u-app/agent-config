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

Routes agent to project-local media governance policy layer at [`agents/policies/media/`](../../agents/policies/media/) when video / image / voice surface fires. Policies are LLM-readable decision frameworks consulted in-session, not Python-enforced gates — see [`agents/policies/media/README.md § Enforcement model`](../../agents/policies/media/README.md) for full agent-in-the-loop contract.

## What this rule surfaces

Any trigger match → agent loads into context:

- [`agents/policies/media/likeness.md`](../../agents/policies/media/likeness.md) — real person's visual likeness.
- [`agents/policies/media/style.md`](../../agents/policies/media/style.md) — named living artist's distinctive style.
- [`agents/policies/media/public-figures.md`](../../agents/policies/media/public-figures.md) — recognised public figures.
- [`agents/policies/media/voice-cloning.md`](../../agents/policies/media/voice-cloning.md) — vocal likeness.
- [`agents/policies/media/disclosure.md`](../../agents/policies/media/disclosure.md) — mandatory non-removable AI-generation disclosure.
- [`agents/policies/media/brand-impersonation.md`](../../agents/policies/media/brand-impersonation.md) — brand / broadcaster identity imitation.
- [`agents/policies/media/transparency.md`](../../agents/policies/media/transparency.md) — provenance metadata (C2PA, SynthID).

Each policy carries own trigger block → within active context agent narrows from superset to policies whose specific patterns actually fired (e.g. prompt naming public figure → `public-figures.md` + `disclosure.md`; `--no-disclosure` → `disclosure.md` standalone).

## Why project-local, not `.agent-src.uncompressed/rules/`

Seven media policies live under [`agents/policies/media/`](../../agents/policies/media/), not as `.agent-src.uncompressed/rules/domain-safety-media-*.md`, for three reasons:

1. **Consumed by skills + adapters**, not surfaced as standalone always-loaded prose. Cost non-trivial (7 × ~80 lines = ~560 lines always-context if hoisted to rules), and most sessions never touch video / image / voice surface.
2. **Enforcement model project-local** — working precedent (`/ghostwriter:*` mandatory footer in `write-engine.md`) + audit log (session transcripts) are project artifacts. Rules under `.agent-src.uncompressed/` are tool-portable governance; these policies are domain-specific bindings.
3. **Extraction to reusable domain pack explicitly deferred** until second non-video domain (audio, image, docs, exports) lands with overlapping execution surfaces. Until then, one-domain abstraction structurally premature — policies stay project-local, routing rule on-demand bridge.

This routing rule is the bridge: sits in always-loaded rule set so trigger keywords surface project-local policies into context on demand, without paying full always-loaded cost.

## CI reachability guarantee

[`scripts/lint_media_policy_linkage.py`](../../scripts/lint_media_policy_linkage.py) fails build if any policy file under `agents/policies/media/` not linked from:

- this routing rule, **or**
- a skill's `## Policies` see-also block, **or**
- another policy file's `## See also` block.

Policy that no skill, rule, or sibling policy references → silent policy. CI check is structural reachability guarantee that agent-in-the-loop model rests on.

## See also

- [`agents/policies/media/README.md`](../../agents/policies/media/README.md) — full enforcement-model contract.
- [`.augment/rules/ask-when-uncertain.md`](../../.augment/rules/ask-when-uncertain.md) — single-question refusal-path discipline every policy depends on.
- [`docs/contracts/write-engine.md`](../docs/contracts/write-engine.md) — prose-disclosure precedent extended to media by [`disclosure.md`](../../agents/policies/media/disclosure.md).
