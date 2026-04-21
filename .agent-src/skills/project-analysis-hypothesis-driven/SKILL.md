---
name: project-analysis-hypothesis-driven
description: "Use when a bug has multiple plausible causes across layers — competing hypotheses, validation loops, evidence-based conclusions — even when the user just says 'why is this happening?'."
source: package
---

# project-analysis-hypothesis-driven

## When to use

Use this skill when:

* There is a concrete issue to explain
* Multiple root causes are plausible
* The system spans several layers
* A shallow single-explanation answer would be risky
* `universal-project-analysis` or `bug-analyzer` routes here

Do NOT use when:

* You are still discovering the stack and architecture
* The issue is already proven and only needs implementation
* The request is a broad project overview without a specific problem focus

## Core principles

* Never stop at the first plausible explanation
* Code, docs, and evidence beat intuition
* Rejected hypotheses matter
* Multiple interacting causes are common
* Uncertainty must be marked explicitly

## Procedure

### 1. Define the observed problem

State clearly: what happens, where it happens, when it happens, what was expected instead.

Use concrete evidence: errors, stack traces, behavior differences, failing tests, logs.

### 2. Build the hypothesis tree

Generate multiple competing explanations.

Typical categories:

* config issue
* version mismatch
* package misuse
* async/timing issue
* data inconsistency
* architecture flaw

Do not stop at one explanation.

### 3. Prioritize hypotheses

Rank by: likelihood, impact, testability.
Start with the most testable high-value explanation.

### 4. Validate each hypothesis

For each hypothesis:

* check code
* check docs
* check runtime evidence
* check real-world reports if relevant

Mark: ✅ confirmed, ❌ rejected, ❓ uncertain.

### 5. Check system interactions

Look for cross-system causes:

| System A | ↔ | System B | What can go wrong |
|---|---|---|---|
| Framework | ↔ | Package | Version mismatch, wrong lifecycle hook, config conflict |
| Sync code | ↔ | Async code | Lost context, stale data, race conditions |
| Config | ↔ | Runtime | Cached config doesn't match env |
| Cache | ↔ | Database | Stale reads, inconsistent state after write |
| Auth | ↔ | Middleware | Order-dependent behavior, missing guards |
| Events | ↔ | Jobs | Events fire during seeding, serialization issues |
| Transaction | ↔ | External calls | Side effects can't be rolled back |

### 6. Perform reality check

Ask:

* does this fully explain the behavior?
* what remains unexplained?
* could multiple causes interact?
* does contradictory evidence exist?

If anything major remains unexplained: continue analysis, do not present a final conclusion yet.

### 7. Validate conclusion quality

Check:

* at least 2 plausible hypotheses were considered where appropriate
* rejected hypotheses are documented
* conclusion is backed by code/doc/runtime evidence
* confidence level is explicit
* partial explanations are not presented as complete

## Output format

1. Problem statement
2. Hypothesis tree
3. Confirmed findings
4. Rejected hypotheses
5. Remaining uncertainties
6. Root-cause conclusion
7. Confidence level
8. Recommended next steps

## Gotcha

* The model tends to lock onto the first plausible explanation too early.
* Contradictory evidence usually means the current conclusion is wrong or incomplete.
* Many production issues are caused by multiple interacting factors, not one neat bug.

## Do NOT

* Do NOT present guesses as facts
* Do NOT skip rejected hypotheses
* Do NOT stop after one plausible explanation
* Do NOT ignore version-specific or package-specific behavior
* Do NOT claim full root cause if meaningful uncertainty remains
