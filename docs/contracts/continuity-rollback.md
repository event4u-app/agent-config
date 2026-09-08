---
stability: beta
keep-beta-until: 2026-12-08
---

# Continuity rollback — which switch undoes what, and what no switch can undo

> Three session-lifecycle handlers, three independent switches. Disabling one
> restores pre-change behaviour **for that handler only**; the other two keep
> firing. This document names the residual behaviour of each switch and the
> criteria that should make an operator throw one.
>
> Written for `road-to-continuity-writer-activation` step 1.4, which required
> exactly one thing this table cannot express and which therefore gets its own
> section below: **a switch cannot bring back a deletion.**

## The two kinds of undo, and why they are not interchangeable

```
DISABLING NEW BEHAVIOUR IS A SWITCH. REVERTING A DELETION IS A COMMIT.
NEVER OFFER A SWITCH AS THE ROLLBACK FOR A REMOVAL.
```

- **Disabling new behaviour** — the handler stops running and the tree behaves
  as it did before the handler existed. One settings key, effective on the next
  session-lifecycle event, no data migration, nothing to restore. Every row in
  the table below is this kind.
- **Reverting a deletion** — a command, a concern, an artefact or a documented
  affordance has been removed from the tree. No settings key brings it back;
  the only undo is a revert of the commit that removed it, plus whatever
  regeneration that commit performed. Phase 3 of the roadmap is entirely this
  kind, which is why each of its steps carries its own gate rather than a
  switch.

Conflating the two is the failure this section exists to prevent: an operator
who reads "continuity is switchable" and then finds `session:recycle` gone has
been told something true about Phase 1 and false about Phase 3.

## The three switches

| Handler | Key | Ships | What OFF restores | Residual behaviour when OFF |
|---|---|---|---|---|
| Continuity-record writer | `continuity.auto_record` | `"off"` | the pre-change tree exactly: no automatic record producer | `session:recycle` remains the only writer, so a record exists only when a human runs it. The recycle advisory and its counter-check still fire, and the counter-check still reports "advised, no envelope written" — which is the correct reading, because with this switch off that is the true state |
| Run-checkpoint producer | `continuity.run_checkpoints` | `"on"` | no `agents/runtime/state/checkpoints/<run>.json` is written | A killed session inside a roadmap contract can no longer be resumed from a derived checkpoint; `run:supervise` falls back to whatever the roadmap file itself says. Continuity writing, the context-fill surface and both advisory lanes are unaffected |
| Session-index restore | `memory.session_index` | `"off"` | the pre-change tree: no memory index injected at `session_start` | No compact id + title index reaches the model at session start; `memory_get` on demand still works, and the working-memory cache injection on the same slot is unaffected |

Each switch is read by its own function, and the two new ones deliberately have
**opposite failure polarity**:

- `auto_record_enabled` fails **closed** — an unreadable settings cascade leaves
  the new producer disarmed.
- `run_checkpoints_enabled` fails **open** — an unreadable cascade never
  silently removes a recovery aid that already existed.

A single helper with one polarity would have been wrong for one of the two, and
which one it was wrong for is the expensive direction.

## Trip criteria — what should make an operator throw one

These are the conditions under which throwing the switch is the right call, not
a list of things that have happened.

**`continuity.auto_record` → `off`**

- A successor session resumes from a record whose `remaining` or
  `acceptance_criteria` disagree with the roadmap on disk. The writer derives
  both, so a disagreement means the derivation is wrong, and a wrong record is
  worse than none: the successor works from a plausible, false picture.
- Records appear for sessions that did nothing. The substantive floor is
  supposed to prevent this, so its appearance means the counters are wrong.
- A record appears in a workspace whose roadmap the session never claimed.
- Stop-path latency becomes visible. The handler spawns no subprocess and reads
  a handful of files, so this should not happen — if it does, the assumption is
  wrong rather than the budget.

**`continuity.run_checkpoints` → `off`**

- Checkpoints accumulate without being consumed, i.e. the janitor is not
  reaching them.
- A checkpoint's recorded counts disagree with the roadmap it names, which makes
  a resume from it worse than a resume from the file.

**`memory.session_index` → `off`** (its shipped state)

- The index injects rows a session never uses, i.e. the unproven ship-criterion
  is still unproven. This is why it ships off.

## What is NOT rollback-able by a switch

Named explicitly, because the roadmap that produced this file also contains the
removals:

- **A retired command.** `session:recycle` and the `/chat-history` pair are
  Phase 3 removals. Once a command document is deleted and the generated
  projections are regenerated, the affordance is gone from the tree and from
  every generated catalogue. The undo is a revert plus a regeneration.
- **A retired concern.** Removing a concern id from `hook_manifest.yaml` changes
  the compiled manifest, the concern registry and every platform's slot list.
  No settings key re-binds it.
- **A retired advisory.** The advisory that tells a human to run
  `session:recycle` before `/clear` is the counted normal-path manual action.
  Retiring it is a code deletion, not a switch.
- **An already-written record.** Throwing `continuity.auto_record` to `off` stops
  future records; it does not remove the ones already on disk. They expire on
  the reader's own staleness bound instead.

## See also

- `docs/contracts/continuity-record-slot.md` — the slot's capacity policy and
  state machine, which every producer publishes through.
- `src/config/agent-settings.template.yml` — the shipped defaults, with the
  reason for each stated beside it.
- `docs/contracts/settings-classes.md` — both new keys are class C: an agent may
  not write them, which is what keeps a switch an operator decision.
