---
adr: 240
status: proposed
date: 2026-08-21
decision: evidence-based-decision-floor
supersedes: —
superseded_by: —
phase: road-to-evidence-based-adr-governance · Phase 5.1
type: structural
provenance:
  kind: mixed
  decision_makers: [owner, agentic-review]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E3
  discovery: complete
  basis:
    - https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record (2026-08-21)
    - https://bmjopen.bmj.com/content/9/6/e027445 (2026-08-21)
    - docs/decisions/engine-reclassification-2026-07.md
    - claim:code-graph-retrieval-null
authority_basis: evidence
reopen_policy: directional
protected_dimensions: [governance]
review_trigger: >-
  Reopen when measured ADR-caused interruptions do not materially decline
  against the pre-registered baseline (claim:adr-interruption-baseline), when
  evidence grading produces material misclassification against the adjudicated
  gold sample (claim:adr-grade-accuracy-vs-gold), or when a run is wrongly
  blocked or wrongly authorized because of this model.
---

# ADR-240 — An ADR's weight comes from its evidence, not from its existence

## Status

**proposed**, deliberately — and the status is part of the decision rather than
a step not yet taken.

A record that would activate a new authorization regime must be separately
reviewable from the schema it governs, so it does not ship `accepted` in the
same change as the metadata it interprets. It is also the one record whose
acceptance this roadmap cannot self-authorize: it carries
`protected_dimensions: [governance]`, and governance self-amendment is
owner-reserved by `adr-layout`'s own discriminator.

There is a second reason, and it is the more interesting one. A record that
fixes *ADRs becoming law* should not become law by being written. So this one
ships with a `review_trigger` pointed at its own measurements: if the
interruption count does not fall, or the grading misclassifies against an
adjudicated sample, the record reopens on its own terms rather than on someone
noticing.

## Context

The estate holds 184 records (177 flat, 7 per-area; 147 accepted). Nothing
about that number is the problem. The problem is that "we documented a decision
once" became "this is architecture law", and that a council's agreement was at
times treated as though it were evidence.

`decision-revisit-gate` already says a recorded decision is a decision under
past conditions rather than a permanent law. What was missing is the part that
makes the sentence operational: a machine-readable record of **who** decided
and **how fact-based** the decision is, so an agent meeting a lock can tell a
measured constraint from a snapshot without re-deriving the whole argument.

Three things in this tree establish the need, and each is a measurement rather
than an opinion.

**Consensus was treated as evidence, and measurement disagreed.** 44
engine-shaped REJECT records accumulated between 2026-06-01 and 2026-07-22
under an over-broad, council-carried interpretation of earlier runtime
decisions (`engine-reclassification-2026-07.md`). The maintainer reversed the
interpretation; the first engine actually built under the corrected reading was
then measured and returned an honest null — recall 0.365 against disciplined
grep's 0.797, pre-registered and hash-bound
(`docs/CLAIMS.md` `claim:code-graph-retrieval-null`). Council agreement carried
44 rejects. One measurement disposed of the feature. The lesson is not that
councils are useless — it is that agreement among correlated reviewers is not
an independent check, which is exactly why a council cannot validate a grade
whose consequence it would benefit from.

**Classify-on-desk produced approximately nothing.** `adr-layout` chose, for
good reasons, to classify an ADR's reopen authority when it lands on the desk
rather than in bulk. Measured at `492873f09`: `reopen_policy` exists in **1 of
177** flat records and **0 of 7** per-area records. The decisive detail is that
the 2026-08-19 reopen sweep *was* the on-the-desk moment for twelve records and
classified exactly one, noting in its own words that ADR-216 "is the first ADR
to carry the new fields". Eleven of twelve left the desk unclassified in the
very change that created the mechanism. A mechanism that fires once per twelve
opportunities is not a policy.

**Prose lifecycle enforcement is satisfied by its weakest honest reading.** The
archived predecessor roadmap checked its step "Resolve ADR-001 specifically" as
done — and the checkbox is honest, because that step's own text operationalized
"resolve" as "give it a disposition in the sweep table", which happened. The
row it produced says in its own words that the follow-up ADR was never written,
and ADR-001 is still `accepted` with `superseded_by: —`. Nothing was hidden and
nothing was lied about; the step was simply satisfiable without the outcome.

## Decision

### 1. Two descriptive axes, and they are descriptive

Every ADR records `provenance` (who decided) and `evidence` (how fact-based),
per `adr-layout § Provenance and evidence`. `provenance.kind` is `human |
agentic | mixed | unknown`. A council is **not** its own kind: epistemically it
is agents, and a separate class would re-suggest that seats confer a different
quality of authority. `agentic_mode` records the shape without creating the
class.

