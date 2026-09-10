---
complexity: structural
status: draft
estate_offset_exempt: >-
  Nothing in the active estate can be offset against this. The two roadmaps the gate counts as
  active are road-to-delivery-for-every-host and road-to-delivery-on-hook-hosts, both host
  delivery; neither carries the platform expectation. Archiving an unrelated roadmap to buy the
  slot would be exactly the gate-gaming this key exists to make visible instead. The count half
  is already neutral because this file is a draft — the key is here because one_in_one_out
  counts the added file separately, and check_estate_count refused the change without it.
  Blocking rather than cosmetic: check_platform_anchor runs in taskfiles/ci-fast.yml, so while
  the drift stands every kernel-rule, governance-hook and anchor-path change is refused at
  pre-push.
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-typed-grants-that-persist
    relation: extends
---
# Road to bounded approval floor waiver

> **Source:** an AI council of 2026-09-10 — `anthropic/claude-sonnet-4-5` and
> `openai/codex-default`, 2 rounds, blind peer review, subscription transport,
> $0.0000 — asked which form the in-repository half of an owner-decided
> approval-floor rollback should take. **Two runs, and only the second counts:**
> the first returned one seat, openai having failed with `os_error: ENOBUFS` and
> zero output tokens. The retry returned both. Session files are gitignored and
> pruned after the retention window, so every load-bearing finding is restated
> in full below rather than cited by path. Where this roadmap says "both seats",
> it means the retry.
>
> **Quorum honesty:** the retry's own record carries `threshold: 1`, so it is a
> degraded-quorum run by configuration, and its `absent_members` names openai
> from the pre-run probe while the same object counts two seats present. Both
> texts are real and both are used here; "2/2 present" is the record's own
> figure and not a claim that the run required two.
>
> The occasion was PR #1988 reporting `mergeStateStatus: BLOCKED`,
> `reviewDecision: REVIEW_REQUIRED` with every required check green.

## Goal

`src/config/platform-anchor.json` describes the live ruleset truthfully again,
and it does so without pretending the approval floor still protects anything.
A reader can tell from the file alone that the two approval checks are
suspended, on what stated ground, and what makes the suspension stop being
valid — and `check_platform_anchor` refuses a suspension that is missing,
malformed, stale, or scoped to any field beyond those two.

## What is measured, so the plan is not built on prose

Every row re-read on 2026-09-10 afternoon.

