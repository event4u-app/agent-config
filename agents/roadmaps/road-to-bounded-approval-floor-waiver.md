---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-typed-grants-that-persist
    relation: extends
---
# Road to bounded approval floor waiver

> **Source:** an AI council of 2026-09-10 (anthropic/claude-sonnet-4-5 +
> openai/codex-default, 2 rounds, blind peer review, quorum 2/2), asked which
> form the in-repository half of an owner-decided approval-floor rollback
> should take. Question and both answers:
> `agents/runtime/council/questions/2026-09-10-approval-floor-solo-maintainer.md`
> and the two files beside it under `../responses/` — gitignored and pruned
> after the retention window, so the council's load-bearing findings are
> restated here rather than cited.
>
> The occasion was PR #1988 reporting `mergeStateStatus: BLOCKED`,
> `reviewDecision: REVIEW_REQUIRED` with every required check green.

## Goal

`src/config/platform-anchor.json` describes the live ruleset truthfully again,
and it does so without pretending the approval floor still protects anything.
A reader can tell from the file alone that the two approval checks are
suspended, why, until when, and what makes the suspension stop being valid —
and `check_platform_anchor` refuses a suspension that is missing, malformed,
expired, or scoped to any field beyond those two.

Today the file expects `minimum_approving_reviews: 1` and
`require_last_push_approval: true`. The owner has decided to return the live
ruleset to `0` / `false`, because with one maintainer and GitHub's prohibition
on approving one's own pull request, `1` is not a strict requirement — it is an
unsatisfiable one, and it locked the sole maintainer out of the merge path
entirely once `bypass_actors` became empty. Nothing in CI enforces the
expectation (`check_platform_anchor` is deliberately unwired — `grep -rn
check_platform_anchor taskfiles/ .github/workflows/ Taskfile.yml` returns
nothing), so the drift reds no check and this roadmap is not urgent. It is
still a file asserting something false about the platform, which is the one
property the anchor exists to prevent.

## What the council converged on, and where it split

Convergent, 2/2:

- The verdict for the change is **`ratified`**, never
  `confirmed-non-expanding`. The set of platform states the verifier accepts
  grows from `1/true` to include `0/false`. Operational necessity explains an
  expansion; it does not make it non-expanding.
- Setting the two floor values to `0` / `false` is not an option.
  `minimum_approving_reviews: 0` excludes no GitHub-supported state and
  `require_last_push_approval: false` imposes no protection, so keeping them in
  `NON_NEGOTIABLE_FLOOR` at their weakest values advertises a floor that
  constrains nothing.
- The two shipped negative tests must not simply invert.
  `tests/scripts/platform_anchor.test.ts:170` and `:218-220` keep their current
  polarity **on the un-waivered path**; new tests carry the waivered one.
- The contract needs affirmative additions, not only corrections: what the
  remaining protection actually is, what signal would show it is inadequate,
  and what triggers re-evaluation.

Split on the form. anthropic accepted a modified Candidate A — drop both
properties from the floor, add a rationale field. openai refused A and B both,
required Candidate C (below), and stated that an indefinite self-asserted
exemption with no invalidation mechanism would draw a `refused` vote from it.
Since `src/config/ratification-policy.json` requires two distinct providers, C
is the only shape that can carry a passing artifact — which is why this roadmap
builds C and records A as rejected rather than presenting the two as open
options.

openai's reason for refusing a `maintainer_model: solo` field is worth keeping
in front of whoever implements this: "solo" is a social description, not the
property that makes approval impossible. A repository can have one maintainer
plus an eligible outside collaborator, and several maintainers with no eligible
independent approver. The field would also let the repository holding the
control declare itself exempt from it, permanently, with no measurement behind
the claim.

## Open design question — a third floor field the council never saw

**Phase 1 cannot be built until this is answered, and it is not answerable from
the 2026-09-10 council record.** That session was asked about two fields. A
third is now off by owner decision:
`strict_required_status_checks_policy` is `false`, deliberately, because
several branches are commonly green at once here and requiring each to be
brought up to date re-runs the full check suite on every one of them, serially.
The owner accepts a rare post-merge repair over that standing cost. (It was
briefly restored at 16:04 on the assumption that the 15:18 change had been a
side effect, then returned to `false` once the intent was stated.)

