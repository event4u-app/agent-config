---
type: "auto"
tier: "1"
description: "Any roadmap touch (file move, checkbox flip, phase change) regens dashboard same response; archive at 0 open. Autonomous runs flip checkboxes inline"
source: package
triggers:
  - path_prefix: "agents/roadmaps/"
  - command: "/roadmap:process-step"
  - command: "/roadmap:process-phase"
  - command: "/roadmap:process-full"
routes_to:
  - "guideline:agent-infra/roadmap-progress-mechanics"
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

**In-progress marker.** When a step takes more than one reply, mark it `[~]` the moment work starts — the user sees one row move `[ ] → [~] → [x]` instead of silent rows. `[~]` stays open for `count_open` but advances the phase percentage.

**Dashboard regen cadence — opt-in batching.** The checkbox flip is non-batchable. The **subprocess regen** (`./agent-config roadmap:progress`) is batchable per `roadmap.dashboard_regen_cadence` in `.agent-settings.yml` (`per_step` default · `every_5_steps` · `phase_boundary`). Run end, phase boundary, and any file-shape touch (rename / phase add / archive — Iron Law 1) always force an immediate regen regardless of cadence.

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
4. Did `count_open` reach 0? If yes → `git mv` to `archive/` and regen again — same reply.

Any "no" at step 2 → reply is incomplete. Do not send. A skipped step 3 regen is fine when cadence permits — checkbox truth lives in the markdown file.

Long-form mechanics (failure-mode catalog, Copilot fallback, `[~]` vs `[ ]` semantics, hook + CI defence-in-depth) live in `guideline:agent-infra/roadmap-progress-mechanics`.
Trigger-set above activates this routing under the `balanced` and `full` profiles.
