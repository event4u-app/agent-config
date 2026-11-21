---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
execution:
  mode: autonomous
estate_growth_exempt: "Owner instruction of 2026-11-21 to plan and execute every measure of the session retrospective; this file carries P1 measure 12 and adds one active roadmap."
estate_offset_exempt: "road-to-shared-task-identity-across-sessions is added on the owner's order of 2026-11-21 to plan every measure of that day's session retro as its own roadmap. No active roadmap is finished, so none was archived to offset it, and folding it into a parked later/ roadmap would hold asked-for work behind that roadmap's entry condition. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
relates:
  - slug: road-to-verified-stale-lock-reclaim
    relation: disjoint
    note: "Its open 3.1 owns the acquire path of _lib/roadmap_slug_lock.ts (rename-aside at ~190); this file only reads locks (read_locks, holder_is_live) and the takeover text in sessions_cli.ts, and changes no lock protocol."
  - slug: road-to-state-and-pins-across-compaction
    relation: disjoint
    note: "Its pins are per-session user constraints carried across one session's compaction; this file carries owner decisions across peer sessions and reads no pin file."
  - slug: later/road-to-roadmaps-finished-before-new-ones-start-carried
    relation: disjoint
    note: "Its 6.3 owns end-of-life checkpoints for every lane; step 2.5 here only names the dead holder's open PR on takeover and writes no checkpoint."
  - slug: stubs/road-to-runtime-orchestration-substrate
    relation: disjoint
    note: "Its gated 'workspace lease manager' row opens on a recorded contention failure the current tooling did not prevent; 1.1 here produces that record but this file builds no lease manager and no control store (D1)."
  - slug: road-to-stop-hooks-that-count-own-edits
    relation: disjoint
    note: "Retro P0 measure 6; owns attributing edits to a session (its D4, candidate B a per-session ledger on pre_tool_use). Steps 2.2 and 5.1 here reuse that ledger when D4 chose B instead of adding a second one."
  - slug: archive/road-to-roadmap-situational-awareness
    relation: extends
    note: "Builds on its owned_paths field and collision axes in the session register."
  - slug: archive/road-to-shared-design-tokens
    relation: disjoint
    note: "Probe hit on the words 'shared' and 'identity' only; design tokens, no common file."
# relates: probe — `roadmap:context --roadmap road-to-shared-task-identity-across-sessions --relates`
# (2026-11-21) returned one slug-keyword hit (archive/road-to-shared-design-tokens). The other
# rows come from the semantic half: grep over agents/roadmaps for 'sessions:claim',
# 'roadmap_slug_lock', 'parallel session', 'duplicate PR', 'owner-questions.md', bodies read.
---
# Road to shared task identity across sessions

> Two sessions on one repository cannot open two pull requests for the same roadmap step
> without one of them being told before the PR exists, a dead session's claim hands its
> branch and open PR to the next one instead of a re-do, an owner decision taken in one
> session is visible to its live peers before it merges, sequential ids are allocated
> without renumbering, and a session cannot pop a stash entry it did not push without a
> warning.

> **Source:** the owner's session retrospective of 2026-11-21 (about 380 Claude Code
> sessions across the owner's repositories), pattern F ("collisions of parallel sessions",
> found in at least 14 chunks) and P1 measure 12, plus the AI council round of the same day
> (members: anthropic, openai). The openai member: date-plus-slug ids do not prevent
> duplicate work; that needs a shared task identity and recovery of orphaned claims, and
> one duplicate PR must be reproduced before hooks change. Incident figures below are
> quoted from the retro transcripts, PR facts re-read with `gh pr view` on 2026-11-21.

## Goal

The three duplicate-PR shapes the retro recorded, replayed as fixtures, each produce a
warning before `gh pr create` returns; a takeover of a dead holder's slug names that
holder's open PR; `agent-config sessions:decisions` lists owner decisions recorded in a
live peer worktree and not yet on `origin/main`; two concurrent id allocations for
`OQ` or `ADR` return two different numbers; a bare `git stash pop` on an entry this session
did not push warns. A 14-day reading after landing counts duplicate PRs and renumber
commits against the baseline of 1.1.

## Prerequisites

- [ ] Read `src/scripts/_lib/session_register.ts` (header, lines 1-70), `src/scripts/_lib/roadmap_slug_lock.ts` (header, lines 1-28) and `src/domains/product-basic/roadmap/next/command.md` § 3b.
- [ ] `node_modules` present in the working tree (`./scripts-run` needs `node_modules/.bin/tsx`).

## Context

**What exists (verified 2026-11-21 at `811cea61d6`).**

