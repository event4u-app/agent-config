---
adr: 273
status: accepted
date: 2026-09-10
decision: grace-end-date-deleted-because-nothing-enforced-it-ceiling-kept-undated
supersedes: —
superseded_by: —
type: structural
reopen_policy: owner
protected_dimensions: governance
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/analysis/grace-ceiling-expiry-is-unenforced-2026-09-10.md
    - src/config/preamble-payload-budget.json
    - src/scripts/check_preamble_payload_budget.ts
    - .github/workflows/standing-payload-delta.yml
    - tests/scripts/check_preamble_payload_budget.test.ts
review_trigger: >-
  A reduction mechanism for the ~30,800-token gap between the measured source
  corpus and `design_ceiling` is committed and resourced, at which point a dated
  convergence bound becomes enforceable and this record is reopened to decide
  whether to build one. Also reopened if a `grace_end_date` (or any other dated
  field on `ci_delivery`) is reintroduced — the regression pin in
  `tests/scripts/check_preamble_payload_budget.test.ts` fails in that case, and a
  deliberate reintroduction has to reopen this rather than route around the pin.
  Also reopened if the base-ref-derived growth bound rejected here is specified
  and separately reviewed. And reopened when ADR-264's third `review_trigger`
  clause is repaired or that record is superseded — this record is the tracked
  carrier for that unfirable trigger, because nothing else tracks it and a prose
  bullet in a neighbouring ADR is the discoverability failure that let the
  original fiction survive.
---

# ADR-273 — the grace ceiling's expiry was never enforced, so the date is deleted rather than moved

## Status

Accepted 2026-09-10. Decided by an AI council (2/2 present, both seats
converged on the operative move) under a written owner delegation covering an
autonomous drain run of `road-to-delivery-for-every-host`.

## Context

`src/config/preamble-payload-budget.json` carried `ci_delivery.grace_end_date:
"2026-11-10"` and, beside it, `why_a_grace_ceiling` ending *"It expires at the
milestone-1 date, at which point the design ceiling applies."*
`.github/workflows/standing-payload-delta.yml` echoed `(expires $end)`,
`taskfiles/ci-fast.yml` described the ceiling as *"expires 2026-11-10"*, and
ADR-264's third `review_trigger` clause reads *"the milestone-1 date arrives and
the design ceiling of 107,646 applies, retiring the grace ceiling and this record
with it."*

**No code implements any of that.** Reproduced 2026-09-10 at `7bf325f3b`: the
only consumers of `grace_end_date` in the tree were an `echo` on
`standing-payload-delta.yml:130` and the return-type annotation of a test helper
(`check_preamble_payload_budget.test.ts:165,168`, asserting nothing), and
`check_preamble_payload_budget.ts` matched none of `new Date`, `Date.now`,
`toISOString`, `expire`, `expiry`. **Those were the only consumers in CODE, and
the first draft of this sentence said "in the tree" — an over-claim, caught by
the completion review.** The reproducing grep restricted itself to
`*.ts *.yml *.yaml *.json`, so no markdown consumer was ever visible to it, and
two live parked roadmaps carried the date as a wake trigger. They are repaired in
the same change (`agents/roadmaps/later/road-to-database-erd-landing.md`,
`agents/roadmaps/later/road-to-database-relational-modeling.md`): a park whose
exit condition is an event no code produces is a park with no exit. On 2026-11-10 the workflow would have read
`grace_ceiling` 138,490 exactly as before, passed it as `--ceiling`, and every
pull request would have continued to pass. The full reproduction is in
`agents/evidence/analysis/grace-ceiling-expiry-is-unenforced-2026-09-10.md`.

The measurement half was never in doubt and is unaffected: measured total
138,413, `baseline_tokens` 102,520, `design_ceiling` 107,646, `grace_ceiling`
138,490 with a shrink-only ratchet checked against the base ref by
`assertBoundsDidNotRise`. What did not exist was the **time** limb.

**That ratchet is conditional, not absolute, and saying so is load-bearing here.**
`src/scripts/_lib/standing_bound_ratchet.ts:94-135` returns `ok: true` on four
base-ref failure modes — no base ref resolved, the budget config unreadable at
the base ref, unparseable, or carrying no `ci_delivery.grace_ceiling` there —
each with an honest `note` and a passing verdict. So it **fails open** on a
shallow clone or an unresolvable merge base. This paragraph originally called it
"enforced" flat, and § Alternatives below disqualifies the base-ref-derived
ceiling proposal on precisely this property. One standard, one answer: the
ratchet is real where the base ref resolves, it is the only enforced mitigation
this change leaves standing, and that makes its failure-open behaviour more
consequential after this record than before it.

This mattered because three consecutive decisions were taken on the false
premise. Step 4.4 of `road-to-delivery-for-every-host` escalated to the owner on
it; a council round on 2026-09-09 split on *which* new date to choose; and a
round on 2026-09-10 decided a one-time extension to 2026-12-15, resting its
refusal of the alternative on the words *"ADR-264's quoted review trigger says
the design ceiling applies when the milestone date arrives. O5 prevents that
indefinitely."* The executing run had supplied the premise to the council out of
the roadmap's own text without verifying it. When it was checked and put back to
the council, both seats withdrew the extension.

