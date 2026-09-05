---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []
# relates: manual sweep over agents/roadmaps/**/*.md on 2026-09-04 for
# `.agent-memory`, `attest_artifact`, `ADR-220` and `Carried to the` — none of
# the three items below is owned by an open roadmap or stub. ADR-094 and ADR-220
# are the records; neither has a receiver for its residue.
estate_offset_exempt: "Cannot be offset. Its three items are residue of decisions recorded in ADR-094 and ADR-220, neither of which has a receiver; the four active roadmaps at the floor own unrelated subjects and none of them can absorb a dead read path, an unwired primitive and two dangling promises without becoming a grab bag."
estate_growth_exempt: "Adds one active roadmap against a floor of 1. Its three items are the cheapest work in this change and the only ones an external reviewer named a closure test — a live tested read path into a file nothing writes, a primitive with zero importers at its fourth consecutive audit, and a promise with no receiver. Folding them into any of the three sibling roadmaps would hide small confirmed residue under a parser fix, a ledger, or a sweep. Parking them is what produced the fourth audit."
---
# Road to decided but not done

> **Source:** `agents/tmp.old/inbox-2026-09-e/` — an external multi-model review
> round on release 14.16.0. One reviewer made the first item a test of the whole
> system: *"Ein Findings-/Roadmap-System, das ein solches triviales bestätigtes <!-- md-language-check: ignore -->
> Residuum nicht entfernt, hat ein Priorisierungsproblem."* Each item below was <!-- md-language-check: ignore -->
> re-checked against `main@56aa348b3`.

## Goal

Three pieces of code and one promise that outlived the decisions that were
supposed to settle them each reach a terminal state: removed, wired, or annotated
with the reason they stay.

## Phase 1 — A read path into a file nothing writes

`docs/decisions/ADR-094-agent-memory-layer-removal.md` removed the agent-memory
layer. `src/scripts/_cli/explain_last/memory.ts:40` still resolves
`.agent-memory/hits.jsonl` as a live source, described in its own docblock
(`:14-17`) as *"optional sidecar produced by the memory-MCP integration"*.

A grep over the whole tree for anything that **writes** that path returns exactly
one hit, and it is a test fixture creating it so the reader can be exercised
(`tests/scripts/_cli/explain_last_build_trace.test.ts:82-91`). There is no
producer. The reader is live, tested, and reachable from `explain_last`.

- [x] **1.1 Remove the sidecar branch, or name its producer.** If a producer
      exists outside this tree, the docblock says which package and how a
      consumer gets it, and the branch stays. If none does — which is what the
      grep shows — the branch, its constant, and the fixture that keeps it green
      go together.
      verify: `grep -rn '\.agent-memory' src/ tests/` returns nothing, or every
      remaining hit names a real producer; `explain_last` still resolves the
      `memory` slot from `state.memory[]` and its tests pass.

      **DONE — removed; no producer exists.** The grep for a writer returns one
      hit and it is the fixture that kept the reader green
      (`explain_last_build_trace.test.ts:82-91` at the base commit). The
      docblock's claimed producer is the "memory-MCP integration", i.e. Layer 2,
      which `docs/decisions/ADR-094-agent-memory-layer-removal.md` removed on
      2026-06-14 — and whose *"Freeze Layer 2 (leave inert)"* alternative that
      ADR **rejected by name** at `:79-80` as *"a dormant integration surface
      advertising a capability the suite no longer has is misleading residue"*.
      So this is executing ADR-094's recorded decision, not reopening it, and no
      revisit route was owed.
      Removed together, because each one's last reference was the one above it:
      `MEMORY_SIDECAR`, `_from_sidecar`, `_splitlines` (called only by
      `_from_sidecar`), the `node:fs` and `node:path` imports, and `build()`'s
      `project_root` parameter with the `run_id` extraction that existed only to
      filter sidecar rows by run. `_coerce_entry`, `_coerceFloat` and `_pyTruthy`
      stay — the surviving `state.memory[]` path uses all three.
      **The ADR-200 parity claim was corrected, not deleted.** The docblock said
      *"same two sources [...] No behaviour changes"*, which this diff makes
      false; it now records that the coercion order and `float()` semantics still
      pin the historical contract while the second source does not, and why. No
      dated tombstone was left, per `minimal-safe-diff` § no tombstones.
      verify: RUN. `grep -rn '\.agent-memory' src/ tests/` returns exactly one
      hit, `src/scripts/_lib/bench_ab_scoring_v2.ts:56` — a `_NON_TASK_PREFIXES`
      entry in a scored-diff heuristic that excludes the directory from a diff,
      not a read path into `hits.jsonl`. It is pre-existing, on a different
      subject, and 1.2 forbids touching it. `memory.ts` retains no path hit; its
      one `agent-memory` occurrence is the ADR-094 **filename** at `:9`.
      12 tests pass in `explain_last_build_trace.test.ts` +
      `explain_last_sections.test.ts`, and `task typecheck-ts` exits 0.
