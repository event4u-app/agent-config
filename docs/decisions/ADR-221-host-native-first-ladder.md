---
adr: 221
status: proposed
date: 2026-08-10
decision: host-native-first-ladder
supersedes: —
superseded_by: —
phase: road-to-feedback-9-29
type: structural
review_trigger: >-
  Revisit when either (a) a host ships a native feature that an existing rung-3
  mechanism in this tree compensates for, which makes that mechanism
  retirement-eligible on that host and tests whether the ladder's retirement
  clause is followed, or (b) a rung-1 choice grounded in the capability registry
  turns out wrong in production — a native feature was declared available and
  was not — which would move the grounding requirement from the registry to a
  live probe at the decision point. Nothing here expires on a date: an ordering
  principle is either being followed or it is not, and both triggers are
  observable events rather than a calendar.
---

# ADR-221 — Host-native first: native feature → adapter → own runtime, in that order

## Status

**Proposed** · 2026-08-10. Codifies an ordering the tree already practices;
acceptance is the maintainer's call. No existing surface is migrated by this
record — it binds *new* capability work and *touched* surfaces only.

## Context

ADR-124 settled the vertical question: this suite may own deterministic
in-process engines, and the service/daemon prohibition stands. What no record
codifies is the *horizontal* ordering — when a capability could be delivered
through a host's native feature, through a thin adapter over it, or through a
mechanism this suite builds and maintains itself, which wins?

The tree already answers this consistently, case by case:

- **Rule scoping** ships as Claude-native `paths:` frontmatter emitted by
  `_emit_claude_rule` — the host's own loader does the scoping — instead of a
  package-side loader (9.29.0). Re-measured 2026-08-10: the scoping itself
  removes 64,841 B ≈ **19.2%** of the emitted standing corpus; the release
  note's −34.8% conflates that with the 81,016 B of frontmatter the emitter
  drops for every rule (table in
  `agents/evidence/analysis/scoped-rule-absence-preregistration.md`).
- **Capability facts** resolve from the committed host registry merged with a
  live environment probe (`src/scripts/_lib/host_capability.ts`), never from
  assumptions about what a host "should" support; a field is added only once
  it is itself observed.
- **Teams and council** are availability-based on host/CLI presence rather
  than gated by a package-side master switch (9.29.0).
- **Hooks** bind through per-host dispatchers over one in-process concern
  registry — the host's slot model is the delivery surface; the package does
  not run its own event loop.

Each of these was decided locally. The external release reviews of the
9.23→9.29 span independently recommended making the ordering explicit, so the
next capability discussion starts from the ladder instead of re-deriving it.

## Decision

For any capability that must reach a host session, prefer, in order:

1. **Native host feature.** If the host ships the mechanism (rule `paths:`
   scoping, native subagent primitives, hook slots, plugin surfaces), emit
   into it. The host maintains the mechanism; this suite maintains content.
2. **Adapter over the native feature.** Where hosts differ, a thin per-host
   adapter (the dispatcher/emitter pattern) that projects one canonical source
   into each host's native shape. The canonical source stays single; the
   adapters stay thin and enumerable.
3. **Own in-process mechanism — the fallback, not the default.** Only when no
   host feature exists on any target host, within ADR-124's bounds (in-process,
   deterministic, no service/daemon). The mechanism must state which hosts it
   compensates for, so it can be retired per-host when a native feature lands.

Two binding corollaries:

- **Capability facts come from the registry + probe, never from inference.**
  A rung-1/rung-2 choice is grounded in `host_capability.ts`'s observed facts;
  "the host probably supports X" is not a rung-1 justification.
- **Degradation is stated, never silent.** When rung 3 compensates for a
  missing host feature, the compensating surface names the gap (the pattern
  the hook-carrying rules already use: "on hosts without the slot, this
  obligation is model-carried").

## Consequences

- A proposal for new own-runtime machinery must show rungs 1 and 2 were
  checked against the capability registry first — one paragraph, not a
  ceremony.
- When a host later ships a native feature that an own mechanism compensates
  for, the mechanism becomes retirement-eligible on that host (decided when
  the surface is next touched, not by a sweep — `minimal-safe-diff` holds).
- No migration wave: existing rung-3 surfaces stay until touched. This record
  changes the default for new work, not the installed base.

## Alternatives considered

- **Codify nothing (status quo).** Rejected: the ordering is real but
  re-derived per discussion; three independent external reviews flagged the
  missing principle.
- **Enforce via a new CI gate.** Rejected: "checked the ladder" is a
  pre-write reasoning step no script observes (`enforced_by: none` honesty
  stance); a gate would be satisfiable by assertion. The locked
  measured-FP-first policy also applies.
- **Mandate migration of existing own-runtime pieces.** Rejected: reopens
  settled surfaces without a defect; violates minimal-safe-diff.

## References

- ADR-124 — embedded-engine doctrine (the vertical bound this extends).
- ADR-088 / ADR-094 — the service/runtime prohibitions, untouched.
- `src/scripts/_lib/host_capability.ts` — the registry + probe mechanism.
- 9.29.0 release notes — native `paths:` scoping, availability-based teams,
  CLI-first council (the shipped instances above).
