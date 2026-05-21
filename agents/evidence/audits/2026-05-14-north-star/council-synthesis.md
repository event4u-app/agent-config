# Council Synthesis — North Star Direction

**Date:** 2026-05-14
**Council members:** `anthropic/claude-opus-4-1`, `openai/o1`
**Rounds:** deep (3) · **Actual cost:** $0.32 · **Estimated:** $2.26
**Inputs:** [`council-question.md`](council-question.md) (neutral, no host framing)
**Raw responses:** [`council-responses.json`](council-responses.json)

> Per `ai-council` Iron Law: the council did **not** see
> [`internal-audit.md`](internal-audit.md) or
> [`north-star-plan.md`](north-star-plan.md). Convergence below is
> independent of host framing.

---

## 1. Convergent verdict (both members)

| Theme | Opus | o1 | Strength |
|---|---|---|---|
| **Measurement first** | "60 days minimum before enforcement" | "at least one minor release before enforcement" | **Strong** |
| **Benchmark corpus** | 25 prompts, selection-accuracy + tokens + quality | 15–20 prompt corpus, automated accuracy | **Strong** |
| **Cost tracking** | #2 priority, reads session jsonl, per-model pricing | #3 priority, session-level reporting | **Strong** |
| **Linter gate** | #3, staged (critical → high → medium) | #2, quick S-effort win | **Strong** |
| **Schema rigor — minimal** | 2 fields now (`model_tier`, `## Deep Reference`), defer rest | minimal split, defer harmonist-full to contributor demand | **Strong** |
| **Compression default** | Remove until measured ≥35 % saving + <3 % quality loss | Keep off until measured ≥30–40 % saving | Strong, with severity diff |
| **Behavioural projection fidelity** | (not specifically) | #5, behaviour-diff not byte-diff | Medium |

## 2. Divergence

| Topic | Opus position | o1 position | Tie-breaker |
|---|---|---|---|
| Compression future | **Remove entirely** until proven | **Keep flag, measure**, then decide | Lean Opus — wrong-boundary measurement (F2/U1) + opt-in default = feature currently has zero proven value. Removal pending proof is cheaper than maintaining unproven feature. |
| Skill testing | Benchmark covers behaviour, no per-skill unit tests | 20 % critical-skill unit tests | Lean Opus — benchmark corpus is the behavioural test; per-skill unit tests duplicate the surface. |

## 3. New finding (not in audits, raised by council)

**Opus #5:** *"Rationalize skill inventory: 208 → ~150."*

Quote: **"208 skills for a solo maintainer is unsustainable. Neither prior reviewer caught this."**

Backed by o1: *"skill usage stats collector before deciding which to
test / migrate first. Drop or merge uncommonly used skills."*

Not in the 13 council findings. Not in `internal-audit.md` (D1 names
"too large to learn", not "rationalize"). **This is the council's
new contribution.**

## 4. Effect on the host plan

[`north-star-plan.md`](north-star-plan.md) had 4 pillars (P1–P4) and a
proposed step-2 = "Schema v2 migration (full harmonist suite)".

Council pushes back on **P3 size**: 6 phases of full schema v2 is
**over-engineered** at solo-maintainer scale. Both members independently
say "two-field minimum, defer rest". Host plan P3 must shrink.

Council **adds** an unnamed pillar: **P0 — Skill inventory rationalization**.
Solo-maintainer load argument. Belongs upstream of measurement (if you
benchmark unmaintainable surface, you measure noise).

## 5. Revised pillars (post-council)

