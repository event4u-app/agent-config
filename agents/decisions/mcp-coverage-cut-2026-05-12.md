# MCP Coverage Cut — Phase 3 Implementation Verdict (2026-05-12)

**Substitutes for:** `road-to-mcp-full-coverage.md` Phase 2 / **K3** — Decision-gate verdict file.
**Why a substitute:** the operator **waived** the original 4-week telemetry window. The Phase 1 stubs (PR #105) have not yet accumulated meaningful call counts, so a measured-demand verdict is impossible. The AI Council was invoked to derive a first-principles cut.

## Inputs

- **Question file:** `agents/council-questions/road-to-mcp-full-coverage-phase-3-cut.md`
- **Council responses:** `agents/council-responses/road-to-mcp-full-coverage-phase-3-cut.json`
- **Members:** `anthropic/claude-sonnet-4-5`, `openai/gpt-4o` — 2 rounds, est. $0.058, actual **$0.018**.
- **Anthropic round-2 was truncated** at the 2048-token output cap; verdict synthesised from GPT-4o full text + Anthropic's confirmed agreement on the shell-spawn exclusion and core risk identification.

## Verdict — Phase 3 cut list (read-only, stdio transport)

| # | Tool | Rationale |
|---|---|---|
| 1 | `chat_history_read` | Mirror of the already-implemented `chat_history_append`; closes the read/write symmetry for the only consumer-facing data store the MCP layer owns. |
| 2 | `memory_lookup` | High-value at start of session — host agents that route work by ownership / historical patterns need this on the wire surface, not a shell-out. |
| 3 | `memory_status` | Zero-arg gate that lets a consumer detect whether the optional `@event4u/agent-memory` package is reachable. Cheap, idempotent, no side effects. |
| 4 | `list_skills` | Manifest of every prompt the server exposes. Lets a host agent discover the skill set without re-parsing `.agent-src/skills/`. |
| 5 | `list_commands` | Manifest counterpart for slash-command prompts. |
| 6 | `list_rules` | Manifest of every rule resource — pairs with `read_resource_body` so clients can inline a rule body into a tool result. |
| 7 | `read_resource_body` | Resource-URI accessor that bypasses `resources/read` for clients that want the body inline. Pure resource cache read. |

## Verdict — explicit rejections (stay stubbed)

| Tool | Reason for exclusion |
|---|---|
| `mine_session` | `--commit-intake` mode writes JSONL under `agents/memory/intake/`. The read-only catalog envelope cannot guarantee this won't accidentally be enabled. Phase 4. |
| `skill_trigger_eval` | The existing `scripts/skill_trigger_eval.py` is an **evaluation harness** that calls the Anthropic API; the catalog description ("score message against compiled router") is a **runtime router scorer** that does not yet exist as a deterministic function. Concept mismatch. Phase 5 — re-spec then implement. |
| `suggest_command` | Cooldown state, settings file, and message-sanitisation surface make a deterministic JSON-over-MCP contract non-trivial. Council neither argued for nor against; defer until consumer demand. |
| `suggest_skill_for_task` | Wraps `skill_tools.suggest_skill_for_task.suggest` which requires both `skills_dir` and `personas_dir` — paths that are not stable across consumer projects. Defer. |
| `run_tests`, `run_quality_checks`, `compile_router` | Shell-spawning. Both council members converged: read-only Phase 3 envelope does not cover the shell-spawn safety contract. Phase 4 with explicit safety review. |
| `chat_history_append`, `memory_signal`, `update_form_request_messages`, `sync_gitignore`, `sync_agent_settings` | `fs-write` side effect — out of Phase 3 scope by roadmap rule. Phase 4 (`chat_history_append` already shipped under explicit allowlist in Phase 1). |

## Verdict — answers to council Q2–Q5

- **Q2 (hot-path `skill_trigger_eval`):** **reject** for Phase 3. Concept mismatch with the catalog description; needs a re-spec before any implementation. Stays a stub until a deterministic router-scoring function is designed.
- **Q3 (shell-spawning tools):** **stay stubbed.** Both council members agreed: the shell-spawn surface is a distinct safety contract that the read-only envelope does not cover.
- **Q4 (waiver guardrail):** **contract tests per tool + post-merge telemetry refresh**. Each tool ships with a stdio handler test + a subprocess-shim parity test (`L3`); post-merge, the J6 healthcheck (`scripts/mcp_telemetry_health.py`) plus the new `K2` query CLI surface real demand within 2 weeks to validate or invalidate the cut.
- **Q5 (one-PR-per-tool):** **relaxed** for this autonomous-execution run, but the per-tool **acceptance test** + per-tool **catalog entry update** remains mandatory. The PR splits into logical commit chunks (one per tool / module) so a per-tool revert stays a single `git revert <sha>`.

## What the cut deliberately does NOT change

- Phase 4 stays **DEFERRED** — wake-up trigger (named consumer requesting an `fs-write` tool) is unchanged.
- Phase 5 stays **DEFERRED** — wake-up trigger (Worker-side Python-runtime endpoint or measured latency budget failure on stdio) is unchanged.
- The Cloud Worker stays **stub-only** for every newly-implemented tool. `implemented_on` flips to `["stdio"]`, never `["stdio", "worker"]`, until a Python-runtime endpoint exists.
- The `not_implemented` envelope contract (`docs/contracts/mcp-tool-stub-envelope.md`) stays the source of truth for every tool still in the stub set.

## Audit trail

- Branch: `feat/road-to-mcp-full-coverage`
- PR: [#105](https://github.com/event4u-app/agent-config/pull/105) (Phase 1) — this verdict authorises the **Phase 2 + Phase 3** delta on top.
- Wait waiver: operator instruction in chat on 2026-05-12, explicitly authorising autonomous Phase 2/3 execution without the 4-week window.
