---
model_tier: medium
name: package
disable-model-invocation: true
pack: meta
intent: "Package dispatcher — test the package install or reset the installed state"
routes_to: [package-test, package-reset]
replaces: []
tier: 2
visibility: internal
description: Package orchestrator — routes to test (verify the package install) and reset (restore installed state)
cluster: package
type: orchestrator
suggestion:
  eligible: false
  rationale: "Package-internal maintenance surface — only deliberate invocation."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /package

Top-level orchestrator for the `/package` family — maintenance of the
agent-config package installation itself.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/package test` | `commands/package/test.md` | Test the package — verify the install/projection pipeline end-to-end |
| `/package reset` | `commands/package/reset.md` | Reset the installed package state (destructive — confirmation-gated) |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/package <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the corresponding `commands/package/<sub>.md` file and
   follow its `## Instructions` (or `## Steps`) section verbatim.
4. If the sub-command is unknown or missing, print the menu and ask — do not
   guess:

   > 1. test — verify the package install pipeline
   > 2. reset — reset installed package state (destructive, confirmation-gated)

## Rules

- **`reset` is destructive.** It never runs without the explicit confirmation
  gate its sub-command defines.
- **Do NOT chain sub-commands.** One `/package <sub>` per turn.
- If the user invokes `/package` with no argument, **show the menu** — do not
  guess which sub-command they meant.
