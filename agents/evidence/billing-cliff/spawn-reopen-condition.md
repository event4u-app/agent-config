# The unattended-spawn refusal's reopen condition has fired

**Measured 2026-08-22** on the maintainer checkout
(`event4u/agent-config`), while harvesting
`agents/tmp.old/agent-cost-gate-2.txt`. Recorded here because the evidence
lives in a gitignored, auto-pruned directory: on any other machine, and on this
one after the next prune, the finding is unreproducible. A falsifiable trigger
that fired and was not written down is indistinguishable from one that did not.

## The lock

`agents/roadmaps/archive/road-to-long-horizon-execution.md` step 4.0 closed the
unattended-spawn capability as a published refusal — AI council 2026-08-19
(anthropic/claude-sonnet-4-5 + openai/codex-default, blind peer review,
$0.031), a SPLIT verdict whose intersection shipped print-only. Its reopen
condition, quoted verbatim from that step:

> **Reopen condition, falsifiable and not a date:** the first time
> `agents/runtime/state/checkpoints/` holds a checkpoint from a real dying run.
> Measured 2026-08-19 on the main checkout, that directory does not exist — the
> resume path has never had one input. Stated the other way round so it cannot
> be over-read: an empty directory is a CONJUNCTION of two rare conditions
> (recycle threshold AND a roadmap claim), so it licenses "do not build the
> spawn yet" and never "the need does not exist".

The runtime carrier of the same refusal is
`src/scripts/_lib/headless_invocation.ts` → `LIVE_SPAWN_REFUSAL`, which
`run:supervise --relaunch` prints before exiting 2.

## What is there now

`agents/runtime/state/checkpoints/` holds two files. Both are checkpoints of a
real run, not fixtures: each carries a run id matching its filename, a roadmap
slug that exists, a 40-character head SHA, and a `written_at` stamp from the
session-end path.

| run id | roadmap | open / done / parked | head | written_at |
|---|---|---|---|---|
| `a59d289f437e64a81755d98cdec36b27e4efd4e6e9ec87a2f9bfd8040ceafa64` | `road-to-standing-context-40k` | 5 / 3 / 1 | `ae08ddfe717a4eb359fb7b0ebaabfbaba8ba2a1f` | 2026-08-19T20:44:07.463Z |
| `cdeac47a01bae8f3ceaac6817e07e507ee6fff87384bee289aa94b47930dc9d2` | `road-to-standing-context-40k` | 6 / 2 / 1 | `2cc8fd96455d877f5b2a99a8b0d769483932d2b8` | 2026-08-19T14:45:01.868Z |

Both name the same next step — `**0.1** Run the standing-rule-delivery dev task
on the maintainer machine` — and the two open counts differ (6 then 5), so the
later file records a run that had made progress since the earlier one. That is
the shape of a run being worked and stopping twice, not of a fixture written
once.

Both stamps fall on **2026-08-19**, the same day the refusal recorded the
directory as absent. The condition therefore fired within hours of being
written, which is worth stating because it bears on the refusal's own reasoning
rather than only on its trigger: the conjunction it called rare occurred
immediately.

## What this does and does not establish

**Establishes:** the stated reopen condition is met. Whatever follows from
reopening, the precondition the council attached is no longer outstanding, and
citing 4.0 as an unqualified blocker without saying so is the failure
`decision-revisit-gate` § "Reading a lock" names — a lock may not be presented
as a reason not to act until its trigger state has been read.

**Does not establish** that the spawn should be built. The refusal's last
sentence guards the empty direction; this file guards the full one, and the
symmetry is deliberate. A fired condition licenses reopening the *question*, in
the venue that closed it. It is not a verdict, and it is not authorisation.

Two things remain in force regardless of how that question is answered, and
neither is reopened by this file:

- The **multi-agent variant** left scope permanently under step 4.3, whose
  closure states that reconsideration requires a new roadmap with fresh
  pre-registration and explicit funding — never a re-reading of that blocker.
- The **`unattended-demotion-gate`** claim (`docs/CLAIMS.md`) is the
  pre-registered measurement that would govern an unattended lane: 14-day
  rework rate against attended PRs, a rework definition fixed before any data
  existed, a ≥10-vs-10 power floor, and an honest-null path that CLOSES the
  capability if the lane never runs.

## How to re-check

```bash
ls -la agents/runtime/state/checkpoints/
```

On a fresh clone this is empty — the directory is gitignored — and that absence
is not a refutation of this file. It is why this file exists.

## The verdict on reopening — AI council, 2026-08-22

Put to the council that closed the refusal, per the blocker
`unattended-spawn-reopen-venue` in `road-to-quota-reset-watcher`. Two members
(anthropic, openai), blind peer review, cost $0.0369. **Unanimous 2/2 on both
halves**, and the two halves point in different directions, which is why both
are recorded.

**Reopen: (a), yes.** The published condition fired, and both seats reached the
same reason for it independently: refusing to reconsider after the stated
trigger fires would make the decision rule **unfalsifiable in retrospect** — a
condition that changes nothing when met was never a condition. One seat added
the textual point that the refusal wrote "do not build the spawn *yet*", a word
that anticipates its own expiry.

Both seats also stated, unprompted, the boundary this file's own § "What this
does and does not establish" states: **reopening is not authorisation.** The new
evidence establishes *need*, not *safety*.

**Venue for the implementation: OWNER-RESERVED, 2/2.** This is the half worth
reading carefully, because it contradicts the recommendation the blocker
carried. The blocker recommended council routing on the grounds that the
transition is reversible and internal — a default-off flag on an existing
report-only tool — which is the discriminator `decision-revisit-gate`'s
owner-reserved table uses. Both seats accepted that the reasoning is
*procedurally* correct and rejected the conclusion anyway, on the same ground:

> a self-relaunching agent establishes a qualitatively different autonomy
> posture than one requiring human intervention to resume. This is not about
> reversibility or scope — it's about the *kind of system you're building*.

The other seat put the same point in one sentence: self-relaunch changes the
agent's **autonomy floor** even when the mechanism is reversible and
default-off. Both named the same strongest counter-argument against themselves
— that the strict bounds make this look like an ordinary internal mechanism a
council should be competent to approve — and both declined it.

So the council reopened the question and then declined to be the venue that
answers it. That is a coherent pair, not a contradiction: the trigger that
fired was theirs to read, and the floor it touches is not theirs to move.

**What is now open, and with whom:** whether to build the spawn at all is a
maintainer decision. Nothing in this repository is blocked on it —
`run:supervise` reports, `--print-relaunch` prints, and a human resumes by
paste, exactly as before.