- [x] **1.2 Do not widen it into a dead-code sweep.** This is one path with a
      recorded decision behind it. Other unreferenced code in the tree is
      pre-existing debt and stays, per
      [`minimal-safe-diff`](../../src/rules/minimal-safe-diff.md) § Own-orphan
      cleanup.
      verify: the diff touches `explain_last/memory.ts`, its test and its
      fixture, and nothing else.

      **DONE, and the two departures from "nothing else" are named rather than
      glossed.** Both are downstream of this exact change, which
      `downstream-changes` mandates — neither is a sweep:
      1. `src/scripts/_cli/explain_last/index.ts:147` — the sole call site.
         Dropping `build()`'s now-unused `project_root` parameter without
         updating its one caller would not compile.
      2. `tests/fixtures/explain_last/README.md:14` — described the
         `no-memory` fixture as *"no `.agent-memory/hits.jsonl` sidecar"*, a
         claim about a source that no longer exists. One clause removed.
      **Deliberately NOT touched, with the reason:**
      `src/scripts/_lib/bench_ab_scoring_v2.ts:56` (above) — removing an
      exclusion prefix would change scoring behaviour for any consumer that
      still has that directory, which is a different decision on a different
      subject. And the whole of `tests/fixtures/explain_last/`, which
      `git grep 'fixtures/explain_last' -- tests/ src/` shows is consumed by
      **nothing** since the Python test directory it names was deleted: that is
      exactly the pre-existing debt this step says stays.
      verify: RUN. The diff is 5 files — `memory.ts`, `index.ts`, the test, the
      fixture README, and this roadmap.

## Phase 2 — A primitive with zero importers, fourth audit

`src/scripts/attest_artifact.ts` (created 2026-08-26, `34dae8d2c`) is imported by
nothing except its own test — verified by grep over `src/`, `tests/`, `docs/`,
`scripts/`. ADR-220's `review_trigger` names two reopen conditions: a concretely
proposed transcript-scanning consumer with a named reader and decision, or a
first skill adopting `attest` in production with the line observed in a
transcript. **Neither has fired.**

An external audit series has carried this as its only open defect for four
consecutive rounds, and three consecutive inbox dispositions do not mention it.

- [x] **2.1 Annotate the state, with the census beside it.** The ADR gains one
      paragraph recording that the primitive exists, that its two reopen
      conditions are unfired, and the importer count with the command that
      produced it. An unannotated zero-importer primitive is indistinguishable
      from an oversight; an annotated one is a decision.
      verify: the ADR names the importer count, the date and the command, and
      `git log -1 --format=%ad -- src/scripts/attest_artifact.ts` matches the
      build date it states.

      **DONE — and the step's premise is FALSE in the same way 2.3's is: ADR-220
      is not this primitive's record, so the annotation does not belong there.**
      The script came from `road-to-skill-ecosystem-runtime-enforcement` Phase 5
      Steps 6-7 (`34dae8d2c`), on a different subject — artifact integrity for
      hook auto-injection. ADR-220 specifies an in-reply text line
      `[skill-attest] <skill-name>`; this hashed artifact files. A shared word,
      not a mechanism.
      **The annotation therefore went where the council placed it** — the
      blocker in the archived parent roadmap
      (`archive/road-to-skill-ecosystem-runtime-enforcement.md`, `blocker:
      plan-injection-decision`, § CORRECTION 2026-09-04) plus the removal
      commit. Both seats independently rejected a separate evidence artefact and
      a new ADR.
      **The census the step asks for is in that annotation**, measured
      immediately before deletion on `main@b75d7f7cb`: 0 importers outside its
      own test, 0 of 299 skills carrying `attest: true`, no `agent-config` verb
      (`git grep -i attest -- src/cli/ src/install/ src/shared/ src/server/` →
      0), no task/workflow/hook binding (2 hits, both the unrelated phrase
      *"self-attestation"* in a reviewer-manifest comment), no `gate-coverage`
      row, no `.attest.json` sidecar tracked or on disk. Build date
      `git log -1 --format=%ad --date=short -- src/scripts/attest_artifact.ts`
      → `2026-08-26`, matching `34dae8d2c`.
      **ADR-220 was deliberately left unedited** — see 2.2 for the 1-1 council
      split behind that.
      verify: RUN. The annotation carries the count, the date, each command, and
      the unfired state of both reopen conditions.
