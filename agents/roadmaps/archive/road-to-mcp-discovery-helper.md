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

- [x] **Step 1:** Add a one-question demand probe to the next release notes / changelog: "Do you use multiple AI coding agents in the same project, and is keeping MCP-server config in sync across them painful?" (very / somewhat / single-agent / self-scripted). Record where responses land. <!-- done: probe added to CHANGELOG.md ## [Unreleased] "Feedback wanted" callout; responses land in GitHub Discussions. -->
- [x] **Step 2:** Verify the comparable external installer's actual client coverage — does its CLI configure Augment / Windsurf / Cline / Copilot, or only Claude + Cursor? Capture the verbatim client list. If that installer already covers our full agent set read-write, reassess whether even discovery is non-duplicative. <!-- done 2026-06-11: from the external installer's client config (VALID_CLIENTS, 23 entries): Claude Code, VS Code, VS Code Insiders, Gemini CLI, Codex, Cursor, Claude Desktop, Witsy, Enconvo, Roo Code, BoltAI, Amazon Bedrock, Amazon Q, Tome, LibreChat, Windsurf, Cline, OpenCode, Goose, Antigravity, Kiro, Zed, Trae. Covers 5/6 of our agents read-WRITE (Claude Code, Cursor, Windsurf, Cline, VS Code/Copilot) — MISSING Augment. The external installer does install (write), not read-only discovery, and is single-registry (its own). Differentiation survives but duplication risk is material → council gate. -->
- [x] **Step 3:** Verify the official registry `/v0/servers` query contract and Glama API auth requirement (does the Glama `/api/mcp/v1` endpoint need a key?). Record the verified request shapes. <!-- done 2026-06-11 (live-checked): Official registry GET https://registry.modelcontextprotocol.io/v0/servers?search=<q>&limit=<n>&cursor=<c> → 200 NO AUTH; response {servers:[{server:<server.json>,_meta:{...registry/official:{status,publishedAt,updatedAt,isLatest}}}],metadata:{nextCursor,count}}. server.json fields: $schema,name,description,title,version,repository{url,source,subfolder},packages[]{registryType,registryBaseUrl,identifier,version,runtimeHint,transport{type},runtimeArguments[],environmentVariables[]{name,description,isRequired,isSecret,default}},remotes[]{type,url}. Glama GET https://glama.ai/api/mcp/v1/servers?first=<n>&after=<cursor> → 200 NO AUTH (key NOT required); response {pageInfo{endCursor,hasNextPage,...},servers[]{id,name,namespace,slug,description,attributes[],environmentVariablesJsonSchema(JSON-Schema),repository{url},spdxLicense{name,url},tools[],url}}. -->
- [x] **Step 4:** Gate decision — surface findings as numbered options (proceed to Phase 1 / pause for more signal / stop per ADR-086 Option C). Do not enter Phase 1 without an explicit proceed. <!-- DECIDED 2026-06-11: STOP per ADR-086 Option C. AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, design mode) converged STOP — see "Gate outcome" below. No explicit proceed → Phases 1–3 cancelled. -->

## Gate outcome — STOP (Phase 0 closed the roadmap)

The Phase-0 demand gate fired its designed STOP. The AI council
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, design mode, 2026-06-11) **converged
on STOP per ADR-086 Option C**, on three grounds:

1. **Demand gate failed** — zero responses to the demand probe; ADR-086 itself made
   "weak signal → stop" the gate condition.
2. **Sequencing inversion** — a comparable external installer already does the *harder*
   capability (install, read-write) for **5 of our 6 target agents** (Claude Code, Cursor,
   Windsurf, Cline, VS Code/Copilot; verified from its client config). A read-only
   discovery tool for the same 5 is strictly weaker; the lone gap is Augment.
3. **Surviving value is doc-shaped, not tool-shaped** — registry-agnostic coverage is
   a comparison matrix (cheap doc), not a 500-line CLI. Building the CLI also creates
   sunk-cost bias toward reimplementing (vs. wrapping) the external installer in any
   future Phase 2.

**Follow-up recommendations (not built here — net-new scope / external):**
contribute Augment support upstream to the external installer's client list; ship a
registry coverage-matrix doc (official / Glama / the external installer) to capture the
registry-agnostic value. **Reopen criteria:** 5+ demand responses citing a need the
external installer cannot serve, OR it registry-locks / won't-fix Augment / shuts down.

