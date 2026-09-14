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
  Blocking rather than cosmetic WHEN THIS WAS WRITTEN, and no longer true — corrected
  2026-09-13 rather than left standing, because it is the sentence that justified the file's
  priority. check_platform_anchor runs in taskfiles/ci-fast.yml, so while the drift stood every
  kernel-rule, governance-hook and anchor-path change was refused at pre-push. The waiver
  mechanism then landed: measured 2026-09-13, the gate reports PASS_WITH_ACCEPTED_RISK and
  exits 0, so nothing is refused. What remained was record work. CORRECTED AGAIN 2026-09-14, and in
  both halves, because each had aged into a false present tense. The two roadmaps named above as the
  active set have both left it — road-to-delivery-for-every-host is archived and
  road-to-delivery-on-hook-hosts is parked under later/ — so that sentence is a superseded
  measurement of exactly the kind AC-6 forbids, written into the frontmatter of the file whose own
  criterion forbids it. And the record work did not close this file: AC-7 is open, stays open, and
  is not an agent's to close. The key itself is kept rather than deleted: it is what
  check_estate_count was satisfied by when the file landed, and removing it would re-take a gate
  decision this correction has no business re-taking.
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

## SUPERSEDED for the approval half — 2026-09-10, later the same day

```
THIS ROADMAP PLANS A BOUNDED WAIVER OVER THE TWO APPROVAL DIMENSIONS.
A LATER OWNER RULING REMOVED BOTH DIMENSIONS INSTEAD, AND A DIMENSION
OUTSIDE THE TRUST MODEL IS NOT A WAIVED RULE.
DO NOT BUILD A WAIVER OVER `minimum_approving_reviews` OR
`require_last_push_approval` — THEY NO LONGER EXIST TO WAIVE.
```

The council session quoted above is real and its reasoning held; what changed is
the question. The owner then ruled that a mandatory approving review is not
wanted on this repository at all — one active maintainer, four rarely-available
write accounts, and a PR author cannot approve their own PR — so both dimensions
left `src/config/platform-anchor.json` and `NON_NEGOTIABLE_FLOOR` rather than
becoming exemptions. A second council (same seats, 2 rounds, blind peer review,
2/2) decided that shape, and the owner authorised the policy.

**The mechanism this roadmap designed did land**, and that is why the file stays
rather than being deleted: `accepted_risk_reductions` in
`src/config/platform-anchor.json`, `AcceptedRiskWaiver` / `readWaivers` /
`NEVER_WAIVABLE` / `WAIVER_AUTHORITIES` in `src/scripts/_lib/platform_anchor.ts`,
and the third status `compliant-with-accepted-risk`. It carries exactly one
entry, `arr-2026-09-10-strict-status-checks`, over the one dimension the
repository still considers the safer setting, expiring 2026-12-09.

**What is genuinely still open, and it is not the waiver:** the administrator
recovery procedure the 12:51 edit removed the escape for, plus the owner question
in `threat_model_note`. Both are tracked as the second half of the
`ratification-platform-anchor` blocker on `road-to-typed-grants-that-persist`.

## Goal

`src/config/platform-anchor.json` describes the live ruleset truthfully again,
and it does so without pretending the approval floor still protects anything.

**Restated 2026-09-13, because the original goal below names a mechanism the
owner ruling replaced.** As shipped: the two approval checks are *removed* from
the expectation and from the floor rather than suspended, and the thing a reader
can tell from the file alone is which dimension is knowingly waived
(`strict_required_status_checks`), on what stated ground, by whose authority, and
when the waiver expires — with `check_platform_anchor` refusing a waiver that is
missing a required field, stale, past `expires`, authored by a non-owner
authority, or scoped to any `NEVER_WAIVABLE` dimension.

*Original text, true until the owner ruling of 2026-09-10:* a reader can tell
from the file alone that the two approval checks are suspended, on what stated
ground, and what makes the suspension stop being valid — and
`check_platform_anchor` refuses a suspension that is missing, malformed, stale,
or scoped to any field beyond those two.

## What is measured, so the plan is not built on prose

Every row re-read on 2026-09-10 afternoon. **Rows M1, M6 and M12 were re-measured
on 2026-09-13 and had moved; each carries its own correction below rather than
being rewritten in place, so the reasoning that was built on the old reading
stays legible. M14-M16 are new on 2026-09-13.**

