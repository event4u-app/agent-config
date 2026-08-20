---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to stop-gate honesty — a blocking gate earns a number

> **Source:** `agents/tmp.old/mixed-trigger-cleanup/road-to-stop-gate-honesty.md`
> — external analysis session, 2026-08-17, drafted against `de76c38b932d1612d36cfc85d6b9fbaff4832350`.
> Adopted 2026-08-17 via `/analyze:inbox` after per-claim verification against
> `origin/main` @ `097ab6549`. One of the draft's phases is materially narrowed by
> that verification — see claim 4 and step 2.2.

---

## 0. The defect, stated first

**The suite refuses turn-ends, and a refused turn-end is at least one extra model
turn the user experiences as slowness and as the agent fighting them — with no
per-session visibility into how often it happens.**

No infinite loop exists: the re-entrancy guard is two-layered and sound. The cost
is per-refusal, and it is unmeasured in the field.

### D-1 — The gate is always armed, with three detectors

Armed unconditionally since the settings switch was removed, which shipped
**inside** the "before 12 it was good" window the report names — itself evidence
that the report's version attribution needs Phase 0 of
`road-to-per-turn-hook-economy` before anything is attributed to 12.1. The
detectors are (A) promissory closing, (B) language mismatch against a fresh pin,
and (C) unverified edit — a turn that changed a file and ran no verify-shaped
command is refused at Stop. For a German-speaking team, B fires on English replies
under a German pin; for quick-edit workflows, C converts every "fix this one line"
turn into "fix it and run a verifier, or be refused".

### D-2 — Refusal frequency is invisible

Per-session ordinal state exists — one small file per session, and its own header
admits there is no TTL — but nothing aggregates refusals into a rate anyone
reviews. A gate that blocks unobserved is exactly the shape this estate's own
advisory-kill discipline exists to prevent: advisories here carry registered kill
standards, and this **blocking** concern carries none.

### D-3 — Stop is the heaviest slot and the least elastic

Stop binds the largest concern chain on claude, including a large transcript read,
a JSONL rebuild, and git scans. **Every refused Stop runs the whole slot again on
the retry.**

## 1. Verified provenance

Verified 2026-08-17 against `origin/main` @ `097ab6549`.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | The gate refuses turn-ends; three detectors A/B/C | **still-true** | `src/scripts/hooks/turn_end_gate_hook.ts` header |
| 2 | Two-layer re-entrancy guard; a wedge rather than a loop is the named failure | **still-true** | same header, re-entrancy section; the `stop_hook_active` check |
| 3 | Always armed; the settings switch was removed | **still-true** | header's always-armed section; the commit is contained in tags from 10.0.0 onward, i.e. before the window the report blames |
| 4 | `_VERIFY_RE` may not recognise the team's PHP toolchain, producing false refusals | **OVERTAKEN — the named toolchain is already covered** | `_VERIFY_RE` matches bare `phpunit` and `pest` in its first alternation, and `composer` / `php artisan` followed by a verify-shaped subcommand in its second. So `vendor/bin/phpunit`, `pest`, `composer test` and `php artisan test` all register as verification today. Step 2.2 is narrowed accordingly: the audit is still worth running, but not on the examples the draft named |
| 5 | Session state files accumulate with no TTL | **still-true** | stated explicitly in the hook header |
| 6 | Stop binds the largest chain on claude | **still-true** | `src/scripts/hook_manifest.yaml` claude block |
| 7 | A large transcript read cap per Stop | **still-true** | the read cap in `turn_end_gate_hook.ts` |
| 8 | Measured origin: language violations survived a fresh pin, and advisory carriers hit zero effect | **still-true** | the round-5 audit citation in the hook header. This is the strongest single result in the enforcement estate and is why this roadmap tunes rather than repeals |
| 9 | The team operates German-language sessions, so detector-B exposure is real rather than hypothetical | **still-true** | `agents/roadmaps/later/road-to-conformance-round7-followup.md` corpus quotes |
| 10 | Refusal rates are expected to correlate with the local 12.1 install date | **prediction, not a claim** | derived from `road-to-mixed-trigger-activation-cost` § 0 — per-edit obligations multiplied by detector C. Phase 1 tests it; nothing downstream assumes it |