- A shared session register: `<git-common-dir>/agent-sessions/<session>.json`, one writer per
  file, heartbeat in `last_seen`, TTL per host (`session_register.ts:83-125`). Each record
  carries `worktree`, `branch`, `roadmap_slug`, optional `owned_paths`
  (`session_register.ts:209-266`). Its header states it is advisory, not a mutex (`:51`).
- An exclusive per-slug lock: `<git-common-dir>/agent-claims/by-slug/`, created with `wx`,
  liveness from the holder's register record (`roadmap_slug_lock.ts:1-28`, `acquire_lock`
  at `:149`). `sessions:claim` takes it and on takeover prints "Its previous holder is
  dead; its work sits in <worktree> — continue there" (`sessions_cli.ts:657-667`).
- The claim is **model-carried**: `/roadmap:next` asks for `sessions:claim` and states that
  nothing forces the invocation (`roadmap/next/command.md:216`). `/roadmap:process-*` and
  free-form prompts take no claim at all. The claim key is the roadmap slug, never the step.
- `session_pr_watch.ts` tracks only the PRs this session opened (`:1-26`); nothing compares
  a new PR against a peer's open or just-merged PR.
- `check_owner_question_ids` detects a duplicate `OQ-<n>` heading after the merge
  (`check_owner_question_ids.ts:1-12`, run in `.github/workflows/consistency.yml:432`); no
  allocator exists. `adr-create` step 2 takes `max + 1` from the local tree
  (`src/skills/adr-create/SKILL.md:125`). `agents/owner-questions.md` carries two
  "Renumbered" notes today.
- `git_command_classifier.ts` classifies `stash-drop` (warn set, `:156`, `:321`), not
  `stash pop` / `stash apply`.
- Owner decisions land as `agents/evidence/owner-directives/*.md` (40 files) and as
  `## Answered` entries in `agents/owner-questions.md`; a peer session sees either only
  after it merges.

**Incidents (retro transcripts).**

