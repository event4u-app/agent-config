<!-- evidence-type: analysis -->

# The hold was decided; its precondition does not exist

AI council, 2026-10-12. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present, 2 rounds with blind peer review, `$0.00` (both seats
subscription-authed). The prompt is committed verbatim beside this file as
`hold-executable-form-20261012.question.md`; the raw response set was written
to `agents/runtime/council/responses/`, which is gitignored and auto-pruned,
so the substance that matters is carried here rather than cited by path.

## What was asked

Not whether D11's hold shape is right — that is decided and was fenced off in
the prompt. What its **executable form** is, given a measurement neither D11
nor D7 had: the "separately authorised principal" the hold requires does not
exist on this repository.

## The measurement the question carried

Read from the live forge on 2026-10-12, not recalled:

<!-- One row below carries a `<!-- ref-ignore -->` marker. `check_references`
     reads a backticked token next to the word "rule" as a rule name of this
     package and reports it broken; `pull_request` there is GitHub's ruleset
     rule TYPE. The marker sits on that row because the marker is matched per
     line as an exact literal, and this comment sits outside the table because
     a comment block between two rows ends the table. -->

| Fact | Value |
|---|---|
| Active branch rulesets | one, `17749383` "main protection", targeting `~DEFAULT_BRANCH` |
| Its `pull_request` rule | `required_approving_review_count: 0`, `require_code_owner_review: false`, `required_reviewers: []` | <!-- ref-ignore -->
| `bypass_actors` | `[]` |
| Write-or-better collaborators | 5 — `matze4u` (admin, and the proposing/merging party), `h3xa2` (maintain), `phpjob`, `0sama`, `php-jesus` (write) |
| Only reachable org team | `event4u-app/galawork`, **one** member: `matze4u` |
| `.github/CODEOWNERS` | every path, including all four Phase 2–3 files, owned by `@matze4u` |
| `doctor --online --json` → `forge_protection` | five rows, **none about required reviewers** |

Plus a prior owner ruling on the same dimension, already committed in
`src/config/platform-anchor.json` (`owner_ruling_2026_09_10`): a mandatory
approving review on this repository *"is not a control … it is a stop"*, and
`minimum_approving_reviews` was removed from the floor for that reason.

## Verdict — convergent 2/2: option (a), dormant-but-declared

The requirement is **declared and reported, not activated**. A verifier reads
the live forge and reports `unsatisfied` while no forge-side approval
requirement covers the authority surface. Phases 2–3 stay blocked. Nothing is
turned on that would stop the only active maintainer.

Both seats stated, independently and in terms, the sentence that keeps this
honest: **adding the verifier makes the blocker checkable and does not resolve
it.** anthropic: *"Adding the verifier row now (reporting `unsatisfied`) is NOT
resolving the blocker. It's making the blocker checkable."* openai: *"An
`unsatisfied` diagnostic makes the blocker observable but does not resolve
it."*

The wrongness condition for (a) — that a declared-but-unsatisfiable
requirement is indistinguishable from no requirement — does **not** apply where
all four of these hold, and both seats listed them:

1. the result is an explicit machine-readable `unsatisfied`;
2. it blocks only the authority-expanding Phase 2–3 changes, not ordinary work;
3. it cannot be flipped to `satisfied` by editing the candidate branch;
4. it is described as an unmet precondition, never as an active control.

anthropic added a fifth, which is kept: the status must not be flippable by the
owner acting alone — e.g. by adding a rarely-active collaborator to CODEOWNERS
without demonstrated acceptance. *"Without that property, (a) could become
governance theater via unilateral reconfiguration."*

## The rejected options, with the reason rather than the ranking

- **(b) bootstrap through the owner's own recorded break-glass act — rejected
  by both, and this was the option the prompt warned itself about.** anthropic:
  *"Break-glass (D3) is for emergency restoration of already-valid controls,
  not for bootstrapping controls that constrain the break-glass holder
  themselves. The 2026-09-10 ruling establishes provenance … not
  independence."* openai: *"A well-recorded violation remains a violation."*
  The circularity is the parent record's own dealbreaker — *the enforcement
  code must not be ratifiable through the same process it enforces* — and
  recording it better does not break it.
- **(c) a non-human second principal (App or bot)** — contradicts D7, which is
  an owner decision, and buys no independence while the credential is reachable
  by the same party.
- **(d) recruit a second human** — *"applies presently, but conditionally"*
  (openai). Not disqualified by inactivity as such; disqualified today by the
  absence of acceptance, dependable availability, independent administration
  and a tested enforcement path. **This is the intended activation path**, and
  the only one either seat endorsed for the future.
- **(e)** — no unmeasured forge capability was identified.

## Does the path-scoped narrowing rescue the requirement? No.

