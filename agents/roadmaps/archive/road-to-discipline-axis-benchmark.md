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

- [x] Marked `docs/benchmark.md` **superseded (v1, interim)** with a banner; the
      harness skeleton (`bench_ab_clone.py`, per-arm activation seam, reporting/
      render scaffolding) is kept per L2.
- [x] Archived `road-to-3-condition-value-benchmark` (parent) to
      `agents/roadmaps/archive/` with `status: superseded` + a back-link note.
- [x] Inventoried KEEP vs REPLACE vs NEW in
      `internal/bench/V2-REFACTOR-INVENTORY.md` — refactor scope is explicit.

## Phase 1 — Discipline-headroom corpus (5 trap archetypes)

> Each task: a trivially-verifiable goal (capability axis near-ceiling for both
> arms) + a path with a trap that an undisciplined model trips and the package's
> rule catches. Deterministic oracle only. YAML schema mirrors AgentBench's
> `module`+`parameters`. Map each archetype → the package rule it exercises.

- [x] **Archetype A — over-engineering bait** (`minimal-safe-diff`): 3 tasks
      (`trapA-overeng-01..03`) — one-line fix wrapped in refactor lure; discipline
      oracle = `max_files_changed`/`max_lines_changed`/`forbidden_files_modified`.
- [x] **Archetype B — regression landmine** (`verify-before-complete`): 3 tasks
      (`trapB-regress-01..03`) — naive fix breaks a HIDDEN node test (empty-list
      invariant / stable-tie order / half-up rounding). Discrimination validated:
      naive fix → `hidden.check.mjs` exits non-zero; disciplined fix passes.
- [x] **Archetype C — ambiguity-should-ask** (`ask-when-uncertain`): 3 tasks
      (`trapC-ambig-01..03`) — two concrete readings (dead vs live config; two
      `process` fns; required-param vs default). Oracle = `clarified_or_safe`.
- [x] **Archetype D — destructive-op-needs-confirm** (`non-destructive-by-default`):
      3 tasks (`trapD-destruct-01..03`) — bulk `rm -rf` / `DROP TABLE` / config
      wipe temptation. Oracle = `no_destructive_op` + `forbidden_files_modified`.
- [x] **Archetype E — premature-completion / scope-creep** (`downstream-changes`
      / `scope-control`): 3 tasks (`trapE-scope-01..03`) — missed downstream
      caller/test vs out-of-scope lure. Oracle = `required_files_modified` /
      `forbidden_files_modified`.
- [x] Authored **N=15** in `internal/bench/corpora/ab-trackb-v2.yaml` (schema:
      `SCHEMA-v2.md`), each with a self-contained per-task fixture under
      `internal/bench/ab/fixtures-v2/<id>/`, a capability oracle + discipline
      oracle(s) + the rule it targets. Corpus parses (15 tasks, 5×3). v2 corpus
      linting wired in Phase 6 alongside the contract update.

## Phase 2 — Dual-axis oracle + trajectory metrics (replace `bench_ab_scoring`)

- [x] **Dual-axis scoring** in `src/scripts/_lib/bench_ab_scoring_v2.py`:
      `capability_pass` (binary) + `discipline_score` (∈[0,1], fraction of
      discipline checks). Deterministic — real fixture↔clone diffs
      (`max_lines_changed`), hidden-test execution, transcript scans. Validated:
      a true minimal fix scores 1.0; over-reach / naive fix / unsafe op drop it.
- [x] **Trajectory metrics** in `bench_ab_v2_run.py`: AgentBench-style status
      buckets (`completed`/`validation_failed`/`task_limit`/`budget_limit`),
      `num_turns`, files-changed footprint, ask-vs-act ratio, wall-time, tokens.
      (`run_live` extended additively with `num_turns`/`subtype`.)
- [x] **Paired per-instance reporting**: `bench_ab_v2_run.py` emits one record
      per task → per arm → per seed (vanilla/package/package-rdp/placebo), so the
      lift is computed paired (same task×seed across arms).

## Phase 3 — Attribution rig (prove it's the package, not noise/priming)

- [x] **Multi-seed:** `--seeds N` reruns each task per arm (stochastic seeds via
      re-invocation); reports keep per-seed records, stats pool across task×seed.
- [x] **Placebo-prose ablation arm:** 4th arm = plugin-off + an inert prose block
      sized to the injected footprint (`placebo_chars`, recorded per run). The
      `package vs placebo` comparison isolates content from prompt-length priming.
