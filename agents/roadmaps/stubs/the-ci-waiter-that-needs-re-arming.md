---
complexity: lightweight
review_by: 2026-12-31
probe: none
---

# Stub: a CI wait that ends without a verdict has to be re-armed by hand

> **Stub — not active work.** Surfaced on PR #2495 (2026-10-19), whose own
> subject was unrelated. Filed rather than fixed because the right shape
> depends on step 3.2 of `road-to-agent-throughput-recovery`, which owns the CI
> settle and is held on the council's D9 there.

## The observation

One PR, one afternoon, six background `ci_settle <pr> --timeout-min 28` waiters:

| # | Head | Ended | What it said |
|---|---|---|---|
| 1 | first push | stopped by hand | a second push made its head stale |
| 2 | second push | exit 2 | DID NOT SETTLE — 41/46, five macOS jobs pending, none red |
| 3 | second push | exit 1 | SETTLED RED — 4 of 46 (two real defects, one expired baseline on `main`) |
| 4 | fix push | exit 2 | DID NOT SETTLE — 34/46, twelve macOS jobs queued, none red |
| 5 | fix push | stopped by hand | a conflict with `main` needed a merge |
| 6 | merge push | exit 2 | DID NOT SETTLE, then a re-armed waiter WITHHELD: the PR had been merged by the owner while it waited |

Three of six waits ended without a verdict and without a failure, each on macOS
jobs still queued for a runner. Each needed the agent to notice, read the log,
and start the next waiter — the exact re-arm loop the `ci_settle` exit-2 line
asks for ("re-run this waiter with the host's background primitive").

## Why it matters

The re-arm is model-carried. A turn that ends while a waiter reports exit 2 —
or a session that is recycled in between — leaves a PR with no reader, which is
how "CI is running" becomes a report instead of a wait. The command contract
already forbids that ("the run ends at a mergeable PR, never at an offer to go
check on one"); nothing makes it cheap to honour across a 60–90 minute macOS
queue.

## What closing this looks like

A test, then a choice, in that order:

1. **Test.** A fixture forge whose checks stay `QUEUED` past the timeout, then
   settle green; and one where the PR is merged mid-wait. The test asserts what
   a waiter reports in each case and that no verdict is ever reported for a head
   that is not the PR's current head. This is runnable today against
   `ci_settle`'s existing seams.
2. **Choice**, after 3.2 of the throughput roadmap has its council answer:
   (a) `ci_settle` re-arms itself up to a stated total budget and exits only on
   a verdict, a head change or the budget; or (b) the settle obligation 3.2
   proposes carries the re-arm, and `ci_settle` stays a single bounded wait.

verify: the fixture test exists and fails with the re-arm removed; the choice
is a Decisions row in the throughput roadmap.

## What this stub deliberately does NOT do

It does not lengthen `--timeout-min`: a longer single wait moves the same loop
further out and makes a merged-while-waiting PR cost more. It does not touch the
macOS runner queue, which is the forge's and is the subject of
`the-macos-test-timeout-class.md` only where tests themselves time out.
