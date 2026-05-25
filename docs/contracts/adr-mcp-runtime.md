---
stability: stable
---

# ADR — MCP server runtime: Anthropic `mcp` Python SDK

> **Status:** Decided · 2026-05-10 (recorded 2026-05-15).
> **Context:**
> [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md),
> [`mcp-cloud-scope.md`](mcp-cloud-scope.md).

## Decision

The MCP server at `scripts/mcp_server/` runs on **Python 3.11+** using the
official Anthropic **`mcp` Python SDK** (PyPI; pinned to `mcp==1.27.1`
per [`scripts/mcp_server/requirements.txt`](../../scripts/mcp_server/requirements.txt)).
**FastMCP** (the higher-level decorator wrapper) and the **MCP TypeScript SDK**
are explicitly rejected for this surface.

The hosted Cloudflare Worker bridge (`internal/workers/mcp/`) is the only place a
non-Python runtime is allowed, and it stays bound to the same wire contract
(see [`mcp-cloud-scope.md`](mcp-cloud-scope.md)).

## Why this was a real question

The package already ships Python under `scripts/` (work engine, AI Council,
skill linter, install driver helpers) and ships zero Node-runtime code paths
outside the npx dispatcher. Picking a runtime for the MCP server had three
candidates that all could have shipped:

1. **MCP Python SDK** (low-level `Server` + `stdio_server` handlers).
2. **FastMCP** (higher-level Pythonic decorators built on the same SDK).
3. **MCP TypeScript SDK** (Node runtime, separate package).

Without an ADR, this choice would have stayed implicit in the code and
re-litigated every time a contributor read `scripts/mcp_server/server.py`.

## Why MCP Python SDK (low-level) wins

| Criterion | MCP Python SDK | FastMCP | MCP TypeScript SDK |
|---|---|---|---|
| Runtime already in repo | ✅ Python is the `scripts/` runtime | ✅ Same | ❌ Adds Node-runtime path for one server |
| A0 safety boundary fit (read-only `prompts/list`, `prompts/get`, narrow `tools/*` allowlist) | ✅ Direct handler control matches the [Phase 1 scope contract](mcp-phase-1-scope.md) | ⚠️ Decorator sugar can obscure the unimplemented-tool guard | ✅ Possible but duplicates Python helpers |
| Import-surface guard (`tests/test_mcp_server.py` asserts no `subprocess`, `os.system`, `os.popen`, no HTTP client in `scripts.mcp_server.prompts/tools`) | ✅ Trivial to enforce — one module set to audit | ⚠️ FastMCP pulls in extra deps that widen the audit surface | ❌ Would need a TS-side equivalent |
| Reuse of existing project helpers (`scripts/skill_linter.py`, `scripts/chat_history.py`) | ✅ Direct in-process call | ✅ Same | ❌ Cross-runtime IPC or duplicated logic |
| Pin / supply-chain footprint | One pin (`mcp==1.27.1`) + `PyYAML` | Adds FastMCP version coupling on top | Node toolchain (`npm`, `tsc`, `dist/`) |
| Smoke-test path | `task mcp:setup && task mcp:run` (already shipped) | Would re-wrap the same SDK | Separate test runner |

Evidence the decision is already realised in code:

- [`scripts/mcp_server/server.py`](../../scripts/mcp_server/server.py) — uses
  `mcp.server.Server`, `mcp.server.stdio.stdio_server`, `InitializationOptions`
  directly (no FastMCP decorators).
- [`scripts/mcp_server/__init__.py`](../../scripts/mcp_server/__init__.py) —
  pins `__version__` and declares stability/contract pointer.
- [`scripts/mcp_server/requirements.txt`](../../scripts/mcp_server/requirements.txt)
  — `mcp==1.27.1`, no FastMCP, no Node tooling.
- [`scripts/mcp_setup.sh`](../../scripts/mcp_setup.sh) — onboarding writes
  the Claude Desktop config snippet against `python -m scripts.mcp_server`.

## Tool surface (Phase 1 scoping)

Locked separately by [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md) Phase 4
amendment. The current ALLOWLIST is exactly two tools, registered as a
hardcoded module-level tuple in
[`scripts/mcp_server/tools.py`](../../scripts/mcp_server/tools.py):

| Tool | Mode | Source |
|---|---|---|
| `lint_skills` | read-only | wraps `scripts.skill_linter.lint_file` |
| `chat_history_append` | path-scoped write | wraps `scripts.chat_history.append`; writes restricted to `agents/runtime/.agent-chat-history` (current default), `agents/.agent-chat-history`, or `.agent-chat-history` under the consumer root |

No `push`, `merge`, `commit`, or prod-write surface is exposed. The
unimplemented-tool envelope from
[`mcp-tool-stub-envelope.md`](mcp-tool-stub-envelope.md) governs the rest of
the [`consumer_tool_catalog.json`](../../scripts/mcp_server/consumer_tool_catalog.json)
entries.

`agent-config init`, `agent-config skills list`, and
`agent-config council estimate` (the speculative tool surface in the
step-14 stub) are **not** exposed today. They stay terminal-gated because
their natural shape is a stateful CLI. The AI Council (claude-sonnet-4-5 +
gpt-4o, 2026-05-10, 2 rounds, $0.06) converged on a hardcoded module-level
ALLOWLIST with mandatory path-scoping for any write tool, and locked the
rule that engine-state-bearing operations stay off the MCP wire until a
real consumer ask justifies amending the A0 boundary.

## Install surface

The step-14 stub speculated about an `agent-config install --mcp` flag.
That shape was rejected in favour of two existing entrypoints, both
already shipped:

- **One-liner onboarding:** `task mcp:setup` runs
  [`scripts/mcp_setup.sh`](../../scripts/mcp_setup.sh) — creates
  `.venv-mcp/`, installs `mcp`, and prints the Claude Desktop JSON snippet
  the operator pastes into
  `~/Library/Application Support/Claude/claude_desktop_config.json`
  (with the per-OS variants documented in
  [`docs/mcp-server.md`](../mcp-server.md)).
- **Config writer:** `./agent-config mcp:render --claude-desktop` writes
  the user-scope Claude Desktop config directly.

Writing the global Claude Desktop config from the npx dispatcher without
an operator pasting JSON is **not** part of this contract — Claude Desktop
restarts and config-merge semantics make silent rewrites a footgun. The
copy-paste path stays the canonical install shape until non-dev recruit
evidence under `agents/evidence/eval-findings/` demonstrates the manual step is the
actual adoption blocker.

## Consequences

- Adding a third tool to the MCP server is a code-review event against
  `ALLOWLIST` in `scripts/mcp_server/tools.py`. No settings flag, no env
  var, no dynamic registration — see
  [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md) Phase 4 amendment.
- Picking up a future protocol break (MCP SDK 2.x) is one pin bump in
  `scripts/mcp_server/requirements.txt`, gated on the 12 import-surface +
  behaviour tests in `tests/test_mcp_server.py` staying green.
- Re-opening FastMCP or the TypeScript SDK requires a new ADR that
  supersedes this one with evidence (Python SDK shipping a deprecation
  or FastMCP closing the safety-audit gap on `tools/*`).

## See also

- [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md) — Phase 1–6 hard contract.
- [`mcp-cloud-scope.md`](mcp-cloud-scope.md) — hosted Worker bridge scope.
- [`mcp-tool-stub-envelope.md`](mcp-tool-stub-envelope.md) — unimplemented-tool wire shape.