## Phases

### Phase 1 — Count before judging

- [x] **1.1** Aggregate refusals: a small reader over the per-session ordinal files
      plus a refusals counter in the session-register record, reported by the hooks
      doctor and rolled up per period — **per detector separately**, because A, B
      and C have different legitimacy profiles and a pooled rate would hide which
      one is firing. The counter rides the existing session-register write, so it
      adds no spawn.
      `verify:` the doctor prints per-detector counts on this machine, and a fixture
      session with a known refusal is counted once.
      <!-- done 2026-08-17: `_lib/turn_end_refusals.ts` is the reader;
      `hooks_doctor` prints it; `SessionRecord.turn_end_refusals` is the
      per-session half, read from the record the gate already maintains, so the
      heartbeat gains no spawn.

      TWO PREMISE CORRECTIONS, both found by executing rather than by reading.

      (a) **The gate has FOUR detectors, not three.** § 0 names A/B/C; detector D
      (`completion`) landed under round 7 § Phase 1 and runs in the same
      unconditional list. A counter built to the prose would have silently
      dropped one detector's refusals, so `DETECTOR_IDS` is read off the gate's
      own `DetectorId` union and a test pins all four.

      (b) **The defect was in the WRITER too, not only in the missing reader.**
      `markRefusedTurn` overwrote its record on every refusal and stored
      `findings[0].detector` alone — so a session refused nine times looked
      exactly like a session refused once, and a turn tripping B and C at once
      counted as one B. D-2's "refusal frequency is invisible" was therefore true
      of the state file as well as of the absent rollup, and a reader alone would
      have aggregated a corpus that had already thrown the numbers away.
      Mutation-verified: reverting the call site to `[findings[0]!.detector]`
      fails the new end-to-end case, restoring it passes.

      HONEST DENOMINATOR. A record exists only for a session that was refused, so
      the reader reports refusals per *refused* session and says so in the output.
      A per-session rate over all sessions would need a write on every session on
      the hot Stop path, which this step's own "adds no spawn" forbids.

      FIRST READING, against the 36 field records (2026-08-12 … 2026-08-17):
      verification 22 (61%), language 9 (25%), promissory 5 (14%), completion 0.
      A floor, not an exact count — every one of those records predates counting
      and contributes one refusal each. Detector C dominating is D-1's own
      prediction for quick-edit workflows, now measured. -->
- [x] **1.2** Add the TTL the header admits is missing: prune ordinal files past a
      declared age at session start. Cheap and bounded.
      `verify:` a fixture directory with aged and fresh files keeps exactly the
      fresh ones.
      <!-- done 2026-08-17: `pruneAgedRefusalState`, 90 days, run at
      `session_start` by the `session-register` concern — the one slot that
      already prunes, so the step costs one directory scan and no new spawn.
      Ages on the record's OWN `refused_at`, never the filesystem mtime, which a
      checkout or an rsync rewrites; an unparseable record is KEPT rather than
      deleted. The gate header's "No TTL ships here" was corrected in place
      rather than left as a stale admission. 90 is a stated default with a
      revisit-if, not a measured optimum, and says so at the constant. -->
- [x] **1.3** Split the counts before and after the local 12.1 install date per
      machine, to test claim 10's prediction rather than assume it.
      `verify:` the split appears in the rollup, with the install date recorded per
      machine.
      <!-- done 2026-08-17, and the step's own mechanism was WEAKER than what
      shipped, which is worth stating because it changes what the split proves.

      `installed.lock` records the version that performed the MOST RECENT install
      and when — not the date any particular version arrived. This machine reads
      `13.0.0 at 2026-08-17`, so a before/after split on that date would say
      nothing about 12.1 and would look like it did. So the refusal record now
      carries `agent_config_version` AT REFUSAL TIME and the primary split is by
      RECORDED version; the lockfile boundary is still printed, because it is the
      only thing that dates the pre-stamping corpus.

      Consequence, stated rather than buried: all 36 existing records are
      `(unrecorded)` and the rollup labels them so. Claim 10 cannot be tested
      until refusals accumulate under a stamped version — which is the honest
      answer, and strictly better than attributing them to whatever is installed
      today. -->

