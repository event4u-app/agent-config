---
type: "auto"
tier: "2b"
description: "Before features or architectural changes — validate against existing code, challenge weak requirements"
alwaysApply: false
council_depth: deep
triggers:
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
collision_ok:
  "migration": "a migration is a significant behavioural change — the pre-implementation checks apply"
  "refactor": "refactor = significant change; the demand gate + three checks apply"
  "implement": "its own core trigger — pre-implementation validation"
# obligation: line 45
obligation_frequency: "per-task"
---

# Improve Before Implement

## The Iron Law

```
BEFORE PRODUCTION CODE, ANSWER TWO QUESTIONS WHERE A LATER READER CAN CHECK
THE ANSWER: DOES THIS ALREADY EXIST IN THE TREE, AND IS THE APPROACH SOUND.
THE EXISTENCE QUESTION IS A NAMED VERDICT, NEVER A YES OR NO.
`new` OWES THE CLOSEST CANDIDATE BY NAME AND PATH, AND WHY IT DOES NOT FIT —
"NOTHING SIMILAR EXISTS" NAMING NO CANDIDATE IS AN UNRUN SEARCH.
CHALLENGE TO IMPROVE, NEVER TO REFUSE. THE USER PICKS, THEN YOU EXECUTE.
```

## When to activate

Before implementing:

- New features
- Refactoring or architectural changes
- Module or service creation
- Significant code changes that alter behavior

**Does NOT activate for** — the **three heavy checks** only:

- Bug fixes (the problem is already defined)
- Config changes, documentation, quality fixes
- Tasks where the user said "just do it" or "skip validation"
- Trivial changes (rename, typo, formatting)

**The cheap existence question fires on all four rows anyway** — the exclusion buys the checks, never the question. Skip only when the diff alone says so: ≤ 1 file, ≤ 5 lines, no new symbol, no new dependency.

## Demand gate — should this exist? (build / defer)

On a "build me an app / add this feature" ask, ONE reflexive pre-check before the three checks: **who asked · what breaks if unbuilt · what's the evidence?** **Read the addressee first** — `project.audience` (`agent-config settings:get project.audience`, absent → `public`): the demand hierarchy measures **market** demand and is meaningless where no market is intended, so at `self` the check is inert and the work is classified `L-self` → **build**. With a market: recommend **build** at a real retention/activation blocker (evidence, not anxiety); else **defer/validate**, naming the missing evidence. Never gate a roadmap on a user population the project is not meant to have. Advisory — "just build it" proceeds immediately; no network lookup. Hierarchy + build/defer table: guideline § 8-pre.

## The solution-size ladder — stop at the first rung that works

Once the demand gate says build, "does this already exist?" has an **ordered** answer set: need-to-exist → reuse-in-repo → stdlib / framework → **native platform** → installed dependency → smallest working form. Stop at the first rung that carries the requirement. Ordered **after** comprehension — it shortens the solution, never the reading. Two axes, not one: the ladder is *scope*; **shape** is the other half — of what must exist, the form with the least cognitive load, explicitly not the fewest keystrokes. Rungs, the platform-rung examples, and the precedence order when they pull against each other: guideline § 8b-ladder / § 8b-shape / § 8b-precedence.

The answer is a **named verdict, never a yes/no**: `reuse` · `extract` · `refactor` · `extend` · `migrate` · `new`. **`new` owes the closest candidate by name and path, and why it does not fit.** Verdict table, the honesty clauses, the cheap-question rationale and the refused TDD routing: [`reuse-verdict-mechanics`](../docs/guidelines/agent-infra/reuse-verdict-mechanics.md).

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
scans `src/` for overlap and reports candidates to extend
before creating a new file.
