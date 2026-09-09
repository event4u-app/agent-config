---
proposed_by: claude-opus-5/drain-session-2026-09-09
implemented_by: claude-opus-5/drain-session-2026-09-09
reviewed_by: council/anthropic+openai-2026-09-09-r3
providers:
  - anthropic
  - openai
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the ratification mechanism itself

The first artifact under `docs/contracts/ratification-artifact.md`, covering
the change that introduces it. Named for the branch rather than a PR number
because the PR does not exist when the gate first reads this file; a rename to
`<pr>.md` is a later hygiene step and not a contract requirement.

## Scope of this ratification — read this before citing it

```
THIS RECORD COVERS THE ADDITIVE GATE ONLY.
IT IS NOT APPROVAL OF RETIRING `block_kernel_rule_writes.ts`.
THAT REPLACEMENT WAS REFUSED 2/2 AND STAYS REFUSED.
A LATER CHANGE THAT REMOVES THE DENY NEEDS ITS OWN RATIFICATION
AND MAY NOT CITE THIS ONE.
```

Both round-3 reviewers made this an explicit condition of passing. One wrote:
*"pass the additive change, preserve the external-anchor blocker, and
explicitly prohibit treating this ratification as approval of the previously
refused replacement."*

## What is ratified

- `docs/contracts/ratification-artifact.md` and
  `src/scripts/_lib/ratification_artifact.ts` — the artifact contract and its
  single pure reader.
- `src/config/ratification-policy.json` — the in-repo quorum, fail-closed.
- `src/scripts/check_kernel_edit_ratified.ts` — the CI gate, added **alongside**
  the existing tool-call deny.
- Its `ci-fast` entry and its `consistency.yml` step, which runs the **base
  revision's** copy of the script against the head's file list.
- `ratification` added to the evidence-type vocabulary.
- 37 tests across two files.

## Why `confirmed-non-expanding` rather than `ratified`

The change adds a merge-time refusal and removes nothing. Under ADR-268 § 0's
discriminator — *does the change put a person back into the per-step loop for a
reversible operation?* — it puts nobody anywhere new. Reviewer wording:
*"the change doesn't meet the ADR-268 § 0 discriminator … it adds a merge-time
check, which is a different operation."*

Its worst failure mode — a PR editing the workflow step to skip it — returns
the tree to exactly the control it has today. It cannot reach a state weaker
than the status quo.

## How this was reviewed — three rounds, two refusals

| Round | anthropic seat | openai seat | Subject |
|---|---|---|---|
| 1 | `non-convergent` | `refused` | retiring the deny |
| 2 | `refused` | `refused` | retiring the deny, three flaws fixed |
| 3 | `confirmed-non-expanding` | `confirmed-non-expanding` | the additive gate only |

Two enabled providers, so the diversity requirement is met by measurement
rather than by assertion: `agent-config council:status` reports
`members 2 enabled of 5 — anthropic, openai`, and the quorum line after each
run read `2/2 present, needed 1 — concluded`. Nothing was billed; all seats are
subscription-authed.

`reviewed_by` differs from both `proposed_by` and `implemented_by`, which the
reader enforces rather than trusts.

### Round 1 — three flaws, all fixed

1. **Bootstrap.** The gate judged from the PR head, so a candidate diff supplied
   the code that judged it. Fixed: CI materialises the base revision in a
   detached worktree and runs that copy; the quorum policy is read from the
   script's own tree so the same PR cannot lower `required_providers` and have
   the base gate honour it. The gated surface grew from the gate file to the
   whole mechanism.
2. **Provider diversity failed open.** The count came from the user-global
   council config, absent on a runner — the rule printed "unmeasured" and
   passed, on the one surface where it most needed to fire. Fixed: an in-repo
   policy file; missing or unparseable is a refusal.
3. **Unstated trust boundary.** Fixed by stating it, and by naming the layer
   this gate does not carry.

`confirmed-non-expanding` itself is a round-1 proposal, adopted: demanding an
artifact for a typo fix and then labelling it `ratified` is a false record.

### Round 2 — refused on a defect the fixes do not reach

The workflow file that decides **whether** the gate runs lives in the candidate
branch. Running the gate's code from the base closes "the candidate judges
itself" one level down and leaves the level above it open. Closing that needs a
platform-anchored required check — a repository setting, not a diff.

The retirement was therefore **reverted in full**. Net diff against `main` for
`block_kernel_rule_writes.ts`, its test, `hook_manifest.yaml`, `docs/proof.md`
and `docs/threat-model.md` is empty.

Both reviewers also held that the artifact does not replace the 24-hour soak's
elapsed-time property — recorded in the contract's own § What was NOT preserved.

### Round 3 — conditions attached, and where each one landed

| Condition | Where it is discharged |
|---|---|
| Not approval of the refused replacement | § Scope above; contract § This gate is not independently enforceable |
| Never cited as independent enforcement | contract § This gate is not independently enforceable (Iron Law) |
| `confirmed-non-expanding` is a classification, not a weaker authorization class; misclassification is review error | contract § verdict table (Iron Law) |
| Preserve the external-anchor blocker | blocker `ratification-platform-anchor`, open, on `road-to-typed-grants-that-persist` |
| The workflow file is not on the watch list | added — `WORKFLOW_PATH` in the gate, with the honest note that it is one more level and not an anchor |

## What a later reader should check before trusting this

The gate reads paths and artifact shape. It cannot read whether the review
happened, whether `reviewed_by` names a session that ran, or whether the
reviewer was steered. The council transcripts are gitignored and auto-pruned,
which is why the verdicts are quoted here rather than linked. What is
verifiable from the tree: the fixes each round demanded are present, the tests
assert both polarities, and the retirement the reviews refused is absent from
the diff.