Asked explicitly; answered the same way by both. The 2026-09-10 ruling is about
**availability**, not scope. Narrowing to four files does not change that
`@matze4u` is the only active party for those paths — it only narrows which
surfaces become unmergeable, and those surfaces are exactly the ones Phases 2–3
need. Path scoping stays useful as a future least-authority design once a real
second approver exists.

## The scope omission neither D11 nor the blocker had caught

openai, unprompted: the trusted surface is **larger than the four named files**.
It includes at least `.github/CODEOWNERS`, the implementation and output
semantics of `doctor` itself, the workflows that invoke or gate on the
verifier, the configuration identifying the default branch or ruleset, anything
able to weaken or bypass the rule, and the external ruleset. *"If those
surfaces are mutable without the external approval, the protected four-file
boundary can be disabled indirectly."*

## Three assertions that must stay separated

openai's decomposition, adopted as the shape of the implemented row:

1. **declared intent** — which surfaces a committed policy says need approval.
   Candidate-controlled unless read from a trusted base revision.
2. **observed forge state** — whether the live configuration actually requires
   it. *"Only the second is wholly forge-readable."*
3. **principal qualification** — separateness, acceptance, continued
   operation. Partly organizational; **not derivable** from CODEOWNERS or from
   recent activity.

openai's correction to its own peer, kept because it bounds what the row may
claim: a diagnostic overclaims when it says an identity is *"administered
independently"* — the API can establish identity, membership, permissions and
ruleset coverage; it cannot establish who controls a credential.

openai also rejected anthropic's proposed availability proxy outright: *"at
least one PR merge in the past 90 days"* proves neither acceptance of the duty,
nor independent control of the account, nor a useful response window. No
activity-based availability test is adopted.

## The sequencing, as openai set it out

1. Freeze Phase 2–3 authority-expanding changes.
2. Merge an observational, fail-closed diagnostic under the existing regime,
   **explicitly recording that this does not satisfy D11**.
3. An authorised external administrator appoints the accepted second principal,
   outside the candidate branch.
4. A disposable test PR proves: owner self-approval cannot satisfy the gate;
   the external reviewer can; a subsequent relevant push invalidates the
   approval; every trusted surface is covered.
5. Only then is the blocker resolved and Phase 2 begun.

*"Step 2 does not logically unblock step 3, and step 3 does not unblock Phase 2
until step 4 succeeds."*

## Kill-switch, required before any future activation

Loss, suspension or departure of the approver returns the gate to
`unsatisfied` immediately; ordinary changes stay mergeable while
authority-surface changes fail closed; no pending authority change is ratified
during an outage; a second recovery administrator is identified before
activation, or losing the sole external identity strands the control
permanently; rollback means restoring a previously verified ruleset, never
disabling approval to restore throughput.

## Rewriting the blocker's resolution condition — yes, both seats

The old condition named a probe with no row that could answer it. openai's
form, which is what the blocker now carries in substance:

> Resolved when a trusted, candidate-independent invocation of `agent-config
> doctor --online --json` reports that every Phase 2–3 authority surface is
> covered by a live forge approval rule; at least one accepted external
> reviewer distinct from the proposing/merging principal is eligible to satisfy
> it; owner self-approval and configured bypass cannot satisfy it; stale
> approval is dismissed after relevant changes; and live positive and negative
> test PRs have demonstrated those properties.

Both seats required that `unknown` stay distinguishable from `unsatisfied` —
*"API failure must not masquerade as a confirmed absence."* The existing
three-state `ProtectionRow` already encodes that as `unread`, so the shipped row
reuses it rather than inventing a fourth state.

## Confidence, and what would move each seat

anthropic **0.75**, openai **0.93**. anthropic's residual uncertainty is
whether this is council-decidable *governance-applicability* (a decided
control's precondition is unmet) or owner-reserved *governance
self-amendment* (changing how authority is decided). It distinguished the two,
leaned council-decidable, and said it would defer to an owner ruling the other
way. **Neither seat declared the question owner-reserved**, so it was taken as
decided here and the uncertainty is recorded rather than resolved.

What would move them: an owner ruling on that applicability question; or a
live test PR showing a named second human has accepted the duty and is
forge-enforced across the complete trusted surface while the owner
demonstrably cannot self-satisfy or bypass the gate.

## Peer-review refinement, recorded and NOT adopted

anthropic's reviewer proposed a **time-boxed escape hatch**: if no qualifying
principal emerges within N months, escalate with three choices — relax D11 to a
different control model, accept an indefinite freeze, or explore a
contractual/organizational separation as a stated-limitation interim. It also
named the option nobody had: an organizational rather than technical
separation, a signed agreement recorded in the repository.

Not adopted, and the reason is on the record rather than left as silence:
choosing N, and choosing what happens at N, is a decision about when a declared
authority requirement may be relaxed — which is the governance self-amendment
dimension anthropic had just flagged as possibly owner-reserved. Picking a
deadline here would be the council deciding the one thing it was unsure it may
decide. It is carried to the owner as residue instead.