| Incident | Shape | Fact |
|---|---|---|
| #2265 / #2266 (2026-10-07) | an orchestrator lane died at the spend limit; a parallel session opened #2266 on the same roadmap | "claim files are from August, worthless"; #2266 merged, #2265 closed |
| #2533 / #2534 (2026-10-20) | two sessions built one roadmap, ten conflicting files | motivated the slug lock (`roadmap_slug_lock.ts:4-9`) |
| #2886 / #2887 (2026-11-06) | same step "proof-where 3.2", branches `feat/proof-where-3-2` and `feat/minimal-prompt-arm` | after the slug lock existed; #2887 closed as duplicate 11 min after #2886 merged |
| OQ renumbering | OQ-12, OQ-14..16, OQ-22..24, OQ-28/29, OQ-36/37 taken on `main` meanwhile; roadmap D13 and ADR-292 likewise | each renumber rewrote every reference |
| foreign stash | `stash push` saved nothing, the following `pop` took another session's entry | recovered by hand |
| "invented" owner decision (~2026-10-14, PR #2327) | an agent accused a peer session of inventing an owner decision the owner had taken in that peer session | decision not visible across sessions |

**Delta this file owns.** Task identity below the slug, a deterministic (hook-carried)
claim, a duplicate screen at PR creation, the open PR on takeover, a cross-worktree view of
unmerged owner decisions, an id allocator, a stash-ownership warning. **Not here:** the
stop hook counting other sessions' diffs (retro measure 6, `road-to-stop-hooks-that-count-own-edits`); the lock
protocol (`road-to-verified-stale-lock-reclaim`); lane checkpoints
(`road-to-roadmaps-finished-before-new-ones-start-carried` 6.3).

**Owner constraint (2026-11-21).** No hand-maintained or owner-written context file. Every
view this file adds is computed on demand from the register, the worktrees, git refs and
`gh`; nothing is a curated list.

## Phase 1 — Reproduce before building

- [ ] **1.1 Classify the three duplicate-PR pairs.** For each pair, find the opening
      sessions by grepping the host transcript directory (`$CLAUDE_CONFIG_DIR/projects/<repo-key>/*.jsonl`)
      for the PR URL, then record per session: claim taken (`sessions:claim` in the
      transcript), slug held, holder live at PR time, screen run. Class per pair, one of:
      `no-claim`, `different-slug`, `expired-holder`, `legacy-claim-path`, `claim-held-screen-skipped`.
      Write `agents/evidence/analysis/parallel-duplicate-prs-2026-11.md` with a row per pair,
      plus the baseline count: duplicate pairs and `git log --grep -i renumber` commits over
      the 30 days before 2026-11-21.
      verify: `grep -cE '^\| #(2265|2533|2886) ' agents/evidence/analysis/parallel-duplicate-prs-2026-11.md` -> 3
- [ ] **1.2 Reconstruct the #2327 owner-decision timeline.** From the transcripts: which
      session the owner answered in, when, which file (if any) recorded it, when that file
      reached `origin/main`, and when the other session called it invented. Classify:
      `tracked-in-peer-worktree` (a cross-worktree view would have shown it) or
      `chat-only` (capture needed, 3.3). Append the row to the 1.1 evidence file.
      verify: `grep -cE 'tracked-in-peer-worktree|chat-only' agents/evidence/analysis/parallel-duplicate-prs-2026-11.md` -> 1
- [ ] **1.3 Council on the design.** Write `agents/evidence/council/shared-task-identity-2026-11.question.md`
      with the 1.1/1.2 rows attached and four questions: (a) task key — slug, or
      `<slug>#<step>`; (b) placement — new `pre_tool_use` concern beside `block_no_verify`,
      the `session-register` concern, or the per-session ledger of
      `road-to-stop-hooks-that-count-own-edits` D4, each with a measured bundle-byte figure; (c) screen
      severity at `gh pr create` — warn, or refuse; (d) whether 3.1's view and 3.3's capture
      pass the ADR-124 § 6 state-store test (`docs/decisions/ADR-124-embedded-engine-doctrine.md:202`).
      Run `agent-config council:run <question-file> --confirm`; write the verdict as rows D6-D9.
      verify: `test -f agents/evidence/council/shared-task-identity-2026-11.md` -> 0

## Phase 2 — Task identity: claimed by the hook, screened at PR creation, recovered from the dead

- [ ] **2.1 Derive the task id from the branch.** Test first:
      `tests/scripts/task_identity.test.ts` — a fixture repo whose branch flips the checkbox
      `3.2` in `agents/roadmaps/road-to-x.md` yields `road-to-x#3.2`; a branch touching no
      roadmap yields none; a `Task: <slug>#<step>` line in a PR body wins over the diff. Run
      red, then add `src/scripts/_lib/task_identity.ts` (key per D6).
      verify: `npx vitest run tests/scripts/task_identity.test.ts` -> 0
- [ ] **2.2 Claim from the hook, not the model.** Test first: a `post_tool_use` Edit that
      flips a checkbox in `agents/roadmaps/<slug>.md` takes the slug lock through
      `acquire_lock` when it is free and injects one warning line naming the holder,
      its worktree and branch when a live foreign holder has it. No lock taken on a
      non-checkbox edit. Red first; placement per D7.
      verify: `npx vitest run tests/scripts/task_claim_hook.test.ts` -> 0
- [ ] **2.3 Screen `gh pr create`.** Test first: with `gh` stubbed to return open PRs and
      PRs merged in the last 24 h (one GraphQL query, 8 s timeout, failure-open), a
      `gh pr create` whose task id matches another PR's, or whose slug a live foreign holder
      locks, emits the D8 outcome naming that PR. Fixtures replay #2886/#2887 (same step,
      different branch names) and #2265/#2266 (same slug, dead lane). Red first.
      verify: `npx vitest run tests/scripts/pr_create_duplicate_screen.test.ts` -> 0
- [ ] **2.4 Carry the task id in PR bodies.** Add a `Task: <slug>#<step>` line as the first
      line of the end-of-run PR body in `src/agent-src/contexts/execution/process-full-delivery.md`
      § "The PR body is one page for the owner's review" (8.2), which `/roadmap:next` and
      `/roadmap:process-full` both deliver through; run `task sync` and `task generate-tools`.
      verify: `grep -c 'Task: <slug>#<step>' src/agent-src/contexts/execution/process-full-delivery.md` -> 1

- [ ] **2.5 Name the dead holder's open PR on takeover.** Test first in
      `tests/scripts/sessions_cli_takeover.test.ts`: when `sessions:claim` supersedes a dead
      holder, the output adds the open PR on that holder's branch (`gh pr list --head <branch>
      --state open --json number,url`, failure-open, omitted when `gh` fails). Red, then edit
      the takeover text in `src/scripts/sessions_cli.ts` (~657-667). No change to
      `roadmap_slug_lock.ts`.
      verify: `npx vitest run tests/scripts/sessions_cli_takeover.test.ts` -> 0
- [ ] **2.6 Stop reading stale legacy claim files.** First action: run the register hook
      against a fixture holding `agents/runtime/state/roadmap-claim-<id>.json` older than
      the host TTL with no register record and record whether it is still read as a claim.
      If read: test first, then prune it at `session_start` in `session_register_hook.ts`;
      if not read: write the observation as the Done line.
      verify: `npx vitest run tests/scripts/session_register.test.ts -t "legacy claim"` -> 0

## Phase 3 — Owner decisions visible to live peers

- [ ] **3.1 `agent-config sessions:decisions`.** Test first: a fixture with a live peer
      record whose worktree holds an uncommitted `agents/evidence/owner-directives/x.md`
      and an added `## Answered` entry in `agents/owner-questions.md` lists both with
      session id, worktree and path; an expired peer lists nothing; a peer worktree that is
      gone is skipped. Read-only over files already in the peers' trees (diff against
      `origin/main`); no store. Red, then add the subcommand in `src/scripts/sessions_cli.ts`.
      verify: `npx vitest run tests/scripts/sessions_decisions.test.ts` -> 0
