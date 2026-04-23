---
name: roadmap-management
description: "Use when the user says "create roadmap", "show roadmap", or "execute roadmap". Creates, reads, and manages roadmap files with phase tracking."
source: package
---

# roadmap-manager

## When to use

Use this skill when:
- Creating a new roadmap (`roadmap-create` command)
- Executing a roadmap (`roadmap-execute` command)
- Checking roadmap progress
- Updating roadmap status after completing work


Do NOT use when:
- Small tasks that don't span multiple steps
- One-off questions or fixes

## ⚠ Dashboard sync — non-negotiable

`agents/roadmaps-progress.md` is auto-generated and must reflect the
live state in real time. After **any** checkbox edit (`[x]`, `[~]`,
`[-]`, `[ ]`) or phase add/rename/remove in a roadmap file, regenerate
the dashboard **in the same response**.

**Completion = archival.** If an edit takes a roadmap to
`count_open == 0` (pure `[x]`, or `[x]` + `[~]`/`[-]`), `git mv`
it into `agents/roadmaps/archive/` **before** regenerating — see
the auto-archive decision table under "Check completion status"
below. A 100%-complete roadmap left in `agents/roadmaps/` makes the
next reader think work is still open.

This is enforced by the [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)
rule. Batching multiple edits in one response is fine — one final
regeneration before replying is enough. But the response must not end
without it.

## Procedure: Manage a roadmap

1. **Identify need** — Is this a multi-step change that spans sessions or agents?
2. **Create or locate** — Create new roadmap in `agents/roadmaps/` or find existing one.
3. **Update progress** — Mark completed steps with `[x]`, add notes for blockers, then regenerate the dashboard in the same response (enforced by `roadmap-progress-sync`).
4. **Verify** — Confirm all steps reflect current state, no stale information.

A roadmap is a structured `.md` file in `agents/roadmaps/` that describes a multi-step change
(refactoring, feature, migration). It ensures work can be picked up across sessions and by
different agents.

## Roadmap locations

| Location | Scope |
|---|---|
| `agents/roadmaps/` | Project-wide roadmaps |
| `app/Modules/{Module}/agents/roadmaps/` | Module-specific roadmaps |
| `{package-root}/agents/roadmaps/` | Package-specific roadmaps |

The file `.augment/templates/roadmaps.md` defines the canonical structure.
**Always read it first** before creating or modifying roadmaps.

## Roadmap structure

Every roadmap follows this structure:

```markdown
# Roadmap: {Short descriptive title}

> {One sentence: What is the expected outcome?}

## Prerequisites

- [ ] Read `AGENTS.md` and relevant docs
- [ ] {specific prerequisites}

## Context

{Why this roadmap exists. Which module/domain. Links to Jira tickets.}

## Phase 1: {Phase name}

- [ ] **Step 1:** {Clear, actionable instruction}
- [ ] **Step 2:** {Next step — reference files/classes}
- [ ] ...

## Phase 2: {Phase name}

- [ ] **Step 1:** {description}
- [ ] ...

## Acceptance Criteria

- [ ] {Observable, testable criterion}
- [ ] All quality gates pass (PHPStan, Rector, tests)

## Notes

{Edge cases, decisions, links}
```

## Key rules for roadmaps

### Checkboxes

- Every actionable step uses `- [ ]` (unchecked) or `- [x]` (completed).
- Mark steps as `[x]` immediately after completing them.
- Never remove completed steps — they serve as history.

### Phases

- Group related steps into phases (e.g. "Preparation", "Migration", "Cleanup").
- Complete one phase before starting the next (unless steps are independent).
- After completing a phase, summarize what was done.

### Quality gates

Every roadmap implicitly includes these gates (run after each step that changes code):

- PHPStan must pass (detect command: artisan vs composer, see `rules/docker-commands.md`)
- Rector: run with fix flag, verify no new PHPStan errors
- Tests: run affected tests

### Step granularity

