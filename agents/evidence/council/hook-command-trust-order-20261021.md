<!-- evidence-type: analysis -->

# Which dispatcher the Claude hook command trusts — two council rounds and the owner's call

**Date:** 2026-10-21 · **Members:** `anthropic`, `openai` (CLI transport, nothing billed)
**Prompts:** `hook-command-trust-order-20261021.question.md` and
`hook-command-plugin-carrier-20261021.question.md`, beside this file.

## Round A — option 1 or option 2 (one round)

Split. `anthropic` chose option 2 (no project-tree candidates at all; with no
dispatcher, `PreToolUse` always refuses): the hook entries signal intent to
enforce, so inability to enforce should block, and `agent-config uninstall`
removes them cleanly. `openai` chose option 1 (project-tree candidates behind
`AGENT_CONFIG_DEV_MODE`; refuse only while `~/.event4u/agent-config/runtime/`
exists), because option 2 turns a bare `npm uninstall -g` into a lockout the
model cannot repair. `openai` also named a gap in both options: an
`agent-config` on `PATH` can resolve into the project (`.`, `node_modules/.bin`),
so `PATH` resolution must reject paths under `$CLAUDE_PROJECT_DIR`; and an
environment variable is not a hard boundary for dev mode.

The split escalated to the owner, who chose **option 2**. The `PATH` rejection
both seats' reasoning supports was added to it.

## Round B — the plugin carrier (two rounds)

A fact missing from round A: the marketplace plugin ships the same command
byte-for-byte, so a plugin-only install, which has no dispatcher, would have
every tool call refused under option 2.

Both rounds split on the label. `openai`: option 1 — a plugin-only install is
"package not installed", and refusing every call breaks a standalone plugin.
`anthropic`: option 2 — but it names when option 1 is acceptable: the degraded
plugin-only state is documented, and a visible session-start notice names the
guards that are off. The plugin carrier already prints that notice at
`SessionStart` (`NO_DISPATCHER_CONTEXT`, naming all three guards), and the
installation guide now states the behaviour, so both seats' conditions meet in
option 1 for the plugin carrier. The owner directed that open questions be
settled in the council; that convergence is what was built.

## What was built

Staged runtime, then an absolute `agent-config` on `PATH` outside the project;
nothing in the project tree runs. No dispatcher: `PreToolUse` exits 2 on the
settings carrier, the plugin carrier and every other event exit 0.