- [ ] **3.2 Surface it at session start.** Test first: when 3.1's list is non-empty the
      `session-register` concern's `session_start` block adds one line — count plus
      `agent-config sessions:decisions` — at most 200 bytes; empty list adds nothing.
      Record the bundle-byte delta in `src/config/hook-bundle-budget.json` per its own rules.
      verify: `npx vitest run tests/scripts/session_register.test.ts -t "peer decisions"` -> 0
- [ ] **3.3 Capture chat-only answers.** If 1.2 classified `tracked-in-peer-worktree`,
      close this step with that row as evidence. Otherwise, test first: a `user_prompt_submit`
      text starting with `OQ-<n>` followed by an answer records `{id, answer_head ≤ 200 chars, at}`
      in this session's register record (`owner_answers`), and 3.1 lists it. Shape per D9.
      verify: `npx vitest run tests/scripts/session_register.test.ts -t "owner answers"` -> 0

## Phase 4 — Ids allocated without renumbering

- [ ] **4.1 Allocator.** Test first: `tests/scripts/id_allocate.test.ts` — `main` has OQ-55,
      a remote branch adds OQ-56, a live peer worktree holds an uncommitted OQ-57: the next
      id is 58; two concurrent calls get two ids, each reserved by a `wx` file under
      `<git-common-dir>/agent-claims/ids/oq-<n>`; same for `ADR-<nnn>` over
      `docs/decisions/`. Red, then add `agent-config ids:next oq|adr` (new
      `src/scripts/id_allocate.ts`, CLI entry beside `sessions_cli.ts`).
      verify: `npx vitest run tests/scripts/id_allocate.test.ts` -> 0
- [ ] **4.2 Use it where ids are picked.** Replace the `max + 1` instruction in
      `src/skills/adr-create/SKILL.md` step 2 with the command, and add one line to the
      header of `agents/owner-questions.md` naming it; run `task sync` and
      `task generate-tools`.
      verify: `grep -c 'ids:next' src/skills/adr-create/SKILL.md` -> 1
- [ ] **4.3 Catch a taken id before the merge.** Test first: `check_owner_question_ids
      --against origin/main` exits 1 when the branch adds an `OQ-<n>` heading that
      `origin/main` already carries for another question. Add it to the pre-push set.
      verify: `npx vitest run tests/scripts/check_owner_question_ids.test.ts -t "against"` -> 0

## Phase 5 — A stash entry belongs to the session that pushed it

- [ ] **5.1 Record and check stash ownership.** Test first: after `git stash push` in
      session A, the entry's SHA lands in `<git-common-dir>/agent-session-stash/<A>.json`;
      in session B a bare `git stash pop` / `git stash apply` (or `stash@{0}`) on that entry
      returns a warning naming the entry and the `git stash apply <sha>` pattern; A's own
      pop passes silently. Add `stash-pop` to `git_command_classifier.ts` in the warn set
      beside `stash-drop`; placement per D7. Red first.
      verify: `npx vitest run tests/scripts/stash_ownership.test.ts` -> 0

## Phase 6 — Measure the outcome

- [ ] **6.1 Re-read after 14 days.** Re-run the 1.1 classification over PRs opened in the 14
      days after the last of 2.3, 3.2 and 5.1 merged; count duplicate pairs, `renumber`
      commits and stash warnings fired. Pre-registered target: 0 duplicate pairs where both
      sessions ran with the hooks, and no renumber commit for an id `ids:next` issued.
      Append to the 1.1 evidence file. <!-- blocked-by: post-landing-window -->
      verify: `grep -c '^## Reading after landing' agents/evidence/analysis/parallel-duplicate-prs-2026-11.md` -> 1

