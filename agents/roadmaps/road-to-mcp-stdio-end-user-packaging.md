---
status: draft
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

- [ ] Pick the end-user scope: full local kernel (bundle scripts + venv) vs a
  read-only lite subset (skills/commands/rules/guidelines, no execution tools).
  Name the trade-off (package weight + maintenance vs capability) in an ADR.
- [ ] Pick the launch channel: the existing `@event4u/agent-config` npm bin, or
  `pipx` / `uvx` for the Python server, or a bundled venv bootstrap. One channel,
  with the reason.
- [ ] Record the demand trigger that promoted this roadmap (per precondition).

## Phase 2 — Turnkey launch entrypoint

- [ ] Provide a single command that launches the stdio server with dependencies
  resolved and **no repo clone** — the chosen channel from Phase 1. Must not
  require the user to know `PYTHONPATH`, the venv path, or the module name.
- [ ] Verify it runs on a clean machine (no prior checkout) end-to-end over
  stdio. <!-- carve-out: new-gate-verification -->

## Phase 3 — stdio client-config templates

- [ ] Add copy-paste stdio client snippets (command + args) for Claude Desktop,
  Cursor, Zed, and Claude Code — the stdio counterpart to today's Worker-only
  `mcp-remote` templates. Keep the remote-Worker templates untouched.
- [ ] Distinguish the two paths in the docs so users do not confuse the local
  stdio entry with the self-hosted Worker entry.

## Phase 4 — End-user docs + smoke

- [ ] Write a short "Getting Started (local stdio)" page aimed at end-users, not
  contributors.
- [ ] Extend smoke coverage to the packaged launch path (a new check, or a flag
  on `src/scripts/mcp_parity_smoke.py`), so the turnkey path cannot rot silently.
  <!-- carve-out: new-gate-verification -->

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