`NON_NEGOTIABLE_FLOOR.strict_required_status_checks` is `true`, so the live
state is under the floor in a field the waiver — as openai specified it — may
**not** touch: *"It may suspend exactly those two approval checks. It must not
affect … strict status checks …"*. Built as designed, the waiver would leave
`check_platform_anchor` permanently noncompliant on a finding nobody intends to
fix, which is the drift this whole limb exists to prevent.

Three shapes, none of them free:

1. **Widen the waiver to three fields.** Smallest diff, and it contradicts
   openai's explicit scope condition — the same seat that would vote `refused`
   on an unbounded exemption. Not a change to make without asking it again.
2. **A second, separately-scoped waiver** for the merge-freshness field, with
   its own reason and expiry. Keeps openai's approval-waiver boundary intact at
   the cost of a second mechanism in one file.
3. **Drop `strict_required_status_checks` from the floor entirely** and keep it
   only in the expectation. This is the shape anthropic proposed for the
   approval fields — a floor value the repository has decided against is not a
   floor — and unlike those fields it does forbid a real state, so dropping it
   is a genuine reduction rather than removing an illusion.

**What has to happen before 1.1:** put exactly this question to the council,
with the owner's cost argument stated as a given rather than as a proposal, and
record the answer here. The ratification artifact in 2.2 then covers three
suspended or dropped fields, not two — a wider expansion than the one the
existing record's verdict was reasoned about.

## Phase 1 — the waiver, fail-closed

- [ ] **1.1 Add `approval_floor_waiver` to `src/config/platform-anchor.json`.**
      Blocked on the open design question above — the field set is two or three
      depending on its answer, and building either shape first wastes the work.
      A sibling of `required`, not a member of it, so the three concepts stay
      separable: `required` says what the platform has, `NON_NEGOTIABLE_FLOOR`
      says what is normally permitted, the waiver records temporary authority
      to deviate. Fields: `reason`, `suspends` (exactly the two approval keys),
      `evidence_observed_at`, `expires_at`, `revisit_when`. `required` moves to
      `minimum_approving_reviews: 0` / `require_last_push_approval: false` in
      the same step, because an expectation that does not match the live
      ruleset is the defect this roadmap closes.
      verify: `./scripts-run src/scripts/check_platform_anchor --files src/rules/commit-policy.md`
      exits 0 and prints `compliant`, against the rolled-back ruleset.

- [ ] **1.2 Teach `enforceFloor` to honour exactly that waiver.**
      `NON_NEGOTIABLE_FLOOR` keeps `minimum_approving_reviews: 1` and
      `require_last_push_approval: true` — the floor is suspended, not lowered.
      A waiver suspends those two keys and nothing else: it may not excuse a
      selector (`enforcement`, `target`, `covers_default_branch`), a threshold
      (`required_review_thread_resolution`, `block_deletion`,
      `block_non_fast_forward`, `strict_required_status_checks`,
      `allow_unconditional_bypass`), `minimum_required_contexts`, or schema
      validation. Missing, malformed, unknown-field, partially-scoped,
      over-broad and expired waivers all fail closed.
      verify: `npx vitest run tests/scripts/platform_anchor.test.ts` green,
      including the new cases in 1.3.

- [ ] **1.3 Write the waiver test matrix.**
      A valid waiver accepts exactly `0/false`; `1/true` stays valid with no
      waiver; removing or expiring the waiver restores the original floor
      immediately; a waiver naming any additional suspended field is rejected;
      a waiver cannot excuse a mismatch in any other field; exact
      expected-state comparison still detects unrelated live drift. Both
      pre-existing negative tests keep their polarity on the un-waivered path.
      verify: the six assertions above exist as named tests, and each is seen
      red once by neutralising the mechanism it covers before it is restored.

- [ ] **1.4 Make `minimum_required_contexts` carry its new weight.**
      With the approval half suspended, the required status checks plus
      `allow_unconditional_bypass: false` are the protection that remains.
      anthropic named this load-bearing and under-addressed. Assert that an
      empty or weakened `required_status_check_contexts` is refused, and record
      in the file which contexts are required and why they are considered
      sufficient.
      verify: a test proves `required_status_check_contexts: []` is rejected;
      the reason is in the file's own comment, not only in this roadmap.

## Phase 2 — the record

