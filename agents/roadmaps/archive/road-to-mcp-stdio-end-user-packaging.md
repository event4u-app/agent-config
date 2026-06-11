---
status: ready
complexity: structural
parent_roadmap: road-to-glama-registry-listing
---

# Road to a turnkey end-user stdio MCP server — packaging the local server for people who configure agents, not clone repos

> **Origin:** spun out of `road-to-glama-registry-listing` Phase 0. The Glama
> listing targets agent developers / contributors; this roadmap covers the
> **other** audience the maintainer named — end-users configuring pre-built
> agents — who today cannot use the stdio MCP server without cloning the repo.
> Held at `status: draft` (off the active dashboard) until the precondition
> fires, so it does not compete for execution attention prematurely.

## Precondition — promote `draft → ready` only when demand is real

The council's caution stands: do not build end-user packaging on spec. Promote
this roadmap to `ready` when **any** of these is true, and record the trigger in
Phase 1's ADR:

- A named inbound request (issue / PR / Glama-sourced report) asks to run the
  server without cloning the repo.
- A second consumer project needs the stdio server as a turnkey dependency.
- The maintainer decides to position the package for end-users explicitly.

Until then this file is the captured plan, not active work.

## The core open question (Phase 1 must answer it first)

The stdio server today is **CLI-first internal tooling, not a library**:

- `task mcp:run` requires the cloned repo + `.venv-mcp/` + `PYTHONPATH=src`.
- The only client-config template (`claude_desktop_config.json.template`) +
  `docs/setup/mcp-client-config.md` target the **remote Cloudflare Worker** via
  `mcp-remote` — there is **no stdio client template** for end-users.
- `mcp_scope: full` (the local kernel) depends on the package's ~112 scripts on
  disk + a consumer `.agent-settings.yml`. A turnkey distributable must either
  **bundle those** (heavier package) or ship a **read-only lite subset** for
  end-users. That choice is the whole design — make it explicitly, do not drift
  into it.

## Phase 1 — Decide the distribution shape (ADR, no code)

- [x] Pick the end-user scope: full local kernel (bundle scripts + venv) vs a
  read-only lite subset (skills/commands/rules/guidelines, no execution tools).
  Name the trade-off (package weight + maintenance vs capability) in an ADR.
  <!-- done: A2 read-only stdio-lite. ADR-085. Council (claude-sonnet-4-5 + gpt-4o, 2026-06-10): round-1 split A2×B1/A1×B2, tie-break converged A2×B1. Full-kernel execution (A1) deferred to a later phase, no demand evidence; minimal-safe-diff + YAGNI. -->
- [x] Pick the launch channel: the existing `@event4u/agent-config` npm bin, or
  `pipx` / `uvx` for the Python server, or a bundled venv bootstrap. One channel,
  with the reason.
  <!-- done: B1 existing npm bin, pure-Node. ADR-085. A1×B1 (Node bin spawning Python) rejected as fatal — stdout pollution breaks JSON-RPC; channel must match impl language. Pure-Node serves bundled dist/ content (the hosted lite Worker already proves the read-only-from-blob pattern in TS). -->
- [x] Record the demand trigger that promoted this roadmap (per precondition).
  <!-- done: maintainer decision 2026-06-10 ("position the package for end-users") — recorded in ADR-085 § Demand trigger. Note: positioning for end-users, NOT proven execution demand → Phase-2 trigger in the ADR. -->

## Phase 2 — Turnkey launch entrypoint

- [x] Provide a single command that launches the stdio server with dependencies
  resolved and **no repo clone** — the chosen channel from Phase 1. Must not
  require the user to know `PYTHONPATH`, the venv path, or the module name.
  <!-- done: `agent-config mcp-server` (native TS command). Pure-Node stdio-lite server (src/cli/mcp/{content,dispatch,stdio}.ts + commands/mcpServer.ts) reading the bundled dist/agent-src/ + docs/guidelines/ — zero Python/venv/PYTHONPATH. Wire shapes mirror the hosted Worker (handlers/prompts/resources) verbatim → multi-channel consistency. Read-only: tools/list empty, tools/call → not_implemented (ADR-085 defers execution). -->