`evidence.strength` is `E0`–`E4` and is **claim-relative, never a count of
sources**. Three models citing three sources yields E3 *because of the
sources*. "We use PSR-12 because it is the PHP-FIG community standard" cites an
applicable external standard and is E3 on that basis alone; adding a repo-local
measurement improves the basis without making the claim more true.

### 2. The grade prices burden. It does not confer authority.

```
AN EVIDENCE GRADE IS A MEASUREMENT, NOT A PERMISSION.
NO PARTY GAINS AUTHORITY FROM A GRADE IT PROPOSED OR BENEFITS FROM.
`reversible-internal` IS ITSELF AN AUTHORITY-BEARING CLASSIFICATION AND IS
NEVER SELF-ASSIGNED BY THE PARTY THAT WOULD ACT ON IT.
AN ADR'S HISTORICAL DECISION-MAKER DOES NOT DETERMINE ITS REOPEN VENUE.
```

This clause is the one an earlier draft of this model got wrong, and the error
is worth recording because it is easy to make twice. That draft claimed the
grade priced only the reopen burden while simultaneously ruling that "agentic +
E0/E1 + reversible-internal ⇒ the agent may supersede directly". Both cannot
hold: if moving E2 to E1 changes whether an agent may act alone, the grade is
an authorization input, and naming the result "provisional" changes neither the
trust boundary nor the blast radius.

Worse, it compounds. The same party would assign the grade *and* classify the
transition as reversible-internal — two of its own judgments, combined into a
permission. That is the 44-REJECT shape with better metadata: an agent has a
structural incentive to grade a constraining record weak, and provenance
recording the conflict is an audit trail, not a control.

So the burden table in `adr-layout § The reopen record` prices what a reopen
must **do**. Who may do it stays with the transition-based discriminator,
unchanged.

### 3. A council reviews; it does not grade itself upward

A council may discover options, challenge assumptions, review evidence,
identify missing evidence, and recommend a decision. It may not raise
`evidence.strength` by agreeing, establish product purpose, or establish an
empirical claim without measurement.

### 4. A low-evidence record may state a decision; it establishes nothing about
the alternatives

"We chose B because we had to choose" is a legitimate and publishable record.
Three months later it is not grounds for "A is forbidden, the ADR says B".
`adr_cite_check` surfaces the distinction at cite time
(`authority_effect: disabled-shadow-mode`) rather than the record being demoted
out of `accepted` — the record is honest, its reach is what was overstated.

### 5. Honest-E0 is publishable, and `discovery` is what makes it honest

An empty Evidence section means E0 by construction and the record says so, on
the same doctrine that makes an honest null publishable. But a bare E0 collapses
five states: evidence absent · evidence existed and was never cited · cited
somewhere non-standard · present in the tree and not found · external and never
fetched. The last four are **discovery** failures. `discovery: incomplete` is
therefore required and default on E0; `complete` asserts absence and is a claim
its author owns.

### 6. Permanence language is out

`forever`, `permanently`, `never revisit`, `never reconsider` and their kin do
not belong in a mechanism decision's title, slug, or Decision section. ADR-208
is the standing demonstration: its title says the tree is kept forever, its
Decision says KEEP permanently, and its own frontmatter carries the conditions
under which that decision should be reopened. A record cannot be both.

An owner purpose statement records `authority_basis: owner_intent` instead —
authoritative, and honest about being a choice rather than a law of nature. That
field is the one the schema declares and the validator checks; an earlier draft
of this record named a bare `owner_intent: currently binding` key, which no
schema declares anywhere in the tree. It would have worked — nothing rejects an
unknown frontmatter key — and that is what made it wrong: a second vocabulary
for one concept, readable only by the lint that invented it.

### 7. Fewer ADRs

An ADR is for a decision that is architecturally significant, hard or costly to
reverse, or broadly constraining. A temporary numeric threshold, a benchmark
value, a model mapping, one-off release sequencing and a reversible local
implementation detail are not — those are config, measurement records,
experiments, or roadmap items.

ADR-002 and ADR-114 are the reference case. ADR-002 encoded `25k → 26k` and a
`4.0k` override ceiling as architecture law; ADR-114 then had to add another
override, recording that 7 of 9 kernel rules already carry them. The principle
— a kernel budget exists, is measured, is capped — is the ADR. The numbers
belong in a versioned budget contract with a regression gate, so a
recalibration stops requiring an architecture supersession.

## Evidence

