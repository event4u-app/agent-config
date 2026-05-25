---
slug: configurable-modules
status: ready
complexity: lightweight
---

# Road to configurable modules — project-driven module paths and per-module agent folders

> Make module locations a first-class project setting. The package today hard-codes `app/Modules/` (Laravel HMVC) in the `module-management` skill and only detects multi-stack paths inside `/module explore` Step 1. This roadmap lifts that detection into `.agent-project-settings.yml`, wires the installer / onboarding wizard to suggest and confirm the path, generalizes the skill across stacks, and lets the agent discover per-module `agents/` folders from the configured roots.

## Goal

Replace hard-coded module paths with a `modules:` block in `.agent-project-settings.yml` populated during install — and route every module-aware skill, rule, and command through that configuration, including discovery of per-module `agents/` folders.

## Prerequisites

- [ ] Read [`docs/guidelines/agent-infra/layered-settings.md`](../../docs/guidelines/agent-infra/layered-settings.md) — confirm the three-tier model and that `.agent-project-settings.yml` is the right home (committed, team-level).
- [ ] Read [`packages/core/.agent-src.uncompressed/skills/module-management/SKILL.md`](../../packages/core/.agent-src.uncompressed/skills/module-management/SKILL.md) — note the Laravel-only assumption (`app/Modules/`, `App\Modules\…` namespace, `ModuleServiceProvider`).
- [ ] Read [`packages/core/.agent-src.uncompressed/commands/module/explore.md`](../../packages/core/.agent-src.uncompressed/commands/module/explore.md) — confirm the existing multi-stack detection table (Laravel HMVC, Symfony DDD, Node monorepo, Python, Go) is the seed for the auto-suggest logic.
- [ ] Read [`packages/core/.agent-src.uncompressed/templates/agents/agent-project-settings.example.yml`](../../packages/core/.agent-src.uncompressed/templates/agents/agent-project-settings.example.yml) — locate the insertion point for the new `modules:` block.
- [ ] Confirm the source-of-truth contract: every edit lands in `packages/core/.agent-src.uncompressed/`; `.agent-src/`, `.augment/`, and tool projections regenerate via `task sync` + `task generate-tools`.

## Context

Today the module surface is two layers out of sync:

- **`module-management` skill** is Laravel-only (`framework: laravel`, hard-coded `app/Modules/`, `App\Modules\…` namespace). A Symfony, Next.js, or Python project using the package has no skill-level support for its modules even though `/module explore` correctly detects them at runtime.
- **`/module explore` Step 1** detects six stack shapes (`app/Modules/`, `src/<Domain>/`, `packages/`, `src/<package>/`, `internal/`, …) every time it runs, instead of reading a configured value.
- **Installer / wizard** never asks about module paths. A consumer project has to discover the gap by invoking `/module explore` and seeing the auto-detected shape — or by reading the skill and realizing it does not match its layout.

The fix is small and additive: one new block in `.agent-project-settings.yml`, one new install / onboarding step, one skill rewrite, one command-side lookup. No new settings file (the three-tier layered-settings model already covers this), no Hard-Floor moves.

## Phase A: Schema — `modules:` block in `.agent-project-settings.yml`

Add the configuration surface first, document it, wire the loader. No consumer-facing behavior change yet — Phase A ships the contract that Phases B–D build on.

- [ ] **Step 1:** Add a `modules:` block to `packages/core/.agent-src.uncompressed/templates/agents/agent-project-settings.example.yml`. Shape:
  - `modules.enabled` (bool, default `false`) — opt-in flag; when false every module-aware skill skips its module branch.
  - `modules.root_paths` (list of strings, default `[]`) — repo-relative paths to module root directories (e.g. `app/Modules`, `src/modules`, `packages`, `internal`). Multiple entries supported for polyglot repos.
  - `modules.namespace_template` (string, optional) — e.g. `App\Modules\{ModuleName}\App` for Laravel HMVC, `App\{ModuleName}` for Symfony DDD; empty when the stack does not use a PHP-style namespace.
  - `modules.agent_folder` (string, default `agents`) — name of the per-module agent docs directory the agent should look for inside each module.
  - `modules.skip_dirs` (list, default `[".module-template", ".example"]`) — directory names to skip when enumerating modules.
