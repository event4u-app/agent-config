---
title: All slash commands for your AI coding agent
description: The slash commands Agent Config adds to your AI tool — the ones you start with, the grouped commands behind them and where to find every one.
---

Type `/` in your AI tool to see the commands; these are the ones to start with:

```text
/work "<what you want>"
/implement-ticket PROJ-123
/review:changes
/commit
```

Slash commands run **inside your AI tool's chat**. The `agent-config` terminal commands are a separate set — see the [CLI reference](/agent-config/reference/cli/).

## Start here

| Command | What it does for you |
|---|---|
| `/work "<what you want>"` | Takes a request through refine, plan, implement, test and verify, then reports back. Never commits for you. |
| `/implement-ticket <ticket>` | The same loop for a ticket; refines the ticket first and asks when something is ambiguous. |
| `/review:changes` | Reviews your local diff with focused reviewers and merges their findings. |
| `/commit` | Splits your changes into logical Conventional Commits after showing you the split. |
| `/agent-handoff` | Summarises a session so a fresh one can pick up where it stopped. |

## Grouped commands

A grouped command shows a menu when you type it bare, or runs one action directly as `/group:action`.

| Group | Actions | Use it to |
|---|---|---|
| `/feature` | `explore`, `plan`, `roadmap`, `dev`, `refactor` | Shape an idea into a plan before code |
| `/roadmap` | `create`, `process-step`, `process-phase`, `process-full`, `next` | [Plan bigger work](/agent-config/workflows/roadmaps/) and run it step by step |
| `/review` | `changes`, `routing` | [Review before the PR](/agent-config/workflows/review/), suggest reviewers |
| `/fix` | `ci`, `pr-comments`, `quality`, `comments`, `references` | Fix a red CI run, answer review comments, clear linter findings |
| `/audit` | `deps`, `code`, `agents` | [Security](/agent-config/features/security/): advisories, code holes, what your bots can do |
| `/council` | `default`, `pr`, `design`, `optimize`, `analysis`, `debate` | A [second opinion from other AI models](/agent-config/features/second-opinion/) |
| `/memory` | `add`, `load`, `propose`, `promote`, `mine-session` | Keep [project memory](/agent-config/features/memory/) the agent consults |
| `/cost` | `report`, `profile` | [Token cost](/agent-config/features/cost/) of the session, and how much is loaded |
| `/design-system` | `capture`, `generate`, `import`, `sync` | Give the agent a [design system](/agent-config/features/design-system/) to follow |
| `/analyze` | `premortem`, `postmortem`, `decision`, `incident`, `near-miss` | Think through a risk, a decision or an outage |
| `/refine-ticket`, `/estimate-ticket` | — | Sharpen and size a ticket before planning |

Also on the menu: `/project:map` draws the [code map](/agent-config/features/code-map/); `/pr:create` opens a pull request ([Commit and open a PR](/agent-config/workflows/commit-and-pr/)).

## Every command

The full list, with each command's description, is the generated [catalog](/agent-config/catalog/). Which commands you see depends on your [profile](/agent-config/getting-started/choose-a-profile/).

On tools without native slash commands, the commands are installed as text your agent reads; ask for them by name ("run the work command on …").
