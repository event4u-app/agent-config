---
adr: 096
status: accepted
date: 2026-06-15
decision: analysis-workbench
supersedes: —
superseded_by: —
phase: road-to-analysis-workbench · Phase 0
type: structural
---

# ADR-096 — Analysis Workbench design decisions

## Status

**Accepted** · 2026-06-15. Lands Phase 0 of
[`road-to-analysis-workbench`](../../agents/roadmaps/road-to-analysis-workbench.md).
Routed through AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
two rounds, 2026-06-15).

## Context

A new `analysis-workbench` pack was proposed to close the post-incident
learning loop: structured post-mortem → root-cause analysis → corrective-action
design → memory candidates → human-gated promote. Several design questions
required council input before authoring any skill.

## Decision

### D1 — Collapse the skill set

Council converged on four skills for v1:

| Skill | Purpose |
|---|---|
| `blameless-post-mortem` | Structured post-incident review |
| `root-cause-frameworks` | RCA engine (5-whys, fishbone, fault-tree, STAMP) |
| `premortem` | Pre-launch risk elicitation |
| `decision-review` | Retrospective decision quality |

`incident-pattern-analysis` is **deferred** — it needs cross-project data the
memory layer does not yet support reliably.

### D2 — Internal-skill-heavy, not command-heavy

The pack surfaces ≤ 5 visible commands (all opt-in). Complex orchestration
lives inside skill bodies, not in a command DSL or state-machine orchestrator
(deferred).

### D3 — `/analyze` as confidence-weighted suggester, not auto-triage

`/analyze` proposes candidate flows with confidence weights. The user picks.
It does NOT auto-triage or auto-route. Selection choices are logged to the
provisional intake stream so future iterations can tune weights from real usage.

### D4 — Memory loop is manual; promote gate is inviolable

The hardest pushback in both council rounds was against any auto-promote path.
Decision: the loop produces and proposes; `scripts/check_memory_proposal.py`
is the sole admission gate (≥2 distinct paths OR ≥3 future decisions);
the human runs `/memory promote`. No skill, hook, or roadmap step may
bypass this gate. See [`analysis-memory-loop.md`](../contracts/analysis-memory-loop.md).

### D5 — AI-specific RCA deferred

AI-specific failure modes (prompt injection, model hallucination root-cause,
latency regression attribution) require `road-to-security-hardening` primitives
that do not yet exist. Deferred explicitly; `root-cause-frameworks` ships
without them.

### N1 — Time-decay is a Phase 1 hardening item (adopted)

Council named time-decay, supersession, and dedup pre-check as Phase 1 work
(not blockers for Phase 0 contract authoring). The contract captures the
schema now so Phase 1 has a stable target:

- `last_validated` + `review_after_days` + `applicable_scope` on every candidate.
- `retrieve()` returns `{results, skipped}` — stale entries are in `skipped`,
  never silently included in `results`.
- Dedup: `retrieve()` before draft; on match, propose `frequency`/`supersedes`
  update, not a new entry.

## Consequences

- Phase 0 ships two authoring artifacts: `docs/contracts/analysis-memory-loop.md`
  and this ADR. No skills, no code.
- Phase 1 (memory-loop hardening) implements the schema fields and `retrieve()`
  contract documented in `analysis-memory-loop.md` § 1 and § 4.
- The pack uses pack identifier `analysis-workbench`, `size_class: medium`,
  `cross_workspace: true`.
- Domain adoption gates do not fire: the analysis domain is already open
  (`incident-commander`, `risk-officer`, `decision-record`,
  `systematic-debugging` exist in the suite).

## Alternatives

- **Auto-promote on ≥ 2 occurrences** — rejected both rounds. Silent learning
  loop is a trust and auditability risk; human gate is non-negotiable.
- **State-machine orchestrator** — deferred. Premature before skills ship and
  real usage patterns emerge.
- **`incident-pattern-analysis` in v1** — rejected. Needs cross-project memory
  access not available in v1; deferred to a follow-up roadmap.
- **Flat command surface (>5 commands)** — rejected per command-surface-tiers
  contract; opt-in pack stays lean.

## References

- [`docs/contracts/analysis-memory-loop.md`](../contracts/analysis-memory-loop.md) — the loop contract.
- [`docs/contracts/low-impact-corpus-format.md`](../contracts/low-impact-corpus-format.md) — curated memory schema.
- [`ADR-094`](ADR-094-agent-memory-layer-removal.md) — agent memory layer decision this pack operates within.
