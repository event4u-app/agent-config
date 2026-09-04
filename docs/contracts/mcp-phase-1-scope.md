---
stability: experimental
mcp_scope: full
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
- Source data: **`dist/agent-src/skills/<name>/SKILL.md`** and
  **`dist/agent-src/commands/**/*.md`** (condensed projections, never the
  uncondensed source-of-truth tree).
- Loaded set (Phase 2): every well-formed skill + command under
  `dist/agent-src/` (Phase 1 hand-picked set retained as a smoke fixture
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
  writable targets are `agents/runtime/.agent-chat-history` (current
  default), `agents/.agent-chat-history`, and `.agent-chat-history`
  under `<consumer_root>`. No log files, no telemetry writes, no
  `.work-state.json` mutation.
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

The boundary is asserted at unit level. The Python-era suite that held these
assertions was **split** at ADR-200 into `tests/scripts/mcp_server_server.test.ts`,
`mcp_server_tools.test.ts` and `mcp_server_serve.test.ts`, and the
import-surface half of it did not survive the port — see the note in
`docs/contracts/adr-mcp-runtime.md`. The remaining assertions are:

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
| `lint_skills` | read-only | Wraps `scripts.skill_linter.lint_file`. Never spawns `git` (no `--changed`). Returns the same JSON shape as `./scripts-run src/scripts/skill_linter --format json`. |
| `chat_history_append` | path-scoped write | Wraps `scripts.chat_history.append`. Writes are allowed only when the resolved target is `agents/runtime/.agent-chat-history` (current default), `agents/.agent-chat-history`, or `.agent-chat-history` under `<consumer_root>`. `dry_run=True` validates the payload without touching the filesystem. |

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
  `dist/agent-src/`.
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

`internal/docker/mcp-server/Dockerfile` ships a stdio-only image. The contract:

- **No HTTP / SSE listener** in the image. Stdio is the only wire.
- The image embeds `scripts/mcp_server/`, the two tool dependencies
  (`scripts/skill_linter.py`, `scripts/chat_history.py`),
  `dist/agent-src/`, `docs/guidelines/`, and `package.json`. Nothing
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

## Amendment — MCP Full Power (accepted 2026-07-07)

> **Status: Accepted.** Recorded by `road-to-mcp-full-power.md` Phase 3.
> User signoff on the `a0-amendment-signoff` blocker plus the council
> verdict in `agents/decisions/mcp-write-exec-cut-2026-07-07.md` both
> landed 2026-07-07. Existing Phase 1–6 sections above predate the TS
> migration (they still reference `scripts/mcp_server/*.py` and a
> two-tool allowlist) and are known-stale beyond what this amendment
> covers; a full contract refresh is a separate follow-up, out of scope
> here.

**Named consumer ask.** Operator, 2026-07-07: expose the CLI/script long
tail (roadmap, telemetry, capabilities, doctor, council, memory, …) through
MCP in safety tiers, not just the current 9-tool read-only/single-write set.

**Safety-tier model** (full classification:
[`agents/settings/contexts/mcp-tool-tier-map.md`](../../agents/settings/contexts/mcp-tool-tier-map.md)):

| Tier | Contract treatment |
|---|---|
| `read-only` | May be implemented without further gate — same bar as the existing 9 tools. |
| `fs-write-in-tree` | May be implemented once path-guarded via `_validateInTreePath` — same pattern as `chat_history_append`. |
| `shell-exec` | Requires the safety envelope: fixed argv (no shell interpolation of caller-supplied strings), timeout, output truncation, no network access from the spawned process. Implementation requires the Phase 3 council verdict naming it in the cut list. |
| `network` | Never silent-default. Every call surfaces cost/consequence before executing; billable calls (e.g. `council:run`) require the caller to pass an explicit confirmation flag echoed back in the tool result, not just be callable. |
| `long-running` | Structurally excluded — not tool-call-shaped (blocks or starts a server). |
| `hard-floor-never` | **Permanently excluded.** Secrets (`keys:install-*`), the global/outside-repo install (`upgrade`, `global`, `refresh`, `settings:migrate`), and bulk-destructive commands (`uninstall`, `prune`) are never reachable via any MCP tool, bridge, or allowlist entry, under any settings value. This list only grows, never shrinks, without a fresh A0 amendment of its own. |

**Deny-by-default, build-time only.** No consumer-settings allowlist ships
(a `mcp.tools.allow` runtime setting was considered and **rejected** by
the Phase 3 council — see below). A tool is reachable if and only if it
was generated into the build from an approved tier-map entry. Enabling a
new tool is a code change (add the entry, rebuild), never a settings
edit. `hard-floor-never` tier entries are never generated — the
exclusion is structural (the tool does not exist in `tools/list`), not a
runtime rejection.

**Bridge shape (Phase 5) — decided: pure build-time codegen.** Every
approved tool, in every tier including `shell-exec`, is generated at
build time from `src/cli/registry.ts` metadata plus the tier map — one
MCP tool per approved command, each with its own JSON Schema. A generic
`agent_config_cli` tool with a runtime-validated `subcommand` argument
was considered and rejected: the package's existing `chat_history_append`
pattern is already a compiled tool with a hardcoded path guard, not a
generic bridge gated by an editable setting, and the council verdict
(`agents/decisions/mcp-write-exec-cut-2026-07-07.md`) found the
runtime-allowlist approach strictly weaker on security grounds for no
countervailing benefit. Shell-exec tools additionally compile in their
safety envelope (fixed argv, timeout, output cap, no network) as
constants, not configuration.

**Shell-exec safety review (Phase 5, shipped pilot: `run_tests`).**
Lethal-trifecta pass for the one approved exec-tier tool:

- *Untrusted-content ingestion:* the tool's inputs (`filter`, `path`) come
  from the MCP caller — the same principal that already holds the chat
  surface; no fetched/external content selects what runs. Caller strings
  become literal argv elements via
  `src/scripts/mcp_exec/safety_envelope.ts` (`execFile`, no shell) — a
  hostile string cannot become a second command.
- *Private-data access:* the spawned vitest run sees the consumer tree,
  same as every fs tool; no credential paths are added to its env.
- *Egress:* the envelope adds no network I/O of its own. Arbitrary test
  code MAY use the network — that is a property of the project's tests,
  not of the tool; the envelope's guarantees are spawn-surface guarantees
  (no shell, `SIGKILL` timeout, per-stream byte caps), stated as such and
  never marketed as network isolation.
- *Compiled constants:* 120s timeout, 64KB per-stream cap — code-review
  events, not settings.

**Long-running policy (Phase 5) — decided: synchronous truncation.** No
async job/poll pattern ships: an exec call that exceeds its compiled
timeout returns `timed_out: true` with the captured, capped output.
Revisit only if a council-approved tool genuinely cannot fit a
synchronous budget (e.g. a future `council:run`).

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
