---
recommended_model: inherit
name: optimize:agents-dir
tier: 2
cluster: optimize
sub: agents-dir
description: Manage the agents/ directory — scaffold, folder-audit, fix. Single command with three modes (--scaffold / --audit / --fix); default = interactive wizard.
skills: [agents-audit, agent-docs-writing, override-management, module-management]
suggestion:
  eligible: true
  trigger_description: "scaffold agents folder, audit agents directory, fix agents docs, clean up overrides, prepare module agents"
  trigger_context: "user wants to inspect, scaffold, or curate the agents/ tree (NOT AGENTS.md — that's /agents)"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /optimize agents-dir

One command for everything that touches the **`agents/` folder** — the
project's prose layer (features, contexts, roadmaps, overrides) and the
mirror dirs under each module's `{agent_folder}/` (per
`modules.root_paths` + `modules.agent_folder`; Laravel shape:
`app/Modules/*/agents/`). Replaces the legacy three-leaf
surface (`/agents prepare` + `/agents audit` + `/agents cleanup`) with
one entry-point and three explicit modes.

> **Not for `AGENTS.md`** — the root-level Markdown file and its tool
> stubs (`CLAUDE.md`, `GEMINI.md`, `copilot-instructions.md`) live under
> [`/agents`](../agents.md) (`init / optimize / audit`).

## Modes

| Flag | Mode | Was | What it does |
|---|---|---|---|
| `--scaffold` | scaffold | `/agents prepare` | Create `agents/`, `agents/features/`, `agents/settings/contexts/`, `agents/roadmaps/`, module mirrors, `.gitkeep` files |
| `--audit` | folder-audit | `/agents audit` | Read-only inventory of `agents/`, per-module agent docs (via `enumerate_modules()`), overrides; flag duplicates, orphans, structural drift |
| `--fix` | fix | `/agents cleanup` | Execute actions from a prior `--audit` (or roadmap) — move, merge, delete, update; per-action confirmation |

**No flag → interactive wizard.** Print the table above, ask:

```
> 1. scaffold — set up the agents/ tree (first-time setup)
> 2. audit — inventory and find issues
> 3. fix — execute actions from a prior audit
```

## Mode dispatch

After a mode is selected, follow the matching procedure verbatim. Each
mode preserves the behavior of the old leaf command exactly — only the
surface changes.

### `--scaffold` (was `/agents prepare`)

1. **Verify project root** — look for `composer.json`, `artisan`, or `package.json`.
2. **Create directory structure** — `agents/{roadmaps,features,contexts}/.gitkeep` + `.augment/guidelines/php/.gitkeep`. Skip dirs that already exist with content.
3. **Module support** — resolve module roots via `scripts/_lib/agent_settings.py::enumerate_modules()`. For every discovered module, mirror the layout: `{module_root}/{Module}/{agent_folder}/{roadmaps,features,contexts}/.gitkeep` (Laravel example: `app/Modules/{Module}/agents/{roadmaps,features,contexts}/.gitkeep`). Skip when `modules.enabled: false` or no roots configured.
4. **Verify templates** — confirm `.augment/templates/{features,roadmaps,contexts}.md` exist; warn on missing.
5. **Clean up old templates** — offer to delete legacy `agents/features/template.md` etc. (now in `.augment/templates/`); ask before delete.
6. **Show summary** — table with status per directory and template; flag missing as `⚠️`.

**Rules:** never overwrite existing files; only add `.gitkeep` to truly empty dirs; ask before deleting old templates.

### `--audit` (was the folder side of `/agents audit`)

