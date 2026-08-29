<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-10-15
relates:
  - slug: road-to-runtime-governance-flip
    relation: depends
    note: "every step here is a Class-B resident process under ADR-124:111 until that roadmap's Phase 1 ADR lands"
  - slug: road-to-experience-loop-broadening
    relation: extends
    note: "owns the 0.27% capture figure and names a collector as the missing writer; this file is that collector"
depends:
  - road-to-runtime-governance-flip
# relates: the governance roadmap is a HARD dependency — every step here is a
# Class-B resident process under ADR-124:111 and cannot begin until that
# roadmap's Phase 1 ADR exists. experience-loop-broadening:108 owns the 0.27 %
# dispatch-capture figure and names "a collector" as the missing writer; this
# file is that collector, split out of the governance roadmap on council
# instruction so the two have separate completion conditions.
estate_growth_exempt: "AMENDED 2026-08-29 — this change charges +1 open_blockers (29 to 30): the `lifecycle-ci-runner-provisioning` blocker added below. It is the AI council verdict of 2026-08-29 executed, not a discretionary addition. Both seats (2/2) chose option B — leave active, flip draft to ready — on the ground that the execution frontier is Phase 2 and Phase 2 is externally blocked by nothing; and BOTH seats independently required the missing CI capability to be named as an explicit dependency NOW rather than discovered when the frontier reaches Phase 5, openai because 'missing' and 'externally blocked' are not the same classification and the choice must be made before it is load-bearing. The flip without the blocker would have been half the verdict. Phase 1 closed 3/28 in the same change, including the supported-platform list AC-1 required and that did not exist. ORIGINAL CLAIM, still standing: Charges +1 on one-in-one-out and +0 on the count half (status: draft). Warranted on a council instruction rather than an opinion: both seats (2/2, deep pass, 2026-08-27) required the telemetry delivery to either move fully into the governance roadmap with its own acceptance criteria or become a formally related dependency with its own — and named the concrete failure of leaving it folded, that two roadmaps would share ownership of one rollback with no answer to which closes when measurement is inconclusive. Draft rather than ready because three architecture decisions below are undecided, and the owner decision that authorises runtime does not make them."
estate_offset_exempt: "The offset is the governance roadmap flipping ready to draft in this same change, which removes it from the active count — this file replaces it there rather than adding beside it. No archive move is available."
---
# Road to a supervised telemetry collector — the first resident process, and the eight things the owner decision does not decide

> **Source:** split out of `road-to-runtime-governance-flip.md` on 2026-08-27
> after a deep council pass (2/2, both seats "not ready"). The originating
> analysis is `agents/tmp.old/uncle-bob-swarm/`; the durable record of the owner
> decision and the surface census is
> `agents/evidence/analysis/runtime-reversal-owner-decision.md`.

> **Hard dependency — DISCHARGED 2026-08-27.** `road-to-runtime-governance-flip.md`
> Phase 1 landed and that roadmap is closed. **ADR-249** supersedes `ADR-124:111`
> in scope — a supervised resident process is permitted in core — and also amends
> `ADR-109:28`'s "no daemon" clause, which this note did not name and which would
> have blocked the collector on its own. Both targets carry the reciprocal
> `superseded_by` + `superseded_scope`.
>
> **What the discharge does NOT hand over.** Three obligations arrive with it,
> and each is a condition on the collector rather than a permission:
>
> 1. **The four governance conditions** in
>    `docs/contracts/resident-process-governance.md` (class **P1**) — supervised,
>    scoped writes, stoppable, claim-consistent. A process missing any one is
>    class **P2** and still prohibited.
> 2. **The same-revision activation guard.** A council found the
>    documentation-ordering rule *necessary but not sufficient*: removing a public
>    absence claim does not stop an **older** revision from activating a process.
>    That guard does not exist yet and is this roadmap's to build — it is
>    governance condition 4, and ADR-249 records it here rather than leaving it to
>    whichever change ships first.
> 3. **The lifecycle evidence contract.** `check_supervision_claim_atomicity`
>    already refuses any present-tense supervision claim on a public surface
>    unless `internal/reports/supervision-lifecycle.json` names a suite, records
>    THIS revision, sets `processes_exercised: true`, and ran more cases than it
>    skipped. The successor claim
>    `resident-process-permitted-under-governance` sits at `status: unbacked` in
>    `docs/CLAIMS.md` and may not be markered in public prose until that evidence
>    exists. Producing it is what closes this roadmap.
>
> Nothing here is buildable while its own blockers stand; the *governance*
> blocker is no longer one of them.

## Why this is its own file

The governance roadmap carried the collector as its Phase 5. Both council seats
rejected that, and the argument that decided it is not about tidiness: the two
deliverables have **incompatible completion conditions**. Governance closes when
documents say what is true — a same-day check. The collector closes when a
representative observation window has passed, which is days or weeks, and a
phase checkpoint cannot wait on production data. Folded together, one roadmap
owned two rollbacks and had no answer to which status changes when the
measurement comes back inconclusive.

The second argument is narrower and sharper. The owner decision authorises
*having* runtime. It decides nothing about supervision mechanism, platform
scope, privilege model, uniqueness namespace, installation, activation, upgrade,
or what a collector may store. Those are eight architecture questions, three of
them blockers below. A roadmap that presented them as steps would have been
claiming a mandate it does not have.

## Goal

One resident process runs on this machine under a named supervisor, on named
platforms, storing a schema whose fields are individually justified, with a
predefined kill switch and rollback trigger matrix — and the dispatch-capture
rate that justified it has been measured over a declared observation window
against a target recorded beforehand. If the target is missed, the collector
stays default-off and the shortfall is recorded. Static operation continues to
work, and a test proves it.

## The debt this pays

`road-to-experience-loop-broadening.md:108` records the measurement: **370
dispatches, 1 recorded line, 0.27 % capture**, and names "a collector" as the
missing writer. That roadmap could not build one while `ADR-124:111` stood. This
one can, once governance Phase 1 lands — and it is the only justification on
file for a resident process, which is why Phase 6 refuses to close on a running
daemon alone.

## What "supervised" has to mean before the word is used publicly

The governance roadmap's first draft verified supervision as "state survives
SIGKILL, second instance refuses to start". A council seat named that correctly:
those are **persistence** and **exclusivity**. Neither is supervision. The five
properties below are the contract, and `SIGKILL` is itself Unix-specific — which
is why platform scope is a blocker rather than an assumption.

1. Death is detected by the supervisor, not by the next invocation.
2. Restart happens within a stated bound.
3. A stale owner record is fenced on restart.
4. Graceful shutdown leaves no orphan.
5. Exactly one collector is live after every transition — within a **declared
   namespace** (blocker below).

## Precondition — the resident-process floors

`docs/contracts/resident-process-floors.md` is a **precondition** of everything
below, not a restatement of it. It landed first, deliberately, so this file
inherits the bounds rather than inventing them: a floor written after the
process it bounds is a description of that process.

