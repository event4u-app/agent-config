<!-- evidence-type: analysis -->

# The advisory goes in the ai-council skill, not the always-loaded context

**Date:** 2026-11-21 · **Members:** `anthropic/claude-sonnet-4-5`, `openai/codex-default`
**Mode:** design, 2 rounds, blind chairman · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 concluded · **Question:** `review-convergence-advisory-placement-20261121.question.md` (committed verbatim beside this record)

Executes the placement question of step 1.4 of
`road-to-review-loops-that-converge`. The planned paragraph in
`contexts/authority/kernel-rule-edits.md` failed `check-always-budget`:
`scope-control` (which loads that context) rose from 19,327 to 19,662 against an
allowlisted ceiling of 19,332.

## Seat positions

- **anthropic:** the budget's basis should be examined first; if forced today,
  raise the ceiling provisionally (B). If the ceiling is a hard constraint, take
  indirection (C) rather than deleting provenance (A).
- **openai:** put the advisory in `ai-council`, the skill used to run a
  ratification round, and leave `kernel-rule-edits.md` intact — no pointer
  (a variant of C). Rejects deleting provenance to make room. Asks that the
  text name who may authorise another round and that a failing script leave
  the prior procedure unchanged.

## Outcome

Split between B and C, both rejecting A. The ceiling is an allowlisted
always-budget cap guarding the cached prompt prefix of every request, and
raising it to fit an advisory paragraph is the allowlist growth the repository's
autonomy rules forbid; held as a lock, both seats' answers reduce to C. The
paragraph moved to `src/skills/ai-council/SKILL.md` § Before the next
ratification round, with openai's two conditions written in. Recorded as D6.