- Each step should be completable in one session (< 1 hour of work).
- If a step is too large, break it down into sub-steps.
- Steps should reference specific files/classes when possible.

### Language

- Roadmap files are written in **English** (per project convention).
- Step descriptions should be precise and actionable, not vague.

## Working with roadmaps

### Creating a roadmap

1. Ask the user for goal, context-create, and phases.
2. Use the template structure from `.augment/templates/roadmaps.md`.
3. Review with the user iteratively until approved.
4. Save with a kebab-case filename (e.g. `optimize-webhook-jobs.md`).
5. Regenerate the dashboard so the new roadmap is included.

### Executing a roadmap

1. Read the full roadmap.
2. Find the next unchecked step (`- [ ]`).
3. Summarize what needs to be done.
4. Ask the user before implementing (numbered options: implement / adjust / skip).
5. After implementation: mark `[x]`, run quality gates, then regenerate the dashboard.
6. Move to the next step.

### Resuming a roadmap

When picking up a roadmap in a new session:
1. Read the roadmap to understand the full context.
2. Check which steps are already completed (`[x]`).
3. Summarize progress to the user.
4. Continue from the next open step.

### Completing, archiving & skipping a roadmap

Every roadmap ends in exactly one of three states:

| State | Folder | Trigger |
|---|---|---|
| **Active** | `agents/roadmaps/` | Work in progress or planned |
| **Archived** | `agents/roadmaps/archive/` | Work was done (fully or partially) and no more work is planned |
| **Skipped** | `agents/roadmaps/skipped/` | Decision against pursuit — superseded, scope rejected, wrong direction. Typically **0 items `[x]`** |

After the last step of a roadmap is done, check completion status:

1. **Scan the file** for all checkbox markers: `- [x]`, `- [ ]`, `- [~]`, `- [-]`.
2. **Classify:**
   - `[x]` = completed
   - `[ ]` = open (not done)
   - `[~]` = deferred (intentionally pushed out, may come back)
   - `[-]` = cancelled (individual item dropped)

3. **Decision rule — `count_open == 0` means the roadmap has no active
   work left. `[x]`, `[~]`, `[-]` are all finalized states; only `[ ]`
   blocks closure. "Fertig ist fertig" — deferred and cancelled items
   don't hold a finished roadmap in the active set.**

   | count_x | count_open | count_deferred / cancelled | Action |
   |---|---|---|---|
   | ≥ 1 | 0 | 0 | **Auto-archive** (silent) — pure completion |
   | ≥ 1 | 0 | ≥ 1 | **Auto-archive** (silent) — done with intentional skips |
   | 0 | 0 | ≥ 1 | **Auto-skip** (silent) — no work happened, scope dropped |
   | ≥ 0 | ≥ 1 | ≥ 0 | **Ask the user** — open work remains |

   Show on auto-move:

   - Archive: `✅  Roadmap archived → agents/roadmaps/archive/{filename}`
   - Skip:    `⏭️  Roadmap skipped → agents/roadmaps/skipped/{filename}`

   The deferred/cancelled items remain searchable inside the archived file
   (grep for `- [~]` / `- [-]` across `archive/`); a future revival opens a
   new roadmap that cites the archived one.

4. **If any items are `[ ]`:** → **Ask the user.** Show what's incomplete:

   ```
   📋 Roadmap completion check:

     ✅  Completed: {count_x}
     ⬜  Open:      {count_open}  — {list of open items, 1 line each}
     ⏭️  Deferred:  {count_skip}  — {list of deferred items, 1 line each}
     ❌  Cancelled: {count_cancel} — {list of cancelled items, 1 line each}

   > 1. Archive — mark open items as cancelled [-] and archive now
   > 2. Keep active — I want to finish the open items
   > 3. Mark open items as deferred [~] and archive
   > 4. Skip — move to skipped/ (no meaningful work done, not pursuing)
   ```

   Option 4 is only appropriate when `count_x == 0` or the completed items were
   trivial (e.g. prerequisites only). If the user picks 4 despite meaningful work
   being done, confirm once — archive is usually the right choice.

