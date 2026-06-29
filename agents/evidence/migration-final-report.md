# Python → TypeScript migration — final report

> Phase 12 (Teardown & final audit) of
> [`road-to-typescript-only-scripts.md`](../roadmaps/road-to-typescript-only-scripts.md).
> Closes the migration that ADR-200 opened. The `python2ts → main`
> integration merge (the user-owned Hard-Floor step) already landed
> (`origin/python2ts` is fully contained in `origin/main`); this report
> records the residual teardown done directly on `main` and the final
> quality state.

## End state — zero migratable Python

| Metric | Baseline (Phase 1 snapshot) | Now | Result |
|---|---:|---:|---|
| Tracked `.py` (migratable source) | 955 | **0** | 100% migrated |
| `pyproject.toml` / `conftest.py` | present | **0** | removed |
| `.venv` / `.venv-mcp` bootstrap | present | **0** | removed |
| `python3` in taskfiles / workflows / `package.json` | 60+ / 40+ / 3 | **0** | removed |
| Dispatcher (`scripts-run` → `run.ts`) | Python fallback branch | **pure `tsx`** | no fallback |

Verified: `git ls-files '*.py'` → 3 files, **all documented carve-outs**
(below). The migration dashboard
([`migration-status.md`](migration-status.md)) reports **100.0%** across
every phase category.

## Documented carve-outs — intentional non-source Python

These stay Python on purpose. They are **data / external-parity fixtures,
not package source**, and are excluded from the zero-Python target in
[`migration_status.ts`](../../src/scripts/migration_status.ts)
(`EXCLUDED_PREFIXES`, with the rationale inline):

| File | Why it stays Python |
|---|---|
| `internal/bench/ab/fixtures-v2/trapA-overeng-02/src/retry.py` | A/B eval **input corpus** — deliberately crufty sample code the evaluator analyses. Referenced by `internal/bench/corpora/ab-trackb-v2.yaml`. Language-agnostic by design. |
| `internal/evals/structure-grounding/fixtures/db/user_model.py` | Structure-grounding eval **ground-truth fixture** — the real schema a model-under-test is graded against. |
| `internal/glama/smoke.py` | Live **glama.ai MCP parity smoke** — mirrors glama's `bash /app/internal/glama/run` boot and asserts the stdio MCP server speaks MCP. Wired into `.github/workflows/glama-mcp-smoke.yml`. Porting deferred: the value is byte-for-byte parity with glama's own runtime, and the registry sync is fragile (the 2026-06-04 `scripts/ → src/scripts/` move broke it silently). Re-porting risks the exact failure surface this smoke exists to catch; tracked as a follow-up, not a teardown blocker. |

## Teardown actions (this PR)

- **Retired the last pytest test** `tests/test_frontmatter_strict_yaml.py` —
  it imported the now-deleted `validate_frontmatter` **Python** module and was
  dead. Its assertions are ported 1:1 in
  `tests/scripts/validate_frontmatter.test.ts` (`describe('strict-YAML gate
  (test_frontmatter_strict_yaml.py)')`, both the parser path and the
  structural-fallback path via `_set_yaml(null)`); the live-artefact gate is
  exercised directly by the CI `validate_frontmatter` run.
- **Retired 4 dead hook fixtures** `tests/hooks/fixtures/concern_{allow,block,silent,warn}.py` —
  zero references in tracked code; `concern_allow.ts` is the live twin used by
  `dispatcher_feedback_traversal.test.ts` (the TS-only dispatcher needs no
  `python3`).
- **Removed 3 migration-scaffolding workflows** —
  `py2ts-base-guard.yml`, `py2ts-drift.yml`, `py2ts-main-sync.yml`. They
  enforced the (now-completed) `python2ts` integration-branch strategy and
  guarded a branch that has merged. The **permanent** `no-python-in-src.yml`
  guard stays (it makes a `src/**/*.py` regression impossible going forward).
- **Swept residual `python3` mentions** — `taskfiles/dev.yml` (historical
  install comment), `docs/architecture.md` (stale execution-metadata example).
- **Retired the obsolete contract addendum** — the `python2ts` integration-branch
  section of [`branch-protection-policy.md`](../../docs/contracts/branch-protection-policy.md)
  is marked RETIRED; `main`'s required-check floor never included the py2ts
  checks, so no `main` branch-protection change is needed.

## Quality state

- **Test suite:** the affected vitest files are green after the deletions —
  `validate_frontmatter.test.ts` (80 tests), `dispatch_hook.test.ts` (20),
  `dispatcher_feedback_traversal.test.ts` (3), `lint_hook_concern_budget.test.ts`
  (7): **106 passed, 4 skipped** (the 4 skips are `skipIfNoPython` golden-parity
  guards that no-op without a `python3` on PATH — expected post-teardown). The
  full pipeline is the authoritative remote-CI gate per
  `quality.local_auto_run` policy.
- **Linter parity:** the pre-migration lint baseline
  (`agents/evidence/analysis/lint-baseline-2026-05-09.txt`) predates the
  `src/` source-of-truth reframe and references the retired
  `.agent-src.uncondensed/` tree, so it is **not** an apples-to-apples diff
  target; the live linter floor is enforced by `task ci` on the PR (the
  authoritative gate), not by this stale snapshot. No new findings are
  introduced by this PR (deletions of dead Python + comment/example edits +
  one exclusion-list extension).
- **CI runtime:** removing 3 scheduled/guard workflows reduces the CI surface;
  the per-job baseline durations live in
  [`ci-cost-budget.md`](../../docs/contracts/ci-cost-budget.md) and the exact
  before/after delta is captured by remote CI on this PR. No Python toolchain
  setup (`setup-python`, `.venv` bootstrap) remains in any workflow.

## Divergence ledger

The migration's behavioral-parity divergences live in
[`docs/migration/divergences/`](../../docs/migration/divergences/) (the
CI-gated record of Python-vs-TS-port differences). This teardown adds no new
port-divergences — the glama carve-out above is a deliberate **non-port**, not
a parity mismatch, so it is recorded here rather than in the ledger.