Three things it owns and this roadmap therefore does not:

- **The observation-only contract** (§ 1) — a resident module reads static,
  versioned configuration on the dispatch path and nothing else, and its
  falsifiable form is *if the module were killed, every dispatch would resolve
  identically*. This collector is an observer by construction; the contract is
  what makes that checkable rather than asserted.
- **The daemon anti-pattern checklist** (§ 2) — five questions, answered below.
- **The fail-closed delivery ladder** (§ 3) — what happens to an obligation
  whose runtime carrier is not running.

### The five checklist answers

Answered here because § 2 requires them answered or named open; two are open and
say so rather than being guessed.

| # | Question | Answer |
|---|---|---|
| 1 | Failure mode when it is not running | Static mode. Dispatch capture falls back to the current hook-carried path; capture rate drops to the measured static baseline and nothing else changes. Phase 4.2 proves the unregressed claim rather than asserting it. |
| 2 | What it does to a dispatch it cannot serve | Nothing — it degrades to the no-collector path. A dispatch is never blocked, delayed past its budget, or altered. This is § 1's boundary applied to the one case that would break it. |
| 3 | State on an unclean stop | **Open** — carried by `blocker: supervisor-mechanism-and-platform-scope`, because fencing a stale owner record (supervision property 3) is a property of the chosen supervisor, not of this collector. Phase 5.1 tests it on real processes once the mechanism is chosen. |
| 4 | Supervisor and privileges | **Open** — the same blocker. The floor's requirement is that the answer be *named*, and the blocker names it as undecided with three costed options rather than defaulting to one. |
| 5 | Uniqueness namespace across concurrent checkouts | **Open** — carried by `blocker: uniqueness-namespace`. Worktrees make concurrent checkouts the common case in this repository, which is why it is a blocker and not an assumption. |

Three open answers is a legitimate state for a `draft` roadmap and an illegitimate
one for a design note under review: § 2's rule is that unanswered is
*unreviewable*, so the three blockers below are what stand between this file and
`ready`.

## Phase 1 — Decide the architecture before writing the schema

> **Lifecycle disposition, AI council 2026-08-29 (anthropic + openai, 2/2
> convergent on B).** Asked, in a fully autonomous run with no user available,
> which honest lifecycle state this roadmap should be left in given that Phases
> 2–6 remain and Phase 6.1 is a 21-day observation window no run can compress.
> Options were park in `later/` (A), leave active and flip to `ready` (B), split
> (C), leave as-is (D), plus cancel and weaken named as owner-reserved and not
> taken.
>
> **Verdict B.** The load-bearing sub-question — whether repo rule 12's "ALWAYS
> moved to `later/`" binds when *some* open work is externally blocked and some
> is not — was answered the same way by both seats: it binds on the **execution
> frontier**, not on eventual closability. openai's test: *"Is there an
> authorized, dependency-valid next step that materially advances the roadmap
> now?"* Here it is Phase 2, which no external dependency touches, so the
> roadmap stays active. anthropic sharpened it against the obvious abuse:
> the question is whether the available work is *closure-meaningful*, not merely
> whether some next step exists.
>
> **`revisit-if`, converged:** this file moves to `later/` when the execution
> frontier itself reaches an external dependency — i.e. when Phases 2–4 are
> done and the only remaining work is CI provisioning or the observation window
> — or immediately if CI provisioning turns out to be owner-reserved.


- [x] **1.1 Resolve the three blockers.** Supervisor mechanism and platform
      scope, uniqueness namespace, activation model. Every later phase reads
      their answers; none can be inferred from the owner decision.
      verify: each of the three blocker sections carries a `Status:` starting with `resolved` and names the chosen option.

      **Closed 2026-08-29, after repairing one of them.** All three carried
      `Status: resolved` naming a chosen option — (a)-narrowed-to-user-scoped,
      (b) one collector per OS user, (b) install-registers-activates-on-use.
      But `supervisor-mechanism-and-platform-scope` **failed its own
      `Resolved when`**: the supported platform list was not named anywhere in
      the file, and AC-1 requires it written down. A blocker reading `resolved`
      with an unmet resolution condition is the silent-green failure this
      roadmap's § 4 warns about in a different register, so it was repaired
      rather than flipped over. The list is now in that blocker as a table, with
      Windows recorded as **unevaluated** rather than refused.
- [x] **1.2 Write the metric definition first, not the collector.** The
      denominator, what counts as an eligible dispatch, exclusions,
      deduplication, how startup failures and opt-outs are treated, the minimum
      sample, the observation window, and the decision rule. Without these,
      "capture rate" is not a measurable quantity and the target in 1.3 is
      unfalsifiable.
      verify: the definition names all nine and a second reader can compute the current rate from it without asking a question.

      **Definition — capture rate, committed 2026-08-29, before any collector
      code.** Nine answers, numbered to the nine the step asks for.

      1. **Denominator.** The count of **eligible dispatches** (below) that
         occurred on a machine during the observation window, as counted by the
         dispatcher itself at the point of dispatch — not by the collector.
         The denominator must be produced by a writer that cannot fail in the
         same way the numerator does; a collector counting its own opportunities
         is the failure `road-to-journal-host-capture-measurement` exists for.
      2. **Eligible dispatch.** One invocation of the hook dispatcher that
         (i) resolved a bound concern for its (platform, event) cell, and
         (ii) ran to a terminal state. A dispatch with no bound concern is not
         an opportunity to capture and is **not** in the denominator — counting
         it would understate capture by counting cells nobody wired.
      3. **Exclusions.** Four, each excluded because it is not a capture
         opportunity rather than because it is inconvenient: dispatches in the
         package's **own** test suite and CI (self-observation); dispatches on a
         machine whose collector is **not installed** (no supervisor to capture
         — those belong to the static-mode figure and are reported separately);
         dispatches during a **declared migration window** from 2.4; and
         dispatches on an **opted-out** machine (see 6).
      4. **Deduplication.** Records are keyed by
         `(machine_id, episode_id, event, sequence)`. A repeated key is one
         record, not two — retry after a failed write must not inflate the
         numerator. Deduplication happens at read time over the store, never at
         write time, so a duplicate is observable as a defect rather than
         silently collapsed.
      5. **Startup failures.** A collector that fails to start is **in the
         denominator and not in the numerator** — it is a missed capture, which
         is precisely what the metric is for. It is additionally recorded as a
         separate `startup_failure` count, because a 40 % rate made of startup
         failures and a 40 % rate made of write losses call for different fixes
         and the single ratio cannot distinguish them.
      6. **Opt-outs.** An opted-out machine is excluded from **both** numerator
         and denominator, and its exclusion is counted. Opt-out prevents the
         write (2.3), so including it in the denominator would report a consent
         choice as a technical failure. The opted-out share is published beside
         the rate: a 95 % capture rate over 5 % of machines is a different claim
         from 95 % over 90 %, and a reader who cannot see the second number
         cannot tell them apart.
      7. **Minimum sample.** **≥ 2,000 eligible dispatches** across **≥ 5
         distinct machines**, with no single machine contributing more than
         **40 %** of the denominator. The machine floor and the concentration
         cap exist because one developer's laptop can produce 2,000 dispatches
         in a week, and a rate measured on one machine measures that machine's
         supervisor, not the population's.
      8. **Observation window.** **21 consecutive days**, starting the day the
         collector is first enabled on the second machine. Not "until the sample
         is reached": a window that ends when the number is good is a stopping
         rule, not a window. If the minimum sample is not met at 21 days, the
         window extends in whole 7-day increments to a **hard stop at 63 days**,
         at which point an unmet sample is reported as unmet and 6.3 applies.
      9. **Decision rule.** Capture rate = numerator ÷ denominator, both as
         defined above, reported with a **95 % Wilson score interval**. The
         target in 1.3 is met when the **lower bound** of that interval is at or
         above the target — not the point estimate. A point estimate that clears
         a target on a sample whose interval straddles it has not cleared it,
         and this rule is written before the number exists so it cannot be
         chosen after.

      **A second reader can compute the current rate from this without asking a
      question**, and the honest answer today is that they cannot compute it at
      all: no denominator writer exists yet (item 1), which is Phase 4 work.
      That is a statement about the instrument, not a gap in the definition.