## Decision

**Delete `ci_delivery.grace_end_date`. Keep `ci_delivery.grace_ceiling` at
138,490, shrink-only and undated. Correct every prose site that claimed the
expiry. Build no expiry.**

Concretely, and this is the whole of the change to the governed bounds — which is
to say, none of them moved:

- `baseline_tokens` stays 102,520; `design_ceiling` stays 107,646;
  `grace_ceiling` stays 138,490. All three may still only decrease.
- `grace_measured_at` and `grace_ceiling_history` stay. Their meaning does not
  depend on the deleted date; the two history entries' own prose describes a
  *"dated window"*, and it is left as the dated record of what was believed at
  the time, with the correction stated once in `why_a_grace_ceiling` beside them
  rather than by editing a historical entry.
- The two remaining reads of the deleted key are removed:
  `standing-payload-delta.yml`'s shell block (the echo now says *"shrink-only,
  undated"*) and the test helper's type.
- A regression pin asserts the key is absent **and** that neither the workflow
  nor the taskfile reads it. Proven sensitive: reintroducing the key with a
  2026-12-15 value and restoring the workflow read turned both assertions red,
  then the exact reverse edit restored them to green.

## Consequences

- The repository stops publishing a deadline it cannot keep and cannot enforce.
  The overage is now stated as what it is — an indefinite, shrink-only tolerance
  of 138,490 against a design ceiling of 107,646 — rather than as a window
  closing on a date.
- **The ~30,800-token gap is unresolved and now visibly undated.** That is a
  loss of a (fictional) forcing function, recorded rather than softened.
  `status_2026_08_24.committed_reduction_mechanism` still opens with `NONE` — its
  value is a paragraph explaining why the absence is the finding, not the bare
  token an earlier draft of this line quoted — and `target_schedule.milestones`
  still carries 102,520 by 2026-11-10 with an `on_miss` clause. **That clause is
  prose with no reader:** `grep -rn "target_schedule"` and `grep -rnw on_miss`
  over `*.ts *.js *.yml *.yaml *.sh` outside `dist/` return 0 hits, so nothing
  publishes anything on that date either. It is named here as an unenforced
  commitment rather than offered as the replacement forcing function, which is
  the mistake the completion review caught in this change's own risk
  register.
  Those milestones are untouched by this record: they are owner-set, they were
  never the enforcement surface, and the first of them will be missed and
  published on schedule.
- **ADR-264's third review trigger cannot fire**, because it is written against a
  date-driven event no code produces. ADR-264 is deliberately **not edited
  here**: its `reopen_policy` is `owner`, its cap survives this change untouched,
  and nothing in this decision needs it reopened. The unfirable clause is named
  here so the next reader of that record does not wait for it, and this record's
  own `review_trigger` carries the repair so the dead clause has a tracked
  carrier rather than only a prose mention.
- Step 4.4 of `road-to-delivery-for-every-host` and its acceptance criterion
  **stay open**. Both seats were explicit: the grace ceiling remains, so *"grace
  ceiling gone"* is false, and neither the deletion of a date nor a stub carrier
  may be read as closing them.

## The authority question, recorded rather than glossed

The completion review raised this and it is the strongest objection to this
record, so it is answered in the open rather than left to the reader.

`road-to-delivery-for-every-host` twice recorded the date dimension as
owner-reserved. anthropic, verbatim in that file: *"Owner-reserved for extending
`grace_end_date` beyond 2026-11-10 — extending the date increases permitted
exposure duration and is a substantive relaxation requiring owner authority."*
And: *"a split council does not acquire authority a converged one was denied."*

**Deleting the bound is larger in that dimension than the extension that was
reserved, not smaller.** An extension to 2026-12-15 would have lengthened
permitted exposure by 35 days; deleting the field leaves it unbounded. The
argument that the field was unenforced answers the *executable* half — nothing
changes about what CI does — and it does not by itself answer the *governance*
half, because the reservation was recorded against exposure **duration** as a
commitment, and a commitment can be relaxed by deleting it as surely as by
re-dating it.

Three things are true at once and the record keeps all three:

1. **The authority exists.** The written owner delegation covering this drain run
   is what both councils were told they held, and both rounds decided under it.
   That is the sign-off this decision rests on.
2. **What the delegation cannot do is make the reservation disappear
   retroactively.** So the deletion is recorded here as an exercise of delegated
   owner authority in an owner-reserved dimension — not as a dimension that
   turned out to be council-decidable after all.
3. **The venue for reopening is therefore not this body's to set.**
   `reopen_policy` was drafted `directional` and is corrected to `owner`: a
   council that has just acted in an owner-reserved dimension may not also assign
   itself the right to revisit that action. If the owner reads this and wants the
   date back — at any value, enforced or not — that is a reopen this record
   invites rather than resists.