| ID | Fact | Where |
|---|---|---|
| M1 | Six ruleset versions exist on 2026-09-10, not two. `49256548` 12:51 · `49271774` 15:14 · `49272069` 15:16 · `49272180` 15:18 · `49276909` 16:04 · `49277135` 16:06 | `gh api repos/event4u-app/agent-config/rulesets/17749383/history` |
| M2 | The approval reversal is two edits, one field each: 15:14 set `required_approving_review_count` 1 → 0; 15:16 set `require_last_push_approval` true → false. 15:18 changed **only** `strict_required_status_checks_policy` true → false | per-version `/history/<id>` |
| M3 | PR #1988 merged at `2026-09-10T13:17:09Z` = **15:17:09 local** — after the 15:16 edit and one minute *before* the 15:18 version exists. The 15:18 edit is not part of what unblocked it | `gh pr view 1988 --json mergedAt` |
| M4 | 16:04 restored `strict` to `true` and 16:06 returned it to `false`. The restoration was made on the assumption that 15:18 had been a side effect; the owner then stated the intent | `/history/49276909`, `/history/49277135` |
| M5 | `check_platform_anchor` runs in `taskfiles/ci-fast.yml` — in `preflight` and as its own target — and in no workflow. The rulesets endpoint needs the repository `administration` permission, which does not exist as a workflow `GITHUB_TOKEN` scope | `taskfiles/ci-fast.yml`; `.github/workflows/rule-backstops.yml`; `src/config/ci-local-parity.yml` (`local_only`, `token-scope-unavailable`) |
| M6 | *As of 2026-09-10:* `NON_NEGOTIABLE_FLOOR` carries `minimum_approving_reviews: 1`, `require_last_push_approval: true`, `strict_required_status_checks: true`. **Corrected 2026-09-13: none of the three is in the floor today.** The two approval keys were removed by the owner ruling; `strict_required_status_checks` left the floor because a floored dimension is unwaivable by construction, and it is now a baseline expectation under waiver `arr-2026-09-10-strict-status-checks` | `src/scripts/_lib/platform_anchor.ts` |
| M7 | `enforceFloor` is called from **inside** `readAnchorPolicy`, against the narrowed 11-field `AnchorPolicy` struct. It never sees a top-level sibling of `required`, and it has no clock | `src/scripts/_lib/platform_anchor.ts` |
| M8 | A waiver placed inside `required` is refused as `policy-unknown-field`; placed as a sibling it is ignored and the floor still refuses `0`/`false`. Both measured by running `readAnchorPolicy` on the two candidate files | `readAnchorPolicy` |
| M9 | `tests/scripts/platform_anchor.test.ts:170-175` asserts `minimum_approving_reviews: 0` → `policy-below-floor`. `:218-220` asserts `1.5` and `10_000` rejected and `2` accepted — it concerns neither approval field, and `:220` is a positive assertion | the test file |
| M10 | **No test anywhere asserts that `require_last_push_approval: false` is refused by the floor.** Both council seats stated `:218-220` proves it; it does not | `grep` over the test file |
| M11 | `required_status_check_contexts: []` is already refused (`platform_anchor.test.ts:180`, backed by the `minimum_required_contexts` branch), and `platform-anchor.json` already carries `required_status_check_contexts_note` | test file; anchor JSON |
| M12 | *As of 2026-09-10:* `SUPPORTED_ANCHOR_SCHEMA = 1`, and `checkAnchorIdentity` hard-rejects any other value. **Corrected 2026-09-13: it is `2`.** The version moved with the field set — see 1.5 | `src/scripts/_lib/platform_anchor.ts` |
| M13 | The acting account has `admin: true` on the repository, so ruleset administration is possible independently of the PR merge path | `gh api repos/event4u-app/agent-config --jq .permissions` |
| M14 | **Eight ruleset versions exist on 2026-09-13, not six** — M1 counted only through 16:06. Two more landed: `49393554` 2026-09-11 12:32 and `49500777` 2026-09-12 15:05 | `/rulesets/17749383/history` |
| M15 | The 2026-09-11 version added an `OrganizationAdmin` bypass actor with `bypass_mode: always`, **and the 2026-09-12 version removed it again**. Live on 2026-09-13: `bypass_actors: []`, `current_user_can_bypass: never`. So `ADR-276`'s present-tense record of that bypass describes a state reverted the next day | `/history/49393554` and `/history/49500777`, read via `.state.bypass_actors` — the history payload nests the ruleset under `state`, and a top-level `.bypass_actors` jq reads empty on every version, which is a trap worth naming |
| M16 | The live ruleset now requires **two** contexts, not one: `Sync + Generate Tools Consistency` and `Standing payload delta + budget gate`. The expectation names only the first, and that is not a finding — `minimum_required_contexts` is a floor, so a forge requiring more than the expectation satisfies it | `gh api …/rulesets/17749383`; `check_platform_anchor` output |
| M17 | **The gate passes today.** `check_platform_anchor --files src/config/platform-anchor.json` reports `PASS_WITH_ACCEPTED_RISK`, ledger `planned 3 · completed 1 · failed 0`, exit 0. The frontmatter's "blocking drift" premise is therefore spent | run 2026-09-13 |

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

## Open design question 1 — fail-measurable or fail-explicit — ANSWERED 2026-09-13

```
ANSWERED. FAIL-EXPLICIT IS SUFFICIENT, AND THE REASON IS ARCHITECTURAL
RATHER THAN DIMENSIONAL: THE GATE IS A LOCAL CONTROL A HUMAN RUNS (M5),
AND A HUMAN CAN READ PROSE. NO TRIGGER NEEDS MECHANISING.
IF ENFORCEMENT EVER MOVES TO CI, THE ANSWER CHANGES WITH IT.
```

**How it was answered.** The question as posed concerned an exemption over
approver eligibility, which the owner ruling deleted. It was put back to the
council reframed onto the dimension that *did* receive a waiver
(`strict_required_status_checks`), with the reframing itself offered for
challenge. Council 2026-09-13, `anthropic/claude-sonnet-4-5` +
`openai/codex-default`, 2 rounds, blind peer review, subscription transport,
$0.0000, **2/2 present and convergent**. Quorum honesty, in the same terms this
file used for the 2026-09-10 run: the record carries `threshold: 1`, so it is a
degraded-quorum run by configuration, and its `absent_members` names both seats
from a pre-run liveness probe that had no prior exchange recorded for either —
while the same object counts two present and two answered. Both texts are real;
2/2 is the record's own figure, not a claim that the run required two.

- **1a — sufficient.** Both seats: yes. anthropic made M5 load-bearing rather
  than contextual: *"Prose is sufficient because the executor is literate…
  The answer to 1a is 'yes' specifically because of M5. If the enforcement
  architecture changed, the answer would too."* openai: the waiver *"accepts a
  known configuration state rather than relying on an unverifiable claim"* —
  which is the distinction that separates it from the approver-eligibility case.
- **1b — nothing is mechanised.** Both seats. openai priced it: a 30-day median
  collector needs *"workflow-data ingestion, population definitions, storage, and
  local-gate coupling"*, and crossing ten minutes *"does not itself prove strict
  checks are operationally acceptable; it merely prompts a policy reassessment"*.
- **1c — openai answers its own condition: yes.** The recorded `refused` vote
  was conditional on *indefinite* + *self-asserted* + *no invalidation*. The
  landed shape inverts all three — hard `expires` against an injected clock,
  `authority: owner` constrained by `WAIVER_AUTHORITIES`, and an expired waiver
  exiting 1 with `waiver-expired`. openai: *"The original demand for measurable
  approver availability should not be transferred to a waiver whose objectively
  known deviation is already bounded by a hard date."*

**The three caveats both seats attached, recorded rather than dropped** — this is
the part of the answer that is not a ratification:

