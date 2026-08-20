# Recurring-criticism mechanics

> Depth for the `recurring-criticism` rule — the past-disposition store list, the mechanism-is-the-defect classification, the hardening floor, and the failure-mode catalog.

_No YAML frontmatter, deliberately: every other guideline under `docs/guidelines/`
is frontmatter-less, and a `name:` key here makes the two MCP resource loaders
derive different URIs for the same file — one from the key
(`guideline://recurring-criticism-mechanics`), one from the path
(`guideline://agent-infra/recurring-criticism-mechanics`). That is a
`mcp_parity_smoke` drift, and it only surfaces once `dist/cli/agent-config.js`
is built, so the local suite passes and CI does not._

Depth for [`recurring-criticism`](../../../src/rules/recurring-criticism.md). The
rule carries the obligation; this carries the lookup addresses and the reasoning
that would otherwise be paid in every session — that rule is phrase-triggered, and
a phrase-triggered rule is unconditionally loaded on Claude (the emitter writes no
`paths:` when any non-path trigger is present), so every line in it is a line every
session pays for. This file is read on demand.

## Look it up before re-deriving it

Without a mechanism that forces a reference to the earlier disposition, every
recurrence becomes a fresh investigation even where the answer already exists
<!-- harvest:forced-lookup-of-past-root-causes -->. The stores are fragmented and
only partly queryable, so **name which one you checked**:

| Store | Path | Queryable? |
|---|---|---|
| ADRs + index | `docs/decisions/` + `INDEX.md`, via `adr_cite_check <ADR-NNN>` | yes — status, `review_trigger` state, successors |
| Estate / activation / low-impact dispositions | `agents/decisions/*.yml`, `agents/decisions/low-impact-decisions.md` | yes, closed vocabularies |
| Roadmap dispositions | `agents/roadmaps/{archive,skipped,later}/` | `later/` only; `skipped/` carries its reason as header prose |
| Curated memory | `agents/memory/*.yml` | yes |
| Analysis documents | `agents/evidence/analysis/` | grep only |
| Harvest / borrow ledgers | `provenance/*.jsonl` | yes, but `adopt`/`adapt` only |

**Rejections are the weak spot, and by design.** `provenance/README.md` states that
a `reject` verdict lives in the analysis document rather than a ledger, because
nothing in the tree cites it. So "I found nothing" here means *unstructured prose
was grepped*, never *nothing was decided*. Say which of the two you mean — the
difference decides whether the recurrence is new information or a lookup failure.

## The mechanism is the candidate defect, not the item

Classify what was missing before choosing an artefact — the taxonomy in
[`skill-improvement-pipeline`](../../../src/skills/skill-improvement-pipeline/SKILL.md)
§ Classify the missing component (instruction · source-of-truth · tool · validator ·
permission · sandbox · evaluation · recovery-path) is the one to use, because "add
another rule" is the answer that feels right and is usually wrong.

Then land the learning where it **constrains** the next run, per
[`learning-to-rule-or-skill`](../../../src/skills/learning-to-rule-or-skill/SKILL.md).
A lesson that does not narrow the next attempt produces thrashing rather than
convergence <!-- harvest:unconstraining-lesson-thrashes -->; a learning that lives
only in a reply is not a learning, it is a note.

**Third recurrence of the same class escalates to structure** —
[`decision-review`](../../../src/skills/decision-review/SKILL.md) § Escalation owns
the threshold, and its point is worth restating: a louder restatement of a rule the
agent keeps missing is the one response already known not to work. At that point
the choice is a deterministic gate or deletion, not more prose.

## The hardening floor

Self-improvement loops can regress the artefact they improve
<!-- harvest:self-improvement-can-self-regress -->. Two consequences:

- A hardening change carries the **same evidence bar** as any other change. "We
  learned something" is not a licence, and a mechanism proposed in response to a
  recurrence still needs a measured false-positive rate before it becomes CI.
- It never arrives as a **weakened** gate, a widened allowlist, a lifted Hard
  Floor, or a loosened ratchet. If the only available hardening lowers a floor, the
  recurrence escalates to the owner instead — that transition is owner-reserved per
  [`decision-revisit-gate`](../../../src/rules/decision-revisit-gate.md) § Who
  decides.

## Failure modes

- **Resolving on the count.** "You have said it three times, so you are right" is
  the sycophancy failure with a procedure attached. The count opens the question.
- **Resolving on the count, inverted.** "It is only the second time, so the old
  call stands" — the repetition still shifted the burden of proof.
- **Naming no outcome.** A resolution that does not say which of the three applies
  (decision wrong · never recorded · unreachable) has not resolved anything.
- **Grepping prose and reporting absence.** See the rejection note above.
- **Treating a resemblance as a recurrence.** Mechanism-match runs first; a new
  complaint that tests a different mechanism is a new finding.
- **Hardening the item instead of the mechanism.** Fixing the one instance leaves
  the surface that dismissed it intact, which is what produces the fourth
  recurrence.
- **Writing the learning into the reply.** It has to land in an artefact.

## See also

- [`recurring-criticism`](../../../src/rules/recurring-criticism.md) — the obligation.
- [`decision-revisit-gate`](../../../src/rules/decision-revisit-gate.md) — the other entrance (a lock blocking a change), the five steps, the owner-reserved table.
- [`self-repair-loop`](../../../src/rules/self-repair-loop.md) — the single-occurrence intake and the `occurrences` counter this rule consumes.
