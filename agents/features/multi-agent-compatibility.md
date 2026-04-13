# Feature: Multi-Agent Compatibility Layer

> Ship agent-config rules to all major AI coding tools via symlinks and generated files, so every tool benefits from our rules without content duplication.

**Status:** 📋 Planned
**Created:** 2026-04-13
**Author:** matze4u
**Jira:** none
**Module:** project-wide
**Context:** `agents/roadmaps/caveman-compress-integration.md`

## Problem

The `event4u/agent-config` package currently only works with **Augment Code**. Other AI coding tools (Claude Code, Cursor, Copilot, Windsurf, Cline, Codex, Gemini CLI) each expect their own config files in specific locations. Teams using multiple tools get no benefit from the 24 curated rules, ~60 skills, and ~50 commands. Maintaining separate copies per tool would be unsustainable.

## Proposal

1. Classify rules as **universal** (~17) vs **Augment-only** (~7)
2. Make universal rules tool-agnostic (remove Augment-specific tool references)
3. Create **symlinks** from tool-specific directories → `.augment/rules/`
4. **Generate** single-file configs (`.windsurfrules`, `GEMINI.md`)
5. Add **Agent Skills standard** (agentskills.io) frontmatter to all SKILL.md files
6. Port **skills** to `.claude/skills/` via symlinks (30+ tools support the standard)
7. Port **commands** to Claude Code Skills with `disable-model-invocation: true`
8. Extend the Composer plugin to create symlinks in target projects
9. Unify YAML frontmatter so one file works for all tools

## Scope

### In Scope

