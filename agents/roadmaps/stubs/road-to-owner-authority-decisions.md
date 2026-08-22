---
complexity: structural
---

# Stub: road to the owner-reserved authority decisions

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-22 when
> [`road-to-evidence-based-adr-governance.md`](../archive/road-to-evidence-based-adr-governance.md)
> was drained. It carries the three decisions that roadmap could not take,
> because each either widens agent write authority or weakens the reach of an
> authority floor — the owner-reserved class. Outcome state recorded on the
> parent: **transferred**.

## Disposition — read this before anything else

**No floor moved. No authority was widened, narrowed, or conditioned.** Every
existing constraint remains operative: `commit-policy.md:37`'s one-shot fence,
ADR-005 § 1's no-auto-merge rule, and the absence of any grade-derived reopen
path.

**This records neither owner acceptance nor owner rejection.** An AI-council
pass (2 of 2 seats convergent, 2026-08-22) was explicit that the wording matters:
the parent's rows are closed as **`AUTHORITY UNAVAILABLE — FLOOR PRESERVED`**,
*not* as `RE-AFFIRMED (no)`. The second would conflate an operational
preservation the council may decide with a policy rejection only the owner may
make. Per the `road-to-drain-commands` ruling of the same day: recording an
owner's *absence* as an owner's *decision* fabricates satisfaction of a terminal
condition.

| Layer | Who may decide | State |
|---|---|---|
| Operational preservation — refuse to ship unauthorized functionality | council | **settled**, floor intact |
| Policy — grant or refuse the authority | owner | **open** |

## Unresolved decision 1 — the commit-policy fence vs the delegation shape

From the parent's step 0B.1.

`src/rules/commit-policy.md:37` reads "A ONE-OFF AUTHORIZATION IS SPENT ON
EXACTLY THAT OPERATION, ONCE", which interrupts every commit outside a
`process-full` run; ADR-237 § 1 pre-clears it only for its own run.

> **Question:** does any explicit, this-turn, single-deliverable delegation in a
> consumer project pre-clear commit/push for that run?

`yes` would widen agent write authority, with the carve-out inheriting ADR-237's
excluded list verbatim (trunk, deploy, prod data, irreversible external).

## Unresolved decision 2 — ADR-005 § 1, auto-merge of ranked candidates

From the parent's step 0B.2.

ADR-005 predates ADR-237's authority model; competitive runs terminate at a human
merge even for integration branches.

> **Question:** may an end-to-end delegation cover integration-branch merges of
> judge-ranked candidates, with trunk staying excluded?

## Unresolved decision 3 — grade-derived authority, and its kill switch

From the parent's Phase 7 (steps 7.1 and 7.2), transferred whole.

> **Question:** may an independently validated evidence grade reduce the
> authorization burden for a reopen — and if so, under which pre-registered
> accuracy threshold, with which rollback unit?

**What the parent settled, so a reopening does not re-derive it.** Phase 6.3
published an **unevaluable null**: no qualifying Phase 6 measurements exist, so
step 7.1's four preconditions are untested. 7.1 therefore closed as **NOT
ENABLED — PRECONDITIONS NOT DEMONSTRATED**, which closes the current
evidence-and-activation attempt and *not* the policy question.

**The parent's own standing finding, which is the strongest argument against
enabling and is preserved verbatim in spirit:** round 5 was unanimous that
*fusing* an evidence grade with authority is the design's central error, because
the party assigning the grade would also be the party gaining authority from it,
**and** would be self-classifying the transition as `reversible-internal`.

**Step 7.2's requirement is carried here rather than dropped**, because a kill
switch defined after the fact is a word. Reopening requires **all** of:

- [ ] Published Phase 6 measurements — `adr-grade-accuracy-vs-gold`,
      `adr-evidence-discovery-recall`, `adr-beneficiary-grade-bias`,
      `owner-reversal-rate`.
- [ ] All four preconditions demonstrated: grade accuracy against the
      adjudicated gold sample at a pre-registered threshold; no
      beneficiary-linked grade bias; measured interruption reduction without a
      defect increase; a successful suspension drill.
- [ ] An explicit, authorized **owner** ruling.
- [ ] A **named** re-enabler.
- [ ] One of the four named rollback units chosen and recorded.
- [ ] The suspension mechanism implemented and drilled **before** any
      grade-derived action — suspension must stop new grade-derived actions,
      route transitions through the prior authority rules, halt authoritative
      backfill writes, preserve every grade and the audit history, and treat
      already-superseded records individually rather than blind-reverting.

If enabled it ships default-off, per-transition, and never lets one party both
assign the grade and classify the transition as `reversible-internal`.

## Blocking cost — recorded as `unknown`, deliberately

The parent required that each non-`yes` row record its blocking cost "as sourced
observations per Phase 3's `blocking_cost` shape". The honest record is that this
run produced **no measurement**, and that shape's own rule is that `unknown` is
the default where nothing was measured and "an inferred figure is never presented
as a measurement":

```yaml
blocking_cost:
  observations: []
  unknowns: [interruptions, context_tokens, blocked_items]
```

Why each is unknown rather than zero:

- **Decision 1** — this drain ran under a single standing mission authorization,
  so `commit-policy.md:37`'s one-shot fence was never exercised. No interruption
  count exists to report.
- **Decision 2** — no judge-ranked competitive run occurred in the window, so
  ADR-005 § 1 was never reached.

**"No cost was observed" is not "the cost is zero."** Both dimensions are
unmeasured, and a blocking cost may trigger reconsideration but never establishes
that a decision is wrong.

## Reopens when

An explicit owner ruling on any of the three, independently of the others. Each
is severable; none implies the others.
