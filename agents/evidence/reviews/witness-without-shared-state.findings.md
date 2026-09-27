# Findings: witness-without-shared-state — test-weakening verdict

<!-- evidence-type: original-review -->
<!-- test-weakening-review: v1 | reviewed: 2026-09-27 | diff: b6e934e83 | file: tests/scripts/witness/reach_doctor_readonly.test.ts | reviewer: fresh-subagent-no-prior-context | prompt: ./witness-without-shared-state.review-input/prompt.md -->

`original-review` and not `current-binding`: this is the review as it was produced against
commit `b6e934e83`, and it asserts nothing about any later state of the tree.

`check_test_weakening` measured **2 assertion(s) net-removed** in
`tests/scripts/witness/reach_doctor_readonly.test.ts` on commit `b6e934e83` and refused it
without an independent verdict. This is that verdict.

**Independence, stated so it can be checked rather than believed.** The reviewer was a fresh
subagent with no prior context — it had not seen the implementer's reasoning, the roadmap, or
any statement of what the answer should be. The prompt it was given is committed verbatim
beside this file (`./witness-without-shared-state.review-input/prompt.md`) together with the
exact diff it read (`./witness-without-shared-state.review-input/diff.patch`), because
`evaluator-independence` admits a self-commissioned review as gate evidence only when the
prompt ships with the verdict. Reviewer scope was the whole commit, not a subset chosen by
the implementer, and it was told to run the suite and read the production sources itself
rather than trust the diff's claims about them.

| # | Severity | Finding | Reviewer's reasoning |
|---|----------|---------|----------------------|
| 1 | none | `isHarnessNoise` / `HARNESS_NOISE_RE` and their dedicated test (8 assertions) removed | The helper existed only to carve an exception into the porcelain instrument this diff retires. Deleting dead code's dead test is correct, not weakening — verified no reference to either identifier survives in the file. |
| 2 | none | `porcelain()`, `snapshot()`, `changesBetween()`, `ambientChanges()`, `attributableChanges()` and the `expect(porcelain()).toMatch(/^!! /m)` self-check (~1 assertion) removed | Same class: the whole-worktree `git status --porcelain --ignored` instrument is retired, not narrowed. Its self-check asserts a property of a function that no longer exists. |
| 3 | none | Factual claim verified — `bench_ab_v2_run.test.ts` writes and removes a file in the wholly-gitignored `internal/bench/reports/ab-v2/` | `.gitignore:315` carries the directory; the neighbouring test runs the real CLI, which writes a report JSON there and then `fs.rmSync(file, {force:true})` without removing the parent. |
| 4 | none | Factual claim verified — git collapses a wholly-ignored directory to one `!!` line that appears and disappears as a file is created and deleted inside it | Reproduced empirically in this repository: no output → `!! internal/bench/reports/ab-v2/` after mkdir+write → no output again after rm. Matches the described flake mechanism exactly. |
| 5 | none | Factual claim verified — no reach script contains a filesystem write primitive | Checked against all five `REACH_SOURCES`: the only hit is `fs.openSync(configPath, 'r')`, a read, consistent with the AST scan's mode-gating and the STRUCTURAL test's zero-offenders assertion. |
| 6 | low | The two added tests are real, targeted additions rather than assertion padding | Both pass (7/7 green). The staged-interference test reproduces the exact flake scenario against the surviving instrument and asserts it stays silent — genuine regression coverage for the defect this change closes. |
| 7 | low-medium | **Genuine, disclosed residual gap:** a write by a spawned child process (`reach_doctor.ts` and `_lib/tool_probe.ts` both `spawnSync` a probe binary) to a NEW untracked, non-gitignored path is no longer caught by anything in this file | The diff's own header names this cost rather than hiding it. Partially mitigated out-of-file: the schema gate in `tests/scripts/reach_doctor.test.ts` keeps `probe_args` flag-shaped, so a probe cannot be handed an output path. Residual risk — a probe binary writing a stray file as its own side effect — is real, was always low-probability, and is stated in the test header rather than papered over. |

## Verdict

> **VERDICT: legitimate re-architecture, adequate replacement coverage** — with one
> honestly-disclosed, low-severity residual gap around spawned-process writes to new
> untracked, non-ignored paths, partially covered by a sibling test file's schema gate rather
> than by this one.

No finding was opened that the change must answer before it ships. Finding 7 is recorded as
standing residual risk, not as a blocker: it is a narrowing this diff states plainly in the
test's own header, which is what `evaluator-independence` asks of a weakening — that it be
argued in the open and independently judged, not that it never happen.
