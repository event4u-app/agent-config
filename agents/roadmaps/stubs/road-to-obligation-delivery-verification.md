---
complexity: bounded
review_by: 2026-09-30
probe: none
---

# Stub: road to verifying an obligation was delivered before measuring it

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-30 when
> `road-to-turnaround-followups.md` step 1.1 re-measured the batching
> obligation and found the number had not moved — and then found that the
> obligation had reached at most one session and plausibly zero. An AI council
> (2026-08-30, anthropic + openai, **2/2 convergent**) ruled the corpus
> shortfall a finding about the **delivery mechanism**, not about the
> obligation, and required it be routed to its own item rather than recorded as
> a behavioural null. This is that item.

## What was found

Measured 2026-08-30 while executing `road-to-turnaround-followups` step 1.1:

- The batching obligation landed in `af0cf0bf0` at 2026-08-30 14:38:40Z.
- Of the ten sessions in the measured window, by first transcript timestamp
  **one** began after it, **two** span it, and **seven** ended entirely before.
- A recursive grep for the obligation's own heading across the operator's
  installed agent tree hits **no installed copy** — only session transcripts.
  The single delivered copy is a projection inside the source checkout, loaded
  on demand rather than always.

So the number of sessions that could have *received* the obligation is **at most
one, plausibly zero**. `mean_batch_size` read 1.01 → 1.01, and that null
measures the delivery channel rather than the instruction.

## Why this is not the parent roadmap's problem

Two competency questions were being conflated, and the council named the split
in both responses:

| Question | Kind | Owner |
|---|---|---|
| *Does an explicit batching instruction change an agent's tool-call grouping?* | behavioural | `road-to-turnaround-followups` AC-1 |
| *Do on-demand projections propagate a config change to a running agent?* | infrastructure | **this stub** |

Recording the second as an answer to the first is what one seat called poisoned
evidence: a later reader cites *"batching obligations measured at 1.01 → 1.01"*
without knowing that zero sessions were exposed.

## Probe — is the gap still real?

Read, at the time this stub is next opened: does the operator's installed agent
tree carry the obligation text at all, and is there any mechanism that records
per-session which obligations were in context at session start? **Baseline
2026-08-30:** no installed copy; no such mechanism.

## What would close it

One of these, and the choice is itself part of the work:

1. **A delivery record.** Something a measurement can read to answer *"was this
   obligation in context for this session?"* per session, rather than inferring
   it from an mtime window.
2. **A documented propagation model.** If on-demand projection is the intended
   delivery, state the propagation guarantee it makes and the lag it carries, so
   a measurement can name a corpus that satisfies it without per-session
   verification. One council seat argued explicitly for this over per-session
   self-report, on the ground that requiring agents to confirm receipt builds
   instrumentation the repository does not have and that AC-1 never asked for.
3. **A recorded decision that temporal-post-change suffices**, with its
   evidentiary limitation written down — the honest version of Reading 1, which
   the council rejected as a default but named as a legitimate policy if adopted
   deliberately.

## What this stub deliberately does NOT do

It does not propose raising the reminder's frequency, and it does not reopen the
parent's pre-commitment. The parent pre-committed that a null is the RESULT and
never a reason to repeat the reminder more loudly; that binds harder here, not
less, because a channel that is not connected cannot be fixed by sending more
down it.

## Related

- `road-to-turnaround-followups.md` § Phase 1 — the parent, where AC-1 stays
  open under the council's `not-met` verdict.
- `src/config/turnaround-budget.json` — `subsequent_readings[0]` carries the
  reading and its corpus window.
- `agents/evidence/analysis/agent-turnaround-2026-08-30.md` — the R1–R5
  re-reading block, where R1 records the delivery finding.
