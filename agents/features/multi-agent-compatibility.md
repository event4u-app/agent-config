# Feature: Multi-Agent Compatibility Layer

> Ship agent-config rules to all major AI coding tools via symlinks and generated files, so every tool benefits from our rules without content duplication.

**Status:** 📋 Planned
**Created:** 2026-04-13
**Author:** matze4u
**Jira:** none
**Module:** project-wide
**Context:** `agents/roadmaps/caveman-compress-integration.md`

## Problem

The `galawork/agent-config` package currently only works with **Augment Code**. Other AI coding tools (Claude Code, Cursor, Copilot, Windsurf, Cline, Codex, Gemini CLI) each expect their own config files in specific locations. Teams using multiple tools get no benefit from the 24 curated rules, and maintaining separate copies per tool would be unsustainable.

## Proposal

1. Classify rules as **universal** (~17) vs **Augment-only** (~7)
2. Make universal rules tool-agnostic (remove Augment-specific tool references)
3. Create **symlinks** from tool-specific directories (`.claude/rules/`, `.cursor/rules/`, `.clinerules/`) → `.augment/rules/`
4. **Generate** single-file configs (`.windsurfrules`, `GEMINI.md`) by concatenating key rules
5. Extend the Composer plugin to create symlinks in target projects
6. Unify YAML frontmatter so one file works for all tools

## Scope

### In Scope

- Refactor `token-efficiency.md` and `rtk.md` to be tool-agnostic
- Classify all 24 rules (universal vs Augment-only)
- Unify frontmatter format (add `alwaysApply` for Cursor compatibility)
- Create symlink directories: `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
- Generate `.windsurfrules` from concatenated universal rules
- Symlink `GEMINI.md` → `AGENTS.md`
- Extend `AgentConfigPlugin` to create symlinks in target projects
- Update `composer.json` archive to include new directories/files
- Update `scripts/compress.py` to generate tool-specific outputs
- Tests for symlink creation and plugin changes

### Out of Scope (deferred)

- Shipping **skills** to other tools (only rules for now)
- Shipping **commands** to other tools (Augment-specific concept)
- Per-file glob scoping for Cursor/Claude (all rules load always for now)
- Custom `.cursorrules` legacy format (deprecated by Cursor)
- Tool-specific rule compression (same compressed file for all tools)

## Affected Areas

| Area | Impact |
|---|---|
| `.augment.uncompressed/rules/` | Refactor 2 files, add frontmatter to all 24 |
| `.augment/rules/` | Compressed versions get new frontmatter |
| `.claude/rules/` | New directory with symlinks |
| `.cursor/rules/` | New directory with symlinks |
| `.clinerules/` | New directory with symlinks |
| `.windsurfrules` | New generated file |
| `GEMINI.md` | New symlink → `AGENTS.md` |
| `src/AgentConfigPlugin.php` | New symlink creation method |
| `scripts/compress.py` | New `--generate-tools` mode |
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
- [ ] Windows symlink support — does Composer plugin need admin rights?
- [ ] Should `CLAUDE.md` remain a separate file or become a symlink to `AGENTS.md`?

## Dependencies

- Completed compression roadmap (done — `caveman-compress-integration.md`)
- No external packages needed

## Acceptance Criteria

- [ ] 17 universal rules available in `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
- [ ] `.windsurfrules` generated with all universal rules
- [ ] `GEMINI.md` symlinked to `AGENTS.md`
- [ ] `token-efficiency.md` and `rtk.md` are tool-agnostic
- [ ] Composer plugin creates symlinks in target projects (with copy fallback)
- [ ] All existing tests pass + new tests for symlink/generation logic
- [ ] No content duplication — single source in `.augment/rules/`

## Roadmaps

→ `agents/roadmaps/multi-agent-compatibility.md`

## Notes

- Cline natively reads `.cursorrules`, `.windsurfrules`, AND `AGENTS.md` — so Cline gets rules from multiple sources automatically
- AGENTS.md is emerging as the universal standard (backed by OpenAI Codex, supported by Cursor, Copilot, and others)
- Claude Code docs explicitly state "symlinks are resolved normally"