<!-- Release holds — none. No intermediate tree state of this roadmap is unpublishable.

     guarded: every screen this file adds is a warning or a read-only command that fails
     open (2.2, 2.3, 3.2, 5.1); the allocator (4.1) is unused until 4.2 wires it in the same
     phase, and the pre-push check (4.3) lands with its test. Each phase leaves the tree
     releasable.
-->

## Blockers

### blocker: post-landing-window
- **Status:** open
- **Owner:** implementer
- **Blocks:** Phase 6 — Measure the outcome
- **Recommendation:** run 6.1 on the first day 14 days after the last of 2.3, 3.2 and 5.1 merged; nothing else waits on it.
- **If you do nothing:** the mechanisms work but their effect on duplicate PRs and renumbering stays unmeasured.
- **What to do:**
  1. `gh pr list --state all --search "created:>=<landing-date>" --json number,title,headRefName,createdAt,closedAt,mergedAt --limit 300`
  2. Apply the 1.1 classification and append `## Reading after landing` to `agents/evidence/analysis/parallel-duplicate-prs-2026-11.md`.
- **Resolved when:** 14 days have passed since the last of 2.3, 3.2 and 5.1 merged.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Extend the register, the slug lock and read-only views; no lease manager, no authoritative cross-session store. | ADR-124 § 6 state-store test (`ADR-124:202`); the substrate stub's lease-manager row is gated | 1.1 classifies a pair `claim-held-screen-skipped` with both screens in place |
| D2 | reversible-technical | agent | Ids stay numeric (`OQ-<n>`, `ADR-<nnn>`); collisions close through the allocator, not a new id format. | The owner answers questions by number in `agents/owner-questions.md`; a format change moves that surface | the allocator issues a colliding id across two machines |
| D3 | reversible-technical | agent | No kernel-rule edit; the carriers are hooks, the `session_start` line and commands. | Kernel rules take a separate slow rollout (`scope-control` § Kernel-rule edits) | 6.1 shows peers still contradict decisions the view listed |
| D4 | deterministic | evidence | The stop hook counting other sessions' diffs is out of scope. | Retro P0 measure 6 owns it in `road-to-stop-hooks-that-count-own-edits` | that roadmap is skipped |
| D5 | reversible-technical | agent | Steps 2.5 and 2.6 change no lock protocol; lock correctness stays with `road-to-verified-stale-lock-reclaim`. | Its open 3.1 edits `roadmap_slug_lock.ts:190` | that roadmap closes 3.1 by moving takeover into this file's scope |

D6-D9 are written by step 1.3 from the council verdict.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Building for the wrong cause | product | If 1.1 shows the duplicates came from skipped claims only, step keys and screens add cost without closing the gap. | 1.1 and 1.2 run before any build; the council in 1.3 decides the key and severity on that evidence. | Phase 1 — Reproduce before building |
| 2 | A new gate the owner has to route around | product | The retro's measure 10 removes blocking gates; a refusing screen at `gh pr create` repeats that friction. | Warn by default (D-row from 1.3); every screen fails open when `gh` or the register is unreachable. | Phase 2 — Task identity: claimed by the hook, screened at PR creation, recovered from the dead |
| 3 | Hook bundle over its ceiling | implementation | New `pre_tool_use` and `post_tool_use` logic adds bytes to a ratified budget with little headroom. | 1.3 asks for measured byte figures per placement; 3.2 records its delta in `hook-bundle-budget.json`. | Phase 3 — Owner decisions visible to live peers |
| 4 | Reading a peer's worktree leaks across profiles | implementation | 3.1 reads files in other worktrees of one repo; a worktree of a different account profile could be listed. | Read only the paths named in 3.1, only for live records of the same git common dir, never file contents outside them. | Phase 3 — Owner decisions visible to live peers |
| 5 | Allocator reservations pile up | implementation | `wx` reservation files for ids never used stay under the common dir. | 4.1 test covers release on merge and expiry with the register TTL. | Phase 4 — Ids allocated without renumbering |

## Acceptance Criteria

- [ ] AC-1 — The #2886/#2887 and #2265/#2266 fixtures each produce the screen's outcome before `gh pr create` returns (2.3).
- [ ] AC-2 — A takeover of a dead holder's slug prints that holder's worktree, branch and open PR (2.5).
- [ ] AC-3 — An owner directive uncommitted in a live peer worktree is listed by `agent-config sessions:decisions` and counted at session start (3.1, 3.2).
- [ ] AC-4 — Two concurrent `agent-config ids:next oq` calls return two different ids (4.1).
- [ ] AC-5 — A bare `git stash pop` on an entry another session pushed warns (5.1).
- [ ] AC-6 — `task ci` exits 0 on the branch carrying each phase.