- [x] **1.3 Record the target before anything is built.** A number, with the
      window it is measured over, committed in this file.
      verify: the target and window appear in this roadmap in a commit that precedes the first collector commit — by commit order, not by assertion.

      **Target — committed 2026-08-29, before any collector code exists.**

      > **≥ 90 % capture**, read as the **lower bound** of the 95 % Wilson
      > interval per 1.2 item 9, over the **21-day window** and **≥ 2,000
      > eligible dispatches across ≥ 5 machines** of 1.2 items 7–8.

      **Why 90 and not 95.** The sibling figure this roadmap exists to move is
      **0.27 % (370 dispatches, 1 recorded line)**, recorded verbatim at
      `docs/CLAIMS.md:328`. `road-to-experience-loop-broadening.md:118-120`
      pre-registers **≥ 95 %** for the *dispatch event* spike — a different
      measurement on a different mechanism (in-process capture with no
      supervisor), and its 164/164 skill-event comparator sets that bar. A
      supervised out-of-process collector adds failure modes the in-process path
      does not have — startup failure, orphaning, crash-loop, the static
      fallback rows of the platform table — and 90 % is the honest allowance for
      them. It is set **below** the sibling deliberately, and the gap is named
      here so a later reader cannot mistake it for the same target.

      **What the target does not buy.** Meeting it is one of the six readings in
      6.2, not the flip. 6.3's "the figure moved is not a result" applies to this
      number too: 0.27 % → 90 % is the claim, and anything short of the interval
      lower bound is a miss, not a partial success.

## Phase 2 — The data contract, field by field

- [x] **2.1 Build the schema as an allowlist with per-field purpose.** "No
      free-form field" is necessary and **not sufficient** — a council seat
      listed the leaks structured fields still carry: repository and worktree
      identifiers, command names and arguments, error enums with interpolated
      values, hashes stable enough to identify a user or repo, timestamps
      combined with a machine identifier. Every field states its purpose, its
      cardinality limit, and why a coarser form does not suffice.
      verify: DONE — `src/scripts/_lib/collector_record.ts`. Nine fields, each carrying all three lines in `FIELD_PURPOSE`: purpose, cardinality limit, and why a coarser form does not suffice. `ALLOWED_FIELDS` is DERIVED from `FIELD_PURPOSE` rather than hand-listed, and a test asserts the allowlist equals the record's own keys — so a field cannot be added without stating its purpose, which is the property that makes the contract self-enforcing rather than aspirational. `validateRecord` reports an unknown key as `unknown field '<name>' — REJECTED, not dropped`, and a test asserts that exact wording per leak class. Dropping is refused on purpose: a producer whose extra field is silently discarded has been told the field is fine, and the leak then lives upstream where this schema cannot see it. Each of the five council-named leak classes is answered by CONSTRUCTION and the answer is written in the module's own table — no field can hold a path, a repo name, a branch or a command; `event`, `outcome` and `platform` are closed enums carrying no payload, so an interpolated error message has nowhere to ride; `machine_id`/`episode_id` are required to be locally generated random UUIDs, because a hash of a host fact is a pseudonym for that fact and is re-identifiable by anyone holding the same inputs; and `occurred_on` is a UTC calendar DATE, since a per-second timestamp beside a stable machine id reconstructs working hours, session lengths and idle gaps. 35 tests green, `tsc --noEmit` clean.
- [x] **2.2 Test the privacy boundary with fixtures, not with a rule.** Named
      serialization fixtures for the leak classes in 2.1, each asserting the
      record cannot carry it.
      verify: DONE — `tests/scripts/collector_record.test.ts`, and the sensitivity half was OBSERVED rather than argued. `LEAK_FIXTURES` is a named table of six: repository/worktree identifier (`repo_path`), branch name, command name and arguments, error enum with an interpolated value, a hash stable enough to identify a user or repo, and a free-form escape hatch (`extra`). Each fixture asserts both that the record refuses the field and that it says `REJECTED, not dropped`. The timestamp class gets its OWN block because it differs in kind — the field is legitimate and required, and it is its RESOLUTION that leaks, so it is a value constraint rather than a field ban; a precise ISO timestamp and a smuggled unix epoch are both refused. Identifier derivation gets a third block: a sha256 and a hostname are both refused as `machine_id`. **Sensitivity probe, run and reversed:** admitting a single leak field (`repo_path`) to `FIELD_PURPOSE` reds **5 of the 35 tests**, including that class's own fixture and the allowlist-equals-record-keys assertion — so the fixtures are enforcing, not decorating. Restored and re-verified: 35 green, `tsc --noEmit` clean. Each fixture additionally carries a `removing_this_constraint_reds_it` line naming the exact edit that would turn it green, so the sensitivity claim is written down per class instead of asserted once for the suite.
