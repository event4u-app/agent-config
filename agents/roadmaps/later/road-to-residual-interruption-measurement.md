---
complexity: structural
status: later
parent_roadmap: road-to-authorization-that-reaches-further
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "The council that descoped step 3.3 required a receiver that preserves ownership and a mechanical reopening trigger, and the archival sweep accepts a carry only into agents/roadmaps/ or later/ — a stub is rejected as a receiver, so parking here is the only shape that satisfies both. The parent roadmap was archived in the same change, so active_roadmaps fell 13 to 12 while later_roadmaps rose 81 to 82: the estate is unchanged in total count and strictly smaller in active work."
review_by: 2026-12-06
design_validated: "AI council 2026-09-06, 2/2 unanimous — descope the measurement half, complete the pre-registration half now"
capability_gap: none
blocker_class: observation
blocker_opened: 2026-09-06
---

# Road to the residual-interruption measurement

> **Parked — not active work.** A **drain-run transfer**, created 2026-09-06 when
> `road-to-authorization-that-reaches-further` was drained. It carries the
> measurement half of that roadmap's step 3.3. The pre-registration half is
> **done** and is not repeated here — it lives in
> `agents/evidence/analysis/authorization-friction-baseline-2026-09-06.md` § 3,
> and this roadmap judges that claim rather than restating it.

## What is deferred, and what is not

| Half | State |
|---|---|
| Pre-register the expected drop as a falsifiable claim, with an honest null permitted | **complete** — the frozen claim, both axes, the missing-data treatment, the unchanged window, the direction and magnitude, the comparison method and the named confound are all recorded in the evidence artefact above |
| Report residual interruptions over a window wide enough to mean something, and judge the claim | **deferred to this roadmap** |

The two halves are separable and only one is time-gated. The pre-registration
was the urgent half: once Phase-1 results have been inspected, a claim recorded
afterwards is no longer pre-registered, and the step's own wording requires it
"before any phase-1 change is measured against it".

## Why it is deferred — a measured absence, not an unfinished task

`./scripts-run src/scripts/interruption_report` on **2026-09-06** reports:

```
window: 0 session(s) found / 30 requested   ⚠️  SHORT WINDOW — see notes
CONTACT AXIS  ·  n=0 runs — ⚠️  UNDERPOWERED, floor is 20
note: interruptions.jsonl is empty or absent — the contact axis has no observations yet.
note: no chat history with session tags — the wall-clock axis has no observations.
```

**Both** observation axes are empty. The SHORT WINDOW flag is the tool correctly
reporting that the observations do not exist yet — it is not a threshold a
longer run clears, and with zero observations a smaller window is equally unmet.

No amount of work performed today satisfies the deferred half. That is the whole
reason it is parked rather than an open step.

## Three shortcuts, each refused explicitly

Recorded so none of them is quietly taken by a later run that reads the flag and
looks for a way to clear it.

| Shortcut | Ruling |
|---|---|
| Record the empty state as the baseline | Legitimate **only** as a dated status snapshot proving no observations existed — which is what the block above is. It does **not** satisfy the deferred half. |
| Synthesise sessions to fill the buffer | **False green.** Useful for testing the reporter, invalid as evidence about real interruptions. |
| Lower the window request so the flag stops firing | **False green** when done to remove the warning. It changes the indicator, not the evidence. |

The window and the power floor are part of the frozen pre-registration. Moving
either as a way of reaching a verdict invalidates the claim rather than
answering it.

## Reopens when — observations, not a date

Reopen when **both** axes carry enough qualifying observations to judge the
pre-registered claim:

- [ ] `./scripts-run src/scripts/interruption_report` reports
      `window_short: false` — sessions found meets the unchanged
      `DEFAULT_WINDOW` request of 30.
- [ ] The **contact** axis reports `n >= 20` runs (the unchanged
      `POWER_FLOOR_RUNS` floor), so the axis is not underpowered.
- [ ] The **wall-clock** axis reports `n >= 20` runs, on the same terms.
- [ ] Qualifying sessions exist on **both** sides of the Phase-1 tree SHA
      `473f4e18e3e7211f3edbc499ba81de8bc4ed4c4e`, so there is something to
      compare.

**The trigger is the four checkboxes above and nothing else.** `review_by:
2026-12-06` is a scheduling date for someone to re-run the one command below; it
is **not** the reopening condition, and its arrival with the boxes unticked
means this file is re-dated rather than reopened.

### The mechanical trigger — one command

```bash
./scripts-run src/scripts/interruption_report --json \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['sessions_found'], d['window_requested'], d['window_short'])"
```

`window_short: false` is the signal that the first box can be ticked. Descope
must not mean passive neglect: this roadmap keeps a named owner and a check that
costs one command, so the deferred half fails visibly rather than silently.

## What the reopened work is, and its bounds

Narrowly: report residual interruptions over the qualifying window and **judge
the pre-registered claim** — confirmed, null, or adverse. It does **not**
re-derive the baseline; step 3.1's figure and its two-sided vocabulary reading
are in the evidence artefact and are referenced rather than duplicated.

A null or an adverse result is a result and is recorded as the finding. The
named confound stands: most confirmations in the round's own account originate
outside this package, so a drop coinciding with a host upgrade is reported as
confounded rather than as a confirmation.

## What this roadmap does NOT claim

It takes no position on whether Phase 1 reduced interruptions. It records that
the question is unanswered because the observations do not exist, that the claim
against which they will be judged is frozen and dated, and that no reading of
the current empty corpus is evidence for or against the claim.