| ID | Fact | Where |
|---|---|---|
| M1 | Six ruleset versions exist on 2026-09-10, not two. `49256548` 12:51 · `49271774` 15:14 · `49272069` 15:16 · `49272180` 15:18 · `49276909` 16:04 · `49277135` 16:06 | `gh api repos/event4u-app/agent-config/rulesets/17749383/history` |
| M2 | The approval reversal is two edits, one field each: 15:14 set `required_approving_review_count` 1 → 0; 15:16 set `require_last_push_approval` true → false. 15:18 changed **only** `strict_required_status_checks_policy` true → false | per-version `/history/<id>` |
| M3 | PR #1988 merged at `2026-09-10T13:17:09Z` = **15:17:09 local** — after the 15:16 edit and one minute *before* the 15:18 version exists. The 15:18 edit is not part of what unblocked it | `gh pr view 1988 --json mergedAt` |
| M4 | 16:04 restored `strict` to `true` and 16:06 returned it to `false`. The restoration was made on the assumption that 15:18 had been a side effect; the owner then stated the intent | `/history/49276909`, `/history/49277135` |
| M5 | `check_platform_anchor` runs in `taskfiles/ci-fast.yml` — in `preflight` and as its own target — and in no workflow. The rulesets endpoint needs the repository `administration` permission, which does not exist as a workflow `GITHUB_TOKEN` scope | `taskfiles/ci-fast.yml`; `.github/workflows/rule-backstops.yml`; `src/config/ci-local-parity.yml` (`local_only`, `token-scope-unavailable`) |
| M6 | `NON_NEGOTIABLE_FLOOR` carries `minimum_approving_reviews: 1`, `require_last_push_approval: true`, `strict_required_status_checks: true` | `src/scripts/_lib/platform_anchor.ts` |
| M7 | `enforceFloor` is called from **inside** `readAnchorPolicy`, against the narrowed 11-field `AnchorPolicy` struct. It never sees a top-level sibling of `required`, and it has no clock | `src/scripts/_lib/platform_anchor.ts` |
| M8 | A waiver placed inside `required` is refused as `policy-unknown-field`; placed as a sibling it is ignored and the floor still refuses `0`/`false`. Both measured by running `readAnchorPolicy` on the two candidate files | `readAnchorPolicy` |
| M9 | `tests/scripts/platform_anchor.test.ts:170-175` asserts `minimum_approving_reviews: 0` → `policy-below-floor`. `:218-220` asserts `1.5` and `10_000` rejected and `2` accepted — it concerns neither approval field, and `:220` is a positive assertion | the test file |
| M10 | **No test anywhere asserts that `require_last_push_approval: false` is refused by the floor.** Both council seats stated `:218-220` proves it; it does not | `grep` over the test file |
| M11 | `required_status_check_contexts: []` is already refused (`platform_anchor.test.ts:180`, backed by the `minimum_required_contexts` branch), and `platform-anchor.json` already carries `required_status_check_contexts_note` | test file; anchor JSON |
| M12 | `SUPPORTED_ANCHOR_SCHEMA = 1`, and `checkAnchorIdentity` hard-rejects any other value | `src/scripts/_lib/platform_anchor.ts` |
| M13 | The acting account has `admin: true` on the repository, so ruleset administration is possible independently of the PR merge path | `gh api repos/event4u-app/agent-config --jq .permissions` |

## What the council actually said

**Convergent in the retry, both seats:**

- The verdict is **`ratified`**, never `confirmed-non-expanding`. The set of
  platform states the verifier accepts grows to include `0`/`false`.
  Operational necessity explains an expansion; it does not make it
  non-expanding. It supersedes only the approval-related portion of
  `drain-typed-grants-platform-anchor.md`.
- **A structured, evidence-carrying exemption object — not a lowered floor and
  not a social label.** anthropic: `maintainer_model: "solo"` "is a label, not
  a constraint. It would silently fail when a second approver joins." Both
  seats converged on a field carrying `reason`, an evidence timestamp, and a
  revisit condition, suspending exactly the two approval checks.
- **Candidate A is a tautology, not a smaller option.** With the expectation at
  `0`/`false` the checker still validates — against the platform's permissive
  defaults. anthropic: "it just proves nothing."
- **The sequence matters and the naive one deadlocks.** Ratify the schema →
  deploy the exemption-aware reader → test it against both states → apply the
  platform rollback → capture evidence → land the expectation. Applying the
  rollback first creates a window where the gate refuses the repository's own
  repair path.
- **`:170` and `:218-220` keep their polarity on the un-exempted path** — and
  both seats were wrong about what `:218-220` is (M9, M10). The obligation they
  meant is real; the line they cited does not carry it, and a test for
  `require_last_push_approval: false` has to be written rather than preserved.

**The one real divergence, and it is the open question:**

openai requires the exemption to be **fail-measurable** — invalidated on expiry
*or* on detection of an eligible independent approver — and says it would vote
`refused` on "an indefinite, self-asserted exemption with no invalidation
mechanism". anthropic calls continuous measurement an impossible bar: GitHub
exposes no queryable "can this user approve this author's PR" across teams,
outside collaborators, CODEOWNERS and inherited roles, and building a shadow
roster "would be more complex than the floor itself". Its counter-proposal is
**fail-explicit**: a human-evaluated `revisit_if` plus `invalidate_on_next_edit`,
which bounds the exemption to one governance change.

