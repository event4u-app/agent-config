---
complexity: lightweight
---

# Roadmap: Claude Code Global Distribution — close the four-defect chain

> Diagnostic landed in chat 2026-05-28: Claude Code receives zero content
> from this package outside the repo. Four independent defects stack —
> stale-lockfile install-refusal silent-exits, plugin-key drift in the
> consumer bridge, `commands/` missing from the Claude bundle, and an
> open architecture call on slash-commands-vs-skills projection. Each
> ships independently. Phase 3 is a decision gate, not a code change.

## Prerequisites

- [x] Diagnosis: `~/.event4u/agent-config/installed.lock` records
      `agent_config_version: 1.42.0` while `package.json` is at 4.7.2 —
      every `install_global` call hits the version-mismatch refusal at
      `scripts/install.py:3530` and exits 1 before touching `~/.claude/`.
- [x] Diagnosis: `.claude/settings.json` carries `agent-conf@event4u`;
      canonical id per `.claude-plugin/marketplace.json` +
      `scripts/install.py:1104` + `docs/installation.md:422` is
      `agent-config@event4u-agent-config`.
- [x] Diagnosis: `_CLAUDE_SKILL_BUNDLE` (`scripts/install.py:2215`,
      `src/install/wizard-plan.ts:67`) ships `rules` / `skills` /
      `personas` only — no `commands`. Augment and Cursor bundles
      already include commands; Claude Code is the outlier.
- [x] Diagnosis: `scripts/condense.py::generate_claude_commands`
      projects every command into `.claude/skills/<flat-slug>/SKILL.md`
      with `disable-model-invocation: true` in the source frontmatter.
      Result: not routed as a slash-command (no file under
      `.claude/commands/`), filtered from the model-invokable skill
      list (disable flag), invisible to the user.

## Phase 1: Plugin-key drift — heal the consumer bridge ✅

Smallest defect; shipped in one commit with two new tests.

- [x] **Step 1:** Add a `CLAUDE_LEGACY_PLUGIN_IDS` constant near
      `ensure_claude_bridge` listing the abbreviated / pre-rename ids
      observed in the wild (`agent-conf@event4u`,
      `agent-config@event4u`). Canonical id stays
      `agent-config@event4u-agent-config`.
- [x] **Step 2:** Add `_heal_legacy_claude_plugin_ids(path)` helper —
      reads `.claude/settings.json`, removes any stale id from
      `enabledPlugins`, writes back, returns True when anything
      changed. No-op when the file is absent or has no `enabledPlugins`
      dict.
- [x] **Step 3:** Hook the heal into `ensure_claude_bridge` before the
      `merge_json_file` call. Pass `force=force or healed` so the heal
      self-authorises the corrective merge even without `--force`.
- [x] **Step 4:** Add `test_claude_bridge_heals_legacy_plugin_id` next
      to the existing Claude bridge tests in
      `tests/test_install_py.py`. Plus `test_claude_bridge_no_heal_when_clean`
      to guard the no-op path.
- [x] **Step 5:** Run targeted test:
      `python3 -m pytest tests/test_install_py.py -k claude_bridge -v`
      → 4 passed.
- [x] **Step 6:** Manually correct `.claude/settings.json` in this
      repo (`agent-conf@event4u` → `agent-config@event4u-agent-config`).

> **Council caveat (2026-05-28, claude-sonnet-4-5 + gpt-4o, design mode):**
> Phase 1 heal only fires from `ensure_claude_bridge`, which is called
> from the project-scope install path. Global-scope installs do NOT
> invoke the bridge, so global-only consumers stuck on stale ids stay
> broken until they hit a project-scope install pass. Acceptable
> trade-off — the user-affecting drift in practice was the maintainer's
> own repo. Cross-reference Phase 4 / Phase 5 for the source-of-truth
> migration on upgrade.

## Phase 2: Lockfile self-heal — kill the silent-refusal trap

`install_global` refuses cross-version installs at `install.py:3530`
and exits 1. The wizard's NDJSON stream surfaces the refusal but the
user reads it as "installed" because the lockfile timestamp gets
touched anyway. Fix: detect the upgrade case and self-heal.

- [x] **Step 1:** In `install_global`, classify the version mismatch
      using semver comparison on the recorded vs running version:
      * recorded < running → **upgrade path** — log
        "Upgrading lockfile from X to Y, redeploying tools" and
        continue.
      * recorded > running → **downgrade path** — keep the existing
        refusal (rare, user-driven, deserves explicit `--force`).
      * recorded shape unparseable (pre-1.0 / 1.x with namespace
        migration) → treat as upgrade.
