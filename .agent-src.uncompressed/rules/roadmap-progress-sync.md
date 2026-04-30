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

**Roadmap touch =** create the file, rename it, delete it, move it
between `roadmaps/` ↔ `archive/` ↔ `skipped/`, add/rename/remove a
phase, **OR** flip any checkbox (`[ ]` ↔ `[x]` ↔ `[~]` ↔ `[-]`).

`agents/roadmaps-progress.md` is the read-only dashboard. Every
unsynced edit makes it lie to the next reader. Created a roadmap
without regenerating? The dashboard claims it does not exist. Marked
8 steps `[x]` and forgot the regen? The dashboard says 0 done.

**Completion = archival, same response.** When the edit takes a
roadmap to `count_open == 0` (every item is `[x]`, `[~]`, or `[-]`),
`git mv` it into `agents/roadmaps/archive/` (or `skipped/` if no `[x]`
at all) **before** regenerating the dashboard. A 100%-complete
roadmap left under `agents/roadmaps/` is a rule violation, not an
optional cleanup. See `roadmap-management` skill for the archive vs
skipped decision table.

## How to regenerate

```bash
./agent-config roadmap:progress
```

The `./agent-config` wrapper is written into the project root by the
package installer and delegates to the master CLI inside
`node_modules/@event4u/agent-config/` or `vendor/event4u/agent-config/`.
No global tooling required.

## Triggers

| Edit | Must run, same response |
|---|---|
| **Create a new roadmap file** | regenerate dashboard |
| **Rename or delete a roadmap file** | regenerate dashboard |
| Mark step `[x]`, `[~]`, `[-]`, or unmark back to `[ ]` | regenerate dashboard |
| Add, rename, or remove a phase | regenerate dashboard |
| **Last `[ ]` flips** — roadmap reaches `count_open == 0` | `git mv` → `archive/` (or `skipped/`) **then** regenerate dashboard |
| Move roadmap between `roadmaps/` ↔ `archive/` ↔ `skipped/` | regenerate dashboard |

**Batching rule:** if you edit multiple checkboxes in one response, a
**single** regeneration at the end of that response is enough — but
the response must not end without it. If one of those edits closes a
roadmap, archive it first, then run the single regen.

## Pre-send self-check — MANDATORY

Before sending any reply that touched `agents/roadmaps/`, run this
silent gate:

1. Did this turn create, rename, delete, or move a roadmap file? → regen MUST be in the reply.
2. Did this turn flip any checkbox in a roadmap file? → regen MUST be in the reply.
3. Did the regen output (`✅ Wrote agents/roadmaps-progress.md · …`) actually appear this turn? → if no, run it now before sending.

Any "yes" + no regen run = rule violation. Rerun before sending.

## Failure modes

- **Created the roadmap, marked Phase 1 done across multiple turns,
  never regenerated** — dashboard silently lies "this roadmap does
  not exist" to the next reader. Canonical failure of this rule;
  the rule was hardened in response to it.
- **Regenerated yesterday, edited today, "I'll regen at session
  end"** — session ends from a crash, regen never lands.
- **Closed a roadmap (last `[ ]` → `[x]`) and regenerated before
  `git mv`** — the closed roadmap reappears in "Open roadmaps".
- **Edited the dashboard by hand to "fix it quickly"** — next regen
  overwrites the manual edit; no audit trail of why.

## Why this is a rule, not a skill tip

The `roadmap-management` skill documents the command in several
places, but skill body text is easy to miss under procedure pressure.
A rule collapses the constraint into one line the model cannot skip:
"checkbox edit → regenerate dashboard — same response".

## Do NOT

- Do NOT edit `agents/roadmaps-progress.md` by hand — always regenerate.
- Do NOT defer the regen to "next commit" or "before push" — same response.
- Do NOT rely on CI (`--check` mode) as the first line of defence — CI is last-line, not real-time.
- Do NOT skip the regen because "only one checkbox changed" — the dashboard aggregates counts and phase percentages that shift on single edits.
- Do NOT leave a 100%-complete roadmap in `agents/roadmaps/` "for review" — archive it in the same response, ask the user afterwards if needed, not before.
- Do NOT regenerate the dashboard before the `git mv` when a roadmap closes — otherwise the completed roadmap reappears in "Open roadmaps".