- [x] **2.3 Implement deletion and opt-out, then test them.** AC-7 of the
      governance roadmap's first draft required these to be *documented*. A
      documented deletion path that nobody executed is a claim.
      verify: DONE — `src/scripts/_lib/collector_store.ts` + `tests/scripts/collector_store.test.ts`. Both clauses are driven against the real store on a temp user root; nothing is mocked, because a mocked deletion is a documented deletion with extra steps.

      **Deletion.** `deleteMachine` is the supported path and returns how many
      records it removed. The test writes 4 records for one machine and 1 for a
      second, deletes the first, and asserts through **both** query shapes —
      `readRecords(handle, machineId)` and `readRecords(handle)` with no filter
      — because "gone" has to mean gone from the store and not merely absent
      from the one query that happened to filter it. Deletion is BY MACHINE and
      nothing coarser is offered: `machine_id` is the only identity a record
      carries, so a "delete everything" verb would make a targeted Art. 17
      request impossible to serve honestly.

      **Opt-out prevents the WRITE.** The step's wording is an architectural
      requirement, not a phrasing preference, so the assertion is the one that
      can tell the two apart: after a refused write the **row count is
      unchanged** (`SELECT COUNT(*)` = 0), which a read filter cannot achieve.
      `writeRecord` refuses before touching SQLite and returns
      `refusal: 'opted-out'`; the check lives INSIDE `writeRecord` rather than
      at the call site, and a test pins that by making the identical one-argument
      call refuse or write purely on the marker's presence — a consent check a
      caller can forget is a consent check that will be forgotten. The marker is
      a FILE under the store directory, not a settings key, and therefore
      reachable without the package running: the same property 3.3's kill switch
      needs.

      **Sensitivity, observed rather than argued.** Moving the opt-out check out
      of `writeRecord` into a filter inside `readRecords` reds **3 of 14** tests,
      including the row-count assertion; making `deleteMachine` a no-op that
      still returns the count reds **2 of 14**. Both reverted from an explicit
      backup and re-verified at 14/14.
- [x] **2.4 Write the upgrade and schema-rollback contract.** Forward and
      backward compatibility, what an older package does when it meets newer
      records, whether a rollback migrates or quarantines, what uninstall
      removes, and recovery after a crash mid-migration.
      verify: DONE — five transitions, five named tests, each driven over a store seeded to the state it tests. `tests/scripts/collector_store.test.ts` § *2.4 — the five upgrade transitions*.

      | # | Transition | Contract | Test |
      |---|---|---|---|
      | 1 | Fresh store | created at `COLLECTOR_SCHEMA_VERSION`, `quarantined: false` | *TRANSITION 1 — a fresh store is created at the current schema version* |
      | 2 | **Backward** compat — older records, newer package | migrated forward inside a marked window; records survive; the marker does not outlive a success | *TRANSITION 2 — an OLDER store is migrated forward and its records survive* |
      | 3 | **Forward** compat — newer records, older package | **QUARANTINED**: renamed, never read, never rewritten. Writes refuse with `schema-quarantined`, reads return nothing, and the moved file's BYTES are asserted equal to what the newer revision wrote | *TRANSITION 3 — a NEWER store is quarantined, never read and never rewritten* |
      | 4 | Crash mid-migration | the marker survives the crash, so the next open quarantines rather than resuming a migration whose progress nothing recorded — and leaves a WORKING store, not a wedge | *TRANSITION 4 — a crash mid-migration quarantines rather than resuming* |
      | 5 | Uninstall | removes the database, its WAL sidecars and the markers; **KEEPS** the quarantine directory | *TRANSITION 5 — uninstall removes the store and the markers, and KEEPS the quarantine* |

      **Three decisions inside that table are decisions and are recorded as
      such.** (a) A rollback **quarantines rather than migrates** — reading a
      record shape you do not understand is how a field gets silently dropped,
      and dropping is what this schema refuses; it also matches the row 3.1's
      matrix already owes for incompatible schemas. (b) The crash marker is
      checked **before** the version stamp is read, because a half-migrated
      store's stamp cannot be trusted to say which half it is in. (c) Uninstall
      keeps the quarantine because a quarantined store is the *record of an
      incompatible-schema event*, and uninstall is not the moment to destroy
      evidence about one.

      A sixth test covers the growth budget the quarantine directory would
      otherwise have none of: the quarantine filename carries a **content
      digest** rather than a timestamp, so repeated incompatible opens of the
      same bytes are idempotent instead of unbounded — R-A7 applied to a
      directory nobody prunes.

      **Sensitivity:** reading a newer store instead of quarantining it reds
      **3 of 14**; checking the crash marker after the version instead of before
      reds **1 of 14** — the transition-4 test alone, which is the targeted
      result rather than a blanket break. Both reverted and re-verified at 14/14.

## Phase 3 — The operational contract

