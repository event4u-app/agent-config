---
complexity: structural
status: ready
parent_roadmap: road-to-one-continuity-record
---

# Road to continuity retirement sequencing

> **Deferral receiver.** The six `[~]` items deferred out of
> `road-to-one-continuity-record` live here, so `lint_deferral_integrity` can
> verify the carry from both ends. That is a property of the deferral edges, not
> of this file's status — see ADR-262.

## Goal

After this roadmap, the tree has **one** continuity record with one writer, one
reader and one start-behaviour, and the artifacts the parent authorised for
retirement are gone with their readers. The five end-state numbers from the
parent's goal read `0 / 0 / 1 / 1 / 0`, derived by a command rather than
asserted, and a check reddens when a new continuity mechanism is added without
one being retired.

Out of scope, carried from the parent by decision: chat-history **capture**
(the only cross-host transcript source) and the runtime journal.

## Status correction, 2026-09-08 — the previous disposition is struck

The section this replaces recorded that an autonomous drain run stopped at this
file because `status: carrier` made it "human-gated". **That disposition is
withdrawn in full.** Three reasons, each checkable:

1. **The maintainer overruled it.** A roadmap in this repository is work the
   maintainer wants done, and a run instructed to drain every roadmap carries
   his authority for every roadmap.
2. **The stop contradicted the running command.**
   `src/domains/product-basic/roadmap/process-full/command.md:262-291` lists
   *"this step looks human-gated"* among its FORBIDDEN NON-HALT REASONS.
3. **`status: carrier` no longer exists.** ADR-262 deleted it.

The struck section also claimed a council record under
`agents/runtime/council/responses/`, which is gitignored and therefore
unresolvable to any reviewer — a defect the release review flagged
(`acc3a715b4e9`, `6f0cfd30a93c`). The council record for the decision that
replaced it is transcribed into the tracked tree at
`agents/evidence/analysis/council-2026-09-08-carrier-status-redefinition.md`.

**What survives from the struck section, because it was correct and measured:**
the probe readings of 2026-09-07 — P1 FALSE, P2 PARTIAL, P3 FALSE, P4 FALSE —
and the finding that all three FALSE readings are *internal, buildable and
reversible*, so what they show is unbuilt work rather than a dead end. Those
four conditions are no longer a gate on starting. They are folded into the
`verify:` lines below, which is what they always described: P1 is the outcome of
step 3.1, P3 of step 4.1's method, P4 of step 4.1b. A condition that cannot
become true without performing the step it gates was never a precondition.

## Phase 3 — one writer, one reader, one start-behaviour

- [ ] **3.1 One concern writes the record at the moments context ends.** The
      writer is its **own** handler with its own kill switch — never a concern
      that also produces run checkpoints or restores the session index.
      `session_eol_hook.ts` currently does all three (`:276` context-fill,
      `:404-407` `run_checkpoint`), and splitting it is this step.
      `run_checkpoint` is **kept**; only its production relocates to its own
      handler. No handler's failure may suppress another's.
      verify: `hook_manifest.yaml` declares three separate concern ids with
      three kill switches; a fault-injection test exercises every handler
      combination and shows no cross-suppression; a session ending at a bound
      slot leaves a record without model spend; a session that did nothing
      substantive leaves none; the count comes from the concern's own state,
      never from file presence.
- [ ] **3.2 The reader consumes once, under the guards that already exist.**
      `wrapAsPriorSessionData`, `hasBoundaryMarker`, `scanEnvelopeDirectives`,
      `MAX_AGE_HOURS` and the consume-once move are reused **by name**, never
      reimplemented. Injection that does not pass through the wrapper is a
      defect, not a shortcut.
      verify: `tests/scripts/recycle_envelope_consumer.test.ts` is **extended**
      to the new record shape rather than replaced — its consume-once,
      stale-refusal and foreign-workspace cases still pass unchanged.
- [ ] **3.3 Behave by how the session started.** `compact` re-injects this
      session's own record; `resume` and `fork` inject nothing because the host
      already restored context; an unrecognised `source` injects nothing rather
      than guessing. Reading the wrong one is how a continuation acquires a
      stranger's state.
      verify: one test per `source` value, plus the unrecognised case.

## Phase 4 — retire the authorised set and ratchet it

- [ ] **4.1 Retire the authorised set, one artifact at a time.** The owner
      authorised the set on 2026-09-06, minus `HANDOFF.md`, which the parent
      already retired. Each retirement names its replacement and lands with its
      reference removals in the same change.
      verify: after each retirement the tree contains no reader of the retired
      artifact; the five end-state numbers are re-derived by command and are
      lower; the `run_checkpoint` keep/retire question carries a written answer
      before it is touched either way.
