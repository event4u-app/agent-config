# Roadmap: Multi-Agent Compatibility Layer

> Feature: `agents/features/multi-agent-compatibility.md`
> Created: 2026-04-13
> Completed: 2026-04-14

## Context

The agent-config package ships 24 rules in `.augment/rules/`, ~60 skills in `.augment/skills/`,
and ~50 commands in `.augment/commands/`.

This roadmap covers three delivery layers:
1. **Rules** → symlinks to `.claude/rules/`, `.cursor/rules/`, `.clinerules/`, `.windsurfrules`
2. **Skills** → symlinks to `.claude/skills/` following the **Agent Skills open standard** (agentskills.io)
3. **Commands** → converted to Claude Code Skills with `disable-model-invocation: true`

> **Architecture note:** During implementation, the approach changed from config-file-driven
> (selecting specific rules/skills via `config/*.json`) to **dynamic directory scanning**
> (all `*.md` in `.augment/rules/`, all dirs in `.augment/skills/`). This means ALL rules
> and skills are delivered to all tools. The `config/` directory was removed.
> Files include `source: package` in frontmatter so agents in target projects know not to edit them.

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

## Rule Delivery

> **Final approach:** ALL rules from `.augment/rules/` are delivered to all tools via symlinks.
> No classification needed — the generation script scans the directory dynamically.
> Rules include `source: package` in frontmatter so agents know not to edit them.
>
> The original plan classified 17 rules as "universal" and 7 as "Augment-only".
> This was dropped because even Augment-specific rules (like `commands.md` or
> `model-recommendation.md`) are useful when someone works on the package itself
> with Claude Code or Cursor.

---

## Phase 1: Make rules tool-agnostic

### Step 1.1: Refactor `token-efficiency.md`

Source: `.agent-src.uncompressed/rules/token-efficiency.md`

Changes:
- [x] **Line 20-23**: Replace `sequentialthinking` → "extended reasoning / chain-of-thought tools". Keep the anti-loop guidance.
- [x] **Line 37**: Replace `"Wo waren wir stehen geblieben?"` → `"Where were we?"` (English in .md rule)
- [x] **Line 76**: Replace `/agent-handoff` → "start a fresh session / hand off context"
- [x] **Line 80**: Replace "Run `/agent-handoff`" → "Initiate a session handoff or start fresh"

- [x] **Line 104/110**: Replace `.agent-settings` references → "project settings file (e.g. `.agent-settings`)"
- [x] **Line 119**: Replace `str-replace-editor` → "the editor tool / edit tool"
- [x] **Line 126-135**: Replace Augment tool names (`codebase-retrieval`, `search_query_regex`, `view_range`) → generic descriptions:
  - `codebase-retrieval` → "codebase search tools"
  - `search_query_regex` → "regex search in files"
  - `view_range` → "view specific line ranges"
  - Keep the behavior guidance identical, just remove tool-specific names
- [x] **Line 208-223**: Extract "Ignored Skills Recovery" section into new **Augment-only block** at the end:
  ```
  ## Augment-specific

  _The following section applies only to Augment Code._

  ### Ignored Skills Recovery
  {existing content}
  ```
- [x] Compress updated file → `.augment/rules/token-efficiency.md`

### Step 1.2: Refactor `rtk.md`

Source: `.agent-src.uncompressed/rules/rtk.md`

Changes:
- [x] **Line 33**: Replace `.agent-settings` check → "project settings file"
- [x] **Line 39**: Remove "recommended by Matze" (personal reference)
- [x] **Line 50**: Replace `/optimize-rtk-filters` → "generate project-local filters (see Post-Install Setup)"
- [x] **Line 52**: Replace `.agent-settings` → "project settings file"
- [x] Compress updated file → `.augment/rules/rtk.md`

### Step 1.3: Verify no quality loss

- [x] Diff original vs refactored — every behavioral instruction must be preserved
- [x] Only tool-name references and personal references change
- [x] Augment-specific sections must be clearly separated, not removed

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

- [x] `ask-when-uncertain.md` — add `description` + `alwaysApply: true`
- [x] `architecture.md` — add `alwaysApply: false` (keep auto)
- [x] `commit-conventions.md` — add `alwaysApply: false`
- [x] `context-hygiene.md` — add `alwaysApply: false`
- [x] `dev-efficiency.md` — add `alwaysApply: false`
- [x] `docker-commands.md` — add `alwaysApply: false`
- [x] `downstream-changes.md` — add `alwaysApply: false`
- [x] `e2e-testing.md` — add `alwaysApply: false`
- [x] `guidelines.md` — add `description` + `alwaysApply: true`
- [x] `lang-files.md` — add `alwaysApply: false`
- [x] `language-and-tone.md` — add `description` + `alwaysApply: true`
- [x] `php-coding.md` — add `description` + `alwaysApply: true`
- [x] `quality-workflow.md` — add `alwaysApply: false`
- [x] `rtk.md` — add `alwaysApply: false`
- [x] `scope-control.md` — add `description` + `alwaysApply: true`
- [x] `token-efficiency.md` — add `description` + `alwaysApply: true`
- [x] `user-interaction.md` — add `description` + `alwaysApply: true`
- [x] `verify-before-complete.md` — add `description` + `alwaysApply: true`