- [x] **3.1 Write the rollback trigger matrix.** Each trigger names its
      activation mechanism, its owner, its recovery procedure, and its test.
      The minimum set, from the council: privacy-contract violation (immediate
      disable and quarantine) · orphan or duplicate collector (disable
      activation) · crash-loop threshold exceeded (bounded retries, then static
      fallback) · CPU, memory or disk budget exceeded (stop) · incompatible
      schema or failed migration (preserve without reading or rewriting) ·
      static-mode regression (block release) · lifecycle-suite failure on any
      supported platform (prohibit the public capability claim).
      verify: DONE — seven rows below, every one carrying all four columns and a named test. No row has an empty test column.

      **The matrix, committed 2026-08-29.** Seven rows — the council's minimum
      set, none dropped and none added. Every row carries all four columns.

      **What the "Test" column is and is not.** The step's `verify:` asks for a
      test *named* per row, and a name is not coverage. So each row's test
      carries its state explicitly — `EXISTS` with the file, or `OWED BY <step>`
      — because a matrix whose test column reads like seven green checks when
      four of them are future work is the "presence check masquerading as proof"
      that step 5.2 exists to prevent, one section earlier. Three of the seven
      are enforced today; four are owed by the steps that build what they test,
      and they are owed by name rather than by hope.

      | # | Trigger | Activation mechanism | Owner | Recovery procedure | Test |
      |---|---|---|---|---|---|
      | 1 | **Privacy-contract violation** — a record reaches the store carrying a field the schema does not allow | `validateRecord` returns `ok: false` at the write boundary; `writeRecord` refuses with `refusal: 'invalid-record'` and surfaces every error. The violation is a REFUSAL, never a drop | maintainer | Immediate disable (`optOut`, which prevents the write and needs no running collector) + `quarantine()` of the store, preserved unread; then `deleteMachine` for any affected machine id | **EXISTS** — `tests/scripts/collector_record.test.ts` (six named leak-class fixtures, each with its `removing_this_constraint_reds_it` line) + `tests/scripts/collector_store.test.ts` § *refuses an invalid record with its errors rather than silently dropping it* |
      | 2 | **Orphan or duplicate collector** — more than one live collector inside the declared namespace (one per OS user, `uniqueness-namespace` (b)) | Per-user runtime lock in the user runtime directory; a second acquirer fails to take it and exits rather than proceeding | maintainer | Disable activation (the `activation-and-installation-model` (b) answer makes starting an explicit action, so activation is revocable without uninstalling); fence the stale owner record on the next start | **OWED BY 5.1** — the fencing and exactly-one-live property are process facts and a mocked assertion proves neither; 5.1's suite spawns real processes. Named, not written |
      | 3 | **Crash-loop threshold exceeded** | Supervisor restart counter crossing its bound within a window; the bound belongs to the supervisor chosen in `supervisor-mechanism-and-platform-scope` | maintainer | Bounded retries, then **static fallback** — the no-collector dispatch path, which is the documented degradation and not an outage. `resident-process-floors` § 3 owns the ladder | **OWED BY 5.1** — a restart counter is only observable across real process deaths |
      | 4 | **CPU, memory, disk or file-descriptor budget exceeded** | Per-resource ceiling from 3.2 crossed, measured against the headroom-at-peak that step records | maintainer | Stop the collector (not throttle it): an observer that has become a load is no longer an observer, and § 1's falsifiable form — *if the module were killed, every dispatch would resolve identically* — is what makes stopping safe | **OWED BY 3.2** — that step's own `verify:` is *"a test asserts the collector is stopped when each is exceeded"*, so the test is that step's deliverable and this row must not pre-claim it |
      | 5 | **Incompatible schema or failed migration** | `openCollectorStore` reads `user_version`; a value ABOVE this revision's, or an in-flight migration marker surviving a crash, both route to `quarantine()` | maintainer | **Preserve without reading or rewriting** — a rename, never a read and never a migration; a fresh store is created beside it and the moved file's bytes are asserted unchanged. `uninstall` deliberately keeps the quarantine directory: it is evidence about the event | **EXISTS** — `tests/scripts/collector_store.test.ts` § TRANSITION 3 (newer store: not read, not written, bytes preserved) and § TRANSITION 4 (crash mid-migration quarantines rather than resuming). Both probed red |
      | 6 | **Static-mode regression** | The existing suite diverging between collector-absent and collector-present-but-off | maintainer | **Block release.** Not a rollback of the collector but a refusal to ship: static operation is the Goal's own floor, and a regression there means the observer changed the observed | **OWED BY 4.2** — that step compares the two runs rather than declaring each green, and the comparison IS the test. Cannot exist before the collector does |
      | 7 | **Lifecycle-suite failure on any supported platform** | The 5.1 suite red, or **skipped**, on a platform the platform table declares supported — AC-8 makes a skip a failure on that platform rather than an absence | maintainer | **Prohibit the public capability claim.** `check_supervision_claim_atomicity` already refuses a present-tense supervision claim without a lifecycle record for THIS revision, so the prohibition is mechanical rather than remembered. Per the `lifecycle-ci-runner-provisioning` (b) verdict the unverified platform row stays excluded from release claims **even if its static fallback appears to work** | **OWED BY 5.2** — that step's `verify:` requires the check to red against a deliberately emptied suite and against a result from a different revision, two seeded negatives, both observed |

      **Row 4's owner column is the one worth arguing about, and it is not
      argued away.** Every row reads `maintainer`, which looks like a column
      that says nothing. It is the honest entry: this package has one
      maintainer, no on-call rotation, and no second party a trigger could page.
      Writing a team name into six of seven rows would have made the column look
      informative while naming nobody who exists. What the column will carry
      once there is someone else to name is a `revisit-if`, not a placeholder.

- [ ] **3.2 Set resource budgets as numbers.** CPU, resident memory, disk
      footprint, and file-descriptor count, each with the ceiling and the
      headroom at expected peak. An unquantified ceiling is not headroom.
      verify: the budgets are recorded and a test asserts the collector is stopped when each is exceeded.
- [ ] **3.3 Define the kill switch and who may pull it.** One mechanism,
      reachable without the collector's cooperation, documented where an
      operator will find it under pressure rather than in this roadmap.
      verify: a test kills a wedged collector through the documented mechanism with the process unresponsive to graceful shutdown.
- [ ] **3.4 Define static mode and daemon mode against the same tree.** Whether
      both may run concurrently, and if not, what prevents it. Left undefined
      this is duplicate capture and version skew.
      verify: a test asserts the declared behaviour — either concurrent operation is correct and proven, or it is prevented and the prevention is proven.

## Phase 4 — Implement, default-off

- [ ] **4.1 Build the collector against the contracts above.** Default-off, and
      default-off is a tested property rather than a config line nobody
      exercised.
      verify: a fresh install runs the full test suite with no collector process started, asserted by process enumeration rather than by reading the setting.
- [ ] **4.2 Prove static operation is unregressed.** The Goal of the governance
      roadmap says static operation still works. Nothing tested it.
      verify: the existing suite passes with the collector absent AND with it present-but-off, and the two results are compared rather than each declared green.

## Phase 5 — Prove the five lifecycle properties on real processes

> **DEPENDENCY, named 2026-08-29 on AI council instruction (2/2).** This phase
> requires process-level tests executing in CI on **both** supported platform
> rows — macOS and Linux-with-a-user-session-bus — and AC-8 makes a skip on
> either a failure on that platform rather than an absence. **That CI capability
> does not exist in this repository today.** Both council seats required this to
> be visible here rather than discoverable when the frontier arrives: openai
> because *"missing and externally blocked are not automatically the same
> thing"* and the classification must be made before it is load-bearing;
> anthropic because leaving it implicit is optimism bias with a schedule
> attached. Tracked as `blocker: lifecycle-ci-runner-provisioning`.


- [ ] **5.1 Test each of the five properties as a process-level test.** Mocks
      do not establish orphan behaviour, signal handling, or file locking.
      verify: the suite spawns real processes, runs on every platform the blocker declared supported, and CI executes it on each — a suite that skips on a platform is a failure on that platform, not an absence.
- [ ] **5.2 Make the evidence protocol explicit, so a presence check cannot
      masquerade as proof.** The governance roadmap's atomicity check asks
      whether this suite is green. That check must establish that the named
      suite exists, ran on the same revision, exercised real processes, and was
      not empty or skipped.
      verify: the check reds against a deliberately emptied suite and against a suite result from a different revision — two seeded negatives, both observed.

## Phase 6 — Measure, then decide

- [ ] **6.1 Observe over the declared window.** Not a checkpoint that completes
      when the code lands. The window from 1.2, the minimum sample from 1.2.
      verify: the recorded observation states its window and sample and both meet the 1.2 definition.
- [ ] **6.2 Apply the full enablement gate, not the capture target alone.**
      Product efficacy is not operational readiness. Default-on requires all of:
      capture target met · lifecycle and rollback tests green on every supported
      platform · resource budgets met · no privacy or data-integrity incident ·
      static-mode compatibility green · window and minimum sample satisfied.
      verify: each of the six is recorded with its reading; a missing reading blocks the flip.
- [ ] **6.3 Act on a miss.** Below target, the collector stays default-off and
      the shortfall becomes a decision record naming what was measured and what
      closing it would cost. Disposition options are predefined — removal, a
      time-bounded experiment, or retention for a different stated purpose — and
      "the figure moved" is not a result: 0.27 % to 0.28 % is a move and pays
      nothing.
      verify: either the six-part gate passed and the default flipped, or a decision record exists naming the reading and the chosen disposition.