**Interlock:** AC-1 asks for a rate over a window on at least two machines. The
instrument now exists and the maintainer machine's window is open; a colleague
machine contributes as soon as one runs a version that stamps its refusals.
Nothing downstream of Phase 1 was built on the unstamped corpus.
- **AC-1:** a per-detector refusal rate exists for the maintainer machine and at
  least one colleague machine, over a window long enough to be read as a rate
  rather than an anecdote.

**AC-1 is UNMET at archival, and archiving removes its last tracked carrier.**
Recorded here rather than left for a reader to infer from the archive row, which
publishes this file as `completed`: the counters reached `count_open == 0` because
every *step* closed, and AC-1 is an acceptance criterion waiting on data from a
second machine, which no step could have produced. AC-3 is in the same state but
has a real owner — it was delegated by name to an open roadmap. AC-1 has none.

The carrier that remains is the `keep-beta-until` review marker on
[`turn-end-detector-demotion`](../../../docs/contracts/turn-end-detector-demotion.md),
which is enforced by `check_beta_review_markers` and forces that file to be
re-read by its date. The same marker is the only schedule behind the two
instruments that contract is waiting on. That is weaker than a roadmap step and
stronger than nothing, and it is named at both ends so neither reader has to
reconstruct it. Retention makes this sharper rather than softer: the 90-day TTL
means a window left unaccumulated is not merely late, it is unrecoverable.

### Phase 2 — Judge each detector on its measured rate against its measured benefit