- [ ] **Step 2:** Extend [`docs/guidelines/agent-infra/layered-settings.md`](../../docs/guidelines/agent-infra/layered-settings.md) — add `modules.*` to the team-file example values column and note that `modules.root_paths` is lockable via `locked_keys`.
- [ ] **Step 3:** Extend the centralized settings loader at `scripts/_lib/agent_settings.py` — add a typed accessor (e.g. `get_modules_config()`) returning the merged `modules:` block with defaults applied. No whitelist changes (`modules.*` is **not** user-global; it is a team decision).
- [ ] **Step 4:** Add a Pytest case under `tests/` covering: (a) defaults applied when the block is absent, (b) team values win over package defaults, (c) `locked_keys: [modules.root_paths]` blocks override from `.agent-settings.yml`.
- [ ] **Step 5:** Regenerate `.agent-src/` and tool projections via `task sync` + `task generate-tools`; verify the example template ships the new block in every projection.

**Exit:** new block present in `.example.yml`, loader exposes typed accessor with defaults, tests green for the three precedence cases, projections regenerated.

**Rollback:** revert the four source files and re-run `task sync` + `task generate-tools`. No data migration to undo — block is additive.

## Phase B: Install + onboarding — detect, suggest, confirm

Wire the new schema into the consumer onboarding path so a fresh install actually populates `modules:` instead of leaving it empty.

- [ ] **Step 1:** Extract the multi-stack detection table from `commands/module/explore.md` Step 1 into a reusable Python helper (e.g. `scripts/_lib/module_detection.py`) — pure function: `detect_module_roots(project_root: Path) -> list[dict]` returning candidates with `{path, stack, namespace_template_guess, confidence}`. No interactive logic here.
- [ ] **Step 2:** Add a module-detection step to `scripts/install.py` — runs after stack detection, calls the Phase B Step 1 helper, surfaces candidates as numbered options ("Found `app/Modules/` — use it as module root? [1] yes [2] no [3] enter custom path"). Default to `modules.enabled: false` when the user declines or no candidates surface.
- [ ] **Step 3:** Mirror the install-time step in the wizard UI (`src/ui/wizard/steps.ts` + corresponding TSX) — same detection helper, called via the Python bridge per the [`gui-wizard`](../../docs/contracts/gui-wizard.md) contract. Output goes into the same `.agent-project-settings.yml`.
- [ ] **Step 4:** Update `/agents init` / onboarding rerun flow so existing projects can populate the block after the fact — invoke the same detection helper and patch `.agent-project-settings.yml` in place (preserve comments + ordering; the install script already does this for other blocks).
- [ ] **Step 5:** Add a Pytest case for the detection helper covering each of the six stack shapes from `/module explore` Step 1 (Laravel HMVC, Symfony DDD, Composer/library, Node monorepo, Python `src/<package>/`, Go `internal/`). Use fixture directories under `tests/fixtures/module_detection/`.
- [ ] **Step 6:** Add a Vitest case for the wizard step under `tests/ui/` covering: candidate shown, user accepts, settings written; user declines, `modules.enabled` stays false; custom path entered, accepted.

**Exit:** install + wizard + `/agents init` all populate `modules:` from auto-detection with explicit user confirmation; detection helper has six fixture-backed Pytest cases; wizard step has Vitest coverage.

**Rollback:** revert install / wizard wiring; leave the detection helper in place (cheap to keep, called only from the new step). Existing installs are unaffected — the block stays optional.

## Phase C: Generalize `module-management` skill across stacks

Lift the Laravel-only assumption out of the skill body. The skill should consult `modules.*` from the merged settings and adapt its prose to the configured stack.

- [ ] **Step 1:** Rewrite `packages/core/.agent-src.uncompressed/skills/module-management/SKILL.md` — drop `framework: laravel` from frontmatter, rewrite the "Detection" / "Architecture" sections to read from `modules.root_paths` instead of hard-coding `app/Modules/`. Move the Laravel-specific HMVC details (ModuleServiceProvider, `App\Modules\…` namespace, capital-letter directories) into a clearly-labeled "Laravel HMVC carve-out" section that fires only when `modules.namespace_template` matches the Laravel pattern.
- [ ] **Step 2:** Add stack-specific carve-out sections for Symfony DDD-lite (`src/<Domain>/`), Node monorepo (`packages/<pkg>/`), and Python (`src/<package>/`). Each carve-out is ≤ 25 lines; mirrors the Laravel one but with the matching namespace template and conventions.
- [ ] **Step 3:** Update the skill's "When to use" + description to drop the `app/Modules/` literal and reference the configured roots instead. New trigger phrasing: "Use when working within any module under the project's configured `modules.root_paths` — Laravel HMVC, Symfony DDD-lite, Node monorepo, Python src layout, Go internal/, or a custom path."
- [ ] **Step 4:** Update `packages/core/.agent-src.uncompressed/commands/module/explore.md` Step 1 — replace the inline detection table with a one-line "consult `modules.root_paths` from `.agent-project-settings.yml`; fall back to auto-detection only when the block is empty" pointer. Keep the auto-detection table as a fallback for unconfigured projects.
- [ ] **Step 5:** Add a skill-linter assertion (extend `task lint-skills` or `scripts/lint_skills.py`) — fail the skill audit if `module-management` frontmatter regains `framework:` or if its body hardcodes `app/Modules/` outside the Laravel carve-out section.
- [ ] **Step 6:** Regenerate `.agent-src/` + projections; verify the new skill body lands in `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`.

