---
stability: experimental
---

# MCP Server — Phase 1–6 Scope (A0 Hard Contract)

> **Status:** Active · covers Phase 1 (A1–A7) + Phase 2 (B1–B5) +
> Phase 3 (C1–C4) + Phase 4 (D1–D4) + Phase 6 F1/F3 of
> `road-to-mcp-server.md`. Phase 6 F2 (SSE transport) is owned by
> [`mcp-cloud-scope.md`](mcp-cloud-scope.md) — the hosted Cloudflare
> Worker bridge — and remains out of scope here. This contract retains
> exclusive ownership of `scripts/mcp_server/` (local stdio).
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

- **`tools/*` beyond the Phase 4 allowlist** — only the two
  built-in tools listed below in *Phase 4 amendment* are reachable.
  Any other name raises `ValueError`. `work_engine` is not exposed.
- **`resources/*` beyond rules / guidelines / contexts** — no model
  outputs, no roadmaps, no chat history surfaced as resources.
- **Filesystem writes outside the Phase 4 write allowlist** — the only
  writable targets are `agents/.agent-chat-history` and
  `.agent-chat-history` under `<consumer_root>`. No log files, no
  telemetry writes, no `.work-state.json` mutation.
- **Direct shell execution from `mcp_server/*`** — modules under
  `scripts/mcp_server/` do not `import subprocess`, `os.system`, or
  `os.popen` directly. Project helpers that internally spawn shells
  (`skill_linter`'s `--changed` git mode, etc.) may be called only via
  read-only wrappers that bypass those code paths.
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

A future regression that adds a `tools/*` handler outside the
allowlist or writes outside the Phase 4 write allowlist fails the
import-surface + behaviour assertions and the contract review in code
review.

## Phase 4 amendment — tool allowlist (D1–D4)

Phase 4 lifts the read-only line for **exactly** the two built-in
tools registered in `scripts/mcp_server/tools.py::ALLOWLIST`. Every
other tool name is unreachable: `tools/call` against an unlisted name
returns `isError=True`.

| Tool name | Mode | Side effects |
|---|---|---|
| `lint_skills` | read-only | Wraps `scripts.skill_linter.lint_file`. Never spawns `git` (no `--changed`). Returns the same JSON shape as `scripts/skill_linter.py --format json`. |
| `chat_history_append` | path-scoped write | Wraps `scripts.chat_history.append`. Writes are allowed only when the resolved target is `agents/.agent-chat-history` or `.agent-chat-history` under `<consumer_root>`. `dry_run=True` validates the payload without touching the filesystem. |

**Path-scoping invariant** — any tool that writes must resolve its
target through `_validate_in_tree_path` before the underlying writer
runs. Escapes (absolute paths outside the root, relative paths that
resolve outside, or filenames not in the write allowlist) raise
`ValueError` and surface as `isError=True` in `tools/call`.

**Boot-time enumeration** — `run_stdio` prints one stderr line
listing the registered tool names so operators see the surface at
launch. Adding a tool to `ALLOWLIST` is a code-review event; no
settings flag can enable an unlisted tool.

Additional tool tests in `tests/test_mcp_server.py`:

8. `tools/list` returns exactly the allowlisted names.
9. `tools/call` against a valid `dry_run` payload returns
   `isError=False` with a JSON-serialized result.
10. `tools/call` with a path escape returns `isError=True` referencing
    the escape — no exception propagates past the handler.
11. `tools/call` against an unknown tool name returns `isError=True`.
12. `scripts.mcp_server.tools` does not import `subprocess`,
    `os.system`, `os.popen`, or any HTTP client directly.

## Phase 6 amendment — identity metadata + Docker bundle (F1, F3)

Phase 6 adds **observability** and **packaging** without changing the
A0 wire surface. F2 (SSE transport) is explicitly deferred — see
status header.

### F1 — Identity metadata

Three values surface at server boot, written to **stderr** in a single
`mcp-server: identity …` line (the canonical surface — the high-level
MCP SDK builds `serverInfo` with a fixed field set, so wire-surface
lift waits on SDK support):

- **`serverVersion`** — hand-maintained SemVer in
  `scripts/mcp_server/__init__.py::__version__`. Bumps on
  **wire-surface** changes only: new tool, new resource MIME type,
  protocol-level break. Does **not** bump for content edits inside
  `.agent-src/`.
- **`packageVersion`** — read from `package.json::version` at boot.
  Bumps on every agent-config bundle release; build-ID semantics, not
  a stability signal.
- **`skillSetSignature`** — first 12 hex chars of the SHA-256 over the
  joined sorted `(path, mtime)` tuples of `PromptCache` and
  `ResourceCache`. **Not a version** — a content fingerprint. Auto-
  updates with every `task sync`; intended for cache-key /
  reproducibility use, never for SemVer-style compatibility claims.

Implementation: `scripts/mcp_server/metadata.py`. The signature is
deterministic for a given snapshot of the loaded file set; any mtime
change invalidates it.

### F3 — Stdio Docker bundle

`docker/mcp-server/Dockerfile` ships a stdio-only image. The contract:

- **No HTTP / SSE listener** in the image. Stdio is the only wire.
- The image embeds `scripts/mcp_server/`, the two tool dependencies
  (`scripts/skill_linter.py`, `scripts/chat_history.py`),
  `.agent-src/`, `docs/guidelines/`, and `package.json`. Nothing
  outside the COPY-listed paths reaches the runtime stage.
- The image runs as a non-root user (`mcp:mcp`); host volumes mounted
  for `chat_history_append` writes must be writable by that uid/gid.
- The A0 contract from Phase 1–4 transfers verbatim — the import-
  surface guard tests run identically inside and outside the image.

Operator documentation: `docs/setup/mcp-server-docker.md`. The image
does not introduce a new tool, resource type, or protocol surface.

### What Phase 6 explicitly does **not** add

- **No HTTP/SSE transport**, native or otherwise. F2 is deferred to
  the successor roadmap; revival is gated on a real consumer ask, and
  the locked design is the bridge pattern from
  [`mcp-request-signing § Appendix`](../guidelines/agent-infra/mcp-request-signing.md#appendix--http-bridge-stdio-kernel-pattern-reference)
  — never a native SSE server inside `scripts/mcp_server/`.
- **No new tools** beyond the Phase 4 allowlist.
- **No multi-tenancy** — the Docker image is single-tenant, one
  process per stdio session. Multi-tenancy lives with the future
  bridge, not the kernel.

## Revision policy

This contract is **experimental** — breaking changes are allowed in any
release with a CHANGELOG note. Promotion to `beta` follows the same
gate as Phase 1 itself: at least one shipped client renders Phase 1
prompts end-to-end without a contract amendment.

## See also

- [`mcp-cloud-scope.md`](mcp-cloud-scope.md) — hosted Worker contract
  (sibling, not child). Extends the bridge pattern from
  [`mcp-request-signing § Appendix`](../guidelines/agent-infra/mcp-request-signing.md#appendix--http-bridge-stdio-kernel-pattern-reference)
  for multi-tenant SSE.
- [`STABILITY.md`](STABILITY.md) — stability policy for `docs/contracts/`.
