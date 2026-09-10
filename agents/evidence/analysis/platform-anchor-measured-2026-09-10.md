<!-- evidence-type: analysis -->

# The platform anchor, measured — 2026-09-10

The ratification mechanism's contract told a reader that its trust came from two
things: the base-revision gate, and human review of the pull request. The first
is real and mechanical. This report measures the second and finds it absent.

Everything below was read with `gh api` against `event4u-app/agent-config` on
2026-09-10, at `origin/main` `7bf325f3b`. Every command is reproducible; nothing
here is inferred from a settings page screenshot or from prose.

## What was measured

### Classic branch protection is not in use

```
$ gh api repos/event4u-app/agent-config/branches/main/protection
404 {"message":"Branch not protected", ...}
```

This matters more than a 404 usually does, because blocker
`ratification-platform-anchor` named exactly this endpoint as the readable
surface for the check it was asking for. A gate written to that specification
would have called an endpoint that returns 404, and — depending on how the
failure was handled — either failed permanently for the wrong reason or passed
while measuring nothing.

### One active ruleset covers the default branch

```
$ gh api repos/event4u-app/agent-config/rulesets
[{ "id": 17749383, "name": "main protection", "target": "branch",
   "enforcement": "active", "source_type": "Repository" }]
```

### Its rules, as they stand

```
$ gh api repos/event4u-app/agent-config/rulesets/17749383
conditions.ref_name.include = ["~DEFAULT_BRANCH"]
rules:
  - deletion
  - pull_request:
      required_approving_review_count: 0
      require_last_push_approval: false
      require_code_owner_review: false
      required_review_thread_resolution: true
      dismiss_stale_reviews_on_push: true
  - required_status_checks:
      strict_required_status_checks_policy: true
      required_status_checks: [ { context: "Sync + Generate Tools Consistency" } ]
  - non_fast_forward
bypass_actors: [ { actor_type: "RepositoryRole", actor_id: 5, bypass_mode: "always" } ]
current_user_can_bypass: "always"
```

## The three findings

1. **No independent approval is required.** A pull request is required and zero
   approving reviews are. So a ratification artifact — whose whole purpose is to
   record that a party other than the one gaining authority looked — can land
   without any party the repository insisted on having looked.
2. **`require_last_push_approval` is false.** Even where an approval exists, it
   may predate the final push, so the reviewed diff need not be the merged diff.
3. **An administrator role bypasses everything unconditionally.** Every rule
   above is advisory for `RepositoryRole#5`, and the account this measurement ran
   under reports `current_user_can_bypass: always`.

## One thing that is NOT a finding, corrected mid-investigation

The first framing of this measurement asserted that `check_kernel_edit_ratified`
*"is not a required status check at all"* and that *"a branch that deletes the
gate's workflow step merges green"*. The second clause is true. The first is
false, and it was put to a council before being checked, so the correction is
recorded here rather than quietly dropped.

`check_kernel_edit_ratified` runs as a step inside the job `Sync + Generate
Tools Consistency` (`.github/workflows/consistency.yml:811-825`), and that job's
context is the ruleset's one required check. The gate is therefore
platform-required, transitively.

What survives, and what the round-2 ratification review actually refused the
deny-retirement over, is narrower and still real: **a required status check pins
a job's reported context, never the steps inside it.** A candidate branch may
delete the gate's step from that job, the job still reports
`Sync + Generate Tools Consistency`, and it goes green. So the required context
is necessary and not sufficient. Nothing in this change closes that, and
`check_platform_anchor` does not claim to.

The council verdict this correction lands under was reached on three drivers, of
which findings 1 and 3 are untouched by it. The verdict does not depend on the
clause that was wrong.

## What was built in response

- `src/config/platform-anchor.json` — the committed expectation, so that
  changing what the repository *should* enforce is a reviewable governance diff
  rather than a settings change nobody sees.
- `src/scripts/_lib/platform_anchor.ts` — the pure evaluator, carrying a
  non-negotiable floor a policy edit cannot cross.
- `src/scripts/check_platform_anchor.ts` — the gate. Fires only on a diff that
  already requires ratification, so an ordinary pull request never reaches the
  network through it. Fails closed: `unverifiable` is a failure, distinct from
  `noncompliant`, because a control that succeeds when it cannot measure is
  advisory.
- `tests/scripts/platform_anchor.test.ts` — 25 tests, both polarities on every
  rule, with the configuration above pinned as a fixture so a later reader sees
  the measured state rather than a sentence about it.

Run against the live repository on 2026-09-10 the gate exits 1 and names findings
1, 2 and 3. That is the intended outcome of a control meeting a missing anchor,
not a defect in the control.

## What is left, and to whom

The three settings changes are admin-only actions that no diff and no council
decision can perform. They are recorded as the open half of
`ratification-platform-anchor`, with the exact fields and the verification
command. Until they land, the mechanism supplies process evidence rather than a
platform-enforced ratification guarantee, and
`docs/contracts/ratification-artifact.md` now says so in those words.

One question above them is owner-reserved and deliberately left open rather than
answered by the party that would benefit from the answer: whether repository
administrators are inside the threat model at all. If they are a deliberate
root-of-trust escape hatch, that belongs in the contract in writing with an
audited emergency-use procedure. What may not stand is the contract claiming
protection against unilateral action while an administrator bypasses
unconditionally.
