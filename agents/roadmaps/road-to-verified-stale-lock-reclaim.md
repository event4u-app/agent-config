---
complexity: lightweight
status: ready
review_by: 2026-12-09
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Carries a defect found in review of the session-pins change (council rounds 54-55) that exists on main at five sites; that change completes no roadmap it could archive, and parking this one would drop a known data-race fix, so it lands without an offset."
estate_growth_exempt: "Created under fix-what-you-see from council rounds 54 and 55 of the session-pins Phase 2 change (feat/session-pins-phase-2). Round 55 judged the in-branch fix unsafe and asked for the lock work in its own change; the branch was reverted to the pre-existing behaviour and the whole defect, all five sites, moved here."
relates:
  - slug: road-to-state-and-pins-across-compaction
    relation: extends
    note: "Its Phase 2 review surfaced the defect; that change carries no lock fix."
---
# Road to verified stale-lock reclaim

> **Source:** council rounds 54 and 55 of the session-pins Phase 2 change; tree
> facts verified on 2026-11-09. No owner existed: a grep over
> `agents/roadmaps/{*,later,stubs}` for `_acquire_lock|LOCK_STALE_MS|stale-lock reclaim`
> finds only `road-to-state-and-pins-across-compaction`, whose step 2.5 records the
> round-56 point and carries no lock work.

## Goal

No file lock in `src/scripts` lets two callers hold it at once because of a
stale-lock break or a release, under any interleaving of three contenders.

## Context

- **The defect.** Five locks break a stale lock by stat-then-remove: they read
  the lock's `mtimeMs`, then `rmSync` / `unlinkSync` the path. The remove
  deletes whatever sits there by then. Two callers that see the same abandoned
  lock can both break it: the first acquires a fresh lock, the second removes
  it and acquires too. Each release is unconditional, so a holder paused past
  the stale threshold removes the lock of the peer that broke its own.
- **Sites (verified 2026-11-09).** `hooks/state_io.ts` `_acquire_lock` (~442,
  ~460) and `_release_lock` (~497); `language_mirror_hook.ts`
  `_withToolWriteLock` (~908, release below it); `_lib/egress_session_table.ts`
  (~190); `ai_council/budget_guard.ts` (~656); `_lib/project_registry.ts` (~134,
  a `mkdirSync` directory lock).
- **Rejected shape (round 55).** Rename the lock aside, judge the renamed file
  by `dev`/`ino`/age, link it back on a failed judgement. Two defects: the path
  is empty during the rename, so a third caller can create a lock; the link-back
  then fails with `EEXIST` and two holders overlap. And a link-back failing for
  any other reason (`EACCES`) followed by removing the aside file deletes a live
  lock silently. Its retry after a successful break also had no deadline.
- **What Phase 1 settles first.** Node exposes no `flock`/`fcntl`, so a pure
  filesystem protocol may not close the three-contender window at all. Step 1.1
  measures that before 1.2 designs anything; how the answer is decided is
  recorded as D1 below.

## Phase 1 — protocol decision

- [ ] 1.1 Write a deterministic three-contender harness (injection points between every stat, rename, link and remove; no timing) and run it against the current `state_io.ts` lock to record which interleavings admit two holders.
- [ ] 1.2 Decide the protocol from the harness: a filesystem protocol that passes every interleaving, or a lease with owner token plus fencing on the write, or a native lock dependency. Record the decision with the rejected shape above and the residual window, if any, stated.

## Phase 2 — the five sites

- [ ] 2.1 `hooks/state_io.ts` acquire and release: the decided protocol, the 1.1 harness green, a link-back or restore failure never deletes a live lock, every retry bounded by the 5 s deadline and the non-blocking contract.
- [ ] 2.2 `language_mirror_hook.ts` `_withToolWriteLock`: same protocol, same harness.
- [ ] 2.3 `_lib/egress_session_table.ts` and `ai_council/budget_guard.ts`: same protocol, same harness.
- [ ] 2.4 `_lib/project_registry.ts`: the directory lock, with the protocol extended to directories first.
- [ ] 2.5 Sibling search: `grep -rnE "statSync\((lock|lockPath|held)\)\.mtimeMs" src/scripts` returns 0 matches outside the shared helper.

## Closes when

Every step is `[x]`, each site's harness run was seen red before its fix, and
the 2.5 search reports zero matches.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | evidence | Whether a pure filesystem protocol can close the three-contender window is answered by the 1.1 harness, not by design. If no protocol survives it, 1.2 chooses between a native advisory lock, a single-writer process, and documenting the residual race, and records the choice here. | council rounds 54 and 55 (the rejected rename-aside shape); Node has no `flock`/`fcntl` | Node ships a portable advisory file lock |
