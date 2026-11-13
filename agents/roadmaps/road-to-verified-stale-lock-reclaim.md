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
>
> **Arrivals:** 1 — latest `inbox-2026-11-wo` (2026-11-10): an external review grades the generation lock P0 and asks for fencing or guarded writes before it reaches the five sites. 2.6 carries it.

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

- [x] 1.1 Write a deterministic three-contender harness (injection points between every stat, rename, link and remove; no timing) and run it against the current `state_io.ts` lock to record which interleavings admit two holders. <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      Done 2026-11-09: `tests/scripts/state_io_lock_interleavings.test.ts`. One schedule admits two holders on the non-strict path — A's stale-break remove landing while B holds, then C beside B — plus the paused-holder release race; the strict path admits none (`agents/evidence/analysis/state-io-lock-interleavings-2026-11-09.md`).
      reach exempt: a test-only harness over the shipped `update_text_under_lock`; it adds no production symbol, and Phase 2 flips its pinned violation list to empty.
- [x] 1.2 Decide the protocol from the harness: a filesystem protocol that passes every interleaving, or a lease with owner token plus fencing on the write, or a native lock dependency. Record the decision with the rejected shape above and the residual window, if any, stated. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/generation_lock.ts -->
      Done 2026-11-09: the generation lock (`src/scripts/_lib/generation_lock.ts`) — a stale break creates `held.<g+1>` with `O_EXCL` and removes only lower generations; a release ages its own generation instead of removing it. No double grant over every three-caller schedule (≤ 3 preemptions); the explorer finds the double grant in today's stat-then-remove shape and in a remove-on-release variant. Residual: a paused holder beside its superseder (D1).
      reach exempt: the protocol has no production caller until 2.1 wires it into `hooks/state_io.ts`; the dispatch bundle is a ratified budget surface, so that wiring carries its own byte figure.

## Phase 2 — the five sites

- [x] 2.1 `hooks/state_io.ts` acquire and release: the decided protocol, the 1.1 harness green, a link-back or restore failure never deletes a live lock, every retry bounded by the 5 s deadline and the non-blocking contract.
      Done 2026-11-13: `_acquire_lock` calls `acquire` from `_lib/generation_lock.ts`; the release ages its generation. The helper grew a waiting `acquire` whose deadline counts sleep (so it bounds attempts too), best-effort removal of lower generations, and generation 0 named after each site's existing guard (`<lock>.held` here; an older process sees a generation-0 holder, though mixed versions on one lock are not excluded), a listing failure that throws instead of reading as no generation, and `breakStale: false`: a strict caller (session pins) still never supersedes a guard that went stale while held, and takes over a released one. Ratification round 1 refused 2/2 and named those last two; both are fixed with tests. Round 8 found that a pruner retiring a lock family restarts generation numbering under a caller that still holds an old listing; a superseder now rechecks, after its create, that the generation it superseded is still the stale one it judged, and the step explorer gained a pruner actor and two sabotaged variants it must catch (no recheck; a recheck by name only). Round 9 found the pruner itself was a stat-then-remove breaker when it removed the whole family; the pruners now keep the highest generation, the explorer's pruner runs one filesystem step per action (one or two at once, no second holder from any start), and round 9's schedule is a scripted regression test (two holders with a whole-family pruner, one with the shipped one). Round 10 (split 1-1) found that a caller backing off removed its own generation, which could be the highest, so the family could still empty; backing off now releases it instead, so nobody removes the highest generation, and that schedule is a scripted test too. The 1.1 harness list is empty; the generalised harness `tests/scripts/lock_sites_interleavings.test.ts` (every `fs` call on the guard an injection point, three callers, an abandoned start and a paused-holder start) was run red first on `24f323151a`: non-blocking `A@8 break-lands-in-B → B+C`, `A@7 release-lands-in-B → B+C`, and the blocking variant red on both starts. Green after; the blocking variant is not kept in the suite (its 2,500-spin wait per nested schedule; the test file says why).
- [x] 2.2 `language_mirror_hook.ts` `_withToolWriteLock`: same protocol, same harness.
      Done 2026-11-13: `tryAcquire` on `<state>.lock` (one attempt, as before). Red first: `A@6 break-lands-in-B → B+C`, `A@5 release-lands-in-B → B+C`; green after.
- [x] 2.3 `_lib/egress_session_table.ts` and `ai_council/budget_guard.ts`: same protocol, same harness.
      Done 2026-11-13: both on `acquire` with their own waits (egress 1 s, ledger 3 s). Red first: egress `A@6 break-lands-in-B → B+C` and `A@5 release-lands-in-B → B+C`; ledger `A@8 break-lands-in-B → B+C` and `A@7 release-lands-in-B → B+C`. Green after.
- [x] 2.4 `_lib/project_registry.ts`: the directory lock, with the protocol extended to directories first.
      Done 2026-11-13: `dir: true` makes each generation a `mkdir`; `registry.lock` stays generation 0. Red first: `A@6 break-lands-in-B → B+C`, `A@9 release-lands-in-B → B+C`; green after.
