---
type: "auto"
tier: "1"
description: "Low-impact council fast-path dispatch — host MUST surface transparency marker verbatim in reply opening; never paraphrase"
source: package
triggers:
  - keyword: "low-impact council"
  - keyword: "fast-path"
  - keyword: "Resolved via low-impact council"
  - keyword: "low_impact"
  - intent: "low-impact council dispatch"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncompressed/"
    reason: "Compressor injects a back-pointer to the uncompressed source for full failure-modes detail."
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

# Fast-Path Marker Visibility

## The Iron Law

```
EVERY LOW-IMPACT COUNCIL FAST-PATH REPLY OPENS WITH THE EXACT MARKER.
NEVER PARAPHRASE. NEVER SWALLOW. NEVER SUBSTITUTE THE AGENT'S OWN VERDICT.
```

Markers (from `scripts/ai_council/low_impact.py`):

- **Resolved** — `> Resolved via low-impact council fast-path: <verdict>.`
- **Unavailable** — `> Low-impact council unavailable (no opted-in members) — escalating to user.`
- **Split** — `> Low-impact council split — escalating to user (<m1>: X / <m2>: Y):`
- **Aborted** — `> Low-impact council aborted (token cap) — escalating to user:`

Verbatim = first non-whitespace line, English (no translation), no emoji prefix, no merged numbered-options. Marker is the only audit signal that distinguishes fast-path from local deliberation. See `.agent-src.uncompressed/rules/fast-path-marker-visibility.md` for full failure modes.

Scope: `low_impact` class only. `high_impact` and `user_required` never reach fast-path.

See: [`ai-council-config § Low-impact council opt-in`](../docs/contracts/ai-council-config.md#low-impact-council-opt-in), [`direct-answers`](direct-answers.md) (invented-facts Iron Law kin).