- [x] **2.2 Route wire-versus-remove, do not decide it here.** Removing a
      primitive an accepted ADR specifies is a change to that record;
      [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) sends
      it to the council, not to this file and not to the maintainer first. This
      step opens that route and records the outcome.
      verify: either a council round is recorded with its verdict, or the ADR
      states that the primitive stays unwired until a trigger fires, with the
      revisit condition restated.

      **DONE — routed, and it took two rounds because the FIRST QUESTION WAS
      DEFECTIVE.** Recorded rather than hidden: round 1's prompt framed the
      script as ADR-220 residue, which is false, and the executing agent wrote
      that premise. Round 2 re-asked on the corrected frame. That is a
      correction of a steered question, not verdict shopping — the round-1
      verdicts were themselves conditional on a reachability check that had not
      been run.

      **Round 1** — 2026-09-04, anthropic/claude-sonnet-4-5 +
      openai/codex-default, 2 rounds, quorum 2/2, no metered spend (both seats
      subscription transport). Split on timing only: sonnet **A/remove**
      conditioned on a reachability check; codex **B/hold** *"A is probably the
      eventual disposition, but the evidence presented supports B today"*, with
      the stated exit *"if all checks are negative, move from B to A"*. Both
      flagged the ADR-220 mechanism mismatch unprompted, and both held that
      removal would not amend ADR-220.

      **Round 2** — same seats, 2 rounds, quorum 2/2 concluded, no metered
      spend. **Converged, on the corrected frame:**
      1. **Remove both files.** Both seats.
      2. **The act is ENFORCEMENT of the standing 2026-08-25 2/2 ruling, not a
         new decision** needing fresh council authority. Both seats.
      3. **The record belongs in the archived roadmap blocker plus the removal
         commit** — explicitly **no new ADR and no separate evidence artefact**.
         Both seats, each rejecting the other's proposal for one.
      4. **Re-run reachability and check for generated sidecars immediately
         before deleting.** Both seats. Done; see 2.1.
      5. **Correct Steps 6-7 so they stop claiming delivery, preserving history
         rather than rewriting it.** Their `[x]` stands with a REVERTED note
         above each; the glyph was deliberately not flipped, since `[-]` is
         CANCELLED and owner-reserved and `[~]` requires a `carried-to=`
         receiver that does not exist.

      **Split 1-1, and resolved conservatively:** whether ADR-220 should carry a
      one-line note disclaiming this script. Sonnet for it (the conflation cost
      four audit rounds); codex against (naming the script there preserves the
      association the correction is meant to remove, and ADR-220 is not
      responsible for cataloguing unrelated mechanisms sharing a word). ADR-220
      is left unedited: it does not mention the script today, so the note would
      introduce that association into an accepted record for the first time.
      The disambiguation instead lives in the parent-roadmap blocker and here.

      **The reassessment condition both seats set was checked and NOT met.**
      Codex required inspecting the introducing commit's PR for evidence of an
      authorized reopening — *"if those reveal actual authority and reasoning,
      the decision must be reassessed"*. PR **#1657** contains no mention of the
      ruling, of reopening, or of Steps 6-7 in its body; its own automated
      review gate flagged the defect as **critical/blocking** at merge time
      (`874766e6afa0`, *"the guard has no consumer"*, and `0ebc6235a5f1`,
      *"the precondition deferred with the injection half"*) and the PR merged
      with that gate advisory rather than enforcing. So the PR evidences the
      contradiction being raised and not answered — the opposite of a
      reopening. Per codex, this is recorded as **"no documented reopening was
      found"** rather than as *unauthorized*: an absent record is not proof that
      no authority existed.
      verify: RUN. A council round is recorded with its verdict, above and in
      the parent-roadmap blocker, inlined rather than cited by runtime path.
