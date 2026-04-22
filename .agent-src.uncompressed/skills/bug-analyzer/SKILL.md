---
name: bug-analyzer
description: "Use when the user shares a Sentry error, Jira bug ticket, or error description and wants root cause analysis. Also for proactive bug hunting and code audits for hidden bugs."
source: package
---

# bug-analyzer

## When to use

**Reactive mode:** User reports a bug, shares a Sentry issue, or asks to investigate an error.
**Proactive mode:** User asks to audit code for hidden bugs, edge cases, or risky patterns.

Do NOT use when:

* Feature development — route to [`feature-planning`](../feature-planning/SKILL.md)
* Code style or refactoring — route to [`code-refactoring`](../code-refactoring/SKILL.md)
* Performance issues — route to [`performance-analysis`](../performance-analysis/SKILL.md)
* Security vulnerabilities — route to [`security-audit`](../security-audit/SKILL.md)
* You need to trace how one data element flows through the code — route to
  [`data-flow-mapper`](../data-flow-mapper/SKILL.md)
* You need to enumerate every call site / consumer affected by a planned fix —
  route to [`blast-radius-analyzer`](../blast-radius-analyzer/SKILL.md)

## Input sources

Bugs can come from multiple sources — gather as many as available:

| Source | What it provides |
|---|---|
| **Branch name** | Auto-detected ticket ID (e.g., `fix/DEV-1234/...`) |
| **Jira ticket** | Description, acceptance criteria, comments, priority |
| **Sentry issue URL** | Stacktrace, affected users/environments, frequency, tags |
| **Sentry event ID** | Specific occurrence with full context |
| **Error message** | String to search in codebase |
| **User description** | Reproduction steps, expected vs. actual behavior |

### Branch ticket detection

Always check the current branch for ticket IDs:

```
git branch --show-current
```

Pattern matching:
- `fix/DEV-1234/description` → extract `DEV-1234`
- `fix/PROJ-567-some-bug` → extract `PROJ-567`
- `hotfix/DEV-999` → extract `DEV-999`
- Regex: `[A-Z]+-[0-9]+`

If found, auto-fetch the ticket and confirm with the user.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes. Random fixes waste time and
create new bugs. Quick patches mask underlying issues.

### Red flags — STOP immediately

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "It's probably X, let me fix that"
- Proposing solutions before tracing data flow
- "One more fix attempt" (when already tried 2+)

## Procedure: Analyze a bug

### Phase 1: Root Cause Investigation

Gather all available evidence before forming any hypothesis:

- **Sentry URL** → use `get_issue_details` to fetch stacktrace, tags, environments, frequency.
- **Sentry issue** → use `get_issue_tag_values` for browser, URL, environment distribution.
- **Jira ticket** → fetch via Jira API, read description, comments, linked issues.
- **Error message** → search the codebase for the message string.
- **Branch name** → auto-detect ticket ID, fetch if found.
- **Stacktrace** → start from top frame (crash site), trace down to entry point.
- Use `codebase-retrieval` to find the relevant code.
- Read each file in the call chain to understand the data flow.
- Check existing context docs (`agents/contexts/`) for the affected area.
- **Consult engineering memory.** Via
  [`memory-access`](../../guidelines/agent-infra/memory-access.md) call
  `retrieve(types=["historical-patterns", "incident-learnings"],
  keys=[<error class>, <affected file paths>], limit=3)`. A prior
  matching pattern or incident is the single most reliable accelerator
  for root-cause analysis. Cite `id` and `path` verbatim so the user
  can verify the precedent.

#### Multi-component diagnostics

When the system has multiple layers (Controller → Service → Repository → DB, or multi-tenant
DB switching), add diagnostic instrumentation **before** proposing fixes:

```
For EACH component boundary:
  - Log what data enters the component
  - Log what data exits the component
  - Verify environment/config propagation (e.g. DB connection, tenant context)
  - Check state at each layer

Run once → gather evidence → identify WHICH layer breaks → investigate that layer.
```

This is especially important for:
- Multi-tenant database switching (wrong DB selected)
- Queue jobs that lose tenant context
- API → Service → Repository chains with data transformation
- External service integrations (ProBauS, GPS, etc.)

### Phase 2: Pattern Analysis

- Find **working examples** of similar code paths in the codebase.
- Compare the broken path against the working reference.
- Identify the **specific difference** that causes the failure.
- Check if the issue is isolated or part of a broader pattern.

### Phase 3: Hypothesis and Testing

- Form a **single hypothesis** based on evidence from Phase 1 and 2.
- Test the hypothesis minimally — don't change multiple things at once.
- If the hypothesis is wrong, go back to Phase 1 with new evidence.
- **3-Strikes Rule:** If 3+ fix attempts fail, STOP. This signals an architectural problem,
  not a bug. Discuss with the user before attempting more fixes. Signs:
  - Each fix reveals new shared state or coupling in a different place.
  - Fixes require "massive refactoring" to implement.
  - Each fix creates new symptoms elsewhere.
