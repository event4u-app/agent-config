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

The `command:` triggers in this rule's frontmatter ensure it loads the moment one of the `/roadmap:process-*` commands is invoked and stays loaded for the whole run — independent of whether the agent is currently editing files under `agents/roadmaps/`. The loop carries its own deterministic flip-guard at [`roadmap-process-loop § 5b`](../contexts/execution/roadmap-process-loop.md#5b-flip-guard--deterministic) — defense-in-depth, not a substitute for the inline flip.

**Step counts as done** when its code/doc change is written and saved AND the verification cited in the step has passed (fresh output in this reply or an earlier one).

**Glyph semantics — single source of truth.** Keep aligned with the dashboard counter in `scripts/update_roadmap_progress.py` and the closure-table in [`roadmap-management`](../skills/roadmap-management/SKILL.md):

| Glyph | Meaning | Counts towards |
|---|---|---|
| `[ ]` | open — planned, not yet done | `count_open` |
| `[x]` | done — work landed + verified | `count_done` |
| `[~]` | deferred — planned but not happening **this** run; resolution required before archive (Iron Law 3) | `count_deferred` |
| `[-]` | cancelled — scope dropped, won't happen at all | `count_cancelled` |

`[~]` is **not** an "in-progress" indicator. Mid-reply work-in-flight has no checkbox change until the step lands; that's a normal `[ ] → [x]` transition.

**Dashboard regen cadence — opt-in batching.** The checkbox flip is non-batchable. The **subprocess regen** (`./agent-config roadmap:progress`) is batchable per `roadmap.dashboard_regen_cadence` in `.agent-settings.yml` (`per_step` default · `every_5_steps` · `phase_boundary`). Run end, phase boundary, and any file-shape touch (rename / phase add / archive — Iron Law 1) always force an immediate regen regardless of cadence.

## Iron Law 3 — no silent archive with unresolved deferred items

```
A ROADMAP WITH `[~]` DEFERRED ITEMS NEVER AUTO-ARCHIVES SILENTLY.
SURFACE EVERY DEFERRED STEP. ASK THE USER WHAT HAPPENS TO THE PLAN.
A SILENT ARCHIVE THAT BURIES PLANNED-FOR-LATER WORK
IS A RULE VIOLATION, NOT A CONVENIENCE.
```

When the closure check fires (`count_open == 0` and `count_deferred > 0`), the agent MUST:

1. Enumerate every `[~]` step in the roadmap (phase + step text + any inline `<!-- deferred: ... -->` annotation).
2. Present numbered options (per [`user-interaction`](user-interaction.md)) — at minimum:
   1. **Follow-up roadmap (draft)** — spawn `agents/roadmaps/road-to-<slug>.md` with `status: draft` frontmatter, `parent_roadmap: <this-slug>`, and the deferred steps lifted verbatim into phases. Draft stays hidden from the dashboard until the user flips it to `ready`.
   2. **Follow-up roadmap (ready, blocked)** — spawn the file with `status: ready` (default), frontmatter `parent_roadmap: <this-slug>` plus a body note (`> Blocked until <condition>`) so the dashboard surfaces it but execution waits.
   3. **Keep in this archive** — confirm the deferred items stay searchable in the archived file; no follow-up roadmap. Choosing this records an explicit decision-to-drop in the same reply.
   4. **Restore selected items to `[ ]`** — finish them in this roadmap before archive.
   5. **Convert selected items to `[-]` cancelled** — drop them with rationale recorded inline.
3. Only after the user resolves the deferrals does the `git mv` to `archive/` run. The dashboard regen happens after the resolution, not before.

The migration mechanics (file naming, frontmatter pattern, body shape, parent-back-link) live in [`roadmap-management § Spawn follow-up from deferred items`](../skills/roadmap-management/SKILL.md). This rule owns the obligation; the skill owns the procedure.

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
   - **Yes + `count_deferred > 0`** → STOP. Run the Iron Law 3 deferred-resolution flow (surface items + numbered options + wait). Archive only after resolution.

Any "no" at step 2 → reply is incomplete. Do not send. A skipped step 3 regen is fine when cadence permits — checkbox truth lives in the markdown file. Skipping the deferred-resolution gate at step 4 is **never** acceptable; it is the canonical "lost-information" failure mode this rule exists to prevent.

Long-form mechanics (failure-mode catalog, Copilot fallback, `[~]` vs `[ ]` semantics, hook + CI defence-in-depth) live in `guideline:agent-infra/roadmap-progress-mechanics`.
Trigger-set above activates this routing under the `balanced` and `full` profiles.
