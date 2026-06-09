# Flows — the user-work journeys

A **Flow** names a multi-command *user-work journey*, the connective tissue
between the curated command surface and the day-to-day developer journey. It
answers **"what am I trying to *do*?"** — not "which command do I type?".

The layered model:

```
Profile → Pack → Flow → Command → Skill → Rule
```

The user-facing developer story is **discovery → implementation → review →
delivery**. Each flow below lists its **entry commands** (the daily front
doors), its **canonical path** (the typical command sequence), and the
**skills** it composes end-to-end. Source of truth:
[`src/flows/<flow>.yaml`](../src/flows/) (schema + lint:
[`flow.schema.json`](../src/scripts/schemas/flow.schema.json),
[`lint_flows.py`](../src/scripts/lint_flows.py); data-model in
[`ADR-055`](decisions/ADR-055-flow-layer-data-model.md)).

## 🔍 Discovery — *what should we build, and how*

Explore, plan, estimate, refine, and investigate **before** building.

- **Entry commands:** `/feature:plan` · `/bug-investigate` · `/research`
- **Canonical path:** `/feature:explore` → `/feature:plan` → `/estimate-ticket` → `/refine-ticket`
- **Skills:** `feature-planning` · `estimate-ticket` · `refine-ticket` · `project-analysis-core` · `validate-feature-fit`

## 🔨 Implementation — *build it*

Drive a prompt, ticket, or feature end-to-end through plan → implement → verify.

- **Entry commands:** `/work` · `/implement-ticket` · `/feature:dev` · `/bug-fix`
- **Canonical path:** `/work` → `/review-changes` → `/quality-fix` → `/commit`
- **Skills:** `test-driven-development` · `code-review` · `systematic-debugging` · `git-workflow`

## 🔎 Review — *check it*

Self-review, judge, quality-fix, and threat-model a change before it ships.

- **Entry commands:** `/review-changes` · `/judge`
- **Canonical path:** `/review-changes` → `/judge` → `/quality-fix` → `/threat-model`
- **Skills:** `code-review` · `adversarial-review` · `quality-tools` · `threat-modeling` · `receiving-code-review`

## 🚢 Delivery — *ship it*

Commit in logical chunks, open the PR, answer review comments, prepare the
branch for review.

- **Entry commands:** `/commit` · `/pr:create` · `/prepare-for-review`
- **Canonical path:** `/commit` → `/pr:create` → `/fix:pr-comments`
- **Skills:** `conventional-commits-writing` · `git-workflow` · `requesting-code-review`

## Why `agent-admin` is not a flow

`agent-admin` (memory · analytics · governance · config) describes **system
administration**, not user *work*. The four flows above describe what a user
*does*; `agent-admin` describes how the platform is *operated* — almost entirely
skills plus a couple of state-queries. It stays out of the flow set by
construction.

## See also

- [`profiles.md`](profiles.md) — the six entry profiles that select which packs (and so which flows) surface.
- [`catalog.md`](catalog.md) — the full command / skill / rule / guideline surface.
- [`src/flows/README.md`](../src/flows/README.md) — the flow schema and the source stubs.
