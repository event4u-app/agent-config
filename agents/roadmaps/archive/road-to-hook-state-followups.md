---
complexity: lightweight
status: ready
estate_offset_exempt: "Every item was SEEN during PR #1458 and must end as a fix or a tracked item under fix-what-you-see, so dropping them is not available. The offset alternatives all cost more than this line: archiving needs a finished roadmap and the dashboard shows none at zero open steps; parking in later/ is what the estate register itself calls burial; and the only roadmaps I could terminate belong to two concurrent sessions, which is a judgement about their work rather than mine. Charged as one reviewable line, per this gate's own instruction."
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

- [x] **`_lib/envelope_grounding.readLastVerify` reads a path nothing writes.**
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
      <!-- verified 2026-08-20: `readLastVerify(root, session_id)` now resolves the
      producer's own builder — `src/scripts/_lib/envelope_grounding.ts:155`
      (`path.join(root, statePathFor(session_id))`); the dead
      `agents/runtime/state/verify-before-complete.json` constant is deleted. The
      session id is threaded from the CLI at
      `src/scripts/_cli/cmd_session_recycle.ts:196` via the canonical resolver
      `env_session_id()`, and is a REQUIRED parameter so no caller can reach the
      dead behaviour by omission. Both halves of the verify are pinned in
      `tests/scripts/envelope_grounding.test.ts` (13 passed) — non-null for a
      session whose state exists, null for one whose does not, plus a
      never-read-a-neighbour case. Sabotage-verified: restoring the old constant
      turns the non-null case red ("expected null not to be null"), restoring the
      builder turns it green again. -->

- [x] **`state_io.feedback_dir` still carries the sanitiser the rest of the file
      dropped.** `session_id.replace(/\//g, '_')` maps `a/b` and `a_b` onto one
      directory, and `'' → 'unknown-session'` gives every id-less invocation one
      shared bucket. This is the exact shape `session_state_file` replaced with a
      digest, for the exact reason. Lower severity — it merges a per-concern
      feedback view rather than destroying a pin — and higher blast radius,
      because it changes the on-disk layout `task hooks-status` reads.
      verify: two ids that the sanitiser merges address different directories;
      `hooks:status` still renders both.
      <!-- verified 2026-08-20: `feedback_dir` now takes its distinctness from a
      sha256 digest of the FULL id and keeps the sanitised label as a legible
      prefix — `src/scripts/hooks/state_io.ts:352` (`${label}.${digest}`). Probed
      directly: the two ids the old sanitiser merged (`a/b`, `a_b`) produce two
      directories on disk (`a_b.648fa9b31bc7`, `a_b.c14cddc033f6`) where they
      previously produced one, and the exact walk `hooks_doctor._latest_feedback`
      performs finds 2 candidates and resolves normally — so `hooks:status` still
      renders. Tests rewritten from literal-equality (which asserted the
      collision) to the property, `tests/scripts/hooks/state_io.test.ts` (35
      passed) + `dispatcher_feedback_traversal.test.ts` (3 passed). No migration:
      nothing parses the dirname back to an id and nothing prunes that tree, so
      old-scheme dirs stay readable. The now-false "Deliberately NOT retrofitted"
      paragraph in the same file is replaced rather than left standing. -->

## Phase 2 — what the two lock primitives need before they converge

Two primitives now exist for one job: `update_json_under_lock` (directory-keyed,
proven by a four-process test that was verified red against an unlocked build)
and the language hook's `_withToolWriteLock` (file-keyed, non-blocking). Neither
is simply better — the granularity and the non-blocking semantics are the
second's, the concurrency evidence is the first's.

- [x] **Three return states instead of two.** `update_json_under_lock` returns
      `true` both when it wrote and when the mutator deliberately declined
      (`mutate → null`). A fail-closed caller needs to tell those apart: the
      language hook's pin-mismatch path must stay silent on a decline, and today
      it can only express that through a closure flag. `written` / `skipped` /
      `failed`.
      verify: a declining mutator yields `skipped`, and a caller that treats
      `skipped` as failure emits nothing.
      <!-- verified 2026-08-20: `LockedUpdateResult = "written" | "skipped" |
      "failed"` — `src/scripts/hooks/state_io.ts:52`, returned at
      `:772`/`:774`/`:776`. Both production call sites converted
      (`before_complete_hook.ts:547` compares `=== "failed"`, never a coercion).
      Verify pinned in `tests/scripts/before_complete_session_isolation.test.ts`
      (31 passed): a declining mutator yields `skipped`; `skipped` and `failed`
      are asserted distinct; and a fail-closed caller that treats anything other
      than `written` as no-emit emits exactly once across landed/declined/failed.
      The migration hazard is real and was CAUGHT in this change:
      `tests/scripts/fixtures/rmw_increment_worker.mts` tested `if (!ok)`, which
      is silently always-false against a string union — it would have reported a
      clean run through a broken lock. Converted to `!== 'written'`. -->

