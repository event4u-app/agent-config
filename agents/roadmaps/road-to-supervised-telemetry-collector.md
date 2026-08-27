---
complexity: structural
status: draft
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
estate_growth_exempt: "Charges +1 on one-in-one-out and +0 on the count half (status: draft). Warranted on a council instruction rather than an opinion: both seats (2/2, deep pass, 2026-08-27) required the telemetry delivery to either move fully into the governance roadmap with its own acceptance criteria or become a formally related dependency with its own — and named the concrete failure of leaving it folded, that two roadmaps would share ownership of one rollback with no answer to which closes when measurement is inconclusive. Draft rather than ready because three architecture decisions below are undecided, and the owner decision that authorises runtime does not make them."
estate_offset_exempt: "The offset is the governance roadmap flipping ready to draft in this same change, which removes it from the active count — this file replaces it there rather than adding beside it. No archive move is available."
---
# Road to a supervised telemetry collector — the first resident process, and the eight things the owner decision does not decide

> **Source:** split out of `road-to-runtime-governance-flip.md` on 2026-08-27
> after a deep council pass (2/2, both seats "not ready"). The originating
> analysis is `agents/tmp.old/uncle-bob-swarm/`; the durable record of the owner
> decision and the surface census is
> `agents/evidence/analysis/runtime-reversal-owner-decision.md`.

> **Hard dependency:** `road-to-runtime-governance-flip.md` Phase 1. Nothing
> here is buildable while `ADR-124:111` stands.

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

## Phase 1 — Decide the architecture before writing the schema

- [ ] **1.1 Resolve the three blockers.** Supervisor mechanism and platform
      scope, uniqueness namespace, activation model. Every later phase reads
      their answers; none can be inferred from the owner decision.
      verify: each of the three blocker sections carries a `Status:` starting with `resolved` and names the chosen option.
- [ ] **1.2 Write the metric definition first, not the collector.** The
      denominator, what counts as an eligible dispatch, exclusions,
      deduplication, how startup failures and opt-outs are treated, the minimum
      sample, the observation window, and the decision rule. Without these,
      "capture rate" is not a measurable quantity and the target in 1.3 is
      unfalsifiable.
      verify: the definition names all nine and a second reader can compute the current rate from it without asking a question.
- [ ] **1.3 Record the target before anything is built.** A number, with the
      window it is measured over, committed in this file.
      verify: the target and window appear in this roadmap in a commit that precedes the first collector commit — by commit order, not by assertion.

## Phase 2 — The data contract, field by field

- [ ] **2.1 Build the schema as an allowlist with per-field purpose.** "No
      free-form field" is necessary and **not sufficient** — a council seat
      listed the leaks structured fields still carry: repository and worktree
      identifiers, command names and arguments, error enums with interpolated
      values, hashes stable enough to identify a user or repo, timestamps
      combined with a machine identifier. Every field states its purpose, its
      cardinality limit, and why a coarser form does not suffice.
      verify: each field has a purpose line, and a test asserts an unknown field is REJECTED rather than dropped.
- [ ] **2.2 Test the privacy boundary with fixtures, not with a rule.** Named
      serialization fixtures for the leak classes in 2.1, each asserting the
      record cannot carry it.
      verify: a fixture exists per named leak class and each one fails when the corresponding field constraint is removed — a constraint never seen enforced has unknown sensitivity.
- [ ] **2.3 Implement deletion and opt-out, then test them.** AC-7 of the
      governance roadmap's first draft required these to be *documented*. A
      documented deletion path that nobody executed is a claim.
      verify: a test deletes a machine's records through the supported path and asserts the store no longer serves them; a second asserts opt-out prevents the write rather than filtering the read.
- [ ] **2.4 Write the upgrade and schema-rollback contract.** Forward and
      backward compatibility, what an older package does when it meets newer
      records, whether a rollback migrates or quarantines, what uninstall
      removes, and recovery after a crash mid-migration.
      verify: a test drives each of those five transitions over a seeded store.

## Phase 3 — The operational contract

- [ ] **3.1 Write the rollback trigger matrix.** Each trigger names its
      activation mechanism, its owner, its recovery procedure, and its test.
      The minimum set, from the council: privacy-contract violation (immediate
      disable and quarantine) · orphan or duplicate collector (disable
      activation) · crash-loop threshold exceeded (bounded retries, then static
      fallback) · CPU, memory or disk budget exceeded (stop) · incompatible
      schema or failed migration (preserve without reading or rewriting) ·
      static-mode regression (block release) · lifecycle-suite failure on any
      supported platform (prohibit the public capability claim).
      verify: every row has all four columns filled and a test named; a row with an empty test column fails this step.
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

- **Status:** open
- **Owner:** maintainer
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

- **Status:** open
- **Owner:** maintainer
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

- **Status:** open
- **Owner:** maintainer
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

- [ ] AC-1 — All three blockers carry a `resolved` status naming the chosen option, and the supported platform list is written down.
- [ ] AC-2 — The metric definition answers all nine questions from 1.2, and the target plus window were committed in a commit preceding the first collector commit — checked by commit order.
- [ ] AC-3 — Every schema field carries a purpose and a cardinality limit; an unknown field is rejected rather than dropped; and a serialization fixture exists per named leak class, each proven to fail when its constraint is removed.
- [ ] AC-4 — Deletion and opt-out are exercised by tests, not documented: records are gone after deletion, and opt-out prevents the write rather than filtering the read.
- [ ] AC-5 — The five upgrade transitions in 2.4 are driven by tests over a seeded store.
- [ ] AC-6 — Every rollback-trigger row has an activation mechanism, an owner, a recovery procedure and a named test; resource budgets are numbers with headroom; and the kill switch has been exercised against an unresponsive process.
- [ ] AC-7 — Static operation is proven unregressed both with the collector absent and with it present-but-off, by comparing the two runs.
- [ ] AC-8 — The five lifecycle properties are demonstrated by process-level tests on every declared platform, executed in CI on each — a skip counts as a failure on that platform.
- [ ] AC-9 — The evidence protocol reds against an emptied suite and against a result from a different revision, both observed.
- [ ] AC-10 — The capture rate is measured over the declared window at or above the minimum sample, and the outcome is acted on: all six enablement readings recorded and the default flipped, or default-off plus a decision record naming the reading and the chosen disposition.