## Phase 1: Registry query + normalize to server.json (CANCELLED — gate STOP)

- [-] **Step 1:** Add a registry-agnostic client module under `src/scripts/` with a thin adapter per source (official registry primary, Glama enrichment). Each adapter returns the canonical `server.json` shape. <!-- cancelled: Phase-0 gate STOP (no proceed). -->
- [-] **Step 2:** Normalizer — merge official + Glama records into one result object: `name`, `description`, `packages[]` (registryType, identifier, transport, runtimeHint, packageArguments), `environmentVariables[]` (with `isSecret`), `remotes[]`, `repository`, optional Glama quality signal (labeled as such, never presented as a safety guarantee). <!-- cancelled: Phase-0 gate STOP. -->
- [-] **Step 2a:** Cache responses on disk with a short TTL so repeated searches do not re-hit the network. Verify: `pytest` on the normalizer + cache module passes. <!-- cancelled: Phase-0 gate STOP. -->
- [-] **Step 3:** Graceful degradation — if Glama is unreachable or unauthenticated, fall back to official-registry-only results with a one-line note. Verify with a unit test that stubs a Glama failure. <!-- cancelled: Phase-0 gate STOP. -->

## Phase 2: Per-agent copy-paste install rendering (CANCELLED — gate STOP)

- [-] **Step 1:** Build a per-agent renderer that turns one normalized server record into the correct config snippet/command for each supported agent: Claude Code (`.mcp.json` / `claude mcp add`), Cursor (`.cursor/mcp.json`), Windsurf, Cline, VS Code/Copilot (`.vscode/mcp.json`), Augment. Source the per-agent target paths from one shared table so adding an agent is one edit. <!-- cancelled: Phase-0 gate STOP. -->
- [-] **Step 2:** Secret handling — render `isSecret` env vars as placeholders (e.g. `<YOUR_API_KEY>`) the user fills in; never fetch, store, or write a secret. Verify: a unit test asserts no snippet path writes to disk and secret vars stay placeholders. <!-- cancelled: Phase-0 gate STOP. -->
- [-] **Step 3:** Wire the `agent-config mcp search <query>` CLI entry point: query → normalize → render. Default output shows the matched servers + env-var table + per-agent snippets. Verify: run the CLI against a known server (e.g. a filesystem server) and confirm the snippets are valid for at least Claude Code + Cursor. <!-- cancelled: Phase-0 gate STOP. -->

## Phase 3: Adoption signal + auto-install decision checkpoint (CANCELLED — gate STOP)

- [-] **Step 1:** Add lightweight, opt-in usage counting for `mcp search` (respecting the existing telemetry default-off posture) so adoption is measurable. <!-- cancelled: Phase-0 gate STOP. -->
- [-] **Step 2:** Document in `src/skills/mcp/SKILL.md` how the discovery helper fits the MCP workflow (discovery vs. the deferred install question). <!-- cancelled: Phase-0 gate STOP. -->
- [-] **Step 3:** Decision checkpoint — once adoption data exists, surface a numbered-options decision: pursue auto-install under a new security-first ADR, keep discovery-only, or retire the helper. This roadmap closes here; auto-install, if pursued, is its own roadmap. <!-- cancelled: Phase-0 gate STOP. -->

## Acceptance criteria

> **Met via the STOP path.** The final criterion is satisfied: Phase 0's demand gate
> resolved to **stop per ADR-086 Option C** (AI-council convergence, 2026-06-11) — no
> explicit proceed was given, so the build criteria below are moot (Phases 1–3
> cancelled). See "Gate outcome" above.

- `agent-config mcp search <query>` returns normalized results from the official
  registry, enriched by Glama when available, degrading gracefully when not.
- For every supported agent, the helper emits a correct copy-paste install snippet
  with `isSecret` env vars rendered as user-filled placeholders.
- The helper writes nothing to any agent config and never handles a real secret.
- Adding a new agent to the per-agent renderer is a single-table edit.
- Phase 0's demand gate was passed with an explicit proceed (or the roadmap
  stopped there per ADR-086 Option C).