- [x] **The lock scope follows the state scope.** `_lock_path(state_dir)` is
      directory-keyed and always was — that part is not new. What is new is what
      the directory holds: before the split one file, so a directory lock was
      effectively a file lock; after it, N per-session files, so the lock
      re-serialises the sessions the split exists to decouple. Write path only,
      and the contention was never measured — measure before choosing, because
      "probably unmeasurable at millisecond writes" is a guess.
      verify: two sessions writing different per-session files do not block each
      other; the four-process same-file test stays green.
      <!-- verified 2026-08-20: measured FIRST, as the step demanded. 4 and 8
      concurrent processes x 60 read-modify-writes each, every process writing its
      OWN per-session file (macOS/APFS, Darwin 24.6.0 arm64): 4 workers — slowest
      worker 68ms under the shared directory lock vs 27ms with no shared lock
      (~1.1ms vs ~0.45ms per write); 8 workers — 138-267ms vs 83-95ms across runs.
      So "probably unmeasurable at millisecond writes" was wrong in direction (it
      IS measurable and grows with concurrent session count) and roughly right in
      magnitude. The decisive reading is the comparison, not the absolute: writes
      to DISTINCT files under the shared lock came out at or above writes to the
      SAME file, i.e. the directory lock paid full mutual-exclusion cost for
      writes needing none.
      Acted on NARROWLY: `update_json_under_lock` is file-keyed via
      `_target_lock_path` (`src/scripts/hooks/state_io.ts` — `<file>.lock`);
      `_atomic_write_text`, the path the hook contract describes and concerns
      share, keeps the directory lock untouched. Both halves of the verify pinned
      in `tests/scripts/hooks/state_io.test.ts` (35 passed): a lock held on one
      session file does not block a write to another (`written`, <1s, peer lock
      intact), and a lock held on the SAME file still excludes. The four-process
      same-file mutual-exclusion test stays green (31 passed in
      `before_complete_session_isolation.test.ts`). Sabotage-verified: restoring
      `_lock_path(state_dir)` reds 3 tests. The pruner now removes `<file>.lock`
      and `.lock.held` with the state file it prunes, so this does not trade a
      serialised write path for unbounded sentinel growth. Contract updated in
      the same change: `docs/contracts/hook-architecture-v1.md:516`. -->