### Step 2.3: Compress all updated rules

- [x] Run `task sync` to copy non-.md changes
- [x] Compress all 17 modified rules to `.augment/rules/`
- [x] `task sync-mark-all-done` to update hashes
- [x] Verify: `python3 scripts/compress.py --check` passes

---

## Phase 3: Create symlink directories

### Step 3.1: Add generation logic to `scripts/compress.py`

Add `--generate-tools` mode that:

1. Scans all `*.md` files in `.augment/rules/`
2. Creates `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
3. Removes stale symlinks in each directory
4. Creates relative symlinks: e.g. `.claude/rules/php-coding.md` → `../../.augment/rules/php-coding.md`

- [x] Implement `generate_tool_dirs()` function
- [x] Add `--generate-tools` CLI flag
- [x] Add stale symlink cleanup (remove links to rules no longer in UNIVERSAL_RULES)
- [x] Add `--clean-tools` flag to remove all generated directories

### Step 3.2: Generate `.windsurfrules`

Part of `--generate-tools`:

1. Read all universal rules from `.augment/rules/`
2. Strip YAML frontmatter from each
3. Concatenate with `---` separator
4. Prepend header: `# Auto-generated from .augment/rules/ — do not edit directly`
5. Write to `.windsurfrules`

- [x] Implement `generate_windsurfrules()` function
- [x] Strip YAML frontmatter before concatenation
- [x] Add header comment

### Step 3.3: Create `GEMINI.md` symlink

- [x] Create `GEMINI.md` → `AGENTS.md` symlink in project root
- [x] Verify git stores it correctly (`git ls-files -s GEMINI.md` shows symlink mode `120000`)

### Step 3.4: Add Taskfile targets

- [x] Add `task generate-tools` → `python3 scripts/compress.py --generate-tools`
- [x] Add `task clean-tools` → `python3 scripts/compress.py --clean-tools`
- [x] Update `task sync` to also run `--generate-tools` after sync

### Step 3.5: Update `composer.json`

Ensure the following are **NOT** in `archive.exclude`:
- `.claude/`
- `.cursor/`
- `.clinerules/`
- `.windsurfrules`
- `GEMINI.md`

- [x] Update `composer.json` archive.exclude list

---

## Phase 3b: Add Agent Skills frontmatter to existing Skills

### Step 3b.1: Add YAML frontmatter to all SKILL.md files

Our `.agent-src.uncompressed/skills/*/SKILL.md` files already follow the directory structure
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

- [x] Add `name` + `description` frontmatter to all ~60 SKILL.md files in `.agent-src.uncompressed/skills/`
- [x] Verify Augment still loads skills correctly (frontmatter is ignored)
- [x] Compress all updated SKILL.md files to `.augment/skills/`

### Step 3b.2: Deliver all skills to other tools

> **Final approach:** All skill directories in `.augment/skills/` are delivered via symlinks.
> No classification needed — dynamic directory scanning replaced the original config-file approach.

- [x] ~~Create `config/universal-skills.json`~~ → Removed, replaced by directory scanning
- [x] All skills delivered to `.claude/skills/` via symlinks

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

- [x] Document the supporting files pattern in skill template
- [x] Ensure generation script symlinks entire skill directories (not just SKILL.md)

### Step 3b.4: Generate `.claude/skills/` symlinks

Part of `--generate-tools`:

1. Scan all directories in `.augment/skills/`
2. For each skill, symlink the **entire directory**:
   `.claude/skills/{name}/` → `../../../.augment/skills/{name}/`
   (This automatically includes SKILL.md + any scripts, templates, examples)
3. Remove stale skill symlinks on re-run

- [x] Implement `generate_skill_symlinks()` function in `compress.py`
- [x] Symlink entire directories (not individual files) for future-proofing
- [x] Add stale cleanup for removed skills

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

- [x] Create transformation script or template
- [x] Classify which commands are universal vs Augment-only
- [x] Transform ~30 universal commands to `.claude/skills/` format

### Step 3c.2: Handle command arguments

Augment commands use inline prompts for user input. Claude Code uses `$ARGUMENTS`:

| Augment Pattern | Claude Code Equivalent |
|---|---|
| Inline "ask the user for X" | `$ARGUMENTS` or `$0`, `$1` |
| Read from context | `$ARGUMENTS` with `argument-hint` |