1. **The enforcement boundary is local and administrator-bypassable.** openai's
   sharpest point, and it is a correction to how this file and its siblings
   describe the gate: *"a voluntarily invoked local check is advisory control,
   especially when the acting account is an administrator"*, and *"an
   administrator may merge without ever invoking it and can modify both sides of
   the comparison"*. Its stated verdict: **do not describe
   `check_platform_anchor` as enforcing repository-wide compliance.** Discharged
   in 2.4.
2. **Prose triggers buy no early warning.** Adequate for correctness, not a
   monitoring signal. Accepted as-is.
3. **The 90-day window was never validated against the triggers it must outlive.**
   anthropic: one trigger is a 30-day rolling median, so the waiver must cover
   30 days of observation plus time to act. 90 days is *probably* enough and
   nobody checked. Recorded as a condition on the next renewal, not fixed here —
   renewal is a fresh decision by contract.

**OVERALL, both seats: RATIFY AS IT STANDS.** anthropic with the three caveats
above; openai *"RATIFY AS IT STANDS; document the local, administrator-bypassable
enforcement boundary explicitly."*

## Open design question 2 — the third floor field — ANSWERED 2026-09-13

```
ANSWERED BY EVENT, AND CONFIRMED BY THE COUNCIL RATHER THAN DECIDED BY IT.
A FOURTH SHAPE SHIPPED THAT WAS NOT ON THE LIST OF THREE, AND BOTH SEATS
RATIFIED IT AS THE ONLY COHERENT ONE. NOTHING HERE REMAINS TO DECIDE.
```

**What shipped, and why it is not one of the three options below.**
`strict_required_status_checks` left `NON_NEGOTIABLE_FLOOR` — necessarily, since
a floored dimension is unwaivable by construction — *stayed* in the expectation,
and became the single `accepted_risk_reductions` entry
`arr-2026-09-10-strict-status-checks`. So the dimension is neither exempted
alongside the approval fields (option 1), nor given a second scoped exemption
(option 2), nor dropped from both floor and expectation (option 3).

- **2a — ratify.** anthropic: the fourth shape is *"not just cleaner than the
  three original proposals — it's the only logically coherent option"*, because
  keeping it in the expectation signals *"this is a real requirement we're
  accepting bounded risk on"* rather than *"we don't care about this
  dimension."* It also checked the boundary neither round-1 seat had:
  `strict_required_status_checks` is correctly **absent** from `NEVER_WAIVABLE`,
  which is what makes the waiver reachable at all. openai: the floor should hold
  invariants, the expectation the desired posture, and
  `accepted_risk_reductions` the temporary difference; the three earlier options
  *"incorrectly treat removed approval requirements and waivable strictness as
  one exemption problem."*
- **2b — record it as answered by event.** Both seats. The policy half closed by
  owner ruling, the mechanism half by the shipped representation plus the schema
  bump; this session confirms the shape rather than choosing it. openai adds the
  one thing that must be recorded rather than left open: the residual limitation
  that *"an administrator can change both policy and forge state while
  enforcement depends on manually running a local control"* — 2.4.

**One correction to the framing below, which the shipped answer makes obsolete.**
The paragraph's premise is that the live state *"sits under the floor in a field
the exemption may not touch, and the gate would report a finding nobody intends
to fix."* Measured 2026-09-13 (M17), the gate reports no finding at all: the
field is no longer in the floor, and the waiver turns the deviation into
`PASS_WITH_ACCEPTED_RISK`. The original text follows for the record.

*Original text, true until the waiver shipped:*
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

- [x] **0.1 Put both open design questions to the council in one session.**
      Question 1 is invalidation (fail-measurable vs fail-explicit), question 2
      is the third field. Supply M1-M13 as measured facts, the owner's cost
      argument as settled, and anthropic's `single-operator-model-by-design`
      framing as the proposed reason. Record the answer in this file.
      verify: a council response exists with both seats present, and this
      section names the chosen shape for each question.
      **DONE 2026-09-13.** One session, both questions, 2 rounds with blind peer
      review, 2/2 present and convergent, $0.0000 (subscription transport). Both
      answers are recorded above under the two question headings, each naming the
      chosen shape. Two departures from the step as written, both deliberate:
      the questions were **reframed** onto the dimension that survived the owner
      ruling, with the reframing itself put to the seats for challenge (openai
      accepted it for the policy dimensions and challenged the word "gate", which
      is caveat 1); and `single-operator-model-by-design` was **not** offered as
      the proposed reason, because it is the reason for an approval exemption that
      no longer exists — the shipped waiver's ground is the measured re-run cost.
      Session files are gitignored and pruned after the retention window, so the
      findings are restated above in full rather than cited by path.

- [ ] **0.2 Establish the administrator recovery path, tested.**
      Both seats raised it and neither proposed one; the earlier draft of this
      roadmap declared it discharged, which it is not. With `bypass_actors: []`
      a future ruleset mistake re-locks the sole maintainer out of the PR path,
      exactly as 12:51 did. `admin: true` is measured (M13) and is a capability
      claim, not a tested procedure.
      verify: a written procedure exists naming the exact command that restores
      a merge path from a locked-out state, and it has been executed once
      against a non-default branch ruleset to prove it works.
      **HALF DONE 2026-09-13, AND THE BOX STAYS OPEN ON PURPOSE.** The written
      half is discharged: `docs/contracts/branch-protection-policy.md`
      § Administrator recovery from a lockout carries a five-step procedure with
      the exact commands, the `enforcement=evaluate` route preferred over a full
      restore, and the `.state` nesting trap that makes a naive history read
      return empty. The **rehearsal** half is not, and cannot be done by an
      agent: every step is an admin API write on repository protection settings,
      which is a Hard-Floor action under `non-destructive-by-default` reserved
      for the maintainer with explicit this-turn confirmation — the same
      reservation `branch-protection-policy.md` § Enforce half already records
      for the sibling write. An agent may write the procedure; an agent may not
      rehearse it. The procedure says so in its own last paragraph rather than
      reading as tested. This is the roadmap's one genuinely externally
      impossible step, it is the only box left open, and it is also tracked as
      the second half of the `ratification-platform-anchor` blocker on
      `road-to-typed-grants-that-persist.md` — so closing this file does not
      drop it.
      **RE-VERIFIED 2026-09-14 and still open, by a run that was sent to close
      it.** Three facts re-measured rather than re-read: the written half is
      present (`branch-protection-policy.md` § Administrator recovery from a
      lockout, five steps, and its own closing paragraph still reads
      *NOT yet rehearsed*); `check_platform_anchor --files
      src/config/platform-anchor.json` exits 0 with `PASS_WITH_ACCEPTED_RISK`;
      and the rehearsal is unchanged in kind — every step is an admin API write
      on repository protection settings. **The `[~]` carry was considered and
      refused, which is worth recording because it is the move that would have
      closed this file.** A `carried-to` / `merged-into` annotation naming the
      sibling roadmap would satisfy `deferralProblems` and let the sweep archive
      this file, and that is the argument against it rather than for it: the
      receiver already carries the remainder in prose, so the carry buys no
      safety it does not already have, while an archived roadmap is a durable
      record that its acceptance criteria were met. AC-7's load-bearing word is
      *tested*, and it is not. Leaving the box open costs a count; closing it
      would file a false completion.

