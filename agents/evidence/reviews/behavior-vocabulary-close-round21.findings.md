# Findings: behavior-vocabulary-close-round21
<!-- completion-review: v1 | reviewed: 2026-10-01 | scope: 4c0752bd3f75076d29420f5d638bc18b46ff9e878559b069c5fa5c2ebe3da249 | diff: 84ed54ac76975cf6b512aa6f6a0be25bd729e949 | reviewer: r2-fresh-subagent-behavior-vocabulary-close-round21 | prompt_hash: b9188047b33d8c0842d63f83230a69d1a74957104f08887aacc49163d93cd747 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-behavior-vocabulary-close-round21"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-01 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 84ed54ac76975cf6b512aa6f6a0be25bd729e949
  scope_hash: 4c0752bd3f75076d29420f5d638bc18b46ff9e878559b069c5fa5c2ebe3da249
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-01T08:40:43Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | src/agent-src/templates/scripts/work_engine/stack/runner.ts:256 | The `behavior_runners` docblock asserts a behaviour suite "is not something `/tests execute` may start running", and `src/agent-src/contexts/execution/toolchain-resolver.md:134-135` repeats it as "reported, never run". For 4 of the 8 labels the emitted behaviour command is byte-identical to a native command that IS in `selected`: `pytest-bdd` -> `pytest` (:851) against `_python_runners`' `pytest`; `cucumber-jvm` -> `jvm.command` (:872) against `_jvm_runners`' identical `./gradlew test` / `mvn test`; `reqnroll` and `specflow` -> `dotnet test` (:881, :884) against `_dotnet_runners`' `dotnet test`. The structural half of the claim (the axis is unreachable from `selected`) is true; the behavioural half is not - `/tests execute` does start those suites, and under the fast-by-default bucket, since the native rows are `SPEED_FAST`. Same self-assertion class the roadmap names as this branch's dominant defect. | fixed | Narrowed to reachability at both sites, with the four coinciding labels (pytest-bdd/pytest, cucumber-jvm/jvm.command, reqnroll and specflow/dotnet test) named so the distinction cannot be re-collapsed. Count reproduced at runner.ts:851, :872, :881, :884 before editing. (`62741f8c8`) |
| 2 | low | src/domains/engineering-base/tests/execute/command.md:73 | `### 2. Run the tests` gained the execution rule "**A behavior-axis command runs from its `scope_root`**, not the repository root", citing `toolchain-resolver.md` § 2b - the same section that says the axis is detection-only and "never run". Step 1 of this command resolves `selected`, which the axis is unreachable from, so the bullet governs a path the command cannot reach: it is either dead guidance or a sanction of exactly what § 2b forbids. One of the two has to give - scope the bullet to an explicitly requested behaviour run, or drop the absolute in § 2b (see finding 1). | fixed | Bullet deleted rather than reworded: under the corrected reading /tests execute still never issues a behavior-axis command, so it was guidance for something that does not happen. (`62741f8c8`) |


## How this round came to be run at all

The session that dispatched round 21 died on an authentication error between
writing this package and reading a verdict, leaving the skeleton untracked in
its worktree and a last message calling the round binding. That claim was an
intention, not a result: nothing had reviewed anything, and committing the
empty skeleton would have put a review into the record that never happened.

The package was complete and already bound to the head that mattered, so it
was dispatched to a fresh reviewer rather than discarded. It was not a null —
which is the argument for having run it, and against treating twenty prior
rounds as a reason to stop.

**Re-bind (§ 2.7 path 1).** Fixing both findings moved the scope; every row is
terminal, so the artefact is re-bound in place rather than archived as a closed
round. What the reviewer read is the pre-fix state.

**`fix-before-artifact`, and the verdict is correct.** The fixes (`62741f8c8`)
were committed before this artefact (`84ed54ac7`), so contract § 2.5's ordering
is violated and the gate says so. It is recorded here rather than engineered
around: the round was dispatched by a session that then died, so by the time
anyone could act on its findings the review had no committed artefact to
precede them, and committing an empty skeleton first would have been the worse
failure — a review in the record that never ran.

The gate is `--advisory` in CI, so this does not block; that is why it can be
stated plainly instead of being hidden by reordering history.