- [x] Verify it runs on a clean machine (no prior checkout) end-to-end over
  stdio. <!-- carve-out: new-gate-verification -->
  <!-- done: tests/cli/mcp-server.e2e.test.ts spawns the compiled binary, drives a real initialize→prompts/list→resources/list→tools/list handshake over stdio, asserts STDOUT PURITY (every line JSON-RPC, readiness note on stderr — the ADR-085 fatal-flaw guard), clean exit on stdin close. + src/cli/mcp/{dispatch,content}.test.ts (pure goldens + real-tree load). 33 mcp/cli tests green; full TS suite 496 green; typecheck + eslint clean. Manual smoke: 531 entries served. -->

## Phase 3 — stdio client-config templates

- [x] Add copy-paste stdio client snippets (command + args) for Claude Desktop,
  Cursor, Zed, and Claude Code — the stdio counterpart to today's Worker-only
  `mcp-remote` templates. Keep the remote-Worker templates untouched.
  <!-- done: docs/setup/mcp-client-config.md § "Local stdio (turnkey)" — 4 client snippets all `command: agent-config, args: [mcp-server]` (+ npx fallback) + a "Verify the local server" stdio drive. Remote-Worker per-client sections + claude_desktop_config.json.template untouched. Doc-only (the roadmap's "templates" = the per-client snippets; a separate .template file would pull in claude_desktop_bundler wiring — out of scope). -->
- [x] Distinguish the two paths in the docs so users do not confuse the local
  stdio entry with the self-hosted Worker entry.
  <!-- done: new "## Two ways to connect — pick one" table (command vs URL, needs, network/account, surface, best-for) + a "don't mix them up" note; H1/intro reframed from "Self-hosted Worker" to both paths; Transport note contrasts local-stdio (no bridge) vs remote (mcp-remote bridge); contributor clone-based kernel kept as a sub-note. -->

## Phase 4 — End-user docs + smoke

- [x] Write a short "Getting Started (local stdio)" page aimed at end-users, not
  contributors.
  <!-- done: docs/getting-started-local-stdio.md — install → point your client (links the mcp-client-config § Local stdio snippets) → verify → what-you-get/don't (read-only, ADR-085) → troubleshooting table. Explicitly end-user-facing; contributor clone path linked out to mcp-server.md. -->
- [x] Extend smoke coverage to the packaged launch path (a new check, or a flag
  on `src/scripts/mcp_parity_smoke.py`), so the turnkey path cannot rot silently.
  <!-- carve-out: new-gate-verification -->
  <!-- done: `--node-stdio` flag on mcp_parity_smoke.py — spawns the built `agent-config mcp-server`, paginates the FULL prompts+resources surface over stdio, diffs the ADR-085 subset (skill/command prompts, rule/guideline resources; contexts excluded by design) against the Python source-of-truth, asserts tools/list empty. + `task mcp:parity-stdio`. Ran locally: 377 prompts + 154 resources parity, tools empty. It CAUGHT a real Phase-2 loader bug (top-level guidelines got a spurious `guidelines/` prefix + lost nesting) — fixed in content.ts (relpath-from-guidelines-root, mirrors resources.py) + a CI-resident regression assertion in content.test.ts. -->
- [x] **(bug fix surfaced by the smoke)** content.ts guideline naming now mirrors the Python `guideline://<relpath-no-ext>` convention; regression-guarded in content.test.ts.

## Out of scope

- Anything touching the remote Cloudflare Worker / Glama hosting.
- Promoting the experimental Worker to end-users.
- Changing the `mcp_scope: full` contract (`docs/contracts/mcp-phase-1-scope.md`)
  — packaging consumes it, does not rewrite it.
- Multi-tenancy or per-user auth on the stdio surface (it is filesystem-trusted
  by design).

## Acceptance criteria

- Phase 1 ADR records the scope (full vs lite) + channel + the demand trigger.
- An end-user can install and run the stdio server, and point a client at it,
  without cloning the repo or editing `PYTHONPATH`.
- stdio client templates exist alongside (not replacing) the Worker templates.
- The packaged launch path has smoke coverage.
- The remote-Worker setup story is unchanged.
