---
complexity: structural
review_by: 2026-09-21
probe: none
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

## Unresolved decisions 5-8 — added 2026-08-26 by the inbox-harvest drain

Four more, each with the exact instrument it moves and what changes on a yes and
on a no. Added here rather than in a new file because this stub already IS the
queue, and a second queue is how a queue stops being read.

### Decision 5 — the release-placeholder guard's estate offset

- **Instrument:** `agents/roadmaps/stubs/road-to-release-placeholder-guard.md:3`
  (`status: stub`) against `CHANGELOG.md:419-422`, which ships four
  `_auto-derived, rewrite before merge:_` lines under `## [14.12.0]`.
- **The situation:** that stub's AC-1 at `:426` **is** the gate reviewers asked
  for. It was promoted on 2026-08-24 and reverted the same day by a 2/2 council
  verdict — **not on merit**, but because the run self-certified an estate
  exemption where a named offset was required.
- **Yes** (name an offset and promote): the guard lands and placeholder lines
  stop reaching a release.
- **No:** the four lines stay in a shipped CHANGELOG and the next release
  inherits the same shape, because nothing refuses them.

### Decision 6 — the Class-B resident-service prohibition

- **Instrument:** `docs/decisions/ADR-124-embedded-engine-doctrine.md:109-110`
  together with the backed `claim:no-runtime-daemon` at `docs/CLAIMS.md:104-108`.
- **Yes** (relax): a resident service becomes admissible, and the backed claim
  must be retired through the ledger's own lifecycle rather than edited.
- **No:** the prohibition stands and every design that wants a daemon is
  answered by the ADR without a fresh argument. **This is the status quo and it
  costs nothing to keep** — recorded so the question is not re-argued from
  scratch each time.

### Decision 7 — accepting ADR-240

- **Instrument:** `docs/decisions/ADR-240-evidence-based-decision-floor.md`,
  which ships `status: proposed` and whose own text reserves acceptance to the
  owner.
- **Yes:** the evidence floor becomes citable as accepted, and gates may rest on
  it.
- **No / indefinite:** it stays `proposed`, which means anything citing it cites
  a proposal — and a proposal cited as a floor is the shape
  `decision-revisit-gate` warns about.

### Decision 8 — the `road-to-skill-ecosystem-*` family cap

- **Instrument:** `lint_roadmap_family_cap.ts:42` (`CAP = 2`), whose reason is
  `ADR-215 § D2`.
- **Council-settled for now, 2026-08-26, 2/2:** leave the cap at 2. The queue
  is real — `later/road-to-skill-ecosystem-executable-payloads.md:69-75` is
  third in a queue of two — but the cap is doing what it was built for, and
  both current occupants were completed work awaiting merge at the time of the
  verdict.
- **Yes** (raise): `lint_roadmap_family_cap.ts:19-20` says that is a one-line
  change **plus a new decision record**, never a silent edit, and `ADR-215 § D2`
  must be amended rather than contradicted.
- **No:** the payloads roadmap waits for the first slot a merge frees.
- **Revisit if** either in-flight family PR stays unmerged beyond seven days, or
  becomes materially blocked, or any completion or release gate turns out to
  rest on the non-executing evaluations that roadmap owns.
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

An explicit owner ruling on any of the four, independently of the others. Each
is severable; none implies the others — and Decision 4 is severable per RECORD,
so a ruling on ADR-108 does not settle ADR-107.
