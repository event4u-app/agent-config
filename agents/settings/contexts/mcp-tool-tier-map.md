# MCP Tool Tier Map

Safety-tier classification of every CLI subcommand in `src/cli/registry.ts`,
built for [`road-to-mcp-full-power.md`](../../roadmaps/road-to-mcp-full-power.md)
Phase 1 Step 5. Fed the Phase 3 council debate (write/exec cut list); verdict
recorded in
[`agents/decisions/mcp-write-exec-cut-2026-07-07.md`](../../decisions/mcp-write-exec-cut-2026-07-07.md).
Bridge shape for Phase 5 is **decided: build-time codegen, no runtime
allowlist setting** — a per-command MCP tool is generated for every tier-map
entry the council (or a future council round) approves; a tool not generated
into the build does not exist in `tools/list`, regardless of settings.

## Tiers

| Tier | Meaning | MCP exposure |
|---|---|---|
| `read-only` | No mutation; safe to expose broadly | Candidate for immediate implementation |
| `fs-write-in-tree` | Writes only inside the consumer's project tree | Candidate for Phase 4, path-guarded via `_validateInTreePath` |
| `shell-exec` | Spawns a subprocess / runs arbitrary downstream logic | Candidate for Phase 5, needs the safety envelope (fixed argv, timeout, output truncation, no network) |
| `network` | Calls an external network endpoint (may be billable) | Needs explicit per-call confirmation; never silent-default |
| `long-running` | Starts a server / blocks / opens a browser — not tool-call-shaped | Excluded from the bridge by construction |
| `hard-floor-never` | Touches secrets, the global (outside-repo) install, or is irreversible without a review step | Permanently excluded — `non-destructive-by-default` applies to MCP callers exactly as to chat |

## Baseline telemetry (2026-07-07, 24h window, 71 calls — `agents/runtime/mcp-telemetry/calls.jsonl`)

Existing MCP tool calls (kernel server, current 9 implemented + stubs):
`list_rules` 581(*) · `read_resource_body` 556(*) · `nope` 287(*) · `lint_skills` 286(*) · **`memory_signal` 281(*)** · `list_commands` 281(*) · `list_skills` 278(*) · `chat_history_append` 25(*) · `memory_lookup` 7(*) · `memory_status` 1(*) · `chat_history_read` 1(*).

`(*)` counts are over the full on-disk log (2,584 lines), not strictly the 24h
window reported by `mcp_telemetry_health` — used here as directional evidence,
not a precise window figure. **`memory_signal` at 281 calls despite being a
stub (`not_implemented` envelope)** is the strongest demand signal in the
dataset and should weight the Phase 3 cut decision toward implementing it
first among the fs-write tier.

## Tier table — `src/cli/registry.ts` (68 entries)

