# Road to MCP Server

**Status:** capture-only — design proposal + staged execution plan.
**Started:** 2026-05-01
**Trigger:** User asked whether agent-config is available as an MCP server. Answer: no — only consumer-side MCP usage docs exist. No server, no JSON-RPC surface.
**Mode:** Capture-only until Phase 1 is approved for execution.

## Purpose

Add an **MCP server distribution channel** parallel to (not replacing) the
existing file-projection model. MCP-aware clients (Claude Desktop, Continue,
Zed, Codex via MCP, future Cursor/Windsurf MCP integrations) connect to the
server and discover skills/rules/commands via JSON-RPC. Non-MCP clients
(Aider, current Cursor, Cline, Windsurf, Gemini CLI) keep consuming the
projected files. Both channels coexist.

This is positioned as a **distinguishing feature** — `claude-skills` does not
ship an MCP server today. agent-config has the architectural advantage
(single source of truth) needed to do this cleanly.

## Why this is a separate roadmap

Multi-client expansion (A1–A8 in `road-to-better-skills-and-profiles.md`)
adds **file-projection** targets (Aider, Codex, Kilo Code, …). MCP server is
a **protocol-projection** target — orthogonal axis, separate dependencies,
separate distribution model. Mixing both in one roadmap obscures the trade-offs.

## Architecture decisions (locked in capture-only)

| Decision | Choice | Rationale |
|---|---|---|
| Language | Python 3.10+ | Matches existing `scripts/` tooling; one runtime, no Node dependency added. |
| Transport | stdio (primary), SSE deferred | stdio is universally supported by MCP clients; SSE only needed for cloud/remote. |
| Location | `scripts/mcp_server/` | Lives alongside `work_engine/`, `command_suggester/`. Same import shape. |
| Entrypoint | `python -m scripts.mcp_server` | Conventional Python module entrypoint. Aligns with `python -m pytest`. |
| SDK | Anthropic `mcp` Python SDK (PyPI) | Official SDK; assumed stable as of 2026-05 — verify in A1 before committing. |
| Distribution | Bundled with package | No separate publish; package install brings the server. Cloud bundle equivalent deferred. |
| Versioning | Server version = package version | One coordinate; skill-version drift is a Phase 6 concern. |

## Capability mapping

| MCP Capability | Source | Mapping shape |
|---|---|---|
| `prompts/list`, `prompts/get` | Skills (~128) + Commands (~77) | One prompt per `SKILL.md` / command file. Frontmatter `description` → MCP prompt description. Body → prompt text. |
| `resources/list`, `resources/read` | Rules (~53) + Guidelines (~46) + Contexts | URIs: `rule://<name>`, `guideline://<name>`, `context://<name>`. |
| `tools/list`, `tools/call` | Engine helpers | `lint_skills`, `chat_history.append`, `work_engine.refine` (subset), `compress`, … — explicit allowlist, not auto-exposed. |

**Locked decision:** prompts and resources are **read-only projections** of
existing files. No new content authored MCP-side. Tools are an explicit
allowlist; arbitrary script execution is **never** exposed.

## Scope of MVP — Phase 1

Smallest useful surface that proves the concept end-to-end:

- 5 hand-picked skills as prompts (representative cross-section).
- stdio transport.
- `prompts/list` + `prompts/get` only.
- Smoke-tested in **one** real client (Claude Desktop most likely — verify
  in A2 which clients accept stdio MCP servers without paid tier).
- No README/setup-doc claims yet — the 3-line README teaser only points to
  the proposal page until Phase 5.

## Phase 1 — MVP Skeleton

Estimated effort: 1-2 dev days, gated on SDK verification.

- [ ] **A1** — Verify `mcp` Python SDK: install, check capability surface, confirm stdio handler API. If SDK is unstable or missing required capabilities, **stop** and re-plan in capture-only.
- [ ] **A2** — Confirm at least one MCP-aware client supports stdio Python servers without paid features (Claude Desktop free tier, Zed, Continue, …). One confirmed client = Phase 1 unblocked.
- [ ] **A3** — `scripts/mcp_server/__init__.py` + `__main__.py` entrypoint, stdio transport boilerplate.
- [ ] **A4** — `prompts/list` returns 5 hand-picked skills (frontmatter → MCP prompt metadata). Picks: `pest-testing`, `eloquent`, `conventional-commits-writing`, `refine-ticket`, `react-shadcn-ui` — verify these exist in `.agent-src/skills/` before locking.
- [ ] **A5** — `prompts/get` returns the SKILL.md body (compressed `.agent-src/` form, not uncompressed).
- [ ] **A6** — Manual smoke test in confirmed client from A2; record session transcript in `agents/roadmaps/sessions/`.
- [ ] **A7** — `tests/test_mcp_server.py` — at minimum: prompts/list returns ≥5 entries, prompts/get returns non-empty body, JSON-RPC envelope is valid.

