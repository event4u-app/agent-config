# `src/flows/` — first-class USER-WORK flows

> Scaffolded in 6.0.0-D (Step 15b) as **structural prep, not wiring**. The flow
> SCHEMA (`entry_points` / `default_path` / `skills`) and the resolver that
> renders a flow are defined and built in 6.1
> ([`road-to-6.1.0-product-consolidation`](../../agents/roadmaps/road-to-6.1.0-product-consolidation.md)
> Step 8b/9). These stubs make Flows part of the source tree now — the concept
> already lives in three docs (the command-classification worksheet's `·_flow:`
> tags, this roadmap, and 6.1), so it is already part of the architecture.

## What a Flow is

A Flow names a multi-command **user-work journey** in the layered model:

```
Profile → Pack → Flow → Command → Skill → Rule
```

A Flow is the connective tissue between the curated command surface and the
day-to-day developer journey. It answers "what am I trying to *do*?" — not
"which command do I type?".

## The USER-WORK flow set (the only flows that live here)

| Flow | What it is |
|---|---|
| [`discovery`](discovery.yaml) | explore / plan / estimate / refine / investigate **before** building |
| [`implementation`](implementation.yaml) | build it (`work` · `ticket-implement` · `feature-dev` · `bug-fix`) |
| [`review`](review.yaml) | check it (`review-changes` · `judge` · `fix-quality` · `threat-model`) |
| [`delivery`](delivery.yaml) | ship it (`git-commit` · `git-pr-create` · `fix-pr-comments` · `prepare-for-review`) |

The user-facing developer story is **discovery → implementation → review →
delivery**.

## Why `agent-admin` is NOT a flow (feedback-6)

`agent-admin` (memory · analytics · governance · config) describes **system
administration**, not user *work*. The four flows above describe what a user
*does*; `agent-admin` describes how the platform is *operated*. It is the
platform / system surface, almost entirely skills plus a couple of
state-queries — so it stays out of `src/flows/` by construction.

## Schema (6.1 — active as of Step 8b / ADR-055)

Each `<flow>.yaml` carries `id`, `title`, `summary`, plus the three activated
fields:

- `entry_points` — the commands that *start* the flow (the daily front doors).
- `default_path` — the canonical command sequence for the flow.
- `skills` — the skills the flow composes end-to-end.

`commands:` remains as a descriptive seed lifted from the worksheet `·_flow:`
tags; `entry_points` / `default_path` are the validated reference fields.

The shape is fixed by [`scripts/schemas/flow.schema.json`](../scripts/schemas/flow.schema.json)
(Draft-07) and validated on load by
[`scripts/lint_flows.py`](../scripts/lint_flows.py), which also enforces that
every `entry_points` / `default_path` / `commands` entry resolves to a real
command, every `skills` slug resolves to a real `skills/<slug>/SKILL.md`, the
`id` is one of the four closed-set flows and equals the filename stem, and all
four flows have a file. Command refs are **logical** paths (the current command
layout, e.g. `pr/create`); pack `slug_prefix` projections like `git-pr-create`
land with Step 8, not here.

Step 9 (making the flow the *primary view* of the command surface) is the
separate, higher-risk follow-up; this schema + lint is the data-model
foundation it builds on. See
[`ADR-055`](../../docs/decisions/ADR-055-flow-layer-data-model.md).
