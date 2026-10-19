<!-- evidence-type: analysis -->

# AC-4 of the release-impact roadmap: amend to the shipped `action` wording, or leave it with the owner

**Date:** 2026-10-18 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `release-impact-ac4-wording-20261018.question.md`, beside this file
**Authority:** the owner's delegations of 2026-10-16 and 2026-10-18

## Verdict — split, escalates to the owner

| Seat | Choice | Condition |
|---|---|---|
| `anthropic` | **(3)** leave AC-4 open for the owner | if forced to choose, (1) recorded as a one-time exception, with a note that a council does not ordinarily rewrite an acceptance criterion after implementation |
| `openai` | **(1)** amend and close | only after the amendment's provenance (#2421's council record) and the test evidence are verified; use ordered, precedence-based wording |

Both seats agree the shipped behaviour is right: `action` for an unmet
`engines.node` is a safety distinction, because `ask` means "install on
approval" and a candidate this machine cannot run must have no install path.
They disagree on **who** may change the criterion's text after the fact.
`anthropic`: acceptance criteria define "done" before implementation, and
rewriting one to match what shipped turns it into post-hoc documentation.

A split is an escalation condition (`decision-revisit-gate`), so AC-4 stays
open and goes to the owner. The wording `openai` proposed, ready for the
owner to adopt:

> **AC-4** Over a ≥ 40-case matrix, `classifyUpdate` applies these rules in order:
> 1. A suppressed check or an input without a newer candidate returns `none`.
> 2. Otherwise, an unsatisfied candidate `engines.node` returns `action`, never `ask` or `auto`.
> 3. No input carrying uncertainty — unknown data, missing provenance, or a project pin — returns `auto`.
