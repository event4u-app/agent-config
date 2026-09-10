---
stability: beta
keep-beta-until: 2026-12-07
---

# Continuity rollback — which switch undoes what, and what no switch can undo

> Three session-lifecycle handlers, three independent switches. Disabling one
> restores pre-change behavior **for that handler only**; the other two keep
> firing. This document names the residual behavior of each switch and the
> criteria that should make an operator throw one.
>
> Written for `road-to-continuity-writer-activation` step 1.4, which required
> exactly one thing this table cannot express and which therefore gets its own
> section below: **a switch cannot bring back a deletion.**

## The two kinds of undo, and why they are not interchangeable

```
DISABLING NEW BEHAVIOR IS A SWITCH. REVERTING A DELETION IS A COMMIT.
NEVER OFFER A SWITCH AS THE ROLLBACK FOR A REMOVAL.
```

- **Disabling new behavior** — the handler stops running and the tree behaves
  as it did before the handler existed. One settings key, effective on the next
  session-lifecycle event, no data migration, nothing to restore. Every row in
  the table below is this kind.
- **Reverting a deletion** — a command, a concern, an artifact or a documented
  affordance has been removed from the tree. No settings key brings it back;
  the only undo is a revert of the commit that removed it, plus whatever
  regeneration that commit performed. Phase 3 of the roadmap is entirely this
  kind, which is why each of its steps carries its own gate rather than a
  switch.

Conflating the two is the failure this section exists to prevent: an operator
who reads "continuity is switchable" and then finds `session:recycle` gone has
been told something true about Phase 1 and false about Phase 3.

## The three switches

| Handler | Key | Ships | What OFF restores | Residual behavior when OFF |
|---|---|---|---|---|
| Continuity-record writer | `continuity.auto_record` | `"on"` (was `"off"` before 2026-09-10) | no automatic record producer — but NOT the pre-change tree any more, and that is the change this row carries | `session:recycle` becomes the only writer again, so a record exists only when a human runs it — and since step 3.2 retired the recycle advisory and its missing-envelope counter-check, **nothing tells anybody to run it**. Throwing this switch off is therefore no longer a return to the previous behaviour; it is continuity off unless an operator remembers the command unprompted. Trip it only for a defect in the writer, and expect to re-arm it |
| Run-checkpoint producer | `continuity.run_checkpoints` | `"on"` | no `agents/runtime/state/checkpoints/<run>.json` is written | A killed session inside a roadmap contract can no longer be resumed from a derived checkpoint; `run:supervise` falls back to whatever the roadmap file itself says. Continuity writing and the context-fill surface are unaffected. (This row used to end "and both advisory lanes are unaffected" — there are no advisory lanes left to be unaffected by anything since step 3.2 retired them.) |
| Session-index restore | `memory.session_index` | `"off"` | the pre-change tree: no memory index injected at `session_start` | No compact id + title index reaches the model at session start; `memory_get` on demand still works, and the working-memory cache injection on the same slot is unaffected |

Each switch is read by its own function, and the two new ones deliberately have
**opposite failure polarity**:

- `auto_record_enabled` fails **closed** — a malformed or unreadable settings
  layer leaves the new producer disarmed, and emits a best-effort diagnostic
  naming the layer.
- `run_checkpoints_enabled` fails **open** — a broken cascade never silently
  removes a recovery aid that already existed.

A single helper with one polarity would have been wrong for one of the two, and
which one it was wrong for is the expensive direction.

**Corrected 2026-09-10, because the first version of this claim was not true of
the code.** Both readers were written as `try { …read the cascade… } catch { }
return <default>`, and `load_agent_settings` does **not** throw on a malformed
`.agent-settings.yml` — it skips the layer and returns the shipped template's
value. So neither `catch` ran for the case this section describes, and each
polarity was carried by its template default rather than by its own code. That
was invisible while `auto_record` shipped `off`; step 3.2 flipped it to `on` and
the property disappeared, caught by the fixture written to pin it.

`auto_record_enabled` now decides the malformed case from
`settings_layer_states` (`src/scripts/_lib/agent_settings.ts`), which reports
per-layer validity instead of letting a resolved value stand in for it — so the
fail-closed claim above is carried by code for the first time. An AI council of
2026-09-10 (2 seats, convergent, under the owner's written delegation) ruled
that repair rather than a re-wording, and classified the alternative — flipping
the documented polarity to fail-open — as a weakening of a class-C `consent`
protection and therefore owner-reserved.

`run_checkpoints_enabled` is **deliberately unchanged**: its `catch` is
unreachable for the same reason, and its fail-open claim is true anyway because
its template value is `on`. Hardening a reader whose claim is currently correct
would change no behaviour. If that default ever moves to `off`, this paragraph
is the notice that the claim moves with it.

**The diagnostic is an attempt, not a promise.** The Stop slot never blocks and
the dispatcher does not forward a concern's stderr on every host, so a line
written there may reach nobody. It is required to be attempted and its delivery
is not guaranteed — stated this way because "it warns you" would be the same
kind of unbacked claim this correction exists to remove.

## Trip criteria — what should make an operator throw one

These are the conditions under which throwing the switch is the right call, not
a list of things that have happened.

**`continuity.auto_record` → `off`** — and note what it no longer restores. Up
to 2026-09-10 this switch shipped `off` and throwing it returned the tree to its
prior behaviour. It now ships `on` and the recycle advisory is retired, so
throwing it leaves the normal path with no writer AND no prompt. Every criterion
below is still a reason to throw it; none of them is a reason to leave it thrown.

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
- **A retired advisory.** The advisory that told a human to run
  `session:recycle` before `/clear` was the counted normal-path manual action.
  It was retired on 2026-09-10 (step 3.2) together with its missing-envelope
  counter-check — a code deletion, not a switch, so throwing
  `continuity.auto_record` to `off` does not bring the prompt back.
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