- [x] **2.3 Correct the audit's unverified sub-claim.** The external series
      also asserts an unannotated contradiction between a *2026-08-25 ruling* and
      the 2026-08-26 build. A sweep over the archived parent roadmap and ADR-220
      found no such ruling; the claim is **unverifiable from this tree** rather
      than refuted. Record that, so the fifth audit meets an answer.
      verify: the annotation from 2.1 states what was searched and that the
      ruling was not found, naming the files searched.

      **DONE — and this step's premise is FALSE. The ruling exists, it was
      found, and the audit's sub-claim is REPRODUCED rather than refuted or
      unverifiable.** Recorded per the rule that a false premise is a legitimate
      outcome when the finding and its evidence are named.

      **Why the earlier sweep missed it: it searched the wrong parent.** This
      roadmap and ADR-220 both assume ADR-220 owns `attest_artifact.ts`. It does
      not. Commit `34dae8d2c` (2026-08-26T06:25:33+02:00,
      `feat: bounded-loop guards`) attributes the script to
      `road-to-skill-ecosystem-runtime-enforcement` **Phase 5, Steps 6-7** — a
      different roadmap on a different subject (artifact integrity for hook
      auto-injection, not skill-invocation attestation). Searching
      `road-to-judgment-and-forensic-evidence` for a 2026-08-25 ruling returns
      0 hits because the ruling was never going to be there.

      **The ruling, in the real parent.**
      `agents/roadmaps/archive/road-to-skill-ecosystem-runtime-enforcement.md:324-355`,
      `blocker: plan-injection-decision`:
      > **Status:** resolved 2026-08-25 — **(c): defer the whole injection half,
      > AND the attestation with it.** AI council **2/2**, and both seats
      > **overruled this blocker's own recommendation of (b)**.

      Option (b), which both seats rejected, was verbatim *"Mark the injection
      half out of scope and ship `src/scripts/attest_artifact.ts` plus
      `tests/scripts/attest_artifact.test.ts` on their own merit"* (`:361-363`).
      The recorded reason (`:329-338`): *"no protected artifact, no threat
      model, no consumer of the attestation result, and no required response to
      a failure"*; one seat, *"attestation is a mechanism without a subject."*
      And the consequence in as many words (`:345-347`):
      > Steps 1-5 land as a bounded **non-injecting** loop, and **Steps 6 and 7
      > land nothing.**

      **The contradiction is not merely next-day — it is INSIDE ONE COMMIT.**
      `7d19d885a` (2026-08-26T06:39:07+02:00,
      `feat(roadmap): close skill-ecosystem-runtime-enforcement`, a single
      372-line insertion) adds **both** of these to the same file:
      - `+- [x] **Step 6:** Add src/scripts/attest_artifact.ts ...`
        and `+- [x] **Step 7:** Add a test ...`
      - `+- **Status:** resolved 2026-08-25 — **(c): defer the whole injection
        half, AND` ... `+ ... Steps 6 and 7 land nothing.`

      The script itself landed 14 minutes earlier in `34dae8d2c`. So the record
      of the ruling and the marks claiming its forbidden steps were completed
      entered the tree together, contradicting each other within one file.
      Reproduce with:
      `git show 7d19d885a -- agents/roadmaps/archive/road-to-skill-ecosystem-runtime-enforcement.md`.

      **The ruling's `Revisit-if` (`:351-355`) has not fired**: no
      provenance-backed context-rot or artifact-tampering incident appears in
      the tree, and no design naming the protected artifact, the trust boundary,
      the attacker or failure mode, the attestation's consumer and the required
      response was found.

      The durable record of this finding follows 2.1/2.2's placement decision,
      which is the council's to make and not this file's.

