<!-- evidence-type: analysis -->

# `switch_decide` — does the call reach the user's confirmation, per host (2026-11-08)

Step 7.4 of `agents/roadmaps/road-to-a-link-with-agent-switch.md`: show, per
supported host, that a `switch_decide` call reaches the user's confirmation, or
record where it does not.

## Which hosts are in scope

One. The switch question exists only where both of these hold, and both are
Claude Code alone at this tree:

- the `quota-notice` concern that raises and relays the request is bound on
  `claude` `user_prompt_submit` only (`src/scripts/hook_manifest.yaml`);
- the `agent-switch` MCP server is written only into `.mcp.json`
  (`registerAgentSwitchLink` in `src/scripts/_lib/mcp_bridge.ts`), the
  project-scope file Claude Code reads.

No other host is told a request id or is given the tool, so no other host has a
`switch_decide` call to confirm. agent-switch's own CLI and GUI are its own
consent surface and are not covered here.

## Claude Code — what is documented

Sources fetched 2026-11-08: `code.claude.com/docs/en/permissions.md`,
`permission-modes.md`, `mcp.md`, `headless.md`, `hooks.md`. Paraphrased; the
claims below are the docs', the readings marked *inference* are not.

| Situation | Does a `switch_decide` call reach the user? |
|---|---|
| Interactive, default mode, no allow rule | Yes on first use: default mode prompts on the first use of each tool. **Whether later calls in the same session prompt again is not documented** for MCP tools (the "don't ask again" table names Bash, edits, WebFetch, WebSearch only). |
| A permission rule of the ask kind naming the tool | Yes, on every call; ask outranks allow. |
| An allow rule (`mcp__agent-switch__switch_decide`, `mcp__agent-switch`, `mcp__agent-switch__*`) or `--allowedTools` | **No.** AC's control: `lint_mcp_config_security` fails such an entry in `.mcp.json` and the project's `.claude/settings*.json`. Not covered: the user-global `~/.claude/settings.json` and managed settings, which this repo's lint does not read. |
| `bypassPermissions` / `--dangerously-skip-permissions` | **No.** The mode skips permission prompts, including the project-server approval. |
| `auto` mode | **Not documented** whether its classifier reviews MCP calls at all. Treated as not shown. |
| `acceptEdits` | Not documented to cover MCP tools; *inference*: it still prompts. |
| Headless `claude -p` | The call is denied unless a hook or `--permission-prompt-tool` approves it — no move happens without a user, but no user is asked either. |
| PreToolUse hook returning allow | Does not override a matching deny or ask rule; with neither, it can skip the prompt. |

The project-scope server itself needs a separate approval in an interactive
session before it connects (`enableAllProjectMcpServers` /
`enabledMcpjsonServers` are read only from settings not checked in, so a cloned
repository cannot approve its own server). `-p` loads it without asking.

## What is shown and what is not

- **Shown (by documentation):** in an interactive Claude Code session in
  default mode with no allow rule, the first `switch_decide` call of the
  session reaches the user's confirmation; under `-p` it does not run.
- **Not shown:** a live run. No session in this tree has executed
  `switch_decide` against a real agent-switch and observed the prompt; the
  table is read from the docs, which are versioned (several behaviours are
  gated on Claude Code 2.1.259 / 2.1.302).
- **Where consent does not reach the user:** `bypassPermissions`, an allow rule
  outside the files the lint reads, and possibly `auto` mode and a repeated
  call after a session-wide approval. In each, the agent's own instruction
  (the `additional_context` says to call only after the user answered) is the
  only remaining control, and it is model-carried.

## What would close the gap

The one documented per-call gate that no mode removes is the server marking
the tool: `_meta["anthropic/requiresUserInteraction"]: true` makes Claude Code
ask on every call, `bypassPermissions` included. That is agent-switch's server,
so it belongs in its counterpart roadmap `road-to-the-agent-config-link`
(`event4u-app/agent-switch`), not here. A live interactive probe would replace
the "not shown" rows with observations.
