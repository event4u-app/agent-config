---
adr: 103
status: accepted
date: 2026-06-16
decision: global-knowledge-default-off-until-measured
supersedes: —
superseded_by: —
phase: evidence-v2
type: structural
---

# ADR-103 — Global knowledge sharing defaults OFF until cross-project reuse is measured

## Status

Accepted (2026-06-16). Council-reviewed (claude-sonnet-4-5 + gpt-4o, design mode,
2 rounds + peer-review) as part of Evidence v2 Phase 0. **Amends
[ADR-100](ADR-100-global-knowledge-card-sharing.md) Decision-6/Consequences**
(the `knowledge.global_sharing.enabled` default) only. The rest of ADR-100 — the
file-first store, origin-tier scoping, redaction-on-write, hybrid promotion,
kill-switch — stands unchanged.

## Context

[ADR-098](ADR-098-evidence-first-structure-discovery.md) Decision-10 killed the
global/registry/promotion layer with an explicit gate: *measure cross-project
reuse over the measurement window, then decide*. [ADR-100](ADR-100-global-knowledge-card-sharing.md)
reversed that kill on the **same day** and shipped the layer **default-ON**,
justified by "measured v1 reuse + the cross-project value case".

An independent review of the shipped v1 (claude-sonnet-4-5 + gpt-4o) found that
justification circular: v1 was ~1 day old, the measurement window was never
waited out, so there is **no measured reuse** — "measured v1 reuse" is a
rationale, not a data point. The global layer thus shipped having bypassed the
very gate that was the point of the gating exercise. Default-ON cross-project
data movement also sits poorly with the otherwise privacy-first posture of a tool
**other people install**: the tier-classifier can misclassify, and redaction is
regex-based (can miss novel formats) — both listed as accepted risks in ADR-100.

## Decision

1. **`knowledge.global_sharing.enabled` defaults to `false`.** The store is
   opt-in, not opt-out, until cross-project reuse exists as a measured signal.
   The kill-switch from ADR-100 is excellent; this ADR only inverts its default.

2. **The measure-then-decide gate is restored, concretely.** The default flips
   back to `true` only when reuse is instrumented across **≥ 2 real projects**
   and shown positive — the `_lib/knowledge_global_promote.py record-seen`
   sightings are the instrument that already exists. Until then, opt-in stands.

3. **v1 is byte-for-byte unaffected.** Project-local discipline + cards do not
   read or write the global store regardless of this default. Only the
   cross-project layer is gated off.

4. **No new mechanism.** Promotion stays suggest-then-confirm; tier scoping,
   redaction-on-write, and the purge command are unchanged. This ADR changes one
   default value and the obligation to measure before flipping it back.

## Consequences

- `knowledge.global_sharing.enabled` default flips `true → false` in
  `src/config/agent-settings.template.yml`, `src/server/schemas/settings.ts`,
  and the `src/agent-src/templates/agent-settings.md` settings table.
- `evidence-discipline.md` § Global layer notes the default-off posture and the
  reuse-gate condition for flipping it back on.
- A consuming operator who wants cross-project sharing sets `enabled: true`
  explicitly — a deliberate, informed opt-in.
- The reuse measurement (Evidence v2 Phase 5 / global-promotion gate) is the
  evidence that would justify flipping the default back; until that data exists,
  the question is not re-litigated.

## Alternatives

- **Keep default-on (do nothing).** Rejected — restates the skipped-gate failure
  the v1 review flagged; default cross-project data movement on an installed tool
  is the wrong default before reuse is measured.
- **`public`-only on, `vendor` off.** Considered; rejected as the default because
  it still moves data cross-project by default. Off-until-measured is the cleaner
  privacy-first default. An operator may set `allowed_tiers: [public]` after
  opting in if they want the narrower surface.
- **Delete the global layer.** Rejected — ADR-100's file-first design is sound;
  the issue is the *default*, not the mechanism.

## References

- [ADR-100](ADR-100-global-knowledge-card-sharing.md) — the global layer; Decision-6
  default amended here.
- [ADR-098](ADR-098-evidence-first-structure-discovery.md) — the original
  measure-then-decide gate this ADR restores.
- `agents/roadmaps/archive/road-to-evidence-v2-project-intelligence.md` — Evidence v2
  Phase 0 (council convergence inlined in its header; archived on completion).
- `src/agent-src/contexts/execution/evidence-discipline.md` § Global layer.
