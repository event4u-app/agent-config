---
type: "auto"
description: "Editing checkboxes in agents/roadmaps/*.md — [x], [~], [-], or add/rename/remove phases — must run task roadmap-progress in the SAME response to keep the dashboard real-time"
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

## Triggers

| Edit | Must run |
|---|---|
| Mark step `[x]`, `[~]`, `[-]`, or unmark back to `[ ]` | `task roadmap-progress` |
| Add, rename, or remove a phase | `task roadmap-progress` |
| Move roadmap between `roadmaps/` ↔ `archive/` ↔ `skipped/` | `task roadmap-progress` |
| Create a new roadmap file | `task roadmap-progress` |

**Batching rule:** if you edit multiple checkboxes in one response, a
**single** `task roadmap-progress` call at the end of that response is
enough — but the response must not end without it.

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