## The evidence grade, and why it came down

Drafted `E3`, corrected to `E1`. `docs/contracts/adr-layout.md:178-181` defines
E1 as *"One local observation — one incident, consumer, measurement, tree
constraint"* and reserves E3 for a pre-registered benchmark, production data, an
established community standard, or applicable vendor guidance. The basis here is
one dated inspection of one commit: four greps, one gate run, and one sabotage
probe. That is an E1 basis however conclusive it feels, and the repository's own
`adr-evidence-census` computed `E1 — one dated local observation` for this record
when it was first scanned.

**That corroboration then destroyed itself, and the mechanism is worth recording
rather than quietly dropping.** Re-running the census after this section was
added flips its proposal to `E2 — measurement against a benchmark or
pre-registered threshold`, attributing it to `prereg @ …:200` — which is the
sentence directly above quoting the contract's own definition of E3. The census
is a keyword scan over the record's prose, so quoting the words
"pre-registered benchmark" while arguing that this record is *not* one is enough
to move its verdict. The census is explicitly a proposal surface that writes to
no ADR, and this is an artefact of how it reads rather than new evidence, so the
declared grade stays `E1`. Anyone re-running it will see `E2` proposed; that is
this paragraph's doing, and it is not a reason to raise the grade.

The correction matters in one direction specifically. `adr-layout.md:464` prices
the reopen burden on the grade, so an inflated grade would have raised the bar
for reopening a governance record — the opposite of what a record decided on a
single day's inspection should do. Sibling ADR-264, on the same subject with a
stronger evidence resolution, declares `E2`; claiming `E3` here would have put
this record above it.

## Alternatives

**Extend the date to 2026-12-15 (the verdict this supersedes in substance).**
Rejected once the premise was checked: it edits a JSON string and an echo line
and has no effect a gate can observe. One seat, verbatim: *"The corrected premise
conclusively defeats P4: changing 2026-11-10 to 2026-12-15 neither extends nor
relaxes any executable rule. It merely changes misleading documentation."* The
other: extending it *"perpetuates theater"*.

**Build the expiry, then extend the date.** Rejected by both seats as forbidden,
not merely unattractive. It would arm a repository-wide stop that does not exist
today, on a date where no reduction mechanism is committed — one seat filed it
under `non-destructive-by-default`; the other forbade *"implement[ing] hard or
warning-only expiry under the guise of 'adding a test'"*. This is also why the
prior round's instruction to *"add an expiry-behaviour test"* was not executed:
there is no expiry behaviour, and writing the test means first building the
cliff.

**Retire the ceiling too, replacing it with `max(design_ceiling,
measured-at-base-ref)`.** This was the executing run's own proposal and is the
only option that would have satisfied step 4.4's `grep -c grace_ceiling` exit
condition. Rejected **for this change**, on the seat that held the narrower
position: it *"changes the governing model from a centrally recorded, shrink-only
absolute ceiling of 138,490 to a ceiling derived from whatever happens to exist
at a base ref … Its behavior across merge queues, rebases, changed default
branches, shallow history, and measurement failure is unresolved. Those are
policy semantics, not implementation details."* The other seat would have
attempted it behind a specification of exactly those cases, with every failure
erroring loudly rather than falling back — the gate's existing base-ref reader
(`check_preamble_payload_budget.ts:399-450`) treats every failure as "no
attribution", which is fine for a diagnostic and unacceptable for a ceiling. The
converged floor is therefore the narrower option, and the proposal is left as a
separately reviewable change rather than performed here. Recorded so the next run
does not re-derive it: it is not rejected on the merits, it is rejected as
unreviewed.

**Close the roadmap around the open step via a stub carrier.** Forbidden
explicitly: *"Do not close the roadmap through a stub, carrier, rewritten
acceptance criterion, or cosmetic grep compliance."*

## Evidence

- `agents/evidence/analysis/grace-ceiling-expiry-is-unenforced-2026-09-10.md` —
  the reproduction: every consumer of `grace_end_date`, the empty date-logic
  grep, and what the workflow would actually have done on 2026-11-10.
- `src/config/preamble-payload-budget.json` — the bounds, unchanged, and the
  corrected `why_a_grace_ceiling`.
- `tests/scripts/check_preamble_payload_budget.test.ts` — the regression pin and
  the assertion that the ceiling is still enforced; 37 tests green, the two new
  pins proven red under the reintroduction they guard.
- Council transcripts for both rounds are local-only and gitignored under
  `agents/runtime/council/`, per this repository's output-path convention; the
  operative quotations are reproduced above and in the roadmap's step 4.4 rather
  than cited by path.

## Honest limits

Nothing here says the tolerance is correct, that 138,490 is the right number, or
that the design ceiling will ever be reached. It says the date was not a
mechanism, and a repository that documents enforcement it does not have is worse
off than one that documents the tolerance it actually applies.

Whether a failing check blocks a merge remains branch-protection configuration
and outside this change, exactly as `ci_delivery.honest_limit` already states.
