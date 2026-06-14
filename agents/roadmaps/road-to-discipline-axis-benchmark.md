---
complexity: structural
status: ready
parent_roadmap: road-to-3-condition-value-benchmark
---

# Roadmap: discipline-axis benchmark (v2) — measure the lift, not the capability

<!-- check-refs: skip --> <!-- dense with external-repo file citations (SWE-bench / GAIA / AgentBench) from the deep-dive; those paths intentionally do not resolve in this repo -->

> **Complexity:** structural — replaces the corpus + oracle + metrics of the
> `bench:ab` harness (keeps the isolation seam, clone, and reporting skeleton)
> with a discipline-headroom design. Supersedes
> `road-to-3-condition-value-benchmark` (the binary-capability frame whose live
> run came back a useless flat 100% in every arm). Council-ratified twice
> (2026-06-14): first session voted **scrap** the binary frame; the second,
> after a 4-repo deep-dive (SWE-bench, GAIA, AgentBench, ai-agent-benchmark),
> voted **reverse the scrap and rebuild around a discipline axis** — both
> members, 2 peer-reviewed rounds.

## Why v1 failed (the locked diagnosis)

The v1 value benchmark used a **single binary deterministic pass/fail oracle**
on a capable host (`claude-sonnet-4-6`). Both arms (with / without the package)
solved the easy tasks → **100% everywhere → zero headroom → no signal.** The
oracle measured *capability* (shared by both arms), never the package's
*discipline*. The first council scrapped it; its "would change my mind"
condition was *a task where vanilla reliably fails, the wrapper fixes it, and a
deterministic oracle attributes the delta to discipline (not variance), under
budget.* The 4-repo deep-dive supplied exactly that mechanism.

## Evidence base — what the 4 repos gave us (verbatim-cited deep-dive, 2026-06-14)

- **GAIA** (`gaia-agent` + GAIA paper `arxiv 2311.12983`): headroom comes from
  **execution discipline over a long chain**, not concept difficulty — answer is
  a trivially-checkable factoid, but every step on the path must be right
  (humans ~92%, GPT-4 ~15%). Failures are discipline failures (single-source
  acceptance, skipped verification, format violations). GAIA's own
  `docs/improving-gaia-scores.md` shows **governance prose lifting a fixed
  model** — a working proof that a "wrapper" moves the score. Free normalized
  exact-match oracle. **Adopt:** discipline-headroom task shape; cheap
  deterministic oracle; step/tool-count as a difficulty knob. **Reject:**
  bidirectional-substring oracle (masks format discipline), heavy live-web tool
  stack (nondeterminism), public-answer memorization risk.
- **SWE-bench** (`swebench/harness/grading.py`, `test_spec/python.py`,
  `reporting.py`): held-out test oracle the agent never sees; **F2P** (achieve
  goal) vs **P2P** (break nothing); pinned `git reset --hard base_commit` +
  future-commit scrub; patch-apply fallback with structured failure codes;
  per-instance id-list reporting. **Adopt:** recast **F2P = capability axis**
  (near-ceiling, saturates) and **P2P-analog = discipline axis** (regression +
  scope/no-touch guards) → **lift = paired Δ(discipline axis)**; the pinned
  reset-fixture + future-leak scrub; **paired per-instance reporting** (McNemar,
  power at small N). **Reject:** binary `resolved=(f2p==1 and p2p==1)` verdict;
  hard real-OSS corpus + 120GB Docker matrix + issue-comprehension difficulty
  (all measure capability, the thing to avoid).
- **AgentBench** (`src/client/{task,agent}.py`, `src/typings/status.py`,
  `src/server/tasks/{dbbench,os_interaction,knowledgegraph}/task.py`):
  **client/server isolation** = the package-injection seam (wrapper only
  agent-side, environment+oracle byte-identical across arms); multi-turn
  `max_round` loop = the headroom engine (errors compound); **`SampleStatus`
  trajectory buckets** (`agent invalid action`, `validation failed`, `context
  limit`, `task limit reached`) = a direct deterministic discipline metric;
  state-oracles (check-script exit code, table-hash) over text-match; graded F1
  for smooth headroom; clean `module`+`parameters` YAML task schema. **Adopt:**
  the trajectory buckets as the discipline metric; the multi-turn loop; the YAML
  task schema; state-oracles. **Reject:** Docker-per-environment fleet
  (overkill/cost), the 8 capability-heavy environments, adversarial/stochastic
  envs (variance swamps small lift).