- [x] **2.1** Pre-register the bar per detector **before looking at Phase 1 data**:
      a detector whose refusals are re-refused on the retry above some share — the
      model could not satisfy it — or whose median per-session count exceeds some
      threshold is demoted from blocking to advisory **for that detector only**, and
      the demotion is published with the distribution. The numbers are the
      maintainer's; the shape is the requirement. Blocked on
      `b-detector-demotion-bars`.
      <!-- glyph corrected 2026-08-17 `[~]` → `[ ]`, maintainer decision, under
      the Iron-Law-3 resolution menu (`roadmap-management § 4b`, outcome
      "restore"). The two glyphs are not synonyms: `[~]` is DEFERRED — work
      consciously moved out of this plan — and `[ ]` is OPEN. This step is
      neither postponed nor cancelled; it is waiting on `b-detector-demotion-bars`
      exactly as every other blocker-gated step in the estate waits, and its own
      blocker entry says so ("Blocks: Phase 2 step 2.1").

      It shipped as `[~]` from the inbox adoption and nothing re-examined the
      choice. Closing Phase 1 moved the file to `count_open == 0` with one
      deferred item, which is the state Iron Law 3 refuses to let archive
      silently — so the glyph had to be decided rather than inherited, and the
      accurate reading is the one that also clears the gate. The gate was NOT the
      reason: a step is marked by what is true of it, and this correction would
      be right with no gate at all.

      What this does NOT do: it does not touch the blocker, does not pre-register
      any bar, and does not read Phase 1's distribution into a decision. The
      pre-registration must predate the first read and remains the maintainer's,
      untouched. -->
      <!-- verify: the roadmap reports one open step and zero deferred, and
      `roadmap:progress-check` no longer lists this file under Iron Law 3. -->
      <!-- done 2026-08-18: `docs/contracts/turn-end-detector-demotion.md`, the
      per-detector standard, registered under option (a) of
      `b-detector-demotion-bars` after an AI-council pass (2/2 seats present,
      concluded — both chose (a) over a shared bar and over "no demotion
      available"). Cross-linked from `concern-activation-policy` § Reverse trigger
      as the worked example for a blocking concern that predates that policy, and
      from the gate's own header.

      THREE THINGS THE STEP'S OWN WORDING DID NOT SURVIVE, each found by
      executing rather than by reading, and each recorded at the contract rather
      than only here.

      (a) **The re-refusal share is 0 BY CONSTRUCTION and is not measurable.**
      The step names it as the primary quantity — "a detector whose refusals are
      re-refused on the retry above some share". `main()` returns `EXIT_ALLOW`
      before any detector runs on a retry, twice over: layer 1 on the host's
      `stop_hook_active`, layer 2 on `alreadyRefusedTurn(…, turnOrdinal)`, and a
      retry carries no new user prompt so the ordinal is unchanged. A turn is
      refused at most once — the wedge the guard exists to prevent. This is
      intended behaviour pinned by a committed test whose fixture is a retry that
      STILL PROMISES and is asserted to pass ("LAYER 2: the turn marker alone
      stops a second refusal, even on a NEW reply"). So the bar is registered
      INERT, with the shadow `would_refuse_again` read named as the instrument
      that makes it live. Neither council seat could reach this: both had the
      mechanism description, not the guard's code.

      (b) **"Median per session" had to become "median per AFFECTED session"**,
      and that is a metric change rather than a clarification. Over all sessions,
      a detector affecting fewer than half of them has a permanent median of
      zero, so the bar could never fire — the gate-that-cannot-fire shape this
      repository rejects elsewhere.

      (c) **Crossing a bar authorises a staged study, NOT a demotion.** The step
      reads as though the bar demotes the detector. Both seats independently
      refused that on the round-5 asymmetry: friction and satisfiability measure
      cost, neither measures the violations that return after a demotion, and a
      high re-refusal share may be evidence the detector is load-bearing rather
      than broken. Recorded as a narrowing with its reason, not absorbed.

      What this does NOT do: it does not demote any detector, does not retire
      dormant D (that needs an opportunity metric this pre-registration
      excludes), and does not read Phase 1's distribution into the numbers — the
      published reading carries neither bar quantity, and the contract states the
      blindness check so a reader does not have to take it on trust. -->
      <!-- verify: test -f docs/contracts/turn-end-detector-demotion.md, and the
      contract names a bar for each of the four `DETECTOR_IDS`. -->
- [x] **2.2** Detector C's verify allowlist decides what counts as verification.
      **Narrowed by claim 4:** the PHP toolchain the draft worried about is already
      matched, so this step is no longer "add phpunit and pest". What remains is a
      real audit with a smaller surface — enumerate the verify-shaped commands the
      team actually runs, test each against `isVerificationCommand`, and record the
      misses. Any addition ships with a fixture mapping command string to
      recognised, the same as every allowlist in this tree.
      `verify:` a fixture table of real commands with their recognition verdict;
      every addition has its own row.
      <!-- done 2026-08-17: 56-row table in
      `tests/scripts/turn_end_verify_allowlist.test.ts`, built from this
      project's real surface — its `package.json` scripts, its `Taskfile`
      targets, `./scripts-run`, `./agent-config`, and the PHP / Python / Go /
      Rust toolchains.

      CLAIM 4 RE-VERIFIED, not taken on trust: `vendor/bin/phpunit`, `pest`,
      `composer test` and `php artisan test` all matched BEFORE this change. The
      draft's expected work was genuinely already done.

      TWO REAL MISSES, both added:
        · `phpstan` — a static analyser of exactly the class already listed
          (`mypy`, `pyright`, `clippy`).
        · `lint` followed by a WORD character. `\blint\b` needs a boundary and
          `_` is a word character, so EVERY `lint_*` script in `src/scripts/` was
          unrecognised — `lint_persistence`, `lint_provenance`, and the rest.
          `lint[-_:a-z]*` is the exact mirror of the `check[-_:a-z]*` this list
          already carried, which is why it is the narrow fix and not a new idea.

      FOUR MISSES DELIBERATELY NOT ADDED, because Risk 2 says every addition is a
      way to satisfy the gate without verifying anything: `npm run prepack` (a
      per-project lifecycle hook — a build step elsewhere), `task sync` /
      `task generate-tools` / `agent-config roadmap:progress` (GENERATORS — they
      rewrite the tree and check nothing, which is the rubber stamp in its purest
      form), `agent-config gates --all` (enumerates, runs nothing), and
      `vendor/bin/rector process --dry-run` (a refactorer; its dry run prints a
      diff and asserts nothing). `psalm` is `phpstan`'s obvious sibling and is
      also not added: nothing in the audited surface runs it, and "the team
      actually runs" is this step's own standard.

      The `false` rows are pinned as tests, not merely recorded — if a later
      widening makes `task sync` or `ls -la` clear an unverified edit, the
      fixture fails and the change has to be argued rather than slipped in. -->
      <!-- open note for 2.1: this audit does NOT read Phase 1's distribution and
      must not be read as doing so. The pre-registration in
      `b-detector-demotion-bars` is untouched and still predates any read. -->

**Phase status (2026-08-18):** both steps are closed. `b-detector-demotion-bars`
is resolved and each of the four detectors now carries a registered bar at
[`turn-end-detector-demotion`](../../../docs/contracts/turn-end-detector-demotion.md).

**AC-2 is met in the sense it was written, and NOT in the sense a reader will
want.** It asks that "no detector stays blocking without a number" — every
detector now has one, which is exactly what this phase was opened to fix. What it
does **not** yet have is a *verdict*: a bar may only be read after its own sample
floor (100 eligible refusals · 50 affected sessions · 30 stable days), and the
eligible corpus is empty because the 36 legacy records predate version stamping.
So the phase closes on the standard, never on a green-or-demote reading, and the
first reading belongs to whoever meets a floor. Stating the split rather than
claiming the criterion outright is the point: a registered bar and a satisfied bar
are different facts.
- **AC-2:** each detector has either a green verdict — rate under its bar — or a
  demotion PR citing the distribution. **No detector stays blocking without a
  number.**

### Phase 3 — Make refusals cheap when they happen

- [x] **3.1** On a refusal retry, skip the non-gate Stop concerns: chat history has
      already written, and re-running the context rebuild, the end-review scan and
      the self-repair detector on the retry is pure duplicate cost. Manifest-level,
      one opt-in flag per concern, default off, flipped only with a per-concern
      argument in the PR — never a blanket skip. Verify per concern that its dedup
      is idempotent before flagging it.
      `verify:` a fixture retry runs only the refusal-capable concerns, and each
      skipped concern's artefact is identical to the non-retry run.
      <!-- done 2026-08-17: `skip_on_refusal_retry` in `hook_manifest.yaml`,
      honoured by `_resolve_concerns` when `_is_refusal_retry` reads the host's
      own `stop_hook_active` — the same field the gate uses as its layer-1 guard,
      so the retry is the host's answer and not our inference. Anything
      unparseable yields the FULL chain: running twice costs duplicate work,
      skipping wrongly loses a write.

      Measured end to end: the claude stop chain is 10 concerns, 8 on a retry.

      THE STEP'S OWN PREMISE IS PARTLY REFUTED, and the audit it demanded is what
      refuted it. "Chat history has already written, and re-running the context
      rebuild, the end-review scan and the self-repair detector is pure duplicate
      cost" holds for ONE of those four. Between the refusal and the retry the
      model DOES more work — that is the point of refusing — so the transcript
      has grown and every concern reading it has a changed input:
        · `chat-history` — would LOSE the work done between the two Stops.
        · `hot-context` — rebuilds from a tree the retry just edited.
        · `self-repair` — a detector over a turn that changed.
        · `session-eol` — reads only the bytes appended since the last scan, so
          skipping the final Stop drops the tail.
      Flagging those four would be Risk 3 exactly: "a concern skipped on the
      retry might have been the one that needed the second pass, and the loss
      would be silent."

      TWO CONCERNS PASS, each on its OWN dedup rather than on our reading:
        · `interruption-ledger` — dedupes on `(run_id, turn)`, and a refusal
          retry is the same turn by construction. It already writes nothing. What
          it does not already avoid is the COST: `main()` calls
          `readTranscriptTail` (up to 8 MB, walking the whole file) BEFORE
          reaching `alreadyRecorded`, so today every refused Stop pays a full
          transcript walk and discards it. This is the flag with the real saving,
          and D-3's "pure duplicate cost" located in the source.
        · `end-review-nudge` — its F2 once-per-session marker returns "without
          re-running the transcript scan", so the artefact is identical by the
          concern's own construction. The saving is the module load, which is
          smaller, and the manifest says so rather than overselling it.

      `turn-end-gate` is asserted to survive the retry: skipping the
      refusal-capable concern would leave the second attempt unguarded, which is
      the inverse of the intent. A test pins it, and another pins that every
      flagged concern carries a written ARGUMENT beside its flag — a flag with no
      argument is the blanket skip wearing a per-concern shape. -->
- [x] **3.2** Complementary lever, recorded here so the two files cannot drift:
      moving the non-gating Stop concerns to the host's async handler form is owned
      by `road-to-per-turn-hook-economy` step 5.3. This roadmap records only the
      split — gates synchronous, recorders async — and defers the mechanism and its
      acceptance criterion to that file.
      `verify:` this step needs no code; it is closed by that file's 5.3 landing, or
      by recording that it did not.
      <!-- done 2026-08-17 by the second branch: 5.3 has NOT landed — read at
      `86cdbf652`, `road-to-per-turn-hook-economy` step 5.3 is open. Recorded
      here as that file's work, with the split stated: gates synchronous
      (`turn-end-gate`, `team-review-gate`), recorders async.

      One interlock the two files must not lose, because they now touch the same
      concerns from opposite directions: 5.3 states that `end-review-nudge`
      "needs its stdout to reach the model, so it stays synchronous until
      measured otherwise". That is about the ASYNC axis and does not conflict
      with 3.1's retry skip — on a retry its stdout was already delivered, or
      already suppressed, on the first Stop. A future 5.3 may make it async or
      leave it synchronous; either way the retry flag is orthogonal and neither
      decision constrains the other. -->

**AC-3 is NOT satisfied by this branch and is not claimed to be.** It asks that a
refused-turn retry cost "materially less than a full Stop in the bench, measured
rather than asserted". What shipped is the mechanism and its correctness proof —
the chain is provably shorter and the skipped artefacts provably identical. The
*measurement* belongs to `road-to-per-turn-hook-economy`'s bench, which owns the
Stop-slot numbers, and is the honest reason this phase advances without closing.
- **AC-3:** a refused-turn retry costs materially less than a full Stop in the
  bench, measured rather than asserted.

## Blockers

### blocker: b-detector-demotion-bars
- **Status:** RESOLVED 2026-08-18 — **option (a), per-detector bars**, registered
  at [`turn-end-detector-demotion`](../../../docs/contracts/turn-end-detector-demotion.md).
  Resolved by AI council (2 of 2 seats present, concluded, `--prompt-mode design`)
  rather than by the host: both seats chose (a) over (b) and over (c), and the
  numbers are the convergence of their two proposals, taking the
  demotion-resistant side wherever they differed. The question file carried no
  host framing and no recommendation.

  **Three corrections the council could not reach, made from the gate's code and
  labelled own analysis at the contract:** the re-refusal share is 0 by
  construction (two re-entrancy layers cap a turn at one refusal, pinned by a
  committed test), so that bar ships INERT with its enabling instrument named;
  "median per session" had to become "median per AFFECTED session" or the bar
  could never fire; and a crossed bar authorises a staged-demotion study rather
  than a demotion, which both seats reached independently and which NARROWS step
  2.1's own wording.

  **What was deliberately NOT decided here:** no detector is demoted, dormant D is
  not retired (that needs an opportunity metric this pre-registration excludes),
  and the staged study's own pre-registration is left to whoever runs it. The
  counter-argument the entry asked to keep in view — round 5's blocking-carriers-
  at-zero-violations result — is on the record at the contract and is the reason
  the standard resists demotion rather than enabling it.
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** Phase 2 step 2.1, and therefore any demotion. Steps 1.x, 2.2 and 3.x
  are repo work and proceed without it.
- **What to do:** pre-register the demotion bar per detector, before reading Phase
  1's data — pre-registration after the fact is not pre-registration. Options:
  (a) name a re-refusal share and a per-session median for each of A, B and C
  separately; (b) name one bar shared by all three, accepting that it will fit the
  most-firing detector worst; (c) declare that no demotion is available and the
  gate stays blocking regardless of rate, in which case Phase 2 closes with that
  recorded and Phase 1's numbers become monitoring rather than a decision input.
  The counter-argument to keep in view: the round-5 measurement — blocking
  carriers at zero violations, advisory carriers not — is the strongest single
  result in the enforcement estate, so a demotion trades a measured win for a
  measured cost and both numbers should be on the table.
- **Recommendation:** **option (a) — per-detector bars.** The three detectors have
  genuinely different legitimacy profiles: A fires on the agent's own promissory
  language, B on a language mismatch against a fresh pin, C on an edit with no
  verifier. A single shared bar (option b) would be set by whichever detector fires
  most and would either demote a detector that was working or protect one that was
  not. Option (c) is defensible on the round-5 evidence but forecloses the question
  permanently, and this roadmap's whole premise is that a blocking gate should carry
  a number.
- **If you do nothing:** the gate keeps refusing turn-ends at an unmeasured rate,
  and the estate keeps a blocking concern with no registered kill standard while
  every advisory around it has one. Phase 1's counts would accumulate with nothing
  authorised to act on them — measurement without a decision rule, which is the
  shape this roadmap was opened to fix.
- **Resolved when:** the bars, or option (c), are recorded at this blocker with
  their reasoning, and the record predates the first read of Phase 1 data.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Demoting a detector reintroduces the violations it closed | product | The measured origin of this gate is that advisory carriers achieved zero effect on exactly these violations while blocking carriers eliminated them; a demotion could re-open a class the estate already paid to close | Demotion is per-detector, evidence-cited and reversible; the round-5 numbers stay the baseline the advisory form is measured against, so a failed demotion is detectable rather than invisible | Phase 2 — Judge each detector |
| 2 | Widening the verify allowlist turns detector C into a rubber stamp | product | Every command added is a way to satisfy the gate without verifying anything; enough additions and the detector stops detecting | Each addition ships a fixture mapping command to verdict, and claim 4 already removed the pressure to add the obvious PHP commands because they match today | Phase 2 |
| 3 | Skipping concerns on retry loses a legitimate second-chance write | implementation | A concern skipped on the retry might have been the one that needed the second pass, and the loss would be silent | Per-concern opt-in with a stated argument, never a blanket skip; idempotence is verified per concern before its flag is flipped, and the artefact diff is the check | Phase 3 |
| 4 | The refusal counter's own cost lands on the slot it measures | implementation | Stop is already the heaviest slot; instrumenting it could make the thing it measures worse | The counter rides the existing session-register write and adds no spawn, which is why 1.1 specifies that carrier rather than a new one | Phase 1 — Count before judging |
| 5 | Pre-registration is quietly done after the data is seen | product | The bar is only meaningful if it predates the distribution; a bar chosen after looking is a description dressed as a decision | The blocker's resolution condition requires the record to predate the first read, and Phase 1 and the blocker are deliberately separable so the data can accumulate while the bar is being decided | Phase 2 |
| 6 | Attributing the refusals to 12.1 when the gate predates it | product | The gate was armed before the window the report blames, so a correlation with the install date could be read as causation and mis-route the whole investigation | Claim 10 is labelled a prediction rather than a claim, step 1.3 tests it as a split, and D-1 states the arming date's position relative to the window up front | Phase 1 |

## CUT list — do not re-litigate

- **Removing the gate.** The round-5 measurement is the strongest single result in
  the enforcement estate. This roadmap tunes; it does not repeal. Cut.
- **A settings kill-switch.** The argument that removed it stands: a default-off
  safety gate soaks nothing. Per-detector demotion by evidence replaces it. Cut.
- **Keying refusal state on prompt text.** Already tried and found wrong in three
  directions. The ordinal stays. Cut.

## Honest-null consequence

If Phase 1 shows refusal rates are negligible across all three detectors, this
roadmap closes as a null with the numbers published, and the "slow since 12.1"
investigation returns fully to the activation flip, the context size and the
environment — which is itself a decidable and valuable answer.