- [x] **0.3 Record that the council's safe sequence was already violated, and
      what follows from that.** The sequence is ratify → deploy reader → test →
      rollback → evidence → expectation. The rollback happened first, on
      2026-09-10 at 15:14 and 15:16. The window the seats warned about is
      therefore open now, and the mitigating fact is M5: the gate is a pre-push
      control, so it blocks the class of change that needs ratification and not
      the repair PR itself. State this rather than re-planning around a
      precondition that has passed.
      verify: this file names the violated step and the reason the window is
      survivable.
      **DONE 2026-09-13, and the outcome is now measured rather than predicted.**
      The violated step is **step 4 of 6, "apply the platform rollback"**, which
      ran first — 2026-09-10 at 15:14 (`required_approving_review_count` 1 → 0)
      and 15:16 (`require_last_push_approval` true → false), before the schema
      was ratified, before an exemption-aware reader existed, and before either
      state had been tested. The window the seats warned about therefore opened
      on 2026-09-10 and is **now closed**, and it was survivable for the reason
      M5 gives: the gate is a pre-push control in `taskfiles/ci-fast.yml`, never
      a workflow, so it blocks the *class of change* that needs ratification and
      never the repair PR itself. The repair could always travel. What the
      window actually cost is one thing and it is worth naming: between 15:14
      and the waiver landing, any kernel-rule, governance-hook or anchor-path
      change was refused at pre-push — which is the drift this file's own
      frontmatter called blocking. Measured 2026-09-13 (M17) the gate exits 0,
      so the cost stopped accruing. The sequence was not re-planned around a
      precondition that had passed, and this entry is that statement.

## Phase 1 — the exemption, fail-closed

```
READ THIS BEFORE THE FIVE STEPS BELOW. PHASE 1 PLANNED AN EXEMPTION OVER
THE TWO APPROVAL DIMENSIONS. THOSE DIMENSIONS WERE REMOVED, NOT EXEMPTED,
SO NO STEP HERE WAS BUILT AS WRITTEN. EACH IS CLOSED AGAINST WHAT ACTUALLY
SHIPPED — THE `accepted_risk_reductions` WAIVER OVER ONE DIFFERENT DIMENSION
— AND EACH SAYS WHICH OF ITS OBLIGATIONS SURVIVED THE CHANGE OF SUBJECT
AND WHICH BECAME MOOT. A STEP CLOSED AS MOOT IS NOT A STEP DONE, AND THE
DIFFERENCE IS STATED PER STEP RATHER THAN AVERAGED AWAY.
```

- [x] **1.1 Teach `readAnchorPolicy` to parse and validate the exemption.**
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
      **CLOSED 2026-09-13 — built, over a different dimension, and the step's
      diagnosis was right.** The step's core claim was that the *reader* is the
      missing piece, and that is exactly how it shipped: `readWaivers` in
      `src/scripts/_lib/platform_anchor.ts` parses and validates the object, and
      the verdict layer consumes it. What survived the change of subject is the
      whole validation contract — every field required, unknown authority
      refused, duplicate `id` refused, unparseable date refused, a waiver over a
      `NEVER_WAIVABLE` dimension refused — and it is stricter than the step asked
      for in one direction that matters: **a refused waiver REDS the verdict**
      rather than merely failing to help, which is the defect the round-2 review
      caught in the first implementation (findings were printed and never
      reached the exit code, so a malformed waiver was strictly *better* than a
      well-formed one). What became moot is the specific field list the step
      named — `reason` vocabulary, `eligible_independent_approvers`,
      `evidence_observed_at`, `revisit_if` — because those describe approver
      eligibility. The shipped equivalents are `failure_mode`, `cost_avoided`,
      `frequency_assumption`, `detection_and_repair`, `residual_protection`,
      `authority`, `decided`, `expires`, `review_triggers`.
      Verified: `npx vitest run tests/scripts/platform_anchor.test.ts` — 57/57
      green, 2026-09-13.

