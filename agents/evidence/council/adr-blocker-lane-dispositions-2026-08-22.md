# Council disposition — ADR blocker-lane rows 3, 4, 8, 9, 10, 11

<!-- evidence-type: analysis -->

**Date:** 2026-08-22 · **Members:** 2/2 (anthropic, openai) · **Mode:** `design`,
depth `deep`, blind peer review · **Cost:** $0.0806 actual.

> **Why the council.** This session ran under a standing autonomous drain
> mandate in which a council decision substitutes for maintainer sign-off. It
> does **not** substitute where the council itself routes a transition to the
> owner — row 11 below is exactly that case, and it is recorded as an owner gate
> rather than decided here.

## The constraint the question carried

Venue derived from the **proposed transition**, never from who decided the
record originally, per the owner-reserved table in `decision-revisit-gate`. And
a council may not raise an evidence grade by agreeing — agreement is not
evidence.

## Verdict — 5 council-decidable, 1 owner-reserved

Both seats produced independent disposition tables and agreed on every row's
disposition, every venue, and (within one week) every follow-up date. Dates
below are the later of the two where they differed.

| Row | Record | Disposition | Venue | Dated follow-up |
|---|---|---|---|---|
| 3 | ADR-137 | **KEEP-BUT-REWRITE**, option (b) | **Council** for the rewrite; selecting an actual consumer-visible date stays **owner-reserved** | amendment draft **2026-09-05**, disposition **2026-09-12** |
| 4 | ADR-118 § 2 rows 1, 2, 8 | **RE-GRADE + MEASURE** — all three to E0 / `discovery: incomplete`; "never automated" becomes "manual pending evidence" | **Council** — reversible internal mechanism, lowers no floor | measurement contracts **2026-09-12**, first evaluation **2026-10-31**, lapse is a compliance finding **2026-11-01** |
| 8 | ADR-046/047/048 | **KEEP-BUT-DOWNGRADE** — 046/047 → E0, 048 → **E1** | **Council**, provided no public compatibility commitment changes | metadata + non-blocking enforcement amendment **2026-09-19**, doctrine review **2026-10-03** |
| 9 | ADR-088 | **RE-AFFIRM** with `protected_dimensions: [purpose]` and an explicit no-redefinition clause | **Council** — re-affirming preserves purpose; broadening, dissolving or federating is **owner-reserved** | re-affirmation + federation cross-link **2026-09-12**, operational boundary contract **2026-09-26** |
| 10 | ADR-020 | **RE-AFFIRM**, conditional on linking the measurement and verifying the stale-prose fix | **Council** — bounded, reversible consumer-scope mechanism | evidence link + fix verification **2026-09-05**, disposition **2026-09-12**, lapse **2026-09-13** |
| 11 | ADR-002 + ADR-114 | **MERGE-INTO-POLICY, conditionally** | **OWNER** — see below | contract + authority model **2026-09-26**, tested gate **2026-10-10**, new ADR and status changes **2026-10-17** |

## Row 11 — why it is owner-reserved, in both seats' words

This was the sharpest point in the session and both seats reached it
independently, against the roadmap's own expectation that row 11 was a
mechanical `MERGE-INTO-POLICY`.

Seat A: *"Calling 'operational parameters' a natural kind that's inherently
council-governed is the core error. Whether a parameter is 'operational' depends
on what authorization boundaries surround it, not on its technical properties.
… 'Moving numbers to policy' could shift them from owner-approved architectural
constraints to council-mutable config, effectively weakening the cap via
procedural reclassification."*

Seat B: *"It relocates control from an ADR-governed boundary to a potentially
routine configuration workflow. Without explicit delegated ranges, approval
rules, expiring waivers, audit history, and tests against unauthorized
relaxation, `MERGE-INTO-POLICY` is governance self-amendment disguised as
refactoring."*

**It becomes council-decidable once four things exist**, and not before:
a policy schema with an owner-approved delegated range; a regression gate that
**fails** when policy exceeds that range; a tamper-evident change history; and a
side-by-side showing the new policy enforces at least what ADR-002/114 enforce.

**Clause-specific status, not a blanket supersede** (seat B, uncontested):
ADR-002's *numeric clauses* are superseded by the new record; its historical
text and forward link stay. ADR-114 is superseded only for what is actually
replaced — its "7 of 9 kernel rules already carry overrides" observation remains
historical evidence and is not struck.

## Four cross-row findings neither seat was asked for

1. **E0 doctrine must not block admission.** If ADR-046/047 grade E0, they
   cannot by themselves reject a command. Both seats: low-evidence doctrine
   gating high-stakes decisions is a sequencing inversion, and the metadata
   change and the enforcement change must land **atomically** — otherwise the
   suite either keeps an E0 doctrine as a hard gate or briefly loses command
   admission control entirely.
2. **Grade vs. study design are different axes.** E1 on ADR-048 means *limited
   sources*, not *observational*. What would move it to E2 is additional
   independent sources, not a different method.
3. **"Manual" is not a safe fallback without a named authority.** Row 4's
   replacement posture needs who adjudicates, what inputs count, whether reasons
   are recorded, how inconsistency is appealed, and whether the same actor may
   design a metric and judge its success. Kill switches also need **recovery**
   criteria — minimum new sample, independent review, fresh window — or they
   become permanent or casually reversible.
4. **Row 9's boundary contract must not gain authority to redefine purpose.**
   The ADR prevails over the contract; broadening the category routes to the
   owner. Without that, repeated "still a content suite, but now also…"
   re-affirmations are incremental scope drift.

## One correction to the question, and one to a prior round

The question stated the roadmap's expectation that row 11 was `MERGE-INTO-POLICY`
council-side. Both seats rejected the venue while accepting the disposition —
recorded because it is the case where the lane's own expectation was wrong.

Seat B also refused seat A's E3 label on row 10: *"'Measured' establishes that
some observation exists, not its grade."* Row 10 therefore carries no grade in
this record, and its follow-up is exactly the missing link.
