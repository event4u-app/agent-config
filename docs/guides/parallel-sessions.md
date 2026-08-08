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
it as if it did. When a collision is detected, your session asks you once — join
the branch, or spawn a separate worktree — and then does what you choose. The
question is the whole mechanism.

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