- [x] **1.2 Suspend exactly the two approval checks, nothing else.**
      **CLOSED 2026-09-13 AS SUPERSEDED — and this is the step the whole
      supersession is about, so it is worth being exact.** Nothing was
      suspended. Both approval dimensions were *removed* from
      `src/config/platform-anchor.json` and from `NON_NEGOTIABLE_FLOOR` by owner
      ruling, and a dimension outside the trust model is not a waived rule. The
      instruction below to keep `1`/`true` in the floor is therefore **reversed,
      not merely stale**: acting on it today would re-add exactly what the owner
      deliberately removed. It is kept rather than deleted because the sentence
      that must not be followed is more useful visible than absent, and AC-2 is
      corrected in the same change for the same reason.
      **What survived the change of subject is the scope discipline**, and it
      shipped verbatim: a waiver may not excuse a selector (`enforcement`,
      `target`, `covers_default_branch`), `allow_unconditional_bypass`,
      deletion or force-push — those six are `NEVER_WAIVABLE`, refused by
      construction. **What the shipped shape adds that this step did not ask
      for** is the inverse guarantee the council later made load-bearing: the
      eligible set is bounded by a *committed list*, not by the quality of a
      waiver's prose. Proven sensitive 2026-09-13 by neutralising
      `NEVER_WAIVABLE` — 2 tests go red, including "an unconditional bypass
      stays a failure even with a waiver written for it".
      *Original step text follows; the first sentence is the reversed one.*
      `NON_NEGOTIABLE_FLOOR` keeps `1`/`true` — suspended, never lowered. The
      exemption may not excuse a selector (`enforcement`, `target`,
      `covers_default_branch`), any other threshold, `minimum_required_contexts`,
      or schema validation. **A missing exemption is the normal green path**, not
      a failure — the earlier draft said missing exemptions fail closed, which
      contradicted its own next step. Malformed, over-broad, stale and
      unknown-`reason` exemptions fail closed.
      verify: `npx vitest run tests/scripts/platform_anchor.test.ts` green,
      including 1.4.

- [x] **1.3 Decide and record the invalidation mechanism from 0.1, and build it
      where it can be built.** If `invalidate_on_next_edit` is chosen, note that
      `enforceFloor` has no clock (M7) — any time- or edit-dependence needs a
      source injected, which makes a pure function impure and touches its three
      existing call sites. The earlier draft asserted expiry "is enforced in
      `enforceFloor`"; that is not implementable as the function stands.
      verify: the mechanism exists in code with a test, or this file records why
      it is manual and what the human checks.
      **CLOSED 2026-09-13 — the mechanism exists in code with a test, AND the
      manual half is recorded, because the shipped answer is both.** Decided in
      0.1: **fail-explicit**, with nothing mechanised, 2/2 convergent.
      *In code:* `expires` is hard-enforced — an expired waiver is refused with
      `waiver-expired` and reds the verdict. *Manual:* the `review_triggers`
      array is prose a human reads when running the gate, and what the human
      checks is the four recorded triggers — first attributable stale-base
      conflict, median required-check duration under 10 minutes over 30 days,
      merge-queue tooling removing the re-runs, and the 2026-12-09 expiry.
      **The step's own warning about the clock was correct and was resolved the
      way it predicted.** `enforceFloor` has no clock (M7), so a time-dependent
      check could not live there; the waiver reader takes `now` as an explicit
      injected argument instead, which is what keeps the verdict reproducible and
      is why the gate warns `as-of: unpinned run` when nobody pins it. The
      earlier draft's assertion that expiry "is enforced in `enforceFloor`" was
      wrong, and it is still wrong — expiry is enforced in `readWaivers`.
      Proven sensitive 2026-09-13 by neutralising the expiry comparison: 3 tests
      go red, including "refuses an expired waiver and an unparseable expiry" and
      "a refused waiver REDS the verdict".

- [x] **1.4 Write the test matrix, including the one that does not exist yet.**
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
      **CLOSED 2026-09-13. The matrix exists — 57 tests, green — and three of
      its mechanisms were seen red TODAY rather than on the word of whoever
      wrote them.** The neutralise-and-observe runs, each restored afterwards
      and the suite re-confirmed at 57/57:

      | Mechanism neutralised | Tests that went red |
      |---|---|
      | the `expires` comparison | 3 — "refuses an expired waiver and an unparseable expiry", "a refused waiver REDS the verdict, it does not merely fail to help", "carries the refusal into the unverifiable verdict too" |
      | the `NEVER_WAIVABLE` membership check | 2 — "refuses a waiver over any never-waivable dimension", "an unconditional bypass stays a failure even with a waiver written for it" |
      | the `WAIVER_AUTHORITIES` value check | 1 — "refuses an authority that is not the owner" |

      **The one assertion this step demanded that CANNOT be written, and why
      that is a closure rather than a gap.** Per M10 no test refused
      `require_last_push_approval: false`, and the step required one to be
      written. It cannot be: the field is no longer in `NON_NEGOTIABLE_FLOOR`,
      so there is no floor for it to fall below and a test asserting a refusal
      would assert a behaviour the owner ruling deliberately removed. The
      obligation behind it — *the floor must not silently stop covering a
      dimension* — is met by a different and stronger test that does exist,
      `has no approval field left for a policy to lower`, which pins the absence
      as intentional so a future re-add is a visible test failure rather than a
      quiet drift. AC-4 is corrected in the same change to say this.
      The remaining named cases map onto tests that exist — names quoted from
      `tests/scripts/platform_anchor.test.ts` rather than paraphrased, so the
      mapping is checkable:

      - *a valid waiver permits exactly the waived dimension* → `turns a
        violated dimension into an accepted risk rather than a finding` (:603),
        with its own control `without the waiver the same forge is a plain
        failure` (:612).
      - *a missing waiver is the normal green path* → `treats an absent or
        malformed waiver list as no waivers, never as a pass` (:737).
      - *a stale waiver restores the dimension* → `reports a stale waiver rather
        than passing a platform that outgrew it` (:776) and `reports a waiver the
        forge has made unnecessary` (:672).
      - *malformed / typo / duplicate / bad date rejected* → `refuses a waiver
        that waives nothing, a typo, a duplicate and a bad date` (:722).
      - *the committed waiver is itself in scope* → `the committed waiver is
        well-formed and covers only a waivable dimension` (:748), which is the
        one that would catch a future over-broad edit to the shipped file.

      The topology case is moot with approver eligibility out of the trust model.

