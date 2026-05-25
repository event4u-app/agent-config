---
slug: clean-skill-distribution-channels
title: Clean Skill Distribution Channels — eliminate dual-registration across Claude, Augment, and cross-scope installs
owner: matze4u
opened: 2026-05-25
status: ready
complexity: structural
related_adrs: []
related_feedback:
  - 2026-05-25 chat — Claude session showed `copilot-config` twice in available-skills, once with the current project description, once with a stale description from `~/.claude/skills/`. Root cause traced to cross-scope install drift (`~/.claude/skills/copilot-config/` vs `.claude/skills/copilot-config/` with different versions of SKILL.md frontmatter).
depends_on: []
---

# Clean Skill Distribution Channels — eliminate dual-registration across Claude, Augment, and cross-scope installs

> A 2026-05-25 investigation surfaced a real package-side hygiene gap. When `event4u/agent-config` is installed at multiple scopes for the same tool (most concretely: `~/.claude/skills/<id>/` AND project-local `.claude/skills/<id>/`), the host harness loads both registrations, exposing the same skill name twice with whatever description each scope happens to carry. The session in question observed `copilot-config` registered with two different `description:` strings — the project version (`"Tune the GitHub Copilot AI…"`) and an older user-level version (`"Use when configuring GitHub Copilot…"`). Same class of issue exists structurally for Augment (it ships `.augment-plugin/marketplace.json` with `source: "."` alongside the `.augment/` filesystem tree). Cursor / Cline / Windsurf / Copilot ship filesystem-only, no plugin manifest, so they are not affected by the *same-install plugin↔filesystem* shape — but the *cross-scope* shape (user-global install + project-local install) still applies to any tool that supports both scopes. This roadmap converts the finding into a structural fix: confirm where dual-channel actually fires, pick a canonical channel per tool, ship a tool-agnostic probe that detects cross-scope drift at `agent-config setup` time, and document the harness behaviours that look like bugs but are not.

## Prerequisites

- [x] Confirm the 2026-05-25 finding — `copilot-config` SKILL.md description differs between `~/.claude/skills/copilot-config/SKILL.md` ("Use when configuring GitHub Copilot…") and `.claude/skills/copilot-config/SKILL.md` ("Tune the GitHub Copilot AI…"). Both currently load into one Claude session.
- [x] Inventory provider distribution surfaces — Claude ships `.claude/skills/` (351 entries) + `.claude-plugin/marketplace.json` (351 unique paths). Augment ships `.augment/` (rules + commands + contexts + personas + skills) + `.augment-plugin/marketplace.json` (`source: "."`). Cursor ships `.cursor/{rules,commands,personas,user-types}` filesystem-only. Cline ships `.clinerules/` (75 flat files) filesystem-only. Windsurf ships `.windsurf/{rules,workflows}` filesystem-only. Copilot ships a single `copilot-instructions.md` file, no skill registry.
- [x] Confirm `quality.local_auto_run: false` in `agents/settings/.agent-settings.yml` — roadmap must NOT schedule full-pipeline CI steps per `roadmap-ci-steps-policy`. Targeted verifications only.
- [x] Confirm no overlap with `road-to-adoption-proof-and-ci-green.md` (CI workflows + recruit sessions + MCP registry) and `road-to-deep-root-restructure.md` (root layout). This roadmap is **distribution hygiene** — orthogonal to both.
- [x] Confirm relevant rules — `non-destructive-by-default` (no destructive scope changes without explicit confirmation), `commit-policy` (no auto-commit), `roadmap-progress-sync` (flip + dashboard same reply), `roadmap-ci-steps-policy` (`local_auto_run: false` → no `task ci` shaped steps), `augment-source-of-truth` (edits land in `packages/<pack>/.agent-src.uncompressed/`).

## Context

Three structurally distinct duplication paths can coexist; this roadmap separates them so each gets a targeted fix:

