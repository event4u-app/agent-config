---
adr: 085
status: accepted
date: 2026-06-10
decision: mcp-stdio-end-user-distribution-shape
supersedes: —
superseded_by: —
phase: mcp-stdio-end-user-packaging Phase 1 (road-to-mcp-stdio-end-user-packaging)
type: structural
---

# ADR-085 — Distribution shape for the turnkey end-user stdio MCP server

## Status

**Accepted** · 2026-06-10. Phase 1 (decision-only, no code) of
[`road-to-mcp-stdio-end-user-packaging`], promoted from `draft → ready` by an
explicit maintainer decision (the demand trigger, recorded below). Resolved via
a two-round peer-reviewed AI-council session plus a tie-break round
(claude-sonnet-4-5 + gpt-4o, 2026-06-10) — split in round 1 (A2×B1 vs A1×B2),
**converged on A2×B1** in the tie-break.

## Context

`@event4u/agent-config` already ships **two** MCP surfaces under a named-scope
model:

- `mcp_scope: lite` — a **hosted Cloudflare Worker** (`internal/workers/mcp/`,
  TypeScript) serving governance content as read-only MCP prompts + resources
  (skills/commands/rules/guidelines) plus a few read-only tools, from a
  release-pinned R2 blob. Never executes, never touches consumer FS.
- `mcp_scope: full` — a **local stdio kernel** (`src/scripts/mcp_server/`,
  Python) that can execute tools and depends on ~112 on-disk scripts + a
  consumer `.agent-settings.yml`. Launched today only from a cloned repo:
  `PYTHONPATH=src .venv-mcp/bin/python -m scripts.mcp_server`.

The npm bin already exists: `agent-config` → `dist/cli/agent-config.js` (Node
≥20). There is **no** stdio client-config template for end-users; the only
templates target the remote Worker via `mcp-remote`.

**Gap.** End-users who *configure* pre-built agents (Claude Desktop / Cursor /
Zed / Claude Code) cannot run a **local** stdio server without cloning the repo
and building a venv. The decision is the whole design — two coupled axes:
**scope** (full execution vs read-only lite) and **launch channel** (npm-Node vs
pipx/uvx vs bundled-venv).

### Demand trigger (recorded per the roadmap precondition)

The roadmap is promoted on the precondition clause *"the maintainer decides to
position the package for end-users explicitly."* That decision was made on
2026-06-10 (maintainer instruction: "promote mcp-stdio, do Phase 1"). The
trigger is **positioning for end-users who configure agents** — note it does
**not** state those users need *execution*; it states they need local access to
the content.

## Decision

**A2 × B1** — a local **stdio-lite** server, pure-Node, launched via the
existing `@event4u/agent-config` npm bin. It serves the shipped `dist/`
governance content (skills / commands / rules / guidelines) as MCP prompts +
resources plus the read-only tools (`memory_lookup`, `list_*`,
`read_resource_body`). **No Python, no venv, no execution, no consumer-FS
writes.**

This is architecturally proven: the hosted lite Worker already does exactly this
in TypeScript from an R2 blob; the local server reads the bundled `dist/`
instead. A local stdio-lite adds an **offline / no-account / Worker-outage
fallback** path — a reliability hedge, cheap to ship in Node, with no
Node→Python handoff.

### Why not the alternatives

- **A1×B1 (full Python kernel launched by the Node bin) — rejected as fatal.**
  A long-running stdio daemon needs a clean stdin/stdout JSON-RPC contract; a
  Node shim spawning Python leaks (npm update checks, debug logs, stderr) and
  breaks the protocol. Both council members converged on this. The channel
  **must** match the implementation language: A2→B1 (pure Node) or A1→B2 (pure
  Python). No mixed handoff.
