---
complexity: structural
status: carrier
parent_roadmap: road-to-one-continuity-record
---

# Road to continuity retirement sequencing

> **Receiver.** This file exists so the six `[~]` items deferred out of
> `road-to-one-continuity-record` have a live destination that
> `deferralProblems` (`src/agent-src/scripts/archive_completed_roadmaps.ts`) can
> verify from both ends. A carry destination resolves only under
> `agents/roadmaps/` or `agents/roadmaps/later/` — never `stubs/` — which is why
> the transfer needed a receiver here as well as its disposition record.
>
> `status: carrier` keeps it off the roadmap dashboard, out of
> `check_roadmap_trackable` and out of the plan risk register until a human
> flips it to `ready`. It does **not** keep it out of the estate count:
> `check_estate_count` adds top-level carriers back to `active_roadmaps`
> deliberately, so this file was paid for by archiving its parent in the same
> change rather than by an exemption.
>
> **Nothing here is scheduled work**, and nothing here may start until the probe
> reads true.

## Read the disposition first

The ruling that moved these steps, the refuted premise that changes one of them,
the two owner-reserved parts, and the four-reading promoting probe are in
`agents/roadmaps/stubs/road-to-continuity-retirement-sequencing.md`. It is not
duplicated here: the steps live in this file because a receiver must carry them,
and the reasoning lives there because that is where the framework puts a
drain-run transfer's record, and two copies of a council verdict is how the two
drift.

**One line of it belongs here anyway, because acting on this file without it is
the failure mode:** step 4.1b's second half is **refuted** and must not be
executed as written — `chat-history:checkpoint` reaches a real handler
(`chat_history.ts:1836`, `:1883`) via `_dispatch.bash:1010` and has four real
producers (`install-hooks.sh:408-424`), and the append it performs is
chat-history capture, which the parent's goal places out of scope by decision.

## Carried steps

- [ ] **3.1 One concern writes the record at the moments context ends.** Carried
      unchanged in intent, and **constrained** by the ruling: the writer is its
      own handler, never a concern that also produces run checkpoints or restores
      the session index.
      verify: unchanged from the parent — a session ending at a bound slot leaves
      a record without model spend, a session that did nothing substantive leaves
      none, and the count comes from the concern's own state rather than from file
      presence.
- [ ] **3.2 The reader consumes once, under the guards that already exist.**
      `wrapAsPriorSessionData`, `hasBoundaryMarker`, `scanEnvelopeDirectives`,
      `MAX_AGE_HOURS` and the consume-once move are reused by name, never
      reimplemented.
      verify: unchanged from the parent.
- [ ] **3.3 Behave by how the session started.** `compact` re-injects this
      session's own record; `resume` and `fork` inject nothing; an unrecognised
      `source` injects nothing rather than guessing.
      verify: unchanged from the parent.
- [ ] **4.1 Retire the authorised set, one artifact at a time.** Minus
      `HANDOFF.md`, which the parent retired. Each retirement names its
      replacement and lands with its reference removals. `run_checkpoint` is kept
      and its production relocates to its **own** handler, not to the continuity
      concern.
      verify: after each retirement the tree contains no reader of the retired
      artifact, and the five end-state numbers are re-derived and lower.
- [ ] **4.1b (second half) `chat-history:checkpoint` — name migration, not
      retirement.** See the refutation above. What is in scope is retiring the
      colliding NAME while capture keeps working, which is a protocol migration
      across installed downstream hooks.
      verify: an upgraded downstream installation shows the four generated hooks
      calling the surviving capture verb, no unmodified hook still calling the
      retired name, and any locally modified hook reported rather than rewritten.
- [ ] **4.2 Ratchet the surface count so it cannot grow back.** Carried with the
      council's amendment: the check must publish a **behavioural inventory** —
      any persisted state written for later session or run recovery, verification
      or context restoration, whether or not it is labelled continuity — with its
      exclusions and their reasons visible, not only the five numbers.
      verify: a change adding a continuity artifact, command, verb or schema
      without retiring one reddens a check; the check reports the five end-state
      numbers and the inventory; and the rule is stated where the check fails.

## Acceptance criteria carried with them

- [ ] AC-5 — A session ending at a bound slot leaves a record without model
      spend; a session that did nothing substantive leaves none.
- [ ] AC-7 — The five end-state numbers read exactly `0 / 0 / 1 / 1 / 0`,
      re-derived by command rather than asserted.
- [ ] AC-8 — A change adding a continuity artifact, concern, command or verb
      without retiring one reddens a check.

Parent AC-6 was **not** carried: it was ticked in the parent against shipped
evidence, because the reader satisfies it today and
`tests/scripts/recycle_envelope_consumer.test.ts` pins consume-once, stale
refusal and foreign-workspace refusal each with their stated reason.

## When this file may be promoted

When P1 through P4 in the stub all read true. Not on a date — a date here would
be a guess about when someone else ships something. Promotion is a human
flipping `status: carrier` to `status: ready`; a drain run may execute the steps
once promoted, and may never decide the two owner-reserved parts the stub names.
