---
status: ready
complexity: standard
---

# Roadmap: Read-only cross-agent MCP discovery helper

> Goal: give users a `agent-config mcp search <query>` command that finds MCP
> servers across registries (official + Glama, registry-agnostic) and emits a
> copy-paste install snippet **per supported agent** — writing nothing, touching
> no secrets. Implements the decision in
> [`ADR-086`](../../docs/decisions/ADR-086-read-only-cross-agent-mcp-discovery-helper.md).

Auto-install (writing config into every agent) is explicitly **out of scope** —
deferred to a future security-first ADR, gated on this helper's adoption.

Driven by the AI-council convergence of 2026-06-10 (claude-sonnet-4-5 + gpt-4o,
design mode): ship discovery read-only first, use it as the demand test.

## Phase 0: Demand gate + fact-finishing — decide whether to proceed at all

A real gate. If the demand signal is weak, the rational outcome is to stop here.

- [ ] **Step 1:** Add a one-question demand probe to the next release notes / changelog: "Do you use multiple AI coding agents in the same project, and is keeping MCP-server config in sync across them painful?" (very / somewhat / single-agent / self-scripted). Record where responses land.
- [ ] **Step 2:** Verify Smithery's actual client coverage — does its CLI configure Augment / Windsurf / Cline / Copilot, or only Claude + Cursor? Capture the verbatim client list. If Smithery already covers our full agent set read-write, reassess whether even discovery is non-duplicative.
- [ ] **Step 3:** Verify the official registry `/v0/servers` query contract and Glama API auth requirement (does the Glama `/api/mcp/v1` endpoint need a key?). Record the verified request shapes.
- [ ] **Step 4:** Gate decision — surface findings as numbered options (proceed to Phase 1 / pause for more signal / stop per ADR-086 Option C). Do not enter Phase 1 without an explicit proceed.

## Phase 1: Registry query + normalize to server.json

- [ ] **Step 1:** Add a registry-agnostic client module under `src/scripts/` with a thin adapter per source (official registry primary, Glama enrichment). Each adapter returns the canonical `server.json` shape.
- [ ] **Step 2:** Normalizer — merge official + Glama records into one result object: `name`, `description`, `packages[]` (registryType, identifier, transport, runtimeHint, packageArguments), `environmentVariables[]` (with `isSecret`), `remotes[]`, `repository`, optional Glama quality signal (labeled as such, never presented as a safety guarantee).
- [ ] **Step 2a:** Cache responses on disk with a short TTL so repeated searches do not re-hit the network. Verify: `pytest` on the normalizer + cache module passes.
- [ ] **Step 3:** Graceful degradation — if Glama is unreachable or unauthenticated, fall back to official-registry-only results with a one-line note. Verify with a unit test that stubs a Glama failure.

## Phase 2: Per-agent copy-paste install rendering

- [ ] **Step 1:** Build a per-agent renderer that turns one normalized server record into the correct config snippet/command for each supported agent: Claude Code (`.mcp.json` / `claude mcp add`), Cursor (`.cursor/mcp.json`), Windsurf, Cline, VS Code/Copilot (`.vscode/mcp.json`), Augment. Source the per-agent target paths from one shared table so adding an agent is one edit.
- [ ] **Step 2:** Secret handling — render `isSecret` env vars as placeholders (e.g. `<YOUR_API_KEY>`) the user fills in; never fetch, store, or write a secret. Verify: a unit test asserts no snippet path writes to disk and secret vars stay placeholders.
- [ ] **Step 3:** Wire the `agent-config mcp search <query>` CLI entry point: query → normalize → render. Default output shows the matched servers + env-var table + per-agent snippets. Verify: run the CLI against a known server (e.g. a filesystem server) and confirm the snippets are valid for at least Claude Code + Cursor.

## Phase 3: Adoption signal + auto-install decision checkpoint

- [ ] **Step 1:** Add lightweight, opt-in usage counting for `mcp search` (respecting the existing telemetry default-off posture) so adoption is measurable.
- [ ] **Step 2:** Document in `src/skills/mcp/SKILL.md` how the discovery helper fits the MCP workflow (discovery vs. the deferred install question).
- [ ] **Step 3:** Decision checkpoint — once adoption data exists, surface a numbered-options decision: pursue auto-install under a new security-first ADR, keep discovery-only, or retire the helper. This roadmap closes here; auto-install, if pursued, is its own roadmap.

## Acceptance criteria

- `agent-config mcp search <query>` returns normalized results from the official
  registry, enriched by Glama when available, degrading gracefully when not.
- For every supported agent, the helper emits a correct copy-paste install snippet
  with `isSecret` env vars rendered as user-filled placeholders.
- The helper writes nothing to any agent config and never handles a real secret.
- Adding a new agent to the per-agent renderer is a single-table edit.
- Phase 0's demand gate was passed with an explicit proceed (or the roadmap
  stopped there per ADR-086 Option C).
