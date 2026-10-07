---
adr: 282
status: accepted
date: 2026-10-07
decision: auto-merge-authority-with-a-council-danger-gate
supersedes: ADR-239 (§ Disposition · the process-full merge row only)
superseded_by: —
type: structural
reopen_policy: owner
protected_dimensions: security_floor
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E0
  authority_basis: owner_intent
  discovery: incomplete
  basis:
    - agents/evidence/owner-directives/2026-10-07-round-7a2e1c.md
    - docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md
    - docs/decisions/ADR-266-explicit-pr-merge-invocation-is-the-this-turn-confirmation.md
    - src/rules/non-destructive-by-default.md
    - src/rules/security-sensitive-stop.md
    - src/scripts/check_kernel_edit_ratified.ts
review_trigger: >-
  A PR merged as `routine` under this record turns out to have touched a surface
  one of the cited rules names — that is a classifier miss and a reportable
  defect, not a tuning question; or a merge happens without an explicit owner
  auto-merge instruction in the run that performed it; or the council path
  merges on anything but two convergent seats.
---

# ADR-282 — Auto-merge on the owner's word, with a council danger gate

## Status

Accepted 2026-10-07. **Owner ruling**, recorded verbatim in
[`owner-directives/2026-10-07-round-7a2e1c`](../../agents/evidence/owner-directives/2026-10-07-round-7a2e1c.md).
It settles the half of ADR-239 § Disposition that ADR-266 left `owner` / `open`:
whether `/roadmap:process-full` may merge.

## Context

`/roadmap:process-full` said *"THIS COMMAND NEVER MERGES. THERE IS NO FLAG THAT
MAKES IT MERGE."* ADR-266 activated merging for an explicit `/pr:merge`
invocation only, and ADR-268 § 12 accepted a roadmap-written grant — yet the
command text still refused, so an owner who said "merge automatically" was
answered by the agent's own contract, and the host's auto-mode classifier
refused the merge as acting against it. The written contract and the owner's
decision disagreed; this record makes them agree.

## Decision

1. **An explicit owner auto-merge instruction removes the review requirement.**
   The instruction is either the owner's own words in the session that runs the
   work ("merge automatically", "merge it at the end") or a `--merge` flag on
   `/roadmap:process-full` / `/pr:merge`. It is the this-turn confirmation
   `non-destructive-by-default` requires for the production-branch merge of a
   **routine** PR, for the run it starts, exactly as ADR-266 argues for an
   invocation.
2. **Danger gate.** Before any such merge, once CI is green on the head and the
   PR is mergeable, `classify_merge_risk` classifies the diff:
   - `routine` → squash-merge with `--match-head-commit <head>`. No review.
   - `needs-council` → the AI council reviews the diff with a neutral prompt and
     answers (a) is it destructive or dangerous under our rules — read as the
     six dangerous-action predicates of
     `agents/evidence/council/authority-routing-20261007.md` § 4, where a council
     may resolve doubt but cannot waive danger — and (b) is a user review
     unnecessary. **Both seats: not dangerous, user review
     unnecessary → merge.** Dangerous, split, degraded quorum, or council
     unavailable → stop and hand to the owner with the reasons. Verdict and
     prompt are recorded as evidence.
3. **No instruction, no change.** Without an explicit auto-merge instruction a
   run ends at an open, CI-green PR, as before. ADR-268 § 3's object-bound
   `prod_merge` grant is a separate path this record does not touch.

The classifier's triggers are lifted from existing rules — the Hard-Floor rows
of `non-destructive-by-default`, the surfaces of `security-sensitive-stop`, the
ratification surfaces through `check_kernel_edit_ratified`'s own
`classifyPaths`, any CI workflow, and its own merge-authority surface — and it
fails closed: an unreadable diff is `needs-council`.

## Part B — owner-directed self-modification and host refusals

1. **Owner-directive record.** When the owner directly orders a change to the
   agent's own rules, hooks or commands, the agent writes
   `agents/evidence/owner-directives/<date>-<opaque-id>.md` (who, verbatim
   instruction, scope, date) and cites it in the PR body and ADR. It grants
   nothing; it makes the order reviewable.
2. **Ask once in-session, then hand off.** When a host classifier refusal
   blocks an owner-directed task, the agent never routes around it — no other
   tool, no smaller pieces, no different encoding. It finishes what does not
   depend on the step, then asks the owner **in the session** for an explicit
   authorization of that exact step (the step, why it is needed, the refusal
   reason). On an explicit yes it re-runs the **same** step **once**: the
   classifier decides again, now with the owner's authorization in the
   transcript it reads — the evidence the refusal asked for, not a workaround.
   Measured 2026-10-07: `task push-ready` refused, then passed after the owner's
   explicit in-session go. Refused again, or no owner present (a headless run)
   → it writes a ready-to-paste continuation prompt with `refusal_envelope` to
   `agents/tmp/round-<hex>/prompt.md` and names the path in one line. A chat yes
   never clears a refusal by itself; only the classifier's own re-decision does.
3. **Lanes report refusals in a fixed field** (`classifier_refusals`), and the
   orchestrator batches them into one envelope at the end of a drain.

## Not reopened

- **The rest of ADR-237 § 4 and ADR-266 § Not reopened** — deploy, release,
  production data, secrets rotation, IAM, DNS, bulk deletion outside scope, and
  every irreversible external action beyond the merge itself keep their own
  this-turn confirmation. A `needs-council` verdict of "safe" does not lift any
  of them; it only clears the merge.
- **Closing a PR the owner did not open** still needs its per-object
  confirmation.
- **The host classifier.** Nothing here hides, disables or works around it; a
  host refusal is answered by the envelope, never by a retry.
- **Kernel rules.** `non-destructive-by-default` is not edited; this record is
  the reading of its "this turn" clause for an auto-merge instruction, the same
  way ADR-266 is for an invocation.

## Consequences

- `process-full` and `/pr:merge` merge on the owner's word and stop short of it
  without one; their texts and the execution contract say so.
- **The danger gate is a heuristic over paths.** A dangerous change in a file
  with an innocuous name classifies `routine`. That is why the triggers are
  over-inclusive and fail closed, and why a miss is this record's
  `review_trigger` rather than an accepted cost.
- Nothing mechanical checks that an instruction was given; the control is
  model-carried, as ADR-266 § Consequences states for its own case.

## Alternatives

1. **Council on every auto-merge.** Rejected by the owner: it re-adds a review
   step to the routine case this record exists to free.
2. **Keep `process-full` non-merging.** Rejected: it is the contradiction the
   owner measured as the host refusing an authorized merge.

## Evidence

`E0`, `authority_basis: owner_intent`: no measurement decides whether a command
should merge; the owner does. The classifier's trigger list is checkable — every
trigger names the rule it comes from in `classify_merge_risk.ts` and in its
output.

## References

- [`ADR-239`](ADR-239-drain-command-surface-and-merge-authority.md) § Disposition — the row this settles.
- [`ADR-266`](ADR-266-explicit-pr-merge-invocation-is-the-this-turn-confirmation.md) — the invocation-is-the-confirmation argument reused here.
- [`ADR-268`](ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md) § 12 — the roadmap grant.
- [`ADR-280`](ADR-280-capability-federation-behind-a-trust-contract.md) — owner-directed provenance shape.
- [`ADR-281`](ADR-281-council-confirmed-self-modification.md) — the council ratifies a change to the gated surface; this record decides whether a ratified or routine PR may then merge. A change ADR-281 gates still needs its ratification record first.
