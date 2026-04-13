---
name: bug-analyzer
description: "Use when the user shares a Sentry error, Jira bug ticket, or error description and wants root cause analysis. Also for proactive bug hunting and code audits for hidden bugs."
---

# bug-analyzer

## When to use

**Reactive:** bug report, Sentry issue, error investigation.
**Proactive:** audit for hidden bugs, edge cases, risky patterns.

NOT for: features (`feature-planning`), refactoring (`refactorer`), performance (`performance-analysis`), security (`security-audit`).

## Input sources

| Source | Provides |
|---|---|
| Branch name | Auto-detect ticket ID (`[A-Z]+-[0-9]+`) |
| Jira ticket | Description, AC, comments |
| Sentry URL | Stacktrace, environments, frequency |
| Error message | Search string for codebase |
| User description | Repro steps, expected vs actual |

Branch detection: `git branch --show-current` → extract ticket ID → auto-fetch + confirm.

## Iron Law: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST

Red flags: "quick fix", "probably X", "just try", proposing solutions before tracing data flow, 2+ failed attempts.

## 4 Phases

### Phase 1: Root Cause Investigation

Gather ALL evidence before any hypothesis: Sentry (stacktrace, tags, frequency), Jira (description, comments), error message (search codebase), stacktrace (top frame → entry point), `codebase-retrieval`, call chain files, context docs.

**Multi-component:** log data at each boundary (Controller→Service→Repo→DB). Especially: multi-tenant switching, queue tenant context, external integrations.

### Phase 2: Pattern Analysis

Find working examples of similar paths. Compare broken vs working. Identify specific difference.

### Phase 3: Hypothesis

Single hypothesis from evidence. Test minimally. Wrong → back to Phase 1. **3-Strikes:** 3+ failures = architectural problem → discuss with user.

Common root causes: missing validation on imports, null from optional columns, type mismatches, race conditions in tenant switching, missing fallbacks.

### Phase 4: Implementation

Present root cause + fix before implementing. Failing test → single focused fix → check side effects → check similar patterns → verify.

## Proactive mode (bug hunting)

1. **Trace** execution path: data flow, state mutations, swallowed exceptions, unvalidated assumptions
2. **Edge cases:** null/empty, boundaries (0, negative, max), type coercion, timing/races, state, external failures
3. **PHP/Laravel patterns:** N+1, missing `->fresh()`, lazy loading in jobs, timezone, missing FKs, transaction+side effects, model events in seeding, off-by-one, silent catch, float money
4. **Output:** Bug → Location → Severity → Root Cause → Trigger → Fix → Confidence

## Commands: `bug-investigate` (analyze), `bug-fix` (implement+verify)

## Project awareness: Read `AGENTS.md`, `agents/`, detect project, check `agents/contexts/`.

## Before fix: run `adversarial-review` — root cause or symptom? Fix breaks something else?

## Gotcha: stacktrace = symptom not cause (trace backwards), Sentry groups errors (check latest event), verify fix doesn't break other paths.

## Do NOT: fix before root cause, commit/push without permission, ignore Sentry data, fix symptom only, attempt fix #4 without discussing architecture.