## Phase 3 — A promise with no receiver

Two artefacts record a limitation as *"Carried to the follow-up"* /
*"Carried to the receiver"* — `tests/scripts/fixtures/git_auth_negation_corpus.ts:109-119`
and `agents/roadmaps/archive/road-to-binding-findings.md:278-282`. A sweep over
`agents/roadmaps/**` finds no receiver for either.

- [x] **3.1 Resolve these two.** `road-to-one-negation-vocabulary` Phase 3 owns
      the same promise from the corpus side; this step confirms the archived
      roadmap's restatement resolves to the same place or to a recorded decline.
      verify: both sites point at a named receiver or carry the acceptance, and
      neither says "carried" without one.

      **DONE — the receiver exists, is active, and owns the promise by
      file:line.** `agents/roadmaps/road-to-one-negation-vocabulary.md`
      (`status: ready`, NOT archived) Phase 3.1 at `:129-141` names both sites
      explicitly — the corpus row `git_auth_negation_corpus.ts:109-119` and the
      restatement at `archive/road-to-binding-findings.md:278-282` — and owns
      giving the limit *"a receiver or a recorded decline"*. The promise is
      owned; it is not dangling.
      **Edited here:** the archived restatement, which said *"Carried to the
      receiver."* with no receiver named. It now names
      `road-to-one-negation-vocabulary` Phase 3.1
      (`archive/road-to-binding-findings.md:281-286`). A roadmap citing a
      roadmap is allowed — `check_no_roadmap_refs` scopes to nine STABLE_TREES
      (`check_no_roadmap_refs.ts:47-56`) and `agents/roadmaps/` is not among
      them.
      **NOT edited here, deliberately:** the corpus row's own `why` field.
      Writing the receiver's name into that row **is**
      `road-to-one-negation-vocabulary` Phase 3.1, an open step in an active
      roadmap. Executing another live roadmap's open step from this one would
      leave its owner to find its work already done — the parallel-work hazard,
      not a discharge. This step's own text scopes it to *"confirm the archived
      roadmap's restatement resolves to the same place"*, which is what was done.
      verify: RUN. Site 2 names its receiver. Site 1 has a named owner that
      cites it by line, with the discharge open under that owner.
