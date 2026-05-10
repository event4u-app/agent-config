---
stability: experimental
---

# MCP Server — Phase 1 Scope (A0 Hard Contract)

> **Status:** Active · Phase 1 spike of `road-to-mcp-server.md`
> **Stability:** experimental — not linked from README, AGENTS.md, or
> `docs/architecture.md`. Internal index reference only per `STABILITY.md`.

## Purpose

Locks the **execution-safety boundary** for the Phase 1 MCP server
spike. Any code under `scripts/mcp_server/` must satisfy this contract
verbatim. Deviation → not Phase 1; promote to a follow-up phase with
its own design-call gate.

## In-scope (Phase 1 only)

- Transport: **stdio**. No SSE, no HTTP, no WebSocket.
- MCP primitives: **`prompts/list`** + **`prompts/get`** — read-only.
- Source data: **`.agent-src/skills/<name>/SKILL.md`** (compressed
  projection, never the uncompressed source-of-truth tree).
- Loaded set: 5 hand-picked stack-agnostic skills enumerated in
  `scripts/mcp_server/prompts.py::PHASE_1_SKILLS`.
- Process lifetime: one server per project, launched per-client by the
  consumer (Claude Desktop, Zed, Continue) at MCP-config time.

## Out-of-scope (Phase 1)

- **`tools/*`** — no `tools/list`, no `tools/call`. Engine helpers
  (`work_engine.refine`, `lint_skills`, `chat_history.append`) are
  Phase 4 (D1–D4) gated on a separate design call.
- **`resources/*`** — `resources/list` + `resources/read` are Phase 3.
  Rules / guidelines / contexts must not be exposed via Phase 1.
- **Filesystem writes** — the server reads SKILL.md once at boot and
  serves the cached body. No log files, no telemetry writes, no
  hot-reload (Phase 2 B5).
- **Shell execution** — no `subprocess.*`, no `os.system`, no engine
  spawn, no `.work-state.json` mutation.
- **Network egress** — the server does not call external APIs;
  the AI Council, anthropic SDK, and openai SDK are not imported by
  any module under `scripts/mcp_server/`.
- **Authentication / multi-tenancy** — single-process, single-project.
  Multi-tenant SSE is Phase 6 (F2).

## Static guarantees enforced by tests

`tests/test_mcp_server.py` asserts the boundary at unit level:

1. `prompts/list` returns ≥ 5 entries with `skill.<name>` naming.
2. `prompts/get` returns a non-empty `messages[].content.text` body
   matching the SKILL.md body (frontmatter stripped).
3. `prompts/get` for an unknown name raises `ValueError` (no silent
   fallback to filesystem scan).
4. `scripts.mcp_server` imports cleanly without `subprocess`,
   `os.system`, `os.popen`, or any `requests` / `httpx` call.

A future regression that adds a `tools/*` handler or a write path
fails the import-surface assertion in test (4) and the contract
review in code review.

## Revision policy

This contract is **experimental** — breaking changes are allowed in any
release with a CHANGELOG note. Promotion to `beta` follows the same
gate as Phase 1 itself: at least one shipped client renders Phase 1
prompts end-to-end without a contract amendment.

## See also

- [`STABILITY.md`](STABILITY.md) — stability policy for `docs/contracts/`.