- **`murataslan1/ai-agent-benchmark`**: 4 files, **0 lines of code**, a
  marketing listicle of model-vs-model leaderboards. **Rejected wholesale** —
  no schema, no oracle, no harness; it measures the exact capability axis we
  must avoid. Nothing adopted.

## Locked decisions (council, 2026-06-14, second session — both members, 2 rounds)

- **L1 — Reverse the scrap.** The discipline-axis + trajectory-scoring design
  overcomes the v1 load-bearing objection: it measures *process discipline*
  (where governance rules have mechanical purchase), not *capability* (where
  both arms saturate). Ratified by both members.
- **L2 — Refactor-in-place, not delete-and-rebuild.** The isolation seam
  (per-arm activation), clone machinery, and paired-arm reporting are
  architecture-correct and stay. Only the **corpus + oracle + metrics** —
  built for the binary-capability frame — are replaced. Faster, preserves the
  fixture + CI wiring + contracts.
- **L3 — Pilot-first is mandatory (the key refinement).** Before scaling, a
  pilot (N=15, 3 seeds) must empirically prove the discipline axis does not
  *itself* saturate. gpt-4o's load-bearing caveat: the design is theoretically
  sound but unproven until pilot data shows the traps aren't trivially solved.
- **L4 — Success criterion corrected (category-error fix).** Success =
  **statistically significant paired lift on ANY axis** (binary McNemar /
  trajectory Wilcoxon / status-bucket rates), across seeds. **NOT** "vanilla
  must fail ≥80%" — demanding a high absolute baseline-failure rate is a
  category error that would reject even GAIA. A task where vanilla=60% /
  wrapper=90% (Δ=+30pp, p<0.01) is a perfect discipline-headroom task.
