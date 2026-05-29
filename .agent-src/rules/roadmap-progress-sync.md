---
type: "auto"
tier: "1"
description: "Any roadmap touch (file move, checkbox flip, phase change) regens dashboard same response; archive at 0 open"
triggers:
  - path_prefix: "agents/roadmaps/"
  - command: "/roadmap:process-step"
  - command: "/roadmap:process-phase"
  - command: "/roadmap:process-full"
routes_to:
  - "guideline:agent-infra/roadmap-progress-mechanics"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Roadmap Progress Sync

## Iron Law 1 — dashboard sync, same response

```
ANY ROADMAP TOUCH → REGENERATE THE DASHBOARD, SAME RESPONSE.
NO EXCEPTIONS. NO "I'LL DO IT AT THE END". NO BATCHING ACROSS TURNS.
```

Roadmap touch = create / rename / delete / move file, add/rename/remove a phase, OR flip any checkbox (`[ ]` ↔ `[x]` ↔ `[~]` ↔ `[-]`). Regen command: `./agent-config roadmap:progress`. Archive (`git mv` → `archive/`) the moment `count_open == 0` — same response.

## Iron Law 2 — real-time checkbox cadence (autonomous execution)

```
EVERY DONE STEP FLIPS [ ] → [x] IN THE SAME REPLY THAT LANDS THE WORK.
NO "I UPDATE THE ROADMAP AT THE END OF THE PHASE."
A REPLY THAT LANDS A VERIFIED STEP WITHOUT FLIPPING ITS CHECKBOX
IS A RULE VIOLATION, NOT AN OVERSIGHT.
```

`/roadmap:process-step`, `/roadmap:process-phase`, `/roadmap:process-full`, and any other multi-step autonomous run flip the box for step N **before** moving on to step N+1. The checkbox itself is the real-time monitor — the markdown file is the source of truth, the dashboard is a derived view.

`command:` triggers in this rule's frontmatter load it the moment any `/roadmap:process-*` command fires and keep it loaded for the whole run — independent of whether the agent is editing files under `agents/roadmaps/`. The loop carries its own deterministic flip-guard at [`roadmap-process-loop § 5b`](../contexts/execution/roadmap-process-loop.md#5b-flip-guard--deterministic) — defense-in-depth, not a substitute for the inline flip.

**Step counts as done** when code/doc saved AND verification cited in step passed (fresh output, this reply or earlier).

**Glyph semantics** — single source of truth, aligned with `scripts/update_roadmap_progress.py` and [`roadmap-management`](../skills/roadmap-management/SKILL.md):

| Glyph | Meaning | Counter |
|---|---|---|
| `[ ]` | open — planned, not done | `count_open` |
| `[x]` | done — landed + verified | `count_done` |
| `[~]` | deferred — planned, not happening **this** run; blocks archive (Iron Law 3) | `count_deferred` |
| `[-]` | cancelled — scope dropped | `count_cancelled` |

`[~]` is **not** "in-progress". Mid-reply work-in-flight has no checkbox change until step lands — normal `[ ] → [x]`.

**Dashboard regen cadence — opt-in batching.** Checkbox flip is non-batchable. **Subprocess regen** (`./agent-config roadmap:progress`) is batchable per `roadmap.dashboard_regen_cadence` (`per_step` default · `every_5_steps` · `phase_boundary`). Run end, phase boundary, any file-shape touch (rename / phase add / archive — Iron Law 1) always force immediate regen regardless of cadence.

## Iron Law 3 — no silent archive with unresolved deferred items

```
A ROADMAP WITH `[~]` DEFERRED ITEMS NEVER AUTO-ARCHIVES SILENTLY.
SURFACE EVERY DEFERRED STEP. ASK USER WHAT HAPPENS TO THE PLAN.
A SILENT ARCHIVE THAT BURIES PLANNED-FOR-LATER WORK
IS A RULE VIOLATION, NOT A CONVENIENCE.
```

When closure check fires (`count_open == 0` and `count_deferred > 0`), agent MUST:

1. Enumerate every `[~]` step (phase + step text + any inline `<!-- deferred: ... -->` annotation).
2. Present numbered options (per [`user-interaction`](user-interaction.md)) — at minimum:
   1. **Follow-up roadmap (draft)** — spawn `agents/roadmaps/road-to-<slug>.md` with `status: draft`, `parent_roadmap: <this-slug>`, deferred steps lifted verbatim into phases. Draft hidden from dashboard until flipped to `ready`.
   2. **Follow-up roadmap (ready, blocked)** — spawn with `status: ready` (default), `parent_roadmap: <this-slug>`, plus body note `> Blocked until <condition>`. Dashboard surfaces it; execution waits.
   3. **Keep in this archive** — confirm deferred items stay searchable in archived file; no follow-up. Records explicit decision-to-drop in same reply.
   4. **Restore selected items to `[ ]`** — finish them in this roadmap before archive.
   5. **Convert selected items to `[-]` cancelled** — drop with rationale recorded inline.
3. Only after user resolves deferrals does `git mv` to `archive/` run. Dashboard regen happens after resolution.

Migration mechanics (file naming, frontmatter, body shape, parent back-link) live in [`roadmap-management § Spawn follow-up from deferred items`](../skills/roadmap-management/SKILL.md). Rule owns obligation; skill owns procedure.

## Pre-send self-check — MANDATORY

Before sending any reply that landed roadmap work:

1. Did this reply land a step (code/doc saved + verification passed)?
2. Is its checkbox flipped to `[x]` / `[~]` / `[-]` in `agents/roadmaps/<file>.md`? If no → flip, then continue.
3. Is regen due now per `roadmap.dashboard_regen_cadence`?
   - `per_step` → yes, always.
   - `every_5_steps` → yes when this is the 5th, 10th, … closed step in the run, or the last step of the reply.
   - `phase_boundary` → only when this reply closes the phase or run.
   - Any file-shape touch (rename / phase add / archive) → yes, regardless of cadence.
   If yes and not run yet → run `./agent-config roadmap:progress`, then continue.
4. Did `count_open` reach 0?
   - **No** → continue normally.
   - **Yes + `count_deferred == 0`** → `git mv` to `archive/` and regen again — same reply.
   - **Yes + `count_deferred > 0`** → STOP. Run Iron Law 3 deferred-resolution flow (surface items + numbered options + wait). Archive only after resolution.

Any "no" at step 2 → reply is incomplete. Do not send. Skipped step 3 regen fine when cadence permits — checkbox truth lives in markdown file. Skipping deferred-resolution gate at step 4 is **never** acceptable; it is the canonical "lost-information" failure mode this rule exists to prevent.

Long-form mechanics (failure-mode catalog, Copilot fallback, `[~]` vs `[ ]` semantics, hook + CI defence-in-depth) live in `guideline:agent-infra/roadmap-progress-mechanics`.
Trigger-set above activates this routing under the `balanced` and `full` profiles.
