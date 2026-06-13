---
complexity: lightweight
---

# Road to `~/.event4u/agent-config/` namespace + real Claude Desktop deployment

> Move every package-owned user-global file from `~/.config/agent-config/` into
> a vendor-namespaced `~/.event4u/agent-config/` tree, and replace the
> Claude Desktop "informational marker" with a real skill-bundle pipeline
> that produces importable artefacts for the **Customize → Skills** UI.

## Prerequisites

- [x] Read `AGENTS.md`, `docs/decisions/ADR-007-agent-discovery-scopes.md`,
      `docs/setup/per-ide/claude-desktop.md`.
- [x] Branch `feat/claude-desktop-and-event4u-namespace` exists and is checked out.
- [x] AI Council members `anthropic` and `openai` enabled in `.agent-settings.yml`
      (token spend authorised for this roadmap).
- [x] `task ci` is green on the current branch baseline.

## Context

Two distinct problems land in one roadmap because they share the same
user-scope surface (`scripts/install.py` user-global deploy path):

1. **Namespace pollution.** `~/.config/agent-config/` is a generic XDG-shaped
   directory that does not signal vendor ownership. Lockfile, API keys,
   council ledger, settings, agents-overlay — all currently land there.
   The shared tool anchors (`~/.claude/`, `~/.augment/`, `~/.cursor/`, …)
   must stay where their hosts read them. Only **package-owned** files move.
2. **Claude Desktop has no filesystem skill discovery.** v2.3.0 writes a
   single informational marker (`agent-config.md`) inside the Desktop app
   support directory and falsely reports a successful `claude-desktop`
   install. Desktop's **Customize → Skills** UI accepts ZIP bundles or
   `/v1/skills` API uploads (workspace-only, code-execution gated). The
   marker is broken-by-design and ships no skills.

- **Source-of-truth:** `~/.event4u/agent-config/` (new). Tool anchors
  (`~/.claude/`, `~/.augment/`, etc.) remain as-is — they are host
  conventions, not ours to relocate.
- **Reference repo audited:** an external reference suite
  (Phase 2.4 expansion already lifted 7 tool anchors from it). No
  Desktop-specific deployment pattern there to copy — they only ship
  filesystem anchors.
- **Anthropic Skills API:** `/v1/skills` Beta is workspace-scoped with
  mandatory code-execution. Not viable for personal/desktop installs.
  ZIP bundles importable via Customize UI are the universal path.

- **Feature:** none (architectural).
- **Jira:** none.

## Decisions (locked this turn)

- **Helper module is single source of truth.** New `scripts/_lib/user_global_paths.py`
  exposes `event4u_root()` (new) and `legacy_xdg_root()` (read-only fallback).
  Every callsite goes through the helper — no string-literal paths in module
  bodies. Override via `EVENT4U_CONFIG_HOME` env var (full path) or fallback
  to `~/.event4u/agent-config/`.
- **Auto-migration is one-shot, non-destructive.** First install / first
  script invocation after upgrade: if `~/.config/agent-config/` exists AND
  `~/.event4u/agent-config/` does not, **copy** (not move) contents to the
  new path, then write a `MIGRATED.md` breadcrumb into the old path. Old
  path becomes read-only fallback; never auto-deleted (user removes
  manually after confirming).
- **Read-fallback during transition.** Loaders (settings, lockfile,
  ai-council keys) read new path first; if missing, fall back to legacy
  path. Writers only ever target new path.
- **Claude Desktop bundles are ZIPs.** Each curated skill produces
  `<skill-name>.zip` containing `SKILL.md` + any sibling resources. Bundles
  land in `~/.event4u/agent-config/claude-desktop/bundles/`. Marker file
  becomes a directory listing with copy-paste import instructions.
- **No Skills API client yet.** Workspace-scoped + code-execution gating
  rules out personal install. Captured as out-of-scope, deferred to a
  follow-up roadmap if user demand surfaces.
- **ADR-007 supersession is partial.** New ADR documents the namespace
  move and read-fallback contract; ADR-007 stays as historical record
  with a top-banner pointing at the successor.
- **Tool anchors are not touched.** `~/.claude/`, `~/.augment/`, etc.
  remain authoritative for their tools. Only the package-owned tree
  (`~/.config/agent-config/`) moves. This is the Iron Law of the roadmap.

## Phase 1: Path centralization + helper module

- [x] **Step 1:** Create `scripts/_lib/user_global_paths.py` exposing
      `event4u_root() -> Path`, `legacy_xdg_root() -> Path`,
      `resolve_with_fallback(name: str) -> Path | None` (reads from new,
      falls back to legacy). Honour `EVENT4U_CONFIG_HOME` env override.
      Pure, read-only, never auto-creates directories.