- **L5 — Attribution rigor.** Paired per-instance design; ≥3 seeds; an
  **equal-length placebo-prose ablation arm** (so a measured lift can't be
  dismissed as prompt-length priming rather than the package's actual rules).
- **L6 — Honesty guardrails non-negotiable.** Every table ships labels: (1)
  "wrapper-lift on host `<model>` @ `<config>`, NOT model-vs-model"; (2)
  "discipline axis, not capability"; (3) low-N / pilot status; (4) the seeds +
  paired-stat used; (5) "not comparable to SWE-bench/GAIA scores."

## Phase 0 — Supersede v1, keep the skeleton

- [ ] Mark `docs/benchmark.md` (the flat-100% v1 result) **superseded — see
      road-to-discipline-axis-benchmark; v1 measured capability and saturated**;
      do NOT delete the harness skeleton (`bench_ab_clone.py`, the per-arm
      activation seam, `reporting`/render scaffolding stay per L2).
- [ ] Archive `road-to-3-condition-value-benchmark` (parent) once this roadmap
      is accepted, with a back-link note that v2 supersedes it.
- [ ] Inventory exactly which v1 pieces are KEPT (isolation seam, clone,
      paired reporting) vs REPLACED (corpus, `bench_ab_scoring`, render tables)
      so the refactor scope is explicit before any code moves.

## Phase 1 — Discipline-headroom corpus (5 trap archetypes)

> Each task: a trivially-verifiable goal (capability axis near-ceiling for both
> arms) + a path with a trap that an undisciplined model trips and the package's
> rule catches. Deterministic oracle only. YAML schema mirrors AgentBench's
> `module`+`parameters`. Map each archetype → the package rule it exercises.

- [ ] **Archetype A — over-engineering bait** (rule: `minimal-safe-diff`): a
      one-line fix surrounded by refactor lure. Discipline oracle = diff
      footprint vs a minimal-diff gold; capability oracle = the one-line fix
      lands.
- [ ] **Archetype B — regression landmine** (rule: `verify-before-complete`):
      a change that breaks a **hidden** test unless the agent verifies.
      Discipline oracle = hidden-test (P2P-analog) stays green.
- [ ] **Archetype C — ambiguity-should-ask** (rule: `ask-when-uncertain`):
      genuinely underspecified task; acting immediately produces a
      deterministically-wrong artifact. Discipline oracle = asked-before-acting
      (trajectory) OR produced the safe interpretation.
- [ ] **Archetype D — destructive-op-needs-confirm** (rule:
      `non-destructive-by-default`): task tempts a bulk delete / prod-shaped op.
      Discipline oracle = no destructive op without the guard / confirmation
      marker.
- [ ] **Archetype E — premature-completion / scope-creep** (rule:
      `downstream-changes` / `scope-control`): a fix that needs a caller/test
      updated too (or must NOT touch out-of-scope files). Discipline oracle =
      downstream updated AND out-of-scope files untouched.
- [ ] Author **3 tasks per archetype = N=15 pilot set**, each with: pinned
      neutral fixture (`git reset --hard` + future-leak scrub, SWE-bench-style),
      capability oracle, discipline oracle(s), and the rule it targets. Lint
      passes (`lint-bench-ab` extended for the new keys).

## Phase 2 — Dual-axis oracle + trajectory metrics (replace `bench_ab_scoring`)

- [ ] **Dual-axis scoring per task:** `capability_pass` (goal achieved,
      expected near-ceiling both arms) + `discipline_score` (regression/scope/
      format/verification oracles — the headroom axis). No LLM judge; all
      deterministic.
- [ ] **Trajectory/process metrics** (AgentBench `SampleStatus`-style, parsed
      from the `--print` transcript / exit + our hooks): status buckets
      (`invalid_action`, `validation_failed`, `context_limit`, `task_limit`),
      step-count, tool-footprint, diff-footprint, ask-vs-act ratio. Each a
      per-arm, per-task number.
- [ ] **Paired per-instance reporting** (SWE-bench id-list style): emit
      per-task paired records (vanilla vs package vs placebo) so lift is
      computed paired, not as two independent rates.

## Phase 3 — Attribution rig (prove it's the package, not noise/priming)

- [ ] **Multi-seed:** run each task ≥3 seeds per arm (vary the seed/prompt-nonce
      by index); report per-seed + pooled.
- [ ] **Placebo-prose ablation arm:** a 4th arm = host + an equal-length block
      of inert prose (matched token budget to the package's rule corpus) so a
      measured lift can't be attributed to mere prompt length.
- [ ] **Paired statistics:** McNemar on the binary capability axis; Wilcoxon
      signed-rank on continuous discipline/trajectory metrics; report p-values +
      effect sizes (Cohen's h / rank-biserial), not just means.

## Phase 4 — Pilot run + gate (the falsification step, L3/L4)

- [ ] Run the **N=15 pilot, 3 seeds, 4 arms** (vanilla / package / package+RDP /
      placebo) under a tight `--max-budget-usd` + step cap; sonnet-pinned;
      error-aware (rate-limit/timeout excluded). Record host + config + seeds.
- [ ] **Gate (L4):** **PASS** if any axis shows significant paired lift
      (McNemar p<0.05 on binary, OR Wilcoxon p<0.05 on a trajectory/discipline
      metric, OR a significant status-bucket-rate reduction) that **replicates
      across the 3 seeds**. **FALSIFY** only if p>0.05 AND trivial effect size on
      **all** axes across all seeds → then the v1 scrap stands and v2 is
      abandoned (document why, archive). Surface the pilot result for maintainer
      decision before scaling. <!-- carve-out: new-gate-verification -->

## Phase 5 — Scale + two-table report (only if Phase 4 passes)

- [ ] Grow to **N=30** (5 archetypes × 6) for the headline; re-run 3 seeds /
      4 arms within budget (~$18 envelope per the council estimate).
- [ ] Render **two tables** into `docs/benchmark.md`: Table 1 = capability axis
      (expected near-flat, by design) + **Table 2 = discipline-lift** (paired Δ
      per metric, with p-values + effect sizes + the placebo column). Per-archetype
      and per-seed breakdowns below.

## Phase 6 — Honesty guardrails + contracts

- [ ] Ship all five L6 labels/banners in `docs/benchmark.md` and the render.
- [ ] Update `docs/contracts/benchmark-*.md` (ab-contract, corpus-spec,
      report-schema) for the dual-axis + trajectory + paired-stat shape;
      `lint-bench-ab` enforces the new schema. <!-- carve-out: new-gate-verification -->

## Acceptance criteria

- The **discipline axis is non-saturated** in the pilot (Phase 4 gate passed)
  — without this, v2 is abandoned and v1's scrap stands (honest exit).
- 5 trap archetypes, ≥3 deterministic-oracle tasks each (pilot N=15 → headline
  N=30), each mapped to the package rule it exercises; `lint-bench-ab` green.
- Dual-axis scoring (capability near-ceiling + discipline headroom) + trajectory
  buckets + paired per-instance reporting.
- Attribution proven: ≥3 seeds, placebo-prose ablation arm, McNemar/Wilcoxon
  p-values + effect sizes — lift attributable to the package, not length/noise.
- Two-table report with all five honesty labels; no model-vs-model or
  SWE-bench-comparable claim.
- The real-numbers pilot/headline runs are the only billable steps; everything
  else verifies cost-free.
