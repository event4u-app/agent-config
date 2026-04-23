---
type: "auto"
description: "Editing checkboxes in agents/roadmaps/*.md — [x], [~], [-], or add/rename/remove phases — must regenerate the roadmap dashboard in the SAME response; a roadmap that hits 0 open items must also be archived in the SAME response"
alwaysApply: false
source: package
---

# Roadmap Progress Sync

## Rule

**CRITICAL — ZERO TOLERANCE:** Whenever you change checkbox state in a
roadmap file (`agents/roadmaps/*.md`, module or package equivalents)
you MUST regenerate the dashboard **in the same response** — not
later, not batched across sessions, not "at the end of the roadmap".

`agents/roadmaps-progress.md` is the read-only dashboard. Every
unsynced edit makes it lie to the next reader.

**Completion = archival, same response.** When the edit takes a
roadmap to `count_open == 0` (every item is `[x]`, `[~]`, or `[-]`),
`git mv` it into `agents/roadmaps/archive/` (or `skipped/` if no
`[x]` at all) **before** regenerating. A 100%-complete roadmap left
in `agents/roadmaps/` is a rule violation. See `roadmap-management`
for the archive vs skipped decision table.

## How to regenerate

```bash
python3 .augment/scripts/update_roadmap_progress.py
```

Taskfile shortcut: `task roadmap-progress` (same script). npm /
Composer / Make wrappers are consumer-project optional; the direct
python path always works — `.augment/scripts/` ships via postinstall
symlinks.

## Triggers

| Edit | Must run, same response |
|---|---|
| Mark step `[x]`, `[~]`, `[-]`, or unmark back to `[ ]` | regenerate dashboard |
| Add, rename, or remove a phase | regenerate dashboard |
| Create a new roadmap file | regenerate dashboard |
| **Last `[ ]` flips** — roadmap reaches `count_open == 0` | `git mv` → `archive/` (or `skipped/`) **then** regenerate dashboard |
| Move roadmap between `roadmaps/` ↔ `archive/` ↔ `skipped/` | regenerate dashboard |

**Batching:** multiple checkbox edits in one response → a **single**
regeneration at the end is enough. If one closes a roadmap, archive
it first, then run the single regen. But the response must not end
without it.

## Why this is a rule, not a skill tip

The `roadmap-management` skill documents the command in several
places, but skill body text is easy to miss under procedure pressure.
A rule collapses the constraint into one line the model cannot skip:
"checkbox edit → regenerate dashboard — same response".

## Do NOT

- Do NOT edit `agents/roadmaps-progress.md` by hand — always regenerate.
- Do NOT defer regen to "next commit" or "before push" — same response.
- Do NOT rely on CI (`--check` mode) as first line of defence — CI is last-line, not real-time.
- Do NOT skip regen because "only one checkbox changed" — the dashboard aggregates counts and phase percentages that shift on single edits.
- Do NOT leave a 100%-complete roadmap in `agents/roadmaps/` "for review" — archive same response, ask the user afterwards if needed, not before.
- Do NOT regenerate the dashboard before the `git mv` when a roadmap closes — otherwise it reappears in "Open roadmaps".
