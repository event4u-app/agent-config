---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
relates: []
estate_growth_exempt: >-
  A non-deterministic red on a required-status-check workflow, measured twice in this repository
  on two different watched paths. It fails PRs that did not cause it, and the only way to clear
  it today is a job re-run — which is indistinguishable from re-running until a real failure
  goes away. Recorded rather than fixed because the remedy this repository already chose for
  the first occurrence is to change what the instrument watches, and that is a test-design
  change unrelated to the branch that happened to observe it.
estate_offset_exempt: >-
  No offset is available. No active roadmap owns test-suite determinism, and the prior
  occurrence was fixed in place without leaving a tracked record — which is why the second one
  arrived as a fresh surprise rather than as a known open item.
---
# Road to a witness without shared state

> **Source:** `Node Tests (ubuntu-latest, shard 3/4)` on PR #2058, 2026-09-18 — a red that the
> branch did not cause, diagnosed and proven non-deterministic by re-running the failed jobs on
> the identical commit (`29c457d66`): red, then green, no code change.

## Goal

`tests/scripts/witness/reach_doctor_readonly.test.ts` stops failing because a neighbouring test
touched the worktree. Its claim — *`reach:doctor` mutates nothing* — survives, carried by an
instrument that cannot be falsified by a parallel test file.

## The evidence

The assertion is a `git status --porcelain --ignored` diff across the command under test:

```
AssertionError: expected [ Array(1) ] to deeply equal []
+   "porcelain-gone: !! internal/bench/reports/ab-v2/"
```

`!!` is git's ignored marker, and `porcelain-gone` means the entry *disappeared* between the two
snapshots. `reach:doctor` does not write there. `tests/scripts/bench_ab_v2_run.test.ts` does —
it writes reports into `internal/bench/reports/ab-v2/` and removes them again (`fs.rmSync`,
`:622`), and its own header says the directory is "snapshot + restored so the suite leaves zero
git drift". Both files sit in shard 3/4 and `vitest run` executes them in parallel in one
worktree.

This is the **second** occurrence of the same shape here. The first watched `agents/runtime/`
and was caught by other tests writing `council/events.log` and `mcp-telemetry/calls.jsonl`. It
was fixed by narrowing the watched path, and the fix left no tracked record — so this arrived
as a new problem rather than as a known one.

## Phase 1 — Make the claim unfalsifiable by a neighbour

- [ ] **1.1 Stop watching a path any other test may touch.** The instrument's scope is the whole
      worktree including ignored entries, which by construction includes every scratch directory
      the suite uses. Narrow it to paths `reach:doctor` could plausibly write, or drop the
      porcelain layer entirely — a scope-out list per offending path is the allowlist-growth
      antipattern and is explicitly not the fix.
      verify: the witness passes with `bench_ab_v2_run` deliberately writing and removing a
      report during its window — the interference is staged, not waited for.
- [ ] **1.2 Carry the read-only claim with a static check instead.** Parse each `reach:doctor`
      source and report a write primitive only in callee position of a call expression, so the
      claim rests on the code rather than on an observation a neighbour can spoil.
      verify: proven in both directions — a real `fs.writeFileSync` planted in a reach script
      fails the test naming `file → primitive@Lnnn`, and the same word inside a comment and a
      string literal passes.

## Phase 2 — Stop losing the finding

- [~] **2.1 Ask whether a flake fixed in place should leave a tracked record.** The first
      occurrence was diagnosed correctly and repaired, and nothing in the tree remembers it, so
      the second cost a full diagnosis again. Whether that warrants a convention is a maintainer
      question. Human-gated, not started.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-18 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The fix is a path allowlist | implementation | Excluding `internal/bench/reports/ab-v2/` clears today's failure and the next parallel writer produces a different path — the exact loop the first occurrence already ran | Step 1.1 forbids the per-path exclusion by name and demands a staged-interference test rather than a quiet run | Phase 1 — Make the claim unfalsifiable by a neighbour |
| 2 | The claim is dropped rather than re-carried | product | Deleting the porcelain layer is the cheapest step 1.1 and leaves `reach:doctor mutates nothing` asserted by nothing | Step 1.2 lands the static check, and its verify proves sensitivity in both directions before the observational layer may go | Phase 1 — Make the claim unfalsifiable by a neighbour |
| 3 | Re-running becomes the habit | product | A known flake on a required check teaches "re-run until green", which hides a real failure the same way | The roadmap exists so the re-run is a diagnosis step with a record, not the disposition | Phase 1 — Make the claim unfalsifiable by a neighbour |

## Acceptance Criteria

- [ ] AC-1 — The witness passes while a neighbouring test deliberately writes and removes a file
      in the worktree during its window.
- [ ] AC-2 — `reach:doctor mutates nothing` is asserted by a check that a parallel test cannot
      falsify, proven red by a planted write.
- [ ] AC-3 — The record-keeping question in Phase 2 is answered, or is still open and visibly `[~]`.
