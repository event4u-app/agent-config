<!-- evidence-type: analysis -->

# Ring 0 — the unattended-install record

The instrument step 4.2 of
`road-to-an-update-that-installs-itself-only-when-it-is-safe` asks for, and the
file step 4.3's invitation gate reads. It exists so that "four clean releases"
is a row somebody can count rather than an impression somebody has.

**Status on 2026-10-20: ENROLLED, NOT EXITED.** Zero releases recorded. The
invitation of step 4.3 is therefore closed, by this file, on every machine.

## The ring

Ring 0 is the `next` dist-tag that `.github/workflows/publish-npm.yml:154-168`
already publishes to — not a new voluntary diagnostic ring. A second ring would
be a second thing to maintain (roadmap decision D4).

A machine is in ring 0 when **both** hold:

- it installs from the `next` dist-tag, and
- its user-global settings carry `update.mode: auto`.

Nothing enrols a machine automatically, and nothing in this package reads this
file to decide whether a machine is enrolled — enrolment is the maintainer
setting the key.

## The exit condition

```
FOUR CONSECUTIVE RELEASES INSTALLED UNATTENDED, WITH ZERO ROLLBACKS
AND ZERO HOOK ERRORS MEASURED THE WAY STEP 1.1 MEASURED THEM.
A GAP IN THE SEQUENCE RESETS THE COUNT. AN UNRECORDED RELEASE IS A GAP.
```

Consecutive is over **releases**, not over attempts: a release that the gates
correctly refused (age, `deprecated`, `engines`, provenance, a live session) is
not a failure and is not a gap either — it is recorded with `refused` and the
reason, and the next release continues the sequence. A release that installed
and then had to be rolled back resets the count to zero.

"Zero hook errors" is the Phase 1.1 probe's own measure: failed hook
invocations during the swap window, counted the way
`agents/evidence/analysis/mid-session-swap-probe-2026-10-18.md` counted its
490 of 4,190. The swap now happens only at a session start with no other
session live, so the expected count is zero and a non-zero one is the finding.

## The machine-readable exit line

Step 4.3's gate reads exactly one line of this file, and it is the line below.
It is written by a human after reading the table, never by an agent, and it is
the only thing that opens the invitation:

```
ring-0-exit: no
```

Change it to `ring-0-exit: yes` only when the table carries four consecutive
clean rows. Nothing recomputes it from the table — a count an agent could
compute is a count an agent could be wrong about, and this one authorises a
prompt on an install the user already has.

## The record

| # | Version | Channel | Installed at | Outcome | Rollbacks | Hook errors during swap | Notes |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | No release has been installed unattended yet. |

## What this file is not

It is not a claim that unattended installation works. It is the place the claim
would have to be made, with rows, before step 4.3's question may be asked of
anyone.