1. **Same-install plugin↔filesystem path.** A single install ships both `.claude-plugin/marketplace.json` (which Claude Code can ingest as a plugin) AND a `.claude/skills/` filesystem tree (which Claude Code loads directly). If both load into the same session, every skill is registered twice. Confirmed structural; in-session evidence still ambiguous because the *observed* duplication had different descriptions, which is the cross-scope path, not this one. Phase A nails this path down.
2. **Cross-scope user↔project path.** User installs the package globally (e.g. `~/.claude/skills/` at version 1.x) and then a project pulls `event4u/agent-config` at version 2.x into `.claude/skills/`. Both register, with **different** frontmatter. This is the path actually observed in the 2026-05-25 session. Phase B addresses installer behaviour + probe detection.
3. **Cross-version stale-install path.** A previous install left orphaned files at the target scope that never got cleaned up on upgrade. Distinct from (2): same scope, but stale content. Probe in Phase C catches both (2) and (3).

The user explicitly extended scope: *"sollte bei anderen ai anbietern (cursor, copilot, etc.) das selbe problem bestehen, fixe das gleich mit"*. Investigation showed only Claude + Augment have plugin manifests, so path (1) only fires for those two. Paths (2) and (3) apply to every tool that supports user-global + project-local scopes — which is most. The tool-agnostic probe (Phase C) covers all six providers.

The bet: 2–3 week execution slice. Phase A + B can land independently per tool. Phase C is the cross-cutting probe. Phase D documents harness expectations (deferred tools, plugin-namespaced peer skills) so the next agent or onboarding session doesn't re-misdiagnose them as package bugs — the exact failure mode that opened this investigation.

## Phase A: Same-install plugin↔filesystem confirmation and canonical-channel decision

Goal — for Claude and Augment, decide whether shipping BOTH the plugin manifest AND the filesystem projection produces dual-registration in a single install. If yes, pick one canonical channel per tool and retire the other.

