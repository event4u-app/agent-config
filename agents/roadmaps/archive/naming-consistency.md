# Naming Consistency Roadmap

Source: Naming audit across all rules, skills, commands, and guidelines.
Goal: Consistent, precise, self-documenting names across all layers.

## Naming Principles

1. **Name = purpose.** Reading the name should tell you what it does.
2. **No collisions across layers.** A rule and skill must NOT share the same name.
3. **Consistent prefixes** for related items: `project-analysis-*`, `laravel-*`, `feature-*`.
4. **Consistent suffixes** for similar roles: `-creator`, `-integration`, `-config`.
5. **No bare nouns** — `jira-integration` says nothing, `jira-integration` says everything.

## Impact Assessment

Renaming affects: folder names, SKILL.md `name:` field, compressed copies, symlinks (.claude/, .cursor/),
`.augmentignore`, cross-references in other skills/rules/commands, AGENTS.md, copilot-instructions.md.

**Process per rename:**
1. Rename folder in `.agent-src.uncompressed/`
2. Update `name:` in frontmatter
3. Run `/compress` for changed file
4. Run `task generate-tools` to regenerate symlinks
5. Search all `.md` files for old name → update references
6. Run `task sync-check` + linter

---

## Phase 1: Layer Collisions (HIGH — causes real confusion)

| Current | Layer | Rename to | Reason |
|---|---|---|---|
| `agent-docs-writing` | rule | `agent-docs-writing` (keep) | Rule triggers on agent doc editing |
| `agent-docs-writing` | skill | `agent-docs-writing` | Skill is the "how to write" workflow |
| `commands` | rule | `slash-commands` | Rule is about slash command execution |
| `commands` | skill | `command-routing` | Skill routes and extends command execution |

## Phase 2: Too Generic Names (MEDIUM — hurts discoverability)

### Skills

| Current | Rename to | Reason |
|---|---|---|
| `context-create` | `context-document` | Creates context documents, not "context" in general |
| `module-management` | `module-management` | Manages modules (create, explore, work within) |
| `override-management` | `override-management` | Creates and manages overrides |
| `php-coder` | `php-coder` | Writes PHP code specifically |
| `jira-integration` | `jira-integration` | Jira API usage, queries, transitions |
| `sentry-integration` | `sentry-integration` | Sentry error investigation via MCP |
| `copilot-config` | `copilot-config` | Configures Copilot behavior |
| `sql-writing` | `sql-writing` | Writes raw SQL queries |

### Rules

| Current | Rename to | Reason |
|---|---|---|
| `rtk` | `rtk-output-filtering` | Abbreviation alone is meaningless |
| `cli-output-handling` | `cli-output-handling` | Actually about CLI output redirect/efficiency |
| `laravel-translations` | `laravel-translations` | About Laravel i18n files specifically |

### Guidelines

| Current | Rename to | Reason |
|---|---|---|
| `php/general.md` | `php/general.md` | `php/general.md` is redundant |

## Phase 3: Inconsistent Patterns (LOW — cosmetic but worth fixing)

### Suffix inconsistencies

| Current | Rename to | Pattern |
|---|---|---|
| `code-refactoring` | `code-refactoring` | `-ing` for activity skills, not `-er` for agents |
| `feature-planning` | `feature-planning` (keep) | Already matches; commands use short forms which is OK |
| `roadmap-management` | `roadmap-management` | Match `module-management`, `override-management` |
| `copilot-agents-optimization` | `copilot-agents-optimization` | Match pattern |
| `dependency-upgrade` | `dependency-upgrade` (keep) | Already clear |

### Command alignment

| Current | Note |
|---|---|
| `feature-dev` | Keep — distinct from `feature-plan`/`feature-explore` (it's the implementation phase) |
| `copilot-agents-optimize` | Keep — matches `optimize-*` command prefix |

## Phase 4: Naming Guideline (ensure future consistency)

- [x] Add naming conventions to `guidelines/agent-infra/naming.md`
- [x] Cover: skills, rules, commands, guidelines folder/file naming
- [x] Add linter check: warn on bare-noun skill names (single word without qualifier)

---

## Execution Order

1. **Phase 1** first — collisions cause actual routing confusion
2. **Phase 2** in batches of 5 — each rename needs full reference update
3. **Phase 3** opportunistically — fix when touching the file anyway
4. **Phase 4** after Phase 1+2 — codify the patterns

## Risk Mitigation

- Run `task generate-tools` after every batch
- Run linter `--all` after every batch
- Run `task sync-check` after every batch
- Run `task check-refs` after every batch — catches broken cross-references from renames
- Search for old names in ALL `.md` files: `grep -r "old-name" .augment* agents/`
- Test that `.augmentignore` entries still match after renames

## Tooling

- `scripts/check_references.py` — detects broken paths, skill/rule name references
- `task check-refs` — run from Taskfile
- Part of `task ci` pipeline
