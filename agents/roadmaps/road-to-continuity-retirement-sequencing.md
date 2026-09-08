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

## Outcome, 2026-09-08 — what this change did, and what it deliberately did not

Five of the nine open items closed. Four carried to
`road-to-continuity-writer-activation`, each with a measured reason and a
blocker rather than a deferral.

**The five numbers did not move, and nothing was added either.** The vector
reads `1 / 2 / 5 / 1 / 1` before and after. That is worth stating plainly
because Risk 1 of this register — *the record is added and nothing is retired* —
is the failure this roadmap exists to avoid, and a reader who sees an unchanged
vector should be able to tell which side of it this change fell on. It added no
continuity mechanism: no concern, no artefact, no command, no verb, and the new
schema variant lives inside the existing schema rather than beside it. What it
added is a measuring instrument and reader tolerance. The estate did not grow,
and for the first time it cannot grow silently.

**Why no retirement landed**, since that is the substantive question. Six
surfaces were candidates and every one has a recorded obstacle:

| Surface | Why not here |
|---|---|
| `hot-context` concern + `hot-context.md` | OUT by the 2026-09-08 council's D1. Relocating the `memory.session_index` restore is new architecture needing evidence of equivalence and a written trust contract (2026-09-07 D3). |
| `session:recycle` | OUT by the same D1. It is the only writer in the tree; retiring it before an automatic one exists leaves no writer at all. |
| `context-fill.json` | Authorised, then found to have a live parked consumer. See the blocker. |
| `/chat-history`, `/chat-history import` | Conditional on an audit proving no documentation dependency. A full tracked-source audit ran and cleared every other class — no verb, no dispatcher case, no MCP tool, no hook, no error path, no test that reads the real tree. It did not clear the documentation class, and the two instances are the ones that matter: the user-facing quick start advertises the command, and the surviving `/agent-handoff` tells agents to use it. The audit's value is that the remaining change is now an enumerated checklist rather than an investigation. |
| `chat-history:checkpoint` name | Owner-reserved (D2). See the blocker. |
| `run_checkpoint` | KEEP, and that is the answer 4.1 asked for in writing, not a failure to retire. |

**The four blockers live on the receiver, not here**, and that is deliberate
rather than tidy-mindedness: `archive_completed_roadmaps` refuses to archive a
roadmap carrying open blockers, and it is right to — a blocker on a dead roadmap
is a blocker nobody reads. They are `capture-endpoint-rename-is-owner-reserved`,
`context-fill-retirement-has-a-parked-consumer`,
`chat-history-command-retirement-has-documented-dependencies` and
`three-concern-split-is-unpaid-under-the-concern-ratchet`, all in
`road-to-continuity-writer-activation`, each with the five-field contract and
the evidence that produced it.

**One near-miss is worth recording, because it would have produced a wrong
retirement.** `agents/evidence/metrics/skill-usage-report.md:34-35` reports both
`/chat-history` commands as `dead`, `0` exposures and `0` mentions in every
window, which reads exactly like the non-use proof the council asked for. It is
not one. The same report's header says `Active: 0` across all 337 tracked
artefacts, and `agent-handoff` — the command the owner's authorisation
explicitly preserves — is `dead / 0 / 0` on the same page. The collector never
emitted, so the report distinguishes nothing, and an all-zero instrument gives a
number for every question and an answer to none. It is filed as its own blocker
on the receiver so the next reader does not spend the same evidence twice.

The honest reading of that table is that the retirement half of this roadmap was
gated on work the parent had already sequenced ahead of it, and this change did
the sequencing work instead of forcing the retirements early. The
`context-fill.json` row is the one that should sting: it was the free win, the
council authorised it on evidence supplied from this session, and the evidence
was incomplete. The finding is recorded rather than quietly dropped.

## Phase 3 — one writer, one reader, one start-behaviour

- [~] **3.1 One concern writes the record at the moments context ends.** The
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
      <!-- deferred-resolution: carried-to=road-to-continuity-writer-activation -->
      **Carried, not attempted.** Two independent obstacles, both measured. The
      manifest half is forbidden by a gate: `check_estate_count` ratchets
      `concern_count` off `src/scripts/hook_manifest.yaml` with allowance 0
      (`src/scripts/check_estate_count.ts:156`, `:841`), a three-way split is
      +2, and no concern retirement is inside the scope this change may
      execute. The writer half is behind the staged-activation contract the AI
      council of 2026-09-08 attached to it (D5) — default-off, an atomic
      create-if-absent publication, a settled conflict policy for the
      authoritative record slot, and integration evidence against the real
      dispatcher. Building the writer while clause 1 stays blocked would add a
      mechanism to a ratcheted estate and still leave the step open, which is
      Risk 1 paid for nothing.
