# Parallel sessions — what the other session can see, and what it cannot

Two agent sessions running side by side in different worktrees of the same repo
used to know nothing about each other. They now share a small register, so a
starting session can tell you that another one is already live, on which branch,
and on which roadmap.

This page is for the person running those sessions. Two of its properties will
surprise you if nobody says them out loud, so they are said here first.

## Walking away for longer than the TTL releases your claim

Your session announces it is alive by writing a timestamp once per turn. If that
timestamp stops moving, other sessions eventually treat your session as gone and
may claim your branch or your roadmap.

**Nothing can tell "the user went to lunch" apart from "the process crashed".**
Both look identical from outside: no turns, no timestamp updates. So a session
you leave open and idle will, after its time-to-live, disappear from other
sessions' view — even though you fully intend to come back.

| Host | Time-to-live |
|---|---|
| Claude Code | 4 hours |
| every other host | 12 hours |

The Claude Code figure is measured from real turn cadence in this repo. Every
other host uses a deliberately generous default, because no cadence has been
measured for them yet and the safe direction is to hold a claim slightly too
long rather than to drop a live one.

**What this means in practice:** if you step away for longer than that and
someone else starts a session meanwhile, they will not be warned about you. When
you come back and take your next turn, your session reappears in the register
immediately — but work may already have started elsewhere.

## It is advisory. It is not a lock.

The register tells you what is going on. It does not stop anything.

Two sessions can claim the same branch in the same millisecond and both succeed.
Nothing here provides mutual exclusion, and no feature should ever be built on
it as if it did. When two sessions share **one worktree** on one branch — the
same files, the same index — your session asks you once **per session**: join
anyway, or spawn a separate worktree. The answer then holds for the rest of that
session. The question is the whole mechanism.

The same branch NAME in a **different** worktree is not that: separate trees,
separate index, and the normal shape on this repository. It produces a one-line
note and no question.

**No collision, no block.** A live peer on a different branch, claiming a
different roadmap or none, produces nothing at all: the context block is emitted
only when a roadmap or branch collision actually fires. Mere co-existence is not
news, and a session told about it tends to mention it unprompted and to treat it
as a reason to hold work back.

**It never gates a git operation.** The block says so in its own text, because
that is where the misreading happened rather than in any code — the hook has
always ended in `return 0` and has never blocked anything. Commit, push and PR
creation on your explicit instruction always run. A `STOP` in the block is about
*which work to start*, never about shipping work that is already done.

The one place that does refuse is `sessions:claim`: it will not WRITE a claim on a
roadmap a live peer already holds, and exits non-zero instead. That is a
consistency check on your own write rather than exclusion — the peer is not
protected, and two simultaneous claims still race — but it stops the second
session to arrive from recording a claim it cannot honour and from missing the
notice. `--force` writes it anyway when duplicating is the deliberate choice.

## The collision that actually cost something: the same roadmap, two branch names

Twice on this repository, both times on
`road-to-inbox-harvest-2026-08-b-dispatch-safety`:

| # | The two PRs | Branches | Outcome |
|---|---|---|---|
| 1 | #1277 and #1280 | `feat/inbox-harvest-b-dispatch-safety` · `feat/dispatch-safety-confirmation` | overlapping Phase-2 work |
| 2 | #1280 and #1281 | `feat/dispatch-safety-confirmation` · `feat/dispatch-safety-confirmed-execution` | #1281 merged as `c7bbe2c24`; #1280 went `CONFLICTING` and withdrew its own implementation |

Two sessions each built the same roadmap phase, and one of the two
implementations was thrown away. The register saw nothing, because it compared
**branch names** — and those differed.

So the comparison is now the **roadmap**, and it reads two independent sources,
because either can be silent on its own:

- **the claim** — a live peer record carrying the same slug. Needs
  `sessions:claim` to have run, which is model-carried.
- **the branch axis** — an unmerged branch in another worktree whose name carries
  the roadmap's distinctive tail. Needs nothing but a checkout on disk, which
  exists from the peer's first minute. `sessions:list` prints it.
- **the path axis** — `owned_paths` on a live peer record, published by
  `sessions:claim --paths`. Two sessions can be on different roadmaps and
  different branches and still be editing one file: neither axis above sees that,
  and it is the one that actually predicts a merge conflict. `sessions:list`
  prints it as a separately-labelled `PATH OVERLAP` line, because the response
  differs — a slug collision means stop, a branch collision means coordinate, a
  path collision means take the disjoint steps first and say so. Absent when a
  session declared nothing, which is the ordinary case.

Two limits worth knowing. A branch created seconds ago has no commits of its own,
so it counts as merged and does not appear on the branch axis — that first minute
is what the claim covers. And a claim naming a roadmap that has since been
archived is **stale**, not held: `sessions:list` labels it `← STALE` and every
check treats it as no claim at all. Four live records once carried one identical
archived slug, and reading that as "taken" is how a screen concludes the opposite
of the truth.

Your claim is keyed on your **session**, not on your worktree. Before, one shared
file per checkout meant a second session in the same directory inherited the first
one's claim — reporting work it was not doing while the original reported none.

One consequence worth knowing if you upgrade with a claim already set: a session
that can identify itself no longer reads the shared file at all, so a claim
written by the previous scheme is dropped rather than inherited. Re-run
`sessions:claim` once. That trade is deliberate — a shared file is either a peer's
or pre-upgrade and a reader cannot tell, so the choice is between losing a claim
(one command to restore) and crediting a peer's work to you (the incident above).

## What the other session sees about you

One small JSON file per session: a session id, the host you are on, the worktree
path, the current branch, the roadmap slug if you have picked one, when you
started, and when you were last seen.

It lives inside the repository's git directory, is never committed, and is
deleted when your session ends. If it cannot be written at all, your session
starts exactly as it did before this existed — the register never costs you a
session.

## Hosts where the heartbeat does not run

The per-turn timestamp needs a hook that fires every turn. Three hosts cannot
provide one today, and their sessions therefore expire from the register after
the TTL even while actively working:

- **Copilot** — no hook surface at all.
- **Cursor CLI** — the per-turn hooks exist only in the IDE; the CLI does not
  fire them. Cursor **in the IDE** is fine.
- **Cowork** — the hooks are wired but the lifecycle events do not fire yet
  (upstream limitation).

A session on one of those hosts still registers itself at start and still *sees*
other sessions. It just stops being visible to them sooner than it should. The
session prints a one-line warning at startup when this applies to you.

## If you cancel a task on Cline

Cline is the one host where cancelling a task removes your register entry
immediately rather than leaving it to expire. That is deliberate: on Cline, the
"cancel" signal is the only end-of-task signal the register receives, and
cancel-and-restart is a normal way to work there. On every other host, cancelling
mid-reply does **not** deregister you — your session is still alive and still
holds its claim.

## See also

- [`using-git-worktrees`](../../src/skills/using-git-worktrees/SKILL.md) — creating the worktrees this coordinates.
- [`worktree-lifecycle`](../../src/skills/worktree-lifecycle/SKILL.md) — the scope-lock note a worktree declares for itself.
- `agents/evidence/analysis/parallel-session-register-phase1.md` — where the TTL numbers come from, and how thin the data behind them is.
