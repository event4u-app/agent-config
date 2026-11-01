---
title: Token cost and budget for your AI coding sessions
description: /cost:report records what a Claude Code session spent and checks it against your budget; the install profile decides how much is loaded, and so how many tokens every task costs.
---

See what your current Claude Code session has cost so far:

```text
/cost:report
```

## What it does

- **`/cost:report`** reads the token usage of the active Claude Code session, prices it per model, appends a record to `agents/cost-tracking/sessions.jsonl` in your repository and checks it against your budget. It counts a turn Claude Code replays into several transcripts once, and it splits the main session from subagents.
- **Budgets** are daily, weekly and monthly ceilings in US dollars, set under `cost.budgets` in your settings. The report warns as you approach a ceiling.
- **`cost.enforcement`** decides what happens at the ceiling: `advisory` (the default) shows the breach and keeps working; `hard-stop` refuses to start the next turn until the budget is raised or reset.
- **`/cost:profile`** changes how much Agent Config loads on every task — the biggest lever on what each task costs.

## How much Agent Config itself costs

Checking its work costs tokens. Measured on Claude Haiku only: the default setting costs 3.3× a run with no rules on the task family where it helps and about 1.7× over the full corpus; loading everything costs 11.7×. <!-- claim:essential-tier-cost-factor --> On a strong model the gain was a null. [Benchmark & cost, explained](/agent-config/trust/benchmark-and-cost/) has the table and its limits.

## When to use it

- At the end of a long session, before you start the next one.
- When you set up a team budget: put the ceilings in the shared settings and pick `hard-stop` if a breach must stop work.

## Example

```yaml
# ~/.event4u/agent-config/settings/.agent-settings.yml
cost:
  budgets:
    daily: 20
    monthly: 300
  enforcement: advisory
```

## What it needs

- `/cost:report` reads Claude Code's session files; on other tools it reports that no Claude Code session was found.
- Nothing leaves your machine: the records stay in `agents/cost-tracking/`.

## Limits

- A model the price table does not know is costed at zero and flagged, so the total is understated until you supply its rate.
- Budgets cover what the report has recorded, not your provider's invoice.
