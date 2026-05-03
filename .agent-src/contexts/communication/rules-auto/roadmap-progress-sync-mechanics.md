# Roadmap Progress Sync — mechanics

Mechanics, triggers, and failure-mode catalog for the
[`roadmap-progress-sync`](../../../rules/roadmap-progress-sync.md)
rule. The Iron Laws and status semantics live in the rule; this
file holds the lookup material the rule pulls when a trigger fires.

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
4. **Autonomous roadmap execution gate** — did this turn complete a roadmap step (code saved + verification passed) without flipping its checkbox? → flip `[x]` (or `[~]` if multi-turn) and regen before sending.
5. **Trackable-roadmap gate** — did this turn create or substantially edit a roadmap file? → does it now contain at least one `- [ ]` per non-intro phase, **or** carry `status: draft` in frontmatter? → if neither, add the checklist or the draft flag before sending.

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
- **Autonomous run, four steps shipped across four turns, dashboard
  flat the whole time, single regen at the end** — user lost
  progress visibility for the entire run. Each completed step must
  flip its checkbox in the reply that ships it.
- **Decision-only roadmap shipped without checkboxes** — file
  contains decisions / ICE / block-sequencing but zero `- [ ]`,
  dashboard shows `0/0` or omits it. Pair with a `## Phase N`
  section or mark `status: draft` (CI catches this now).
- **Headings off-canon (`### P0 #N`, `## Block A`, `### Sequencing
  — Phase 1`)** — `PHASE_RE` skips them, roadmap invisible to the
  dashboard. Rename to `## Phase <id>` or mark `status: draft`.

## Do NOT

- Do NOT edit `agents/roadmaps-progress.md` by hand — always regenerate.
- Do NOT defer the regen to "next commit" or "before push" — same response.
- Do NOT rely on CI (`--check` mode) as the first line of defence — CI is last-line, not real-time.
- Do NOT skip the regen because "only one checkbox changed" — the dashboard aggregates counts and phase percentages that shift on single edits.
- Do NOT leave a 100%-complete roadmap in `agents/roadmaps/` "for review" — `git mv` to archive **before** regenerating, otherwise it reappears in "Open roadmaps".