**anthropic's hardest pushback, which changes how the record must read.** The
exemption does not encode a platform constraint. GitHub supports outside
collaborators, teams and bots; this repository has zero eligible approvers
because none has been configured. Calling it "structurally unsatisfiable"
obscures a deliberate single-operator model. The proposed reason is therefore
`single-operator-model-by-design`, and the ratification names the choice rather
than a constraint. **An earlier draft of this roadmap used the
"unsatisfiable" framing throughout; that was the framing anthropic rejects.**

## Open design question 1 — fail-measurable or fail-explicit

Not answerable from the record: the two seats disagree, and openai attached a
`refused` vote to the shape it rejects. Both agree on the object; they disagree
on what invalidates it. Options are openai's measured-eligibility invalidation,
anthropic's `invalidate_on_next_edit` plus human `revisit_if`, or a hybrid where
the measurement is *specified* as a manual review trigger and automated only if
the API ever supports it — which is anthropic's own compromise ("specified but
not automated"). This must be put back to the council before Phase 1.

## Open design question 2 — the third floor field

`strict_required_status_checks` is `true` in `NON_NEGOTIABLE_FLOOR` (M6) and
`false` live, by a separate owner decision on measured cost: several branches
are commonly green at once here, and requiring each to be brought up to date
re-runs the full suite on every one of them, serially. A rare post-merge repair
is the accepted price.

openai scoped the exemption to exactly the two approval checks and named strict
status checks among what it must **not** affect. So the live state sits under
the floor in a field the exemption may not touch, and the gate would report a
finding nobody intends to fix.