- [x] **Step 2:** Move the lockfile rewrite (currently
      `install.py:3555`) to before the deploy. Claim the version slot
      first, then attempt deploy. If deploy fails, surface the error
      but do NOT roll back the version — the deploy retries cleanly
      on next invocation, and the lockfile staying stuck on an ancient
      version is the worse failure mode.
- [x] **Step 3:** Add `test_install_global_heals_pre_2x_lockfile` —
      seed the lockfile with `agent_config_version: 1.42.0`, call
      `install_global({"claude-code"})`, assert the lockfile now
      records the current version AND `~/.claude/skills/` exists in
      the isolated HOME.
- [x] **Step 4:** Run targeted test:
      `python3 -m pytest tests/test_installed_lock.py -v`. Must be
      green. → 30 passed (incl. the two new heal regressions).

## Phase 3: Architecture gate — Claude Code command projection ✅

Decision gate. No code changes. Council session 2026-05-28 (claude-sonnet-4-5 + gpt-4o, design mode, 2 rounds, $0.06 actual) converged.

- [x] **Step 1:** Council convened. Brief:
      `.tmp/council-claude-code-distribution.md`. Responses:
      `agents/runtime/council/responses/claude-code-distribution.json`.
- [x] **Step 2:** Verdicts captured:
      - **Q1 (maintainer mode):** Anthropic D (Hybrid auto-detect +
        visible warning + `AGENT_CONFIG_CONSUMER_MODE=1` override);
        OpenAI B (Refuse-and-ask). Split — going with D per the
        zero-friction 95%-case argument.
      - **Q2 (command projection):** Both converged on **Option B
        (native slash-only)**, CONDITIONAL on:
        1. Plugin loader reads `.claude/commands/` for globally-installed
           plugins (not just cwd-local).
        2. Command parser tolerates `disable-model-invocation: true`
           in frontmatter (or strip during projection).
        3. Kill-switch defined: if native slash doesn't resolve in
           production within 14 days, fall back to dual-projection
           with deprecation timeline.
- [x] **Step 3:** Write ADR via `adr-create` skill (next number under
      `docs/decisions/`). Title: "Claude Code command-projection
      strategy". Status: accepted with three conditions above.
      → [`ADR-030`](../../docs/decisions/ADR-030-claude-code-command-projection.md);
      index regenerated.
- [x] **Step 4:** Verify the three conditions before opening Phase 4:
      - [x] Condition 1 — **VERIFIED EMPIRICALLY 2026-05-28**.
        `~/.claude/commands/probe/sub.md` → `/probe:sub` routed
        successfully via `echo '' | claude --print "/probe:sub"`.
        Native filesystem channel works for user-scope at top-level
        AND in subdirectories (nested colon-namespace per Claude Code
        convention: subdir → `<cluster>:<sub>`). Confirmed by Claude
        itself: *"User-level: `~/.claude/commands/`; Project-level:
        `.claude/commands/`. Subdirectories namespace via colon."*
      - [x] Condition 2 — **VERIFIED EMPIRICALLY 2026-05-28**.
        Probe command carrying our full rich frontmatter
        (`name`, `tier`, `cluster`, `sub`, `skills`, `description`,
        `disable-model-invocation: true`, `suggestion`, `workspaces`,
        `packs`, `lifecycle`, `trust`, `install`) routed
        successfully. Runtime tolerates ALL unknown fields. SUBTLE
        BEHAVIOUR: `disable-model-invocation: true` hides the command
        from `/help` listing BUT keeps it slash-invokable when typed
        directly. This is the **desired UX** for heavyweight commands.
        No frontmatter-strip step needed.
      - [x] Condition 3 — Kill-switch is the inverse of Phase 4 Step 1
        (remove `(".agent-src/commands", "commands")` from
        `_CLAUDE_SKILL_BUNDLE`). One-line revert.

## Phase 4: Bundle expansion + projection per Phase 3 verdict ✅

Implementation phase. Shipped per Council Option B (native slash-only). Skills-projection for backwards compatibility kept for now (`condense.py::generate_claude_commands` unchanged — retirement deferred to a separate roadmap if needed).

- [x] **Step 1:** Extend `_CLAUDE_SKILL_BUNDLE` in
      `scripts/install.py:2215` and `src/install/wizard-plan.ts:67`
      to include `(".agent-src/commands", "commands")`. Both sides
      stay in lockstep per the existing 1:1 mirror contract.
