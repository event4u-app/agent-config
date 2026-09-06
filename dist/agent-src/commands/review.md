---
model_tier: medium
name: review
disable-model-invocation: true
argument-hint: "[changes|routing]"
pack: engineering-base
intent: "Review dispatcher — multi-judge self-review of the current diff, or reviewer routing"
routes_to: [review-changes, review-routing]
replaces: []
visibility: advanced
description: Review orchestrator — routes to changes (seven-judge self-review of the local diff) and routing (compute reviewer roles + historical bug patterns)
cluster: review
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "review my changes before the PR, who should review this diff"
  trigger_context: "uncommitted or staged changes pre-PR, or an open PR without reviewers"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /review

Top-level orchestrator for the `/review` family — pre-PR self-review and
reviewer selection.

> Preparing the **branch** for a human review pass (update main, merge the
> branch chain)? That is the standalone
> [`/prepare-for-review`](prepare-for-review.md).

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/review changes` | `commands/review/changes.md` | Self-review local changes before creating a PR — five specialized judges (bug, security, tests, quality, architecture), consolidated verdicts |
| `/review routing` | `commands/review/routing.md` | Compute reviewer roles + matched historical bug patterns for the current diff (ownership-map.yml, historical-bug-patterns.yml) |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/review <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the corresponding `commands/review/<sub>.md` file and
   follow its `## Instructions` (or `## Steps`) section verbatim.
4. If the sub-command is unknown or missing, print the menu and ask — do not
   guess:

   > 1. changes — seven-judge self-review of the local diff (pre-PR)
   > 2. routing — suggest reviewers + surface matched historical bug patterns

## Rules

- **Verdict only, never auto-fix.** `/review changes` reports findings; fixes
  are a separate, user-authorized step.
- **Do NOT chain sub-commands.** One `/review <sub>` per turn.
- If the user invokes `/review` with no argument, **show the menu** — do not
  guess which sub-command they meant.
