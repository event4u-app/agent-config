<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: structural
status: later
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
  - slug: road-to-journal-host-capture-measurement
    relation: extends
    note: "receives that roadmap's step 1.2 dispatch-counter item, merged in on AI-council verdict 2026-08-29; Phase 4 is where it lands"
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

> **PARKED 2026-08-30 — Phases 1 to 5 complete and verified; Phase 6 cannot be
> executed and is explicitly INCOMPLETE.** Resume when the six conditions below
> clear and a real observation window has started.
>
> Phase 6.1 is a **21-consecutive-day window with ≥ 2,000 eligible dispatches
> across ≥ 5 machines** (1.2 items 7–8). Zero days have elapsed and the
> collector is default-off, so nobody has started the clock. This is not a
> missing implementation; it is a missing elapsed calendar, and the roadmap's
> own § 4 already said so: *"Phase 6.1 is a 21-day observation window no run can
> compress."*
>
> **AI council, 2026-08-30 — DEGRADED, 1 of 2 seats present (`anthropic`
> `claude-sonnet-4-5`; `openai` `codex-default` absent, `os_error: ENOBUFS`).
> Quorum 1, concluded. $0.00 — subscription-authed. This is a degraded verdict,
> not convergence, and it is recorded as such.** The maintainer delegated the
> disposition to the council for the autonomous drain run of 2026-08-30.
>
> The seat was offered four options — (a) park, (b) descope Phase 6 into a
> follow-up roadmap, (c) re-scope 6.1 to a synthetic verification, (d) name
> something else — and chose **(d): a hybrid.** Park at Phase 5 with Phase 6
> explicitly incomplete, AFTER landing a synthetic measurement-machinery
> checkpoint as a prerequisite. That checkpoint is step **5.3**, which shipped
> in the same change.
>
> It rejected (b) explicitly: *"Descoping to Phase 5 as 'complete' retroactively
> redefines what this roadmap promised. Phase 6 was always part of scope."* And
> it rejected treating the synthetic test as a substitute: *"Synthetic
> verification is a prerequisite, not a substitute for 6.1."*
>
> **Resume conditions, recorded as the seat required — all six must clear:**
>
> 1. **Platform coverage resolved.** Linux lifecycle/rollback verification
>    passes in a real user-session-bus environment, OR Linux is formally removed
>    from the supported-platform contract by an explicit support-policy decision.
>    The seat was emphatic that spending 21–63 days on an observation 6.2 will
>    then reject is waste — so this is a RESUME condition, not a park condition.
> 2. **Cohort and enablement design defined** — eligibility criteria, machine
>    identity for deduplication, who may enable collection, version-skew
>    handling, clock authority for window boundaries, representative-sample
>    threshold. *"'Somebody enables it' is not an operational plan."*
> 3. **Privacy and data-integrity boundaries specified** — allowed fields,
>    retention, access controls, deletion path, PII-exclusion verification, and
>    incident-detection criteria. *"'No privacy incident' is only measurable if
>    'incident' has a definition."*
> 4. **Kill-switch and rollback design complete** — automatic stop criteria,
>    stop-propagation time bound, verification that disabling reaches the entire
>    cohort, and a fallback if telemetry infrastructure fails.
> 5. **Observation window formally started** — the collector enabled on a
>    qualifying multi-machine cohort per condition 2, with the start timestamp
>    recorded. *"Single-machine or maintainer-only testing does not start the
>    clock."*
> 6. **Synthetic measurement-machinery verification green** — step 5.3. **MET
>    2026-08-30**, and it is the only one of the six that is.
>
> **The one point where this record disagrees with its own seat, stated rather
> than smoothed over.** Conditions 3 and 4 are partly discharged by Phases 2 and
> 3 as shipped — the schema is an allowlist with per-field purpose and six
> named leak-class fixtures (2.1, 2.2), deletion and opt-out are exercised by
> tests rather than documented (2.3), and the kill switch has an automatic stop
> criterion (budget breach), a mechanism reachable without the collector's
> cooperation, and a test that kills a real wedged process (3.2, 3.3). What is
> genuinely missing from both is the **cohort** half: propagation to more than
> one machine, and an operational definition of "incident" across a fleet. The
> conditions are therefore kept as written rather than marked partly met, since
> the missing half is the half that matters for a fleet measurement — but a
> future reader should not re-derive the parts that exist.
>
> **Revisit-if:** all six conditions clear and the 21-day window completes with
> ≥ 2,000 sampled dispatches and a computed Wilson lower bound; OR the telemetry
> strategy changes so field measurement is unnecessary; OR the Linux CI
> infrastructure gap closes and the platform-coverage reading can be
> re-verified.
# Road to a supervised telemetry collector — the first resident process, and the eight things the owner decision does not decide

