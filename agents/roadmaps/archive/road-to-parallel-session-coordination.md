---
complexity: lightweight
status: ready
---

# Road to parallel-session coordination — a second session should know the first one exists

**Goal:** make a starting session detect another live session's branch and
roadmap claim before it begins work, via a shared per-session register in the git
common dir kept alive by a per-turn heartbeat, and turn a collision into a
question instead of a conflict.

## Context

Parallel work in this repo is not hypothetical. `road-to-worktree-hygiene`
measured **249 worktrees, 40 GB, 692 local branches** — one per feature branch,
accumulated because sessions run side by side. What does not exist is any way for
two of those sessions to know about each other.

Three findings, each verified against HEAD:

1. **Runtime state is per-worktree, not per-repo.** Concerns run with
   `CWD = envelope.workspace_root` and resolve `agents/runtime/state/` relative
   to it (`src/scripts/hooks/dispatch_hook.ts` ~line 560). In a worktree that is
   the worktree path, so `hot-context.md`, `context-hygiene.json` and
   `rule-trips.json` are isolated copies. Two sessions in two worktrees share
   nothing.
2. **The scope lock is local-only.** `worktree-lifecycle` already has the right
   idea — a `.worktree-scope.md` declaring which paths a worktree owns — but it
   is written untracked *inside* the worktree and no other session reads it. The
   declaration exists, the lookup does not.
3. **`/roadmap:next` has a claim window.** Its live screen excludes any roadmap
   whose slug matches an **open PR's** branch. Correct, and late: between
   "session A picks the roadmap" and "session A's PR exists" there is an
   unguarded interval in which session B screens the same roadmap as free.

### Why this is not a memory feature

The obvious reading — "let agents write what they are doing into memory" — is the
wrong store, deliberately. Memory is curated, durable, and indexed into every
session. "Who is working on what right now" is transient, machine-read, and wrong
within the hour. Putting it there degrades the index that currently works. The
register is a separate, disposable surface — and because it is disposable by
declaration, it owes no history, which Phase 2's layout choice depends on.

### The shared surface, and the resolution that already exists

`git rev-parse --git-common-dir` resolves to the **same** directory from every
worktree of a repo. A register there is shared by construction: no new directory,
no sync step, no generator, never tracked.

Resolving that path is **not** new code: `src/scripts/_cli/cmd_doctor.ts`
(~lines 912-914) already reads the `commondir` file and resolves it against the
git dir. Reuse that resolution rather than writing a second one — a repo with two
different answers to "where is the common dir" is a bug waiting for a symlinked
parent, exactly the class of defect the worktree cleanup work already hit once.

### `stop` is not session end — the correction this design turns on

On Claude Code the native `Stop` event fires **after every assistant reply**, not
at session end; the manifest says so itself, describing the `stop` write as a
"deterministic … overwrite of hot-context.md" — a working-memory refresh per
reply. On Cline `stop` is mapped from `TaskCancel`. True session end is the
separate `session_end` slot, present on six platforms and **absent on Windsurf**
(its manifest comment: handled "in the `stop` slot rather than `session_end`").

Consequence for this design: deregistering on `stop` would mark a session dead
after its first reply, while it is working. Deregistration therefore belongs on
`session_end`, and `stop` becomes a **second heartbeat carrier**. That reframes
correctness usefully: **liveness rests on heartbeat + TTL alone; deregistration
is a best-effort optimisation that frees a claim sooner.** The crash path already
*is* the TTL path, so Windsurf's missing `session_end` costs latency, not
correctness.

## Prerequisites

- `src/scripts/hook_manifest.yaml` — `session_start`, `user_prompt_submit`,
  `stop` and `session_end` all exist already; this adds a concern to existing
  slots, never a slot.
- `src/scripts/_cli/cmd_doctor.ts` — the existing common-dir resolution.
- `src/scripts/worktree_cleanup_check.ts` — the existing liveness notion and the
  measurement trap Phase 2 must not repeat.