- [x] 2.5 Sibling search: `grep -rnE "statSync\((lock|lockPath|held)\)\.mtimeMs" src/scripts` returns 0 matches outside the shared helper and the ratified `code_graph/refresh_lock.ts` (exception added 2026-11-13, reason below).
      Done 2026-11-13: the search found three sites this step did not list. `advisories.ts` (the rename-aside shape round 55 rejected) and `ai_council/cli_call_budget.ts` (whose break compared `performance.now()` with an epoch mtime and so never fired) moved to the generation lock. The one remaining match, `code_graph/refresh_lock.ts:145`, is a different mechanism and stays: the stale judgement there is repeated under a second `mkdir` mutex, a release is nonce-checked, and its interleaving tests were ratified on 2026-10-24. A wider search for the defect class (exclusive create plus remove or rename) found one more rename-aside lock, `worktree_cleanup_check.ts` `takeRemovalLock`, moved too, and four that Phase 3 carries. These three converted sites (`advisories`, `cli_call_budget`, `worktree_cleanup_check`) are not in the site harness and were not run red first; they rest on their own suites, the helper's step explorer, and for the CLI budget a test that an abandoned lock is superseded at once (on origin/main it waited out the second and proceeded unlocked). A release now ages a lock file instead of removing it, so the session-state and egress-table pruners remove a retired file's lock generations with it — every one but the highest, which stays as one empty file per retired lock (ratification round 9: removing it restarts the numbering, and judging it stale first is the stat-then-remove race again); 3.6 carries that residue.
- [x] 2.6 Fencing, or the limit named where the lock is used: either each of the five sites passes the held generation into its write and the write refuses a stale generation, or each site's header states that a holder paused past `staleMs` keeps writing after it is superseded (`_lib/generation_lock.ts` header, "What it does not do", states it for the helper only). Round inbox-2026-11-wo.
      Done 2026-11-13, the second option: each of the eight call sites states the unfenced limit at the lock, with what narrows it there (a millisecond critical section, the pin re-read, `git worktree remove` re-checking).

## Phase 3 — the same defect class outside the grep

Found by the 2.5 wider search on 2026-11-13; each keeps its own liveness rule (a pid, a lease), so each needs its own harness run rather than a mechanical swap.

- [ ] 3.1 `_lib/roadmap_slug_lock.ts` (~190): rename-aside on a lock judged dead, plus a `write_atomic` overwrite when the read lands between a peer's create and its write.
- [ ] 3.2 `_cli/upgrade_unattended.ts` (~214): rename-aside on a lock judged dead; the put-back `linkSync` fails with `EEXIST` and displaces a newer holder.
- [ ] 3.3 `_lib/collector_supervision.ts` (~417): a dead incumbent pid, then remove and re-create; two fencers that judged one pid can both win.
- [ ] 3.4 `quota_notice_hook.ts` (~99, ~276): claim markers expired by age and removed before the exclusive create; two callers re-claiming one key after eight days can both win.
- [ ] 3.5 `_lib/generation_lock.ts` `tryAcquire`: a listing that throws after this caller's create leaves its fresh generation behind with no holder; a strict caller then never supersedes it until the retention prune releases it. Expire the created generation before rethrowing (R2 completion review, finding 3; deferred because the helper is a ratified hook-plumbing file and the fix carries its own byte figure).
- [ ] 3.6 Retire a lock family whole: the pruners leave the highest generation of each retired lock (one empty file per lock per retired session, and every listing reads the directory they sit in). Removing it needs a retirement step that excludes in-flight acquirers, or generation names that are never reused (R2 completion review finding 1, ratification round 9).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-13 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A green harness that missed an interleaving | implementation | The race only shows under one ordering of stat, rename, link and remove across three contenders; a harness that samples timings can pass while the window stays open. | Deterministic injection points between every filesystem call, no timing (1.1); every recorded interleaving that admits two holders becomes a regression case. | Phase 1 — protocol decision |
| 2 | Trading the race for a deadlock | implementation | A protocol that never breaks a stale guard cannot double-grant, but a dead holder then blocks its callers for good, as the strict pin callers do today. | 1.2 records the residual per site and which callers may block; each site in Phase 2 states its choice and tests it. | Phase 2 — the five sites |
| 3 | A native lock breaks the install | product | A native advisory-lock addon would add a compiled dependency to a package consumers install with npx. | D1 weighs it against a single-writer process and a documented residual; no native dependency without its install matrix green. | Decisions |
| 4 | A superseded holder keeps writing | implementation | A holder paused past `staleMs` writes after a peer has taken a higher generation; the lock alone cannot stop that write. | 2.6 either fences each write with the held generation or names the limit at every site | Phase 2 — the five sites |
| 5 | A pid-keyed lock swapped mechanically | implementation | The Phase 3 locks judge liveness by pid or lease, not by age alone; replacing them with the age-only generation lock would break a live holder that is merely slow. | Each 3.x step keeps its liveness rule and runs the site harness red first. | Phase 3 — the same defect class outside the grep |

## Closes when

Every step is `[x]`, the harness run of each of the five sites steps 2.1-2.4 name was seen red before its fix (the sites 2.5 added are covered as 2.5 states), and
the 2.5 search reports zero matches outside the helper and the ratified
`code_graph/refresh_lock.ts` (2.5).

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | evidence | A filesystem protocol survives: the generation lock. No native dependency and no single-writer process. Residual, documented: a holder paused past `LOCK_STALE_MS` runs beside its superseder (a lease without fencing). | council rounds 54 and 55 (the rejected rename-aside shape); Node has no `flock`/`fcntl` | Node ships a portable advisory file lock |