- [x] **1.5 Decide the schema version.** The exemption is a new structural
      top-level field while `SUPPORTED_ANCHOR_SCHEMA = 1` and
      `checkAnchorIdentity` rejects any other value (M12). Unknown-field
      rejection is scoped to `required`, so it happens to pass — but "happens to
      pass" is an unmade decision, and the code comment says a bump lands with
      the reader that understands it.
      verify: this file states bump-or-not and why.
      **CLOSED 2026-09-13: BUMPED, 1 → 2, and the step's reasoning is why.**
      `SUPPORTED_ANCHOR_SCHEMA = 2` (M12, corrected). The step's objection was
      that unknown-field rejection is scoped to `required`, so a new top-level
      field "happens to pass" — and that "happens to pass" is an unmade decision.
      That is precisely the argument the bump settles, and it was not the only
      reason to bump: the field set **changed in both directions** in one edit —
      two approval keys left `required` and `accepted_risk_reductions` arrived —
      so a reader pinned to schema 1 would have been handed a differently-shaped
      object under an unchanged version number. The anchor file's own
      `$comment` records this in those terms: the version moved with the field
      set "rather than leaving a reader to discover the shape had changed under
      a constant number". `checkAnchorIdentity` still hard-rejects any other
      value, so the bump is enforced rather than advisory — verified by the test
      `refuses a schema version its reader does not support` (:288).
      Council 2026-09-13, anthropic, unprompted: the bump is *"semantically
      correct … field-set change = breaking change"*, while noting that
      "it shipped" is not the same as "the version signal is correct" — which is
      what this entry now records.

## Phase 2 — the record

- [x] **2.1 Correct the stale platform measurements in
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
      **DONE 2026-09-13, and it found one more defect than the step predicted.**
      The verify command returns `{"bypass_actors":[],"current_user_can_bypass":
      "never"}`, which agrees with the note. The step's own instruction —
      give the retained reading an inline date — had already been carried out in
      an earlier pass. What had NOT been caught is that the note's *preamble*
      asserted the emptying of `bypass_actors` "held", and M15 shows it did not
      hold continuously: an `OrganizationAdmin` actor with `bypass_mode: always`
      was re-added 2026-09-11 and removed again 2026-09-12. "Held" was the
      convenient reading, not the measured one, and the note now carries the
      gap plus the fact that the dimension has a re-entry history worth
      re-measuring. A second stale claim in the same file was corrected at the
      same time: `required_status_check_contexts_note` called the containing job
      "the ruleset's one required context" when it is one of two since
      2026-09-11 (M16) — the jobs-versus-steps argument is untouched, and the
      expectation naming a single context is still satisfied because
      `minimum_required_contexts` is a floor, not an equality.
      Note for the reader: `src/config/platform-anchor.json` is on
      `ANCHOR_PATHS`, so even a prose-only correction to it reds
      `check_kernel_edit_ratified` without a ratification to point at. Both
      edits are listed in `drain-anchor-owner-ruling.md` § Also ratified by this
      record for exactly that reason. Gate re-run after the edits:
      PASS_WITH_ACCEPTED_RISK, exit 0; `platform_anchor.test.ts` 57/57.

- [x] **2.2 Write the ratification artifact with `verdict: ratified`.**
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
      **CLOSED 2026-09-13 — the artifact exists, is AMENDED rather than newly
      written, and the difference is deliberate.** It is
      `agents/evidence/ratifications/drain-anchor-owner-ruling.md`:
      `verdict: ratified`, providers `anthropic` and `openai`,
      `effective_after: merge`. Writing a *second* artifact for the same
      decision would have split one governance event across two records and left
      a reader to work out which governs; the existing one already covers the
      approval removal and the waiver mechanism, so the 2026-09-13 review and
      the two record corrections are amendments to it.
      What this step asked for and did NOT get, stated rather than glossed: the
      artifact does not contain the literal sentence "supersedes only the
      approval-related portion of `drain-typed-grants-platform-anchor.md`". It
      carries the substance under § Not ratified by this record, and 2.3 puts
      the supersession where a reader of the superseded document will actually
      meet it, which is the sibling roadmap's own blocker. Recorded as a
      deviation so the next reader does not go looking for a sentence that was
      decided against rather than forgotten.
      **One stale claim was found IN the artifact and fixed**: its closing bullet
      said `strict_required_status_checks` "is still enforced by the gate, and is
      therefore the single dimension the anchor now reds on". The waiver that
      same artifact ratifies removed that red. A ratification asserting a red its
      own subject deleted is the worst possible place for that sentence, so it is
      corrected there rather than only noted here.
      The step's own observation about the gate's arithmetic still holds and is
      worth keeping: the gate counts distinct providers and one top-level
      verdict, and does not require unanimity — so the reason to honour the
      council's shape is the recorded `refused` vote, never the gate's counting.
      Verified: `./scripts-run src/scripts/check_kernel_edit_ratified
      --base-ref origin/main` exits 0.

- [x] **2.3 Reconcile `road-to-typed-grants-that-persist.md`.**
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
      **DONE 2026-09-13.** Four edits to the `ratification-platform-anchor`
      blocker, one per clause the step named:
      1. *The limb-1 verdict.* It read "limb 1 is **not met** and the gate
         reports three findings again" in the present tense, and waited on "a
         structured, evidence-carrying exemption". Both halves are now false:
         the gate exits 0, and no exemption over the approval dimensions was
         ever built. The paragraph is dated and the original kept below it.
      2. *The `Blocks:` qualification.* It anticipated compliance becoming
         "compliant-with-approvals-suspended". The real weakening is larger —
         the dimensions are out of the trust model altogether — so the
         qualification is restated to say the precondition is **materially
         weaker** than the seats assumed, not merely differently worded, and
         that this entry settles it even less than before.
      3. *The recovery path.* Recorded that 0.2's written half landed in
         `branch-protection-policy.md` and that the rehearsal is Hard-Floor and
         therefore agent-impossible, so the remainder rides on this blocker
         rather than being dropped when the waiver roadmap closed.
      4. *The bypass history.* "`bypass_actors: []` … still hold" is true of
         today and not of the interval (M15), and the "six versions" count is
         correct for 2026-09-10 and is eight as of 2026-09-13 (M14). Both dated.
      The two clauses the step expected to still be wrong were already correct
      and were left alone, which is worth recording so a later reader does not
      re-fix them: the `What to do` field already says items 1 and 2 were "ruled
      out of the trust model entirely" and that instructing a reader to restore
      them "would mutate the live ruleset against a recorded ruling", and the
      `What is NOT discharged` paragraph already refuses to call the
      `bypass_actors` item done. Verified: no line in the blocker now asks for
      `required_approving_review_count >= 1` or `require_last_push_approval:
      true`.