**Exit:** skill is framework-agnostic, four stack carve-outs documented, `/module explore` consults the configured paths, lint guard prevents regression, projections regenerated.

**Rollback:** restore the previous SKILL.md from git, revert the lint guard, regenerate. No consumer state to undo.

## Phase D: Per-module `agents/` folder discovery and context loading

Make per-module agent docs (features / roadmaps / contexts) discoverable from the configured roots so module-scoped work surfaces module-scoped context automatically.

- [ ] **Step 1:** Extend the Phase A `get_modules_config()` accessor with a helper `enumerate_modules() -> list[Module]` that, for each `modules.root_paths` entry, lists subdirectories (excluding `modules.skip_dirs`) and reports `{name, root_path, has_agent_folder, agent_folder_path}`. The `has_agent_folder` flag checks for the configured `modules.agent_folder` (default `agents`).
- [ ] **Step 2:** Update `/module explore` Step 2 to consume `enumerate_modules()` instead of re-scanning — the table column "Agent Docs" now reflects the configured folder (`agents/`, or whatever `modules.agent_folder` is set to). No prose changes to the table shape; same numbered list.
- [ ] **Step 3:** Add a module-context loader entry point — when the agent enters a module via `/module explore <Name>`, automatically load `{module_root}/{agent_folder}/contexts/*.md` into the conversation context per the existing context-loading conventions in [`.agent-src.uncompressed/commands/context/`](../../packages/core/.agent-src.uncompressed/commands/context/). Skip silently when the folder is absent.
- [ ] **Step 4:** Update `roadmap-writing` SKILL.md — the existing line "module-scoped under `app/Modules/{Module}/agents/roadmaps/`" already mentions the pattern; rewrite to "module-scoped under `{module_root}/{agent_folder}/roadmaps/` where `{module_root}` comes from `modules.root_paths` and `{agent_folder}` from `modules.agent_folder`". Same rewrite for any other skill that references `app/Modules/{Module}/agents/` literally (audit via grep).
- [ ] **Step 5:** Add a Pytest case for `enumerate_modules()` covering: empty `root_paths` returns `[]`; two roots configured, three modules each; skip_dirs honored; `has_agent_folder` flag flips correctly when the folder exists / is missing / is a file.
- [ ] **Step 6:** Add a smoke test that invokes the `/module explore` command body against a fixture project with two configured roots and verifies the rendered overview lists modules from both roots with correct agent-folder flags.
- [ ] **Step 7:** Update the consumer-facing `AGENTS.md` template's emergency-triage block (point 5) to note that per-module agents live under `{module_root}/{agent_folder}/` when `modules.enabled` is true — keep the kernel rules pointer intact.

**Exit:** modules from every configured root are enumerable; `/module explore` lists them with accurate agent-folder flags; entering a module auto-loads its contexts; every skill that references the old hard-coded path now reads from `modules.*`; lint guards prevent regression.

**Rollback:** revert the loader extension, the command body, and the skill audits. Configuration block stays in place (additive); per-module folders untouched on disk.

## Acceptance criteria

- [ ] `.agent-project-settings.yml` carries a fully documented `modules:` block; settings loader exposes a typed accessor with three-tier precedence honored.
- [ ] Fresh install on a Laravel HMVC project surfaces `app/Modules` as a numbered candidate, accepting writes `modules.enabled: true` and `modules.root_paths: [app/Modules]`.
- [ ] Fresh install on a Symfony / Node / Python / Go project surfaces the matching candidate; declining writes `modules.enabled: false` with no other block changes.
- [ ] `/module explore` on a configured project lists every module under every configured root, with accurate "Agent Docs" flags driven by `modules.agent_folder`.
- [ ] `module-management` skill body contains no hard-coded `app/Modules/` reference outside its Laravel HMVC carve-out section; `task lint-skills` enforces this.
- [ ] Entering a module via `/module explore <Name>` auto-loads any `contexts/*.md` it ships; absent folders are skipped silently.
- [ ] Pytest + Vitest coverage for the schema accessor, the detection helper (six stacks), the wizard step, the `enumerate_modules()` helper, and the per-module context loader is green.
- [ ] Layered-settings guideline doc names `modules.*` as a team-tier example; example template ships the block.
- [ ] No changes to user-global whitelist; no Hard-Floor moves; no commit / push / merge steps inside this roadmap.