## Blockers

### blocker: supervisor-mechanism-and-platform-scope

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(a), narrowed to USER-SCOPED service managers — and (c) is
  reclassified as a scope constraint rather than a competing mechanism.** AI
  council 2026-08-28 (anthropic + openai, 1 round, $0.00, both seats
  subscription-authed). The seats **split**, and the split resolves on a factual
  premise in this blocker's own text that one seat refuted:

  > "requires installation privileges and breaks the 'nothing else installed'
  > wedge"

  That is **too broad**. A per-user `launchd` agent and a `systemd --user`
  service generally require **no administrator privileges**, and registration
  can stay inside `~/.event4u/agent-config/`. The option (a) this blocker
  described — and rejected on privilege grounds — is not the option that was
  actually available.

  With that premise corrected, the decisive argument is the one this roadmap's
  own § 4 question raises: **a silently dead collector makes incomplete
  telemetry look healthy.** Option (b) does not solve that, it relocates it —
  the single point of failure moves from child to parent, and the parent is
  unsupervised by construction. For a process whose entire purpose is moving a
  0.27 % capture rate, silent permanent death defeats the measurement even
  though it loses no user work.

  **Adopted:** ship only where a supported user service manager is **positively
  detected** — probed, never assumed — and fall back to static mode elsewhere.
  That is what (c) actually is: a platform-scope constraint layered on (a), not
  a third mechanism.

  **(b) is refused as the normal production design**, and permitted only as an
  explicitly **degraded, observable** mode — never labelled "supervised
  telemetry". Where it runs, the other seat's mechanism is what makes it
  observable: a heartbeat file carrying pid, `started_at` and `last_heartbeat`,
  written on an interval, and checked by every CLI invocation — missing means
  not running, stale beyond a threshold means likely dead, and the operator is
  told rather than left with a healthy-looking gap.
- **Consequence for Phase 5's death detection:** it is a real requirement under
  either branch, and under (b) it is the *only* thing standing between a dead
  collector and an understated capture figure.
- **Supported platform list — ADDED 2026-08-29, and it was MISSING.** This
  blocker's own `Resolved when` requires the list to be named, and AC-1 requires
  it written down. Neither was true: the resolution named a *rule* for choosing
  platforms and no list, so the blocker read `resolved` while its resolution
  condition was unmet. Recorded here rather than left to the first implementer,
  because "positively detected" without an enumeration is a decision deferred to
  whoever writes the probe.

  | Platform | Supervisor | Tier |
  |---|---|---|
  | macOS | per-user `launchd` agent under `~/Library/LaunchAgents/` | **supported** |
  | Linux with a user session bus | `systemd --user` unit under `~/.config/systemd/user/` | **supported** |
  | Linux without a user session bus (containers, minimal images, CI runners) | none detected | static fallback |
  | Windows | none — no user-scoped manager in the adopted set | static fallback |
  | Everything else | none detected | static fallback |

  The list is a **derivation of the adopted resolution, not a new decision**:
  the resolution is "ship only where a supported user service manager is
  positively detected — probed, never assumed — and fall back to static mode
  elsewhere", and these are the two managers that clause names. Two properties
  follow and are stated so they cannot be quietly dropped: detection is a
  **probe** (a Linux box with `systemd` installed but no user session bus is
  *not* supported, and assuming otherwise is the failure this wording exists to
  prevent), and **Windows is static-fallback by omission, not by refusal** — no
  Windows supervisor was evaluated, so the honest status is unevaluated rather
  than rejected.

  `SIGKILL` in the lifecycle contract is Unix-specific, so Phase 5's
  process-level suite runs on exactly the two supported rows. Under AC-8 a skip
  on either is a failure on that platform, and the two fallback rows are outside
  the suite because there is no supervisor there to test.

  **Still outstanding on this blocker:** its third clause — for option (a), the
  privilege requirement stated in the installation documentation — is **not yet
  due**, since no code has landed. It becomes due with the first collector
  commit and is carried by AC-1.
- **Blocks:** everything from Phase 3 onward, and Phase 5 entirely. Phases 1.2,
  1.3 and 2 are mechanism-independent and land regardless.
- **What to do:** pick exactly one — (a) an OS service manager per platform
  (`systemd` on Linux, `launchd` on macOS), which gives real restart and death
  detection for free but requires installation privileges and breaks the
  "nothing else installed" wedge; (b) an in-package parent process supervising a
  child, which keeps installation unchanged and portable but means the
  supervisor itself is unsupervised — if it dies, nothing restarts anything; or
  (c) Unix-only for the first release with an explicit static-mode fallback
  everywhere else, which halves the platform matrix and defers the Windows
  question rather than answering it.
- **Resolved when:** the choice is recorded here, the supported platform list is
  named, and for (a) the privilege requirement is stated in the installation
  documentation before any code lands.
- **Recommendation:** (c) with (b) as its mechanism. `SIGKILL` in the lifecycle
  contract is already Unix-specific, so the platform matrix is narrower than the
  roadmap implied whichever option wins; naming that is cheaper than discovering
  it in Phase 5. (b) over (a) because the wedge is a product commitment and a
  telemetry collector is the weakest possible reason to spend it — and the
  supervisor-is-unsupervised gap is exactly what the crash-loop trigger in 3.1
  and the static fallback are for.
- **If you do nothing:** Phase 5 cannot be written, because the five properties
  are properties *of a supervisor* and there is none to test. The roadmap stalls
  at 2.4, which is a real and safe resting point.

### blocker: uniqueness-namespace

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(b) — exactly one collector per OS user.** AI council
  2026-08-28 (anthropic + openai, 1 round, $0.00), **2/2 convergent**.
  Configuration is already user-global at `~/.event4u/agent-config/`, user
  service managers naturally supervise user services, and one process can
  multiplex every repository and worktree that user touches without a process
  fleet. (c) and (d) multiply processes by checkout — and this repository runs
  12+ worktrees at once, so (d) is a dozen residents for one developer.

  (a) per-machine was rejected on a **security** ground rather than a resource
  one: on a shared system it is the wrong boundary, because one user's collector
  must not discover, read, lock, or attribute another user's repositories.

- **Requirements that come with (b), adopted from the seat that named them:**
  one per-user runtime directory and lock; a Unix socket or equivalent local IPC
  endpoint **restricted to that user**; event payloads carrying stable
  repository and worktree identifiers so attribution survives multiplexing; **no
  filesystem-wide repository discovery** — producers register or submit
  explicitly; and bounded registration expiry, so a deleted worktree does not
  linger in the registry forever.
- **Blocks:** Phase 3.4, Phase 5.1 and Phase 5's fencing test. The data contract
  in Phase 2 is unaffected.
