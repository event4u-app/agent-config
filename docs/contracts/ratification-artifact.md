# The ratification artifact

The record that makes ADR-268 § 4 falsifiable. Written by
`road-to-typed-grants-that-persist` Phase 5.1; read by
`src/scripts/check_kernel_edit_ratified.ts` and by
`src/scripts/_lib/ratification_artifact.ts`, which is the single reader both
the gate and its tests import.

## What it is for

ADR-268 § 4 supersedes ADR-255 § 4's four refusals. Kernel rules, governance
hooks and authority schemas **may** be edited inside an authorised mission. The
control that replaces the refusal is not a permission check — it is a record:

```
AN AGENT MAY MODIFY ITS CONSTITUTION. IT MAY NOT RATIFY ITS OWN INCREASE IN POWER.
THE PARTY GAINING THE AUTHORITY IS NEVER THE PARTY RECORDING THE RATIFICATION.
PROVIDER DIVERSITY IS REQUIRED WHERE TWO PROVIDERS ARE CONFIGURED.
```

## Where it lives

`agents/evidence/ratifications/<slug>.md` — one file per change, in one
directory, because the gate has to find the artifact from the diff alone and a
search over the whole evidence tree would match a file that merely mentions the
word. The gate reads the directory, never the filename.

**This used to say `<pr>.md`, named for the PR number, and every artifact ever
written here deviated from it** — three of three by 2026-09-10, which a blind
review counted. The convention was unpracticable rather than unpractised: the
artifact has to exist before the pull request does, because the gate reads it on
the first push, so a PR number is not available at write time. The first artifact
recorded that in its own body and named itself for its branch instead. Corrected
in the direction of what the mechanism allows, rather than leaving a rule nobody
could follow and everybody broke.

## Frontmatter — all six fields required

| Field | Value | Why it is required |
|---|---|---|
| `proposed_by` | the session or agent that proposed the expansion | one half of "the party gaining the authority" |
| `implemented_by` | the session or agent that wrote the diff | the other half — see § Both producer fields |
| `reviewed_by` | the independent party that reviewed it | must differ from both of the above |
| `providers` | the provider ids consulted, as a YAML list or an inline `[a, b]` | diversity is counted over this |
| `verdict` | `ratified` · `confirmed-non-expanding` · `refused` · `non-convergent` | a closed vocabulary; an open one always reads as approval to a grep |
| `effective_after` | `merge`, or an ISO-8601 instant with a timezone | an authority-expanding change is inert until this passes |

`ratified` and `confirmed-non-expanding` let a diff land; `refused` and
`non-convergent` do not. The second passing verdict exists because the gate
demands an artifact for **every** kernel and governance-hook diff, a typo fix
included — and recording a typo fix as a ratification of an authority
expansion would be a false record. A vocabulary that forces a false label is a
vocabulary people route around, which is the pressure that eventually weakens
the gate.

```
`confirmed-non-expanding` IS A CLASSIFICATION, NEVER A WEAKER AUTHORIZATION CLASS.
IT CARRIES THE SAME INDEPENDENCE AND PROVIDER-DIVERSITY BAR AS `ratified`.
A MISCLASSIFIED EXPANSION IS REVIEW ERROR — THE LABEL IS NOT AN ESCAPE HATCH.
```

Both passing verdicts run through identical validation and differ only in what
they record. Stated as an Iron Law because the round-3 review passed the
verdict on exactly this condition: the reviewer's judgement about whether a
change expands authority must clear the same bar as any other judgement they
make, and a reviewer who labels an expansion `confirmed-non-expanding` has made
an error, not used an option.

The body carries `<!-- evidence-type: ratification -->` and the review itself:
what was proposed, what the reviewer checked, and what would have changed the
verdict.

## Both producer fields are checked against `reviewed_by`

Phase 5.1 names one fixture — `proposed_by == reviewed_by` is rejected. The
Iron Law is wider than that fixture. The party gaining the authority is the
party that proposed the expansion **and** the party that implemented it, so an
artifact reviewed by its own implementer is the same defect wearing the other
field's name. Both are rejected.

## This gate is not independently enforceable, and must not be cited as if it were

```
THE GATE ADDS A REFUSAL. IT DOES NOT ADD AN ANCHOR.
IT RUNS BECAUSE A WORKFLOW STEP IN THE CANDIDATE BRANCH INVOKES IT.
NEVER CITE IT AS INDEPENDENT ENFORCEMENT, AND NEVER AS GROUNDS
FOR REMOVING THE TOOL-CALL DENY IT SITS BESIDE.
```

