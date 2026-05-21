---
complexity: lightweight
---

# Road to MCP Server

**Status:** Phase 1 + 2 + 3 + 4 + 5 + Phase 6 F1/F3 done — F2 + F4 deferred to `road-to-mcp-distribution.md`. Roadmap closed at 26/26 countable.
**Started:** 2026-05-01
**Trigger:** User asked whether agent-config is available as an MCP server. Answer: no — only consumer-side MCP usage docs exist. No server, no JSON-RPC surface.
**Mode:** Phase 2 (B1–B5) and Phase 3 (C1–C4) executed on `feat/road-to-mcp-server` after Phase 1 GUI smoke confirmed in Claude Desktop 2026-05-10. Adoption-barrier fixes (`task mcp:setup`, Lint-Bot JSON-fallback) shipped alongside Phase 3. Phase 4 (D1–D4) executed 2026-05-10 after AI Council Design Call D1 locked the security boundary. Phase 6 F1/F3 executed 2026-05-10 after AI Council 3-round convergence on the distribution verdict; F2 and F4 deferred to `road-to-mcp-distribution.md` after the F4 closure call (2026-05-10) confirmed F4 is a deployment primitive, not Phase-1 polish.

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

## Phase ordering

- Phase 1 (A1–A7) — MVP skeleton: SDK verify (A1), free-tier client confirm
  (A2), `scripts/mcp_server/` entrypoint, `prompts/list` + `prompts/get` for
  5 hand-picked stack-agnostic skills, smoke test in one client, base test
  suite. Gated on A1 + A2 succeeding.
- Phase 2 (B1–B5) — full skill + command coverage, pagination, hot-reload.
- Phase 3 (C1–C4) — resources (rules · guidelines · contexts).
- Phase 4 (D1–D4) — tools (engine helpers, allowlist) — design call required first.
- Phase 5 (E1–E5) — real setup docs + README/AGENTS surfaces.
- Phase 6 (F1–F4) — distribution polish (versioning, SSE, cloud bundle, marketplace).

Phases 2+ stay capture-only until Phase 1 ships a working stdio prompt fetch
in at least one confirmed client.

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

- [x] **A1** — Verify `mcp` Python SDK: install, check capability surface, confirm stdio handler API. If SDK is unstable or missing required capabilities, **stop** and re-plan in capture-only. _Done 2026-05-10 — `mcp` v1.27.1 verified under Python 3.11.15 (`.venv-mcp`); `Server`, `stdio_server`, `InitializationOptions`, `Prompt`, `GetPromptResult`, `PromptMessage`, `TextContent` all resolve._
- [x] **A2** — Confirm at least one MCP-aware client supports stdio Python servers without paid features (Claude Desktop free tier, Zed, Continue, …). One confirmed client = Phase 1 unblocked. _Done 2026-05-10 — Claude Desktop (free), Zed, and Continue all support stdio MCP servers without a paid tier per their published docs._
- [x] **A3** — `scripts/mcp_server/__init__.py` + `__main__.py` entrypoint, stdio transport boilerplate. _Done 2026-05-10 — `scripts/mcp_server/{__init__,__main__,server,prompts}.py`. `python -m scripts.mcp_server` boots clean._
- [x] **A4** — `prompts/list` returns 5 hand-picked skills (frontmatter → MCP prompt metadata). Picks: `verify-completion-evidence`¹, `systematic-debugging`, `test-driven-development`, `refine-ticket`, `conventional-commits-writing` — stack-agnostic on purpose, so the demo lands on any consumer regardless of language/framework. _Done 2026-05-10 — `scripts/mcp_server/prompts.py::PHASE_1_SKILLS`._<br>¹ Original list named `verify-before-complete`; that artefact is a **rule**, not a skill. Its skill counterpart is `verify-completion-evidence` (same evidence-gate obligation, different surface). Substituted on implementation — both reviewers' "5 stack-agnostic instructional skills" intent preserved.
- [x] **A5** — `prompts/get` returns the SKILL.md body (compressed `.agent-src/` form, not uncompressed). _Done 2026-05-10 — frontmatter is stripped at load time; body served verbatim._
- [x] **A6** — Manual smoke test in confirmed client from A2; record session transcript outside `agents/roadmaps/`. _Done 2026-05-10 — programmatic stdio JSON-RPC handshake recorded in `agents/evidence/mcp-sessions/2026-05-10-phase-1-stdio-smoke.md`. Substitutes for a GUI smoke in autonomous mode; same wire protocol Claude Desktop / Zed / Continue would use._
- [x] **A7** — `tests/test_mcp_server.py` — at minimum: prompts/list returns ≥5 entries, prompts/get returns non-empty body, JSON-RPC envelope is valid. _Done 2026-05-10 — 10 tests pass (loader · import-surface guard · server handlers). SDK-dependent tests use `pytest.importorskip` so CI matrices without the `mcp` SDK still run the loader layer._

