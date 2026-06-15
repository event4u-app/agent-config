---
complexity: structural
status: ready
parent_roadmap: road-to-discipline-axis-meso-pilot
---

> Blocked on a maintainer go-ahead for the billable run. The non-saturation
> baseline probe (Phase 1c) is cheap (~3-5M tokens) and gates the larger run.

# Roadmap: capability-headroom benchmark (v3) — GAIA-honest, can it finally show a lift?

The v2 discipline-axis benchmark **saturated** (every arm ≈ 1.0) across both
hosts and both scales — three measurement confounds found+fixed (budget
truncation, plugin-hook artifact, prompt-coaching), but the root cause is
structural: **deterministic small-task discipline-traps don't trap a capable
model**. So we still do NOT know if the package helps.

The maintainer's observation: **GAIA** stays honest (~41.5% for GPT) because its
tasks are genuinely HARD (long, multi-step, single verifiable answer) → baseline
fails ~60% → real headroom. A benchmark with headroom can finally answer
"is the package better?" in either direction.

## Council verdict (2026-06-15, claude-sonnet-4-5 + gpt-4o, 2 peer-reviewed rounds)

- **Axis = capability-headroom (GAIA-style), discipline SECONDARY.** Both members
  converged: multi-step discipline-traps would re-saturate (capable models adapt;
  explicit workflow steps re-coach scope). Measure **solve-rate** on hard tasks;
  measure discipline only as a secondary artifact-bloat metric on SOLVED tasks.
- **Honesty locks (all four):** (1) NOVEL / non-memorized tasks (GAIA's public
  answers are in training data → inflated baseline); (2) keep the **placebo arm**
  (lift must beat equal-length inert prose, else it's just "more context");
  (3) **deterministic oracle** (normalized exact-match / hidden-test-passes — no
  LLM judge); (4) **bound cost** (long-chain tasks are token-heavy).
- **Valid-claim test (Q4):** a governance package must not be sold as making the
  model smarter. A solve-rate lift is honest ONLY if framed as **"better
  decomposition / fewer careless dead-ends over a long chain → higher solve-rate
  WITHOUT artifact bloat"**, attributed via: solve-rate lift package>placebo
  (rules out more-context) AND no artifact-bloat increase on solved tasks (rules
  out try-everything). Framing: **"improves solution efficiency, not intelligence."**

## Phase 1 — Hard novel corpus (non-saturating baseline)

- [x] Archetype = **hard code debugging + verify** (most tractable in our neutral
      sandbox; oracle = a HIDDEN test passes — reuse `bench_ab_scoring_v2.hidden_test`).
      The bug must be subtle enough that bare sonnet fails ~30-70% (edge-case /
      off-by-one-in-a-complex-invariant / state / concurrency-ish logic).
- [x] Authored **9 novel hard tasks** (capH-debug-01..09), hidden solve.check.mjs verified. (3 difficulty bands × 3), each a
      self-contained multi-file fixture with a hidden verifying test; NO prompt
      coaching; single deterministically-checkable outcome.
- [x] Secondary discipline metric = max_files/lines (bloat). = artifact-bloat ratio (lines/files
      changed vs a minimal-fix reference) recorded on SOLVED tasks only.

## Phase 1c — Non-saturation baseline probe (cheap, runs FIRST, gates everything)

- [x] Ran vanilla-only sonnet, 9 tasks. **Baseline = 8/9 = 89%** — only
      capH-debug-08 (right-assoc exponentiation + unary minus) fails. **ESCALATE:**
      hard *self-contained* code bugs leave almost no headroom on Sonnet (1/9 is
      too little for paired stats); GAIA's 41% headroom needs long tool-using /
      research chains, not single-file logic.

## Conclusion (2026-06-15) — honest bottom line, escalated

Across **v1 (binary), v2 (discipline, haiku+sonnet, micro+meso), v3 (capability,
hard debug)** the finding is consistent: **on deterministic, self-contained tasks
— the only class we can cheaply build — capable models (haiku AND sonnet) are at/
near ceiling in BOTH capability (89% on hard bugs) and discipline (≈100%). No
headroom → no measurable package lift reachable there.** Not "the package is
useless" — its value (governance, safety floors, consistency over long agentic
runs) lives where a short deterministic benchmark cannot reach. GAIA stays honest
(~41%) via long tool-using/research chains; reproducing that needs real agentic
infrastructure (a separate large investment). Escalated (no further iteration per
the N=3 validation-loop budget): (A) accept this honest conclusion + stop, or
(B) invest in agentic GAIA-class infra (new roadmap).

## Phase 2 — 4-arm run + attribution

- [-] Run vanilla / package / package-rdp / placebo × the corpus × ≥3 seeds,
      budget-capped, error-aware. Primary = solve-rate (McNemar paired);
      secondary = artifact-bloat on solved tasks (Wilcoxon). <!-- cancelled: Phase 1c gate showed 89% baseline / no headroom → 4-arm run cannot reach a measurable lift; honest null accepted (maintainer, 2026-06-15) -->
- [-] PASS = package solve-rate > placebo (p<0.05, ≥6 discordant pairs) AND no
      bloat increase. Else honest null. Cost reported per arm (L10). <!-- cancelled: no non-saturating baseline to run against; honest null accepted (maintainer, 2026-06-15) -->

## Phase 3 — Render + resolve + scale

- [-] Extend the render: Table 1 = solve-rate (the lift), Table 2 = artifact-bloat
      (secondary), Table 3 = cost. Honesty labels + "efficiency not intelligence"
      framing. Scale N only if Phase 2 shows a lift. <!-- cancelled: depends on Phase 2 which is cancelled; honest null accepted (maintainer, 2026-06-15) -->

## Acceptance criteria

- A baseline that does NOT saturate (solve-rate well below 100% on bare sonnet) —
  without this, scrap the capability frame too and report that honestly.
- Solve-rate lift attributed (package>placebo, no bloat) or an honest null.
- Novel tasks, deterministic oracle, placebo arm, ≥6 discordant pairs for any
  significance claim, cost per arm, "efficiency not intelligence" framing.