- Common root causes in this project:
  - **Missing validation** on external sync data (CSV, XML, JSON imports).
  - **Null values** from optional DB columns not handled.
  - **Type mismatches** between legacy DB columns and PHP code.
  - **Race conditions** in multi-tenant database switching.
  - **Missing fallbacks** when external services are unavailable.

### Phase 4: Implementation

- Present the root cause and proposed fix **before implementing**.
- Create a **failing test** that reproduces the bug.
- Implement a **single, focused fix** — not multiple changes.
- Consider side effects — does the fix affect other code paths?
- Check if similar patterns exist elsewhere that need the same fix.
- Add validation/monitoring (e.g. `MonitoringHelper::captureException()`) for data quality issues.
- Verify the fix with the test from step 1.

## Proactive mode (bug hunting)

When asked to audit code for hidden bugs, use this workflow instead of the 4 phases above:

### 1. Execution tracing

Trace the actual code path step by step:
- Follow data through each function call
- Track state mutations and side effects
- Note where exceptions are caught or swallowed
- Identify where assumptions are made but not validated

### 2. Edge case analysis

For each code path, test these scenarios mentally:

| Category | What to check |
|---|---|
| **Null/empty** | Null inputs, empty arrays, empty strings, missing keys |
| **Boundaries** | Zero, negative, max int, first/last element |
| **Type coercion** | String "0" vs int 0, loose comparison bugs |
| **Timing** | Race conditions, stale cache, concurrent writes |
| **State** | Uninitialized state, partial updates, rollback failures |
| **External** | Network timeout, API errors, malformed responses |

### 3. Known bug patterns (PHP/Laravel)

- N+1 queries hidden in loops or accessors
- Missing `->fresh()` after update when using same instance
- Eloquent lazy loading in queued jobs (serialization issues)
- `now()` timezone mismatches
- Missing FK constraints allowing orphaned records
- `DB::transaction()` with external side effects (emails, API calls)
- Model events firing during seeding or migration
- Off-by-one errors in pagination or date ranges
- Silent exception swallowing (`catch (\Exception $e) {}`)
- Floating point comparison for money/quantities

### 4. Output format (proactive mode)

For each bug found: **Bug** → **Location** → **Severity** → **Root Cause** → **Trigger** → **Fix** → **Confidence**

## Commands

| Command | Purpose |
|---|---|
| `bug-investigate` | Gather context from all sources, analyze, identify root cause |
| `bug-fix` | Plan the fix, implement, verify with tests and quality tools |

## Project awareness

Read `AGENTS.md` and `./agents/` for project-specific architecture, business rules, and domain docs.
Detect the project from the repo name (see `rules/architecture.md`).
Check for existing contexts in `agents/contexts/` or module `agents/contexts/`.


## Adversarial review

Before implementing a fix, run the **`adversarial-review`** skill.
Focus on the "Bug fixes" attack questions: Is this the root cause or a symptom? Will the fix break something else?

## Auto-trigger keywords

- bug investigation
- error analysis
- Sentry error
- stacktrace
- root cause

## Rationalization prevention

| Excuse | Reality |
|---|---|
| "Should work now" | RUN the verification — confidence ≠ evidence |
| "It's probably X, let me fix that" | "Probably" = guessing. Complete Phase 1 first |
| "Quick fix for now" | Quick fixes mask root causes and create technical debt |
| "I'll investigate later" | Later never comes. Investigate now |
| "One more fix attempt" (after 2+) | 3+ failures = architectural problem. Stop and discuss |
| "Issue is simple, don't need process" | Simple issues have root causes too. Process is fast for simple bugs |
| "Emergency, no time for process" | Systematic debugging is FASTER than guess-and-check thrashing |

## Output format

1. Root cause analysis with evidence trail
2. Fix implementation or fix plan with specific files and changes
3. Regression test covering the failure scenario

## Gotcha

- Don't assume the stacktrace shows the root cause — it often shows the symptom. Trace backwards.
- Sentry groups similar errors — check if the "latest event" is actually representative of the issue.
- The model tends to suggest fixes without verifying the fix doesn't break other code paths.

## Do NOT

- Do NOT start fixing before understanding the root cause.
- Do NOT commit or push without permission.
- Do NOT ignore Sentry data if available — it provides real-world context.
- Do NOT fix only the symptom — trace to the root cause.
- Do NOT attempt fix #4 without discussing the architecture with the user.

## References

- **Chain-of-Verification (CoVe)** — [arxiv.org/abs/2309.11495](https://arxiv.org/abs/2309.11495)
  Generate candidate answers, then verify each with follow-up
  questions. This skill adapts CoVe by verifying stacktrace-derived
  hypotheses against Sentry data and surrounding code before fixing.