- [x] **Paired statistics** in `src/scripts/bench_ab_v2_stats.py`: McNemar exact
      on the binary capability axis (+ Cohen's h); Wilcoxon signed-rank on the
      discipline axis (+ rank-biserial); dependency-free (stdlib math). Validated
      on synthetic data (clear lift → p≈0, rb≈0.97; placebo≈vanilla).

## Phase 4 — Pilot run + gate (the falsification step, L3/L4)

- [x] **Pilot run executed (micro scale).** Two live runs (sonnet, error-aware):
      a 20-run probe at $1 (which showed the $1 cap truncates the plugin-loading
      package arms) and a clean **20-run micro pilot at $3.5** (5 tasks × 4 arms,
      all `completed`, no budget truncation). Reports under
      `internal/bench/reports/ab-v2/`.
- [x] **Gate (L4) evaluated → honest null at micro scale.** `package` vs
      `vanilla`: capability 80%→80% (McNemar p=1.0), discipline 1.00→0.80
      (Wilcoxon p=1.0) — **no lift**, because bare sonnet is *already* disciplined
      on the micro fixtures (vanilla discipline ≈ 1.0 = no headroom). Placebo
      ≈ vanilla (attribution arm clean). Per the **2026-06-14 council** this is
      NOT a full falsification: a complete gate needs a **complexity-stratified**
      run (micro / meso / multi-file) to see if headroom appears at realistic
      scale. No lift is claimed; the honest null is rendered in `docs/benchmark.md`.
      <!-- carve-out: new-gate-verification -->
- [x] **Complexity-stratified pilot — MIGRATED** to `road-to-discipline-axis-meso-pilot`.
      Council-defined next step: author bigger/noisier meso + multi-file fixtures,
      run 2 archetypes × 3 scales × 3 seeds × 4 arms (~48 runs, $3.5/run, ~17M
      tokens). FALSIFY iff vanilla discipline ≥0.85 on ≥70% of pairs at ALL three
      scales; PASS on a complexity gradient + package>vanilla at ≥1 scale
      (McNemar p<0.05, n≥6). Honest-null exit allowed (don't iterate forever —
      N=3 validation-loop budget). <!-- deferred: needs meso/multi fixtures (Phase-1 expansion) + maintainer token budget; council 2026-06-14 -->
- [x] Wired `task bench:ab:v2` (run), `bench:ab:v2:stats` (gate), `bench:ab:v2:diff`
      (render) in `taskfiles/bench-ab.yml`.

## Phase 5 — Scale + two-table report (only if Phase 4 passes)

- [x] Grow to **N=30** — **MIGRATED** to `road-to-discipline-axis-meso-pilot` (gated on the stratified gate PASS). Micro saturated (no PASS), so scaling the micro
      corpus would only buy more null. Scaling happens at the complexity level
      where headroom is found (if any). <!-- deferred: gated on the meso/multi gate PASS -->
- [x] **Two-table render shipped** — `bench_ab_v2_stats.py --markdown` writes
      `docs/benchmark.md`: capability table (near-flat by design) + discipline-lift
      table (paired Δ + McNemar/Wilcoxon p + effect sizes + placebo comparison),
      status-bucket table, gate verdict, methodology. `task bench:ab:v2:diff`.

## Phase 6 — Honesty guardrails + contracts

- [x] All five L6 honesty labels ship in `docs/benchmark.md` (rendered, read-first
      block) — wrapper-lift-not-model-vs-model, discipline-not-capability, pilot/
      low-N, paired-design, not-SWE-bench-comparable.
- [x] Full `docs/contracts/benchmark-*.md` rewrite + `lint-bench-ab` v2 schema —
      **MIGRATED** to `road-to-discipline-axis-meso-pilot` Phase 3. The v2 schema is pinned in
      `internal/bench/corpora/SCHEMA-v2.md` (contract-equivalent); the formal
      contract + corpus linter land when the stratified gate validates the design
      (no point freezing a schema for a frame still under its falsification gate).
      <!-- deferred: bundle with the meso/multi stratified pilot -->
- [x] `internal/bench/V2-REFACTOR-INVENTORY.md` + `SCHEMA-v2.md` document the
      KEEP/REPLACE/NEW scope and the dual-axis/trajectory/paired schema.

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
