---
type: "auto"
description: "Editing checkboxes in agents/roadmaps/*.md — [x], [~], [-], or add/rename/remove phases — must run task roadmap-progress in the SAME response; a roadmap that hits 0 open items must also be archived in the SAME response"
alwaysApply: false
source: package
---

# Roadmap Progress Sync

## Rule

**CRITICAL — ZERO TOLERANCE:** Whenever you change checkbox state in a
roadmap file (`agents/roadmaps/*.md`, module or package equivalents)
you MUST run `task roadmap-progress` **in the same response** — not
later, not batched across sessions, not "at the end of the roadmap".

`agents/roadmaps-progress.md` is the read-only dashboard. Every
unsynced edit makes it lie to the next reader.

**Completion = archival, same response.** When the edit takes a
roadmap to `count_open == 0` (every item is `[x]`, `[~]`, or `[-]`),
`git mv` it into `agents/roadmaps/archive/` (or `skipped/` if no `[x]`
at all) **before** regenerating the dashboard. A 100%-complete
roadmap left under `agents/roadmaps/` is a rule violation, not an
optional cleanup. See `roadmap-management` skill for the archive vs
skipped decision table.

## Triggers

| Edit | Must run, same response |
|---|---|
| Mark step `[x]`, `[~]`, `[-]`, or unmark back to `[ ]` | `task roadmap-progress` |
| Add, rename, or remove a phase | `task roadmap-progress` |
| Create a new roadmap file | `task roadmap-progress` |
| **Last `[ ]` flips** — roadmap reaches `count_open == 0` | `git mv` → `archive/` (or `skipped/`) **then** `task roadmap-progress` |
| Move roadmap between `roadmaps/` ↔ `archive/` ↔ `skipped/` | `task roadmap-progress` |

**Batching rule:** if you edit multiple checkboxes in one response, a
**single** `task roadmap-progress` call at the end of that response is
enough — but the response must not end without it. If one of those
edits closes a roadmap, archive it first, then run the single regen.

## Why this is a rule, not a skill tip

The `roadmap-management` skill documents the command in several
places, but skill body text is easy to miss under procedure pressure.
A rule collapses the constraint into one line the model cannot skip:
"checkbox edit → `task roadmap-progress` — same response".

## Do NOT

- Do NOT edit `agents/roadmaps-progress.md` by hand — always regenerate.
- Do NOT defer the regen to "next commit" or "before push" — same response.
- Do NOT rely on `task ci` / `task roadmap-progress-check` as the first line of defence — CI is last-line, not real-time.
- Do NOT skip the regen because "only one checkbox changed" — the dashboard aggregates counts and phase percentages that shift on single edits.
- Do NOT leave a 100%-complete roadmap in `agents/roadmaps/` "for review" — archive it in the same response, ask the user afterwards if needed, not before.
- Do NOT regenerate the dashboard before the `git mv` when a roadmap closes — otherwise the completed roadmap reappears in "Open roadmaps".