- [x] **3.2 Count the rest, and stop there.** Grep the tracked tree for the
      carried-to shape and report how many such promises exist and which resolve.
      The output is a count and a list — resolving all of them is not this
      roadmap's scope and would be the sweep Phase 1.2 refuses.
      verify: the census names the total and the unresolved subset; a zero is a
      real answer and is reported as one.

      **DONE — 8 promise sites, 7 resolved, 1 unresolved.** Census on
      `main@b75d7f7cb` via `git grep -i 'carried to the' -- .
      ':!agents/evidence/reviews/*.review-input/*'`. The exclusion drops frozen
      snapshots of other artefacts, which are copies rather than live promises.

      | # | Site | Receiver | State |
      |---|---|---|---|
      | 1 | `tests/scripts/fixtures/git_auth_negation_corpus.ts:116` | `road-to-one-negation-vocabulary` Phase 3.1 (active, open) | resolved — owned, discharge open |
      | 2 | `agents/roadmaps/archive/road-to-binding-findings.md:281` | same as #1 | resolved — **named by this change** |
      | 3 | `agents/evidence/analysis/agent-turnaround-2026-08-30.md:417` | none | **UNRESOLVED** |
      | 4 | `agents/roadmaps/archive/road-to-binding-findings.md:147` | `later/road-to-release-finding-ordering.md`, via `agents/evidence/release-findings/14.15.0.json:32` | resolved |
      | 5 | `archive/road-to-merge-op-split-and-negation-guard.md:327` | `stubs/road-to-merge-confirmation-doctrine.md`, named in-file at `:61`, `:316`, `:423` | resolved |
      | 6 | `archive/road-to-subagent-lifecycle-integrity.md:1035` | `stubs/road-to-do-not-touch-guard.md`, named in-file at `:48` | resolved |
      | 7 | `archive/road-to-ui-track-integrity.md:368` | `archive/road-to-ui-track-integrity-followup.md`, named at `:373` | resolved |
      | 8 | `src/skills/judge-injection-defense/fixtures/perturbation-taxonomy.json:7` | the judge-scored corpus, Phase 2 — named in place | resolved |

      Every receiver above was confirmed to **exist** as a file, not merely to
      be named: `agents/roadmaps/later/road-to-release-finding-ordering.md`,
      both `stubs/` targets and the `ui-track-integrity` follow-up all resolve.

      **The one unresolved: #3**, `agent-turnaround-2026-08-30.md:417`. Three
      rules (`ui-audit-gate`, `design-review-after-ui-write`,
      `roadmap-progress-sync`) install globally without `paths:`; the repair is
      a consumer-facing installer change that would silently narrow three rules'
      activation, so the measurement roadmap declined to make it and wrote
      *"Carried to the follow-up."* with no follow-up named. **Reported, not
      resolved** — resolving it is the sweep this step exists to refuse, and it
      is a live installer decision, not a dangling label.

      Excluded as non-promises, listed so the count is auditable: the 4 hits in
      this roadmap and 3 in `road-to-one-negation-vocabulary` (records *about*
      the promises), `inbox-2026-09-e-verification.md:131` (the same),
      `drain-supervised-telemetry.round3-review.md:25` (*"carried to the
      control"* — a fix not carried, a different sense),
      `archive/road-to-final-state-and-market-readiness.md:103` (*"carried to
      the Starlight site"* — content delivery, not deferral), and the
      `dist/agent-src/` projection of #8.
      verify: RUN. Total 8, unresolved 1, named above with its reason.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The sidecar has an out-of-tree producer nobody grepped for | implementation | The docblock names a "memory-MCP integration", and a grep over this repo cannot see a consumer's MCP server; deleting a reader something external feeds would break it silently | 1.1 makes naming the producer an equal outcome to removal, so the branch survives on evidence rather than on the absence of a grep hit | Phase 1 — A read path into a file nothing writes |
| 2 | Phase 2 is executed as a removal | product | The cheapest reading of "zero importers" is `git rm`, and the primitive is specified by an accepted ADR whose trigger has not fired — removal is a change to that record, not cleanup | 2.2 routes it to the council per the revisit gate and forbids deciding it in this file; 2.1's annotation is the deliverable either way | Phase 2 — A primitive with zero importers |
| 3 | The carried-to census turns into a resolution sweep | product | Finding N dangling promises invites closing all of them, which is scope creep against artefacts other roadmaps may own | 3.2 caps the output at a count and a list, and names resolving-all as out of scope | Phase 3 — A promise with no receiver |

## Acceptance Criteria

- [x] AC-1 — **Met.** No live code path reads `.agent-memory/hits.jsonl`; the
      branch, its constant and its fixture are gone. The one surviving
      `\.agent-memory` hit in `src/` is `bench_ab_scoring_v2.ts:56`, a
      diff-exclusion prefix, not a read path.
- [x] AC-2 — **Met, at a corrected address.** ADR-220 is not this primitive's
      record (2.1); the census — importer count, date, each command, and both
      reopen conditions unfired — is recorded in the parent roadmap's `blocker:
      plan-injection-decision`, where the council placed it.
- [x] AC-3 — **Met.** Two council rounds, 2/2 quorum each, verdict inlined at
      2.2 and in the blocker. The outcome is REMOVE, as enforcement of the
      standing 2026-08-25 2/2 ruling. Not decided in this roadmap.
- [x] AC-4 — **Met by refutation of its own premise.** The ruling was FOUND —
      `archive/road-to-skill-ecosystem-runtime-enforcement.md:324-355` — and the
      audit's sub-claim is REPRODUCED, not unverifiable. The earlier sweep
      searched the wrong parent roadmap. Full finding, with both commits, at
      2.3.
- [x] AC-5 — **Met.** Site 2 now names its receiver; site 1 is owned by
      `road-to-one-negation-vocabulary` Phase 3.1, which cites it by line. The
      census reports 8 promise sites, 7 resolved, 1 unresolved
      (`agent-turnaround-2026-08-30.md:417`), reported rather than swept.