5. **Move the file** with `git mv` so history is preserved:

   ```bash
   # Archive (work was done)
   git mv agents/roadmaps/{file} agents/roadmaps/archive/{file}

   # Skipped (not pursuing)
   git mv agents/roadmaps/{file} agents/roadmaps/skipped/{file}
   ```

6. **Regenerate the dashboard** (see "Command" below). The moved roadmap is
   excluded from the active set once it sits in `archive/` or `skipped/`.

### When to use `skipped/` vs `archive/`

| Situation | Destination |
|---|---|
| Finished all phases | `archive/` |
| Finished some phases, rest deferred/cancelled on purpose | `archive/` |
| Whole roadmap deferred or cancelled (no `[x]` at all) | `skipped/` |
| Never started, scope decision reversed | `skipped/` |
| Superseded by another roadmap | `skipped/` — add a pointer line at the top: `> Superseded by agents/roadmaps/{other}.md` |
| Research proved the direction wrong | `skipped/` — add a 1-line reason at the top |

If in doubt: archive beats skipped. `skipped/` is reserved for roadmaps where
no meaningful work was invested and the scope itself was rejected.

## Progress dashboard — `agents/roadmaps-progress.md`

A generated dashboard aggregates progress across every open roadmap. It sits at
`agents/roadmaps-progress.md` (outside `roadmaps/` to keep the folder clean) and
is rewritten by `.augment/scripts/update_roadmap_progress.py`.

**Always regenerate in the SAME response** after any of the following
(enforced by [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)):

- Creating a new roadmap (`roadmap-create`)
- Marking a step `[x]`, `[~]`, or `[-]` during `roadmap-execute`
- Archiving or moving a roadmap to `skipped/`
- Adding, renaming, or removing a phase

Command:

```bash
python3 .augment/scripts/update_roadmap_progress.py           # rewrite the dashboard
python3 .augment/scripts/update_roadmap_progress.py --check   # CI: fail if stale
```

Projects with a Taskfile get two shortcuts for the same script —
`task roadmap-progress` and `task roadmap-progress-check`. Consumer
projects without Task use the direct python invocation; the script
is shipped via postinstall symlinks and always available at
`.augment/scripts/`.

The dashboard is a **read-only snapshot**. Do not edit it by hand — regenerate it.

## Output format

1. Roadmap file in agents/roadmaps/ with ordered phases and tasks
2. Progress tracking with checkbox status
3. `agents/roadmaps-progress.md` regenerated on every change

## Auto-trigger keywords

- roadmap
- roadmap creation
- phase tracking
- step completion

## Gotcha

- Roadmap files go in `agents/roadmaps/` — don't create them in other directories.
- Don't mark phases complete without running verification (tests, quality checks) — the verify-before-complete rule applies.
- The model tends to skip phases it deems "simple" — every phase must be explicitly completed.
- Auto-archive only when ALL checkboxes are `[x]`. Even one `[~]` or `[-]` requires user confirmation.
- `archive/` and `skipped/` are distinct — `archive/` = work happened, `skipped/` = no meaningful work, not pursuing. Create either directory if it doesn't exist.
- Use `git mv` (not `mv`) so history follows the file.

## Do NOT

- Do NOT skip quality gates between steps.
- Do NOT mark steps as done without actually completing them.
- Do NOT modify completed steps (only add notes if needed).
- Do NOT create roadmaps for trivial changes (single-file fixes don't need a roadmap).
- Do NOT commit or push — only local changes.
- Do NOT archive roadmaps with open `[ ]` items without asking the user.
- Do NOT delete roadmaps — always move to `archive/` or `skipped/`.
- Do NOT use `skipped/` as a dumping ground for partially-finished work — that is what `archive/` with deferred items is for.
- Do NOT assign version numbers, git tags, or release identifiers to phases. Roadmaps plan work; releases and tags are decided by the user separately.
