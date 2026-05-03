---
status: draft
---

# Spec: Decay calibration per memory type

> **Spec for `agent-memory`, authored from `agent-config`.**
> See [`README.md`](README.md) for the ownership split.

## Status

Draft. Addresses the gap raised in Claude's review: *"A historical bug
pattern about tenant scoping should not fade after 30 days even if
never accessed. A transient debugging context from last week should.
The policy for decay rates per memory type is still missing."*

## Prerequisites

- `agent-memory` implements **Ebbinghaus decay** (package README)
- [`../road-to-engineering-memory.md`](../road-to-engineering-memory.md)
  defines the six content types
- [`road-to-promotion-flow.md`](road-to-promotion-flow.md) defines the
  4-tier lifecycle that decay operates on

## Vision

Decay is a **hygiene mechanism, not a forgetting penalty**. Entries
fade when they no longer match reality; entries that encode durable
domain truth are held steady regardless of access frequency.

## Non-goals

- **No** uniform decay curve across all types — that is what we are
  fixing
- **No** hard-coding of project-specific overrides inside `agent-memory` —
  overrides come from `.agent-project-settings` or the consumer's
  install config
- **No** decay for `procedural` tier entries — by definition they are
  canonical workflow; if they become wrong the path is `deprecate`,
  not fade

## Mapping — six content types onto four cognitive tiers

| Content type (from `road-to-engineering-memory`) | Initial tier on first capture | Promoted tier | Rationale |
|---|---|---|---|
| Session notes / active hypothesis | `working` | — | Not persisted beyond session |
| Historical bug pattern — single occurrence | `episodic` | `semantic` on 2+ occurrences | One bug is an event; a pattern is truth |
| Incident learning | `episodic` | `semantic` after review | Event first, generalised rule second |
| Domain invariant | `semantic` | `procedural` after adoption | Abstract rule from day 1 |
| Ownership | `semantic` | — | Stable mapping of path → team |
| Architecture decision (ADR) | `semantic` | `procedural` once pattern-in-use | The decision is semantic, the followed pattern is procedural |
| Product rule | `semantic` | `procedural` after launch | Business-level invariant |

Tier assignment is deterministic from the proposal payload; agent-memory
does not guess.

## Default decay rates

Rates are defaults; consumers override per type via
`.agent-project-settings.memory.decay`.

| Tier | Default half-life | Floor | Lifted by |
|---|---|---|---|
| `working` | 2 hours | hard-drop at session end | — |
| `episodic` | **30 days** | `trust ≥ 0.4` keeps it visible with a "supporting evidence" tag | Promotion to `semantic` resets clock |
| `semantic` | **180 days since `last_validated`** | `trust ≥ 0.6` (default threshold); `0.3` floor prevents full fade | `last_validated` refresh on confirmation, retrieval hit, or human review |
| `procedural` | **effectively none** — 720 days | never drops below `0.8` | Only `deprecate` removes it |

### Per-type overrides to default rates

These are *recommendations to agent-memory defaults*; consumers can
tune further:

| Content type | Recommended override | Why |
|---|---|---|
| Domain invariant (semantic) | half-life 365 d | Invariants change rarely; premature fade hurts |
| Ownership (semantic) | half-life 365 d | Team changes are the signal, not time |
| Historical bug pattern (semantic) | half-life 180 d, floor `0.5` | Patterns stay relevant even when no recent sighting |
| Incident learning (episodic) | half-life 90 d | Incidents fade faster than patterns, but slower than generic episodic |
| ADR (semantic) | **no decay**, only explicit deprecate | ADRs are decisions; they die only when superseded |
| Product rule (semantic) | half-life 365 d | Business rules change with releases, not time |

## Override surface — what agent-memory must accept from consumers

The consumer ships a section in `.agent-project-settings.memory.decay`
that the install step writes into agent-memory's per-consumer config:

```yaml
memory:
  decay:
    tier_defaults:
      working:    { half_life_hours: 2 }
      episodic:   { half_life_days: 30, floor: 0.4 }
      semantic:   { half_life_days: 180, floor: 0.3 }
      procedural: { half_life_days: 720, floor: 0.8 }
    type_overrides:
      domain-invariant:   { half_life_days: 365 }
      ownership:          { half_life_days: 365 }
      historical-pattern: { half_life_days: 180, floor: 0.5 }
      incident-learning:  { half_life_days: 90 }
      adr:                { half_life_days: null }   # no decay
      product-rule:       { half_life_days: 365 }
```

`half_life_days: null` means "do not decay". `agent-memory` must accept
this value and skip decay arithmetic for matching entries.

## Retrieval-time coupling

Decay affects **trust score**, which in turn governs what is served:

- `working`: local only, not returned via `retrieve()`
- `episodic` with `trust < 0.6`: returned only when caller passes
  `include_supporting=true` (used by `bug-analyzer`, `/bug-investigate`)
- `semantic` / `procedural` with `trust ≥ threshold`: returned normally
- Anything below `floor`: `prune()` candidate on next hygiene run

## Open questions (decided in `agent-memory` repo)

- **Refresh semantics on retrieval hit.** Does a successful retrieval
  count as validation (refreshes `last_validated`)? Proposal: **yes,
  but only up to one refresh per entry per 7 days** to avoid access
  loops keeping dead entries alive.
- **Floor-vs-threshold ordering.** If `floor > serve_threshold`, does
  the entry stay served forever? Proposal: **floor applies to decay
  math only**; serve threshold is an independent gate.
- **Per-entry override.** Should a specific entry be able to declare
  `no_decay: true` (e.g. a critical security invariant)? Proposal:
  **yes**, but only settable by human via review, never by the agent.

## See also

- [`road-to-promotion-flow.md`](road-to-promotion-flow.md) — promotion
  resets and affects decay clocks
- [`../road-to-project-memory.md`](../road-to-project-memory.md) —
  the `.agent-project-settings.memory.decay` block lives there
- [`../road-to-engineering-memory.md`](../road-to-engineering-memory.md) —
  content-type definitions
