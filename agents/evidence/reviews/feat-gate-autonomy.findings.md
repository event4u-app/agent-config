# Findings: feat-gate-autonomy
<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: 1cb04bbc674104e6134c12ecf4eaf07cd29a0cdfcc8f80f56a75747ce6ca4c34 | diff: 186ddaa747062b527400676967d14676a8dd672f | reviewer: r2-fresh-subagent-feat-gate-autonomy | prompt_hash: 429e0346c134261653bdf50343050bc644ad1fdfcb72cb4a87e3a886c6da951f -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-17 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 186ddaa747062b527400676967d14676a8dd672f
  scope_hash: 1cb04bbc674104e6134c12ecf4eaf07cd29a0cdfcc8f80f56a75747ce6ca4c34
  roadmap: agents/roadmaps/road-to-gate-autonomy.md
  roadmap_hash: cdd1dbb922276d25d5b8a2707baefaea23008621b23d692b95fe5ce8247117b0
  ac_hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-17T13:44:51Z
-->

19 findings from a fresh reviewer over the whole 3053-line diff. Committed with
every row `open`, before any fix, per the ordering contract.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/agent-src/scripts/gate_execute.ts:225 | `spawnSync(command, { shell: true, cwd: <repoRoot> })` executes an arbitrary shell string read from a roadmap markdown field, with no allowlist, no echo-before-run, no `--dry-run` and no this-turn confirmation. The stated mitigation (roadmap risk 2, "class is authored and linted") only checks that `Run:` exists — the lint never inspects the command — so a mis-authored or PR-supplied `Class: 0` + `Run:` pair yields repo-root code execution on one keypress, including Hard-Floor actions. | open | |
| 2 | high | agents/roadmaps-progress.md:5 | The dashboard was regenerated AFTER the `blocker_is_resolved` fix, yet still reports 50 open blockers / 22 need you and still renders `b-matrix-semantics-amendment` as a live user-owned decision. The predicate is correct; the committed artifact is stale. The user-facing effect of the branch's headline fix is absent from the tree. | open | |
| 3 | medium | src/agent-src/scripts/gate_execute.ts:139 | `appendEvidence` bounds the blocker body only at the next `### blocker:` heading, never at the next `##` section. For the LAST blocker in a file — the common shape — the evidence bullet lands at the END OF THE FILE, contradicting the function's own docblock. The single-blocker fixture cannot catch it. | open | |
| 4 | medium | src/agent-src/scripts/gate_execute.ts:70 | `locate()` reconstructs the file as `path.join(roadmapRoot, path.basename(r.rel))`, discarding the directory and ignoring `RoadmapStats.path`, which already holds the absolute path. A roadmap in a subdirectory is written to the wrong path or throws — after the authored command has already run. | open | |
| 5 | medium | src/agent-src/scripts/resume_probe.ts:228 | `stepIsDone` matches the step id anywhere on a checkbox line and returns the FIRST match, so an unrelated earlier line mentioning `2.1` decides the verdict for step 2.1 and can report `fired` while the real step is open. | open | |
| 6 | medium | src/agent-src/scripts/resume_probe.ts:63 | `COMPOUND_RE` carries no `i` flag while every sibling regex does, so `BOTH`/`AND` fire only in uppercase. A lowercase "and" conjunction escapes the guard added after the first live run's 7 false positives. The existing lowercase test names two roadmaps and never exercises the gap. | open | |
| 7 | medium | agents/roadmaps/road-to-gate-autonomy.md:147 | Phases 1 and 2 are marked done while their own ACs are knowingly unmet. The deferred class write-back is named in step prose only — no step, no blocker, no `later/` note tracks it, so it is lost when the roadmap archives. | open | |
| 8 | medium | src/agent-src/scripts/gate_execute.ts:190 | Step 2.1's `verify:` requires an over-budget path rendering rather than executing. No over-budget path exists: the class-1 branch only tests ledger existence, never compares a spend against a budget, and `Blocker.budget` is parsed but read nowhere. The ledger-exists branch has no test. | open | |
| 9 | medium | src/agent-src/scripts/gate_execute.ts:252 | The `resolved` path rewrites a roadmap file and neither regenerates the dashboard nor tells the caller to — the same staleness finding 2 records. `renderResumed` does emit that follow-up for its own suggestion; the write path does not. | open | |
| 10 | low | src/agent-src/scripts/gate_execute.ts:30 | Docblock claims class 3 is byte-identical because "it calls the same renderer". It calls no renderer — it returns a bespoke string. The claim describes a mechanism the file does not have. | open | |
| 11 | low | src/agent-src/scripts/roadmap_gates.ts:243 | Docblock claims "empty findings render nothing at all", contradicted by the next paragraph of the same docblock: with park notes present and zero fired, a blank line plus the coverage line is still emitted. | open | |
| 12 | low | src/agent-src/scripts/roadmap_gates.ts:573 | The no-roadmaps-directory early return omits the three keys `renderJson` now always emits, so a consumer reading them gets `undefined` on that branch. | open | |
| 13 | low | src/agent-src/scripts/gate_execute.ts:133 | The blocker id is interpolated unescaped into `new RegExp(...)`. Ids are parsed with `(.+?)`, so a metacharacter throws an uncaught `SyntaxError` after the authored command has already run. | open | |
| 14 | low | src/agent-src/scripts/resume_probe.ts:152 | `extractCondition` searches the WHOLE file for the resume marker without restricting to the blockquote or stripping fenced code, so body prose can silently become "the condition". | open | |
| 15 | low | src/agent-src/scripts/gate_execute.ts:232 | `r.error` is never read. A spawn failure or maxBuffer overflow reports "exited null" with no diagnostic, on the branch's only writing path. | open | |
| 16 | low | src/agent-src/scripts/gate_execute.ts:95 | The consent Question falls back to `b.blocks`, and the default is a fixed string for every entry, so the first real entry renders a Blocks sentence in the Question slot and no per-blocker default. | open | |
| 17 | low | agents/roadmaps/road-to-gate-autonomy.md:103 | The 1.1 done-note says "Eight new tests"; the diff adds nine `it(` blocks. A checkable count is off by one. | open | |
| 18 | low | src/agent-src/templates/roadmaps.md:146 | The canonical template ships `Class: 3` together with `Run:` and `Budget:`, so an author copying it produces a class-3 entry advertising a runnable command — the confusion the same rule warns about three paragraphs later. | open | |
| 19 | low | src/agent-src/scripts/roadmap_gates.ts:583 | `--execute` is parsed after the `--pending` early return and ignores `--json`, and the flag has no usage output or user-facing doc. | open | |

## What the reviewer checked and found clean

Recorded so the gaps are legible rather than inferred from silence: the sweep
arithmetic (all five percentages, the uncorrected 24.0 %, the 37-of-49 figure
and the eight-of-twenty-one threshold) re-counted and correct; the
pre-registration commit verified to exist with sections 3 and 4 empty; the
"HARD, not ratcheted" claim verified against the code path; `blocker_is_resolved`
verified to match the lint's existing prefix semantics; src/dist parity
verified blob-identical; the 12 gate-execute fixtures counted.
