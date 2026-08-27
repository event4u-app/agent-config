---
complexity: lightweight
review_by: 2026-09-26
---

# Stub: the test-first and existence-question rule clauses

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-27 when
> [`road-to-evidence-gated-change`](../archive/road-to-evidence-gated-change.md)
> was drained. Steps **1.3** and **3.1–3.4** are always-loaded rule clauses that
> cannot land while the standing per-spawn payload sits at its ceiling.
> Outcome state on the parent: **transferred**.
>
> **Transferred, not completed — and the reasoning still ships.** Only the
> always-loaded clauses are deferred.

## Why they did not land — a budget, not a doubt

The clauses were **written, measured, and reverted**. Nothing about their
content is in question.

`check_preamble_payload_budget` enforces a **grace ceiling pinned exactly at
HEAD's measurement**, and its config states the property in its own words:

> "The grace ceiling is set AT the measurement so growth beyond today reds
> immediately while today's total is tolerated."

`origin/main` measures **exactly 138,212** against a grace ceiling of 138,212.
**The headroom is zero**, so any rule growth reds the gate by design.

| What | chars | tokens over |
|---|--:|--:|
| `improve-before-implement` additions | ~1,960 | — |
| `think-before-action` additions | ~580 | — |
| both, measured | ~2,540 | **~490** |

Compression recovered roughly 800 characters — a duplicated verdict sentence the
Iron Law already stated, a restated exception list, and a section whose content
was already in the guideline. **It could not close the gap**: what remained was
obligation surface, not prose, and the point at which shrinking stops being a
saving had been reached.

## The council decision this inherits

**2026-08-26, both seats, convergent on D — fund it by an audited reduction, and
until then do not ship it.** Recorded at
[`preamble-ceiling-vs-new-rule`](../../evidence/council/preamble-ceiling-vs-new-rule.md)
on the sibling branch that first hit this ceiling.

Two dispositions were rejected **by name**, and the reasons bind whoever
promotes this stub:

- **Raising the grace ceiling** — its stated property is that it reds on ANY
  growth, so raising it on an early addition is the precedent that makes it
  inert.
- **Shipping with a red check** — *"a red check that a reviewer must be told to
  ignore is how a gate becomes background noise."*

The standard the promoter must meet, in one seat's words:

> "Any addition to over-budget corpus requires demonstrating it's more valuable
> than existing content, or that existing content is redundant."

## Two roadmaps, one ceiling — and that is the argument for the audit

| Roadmap | Steps | Over |
|---|---|--:|
| `road-to-consumer-repo-reality` | 1.5, 5.1 | ~1,731 tok |
| `road-to-evidence-gated-change` | 1.3, 3.1–3.4 | ~490 tok |

**Two roadmaps in two days were blocked by the same ceiling.** That is not an
argument that the ceiling is wrong — it is the honest measure of what a corpus
sitting exactly at its cap costs: every future instruction fix becomes a funding
problem before it is a correctness one. A promoter should expect a third.

## What already landed, so the promoter does not rebuild it

**The depth ships in full.**
[`existence-question-verdicts`](../../../docs/guidelines/agent-infra/existence-question-verdicts.md)
carries the verdict set (`reuse` · `extract` · `refactor` · `extend` ·
`migrate` · `new`), what a `new` verdict owes as negative evidence, why the
three heavy-check exclusions never buy the cheap question, and why the question
is not routed through the TDD cluster. It was extracted in the same change, so
the reasoning is written down and reachable — a reader loses the always-loaded
reminder, not the argument.

**Everything outside the rule layer ships too**: the TDD skill's mode contract,
the RED-validity taxonomy, the durable RED-run record, the command surfaces and
the ADRs. Only the two rule files were reverted.

## Probe

- **Producer:** a maintainer or agent run that can first fund ~500 tokens of
  project-scope rule payload by an audited reduction.
- **Probe:** does `src/rules/improve-before-implement.md` carry an
  `## The Iron Law` block, and does `check_preamble_payload_budget` measure at
  or below its grace ceiling?
- **Measured 2026-08-27 (transfer-date baseline):** the block does not exist;
  the payload measures 138,210 against a ceiling of 138,212 — two tokens of
  headroom, which is what paying for the sibling-routing clauses in two skill
  descriptions cost.

## Seed content on promotion

1. **Run the audit first.** Both seats asked for it by name and both refused an
   arbitrary deletion. Consolidation and deduplication are the preferred
   sources.
2. **The clauses are recoverable from history** — they were committed and then
   reverted, deliberately, rather than never written.
3. **Take the compressed forms, not the originals.** The ~800 characters removed
   during the attempt were genuine duplication: a verdict sentence the Iron Law
   already stated, a restated exception list, and a section already in the
   guideline. Re-adding the long forms would pay for prose twice.
4. **Two skill descriptions are load-bearing now.** `test-driven-development`
   and `testing-anti-patterns` carry sibling-routing clauses that
   `lint_skill_descriptions` requires, and they were trimmed to the byte to fit
   the same ceiling. Lengthening either one re-opens this blocker.
