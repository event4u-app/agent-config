---
complexity: structural
status: active
---

# Roadmap: Ruflo Coexistence Bridge

> Make `event4u/agent-config` coexist cleanly with
> [`ruvnet/ruflo`](https://github.com/ruvnet/ruflo) (a multi-agent
> orchestration runtime for Claude Code) when ruflo is installed in the
> same project: both tools' lifecycle hooks fire reliably regardless of
> install order, secondary `.claude/` collisions are namespaced, and the
> shared memory directory is used without clobbering or import loops.
> Delivered as a **detection-gated** integration so zero cost is paid
> when ruflo is absent.

## Why (problem shape)

Both tools write `.claude/settings.json` hooks on overlapping lifecycle
events (`PostToolUse`, `SessionStart`, `Stop`, `SessionEnd`,
`UserPromptSubmit`, `PreToolUse`). agent-config's `deep_merge`
**replaces** JSON arrays (`scripts/install.py:439`), so today the
last-installing tool clobbers the other's hooks; agent-config's
foreign-pointer guard (`scripts/install.py:504`) only offers
force / skip / abort — never "merge both into the same event array".
Claude Code supports multiple hook entries per event, so technical
coexistence is achievable with an array-append merge.

**Governance scope (load-bearing constraint).** agent-config's
safety floors (`non-destructive-by-default`, `scope-control`,
`commit-policy`) are enforced as always-on **rules in the host
agent's context**, NOT via hooks. They bind the **main** Claude Code
agent. ruflo's autonomously spawned **swarm subagents** do not inherit
that rule context, so agent-config **cannot** govern ruflo's swarms
through hooks or rules. This roadmap does not pretend otherwise — it
makes coexistence honest, not omnipotent.

**Council note.** AI Council (anthropic/claude-sonnet-4-5 +
openai/gpt-4o, deep 3-round + peer-review, 2026-05-27) converged on:
array-append is necessary-but-not-sufficient; detection + explicit
one-time user choice over silent auto-mode; aggressive namespacing for
secondary collisions; separate-ownership for shared memory. They
clashed on abort-by-default (anthropic) vs proceed-with-modes
(openai); resolved here as a one-time install-mode choice (Phase 3).
The git-layer enforcement idea (Phase 7) is carried as **optional and
re-gated** through a second council pass + user confirmation at build
time.

## Phase 0 — Reference fixture + runtime assumption check

- [x] Capture a real ruflo `.claude/settings.json` (hook bindings for
      `pre-bash` / `post-edit` / `route` / `session-restore` /
      `auto-memory-hook`) as a test fixture under
      `tests/fixtures/ruflo/settings.json`.
- [x] Confirm from Claude Code docs that multiple hook entries in one
      event array all execute, and capture the documented ordering /
      failure-isolation semantics (fail-open vs fail-closed) into
      `docs/contracts/` notes. This answers the peer-review blind spot
      (execution order + error propagation). → all run in parallel,
      dedup by command string, non-2 exit is non-blocking & isolated,
      no guaranteed order; captured in `docs/contracts/ruflo-coexistence.md`.
