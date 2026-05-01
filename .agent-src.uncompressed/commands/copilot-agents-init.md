---
name: copilot-agents-init
description: Create AGENTS.md and .github/copilot-instructions.md from scratch in the consumer project — interactive, auto-detects stack, never leaks other projects' identifiers.
skills: [copilot-config, copilot-agents-optimization, agent-docs-writing]
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Project init — only deliberately during onboarding."
---

# /copilot-agents-init

Interactive initializer that **creates** `AGENTS.md` and
`.github/copilot-instructions.md` in the consumer project from the
package-shipped templates (`.augment/templates/AGENTS.md` and
`.augment/templates/copilot-instructions.md`), filling in placeholders
based on auto-detected stack + user answers.

Use when either file is missing, or the user wants to start over with a
clean scaffold. For tuning an existing file, use `/copilot-agents-optimize`.

## Steps

### 1. Precondition checks

```bash
ls AGENTS.md .github/copilot-instructions.md 2>/dev/null
ls .augment/templates/AGENTS.md .augment/templates/copilot-instructions.md
```

Outcomes:

| State | Action |
|---|---|
| Both targets missing | Proceed |
| One exists, other missing | Ask whether to fill only the missing one |
| Both exist | Ask confirmation — offer `/copilot-agents-optimize` instead |
| Template missing | Abort with "package not installed" hint |

### 2. Auto-detect stack

Read (in this order) and record what is found:

- `composer.json` → framework (Laravel / Symfony), PHP version, package name
- `package.json` → framework (Next.js / React / Vue / Node), engines
- `pyproject.toml` / `requirements.txt` → Python framework + version
- `Gemfile` → Rails
- `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle` → language/framework

Secondary signals:

- `Dockerfile`, `docker-compose.yml` → containerized setup
- `Makefile`, `Taskfile.yml`, `package.json` scripts → dev commands
- `phpunit.xml` / `pest.config` / `jest.config` / `vitest.config` / `pytest.ini` → test framework
- `phpstan.neon`, `rector.php`, `eslint.config.js`, `ruff.toml` → quality tools

Present a numbered table so the user can confirm or correct:

```
Detected:
> 1. Language: {lang}            — correct? yes / edit
> 2. Framework: {framework}      — correct? yes / edit
> 3. Database: {db}              — correct? yes / skip / edit
> 4. Test framework: {tests}     — correct? yes / edit
> 5. Dev commands: {commands}    — correct? yes / edit
```

### 3. Gather remaining answers

Ask for values that cannot be auto-detected — one question at a time,
always with numbered options where applicable:

1. **Project name** — default = `{{repo_name}}` from git remote or
   directory name.
2. **One-line description** — used in copilot-instructions.md.
3. **Architecture style** — e.g. "Controllers thin, logic in services,
   validation via FormRequests". Offer `/optimize-agents` style presets
   based on detected framework.
4. **User-facing strings strategy** — translation files? hardcoded?
   default per framework.
5. **Additional conventions** — free text, optional.

### 4. Generate files

Read the templates, substitute placeholders:

| Placeholder | Source |
|---|---|
| `{{project_name}}` | Step 3.1 |
| `{{project_description}}` | Step 3.2 |
| `{{project_description_oneline}}` | Short version of 3.2 |
| `{{primary_language}}`, `{{framework}}`, `{{database}}`, `{{test_framework}}`, `{{code_style_tool}}` | Step 2 |
| `{{dev_start_command}}`, `{{dev_test_command}}` | Step 2 Makefile / scripts |
| `{{project_structure_notes}}`, `{{testing_notes}}`, `{{quality_tools_notes}}` | Offer framework-specific defaults, let user edit |
| `{{architecture_notes}}`, `{{coding_standards}}`, `{{framework_conventions}}` | Offer defaults + user edits |
| `{{test_all_command}}`, `{{test_targeted_command}}`, `{{testing_extra_notes}}` | From detected test framework |
| `{{user_facing_strings_strategy}}` | Step 3.4 |
| `{{target_language_level}}` | e.g. "PHP 8.2 / Laravel 11" |

Remove the HTML comments starting with `<!-- AGENTS.md — entry point …`
and `<!-- copilot-instructions.md — read by GitHub Copilot …` — they are
instructions for the human user and no longer needed once filled.

Keep the **example** HTML comments (those starting with `<!-- Replace with
your actual stack. Examples:`) — they help future maintenance.

### 5. Portability verification

Before writing, scan the generated content for forbidden identifiers:

- Any project name from `agents/` module docs except the one chosen in 3.1
- Any reference to vendor-specific internal tools not in the user's stack
- Any identifier listed in `FORBIDDEN_IDENTIFIERS` in
  `scripts/check_portability.py` (the package ships a blocklist of
  legacy/adjacent project names that must never leak into consumer files)
- The package's own name (e.g. the shared-config package itself), unless
  the consumer project explicitly depends on it

If any hit is found, flag it and ask for a replacement. This mirrors what
`scripts/check_portability.py` enforces for package files.

### 6. Write files

Write to `AGENTS.md` and `.github/copilot-instructions.md` (create
`.github/` if missing). Report:

```
✅  AGENTS.md written (X lines)
✅  .github/copilot-instructions.md written (Y lines)

Next steps:
  1. Review both files and refine sections that say "document your …"
  2. Commit them as part of the project's initial agent setup
  3. Run `/copilot-agents-optimize` periodically to deduplicate against .augment/
```

### 7. Follow-ups

If `agents/` directory does not exist, suggest running `/agents-prepare`.
If `.agent-settings.yml` does not exist, suggest running `scripts/install` (then `/onboard` for first-run setup).

## Rules

- **Never copy from the package's own root `AGENTS.md` or
  `.github/copilot-instructions.md`.** Those are meta docs about the
  package, not templates.
- **Always start from `.augment/templates/`** — that is the only portable
  source.
- **Refuse to overwrite** existing files without explicit `--force` or
  interactive confirmation.
- **Never embed identifiers from other projects** — if the consumer's repo
  is `acme/widget`, the generated file must say `acme/widget`, not any
  name encountered while scaffolding the shared package.
