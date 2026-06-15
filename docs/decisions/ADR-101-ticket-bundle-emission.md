---
adr: 101
status: proposed
date: 2026-06-15
decision: ticket-bundle-emission
supersedes: —
superseded_by: —
phase: ticket-bundles (road-to-ticket-bundles, Phase 0)
type: structural
---

# ADR-101 — Roadmaps emit durable, self-contained ticket bundles; tracker import is a projection

## Status

**Proposed** · 2026-06-15. Promote to `accepted` after the Phase-1 probes
(build pilot + transport spike) confirm the format holds.

## Context

The package separates planning concerns cleanly: roadmaps own the *what/when*
(`roadmap-writing`, `agents/roadmaps/`), ADRs own the *why* (`adr-create`,
`docs/decisions/`), and the `work_engine` (`/implement-ticket`) owns execution.
[ADR-035](ADR-035-model-capability-tiers.md) expresses the capability split
(`high→opus, medium→sonnet, lite→haiku`).

Missing is the artifact that lets an **expensive planning agent** hand a **cheap
building agent** a closed unit of work. A roadmap step is a one-line checkbox;
the full spec is spread across the roadmap, ADRs, and the code. A `high`-tier
agent holds that together; a `lite`-tier agent re-derives, drifts, or asks. The
ticket-side skills (`refine-ticket`, `estimate-ticket`, `implement-ticket`) all
operate on a ticket that already exists in a tracker; none *materialise* one.
The only Linear surface is `build_linear_digest.py` (coding *rules*, not
tickets). Assets are transient (`agents/roadmap-assets/`).

Goal: *one expensive agent plans, a cheap agent or subagent builds it* — which
requires a planning output that is a complete, portable, verifiable build spec.

## Decision

A roadmap may be **materialised** into a durable ticket bundle under
`agents/tickets/{slug}/` (Markdown tickets + durable assets + a `manifest.yml`).
Markdown is the source of truth; the tracker (Linear) is a generated projection.
Full schema + mapping: [`ticket-bundle-format`](../contracts/ticket-bundle-format.md).

The design converged across **two AI-council rounds** (2026-06-15, deep, members
`anthropic/claude-sonnet-4-5` + `openai/gpt-4o`) plus an external review pass,
reasoning from established empirical facts (Linear CSV import is create-only;
Linear GraphQL auto-uploads markdown image URLs into auth-gated storage; the
industry spec-driven-development pattern of spec→plan→isolation-testable-tasks).

- **R1 — Layout = separate `agents/tickets/{slug}/`** (not co-located). The
  flat-file dashboard/archival machinery is concrete; co-location's traceability
  gain is speculative. Discovery via a machine-generated
  `agents/tickets/_registry.yml` (no recursive glob, no roadmap↔manifest cycle).
- **R2 — Transport = GraphQL API canonical**; CSV is create-only (non-idempotent)
  → demoted to an optional one-shot bootstrap. Idempotency is **query/map-first**
  via `linear_state.linear_id` (Linear has no documented external-key upsert).
  GraphQL batch partial-failure must be resumable.
- **R3 — Explicit `manifest.yml`** carrying the acyclic `dependency_graph` and
  the `linear_state` idempotency map (without it, "idempotent re-export" is
  vaporware).
- **R4 — Risk-ordering:** two independent Phase-1 probes — 1a build-pilot (the
  premise; the gate) and 1b transport-spike. The build pilot needs no export.
- **R5 — `model_tier` per ticket**, enforced by a buildability lint
  (`lint_ticket_buildable.py`): a `lite` ticket must carry runnable,
  isolation-testable acceptance, exact paths, enforceable `boundaries`, and
  resolvable assets — else rejected or escalated to `medium`. This is the
  load-bearing guard of the expensive→cheap handoff.
- **R6 — v1 tickets are immutable** (a source change spawns a NEW bundle, no
  in-place issue update); a `linear_id` map still makes create idempotent.
  Mutable mode (+`last_synced_sha` sync) is deferred until issue bloat is proven.
- **Staleness split severity:** `adr_refs` SHA drift HARD-blocks (semantic,
  rare); `source_refs` SHA drift only WARNS (source churns constantly).
- **Boundaries enforceable:** `must_touch/may_touch/must_not_touch`, validated by
  the work_engine boundary guard before commit — prose "do not touch" does not
  bind a cheap agent.
- **Build gate is qualitative, not a hard percentage on small n.**

## Consequences

- **Positive.** A roadmap is decomposed into closed build units by one expensive
  pass; cheap agents execute them. Linear import is a one-command idempotent
  projection. Design context (screenshots, wireframes) stops being lost. The
  `model_tier` band gains operational teeth.
- **Negative / cost.** A new artifact axis (`agents/tickets/`), a contract, a
  template, a generator, two linters, and a skill to maintain. The dashboard
  scanner must learn the registry. Live Linear export needs a token.
- **Neutral.** Roadmaps remain the planning surface; tickets are an optional
  downstream materialisation. Small roadmaps need not emit tickets.

## Alternatives considered

1. **Co-located bundle under the roadmap.** Rejected (R1) — forces a migration
   of the flat-file dashboard/archival machinery for a speculative gain.
2. **CSV-first transport.** Rejected (R2) — the native Linear importer is
   create-only; re-import duplicates, making "MD is truth" a lie.
3. **Derived `_index.md` instead of `manifest.yml`.** Rejected (R3) — the
   idempotency map + dependency graph must be a persisted, validatable lock-file.
4. **Single-file tickets (no folder).** Rejected — cannot carry binary assets
   next to the spec, which the maintainer requires.
5. **Mutable tickets in v1.** Deferred (R6) — the diff/sync logic is complexity
   v1 does not need until issue bloat is observed.

## References

- [`ticket-bundle-format`](../contracts/ticket-bundle-format.md) — the full contract.
- [ADR-035](ADR-035-model-capability-tiers.md) — model_tier bands.
- `agents/roadmaps/road-to-ticket-bundles.md` — the roadmap that implements this ADR.