**One correction to how this was framed earlier:** `status-checks-not-strict`
fires on an *expectation-versus-live* comparison, not on the floor. So "drop the
field from the floor and keep it in the expectation" does **not** clear the
finding — the expectation has to move to `false` as well. Three shapes remain:
widen the exemption to three fields (against openai's stated scope), a second
separately-scoped exemption for merge freshness, or move both the floor entry
and the expectation. This goes to the council with question 1, and the owner's
cost argument is a given rather than a proposal.

## Phase 0 — answer the two questions, then sequence

- [ ] **0.1 Put both open design questions to the council in one session.**
      Question 1 is invalidation (fail-measurable vs fail-explicit), question 2
      is the third field. Supply M1-M13 as measured facts, the owner's cost
      argument as settled, and anthropic's `single-operator-model-by-design`
      framing as the proposed reason. Record the answer in this file.
      verify: a council response exists with both seats present, and this
      section names the chosen shape for each question.

- [ ] **0.2 Establish the administrator recovery path, tested.**
      Both seats raised it and neither proposed one; the earlier draft of this
      roadmap declared it discharged, which it is not. With `bypass_actors: []`
      a future ruleset mistake re-locks the sole maintainer out of the PR path,
      exactly as 12:51 did. `admin: true` is measured (M13) and is a capability
      claim, not a tested procedure.
      verify: a written procedure exists naming the exact command that restores
      a merge path from a locked-out state, and it has been executed once
      against a non-default branch ruleset to prove it works.

- [ ] **0.3 Record that the council's safe sequence was already violated, and
      what follows from that.** The sequence is ratify → deploy reader → test →
      rollback → evidence → expectation. The rollback happened first, on
      2026-09-10 at 15:14 and 15:16. The window the seats warned about is
      therefore open now, and the mitigating fact is M5: the gate is a pre-push
      control, so it blocks the class of change that needs ratification and not
      the repair PR itself. State this rather than re-planning around a
      precondition that has passed.
      verify: this file names the violated step and the reason the window is
      survivable.

## Phase 1 — the exemption, fail-closed

- [ ] **1.1 Teach `readAnchorPolicy` to parse and validate the exemption.**
      This step comes first, and the earlier draft had it second — which was
      unbuildable. `enforceFloor` is called from inside `readAnchorPolicy`
      against an 11-field struct with no exemption member (M7), so the reader is
      the missing piece. Either `AnchorPolicy` grows the field and
      `enforceFloor` reads it, or `enforceFloor` takes it as a second argument;
      both touch every existing call site. Validation per the council: closed
      `reason` vocabulary, `eligible_independent_approvers` must be `0` when
      present, an ISO-8601 `evidence_observed_at` in the past, non-empty
      `revisit_if`, and unknown fields inside the exemption rejected.
      verify: `readAnchorPolicy` on a file carrying a valid exemption returns a
      policy rather than `null`; on a malformed one it returns `null` with a
      named finding.

- [ ] **1.2 Suspend exactly the two approval checks, nothing else.**
      `NON_NEGOTIABLE_FLOOR` keeps `1`/`true` — suspended, never lowered. The
      exemption may not excuse a selector (`enforcement`, `target`,
      `covers_default_branch`), any other threshold, `minimum_required_contexts`,
      or schema validation. **A missing exemption is the normal green path**, not
      a failure — the earlier draft said missing exemptions fail closed, which
      contradicted its own next step. Malformed, over-broad, stale and
      unknown-`reason` exemptions fail closed.
      verify: `npx vitest run tests/scripts/platform_anchor.test.ts` green,
      including 1.4.

- [ ] **1.3 Decide and record the invalidation mechanism from 0.1, and build it
      where it can be built.** If `invalidate_on_next_edit` is chosen, note that
      `enforceFloor` has no clock (M7) — any time- or edit-dependence needs a
      source injected, which makes a pure function impure and touches its three
      existing call sites. The earlier draft asserted expiry "is enforced in
      `enforceFloor`"; that is not implementable as the function stands.
      verify: the mechanism exists in code with a test, or this file records why
      it is manual and what the human checks.

- [ ] **1.4 Write the test matrix, including the one that does not exist yet.**
      Per M10 a test refusing `require_last_push_approval: false` has to be
      **written**, not preserved. Then: a valid exemption permits exactly `0`
      and `false`; `1`/`true` stays valid with no exemption; a stale or
      malformed exemption restores the floor; an exemption naming any further
      suspended field is rejected; an exemption cannot excuse a mismatch in any
      other field; exact expected-state comparison still detects unrelated live
      drift; and the topology case (`eligible_independent_approvers: 0` while an
      approver exists) is at minimum *specified* as a manual trigger, per
      anthropic.
      verify: each assertion exists as a named test and has been seen red once
      by neutralising the mechanism it covers.

- [ ] **1.5 Decide the schema version.** The exemption is a new structural
      top-level field while `SUPPORTED_ANCHOR_SCHEMA = 1` and
      `checkAnchorIdentity` rejects any other value (M12). Unknown-field
      rejection is scoped to `required`, so it happens to pass — but "happens to
      pass" is an unmade decision, and the code comment says a bump lands with
      the reader that understands it.
      verify: this file states bump-or-not and why.

## Phase 2 — the record

- [ ] **2.1 Correct the stale platform measurements in
      `src/config/platform-anchor.json`'s `threat_model_note`.**
      It states `bypass_actors` carries
      `{actor_type: RepositoryRole, actor_id: 5, bypass_mode: always}` and
      `current_user_can_bypass: always`. Both are history since 12:51; the live
      values are `[]` and `never`. The owner question the note records is
      unchanged and stays open. Give the retained reading an inline date rather
      than leaving it present-tense.
      verify: `gh api repos/event4u-app/agent-config/rulesets/17749383 --jq
      '{bypass_actors, current_user_can_bypass}'` agrees with what the note
      claims for the date it claims it.

- [ ] **2.2 Write the ratification artifact with `verdict: ratified`.**
      Under `agents/evidence/ratifications/`, providers `anthropic` and
      `openai`, `effective_after: merge`. It supersedes only the
      approval-related portion of `drain-typed-grants-platform-anchor.md`. It
      states the scope in anthropic's terms — the floor is retained as the
      default and exempted here under a named operational choice — and records
      the approval exemption and the `bypass_actors` removal as two separate
      dated changes. Note that the gate counts distinct providers on the
      artifact and checks one top-level verdict; it does not require unanimity,
      so the reason to build the council's shape is the recorded `refused`
      vote, not the gate's arithmetic.
      verify: `./scripts-run src/scripts/check_kernel_edit_ratified
      --base-ref origin/main` exits 0.

- [ ] **2.3 Reconcile `road-to-typed-grants-that-persist.md`.**
      Its `ratification-platform-anchor` blocker instructed a future reader to
      set the two values the owner reversed, and its retained limb-1 paragraph
      is present-tense about a 12:51 state. Both need dating. Its `Blocks:`
      field still says both seats tied the deny retirement to the anchor
      "reading compliant", which the exemption changes to
      compliant-with-approvals-suspended. And its claim that the `bypass_actors`
      item is "done" and its "what may not stand" clause "discharged" closes
      what both seats flagged as open (0.2).
      verify: no line in that blocker asks for a state the live ruleset is
      deliberately not in, and no undated present-tense sentence describes a
      superseded measurement.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The exemption outlives its ground | implementation | The single-operator model ends, or a collaborator is added, and nobody re-raises the floor. The exemption then reads as permanent policy — openai's stated ground for a `refused` vote | Decided in 0.1, because the two seats disagree on whether this can be measured at all. Whatever is chosen, the ground is named in the file as a choice rather than a constraint, so the condition that ends it is legible | Phase 0 — answer the two questions, then sequence |
| 2 | The exemption becomes a general escape | implementation | A later edit widens the suspended set to a threshold or a selector, hollowing out the floor through the door built here | The suspended set is validated against a closed two-element list with a test asserting rejection. `platform-anchor.json` is on `ANCHOR_PATHS`, so the attempt needs its own ratification | Phase 1 — the exemption, fail-closed |
| 3 | A second lockout with no way back | implementation | With `bypass_actors: []` another ruleset mistake re-locks the sole maintainer out of the PR path, as 12:51 did. `admin: true` is a capability, not a rehearsed procedure | 0.2 requires a written procedure executed once against a non-default-branch ruleset. Until that exists this risk is open, and both council seats raised it | Phase 0 — answer the two questions, then sequence |
| 4 | The remaining protection is weaker than assumed | implementation | With approvals suspended and merge-freshness off, one required context carries the load. A required context pins a job name, never the steps inside it | M11 records that an empty context set is already refused. The job-name residual is recorded in `platform-anchor.json`'s own note and is **not** closed here | Phase 1 — the exemption, fail-closed |

## Acceptance Criteria

- [ ] AC-1 — `check_platform_anchor` reports no finding that nobody intends to
      fix. Both open design questions are answered and their answers are in
      this file.
- [ ] AC-2 — `NON_NEGOTIABLE_FLOOR` still carries
      `minimum_approving_reviews: 1` and `require_last_push_approval: true`.
      The floor was suspended by a named exemption, not lowered.
- [ ] AC-3 — An exemption that is stale, malformed, unknown-`reason`, or scoped
      beyond the two approval keys is refused, each case covered by a test that
      has been seen red. A **missing** exemption is green.
- [ ] AC-4 — A test refusing `require_last_push_approval: false` on the
      un-exempted path exists, since none did (M10).
- [ ] AC-5 — A ratification artifact with `verdict: ratified` and two distinct
      providers is committed, naming which part of
      `drain-typed-grants-platform-anchor.md` it supersedes and stating the
      exemption's ground as an operational choice.
- [ ] AC-6 — No undated present-tense sentence in the tree describes a
      superseded platform measurement, and no blocker asks a future reader to
      restore either setting the owner reversed.
- [ ] AC-7 — A tested administrator recovery procedure exists for a
      lockout with `bypass_actors: []`.