- [x] **3.2 The reader consumes once, under the guards that already exist.**
      `wrapAsPriorSessionData`, `hasBoundaryMarker`, `scanEnvelopeDirectives`,
      `MAX_AGE_HOURS` and the consume-once move are reused **by name**, never
      reimplemented. Injection that does not pass through the wrapper is a
      defect, not a shortcut.
      verify: `tests/scripts/recycle_envelope_consumer.test.ts` is **extended**
      to the new record shape rather than replaced — its consume-once,
      stale-refusal and foreign-workspace cases still pass unchanged.
      **Done 2026-09-08.** The new record shape is the `continuity_record`
      variant (`src/scripts/_lib/subagent_capsule.ts:147`), with its forbidden
      and required key sets declared at `:180` and `:196`. The consumer test
      went 17 -> 21 cases and all four original acceptance fixtures are
      byte-unchanged, which is what "extended rather than replaced" asks for.
      No guard was reimplemented: the derived variant goes through
      `validateRecycleEnvelope`, `RECYCLE_MAX_AGE_HOURS`, the realpath identity
      check, `predecessorTracePresent`, `scanEnvelopeDirectives`,
      `wrapAsPriorSessionData` and the same consume-by-rename move. The
      validator now dispatches on `variant` BEFORE version, which also closes
      the stub's probe P2 — recorded there as untestable "by construction"
      because no third variant existed.
- [x] **3.3 Behave by how the session started.** `compact` re-injects this
      session's own record; `resume` and `fork` inject nothing because the host
      already restored context; an unrecognised `source` injects nothing rather
      than guessing. Reading the wrong one is how a continuation acquires a
      stranger's state.
      verify: one test per `source` value, plus the unrecognised case.
      **Done 2026-09-08.** `sourceGate` in
      `src/scripts/handoff_context_hook.ts`, with seven cases in
      `tests/scripts/handoff_context_hook.test.ts` — `startup`, `clear`,
      `compact`, an absent source, `resume`, `fork` and an unrecognised one.
      The gate runs BEFORE either consumer, and that placement is the part
      worth reviewing rather than the table of sources: both consumers move
      their file aside on every non-absent outcome, so a gate placed inside one
      would have deleted the record while reporting that it injected nothing.
      Proven by sabotage — moving the gate after consumption fails 3 of the 14
      tests, restoring it passes 14.

## Phase 4 — retire the authorised set and ratchet it

- [~] **4.1 Retire the authorised set, one artifact at a time.** The owner
      authorised the set on 2026-09-06, minus `HANDOFF.md`, which the parent
      already retired. Each retirement names its replacement and lands with its
      reference removals in the same change.
      verify: after each retirement the tree contains no reader of the retired
      artifact; the five end-state numbers are re-derived by command and are
      lower; the `run_checkpoint` keep/retire question carries a written answer
      before it is touched either way.
      <!-- deferred-resolution: carried-to=road-to-continuity-writer-activation -->
      **One of three verify clauses is discharged; no artifact was retired.**
      The `run_checkpoint` question carries its written answer, and the answer
      is KEEP — recorded in `src/config/continuity-surface.json` at the
      `checkpoints` row, where the count is computed, and printed by the gate
      on every run rather than filed somewhere nobody opens. It rests on the
      2026-09-07 council's D2: run-integrity evidence is keyed by run id,
      consumed by `run:supervise`, and a disagreement there is an integrity
      alarm, while a continuity record is keyed by session and a gap there is a
      degraded resume.
      The retirements themselves did not land, and each has a measured reason
      rather than a deferral. `hot-context` and `session:recycle` are OUT by the
      2026-09-08 council's D1. `context-fill.json` was authorised by that same
      council and then found to have a live parked consumer (blocker below) —
      the authorisation rested on producer/no-consumer evidence that was
      incomplete, which the same seat had explicitly warned about. The two
      `/chat-history` commands were conditional on an audit proving no
      documentation dependency, and the audit found four (blocker below).
