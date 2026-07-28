# Memory FTS5 replay — 2026-07-27

Rollback-trigger measurement for the memory FTS5 index (road-to-reachable-code-memory Phase 6 item 2 / ADR-129). Compares the substring `_score` fallback against the persisted FTS5 index over a fixed 24-query set of real `agents/memory/*.yml` entry ids.

## Comparability note

Both cited artefacts were measured over internal/bench/second-brain/retrieval-store/ (engineered needed+distractor fixture). This replay runs over the real agents/memory/ corpus (no engineered distractors) with a DIFFERENT query set (real entry ids, not curated needed/distractor tasks) — the numbers above are NOT directly comparable to either cited artefact. They are cited per ADR-129's instruction to name which baseline artefact a replay compares against; this replay's own baseline-vs-FTS delta (computed on one corpus, one run) is the load-bearing number.

## Cited baselines (context only — not directly comparable, see above)

- `internal/bench/reports/second-brain-retrieval.json` — mean_tie_set_size = 4.111111111111111
- `internal/bench/reports/lexical-ranking.json` — records ~3.333 mean baseline tie-set for the same _score scorer over the SAME bench store — a different measurement pass, cross-artefact discrepancy documented in docs/proof.md

## This replay

- Corpus: agents/memory/ (real, distractor-free) (107 entries)
- Queries: 24, k=5
- Recall@5: baseline=0  fts=1
- Mean top tie-set size: baseline=0.083  fts=1
- Mean top-5 overlap (baseline ∩ fts): 0.017

## Per-query detail

| query | baseline rank | baseline tie | fts rank | fts tie | top5 overlap |
|---|---|---|---|---|---|
| `adr-number-collision-on-parallel-prs` | -1 | 0 | 0 | 1 | 0 |
| `agent-config-hooks-need-global-binary` | -1 | 0 | 0 | 1 | 0 |
| `ai-council-cli-repo-local-only` | -1 | 0 | 0 | 1 | 0 |
| `auto-commit-empties-roadmaps` | -1 | 0 | 0 | 1 | 0 |
| `bench-ab-cost-and-activation-mechanics` | -1 | 0 | 0 | 1 | 0 |
| `capability-matrix-coverage-guard` | -1 | 0 | 0 | 1 | 0 |
| `claude-plugin-local-install-via-worktree` | -1 | 0 | 0 | 1 | 0 |
| `command-cluster-ci-surface` | -1 | 1 | 0 | 1 | 0.2 |
| `commit-relocates-into-per-branch-worktree` | -1 | 0 | 0 | 1 | 0 |
| `council-a1-subagent-contract` | -1 | 0 | 0 | 1 | 0 |
| `council-access-control-and-remediation` | -1 | 0 | 0 | 1 | 0 |
| `council-agent-memory-sunset` | -1 | 0 | 0 | 1 | 0 |
| `council-ai-failure-mode-prevention` | -1 | 0 | 0 | 1 | 0 |
| `council-analysis-workbench` | -1 | 0 | 0 | 1 | 0 |
| `council-chat-history-consolidation` | -1 | 0 | 0 | 1 | 0 |
| `council-claude-code-single-surface` | -1 | 1 | 0 | 1 | 0.2 |
| `council-command-cluster-phase4` | -1 | 0 | 0 | 1 | 0 |
| `council-contract-integrity` | -1 | 0 | 0 | 1 | 0 |
| `council-curl-timeout-fix` | -1 | 0 | 0 | 1 | 0 |
| `council-decisions-workspace-phases` | -1 | 0 | 0 | 1 | 0 |
| `council-design-antislop-harvest` | -1 | 0 | 0 | 1 | 0 |
| `council-design-exploration-skills` | -1 | 0 | 0 | 1 | 0 |
| `council-discipline-axis-benchmark` | -1 | 0 | 0 | 1 | 0 |
| `council-ecc-harvest` | -1 | 0 | 0 | 1 | 0 |

