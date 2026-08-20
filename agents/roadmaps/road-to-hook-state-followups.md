---
complexity: bounded
status: ready
execution:
  mode: phase-checkpoints
---
# Road to the hook-state follow-ups nobody owned

> **Source:** PR #1458 (per-session hook state, ownership checks, locked
> read-modify-write) and the two AI-council runs over it, 2026-08-20. Every item
> here was SEEN during that work and deliberately not fixed in it — each with a
> stated reason. This file exists because a stated reason is not a disposition:
> under `fix-what-you-see`, an observed defect ends as a fix or as a tracked
> item, and "known-open in a PR body" is neither.
>
> **Companion, not a duplicate.** `road-to-hook-state-concurrency.md` owns the
> claim-then-act *criterion* and the lock mechanism's redesign. This file owns
> the leftovers that criterion does not reach: two dead or unsafe consumers, the
> API shape the two lock primitives need before they can converge, and a set of
> local test reds nobody had disposed of. Where the two touch — the lock
> granularity — this file defers and says so.

## 0. Why each item is here rather than in the PR

The PR fixed thirteen council findings. These six survived it, and the honest
reason differs per item: two are pre-existing defects whose fix changes behaviour
(so they need their own change), one is an API decision that needed a second
implementation to exist before it could be made, one was blocked on a concurrent
review reading the same code, and two are test reds that were never anybody's.

None of them is blocked on a decision the maintainer has to make first.

## Phase 1 — the two consumers that read what nobody writes

- [ ] **`_lib/envelope_grounding.readLastVerify` reads a path nothing writes.**
      It resolves `agents/runtime/state/verify-before-complete.json`; the
      producer writes `agents/state/verify-before-complete/<digest>.json`. Dead
      before the per-session split and still dead — the `runtime/` segment was
      never a directory the code used. Its one caller is
      `_cli/cmd_session_recycle.ts`, which has no `session_id` in hand, so the
      fix threads one through (the host exports `CLAUDE_CODE_SESSION_ID`) or the
      function drops the field and says the state is per-session and unreachable
      from a CLI. **The fix turns a dead reader live**, which changes a CLI's
      output — that is why it is not a drive-by.
      verify: `readLastVerify` returns a non-null line for a session whose
      producer state exists, and `null` for one whose does not.

- [ ] **`state_io.feedback_dir` still carries the sanitiser the rest of the file
      dropped.** `session_id.replace(/\//g, '_')` maps `a/b` and `a_b` onto one
      directory, and `'' → 'unknown-session'` gives every id-less invocation one
      shared bucket. This is the exact shape `session_state_file` replaced with a
      digest, for the exact reason. Lower severity — it merges a per-concern
      feedback view rather than destroying a pin — and higher blast radius,
      because it changes the on-disk layout `task hooks-status` reads.
      verify: two ids that the sanitiser merges address different directories;
      `hooks:status` still renders both.

## Phase 2 — what the two lock primitives need before they converge

Two primitives now exist for one job: `update_json_under_lock` (directory-keyed,
proven by a four-process test that was verified red against an unlocked build)
and the language hook's `_withToolWriteLock` (file-keyed, non-blocking). Neither
is simply better — the granularity and the non-blocking semantics are the
second's, the concurrency evidence is the first's.

- [ ] **Three return states instead of two.** `update_json_under_lock` returns
      `true` both when it wrote and when the mutator deliberately declined
      (`mutate → null`). A fail-closed caller needs to tell those apart: the
      language hook's pin-mismatch path must stay silent on a decline, and today
      it can only express that through a closure flag. `written` / `skipped` /
      `failed`.
      verify: a declining mutator yields `skipped`, and a caller that treats
      `skipped` as failure emits nothing.

- [ ] **The lock scope follows the state scope.** `_lock_path(state_dir)` is
      directory-keyed and always was — that part is not new. What is new is what
      the directory holds: before the split one file, so a directory lock was
      effectively a file lock; after it, N per-session files, so the lock
      re-serialises the sessions the split exists to decouple. Write path only,
      and the contention was never measured — measure before choosing, because
      "probably unmeasurable at millisecond writes" is a guess.
      verify: two sessions writing different per-session files do not block each
      other; the four-process same-file test stays green.

- [ ] **A non-blocking acquire for hot paths.** `post_tool_use` runs on every
      tool call and must never wait. This subsumes the item below rather than
      complementing it: a caller that never waits cannot cross a deadline, so the
      reclaim branch becomes unreachable instead of merely rarer.
      verify: a held lock returns immediately with a decline, never after a spin.

- [ ] **`_acquire_lock`'s reclaim is a patience check wearing the name of a
      staleness check.** The comment says `// Stale companion — reclaim it` and
      nothing in the branch examines the companion: no mtime, no age, no owner.
      It is deleted because *this* caller waited long. Worse, `start` is not
      reset before `continue`, and the deadline check sits before the 2 ms
      `Atomics.wait` — so after the first timeout the sleep is unreachable and a
      pauseless loop is the end state of any call that touches the deadline once.
      Two callers past their deadline can evict each other without bound.
      Pre-existing; PR #1458 contributes probability by holding the lock longer.
      Defers to `road-to-hook-state-concurrency.md` for the criterion; the item
      is kept here because that roadmap's criterion does not name this function.
      verify: a fresh companion is never removed by a caller that merely waited;
      no call path reaches a sleepless retry.