- The `chat-history` JSONL — already written in the per-turn slot on every host,
  carrying timestamps; it is the measurement source for the TTL.

## Phase 1 — measure what the design depends on

- [x] Confirm empirically that `agents/runtime/state/` differs per worktree:
      start a session in two worktrees, compare resolved state paths. The claim
      is read off a code comment and has not been observed.
- [x] Confirm `git rev-parse --git-common-dir` returns an identical, writable
      path from the main checkout and from a worktree, **including through a
      symlinked parent** — the cleanup work already found that git reports
      realpaths and a symlinked ancestor mis-classified conventional worktrees.
- [x] **Derive the TTL from data, not taste — and per host, not globally.**
      Extract the inter-turn gap distribution from the `chat-history` JSONL over
      a real working week, **split by host**. One global number fails in both
      directions: dominated by the slowest host it lets a crashed Claude Code
      session squat on a claim for ten times the normal turn gap; taken from the
      fastest host it expires active sessions on platforms where "turn" is
      proxied by a coarser event. "Turn" is not the same quantity on eight hosts
      — Augment proxies it through `stop`, and editor-centric hosts log fewer
      chat turns than they have working minutes.
- [x] Exclude long idle stretches from the calibration set before taking the
      percentile — an overnight gap in the log is not a turn cadence, and left in
      it drags the tail far enough to make the TTL meaningless.
- [x] **Probe Augment's `stop` frequency.** Augment has no `user_prompt_submit`
      but does have `stop`. If its `stop` fires per reply, the heartbeat gap on
      that platform closes by itself; if it fires once, the gap is real and gets
      documented. Do not assume either way.
- [x] Measure the claim window on `/roadmap:next`: from roadmap selection to PR
      creation, in a real run. Under a minute makes the register a nice-to-have;
      an hour makes it the point.

## Phase 2 — layout and liveness

- [x] **Choose the layout, default: one file per session.**
      `<common-dir>/agent-sessions/<session_id>.json`, heartbeat overwrites its
      own file via write-temp + rename. Each file has exactly one writer, so
      there is no concurrent-write case at all: atomicity comes from rename, the
      file never grows, compaction does not exist, the reader does `readdir` plus
      N small reads, and cleanup is `unlink` of expired files during the
      `session_start` read. The append-only JSONL alternative buys concurrency
      safety this layout does not need, and pays for it with unbounded growth
      (one record per turn per session once heartbeating), a rotation problem
      (rotating under live appenders loses heartbeats to the unlinked inode —
      the classic logrotate defect), and fold-the-whole-file reads. Keep JSONL
      only as the fallback if Phase 1 finds a target filesystem without atomic
      rename — in practice, none. A separate append-only audit log alongside the
      per-session files was considered and rejected: it re-imports the growth and
      rotation problems to buy post-mortem history the register has already
      declared worthless.
- [x] Define the record: `session_id`, worktree path, branch, roadmap slug (or
      null), started-at, last-seen.
- [x] **Heartbeat `last-seen` every turn.** Without a writer that updates it,
      `last-seen` equals `started-at` and the TTL is unresolvable: short → a
      long-running active session expires mid-work and goes invisible to session
      B, which is precisely the collision this prevents; long → a crashed session
      blocks roadmaps for hours. Carriers: `user_prompt_submit` (all hosts but
      Augment) and `stop` (all hosts, per reply on Claude Code).
- [x] Store the TTL as a per-host map, not a constant, and give an unknown host
      a conservative default plus a logged warning — a new host must degrade to
      "claims held slightly too long", never to "active sessions vanish".
- [x] Rule out file mtime as the liveness signal explicitly. The cleanup work hit
      this: plain `git status` refreshes the on-disk index and bumped the very
      mtime read as liveness, moving 10 worktrees from safe to live between
      consecutive runs. A heartbeat *inside the record* has no such coupling —
      nothing else writes it.
