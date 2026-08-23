---
model_tier: medium
name: module-detect-on-the-fly
description: "When editing a module-shaped path (`Modules/*`, `packages/*`, `apps/*`) while `modules.enabled` is false — asks once to enable it; also the project/stack + task-runner detection reference."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# module-detect-on-the-fly

## When to use

Fires the first time the agent edits, reads, or references a file
inside a module-shaped path while the project has not yet opted into
the module config. Goal: catch projects with real module structure
that never ran `/agents init` or the GUI wizard, and offer to enable
the config — once, without nagging.

**Trigger heuristic** (any one):

- The agent is about to edit a path matching `*/Modules/*`,
  `*/app/Modules/*`, `*/packages/*/<non-noise>`, `*/apps/*/<non-noise>`,
  `*/src/Module*/*`, or `*/internal/*/<non-noise>`.
- The user names such a path in their request.
- A `/module *` command runs while `modules.enabled` is `false`.

**Hard gate** — skip the skill entirely when **any** of these hold:

1. `modules.enabled` is `true` (already configured — use `module-management`).
2. `modules.detection_acknowledged` is `true` (user already answered).
3. The path matches a `_NOISE_SEGMENTS` entry (`vendor`, `node_modules`,
   `dist`, `build`, etc.) — see `scripts/_lib/module_detection.ts`.

Confirm both flags via `get_modules_config()` before running detection.

## Procedure

1. **Detect** — call `detect_module_roots(project_root)` from
   `scripts/_lib/module_detection.ts`. Returns a list of
   `ModuleCandidate` ordered `high → medium` confidence.
2. **Bail early** — if the list is empty OR every candidate has
   `confidence: "medium"` AND no candidate matches the path the agent
   is currently working on, skip silently. (False positives nag worse
   than missed detections.)
3. **Surface once** — present a single numbered-options block:

   ```text
   Detected module-shaped structure not yet in config:
   - app/Modules/  (laravel-hmvc, high confidence, 4 modules)
   - packages/     (node-monorepo, medium confidence, 2 candidates)

   1. Enable modules config — add detected paths to
      `.agent-project-settings.yml` so module-aware skills activate.
   2. Not now — silence this prompt for the project (you can revisit
      via `/agents init` later).
   3. Show details first — list the candidates with their stack guess
      and per-module subdirs before deciding.

   Recommendation: 1 when the high-confidence list matches your
   intent. 2 when the layout is intentionally flat.
   ```

4. **Persist the choice**:

   - **Option 1** — build the payload (matches `propose_modules_config.ts
     --json` shape, includes `detection_acknowledged: true`), pipe into
     `./scripts-run src/scripts/apply_modules_config --project <root>`.
   - **Option 2** — run `./scripts-run src/scripts/apply_modules_config
     --project <root> --acknowledge-only`. Flips only the ack flag;
     every other `modules.*` key stays untouched.
   - **Option 3** — list candidates, then loop back to step 3.

5. **Resume the original task** — never block work on the prompt. If
   the user picks 2, treat the project as flat for the rest of the
   session.

## Output format

1. One-paragraph note naming the detected paths + stack guess +
   confidence per row.
2. Single numbered-options block (1 = enable, 2 = silence,
   3 = show details).
3. After the user picks: the apply-script invocation that was run,
   then resume the original task on the next turn.

## Gotcha

- **False positives nag worse than misses.** Only fire when
  `is_module_like_path()` matches AND `detect_module_roots()` returns
  a `high`-confidence candidate that overlaps the path the agent is
  touching. Pure `medium`-only hits on unrelated paths → skip silently.
- **Vendored trees mimic module shape.** `vendor/foo/Modules/Bar`,
  `node_modules/*/packages/*`, `dist/Modules/*` — the noise filter in
  `is_module_like_path()` already drops these, but never call
  `detect_module_roots()` against a vendored sub-root.
- **Maintainer dogfooding.** This repo (`event4u/agent-config`) ships
  `packages/*/agents/` that look module-shaped. The repo's own
  `.agent-project-settings.yml` sets `detection_acknowledged: true` to
  silence the skill here.
- **Intentional flat monorepos.** When `packages/*` is just a
  vendoring directory for unrelated tools, option 2 is the right
  answer and the skill must respect it permanently.

