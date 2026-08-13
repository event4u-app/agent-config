# Unblocking `road-to-design-system-onramp` — the two decisions, and how they were made

**Date:** 2026-08-13 · **Mechanism:** AI council, on an explicit maintainer
delegation ("decide things in the AI council to unblock yourself").

## This was a single-member review, not a convergence

Say it first, because everything below inherits it. The run reports:

```
council:quorum · before the run · 2/2 present, needed 1 — concluded.
council:quorum · after the run  · 1/2 present, needed 1 — concluded.  ⚠️ DEGRADED
```

Two members are configured and both were present *before* the run. Afterwards
only one had answered: the `openai` seat returned `error: exit_1` — the `codex`
CLI refuses a git worktree with "not inside a trusted directory", and the
transport passes no `--skip-git-repo-check`. The session ran from a worktree, so
that seat could not answer.

The surviving member replied over two rounds, and its round-2 text argues with
"Reviewer A". **Reviewer A is the same member's round 1**, not a second seat.
Reading that exchange as agreement between two reviewers would be exactly the
mistake the quorum line exists to prevent.

So: **one voice, two rounds.** It is better than a solo decision by the
implementing agent — which is the whole point of routing it — and it is not the
2-of-2 convergence a council verdict normally implies. Cost: $0.0433, quota
2/50 per member.

## Decision A — the vendored corpus is a commit behind

**Verdict: adopt `motion.csv` only (10.5 KB) and re-baseline the per-skill cap
to 23.5 %, with the reason recorded in the same commit. Ship all three dials.
Decline the font CSV, the six desktop stacks and the wholesale pin bump.**

The reasoning that decided it, in the member's own framing: the three dials were
in the roadmap's original scope, not speculative additions; the motion dial's
implementation is proven rather than a research spike; and shipping two of three
is a scope cut that should require demand evidence, not budget convenience.

Its own strongest counter, which it stated rather than hid: this exhausts the
budget flexibility, and the next adoption raises the cap again. That cost is
real and is accepted here rather than argued away.

**What it declined to decide:** whether to pursue the full re-pin or the font
corpus later — "a separate roadmap with different scope evidence".

## Decision B — a pre-registered falsifier with no instrument

**Verdict: amend the falsifier to a signal that exists** — a maintainer read of
`skill-usage:collect` exposure records at each release-review walk, plus
Issues/PRs citing the cluster — rather than build per-command telemetry.

Two supporting arguments worth keeping. Building a new user-behaviour telemetry
surface is disproportionate to the question it would answer. And a human review
at a release boundary is *appropriate* for a retirement decision: an automated
count answers "how much", while "should we" carries context a counter does not,
such as unreported bugs the maintainer knows about.

## Two corrections to the verdict before it was applied

The member's proposed replacement text was checked against the tree rather than
adopted as written, and it was wrong in two places that matter. Both corrections
narrow the claim; neither reverses the verdict.

1. **It named a sub-command that does not exist.** The proposed falsifier reads
   exposure records for `/design-system`, `/design-system:capture` and
   `/design-system:apply`. There is no `:apply`. The cluster is `generate`,
   `import`, `capture`.

2. **The instrument covers less than the text assumes**, and this is the load-
   bearing one. `skill_usage_collect.load_known_slugs` builds its population
   from directories containing a `SKILL.md` under `.augment/skills`,
   `.claude/skills` and `dist/agent-src/skills`. Checked against the real tree:

   - `design-system` — **present** (the cluster head projects as a
     command-skill, because it is suggestion-eligible).
   - `design-system-generate`, `design-system-import` — **absent**. The subs are
     `suggestion.eligible: false`, so they get no command-skill projection and
     the instrument cannot see them.
   - `design-system-capture` — present, but it is the pre-existing **skill** of
     that name, not the command. Counting it would conflate two different
     things, and the skill has its own independent traffic.

   So the falsifier's signal is exposure of the **cluster-head slug only**, and
   `design-system-capture` must be excluded by name. The amended text says so,
   including what it cannot see, so a future reader is not misled into treating
   a head-only count as cluster-wide usage.

## Applied

- Decision A → Phase 3 (all three steps).
- Decision B → the Phase-2 falsifier text and Phase 5 Step 1.
- Both blockers on the roadmap are closed with a pointer to this record.
