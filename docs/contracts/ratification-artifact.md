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

`agents/evidence/ratifications/<pr>.md` — one file per pull request, named for
the PR number (`1981.md`). One directory, because the gate has to find the
artifact from the diff alone and a search over the whole evidence tree would
match a file that merely mentions the word.

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
   ruleset over the default branch, deletion and force-push blocked, strict
   required checks, the context that carries the ratification gate, no
   unconditional bypass actor. It does **not** include an approving review, by
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
strict_required_status_checks       true        true             false
bypass_actors                       1           0                0
```

`repos/{owner}/{repo}/branches/main/protection` returns **404** — this
repository uses repository **rulesets**, so a checker written against the
classic endpoint measures nothing. The emptied `bypass_actors` held;
`current_user_can_bypass` went `always` → `never` and stayed there.

**`strict_required_status_checks` is the one dimension still failing, and it is
deliberately still enforced.** It read true before this work and false after,
and the owner's ruling covers reviewer availability rather than whether a branch
may merge against a stale base — so it is collateral rather than part of the
decision, and it was left untouched on the forge because approval of a
trust-model change is not authorization to mutate the live ruleset. Restoring it
is one setting and needs no reviewer.

The three facts, from `gh api`, so a reader can re-run them rather than trust
this paragraph:

- `repos/{owner}/{repo}/branches/main/protection` returns **404, "Branch not
  protected"** — classic branch protection is not in use here at all. The live
  surface is `repos/{owner}/{repo}/rulesets`, and any check written against the
  classic endpoint measures nothing.
- The one active branch ruleset covering `~DEFAULT_BRANCH` sets
  **`required_approving_review_count: 0`** and `require_last_push_approval:
  false`. A pull request is required; an *approving reviewer* is not. So a
  ratification artifact can land reviewed by nobody the repository insisted on.
- `bypass_actors` carries **`{actor_type: RepositoryRole, actor_id: 5,
  bypass_mode: always}`**. Every rule above is advisory for that actor.

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

**Whether repository administrators are inside the threat model is unanswered,
and this contract must not pretend otherwise.** If they are a deliberate
root-of-trust escape hatch, that belongs here in writing along with an audited
emergency-use procedure; what may not stand is this document simultaneously
claiming protection against unilateral action while an administrator role
bypasses unconditionally. The question is recorded in `threat_model_note` in
`src/config/platform-anchor.json` and is owner-reserved.

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
model-carried half). It also does not verify the platform controls named in
§ Where the trust actually comes from — that is the open residual.

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
