---
adr: 216
status: accepted
date: 2026-08-05
decision: restraint-reanchored-to-capacity
supersedes: —
superseded_by: —
phase: ADR-211 Amendment E + correction of ADR-215 + adoption-anchor sweep
type: structural
protected_dimensions: [purpose]
reopen_policy: owner
review_trigger: >-
  Reopen when the capacity premise changes: a second regular maintainer joins
  (the concurrency cap's basis disappears), or the cap demonstrably blocks work
  the maintainer wants open — two roadmaps stalled while a third is being
  actively asked for. Do NOT reopen on an external-adoption signal: this record
  exists precisely because adoption is not a project goal and therefore not a
  valid gate. If external adoption is ever adopted AS a goal, that is a fresh
  product decision and needs its own record, not a revival of these gates.
---

# ADR-216 — Every restraint gate is re-anchored to capacity; external adoption is struck as a condition

## Status

**Accepted.** Owner decision. The external-adoption arm is struck from every
governing gate in the tree, the surviving restraint is re-anchored to
maintainer capacity, and everything that was blocked on an adoption signal is
unblocked in the same change.

## Context

### The owner's decision

This suite is developed for internal use. **External adoption is explicitly not
a project goal.** It is a pleasant side effect if it happens and it is not
something the project will spend effort pursuing or waiting for.

**This ruling is not new, and that is the sharpest fact in this record.** It was
already recorded in `agents/settings/contexts/feedback-9x-council-cut.md`, whose
refusal list names *"anything justified by external adoption — launch, taster
plugins, registry submissions, recruiting external testers, adoption deadlines"*
and states plainly that the operator ruled this out of scope, dropping two review
documents' entire opening phase as a result. So the adoption anchoring in ADR-211
did not merely rest on a false premise — **it contradicted an owner decision that
was already on the record.** Every downstream blocker built on it was enforcing a
condition the project had already rejected as a goal.

This is a purpose decision, not a mechanism decision. No council can overrule
the owner on what the project is *for*, so this record does not carry a council
disposition — deliberately. The AI council was consulted earlier the same day on
the mechanism question ("does the freeze still serve its purpose in its current
form?") and its answer was recorded in
[ADR-215](ADR-215-harvest-freeze-verification-arm-lift.md). This record answers
the prior question the council was never asked: **is the freeze anchored to the
right thing at all?**

### The construction defect, stated precisely

[ADR-211](ADR-211-harvest-freeze-resume-conditions.md) already diagnosed half of
it: "first external adopter" is a practically unreachable exit for an internal
project, which is why Amendment A added an internal arm. But the repair was
partial. Amendment A fixed the *resume condition* and left the *anchoring*
untouched:

- The external arm remained in the record as a co-equal, in fact **first-listed**,
  exit option.
- The original rationale — "harvest freeze until the first external adopter … the
  binding constraint is adoption, not capability" — survived verbatim in
  `surface-consolidation-restraint.md`, so every later reader inherits the
  premise that the freeze exists to *wait for adoption*.

That premise was never the real reason. The real reason was, and remains, a
**capacity** argument: one maintainer, an open renewal set, an open hook-latency
repair, and the observed tendency of harvest roadmaps to accumulate additive
features while foundational work waits. That argument stands complete with no
reference to adoption whatsoever. The four roadmaps parked on 2026-08-03 were
parked because they competed with the renewal set for the maintainer's time —
not because nobody outside was watching.

An unreachable condition presented as a live exit is worse than an honest ban:
it reads as "not yet" while behaving as "never", and it accretes downstream
blockers that nobody re-examines because the gate looks legitimate.

### What was actually blocked — measured, not estimated

A tree-wide sweep for adoption-anchored gates found two independent chains:

**Chain 1 — the harvest freeze (ADR-211).** Four roadmaps parked in `later/`,
each with a resume line reading "external adopter OR the internal arm". The
internal arm has been satisfied since 2026-08-05, so these were already
technically unblocked — the zombie wording simply made them look adoption-gated.

**Chain 2 — the "polish gate", and it is the more expensive one.** A council
sequencing decision from 2026-07-08 states that while
`road-to-adoption-without-narrative-debt` has open phases, no new
settings-interface, theming, or configuration-management polish ships, and that
the gate exits when **three external adoptions are documented** or that roadmap
is archived. That gate blocks:

| Blocked roadmap | Open steps |
|---|---|
| `road-to-zero-ceremony-settings` | 19 |
| `road-to-zero-ceremony-host-primitives` | 14 (plus a second, non-adoption condition) |

Thirty-three open steps of internal configuration and host-primitive work,
blocked behind a roadmap whose own seven remaining open steps are **entirely
external-adoption work**: link the published documentation site, add a donation
path, run a human-gated study with a real external person, submit to
third-party directories, publish a launch story, and measure installer
conversion. Under the owner's decision, none of that work is wanted — so the
gate was holding internal work hostage to work that will never be done.

**Two further live gates were found on a second pass**, both missed by a first
sweep that filtered too aggressively on annotation keywords:

- `road-to-zero-ceremony-host-primitives` carried a *second* copy of the polish
  gate inside its `## Blockers` section, blocking Phases 2 and 3, with the
  three-adoptions condition spelled out again. Resolved here.
- `road-to-external-proof-upgrade` gated **its entire contents** on a human owner
  scheduling the first recruit session — including an encryption default-flip that
  has nothing to do with adoption. Recruiting external testers is on the refusal
  list quoted above, so that gate was holding internal work behind work the
  project had already ruled out. Split here: the internal half is unblocked, the
  recruiting half is marked out of scope rather than pending.

The lesson for the sweep method: filtering a grep on words like "struck" or
"superseded" hides live gates that happen to sit near an annotation. The second
pass read every hit.

**The change set reproduced the defect it exists to fix — twice — and both
instances are worth recording because they are the cheapest available evidence
that the failure class is real rather than historical.**

*First:* ADR-215 was authored earlier the same day with an external-adoption
condition on its capability arm. It was written specifically to narrow an
unreachable gate, and it carried that gate forward into its own text one file
over. The commit history shows it plainly — the first three commits still title
the work "freeze narrowed to verification arm", and the correction arrives only in
the later commits. A record can inherit a premise from the record it amends
without ever examining it.

*Second:* ADR-215 § D2 declared the concurrency cap "mechanically enforced, not
left to discipline" — the load-bearing sentence, since the cap became the only
surviving restraint once the adoption gates were struck — and then deferred the
implementation to a roadmap step that **did not exist**. So for the duration of
this change set the sole remaining restraint ran on maintainer discipline while
its own record asserted otherwise. Fixed by writing the gate rather than by
softening the sentence: a written contract that describes an absent mechanism is
the exact thing this package's own doctrine says loses to an enforced gate.

Both are instances of the same shape the sweep found six sources converging on:
**an assertion of coverage that nothing verifies.** Finding them inside the change
that removes the class is not embarrassing, it is the method working — and it is
why the enforcement obligation is discharged here rather than promised.

**Two further adoption citations** were found in
[ADR-123](ADR-123-runtime-security-scope-and-spawn-hardening.md) (three security
items deferred, with the restraint's adoption clause cited as part of the
justification) and [ADR-137](ADR-137-amend-tier-removal-reopen-triggers.md) (an
adopter count used as supporting reasoning). And the one **active** roadmap
`road-to-surface-consolidation` carries a blocker whose stated content is "the
standing adoption gate".

### The one thing that does survive

The concurrency cap from ADR-215 is a *capacity* mechanism, not an adoption
mechanism. Its argument — one maintainer cannot hold nine parallel workstreams,
and a cap left to intention drifts under urgency so it ships as a gate — is
entirely independent of who is watching from outside. It survives this
re-anchoring unchanged and is now the **only** thing restraining the harvest
queue.

## Decision

### D1 — ADR-211 Amendment E: the external arm is struck

**Before:** the freeze lifts when EITHER ≥1 real external adoption is documented,
OR all three internal conditions hold.

**After:** the freeze lifts when all three conditions hold — the renewal roadmap
set fully closed, the hook-latency repair complete, and an AI-council
reconfirmation with a documented outcome. There is no second arm.

**Consequence, immediate:** all three conditions are already satisfied (verified
by inspection on 2026-08-05; the council ran the same day). **The freeze is
therefore lifted in full, not partially.**

Amendment A's OR-structure is retired as unnecessary — with adoption gone there
is only one arm, so there is nothing to OR. Amendments **B, C and D are
untouched**: the review cadence, the evidence-direction requirement
(finding precedes borrow), and the red-test-first latent-risk door are all
adoption-independent and are exactly the kind of mechanism this suite enforces
everywhere else.

### D2 — The rationale is re-anchored

ADR-211's rationale and `surface-consolidation-restraint.md`'s freeze bullet are
rewritten from *adoption-waiting* to *capacity-restraint*. The restraint's second
bullet ("no new council/review modes pending the first external adopter") is
re-anchored the same way: it waits on the **pending benchmarks**, which is its
real and reachable condition, and the adoption clause is struck.

### D3 — ADR-215's capability arm is corrected

ADR-215 split the lift into a verification arm and a capability arm, and gated
the capability arm on "≥1 real external adoption documented OR an external
finding reproduced by local measurement". The first half is the same zombie and
is **struck**. With it gone, the capability arm's remaining condition is
reachable but no longer load-bearing, because the freeze itself is now lifted in
full under D1.

**Therefore the verification-versus-capability split dissolves.** It existed only
to keep capability behind the adoption gate. What remains is one queue governed
by one capacity mechanism:

- The **two-slot concurrency cap** on concurrently-open `road-to-skill-ecosystem-*`
  roadmaps stays, mechanically enforced, exactly as ADR-215 D2 specifies.
- The cap applies to **any** roadmap in that family regardless of whether its
  content is verification or capability. A capability roadmap now competes for a
  slot on equal terms rather than being categorically excluded.
- Ordering within the queue is a maintainer choice per slot, informed by the
  sweep record's evidence, not fixed by a category.

**Scope limitation, stated honestly:** the cap covers the `road-to-skill-ecosystem-*`
family because that is what the council scoped. The real constraint is total
maintainer capacity across all open roadmaps, and there are considerably more
than two of those. Widening the cap would be a new governance decision and is
not made here.

### D4 — The polish gate is retired by disposing of its own roadmap

`road-to-adoption-without-narrative-debt` is moved to `agents/roadmaps/skipped/`
— a decision against pursuit, which is the correct disposition for work the
owner has ruled out of scope. Its remaining seven open steps are all
external-adoption work.

The polish gate's own wording provides the exit: it lifts when three external
adoptions are documented **or this roadmap is archived**. Disposing of the
roadmap satisfies the second clause on the gate's own terms, so no override is
needed. `road-to-zero-ceremony-settings` and
`road-to-zero-ceremony-host-primitives` are unblocked as a direct consequence.

What the disposed roadmap contains that is *not* adoption work — the
no-unbacked-number discipline and its claims-pointer enforcement — is already
shipped and independently gated in continuous integration. Nothing of value is
lost by the disposal; the falsifiability discipline it defended is enforced by a
gate, not by that file.

### D5 — Adoption is struck as a gate everywhere, and may not return as one

No gate, blocker, resume condition, or reopen trigger in this tree may be
anchored on an external-adoption signal. A restraint must name a condition the
maintainer can reach. Existing citations are corrected in this change; a new one
is a defect.

This does not forbid *recording* adoption facts. Observing that the project has
no external adopters is a true statement and may appear as context. What it may
not do is gate work.

## Consequences

**Unblocked in this change:**

- The harvest freeze is lifted in full. The four roadmaps parked under it keep
  their `later/` disposition **only** because of the capacity cap, and their
  resume lines are rewritten to say so instead of naming an adopter.
- `road-to-zero-ceremony-settings` (19 open steps) and
  `road-to-zero-ceremony-host-primitives` (14 open steps) lose their
  adoption-anchored blocker. The second, non-adoption condition on
  host-primitives is preserved.
- The skill-ecosystem capability queue is no longer categorically frozen; it
  competes for a capacity slot.
- ADR-123's three deferred security items lose the adoption clause from their
  revisit condition and retain their real triggers: a genuine outbound-injection
  incident, a demand signal, or utilization evidence.
- `road-to-surface-consolidation`'s adoption-gated blocker is resolved as
  out-of-scope rather than left open forever.

**Still blocked, legitimately:** `road-to-contract-integrity` waits on the
pruning track, which is real work with a reachable end. That blocker is
untouched.

**Newly enforced rather than merely written:** the concurrency cap now has a gate
(`src/scripts/lint_roadmap_family_cap.ts`, `task lint-roadmap-family-cap`) with
paired fixtures proving it fails when the cap is exceeded and when its scan root
is dead. Before this change the cap was the only surviving restraint and ran on
discipline alone while its record claimed enforcement.

**Not changed:** every safety floor, the Hard Floor, the evidence-direction
requirement, the red-test door, the review cadence, the claims-pointer
discipline, and the concurrency cap itself. This record removes an unreachable
condition; it does not relax a standard.

**Honest cost:** the project gives up the option of using adoption as a
sequencing signal. Since the owner has ruled adoption out as a goal, that option
was worth nothing and was costing thirty-three blocked steps plus a
permanently-parked harvest queue.

## Alternatives considered

- **Delete ADR-211 outright.** Rejected. The capacity argument is real and worth
  keeping; deleting the record would lose the amendments that carry it (evidence
  direction, red-test door, review cadence) and would discard a restraint that
  demonstrably worked at item granularity on its last application.
- **Leave the external arm as a harmless second option.** Rejected. It is not
  harmless: it is first-listed, it anchors the rationale, and it propagated into
  two ADRs, a restraint context, four parked roadmaps, one active roadmap
  blocker, and a second gate blocking thirty-three steps. An unreachable
  condition presented as live is a load-bearing falsehood.
- **Keep the verification-versus-capability split as a capacity heuristic.**
  Rejected. Its only justification was the adoption gate; as a capacity device it
  is worse than the slot cap, because it categorically excludes work rather than
  sequencing it, and the category boundary is arguable exactly where arguing is
  tempting.
- **Run another council before acting.** Rejected. The council was consulted on
  the mechanism question the same day. This record decides *purpose*, which is
  the owner's call, and a council cannot adjudicate what the project is for.
  Recording it as an owner decision is the honest classification.
- **Archive rather than skip `road-to-adoption-without-narrative-debt`.**
  Rejected. Archive means work happened and no more is planned; skipped means a
  decision against pursuit. The latter is accurate and the distinction matters
  for anyone reading the disposition later.

## References

- [ADR-211](ADR-211-harvest-freeze-resume-conditions.md) — amended here
  (Amendment E); Amendments B, C, D untouched.
- [ADR-215](ADR-215-harvest-freeze-verification-arm-lift.md) — corrected here;
  its concurrency cap survives, its capability-arm adoption condition is struck,
  its verification-versus-capability split dissolves.
- [ADR-123](ADR-123-runtime-security-scope-and-spawn-hardening.md) — deferral
  re-anchored.
- [`surface-consolidation-restraint`](../../agents/settings/contexts/surface-consolidation-restraint.md)
  — both adoption-anchored bullets rewritten.
- [`skill-ecosystem-sweep-2026-08`](../../agents/settings/contexts/skill-ecosystem-sweep-2026-08.md)
  — the evidence the queue is ordered against.
- [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) — the rule
  that makes surfacing a blocking lock mandatory rather than optional. This
  record is that rule firing at the largest scale it has fired so far.

## History

- 2026-08-05 — record created. Owner decision: external adoption is not a project
  goal and is struck as a gate everywhere. ADR-211 Amendment E (external arm
  struck, rationale re-anchored to capacity, freeze consequently lifted in full).
  ADR-215 corrected (capability-arm adoption condition struck,
  verification-versus-capability split dissolved, concurrency cap retained).
  `road-to-adoption-without-narrative-debt` disposed to `skipped/`, retiring the
  polish gate on its own terms and unblocking 33 open steps across two roadmaps.
