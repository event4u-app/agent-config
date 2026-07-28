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
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
roles: [planner]
enforced_by:
  - "hook:roadmap-progress"
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

`/roadmap:process-*` runs flip the box for step N **before** moving on to step N+1 — the markdown file is the source of truth, the dashboard a derived view. `[~]` means deferred, never in-progress. Glyph table, done-definition, command-trigger loading + flip-guard, regen-cadence batching, and the blockers cadence live in the guideline (routing below).

## Iron Law 3 — no silent archive with unresolved deferred items

```
A ROADMAP WITH `[~]` DEFERRED ITEMS NEVER AUTO-ARCHIVES SILENTLY.
SURFACE EVERY DEFERRED STEP. ASK THE USER WHAT HAPPENS TO THE PLAN.
A SILENT ARCHIVE THAT BURIES PLANNED-FOR-LATER WORK
IS A RULE VIOLATION, NOT A CONVENIENCE.
```

Closure check fires (`count_open == 0` and `count_deferred > 0`) → enumerate every `[~]` step, present the numbered-options resolution menu (per [`user-interaction`](user-interaction.md)), and only after the user resolves the deferrals does the `git mv` to `archive/` run. Full option menu + migration mechanics: guideline + [`roadmap-management`](../skills/roadmap-management/SKILL.md).

## Later disposition — blocked-for-later roadmaps are parked, never left active

```
A ROADMAP WHOSE OPEN WORK CANNOT PROCEED NOW (GATED ON AN EXTERNAL
TRIGGER OR A DECISION) BUT WILL RESUME → MOVE IT TO agents/roadmaps/later/.
NEVER LEAVE A BLOCKED-FOR-LATER ROADMAP IN THE ACTIVE TREE.
```

`later/` is the fourth disposition alongside `archive/` and `skipped/`; excluded from the dashboard and `/roadmap:process-*`. Procedure + the Active-vs-Later test: guideline + [`roadmap-management`](../skills/roadmap-management/SKILL.md).

## PR-gate — a completed roadmap archives in its own PR, never post-merge

```
COMPLETED ROADMAP → ARCHIVED IN THE PR THAT COMPLETES IT.
NEVER MERGED-BUT-UNARCHIVED INTO THE TRUNK.
/create-pr RUNS THE ARCHIVAL SWEEP BEFORE THE PR EXISTS.
NO merge-gated PLACEHOLDER ITEM. NO AGENT-SET ANNOTATION.
```

The sweep (`scripts/archive_completed_roadmaps.ts`, invoked by [`/create-pr` § 1c](../commands/pr/create.md)) archives deterministically before the PR exists; `./agent-config roadmap:progress-check` is the CI backstop. Rationale + sweep detail: guideline.

## Pre-send self-check — MANDATORY

Before sending any reply that landed roadmap work:

1. Did this reply land a step (code/doc saved + verification passed)?
2. Is its checkbox flipped to `[x]` / `[~]` / `[-]` in `agents/roadmaps/<file>.md`? If no → flip, then continue.
2b. Roadmap created/updated from an `agents/tmp/` inbox file this reply? If
   yes → `mv` it to `agents/tmp.old/` NOW, same reply (per
   `agents-layout § User Inbox Workflow`); point the Source line at
   `agents/tmp.old/<name>`. Consumed inbox file left in `agents/tmp/` = rule
   violation, not tidiness. Move ONLY the explicitly named input file(s) —
   never sweep the rest of the inbox.
3. Is regen due now per `roadmap.dashboard_regen_cadence`?
   - `per_step` → yes, always.
   - `every_5_steps` → yes when this is the 5th, 10th, … closed step in the run, or the last step of the reply.
   - `phase_boundary` → only when this reply closes the phase or run.
   - Any file-shape touch (rename / phase add / archive) → yes, regardless of cadence.
   If yes and not run yet → run `./agent-config roadmap:progress`, then continue.
4. Did `count_open` reach 0?
   - **No (real open work remains)** → continue normally.
   - **Yes + `count_deferred == 0`** → the roadmap is **complete**. Archive it — `git mv` to `archive/` + migrate inbound refs + regen, same reply — or let the next `/create-pr` § 1c sweep do it deterministically. Either way it must never be pushed to the trunk unarchived (§ PR-gate; the `--check` backstop enforces it).
   - **Yes + `count_deferred > 0`** → STOP. Run the Iron Law 3 deferred-resolution flow (surface items + numbered options + wait). Archive only after resolution.

Any "no" at step 2 → reply is incomplete. Do not send. A skipped step 3 regen is fine when cadence permits — checkbox truth lives in the markdown file. Skipping the deferred-resolution gate at step 4 is **never** acceptable; it is the canonical "lost-information" failure mode this rule exists to prevent.

Body migrated to `guideline:agent-infra/roadmap-progress-mechanics` (per P4 of `road-to-kernel-and-router.md`) — glyph semantics, regen cadence, deferred-resolution menu, later-disposition procedure, PR-gate prose, plus the long-form failure-mode catalog, Copilot fallback, and hook + CI defence-in-depth.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