- Refactor `token-efficiency.md` and `rtk.md` to be tool-agnostic
- Classify all 24 rules (universal vs Augment-only)
- Unify frontmatter format (add `alwaysApply` for Cursor compatibility)
- Create rule symlink directories: `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
- Generate `.windsurfrules` from concatenated universal rules
- Symlink `GEMINI.md` → `AGENTS.md`
- **Add Agent Skills frontmatter** (`name`, `description`) to all SKILL.md files
- **Create `.claude/skills/`** with symlinks to universal skills
- **Convert commands** to Claude Code Skills format (`disable-model-invocation: true`)
- Classify skills and commands (universal vs Augment-only)
- Extend `AgentConfigPlugin` to create rules + skills symlinks in target projects
- Update `composer.json` archive to include new directories/files
- Update `scripts/compress.py` to generate rules, skills, and commands outputs
- Tests for all generation and plugin logic

### Out of Scope (deferred)

- Per-file glob scoping for Cursor/Claude (all rules load always for now)
- Custom `.cursorrules` legacy format (deprecated by Cursor)
- Tool-specific rule compression (same compressed file for all tools)
- Skills delivery to tools other than Claude Code (future: Cursor, Copilot when paths are confirmed)

## Affected Areas

| Area | Impact |
|---|---|
| `.augment.uncompressed/rules/` | Refactor 2 files, add frontmatter to all 24 |
| `.augment.uncompressed/skills/` | Add YAML frontmatter to all ~60 SKILL.md files |
| `.augment/rules/` | Compressed versions get new frontmatter |
| `.augment/skills/` | Compressed versions get new frontmatter |
| `.claude/rules/` | New directory with rule symlinks |
| `.claude/skills/` | New directory with skill symlinks + converted commands |
| `.cursor/rules/` | New directory with rule symlinks |
| `.clinerules/` | New directory with rule symlinks |
| `.windsurfrules` | New generated file |
| `GEMINI.md` | New symlink → `AGENTS.md` |
| `src/AgentConfigPlugin.php` | New symlink creation for rules + skills |
| `scripts/compress.py` | New `--generate-tools` mode for rules, skills, commands |
| `config/` | New config files for universal rules, skills, commands |
| `composer.json` | Update archive.exclude |
| `Taskfile.yml` | New tasks for generation |

## Technical Approach

### Symlinks (directory-based tools)

```
.claude/rules/php-coding.md → ../../.augment/rules/php-coding.md
.cursor/rules/php-coding.md → ../../.augment/rules/php-coding.md
.clinerules/php-coding.md   → ../../.augment/rules/php-coding.md
```

Only universal rules get symlinked. Augment-only rules are excluded.

### Unified frontmatter

```yaml
---
type: "always"          # Augment: always-active
description: "..."      # Augment + Cursor
alwaysApply: true       # Cursor: load for every file
---
```

Each tool reads only the fields it understands, ignores the rest. Verified: Claude Code, Cursor, and Cline all tolerate unknown frontmatter fields.

### Generated files (single-file tools)

`.windsurfrules`: concatenate all universal rules into one file, separated by `---`.
`GEMINI.md`: symlink → `AGENTS.md` (same content).

### Composer Plugin: symlink creation

The plugin creates **relative symlinks** in target projects. Advantage over copying: when `.augment/rules/` is updated via `composer update`, symlinks automatically point to the new content.

Fallback: if symlink creation fails (Windows, restricted filesystem), copy files instead.

### Options Considered

| Option | Pros | Cons | Decision |
|---|---|---|---|
| Symlinks from tool dirs → .augment/rules/ | Zero duplication, auto-updates | Needs plugin changes, Windows compat | ✅ Chosen |
| Copy files to each tool dir | Simple, no symlink issues | N×duplication, stale copies | ❌ Rejected |
| Single AGENTS.md for all tools | Minimal effort | No tool-specific features (globs, etc.) | ❌ Rejected |

## Open Questions

- [x] Which rules are universal vs Augment-only? → Classified (17 universal, 7 Augment-only)
- [x] Can frontmatter be unified? → Yes, tools ignore unknown fields
- [x] Symlinks or copies in target projects? → Symlinks with copy fallback
- [x] Can skills be shipped to other tools? → Yes, via Agent Skills standard (agentskills.io)
- [x] Can commands be ported? → Yes, as Claude Code Skills with `disable-model-invocation: true`
- [ ] Windows symlink support — does Composer plugin need admin rights?
- [ ] Should `CLAUDE.md` remain a separate file or become a symlink to `AGENTS.md`?
- [ ] Exact paths for Cursor/Copilot/Gemini skills directories (confirmed for Claude Code only)

## Dependencies

- Completed compression roadmap (done — `caveman-compress-integration.md`)
- No external packages needed

## Acceptance Criteria

### Rules
- [ ] 17 universal rules available in `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
- [ ] `.windsurfrules` generated with all universal rules
- [ ] `GEMINI.md` symlinked to `AGENTS.md`
- [ ] `token-efficiency.md` and `rtk.md` are tool-agnostic

### Skills (Agent Skills Standard)
- [ ] All SKILL.md files have `name` + `description` YAML frontmatter
- [ ] Universal skills available in `.claude/skills/` via symlinks
- [ ] Augment Code still loads skills correctly (backward compatible)

### Commands
- [ ] Universal commands converted to `.claude/skills/*/SKILL.md` format
- [ ] All converted commands have `disable-model-invocation: true`

### Infrastructure
- [ ] Composer plugin creates rules + skills symlinks in target projects (copy fallback)
- [ ] All existing tests pass + new tests for all generation logic
- [ ] No content duplication — single source in `.augment/`

## Roadmaps

→ `agents/roadmaps/multi-agent-compatibility.md`

## Notes

- Cline natively reads `.cursorrules`, `.windsurfrules`, AND `AGENTS.md` — triple coverage
- AGENTS.md is emerging as the universal standard (backed by OpenAI Codex, Cursor, Copilot)
- Claude Code docs explicitly state "symlinks are resolved normally"
- **Agent Skills standard** (agentskills.io) supported by 30+ tools including Claude Code, Cursor, GitHub Copilot, Gemini CLI, Kiro, OpenAI Codex, Roo Code, TRAE, Junie
- Augment ignores YAML frontmatter in SKILL.md — adding it is fully backward-compatible
- Our SKILL.md directory structure (`skill-name/SKILL.md`) already matches the standard
