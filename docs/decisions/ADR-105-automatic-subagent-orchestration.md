---
adr: 105
status: accepted
date: 2026-06-23
decision: automatic-subagent-orchestration
supersedes: —
superseded_by: —
phase: auto-subagent-orchestration
type: structural
---

# ADR-105 — Automatic subagent orchestration: activate-don't-fragment, prove before default-on

## Status

**Accepted** · 2026-06-23. Resolved by a deep AI-council round
(claude-sonnet-4-5 + gpt-4o, design mode) plus host critical-evaluation, and
implemented by `road-to-auto-subagent-orchestration.md`.

## Context

The package shipped three latent subagent surfaces — the
`subagent-orchestration` skill (7 modes), `/orchestrate` (YAML pipelines), and
the RDP `reasoning-orchestrator` ("dispatch by default") — all **opt-in**,
none firing automatically. The goal: make subagent use automatic and
settings-gated, so an orchestrating model delegates delegable sub-tasks to
cheaper / faster / quota-separate subagents, each configured for its task,
globally toggleable in `.agent-settings.yml`.

The user's stated default was **on**. The council pushed back hard: a "default
on" whose own design concedes it *may increase* token spend inverts risk in a
package whose canon includes token-efficiency as an Iron Law, and whose
multi-tool portability constraint means not every host even has a subagent
primitive.

## Decision

1. **Activate, don't fragment.** Auto-dispatch is a settings + host-manifest
   gate over the **existing** `subagent-orchestration` skill and RDP
   "dispatch by default" — not a new parallel rule. Smallest surface.
2. **Conservative-until-proven shipped default.** The full toggle ships now
   (`subagents.enabled`, `subagents.auto: off|ask|on`), but the **shipped**
   default is `ask` on hosts whose capability manifest reports
   `subagent_spawn: true`, `off` elsewhere. The default flips toward `on`
   (host-gated) **only** behind a real benchmark proving a net token-or-time
   win at held quality (Phase 6). `on` is the destination, reached by
   evidence — the reconciliation of the user's goal with the council's
   prove-first.
3. **Quota arbitrage is a runtime-detected bonus, never load-bearing.** The
   "separate quota pool" (e.g. a subscription's distinct Sonnet allowance) is a
   `host-capability-manifest` flag; routing is identical (minus the bonus)
   where unsupported. No `.md` names a vendor's billing rule.
4. **Deterministic classification v1.** Delegability is decided by enumerated
   structural signals (frontmatter `parallelizable:`, ordered-plan,
   independent-slices, a size floor); ambiguity defaults to ask/no-op, never
   speculative spawn. No per-turn LLM meta-call in v1. LLM classification is
   deferred to v2+, gated on the benchmark.
5. **Verification budget preserves the floors.** Trivial/read-only sub-tasks
   verify deterministically; non-trivial mutating sub-tasks get a full
   cross-model judge (the `subagent-orchestration` Iron Law). A required
   verification recorded as `none` is a surfaced safety gap.
6. **Instrumentation first; kill-switch + surfaced guardrails.** Orchestration
   telemetry rides additively on `audit-log-v1`. The kill-switch is a
   single settings flip (`enabled: false` / `auto: off`). Rollback thresholds
   (token blowup, spawn-failure, verify-skip, override rate) are surfaced from
   the audit log — there is no automatic cohort-disable (a config package runs
   no daemon).
7. **Graceful host degradation.** Where the manifest reports
   `subagent_spawn: false`, the whole layer is a clean no-op (single-agent),
   surfaced explicitly. `.md` artefacts stay project-agnostic.

## Consequences

- Auto-dispatch is the default **where the host and settings allow it**, and a
  no-op everywhere else. No safety floor is lifted.
- The user's "default on" is an evidence-gated milestone, not assumed — the
  one decision left for the user is to authorise/run the Phase-6 benchmark and
  approve the default flip.
- The implementation is mostly contexts + small pure helpers + a settings
  block + two activated skills, keeping the diff minimal.

## Alternatives considered

- **Default `on` immediately** (the literal ask) — rejected: inverts risk
  before measurement, against the frugality canon.
- **New parallel auto-dispatch rule** — rejected: fragments a surface that
  already exists; activation is the smaller change.
- **Quota arbitrage as a core motivation** — rejected: vendor-specific,
  fragile, violates portability; demoted to a runtime bonus.
- **Council-strict default `off` forever** — rejected: forecloses the user's
  goal; the benchmark gate is the middle path.

## References

- The auto-subagent-orchestration roadmap (now archived) + the
  full council Convergence / Host verdict.
- [`docs/contracts/auto-orchestration-v1.md`](../contracts/auto-orchestration-v1.md) — the manifest + spawn + telemetry contract.
- Context docs under `src/agent-src/contexts/execution/`:
  `host-capability-manifest`, `orchestration-telemetry`,
  `auto-orchestration-activation`, `auto-dispatch-classification`,
  `subagent-routing`, `subagent-spawn-contract`, `verify-budget`,
  `subagent-steering`, `orchestration-benchmark-gate`.
