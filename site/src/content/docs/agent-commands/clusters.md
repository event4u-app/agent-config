---
title: Command Clusters
description: The agent-command clusters at a glance — counts and purpose. See the catalog for the full 190.
---

Commands are organised into clusters (subcommand counts shown). This is an
overview — the [full catalog](/agent-config/catalog/) lists all 190.

| Cluster | Subcmds | Purpose |
|---|---|---|
| `agents` | 9 | Agent-layer lifecycle — init/optimize/audit `AGENTS.md`, persona interview |
| `fix` | 8 | Targeted fixers — ci, pr-comments, quality, refs, portability, seeder, route |
| `roadmap` | 6 | Roadmap authoring + autonomous execution (step/phase/full), materialize |
| `council` | 6 | Poll external AIs for a neutral second opinion — default, pr, design, … |
| `optimize` | 6 | Optimization sweeps — skills, agents-dir, rtk filters, project, prompt |
| `memory` | 6 | Engineering-memory lifecycle — add/load/propose/promote/mine |
| `analyze` | 6 | Retrospective/prospective — postmortem, premortem, decision, incident |
| `brand` | 5 | Brand-as-UX — strategy, identity, tokens, voice, review |
| `feature` | 5 | Feature workflow — explore, plan, refactor, roadmap, dev |
| `ghostwriter` | 5 | Public-figure voice profiles (mandatory disclosure) |
| `video` | 5 | AI video pipeline — from-script, from-song, scene, storyboard, stitch |
| `team` | 4 | Governed cross-model access — review, adversarial, delegate, status |
| `tests` | 4 | Test authoring/execution — create, execute, e2e-plan, e2e-heal |
| `worktree` | 4 | Governed git worktrees — create, status, verify, cleanup |
| `knowledge` | 4 | Local knowledge ingestion — ingest, list, forget, cross-repo |
| `judge` · `tdd` · `image` · `profile` · `sync` | 3 each | LLM-judge loops · TDD cycle · character images · session profiles · config sync |
| `analytics` · `bug` · `challenge-me` · `context` · `cost` · `module` · `override` · `package` · `post-as` · `pr` · `project` · `research` · `review` · `team-knowledge` | 2 each | Focused two-command clusters |

Plus ~22 **standalone** commands (no cluster): `work`, `implement-ticket`,
`jira-ticket`, `refine-ticket`, `estimate-ticket`, `agent-handoff`,
`agent-status`, `mode`, `orchestrate`, `condense`, `humanize`, `threat-model`,
`prepare-for-review`, `upstream-contribute`, and more.