- [x] **2.4 Write down the enforcement boundary the review insisted on.**
      Not in the original plan; added 2026-09-13 because it is the one change
      the council's answer to 0.1 *required* rather than merely permitted.
      openai's verdict was explicit: **do not describe `check_platform_anchor`
      as enforcing repository-wide compliance.** It is a locally invoked
      pre-push control (M5) that an administrator may skip, and the acting
      account holds `admin: true` (M13), so the same party can modify both the
      committed expectation and the forge state it is compared against. Three
      surfaces were describing it as more than that:
      `src/config/platform-anchor.json` now carries an
      `enforcement_boundary_note` stating what a green verdict does and does not
      establish, and naming openai's own condition for a stronger claim —
      mandatory execution from an independently controlled environment with
      read-only policy inputs. `src/config/ci-local-parity.yml` said the gate
      checks "that the forge actually requires what the ratification mechanism
      claims it does"; `taskfiles/ci-fast.yml` said it "checks the forge
      actually required anyone to". Both now say *compares the committed
      expectation against the live ruleset*, and both drop the two approval
      dimensions from the list of what is checked.
      The new field is prose alongside the other `*_note` fields and the
      **evaluated** field set is untouched, so `schema_version` stays 2 — the
      1 → 2 bump was for a change in what a reader must understand, which this
      is not. The note says so itself, so the next reader does not have to
      re-derive why no bump accompanied a new top-level key.
      verify: `check_platform_anchor` still PASS_WITH_ACCEPTED_RISK exit 0 with
      the new field present; `check_ci_local_parity` exits 0. Both run
      2026-09-13.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-14 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The waiver outlives its ground | implementation | **CORRECTED 2026-09-14 — the approval exemption this row was written against was never built.** The risk survives, re-pointed at the mechanism that did ship: the waiver `arr-2026-09-10-strict-status-checks` is renewed past its expiry without anyone re-measuring the re-run cost that is its stated ground, and it then reads as permanent policy. *Original, whose premise the owner ruling removed:* "The single-operator model ends, or a collaborator is added, and nobody re-raises the floor" — there is no approval floor left to re-raise | Answered in 0.1 and shipped as a hard `expires: 2026-12-09`, which is the condition that ends it, plus a stated ground a reader can re-measure. `check_platform_anchor` refuses a waiver past its `expires`, so lapsing is loud rather than silent — renewal is the unguarded move, and it needs the cost re-measured | Phase 0 — answer the two questions, then sequence |
| 2 | The waiver becomes a general escape | implementation | A later edit widens the waivable set to a threshold or a selector, hollowing out the floor through the door built here | **CORRECTED 2026-09-14 — the closed two-element list was never built, and a reader auditing this mitigation would have grepped for one and found nothing.** The shipped boundary is `NEVER_WAIVABLE` (six dimensions) plus `WAIVER_AUTHORITIES`, and a waiver scoped to any of the six is refused by a test that has been seen red (AC-3). `platform-anchor.json` is on `ANCHOR_PATHS`, so the widening attempt still needs its own ratification. *Original:* "The suspended set is validated against a closed two-element list with a test asserting rejection." | Phase 1 — the exemption, fail-closed |
| 3 | A second lockout with no way back | implementation | With `bypass_actors: []` another ruleset mistake re-locks the sole maintainer out of the PR path, as 12:51 did. `admin: true` is a capability, not a rehearsed procedure | 0.2 requires a written procedure executed once against a non-default-branch ruleset. Until that exists this risk is open, and both council seats raised it | Phase 0 — answer the two questions, then sequence |
| 4 | The remaining protection is weaker than assumed | implementation | **CORRECTED 2026-09-14 in the reassuring direction, which is why it is corrected rather than left:** approvals are *removed* from the trust model rather than suspended, and M16 measured **two** required contexts, not one — so more carries the load than this row assumed. The residual it names is untouched: a required context pins a job name, never the steps inside it. *Original:* "With approvals suspended and merge-freshness off, one required context carries the load." | M11 records that an empty context set is already refused. The job-name residual is recorded in `platform-anchor.json`'s own note and is **not** closed here | Phase 1 — the exemption, fail-closed |

## Acceptance Criteria

```
TWO OF THESE CRITERIA WERE WRITTEN AGAINST THE EXEMPTION AND ARE NOW
WRONG IN THE DANGEROUS DIRECTION: AC-2 AND AC-4 ASK A READER TO ASSERT
A FLOOR THE OWNER DELIBERATELY REMOVED. THEY ARE CORRECTED IN PLACE,
WITH THE ORIGINAL QUOTED, BECAUSE AC-6 FORBIDS EXACTLY THE INSTRUCTION
THEY CARRIED — AN ACCEPTANCE CRITERION IS THE LAST PLACE A REVERSED
INSTRUCTION SHOULD BE LEFT LYING.
```

- [x] AC-1 — `check_platform_anchor` reports no finding that nobody intends to
      fix. Both open design questions are answered and their answers are in
      this file.
      **Met.** The gate reports no finding at all — `PASS_WITH_ACCEPTED_RISK`,
      exit 0, ledger `planned 3 · completed 1 · failed 0` (M17), with the one
      deviation surfaced as a dated waiver rather than suppressed. Both
      questions are answered above, 2/2 convergent, with the chosen shape named.
- [x] AC-2 — **CORRECTED 2026-09-13. Reads now:** `NON_NEGOTIABLE_FLOOR` carries
      *neither* `minimum_approving_reviews` nor `require_last_push_approval`,
      and that absence is deliberate, recorded, and pinned by a test so a future
      re-add is a visible failure rather than a silent drift. The floor was
      **narrowed by an owner ruling**, not suspended by an exemption — and it
      was narrowed rather than lowered in place, which is the distinction that
      keeps "we do not require this" separable from "we require it and ignore
      it". **Met:** the test `has no approval field left for a policy to lower`
      (`platform_anchor.test.ts:248`) is the pin.
      *Original, and it must NOT be acted on:* "`NON_NEGOTIABLE_FLOOR` still
      carries `minimum_approving_reviews: 1` and `require_last_push_approval:
      true`. The floor was suspended by a named exemption, not lowered."
