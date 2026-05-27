# Ruflo Coexistence Contract

How `event4u/agent-config` shares a Claude Code project's `.claude/`
directory with [`ruvnet/ruflo`](https://github.com/ruvnet/ruflo), a
multi-agent orchestration runtime. Driven by
[`road-to-ruflo-bridge`](../../agents/roadmaps/road-to-ruflo-bridge.md).

## The collision surface

Both tools write `.claude/settings.json` hooks on overlapping lifecycle
events. ruflo's real binding (captured verbatim at
`tests/fixtures/ruflo/settings.json`, `ruvnet/ruflo@main`, 2026-05-27)
routes through `node .claude/helpers/hook-handler.cjs <verb>` and
`auto-memory-hook.mjs`:

| Event | ruflo | agent-config |
|---|---|---|
| `PreToolUse` | matcher `Bash` → `pre-bash` | matcher-less → `dispatch:hook` |
| `PostToolUse` | matcher `Write\|Edit\|MultiEdit` → `post-edit` | matcher-less → `dispatch:hook` |
| `UserPromptSubmit` | → `route` | → `dispatch:hook` |
| `SessionStart` | → `session-restore` + `auto-memory import` | → `dispatch:hook` |
| `SessionEnd` | → `session-end` | → `dispatch:hook` |
| `Stop` | → `auto-memory sync` | → `dispatch:hook` |
| `PreCompact`, `SubagentStop` | own handlers | (no agent-config binding) |

Other shared `.claude/` surfaces: `commands/`, `skills/`, `agents/`,
`mcp.json` (ruflo server id `claude-flow`; agent-config `agent-memory`),
`enabledPlugins` (`ruflo-core@ruflo` vs `agent-conf@event4u`).

## Claude Code hook execution semantics (authoritative)

Per the Claude Code hooks reference (code.claude.com/docs/en/hooks,
read 2026-05-27):

- **All matching hooks run in parallel**; "identical handlers are
  deduplicated automatically" — command hooks by `command` string +
  `args`.
- A non-zero exit other than `2` is a **non-blocking** error for the
  emitting hook and **does not stop the other hooks** for that event
  (fail-open between independent hooks).
- Exit `2` is a blocking error for blockable events (`PreToolUse`,
  `PermissionRequest`, `UserPromptSubmit`, …); other parallel hooks
  still execute; any block decision takes precedence.
- **No guaranteed ordering** across hooks in an event array.

### Consequence for the bridge

Multiple matcher-groups in one event array all fire, so ruflo's group
and an appended agent-config group coexist natively. Failure isolation
is a platform guarantee — no custom chaining/wrapper is needed.
agent-config must NOT rely on running first or on a deterministic order;
this is acceptable because agent-config's hook concerns are observability
(chat-history, roadmap-progress, context-hygiene, verify-evidence,
minimal-diff counter), not control-flow enforcement.

## Governance scope (the honest limit)

agent-config's safety floors (`non-destructive-by-default`,
`scope-control`, `commit-policy`) are enforced as always-on **rules in
the host agent's context**, not via hooks. They bind the **main** Claude
Code agent. ruflo's autonomously spawned **swarm subagents** do not
inherit that rule context, so agent-config cannot govern ruflo's swarms
through hooks or rules. The bridge documents this; it does not pretend to
close the gap. (Optional git-layer enforcement is gated behind a council
re-check + user confirmation — roadmap Phase 7.)

## Design

1. **Array-append merge** for shared hook events when a coexistence
   partner is detected — append agent-config's dispatch group, never
   replace the array. Idempotent via command-string dedup.
2. **Detection-gated**: inert when ruflo is absent.
3. **One-time install-mode choice** (Full / Observe-only / Skip),
   persisted, not re-asked.
4. **Memory**: shared `~/.claude/projects/*/memory/*.md` with an
   owner-marker + import-loop guard.
5. **Secondary collisions**: namespace on overlap; uninstall subtracts
   only agent-config's manifest pointers.

## Council provenance

AI Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, deep 3-round +
peer-review, 2026-05-27) converged on array-append-as-necessary-but-not-
sufficient, detection + explicit user choice, aggressive namespacing,
and separate-ownership memory; the parallel/fail-open semantics above
resolve the peer-review blind spot on hook ordering and error isolation.