Both round-3 reviewers passed the additive gate on this condition and named it
in their own words — *"must not be represented as independently enforceable or
as justification for later removing the existing deny"*. The gate ships
**alongside** `block_kernel_rule_writes.ts`, not in place of it; the
replacement was refused 2/2 in round 2 and stays refused until the blocker
`ratification-platform-anchor` is closed by an owner decision. A later change
that removes the deny needs its own ratification and cannot cite this one.

## Where the trust actually comes from

```
THE ARTIFACT IS A RECORD OF WHO DECIDED. IT IS NOT PROOF THAT THEY DECIDED.
THE TRUST ANCHOR IS THE BASE REVISION PLUS THE PULL-REQUEST PLATFORM —
NEVER THE ARTIFACT'S OWN STRINGS.
```

Stated because the first review round refused an earlier version of this
contract for leaving it unstated, and both reviewers independently named the
same gap: `reviewed_by`, `proposed_by` and `providers` are editable text, so a
gate that reads only those checks the **format** of the Iron Law rather than
the Iron Law. Three layers carry the actual trust, and each is named with what
it does and does not cover:

1. **The judging code comes from the base revision.** CI materialises the base
   in a detached worktree and runs *that* copy of
   `check_kernel_edit_ratified.ts`, pointed at the head tree for the changed
   files and the artifact. A candidate diff therefore cannot supply the code
   that judges it. The quorum policy is read from the script's own tree for the
   same reason — otherwise the same PR could lower `required_providers` and
   have the base gate honour it.
2. **The platform holds the branch, and deliberately not the reviewer.**
   `check_platform_anchor` reads the live rulesets and compares them against
   `src/config/platform-anchor.json`, so what the forge enforces is measured
   rather than assumed. What it enforces here is branch integrity — an active
   ruleset over the default branch, deletion and force-push blocked, review-thread
   resolution required, strict required checks, the context that carries the
   ratification gate, no unconditional bypass actor. It does **not** include an approving review, by
   owner ruling; see the next section, which states exactly what a green anchor
   is and is not evidence of. Read that before crediting this layer with
   anything.
3. **The artifact is the durable record.** It is what a later reader opens to
   learn who reviewed what, and on what basis.

### What a green platform anchor does and does not establish

```
A GREEN ANCHOR PROVES THE OBSERVED PLATFORM CONFIGURATION MATCHES THIS
REPOSITORY'S DECLARED, MECHANICALLY TESTED BASELINE AT THE TIME CHECKED.
IT PROVES NOTHING ELSE. IT DOES NOT PROVE INDEPENDENT APPROVAL, SEPARATION
OF DUTIES, PROTECTION AGAINST ADMINISTRATOR ACTION, OR THAT THE BASELINE
ITSELF WAS INDEPENDENTLY AUTHORIZED. DO NOT CITE IT AS ANY OF THOSE.
```

**This repository does not require an approving review, by owner ruling of
2026-09-10, and that is a trust-model choice rather than a gap.** One
maintainer is active; four other accounts hold write access and are rarely
available, so a mandatory approval is a stop rather than a control. The two
approval dimensions were therefore removed from the anchor's enforced set and
from its non-negotiable floor — **not** waived as exceptions, because a
dimension outside the trust model is not a suspended rule. Full record,
including who may do this again and on what evidence:
`owner_ruling_2026_09_10` in `src/config/platform-anchor.json`.

**The vocabulary this contract may no longer use**, because each of these
would now be false: *independent approval* · *separation of duties* · *no
unilateral governance changes* · *administrator-resistant* · any claim that a
green anchor proves council participation.

**What independence actually rests on here — three parts, only one mechanical:**

1. **Mechanical integrity.** The base-revision gate runs the base's copy of
   `check_kernel_edit_ratified`, so a candidate diff cannot supply the code that
   judges it, and the quorum policy is read from the same side. This part is
   real and enforced.
2. **Analytical independence.** The AI council is a different party from the
   implementer and its verdicts are recorded verbatim. It is **not**
   platform-enforced, it has no binding authority over the owner, and a
   committed council record is evidence rather than authorization — the same
   actor that edits the code could write it.
