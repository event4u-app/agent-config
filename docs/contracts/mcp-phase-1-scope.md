---
stability: experimental
---

# MCP Server — Phase 1 + Phase 2 Scope (A0 Hard Contract)

> **Status:** Active · covers Phase 1 (A1–A7) + Phase 2 (B1–B5) of `road-to-mcp-server.md`
> **Stability:** experimental — not linked from README, AGENTS.md, or
> `docs/architecture.md`. Internal index reference only per `STABILITY.md`.

## Purpose

Locks the **execution-safety boundary** for the MCP server through
Phase 2. Any code under `scripts/mcp_server/` must satisfy this
contract verbatim. Deviation → not Phase 1/2; promote to a follow-up
phase with its own design-call gate.

## In-scope (Phase 1 + Phase 2)

- Transport: **stdio**. No SSE, no HTTP, no WebSocket.
- MCP primitives: **`prompts/list`** + **`prompts/get`** — read-only.
- Source data: **`.agent-src/skills/<name>/SKILL.md`** and
  **`.agent-src/commands/**/*.md`** (compressed projections, never the
  uncompressed source-of-truth tree).
- Loaded set (Phase 2): every well-formed skill + command under
  `.agent-src/` (Phase 1 hand-picked set retained as a smoke fixture
  in `prompts.py::PHASE_1_SKILLS`).
- **Pagination** (B4): cursor-based `nextCursor` on `prompts/list`,
  default `page_size=100`. Cursor is an opaque stringified offset.
- **Hot-reload** (B5): `PromptCache` re-scans on mtime / path-set
  change before each `prompts/list` response. No background thread,
  no inotify, no debounce — the request itself is the rate-limiter.
- **Frontmatter validation** (B3): entries missing `name` or
  `description` are skipped with a stderr warning at boot; malformed
  files do not crash the server.
- Process lifetime: one server per project, launched per-client by the
  consumer (Claude Desktop, Zed, Continue) at MCP-config time.

## Out-of-scope (Phase 1 + Phase 2)

- **`tools/*`** — no `tools/list`, no `tools/call`. Engine helpers
  (`work_engine.refine`, `lint_skills`, `chat_history.append`) are
  Phase 4 (D1–D4) gated on a separate design call.
- **`resources/*`** — `resources/list` + `resources/read` are Phase 3.
  Rules / guidelines / contexts must not be exposed yet.
- **Filesystem writes** — the server only reads. No log files, no
  telemetry writes, no `.work-state.json` mutation.
- **Shell execution** — no `subprocess.*`, no `os.system`, no engine
  spawn.
- **Network egress** — the server does not call external APIs;
  the AI Council, anthropic SDK, and openai SDK are not imported by
  any module under `scripts/mcp_server/`.
- **Authentication / multi-tenancy** — single-process, single-project.
  Multi-tenant SSE is Phase 6 (F2).

## Static guarantees enforced by tests

`tests/test_mcp_server.py` asserts the boundary at unit level:

1. `prompts/list` returns the full skills + commands set with
   `skill.<name>` and `command.<name>` wire-name prefixes.
2. `prompts/get` returns a non-empty `messages[].content.text` body
   matching the SKILL.md / command-file body (frontmatter stripped).
3. `prompts/get` for an unknown name raises `ValueError` (no silent
   fallback to filesystem scan).
4. `scripts.mcp_server.prompts` imports cleanly without `subprocess`,
   `os.system`, `os.popen`, or any `requests` / `httpx` call.
5. `prompts/list` paginates with `nextCursor` and pages do not
   overlap.
6. `PromptCache` re-scans on mtime change (hot-reload).
7. Malformed frontmatter is skipped with an error line, not crashed.

A future regression that adds a `tools/*` handler or a write path
fails assertion (4) and the contract review in code review.

## Revision policy

This contract is **experimental** — breaking changes are allowed in any
release with a CHANGELOG note. Promotion to `beta` follows the same
gate as Phase 1 itself: at least one shipped client renders Phase 1
prompts end-to-end without a contract amendment.

## See also

- [`STABILITY.md`](STABILITY.md) — stability policy for `docs/contracts/`.