| Pillar | Status | Change |
|---|---|---|
| **P0 — Inventory rationalization** | **NEW** | Skill-usage collector → merge / archive ~50 skills → 208 → ~150 target |
| **P1 — Measurement** | unchanged priority | Specific: 25-prompt corpus, selection-accuracy + tokens + cost, 60-day baseline before enforcement |
| **P2 — Mechanical enforcement** | sequenced AFTER P1 | Linter strict gate is the S-effort piece; runtime hooks defer until measurement baselines exist |
| **P3 — Schema rigor (minimal)** | **SHRUNK** | Only `model_tier` + `## Deep Reference`. Drop `schema_version`, `distinguishes_from`, `disambiguation`, migration registry from current scope. |
| **P4 — Adoption ramp** | unchanged | Role bundles, standalone-vs-supercharged, settings-light path |

## 6. Revised roadmap mapping

| New slot | File | Pillar | Δ from prior plan |
|---|---|---|---|
| step-1 | `step-1-v2-feedback-followup.md` | P1+P2 | unchanged |
| **step-2** | **`step-2-skill-inventory-rationalization.md` (NEW)** | **P0** | Replaces "Schema v2 migration" — council-driven new work |
| step-3 | `step-3-ai-council-consolidation.md` | P2 | rename only (was step-2) |
| **step-4** | **`step-4-measurement-and-benchmark.md` (NEW)** | P1 | Same intent, refined scope (25 prompts, cost-tracker, 60-day baseline) |
| **step-5** | **`step-5-minimal-schema.md` (NEW)** | P3 | Replaces full schema-v2; just `model_tier` + `## Deep Reference` |
| step-6 | `step-6-test-cleanup.md` | P2 | renumbered (was step-5) |
| step-7 | `step-7-agent-user-persona.md` | P4 | renumbered (was step-3) |
| step-8 | `step-8-ghostwriter.md` | P4 | renumbered (was step-4) |
| step-9 | `step-9-user-types-axis.md` | P4 | renumbered (was step-6) |

Three new roadmap files. Six renames. Zero deletions.

## 7. Compression decision — host verdict

Council split is real (Opus = remove, o1 = measure-then-decide). Host
verdict: **measure-then-decide**, but with an explicit kill-criterion.

- Until `task bench` produces a number, `caveman.speak_scope` stays
  default off; carve-outs documented but feature non-promoted.
- After 60-day baseline: if measured saving < 30 %, **deprecate**
  per Opus reasoning (wrong-boundary + unproven).
- After 60-day baseline: if measured saving ≥ 30 % with <5 %
  quality regression on the corpus, **flip default on** with
  caveman-style carve-outs (security / destructive / multi-step).

This is decision-deferred-with-criterion, not decision-skipped.

## 8. Acceptance gates (revised)

| Gate | Replaces | Pass criterion |
|---|---|---|
| **G0 — sustainable surface** | (none) | Skill count ≤ 160, usage data collected for ≥ 30 days, archive notes for every removed skill |
| G1 — measured savings | unchanged | `task bench` numeric table per release |
| G2 — enforced laws | linter scope only | `task ci:strict` blocks tag push on linter WARN > 0; runtime hooks **deferred** until after measurement baseline |
| G3 — typed schema (minimal) | shrunk from full v2 | 100 % skills declare `model_tier`; ≥ 80 % skills > 80 lines use `## Deep Reference` |
| G4 — adoption ramp | unchanged | Role bundles install; standalone-vs-supercharged table on every skill |

All five green = v3.0.0 tagged "Senior-Dev Bar reached".

## 9. Next actions

In strict order:

1. **Stop and report to user** with this synthesis. Confirm new pillar
   set + roadmap mapping before touching `agents/roadmaps/`.
2. On approval: `git mv` six existing roadmap files into the new slots.
3. Draft three new roadmap files (`step-2-skill-inventory-rationalization`,
   `step-4-measurement-and-benchmark`, `step-5-minimal-schema`) using
   `roadmap-writing` skill.
4. Regenerate `roadmaps-progress.md`; verify `task ci` green.
5. Commit in three chunks: (a) audit + synthesis deliverables;
   (b) roadmap renames; (c) new roadmap drafts.

Stopping at step 1. User signal needed before mutating the roadmap tree.
