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
| `verdict` | `ratified` · `refused` · `non-convergent` | a closed vocabulary; an open one always reads as approval to a grep |
| `effective_after` | `merge`, or an ISO-8601 instant with a timezone | an authority-expanding change is inert until this passes |

The body carries `<!-- evidence-type: ratification -->` and the review itself:
what was proposed, what the reviewer checked, and what would have changed the
verdict.

## Both producer fields are checked against `reviewed_by`

Phase 5.1 names one fixture — `proposed_by == reviewed_by` is rejected. The
Iron Law is wider than that fixture. The party gaining the authority is the
party that proposed the expansion **and** the party that implemented it, so an
artifact reviewed by its own implementer is the same defect wearing the other
field's name. Both are rejected.

## Provider diversity fires on a measured count, never on an assumption

The diversity rule fires only when `agent-config council:status` reports **two
or more** configured members. Where it reports one, the ladder's next rung is
the owner rather than a second session of the same model, and the artifact is
accepted without diversity — with the count recorded, so a later reader can
tell "diversity was unavailable" from "diversity was skipped".

Where the count **could not be established at all**, the rule does not fire and
the gate says so in its output. An unmeasured count is not evidence that
diversity was unavailable, and silently treating it as one would convert a
missing probe into a clearance.

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
model-carried half). What it makes impossible is the shape that was previously
possible: a kernel-rule edit landing with no record at all, and a record whose
reviewer is its own author.

## See also

- **ADR-268 § 4** — the ruling this implements.
- [`evidence-artifact-types`](evidence-artifact-types.md) — the `ratification`
  type row.
- [`kernel-membership`](kernel-membership.md) — the nine rules the gate watches.
- `src/scripts/check_kernel_edit_ratified.ts` — the gate.
- `src/scripts/_lib/ratification_artifact.ts` — the reader.
