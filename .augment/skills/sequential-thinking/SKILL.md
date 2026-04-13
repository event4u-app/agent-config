---
name: sequential-thinking
description: "ONLY when user explicitly requests: step-by-step reasoning, structured problem decomposition, or iterative analysis. NOT for regular coding tasks."
---

# sequential-thinking

## When to use

Multi-step reasoning, uncertain scope, complexity filtering, backtracking, alternatives. NOT for: simple queries, single-step, routine.

## Capabilities: iterative reasoning (build+revise), dynamic scope (adjust steps), revision tracking (acknowledge→identify→revise→propagate), branch exploration (identify→explore→compare→choose→document).

## Process: Frame (what/constraints/success/missing) → Decompose (sub-problems, dependencies) → Solve (analyze→hypothesize→verify→conclude/revise) → Synthesize (combine, check contradictions) → Validate (solves problem? edge cases? proportional?).

## Revise: contradicting evidence, sub-solution doesn't fit, new info, wrong problem. Branch: equal approaches, high stakes, dead end.

## Integration: `bug-analyzer` (root cause), `feature-planning` (Phase 4), `refactorer` (multi-step).

## Anti-patterns: premature conclusion, analysis paralysis (set step limit), ignoring contradictions, linear-only, scope creep.

## Gotcha: simple tasks = no value, cap 10 thoughts, each thought must build on previous.

## Do NOT: simple tasks, call `sequentialthinking` more than once per task (looping), use as "thinking proxy" for view/command, skip validation, ignore contradictions, fixed step count.