## Phase 2 — Full skill + command coverage

- [x] **B1** — `prompts/list` iterates all skills + commands from `.agent-src/`. _Done 2026-05-10 — `scripts/mcp_server/prompts.py::scan_skills` + `scan_commands` + `load_all_prompts`; 278 prompts (174 skills + 104 commands) at HEAD._
- [x] **B2** — Filter by `source: package` vs `source: project` (overrides) — clients see merged view. _Done 2026-05-10 — frontmatter `source:` forwarded into MCP `_meta` alongside `kind`; `.agent-src/` is the already-merged tree so the runtime loader inherits override resolution from `task sync`._
- [x] **B3** — Frontmatter validation: skip prompts with malformed YAML, log warning. _Done 2026-05-10 — entries missing `name` / `description` are surfaced in the loader's `errors` tuple and printed to stderr at server boot (`mcp-server: warn: …`); they do not crash the boot path._
- [x] **B4** — Pagination — MCP clients may not handle 200+ prompts in one list response. _Done 2026-05-10 — new-style `list_prompts` handler returns `ListPromptsResult` with cursor-based `nextCursor`; default `page_size=100`. Verified end-to-end via `stdio_client` handshake (page 1 → 100 prompts, nextCursor='100')._
- [x] **B5** — Hot-reload on file change (dev convenience, not production requirement). _Done 2026-05-10 — `PromptCache` tracks mtime + path-set signature; re-scan triggers on every `prompts/list` when any tracked file changes. No background thread, no inotify; the list request is the rate-limiter._

## Phase 3 — Resources (rules, guidelines, contexts)

- [x] **C1** — URI scheme: `rule://`, `guideline://`, `context://`. _Done 2026-05-10 — `scripts/mcp_server/resources.py` implements three scanners with stable, sorted, unique URIs (`rule://<stem>`, `guideline://<relpath>`, `context://<relpath>`)._
- [x] **C2** — `resources/list` enumerates all rules + guidelines + contexts. _Done 2026-05-10 — `@server.list_resources()` handler in `server.py` returns 160 resources (60 rules · 69 guidelines · 31 contexts) via `ResourceCache.get`._
- [x] **C3** — `resources/read` returns body. Same `.agent-src/` source as prompts. _Done 2026-05-10 — `@server.read_resource()` returns `ReadResourceContents(content=body, mime_type='text/markdown')`. Unknown URI raises `ValueError` per Phase-2 contract._
- [x] **C4** — MIME type: `text/markdown` for all. _Done 2026-05-10 — single `MIME_MARKDOWN` constant in `resources.py`; pagination (`page_size=100`) + hot-reload via mtime signature both inherited from Phase 2 pattern. 9 new tests in `tests/test_mcp_server.py`, 29/29 green._

## Phase 4 — Tools (engine helpers)

Highest-risk phase — exposing tools means real side effects on the consumer's
filesystem. Design call needed before writing code.