- **A1×B2 (full Python kernel via pipx/uvx) — deferred, not chosen.** It ships
  the ~112 executable scripts and therefore demands a platform matrix
  (linux-x64 / darwin-arm64 / win32-x64), a supply-chain threat model, a
  first-run consent flow, and a kill-switch — all Phase-1-blocking. There is **no
  evidence** end-users need execution (vs content access); committing that
  surface now is building the maximal surface for a speculative problem, against
  `minimal-safe-diff` + YAGNI and the council's standing "do not build end-user
  packaging on spec" caution.
- **B3 (bundled venv / self-contained binary) — deferred.** Only justified if a
  material fraction of the audience has *neither* Node nor Python; no such data
  exists, and the stated clients (Claude Desktop / Cursor / Zed / Claude Code)
  overwhelmingly carry Node.

## Consequences

### Trade-off the maintainer accepts

**Zero local script execution in Phase 1.** A user who needs to *run* a script
must file an issue or self-host the Python `full` kernel separately. The
turnkey path serves content access only.

### Phase-2 upgrade trigger (when the deferred execution axis flips)

Flip to A1×B2 scoping (platform matrix + consent UI + sandboxing) when **any**
of:

- **≥ 3** end-user issues request execution of *named* scripts (any tier), **or**
- **≥ 1** issue requests a *write / mutate* script (flips immediately — higher
  risk), **or**
- **≥ 1** corporate adopter requires auditable local execution.

(The tie-break preferred this tighter, falsifiable trigger over a flat "≥ 20
requests"; the threshold remains the maintainer's to tune.)

### Phase-2 prerequisites surfaced now (council blind-spot fold-in)

These are **not** Phase-1 work (Phase 1 is ADR-only) but the roadmap's later
phases should land them so a Phase-2 flip is a configuration change, not a
discovery project:

- A **script-dependency manifest** (each script's PyPI/stdlib imports) +
  **execution-tier tags** (read-only / mutate / network) + a one-time **CVE
  baseline scan** (`pip-audit` / `safety`), e.g. `dist/scripts-meta.json`.
- A **`list-scripts`** discoverability tool that surfaces the corpus with tier +
  availability metadata ("execution: deferred to Phase 2") so end-users see what
  exists without it being runnable.

### Positive

- Smallest turnkey path that solves the *stated* problem (local content access).
- No new packaging toolchain, no venv, no platform matrix, no execution security
  surface in Phase 1.
- Multi-channel content consistency + a Worker-outage fallback.

### Negative / cost

- Read-only MCP tools (`memory_lookup`, `list_*`, `read_resource_body`) get a
  Node reimplementation (~200–300 LOC) over the shipped `dist/` artefacts,
  duplicating the Python handlers. Accepted as a one-time tax that buys the
  elimination of the trust-boundary, platform-matrix, and rollback complexity
  A1 would introduce.

## Alternatives

| Shape | Verdict |
|---|---|
| **A2×B1** pure-Node stdio-lite via npm bin | **Chosen** — minimal-safe-diff, no handoff, reliability hedge |
| A1×B2 full Python kernel via pipx/uvx | Deferred — no execution-demand evidence; heavy security surface |
| A1×B1 full kernel via Node bin | Rejected (fatal) — Node→Python stdout pollution breaks JSON-RPC |
| B3 bundled venv / self-contained binary | Deferred — only for a no-runtime audience; no data |

## References

- Roadmap: `road-to-mcp-stdio-end-user-packaging` Phase 1 (under `agents/roadmaps/`).
- [`ADR-067`](ADR-067-glama-registry-listing.md) — the Glama listing (targets
  *contributors*; this ADR targets *end-users*).
- [`mcp-cloud-scope`](../contracts/mcp-cloud-scope.md) — the lite/full scope model.
- [`mcp-phase-1-scope`](../contracts/mcp-phase-1-scope.md) — owns `scripts/mcp_server/` (local stdio).
- Council convergence: claude-sonnet-4-5 + gpt-4o, 2026-06-10 (round 1 split
  A2×B1 / A1×B2, tie-break converged A2×B1).
