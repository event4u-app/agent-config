# Scale & history bench — pre-registration (fixed before any scored data)

> road-to-scale-and-history-discipline Phase 4. Design parameters fixed
> 2026-07-27 from the roadmap's council convergence (2026-07-27 debate,
> 2 members, 2 rounds — waiver-model terminology, power analysis, manual
> rubric primacy, legitimate-sync distractor). This file is committed
> BEFORE the first scored run; any later change to a threshold is a
> protocol amendment visible in git history, never a silent retrofit.
> Extends the existing bench family (`internal/bench/` harness +
> `corpora/` pattern) — not a subsystem.

## What is measured

Whether the `scale-discipline` / `history-discipline` packs change agent
persistence-code quality — in EITHER direction. External evidence (an
external 2026 agent-DDL benchmark; identity in the local inbox archive per
`source-confidentiality`) shows skill files move output quality **both
ways** per model family; regression in any family is reported, never
averaged away.

## Task (fixed)

Agent builds a small SaaS admin module on the seeded schema
(`internal/bench/scale-history/seed-schema.sql`):

- CRUD for `projects` (tenant-scoped) + a **list endpoint**;
- an **audit requirement**: "record who changed what and when on projects";
- the mandated side effect (**F9/F10/F11 honeypot**): "notify the owner by
  email on status change" — does the agent inline it, fire-and-forget it,
  or queue it durably after commit?
- the **legitimate-sync distractor** (council round 2): "on create,
  validate the project key against the internal registry service (P99
  40ms) and reject invalid keys in the same response" — work that must
  NOT be queued; queueing it (or waiving it away) scores as
  over-application.

## Arms (3) × model families (≥2)

| Arm | Pack surface |
|---|---|
| A `no-packs` | Neither pack loaded |
| B `advisory` | Packs loaded, `lint_persistence` findings shown as advice, never blocking |
| C `gating` | Packs loaded, gate-tier findings block completion until fixed or waived-with-reason |

Per family × arm: N per the power analysis below. Results reported PER
FAMILY; no cross-family averaging.

## Power analysis (binding, council round 1)

Primary metric = total gate-class defect count per run (F1, F2, F3, F6,
F7, F9, F11 — count data). Test: two-sample Poisson rate comparison
(A vs C) per family. Assumed baseline rate λ_A ≈ 4 defects/run (from the
FP-verification pass: an unguided mature codebase averaged >1 R-A2 gap
per 70 files; a fresh scaffold task plausibly seeds ~4 gate defects —
assumption stated, not data). To detect a 50% reduction (λ_C = 2) at
α = 0.01 with power 0.8, the Poisson rate test needs **N ≈ 16 runs per
arm per family** (var = mean; delta = 2, SE at N=16 ≈ 0.61, z ≈ 3.3).
**Registered N = 16 per arm per family** (not the N=10 floor — the floor
was underpowered at p<0.01, exactly the council's round-1 objection).
If spend authorization caps N below 16, the achievable α is recomputed
and REGISTERED BEFORE the run — never post-hoc.

## Scoring (manual rubric is PRIMARY)

1. **Independent manual rubric** (`internal/bench/scale-history/rubric.md`)
   scores each artifact per failure class — the primary defect count.
2. `lint_persistence` runs as SECONDARY verification; its recall/precision
   against the rubric is itself a reported outcome (the linter never
   grades its own homework as the primary signal).
3. **Correctness dominates**: an arm that queues everything but loses the
   email on redeploy (no durable queue / no afterCommit) scores WORSE than
   inline-sync. The distractor scores over-application symmetrically.
4. Audit coverage % (R-B1 against the task's declared audit scope).
5. Token overhead + wall-clock per arm.

## Binding thresholds

1. **Publish lift only if** Δ(defects A→C) is significant at the
   registered α (0.01 at N=16) in at least one family AND token overhead
   ≤ 1.3× baseline. Otherwise: honest null, packs stay default-off,
   roadmap re-scoped.
2. **Regression guardrail:** any family where arm B or C shows MORE
   defects than arm A (the skill-file regression effect) is headline-
   reported; a reproduced regression in any family blocks any launch
   claim regardless of other families' lift.
3. **Over-application guardrail:** if arm C queues the legitimate-sync
   distractor in >20% of runs, R-A8's catalog/prompt surface is defective
   — reported as a design finding against the pack, not hidden.

## Run gate (binding)

The first PAID scored run requires the standing benchmark-spend
authorization (blocker carried from the council roadmap). Until then this
pre-registration + the harness + rubric are committed, runnable
infrastructure; the dry smoke path (`--dry` on a committed sample
artifact) is the only thing that executes.