- [x] AC-3 — A waiver that is stale, malformed, unknown-`authority`, expired, or
      scoped to a `NEVER_WAIVABLE` dimension is refused, each case covered by a
      test that has been seen red. A **missing** waiver is green.
      **Met**, with the scope re-pointed from "the two approval keys" to the
      six `NEVER_WAIVABLE` dimensions, which is where the boundary actually
      lives. Three mechanisms were neutralised on 2026-09-13 and observed red
      (6 tests total, table in 1.4), each restored with the suite back at 57/57.
      The missing-waiver-is-green half is `treats an absent or malformed waiver
      list as no waivers, never as a pass` (:737).
- [x] AC-4 — **CORRECTED 2026-09-13. Reads now:** a test pinning the *absence*
      of both approval dimensions from the floor exists, since the test M10
      asked for cannot be written.
      **Why it cannot:** a test refusing `require_last_push_approval: false`
      would assert a floor behaviour the owner ruling removed — it would fail
      today, and making it pass would mean re-adding the dimension. The
      obligation behind M10 was never "refuse this value"; it was *the floor
      must not silently stop covering a dimension*. That is met, and met more
      strongly, by `has no approval field left for a policy to lower` (:248),
      which turns a future re-add into a red test.
      *Original:* "A test refusing `require_last_push_approval: false` on the
      un-exempted path exists, since none did (M10)."
- [x] AC-5 — A ratification artifact with `verdict: ratified` and two distinct
      providers is committed, stating the ground as an operational choice.
      **Met** by `agents/evidence/ratifications/drain-anchor-owner-ruling.md`
      (`ratified`, `anthropic` + `openai`, `effective_after: merge`), amended
      2026-09-13 with the confirming review and the two record corrections.
      **One clause deliberately not met, recorded in 2.2:** the artifact does
      not carry the literal sentence naming which part of
      `drain-typed-grants-platform-anchor.md` it supersedes. The supersession is
      instead written into the sibling roadmap's own blocker (2.3), where a
      reader of the superseded document meets it. `check_kernel_edit_ratified`
      exits 0.
- [x] AC-6 — No undated present-tense sentence in the tree describes a
      superseded platform measurement, and no blocker asks a future reader to
      restore either setting the owner reversed.
      **Met for every definitely-stale finding of a tree-wide sweep run
      2026-09-13**, which is a stronger claim than "I fixed what I noticed" and
      a weaker one than "the tree is clean". Corrected: the ratification
      artifact's own closing bullet; `platform-anchor.json`'s
      `threat_model_note` and `required_status_check_contexts_note`;
      `branch-protection-policy.md`'s bypass row, required-context row and
      "admin bypass deliberately not used" sentence;
      `src/config/ci-local-parity.yml`; `taskfiles/ci-fast.yml`;
      `ADR-113`'s verified-facts bullet; `ADR-276`'s present-tense bypass
      paragraph; `road-to-typed-grants-that-persist.md`'s blocker;
      `road-to-adversarial-verification-and-long-runs.md`;
      `road-to-decision-closure.md`; `road-to-bus-factor-external-actions.md`;
      and this file's own frontmatter, Goal, M6, M12, AC-2 and AC-4.
      **What was deliberately NOT edited, so the limit is legible:** archived
      roadmaps under `agents/roadmaps/archive/`, and dated historical records
      that already carry their date or a SUPERSEDED marker — a correctly dated
      record is correct, and re-dating it would be churn.
      **THE SWEEP MISSED ITS OWN FILE, in two places, found 2026-09-14 and
      closed in the same change.** The list above names this file's frontmatter,
      Goal, M6, M12, AC-2 and AC-4 — and not its Risk Register, which carried
      three rows written against the exemption that was never built. Row 2's
      mitigation claimed a *closed two-element list with a test asserting
      rejection*: a reader auditing the boundary would have grepped for that
      list and found nothing, because the shipped boundary is `NEVER_WAIVABLE`
      plus `WAIVER_AUTHORITIES`. Row 4 said *one required context carries the
      load* where M16 in this same file measures two. Row 1 named the
      single-operator model as the ground of a waiver whose ground is the
      measured re-run cost. The frontmatter's `estate_offset_exempt` still named
      two roadmaps as *the two roadmaps the gate counts as active* when one is
      archived and one is parked under `later/`. All four are corrected in place
      with the original quoted, and the marker date moved to 2026-09-14.
      **What this does to the criterion's own wording:** "Met for every
      definitely-stale finding of a **tree-wide** sweep" was the claim, and a
      sweep that skipped the register of the file it was run from was not
      tree-wide. The criterion stays `[x]` because the findings are now closed,
      not because the 2026-09-13 sweep was complete — and the miss is recorded
      here rather than quietly patched, since a self-applied criterion that
      cannot see its own file is the one failure mode worth leaving legible.
- [ ] AC-7 — A **tested** administrator recovery procedure exists for a lockout
      with `bypass_actors: []`.
      **NOT MET, and this is the roadmap's one open item.** The procedure is
      written (`branch-protection-policy.md` § Administrator recovery from a
      lockout, five steps with exact commands); the word in this criterion that
      is not satisfied is **tested**. Rehearsing it is an admin API write on
      repository protection settings — Hard-Floor under
      `non-destructive-by-default`, maintainer-only with explicit this-turn
      confirmation — so no agent can close it. Tracked on beyond this file as
      the `ratification-platform-anchor` blocker of
      `road-to-typed-grants-that-persist.md`, whose own text says that blocker
      *now carries the remainder* — so the obligation is live in the estate
      whatever this file's status is.
      **Re-verified 2026-09-14: still not met, and deliberately not carried.**
      See 0.2 for why a `[~]` carry was refused rather than overlooked.
