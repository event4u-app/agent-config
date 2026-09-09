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
2. **The platform holds the merge.** Protected branches and required approvals
   are what make a landed artifact mean something. This gate does **not** verify
   them; that is the largest residual and it is recorded as an open blocker on
   `road-to-typed-grants-that-persist` rather than implied away.
3. **The artifact is the durable record.** It is what a later reader opens to
   learn who reviewed what, and on what basis.

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
