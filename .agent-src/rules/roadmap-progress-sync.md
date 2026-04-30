---
type: "auto"
description: "Editing checkboxes in agents/roadmaps/*.md — [x], [~], [-], or add/rename/remove phases — must regenerate the roadmap dashboard in the SAME response; a roadmap that hits 0 open items must also be archived in the SAME response"
alwaysApply: false
source: package
---

# Roadmap Progress Sync

## Iron Law

```
ANY ROADMAP TOUCH → REGENERATE THE DASHBOARD, SAME RESPONSE.
NO EXCEPTIONS. NO "I'LL DO IT AT THE END". NO BATCHING ACROSS TURNS.
A ROADMAP NOT IN THE DASHBOARD IS A RULE VIOLATION, NOT AN OVERSIGHT.
```

**Roadmap touch =** create file, rename, delete, move between
`roadmaps/` ↔ `archive/` ↔ `skipped/`, add/rename/remove phase,
**OR** flip any checkbox (`[ ]` ↔ `[x]` ↔ `[~]` ↔ `[-]`).

`agents/roadmaps-progress.md` is read-only dashboard. Every unsynced
edit lies to next reader. Created roadmap, no regen → dashboard
claims it does not exist. Marked 8 steps `[x]`, forgot regen →
dashboard says 0 done.

**Completion = archival, same response.** Edit takes roadmap to
`count_open == 0` (every item `[x]`, `[~]`, or `[-]`) → `git mv` to
`agents/roadmaps/archive/` (or `skipped/` if no `[x]` at all)
**before** regen. 100%-complete roadmap left in `agents/roadmaps/`
is rule violation. See `roadmap-management` skill for archive vs
skipped table.

## How to regenerate

```bash
./agent-config roadmap:progress
```

`./agent-config` wrapper sits in project root, written by installer,
delegates to master CLI in `node_modules/@event4u/agent-config/` or
`vendor/event4u/agent-config/`. No global tooling.

## Triggers

| Edit | Must run, same response |
|---|---|
| **Create new roadmap file** | regenerate dashboard |
| **Rename or delete roadmap file** | regenerate dashboard |
| Mark step `[x]`, `[~]`, `[-]`, or unmark back to `[ ]` | regenerate dashboard |
| Add, rename, or remove phase | regenerate dashboard |
| **Last `[ ]` flips** — roadmap reaches `count_open == 0` | `git mv` → `archive/` (or `skipped/`) **then** regenerate dashboard |
| Move roadmap between `roadmaps/` ↔ `archive/` ↔ `skipped/` | regenerate dashboard |

**Batching:** multiple checkbox edits in one response → **single**
regen at end is enough. One edit closes a roadmap → archive first,
then single regen. Response must not end without it.

## Pre-send self-check — MANDATORY

Before sending any reply that touched `agents/roadmaps/`, silent gate:

1. Did this turn create, rename, delete, or move a roadmap file? → regen MUST be in reply.
2. Did this turn flip any checkbox in a roadmap file? → regen MUST be in reply.
3. Did the regen output (`✅ Wrote agents/roadmaps-progress.md · …`) actually appear this turn? → no → run it now before sending.

Any "yes" + no regen run = rule violation. Rerun before sending.

## Why this is a rule, not a skill tip

`roadmap-management` skill documents command in several places, but
skill body text easy to miss under procedure pressure. Rule collapses
constraint into one line model cannot skip: "checkbox edit →
regenerate dashboard — same response".

## Do NOT

- Do NOT edit `agents/roadmaps-progress.md` by hand — always regenerate.
- Do NOT defer regen to "next commit" or "before push" — same response.
- Do NOT rely on CI (`--check` mode) as first line of defence — CI is last-line, not real-time.
- Do NOT skip regen because "only one checkbox changed" — dashboard aggregates counts and phase percentages that shift on single edits.
- Do NOT leave 100%-complete roadmap in `agents/roadmaps/` "for review" — archive same response, ask user afterwards if needed.
- Do NOT regenerate dashboard before `git mv` when roadmap closes — otherwise it reappears in "Open roadmaps".

## Failure modes

- **Created roadmap, marked Phase 1 done across multiple turns,
  never regenerated** — dashboard silently lies "this roadmap does
  not exist" to next reader. Canonical failure of this rule; rule
  hardened in response to it.
- **Regenerated yesterday, edited today, "regen at session end"** —
  session ends from crash, regen never lands.
- **Closed roadmap (last `[ ]` → `[x]`) and regenerated before
  `git mv`** — closed roadmap reappears in "Open roadmaps".
- **Edited dashboard by hand to "fix it quickly"** — next regen
  overwrites manual edit; no audit trail.