> **Source:** [REDACTED:src-conf]
> after a deep council pass (2/2, both seats "not ready"). The originating
> analysis is `agents/tmp.old/inbox-2026-08-h/`; the durable record of the owner
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
      **The count is runtime-conditional and is NOT CI evidence.** Those tests require `node:sqlite`, which `.github/workflows/tests.yml` does not offer — CI pins Node 20 and the module did not exist before 22.5 — so on CI the `withSqlite` blocks do not execute and this platform row is **unverified**, exactly as `blocker: lifecycle-ci-runner-provisioning` resolved for the lifecycle suite. The counts below were executed on a Node 26 runtime. `tests/scripts/collector_store.test.ts` enforces this qualifier: on a runtime without `node:sqlite` it asserts this very paragraph exists, so deleting it reds the suite on CI.

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
      verify: DONE — five transitions, five named tests, each driven over a store seeded to the state it tests. `tests/scripts/collector_store.test.ts` § *2.4 — the five upgrade transitions*. Runtime-conditional on `node:sqlite`, per the qualifier recorded under 2.3 — unverified on CI, executed on Node 26.

      | # | Transition | Contract | Test |
      |---|---|---|---|
      | 1 | Fresh store | created at `COLLECTOR_SCHEMA_VERSION`, `quarantined: false` | *TRANSITION 1 — a fresh store is created at the current schema version* |
      | 2 | **Backward** compat — older records, newer package | walked forward through the explicit `MIGRATIONS` ladder inside a marked window; records survive; the marker does not outlive a success; a version with **no registered path** is quarantined rather than stamped | *TRANSITION 2* + `R2-2 — the migration ladder` (four pure `migrationPath` cases) + `R2-2 — an unmigratable store is quarantined, not stamped forward` |
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

      Two further tests cover the growth budget the quarantine directory would
      otherwise have none of: the filename carries a **content digest** rather
      than a timestamp, so quarantining **identical** bytes twice leaves exactly
      one artefact, while **different** bytes leave two. Both directions are
      asserted, because an exact-count assertion alone would let a
      delete-the-old-one implementation satisfy it. (The first version of this
      test was tautological — see the R2 record below — and its replacement is
      the reason this paragraph is two tests rather than one.)

      **And the table itself now has a retention policy**, which it did not:
      `RETENTION_DAYS = 63` — the metric definition's own hard stop for the
      observation window — with a tested `pruneOlderThan` job. An append-only
      table with no TTL, pruning job, partition rotation or archive path is an
      R-A7 violation, and this step had reasoned about R-A7 for the neighbouring
      quarantine *directory* while leaving the table that actually grows per
      event unbudgeted. The disk CEILING is still 3.2's; a retention policy is
      not a ceiling.

      **Sensitivity:** reading a newer store instead of quarantining it reds
      **3 of 14**; checking the crash marker after the version instead of before
      reds **1 of 14** — the transition-4 test alone, which is the targeted
      result rather than a blanket break. Both reverted and re-verified at 14/14.

> **R2 completion review, 2026-08-29 — 12 findings, and both highs were on steps
> already flipped `[x]`.** A fresh blind reviewer subagent was dispatched at the
> dispatcher-authored prompt package (never a prompt the implementing session
> wrote, per `evaluator-independence`), over the whole branch delta, with the
> artefact committed BEFORE any fix. Verdict: 2 high, 5 medium, 5 low; every
> finding reached a terminal status — **11 `fixed`, 1 `accepted-risk`**.
>
> **The two highs were evidence failures, not code failures, which is the worse
> place for them.** (1) The quarantine growth-budget test was *tautological*:
> `new Set(names).size === names.length` is true of every `readdirSync` result by
> definition, and `names.length >= 1` accepts unbounded growth — so the R-A7
> claim in 2.4 was asserted, not enforced, and the fixture never even produced
> the same bytes twice. (2) Transition 2's *migration* was a `user_version`
> stamp: `db.exec(SCHEMA)` is `CREATE TABLE IF NOT EXISTS`, a no-op on an
> existing table of any shape, and the test seeded only the version integer
> backwards over the CURRENT shape, so it passed for a stamp-only implementation
> and the first real column change would have stamped an old-shaped store as
> current. Both steps' `verify:` lines above are rewritten to what is now
> actually enforced.
>
> **One finding demoted itself, and the demotion is recorded rather than
> smoothed over.** Medium 6 said `quarantine()` deleted WAL sidecars instead of
> moving them, losing committed data behind a byte-equality assertion that could
> not see it. The move is implemented — and measuring it showed the loss is *not
> reachable* through `openCollectorStore`, which opens the database before
> reading its version, and opening removes an unrecognised `-wal`. So the
> assertion sits on `quarantine()` directly and a second test pins the
> removal-on-open that makes the end-to-end path unreachable, which means
> enabling WAL later reds it and re-opens the question deliberately.
>
> The remaining mediums were concrete state-machine defects: a crash *inside*
> crash-recovery left a stale marker and evicted a healthy store one restart
> later; `quarantined` implied a durable lockout it never was; `uninstall` left
> the opt-out marker while its docstring said "the markers"; `deleteMachine`
> returned a pre-delete SELECT count instead of the DELETE's `changes` on the one
> path framed as serving an Art. 17 request. The lows added the retention policy
> this phase owed under R-A7 (`RETENTION_DAYS = 63`, the metric definition's own
> hard stop, with a tested pruning job), removed an unreachable enum member, and
> made the `node:sqlite` skip a RED rather than a silent zero — on the finding's
> own argument that AC-8 of this roadmap holds a skip to be a failure.
>
> The single `accepted-risk` is the one the finding itself labelled a trade-off:
> one `existsSync` per write, the price of honouring a mid-session opt-out
> immediately, now recorded as a line item owed to step 3.2's CPU budget so that
> step meets it as a known cost instead of discovering it.
>
> Also self-caught before the review and fixed alongside it: the store
> deduplicated at WRITE time via `PRIMARY KEY` + `INSERT OR REPLACE`, satisfying
> metric item 4's *"a repeated key is one record"* by violating its *"observable
> as a defect rather than silently collapsed"*. Read-time dedup now, with
> `readSummary` reporting rows / unique / duplicates.
>
> Evidence after the fixes: **32 tests green** (was 14), typecheck and eslint
> clean, and **seven sensitivity probes** each applied alone and reverted from an
> explicit backup — write-time dedup restored reds 3, and the other six red
> exactly 1 apiece, so every probe is targeted rather than a blanket break.

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
      five of them are future work is the "presence check masquerading as proof"
      that step 5.2 exists to prevent, one section earlier. **Two** of the seven
      are enforced today — rows 1 and 5 — and **five** are owed by the steps
      that build what they test, by name rather than by hope. (The first draft
      of this paragraph said three and four. Counted against the table below it
      is two and five, and the table is what a reader checks.)

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

