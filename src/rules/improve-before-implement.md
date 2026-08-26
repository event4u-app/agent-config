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

**The one cheap question fires on all four rows anyway** — *does this already exist in the tree?* Bug fixes and renames re-add an existing helper more often than features do, so switching the reuse rung off there switches it off where it pays most. Cheap the [`ui-audit-gate`](ui-audit-gate.md) way — one `code-graph query`, one named verdict, no interview: the exclusion buys the **checks**, never the question. Skip the question only when the **diff alone** says it is moot — ≤ 1 file, ≤ 5 changed lines, no new symbol, no new dependency — which a typo satisfies with no state to consult, and an added symbol never does.

## Demand gate — should this exist? (build / defer)

On a "build me an app / add this feature" ask, ONE reflexive pre-check before the three checks: **who asked · what breaks if unbuilt · what's the evidence?** **Read the addressee first** — `project.audience` (`agent-config settings:get project.audience`, absent → `public`): the demand hierarchy measures **market** demand and is meaningless where no market is intended, so at `self` the check is inert and the work is classified `L-self` → **build**. With a market: recommend **build** at a real retention/activation blocker (evidence, not anxiety); else **defer/validate**, naming the missing evidence. Never gate a roadmap on a user population the project is not meant to have. Advisory — "just build it" proceeds immediately; no network lookup. Hierarchy + build/defer table: guideline § 8-pre.

## The solution-size ladder — stop at the first rung that works

Once the demand gate says build, "does this already exist?" has an **ordered** answer set: need-to-exist → reuse-in-repo → stdlib / framework → **native platform** → installed dependency → smallest working form. Stop at the first rung that carries the requirement. Ordered **after** comprehension — it shortens the solution, never the reading. Two axes, not one: the ladder is *scope*; **shape** is the other half — of what must exist, the form with the least cognitive load, explicitly not the fewest keystrokes. Rungs, the platform-rung examples, and the precedence order when they pull against each other: guideline § 8b-ladder / § 8b-shape / § 8b-precedence.

The answer is a **named verdict, never a yes/no**: `reuse` · `extract` · `refactor` · `extend` · `migrate` · `new`. **`new` owes negative evidence** — the closest existing candidate by name and path, and why it does not carry the requirement; "nothing similar exists" naming no candidate is an unrun search, not an answer. Two clauses hold the set honest: the order is a **thinking preference, not a ranking** (a `new` after a real search beats an `extend` that bends a helper out of shape), and **textual similarity alone is never grounds for an abstraction** — two blocks that read alike and change for different reasons are two blocks ([`abstraction-thresholds`](../../docs/guidelines/abstraction-thresholds.md)). Reach the verdict with `agent-config code-graph query` and `code-graph affected`, never a fresh grep protocol: [`external-code-graph-interop`](external-code-graph-interop.md) already mandates query-before-grep and names grep the fallback, so a second search specification here would contradict it rather than add to it.

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

## Why the existence question is not routed through the TDD cluster

Two source proposals put it in `/tdd`'s design mode as the one point every
behaviour passes. It cannot live there, and the reason is delivery rather than
design: `src/domains/engineering-base/tdd/command.md` carries
`visibility: internal`, `disable-model-invocation: true` and
`workspaces: [agent-config-maintainer]`, so a **consumer cannot reach that
orchestrator at all** — the chokepoint argument fails before its merits. The
question therefore sits in this rule, which every engineering consumer
receives. Recorded so the next author does not re-propose the routing.

## Creating new agent artifacts

When the request is to create or significantly rewrite a skill, rule, command,
or guideline, the "fit the existing architecture" check is handled by
[`artifact-drafting-protocol`](artifact-drafting-protocol.md)'s Phase B
(Research). Follow that protocol instead of improvising a one-shot check — it
scans `src/` for overlap and reports candidates to extend
before creating a new file.
