---
complexity: structural
---

# Road to Global-First Install

**Status:** READY — derived from [`ADR-007`](../../docs/decisions/ADR-007-agent-discovery-scopes.md) accepted 2026-05-12.
**Started:** 2026-05-12
**Trigger:** v2.1.0 ships project-scoped install only. User ask
2026-05-12: "Es macht keinen Sinn, das paket nicht global zu
installieren." Validated through AI Council 2+1 rounds (claude-sonnet-4-5
+ gpt-4o, $0.0695 actual, 3/4 convergence). Source: <!-- council-ref-allowed: roadmap trace -->
[`agents/council-sessions/2026-05-12-global-first-strategy/`](../council-sessions/2026-05-12-global-first-strategy/). <!-- council-ref-allowed: roadmap trace -->
**Mode:** Three-phase roadmap, all shipping under the **v2.x line**
(v2.0.0 was the breaking npx-only cut — no v3.0.0 planned).
Phase 1 (core global-first install, 8 steps) lands as the next v2.x
minor release. Phase 2 (per-AI breadth expansion, 7 sub-steps) extends
coverage from 8 → 17 AIs in subsequent v2.x minors. Phase 3
(`installed-tools.lock` manifest, 5 sub-steps) ships in a later v2.x
minor — closes the "which AIs does this project use?" gap surfaced by
the 2026-05-12-project-settings-and-v1-v2 council. Phase 2 derives
from AI Council session 2026-05-12-installer-expansion (claude-sonnet-4-5
+ gpt-4o, $0.0285 actual, converged Round 1). Source: <!-- council-ref-allowed: roadmap trace -->
[`agents/council-sessions/2026-05-12-installer-expansion/synthesis.md`](../council-sessions/2026-05-12-installer-expansion/synthesis.md). <!-- council-ref-allowed: roadmap trace -->

## Purpose

Flip `npx @event4u/create-agent-config init` from project-scoped to
**global-scoped by default**. One npx invocation configures every
supported AI agent (Claude Code, Claude Desktop, Cursor, Windsurf,
Cline, Augment, GitHub Copilot, Gemini CLI, Aider, OpenAI Codex)
from `~/.config/agent-config/` and per-tool user-scope paths.
Project-scope install becomes opt-in via `--project[=<dir>]`.

Symlink-bridge is **not** built (Council REJECT — Windows / Git /
tool-precedence-asymmetry kill it). Replaced by **`agent-config
export --tool=<x> --output=<path>`** for teams that need committed
per-tool files (`.github/copilot-instructions.md`, `AGENTS.md`,
`CLAUDE.md` in repo).

## Decisions (locked 2026-05-12 via ADR-007)

- **D1:** Global is the default. `--project` is opt-in.
- **D2:** Multi-signal detect; prompt only on ambiguity. `.git/` is
  not a signal.
- **D3:** `export` subcommand replaces the rejected bridge.
- **D4:** One manifest, full set, no global-curation split.
- **D5:** Lockfile `~/.config/agent-config/installed.lock`; `init`
  on differing version fails loud.
- **D6:** Source-repo guard (`AGENT_CONFIG_ALLOW_SELF_INSTALL=1`)
  stays for both modes.

## Phase 1 — Implementation (8 steps)

Target branch: `feat/global-first-install`. Target version: **next
v2.x release** (behavioural change vs v2.1.0 — `init` default location
changes; ships as a v2.x minor under loud release notes, no v3 cut).

- [x] **1.1** Re-introduce `--global` end-to-end across the four
  install layers. The pre-`5388de25` `--global` was an in-project
  symlink scheme; ADR-007 rebuilds the flag as a real-file user-scope
  install (see ADR-007 § "Relationship to the retired `--global`").
  All four sub-tasks landed together with the Phase 2 scope work:
  - [x] **1.1a** `packages/create-agent-config/src/install.js` —
    `parseArgs` accepts `--global`; `run()` forwards `--global` to
    the bash installer.
  - [x] **1.1b** `scripts/install` (bash) — option parsing accepts
    `--global` (implies `--skip-sync`), forwards to
    `scripts/install.py`.
  - [x] **1.1c** `scripts/install.py` — `--global` parsed in
    `parse_options`; `install_global(tools, force)` scaffold prints
    the planned per-tool anchor paths from `USER_SCOPE_PATHS` plus
    the lockfile target. No file writes (deferred to 1.5/1.6). No
    symlinks; the rejected `global-install-manifest.yml` template
    under `templates/` is not revived.
  - [x] **1.1d** Smoke verified:
    `AGENT_CONFIG_ALLOW_SELF_INSTALL=1 bash scripts/install --global --tools=claude-code --yes --skip-sync`
    reaches the Python scaffold, prints
    `claude-code → ~/.claude/` + lockfile target, exits 0, no files
    written.
