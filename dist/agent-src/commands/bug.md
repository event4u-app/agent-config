---
model_tier: medium
name: bug
disable-model-invocation: true
argument-hint: "[investigate|fix] [args]"
pack: engineering-base
intent: "Bug dispatcher — investigate the root cause or implement the fix"
routes_to: [bug-investigate, bug-fix]
replaces: []
visibility: internal
description: Bug orchestrator — routes to investigate (root cause) and fix (plan + implement)
cluster: bug
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "there is a bug, something is broken, investigate or fix this error"
  trigger_context: "user reports a defect without saying whether they want root-cause analysis or the fix"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /bug

Top-level orchestrator for the `/bug` family — triage entry point when the
user knows they have a defect but has not picked a workflow yet.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/bug investigate` | `commands/bug/investigate.md` | Investigate a bug — auto-detect ticket from branch, gather Jira/Sentry context, trace root cause |
| `/bug fix` | `commands/bug/fix.md` | Plan and implement a bug fix — based on investigation, with quality checks and test verification |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/bug <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the corresponding `commands/bug/<sub>.md` file and follow
   its `## Instructions` (or `## Steps`) section verbatim.
4. If the sub-command is unknown or missing, print the menu and ask — do not
   guess:

   > 1. investigate — trace the root cause (Jira/Sentry/stack-trace context)
   > 2. fix — plan and implement the fix (quality checks + test verification)

## Rules

- **Investigate before fix when the cause is unknown.** `/bug fix` assumes an
  investigation result or an obvious cause; if neither exists, recommend
  `/bug investigate` first.
- **Do NOT chain sub-commands silently.** One `/bug <sub>` per turn; the
  investigate output ends with a hand-back, not an auto-started fix.
- If the user invokes `/bug` with no argument, **show the menu** — do not
  guess which workflow they meant.