- [ ] **2.1 Correct the stale platform measurements in
      `src/config/platform-anchor.json`'s `threat_model_note`.**
      It states `bypass_actors` carries
      `{actor_type: RepositoryRole, actor_id: 5, bypass_mode: always}` and that
      the acting account reports `current_user_can_bypass: always`. Measured
      2026-09-10 at 15:0x, `bypass_actors` is `[]` and
      `current_user_can_bypass` is `never` — removed by the same 12:51 ruleset
      edit that raised the approval count. The owner question the note records
      is unchanged and stays open; only the measurement is false. Keep the
      original reading as dated historical evidence rather than rewriting it,
      per openai's explicit instruction.
      verify: `gh api repos/event4u-app/agent-config/rulesets/17749383 --jq
      '{bypass_actors, current_user_can_bypass}'` agrees with what the note
      claims for the date it claims it.

- [ ] **2.2 Write the ratification artifact with `verdict: ratified`.**
      Under `agents/evidence/ratifications/`, providers `anthropic` and
      `openai`, `effective_after: merge`. It supersedes only the
      approval-related portion of `drain-typed-grants-platform-anchor.md` and
      says so; that record's `confirmed-non-expanding` verdict does not reach
      the weaker approval state. It documents the approval-floor suspension and
      the `bypass_actors` removal as two separate dated changes with separate
      justifications — anthropic's point, and correct: they are independent and
      could have happened in either order.
      verify: `./scripts-run src/scripts/check_kernel_edit_ratified
      --base-ref origin/main` exits 0.

- [ ] **2.3 Reconcile the `ratification-platform-anchor` blocker in
      `road-to-typed-grants-that-persist.md`.**
      Its "What the human must change" list demands
      `required_approving_review_count` ≥ 1 and
      `require_last_push_approval: true` — the two the owner has now reversed.
      Item 3 (`bypass_actors`) is done. The blocker must say what it now waits
      on, or be resolved; what may not stand is a blocker instructing a future
      reader to undo a decision the owner took.
      verify: no line in that blocker asks for a state the live ruleset is
      deliberately not in.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The waiver outlives its reason | implementation | `expires_at` passes unnoticed, or a second maintainer with approval rights joins and nobody re-raises the floor. The suspension then reads as permanent policy, which is exactly openai's stated ground for a `refused` vote | Expiry is enforced in `enforceFloor`, not documented in prose: an expired waiver fails closed and the gate names it. `revisit_when` records the topology condition in the file, since GitHub's effective-approver eligibility (teams, outside collaborators, inherited org roles) is not something this evaluator derives | Phase 1 — the waiver, fail-closed |
| 2 | The waiver becomes a general escape | implementation | A later edit widens `suspends` to cover a threshold or a selector, and the floor is hollowed out through the door built here rather than by lowering it | `suspends` is validated against a closed two-element set; a waiver naming any further field is rejected, with a test asserting the rejection. `platform-anchor.json` sits on `ANCHOR_PATHS`, so the attempt needs its own ratification | Phase 1 — the waiver, fail-closed |
| 3 | The remaining protection is weaker than assumed | implementation | With approvals suspended, one required context carries the load. If that context is renamed, split, or its job stops running the gate's steps, nothing objects | 1.4 asserts a non-empty required-context set. The known residual — a required context pins a job name, never the steps inside it — is already recorded in `platform-anchor.json`'s `required_status_check_contexts_note` and is not closed here | Phase 1 — the waiver, fail-closed |

## Acceptance Criteria

- [ ] AC-1 — `src/config/platform-anchor.json` matches the live ruleset, and
      `check_platform_anchor` reports `compliant` rather than `noncompliant`.
- [ ] AC-2 — `NON_NEGOTIABLE_FLOOR` still carries
      `minimum_approving_reviews: 1` and `require_last_push_approval: true`.
      The floor was suspended by a named, expiring waiver, not lowered.
- [ ] AC-3 — A waiver that is expired, malformed, or scoped beyond the two
      approval keys is refused, each case covered by a test that has been seen
      red.
- [ ] AC-4 — A ratification artifact with `verdict: ratified` and two distinct
      providers is committed, and it states which part of
      `drain-typed-grants-platform-anchor.md` it supersedes.
- [ ] AC-5 — No document in the tree claims an administrator bypass exists on
      this repository as current state, and no blocker asks a future reader to
      restore either the approval requirement or the merge-freshness setting
      the owner reversed.
- [ ] AC-6 — `check_platform_anchor` reports no finding that nobody intends to
      fix. The `status-checks-not-strict` case is resolved by whichever shape
      the council picks for the open design question, and the choice is
      recorded in the ratification artifact rather than only in this roadmap.
