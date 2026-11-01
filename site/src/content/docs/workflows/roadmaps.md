---
title: Plan bigger work as a roadmap your agent works through
description: /feature:plan and /roadmap:create turn an idea into steps with a check each; /roadmap:process-step runs one step at a time and ticks it off when it is verified.
---

Turn an idea into a plan, then let the agent work through it one verified step at a time:

```text
/feature:plan "self-service password reset"
/roadmap:create
/roadmap:process-step
```

## What it does

- `/feature:explore` brainstorms an idea before you commit to it; `/feature:plan` turns it into a feature document — research, open questions, decisions.
- `/roadmap:create` writes a roadmap under `agents/roadmaps/` in your repository: phases, steps, and how each step will be checked.
- `/roadmap:process-step` runs the next open step and stops. `/roadmap:process-phase` runs a whole phase. `/roadmap:process-full` runs until the roadmap is closed.
- A step is ticked `[x]` in the file only when its check passed, in the same reply that did the work. The roadmap file is the source of truth; `agents/roadmaps-progress.md` is a dashboard generated from it.

## When to use it

When the work is bigger than one sitting: several pull requests, several people, or a change you want to review as a plan before any code exists.

## Example

```text
/roadmap:create
> What should the roadmap deliver?
  Self-service password reset: request form, signed e-mail link, rate limit, audit log.
```

The agent asks what it cannot find in the code, proposes phases, and writes the file. You review it like any other document. `/roadmap:process-step` then picks the first open step, does it, runs its check, ticks it and stops.

## What it needs

- Any [supported AI coding tool](/agent-config/tools/overview/).
- A repository: the roadmap and its dashboard are files you commit like any other.

## Limits

- Creating a roadmap never starts the work; processing it is a separate command you run.
- Roadmaps plan work, not releases: they carry no version numbers or dates.
- The agent does not commit as it goes unless you ask it to.

## Next

- [Implement a change](/agent-config/workflows/implement/) — for work that fits in one sitting.
- [Second opinion from other AI models](/agent-config/features/second-opinion/) — `/roadmap:ai-council` challenges a roadmap before you start.