- [x] **Step 1:** Reproduce same-install dual-registration on Claude. Spin up a fresh project (no `~/.claude/skills/` overlap — `mv ~/.claude/skills ~/.claude/skills.bak` for the duration of the test). Install `event4u/agent-config` via `scripts/install.sh --scope=project`. Verify with `claude --list-skills` (or whatever the harness exposes) whether `copilot-config` appears once or twice. Record observation at `agents/evidence/audits/2026-05-distribution-channels/01-claude-same-install.md`. ≤ 1 h.
- [x] **Step 2:** Reproduce same-install dual-registration on Augment. Same protocol against `.augment/` + `.augment-plugin/marketplace.json` with `source: "."`. Augment's plugin source-pointer is the whole directory; verify whether the harness deduplicates or double-registers. Record at `agents/evidence/audits/2026-05-distribution-channels/02-augment-same-install.md`.
- [x] **Step 3:** Decide canonical channel per tool. Author `docs/contracts/skill-distribution-channels.md` listing one canonical channel per tool: Claude → plugin OR filesystem (decision driven by Step 1 finding); Augment → plugin OR filesystem (Step 2); Cursor / Cline / Windsurf / Copilot → filesystem (only option exists). Document the rationale for each pick (plugin = upgrade-safe registry; filesystem = simpler, fewer moving parts).
- [x] **Step 4:** Update `scripts/install.sh` and the `task sync` / `task generate-tools` targets to project ONLY the canonical channel per tool. If filesystem-only is canonical for Claude, `task generate-tools` skips `.claude-plugin/marketplace.json` regeneration; if plugin is canonical, `.claude/skills/` is no longer projected. Add a `--legacy-both` flag for users on older harnesses that need the dual channel. Lint: `actionlint` on touched workflows, `shellcheck` on the script. <!-- 2026-05-25: install.sh already filesystem-only by default; --legacy-both flag added as the opt-in dual-channel projection; task generate-tools is unchanged because it does not touch consumer marketplace.json (release.py only bumps version of the published manifest). -->`
- [x] **Step 5:** Add a regression test at `tests/test_canonical_distribution.py` that asserts, after a clean `task sync && task generate-tools` run, only the canonical channel exists for each tool. Coverage: per-tool assertion that the non-canonical artefact is absent (or behind `--legacy-both`).
- [x] **Step 6:** Update `docs/architecture.md` § Content pipelines to reflect the canonical-channel decision. Cross-link from `AGENTS.md` § Emergency triage.

## Phase B: Cross-scope user↔project drift — installer guard

Goal — prevent the exact failure mode observed on 2026-05-25 (user-global install at one version + project-local install at a different version, both registered, drift visible to the agent).

- [x] **Step 1:** Inventory how `scripts/install.sh` handles `--scope=user` and `--scope=project` today. Document the current behaviour at `agents/evidence/audits/2026-05-distribution-channels/03-installer-scope-flow.md`: which directories are written per scope, whether upgrades clean prior versions, whether the installer detects an existing install at the other scope.
- [x] **Step 2:** Author `scripts/_lib/scope_guard.sh` — pre-install hook that detects whether the same package is already installed at the other scope. Output: `OK` (no other-scope install) | `WARN` (other-scope install at same version, no drift) | `DRIFT` (other-scope install at different version, version mismatch likely to cause duplicate registration). Tool-agnostic — checks `~/.claude/skills/`, `.claude/skills/`, `~/.augment/`, `.augment/`, `~/.cursor/rules/`, `.cursor/rules/`, `~/.clinerules/`, `.clinerules/`, `~/.windsurf/rules/`, `.windsurf/rules/`. Reads version from `.augment-plugin/plugin.json` (canonical version source).
- [x] **Step 3:** Wire `scope_guard.sh` into `scripts/install.sh` to run before any file write. On `DRIFT`, surface a numbered-options prompt (per `user-interaction` Iron Law 1): (1) abort install, (2) upgrade other scope first, (3) force install at this scope with drift accepted. No silent override.
- [x] **Step 4:** Add the same guard to `agent-config setup` (the wizard that already exists per `onboarding-gate`). On the first wizard step, run `scope_guard.sh` for all six tools and surface DRIFT/WARN findings before the user picks an install scope.
- [x] **Step 5:** Author a `scripts/cleanup_other_scope.sh` companion script — given an explicit user confirmation, removes a stale install at the other scope. Refuses to run without `--confirm` (per `non-destructive-by-default`). Coverage: unit test with a tmpdir scope simulation.
- [x] **Step 6:** Document the scope policy at `docs/contracts/install-scopes.md`. Default: project-local for application repos; user-global for tooling repos. Cross-link from `README.md` § Installation.

## Phase C: Tool-agnostic skill-registration probe

Goal — a single script that, at any moment (`agent-config setup`, post-install verification, ad-hoc agent invocation), reports duplicate skill registrations across all known tool surfaces. Defence-in-depth against (1), (2), and (3) above.

- [x] **Step 1:** Author `scripts/probe_skill_registration.py` skeleton. Inputs: optional `--tool=<claude|augment|cursor|cline|windsurf|copilot|all>` (default `all`), `--scope=<user|project|all>` (default `all`), `--format=<text|json>` (default `text`). Outputs: per-tool table of (skill-id, scope, source-path, version, description-snippet) plus a `DUPLICATE` section listing every skill-id appearing more than once across scopes/channels.
- [x] **Step 2:** Implement Claude reader. Sources: `~/.claude/skills/*/SKILL.md`, `.claude/skills/*/SKILL.md`, `.claude-plugin/marketplace.json` (if present). Parse frontmatter for `name` + `description` + optional `version` (fall back to package version). Emit one row per source per skill.
- [x] **Step 3:** Implement Augment reader. Sources: `~/.augment/{skills,commands,rules}/`, `.augment/{skills,commands,rules}/`, `.augment-plugin/marketplace.json`. Same row shape.
- [x] **Step 4:** Implement Cursor / Cline / Windsurf / Copilot readers. No plugin manifests; readers are filesystem-only. Cursor → `~/.cursor/rules/*.mdc` + `.cursor/rules/*.mdc`. Cline → `~/.clinerules/*.md` + `.clinerules/*.md`. Windsurf → `.windsurf/rules/*.md` (no global standard). Copilot → `~/.github/copilot-instructions.md` + `.github/copilot-instructions.md` (treated as a single "skill" `copilot-instructions` for duplication checks).
- [x] **Step 5:** Implement duplicate-detection rule. A skill is `DUPLICATE` when its `name` appears in ≥ 2 of: user-scope filesystem, project-scope filesystem, plugin-marketplace. The probe also flags `DRIFT` when two sources have the same `name` but different `description`-hash or different `version` — that is the 2026-05-25 failure mode. Coverage: `tests/test_probe_skill_registration.py` with synthetic fixtures for each duplicate shape.
- [x] **Step 6:** Wire the probe into `agent-config setup` final step — always runs, prints DUPLICATE / DRIFT findings, exits 0 (informational) unless `--strict` is passed. Wire it into `scripts/install.sh` post-install hook with `--strict` so a release install fails loudly on drift.
- [x] **Step 7:** Add a `task probe:skills` Taskfile target that wraps `python3 scripts/probe_skill_registration.py --format=text`. Document in `docs/customization.md` § Troubleshooting as the first thing to run when "a skill appears twice in my AI tool".

## Phase D: Harness-behaviour documentation + onboarding integration

Goal — close the documentation gap that caused the 2026-05-25 misdiagnosis. Two of three "limitations" reported in that session (`codex:*` namespacing, deferred MCP tools) were Claude-Code-harness behaviour, not package bugs. The next agent or onboarding flow must not re-misdiagnose them.

- [x] **Step 1:** Author `docs/contracts/harness-expectations.md` — single document covering the three classes of "looks like a bug, is actually harness behaviour": (a) plugin-namespaced peer skills (`codex:*`, `cc-gemini-plugin:*`) loaded from sibling plugins and not controllable from this package; (b) deferred tools (`TaskCreate`, `WebFetch`, MCP tools) that the Claude Code harness exposes only after `ToolSearch` and have no package-side fix; (c) optional probe-driven dup detection per Phase C. Each section: symptom, what's actually happening, what the package can do (often: nothing), where to look for the true source.
- [x] **Step 2:** Add a `Harness Expectations` section to `README.md` (≤ 15 lines) that points at the contract from Step 1. Front-loads the FAQ before users open a "skill appears twice" issue.
- [x] **Step 3:** Extend the wizard at `agent-config setup` to surface a one-screen "Harness Expectations" page after the install completes — bullet list of the three classes plus a "Run `task probe:skills` if you see duplicates" hint. Implementation: extend the existing TypeScript wizard server already booted by `agent-config setup` (per `onboarding-gate`). No new bridge.
- [x] **Step 4:** Cross-link from `ONBOARDING.md` template at `templates/consumer-settings/ONBOARDING.md` (or equivalent) so consumer projects ship the same expectations note to their downstream developers.
- [x] **Step 5:** Author `agents/recruit-sessions/_findings-distribution.md` placeholder for the recruit sessions in `road-to-adoption-proof-and-ci-green.md` Phase B — instructs the human-owner to ask each recruit specifically whether they observed duplicate skills, and which tool. Feeds back into this roadmap's evidence base.
- [x] **Step 6:** Lint pass — run `python3 scripts/check_refs.py` to verify every new doc cross-link resolves. Run `python3 scripts/skill_linter.py` if any skill file is touched (none should be in this roadmap, but defence-in-depth). <!-- 2026-05-25: check_refs.py not in repo; ran scripts/check_references.py (PASS, no broken references) and skill_linter.py --all (453 pass, 4 warn, 0 fail). -->`

## Acceptance criteria

- Phase A — one canonical distribution channel per tool, documented at `docs/contracts/skill-distribution-channels.md`, regression-tested at `tests/test_canonical_distribution.py`. The `--legacy-both` escape hatch documented for users on older harnesses.
- Phase B — `scripts/install.sh` refuses (or warns with numbered options) on cross-scope drift. `agent-config setup` wizard surfaces drift findings before the install scope is picked.
- Phase C — `scripts/probe_skill_registration.py` detects DUPLICATE and DRIFT across all six tools, wired into `agent-config setup`, `scripts/install.sh --strict`, and `task probe:skills`. Test coverage at `tests/test_probe_skill_registration.py`.
- Phase D — `docs/contracts/harness-expectations.md` published, `README.md` cross-link in place, wizard surfaces the expectations after install completes. The session that opened this roadmap (`copilot-config` apparent duplication) is reproducible only when scopes actually drift; the probe + wizard make the cause visible in under a minute.

## Out of scope

- Fixing externally-distributed plugins (`codex:*`, `cc-gemini-plugin:*`) — those are sibling Claude Code plugins, not this package's surface. Phase D documents the expectation; no other fix attempted.
- Changing how Claude Code, Augment, Cursor, Cline, Windsurf, or Copilot themselves resolve skill sources. The package targets its own distribution discipline, not host-harness behaviour.
- Telemetry / analytics on which tools see duplicates in the wild. Could become a follow-up if Phase C reveals it would change priorities; not in this roadmap.
- Retroactive cleanup of installs at user machines beyond the explicit `scripts/cleanup_other_scope.sh --confirm` path. The package does not auto-delete content at scopes it did not install.
