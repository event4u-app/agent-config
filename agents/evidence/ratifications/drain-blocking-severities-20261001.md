---
proposed_by: claude-opus-5/drain-blocking-severities-20261001
implemented_by: claude-opus-5/drain-blocking-severities-20261001
reviewed_by: council/anthropic+openai-2026-10-01-blocking-severities
providers:
  - anthropic
  - openai
verdict: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — blocking severities where a refusal can land

Covers the diff executing `road-to-blocking-severities-where-a-refusal-can-land`:
the widened ratification path set (2.1), the widened plumbing deny (2.2), the
served-body fingerprint check (2.3), the published declared-severity /
verified-enforcement reading with its hard generated-row gate (1.1, 1.2), and
the dispatcher's corrected hash rationale (3.1). Named for the branch rather
than a PR number because the PR does not exist when the gate first reads this
file.

## The review

Both seats of a two-provider council reviewed a neutral description of the
change — the four parts, the facts relied on, and an explicit invitation to name
what would have changed the verdict. The prompt stated no expected outcome in
either direction and is committed at
`agents/evidence/analysis/blocking-severities-ratification-prompt.md`.

**Both seats approve the change. They split on the label, and the split is
recorded rather than averaged away.**

- `anthropic/claude-sonnet-4-5` → `confirmed-non-expanding`. Its test is the
  capability envelope of a *governed actor*: after this diff a user, agent or
  attacker can do strictly less — four more file classes need a record, two more
  files cannot be hand-edited, a tampered compiled body is no longer served.
  It argued that counting a widened enforcement scope as authority expansion is
  circular, since adding a ratification requirement would then itself require
  ratification.
- `openai/codex-default` → `ratified`. Its test reads the contract's phrase
  "anyone's authority" literally and includes the enforcement components: the
  gate acquires jurisdiction over four more file classes and the guard acquires
  a refusal power over two more files that it did not previously have. It named
  `ratified` "the safer and more literal classification" and said it would move
  to `confirmed-non-expanding` only if the repository's authoritative definition
  explicitly limited "authority" to governed actors.

## Why the recorded verdict is `ratified`

```
THE SEATS CONVERGED ON APPROVAL AND SPLIT ON CLASSIFICATION.
THE STRICTER OF TWO APPROVING LABELS IS RECORDED, NEVER THE LOOSER.
A LABEL THAT OVER-RECORDS COSTS A READER ONE PARAGRAPH.
A LABEL THAT UNDER-RECORDS IS THE REVIEW ERROR THE CONTRACT NAMES.
```

`non-convergent` would be the wrong reading and is worth saying plainly: that
verdict is for reviewers who do not converge, and these two converged on the
decision — land it — while disagreeing about which word describes it. Recording
`non-convergent` would block a change both reviewers approved.

Between the two approving labels the contract settles the direction rather than
the wording: `confirmed-non-expanding` is "not a weaker authorization class" and
"a misclassified expansion is review error, the label is not an escape hatch".
The only misclassification the contract warns against runs one way — recording
an expansion as non-expanding. `ratified` cannot make that error, and one seat
chose it for exactly that reason. So the ambiguity the other seat identified is
resolved toward the label that is wrong in the harmless direction.

The contract's own definition does not settle whose authority is counted, and
this record does not settle it either. That is an open question, not a thing
this diff may decide for itself.

## What each part does, and what it does not

```
NO EXISTING REFUSAL BECOMES A NON-REFUSAL.
NO THRESHOLD, BASELINE OR CEILING MOVES DOWN.
NO KERNEL RULE FILE IS EDITED.
NO CONCERN, BINDING OR `severity` VALUE CHANGES.
`block_kernel_rule_writes.ts` AND `block_no_verify.ts` ARE UNTOUCHED.
```

- **2.1** adds `dispatch_hook.ts`, `_lib/kernel_rules.ts`, `hook_manifest.json`
  and `host_lowering.json` to `check_kernel_edit_ratified`'s gated set. Four
  file classes that required no record now require one.
- **2.2** adds the two compiled JSON tables to `block_plumbing_writes`'
  `PLUMBING_BUILD_OUTPUTS`, with the compiler command printed in the deny. The
  compiler itself still runs — a test pins that, because a guard that refused
  its own repair path would make the governed file unmaintainable.
- **2.3** adds `body_fingerprint` to both compiled tables and verifies it in
  both readers. An absent field falls through to the YAML source rather than
  being accepted, so the check cannot be skipped by omission. The fall-through
  rather than refusal is the roadmap's recorded D2: the reader is documented as
  slow-never-wrong, and refusing on a mismatch would turn a tamper into an
  outage on every host.
- **1.2** publishes a reading and changes no behaviour. Its new hard check
  applies only to rows of a generated document, never to the population of
  legacy bindings the pre-existing audit counts — that audit stays non-failing,
  deliberately, and both seats of the 1.1 council endorsed keeping the two
  apart.

## What this record does NOT approve

```
THIS COVERS THE FOUR PARTS ABOVE AND NOTHING ELSE.
IT IS NOT APPROVAL OF RETIRING ANY DENY, INCLUDING THE TWO IT WIDENS.
IT IS NOT APPROVAL OF ANY KERNEL-RULE EDIT.
IT IS NOT APPROVAL OF THE GAP-COUNT RATCHET BOTH 1.1 SEATS PROPOSED,
WHICH IS LEFT UNBUILT AND REPORTED AS RESIDUE.
A LATER CHANGE DOING ANY OF THESE NEEDS ITS OWN RECORD AND MAY NOT CITE THIS ONE.
```

## Residual risks the reviewers named, carried forward unresolved

1. **A fingerprint is a consistency check, not authentication.** Both seats said
   so, and both readers' comments now say so in the code: someone who edits a
   compiled body can recompute `body_fingerprint` as easily as the compiler can.
   What 2.3 closes is the partial edit — a hand edit, a bad merge, a truncated
   write. What is aimed at an author is 2.2's deny and 2.1's record.
2. **"Verified enforcement" verifies a slot's capability, not an end-to-end
   refusal.** The published column says a refusal *can* leave the slot
   according to `host_lowering.yaml`; it is not a runtime conformance result,
   and the surrounding document already says a generated table proves agreement
   with the configuration and nothing about a host. Named here so a later reader
   does not credit the new column with more than it carries.
3. **Generated-document completeness.** The gate fails a published row the
   configuration refutes and fails a region that differs from what the
   generators produce. One seat asked for an explicit completeness mechanism
   beyond region equality; region equality is what is shipped, and the gap is
   recorded rather than claimed closed.

## What would have changed the verdict

Both seats named `refused` conditions and none of them hold: a body-fingerprint
failure that still let the altered body execute, a YAML fallback that were less
restrictive than the compiled path, or any existing refusal becoming a
non-refusal. The first two are pinned by tests that were each run RED against a
neutralised mechanism before being accepted; the third is a property of the diff
and is stated in the Iron Law above.
