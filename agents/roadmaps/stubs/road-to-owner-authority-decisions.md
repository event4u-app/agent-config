---
complexity: structural
review_by: 2026-09-25
probe: none
---

# Stub: road to the owner-reserved authority decisions

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-22 when
> [`road-to-evidence-based-adr-governance.md`](../archive/road-to-evidence-based-adr-governance.md)
> was drained. It carries the three decisions that roadmap could not take,
> because each either widens agent write authority or weakens the reach of an
> authority floor — the owner-reserved class. Outcome state recorded on the
> parent: **transferred**.

## Probe — a recorded owner ruling, per decision

Read, independently per decision: does a dated, explicit ruling by the
repository owner exist in the tree — an ADR, a recorded decision entry, or a
signed statement under `agents/` — answering Decision 1, 2, 3, or 4 (and for
Decision 4, that individual record)? Silence is not an answer: recording an
owner's absence as an owner's decision is the fabrication § Disposition below
refuses. **Baseline 2026-08-22:** four open, no ruling recorded on any.

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

## Unresolved decision 4 — five permanence claims that are owner purpose, not mechanism

**Added 2026-08-22 by `road-to-evidence-based-adr-governance` 4.3**, which split
`lint_provenance_vocabulary:permanence-language` along authority and found the
split does not follow the row boundary. Six of the eleven hits were mechanism
decisions and were repaired in that step by taking ADR-240 § 6's escape — a
reopen condition in place of a permanence claim. These five are not that shape:

| Record | Line | The claim |
|---|---|---|
| ADR-107 | `:37` | "commercial (Pro-tier) ship would require licen…" — `forever` in the Decision |
| ADR-108 | `:5` | `decision:` slug `open-source-forever-no-commercial-tier` |
| ADR-108 | `:12` | title — "The suite is open-source forever; no commercial / Pro tier" |
| ADR-108 | `:24` | Decision — "There is no commercial tier, now or in the future" |
| ADR-108 | `:29` | Decision — "Liability disclaimer is permanent" |

**Why an agent must not touch them.** These are statements of what the project
*is for*, and the owner-reserved table in `decision-revisit-gate` routes exactly
this class to the owner: purpose, licensing posture, and a public liability
commitment. ADR-240 names the discharge — record `authority_basis: owner_intent`,
which the gate's own baseline note calls "an owner ruling, not an agent edit" —
and the ruling is the whole decision. An agent that reworded the purpose to clear
a lint would have changed the project's declared posture to make a gate green,
which is the inversion this stub exists to prevent.

**What the decision actually is, and it is one line per record:** does this
record's permanence claim stand as owner intent (→ `authority_basis:
owner_intent`, lint clear, claim intact), or is it a mechanism decision that
should carry a reopen condition instead (→ the § 6 escape, as the other six
took)? Not "should the project stay open-source" — nothing here proposes that,
and the drain run did not put it to the council.

**A regression test pins the current state in both directions.**
`tests/scripts/lint_provenance_vocabulary.test.ts` asserts these two records
stay DETECTED and the three repaired ones stay clean. So a run that "fixes"
ADR-107 or ADR-108 by rewording turns that test red — the fence is deliberate,
and it is the reason the owner ruling cannot be quietly pre-empted.

**Cost of not deciding:** the baseline sits at 5 with zero headroom, so the gate
keeps working for every new record; nothing degrades. The 56-day expiry on the
entry is the real clock — if the number has not moved by then, the gate fails
until someone decides whether the doctrine is real.

## Unresolved decision 5 — the release-placeholder offset

**Added 2026-08-26** by `road-to-inbox-harvest-2026-08-f-owner-decision-queue`
step 2.2, which registers the owner-reserved decisions that drain run surfaced.

**Instrument:** `agents/roadmaps/stubs/road-to-release-placeholder-guard.md:36-38`
— the stub records that its own promotion needed both an owner instruction and a
named `one_in_one_out` offset; the instruction existed, the offset did not, and
the run *"wrote an `estate_offset_exempt` claim to itself instead"*.

> **Question:** may a run satisfy the one-in-one-out estate rule with a
> self-written `estate_offset_exempt` claim when no archive move is available,
> or does an offset require a named counterpart the run did not choose?

**If the owner says yes** — self-certified exemptions stay legal, and the estate
ratchet's one-in-one-out half is discipline rather than a constraint: any run
that cannot find a counterpart writes its own reason and proceeds.
**If the owner says no** — a run with no available offset cannot add to the
estate at all, and the placeholder guard (plus every future addition in the same
position) waits for a real archive move. That is the stricter reading and it is
the one the stub itself argues for.

**Why it is owner-reserved:** the party writing the exemption is the party
gaining the slot. Self-certification of an estate constraint is the same
authority shape as the grade-derived-authority question in Decision 3.

## Unresolved decision 6 — the Class-B resident-service prohibition

**Added 2026-08-26** by the same step. **Surfaced, not decided** — an AI council
(2026-08-26, 2/2) was explicit that this is *established policy being preserved*,
not a new constraint, and that reopening it is owner-reserved.

**Instrument, two halves that must move together:**
- `docs/decisions/ADR-124-embedded-engine-doctrine.md:110` — the Class-B row:
  *"Anything with a lifecycle beyond one command … **PROHIBITED in core**,
  unchanged."*
- `docs/CLAIMS.md:120-125` — `claim:no-runtime-daemon`, `status: backed`,
  *"The whole layer is compiled into host agents with zero runtime daemon."*

**Provenance correction, recorded rather than silently fixed:** the roadmap step
that requested this entry cited `docs/CLAIMS.md:104-108` for that claim. Read at
HEAD, `:104-108` is the `**What \`exec:\` cannot cover.**` paragraph; the claim is
at `:120-125`. The instrument is the one above.