- [~] **4.1b `chat-history:checkpoint` — name migration, not retirement.** The
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
      <!-- deferred-resolution: carried-to=road-to-continuity-writer-activation -->
      **Owner-reserved, exactly as this roadmap's own § "Two things this
      roadmap may not decide" predicted it would turn out.** The 2026-09-08
      council ruled it Option 2 on the ground that net-zero describes a count
      and not an authorisation: a new endpoint name is a new callable contract,
      and a deprecation alias means the old name is still operational and
      therefore not yet retired. The blocker below carries the five decisions
      the owner has to make. Capture is untouched and keeps working.
      One anchor in the text above is stale and is corrected here rather than
      silently: the dispatcher call is at `_dispatch.bash:1045-1051`, not
      `:1010`. `chat_history.ts:1836` and `:1883` and
      `install-hooks.sh:459-484` all still resolve.
- [x] **4.2 Ratchet the surface count so it cannot grow back.** The rule the
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
      **Done 2026-09-08.** `src/scripts/check_continuity_surface.ts` plus the
      inventory at `src/config/continuity-surface.json`, wired into `task ci`
      via `taskfiles/ci-fast.yml` and registered in
      `src/config/gate-coverage.yml`. It is a CI gate and deliberately not a
      public verb — the 2026-09-08 council: *"Turning it into a public CLI
      command would enlarge the very surface being reduced."*
      The artefact axis is discovered behaviourally, which is the clause that
      makes the count ungameable: every distinct leaf under
      `agents/runtime/state/` that any source names must be disposed of in the
      inventory as counted or excluded-with-a-reason, so a new persisted-state
      surface cannot slip past by not being called continuity. 57 leaves
      discovered, 69 rows, all disposed. The rule is printed at the point of
      failure, and every exclusion prints with its reason on every run —
      including `checkpoints/`, the worked example the council named.
      Sensitivity proven rather than assumed: a planted
      `agents/runtime/state/` path in a new source file takes the gate to exit
      1 and the suite to 1 failure; removing it restores exit 0 and 14 passes.
      The gate's own `--self-test` carries 7 cases, 4 rejecting, covering all
      four failure classes in both directions.

## Acceptance criteria

- [~] AC-5 — A session ending at a bound slot leaves a record without model
      spend; a session that did nothing substantive leaves none.
      <!-- deferred-resolution: carried-to=road-to-continuity-writer-activation -->
      Carried with step 3.1, which is the step that would make it true. Nothing
      writes a record automatically yet.
- [x] AC-7a — The five end-state numbers are DERIVED by a command rather than
      asserted: `./scripts-run src/scripts/check_continuity_surface` publishes
      them together with the behavioural inventory they come from, names every
      counted item by source location, records every exclusion with its reason,
      and reddens on unreviewed growth. Wired into `task ci`.
      **Done 2026-09-08.** The vector reads `1 / 2 / 5 / 1 / 1` on this tree.
- [~] AC-7b — The derived vector reads exactly `0 / 0 / 1 / 1 / 0`, and no
      exclusion represents a normal-path continuity mechanism that would change
      the vector if counted.
      <!-- deferred-resolution: carried-to=road-to-continuity-writer-activation -->
      **AC-7 was SPLIT, not weakened**, on the 2026-09-08 council's D3 (Option
      3, both seats). The mechanism half is verifiable now and the value half
      is not, because three of the five axes cannot move until retirements land
      that this change is not authorised to make. Splitting keeps the shipped
      instrument from being hidden behind a target it cannot reach, and keeps
      the target from being quietly redefined to whatever shipped. The current
      vector is stated on AC-7a so the gap is a number rather than a promise.
- [x] AC-8 — A change adding a continuity artifact, concern, command or verb
      without retiring one reddens a check.
      **Done 2026-09-08.** `check_continuity_surface` T1 and T2. Two distinct
      failure paths, both self-tested: an added persisted-state leaf that the
      inventory does not dispose of reddens immediately, and any axis reading
      higher than the base ref's own inventory reddens with the rule printed.
      Honest limit, stated because the gate says it too: on THIS branch the
      floor is unavailable — `origin/main` carries no inventory yet, so the
      ratchet half has nothing to compare against and prints that it did not
      run. It arms on the next branch. The T1 half is live from this commit.

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
