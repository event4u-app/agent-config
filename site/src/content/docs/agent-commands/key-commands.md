---
title: Key Commands
description: The agent commands you'll reach for most, with a pointer to the full catalog.
---

The commands most worth knowing. For the exhaustive list of all 190, see the
[Catalog](/agent-config/catalog/) or
[`docs/catalog.md`](https://github.com/event4u-app/agent-config/blob/main/docs/catalog.md).

| Command | What it does |
|---|---|
| `/work` | Drive a free-form prompt end-to-end: refine → plan → implement → test → verify; confidence-gated, no auto-git |
| `/implement-ticket` | The same loop, driven from a Jira/Linear ticket; blocks on ambiguity |
| `/commit` | Stage and commit changes split into logical Conventional Commits |
| `/pr:create` (`/create-pr`) | Create a GitHub PR with a structured description from the ticket + changes |
| `/roadmap:process-full` | Autonomously process every open step across every phase until the roadmap closes |
| `/roadmap:process-phase` · `/roadmap:process-step` | Narrower roadmap execution scopes |
| `/roadmap:create` | Interactively author a new roadmap |
| `/council:default` | Neutral, advisory-only second opinion on a prompt, roadmap, diff, or files |
| `/council:debate` · `/council:design` · `/council:pr` | Multi-round debate · design-doc review · PR-diff review |
| `/review:changes` | Self-review the local diff via five judges (bug, security, tests, quality, architecture) |
| `/fix:ci` | Fetch CI failures from GitHub Actions and fix them |
| `/fix:pr-comments` | Fix, push, reply to, and resolve open PR review comments |
| `/research:deep` | Batched deep research producing validated per-item JSON |
| `/project:analyze` | Full project analysis — detect stack, inventory modules, audit docs |
| `/worktree:create` | Create a governed worktree with a scope-lock note |
| `/agent-handoff` | Generate a context summary to continue work in a fresh chat |