For commands that don't need arguments (most of ours): no change needed.
For commands with variable input: add `$ARGUMENTS` and `argument-hint`.

- [x] Audit all commands for argument patterns
- [x] Add `argument-hint` frontmatter where appropriate
- [x] Add `$ARGUMENTS` substitution in command body where needed

### Step 3c.3: ~~Create `config/universal-commands.json`~~ → Removed

> Config files were removed. Commands are now discovered by scanning `.augment/commands/`.
> Description is extracted from the `# heading` in each command file.

- [x] ~~Classify commands~~ → All commands delivered
- [x] ~~Create config file~~ → Replaced by directory scanning
- [x] Add to generation script

---

## Phase 3d: Extend generation for skills and commands

### Step 3d.1: Update `scripts/compress.py`

Extend `--generate-tools` to also handle:

1. Skills: scan `.augment/skills/` directories, create `.claude/skills/` symlinks
2. Commands: scan `.augment/commands/` files, generate `.claude/skills/` with transformed content

- [x] Add `generate_claude_skills()` function
- [x] Add `generate_claude_commands()` function
- [x] Add command transformation logic (add frontmatter, replace argument patterns)
- [x] Update `--clean-tools` to also clean skills and commands

### Step 3d.2: Handle Augment ↔ Claude Code coexistence

Both `.augment/skills/` and `.claude/skills/` will exist. Ensure:
- Augment reads from `.augment/skills/` (unchanged)
- Claude Code reads from `.claude/skills/` (symlinks → `.augment/skills/`)
- Commands only exist in `.claude/skills/` (Augment reads from `.augment/commands/`)
- No name collisions between skills and converted commands

- [x] Verify no naming conflicts
- [x] Document the dual-directory strategy

---

## Phase 4: Extend Composer Plugin

### Step 4.1: Add symlink creation to `AgentConfigPlugin`

New method `createToolSymlinks(string $packageDir, string $projectRoot)`:

1. Scan all `*.md` files in `$projectRoot/.augment/rules/`
2. For each tool dir (`.claude/rules`, `.cursor/rules`, `.clinerules`):
   a. Create directory if missing
   b. Remove stale symlinks (links pointing to files no longer in list)
   c. Create relative symlinks from `{tool-dir}/{rule}.md` → `../../.augment/rules/{rule}.md`
   d. Fallback: if `symlink()` fails → `copy()` instead + log warning

- [x] Implement `createToolSymlinks()` method
- [x] ~~Implement `getUniversalRules()`~~ → Replaced by `DirectoryIterator` scan
- [x] Implement `getRelativePath()` helper for calculating relative symlink targets
- [x] Implement Windows fallback (copy instead of symlink, log warning)
- [x] Call from `install()` method after `syncDirectory()`

### Step 4.2: Add skills and commands symlink creation

New method `createSkillSymlinks(string $packageDir, string $projectRoot)`:

1. Scan all directories in `$projectRoot/.augment/skills/`
2. Create `.claude/skills/` directory
3. For each skill: symlink entire skill directory
4. For converted commands: copy transformed SKILL.md files

- [x] Implement `createSkillSymlinks()` method
- [x] Handle skill directories with supporting files
- [x] Create `.claude/skills/{command}/SKILL.md` for converted commands
- [x] Call from `install()` method after rule symlinks

### Step 4.3: Add `.windsurfrules` and `GEMINI.md` sync

In `install()` method, after existing syncs:

- [x] `.windsurfrules` → always overwrite (auto-generated, not user-editable)
- [x] `GEMINI.md` → create symlink to `AGENTS.md` if not exists, copy fallback
- [x] Keep `CLAUDE.md` as `copyIfMissing` (users may have customized it)

### ~~Step 4.4: Create `config/universal-rules.json`~~ → Removed

> Config files were removed. Both `compress.py` and `AgentConfigPlugin.php` scan
> `.augment/rules/` and `.augment/skills/` directories directly.

- [x] ~~Create `config/universal-rules.json`~~ → Replaced by directory scanning
- [x] Both `compress.py` and `AgentConfigPlugin.php` scan `.augment/` directly

---

## Phase 5: Tests

### Step 5.1: Python tests (extend `tests/test_compress.py`)

Rules generation:
- [x] Test `generate_rule_symlinks()`: creates symlinks in all tool dirs for all `.augment/rules/*.md`
- [x] Test `generate_rule_symlinks()`: symlinks resolve correctly
- [x] Test `generate_windsurfrules()`: concatenates all rules, strips frontmatter
- [x] Test `generate_windsurfrules()`: output starts with header comment