- [x] **D1** — Decision call: which `work_engine` surface is safe to expose? _Done 2026-05-10 — AI Council Design Call captured in `agents/council-questions/mcp-phase-4-tools.md` + verdict in `agents/council-responses/mcp-phase-4-tools-verdict.md`. **Verdict: `work_engine` not exposed in Phase 4.** Only two narrow, hardcoded tools land: `lint_skills` (D2) and `chat_history_append` (D3). `refine` step output stays out of scope — it would couple MCP wire to engine state, which is the exact coupling Phase 1 A0 forbade._
- [x] **D2** — `lint_skills` as MCP tool — pure read, safe. _Done 2026-05-10 — `scripts/mcp_server/tools.py::_lint_skills_handler` wraps `scripts.skill_linter.lint_file` directly (no `--changed` git mode). Path-scoped via `_validate_in_tree_path`. Returns same JSON shape as `scripts/skill_linter.py --format json`._
- [x] **D3** — `chat_history.append` as MCP tool — writes a project file. _Done 2026-05-10 — `_chat_history_append_handler` wraps `scripts.chat_history.append` with strict write allowlist (`agents/.agent-chat-history` or `.agent-chat-history` under `<consumer_root>` only). `dry_run=True` validates without touching the filesystem. Lazy-inits header when file missing. Explicit user consent surfaces via MCP client UI per protocol — no extra gate needed on server side._
- [x] **D4** — Allowlist enforced at server boot: tools not in allowlist are unreachable, not just unlisted. _Done 2026-05-10 — `ALLOWLIST` is a hardcoded module-level tuple in `tools.py`; no settings flag, no env var, no dynamic registration. `tools/call` against an unlisted name returns `isError=True` from the dispatcher. `run_stdio` enumerates registered tools on stderr at boot. 9 new tests in `tests/test_mcp_server.py` (48/48 green) cover listing, dispatch, path-escape, unknown-tool, and import-surface guard. Contract amended in `docs/contracts/mcp-phase-1-scope.md` (Phase 4 amendment section)._

## Phase 5 — Real setup docs (the deliverable from option 3)

Only runs **after** A1-A7 are green and a real client renders prompts.

- [x] **E1** — `docs/mcp-server.md` "How to set it up". _Done 2026-05-10 — copy-paste config for Claude Desktop, Cursor, Zed, Continue. Smoke-test snippet + scope statement + troubleshooting table included._
- [-] **E2** — `docs/proposals/mcp-server.md` retired. _N/A — proposal page never landed; Phase 1 ADR-equivalent lives in `docs/contracts/mcp-phase-1-scope.md`. Dropped._
- [x] **E3** — README "MCP Server" section. _Done 2026-05-10 — section under "Optional: persistent agent memory" with 5 lines + `task mcp:setup` snippet + link to `docs/mcp-server.md`. README at 514 lines (was 500); within 600-line working ceiling._
- [x] **E4** — `AGENTS.md` "Multi-agent tool support" row. _Done 2026-05-10 — adapted to AGENTS.md thin-root shape: added an MCP-server clause to the existing "Multi-tool projection" pointer line + link to `docs/mcp-server.md`. No new top-level section (would breach thin-root char ceiling)._
- [x] **E5** — Highlight in `README.md` positioning. _Done 2026-05-10 — same section as E3 doubles as the positioning highlight (no separate hero edit — the hero already cites "120+ skills"; calling out MCP would dilute the on-disk-skills story)._

## Phase 6 — Distribution polish

Council verdict 2026-05-10:
[`agents/council-responses/mcp-phase-6-distribution-verdict.md`](../council-responses/mcp-phase-6-distribution-verdict.md)
(host-synthesized, not gitignored exception — kept inside
`agents/` per project convention).

- [x] **F1** — Identity metadata: wire-surface `serverInfo.version`
  (SemVer in `__version__`) + `_meta.packageVersion` (read from
  `package.json` at boot) + `_meta.skill_set_signature` (SHA-256/12
  over the joined `PromptCache` + `ResourceCache` `(uri, mtime)`
  tuples). Surfaced via stderr boot log; SDK constructs `serverInfo`
  with a fixed field set, so wire-surface lift waits on SDK support.
  Implementation: `scripts/mcp_server/metadata.py`.