| Command | Tier | Notes |
|---|---|---|
| `init` | fs-write-in-tree | One-shot project install |
| `sync` | fs-write-in-tree | Replays `installed-tools.lock` |
| `validate` | read-only | Drift detection |
| `work` | shell-exec | Drives `work_engine` on a free-form prompt — largest blast radius of any command; arbitrary code edits |
| `implement-ticket` | shell-exec | Same engine, ticket-shaped input |
| `update` | fs-write-in-tree | Update check / apply |
| `upgrade` | hard-floor-never | Installs latest **globally** — outside repo tree |
| `refresh` | hard-floor-never | Re-install; touches global or project install state |
| `versions` | read-only | Lists package versions |
| `global` | hard-floor-never | Global install management |
| `export` | read-only | Exports config |
| `settings:check` | read-only | — |
| `settings:sync` | fs-write-in-tree | Merges template keys into `.agent-settings.yml` |
| `settings:migrate` | hard-floor-never | Touches `~/.event4u/agent-config/` — outside repo |
| `uninstall` | hard-floor-never | Bulk removal |
| `prune` | hard-floor-never | Bulk removal |
| `doctor` | read-only | Diagnostics |
| `conformance` | read-only | Consumer conformance contract |
| `doctor-shell` | read-only | Native TS-shell probe |
| `ui:serve` | long-running | Starts local Fastify server |
| `settings` | long-running | Opens Settings GUI (browser) |
| `install` | long-running | Opens install wizard (browser) |
| `setup` | long-running | Opens onboarding wizard (browser) |
| `workspaces` | read-only | Lists workspaces |
| `packs` | read-only | Lists packs |
| `commands` | read-only | Lists/explains command surface |
| `help` | read-only | — |
| `explain` | read-only | — |
| `analyze-session` | read-only | Read-only post-session report |
| `migrate` | fs-write-in-tree | Config migration |
| `mcp:render` | fs-write-in-tree | Renders per-client `mcp.json` (may write outside repo, e.g. `~/.config/`) — verify target before allowlisting |
| `mcp:check` | read-only | — |
| `mcp:setup` | fs-write-in-tree | Writes MCP client config |
| `mcp:run` | long-running | Starts the kernel MCP server itself — cannot self-host as a tool call |
| `mcp-server` | long-running | Turnkey stdio server |
| `use` | fs-write-in-tree | Writes `profile.id` |
| `roadmap:progress` | fs-write-in-tree | Regenerates `agents/roadmaps-progress.md` — highest-frequency background script in real sessions |
| `roadmap:progress-check` | read-only | — |
| `roadmap:archive` | fs-write-in-tree | `git mv` to `archive/` — mutates git index, not just files; keep path-guarded, no push |
| `capabilities:index` | fs-write-in-tree | Regenerates `CAPABILITIES.yaml` |
| `hooks:install` | fs-write-in-tree | May also write host-level hook config outside repo — verify before allowlisting |
| `hooks:status` | read-only | — |
| `hooks:doctor` | read-only | — |
| `hooks:replay` | shell-exec | Replays a hook payload — re-triggers side effects |
| `keys:install-anthropic` | hard-floor-never | Writes secrets |
| `keys:install-openai` | hard-floor-never | Writes secrets |
| `first-run` | fs-write-in-tree | — |
| `memory:lookup` | read-only | Already the model behind the implemented `memory_lookup` MCP tool |
| `linked-projects:list` | read-only | — |
| `memory:signal` | fs-write-in-tree | Stub `memory_signal` MCP tool — 281 calls in telemetry, highest-demand candidate |
| `memory:hash` | read-only | — |
| `memory:check` | read-only | — |
| `memory:check-proposal` | read-only | — |
| `proposal:check` | read-only | — |
| `refine-ticket:detect` | read-only | — |
| `chat-history:hook` | fs-write-in-tree | Model behind implemented `chat_history_append` |
| `chat-history:checkpoint` | fs-write-in-tree | — |
| `roadmap-progress:hook` | fs-write-in-tree | — |
| `onboarding-gate:hook` | fs-write-in-tree | Writes onboarding state |
| `context-hygiene:hook` | fs-write-in-tree | Writes `agents/runtime/state/context-hygiene.json` |
| `dispatch:hook` | shell-exec | Generic hook dispatcher — can trigger arbitrary registered hook scripts |
| `telemetry:record` | fs-write-in-tree | Catalog stub name already reserved |
| `telemetry:status` | read-only | — |
| `telemetry:report` | read-only | — |
| `council:estimate` | read-only | Cost estimate only, no spend |
| `council:run` | network | Calls external LLM APIs — **billable**; never silent-default via MCP |
| `council:render` | fs-write-in-tree | Renders session output to file |
| `eval:record` | fs-write-in-tree | Records a live trigger-eval result |

## Non-registry candidates named in the 2026-05-12 coverage-cut decision

These are Taskfile targets, not `src/cli/registry.ts` entries — noted here
because the coverage-cut decision references them by MCP tool name:

| Catalog name | Maps to | Tier |
|---|---|---|
| `run_tests` | `task test` / project test runner | shell-exec |
| `run_quality_checks` | `task ci` / `task ci-fast` | shell-exec |
| `compile_router` | router-compile script (`dist/router.json` build) | fs-write-in-tree |
| `skill_trigger_eval` | live trigger-eval harness (human `/dev/tty` gate) | long-running — cannot run headless per `live-trigger-eval-human-gate` memory |

## Summary counts

- `read-only`: 28
- `fs-write-in-tree`: 24
- `shell-exec`: 5 (`work`, `implement-ticket`, `hooks:replay`, `dispatch:hook`, plus non-registry `run_tests`/`run_quality_checks` above)
- `network`: 1 (`council:run` — billable)
- `long-running`: 7 (`ui:serve`, `settings`, `install`, `setup`, `mcp:run`, `mcp-server`, plus non-registry `skill_trigger_eval`)
- `hard-floor-never`: 8 (`upgrade`, `global`, `settings:migrate`, `uninstall`, `prune`, `keys:install-anthropic`, `keys:install-openai`, `refresh`)

`long-running` and `hard-floor-never` commands are structurally excluded from
the MCP bridge (Phase 5) regardless of council outcome — they cannot be
tool-call-shaped (long-running) or would violate the Hard Floor
(`non-destructive-by-default`).
