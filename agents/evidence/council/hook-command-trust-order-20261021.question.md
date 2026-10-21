<!-- evidence-type: analysis -->

# Design decision — which dispatcher the Claude hook command trusts, and what it does when none is reachable

The owner holds the 17.0.0 release until two self-review findings are fixed, and
asks the council to choose between two designs. You are asked for a decision
between option 1 and option 2 below, not for a third design unless both are
unacceptable.

## What exists

`agent-config` installs one shell command per Claude Code hook event into the
user-global `~/.claude/settings.json`. The command finds a dispatcher and runs
it; the dispatcher runs the package's hook concerns, among them three
`fail_closed` `pre_tool_use` guards: `block-no-verify` (refuses git hook
bypasses), `block-kernel-rule-writes` and `block-plumbing-writes` (refuse agent
writes to the package's kernel rules and hook plumbing). On a `PreToolUse` event
Claude Code treats exit code 2 as a refusal of the tool call and shows stderr to
the model; exit 0 lets the call through.

The command today tries, in this order:

1. `$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js`
2. `$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js`, only when
   `$CLAUDE_PROJECT_DIR/src/scripts/hook_manifest.yaml` exists beside it (the
   package's own source checkout)
3. the package-owned staged runtime under `~/.event4u/agent-config/runtime/current`
4. `$CLAUDE_PROJECT_DIR/agent-config`, a project-local wrapper, when the project
   has `node_modules`
5. `agent-config` on `PATH`
6. none reachable → `exit 0` on every event

## The two findings

- **`feaebdef733b`** — candidates 1, 2 and 4 are files inside the project the
  user opened. A cloned repository can commit either path and its code then
  runs as the user's global hook, ahead of the package-owned runtime, and can
  silently skip the three guards.
- **`bb6ab0f5f37d`** — step 6 makes every `fail_closed` guard fail open. A
  measured `upgrade` swap produced 487 exit-127 invocations in 4,190, each a
  silent pass of every guard; a missing `PATH` binary reproduces it permanently.

## Option 1

- **Order:** staged runtime → `agent-config` on `PATH`. The project-tree
  candidates (1, 2, 4) are used only when the environment variable
  `AGENT_CONFIG_DEV_MODE=1` is set. That variable comes from the user's shell,
  not from the repository, and keeps the package maintainer's own checkout able
  to run its in-tree dispatcher while developing hooks.
- **None reachable:** `PreToolUse` exits 2 with a message naming the missing
  dispatcher and the repair, **but only when `~/.event4u/agent-config/runtime/`
  exists** — the package is installed and the dispatcher is merely unreachable,
  the `upgrade`-swap case. When that directory is absent the command keeps
  `exit 0`. Other events keep `exit 0`.

## Option 2

- **Order:** staged runtime → `agent-config` on `PATH`. The project-tree
  candidates are removed entirely, including for the maintainer's checkout,
  whose hook changes then take effect only after a reinstall stages them.
- **None reachable:** `PreToolUse` always exits 2 with that message. Other
  events keep `exit 0`.

## Facts that bear on the choice

- `agent-config uninstall` removes the managed hook entries from
  `~/.claude/settings.json`. Removing the package with `npm uninstall -g` alone
  does not, and leaves the hook commands in place.
- Under option 2, a machine whose hook entries outlive the package refuses every
  tool call in every Claude Code session until the user edits
  `~/.claude/settings.json` by hand or reinstalls. The refusal message can name
  that repair; the model cannot carry it out with a tool, because its tool calls
  are refused.
- Under option 1, a staged-runtime directory left behind by an incomplete
  removal also triggers the refusal; a removal that also deleted the runtime
  directory does not.
- `AGENT_CONFIG_DEV_MODE` already exists in this package as the maintainer's
  switch for project-scoped development (`docs/maintainers/dev-mode.md`).
- The package's stated design for this command until now: "only the
  missing-binary case degrades open, which is the honest degrade (an absent
  dispatcher cannot evaluate anything)".

## The question

Which option should be built: **1** or **2**? Give the choice, the reason, and
the one condition under which you would reverse it. If you find a case in which
your chosen option still lets a project-planted dispatcher run, or still lets a
`pre_tool_use` guard pass silently while the package is installed, name it.