- [x] **1.2** Added `global` subcommand to `scripts/agent-config`.
  `cmd_global()` resolves the bash installer and forwards with
  `--global` prepended, so `./agent-config global --tools=claude-code`
  reaches `scripts/install.py install_global()` via the existing
  bash → python pipeline. Help entry + two usage examples added.
  Smoke: `./agent-config global --tools=claude-code --yes` prints the
  per-tool anchor matrix and exits 0 with no file writes.
- [x] **1.3** Implement multi-signal detection in `scripts/install.py`:
  existing `.agent-settings.yml` in CWD → project. Existing
  AI-tool config collision → prompt. CWD has manifest file but no
  AI-tool config → prompt. Anything else (incl. `~/`, empty dir,
  dotfile-Git) → global.
  Done — added `detect_scope(cwd) -> (scope, reason)` returning
  `project` / `prompt` / `global` per ADR-007 D2. Pure function;
  `.git/` explicitly excluded as signal. 8 unit tests in
  `TestDetectScope` (settings-wins, manifest-alone, ai-alone,
  manifest+ai = prompt, `.git/` not a signal). Wired into `main()`
  as informational log only — dispatch still honors explicit
  `--global` and project default until 1.4 lands the prompt.
- [x] **1.4** Collision prompt landed.
  `prompt_scope_choice()` (3-option Project/User/Custom) and
  `prompt_collision_choice()` (Hard-Floor Merge/Backup/Abort) live
  in `scripts/install.py`. `_resolve_scope()` orchestrates the
  precedence: explicit `--scope=project|global|prompt` wins, then
  `--scope=auto` honours detection, then `--global` legacy alias,
  then backward-compat project default with auto-prompt on
  detection==prompt. `--custom-path=<dir>` pre-fills the Custom
  branch and is rejected with `--scope=global` / `--global`. CI
  fail-fast: non-TTY + detection==prompt + no `--scope` aborts
  with directive error. Bash forwarder (`scripts/install`)
  parses `--scope` / `--custom-path` and threads them to
  `install.py`; help text updated. 15 new unit tests
  (`TestPromptScopeChoice`, `TestPromptCollisionChoice`,
  `TestResolveScope`) bring the install_py suite to 110 passed.
- [x] **1.5** `agent-config export --tool=<x> --output=<path>` shipped.
  `scripts/_cli/cmd_export.py` resolves AGENTS.md / copilot-instructions /
  per-bridge markers from `.agent-src/templates/` + `scripts/install.py`,
  writes the chosen tool's canonical content to an explicit `--output`
  path, idempotent (hash-compare, exit 0 on match), `--force` overrides
  drift. Wired through `scripts/agent-config` dispatcher. No canonical-
  path defaults (per ADR Q1 council verdict).
- [x] **1.6** Lockfile lifecycle landed.
  `scripts/_lib/installed_lock.py` owns read / write / version-check on
  `~/.config/agent-config/installed.lock` (schema_version 1,
  agent_config_version, installed_at, tools[]). `install_global()`
  refuses on version mismatch with exit code 1 and a directive error
  ("run `agent-config update` or re-run with `--force`"), merges tool
  IDs with prior entries on success, atomic write via tempfile +
  os.replace. `cmd_update.py` calls `_refresh_global_lockfile()` after
  pinning so the user-scope manifest stays in lockstep with the project
  pin; silent no-op when no lockfile exists. `AGENT_CONFIG_INSTALLED_LOCK`
  env var redirects the lockfile for tests. Smoke-tested:
  fresh-install / idempotent re-run / mismatch refusal / `--force`
  override / update-refresh / update no-op all green.