- [x] **3.2 Set resource budgets as numbers.** CPU, resident memory, disk
      footprint, and file-descriptor count, each with the ceiling and the
      headroom at expected peak. An unquantified ceiling is not headroom.
      verify: DONE — `RESOURCE_BUDGETS` in `src/scripts/_lib/collector_supervision.ts` records four budgets, and `tests/scripts/collector_supervision.test.ts` § 3.2 asserts `action: 'stop'` for EACH budget individually.

      **Four numbers, and the honest part is where they come from.** Every row
      carries `ceiling`, `expectedPeak` and a `basis` string stating the
      arithmetic the peak comes from; `headroomAtPeak()` DERIVES the headroom as
      `ceiling - expectedPeak` rather than storing it, so the two numbers cannot
      drift into a headroom that is not their difference. CPU 2 % of one core
      (peak 0.2 %) · RSS 96 MiB (peak 60 MiB) · disk 64 MiB (peak 12 MiB) ·
      file descriptors 32 (peak 12).

      **Every `expectedPeak` is a DERIVATION, not a measurement, and the module
      says so in those words.** No collector exists to measure — that is Phase 4
      — so a row whose basis read like an observation would be the same
      overclaim this roadmap's risk 1 already caught once. A measured peak above
      a derived one FALSIFIES the derivation; the row is re-derived and the
      ceiling is not raised to accommodate it. That is written as a `revisit-if`
      on `RESOURCE_BUDGETS`.

      Breach semantics are `stop`, never throttle — row 4 of the 3.1 matrix, on
      the grounds that an observer which has become a load is no longer an
      observer. Two boundary cases are tested rather than assumed: a reading
      exactly AT the ceiling is INSIDE it (the ceiling is the last permitted
      value), and a **missing or non-finite reading is a breach, not a pass**.

      SENSITIVITY, observed: flipping `>` to `>=` in `budgetVerdict` reds 1 of
      21; making the non-finite branch continue silently reds 1 of 21. Neither
      probe reds the whole file, which is what distinguishes a probe from a
      broken import.
- [x] **3.3 Define the kill switch and who may pull it.** One mechanism,
      reachable without the collector's cooperation, documented where an
      operator will find it under pressure rather than in this roadmap.
      verify: DONE — `tests/scripts/collector_supervision.test.ts` § 3.3 *KILLS A REAL WEDGED PROCESS that ignores SIGTERM*, and asserts `via: 'forced'` plus an ESRCH on the pid afterwards.

      **The mechanism is a marker file, and its presence is the whole signal.**
      `touch ~/.event4u/agent-config/agent-collector/STOP`. Nothing parses its
      contents, so it cannot be half-pulled, and it needs no cooperation from
      the collector — which is the step's binding requirement. While it exists
      `acquireRuntimeLock` refuses, so a supervisor restart loop cannot bring
      the collector back, and `resolveDispatchMode` reports `static` whatever
      the lock says.

      **Documented where an operator will find it under pressure**, which the
      step requires explicitly and which this roadmap is not:
      `docs/contracts/collector-operations.md` — stop it, is it running, what it
      may cost, which mode, and what to look at when something went wrong.

      **The wedged-process test is a real process, and two things about how it
      is built are load-bearing rather than ceremony.** The victim is a
      GRANDCHILD, re-parented to init when its launching shell exits: a direct
      child stays a ZOMBIE after `SIGKILL`, `kill(pid, 0)` succeeds against an
      unreaped child, and `terminateCollector` is synchronous so the event loop
      that would reap it never runs — the first draft of this test failed
      exactly there and reported `unreachable`. And the test WAITS for the child
      to write a readiness file before signalling, because Node installs the
      `SIGTERM` handler only once the script runs; a signal delivered during
      interpreter startup takes the default action and the test goes green as
      `graceful` — which is a pass for a test whose entire point is the
      escalation. Both failures were observed, not anticipated.

      SENSITIVITY, observed: deleting the `SIGKILL` escalation block reds 1 of
      21; dropping the kill-switch guard from `acquireRuntimeLock` reds 1 of 21.

      **`agent-config collector:stop` does not exist and the doc does not claim
      it does.** There is no process to end until Phase 4; the verb ships with
      the collector, in the same change, and the ops page says so in those words
      rather than describing a command a reader would try and fail to run.