1. **Inventory all agent docs** — `find agents/ -maxdepth 1`, `agents/features/`, `agents/settings/contexts/`, `agents/overrides/`, `.augment/guidelines/`, and per-module `{module_path}/{agent_folder}/` (resolved via `enumerate_modules()`). For each: filename, first heading, size, last `git log` date.
2. **Module coverage** — for every module returned by `enumerate_modules()`: docs count, presence of description file, features dir, contexts dir; flag inactive modules with no docs as `🔵 Info` only.
3. **Scan overrides** — for every `agents/overrides/*.md`: extract `Mode:` (`extend`/`replace`) and `Original:` headers; check the original file exists; flag orphans.
4. **Classify documents** — `Architecture / Convention / Pattern / Feature / Context / Module Doc / Override / Unclear`.
5. **Detect issues**:
   - Structural — files in wrong dirs, naming inconsistencies, kebab-case violations.
   - Content — verify class/method/path references against the actual codebase via `codebase-retrieval` or file checks; flag stale references.
   - Duplication — `agents/` ↔ `.augment/skills/`, root ↔ `.augment/guidelines/`, root ↔ module docs.
   - Coverage gaps — active modules without docs, complex areas without contexts.
6. **Display audit report** — sectioned table (Inventory · Module Agents · Overrides · Issues · Duplicates · Gaps) with severity buckets `🔴 Critical`, `🟡 Warning`, `🔵 Info`, `⚪ Clean`.
7. **Offer improvement roadmap**:
   ```
   > 1. Yes — create agents/roadmaps/agents-cleanup.md
   > 2. Show recommendations only (no file)
   > 3. No — audit was enough
   ```
   Roadmap phases: critical fixes → structural cleanup → fill gaps → cleanup.
8. **Offer next steps** — `/optimize agents-dir --fix`, `/context refactor`, or done.

**Rules:** read-only — no file edits; do NOT audit `agents/roadmaps/` or per-module `{module_path}/{agent_folder}/roadmaps/` (separate lifecycle); do NOT audit `.augment/` (route to `/agents audit`); be specific (file, reference, what's wrong); don't flag inactive modules.

### `--fix` (was `/agents cleanup`)

1. **Locate the audit roadmap** — most recent `agents/roadmaps/road-to-agents-cleanup*.md` (or named cleanup roadmap from a prior `--audit` run). Missing → recommend `/optimize agents-dir --audit` first; allow `--ad-hoc` only on explicit override.
2. **Show action plan** — phases from the roadmap (Critical fixes · Structural cleanup · Fill gaps · Cleanup) with action counts; ask which phase to start.
3. **Execute actions** — for each: per-action confirmation, then run the matching workflow:
   - **Move** — move file + update references in `.augment/` skills/commands and other docs.
   - **Merge** — preview merged content, confirm, write merged file, delete originals, update references.
   - **Delete** — preview file, confirm, delete, scrub references.
   - **Update** — apply explicit content changes (remove stale refs, refresh sections, add missing info).
   - **Create context** — hand off to `/context create` with area pre-selected.
4. **Update roadmap progress** — flip `[ ]` → `[x]` after each action; show progress bar. Per `verbosity.routine_confirmations`: `false` → continue silently, user can interrupt; `true` → confirm next.
5. **Summary** — gated by `verbosity.post_action_reports` (`off` / `minimal` / `full`); minimal = one line counts (moved · merged · deleted · updated · remaining).

**Rules:** confirm before every destructive action; always update references when moving/renaming; update the roadmap after each completed action; show file content before delete; check `.augment/` references too.

## What this command does NOT do

- **No edits to `AGENTS.md`** or its tool stubs — that's [`/agents optimize`](../agents/optimize.md).
- **No edits to rules / skills / `.augment/`** — that's [`/agents audit`](../agents/audit.md), `/optimize skills`, or `skill-reviewer`.
- **No commits, no push, no PR** — finishing is a user decision per
  [`commit-policy`](../../rules/commit-policy.md).
- **No edits to `.agent-src/` or `.augment/`** — those regenerate from
  `.agent-src.uncondensed/`. Edit the source.

## See also

- [`/agents`](../agents.md) — `init / optimize / audit` for `AGENTS.md` and tool stubs.
- [`agent-docs-writing`](../../skills/agent-docs-writing/SKILL.md) — voice, structure, anchor conventions for prose under `agents/`.
- [`agents-audit`](../../skills/agents-audit/SKILL.md) — folder-audit heuristics and severity matrix.
- [`override-management`](../../skills/override-management/SKILL.md) — `extend` vs `replace` semantics and orphan detection.