- **What to do:** pick exactly one — (a) per machine, one collector for
  everything, simplest to fence and it must then multiplex every repository and
  worktree on the machine; (b) per OS user, which matches where the config
  already lives (`~/.event4u/agent-config/`) and leaves a shared-machine case
  unanswered; (c) per repository, which matches how dispatches are attributed and
  multiplies processes by the number of checkouts — and this repository has more
  than a dozen worktrees live at once; or (d) per worktree, which is the
  attribution unit and the worst process count.
- **Resolved when:** the choice is recorded and "exactly one collector" in the
  lifecycle contract is restated to name the scope explicitly.
- **Recommendation:** (b). The uniqueness scope should match the state's scope,
  and the state already lives under the user's home; (a) forces a multiplexer
  nobody asked for, while (c) and (d) put a resident process behind every
  checkout, which on this machine alone means a dozen. The shared-machine gap is
  real and is a documented limitation rather than a design.
- **If you do nothing:** "exactly one collector" is untestable — a fencing test
  cannot be written without knowing what it fences against — so Phase 5.1 has no
  specification.

### blocker: activation-and-installation-model

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(b) — installation registers the service definition, an
  explicit action starts it.** AI council 2026-08-28 (anthropic + openai, 1
  round, $0.00), **2/2 convergent**, and both seats **refused (c) outright**.

  The refusal is on security grounds, not ergonomics, which is how it was put to
  them. *"Users who clone a repo reasonably expect zero resident processes until
  they opt in"*; *"3(c) is not acceptable as stated"*. A package may execute when
  it is invoked; starting a **persistent background process** as a side effect of
  cloning or of first use crosses a boundary that the content being telemetry
  does not weaken.

  (a) was not chosen because it leaves the friction entirely on the operator and
  invites the failure this blocker already names — capture stays near zero, and
  the 0.27 % figure fails to move for a reason that has nothing to do with the
  collector's quality. (b) keeps the consent and removes the discoverability
  problem: the first CLI invocation after install detects the registered-but-
  stopped state and offers to start it, with a decline and a **never-ask** answer
  both honoured.

- **Incoherent combination, named independently by both seats:** **(d)
  per-worktree × (c) automatic start.** Ordinary use of a 12-worktree checkout
  would spawn a fleet of residents with duplicated upgrades, locks, health state
  and uploads. Per-repository automatic start has the same defect at smaller
  scale. Both are excluded by the resolutions above; the exclusion is recorded
  so a later reader does not reintroduce either half.
- **Blocks:** Phase 4.1's default-off test and Phase 6.2's enablement flip.
- **What to do:** pick exactly one — (a) explicit operator action starts it,
  never installation and never cloning, which is the most conservative and means
  capture stays near zero until operators opt in — possibly leaving the 0.27 %
  figure unmoved for a reason that has nothing to do with the collector; (b)
  installation registers it but leaves it stopped, requiring one command to
  start; or (c) first use starts it automatically, which is the only option that
  plausibly moves the measurement and the only one where cloning a repository
  can start a process on someone's machine.
- **Resolved when:** the choice is recorded, and the answers to "who starts it,
  where do executables and state live, how does an update replace it, what does
  uninstall terminate and remove" are written into the installation
  documentation.
- **Recommendation:** (b). It keeps activation an explicit act while removing the
  discovery problem (a) has, and it refuses (c) outright — a repository clone
  that starts a process is a supply-chain surface, and this repository's own
  spawn hardening exists to close that class. Note the honest consequence: under
  (b) the capture rate measures adoption as much as it measures the collector, so
  1.2's metric definition must state which of the two it is reporting.
- **If you do nothing:** Phase 4.1 cannot assert default-off, because there is no
  definition of what "on" would have been.

### blocker: lifecycle-ci-runner-provisioning

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 5 entirely, and through AC-8 the public capability claim.
  Phases 2, 3 and 4 are unaffected and are the current execution frontier.
- **What to do:** pick exactly one — (a) provision CI runners for both supported
  platform rows (macOS and Linux-with-a-user-session-bus) and run the
  process-level lifecycle suite on each, which is what AC-8 as written requires;
  or (b) run the suite on the one platform CI already provides and record the
  other as **unverified**, which narrows the public capability claim to the
  verified platform and leaves the other in static fallback regardless of what
  the platform table says; or (c) treat process-level lifecycle verification as
  a release-time manual gate on both platforms, documented and signed off per
  release, which needs no new infrastructure and gives up continuous evidence.
- **Recommendation:** (b) as the honest interim, moving to (a) when the
  provisioning question is answered. (b) is the only option that neither claims
  unverified platform support nor stalls Phase 5 on infrastructure; (c) is
  refused as a default because a manual gate is exactly the "presence check
  masquerading as proof" that 5.2 exists to prevent.
- **If you do nothing:** Phase 5 cannot start when the frontier reaches it, and
  the roadmap becomes externally blocked at that moment — which, per the same
  council verdict, is the point at which repo rule 12 binds and this file moves
  to `later/`. Doing nothing therefore does not keep the roadmap active; it
  defers the parking decision to the moment it is most expensive.
- **Decision (AI council, 2026-08-29, UNANIMOUS — 2/2 seats present, anthropic
  `claude-sonnet-4-5` + openai `codex-default`): (b).** Run the process-level
  lifecycle suite on the one platform CI already provides; record the other
  platform row as **unverified**. The maintainer delegated this decision to the
  council for the autonomous drain run of 2026-08-29; the council took it, and
  this line is the record that delegation requires.

  Both seats reached (b) independently and for the same reason: it is the only
  option that neither claims unverified platform support nor stalls Phase 5 on
  infrastructure nobody has provisioned. Both rejected (c) explicitly — a
  release-time manual gate is the "presence check masquerading as proof" that
  step 5.2 exists to prevent. (a) remains the target, not the interim.

  Two conditions the seats attached, both binding on Phase 5 and neither
  optional. From anthropic: the public capability claim narrows to the verified
  platform, and the limitation is documented rather than implied. From openai,
  sharper and the one most easily lost: **the unverified platform stays excluded
  from release claims even if its static fallback appears to work** — an
  appearance of function is not evidence of the five lifecycle properties. The
  capability matrix and AC-8 are to be revised to match the evidence rather than
  the aspiration, and the runner-provisioning question gets an owned follow-up
  with a target date.

  *Revisit-if:* a reliable runner for the second platform row becomes available;
  or lifecycle support there is proposed for public advertisement; or a field
  failure exposes material cross-platform divergence.
- **Resolved when:** the choice is recorded here and, for (a) or (b), the CI
  workflow that runs the suite names the platforms it runs on.
- **Why this is still `open` after the decision:** the first clause above is now
  met and the second is not, and a blocker whose criterion is half-met is open.
  The CI workflow that clause requires cannot exist yet — it runs the Phase 5
  lifecycle suite, which is not built, because Phases 2–4 are the current
  execution frontier. Flipping this to `resolved` on the strength of the
  recorded choice alone would be exactly the silent-green this repository's own
  records name as a recurring defect. It closes when Phase 5 lands a workflow
  that names its platforms.


## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The collector is built before its contracts exist | implementation | The governance roadmap's first draft ordered build-then-contract, and 5.2 there said the data contract must exist "before the first write" — which is weaker than before implementation, since a schema fixed by an implementation is fixed. | Phases 1 to 3 are entirely contracts and decisions; the first implementation step is 4.1, and 1.3 requires the target to be committed before the first collector commit by commit order. | Phase 1 — Decide the architecture before writing the schema |
| 2 | "No free-form field" is mistaken for PII exclusion | product | Structured fields leak through repo identifiers, command arguments, interpolated error enums, stable hashes, and timestamps joined to a machine id. The first draft's AC required only the absence of a free-form field. | 2.1 makes every field justify itself and 2.2 requires a failing fixture per named leak class, each proven to fail when its constraint is removed. | Phase 2 — The data contract, field by field |
| 3 | Supervision is tested with mocks and passes | implementation | Orphan behaviour, signal handling and file locking are process properties. A mocked suite can demonstrate all five properties and prove none of them. | 5.1 requires real processes on every declared platform, and 5.2 requires the evidence protocol to red against an emptied suite and against a foreign-revision result. | Phase 5 — Prove the five lifecycle properties on real processes |
| 4 | The measurement is treated as a code checkpoint | product | Capture rate needs a representative window. A phase that closes when the code lands has measured nothing, and the observation cannot be compressed. | 6.1 is its own step gated on the window and minimum sample from 1.2, and this roadmap is deliberately separate from governance so its slower clock does not hold that one. | Phase 6 — Measure, then decide |
| 5 | The wedge is spent on a telemetry collector | product | "Nothing else installed" is a product commitment. An OS service manager costs it, and the cost would be paid by the least important feature that could pay it. | The supervisor blocker names the trade-off explicitly and recommends against the service-manager option for exactly this reason. | Phase 1 — Decide the architecture before writing the schema |
| 6 | Enablement is decided on the capture target alone | product | 6.2's target is the product signal. Green on it while a resource budget is breached or a platform's lifecycle suite fails would ship an unsafe default. | 6.2 requires all six readings recorded, and a missing reading blocks the flip rather than defaulting to pass. | Phase 6 — Measure, then decide |

## Acceptance Criteria

- [x] AC-1 — All three blockers carry a `resolved` status naming the chosen option, and the supported platform list is written down.
      MET by 1.1, and the scope of "three" is stated rather than assumed. The three blockers this AC was written against — `supervisor-mechanism-and-platform-scope`, `uniqueness-namespace`, `activation-and-installation-model` — each carry `Status: resolved` naming a chosen option, and the supported platform list is a table inside the first of them, with Windows recorded as **unevaluated** rather than refused. A **fourth** blocker, `lifecycle-ci-runner-provisioning`, is `open` and is deliberately NOT counted here: it was added on 2026-08-29 by council instruction, after this AC was written, and its own closure condition is tracked by AC-8's Phase 5 dependency rather than by this line. Flipping this with the fourth blocker unnamed would have been the more convenient reading and a worse record.
- [x] AC-2 — The metric definition answers all nine questions from 1.2, and the target plus window were committed in a commit preceding the first collector commit — checked by commit order.
      MET by 1.2 and 1.3, and the commit-order clause was CHECKED rather than asserted: the target and window landed in `df8ab5c68` (PR #1714) and the first commit touching any collector code — `src/scripts/_lib/collector_record.ts` — is `1468231fa` (PR #1721). `git merge-base --is-ancestor df8ab5c68 1468231fa` exits 0, so the order holds by ancestry and not by date-stamp comparison. The nine answers are numbered 1–9 in 1.2 against the nine questions the step names.
- [x] AC-3 — Every schema field carries a purpose and a cardinality limit; an unknown field is rejected rather than dropped; and a serialization fixture exists per named leak class, each proven to fail when its constraint is removed.
      MET by 2.1 and 2.2. All three clauses: `FIELD_PURPOSE` in `src/scripts/_lib/collector_record.ts` carries purpose, cardinality limit and why-a-coarser-form-does-not-suffice for all nine fields, and `ALLOWED_FIELDS` is DERIVED from it so a field cannot be added without stating its purpose; `validateRecord` reports an unknown key as `unknown field '<name>' — REJECTED, not dropped`; and `LEAK_FIXTURES` in `tests/scripts/collector_record.test.ts` is a named table of six leak classes, each carrying a `removing_this_constraint_reds_it` line, with the sensitivity claim OBSERVED — admitting `repo_path` reds 5 of 35.
- [x] AC-4 — Deletion and opt-out are exercised by tests, not documented: records are gone after deletion, and opt-out prevents the write rather than filtering the read.
      MET by 2.3. `tests/scripts/collector_store.test.ts` deletes through `deleteMachine` and asserts absence through BOTH query shapes (filtered and unfiltered), and asserts a refused write leaves `SELECT COUNT(*)` at 0 — the assertion that distinguishes a prevented write from a filtered read. Sensitivity observed: moving the check into `readRecords` reds 3 of 14, a no-op `deleteMachine` reds 2 of 14.
- [x] AC-5 — The five upgrade transitions in 2.4 are driven by tests over a seeded store.
      MET by 2.4. Five named tests, one per transition, each over a store seeded to the state it tests — plus a sixth on the quarantine directory's growth budget. Transition 3 asserts the quarantined file's BYTES are unchanged, which is what "preserve without reading or rewriting" has to mean to be checkable. Sensitivity observed: 3 of 14 red when a newer store is read instead of quarantined, 1 of 14 when the crash marker is checked after the version stamp.
- [ ] AC-6 — Every rollback-trigger row has an activation mechanism, an owner, a recovery procedure and a named test; resource budgets are numbers with headroom; and the kill switch has been exercised against an unresponsive process.
      FIRST CLAUSE MET by 3.1 — seven rows, four columns each, no empty test cell, and each test carries its state (`EXISTS` with the file, or `OWED BY <step>`) so a name is not mistaken for coverage. THREE of the seven are enforced today; four are owed by the steps that build what they test. The second and third clauses are 3.2 and 3.3 and are OPEN: both need the collector, which is Phase 4. Deliberately not flipped — a partly-met AC reading met is the silent-green this roadmap's own § 4 warns about.
- [ ] AC-7 — Static operation is proven unregressed both with the collector absent and with it present-but-off, by comparing the two runs.
- [ ] AC-8 — The five lifecycle properties are demonstrated by process-level tests on every declared platform, executed in CI on each — a skip counts as a failure on that platform.
- [ ] AC-9 — The evidence protocol reds against an emptied suite and against a result from a different revision, both observed.
- [ ] AC-10 — The capture rate is measured over the declared window at or above the minimum sample, and the outcome is acted on: all six enablement readings recorded and the default flipped, or default-off plus a decision record naming the reading and the chosen disposition.
