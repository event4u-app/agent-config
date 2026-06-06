---
type: "auto"
tier: "1"
description: "Low-impact council fast-path dispatch — host MUST surface transparency marker verbatim in reply opening; never paraphrase"
triggers:
  - keyword: "low-impact council"
  - keyword: "fast-path"
  - keyword: "Resolved via low-impact council"
  - keyword: "low_impact"
  - intent: "low-impact council dispatch"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncondensed/"
    reason: "Condenseor injects a back-pointer to the uncondensed source for full failure-modes detail."
workspaces:
  - agent-config-maintainer
packs:
  - meta
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

Verbatim = first non-whitespace line, English (no translation), no emoji prefix, no merged numbered-options. Marker is the only audit signal that distinguishes fast-path from local deliberation. See `.agent-src.uncondensed/rules/fast-path-marker-visibility.md` for full failure modes.

## Failure modes

- Opening with `Found it` / `Looks like` / `Here's the verdict` — drops the marker. **Violation.**
- Translating the marker to non-English. **Violation.**
- Adding emoji prefix (`✅ Resolved via …`) — alters the literal. **Violation.**
- Indenting beyond the leading `> ` — breaks pattern match. **Violation.**
- Merging marker into a numbered-options block. **Violation.**

Scope: `low_impact` class only. `high_impact` and `user_required` never reach fast-path.

See: [`ai-council-config § Low-impact council opt-in`](../docs/contracts/ai-council-config.md#low-impact-council-opt-in), [`direct-answers`](direct-answers.md) (invented-facts Iron Law kin).
