# Roadmap: Multi-Agent Compatibility Layer

> Feature: `agents/features/multi-agent-compatibility.md`
> Created: 2026-04-13

## Context

The agent-config package ships 24 rules in `.augment/rules/`, ~60 skills in `.augment/skills/`,
and ~50 commands in `.augment/commands/`. 17 rules are universally useful for any AI coding tool.

This roadmap covers three delivery layers:
1. **Rules** → symlinks to `.claude/rules/`, `.cursor/rules/`, `.clinerules/`, `.windsurfrules`
2. **Skills** → symlinks to `.claude/skills/` following the **Agent Skills open standard** (agentskills.io)
3. **Commands** → converted to Claude Code Skills with `disable-model-invocation: true`

### Agent Skills Open Standard (agentskills.io)

The [Agent Skills](https://agentskills.io) format was developed by Anthropic and released as an
open standard. It uses `SKILL.md` files with YAML frontmatter and is supported by **30+ tools**:

| Tool | Skills Path | Notes |
|---|---|---|
| **Claude Code** | `.claude/skills/` | Full standard + extensions (subagents, hooks, effort) |
| **Cursor** | `.cursor/skills/` | Agent Skills support |
| **GitHub Copilot** | `.github/skills/` | Agent Skills support |
| **VS Code** | `.vscode/skills/` | Via Copilot integration |
| **Gemini CLI** | `.gemini/skills/` | Agent Skills support |
| **Roo Code** | Skills support | Agent Skills support |
| **OpenAI Codex** | Skills support | Agent Skills support |
| **Kiro** | Skills support | Agent Skills support |
| **Junie** | Skills support | JetBrains Agent Skills |
| **TRAE** | Skills support | ByteDance agent |

### Mapping: Augment → Agent Skills Standard

| Augment Concept | Agent Skills Equivalent | Frontmatter |
|---|---|---|
| **Rules** (`.augment/rules/`) | Tool-specific rules dirs | N/A (rules ≠ skills) |
| **Skills** (`.augment/skills/*/SKILL.md`) | `.claude/skills/*/SKILL.md` | Default (both user + model invoke) |
| **Commands** (`.augment/commands/*.md`) | `.claude/skills/*/SKILL.md` | `disable-model-invocation: true` |

Our Augment skills already follow 90% of the standard — same directory structure
(`skill-name/SKILL.md`), same concept (description-based matching). The main gap:
our SKILL.md files lack YAML frontmatter (`name`, `description`).

## Rule Classification

### Universal rules (17) — ship to all tools

| Rule | Type | Purpose |
|---|---|---|
| `ask-when-uncertain` | always | Ask when unsure |
| `architecture` | auto | File/class creation rules |
| `commit-conventions` | auto | Git conventions |
| `context-hygiene` | auto | 3-failure debugging rule |
| `dev-efficiency` | auto | CLI output handling |
| `docker-commands` | auto | PHP in Docker |
| `downstream-changes` | auto | Find all affected files |
| `e2e-testing` | auto | Playwright rules |
| `guidelines` | always | Guideline references |
| `lang-files` | auto | i18n conventions |
| `language-and-tone` | always | Communication style |
| `php-coding` | always | PHP coding standards |
| `quality-workflow` | auto | PHPStan/Rector/ECS |
| `rtk` | auto | CLI output filtering |
| `scope-control` | always | Stay in scope |
| `token-efficiency` | always | Efficient context usage |
| `user-interaction` | always | Numbered options |
| `verify-before-complete` | always | Verify before claiming done |

### Augment-only rules (7) — NOT shipped to other tools

| Rule | Reason |
|---|---|
| `agent-docs` | References `.augment/` structure |
| `augment-portability` | Augment `.augment/` directory rules |
| `augment-source-of-truth` | `.augment.uncompressed/` workflow |
| `commands` | Augment command system |
| `docs-sync` | `.augment/` cross-references |
| `model-recommendation` | Augment model switching |

---

## Phase 1: Make rules tool-agnostic

### Step 1.1: Refactor `token-efficiency.md`

Source: `.augment.uncompressed/rules/token-efficiency.md`

Changes:
- [ ] **Line 20-23**: Replace `sequentialthinking` → "extended reasoning / chain-of-thought tools". Keep the anti-loop guidance.
- [ ] **Line 37**: Replace `"Wo waren wir stehen geblieben?"` → `"Where were we?"` (English in .md rule)
- [ ] **Line 76**: Replace `/agent-handoff` → "start a fresh session / hand off context"
- [ ] **Line 80**: Replace "Run `/agent-handoff`" → "Initiate a session handoff or start fresh"

- [ ] **Line 104/110**: Replace `.agent-settings` references → "project settings file (e.g. `.agent-settings`)"
- [ ] **Line 119**: Replace `str-replace-editor` → "the editor tool / edit tool"
- [ ] **Line 126-135**: Replace Augment tool names (`codebase-retrieval`, `search_query_regex`, `view_range`) → generic descriptions:
  - `codebase-retrieval` → "codebase search tools"
  - `search_query_regex` → "regex search in files"
  - `view_range` → "view specific line ranges"
  - Keep the behavior guidance identical, just remove tool-specific names
- [ ] **Line 208-223**: Extract "Ignored Skills Recovery" section into new **Augment-only block** at the end:
  ```
  ## Augment-specific

  _The following section applies only to Augment Code._

  ### Ignored Skills Recovery
  {existing content}
  ```
- [ ] Compress updated file → `.augment/rules/token-efficiency.md`

### Step 1.2: Refactor `rtk.md`

Source: `.augment.uncompressed/rules/rtk.md`

Changes:
- [ ] **Line 33**: Replace `.agent-settings` check → "project settings file"
- [ ] **Line 39**: Remove "recommended by Matze" (personal reference)
- [ ] **Line 50**: Replace `/optimize-rtk-filters` → "generate project-local filters (see Post-Install Setup)"
- [ ] **Line 52**: Replace `.agent-settings` → "project settings file"
- [ ] Compress updated file → `.augment/rules/rtk.md`

### Step 1.3: Verify no quality loss

- [ ] Diff original vs refactored — every behavioral instruction must be preserved
- [ ] Only tool-name references and personal references change
- [ ] Augment-specific sections must be clearly separated, not removed

---

## Phase 2: Unify frontmatter

### Step 2.1: Define universal frontmatter schema

Target format for universal rules:

```yaml
---
type: "always"          # Augment: always-active
description: "..."      # Augment + Cursor: human-readable description
alwaysApply: true       # Cursor: load for every file
---
```

For `type: "auto"` rules:

```yaml
---
type: "auto"            # Augment: loaded on topic match
description: "..."      # Augment + Cursor: used for matching
alwaysApply: false      # Cursor: only when description matches
---
```

Notes:
- Claude Code: no `globs` → rule loads on every request (matches our `always` behavior)
- Cursor: `alwaysApply: true` = always loaded, `false` = loaded when description matches
- Cline: ignores frontmatter entirely, always loads all files in `.clinerules/`

### Step 2.2: Update all 17 universal rules

- [ ] `ask-when-uncertain.md` — add `description` + `alwaysApply: true`
- [ ] `architecture.md` — add `alwaysApply: false` (keep auto)
- [ ] `commit-conventions.md` — add `alwaysApply: false`
- [ ] `context-hygiene.md` — add `alwaysApply: false`
- [ ] `dev-efficiency.md` — add `alwaysApply: false`
- [ ] `docker-commands.md` — add `alwaysApply: false`
- [ ] `downstream-changes.md` — add `alwaysApply: false`
- [ ] `e2e-testing.md` — add `alwaysApply: false`
- [ ] `guidelines.md` — add `description` + `alwaysApply: true`
- [ ] `lang-files.md` — add `alwaysApply: false`
- [ ] `language-and-tone.md` — add `description` + `alwaysApply: true`
- [ ] `php-coding.md` — add `description` + `alwaysApply: true`
- [ ] `quality-workflow.md` — add `alwaysApply: false`
- [ ] `rtk.md` — add `alwaysApply: false`
- [ ] `scope-control.md` — add `description` + `alwaysApply: true`
- [ ] `token-efficiency.md` — add `description` + `alwaysApply: true`
- [ ] `user-interaction.md` — add `description` + `alwaysApply: true`
- [ ] `verify-before-complete.md` — add `description` + `alwaysApply: true`

### Step 2.3: Compress all updated rules

- [ ] Run `task sync` to copy non-.md changes
- [ ] Compress all 17 modified rules to `.augment/rules/`
- [ ] `task sync-mark-all-done` to update hashes
- [ ] Verify: `python3 scripts/compress.py --check` passes

---

## Phase 3: Create symlink directories

### Step 3.1: Add generation logic to `scripts/compress.py`

Add `--generate-tools` mode that:

1. Reads `config/universal-rules.json` for the rule list
2. Creates `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
3. Removes stale symlinks in each directory
4. Creates relative symlinks: e.g. `.claude/rules/php-coding.md` → `../../.augment/rules/php-coding.md`

- [ ] Implement `generate_tool_dirs()` function
- [ ] Add `--generate-tools` CLI flag
- [ ] Add stale symlink cleanup (remove links to rules no longer in UNIVERSAL_RULES)
- [ ] Add `--clean-tools` flag to remove all generated directories

### Step 3.2: Generate `.windsurfrules`

Part of `--generate-tools`:

1. Read all universal rules from `.augment/rules/`
2. Strip YAML frontmatter from each
3. Concatenate with `---` separator
4. Prepend header: `# Auto-generated from .augment/rules/ — do not edit directly`
5. Write to `.windsurfrules`

- [ ] Implement `generate_windsurfrules()` function
- [ ] Strip YAML frontmatter before concatenation
- [ ] Add header comment

### Step 3.3: Create `GEMINI.md` symlink

- [ ] Create `GEMINI.md` → `AGENTS.md` symlink in project root
- [ ] Verify git stores it correctly (`git ls-files -s GEMINI.md` shows symlink mode `120000`)

### Step 3.4: Add Taskfile targets

- [ ] Add `task generate-tools` → `python3 scripts/compress.py --generate-tools`
- [ ] Add `task clean-tools` → `python3 scripts/compress.py --clean-tools`
- [ ] Update `task sync` to also run `--generate-tools` after sync

### Step 3.5: Update `composer.json`

Ensure the following are **NOT** in `archive.exclude`:
- `.claude/`
- `.cursor/`
- `.clinerules/`
- `.windsurfrules`
- `GEMINI.md`
- `config/`

- [ ] Update `composer.json` archive.exclude list

---

## Phase 3b: Add Agent Skills frontmatter to existing Skills

### Step 3b.1: Add YAML frontmatter to all SKILL.md files

Our `.augment.uncompressed/skills/*/SKILL.md` files already follow the directory structure
of the Agent Skills standard, but lack YAML frontmatter. Adding `name` and `description`
makes them compliant with the agentskills.io spec.

For each SKILL.md, add frontmatter extracted from the existing first paragraph / description:

```yaml
---
name: quality-tools
description: "Use when running code quality checks — PHPStan, Rector, ECS. Knows all commands, parameters, and execution rules."
---
```

Augment Code ignores YAML frontmatter in SKILL.md — it reads descriptions from `<available_skills>`
in the system prompt. So adding frontmatter is backward-compatible.

- [ ] Add `name` + `description` frontmatter to all ~60 SKILL.md files in `.augment.uncompressed/skills/`
- [ ] Verify Augment still loads skills correctly (frontmatter is ignored)
- [ ] Compress all updated SKILL.md files to `.augment/skills/`

### Step 3b.2: Classify skills for cross-tool delivery

Not all skills should ship to other tools. Classify:

**Universal skills** — useful for any AI coding tool:
- All language/framework skills (php, laravel, eloquent, javascript, typescript, react, vue, etc.)
- All pattern/practice skills (api-design, database, security, performance, etc.)
- All testing skills (pest-testing, api-testing, playwright-testing, etc.)
- Quality tools, git-workflow, docker, etc.

**Augment-only skills** — reference Augment internals:
- `agent-docs`, `copilot-agents-optimizer`, `override`, `file-editor`
- `guidelines`, `commands`, `context` (reference `.augment/` structure)
- `skill-reviewer` (Augment skill system internals)
- `sequential-thinking` (Augment-specific tool reference)

- [ ] Create `config/universal-skills.json` listing all universal skill names
- [ ] ~45-50 universal, ~10-15 Augment-only (exact count after classification)

### Step 3b.3: Skill directory structure with supporting files

The Agent Skills standard supports full directories — not just `SKILL.md`:

```
quality-tools/
├── SKILL.md              ← Main instructions (required, discovered by agents)
├── scripts/
│   └── detect-tools.sh   ← Script Claude can execute via Bash tool
├── templates/
│   └── config.yaml       ← Template for Claude to fill in
└── examples/
    └── phpstan-fix.md    ← Example output showing expected format
```

Currently all our skills are SKILL.md-only. Supporting files can be added later
without changing the generation logic — they just need to be symlinked alongside.

Reference from `SKILL.md` so the agent knows when to load them:

```markdown
## Additional resources
- For tool detection logic, run `scripts/detect-tools.sh`
- For configuration examples, see [examples/phpstan-fix.md](examples/phpstan-fix.md)
```

Key: `${CLAUDE_SKILL_DIR}` variable resolves to the skill directory at runtime,
so scripts can be referenced as `${CLAUDE_SKILL_DIR}/scripts/detect-tools.sh`.

- [ ] Document the supporting files pattern in skill template
- [ ] Ensure generation script symlinks entire skill directories (not just SKILL.md)

### Step 3b.4: Generate `.claude/skills/` symlinks

Part of `--generate-tools`:

1. Read `config/universal-skills.json` for skill list
2. For each universal skill, symlink the **entire directory**:
   `.claude/skills/{name}/` → `../../../.augment/skills/{name}/`
   (This automatically includes SKILL.md + any scripts, templates, examples)
3. Remove stale skill symlinks on re-run

- [ ] Implement `generate_skill_symlinks()` function in `compress.py`
- [ ] Symlink entire directories (not individual files) for future-proofing
- [ ] Add stale cleanup for removed skills

---

## Phase 3c: Port Commands → Claude Code Skills

### Step 3c.1: Transform Augment commands to Agent Skills format

Augment commands (`.augment/commands/*.md`) are flat Markdown files invoked by `/command-name`.
Claude Code Skills use `skill-name/SKILL.md` in a directory with YAML frontmatter.

Transform each command:

**Before** (`.augment/commands/create-pr.md`):
```markdown
# Create PR
1. Check current branch...
2. Create PR description...
```

**After** (`.claude/skills/create-pr/SKILL.md`):
```yaml
---
name: create-pr
description: "Create a pull request with conventional commit title and structured description"
disable-model-invocation: true
---

# Create PR
1. Check current branch...
2. Create PR description...
```

Key frontmatter for commands:
- `disable-model-invocation: true` — only user can invoke (same as Augment commands)
- `$ARGUMENTS` placeholder where Augment commands expect user input

- [ ] Create transformation script or template
- [ ] Classify which commands are universal vs Augment-only
- [ ] Transform ~30 universal commands to `.claude/skills/` format

### Step 3c.2: Handle command arguments

Augment commands use inline prompts for user input. Claude Code uses `$ARGUMENTS`:

| Augment Pattern | Claude Code Equivalent |
|---|---|
| Inline "ask the user for X" | `$ARGUMENTS` or `$0`, `$1` |
| Read from context | `$ARGUMENTS` with `argument-hint` |

For commands that don't need arguments (most of ours): no change needed.
For commands with variable input: add `$ARGUMENTS` and `argument-hint`.

- [ ] Audit all commands for argument patterns
- [ ] Add `argument-hint` frontmatter where appropriate
- [ ] Add `$ARGUMENTS` substitution in command body where needed

### Step 3c.3: Create `config/universal-commands.json`

```json
{
  "commands": [
    "commit",
    "create-pr",
    "quality-fix",
    "fix-ci",
    "bug-fix",
    "feature-dev",
    "tests-create"
  ]
}
```

- [ ] Classify commands: universal vs Augment-only
- [ ] Create config file
- [ ] Add to generation script

---

## Phase 3d: Extend generation for skills and commands

### Step 3d.1: Update `scripts/compress.py`

Extend `--generate-tools` to also handle:

1. Skills: read `config/universal-skills.json`, create `.claude/skills/` symlinks
2. Commands: read `config/universal-commands.json`, generate `.claude/skills/` with transformed content

- [ ] Add `generate_claude_skills()` function
- [ ] Add `generate_claude_commands()` function
- [ ] Add command transformation logic (add frontmatter, replace argument patterns)
- [ ] Update `--clean-tools` to also clean skills and commands

### Step 3d.2: Handle Augment ↔ Claude Code coexistence

Both `.augment/skills/` and `.claude/skills/` will exist. Ensure:
- Augment reads from `.augment/skills/` (unchanged)
- Claude Code reads from `.claude/skills/` (symlinks → `.augment/skills/`)
- Commands only exist in `.claude/skills/` (Augment reads from `.augment/commands/`)
- No name collisions between skills and converted commands

- [ ] Verify no naming conflicts
- [ ] Document the dual-directory strategy

---

## Phase 4: Extend Composer Plugin

### Step 4.1: Add symlink creation to `AgentConfigPlugin`

New method `createToolSymlinks(string $packageDir, string $projectRoot)`:

1. Read `config/universal-rules.json` from package for rule list
2. For each tool dir (`.claude/rules`, `.cursor/rules`, `.clinerules`):
   a. Create directory if missing
   b. Remove stale symlinks (links pointing to files no longer in list)
   c. Create relative symlinks from `{tool-dir}/{rule}.md` → `../../.augment/rules/{rule}.md`
   d. Fallback: if `symlink()` fails → `copy()` instead + log warning

- [ ] Implement `createToolSymlinks()` method
- [ ] Implement `getUniversalRules()` — reads from `config/universal-rules.json`
- [ ] Implement `getRelativePath()` helper for calculating relative symlink targets
- [ ] Implement Windows fallback (copy instead of symlink, log warning)
- [ ] Call from `install()` method after `syncDirectory()`

### Step 4.2: Add skills and commands symlink creation

New method `createSkillSymlinks(string $packageDir, string $projectRoot)`:

1. Read `config/universal-skills.json` from package for skill list
2. Create `.claude/skills/` directory
3. For each universal skill: symlink entire skill directory
4. For converted commands: copy transformed SKILL.md files

- [ ] Implement `createSkillSymlinks()` method
- [ ] Handle skill directories with supporting files
- [ ] Create `.claude/skills/{command}/SKILL.md` for converted commands
- [ ] Call from `install()` method after rule symlinks

### Step 4.3: Add `.windsurfrules` and `GEMINI.md` sync

In `install()` method, after existing syncs:

- [ ] `.windsurfrules` → always overwrite (auto-generated, not user-editable)
- [ ] `GEMINI.md` → create symlink to `AGENTS.md` if not exists, copy fallback
- [ ] Keep `CLAUDE.md` as `copyIfMissing` (users may have customized it)

### Step 4.3: Create `config/universal-rules.json`

Single source of truth for which rules are universal:

```json
{
  "rules": [
    "ask-when-uncertain.md",
    "architecture.md",
    "commit-conventions.md",
    "context-hygiene.md",
    "dev-efficiency.md",
    "docker-commands.md",
    "downstream-changes.md",
    "e2e-testing.md",
    "guidelines.md",
    "lang-files.md",
    "language-and-tone.md",
    "php-coding.md",
    "quality-workflow.md",
    "rtk.md",
    "scope-control.md",
    "token-efficiency.md",
    "user-interaction.md",
    "verify-before-complete.md"
  ]
}
```

- [ ] Create `config/universal-rules.json`
- [ ] Both `compress.py` and `AgentConfigPlugin.php` read from this single source
- [ ] Ensure `config/` is NOT in `composer.json` archive.exclude

---

## Phase 5: Tests

### Step 5.1: Python tests (extend `tests/test_compress.py`)

Rules generation:
- [ ] Test `generate_tool_dirs()`: creates symlinks for all 17 universal rules
- [ ] Test `generate_tool_dirs()`: does NOT create symlinks for Augment-only rules (7)
- [ ] Test `generate_tool_dirs()`: cleans stale symlinks on re-run
- [ ] Test `generate_windsurfrules()`: concatenates all rules, strips frontmatter
- [ ] Test `generate_windsurfrules()`: output starts with header comment
- [ ] Test `generate_windsurfrules()`: rules separated by `---`
- [ ] Test GEMINI.md symlink creation and target

Skills generation:
- [ ] Test `generate_claude_skills()`: creates symlinks for universal skills
- [ ] Test `generate_claude_skills()`: does NOT create symlinks for Augment-only skills
- [ ] Test `generate_claude_skills()`: symlinks supporting files in skill directories
- [ ] Test `generate_claude_skills()`: cleans stale skill symlinks on re-run

Commands generation:
- [ ] Test `generate_claude_commands()`: creates SKILL.md with correct frontmatter
- [ ] Test `generate_claude_commands()`: `disable-model-invocation: true` in all generated files
- [ ] Test `generate_claude_commands()`: preserves original Markdown content
- [ ] Test `generate_claude_commands()`: adds `$ARGUMENTS` where configured

### Step 5.2: PHP tests for Composer plugin

File: `tests/AgentConfigPluginTest.php`

- [ ] Test `createToolSymlinks()`: creates `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
- [ ] Test `createSkillSymlinks()`: creates `.claude/skills/` with correct structure
- [ ] Test symlinks point to correct relative paths (resolve and check target exists)
- [ ] Test stale symlink cleanup on re-run
- [ ] Test copy fallback when symlink fails (mock `symlink()` failure)
- [ ] Test `.windsurfrules` is always overwritten on update
- [ ] Test `GEMINI.md` symlink creation

---

## Phase 6: Documentation & Commit

### Step 6.1: Update documentation

- [ ] `AGENTS.md`: add section "Multi-Agent Support" listing supported tools and Agent Skills standard
- [ ] `.augment.uncompressed/README.md`: mention generated tool directories and skills
- [ ] Create `.claude/rules/README.md`: "Auto-generated symlinks — see .augment/rules/"
- [ ] Create `.claude/skills/README.md`: "Auto-generated from .augment/skills/ and .augment/commands/"
- [ ] Create `.cursor/rules/README.md`: same as .claude
- [ ] Create `.clinerules/README.md`: same

### Step 6.2: Commit plan

| # | Scope | Commit message |
|---|---|---|
| 1 | Rules refactor | `refactor: make token-efficiency and rtk rules tool-agnostic` |
| 2 | Rule frontmatter | `feat: add unified frontmatter for multi-tool rule compatibility` |
| 3 | Skill frontmatter | `feat: add Agent Skills frontmatter to all SKILL.md files` |
| 4 | Rule generation | `feat: add --generate-tools for rule symlinks and .windsurfrules` |
| 5 | Skill generation | `feat: generate .claude/skills/ from augment skills and commands` |
| 6 | Composer plugin | `feat: extend AgentConfigPlugin for rules + skills delivery` |
| 7 | Config + tests | `test: add config files and tests for multi-agent generation` |
| 8 | Documentation | `docs: document multi-agent compatibility and Agent Skills support` |

### Step 6.3: Final verification

- [ ] `python3 scripts/compress.py --check` passes
- [ ] `python3 -m pytest tests/` all green
- [ ] `ls -la .claude/rules/` — 17 symlinks, all resolve
- [ ] `ls -la .claude/skills/` — universal skills + converted commands present
- [ ] `ls -la .cursor/rules/` — 17 symlinks, all resolve
- [ ] `ls -la .clinerules/` — 17 symlinks, all resolve
- [ ] `cat .windsurfrules | head -3` — starts with header, no frontmatter
- [ ] `readlink GEMINI.md` → `AGENTS.md`
- [ ] Augment Code works as before (no regression in `.augment/` loading)
- [ ] Claude Code can discover and invoke skills via `/skill-name`

---

## Acceptance Criteria

### Rules (Phase 1-3)
- [ ] 17 universal rules available via symlinks in `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
- [ ] `.windsurfrules` auto-generated with all universal rules, no YAML frontmatter
- [ ] `GEMINI.md` symlinks to `AGENTS.md`
- [ ] `token-efficiency.md` and `rtk.md` are tool-agnostic (no Augment-specific tool names)
- [ ] Augment-specific content clearly separated in `## Augment-specific` sections
- [ ] `config/universal-rules.json` is single source of truth for rule classification

### Skills (Phase 3b)
- [ ] All SKILL.md files have `name` + `description` YAML frontmatter (agentskills.io compliant)
- [ ] Universal skills available in `.claude/skills/` via symlinks
- [ ] `config/universal-skills.json` classifies skills as universal/Augment-only
- [ ] Augment Code still loads skills correctly (backward compatible)

### Commands (Phase 3c)
- [ ] Universal commands converted to `.claude/skills/*/SKILL.md` format
- [ ] All converted commands have `disable-model-invocation: true` frontmatter
- [ ] `$ARGUMENTS` substitution works for commands that need input
- [ ] `config/universal-commands.json` lists converted commands

### Infrastructure (Phase 4-6)
- [ ] Composer plugin creates rules + skills symlinks in target projects (copy fallback)
- [ ] All tests pass (Python + PHP)
- [ ] No content duplication — single source in `.augment/`
- [ ] Documentation covers Agent Skills standard and multi-tool support

## Notes

- `verify-before-complete` was added to universal list (18 not 17) — corrected count throughout
- When adding new rules: add to `config/universal-rules.json`, re-run `task generate-tools`
- When adding new skills: add to `config/universal-skills.json`, re-run `task generate-tools`
- Cline also auto-reads `.cursorrules`, `.windsurfrules`, and `AGENTS.md` — triple coverage
- Agent Skills standard (agentskills.io) ensures future compatibility with new tools
- Skills with `disable-model-invocation: true` don't consume context budget in Claude Code
- Augment ignores YAML frontmatter in SKILL.md — adding it is fully backward-compatible
- Skills can bundle scripts, templates, and examples alongside SKILL.md — agents discover the
  directory and SKILL.md references supporting files. Use `${CLAUDE_SKILL_DIR}` in Claude Code
  to resolve paths at runtime. Currently all our skills are SKILL.md-only; supporting files
  can be added incrementally without changing generation logic.