| Claim | Basis |
|---|---|
| Recording a confidence level on an ADR is established practice, not a local invention | Azure Well-Architected ADR guidance, which recommends recording the decision's confidence level (fetched 2026-08-21) |
| Separating evidence certainty from the strength of what is recommended is a transferable method | GRADE's two-axis separation of certainty of evidence from strength of recommendation (BMJ Open, fetched 2026-08-21) |
| In this tree, consensus was treated as evidence and measurement disagreed | `engine-reclassification-2026-07.md` — 44 engine-shaped REJECTs; `claim:code-graph-retrieval-null` — recall 0.365 vs 0.797, pre-registered, hash-bound |
| Classify-on-desk produced ~nothing here | `grep -rln '^reopen_policy:' docs/decisions/ docs/adrs/` → 1 of 184; the 2026-08-19 sweep classified 1 of the 12 records it touched |
| Prose lifecycle enforcement is satisfiable without the outcome | `agents/roadmaps/archive/road-to-adr-revisit-governance.md:320` checked done; ADR-001 still `accepted`, `superseded_by: —` |

The grade is **E3 by triangulation** — an authoritative external recommendation,
a transferable method, and this repository's own measured defects — and
explicitly not by counting three sources. Were the two external references
withdrawn tomorrow, the repo-internal measurements would still carry the
mechanism at E2; the external half is what makes the *design* conventional
rather than idiosyncratic.

## Assumptions

Stated as assumptions because they are not measured, and a reader is entitled to
know which parts of this record are which.

1. **A heuristic census can propose grades a human will mostly accept.**
   Unmeasured until the calibration tranche runs. If reviewers disagree with the
   census more often than they agree, the census is a cost with no benefit and
   the proposals should be dropped rather than tuned.
2. **A grade surfaced at cite time changes what an agent does with a lock.** The
   whole interruption-reduction argument rests on this and it is the thing
   Phase 6 measures. A null here is a real possible outcome.
3. **The estate's dominant governance cost is unevaluated locks rather than
   missing decisions.** If the opposite is true, this model adds metadata to a
   problem that was never the bottleneck.
4. **`discovery: complete` is answerable in practice.** Asserting that no
   evidence exists anywhere is a strong claim, and it may prove that almost
   every honest answer is `incomplete` — in which case the field records
   uncertainty rather than resolving it, which is still better than a bare E0
   but is less than intended.

## Consequences

**Positive.** An agent meeting a lock can tell a measured constraint from a
snapshot without re-deriving the argument. A weak lock announces its own
weakness at the moment it is cited. Calibration numbers stop needing
architecture supersessions. Permanence language stops entering the corpus.

**Negative, and accepted.** The estate carries a fourth and fifth metadata axis
on top of two existing ones — real cost, justified only if Phase 6's
interruption metric moves. A backfill across 184 records is a large mechanical
diff. And the grades are heuristic proposals until adjudicated, so for a period
the tree carries metadata of uneven quality; `discovery: incomplete` is how
that period is made visible rather than hidden.

**Unresolved, deliberately.** Whether an independently validated grade may ever
reduce the *authorization* burden is not decided here. It is owner-reserved,
tracked as the `authority-coupling-decision` blocker in
`road-to-evidence-based-adr-governance`, and gated on measured grade accuracy
against an adjudicated sample, an absence of beneficiary-linked grade bias, a
measured interruption reduction without a defect increase, and a passed
suspension drill. A published null is an acceptable outcome for that question.

## Alternatives

**A single `level: high | medium | low`.** Rejected: it fuses how well
established a decision is with how hard it should be to change, which are
independent — an owner purpose statement can be authoritative and entirely
unmeasured, and a strong benchmark can support a decision that is cheap to
revisit. GRADE separates the two axes for the same reason.

**A static `change_resistance: R0–R3` per document.** Rejected on this tree's
own prior decision: `adr-layout § Reopen authority` records, council-convergent
2026-08-19, that "the routing unit is the transition, never the document … a
static per-document label cannot express that." The autonomy that axis was
reaching for survives as evidence-priced burden instead.

**A `council` provenance kind.** Rejected: it would imply that seats are a
distinct authority source, which is the belief the 44-REJECT record refutes.
`agentic` plus `agentic_mode: council` records the same fact without the
implication.

**Grade authority coupled now, with a kill switch.** Rejected as premature
rather than wrong. The coupling may well be correct; nothing yet measures
whether the grades are accurate enough to carry it, and a kill switch that has
never been drilled is a word. Phase 6 exists to turn that into a decision.

**Do nothing.** Rejected against the three measurements above — but worth
naming, because "the estate is fine and this is ceremony" is the honest
counter-position, and Phase 6's interruption metric is what would vindicate it.

## References

- `docs/contracts/adr-layout.md` § Provenance and evidence, § The reopen record
- `agents/roadmaps/road-to-evidence-based-adr-governance.md`
- `docs/decisions/adr-reopen-sweep-2026-08.md`
- `docs/decisions/engine-reclassification-2026-07.md`
- ADR-237 — capability-before-role; the doctrine the blocker lane applies
- ADR-216 — the one record carrying `reopen_policy` before this change
