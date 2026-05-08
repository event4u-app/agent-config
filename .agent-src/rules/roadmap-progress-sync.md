---
type: "auto"
tier: "1"
description: "Any roadmap touch (file move, checkbox flip, phase change) regens dashboard same response; archive at 0 open. Autonomous runs flip each checkbox the SAME reply, never batched at the end."
source: package
triggers:
  - path_prefix: "agents/roadmaps/"
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
NO "FOUR STEPS DONE, ONE COMMIT, ONE REGEN."
A REPLY THAT LANDS A VERIFIED STEP WITHOUT FLIPPING ITS CHECKBOX
IS A RULE VIOLATION, NOT AN OVERSIGHT.
```

`/roadmap:process-step`, `/roadmap:process-phase`, `/roadmap:process-full`, and any other multi-step autonomous run flip the box for step N **before** moving on to step N+1. The dashboard is a real-time monitor, not a post-hoc summary. Batched flips at the archive commit defeat the dashboard's purpose.

**Step counts as done** when its code/doc change is written and saved AND the verification cited in the step has passed (fresh output in this reply or an earlier one).

**In-progress marker.** When a step takes more than one reply, mark it `[~]` the moment work starts and regen — the user sees one row move `[ ] → [~] → [x]` instead of silent rows. `[~]` stays open for `count_open` but advances the phase percentage.

## Pre-send self-check — MANDATORY

Before sending any reply that landed roadmap work:

1. Did this reply land a step (code/doc saved + verification passed)?
2. Is its checkbox flipped to `[x]` / `[~]` / `[-]` in `agents/roadmaps/<file>.md`? If no → flip, then continue.
3. Did `./agent-config roadmap:progress` run after the flip? If no → run, then continue.
4. Did `count_open` reach 0? If yes → `git mv` to `archive/` and regen again — same reply.

Any "no" at step 2 or 3 → reply is incomplete. Do not send.

Long-form mechanics (failure-mode catalog, Copilot fallback, `[~]` vs `[ ]` semantics, hook + CI defence-in-depth) live in `guideline:agent-infra/roadmap-progress-mechanics`.
Trigger-set above activates this routing under the `balanced` and `full` profiles.
