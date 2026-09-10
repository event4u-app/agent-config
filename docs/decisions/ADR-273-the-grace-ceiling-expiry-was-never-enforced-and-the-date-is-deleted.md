---
adr: 273
status: accepted
date: 2026-09-10
decision: grace-end-date-deleted-because-nothing-enforced-it-ceiling-kept-undated
supersedes: —
superseded_by: —
type: structural
reopen_policy: directional
protected_dimensions: governance
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E3
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
  and separately reviewed.
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
`toISOString`, `expire`, `expiry`. On 2026-11-10 the workflow would have read
`grace_ceiling` 138,490 exactly as before, passed it as `--ceiling`, and every
pull request would have continued to pass. The full reproduction is in
`agents/evidence/analysis/grace-ceiling-expiry-is-unenforced-2026-09-10.md`.

The measurement half was never in doubt and is unaffected: measured total
138,413, `baseline_tokens` 102,520, `design_ceiling` 107,646, `grace_ceiling`
138,490 with a shrink-only ratchet enforced against the base ref by
`assertBoundsDidNotRise`. What did not exist was the **time** limb.

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
  `status_2026_08_24.committed_reduction_mechanism` remains the string `"NONE"`,
  and `target_schedule.milestones` still carries 102,520 by 2026-11-10 with an
  `on_miss` clause requiring the miss to be published with its measured number.
  Those milestones are untouched by this record: they are owner-set, they were
  never the enforcement surface, and the first of them will be missed and
  published on schedule.
- **ADR-264's third review trigger cannot fire**, because it is written against a
  date-driven event no code produces. ADR-264 is deliberately **not edited
  here**: its `reopen_policy` is `owner`, its cap survives this change untouched,
  and nothing in this decision needs it reopened. The unfirable clause is named
  here so the next reader of that record does not wait for it.
- Step 4.4 of `road-to-delivery-for-every-host` and its acceptance criterion
  **stay open**. Both seats were explicit: the grace ceiling remains, so *"grace
  ceiling gone"* is false, and neither the deletion of a date nor a stub carrier
  may be read as closing them.

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