## Phase 2 — Full skill + command coverage

- [ ] **B1** — `prompts/list` iterates all skills + commands from `.agent-src/`.
- [ ] **B2** — Filter by `source: package` vs `source: project` (overrides) — clients see merged view.
- [ ] **B3** — Frontmatter validation: skip prompts with malformed YAML, log warning.
- [ ] **B4** — Pagination — MCP clients may not handle 200+ prompts in one list response.
- [ ] **B5** — Hot-reload on file change (dev convenience, not production requirement).

## Phase 3 — Resources (rules, guidelines, contexts)

- [ ] **C1** — URI scheme: `rule://`, `guideline://`, `context://`. Document in proposal page.
- [ ] **C2** — `resources/list` enumerates all rules + guidelines + contexts.
- [ ] **C3** — `resources/read` returns body. Same `.agent-src/` source as prompts.
- [ ] **C4** — MIME type: `text/markdown` for all.

## Phase 4 — Tools (engine helpers)

Highest-risk phase — exposing tools means real side effects on the consumer's
filesystem. Design call needed before writing code.

- [ ] **D1** — Decision call: which `work_engine` surface is safe to expose? Probably read-only first (`refine` step output without commit), never `apply`.
- [ ] **D2** — `lint_skills` as MCP tool — pure read, safe.
- [ ] **D3** — `chat_history.append` as MCP tool — writes a project file. Needs explicit user consent in MCP client UI.
- [ ] **D4** — Allowlist enforced at server boot: tools not in allowlist are unreachable, not just unlisted.

## Phase 5 — Real setup docs (the deliverable from option 3)

Only runs **after** A1-A7 are green and a real client renders prompts.

- [ ] **E1** — `docs/mcp-server.md` "How to set it up" — copy-paste config for Claude Desktop, Cursor, Zed (verify each one against a live install at write time).
- [ ] **E2** — `docs/proposals/mcp-server.md` retired or rewritten as design doc (kept for history).
- [ ] **E3** — README "MCP Server" section (3-5 lines under "Multi-agent tool support" + link to `docs/mcp-server.md`). Hardcap-aware (500-line ceiling).
- [ ] **E4** — `AGENTS.md` "Multi-agent tool support" table gets a new MCP Server row.
- [ ] **E5** — Highlight in `README.md` hero/positioning section as distinguishing feature vs `claude-skills`.

## Phase 6 — Distribution polish (deferred)

- [ ] **F1** — Versioning strategy: server version vs skill-set version vs package version.
- [ ] **F2** — SSE transport for cloud / remote.
- [ ] **F3** — Cloud bundle equivalent — running server image (Docker?) for hosted scenarios.
- [ ] **F4** — Plugin marketplace listing (tied to identity decision in `road-to-better-skills-and-profiles.md`).

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| MCP Python SDK unstable / missing capabilities | High | A1 is a hard gate. If SDK doesn't deliver, roadmap stays capture-only. |
| No client accepts stdio Python servers without paid tier | High | A2 is a hard gate. If no free path exists, scope reduces to "for paid users only" or roadmap pauses. |
| Tools phase exposes destructive ops | High | Explicit allowlist; D1 is a design call before any code. |
| Hot-reload (B5) introduces race conditions | Medium | Defer; MVP is read-on-startup. |
| Client UX inconsistency (each client renders prompts differently) | Medium | Test in 2+ clients during Phase 1. Document client-specific quirks in `docs/mcp-server.md`. |
| Bloat: shipping MCP runtime to non-MCP users | Low | `mcp` SDK as optional dependency; server only imported when entrypoint runs. |

## Open questions

- Should commands be exposed as prompts, or as something else (MCP doesn't have a "command" primitive)? Defer to Phase 2 design.
- Project-local overrides vs package skills — merge order in `prompts/list`?
- Telemetry / artifact-engagement: does an MCP-prompt fetch count as "applied"?
- Multi-tenancy: one server per project (today's assumption) or one shared server with project switching?

## Reference

- `docs/architecture.md` — projection model description.
- `road-to-better-skills-and-profiles.md` § "Multi-client expansion" — sister roadmap, file-projection axis.
- `.agent-src.uncompressed/skills/mcp/SKILL.md` — current consumer-side MCP skill (will be expanded once we ship our own server).
- Anthropic MCP spec — verify URL + version in A1 before locking.

## Next step

Pending user confirmation: promote Phase 1 (A1–A7) out of capture-only and start with A1 (SDK verification).