- [x] **1.7** Test matrix expanded.
  `tests/test_installed_lock.py` (16 tests) covers lockfile read /
  write / version-check / atomic write / env-override + the
  `install_global` round-trip (fresh / merge / mismatch refusal /
  `--force` override) + `cmd_update._refresh_global_lockfile` no-op /
  refresh / idempotent paths. `tests/test_cmd_export.py` (8 tests)
  covers the export contract: `--list`, missing args, unknown tool,
  successful write, idempotent re-run, drift refusal, `--force`.
  CI: `.github/workflows/tests.yml` gains a `windows-lockfile-export`
  job (windows-latest, Python 3.12) that runs both test modules so
  the cross-platform lifecycle is locked in (POSIX symlink paths
  remain Ubuntu / macOS-only per ADR-007 D5 carve-out). Full sweep:
  3324 passed, 15 skipped.
- [x] **1.8** Docs updated for global-first model.
  `docs/installation.md` — Principle section rewritten ("Global-first
  install, opt-in project export"), scope-detection note, lockfile
  reference (`~/.config/agent-config/installed.lock`), `export` block
  with link to command-clusters contract.
  `README.md` — Quickstart gains a "global-first by default" preamble
  noting auto-detection (`--scope=global|project` override) and
  pointing at `docs/installation.md` for the matrix.
  `CHANGELOG.md` — new R4 (Global-First Install) summary in
  `[Unreleased]` covering lockfile lifecycle, `export` subcommand, 12
  supported tool ids, Windows CI matrix.
  `docs/setup/per-ide/claude-desktop.md` — TL;DR rewritten to point at
  the new ADR-007 global install (`global --tools=claude-desktop`)
  and disambiguate from the retired v1 npm / composer scheme.
  Per-IDE pages already document `global --tools=<id>` (added in
  Phase 1.2); no further rewrites needed.
  `agents/roadmaps/road-to-productization.md` — no global-first
  references found; deferred.

## Phase 2 — Per-AI Expansion (6 sub-steps)

Target branch: `feat/installer-expansion` (separate PR after Phase 1 lands).
Target version: **subsequent v2.x minor** (additive — no behavioural break).
Plan source: Council convergence — adopt strangler migration with
imperative-first build, hybrid declarative only if validation gate trips.

- [x] **2.0** Validation gate. Implemented `ensure_roocode_bridge`
  imperatively (project-scope, marker at `.roo/rules/agent-config.md`).
  Wired into `_VALID_TOOLS`, `main()`, `USER_SCOPE_PATHS`. **Measured:
  ~45 LOC, <30 min.** Imperative wins for Phase 2.2 — no declarative
  refactor needed.
- [x] **2.1** Fix Tier-1 stubs (4 bridges). Declared in `_VALID_TOOLS`
  or roadmaps but missing implementations: `claude-desktop`, `aider`,
  `codex`, `continue`. Imperative marker pattern (Roocode-style) —
  `.claude-desktop/agent-config.md`, `.aider/agent-config.md`,
  `.codex/agent-config.md`, `.continue/rules/agent-config.md`.
  `continue` added to `_VALID_TOOLS`, `USER_SCOPE_PATHS`, bash
  `VALID_TOOLS`, help text, and interactive menu. 64/64 install.py
  tests pass; end-to-end smoke through bash wrapper writes all four
  markers idempotently.
- [x] **2.2** Tier-2 expansion (4 bridges). `kilocode`, `zed`,
  `jetbrains`, `kiro`. (roocode lands in 2.0.) Done — informational
  markers under `.kilocode/rules/`, `.zed/`, `.jetbrains/`,
  `.kiro/steering/`. `_VALID_TOOLS` / `VALID_TOOLS` / `USER_SCOPE_PATHS`
  / `--tools` help / interactive menu / JS wrapper synced. Tests:
  64/64 pass; end-to-end install writes all 4 markers.
- [x] **2.3** Per-AI scope declarations. Added `SCOPE_SUPPORT` map
  (16 tools × `project | global | both`) + `_validate_scope` +
  `_tools_was_all` helpers in `scripts/install.py`. Explicit
  `--tools=X` with incompatible scope → hard reject with directive
  hint (`drop --global (project is the default scope)` /
  `use --global`); `--tools=all` silently filters to scope-compatible
  subset (backward-compatible). Validation runs before package /
  profile detection so the CLI fails fast. README claim restored. New
  test classes `TestValidateScope`, `TestToolsWasAll`,
  `TestScopeSupportMatrix` — pytest 77/77 green.
- [x] **2.4** CLI flag aliases. Added `--ai=NAME[,NAME…]` (long + `=`
  form) to all three CLI surfaces: `scripts/install.py`
  (`_merge_tools_aliases` helper, post-`parse_args` reconciliation),
  `scripts/install` (bash, comma-concat in argparse loop +
  `--list-tools` examples), `packages/create-agent-config/src/install.js`
  (`mergeToolsValue` helper). Both flags may be combined — values
  union (order-preserving, deduplicated). `--tools` stays primary in
  `--help`. pytest 87/87 green (10 new tests covering parse_options +
  `_merge_tools_aliases`).
- [-] **2.5** Conditional declarative refactor. **Not triggered.**
  Phase 2.0 gate measured imperative bridge at ~45 LOC / <30 min and
  Phases 2.1 + 2.2 confirmed the pattern scales mechanically across
  8 new bridges with zero deviation. No declarative emitter needed at
  current breadth (16 tools). Re-evaluate if Tier-3 (2.6) lands more
  than 4 community AIs or if a non-marker bridge variant emerges that
  the imperative pattern cannot express in <60 LOC. Imperative escape
  hatch for substrate (augment, vscode) and hook dispatchers
  (claude-code/cursor/cline/windsurf/gemini) is the current default,
  not a fallback.
- [x] **2.6** Tier-3 deferral mechanism. Documented in
  [`docs/contracts/tier-3-contrib-plugin.md`](../../docs/contracts/tier-3-contrib-plugin.md)
  — beta-stability contract covering candidate list (qoder, trae,
  opencode, codebuddy, droid, warp, antigravity), manifest YAML
  schema for `agents/manifests/contrib/<tool-id>.yml`, non-
  implementation guarantee (no directory scaffolded, no `_VALID_TOOLS`
  entries, no empty-shell drift), promotion path Tier-3 → Tier-2
  (single PR with manifest + bridge + README row), and explicit
  out-of-scope items (capability matrices, auto-discovery, third-
  party contribution channel — last would require ADR-009+).
  Implementation ships when the first user request lands by name.
- [x] **2.7** README + skill alignment. Pulled forward to run after 2.1
  (before 2.2) so docs stop drifting. Added `### Pick specific AIs`
  subsection to `README.md` Quickstart with the per-AI catalog (12
  shipped AIs, one line each, `--tools=<name>` syntax — `--ai` alias
  ships in 2.4) plus `#### Global install` and ADR-007 reference.
  Extended `## Supported Tools` project-installed table from 7 → 12
  rows (added Roo Code, Codex CLI, Continue.dev, Aider, Claude
  Desktop with new `📌 = informational marker` legend entry).
  Synchronised `packages/create-agent-config/src/install.js` `--tools`
  help text to include `roocode,continue`. Updated
  `.agent-src.uncompressed/skills/readme-writing-package/SKILL.md` §
  "Per-AI catalog pattern" with the flat-list pattern, when to use it
  vs. a capability matrix, and a deep link to the README example.
  Catalog reflects shipped reality (12 AIs); Phase 2.2 will append 4
  Tier-2 rows as they land. Sync clean: 174 skills · 60 rules · 106
  commands · 69 guidelines · 14 personas.

Final coverage after Phase 2: 8 existing + 4 fix-stub + 5 Tier-2 = **17 AIs**.

## Phase 3 — Installed-Tools Manifest (5 sub-steps)

Closes the "which AIs does this project use?" gap surfaced by the
2026-05-12-project-settings-and-v1-v2 council (sonnet + gpt-4o,
$0.0298 actual). Architecturally separate from
`.agent-project-settings.yml` (behaviour) — `installed-tools.lock`
tracks **bill of materials** (which tools, scope, marker path). Both
files committed, both have a single clear job. Council synthesis: <!-- council-ref-allowed: roadmap trace -->
[`agents/council-sessions/2026-05-12-project-settings-and-v1-v2/synthesis.md`](../council-sessions/2026-05-12-project-settings-and-v1-v2/synthesis.md). <!-- council-ref-allowed: roadmap trace -->

Runs **after** Phase 2 — Phase 2 bridges define the tool catalog
that Phase 3 then makes inspectable / reproducible across team
members.

- [x] **3.1** Spec `agents/installed-tools.lock` schema in
  **ADR-008**. Fields: `schema_version`, `agent_config_version`,
  `tools[]` with `{ name, scope, bridge_marker, installed_at }`.
  Lock-file is **append-on-init / overwrite-on-sync**, never
  hand-edited. Document scope-switch migration path (tool moves
  from `project` → `global` between versions).
- [x] **3.2** `init --ai <name>` writes the entry. Existing entry
  for same tool → no-op (idempotent); scope mismatch → loud
  warning + refuse without `--force`. Shipped via
  `_update_installed_tools_manifest` in `scripts/install.py`;
  `PROJECT_BRIDGE_MARKERS` map covers all 17 tools.
- [x] **3.3** `sync` reads the lock file, replays every listed
  tool's install (skip if marker already present). New team
  member clones repo → one `sync` brings every AI online.
  Shipped at `scripts/_cli/cmd_sync.py`; wired into the bash CLI
  as `./agent-config sync`; covered by `tests/test_cmd_sync.py`
  (10 tests, batched replay by scope, dry-run, fail-fast).
- [x] **3.4** `validate` subcommand. Read-only drift detection:
  marker missing, marker pointing at unexpected version, scope
  divergence. Exit 1 on drift. **No auto-fix.** Shipped at
  `scripts/_cli/cmd_validate.py`; wired as `./agent-config validate`;
  covered by `tests/test_cmd_validate.py` (7 tests covering all
  three drift kinds + skip-version-check + corrupt-entry).
- [x] **3.5** Docs: `docs/guidelines/agent-infra/installed-tools-manifest.md`
  (concept, schema, workflow). Update `docs/installation.md` with
  the team-onboarding flow ("clone → `sync` → done"). README
  catalog (Phase 2.7) links to the manifest concept. README
  catalog gains a "Team reproducibility (ADR-008)" callout
  pointing at the new guideline.

Final coverage after Phase 3: 17 AIs + reproducible team installs.

## Acceptance Criteria

- `npx @event4u/create-agent-config init` in `~/` installs globally,
  no prompt, no error.
- `npx @event4u/create-agent-config init` in a project with existing
  `.agent-settings.yml` installs project-locally, no prompt.
- `npx @event4u/create-agent-config init` in a project with manifest
  file but no AI-tool config prompts with 3 options.
- `npx @event4u/create-agent-config init` with existing `~/.claude/CLAUDE.md`
  prompts before overwrite (Hard Floor).
- `agent-config export --tool=copilot --output=.github/copilot-instructions.md`
  writes a real file, idempotent, refuses on diff without `--force`.
- `agent-config update` writes new lockfile atomically, refuses on
  no-op (already current).
- All 10 supported agents documented with their global discovery
  path in `docs/installation.md`.
- CI green on macOS + Linux + Windows.
- v2.x release notes explain the behavioural change and migration path.

## Out of Scope

- **`--minimal` install profile.** Council had residual divergence on
  Q3 (full vs curated). We ship **full** per Anthropic's recommendation;
  `--minimal` may be added later if real-world feedback warrants. Not
  a release blocker.
- **Symlink-bridge.** Rejected by Council, will not be built.
- **Tool-specific global path autodetection.** Each tool's user-scope
  path is hardcoded per the ADR matrix; no runtime detection.
- **MCP server installation.** Existing `mcp:setup` flow continues
  unchanged.

## Risks

| Risk | Mitigation |
|---|---|
| Existing v2.1.0 users on `npx … init` get unexpectedly different behaviour after the next v2.x release | Loud v2.x release note + migration guide; lockfile fail-loud catches accidental upgrades |
| Windows file-locking on `~/.config/agent-config/installed.lock` | Atomic write via `tempfile + os.replace`; documented behaviour |
| Tools with `workspace > global` precedence (Windsurf, Cline, Gemini) silently ignore global install inside specific repos | `export` subcommand is the documented escape; `docs/installation.md` calls out per-tool precedence |
| User's hand-written `~/.claude/CLAUDE.md` gets overwritten | Hard Floor prompt (1.4); refusal-by-default |

## References

- [`ADR-007`](../../docs/decisions/ADR-007-agent-discovery-scopes.md) — the locked architecture decision.
- [`agents/council-sessions/2026-05-12-global-first-strategy/`](../council-sessions/2026-05-12-global-first-strategy/) — full council transcripts. <!-- council-ref-allowed: roadmap trace -->
- Related rule: [`non-destructive-by-default`](../../.augment/rules/non-destructive-by-default.md) — Hard Floor on `~/.claude/CLAUDE.md` overwrite.
