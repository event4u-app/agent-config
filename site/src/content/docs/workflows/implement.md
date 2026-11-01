---
title: Implement a change end to end with your AI agent
description: /work and /implement-ticket take a request or a ticket through refine, plan, implement, test and verify — and report what was actually checked.
---

Give the agent a request and it works through it in fixed steps, then tells you what it checked:

```text
/work "add a CSV export to the orders list"
/implement-ticket PROJ-123
```

## What it does

`/work` takes a free-form request through **refine → plan → implement → test → verify → report**. `/implement-ticket` runs the same loop for a ticket and refines the ticket first. Both:

- ask one question when the request is ambiguous, instead of guessing;
- read the code they are about to change — callers, tests, data — before editing;
- write the test first where a test makes sense;
- run something that exercises the change before saying done, and say so when nothing could be run;
- stop at a report. They never commit, push or open a pull request on their own.

## When to use it

Any change you would otherwise describe to the agent in a chat message: a feature, a bug fix with a known symptom, a refactor with a clear goal. For bigger work that spans days or several pull requests, [plan it as a roadmap](/agent-config/workflows/roadmaps/) first.

## Example

```text
/work "orders list: add a CSV export button that downloads the filtered rows"
```

A good report names the files changed, the tests added, the command that was run to check the export and its result, and anything left open — for example that the export was not tried with ten thousand rows.

## What it needs

- Any [supported AI coding tool](/agent-config/tools/overview/). No API key beyond the one your tool already uses.
- For `/implement-ticket`, a ticket the agent can read — pasted into the chat, or through your tool's Jira or Linear connection.

## Limits

- It changes how the agent works, not how capable the model is. On a strong model the measured gain was a null; on a weaker one it was significant. [Benchmark & cost](/agent-config/trust/benchmark-and-cost/).
- It spends more tokens than a plain prompt, because checking is work.
- Outside Claude Code the steps are instructions the agent is asked to follow, not checks that can stop it. [What each tool can block](/agent-config/trust/enforcement-by-host/).

## Next

- [Review before the PR](/agent-config/workflows/review/)
- [Commit and open a PR](/agent-config/workflows/commit-and-pr/)