- [x] **Declare the two accepted limits**, in the same honesty register as the
      "not a mutex" note below:
      - *Idle is indistinguishable from crashed.* A session left open over lunch
        does not heartbeat, expires, and releases its claim although the user
        returns. No hook-based heartbeat can tell that apart from a crash. The
        collision question catches the rest: when they resume, the *other*
        session sees revived heartbeats at its next start. **This limit belongs
        in user-facing documentation, not only in the design note** — someone
        needs to know that walking away for longer than the TTL means another
        session may claim their branch.
      - *This is advisory, not a mutex.* Two sessions can claim in the same
        millisecond. State it in the artefact so nobody later builds on it as if
        it were exclusive.

## Phase 3 — write the register

- [x] Register on `session_start`: write the file. Fail-open — a session that
      cannot write the register still starts.
- [x] Heartbeat on `user_prompt_submit` and on `stop`: rewrite `last-seen`.
- [x] **Re-read the mutable fields on every heartbeat, never carry the start
      value forward.** The branch changes mid-session via checkout — one
      `git rev-parse --abbrev-ref HEAD` per heartbeat keeps it true.
- [x] Deregister on `session_end` where the slot exists (six platforms; not
      Windsurf). Best-effort by design: correctness rests on heartbeat + TTL, so
      a missing `session_end` costs claim-release latency and nothing else.
- [x] Do **not** deregister on `stop` — on Claude Code that would kill the
      session's own record after its first reply.

## Phase 4 — bridge the roadmap claim, or Phase 5 reads an empty field

The record carries a roadmap slug, but the roadmap is chosen **mid-session** by
`/roadmap:next`. At registration the slug is always null, and a hook is a script:
it does not know what the model picked. Without a bridge the third acceptance
criterion is unreachable — the screen would only ever see null slugs.

- [x] Bridge via a state file the heartbeat reads: `/roadmap:next` writes the
      chosen slug into `agents/runtime/state/`, and the next heartbeat lifts it
      into the record. Preferred over having the command call the register
      directly — the claim lands at most one turn later, and the model never
      needs to know the register path or format.
