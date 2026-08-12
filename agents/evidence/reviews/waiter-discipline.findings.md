# Completion review — waiter discipline in context-hygiene

**Skipped:** no code surface for this completion — the diff is one rule file plus its byte-identical projection and the gate itself measures zero code paths of two changed files, scope 6eeeefeb9708084154be49372be476df8fac5a0d01490b1b396ae24bfcd37d6e, declared 2026-08-12

## Why a skip rather than a review

The change adds one subsection to `src/rules/context-hygiene.md` and regenerates
`dist/agent-src/rules/context-hygiene.md` from it. No script, no hook, no config,
no test, no schema. `check_completion_review` classifies the diff as zero code
paths of two changed files, which is exactly the condition this declaration
covers.

## What replaces a code review here

The rule makes falsifiable claims, and each was checked rather than asserted:

- **The incident is measured, not recalled.** The session that produced this rule
  is the one that committed the failure: a CI wait started roughly 35 background
  commands, a timer and a condition-watcher per round with none cancelled, and
  about fifteen were still live when CI settled. The empty turns they produced
  are in the same transcript as this artefact.
- **The claim that both loop clauses miss it was checked against the rule text
  they live in**, not from memory. `context-hygiene` § Tool Loop Detection keys
  on "same tool … with similar parameters", and `token-efficiency` carries the
  same carve-out; a varying `sleep N` satisfies neither test.
- **The enforcement line claims nothing.** It states `none` and gives the
  structural reason — the hook counts tool calls, and a waiter is
  indistinguishable from any other call at that layer. This matches the honesty
  stance the rule's own header already takes about what its `PostToolUse` slot
  cannot reach.
- **n=1 is stated as n=1.** The rule says so in its own text rather than
  presenting one observation as a rate.

Gates green on this branch: `task preflight` (including `check_condensation`,
which asserts the projection is byte-identical to the rewritten source),
`skill_linter --changed` PASS on the rule, `check_references`,
`lint_hidden_unicode`.

## Standing caveat

A skip declaration is a statement about the diff's surface, not a claim that the
prose is right. The strongest objection to this rule is that a single observation
is thin ground for a new subsection; the counter is that the failure mode is
structural rather than probabilistic — the detectors cannot see it at all, so its
frequency in the record is a measure of what gets noticed, not of what happens.