## Do NOT

- Do NOT background-scan. Detection only runs when the trigger
  heuristic fires on a path the agent is actively touching.
- Do NOT re-prompt once `modules.detection_acknowledged` is `true`.
  Re-entry goes through `/agents init`, never automatic.
- Do NOT auto-enable on a `high`-confidence match. The user has to
  pick option 1 — the whole point is one explicit decision.
- Do NOT commit or push the patched `.agent-project-settings.yml`.
  Persistence writes the file only; staging is the user's call per
  `commit-policy`.
- Do NOT block the original task on the prompt. If the user ignores
  the options block, continue the work and treat the project as flat
  for the rest of the session.

## Project & module detection reference

_Origin: migrated from `src/rules/architecture.md` per the P4 pattern of `road-to-kernel-and-router.md`. The rule keeps the Iron-Law block, General Principles, and the ADR paragraph; the detection mechanics live here._

### Project detection

Detect the current project type from the **Git remote URL**, **directory name**, or **project files**:

- **PHP** — `composer.json` (framework slot: Laravel via `artisan`, Symfony via `bin/console`, standalone otherwise).
- **JS / TS** — `package.json` (framework slot: Next.js via `next` dep, Nuxt via `nuxt`, Express / Fastify / NestJS via deps; plain Node otherwise).
- **Python** — `pyproject.toml` / `requirements.txt` (framework slot: Django via `django`, FastAPI via `fastapi`, Flask via `flask`).
- **Go** — `go.mod` (framework slot: `gin`, `echo`, `fiber`, stdlib `net/http`).
- **Ruby** — `Gemfile` (framework slot: Rails via `rails` gem, Sinatra otherwise).
- **Rust** — `Cargo.toml` (framework slot: `axum`, `actix-web`, `rocket`).
- Check `AGENTS.md` or `agents/` for project-specific documentation.

Tooling lives in a runner file at the project root — detect once and reuse the result:
`Taskfile.yml` → `task`, `Makefile` → `make`, `package.json` `scripts:` → `npm` / `pnpm` / `yarn`, `pyproject.toml` `[tool.poetry.scripts]` or `[project.scripts]` → `poetry` / `uv`, framework CLIs (`artisan`, `bin/console`, `manage.py`, `bin/rails`) when the matching manifest is present.

### Project-specific architecture docs

Each project documents its own architecture in `./agents/` and/or `AGENTS.md`.
**Always read those files** before making structural decisions. Do not rely on
generic rules for project-specific directory layouts, database conventions, or
module systems.

### Module-level documentation

Some projects use a module system (e.g. `app/Modules/` in Laravel, `apps/`/`packages/` in a Turborepo, `src/modules/` in NestJS, `internal/` in Go).
Module roots and the per-module agent-docs folder are configured via
`modules.root_paths` and `modules.agent_folder` in `.agent-settings.yml`
(resolve at runtime via `scripts/_lib/agent_settings.ts::enumerate_modules()`).
Modules may have their own agent docs under
`{module_root}/*/{agent_folder}/` (Laravel shape: `app/Modules/*/agents/`) with:

- Module descriptions and feature docs
- Module-specific roadmaps (`agents/roadmaps/`)
- Module-specific documentation (`Docs/`)

When working on a module, **always check for module-level agent docs** first.

### Packages

Packages (Composer, npm, etc.) may also use `./agents/` in their root
for package-specific docs and roadmaps. Treat them the same way as projects.

### Build / task runner detection

Projects use either `Makefile` or `Taskfile.yml` (or both) for common commands.
**Always check which one exists** and read it to discover available targets for
testing, quality checks, container access, migrations, etc.

- `Makefile` → use `make <target>`
- `Taskfile.yml` → use `task <target>`

Prefer these targets over raw `docker compose exec` commands when available.

## See also

- `module-management` — the active skill once modules are configured.
- `scripts/_lib/module_detection.ts` — `detect_module_roots()` +
  `is_module_like_path()` helpers.
- `scripts/apply_modules_config.ts` — persistence with
  `--acknowledge-only` for option 2.
- `commands/agents/init.md` — the explicit re-entry point if the user
  wants to revisit detection later.