> **Question:** does core ever admit a Class-B resident service — a watcher, a
> memory backend run as a server, a background worker?

**If the owner says yes** — `claim:no-runtime-daemon` loses its backing and must
be restated or retired, `docs/contracts/no-runtime-boundary.md` is amended, and
the sibling-package routing ADR-124 prescribes stops being the answer.
**If the owner says no** — nothing changes; the row and the claim stand, and
proposals for a resident index, daemon or watcher keep routing to
`agent-ide-plugin` or a sibling package.

**This entry takes no position.** It exists because the prohibition was
reachable only by reading two documents that do not cite each other.

## Unresolved decision 7 — acceptance of ADR-240

**Added 2026-08-26** by the same step. **Surfaced, not decided**, and for a
reason stronger than convention: the record's own text reserves acceptance to
the owner, so an agent accepting it would be using the record to authorise
accepting the record.

**Instrument:** `docs/decisions/ADR-240-evidence-based-decision-floor.md:3` —
`status: proposed`.

> **Question:** is ADR-240 accepted, and if so does its evidence floor bind
> retroactively or only records written after acceptance?

**If the owner says yes** — the evidence floor becomes live and every ADR
carrying an evidence grade is gradeable against it; the retroactivity half needs
its own answer, because a floor applied backwards reclassifies 185 existing
records at once.
**If the owner says no** — the floor stays proposed, the grading vocabulary stays
descriptive, and `decision-revisit-gate`'s statement that *no grade lets an agent
supersede a record* stays the operative rule with nothing behind it but prose.

## Unresolved decision 8 — the `CAP = 2` family limit

**Added 2026-08-26** by the same step. **The council DID decide the immediate
question** (2026-08-26, 2/2 convergent: keep `CAP = 2`), so what is registered
here is narrower than the other three: not whether the cap stands today, but
whether `ADR-215 § D2`'s reasoning is the owner's settled position.

**Instrument:** `src/scripts/lint_roadmap_family_cap.ts:42` — `const CAP = 2;`,
whose stated reason is `ADR-215 § D2`. Raising it is *"a one-line change plus a
new decision record, never a silent edit"* (`:19-20`).

**The premise the blocker was written against is STALE, and this is the
correction rather than the decision.** The blocker described *"a queue of two
with three files in it"*. Measured at HEAD on 2026-08-26:
`./scripts-run src/scripts/lint_roadmap_family_cap` reports
**`0/2 slot(s) used`** — all three `road-to-skill-ecosystem-*` roadmaps
(`capability-queue`, `executable-payloads`, `security-and-conformance`) sit in
`agents/roadmaps/later/`, and the cap binds nothing at all today.

So the cost the blocker named — *"the eval-runner stub keeps being re-proposed by
every incoming bundle, because from outside the estate it looks unowned"* — is
**not a cap problem**. Nothing is waiting for a slot; three files are parked for
their own reasons. Both council seats independently predicted that registering a
decision in a distant register would not stop the re-proposal loop, and the
measurement says why: the loop is not about the cap.

> **Question:** does `ADR-215 § D2`'s reasoning — one maintainer cannot hold more
> than two parallel workstreams in one family — stand as the owner's position?

**If the owner says yes** — `CAP = 2` stays, and a future family member above the
cap waits rather than widening the road.
**If the owner says no** — the cap is raised in a one-line change **with** a new
decision record amending `ADR-215 § D2` rather than contradicting it, per the
linter's own docblock.

**Refused explicitly, so it is not re-proposed silently:** re-anchoring the
eval-runner work outside the family prefix. That roadmap calls it gate-gaming at
its own `:74`, and this entry records the refusal rather than leaving the option
to look unconsidered.

**Council `revisit-if`:** a slot opens; an active family member lacks a credible
completion or archival path at its next scheduled review; independent work is
demonstrably harmed by serialization; or re-proposals continue after the waiting
state is visible to intake.

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
- **Decision 4** — the five records block no work at all today: the ratchet is
  green at 5 and shrink-only, so the claims cost nothing until the expiry. That
  is a real zero for `blocked_items` and is still recorded as an observation
  rather than folded into the `unknowns`, because it was measured.

**"No cost was observed" is not "the cost is zero."** Both dimensions are
unmeasured, and a blocking cost may trigger reconsideration but never establishes
that a decision is wrong.

## Reopens when

An explicit owner ruling on any of the **eight**, independently of the others.
Each is severable; none implies the others — and Decision 4 is severable per
RECORD, so a ruling on ADR-108 does not settle ADR-107.

Decisions 5-8 were added on 2026-08-26 and are severable from 1-4 in both
directions. Two of them (6 and 7) are **surfaced without a position**: this file
records where the decision lives and what each answer costs, and takes neither
side. Decision 8 is narrower still — the council settled the operational
question and only the underlying reasoning is registered here.
