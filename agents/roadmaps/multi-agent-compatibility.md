# Roadmap: Multi-Agent Compatibility Layer

> Feature: `agents/features/multi-agent-compatibility.md`
> Created: 2026-04-13

## Context

The agent-config package ships 24 rules in `.augment/rules/`. 17 of these are universally useful
for any AI coding tool. This roadmap adds symlink-based delivery to Claude Code, Cursor, Cline,
Windsurf, Codex, and Gemini CLI — zero content duplication.

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

### Step 4.2: Add `.windsurfrules` and `GEMINI.md` sync

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

- [ ] Test `generate_tool_dirs()`: creates symlinks for all 17 universal rules
- [ ] Test `generate_tool_dirs()`: does NOT create symlinks for Augment-only rules (7)
- [ ] Test `generate_tool_dirs()`: cleans stale symlinks on re-run
- [ ] Test `generate_windsurfrules()`: concatenates all rules, strips frontmatter
- [ ] Test `generate_windsurfrules()`: output starts with header comment
- [ ] Test `generate_windsurfrules()`: rules separated by `---`
- [ ] Test GEMINI.md symlink creation and target

### Step 5.2: PHP tests for Composer plugin

File: `tests/AgentConfigPluginTest.php`

- [ ] Test `createToolSymlinks()`: creates `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
- [ ] Test symlinks point to correct relative paths (resolve and check target exists)
- [ ] Test stale symlink cleanup on re-run
- [ ] Test copy fallback when symlink fails (mock `symlink()` failure)
- [ ] Test `.windsurfrules` is always overwritten on update
- [ ] Test `GEMINI.md` symlink creation

---

## Phase 6: Documentation & Commit

### Step 6.1: Update documentation

- [ ] `AGENTS.md`: add section "Multi-Agent Support" listing supported tools
- [ ] `.augment.uncompressed/README.md`: mention generated tool directories
- [ ] Create `.claude/rules/README.md`: "Auto-generated symlinks — see .augment/rules/"
- [ ] Create `.cursor/rules/README.md`: same
- [ ] Create `.clinerules/README.md`: same

### Step 6.2: Commit plan

| # | Scope | Commit message |
|---|---|---|
| 1 | Rules refactor | `refactor: make token-efficiency and rtk rules tool-agnostic` |
| 2 | Frontmatter | `feat: add unified frontmatter for multi-tool compatibility` |
| 3 | Generation script | `feat: add --generate-tools to create symlink dirs and .windsurfrules` |
| 4 | Composer plugin | `feat: extend AgentConfigPlugin to create tool symlinks in target projects` |
| 5 | Config + tests | `test: add universal-rules.json and tests for multi-agent generation` |
| 6 | Documentation | `docs: document multi-agent compatibility layer` |

### Step 6.3: Final verification

- [ ] `python3 scripts/compress.py --check` passes
- [ ] `python3 -m pytest tests/` all green
- [ ] `ls -la .claude/rules/` — 17 symlinks, all resolve
- [ ] `ls -la .cursor/rules/` — 17 symlinks, all resolve
- [ ] `ls -la .clinerules/` — 17 symlinks, all resolve
- [ ] `cat .windsurfrules | head -3` — starts with header, no frontmatter
- [ ] `readlink GEMINI.md` → `AGENTS.md`
- [ ] Augment Code works as before (no regression in `.augment/` loading)

---

## Acceptance Criteria

- [ ] 17 universal rules available via symlinks in `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
- [ ] `.windsurfrules` auto-generated with all universal rules, no YAML frontmatter
- [ ] `GEMINI.md` symlinks to `AGENTS.md`
- [ ] `token-efficiency.md` and `rtk.md` are tool-agnostic (no Augment-specific tool names)
- [ ] Augment-specific content clearly separated in `## Augment-specific` sections
- [ ] `config/universal-rules.json` is single source of truth for rule classification
- [ ] Composer plugin creates symlinks in target projects (copy fallback on failure)
- [ ] All tests pass (Python + PHP)
- [ ] No content duplication — every tool reads from `.augment/rules/` via symlinks

## Notes

- `verify-before-complete` was added to universal list (18 not 17) — corrected count throughout
- When adding new rules in the future: add to `config/universal-rules.json` if universal, re-run `task generate-tools`
- Cline also auto-reads `.cursorrules`, `.windsurfrules`, and `AGENTS.md` — so Cline users get triple coverage