- [-] **F2** — SSE transport for cloud / remote — **deferred to
  [`road-to-mcp-distribution.md`](road-to-mcp-distribution.md)**.
  Council convergence: no current consumer ask, and F2 is a
  deployment primitive with its own A0 amendment (not "polish").
  Trigger to revive: a real consumer needing remote MCP. Locked
  design when it revives: the HTTP-bridge pattern in
  [`mcp-request-signing § Appendix`](../../docs/guidelines/agent-infra/mcp-request-signing.md#appendix--http-bridge-stdio-kernel-pattern-reference),
  not a native SSE server.
- [x] **F3** — Stdio Docker bundle at `docker/mcp-server/Dockerfile`.
  Multi-stage Python 3.11-slim image; stdio transport only (no HTTP
  surface). Operator doc at
  [`docs/setup/mcp-server-docker.md`](../../docs/setup/mcp-server-docker.md).
  Smoke-tested: `docker build` + `docker run -i` + initialize
  round-trip green.
- [-] **F4** — Plugin marketplace listing — **deferred to
  [`road-to-mcp-distribution.md`](road-to-mcp-distribution.md) (G5)**.
  Council closure verdict 2026-05-10:
  [`agents/council-responses/mcp-phase-6-f4-marketplace-verdict.md`](../council-responses/mcp-phase-6-f4-marketplace-verdict.md).
  Public marketplace listing implies production-readiness the Phase 1
  scope contract (`docs/contracts/mcp-phase-1-scope.md`) deliberately
  does not promise (server stays *experimental*). Same shape as F2:
  deployment primitive, not protocol polish. Original "identity
  decision" blocker is stale — `road-to-better-skills-and-profiles.md`
  is archived and the OSS-light verdict was reached.

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| MCP Python SDK unstable / missing capabilities | High | A1 is a hard gate. If SDK doesn't deliver, roadmap stays capture-only. |
| No client accepts stdio Python servers without paid tier | High | A2 is a hard gate. If no free path exists, scope reduces to "for paid users only" or roadmap pauses. |
| Tools phase exposes destructive ops | High | Explicit allowlist; D1 is a design call before any code. |
| Hot-reload (B5) introduces race conditions | Medium | Defer; MVP is read-on-startup. |
| Client UX inconsistency (each client renders prompts differently) | Medium | Test in 2+ clients during Phase 1. Document client-specific quirks in `docs/mcp-server.md`. |
| Bloat: shipping MCP runtime to non-MCP users | Low | `mcp` SDK as optional dependency; server only imported when entrypoint runs. |

## Decisions (synthesized 2026-05-01)

Synthesized from Claude + ChatGPT review rounds. Both reviewers stated that
without A1 (SDK) + A2 (client tier) answers, all further MCP planning is
speculation. Phase 1 is therefore a **spike** with two hard gates; Phases
2+ remain capture-only until Phase 1 ships.

### Gating decisions for Phase 1

| Gate | Decision |
|---|---|
| **A1 — SDK verification** | Hard gate. Verify Anthropic `mcp` Python SDK on PyPI: install, list capabilities, confirm stdio handler API and prompt/resource schemas. SDK unstable or missing required capabilities → roadmap returns to capture-only with documented gap. No code written without A1 green. |
| **A2 — Free-tier client** | Hard gate. Confirm at least one MCP-aware client accepts stdio Python servers without paid features. Verification list: Claude Desktop free tier · Zed · Continue. One confirmed client = A3+ unblocked. Zero confirmed → pause roadmap, document the constraint. |
| **A0 — Execution-safety boundary** (added 2026-05-01 after AI #5 review) | Hard contract before any code. Phase 1 server is **read-only and instructional**: `prompts/list`, `prompts/get`, `resources/list`, `resources/read`. No `tools` primitive, no engine spawn, no state-file writes, no shell execution. Documented in `docs/contracts/mcp-phase-1-scope.md` with `stability: experimental`. Any deviation → not Phase 1. |

### Open-question resolutions

| Question | Decision | Rationale |
|---|---|---|
| **Commands as prompts, or other primitive?** | **As prompts — instructional content only.** MCP has no "command" primitive in the current spec; `prompts` is the closest semantic match (parametrised text the user invokes). Disambiguate via prompt name prefix (`skill.<name>` vs `command.<name>`) and the MCP `description` field. **Phase 1 ships instructional prompts only** — the host agent receives the command body as text and runs it; the MCP server never executes engine code, never spawns `work_engine`, never touches `.work-state.json`. Engine-driven commands (`/work`, `/implement-ticket`) are explicitly **out of scope for Phase 1**: their `prompts/get` returns a stub message pointing at the local `./agent-config` CLI. Closes the AI #5 execution-safety risk that an MCP client confuses prompt-fetch with engine-run. Re-evaluate if a future MCP spec adds a command primitive or a sandboxed-execution primitive. |
| **Project-local overrides vs package skills — merge order** | **Project overrides win.** `prompts/list` returns the merged view: same shape as the existing `task generate-tools` projection. Override entries get `source: project` in metadata; package entries get `source: package`. Clients see one prompt per name, with overrides taking precedence. No "show both" mode in MVP. |
| **Telemetry — does an MCP prompt fetch count as "applied"?** | **No — fetch ≠ apply.** A `prompts/get` retrieval counts as `consulted`, not `applied`. Apply telemetry stays anchored on the existing `./agent-config telemetry:record` rule (concrete code/doc edits citing the artefact). The MCP server emits a `consulted` event when telemetry is enabled (opt-in, same privacy contract as local). Aligns with the redesign in `road-to-post-pr29-optimize.md` (artefact-engagement deprioritised in favour of behavioural outcomes). |
| **Multi-tenancy — one server per project, or shared server with switching?** | **One server per project (current assumption locked).** stdio transport is process-per-client; project context binds at launch time via `cwd` + `.agent-src/`. Shared server with project-switching needs SSE + auth model — deferred to Phase 6 (F2/F3) alongside cloud distribution. |

### Confidence

- A1 + A2: **high** — concrete verification steps, binary gates, no ambiguity.
- Phases 2–5: **medium** — depend on Phase 1 evidence; replan after spike.
- Phase 6: **low** — distribution polish, scoped after real adoption signal.

**Phase 1 (A1–A7) is approved for execution as a spike.** A1 + A2 fail →
roadmap returns to capture-only with the gap documented. Phases 2+ stay
capture-only until Phase 1 ships a working stdio prompt fetch in at least
one confirmed client.

## Open questions (deferred to post-spike)

- None blocking Phase 1. Open items above all rolled into Decisions or
  deferred to Phases 2/4/6 as documented.

## Reference

- `docs/architecture.md` — projection model description.
- `road-to-better-skills-and-profiles.md` § "Multi-client expansion" — sister roadmap, file-projection axis.
- `.agent-src.uncompressed/skills/mcp/SKILL.md` — current consumer-side MCP skill (will be expanded once we ship our own server).
- [`docs/guidelines/agent-infra/mcp-request-signing.md`](../../docs/guidelines/agent-infra/mcp-request-signing.md) — HMAC-SHA256 signing primitive for any non-stdio transport. Pairs with **D4** allowlist; load-bearing once **F2** (SSE) or **F3** (cloud bundle) ship.
- Anthropic MCP spec — verify URL + version in A1 before locking.

## Next step

Phase 1 + Phase 2 + Phase 3 all ship under PR #87 on
`feat/road-to-mcp-server` (GUI smoke in Claude Desktop confirmed by
user on 2026-05-10 between Phase 1 and Phase 2; Phase 3 verified via
contract tests + in-process stdio handshake). Adoption fixes
(`task mcp:setup`, Lint-Bot JSON-fallback) shipped on the same branch.
Phase 5 (E1–E5 — setup docs) is the next user-facing surface;
Phase 4 (tools — D1–D4) remains capture-only behind the **D1** design call.