- [x] **A non-blocking acquire for hot paths.** `post_tool_use` runs on every
      tool call and must never wait. This subsumes the item below rather than
      complementing it: a caller that never waits cannot cross a deadline, so the
      reclaim branch becomes unreachable instead of merely rarer.
      verify: a held lock returns immediately with a decline, never after a spin.
      <!-- verified 2026-08-20: `_acquire_lock(lock_path, { blocking: false })`
      returns `null` on the first contended attempt with no spin, surfaced as
      `update_json_under_lock(..., { blocking: false })`. Pinned in
      `tests/scripts/hooks/state_io.test.ts`: a held lock declines in <1s (vs the
      5s blocking deadline) and does not evict the live peer's companion. An
      ABANDONED companion is still reclaimed on the non-blocking path, so one
      crashed process cannot wedge the hot path for LOCK_STALE_MS.
      DECISION recorded below: the capability ships, the existing caller's
      default does NOT change. -->
      <!-- decision 2026-08-20: `before_complete_hook`'s `post_tool_use` write
      stays BLOCKING (the default). Flipping it to non-blocking would trade a
      late verification counter for a LOST one, and risk-register row 4 names
      exactly that trade as the open question ("for a verification witness it
      might not be" recoverable). The measurement above puts the contended cost
      at ~1ms per write, which does not justify losing verification evidence, and
      this roadmap's own Non-goals say it "supplies the API shape (Phase 2) it
      will need and stops there". Conservative and reversible: the primitive and
      its tests exist, so flipping the default later is a one-line change with
      coverage already in place. -->

- [x] **`_acquire_lock`'s reclaim is a patience check wearing the name of a
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
      <!-- verified 2026-08-20: rewritten in `src/scripts/hooks/state_io.ts` —
      reclamation is now decided by the COMPANION's age (`age_ms >=
      LOCK_STALE_MS`, 30s) and by nothing else; a blocking caller that reaches its
      deadline reports failure instead of evicting. Both named defects are gone:
      the deadline test no longer precedes the sleep (so the sleep is reachable —
      every retry path either sleeps or has just made real progress: the companion
      vanished, or a genuinely abandoned one was removed), and two callers past
      their deadline can no longer evict each other because neither evicts a fresh
      companion at all. Verify pinned in `tests/scripts/hooks/state_io.test.ts`: a
      fresh companion survives a caller that waited the full 5s deadline (which
      then reports `failed` and writes nothing), while an abandoned one is
      reclaimed IMMEDIATELY (<5s, i.e. without waiting out the deadline first).
      Sabotage-verified: restoring the patience check (`Date.now() - start >
      LOCK_ACQUIRE_DEADLINE_MS`) reds 3 tests, including "expected false to be
      true" on the surviving-companion assertion. Scope respected: the
      claim-then-act CRITERION remains `road-to-hook-state-concurrency.md`'s; this
      change is confined to the function that roadmap's criterion does not name. -->

- [x] **The NFS claim is unverified and must not be acted on as stated.** A peer
      reported `openSync(path, 'wx')` as "broken on NFS per `open(2)`" and
      proposed `mkdirSync`. The local BSD manpage says the opposite — it
      recommends `O_EXCL` for exactly this — and the warning is Linux-specific
      and version-bound (old NFS), not categorical. Establish the actual scope
      before any rewrite, and state whether NFS is even in scope for a state tree
      that lives inside the project directory.
      verify: the chosen primitive cites the platform and version its guarantee
      holds on.
      <!-- verified 2026-08-20: scope established, and the proposed rewrite is
      NOT adopted. The guarantee is now stated at the primitive with its platform
      and version — `src/scripts/hooks/state_io.ts:272` "The guarantee this lock
      rests on, and where it holds": local filesystems on macOS/APFS and
      Linux/ext4|btrfs|xfs, Node >= 20.11.0 (`package.json` engines), read on
      Darwin 24.6.0 arm64; native Windows explicitly not claimed
      (`docs/installation.md:951`). The peer's report does not survive checking in
      either direction: the local BSD `open(2)` recommends this exact use ("This
      may be used to implement a simple exclusive-access locking mechanism"), and
      the Linux warning is version-bound to NFSv2 rather than categorical — so the
      honest claim is "unreliable on NFSv2", not "broken on NFS". Is NFS in scope?
      No: this state tree lives inside the project directory
      (`<project>/agents/runtime/state/`, `docs/contracts/agents-layout.md`), so
      its filesystem is the developer's checkout, and an NFSv2 checkout is not a
      configuration this package supports, tests, or has observed. `mkdirSync` is
      therefore not adopted — it would buy nothing on any in-scope filesystem
      while trading a manpage-recommended primitive for one chosen on a mis-stated
      premise. The revisit condition is recorded at the primitive. -->

## Phase 3 — the local test reds nobody had disposed of

Seen while running the full suite for PR #1458: **11 failures across 6 files**,
all of which reproduce with this PR's changes reverted (same test names, only
timings differ) and none of which CI reports. They are local-only reds, which is
precisely why they had no owner — the shipped gate is green, so nothing forces a
look, and every session that runs the suite locally sees noise it learns to
ignore. That is the state this phase ends.

- [x] **Classify each of the 11 before fixing any.** Three plausible classes and
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
      <!-- verified 2026-08-20: classified, but the SET IS NOT THE ONE THIS STEP
      NAMES, and that is the finding. Measured on a fresh worktree at
      origin/main: **32 failures across 5 files**, not 11 across 6. Of the six
      files named here, only `check_artefact_count_messaging` fails in this
      environment; `explain_run`, `build_mcp_registry_manifest`,
      `sweep_dead_scan_roots`, `manual_rule_projection` and `code_graph_refresh`
      all PASS. The 11 were measured in the PR author's environment and do not
      reproduce here, so they are classified as observed rather than as listed.
      Two causes account for all 32:
      (1) **31 failures / 4 files — build-state dependent.** `dist/cli/agent-config.js`
      and `dist/ui/index.html` do not exist; `dist/*` is gitignored
      (`.gitignore:178`) so a clean checkout has never built them.
      `tests/cli/cli-e2e.test.ts` (11), `tests/cli/settings.e2e.test.ts` (9),
      `tests/cli/mcp-server.e2e.test.ts` (8), `tests/ui/build.test.ts` (3). Proven
      by building the three targets and re-running the four files: 32 passed. This
      is a FOURTH class the step's taxonomy does not have — not (a)
      environment-dependent, not (b) working-tree-dependent, not (c) broken — but
      it has class (b)'s shape: a test telling the truth about the wrong question.
      (2) **1 failure / 1 file — class (b), and worse than described.**
      `check_artefact_count_messaging` passes alone and fails in the suite. The
      step predicted "an untracked artefact in the tree changes their answer"; the
      real mechanism is cross-test contamination inside one run.
      `lint_originality.test.ts:118-127` writes seven `command.md` files into the
      REAL tree at `src/domains/__origtest_batch/c1..c7/` (it must — that gate
      classifies by PATH), and vitest runs files in parallel workers, so a
      concurrent counter sees them: the gate's own output is `commands says 200,
      expected 207`. The +7 is exact. Note the direction refutes the plausible
      alternative (an undercount from a swallowed `readdirSync`): the count went
      UP. -->

- [x] **Fix class (a) and (c); give class (b) a fixture root or an explicit
      allow.** A test that reads the developer's working tree and fails on
      untracked files is telling the truth about a wrong question.
      verify: a clean checkout and a checkout with untracked artefacts produce
      the same result.
      <!-- verified 2026-08-20: both causes fixed, neither by weakening an
      assertion.
      Cause (2), the live-tree contamination, is fixed at the classification
      boundary: `_iter_domains_commands` skips `__`-prefixed scratch packs
      (`src/scripts/_lib/agent_src.ts` `_isScratchPack`). A pack id is a validated
      lowercase slug, so `__`-prefixed is not a shippable pack; placing the
      boundary where a path BECOMES a counted artefact fixes it for every counter
      at once, and the count of real artefacts is still asserted exactly.
      Reproduced and confirmed: with two scratch `command.md` files present the
      gate reports `commands=200` (it reported 202 before) and exits 0. Pinned
      hermetically in `tests/scripts/symlink_confinement_walkers.test.ts` (8
      passed) using the existing `_setRootsForTest` tmpdir harness — so the pin
      cannot become the thing it pins — including a case asserting the prefix is
      checked on the PACK segment only, so a real pack with a `__` subpath is
      still counted. Sabotage-verified: removing the skip reds it. Checked before
      shipping: no existing pack uses a `__` prefix, and `lint_originality` does
      not consume these walkers, so its own batch test is unaffected.
      Cause (1), the build-state class, is fixed by BUILDING rather than skipping:
      `tests/_lib/ensure-build-artefacts.ts`, wired as `globalSetup` in
      `vitest.config.ts:39`, builds each missing artefact once in the main process
      before any worker spawns (so four parallel files cannot race four builds
      onto one output path). This is the house pattern, not a new one —
      `cli-e2e.test.ts`'s own `beforeAll` already builds the gitignored discovery
      manifest when absent, for this reason. Absent only, never stale; a no-op in
      CI, where `.github/workflows/tests.yml:227` runs `npm run build` before
      `npm run test:ts`, so a genuinely broken build still fails at the build step
      and cannot hide behind the shim.
      The step's verify is met literally: `dist/cli` + `dist/ui` + `dist/mcp`
      deleted to reproduce a clean checkout, the four files then produced the same
      `32 passed` as a built tree, with the shim's three build lines on stderr. -->

- [x] **Then make the whole-suite state legible.** Right now "15500 passed, 11
      failed" is indistinguishable from a regression at a glance, so nobody
      glances. Either the 11 reach zero, or the known set is named somewhere a
      run can be compared against.
      verify: a full local run either is green, or names exactly which failures
      are expected and why.
      <!-- verified 2026-08-20: it reaches ZERO, so there is no known-failing set
      to name and no list that can rot. Measured on this worktree, three full
      `npx vitest run` runs:
        - BEFORE:  `Test Files 5 failed | 1136 passed` · `Tests 32 failed | 15515 passed` · exit 1
        - INTERIM: `Test Files 2 failed | 1139 passed` · `Tests  2 failed | 15564 passed` · exit 1
        - AFTER:   `Test Files 1141 passed | 2 skipped` · `Tests 15566 passed | 21 skipped` · exit 0
      The two interim failures were both caused by this change and are worth
      recording rather than smoothing over:
        (a) `payload_optin.test.ts:359` hand-spelled the feedback directory as
            `.dispatcher/e2e` — a real caller of the Phase 1 layout change that
            the first sweep missed. Fixed by deriving the path from
            `feedback_dir` instead of spelling it, which is the right shape
            independently of this change.
        (b) `witness/reach_doctor_readonly.test.ts` reported
            `tracked: mutated: agents/roadmaps/archive/road-to-hook-state-followups.md` —
            a FALSE red with a real cause: that witness watches the whole
            worktree for mutations, and this roadmap file was being edited while
            the run was in flight. Green on a stable tree (6 passed), re-verified
            in isolation. No code involved; the lesson is that a suite run and a
            tree edit cannot overlap, which is the same shared-state hazard
            Phase 3 is about. -->

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