3. **Owner authorization.** Real, and the owner is also the party gaining the
   authority. This is not separation of powers and must never be described as
   such.

Together these prevent *accidental* weakening, create an *audit trail*, and
supply *recorded multi-perspective review*. They do not constrain a determined
administrator, and the mechanism cannot: the same account controls the verifier,
its expectation file, the required contexts and the platform ruleset.

**One limitation stated rather than hidden:** the verifier cannot authenticate
that an owner ruling was given or correctly transcribed. It can only verify that
a governance-labelled change was made and merged. An agent's transcription of a
chat message into a floor reduction is not something any gate here can check —
which is why the authorising event is the owner's own review and merge of a
conspicuously labelled trust-model change, and never the transcription itself.

### Emergency use, and what does not qualify

The owner can bypass any gate here; the platform cannot prevent it. So this
procedure is **detective and restorative, not preventive** — its job is that a
bypass leaves a trace, not that it be impossible.

1. **Trigger:** an active incident where an enforced control blocks time-critical
   restoration or containment. Ordinary work, release pressure, convenience, and
   *"the check is red"* are **not** emergencies.
2. **Record** — before acting if feasible, immediately after if not: the
   incident, the control changed, the reason, the affected revision, the
   timestamp.
3. **Change the smallest thing** that unblocks the incident.
4. **Restore** the control as soon as the incident permits.
5. **Verify** with `check_platform_anchor` after restoration and attach the
   result to the incident record.
6. **Commit** the record. An unrecorded bypass is the only failure mode this
   procedure can actually have.

### The measurement this section was written from

```
                                   before      written 10:51Z   now
required_approving_review_count     0           1                0
require_last_push_approval          false       true             false
required_review_thread_resolution   true        true             true
strict_required_status_checks       true        true             false
bypass_actors                       1           0                0
```

`required_review_thread_resolution` is in the table because a blind review
pointed out that it was the one dimension the evaluator still enforced whose
live value nothing here had measured — so a claim about which dimensions fail
rested on an unread field. Measured: true, throughout. It is enforced, satisfied,
and covered by no waiver.

`repos/{owner}/{repo}/branches/main/protection` returns **404** — this
repository uses repository **rulesets**, so a checker written against the
classic endpoint measures nothing. The emptied `bypass_actors` held;
`current_user_can_bypass` went `always` → `never` and stayed there.

### `strict_required_status_checks` is waived, not failing and not removed

The owner ruled on it separately, later the same day, and the reasoning is a cost
trade-off rather than an impossibility:

> *"It is fine by me if 3 branches were green, then I want to be able to merge
> all 3 without updating them. If something breaks in the process, I can fix it
> afterwards. But that happens too rarely. And the other way currently costs me
> too much time, because after every update all the checks have to run again."*

That falls on the other side of the boundary the approval ruling was recorded
under — *"legitimate only where the operating model cannot satisfy the floor,
never where waiting is merely inconvenient"* — so it was not folded in with it.
The council replaced the boundary rather than stretching it, and gave the
mechanism a third state:

> A baseline control may be waived only when the repository cannot reasonably
> satisfy it, **or** when the accountable owner explicitly accepts a specific,
> bounded risk in exchange for a documented and material operational benefit.
> Every waiver must identify the failure mode, supporting evidence, scope,
> authority, review trigger, and expiry or renewal date. Convenience or
> preference alone is insufficient.

So `strict_required_status_checks` stays a **baseline expectation** with an
active waiver, and the gate reports `PASS_WITH_ACCEPTED_RISK` — exit 0, with the
accepted risk, its authority, and its expiry named in the output. It is neither a
silent pass nor a red. The waiver is `arr-2026-09-10-strict-status-checks` in
`src/config/platform-anchor.json`, it expires **2026-12-09**, and renewal is a
fresh decision with refreshed measurements rather than an extension.

**What this specifically does not prove, and the gate says so in its own
output:** that a change composes with the current base. A required status check
certifies the commit it ran on. With strictness waived, two independently green
branches may merge from stale bases and interact to break the result, and the
staleness is not bounded to one commit.

**What stops the waiver list becoming an exemption registry** — the failure both
council seats named: eligibility is bounded by a committed `NEVER_WAIVABLE` list
in code rather than by the quality of a waiver's prose; every field is required
and an incomplete waiver is *refused* rather than honoured, so the dimension it
names reds normally; an expired waiver is not honoured; and a waiver for a
dimension the forge already satisfies is reported as stale. A malformed waiver is
worse than no waiver, never better.