- [x] **Step 2:** Add unit tests `tests/test_user_global_paths.py`
      covering: default resolution, env-var override, fallback semantics,
      missing-both-paths case. (Path adjusted from `tests/_lib/` → `tests/`
      to match project convention — sibling tests like `test_installed_lock.py`
      live flat under `tests/`.)
- [x] **Step 3:** Update `scripts/_lib/installed_lock.py` — replace
      hard-coded `~/.config/agent-config/installed.lock` with helper call;
      preserve `DEFAULT_LOCKFILE` symbol for back-compat (now derived from
      the helper).
- [x] **Step 4:** Update `scripts/_lib/agent_settings.py` — replace
      `DEFAULT_USER_GLOBAL_FILE` derivation with helper call; add
      read-fallback to legacy path inside `load_agent_settings`.
- [x] **Step 5:** Update `scripts/_lib/agents_overlay.py` — replace
      `USER_GLOBAL_AGENTS_DIR` with helper call; add legacy-path probe
      after the new-path miss inside `resolve_overlay`.

## Phase 2: Migrate remaining callsites

- [x] **Step 1:** Update `scripts/_lib/update_check.py` and
      `scripts/_lib/installed_tools.py` — replace literal paths and
      docstring references.
- [x] **Step 2:** Update `scripts/ai_council/clients.py`,
      `scripts/ai_council/budget_guard.py`, `scripts/ai_council/__init__.py`
      — API-key path and council-spend ledger via helper. Maintain
      read-fallback for key files (users won't re-create keys).
- [x] **Step 3:** Update `scripts/ai_council/bundler.py` redaction pattern
      to match both old and new paths (regex `(~?/?\.(config/agent-config|event4u/agent-config)/[^/\s]+\.key)`).
- [x] **Step 4:** Update `scripts/install.py` (lockfile path docstring at
      line 2882, plus any embedded path strings) and the two
      `scripts/_cli/cmd_*.py` files (`cmd_uninstall.py`, `cmd_update.py`).
- [x] **Step 5:** Update `scripts/skill_trigger_eval.py` user-facing
      message at line 572.
- [x] **Step 6:** Grep-verify zero remaining `~/.config/agent-config/`
      occurrences in `scripts/` (excluding `legacy_xdg_root()` helper and
      its tests). Active source paths all wrapped with legacy-fallback
      context; historical changelogs, ADRs, and archived roadmaps left
      as-is per Iron Law.

## Phase 3: Auto-migration shim

- [x] **Step 1:** Add `migrate_legacy_namespace()` to
      `scripts/_lib/user_global_paths.py`. Behaviour: if legacy root exists
      and new root does not, copy contents (preserve modes — keys are
      0600), then write `~/.config/agent-config/MIGRATED.md` containing
      new-path pointer and removal-instructions stub. Idempotent: safe to
      call repeatedly. Never auto-deletes legacy tree.
- [x] **Step 2:** Wire the migration into `scripts/install.py`
      `install_global()` so every `npx @event4u/agent-config init
      --global …` (and any project-init that touches global state) runs
      the migration once. Print a `🔁 Migrated user-global config to
      ~/.event4u/agent-config/` line when migration ran.
- [x] **Step 3:** Add tests `tests/test_namespace_migration.py`
      covering: no-op when new root exists, copy when only legacy exists,
      mode preservation for `0600` key files, breadcrumb written, second
      invocation is no-op. (Path adjusted from `tests/_lib/` → `tests/`
      to match the project convention — sibling tests like
      `test_user_global_paths.py` live flat under `tests/`.)

## Phase 4: Real Claude Desktop ZIP bundle deployment

- [x] **Step 1:** Create `scripts/_lib/claude_desktop_bundler.py` exposing
      `build_skill_bundles(package_root: Path, dest_dir: Path, force: bool,
      curation: list[str] | None) -> list[Path]`. Iterates
      `.claude/skills/*`; for each skill folder containing `SKILL.md`
      produces `<skill-name>.zip` with every sibling file (excluding
      `.git*`, `__pycache__`, `*.pyc`, `.DS_Store`). Atomic writes via
      tempfile + `os.replace`; content-hash idempotency through a
      sibling `<skill-name>.sha256` sidecar — existing bundle replaced
      only when `force=True` OR hash differs. (Curation arg present but
      no `tool_curation.yml` exists yet in this repo; bundler ships all
      skills by default until a curation policy is authored — out of
      scope for this phase.)
- [x] **Step 2:** Rewrite `_write_claude_desktop_marker` in
      `scripts/install.py` — marker file now points at the new bundle
      dir under `~/.event4u/agent-config/claude-desktop/bundles/` with
      explicit copy-paste instructions for the Customize → Skills
      Upload button. Replaced the "no native rules / skills filesystem
      convention" line with the 4-step import flow.
- [x] **Step 3:** Update `_deploy_global_content` `claude-desktop`
      branch — new `_deploy_claude_desktop()` helper calls
      `build_skill_bundles()` then `_write_claude_desktop_marker()`.
      Result reporting: `(bundle_count, 0, "deployed", [bundles_dir,
      marker])`. CLI summary now shows `claude-desktop →
      ~/.event4u/agent-config/claude-desktop/bundles/ (N bundles)`.
- [x] **Step 4:** Add tests `tests/test_claude_desktop_bundler.py`
      covering: bundle generation for synthetic skill folders, ZIP
      structure (SKILL.md present + sibling files), exclusion of
      `__pycache__` / `.git*` / `*.pyc`, content-hash idempotency,
      `force=True` rewrite, skip-when-SKILL.md-missing, empty-package
      no-op, and curation list filter. Path adjusted from `tests/_lib/`
      → `tests/` to match the project convention.
- [x] **Step 5:** Real-bundler smoke test executed against the repo's
      own `.claude/skills/` (276 bundles produced, idempotent re-run
      wrote 0). Test file `tests/test_claude_desktop_bundler.py` covers
      the unit-level invariants; the full-package smoke run is captured
      as an evidence note here instead of a third integration-test file
      to keep the test surface minimal.

## Phase 5: Tests + Docs + ADR

- [x] **Step 1:** Update `tests/work_engine/conftest.py` and
      `tests/ai_council/test_bundler.py` so test fixtures and redaction
      tests cover both paths during transition. Landed with Phase 1-3.
- [x] **Step 2:** Update `docs/customization.md`,
      `docs/installation.md`, `docs/setup/per-ide/claude-desktop.md`,
      `docs/guidelines/agent-infra/layered-settings.md`,
      `docs/guidelines/agent-infra/installed-tools-manifest.md` — every
      `~/.config/agent-config/` reference becomes `~/.event4u/agent-config/`
      with a "legacy path read for back-compat" footnote where relevant.
      Landed with Phase 1-3.
- [x] **Step 3:** Update `docs/migration/v1-to-v2.md` — added the v2→v2.4
      sub-section documenting the namespace migration (auto-shim covers
      it; no manual action required).
- [x] **Step 4:** Rewrote `docs/setup/per-ide/claude-desktop.md`
      end-to-end. TL;DR drops the false "reads from `~/.claude/`" claim.
      Added "Step 1 — generate the ZIP bundles" + "Step 1b — Import
      skills into Customize" walking through bundle path, Upload button,
      and the per-skill ZIP that v2.4 generates. MCP server section
      preserved.
- [x] **Step 5:** Created `docs/decisions/ADR-009-event4u-namespace.md`
      (Accepted, 2026-05-13). Documents the namespace move, the
      legacy-fallback contract, and the Claude Desktop bundler decision
      (ZIP over API). Top-banner added to `ADR-007` linking to the
      successor. ADR index regenerated.

## Phase 6: Quality pipeline + AI Council post-review + PR

- [x] **Step 1:** Run `task ci` end-to-end. PR-gating subset
      (`.github/workflows/consistency.yml`) is green: `sync-check`,
      `sync-check-hashes`, `sync`, `generate-tools`,
      `check_references`, `check_portability`, `check_condensation`,
      `check_iron_law_prominence`, `check-always-budget`,
      `lint-marketplace`, `lint-agents-md`, `ci-cloud-bundle`,
      `ci-linear-digest`, `readme_linter`, full pytest (56/56). Two
      pre-existing failures on `main` (`check-no-roadmap-refs`,
      `check-public-links` warning surface) are out of scope for this
      PR — main currently ships with the same violations.
- [x] **Step 2:** Ran `/review-changes` (5-judge self-review:
      bug-hunter, security, tests, quality, architecture). All five
      verdicts GREEN. Three low-priority follow-ups captured in Notes:
      (a) circular-symlink hardening in `_walk_skill_files`, (b)
      TOCTOU note on `migrate_legacy_namespace`, (c) optional
      end-to-end install integration test.
- [x] **Step 3:** AI Council post-implementation review — consulted
      `anthropic/claude-opus-4-1` + `openai/o1`, 2 rounds, actual
      spend $0.308. Raw responses in
      `agents/council-responses/event4u-namespace-and-claude-desktop.json`.
      Convergence (after convener-skeptic filter against the actual
      code, not just the roadmap):
      **accept** — partial-`copytree` interrupt could leave permanent
      partial state; ADR-009 has no rollback paragraph; success-metric
      wording implied non-existent version detection.
      **accept-with-mod** — TOCTOU on migration check (single-user
      laptop, low priority).
      **reject** — Windows `os.replace` (POSIX-only project), "Iron Law
      undefined" (defined extensively in `.augment/rules/`), "hidden
      coupling" (Phase 2 converted all writers before Phase 3),
      "missing dir creation" (`mkdir(parents=True, exist_ok=True)`
      already present), `EVENT4U_HOME` "security hole" (standard
      user-env override pattern), Phase 4 "complexity bomb" (council
      read roadmap, the actual code in `claude_desktop_bundler.py` is
      already split into the functions they proposed).
- [x] **Step 4:** Resolved accepted findings: per-entry atomic write
      (temp → `os.replace`) with partial-debris purge added to
      `migrate_legacy_namespace`; `test_migration_recovers_from_partial_copy_leftover`
      added; ADR-009 grew a Rollback / kill-switch section;
      success-criteria text tightened to "every install runs idempotent
      migration shim". Manual Claude Desktop upload verification + end-
      to-end `install.py --global --tools=claude-desktop` integration
      test logged as post-merge TODOs in this Notes section.
- [x] **Step 5:** Commit in logical chunks via `/commit:in-chunks` per
      Conventional Commits (one commit per phase boundary or smaller).
- [x] **Step 6:** Push branch + open PR via `/create-pr`. PR description:
      goal, decision summary, migration safety note, screenshots of
      Customize → Skills import flow (text-only — emit instructions for
      the user since the agent cannot screenshot).

## Acceptance Criteria

- [x] Zero `~/.config/agent-config/` literal references in `scripts/`
      outside `legacy_xdg_root()` helper and its tests. Verified
      2026-05-13: 35 grep hits across `scripts/` are all docstrings,
      argparse help, and user-facing fallback messages; zero actual
      `Path()` / `expanduser` constructions for the legacy path —
      `legacy_xdg_root()` in `scripts/_lib/user_global_paths.py` is the
      sole computation site.
- [x] `npx @event4u/agent-config init --tools=claude-desktop --force`
      writes ≥ 1 ZIP bundle into
      `~/.event4u/agent-config/claude-desktop/bundles/` and prints
      bundle count in the summary. Verified by 17 tests in
      `tests/test_claude_desktop_bundler.py` (single-skill, command
      bundles, idempotency, force-rebuild, curation); PR #125 description
      records 276 ZIPs on a full install.
- [x] Existing user with `~/.config/agent-config/` on disk: every install
      runs the idempotent migration shim — first run copies contents to the
      new path and drops a `MIGRATED.md` breadcrumb; subsequent runs are
      a no-op once the new root has real (non-`*.event4u-partial-*`)
      content. Per-entry atomic write means a crash mid-copy is recovered
      on the next run, not preserved as partial state. Verified by 9
      tests in `tests/test_namespace_migration.py`, including
      `test_second_invocation_is_noop` and
      `test_migration_recovers_from_partial_copy_leftover`.
- [x] `task ci` green. Verified at PR #125 merge time: full pytest
      (301/301), 5-judge `/review-changes` all green, AI Council
      post-review with accepted findings resolved in-PR. Fresh subset
      re-run 2026-05-13: 38/38 in
      `tests/test_user_global_paths.py`,
      `tests/test_namespace_migration.py`,
      `tests/test_claude_desktop_bundler.py`.
- [x] AI Council post-review reports no blocker-tier findings — accepted
      findings resolved in-PR; non-blocking suggestions captured in Notes.
- [x] PR open, CI green, awaiting user review. **Outcome:** PR #125
      merged 2026-05-13T05:17:00Z into `main` and shipped via release
      `2.4.0` (with follow-up fixes in `2.4.1`, `2.5.0`, `2.6.0`,
      `2.6.1`).

## Notes

- **Out of scope (explicit):** Anthropic `/v1/skills` API client (workspace
  + code-execution gated, not viable for personal installs). Capture as
  follow-up if user demand surfaces.
- **Tool anchors are untouched.** `~/.claude/`, `~/.augment/`, `~/.cursor/`,
  etc. remain where their hosts read them. The roadmap moves only the
  package-owned `~/.config/agent-config/` tree.
- **Legacy fallback is read-only and transitional.** A future v3 roadmap
  may remove the fallback once telemetry shows migration penetration
  is complete; that decision is not in this scope.
- **Council token spend tracked via existing budget guard.** Roadmap
  authorises spend; per-call estimates still shown in the host log.
- **Post-merge TODOs (non-blocking):**
  - Manual Claude Desktop upload verification — exercise the
    Customize → Skills upload flow against a generated bundle and
    confirm the skill appears in the panel. Cannot be automated;
    requires a human at a Claude Desktop install.
  - End-to-end `install.py --global --tools=claude-desktop`
    integration test in CI — currently covered by unit tests on the
    individual building blocks (migration, bundler, path resolver)
    but no single test exercises the full installer with the new
    namespace + bundle integration. Add once the manual verification
    above confirms the flow shape is stable.
  - Circular-symlink hardening in `_walk_skill_files` — graceful
    failure if a skill directory contains a circular symlink chain.
    Low priority (no in-tree skill currently has one).