- [ ] **4.1b `chat-history:checkpoint` — name migration, not retirement.** The
      parent's premise that this verb is an orphan is **refuted**: it reaches a
      real handler (`chat_history.ts:1836`, `:1883`) via `_dispatch.bash:1010`
      and has four real producers (`install-hooks.sh:459-484`). What is in scope
      is retiring the colliding NAME while capture keeps working — a protocol
      migration across already-installed downstream hooks. Note that
      `post-merge` and `post-checkout` carry an appended auto-sync block, so
      ownership detection must expect two distinct generated contents per hook.
      verify: an **upgraded** (not freshly installed) downstream checkout shows
      the four generated hooks calling the surviving capture verb; no unmodified
      hook still calls the retired name; a locally modified hook is **reported,
      never rewritten**.
- [ ] **4.2 Ratchet the surface count so it cannot grow back.** The rule the
      ratchet encodes: a new continuity mechanism may be introduced only if it
      replaces an existing one, or demonstrably covers a capability the one
      record cannot. The check must publish a **behavioural inventory** — any
      persisted state written for later session or run recovery, verification or
      context restoration, whether or not it is labelled "continuity" — with its
      exclusions and their reasons visible, not only the five numbers. Without
      the inventory the numbers are gameable by naming.
      verify: a change adding a continuity artifact, command, verb or schema
      without retiring one reddens a check; the check reports the five numbers
      **and** the inventory; the rule is stated where the check fails, not only
      here.

## Acceptance criteria

- [ ] AC-5 — A session ending at a bound slot leaves a record without model
      spend; a session that did nothing substantive leaves none.
- [ ] AC-7 — The five end-state numbers read exactly `0 / 0 / 1 / 1 / 0`,
      re-derived by command rather than asserted.
- [ ] AC-8 — A change adding a continuity artifact, concern, command or verb
      without retiring one reddens a check.

Parent AC-6 was **not** carried: it was ticked in the parent against shipped
evidence, because the reader satisfies it today and
`tests/scripts/recycle_envelope_consumer.test.ts` pins consume-once, stale
refusal and foreign-workspace refusal each with its stated reason.

## Two things this roadmap may not decide

Both are genuine owner reservations under
[`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)'s reserved
set, and neither is a status flip:

1. **Rewriting a locally modified installed git hook.** Detect ownership by
   exact generated content; leave a modified hook untouched and report it. That
   is 4.1b's stated verify line, so the reservation binds a *failure* path, not
   the step.
2. **Introducing a new public command** as the surviving capture endpoint. The
   parent's authorisation names what is retired, not what is added.

Neither blocks starting. If 4.1b's migration turns out to need a new public
command, that is the point at which a blocker is filed — not before.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The record is added and nothing is retired | product | The parent's own Risk 1, live since the parent archived. A tree can carry one new record and still leave `handoff`, `recycle`, chat-history import and a hot-context cache standing as competing mental models — which is the failure the whole parent existed to prevent. | 4.2's ratchet plus its behavioural inventory; AC-7 re-derives the five numbers by command so "retired" is measured, not claimed. | Phase 4 |
| 2 | Splitting one concern into three breaks a hook slot silently | implementation | `session_eol_hook` writes three unrelated things today. A split that loses a binding fails at session end, where nothing watches — the failure mode is a missing record, not an error. | 3.1's fault-injection test over every handler combination, and the count read from the concern's own state rather than from file presence. | Phase 3 |
| 3 | The name migration breaks chat-history capture on upgraded installs | implementation | `chat-history:checkpoint` has four live producers in generated git hooks; a rename that lands without a migration path silently stops phase-boundary capture on every existing checkout. | 4.1b verifies against an **upgraded** checkout rather than a fresh install, and reports locally modified hooks instead of rewriting them. | Phase 4 |
| 4 | The five end-state numbers are gamed by naming | product | Position 3 could read `1` with nothing actually retired, by relabelling an artifact as something other than "continuity" — `run_checkpoint` is the worked example. | 4.2's inventory is behavioural (any persisted recovery state, however labelled) and publishes its exclusions with reasons. | Phase 4 |
| 5 | The reader is reimplemented instead of reused | implementation | Three constants named `MAX_AGE_HOURS`/`RECYCLE_MAX_AGE_HOURS`, all 48, already exist in three files. A fourth reader would drift from the guards that are tested. | 3.2 reuses the five guards **by name** and extends the existing consumer test rather than writing a new one. | Phase 3 |
