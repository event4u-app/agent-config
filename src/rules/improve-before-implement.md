---
type: "auto"
tier: "2b"
description: "Before features or architectural changes — validate against existing code, challenge weak requirements"
alwaysApply: false
council_depth: deep
triggers:
  - intent: "implement feature"
  - intent: "architectural change"
  - keyword: "refactor"
  - keyword: "implement"
  - keyword: "migration"
routes_to:
  - "guideline:agent-infra/agent-interaction-and-decision-quality"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncondensed/"
    reason: "Rule cites the authoring tree when describing where examples live."
workspaces: [engineering]
packs: [engineering-base]
---

# Improve Before Implement

## When to activate

Before implementing:

- New features
- Refactoring or architectural changes
- Module or service creation
- Significant code changes that alter behavior

**Does NOT activate for:**

- Bug fixes (the problem is already defined)
- Config changes, documentation, quality fixes
- Tasks where the user said "just do it" or "skip validation"
- Trivial changes (rename, typo, formatting)

## Demand gate — should this exist? (build / defer)

On a "build me an app / add this feature" ask, ONE reflexive pre-check before the three checks: **who asked · what breaks if unbuilt · what's the evidence?** Recommend **build** only at a real retention/activation blocker (evidence, not anxiety); else **defer/validate**, naming the missing evidence. Advisory — "just build it" proceeds immediately; no network lookup. Hierarchy + build/defer table: guideline § 8-pre.

## The three checks

Run, in order: **1. Is the request clear?** · **2. Does it fit the existing architecture?** · **3. Is the approach sound?**

Verification stays concrete — a `curl` probe against the endpoint, a Playwright spec, an `xdebug` step-through, or the project's test runner with a targeted filter — never a from-memory assertion (full section in the guideline below).

Body migrated to [`guideline:agent-infra/agent-interaction-and-decision-quality` § 8](../../docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md#8-improve-before-implement--pre-implementation-validation) (per P4 of `road-to-kernel-and-router.md`) — the three checks' detail, how-to-challenge example, scope limits, verify-with-concrete-tools, RDP intent-inference.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## The golden rule

**Challenge to improve, never to refuse.**

The agent is a thought partner, not a gatekeeper. After presenting concerns:
- User picks an option → execute immediately
- User says "just do it" → execute immediately
- Never argue twice about the same point
- Never block work — delay is only justified if it prevents a clear mistake

## Creating new agent artifacts

When the request is to create or significantly rewrite a skill, rule, command,
or guideline, the "fit the existing architecture" check is handled by
[`artifact-drafting-protocol`](artifact-drafting-protocol.md)'s Phase B
(Research). Follow that protocol instead of improvising a one-shot check — it
scans `.agent-src.uncondensed/` for overlap and reports candidates to extend
before creating a new file.
