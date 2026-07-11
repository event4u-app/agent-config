---
adr: 119
status: accepted
date: 2026-07-12
decision: global-knowledge-default-on
supersedes: 103
superseded_by: —
phase: opt-decision-flips
type: structural
---

# ADR-119 — Global knowledge sharing defaults ON (validated bounded-downside flip)

## Status

Accepted (2026-07-12). Supersedes ADR-103.

## Context

ADR-103 (2026-06-16) kept `knowledge.global_sharing.enabled: false` until
cross-project reuse was measured across ≥ 2 projects. Verified state at
re-evaluation (2026-07-11): the measurement instrument
(`src/scripts/_lib/knowledge_global_promote.ts`) shipped, but no sightings
data, no global store, and no reuse record existed — reuse can only accrue
while the layer is ON, and ON was withheld pending reuse. The gate could
never fire by construction: the same self-locking-measurement deadlock
ADR-117 broke for `subagents.auto` on 2026-07-09.

A two-round AI-council re-evaluation ran on 2026-07-11 (members:
anthropic/claude-sonnet-4-5, openai/gpt-4o; cost $0.10). Round 1: both
members stanced **Option A — flip ON now** (deadlock + ADR-117 precedent +
shipped guards). Round 2 dissent (gpt-4o): the redaction floor was
unvalidated for cross-project adversarial scenarios — composite inference,
homoglyph/encoding smuggling, temporal context collapse. The named
evidence-that-would-change-my-mind: demonstrating the redaction mechanism
handles those classes. Convergence: **flip WITH validation** — the dissent
becomes a pre-flip gate, not a blocker.

## Decision

1. **Pre-flip validation executed (2026-07-12).** Adversarial spot-check in
   `tests/scripts/_lib_knowledge_global_redaction_adversarial.test.ts` +
   `tests/fixtures/global-knowledge-redaction/` covering the three named
   classes. Honest result: the zero-width-smuggling probe FAILED on first
   run — the dissent's predicted gap was real. Closed by an additive
   hardening in `knowledge_global_redaction.ts` (`hidden_unicode` violation
   class + strip-then-rescan); homoglyph emails were already caught
   (Unicode-aware pattern); temporal collapse is bounded by the freshness
   state machine (fresh → hypothesis → stale). All 20 tests green,
   including the 11 pre-existing parity tests.
2. **`knowledge.global_sharing.enabled` defaults to `true`** in the shipped
   template.
3. **Narrowest tier default:** `allowed_tiers: [public]` (down from
   `[public, vendor]`); `vendor` becomes a deliberate opt-in widening.
   `proprietary` stays hard-coded manual-only in the gate.
4. **Pre-registered demotion trigger:** any cross-project PII/secret
   sighting in a shared card — a confirmed identifier that crossed a
   project boundary despite the gate — auto-reverts the shipped default to
   `false` and lands an incident note under `agents/settings/contexts/`.
   This is the ADR-117 demotion-gate pattern applied to knowledge sharing.
5. **Measurement window:** 60–90 days from release. The reuse data the
   ADR-103 gate wanted now accrues; at window end the default is either
   confirmed (reuse observed, no incidents) or reverted (no reuse — the
   layer is dead weight — or a demotion trigger fired).
6. **Accepted residual, pinned by test:** k-anonymity over pure
   quasi-identifier combinations is out of scope for a write-time text
   gate. The council accepted this on the single-install trust boundary
   (an actor with filesystem access to the global store already reads the
   raw projects, which are strictly more sensitive). The boundary is
   asserted by a dedicated test so any future change to it is a deliberate
   decision, not drift.

## Consequences

- Cross-project knowledge cards flow by default on the narrowest tier,
  through the unchanged suggest-then-confirm promotion flow
  (`auto_promote_threshold` gates a suggestion, never a silent write) and
  the hardened redaction gate (halt-and-surface, never silent-rewrite).
- Single-key revert: `knowledge.global_sharing.enabled: false` fully
  no-ops the layer; v1 project-local cards are unaffected either way.
- No new infrastructure: file-first store, no vectors, no services — the
  ADR-094 Layer-2 sunset is untouched.
- The hidden-unicode hardening also protects every other consumer of
  `redaction_scan` (the Phase-4 CI linter over committed global cards).

## Alternatives considered

- **Keep OFF + opt-in campaign (Option B):** rejected — self-selection
  bias, slow, and it retains the deadlock for everyone who does not
  opt in.
- **Maintainer-org pilot first (Option C):** rejected as the primary path —
  the council judged the guarded flip's downside bounded enough that a
  pilot's extra latency buys little; the demotion trigger plus the
  measurement window deliver the same safety net in production shape.

## References

- ADR-103 (superseded), ADR-117 (deadlock-flip precedent), ADR-100/-094
  (store shape + Layer-2 sunset).
- Council session 2026-07-11 (claude-sonnet-4-5 + gpt-4o, 2 rounds,
  convergence inlined above per `no-roadmap-references`).
- `tests/scripts/_lib_knowledge_global_redaction_adversarial.test.ts` —
  the validation gate.
- `agents/roadmaps/road-to-opt-decision-flips.md` Phase 1 (execution).
