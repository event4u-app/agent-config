# Council verdict — which shipped figures are ceilings on money or tokens

<!-- evidence-type: analysis -->

**Date:** 2026-10-06 · **Members:** 2/2 answered (anthropic/claude-sonnet-4-5,
openai/codex-default) · **Mode:** `analysis`, 2 rounds, blind peer review ·
**Cost:** $0.0000 actual — both seats resolved to subscription-authed CLI
transports and nothing was billed.

Step 1.2 of `road-to-a-spend-bound-only-where-one-was-set`. The bundle was a
13-row table of the package's shipped figures and controls, each described by
what it does and nothing else, with the instruction to answer only from the
table. The question asked for a two-way classification —
**money/token ceiling** vs **not one** — plus four named sub-questions, two of
which the roadmap required by name: the **unattended** run budget and the
debate's **between-round confirmation**.

## Attendance, honestly

The pre-run quorum line read `1/2 present` and the run was marked
**DEGRADED**, because the openai seat failed its live probe before dispatch.
It answered in the second round regardless, and the post-run line read
`2/2 present`. So the verdict below rests on two independent seats from two
providers, and the degradation marker describes the dispatch, not the
evidence. The two seats are recorded separately rather than merged, and where
they differ the difference is stated rather than averaged away.

## Verdict — the classification

| Rows | Class | Disposition |
|---|---|---|
| 1 — `cost_budget.max_input_tokens` / `max_output_tokens` | **Token ceiling** | moves to `0` |
| 2, 3, 5, 9, 11 — `max_total_usd`, `daily_limit_usd`, `debate.max_cost_usd`, the two paid-gate caps, the low-impact fast-path cap | **USD ceilings**, one family at five scopes | the first three move to `0`; the paid-gate pair ships unset; the fast-path cap is out of this change's scope |
| 4, 7 — `max_calls`, `cli_call_budget.max_calls_per_day` | **Not ceilings** — count and plan-quota guards | stay |
| 6, 8 — the between-round confirmation, `--confirm` | **Not ceilings** — authorization controls | stay |
| 10 — the unattended-run budget | **Not a ceiling** — a safety precondition | stays |
| 12 — a provider's own refusal | **Not a ceiling** — external failure | stays |
| 13 — the preset and `mcp.*` display figures | **Not ceilings** — unenforced | relabelled, not removed |

Both seats reached this table independently. No row was classified differently
by the two.

## The two rows the roadmap named

**Row 10, the unattended budget — both seats say it stays.** The reasoning
converged on one distinction: *requiring a decision is not the same as making
one*. The package is not saying "an unattended run costs at most $50"; it is
saying "you must state what it costs at most". A policy of "no ceiling unless
someone set one" addresses arbitrary numeric defaults, not the existence of a
safety gate — and an unattended run is the case where nobody is present to see
the estimate, so the gate has no substitute. **D7 is confirmed, not
overturned.**

**Row 6, the between-round confirmation — both seats say it stays.** The
sharpest formulation came from the openai seat: repeated approvals permit an
*unbounded* number of rounds, so the control cannot be a ceiling; it is
**incremental authorization with spend-reducing friction**. The anthropic seat
reached the same place by a different route — a ceiling enforces a quantity
bound, a confirmation enforces a decision point, and the two can be layered,
which is what makes them orthogonal. **D4 is confirmed, not overturned.**

**D3 (the per-day call guards, `max_calls`, the debate round limits) is
confirmed** by rows 4 and 7, with one refinement worth keeping: a count limit
becomes a money ceiling *only* when the cost per unit has a known floor. A
subscription call has none, which is exactly why these stay.

So the verdict overturns **none** of D3, D4 or D7, and this is the second
independent confirmation of that list — the owner reached the same conclusion
on the same day via D9, choosing option (a) and moving nothing between the two
lists.

## Recorded disagreement

The seats were not identical, and the difference is a real one rather than a
framing gap.

The **openai seat dissents on confidence, not on class.** It holds that the
table alone cannot establish three things about row 10: the units of the
mandated budget, whether that budget must be finite, and whether an explicit
unlimited value may be chosen. It marks row 10 **"needs discovery"** rather
than settled, and calls the anthropic seat's "requiring a budget ≠ imposing a
ceiling" **too categorical** — if the accepted budget must be finite and is
enforced, the combined mechanism does make the operator impose a ceiling, even
though the requirement itself is not one.

It also rejects an argument the anthropic seat used: that two controls
coexisting *proves* they serve different purposes. Coexistence is consistent
with distinct purposes but does not establish them, since redundant controls
can coexist too.

Both points are accepted here and neither changes the disposition: row 10
stays either way, and the open question is about what a *configured*
unattended budget may contain — which this roadmap does not touch.

## Standing limitation, stated by both seats

The bundle was a described table, not the code. Both seats named the same
blind spot: every classification is supported by the stipulated descriptions
and **unverified against the implementation**, with no file:line evidence
attached. The question was deliberately built that way — a classification
question should not be answerable by reading the implementation's current
behaviour, or it decays into "whatever the code does is right".

The implementation evidence lives elsewhere and was gathered separately: the
roadmap's own Context section carries a file-and-line anchor for every row,
and the steps that moved each figure carry a red-then-green test. A reader
who wants to know whether a ceiling named here actually fires should read
those, not this file.

## What this changed in the work

Nothing was reclassified as a result — which is the useful outcome to record,
because it is the one that could have gone the other way. The verdict's one
substantive contribution to the shipped change is row 13's wording: both seats
rejected "cap", "limit", "ceiling" and "target" for a figure nothing enforces,
and the openai seat's "configured budget values — not enforced" is the shape
step 3.5 implemented, as `preset cost figures (shown, NOT enforced — nothing
compares spend with these)`.
