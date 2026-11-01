---
title: The four profiles
description: Four different Agent Config settings are called a profile — your role, how much is loaded, the rule set and a temporary view for one session. This page tells them apart.
---

Four settings share the word "profile". Switch your **role** profile with:

```bash
npx -y @event4u/agent-config use --profile founder
```

| You want to… | Change |
|---|---|
| Change who the agent is tuned for | the **role profile** (`profile.id`) |
| Change how much loads on every task, and so the token cost | the **install profile** (`init --profile`), which sets the **rule set** (`discipline_profile`) |
| Narrow the skills shown, for one session only | the **session profile** (`/profile activate`) |

## 1. Role profile — `profile.id`

Who you are. The wizard's first question; it picks the skills and workflows you start with — `developer` (default), `founder`, `content_creator`, `agency`, `finance` or `ops`. See [Choose a profile](/agent-config/getting-started/choose-a-profile/).

## 2. Install profile — `init --profile`

How much is loaded, chosen when you install: `minimal`, `balanced` (default) or `full`. It fills in the rule set below.

```bash
npx -y @event4u/agent-config init --profile minimal
```

## 3. Rule set — `discipline_profile`

The setting the install profile writes, and the one the agent reads:

| Value | What loads | Measured cost (Claude Haiku) |
|---|---|---|
| `off` (from `minimal`) | The always-on rules only | not measured as its own arm |
| `essential` | The always-on rules plus the rule that carries the measured gain | 3.3× a run with no rules on the task family where it helps <!-- claim:essential-tier-cost-factor --> |
| `full` (from `full`) | Every rule; experimental | 11.7× <!-- claim:essential-tier-cost-factor --> |
| `auto` (from `balanced`) | `essential` on Claude models without a measured null, `off` on Claude Sonnet and on non-Claude models | as above, per model |

The safety rules load in every value; only the extra coaching changes. [Benchmark & cost, explained](/agent-config/trust/benchmark-and-cost/) has the limits of these figures.

## 4. Session profile — `/profile activate`

A temporary narrowing for the current session, typed in your AI tool:

```text
/profile activate finance
/profile deactivate
```

It changes which skills and commands are suggested, never what is allowed, and it is stored in a gitignored local file — nothing is committed.