- [ ] **The NFS claim is unverified and must not be acted on as stated.** A peer
      reported `openSync(path, 'wx')` as "broken on NFS per `open(2)`" and
      proposed `mkdirSync`. The local BSD manpage says the opposite — it
      recommends `O_EXCL` for exactly this — and the warning is Linux-specific
      and version-bound (old NFS), not categorical. Establish the actual scope
      before any rewrite, and state whether NFS is even in scope for a state tree
      that lives inside the project directory.
      verify: the chosen primitive cites the platform and version its guarantee
      holds on.

## Phase 3 — the local test reds nobody had disposed of

Seen while running the full suite for PR #1458: **11 failures across 6 files**,
all of which reproduce with this PR's changes reverted (same test names, only
timings differ) and none of which CI reports. They are local-only reds, which is
precisely why they had no owner — the shipped gate is green, so nothing forces a
look, and every session that runs the suite locally sees noise it learns to
ignore. That is the state this phase ends.

- [ ] **Classify each of the 11 before fixing any.** Three plausible classes and
      they need different work: (a) genuinely environment-dependent, like the
      locale defect PR #1458 fixed with `tests/_lib/hermetic-env.ts`; (b)
      working-tree-dependent — `sweep_dead_scan_roots` and
      `check_artefact_count_messaging` read the real repo, so an untracked
      artefact in the tree changes their answer; (c) genuinely broken and masked.
      Class (b) is not a test defect but a **scope defect** — a test asserting
      over a live tree cannot be hermetic — and its fix is a fixture root, not a
      new expectation.
      verify: each of the 11 carries a class and a one-line reason.
      Files: `explain_run`, `build_mcp_registry_manifest`,
      `check_artefact_count_messaging`, `sweep_dead_scan_roots`,
      `manual_rule_projection`, `code_graph_refresh`.

- [ ] **Fix class (a) and (c); give class (b) a fixture root or an explicit
      allow.** A test that reads the developer's working tree and fails on
      untracked files is telling the truth about a wrong question.
      verify: a clean checkout and a checkout with untracked artefacts produce
      the same result.

- [ ] **Then make the whole-suite state legible.** Right now "15500 passed, 11
      failed" is indistinguishable from a regression at a glance, so nobody
      glances. Either the 11 reach zero, or the known set is named somewhere a
      run can be compared against.
      verify: a full local run either is green, or names exactly which failures
      are expected and why.

## Non-goals

- Redesigning the lock mechanism. That is
  `road-to-hook-state-concurrency.md`; this file supplies the API shape (Phase 2)
  it will need and stops there.
- Re-litigating the 150-tool-call re-emit threshold. Its own revisit-if condition
  covers the one seat that called the evidence insufficient.
- The formal R2 completion review for PR #1458. The dispatcher package is
  reproducible in one command and the gate reports its absence accurately; that
  is a decision about that PR, not follow-up work.

## Acceptance criteria

- No consumer in the tree resolves a state path its producer does not write.
- One lock primitive, or two with a stated reason why the second exists.
- A full local suite run is either green or self-describing.
- Every item above ends as a fix or as an explicitly recorded decision — not as
  a mention.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Fixing a dead reader changes behaviour nobody expected | implementation | `readLastVerify` has returned `null` for its whole life, so `cmd_session_recycle` output has never carried a verify line. Making it work is a visible change to a CLI's output, and a caller may have come to rely on the field being absent | Phase 1 states the behaviour change as the reason it is not a drive-by; the verify demands both the present and the absent case, so the null path stays exercised rather than silently removed | Phase 1 |
| 2 | The `feedback_dir` fix breaks `hooks:status` | implementation | Changing the sanitiser changes the on-disk directory layout the dispatcher feedback view reads; an existing tree keeps directories under the old names and a reader that assumes one scheme sees a split view | Phase 1's verify requires `hooks:status` to render both, which forces the migration question to be answered rather than discovered after the change | Phase 1 |
| 3 | Measuring lock contention gets skipped and the granularity is chosen on a guess | product | "Probably unmeasurable at millisecond writes" is the current basis, and a guess that turns out wrong costs every concurrent session a serialised write path — with a 5-second acquire deadline behind it | Phase 2 makes the measurement the precondition for the choice, not a follow-up to it, and names the guess as a guess so it cannot be quoted as a finding | Phase 2 |
| 4 | The non-blocking acquire trades a wait for a silent skip | product | A caller that returns immediately on a held lock records nothing, and for a counter that means a missed increment rather than a late one. For the re-emit path that is recoverable by construction; for a verification witness it might not be | Phase 2 pairs the non-blocking acquire with the three return states, so a skip is distinguishable from a failure at every call site instead of collapsing into one boolean | Phase 2 |
| 5 | Class-(b) test reds get "fixed" by weakening an assertion | implementation | A test that reads the real working tree fails on untracked files. The cheap fix is to relax what it asserts, which removes the coverage instead of the scope defect | Phase 3 requires classification before any fix and names the class-(b) remedy as a fixture root, with a verify that compares a clean checkout against a dirty one | Phase 3 |
| 6 | The 11 local reds are declared expected and then grow | product | Naming a known-failing set is the pragmatic option and also the one that rots: the next red joins the list instead of being fixed, and the list becomes the reason nobody looks | Phase 3's last item allows either zero or a named set, and the acceptance criterion demands the run be self-describing — a set that grows makes its own growth visible in the diff | Phase 3 |