**The floor is now two tiers, and calling it otherwise would be false.** Six
dimensions are hard — enforcement, target, default-branch coverage,
unconditional bypass, deletion, force-push. The rest are baseline expectations a
complete, unexpired, owner-authorised waiver may trade against a documented
benefit.

The readings themselves are in § The measurement this section was written from,
above, and are not repeated here — they were, and the duplicate said something
the rest of this file no longer says. What that earlier copy framed as three
findings is now one finding, one owner ruling and one waiver: the 404 stands and
is why a classic-endpoint check would measure nothing; the zero approving reviews
are a recorded trust-model choice rather than a gap; and the unconditional bypass
was removed and is the only one of the three that was ever a defect this
mechanism could act on.

One clause that a first reading of this gap gets wrong, corrected here because
it changes what a fix has to do: **the ratification gate IS a required status
check, transitively.** `check_kernel_edit_ratified` runs as a step inside the
job `Sync + Generate Tools Consistency`
(`.github/workflows/consistency.yml:811-825`), and that job's context is the
ruleset's one required check. What a required context pins is the job's
reported *name*, never the steps inside it — so a candidate branch may delete
the step and the job still reports the same context, green. That is the defect
the round-2 ratification review refused the deny-retirement over. It is
necessary and not sufficient, and neither `check_platform_anchor` nor anything
else in this tree closes it.

**Whether repository administrators are inside the threat model is ANSWERED, as
of 2026-09-10: they are the root of trust, by owner ruling.** The owner is the
one active maintainer and a mandatory approving review would be a stop rather
than a control, so the approval dimensions left the anchor's enforced set
entirely. This contract therefore no longer claims protection against unilateral
administrator action anywhere — see § What a green platform anchor does and does
not establish for the vocabulary that is now forbidden, and § Emergency use for
the audited procedure the answer obliges. The ruling is recorded in
`owner_ruling_2026_09_10` in `src/config/platform-anchor.json`; the superseded
`threat_model_note` beside it is kept because a superseded record reads
differently from a deleted one.

One half of that note still stands and is still enforced: an unconditional
bypass actor remains a **failure**, and it is on the list no waiver may reach.
The owner's ruling removed the approval requirement, not the bypass rule, and
the emptied `bypass_actors` held through the later revert of the two approval
dimensions.

### Re-measured 2026-09-10, afternoon — one of those three readings is now history

> **This whole section is itself now a dated reading, and two of its
> present-tense claims are superseded by § `strict_required_status_checks` is
> waived, not failing and not removed above.** It was written while the gate
> exited 1 on three findings; the gate now exits **0** with
> `PASS_WITH_ACCEPTED_RISK`, because the two approval dimensions left the
> enforced set entirely by owner ruling and `strict_required_status_checks`
> gained a bounded waiver. It stays as written for the same reason the block it
> corrects does: it records the measurement the later decisions were taken
> against. Read its verdict sentences with that date attached.

The block above is a **dated** reading and stays as written. It was true at
08:26 (commit `6bab400a8`) and it is not a complete description of the current
state; rewriting it would destroy the evidence that the anchor was built
against a measured failure. What follows is the later reading, recorded beside
it rather than over it.

**Which of its three bullets moved, precisely — because only one did.**
Bullet 1 (`branches/main/protection` → 404, rulesets in use) still holds.
Bullet 2 (`required_approving_review_count: 0`, `require_last_push_approval:
false`) went to `1`/`true` at 12:51 and **back to `0`/`false` the same
afternoon**, so it reads true again — by owner decision now rather than by
neglect, which is the part that changed. Bullet 3 (`bypass_actors` carrying
`{RepositoryRole 5, always}`) is history: it is `[]`, and
`current_user_can_bypass` is `never`.

**Six versions of ruleset `17749383` exist on 2026-09-10, not two.** All
reproducible from
`gh api repos/event4u-app/agent-config/rulesets/17749383/history`, and each
edit changed one field:

| At | Version | What changed |
|---|---|---|
| 12:51 | `49256548` | `required_approving_review_count` 0 → 1 · `require_last_push_approval` false → true · `bypass_actors` `{RepositoryRole 5, always}` → `[]` |
| 15:14 | `49271774` | `required_approving_review_count` 1 → **0** |
| 15:16 | `49272069` | `require_last_push_approval` true → **false** |
| 15:18 | `49272180` | `strict_required_status_checks_policy` true → **false** |
| 16:04 | `49276909` | `strict_required_status_checks_policy` false → **true** |
| 16:06 | `49277135` | `strict_required_status_checks_policy` true → **false** |

**The 12:51 edit made the repository unmergeable, and the 15:14 and 15:16 edits
are the reversal.** This repository has zero eligible approvers and GitHub does
not permit approving one's own pull request, so
`required_approving_review_count: 1` could not be satisfied; with
`bypass_actors` emptied in the same edit there was no administrator escape
either. PR #1988 measured `mergeable: MERGEABLE`,
`mergeStateStatus: BLOCKED`, `reviewDecision: REVIEW_REQUIRED` with every
required check green, and merged at `2026-09-10T13:17:09Z` — **15:17:09 local,
after the 15:16 edit and one minute before the 15:18 version exists.** So the
15:18 edit is not part of what unblocked it, and an earlier version of this
section said it was.

**One framing correction, because it changes what the record claims.** Calling
the state "structurally unsatisfiable" is the framing the 2026-09-10 council
rejected: GitHub supports outside collaborators, teams and bots, so the
approver count is zero because none has been configured — a deliberate
single-operator model, not an external constraint. The exemption planned below
therefore names an operational choice, and the reversal is an owner decision
under `decision-revisit-gate`'s owner-reserved set.

**Two present-tense claims in this document, and one in
`src/config/platform-anchor.json`, are no longer current state.** They are
bullet 3 of the dated block above and the sentence in the
`HUMAN REVIEW REQUIRED` band that reads "while an administrator role bypasses
unconditionally"; the third is `threat_model_note`. Trust layer 2 is **not**
among them — it makes no bypass claim, it says the anchor measures a failure
and points here. The **owner question** those passages record — whether
administrators are meant to be a deliberate escape hatch — is untouched and
stays open; only the measurement behind it has moved. Correcting the note
inside `platform-anchor.json` is deferred to the roadmap below, because that
file sits on `ANCHOR_PATHS` and a prose fix there needs its own ratification
artifact.

`./scripts-run src/scripts/check_platform_anchor --files src/rules/commit-policy.md`
now exits 1 with three findings, and **all three are intended**. The committed
expectation has not yet followed the platform, so the gate is correctly
reporting a drift the repository knows about.

`approvals-below-minimum` and `last-push-approval-missing` follow from the
unsatisfiable-approval reasoning above. `status-checks-not-strict` is a
separate owner decision with its own cost argument, recorded here because it
first looked like an accident and is not one: `strict_required_status_checks_policy`
lets a stale branch merge without re-running the required checks against the
current base, and the owner has weighed that against what strictness costs on
this repository — several branches are commonly green at once, and requiring
each to be brought up to date re-runs the full check suite on every one of
them, serially. The owner accepts a rare post-merge repair over that standing
cost. It was briefly restored to `true` at 16:04 on the assumption that the
15:18 change had been a side effect, and returned to `false` minutes later
once the owner stated the intent; the round trip is recorded rather than
tidied away, so a later reader does not read the restoration as the settled
state.

The residual is named rather than softened: with strictness off, a green check
on a branch is evidence about that branch's base, not about the trunk it lands
on. Nothing in the tree detects the case where two independently green
branches conflict semantically after both merge.

**Where the gate actually runs, since this matters for what the drift costs.**
It is in `taskfiles/ci-fast.yml`, both in the `preflight` list and as its own
`check-platform-anchor` target — a **pre-push** control, not a CI one, and the
distinction is not cosmetic. No workflow can run it: the evaluator reads
`repos/{owner}/{repo}/rulesets`, which needs the repository `administration`
permission, and that scope does not exist for a workflow `GITHUB_TOKEN` —
actionlint refuses `administration: read` as an unknown scope and none of the
sixteen that do exist grants it. `rule-backstops.yml` carries a comment
recording that refusal in place of a step. Closing it needs a PAT in a
repository secret; that is a human action, tracked as limb 2 of the
`ratification-platform-anchor` blocker.

