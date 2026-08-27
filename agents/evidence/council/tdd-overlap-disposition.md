<!-- evidence-type: analysis -->
<!-- evidence-artifact-type: analysis -->

# Council — the TDD ↔ testing-anti-patterns overlap disposition

**Date:** 2026-08-26 · **Members:** `anthropic/claude-sonnet-4-5`,
`openai/codex-default` · **Rounds:** 2 · **Quorum:** 2/2, concluded ·
**Actual cost:** $0.0190 · **Verdict: A, unanimous.**

Recorded under the drain-run standing directive: a disposition that would
normally end in "ask the maintainer" goes to the council, and the council's
recorded decision substitutes for sign-off.

## What was asked

`audit_skill_overlap --strict` failed the branch:

```
0.712  test-driven-development ↔ testing-anti-patterns  [engineering-base]
```

Three dispositions were put: **A** add the first allowlist entry · **B** keep
trimming the TDD skill body under 0.70 · **C** treat it as a finding about the
gate and transfer it. A fourth — merge the pair, which the gate's own error
message offers first — was named explicitly so it could be rejected on the
record rather than by omission.

## The measurements the question carried

All taken with the audit's own exported `collect()` + `_cosine()`, not by
re-implementing the metric:

| State of `src/skills/test-driven-development/SKILL.md` | similarity |
|---|--:|
| before this run's edit (`40d3b7eaf~1`), 355 lines | **0.7000** |
| after this run's edit (`40d3b7eaf`), 376 lines | **0.7120** |
| after migrating 11 lines of rationale to the companion file, 370 lines | **0.7056** |

**The pair was already at the cap.** 0.7000 passed only because the raw double
is a hair under `0.70`; the edit that landed is not special, it is the first one
after the pair reached the edge.

## The verdict

**A — add the first allowlist entry.** Both seats independently, on the same two
grounds:

> "The cosine metric measures shared vocabulary, not duplicated responsibility.
> Attempting to satisfy it by trimming operational content optimizes for the
> detector rather than the agent." — anthropic

> "Trimming agent-facing guidance to appease a vocabulary metric optimizes for
> the audit rather than skill quality." — openai

**Merging was rejected by both** on invocation shape: a procedure and a
diagnostic catalogue are consulted at different call sites, and merging conflates
two lookup patterns.

## What the council changed about the work already done

**It reversed a step this run had already taken.** The 11-line migration to
`process-anti-patterns.md` was tried, measured at 0.7056, and would still have
failed the gate. Both seats named the deeper problem independently:

> "If the agent loads `SKILL.md` but not `process-anti-patterns.md`, migrating
> content there to satisfy the metric removes it from the agent's working
> context. That's optimizing the wrong layer." — anthropic

So the migration was **reverted**: `SKILL.md` is back at 376 lines (under the
400-line sunset trigger) and `process-anti-patterns.md` back at 104.

## The one disagreement, and how it was resolved

anthropic asked for a `revisit-if` on the entry and framed "permanently blinds
the gate" as too strong. openai agreed on the trigger but **objected to periodic
review specifically**:

> "I disagree only with requiring periodic review: unless mechanically enforced,
> it becomes unactionable metadata."

Resolved toward the stronger form: the entry carries a **concrete invalidation
condition** — either skill's scope materially changing, or substantive guidance
becoming duplicated rather than merely sharing vocabulary — and **no calendar
date**. A review date nothing enforces is the metadata openai named.

## The finding neither disposition fixes

Both seats flagged the gate itself, and this is recorded rather than acted on:

> "Cosine similarity over keyword vectors cannot distinguish *complementary
> domain-focused skills* from *redundant ones*. That's not a flaw in the pair —
> it's a limitation of the gate. The gate should fail on high overlap AND low
> justification quality, not on overlap alone." — anthropic

anthropic also read the allowlist's own "empty is the healthy state" comment as
too absolute: *"the real failure is an entry WITHOUT justification."* Neither
observation was implemented — changing the metric or the threshold is a gate
design decision with its own review surface, and this run is not the place for
it. It is stated here so a later reader finds the argument rather than only the
entry.

## Where the decision landed

`src/scripts/audit_skill_overlap_allowlist.json` — one entry, carrying the
measurements above, the rejected alternatives (trim, merge), and the
invalidation trigger. The allowlist cap is 20; this is entry 1.