- [x] **3.4 Define static mode and daemon mode against the same tree.** Whether
      both may run concurrently, and if not, what prevents it. Left undefined
      this is duplicate capture and version skew.
      verify: DONE — declared PREVENTED in `DISPATCH_MODE_CONTRACT`, and `tests/scripts/collector_supervision.test.ts` § 3.4 proves the prevention: two contenders, exactly one lock, the loser routed to `static`.

      **The declared behaviour is refusal, not correctness.** Concurrent
      operation is not made safe; it is prevented by the per-user runtime lock
      (`agent-collector/collector.lock`), which is the `uniqueness-namespace`
      (b) verdict made concrete. Two checkouts of this repository — two
      worktrees, which `resident-process-floors` § 2 Q5 calls the common case
      here rather than the exotic one — resolve to the SAME lock path, so the
      second does not get a second collector. It gets static mode.

      What is refused, named rather than implied: duplicate capture (one
      dispatch counted twice, in the numerator of the very ratio this
      instrument exists to measure) and version skew (two revisions disagreeing
      about the schema). Neither is worth solving for this instrument.

      **What makes the exclusion cheap is what "static mode" means:** there is
      no collector process and nothing is captured. It is not a second, quieter
      writer — so the losing contender has nothing to flush and no partial
      state, and § 1's falsifiable form (*if the module were killed, every
      dispatch would resolve identically*) holds unchanged.

      A lock whose recorded pid is not alive is FENCED rather than respected —
      row 2's recovery procedure in the 3.1 matrix — so a crashed collector does
      not lock its successor out forever. Atomicity is `wx`, not
      compare-then-write.

      SENSITIVITY, observed: dropping the `wx` flag reds 1 of 21 (both
      contenders acquire); returning `held-by-live-process` without probing
      liveness reds 1 of 21 (the crashed owner's lock becomes permanent).

## Phase 4 — Implement, default-off

> **Received item, AI council 2026-08-29 (DEGRADED — 1 of 2 seats, quorum 1;
> `openai` absent, `os_error: ENOBUFS` then reported unavailable by the free
> probe).** `road-to-journal-host-capture-measurement` step 1.2 — *"If no host
> count exists, build the narrowest thing that counts"*, a per-event dispatch
> counter with no payload and no free-form field, hook-invocation writes only —
> was deferred there and **merged into this phase** rather than cancelled.
>
> Its antecedent went false in that roadmap: six `(claude, event)` cells turned
> out to publish a host-readable count, so no counter was owed for ITS
> measurement. The council refused to mark the step `[x]` on the grounds that a
> vacuous discharge is *"cancellation wearing a checkmark"* under
> `roadmap-progress-sync` Iron Law 3, and refused a new roadmap as +1 estate for
> an instrument nobody currently needs. It chose this phase because **the item is
> already owed here**: step 1.2 item 1 of this roadmap requires that *"the
> denominator must be produced by a writer that cannot fail in the same way the
> numerator does; a collector counting its own opportunities is the failure
> `road-to-journal-host-capture-measurement` exists for."* That writer is the
> same instrument, for the same reason.
>
> **This note adds no step and changes no acceptance criterion.** It records
> where the item lives so it is not lost, which is the whole point of the merge
> disposition. Step 4.1's denominator writer discharges it; if 4.1 ever ships
> without one, this item is the open half.
>
> Recorded dissent, carried across with the verdict: if host-published counts
> turn out to be permanent infrastructure, the merged item never activates and
> documenting the false antecedent would have been better. The seat declined to
> assume permanence — *"platforms change, deprecation happens."*


- [x] **4.1 Build the collector against the contracts above.** Default-off, and
      default-off is a tested property rather than a config line nobody
      exercised.
      verify: DONE — `tests/scripts/collector_daemon.test.ts` § 4.1 greps the live process table (`ps -eo pid,args`) and asserts no collector process exists, with a POSITIVE CONTROL that spawns one first and proves the same grep can see it.

      **Three modules, and the daemon adds a loop and a signal handler to them.**
      `src/scripts/collector_daemon.ts` builds against the Phase 1–3 contracts
      rather than beside them: the record shape is `collector_record`, the store
      and quarantine are `collector_store`, the budgets, kill switch, lock and
      heartbeat are `collector_supervision`, and the denominator plus spool are
      the new `src/scripts/_lib/collector_denominator.ts`. Every rule it obeys
      was decided earlier and is imported, not restated.

      **Default-off is the ABSENCE of a file, which is what makes it a property
      rather than a config line.** `ENABLED` is an opt-IN marker; a fresh
      install has none, so there is no default that could be misread and no
      environment variable CI could set by accident. Opt-out still beats opt-in.

      **The verify clause is honoured literally: process enumeration, not a
      setting read.** And the negative assertion is preceded by a positive
      control, because "the grep found nothing" is worthless until the same grep
      has been shown to find something — a grep that can never match reports
      "no collector" on a machine running ten.

      **The merged received item is discharged here, and it is the denominator.**
      Step 1.2 item 1 requires that *"the denominator must be produced by a
      writer that cannot fail in the same way the numerator does"*.
      `recordOpportunity` runs in the HOOK process, synchronously, with no
      daemon involved — so a dead collector yields a climbing denominator
      against a flat numerator and the capture rate falls instead of reading
      0/0. It is gated on the opt-in MARKER, never on the daemon: gating on the
      daemon would make the instrument self-reporting, which is exactly the
      failure `road-to-journal-host-capture-measurement` exists for.

      One `stat` is the whole cost on a default-off install. The wiring is a
      single call in `dispatch_hook.main`, placed after the vocabulary check (an
      unknown event is not an opportunity) and before the manifest load (a
      missing manifest fails open, and the dispatch still WAS an opportunity) —
      that ordering is the difference between measuring dispatches and measuring
      successful dispatches, and the metric definition asks for the former.

      **It never throws, and that is the observation-only contract rather than
      defensive habit.** `resident-process-floors` § 1's falsifiable form is
      that killing the module leaves every dispatch resolving identically; a
      raising counter breaks precisely that. Tested against an unwritable
      directory.

      SENSITIVITY, observed (20 tests in the file): inverting
      `isCollectorEnabled` to default-ON reds 1; dropping the `isOptedOut` guard
      reds 1; gating the denominator on a running daemon reds 1; swapping the
      UTC date for a full timestamp reds 1; removing `recordOpportunity`'s
      try/catch reds 1; stopping on the first budget breach instead of the
      second reds 1; dropping `runLoop`'s `finally { stop() }` reds 1.

      **The negative default-off assertion has no red edit, and that is stated
      rather than hidden.** It is a negative claim about the machine, so its
      sensitivity is carried by the positive control beside it — which is the
      honest structure for an assertion no module edit can falsify.
- [x] **4.2 Prove static operation is unregressed.** The Goal of the governance
      roadmap says static operation still works. Nothing tested it.
      verify: DONE — `./scripts-run src/scripts/check_static_parity` ran both suites and COMPARED them: equal test counts on both sides, both exit 0, `✅ static operation is unregressed — per-test verdicts are identical`. The count itself moves with the suite and is deliberately not pinned in prose (R2 round-2 finding 15 caught three different figures for it in one change); the gate prints the live number.

      **Two green runs are not the assertion; two runs with identical per-test
      verdicts is.** The difference is the whole point of the step's wording: a
      suite that passes both times while one test silently turned from `passed`
      to `skipped` has regressed static operation in the one way "both green"
      cannot see. `compare()` is keyed on test name → status, in both
      directions, and is order-independent.

      **"Absent" is absent, not disabled.** The second run aliases
      `collector_denominator` to `tests/_lib/collector-absent-stub.ts` through a
      `vitest.config.ts` branch that is inert unless
      `AGENT_CONFIG_COLLECTOR_ABSENT=1`, so the dispatcher resolves a
      do-nothing module and the real one is never loaded — its imports, its
      filesystem probes and its existence all out of the picture. Run A is the
      real module with no opt-in marker: present, and off.

      **The parity set is DISCOVERED, not listed.** `parityFiles()` greps for
      every test file that reaches `dispatch_hook` — 31 files, 551 tests — and
      prints them, so a reader can check the denominator of the claim. A
      hand-written list goes stale the first time a test file is added, and a
      stale parity set reports parity over the wrong population. An empty set
      exits 1 with *"a gate that scans nothing exits green"*, because that is
      this gate's silent-failure shape.

      **The scope limit, stated rather than implied:** this proves parity for
      the dispatcher surface, which is the collector's entire contact with the
      tree (one call in `dispatch_hook.main`). A test that never reaches that
      function cannot diverge, because nothing differs on the path it takes. It
      is NOT evidence that the whole suite is identical under both runs, and it
      is not evidence about a future collector call site placed elsewhere —
      adding one is what re-runs the grep.

      SENSITIVITY, observed: making `recordOpportunity` throw (and removing its
      try/catch) turns the present-but-off run red — 174 tests, exit 1 — and the
      gate refuses with *"parity over a red suite proves nothing"* rather than
      comparing two broken runs. The comparator's own sensitivity is unit-tested
      in `tests/scripts/check_static_parity.test.ts`: a length-only comparison
      passes the `passed → skipped` case and reds that block.

      **Not wired into CI, and that is a decision with a cost.** The gate takes
      about a minute (two 551-test runs) and registering a new gate touches six
      further surfaces plus the gate-coverage ledger. It is run on demand, which
      means it can rot between runs. *Revisit-if:* a second collector call site
      lands anywhere outside `dispatch_hook.main`, or a static-mode regression
      reaches `main` — either falsifies "on demand is enough".

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


- [x] **5.1 Test each of the five properties as a process-level test.** Mocks
      do not establish orphan behaviour, signal handling, or file locking.
      verify: DONE on the macOS row — `tests/scripts/collector_lifecycle.test.ts` spawns real `collector_daemon run` processes for all five properties, 5 run / 0 skipped, and the `Collector Lifecycle` job in `.github/workflows/tests.yml` executes it on `macos-latest`. The second declared row is NOT run and is recorded unverified, per the council's (b).

      **The five properties, named rather than counted.** 1 — exactly one live
      collector per OS user (two real daemons contend; the loser EXITS rather
      than becoming a second writer). 2 — SIGTERM ends it cleanly: lock
      released, heartbeat removed, successor starts with no fencing needed. 3 —
      SIGKILL leaves real residue (a lock and a heartbeat, because an unclean
      death cannot run a handler) and the successor FENCES both. 4 — a dead
      collector is readable as dead: the corpse's beat survives and reads
      `stale` past the threshold, never `running`. 5 — an orphan survives its
      parent, keeps beating, and its ppid is not this test's.

      **Nothing is mocked, and the test found three real defects by being
      real.** All three were the same confusion: `tsx` is a LAUNCHER, so
      `child.pid` is a wrapper and the daemon runs in a grandchild. Signalling
      the wrapper left the daemon alive; comparing `child.pid` to the heartbeat
      compared two different processes. Properties 1, 3 and 4 all failed on it,
      and the failures read like product bugs. The suite now reads the daemon's
      pid from its own readiness line, which the daemon prints only AFTER the
      lock and heartbeat exist — the same startup race step 3.3 learned.

      **The first real start also falsified two of 3.2's four budgets**, which
      is exactly what that step's `revisit-if` said would happen and is recorded
      there rather than quietly patched: resident memory read 116.2 MiB against
      a 96 MiB ceiling and the daemon budget-stopped itself within seconds; file
      descriptors read 28 against a derived peak of 12. Both rows are now
      MEASURED (192 MiB / 128 fd ceilings) and the other two still say DERIVED.
      A third defect surfaced in the same run: back-to-back CPU sampling
      produced `103 %` and then `36800 %`, because a sub-millisecond window
      divides into any CPU time to give nonsense — `MIN_CPU_WINDOW_MS` now
      refuses to recompute below one second and carries the previous value,
      with the three-way trade-off written out at the call site.

      **The platform gap is named, not implied.** `ubuntu-latest` has no user
      session bus, so it is the platform table's STATIC-FALLBACK row, not the
      supported `systemd --user` row. Running the suite there would produce a
      green tick that says nothing about the row AC-8 cares about — so the job
      does not run it, and the workflow comment says why. Per the (b) verdict's
      binding conditions, the unverified row stays out of release claims **even
      if its static fallback appears to work**.
- [x] **5.2 Make the evidence protocol explicit, so a presence check cannot
      masquerade as proof.** The governance roadmap's atomicity check asks
      whether this suite is green. That check must establish that the named
      suite exists, ran on the same revision, exercised real processes, and was
      not empty or skipped.
      verify: DONE — `./scripts-run src/scripts/check_supervision_claim_atomicity --self-test` reports `7/7 case(s) behaved (5 rejecting, floor 7)`, and two of those five are exactly the seeded negatives this step names: *"an emptied suite — every case skipped, none run"* and *"a result recorded against a different revision"*. Both observed rejecting with exit 1.

      **The check existed; what was missing was a producer.** The gate already
      demanded that the artifact name a suite, match HEAD's revision, record
      `processes_exercised: true`, and carry integer counts with `run > skipped`
      — four conditions, each with its own refusal string. Nothing wrote the
      artifact. `src/scripts/run_lifecycle_suite.ts` is that producer, and every
      field in it is OBSERVED rather than asserted: the revision from `git
      rev-parse HEAD` at run time, the counts parsed out of vitest's own JSON
      report, and `processes_exercised` true only when all five NAMED properties
      passed — matched by name, because a count cannot tell five properties from
      five repeats of one. A hardcoded `true` there would defeat the gate
      entirely, since the gate exists because a mocked suite can demonstrate all
      five properties and prove none.

      A skip is a failure: the producer exits non-zero on any skipped case, and
      still writes the artifact with the honest counts — a missing artifact and
      a skipped suite need different remediation, and the gate distinguishes
      them by design.

      **The artifact is deliberately gitignored.** The gate refuses a result
      whose recorded revision is not HEAD, so a committed artifact would forever
      name the commit before the one it ships in and could never match. It is a
      CI-time fact, produced by the `Collector Lifecycle` job at the revision
      under test.

      **What the negatives do NOT show, stated because the difference matters.**
      Run against the REAL tree, the gate passes whatever the artifact says —
      because no public surface currently makes a present-tense supervision
      claim, so there is nothing for it to refuse. That is the correct state
      (AC-8 is unverified on one row, so no such claim may be made), and it is
      why the step asks for SEEDED negatives: the self-test plants the claim
      alongside the bad evidence. Reporting the vacuous real-tree pass as
      evidence of the protocol working would have been the available mistake.

- [x] **5.3 Prove the measurement machinery before the measurement.** Seeded
      opportunities and captures, an asserted ratio, an asserted Wilson bound,
      the minimum-sample boundary, malformed input, and duplicate suppression —
      all verifiable with zero elapsed days. It proves the instrument; it claims
      nothing about the field measurement.
      verify: a test computes the rate and its interval from the REAL denominator writer and the REAL store, and the eligibility boundary is asserted at the exact minimum sample.

      > **ADDED 2026-08-30 on AI council instruction (DEGRADED — 1 of 2 seats;
      > `openai` absent, `os_error: ENOBUFS`).** The seat made this a
      > **prerequisite checkpoint between Phase 5 and Phase 6**, explicitly not a
      > Phase 6 step and explicitly not a substitute for 6.1: *"The synthetic
      > test is a checkpoint, not a Phase 6 step. It answers 'does the instrument
      > work?' before asking 'what does it measure?'"* Recording it as its own
      > step rather than folding it into 6.1 is the whole point — folding it in
      > would let a green instrument read as a completed measurement.

      **DONE.** `src/scripts/_lib/capture_rate.ts` + 19 tests in
      `tests/scripts/capture_rate.test.ts`.

      **The decision rule is implemented as 1.2 item 9 fixed it, and the test
      that matters is the one that fails.** 1800/2000 is exactly 90 % as a point
      estimate and its Wilson lower bound is below 90 %, so the rule says it has
      NOT cleared the target. A consequence worth stating because it is easy to
      discover late and expensive: at the 2,000 minimum sample, a 90 % LOWER
      BOUND needs a point estimate of roughly **91.3 %**. The test computes that
      threshold rather than asserting it, so it moves if the sample floor does.

      **Ineligible is `null`, never `false`, and that is a three-valued verdict
      on purpose.** A 200-dispatch sample over 3 days is *keep observing*, not
      *missed* — and a miss is what fires 6.3's decision record. Collapsing the
      two would produce a recorded shortfall for a measurement that never
      happened. Same shape in `judgeEnablement`: a MISSING reading and a FALSE
      reading are reported separately, because "we did not look" and "we looked
      and it was bad" call for different actions.

      **Wilson rather than the normal approximation**, because the normal one is
      wrong exactly where this measurement lives: near a proportion of 1 it
      returns an upper bound above 1 and a spuriously narrow interval. At `n = 0`
      the interval is `[0, 1]` — *we measured nothing* — never `[0, 0]`, which
      would read as a total capture failure.

      **The end-to-end block drives the REAL writers**: 40 opportunities through
      `recordOpportunity`, 34 records through `spoolRecord` and `drainOnce` into
      the real store, giving 34/40. Duplicate suppression is asserted against the
      store's actual behaviour — three identical spooled records produce three
      ROWS and one record, because the store is append-only and de-duplicates at
      read time — which is what keeps the numerator from exceeding the
      denominator without an insert-time unique constraint.

      SENSITIVITY, observed (19 tests): judging on the point estimate instead of
      the lower bound reds 1; returning `false` instead of `null` for an
      ineligible reading reds 4; `[0, 0]` at `n = 0` reds 1; treating a missing
      enablement reading as `false` reds 1; dropping the
      numerator-above-denominator check reds 1.

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

      **The platform reading is REVISED to match the evidence, and it is
      revised as BLOCKING rather than as met** (AI council 2026-08-30, the same
      degraded verdict that parked this roadmap). It now reads:

      > *Lifecycle and rollback tests verified on macOS (AC-8 green on that row);
      > Linux verification infrastructure-blocked — no user session bus on any
      > GitHub-hosted runner.*

      The seat was explicit about why this is a revision of the WORDING and not
      of the bar: *"Do not treat a known unverified platform as 'met'."* The gap
      closes one of two ways — Linux lifecycle tests pass in a real
      user-session-bus environment, or Linux is formally removed from the
      supported-platform contract through a separate support-policy decision.
      Until then this reading is `false`, not `null`: it has been looked at.

      Two readings are recordable today and are recorded here so a resumer does
      not re-derive them. **Resource budgets: met** — measured 2026-08-30, and
      two of the four ceilings were re-derived from that measurement rather than
      the reading being fitted to them (3.2). **Static-mode compatibility:
      green** — 551 tests run twice with identical per-test verdicts (4.2). The
      other four need the window, the cohort, or the Linux row.
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

- **Status:** resolved 2026-08-30 — both clauses of `Resolved when` are now met.
  The choice was recorded here on 2026-08-29 (council, (b)); the second clause
  — *"the CI workflow that runs the suite names the platforms it runs on"* — is
  met by the `Collector Lifecycle` job in `.github/workflows/tests.yml`, which
  runs on `macos-latest` and states in its own comment that the
  Linux-with-a-user-session-bus row is NOT run and NOT verifiable on a
  GitHub-hosted runner, because `ubuntu-latest` has no user session bus and is
  therefore the platform table's static-fallback row rather than the supported
  one. The (b) verdict's binding condition is carried into the workflow text:
  the unverified row stays out of release claims even if its static fallback
  appears to work. Option (a) remains the target and is unchanged; see the
  `Revisit-if` below.
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
- **Why it was `open` after the decision, and what closed it (2026-08-30):** the
  first clause was met on 2026-08-29 and the second was not, and a blocker whose
  criterion is half-met is open — flipping it on the strength of the recorded
  choice alone would have been exactly the silent-green this repository's own
  records name as a recurring defect. The paragraph then said it *"closes when
  Phase 5 lands a workflow that names its platforms"*. Phase 5 landed and the
  workflow names them, so it is closed on the condition it stated, not on a
  reinterpretation of it.


## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-30 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A step is flipped `[x]` on a test that cannot red | implementation | The only risk in this register OBSERVED TO HAVE MATERIALISED. The blind R2 review of 2026-08-29 found both of its high findings on steps already flipped `[x]`: a quarantine growth-budget test asserting `new Set(names).size === names.length` (true of every `readdirSync` result by definition) and a transition-2 test that passed for a migration consisting only of a `user_version` stamp. Neither could have gone red, so both steps read closed while the property they name was unenforced — which is risk 4 of this register in a register-invisible register: the failure is not that a check was skipped, it is that a check ran and proved nothing. | Every flip now records its SENSITIVITY reading — the exact edit that reds it and how many tests red — and a probe that reds zero tests, or the whole file, is treated as evidence of a bad probe rather than a good implementation. Seven probes were run on this change and each reds between 1 and 3 of 32. The structural half is the R2 pass itself: a fresh reviewer with the whole delta and a prompt the implementing session did not write. | Phase 2 — The data contract, field by field |
| 2 | The collector is built before its contracts exist | implementation | The governance roadmap's first draft ordered build-then-contract, and 5.2 there said the data contract must exist "before the first write" — which is weaker than before implementation, since a schema fixed by an implementation is fixed. | Phases 1 to 3 are entirely contracts and decisions; the first implementation step is 4.1, and 1.3 requires the target to be committed before the first collector commit by commit order. | Phase 1 — Decide the architecture before writing the schema |
| 3 | "No free-form field" is mistaken for PII exclusion | product | Structured fields leak through repo identifiers, command arguments, interpolated error enums, stable hashes, and timestamps joined to a machine id. The first draft's AC required only the absence of a free-form field. | 2.1 makes every field justify itself and 2.2 requires a failing fixture per named leak class, each proven to fail when its constraint is removed. | Phase 2 — The data contract, field by field |
| 4 | Supervision is tested with mocks and passes | implementation | Orphan behaviour, signal handling and file locking are process properties. A mocked suite can demonstrate all five properties and prove none of them. | 5.1 requires real processes on every declared platform, and 5.2 requires the evidence protocol to red against an emptied suite and against a foreign-revision result. | Phase 5 — Prove the five lifecycle properties on real processes |
| 5 | The rollback matrix reads as coverage while five of its seven rows are unenforced | implementation | 3.1 landed the seven-row trigger matrix and two rows are enforced today (1 and 5); the other five carry `OWED BY` against steps 5.1, 5.1, 3.2, 4.2 and 5.2 — Phases 3, 4 AND 5, not Phases 4 and 5. Step 3.1 already writes the caveat into its own prose, so this row PROMOTES an existing observation into the register where its closure can be tracked; it does not discover it. What distinguishes it from risk 1 is the failure shape: not a check that ran and proved nothing, but a control that is named and not yet wired. | 3.1 annotates every test cell with `EXISTS` or `OWED BY <step>` so a name is not mistaken for coverage, and AC-6 is left `[ ]` with its met clause separated from its two open ones. Two bounds on the exposure and one open question, stated rather than smoothed: it closes at FOUR different steps (3.2, 4.2, 5.1, 5.2), so "the matrix is wired" is not a single event; and under `mode: phase-checkpoints` 3.2 lands before Phase 4, leaving four unwired rows at ship time rather than five. If instead 3.2's `verify:` cannot run before the collector exists, then Phase 3 is blocked on Phase 4 and THAT ordering conflict is the thing to resolve — this row names it rather than absorbing it. | Phase 3 — The operational contract, Phase 4 — Implement |
| 6 | The measurement is treated as a code checkpoint | product | Capture rate needs a representative window. A phase that closes when the code lands has measured nothing, and the observation cannot be compressed. | 6.1 is its own step gated on the window and minimum sample from 1.2, and this roadmap is deliberately separate from governance so its slower clock does not hold that one. | Phase 6 — Measure, then decide |
| 7 | The wedge is spent on a telemetry collector | product | "Nothing else installed" is a product commitment. An OS service manager costs it, and the cost would be paid by the least important feature that could pay it. | The supervisor blocker names the trade-off explicitly and recommends against the service-manager option for exactly this reason. | Phase 1 — Decide the architecture before writing the schema |
| 8 | Enablement is decided on the capture target alone | product | 6.2's target is the product signal. Green on it while a resource budget is breached or a platform's lifecycle suite fails would ship an unsafe default. | 6.2 requires all six readings recorded, and a missing reading blocks the flip rather than defaulting to pass. | Phase 6 — Measure, then decide |

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
- [x] AC-6 — Every rollback-trigger row has an activation mechanism, an owner, a recovery procedure and a named test; resource budgets are numbers with headroom; and the kill switch has been exercised against an unresponsive process.
      MET by 3.1, 3.2 and 3.3. **The rationale below is REWRITTEN, and the rewrite is itself a finding** (R2 finding 12): it still said the second and third clauses "are OPEN: both need the collector, which is Phase 4" while the same file marked 3.2, 3.3 and all of Phase 4 `[x]` and opened with "Phases 1 to 5 complete and verified". That is this roadmap's own § 4 silent-green discipline running in reverse — understating rather than overstating — and it is equally uncheckable.
      Clause 1: seven rows, four columns each, no empty test cell, each test carrying its state (`EXISTS` with the file, or `OWED BY <step>`). Clause 2: `RESOURCE_BUDGETS` carries four ceilings with a derived headroom apiece, two of them re-measured after the first real daemon start falsified the derivation. Clause 3: `collector_supervision.test.ts` § 3.3 kills a REAL wedged process — a grandchild that installs a `SIGTERM` handler and ignores it — and asserts `via: 'forced'` plus ESRCH afterwards.
      Two of the 3.1 matrix's seven test cells were `OWED BY` a Phase-5 step when it was written and are now `EXISTS`: rows 2 and 3 are covered by `collector_lifecycle.test.ts` PROPERTIES 1 and 3. Rows 4, 6 and 7 are covered by 3.2's budget tests, 4.2's parity comparison and 5.2's seeded negatives respectively. The matrix text still reads `OWED BY`, which is now stale in the safe direction and is left for the resumer rather than rewritten from a step that is closed.
- [x] AC-7 — Static operation is proven unregressed both with the collector absent and with it present-but-off, by comparing the two runs.
      MET by 4.2. `./scripts-run src/scripts/check_static_parity` ran every dispatcher-reaching test file twice — present-but-off, then with `collector_denominator` aliased to a do-nothing stub so the real module is never loaded — and COMPARED them per test: identical verdicts, both exit 0. Two green runs would not have satisfied this; a test silently turning from `passed` to `skipped` keeps both suites green and only the per-test comparison sees it. The gate now runs in CI (`Collector Lifecycle` job), which it did not when this AC was first evidenced — R2 finding 5 caught that the evidence was a hand-run nothing could reproduce.
- [ ] AC-8 — The five lifecycle properties are demonstrated by process-level tests on every declared platform, executed in CI on each — a skip counts as a failure on that platform.
      PARTLY MET, and deliberately NOT flipped. The five properties are demonstrated on real spawned processes (5.1) and the `Collector Lifecycle` job executes them in CI on `macos-latest`, where a skip fails the job because `run_lifecycle_suite` exits non-zero on any skipped case. The criterion says **every declared platform**, and the second declared row — Linux with a user session bus — is not run and is not runnable on a GitHub-hosted runner. Per the `lifecycle-ci-runner-provisioning` (b) verdict that row is recorded **unverified** and stays out of release claims even if its static fallback appears to work. Flipping this on one of two rows is exactly the silent-green this roadmap exists to avoid; it closes when option (a) — a runner with a real user session bus — is provisioned.
- [x] AC-9 — The evidence protocol reds against an emptied suite and against a result from a different revision, both observed.
      MET by 5.2. `check_supervision_claim_atomicity --self-test` reports `7/7 case(s) behaved (5 rejecting, floor 7)`, and two of those five rejections are precisely the seeded negatives this AC names: *"an emptied suite — every case skipped, none run"* and *"a result recorded against a different revision"*, both exit 1. Seeded rather than real, because the real tree makes no present-tense supervision claim and the gate is therefore vacuous against it — reporting that vacuous pass as evidence would have been the available mistake. The producer (`run_lifecycle_suite`) and the reader now run in the SAME CI job, which R2 finding 1 established they did not: the artifact was written in `tests.yml` and read in `rule-backstops.yml`, across a workflow boundary with no shared filesystem, so the chain could never close.
- [ ] AC-10 — The capture rate is measured over the declared window at or above the minimum sample, and the outcome is acted on: all six enablement readings recorded and the default flipped, or default-off plus a decision record naming the reading and the chosen disposition.