So the three findings red nothing on an ordinary pull request — the gate fires
only on a diff that already requires ratification and exits before its first
API call otherwise — but they **do** block every future kernel-rule,
governance-hook and anchor-path change at pre-push, which is precisely the
class of change this whole mechanism exists to govern. The drift is therefore
not idle. The in-repository half of the reconciliation was planned in the
`road-to-bounded-approval-floor-waiver` roadmap — named by slug rather than by
path, per `no-roadmap-references`.

**And it did not land in the shape that roadmap planned, which is worth stating
here rather than only there.** The roadmap plans a bounded waiver over the two
**approval** dimensions. A later ruling the same day removed both dimensions
instead — from the expectation and from the floor — on the ground that a
dimension outside the trust model is not a waived rule. The waiver mechanism
did land, over `strict_required_status_checks`, which is the one dimension the
repository still considers the safer setting. So the paragraph above describing
three intended findings describes a state that lasted about three hours; the
current verdict, and the reasoning for the split, are in
§ `strict_required_status_checks` is waived, not failing and not removed.

### The bootstrap exception, which is sound exactly once

The PR that *introduces* the gate has no base copy to be judged by. The
workflow detects this, emits a `::warning::`, and runs the head's own gate —
and in that single case the independence rests entirely on the ratification
artifact and on human review of that PR. Every later kernel PR is judged by
code it did not write.

## Provider diversity fails closed

The required count comes from `src/config/ratification-policy.json`, committed
**in this repository**. That location is the round-1 fix: the previous version
read the count from the user-global council config (ADR-104), which is absent
on a CI runner — so the rule printed "unmeasured" and passed, on the one
surface where it most needed to fire. A control that passes when it cannot
measure is advisory.

If the policy file is missing or unparseable the gate **refuses**. An artifact
must name at least `required_providers` distinct providers. Lowering that
number is itself a governance edit: the policy file is on the gated-surface
list, so it reds the gate without its own ratification.

## The ratification ladder

Per ADR-268 § 4, in order: an independent session or agent → the AI council,
CLI-first → a different provider → the owner. The owner is reached only on
non-convergence, on unavailable diversity for a critical expansion, or on an
owner-reserved dimension.

## What the artifact does NOT decide

Whether the diff is authority-**expanding**. That is a judgement over rule
prose, not a property of the artifact. `check_kernel_edit_ratified` therefore
requires an artifact for **every** kernel-rule or governance-hook diff — a
strictly stronger and mechanically decidable rule — rather than classifying the
diff and being wrong quietly.

## Honest enforcement

The gate reads the artifact's shape and the diff's paths. It cannot read
whether the review actually happened, whether `reviewed_by` names a session
that ever ran, or whether the reviewer was steered
([`evaluator-independence`](../../src/rules/evaluator-independence.md) is the
model-carried half). The platform controls it once did not verify at all are now
read by `check_platform_anchor` — corrected here because this was the last thing
a reader was told on the subject and it had stopped being true. What remains is
narrower: that gate runs pre-push and not in CI, because the rulesets endpoint
needs a token scope a workflow `GITHUB_TOKEN` cannot carry.

What it makes impossible is narrower and real: a kernel-rule edit landing with
no record at all; a record whose reviewer is its own author; a diff that
weakens the judge and is then approved by the weakened judge; and a quorum rule
that silently does not fire because the file it needed was somewhere else.

## What was NOT preserved from the mechanism this replaces

The 24-hour soak is gone and nothing replaces its *elapsed-time* property. The
soak let behavior emerge — a rule that stops firing, a trigger that swallows a
sibling's domain — before the next edit landed and confounded the diagnosis. A
ratification review at T+0 judges intent; it cannot judge what a week of real
sessions would have shown. ADR-268 § 4 makes this a deliberate owner-decided
trade, and both round-1 reviewers were right that calling the artifact a
"replacement" overstates it. It is a different control, chosen over the old one.

## See also

- **ADR-268 § 4** — the ruling this implements.
- [`evidence-artifact-types`](evidence-artifact-types.md) — the `ratification`
  type row.
- [`kernel-membership`](kernel-membership.md) — the nine rules the gate watches.
- `src/scripts/check_kernel_edit_ratified.ts` — the gate.
- `src/scripts/_lib/ratification_artifact.ts` — the reader.
- `src/scripts/check_platform_anchor.ts` — the platform-anchor gate, and
  `src/scripts/_lib/platform_anchor.ts` its pure evaluator.
- `src/config/platform-anchor.json` — the committed expectation the anchor is
  measured against, and the one place its threat-model question is recorded.