- [x] Treat a write the command performs as model-carried and declare it as such
      (see Phase 5's honesty step); the heartbeat half is hook-carried and real.

## Phase 5 — close the claim window, and declare its carrier

- [x] Add the register read to the live remote screen of `/roadmap:next`,
      alongside `gh pr list`. A roadmap claimed by a live session is excluded
      from the candidate set exactly as an open-PR roadmap is.
- [x] Keep the exclusion reasons distinguishable: "taken by open PR" and
      "claimed by a live session" are different states with different recovery.
- [x] On `session_start`, read the register, drop expired entries, and inject
      live foreign sessions as context — the delivery mechanism `hot-context`
      already uses, so no new injection path is invented.
- [x] Collision rule: the starting session's branch matches a live foreign claim
      → ask **once**, numbered options per `user-interaction`: join the same
      branch, or spawn a worktree. Never decide silently, in either direction.
      It fires only on an actual live claim — never a routine "are you sure" at
      every start, per `no-cheap-questions`.
- [x] **Declare this step's enforcement honestly.** `/roadmap:next` is a command
      markdown, not a script — the screen runs because the model reads the
      instruction. That is a model-carried obligation, i.e. exactly the shape the
      obligation-carrier audit exists to find. Say so in the command, in the form
      the six `enforced_by: none` rules use, rather than leaving a prose step that
      reads like a guarantee. The register *write* is hook-carried and real; the
      register *read in the screen* is not, and the two must not look alike.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-07 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The TTL expires an active session | implementation | Too short a TTL makes a long-running session invisible to session B — which is exactly the collision this roadmap exists to prevent, now caused by the fix rather than the gap | TTL derived from the real inter-turn gap distribution per host, with long idle stretches excluded from the calibration set; unknown hosts get a conservative default that holds claims too long rather than dropping them | Phase 1 — measure what the design depends on |
| 2 | A crashed session squats on a claim | implementation | Too long a TTL, or a missing `session_end`, leaves a roadmap blocked for hours with no live session behind it | Liveness rests on heartbeat + TTL alone, so the crash path IS the TTL path; deregistration is a best-effort optimisation that only frees the claim sooner | Phase 2 — layout and liveness |
| 3 | `stop` is mistaken for session end | implementation | Deregistering on `stop` would mark a session dead after its first reply on Claude Code, where the native `Stop` fires per assistant reply | Deregistration bound to `session_end` only; `stop` is a second heartbeat carrier. Pinned by an acceptance criterion and by the frequency lattice shipped in the obligation-carrier audit, which now models this slot per platform | Phase 3 — write the register |
| 4 | The heartbeat obligation reads as covered when it is not | implementation | This roadmap adds a per-turn obligation; on Augment there is no `user_prompt_submit`, so a naive coverage read would report it green on a host that cannot carry it | The obligation-carrier audit landed first, precisely so `obligation_frequency` + the per-platform join surface this before two sessions collide | Prerequisites |
| 5 | Idle is indistinguishable from crashed | product | A session left open over lunch stops heartbeating, expires, and releases its claim although the user returns | Accepted and declared. No hook-based heartbeat can tell them apart; the collision question catches the rest. The limit must reach user-facing documentation, not only the design note | Phase 2 — layout and liveness |
| 6 | The register is read as a mutex | product | Two sessions can claim in the same millisecond; a later feature built on it as if exclusive would be silently wrong | Stated in the shipped artefact, not only in this roadmap | Phase 2 — layout and liveness |
| 7 | The roadmap-claim screen is model-carried | implementation | `/roadmap:next` is command markdown, so the screen runs because the model reads the instruction — the register *write* is hook-carried and real, the *read* is not | Declared honestly in the command, in the shape the six `enforced_by: none` rules use, rather than left as prose that reads like a guarantee | Phase 5 — close the claim window, and declare its carrier |
| 8 | Growth or rotation defects in the store | implementation | An append-only log grows one record per turn per session and loses heartbeats to an unlinked inode when rotated under live appenders | One file per session, one writer each, atomicity from write-temp + rename; JSONL kept only as a fallback for a filesystem without atomic rename | Phase 2 — layout and liveness |

## Council convergence (2026-08-07 · anthropic/claude-sonnet-4-5, openai/gpt-4o · $0.08)

Both members reviewed the locked design decisions. Converged, and folded in above:

- **One file per session is the right layout.** The rotation-under-live-appenders
  failure is decisive against JSONL; the lost history costs nothing the register
  claims to provide.
- **The TTL cannot be one number.** "Turn" is a platform-dependent quantity across
  eight hosts, so a global P99 is dominated by the slowest host — a crashed
  session on a fast host would then squat on a claim for ten times the normal
  turn gap. Per-host derivation, conservative default for unknown hosts.
- **Heartbeat + TTL is the correct correctness basis**, and the idle-vs-crashed
  limit is acceptable for an advisory register — provided it reaches users, not
  only the design note.
- **Roadmap 1 first**, with a concrete failure case: without the frequency field,
  this roadmap's own per-turn heartbeat obligation would be reported green by the
  coverage instrument on a host whose slot coverage does not actually carry it,
  and the gap would surface only after two sessions had already collided.

Divergence, recorded rather than resolved: the second member saw value in
shipping the register first for earlier user benefit. A concrete platform-spread
failure case outweighs a generic value argument, so the order stands.

## Council convergence — round 2, on what Phase 1 measured (2026-08-07 · anthropic/claude-sonnet-4-5, openai/gpt-4o · $0.43)

Three Phase-1 findings disturbed a locked decision. Both members converged on
all three, and corrected the implementation proposal twice.

- **TTL from the raw, unfiltered p99 — confirmed.** The idle filter that Phase 1
  mandates characterises turn cadence correctly and is the wrong basis for an
  expiry, because the gaps it drops occur *inside* live sessions.
- **The per-host map ships, but named as what it is.** `TTL_MEASURED_SECONDS`
  (one entry) plus `TTL_DEFAULT_SECONDS`, not a table implying eight measured
  hosts. Six empty slots would be speculation wearing a data structure.
- **The unknown-host default moved down, 24 h → 12 h.** Correction against the
  proposal: the evidence for a wide spread is a 4× range within one host, which
  does not justify a 6× extrapolation, and a full day makes the register useless
  on an unmeasured host — a crashed session would block a claim until tomorrow.
- **Cline deregisters on `stop` via an explicit platform allow-list.** Correction
  against the proposal, which was to compute the condition from
  `slot_frequency(...) === 'per-event'`. Both members rejected that: a future
  platform typed `per-event` would silently acquire deregistration behaviour in
  a code path whose failure mode is *a live session deleting its own claim*. A
  human adds the line deliberately, or the platform keeps the safe default. The
  general rule — `stop` is a heartbeat carrier, never deregistration — is
  unchanged, and TTL remains the correctness basis on Cline too.
- **The lattice's false greens are declared, not fixed here.** Widening
  `Frequency` with a reachability dimension touches every consumer and every
  rule's frontmatter, plainly outside a register roadmap. Both members endorsed
  the scope call and both independently asked for the reachable set to be
  explicit in the register's own artefact — shipped as
  `HEARTBEAT_REACHABLE_PLATFORMS`, which names cursor-CLI, cowork and copilot by
  their absence.

**One round-1 premise the measurement does not support**, corrected here rather
than left standing two sections apart. Round 1 held that a single global TTL "is
dominated by the slowest host". The data does not test that claim, and the only
fragment touching it points the other way: pooling two hosts moved the kept p95
to a value *between* them, not up to the slower one, because the faster host
contributed more samples — pooling is a sample-weighted mixture, not a max.
Recorded as unsupported rather than refuted; n is far too small to settle it. The
per-host map survives regardless, because its justification never depended on
that claim: an unmeasured host needs a conservative default either way.

One member's reframing, adopted: the lattice is not lying. It answers "does a
structural slot exist"; the register needs "will this actually fire". Those are
different questions, and the fix is to ask the right one of the right component
rather than to make the lattice answer both.

Recorded and NOT adopted: both members proposed extending the lattice with a
`KNOWN_UNREACHABLE` map in the same change. It is the correct eventual fix and
it is a different roadmap — the register does not need it to be honest, because
it declares its own reachable set.

## Acceptance criteria

- Two sessions started in different worktrees each see the other in their
  injected start context.
- Starting a session on a branch another live session holds produces one
  numbered-options question and no silent proceed.
- A session that picks a roadmap mid-run has that slug visible in the register
  within one turn, and `/roadmap:next` in another session skips it before any PR
  exists — the window measured in Phase 1 is closed.
- A session active longer than the TTL stays visible (heartbeat) **and** a
  crashed session's entry disappears by TTL without manual cleanup — both hold
  simultaneously, and neither depends on file mtime.
- No session marks itself dead while still working (the `stop`-is-not-session-end
  trap) on any platform.
- The idle-vs-crashed limit and the advisory-not-mutex property are written into
  the shipped artefact, not only into this roadmap.
- The TTL is stored per host, derived from a calibration set with long idle
  stretches excluded, and an unknown host degrades to holding claims slightly too
  long rather than to vanishing sessions.
- The register is never tracked by git, and its absence degrades the session to
  today's behaviour rather than blocking it.

## Quality gates

Targeted only — the remote CI on the PR is the authoritative full gate.

```bash
npx tsx src/scripts/lint_roadmap_complexity.ts
npx tsx src/scripts/validate_frontmatter.ts
npx vitest run tests/scripts/<new-register-test>.test.ts
```