- [-] **Step 2:** ~~Add `generate_claude_slash_commands()` in `scripts/condense.py`~~ — **deferred / not needed for global path**. Native slash-routing works directly off `~/.claude/commands/<cluster>/<sub>.md` (the bundle deploy from Step 1) without a separate condensation projector. The in-repo `.claude/commands/` would only matter for project-scope maintainer testing, which is not in this roadmap's scope.
- [-] **Step 3:** ~~Wire generator into `task sync` / `task generate-tools`~~ — N/A given Step 2 deferred.
- [-] **Step 4:** ~~Add `tests/test_claude_command_projection.py`~~ — N/A given Step 2 deferred. Phase 4 coverage instead comes from the existing `test_global_deploy_claude_code_bundle` family in `tests/test_install_py.py` / `tests/test_installed_lock.py`; if those tests assert the bundle list, they'll auto-cover the new `commands` entry.
- [x] **Step 5:** Re-ran global install end-to-end on this machine:
      `AGENT_CONFIG_DEV_MODE=1 python3 scripts/install.py --tools=claude-code --global --force` → 483 files deployed; `~/.claude/commands/roadmap/` populated (5 files).
- [x] **Step 6:** Manual smoke in fresh headless Claude Code:
      `echo '' | claude --print "List slash commands that start with /roadmap:"` → returns `/roadmap:ai-council`, `/roadmap:create`, `/roadmap:process-full`, `/roadmap:process-phase`, `/roadmap:process-step`. `/roadmap:create test-arg` invoked successfully.

## Phase 5: Wizard postcheck — defense-in-depth ✅

Prevents future regressions of the silent-failure class Phase 2
addressed.

- [x] **Step 1:** In `_deploy_global_content`, after each tool's
      deploy loop, `_verify_deploy_targets(anchor, plan)` checks
      every expected `(_, dest_sub)` target exists AND is non-empty.
      Emits a `"verified"` NDJSON event on success and a
      `"verify_failed"` event with missing-targets list on failure.
- [x] **Step 2:** Status downgrade `"deployed"` → `"deploy_failed"`
      wired in `_deploy_global_content`. In `install_global`, a
      post-deploy correction step computes `failed_tools` and rewrites
      the lockfile to drop them — `merged_tools - failed_tools`. CLI
      surface emits `warn("Lockfile corrected after deploy postcheck …")`.
- [x] **Step 3:** Added `test_install_global_postcheck_drops_failed_tool_from_lockfile`
      in `tests/test_installed_lock.py` — stubs `_verify_deploy_targets`
      to fail one tool, asserts the failed tool is dropped from
      lockfile while siblings remain.
- [x] **Step 4:** Re-ran `python3 -m pytest tests/test_installed_lock.py -v`
      → 31 passed (new postcheck regression included).

## Acceptance criteria

- [x] Phase 1: `_heal_legacy_claude_plugin_ids` heals any stale id
      on next install; `.claude/settings.json` in this repo carries
      the canonical id; targeted test green.
- [x] Phase 2: stale-lockfile no longer blocks deploy on upgrades;
      regression test passes; running
      `python3 scripts/install.py --tools=claude-code --global` on
      this machine successfully populates `~/.claude/`.
- [x] Phase 3: ADR-030 landed; INDEX.md regenerated; Phase 4 plan
      reshaped per Option B verdict.
- [x] Phase 4: `~/.claude/commands/` populated after global install
      (135 .md files); `/roadmap:create test-arg` resolved as a
      native slash-command in headless Claude Code; skill projection
      kept during 14-day kill-switch window per ADR-030.
- [x] Phase 5: deploy verification catches silent-failure class;
      regression test green; `installed.lock` reflects only the
      tools whose deploys actually verified.
- [x] **Q1 follow-up:** maintainer auto-detect (`_is_agent_config_source_repo`)
      added per Council Option D — package.json name match,
      `.agent-src.uncondensed/` at root OR nested under `packages/*/`,
      and installer-self signature. `AGENT_CONFIG_CONSUMER_MODE=1`
      override for end-to-end consumer-flow testing. Visible warning
      on auto-detect.

## Notes

- **Roadmap plans work, not a release.** No version / tag / commit
  step implied — each phase ships when ready, separately.
- **Scope.** All four defects concern Claude Code distribution.
  Augment / Cursor / Copilot bridges are out of scope — their
  plugin-key ids look correct per their own marketplaces
  (`agent-config@event4u` for Augment per `test_augment_bridge`,
  same shape for Copilot per `.github/plugin/marketplace.json`).
- **Phase 3 is a gate, not a placeholder.** Phase 4 work pauses
  until the ADR lands. If Phase 3 verdict picks Option B
  (slash-only) or Option C (commands_unsupported), Phase 4 step list
  shrinks or changes shape.
- **Hard-Floor stays in force.** Phase 2 Step 2 inverts the lockfile
  write order; lockfile contents are user data, not destructive
  state. No `non-destructive-by-default` carve-out needed.
