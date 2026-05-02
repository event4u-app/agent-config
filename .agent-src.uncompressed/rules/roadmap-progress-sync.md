---
type: "auto"
description: "Any touch to agents/roadmaps/ — create/rename/delete/move, edit checkboxes ([x]/[~]/[-]), add/rename/remove phases — must regenerate dashboard and archive if 0 open items, same response"
alwaysApply: false
source: package
---

# Roadmap Progress Sync

## Iron Law — dashboard sync

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

## Iron Law — every active roadmap is trackable

```
EVERY ACTIVE ROADMAP MUST CONTAIN AT LEAST ONE TRACKABLE CHECKBOX
(`- [ ]`) PER NON-INTRO PHASE. ROADMAPS WITHOUT EXECUTABLE STEPS
EITHER GET A CHECKLIST OR THE `status: draft` FLAG.
```

**Active roadmap =** any file in `agents/roadmaps/` (root, not
`archive/` or `skipped/`) without `status: draft` frontmatter.

**Trackable checkbox =** an actionable `- [ ]` line under a `## Phase N`
or `### Phase N` heading (numeric `Phase 1`, roman `Phase II`, or
letter-track `Phase A1` — matched by the dashboard's `PHASE_RE`).
Tables of decisions, ICE matrices, ADR captures, and "block
sequencing" tables are valid **rationale**, but they do not satisfy
this rule on their own — they must be paired with at least one
`## Phase N` section whose checkboxes execute the decision.
Headings such as `## Phase steps`, `### Sequencing — Phase 1 …`, or
`## Block A` do **not** count — only the canonical `Phase <id>`
form parsed by the dashboard.

## Status — binary `ready` (default) vs `draft`

```yaml
---
status: draft          # hidden from the dashboard until flipped
---
```

Two values, no synonyms. Anything else — no frontmatter at all,
`status: ready`, an unknown value — counts as **ready** and lands
in the dashboard.

- **Ready** is the implicit default. New roadmaps are created
  ready unless the user explicitly says draft. Ready roadmaps are
  listed in the dashboard, count towards open/done totals, and
  trip the "completed but not archived" warning when they close.
- **Draft** hides the file from the dashboard entirely (not
  counted, not listed). Use it while the roadmap is still being
  authored, while waiting for upstream decisions, or as a
  capture-only synthesis that has not yet been promoted to
  executable phases. Flip to ready (or remove the field) the
  moment the roadmap is ready to track.

A `## Decisions` or `## Block sequencing` table is **not** a roadmap
on its own. Either pair it with a `## Phase N: <name>` section whose
checkboxes execute the decision, or mark the file `status: draft`
until the executable phases land.

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

## Autonomous execution — checkbox cadence

When executing a roadmap autonomously (multi-turn, no per-step user
prompt), the user loses progress visibility unless checkboxes flip
**as work lands**, not in a batch at the end. Iron Law:

```
EVERY DONE STEP FLIPS [ ] → [x] IN NEXT REPLY THAT ACKNOWLEDGES IT.
NO "I UPDATE ROADMAP AT END OF PHASE."
NO "FOUR STEPS DONE, ONE COMMIT, ONE REGEN."
```

Step counts as completed when:

- Code / docs change for that step has been **written and saved** AND
- Verification cited in the step (project CI command, targeted test, lint) has
  **passed in this response or an earlier one** — fresh output, not memory.

Then in the **same reply**: flip the checkbox, regenerate the
dashboard, commit if commit policy allows.

**Forbidden pattern** (canonical failure):

> Turn 1: implement Step 1. Turn 2: implement Step 2. Turn 3:
> implement Step 3. Turn 4: implement Step 4. Turn 5: "all done,
> let me update the roadmap and commit." → the user spent four turns
> without dashboard movement.

**Required pattern:**

> Turn 1: implement Step 1, flip `[x]`, regen, commit.
> Turn 2: implement Step 2, flip `[x]`, regen, commit. …

A reply that lands a verified step without flipping its checkbox
is a rule violation.

**In-progress marker:** when a step takes more than one reply,
mark it `[~]` the moment work starts on it and regenerate. The
user sees one row move from `[ ]` to `[~]` to `[x]` instead of
silent rows. `[~]` is treated as open for `count_open` but moves
the phase percentage forward in the dashboard.

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
- **Decision-only roadmap shipped without checkboxes** — the file
  documents synthesized decisions, ICE matrices, or block sequencing
  but contains zero `- [ ]` items. The dashboard regenerates with
  `0/0 steps` for that file or omits it from the open set entirely.
  The reader thinks no work is planned. Either pair the decisions
  with a `## Phase N` / `## Implementation Checklist` section, or
  mark the file `status: draft` so it is hidden until the executable
  phases land.

## Do NOT

- Do NOT edit `agents/roadmaps-progress.md` by hand — always regenerate.
- Do NOT defer the regen to "next commit" or "before push" — same response.
- Do NOT rely on CI (`--check` mode) as the first line of defence — CI is last-line, not real-time.
- Do NOT skip the regen because "only one checkbox changed" — the dashboard aggregates counts and phase percentages that shift on single edits.
- Do NOT leave a 100%-complete roadmap in `agents/roadmaps/` "for review" — archive it in the same response, ask the user afterwards if needed, not before.
- Do NOT regenerate the dashboard before the `git mv` when a roadmap closes — otherwise the completed roadmap reappears in "Open roadmaps".