- [x] **Plugin-hook spike.** Confirmed (Claude Code plugins + settings
      docs, 2026-05-27): plugin hooks live in `<plugin-root>/hooks/hooks.json`,
      same format as `settings.json` hooks; enabled-plugin hooks load
      automatically (no force-enable); `$CLAUDE_PROJECT_DIR` is available
      in the hook command; Claude Code merges plugin-scope + settings
      scopes and dedups by command string. **Decision (user, 2026-05-27):
      deliver agent-config's Claude hooks via the plugin globally** —
      this is the root fix (no shared `hooks` array in any settings file
      → no collision with ruflo OR with a developer's `settings.local.json`).
      Supersedes the array-append approach below.

## Phase 1 — Core: deliver Claude hooks via plugin scope (not settings.json)

> Revised after the Phase-0 plugin spike. Array-append into the shared
> `settings.json` array is abandoned: it collides with the locked
> wholesale-array ownership in `subtract_pointers`
> (`scripts/_lib/json_pointers.py`) and only moves the collision risk to
> `settings.local.json`. Plugin-scope delivery removes the shared array
> entirely.

- [x] Generate the agent-config plugin's `hooks/hooks.json` from
      `scripts/hook_manifest.yaml` (the `claude` bindings), command rooted
      at `$CLAUDE_PROJECT_DIR/agent-config dispatch:hook …`. Implemented as
      `condense.generate_plugin_hooks()`, wired into `generate_tools()`
      (`--generate-tools`). Output verified: 5 bindings at `hooks/hooks.json`.
- [x] Stop `ensure_claude_bridge` writing the `hooks` block into
      `.claude/settings.json`; keep only `enabledPlugins` (dict-merge),
      canonical id `agent-config@event4u-agent-config`. Removed dead
      `CLAUDE_DISPATCHER_BINDINGS` / `_claude_dispatch_block`. Claude-only —
      cursor/cline/windsurf/gemini bridges unchanged.
- [x] Targeted test: `test_claude_bridge_is_plugin_enablement_only` +
      `test_claude_bridge_coexists_with_neighbour_hooks` (ruflo fixture
      hooks survive) + `TestGeneratePluginHooks` (5 bindings,
      `$CLAUDE_PROJECT_DIR`-rooted, skips unbound events). 5/5 green.
- [x] No existing test asserted settings.json Claude hooks (verified via
      grep) — nothing to migrate. Full `test_install_py` + `test_condense`
      suites green (205 passed).

## Phase 2 — Ruflo detection

- [x] `detect_ruflo(project_root) -> (bool, reason)` in `install.py`:
      matches `claude-flow.config.json`, `ruflo-core@ruflo` in
      `enabledPlugins`, `claude-flow`/`ruflo` in `mcpServers`,
      `hook-handler`/`auto-memory-hook` in the hooks blob, or the helper
      scripts under `.claude/helpers/`. Returns the first matched signal
      as `reason`.
- [x] Targeted tests: absent, via ruflo fixture settings, via
      `claude-flow.config.json` marker, via helper script. 4/4 green.

## Phase 3 — One-time install-mode choice

> Simplified to **2 modes** (2026-05-27 decision): in our architecture
> governance is rule-context (always on) and hooks are observability
> (never block), so the council's Full vs Observe-only modes collapse —
> the only real lever is hooks-on vs hooks-off.

- [x] `resolve_ruflo_mode(project_root, *, interactive, force)` in
      `install.py`: on ruflo detection with no recorded choice, prompts
      **coexist** (default) / **skip**; non-interactive defaults to
      `coexist`. Setting `integrations.ruflo.mode` added to
      `config/agent-settings.template.yml`.
- [x] Persisted via `_persist_ruflo_mode`; honored on reruns without
      re-asking (`resolve_ruflo_mode` short-circuits on the existing
      value — decline = silence). Dispatcher enforces `skip` via
      `dispatch_hook._ruflo_skip_active()` (fail-open). Tests: 3 resolve
      + 3 dispatcher-skip; full install/condense/hooks suites 305 green.

## Phase 4 — `pack-ruflo-bridge` content (authored in `.agent-src.uncondensed/`)

- [x] Added pack row `ruflo-bridge` to `config/discovery/packs.yml`
      (bare id, not `pack-`-prefixed, matching convention) + amended the
      ADR-013 §packs vocabulary, the linter's frozen set, and the
      `engineering` workspace `optional_packs` (bidir). Discovery
      vocabulary lint green (9 workspaces · 22 packs).
- [x] Routing rule `rules/ruflo-routing.md` (`auto`, tier-3,
      `packs: [ruflo-bridge]`): orchestration/swarm + ruflo present →
      route to `skill:ruflo-orchestration`, not an in-session fan-out.
- [x] Skill `skills/ruflo-orchestration/SKILL.md` — ruflo MCP-tool
      surface + persona→agent-type map + `evals/triggers.json` stub
      (5 should / 5 should-not). Frontmatter validates (455 artefacts, 0 failing).
- [x] Honest governance-scope section in the skill: agent-config governs
      the main agent (rule-context), NOT ruflo's swarm subagents.
- [~] Condense via `/condense` + targeted `lint-skills` — PENDING. Files
      are discovered by condense (`--check` lists all three); the
      condensation + tool-projection regen is the next step. (NB: the
      three artefacts were first written to the main repo by mistake and
      moved into the worktree — see chat.)

## Phase 5 — Shared-memory coexistence

- [ ] Owner-marker in agent-config memory frontmatter; document the
      shared `~/.claude/projects/*/memory/*.md` contract.
- [ ] Import-loop guard: ensure agent-config does not re-ingest /
      rewrite files ruflo's `auto-memory-hook import` produced (and
      vice-versa) — define the ignore/marker convention.

## Phase 6 — Secondary collisions (namespacing)

- [ ] Detect command/skill filename overlap with ruflo
      (`security`, `code-review`, `git-workflow`, …); apply the
      lowest-friction namespacing (prefix or subdir, per Claude Code
      support) only on collision.
- [ ] Confirm the install manifest (`merged_keys[]`) lets uninstall
      subtract only agent-config's entries, leaving ruflo's intact.

## Phase 7 — OPTIONAL · git-layer enforcement for ruflo swarm commits (GATED)

> Carried as optional per the user's decision. Do **not** build this
> phase on autopilot.

- [ ] **GATE — council re-check.** Re-run the AI Council (deep) on the
      narrow question: "Given agent-config's governance is rule-context
      (main-agent) not hook-based, does a `.git/hooks/pre-commit` gate
      that applies non-destructive / scope checks to ruflo's autonomous
      swarm commits make sense, and what are its failure modes?"
- [ ] **GATE — ask the user.** Surface the council verdict and ask for
      an explicit go / no-go before writing any git-hook code.
- [ ] (Only on user go) Install an order-independent pre-commit gate
      that runs agent-config's destructive/scope checks on commits ruflo
      cannot bypass; targeted test with a simulated bulk-delete commit.

## Phase 8 — Docs + acceptance

- [ ] Pointer from `docs/architecture.md` / catalog to the bridge pack;
      README one-liner for the ruflo integration.
- [ ] Targeted reference + portability linters green on the touched
      files.

## Acceptance criteria

- With ruflo present, after agent-config install both tools' hooks fire
  on every shared lifecycle event (verified against the Phase-0
  fixture).
- With ruflo absent, the bridge is inert at the **behavior** level — the
  dispatcher no-ops exactly as today. (Relaxed from "fully inert" per the
  2026-05-27 decision: the Claude hook **delivery channel** moves to
  plugin scope for all consumers, but behavior is unchanged.)
- The governance-scope limitation (no governance over ruflo swarm
  subagents) is documented, not hidden.
- A second agent-config install run is idempotent (no duplicate hook
  entries, no clobbered ruflo hooks).
