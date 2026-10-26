# Independent test review — check_test_weakening on the inbox-2026-10-az branch

- **Date:** 2026-10-26
- **Reviewer:** an independent session of the same model (level L1 in `evaluator-independence`), commissioned by the implementing session. No owner or council review.
- **Scope:** the six files `check_test_weakening` reported, compared with `origin/main`, plus anything the reviewer found beyond them.

## The prompt, verbatim

> You are reviewing test changes in the git repository at <worktree> (work only inside this directory; do not modify any file, do not run git commands that change state).
>
> A CI gate (`src/scripts/check_test_weakening.ts`) reports that these six test files, compared with `origin/main`, assert less than before:
>
> - tests/cli/uiRenderInteract.test.ts: 3 suppression(s) net-added
> - tests/cli/uiRenderRegion.test.ts: 1 suppression(s) net-added
> - tests/cli/uiRender_geometry.test.ts: 1 suppression(s) net-added
> - tests/scripts/design_slop_cp6.test.ts: 8 assertion(s) net-removed (the file is deleted)
> - tests/scripts/design_slop_render_bench.test.ts: 1 suppression(s) net-added
> - tests/scripts/ui_conformance_probe_sibling.test.ts: 1 suppression(s) net-added
>
> Inspect each with `git diff origin/main -- <path>` (for the deleted file, `git show origin/main:<path>`), and read the production code it exercises. Relevant context you can check yourself: `src/scripts/design_slop_rules.ts` (the rule registry; search it for the CP6 catalog id), `docs/guidelines/design-antipatterns.md` § Detector status (the CP6 row), and `vitest.config.ts`.
>
> For each file, answer: is this a weakening of a test that previously guarded existing behavior, or something else (for example a new test file, or a test whose subject no longer exists)? If a test is skipped under a condition, is the condition legitimate, and does any job still run it unskipped? Name every problem you find, with file and line, including problems outside these six questions if you see them.
>
> Return: one section per file with a verdict (`acceptable` or `not acceptable`) and the evidence (file:line, command output) behind it, then an overall verdict.

## The verdict

| File | Verdict | Evidence |
|---|---|---|
| `tests/cli/uiRenderInteract.test.ts` | acceptable | new file; 3 cases `it.skipIf(!live)`, `live = chromiumAvailable()` checks the executable on disk |
| `tests/cli/uiRenderRegion.test.ts` | acceptable | new file; 4 pure cases always run, 1 live case gated the same way |
| `tests/cli/uiRender_geometry.test.ts` | acceptable | new file; 1 live case |
| `tests/scripts/design_slop_cp6.test.ts` | acceptable | the subject was removed: commit 8255bc3b10 demotes CP6 to judgment-only; the catalog row records the demotion and its near-miss (`LABELS.json`, `tune/cp6-request-rate-particle-field.md`) |
| `tests/scripts/design_slop_render_bench.test.ts` | acceptable | new file; the bar for the five render rules |
| `tests/scripts/ui_conformance_probe_sibling.test.ts` | acceptable | new file; 2 pure cases, 1 live |

**Overall:** acceptable as a test-weakening question. Not acceptable as shipped coverage, for two reasons the reviewer found:

1. The 7 live cases ran in no CI job — the only job that installs Chromium ran two named files.
2. `src/skills/design-intelligence/data/stacks/threejs.csv:55` still called CP6 a shipped copy-engine slop rule.

## What was done with it

1. The five files are named in the `svg-witness-tests` job's Vitest step (`.github/workflows/tests.yml`) and listed in `vitest.config.ts` as `LIVE_BROWSER_SUITES`, so they run whole with Chromium and are not collected as skipped on the node shards. Local run with the job's file set: 7 files, 81 tests, none skipped.
2. The threejs row now names CP6 as judgment-only. A search over `src/`, `docs/` and `internal/` for the six demoted rule ids or "slop rule CP…" claims found no other site.