Skills generation:
- [x] Test `generate_claude_skills()`: creates symlinks for all skill directories
- [x] Test `generate_claude_skills()`: symlinks resolve to SKILL.md

Commands generation:
- [x] Test `generate_claude_commands()`: creates SKILL.md with correct frontmatter
- [x] Test `generate_claude_commands()`: `disable-model-invocation: true` in all generated files
- [x] Test `generate_claude_commands()`: preserves original Markdown content
- [x] Test `generate_claude_commands()`: strips old frontmatter
- [x] Test `generate_claude_commands()`: extracts description from `# heading`

### Step 5.2: PHP tests for Composer plugin

File: `tests/AgentConfigPluginTest.php`

- [x] Test `createToolSymlinks()`: creates `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
- [x] Test `createSkillSymlinks()`: creates `.claude/skills/` with correct structure
- [x] Test symlinks point to correct relative paths (resolve and check target exists)
- [x] Test stale symlink cleanup on re-run
- [x] Test copy fallback when symlink fails (mock `symlink()` failure)
- [x] Test `.windsurfrules` is always overwritten on update
- [x] Test `GEMINI.md` symlink creation

---

## Phase 6: Documentation & Commit

### Step 6.1: Update documentation

- [x] `AGENTS.md`: add section "Multi-Agent Support" listing supported tools and Agent Skills standard
- [x] `.agent-src.uncompressed/README.md`: mention generated tool directories and skills
- [x] Create `.claude/rules/README.md`: "Auto-generated symlinks — see .augment/rules/"
- [x] Create `.claude/skills/README.md`: "Auto-generated from .augment/skills/ and .augment/commands/"
- [x] Create `.cursor/rules/README.md`: same as .claude
- [x] Create `.clinerules/README.md`: same

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

- [x] `python3 scripts/compress.py --check` passes
- [x] `python3 -m pytest tests/` all green
- [x] `ls -la .claude/rules/` — 24 rule symlinks, all resolve
- [x] `ls -la .claude/skills/` — 99 skill symlinks + 46 command skills
- [x] `ls -la .cursor/rules/` — 24 rule symlinks, all resolve
- [x] `ls -la .clinerules/` — 24 rule symlinks, all resolve
- [x] `cat .windsurfrules | head -3` — starts with header, no frontmatter
- [x] `readlink GEMINI.md` → `AGENTS.md`
- [x] Augment Code works as before (no regression in `.augment/` loading)
- [x] Claude Code can discover and invoke skills via `/skill-name`

---

## Acceptance Criteria

### Rules (Phase 1-3)
- [x] All rules available via symlinks in `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
- [x] `.windsurfrules` auto-generated with all rules, no YAML frontmatter
- [x] `GEMINI.md` symlinks to `AGENTS.md`
- [x] `token-efficiency.md` and `rtk.md` are tool-agnostic (no Augment-specific tool names)
- [x] Augment-specific content clearly separated in `## Augment-specific` sections
- [x] Rules and skills discovered via directory scanning (no config files needed)

### Skills (Phase 3b)
- [x] All SKILL.md files have `name` + `description` YAML frontmatter (agentskills.io compliant)
- [x] All skills available in `.claude/skills/` via symlinks
- [x] Augment Code still loads skills correctly (backward compatible)

### Commands (Phase 3c)
- [x] All commands converted to `.claude/skills/*/SKILL.md` format
- [x] All converted commands have `disable-model-invocation: true` frontmatter
- [x] Description extracted from `# heading` in command files

### Infrastructure (Phase 4-6)
- [x] Composer plugin creates rules + skills symlinks in target projects (copy fallback)
- [x] All tests pass (Python 49 tests)
- [x] No content duplication — single source in `.augment/`
- [x] All files have `source: package` frontmatter for protection in target projects
- [x] Documentation covers Agent Skills standard and multi-tool support

## Notes

- When adding new rules: place in `.augment/rules/`, re-run `task generate-tools`
- When adding new skills: place in `.augment/skills/`, re-run `task generate-tools`
- When adding new commands: place in `.augment/commands/`, re-run `task generate-tools`
- Cline also auto-reads `.cursorrules`, `.windsurfrules`, and `AGENTS.md` — triple coverage
- Agent Skills standard (agentskills.io) ensures future compatibility with new tools
- Skills with `disable-model-invocation: true` don't consume context budget in Claude Code
- Augment ignores YAML frontmatter in SKILL.md — adding it is fully backward-compatible
- `source: package` in frontmatter tells agents in target projects not to edit these files
- Skills can bundle scripts, templates, and examples alongside SKILL.md — agents discover the
  directory and SKILL.md references supporting files. Use `${CLAUDE_SKILL_DIR}` in Claude Code
  to resolve paths at runtime. Currently all our skills are SKILL.md-only; supporting files
  can be added incrementally without changing generation logic.