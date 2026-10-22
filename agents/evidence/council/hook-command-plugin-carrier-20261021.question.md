<!-- evidence-type: analysis -->

# Design decision — does the plugin carrier refuse `pre_tool_use` when no dispatcher is reachable?

The owner chose "option 2" for the Claude Code hook command of `agent-config`:
trust only the package-owned staged runtime and an `agent-config` on `PATH`
whose resolved path is absolute and outside the opened project, and when
neither is reachable, refuse every `PreToolUse` call (exit 2 with a repair
message) instead of exiting 0. The goal is that the three `fail_closed` guards
(`block-no-verify`, `block-kernel-rule-writes`, `block-plumbing-writes`) never
fail open silently while the package is installed.

A fact missing from that decision: the same command string, byte-identical, is
also shipped as the hook of the Claude Code **marketplace plugin**
(`hooks/hooks.json`). The host's dedupe needs the strings identical; the
command can still branch at runtime on `$CLAUDE_PLUGIN_ROOT`, which the host
sets for plugin hooks only. A user who installs only the plugin, without the
npm package, has no dispatcher. Today they get a one-line stderr warning
("Hooks need the npm package … npm i -g @event4u/agent-config") and every hook
exits 0 — the guards have never run for them.

## Options

1. Refuse on the settings carrier only. When `$CLAUDE_PLUGIN_ROOT` is set the
   no-dispatcher branch keeps today's warning and `exit 0`. A plugin-only
   install is treated as "package not installed".
2. Refuse on both carriers. A plugin-only user has every tool call in every
   session refused until they run `npm i -g @event4u/agent-config`; the refusal
   message names that command.

Which should be built, **1** or **2**? Give the choice, the reason, and the
condition under which you would reverse it.
