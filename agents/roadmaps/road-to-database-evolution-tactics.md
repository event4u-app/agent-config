---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: >
  One of four siblings split from a single inbox drop carrying 24 verified
  defect claims. This one holds schema-evolution tactics and the measurement
  layer the whole campaign depends on; rule 11 forbids folding it into the
  modeling sibling, whose subject is design rather than rollout, and rule 1
  caps a structural roadmap at 1000 lines.
estate_growth_exempt: >
  Two blockers were discovered during verification rather than proposed by the
  inbox artifact: promoting any new linter rule to gate tier requires a
  pre-registered spike per rule, and the waiver kind three proposals depend on
  does not exist in a closed union that would have to be widened.
---
# Road to database evolution tactics

> **Source:** `agents/tmp.old/database-structure/` — four database roadmap
> proposals from two parallel external LLM sessions plus two competing
> consolidations, dropped 2026-08-26. The tactics claims (D7, D16, D18, D19,
> D21) were re-verified against HEAD `1899f92b9`; all hold, and five
> engine-behaviour halves across the campaign are unverifiable offline, which is
> why this roadmap ends in a measurement phase rather than in an assertion.

## Goal

A schema change in this package is planned by escalating from the cheapest
adequate strategy, and the plan states the evidence that would make the next
rung necessary. Where a table must be rebuilt without downtime, the tactic is
named — clone, apply, sync, verify, swap — and the verification has a divergence
budget and an abort criterion rather than a hope. Where a schema moves between
engines, the divergences that silently corrupt data are checked rather than
remembered. When this is finished, every rule this roadmap promotes to a gate
has a pre-registered spike behind it, and every engine fact it states has either
a pinned citation or a measurement.

## Context

`src/skills/migration-architect/SKILL.md` (125 lines) is a strategy-shape layer
— anchor, systems, shape table, sequence, deprecation. It has no DDL-level
section by design, and nothing else in the tree fills that gap. Verified: a
grep for `ALGORITHM=`, `gh-ost`, `pt-online`, `pgroll`, `shadow table`,
`lock_timeout` or `statement_timeout` across `src/`, `docs/` and
`dist/agent-src/` returns **zero** domain hits (D7). `lock_timeout`,
`ACCESS EXCLUSIVE` and the retryable lock-timeout error code return zero (D16).
Cross-engine porting terms — `JSON_VALID`, `sql_mode`, `GTID`, `caching_sha2`,
and the invisible-index keywords as SQL rather than as prose — return zero
(D18). Managed-service terms return zero (D19). `history-design/SKILL.md:41`
names DB temporal tables generically, with a useful caveat at `:87-90` that no
engine syntax follows (D21).

One claim in the input registers is mislabelled and the correction changes this
roadmap's Phase 4. `src/scripts/_lib/persistence/adapter_raw_sql.ts:6-12` was
cited as "expand/contract rules already exist in the linter". It encodes
migration-**safety** rules — a destructive operation without a waiver, `NOT NULL`
without a default, index creation without the concurrent variant, a column type
change without a waiver — and the string "expand-contract" does not appear in
the file. So Phase 4 extends a safety linter, and the extension is harder than
the proposals assumed: `WAIVER_KINDS` is a closed `as const`
(`no-index`, `sync-required`, `accepted-loss`, `no-retention`,
`migration-unsafe`), `StackId` is a closed union keyed off file extensions, and
`docs/spikes/scale-history-spikes.md:21` states that `lint_persistence` gates
only where a spike with a pre-registered pass threshold has passed — unspiked
rules stay advisory.

Siblings, sharing the `road-to-database-` prefix: `-advice-correction` (stop
shipping folklore; independent, runs first), `-erd-landing` (land a finished ERD
capability), `-relational-modeling` (the modeling capability and its ownership
question).

## Provenance

- **Source A** — an external LLM ideation thread, four analysis loops.
  `ENC1:n37Vvuk8AEZHmidSo1ARDeBqPO5FWZiPEx4xsRnKXAH77thamSR51BjdOweQ5TUIlnggpcFFOzga3s9St4+ubTH+2oYCB0dGDeGsbH8THloswnlYqqkRxFTPpieCd7bkBRr2PPGj2e3ngmPKlrpiaKpm1gm0GC3RxXY=`
- **Source B** — a second external LLM ideation thread, six loops plus a harvest
  of ten external skill collections.
  `ENC1:uwPcFwnylOcQB/u2WBmmK0YEXNGjYZuvh7DYzxJqJfQzfZDKOB0PxAHIYJ9EsrcG6wktnGWGlo0QBHBLCaHWOOPvdC1WC2eOY8FPM7LNO6r7nVD9kNcFK50kJAfO443D1QCLn2t89J0LOjVYwgjP8ZXmMX8Gv7tR0o33`
- The external tooling this roadmap describes is described as **patterns with
  reachability criteria**, and named as tools without being taken as
  dependencies. That distinction is both sources' own recommendation and it is
  kept: the online-schema-change tools, the multi-version-view approach, and the
  unsafe-migration linters are prior art for a shape, not software this package
  bundles or requires. ADR-216 Amendment E additionally forbids anchoring any
  gate in this tree on an external-adoption signal, which is why Phase 4's gate
  promotion rests on our own spikes and not on what the prior art enforces.

### Council convergence

AI council, 2026-08-26, members `anthropic/claude-sonnet-4-5` and
`openai/codex-default`, 3 rounds, blind chairman.

**Q2, live-engine evaluations — both seats kept them in scope and both refused
to park them.** This overrides the master consolidation, which parked them in
`later/`. `codex-default`: *"Only execution against real engines can resolve the
five engine-behaviour claims explicitly identified as unverifiable offline"*,
and parking *"would turn known uncertainty into permanent debt"*. Both required
the same shape — a non-gating stage — and both insisted the abort criteria be
numbers rather than a promise. `claude-sonnet-4-5` named the failure mode
precisely: *"live-engine checks ship → hit platform limits in CI → fail
unpredictably → get disabled emergency-style instead of via stated threshold"*.
`codex-default` added the distinction Phase 5 encodes: infrastructure
unavailable must read `not-run`, an assertion failure is a real finding, and a
timeout or nondeterminism is a harness defect — *"collapsing these into 'advice
unavailable' would conceal engine regressions"*. Both proposed concrete initial
thresholds; the two sets differ (flake above 10% over 100 runs versus above 2%
over 50), so Phase 5 records both and calibrates rather than picking silently.

**Sequencing.** `codex-default` placed rule promotion last of eleven steps —
*"promote individual rules only after their rule-specific spikes pass"* — and
put live-engine evaluations immediately before it. Phases 4 and 5 follow that
order.

## Gap table

| Proposed item | Verified state | Disposition |
|---|---|---|
| Escalation ladder: additive → expand/contract → native online DDL → clone-and-swap → parallel schema → change capture | `migration-architect` has the strategy shapes; zero DDL-level content anywhere (D7) | **KEEP** — as a tactics reference under the existing shape layer |
| The lock-queue lesson: a fast DDL statement queued behind a long read blocks everything behind it | zero hits for `lock_timeout`, `ACCESS EXCLUSIVE`, the retryable timeout code (D16) | **KEEP** — the mechanism, stated engine-neutrally, with the engine specifics deferred to Phase 5 |
| Batched, throttled backfill outside the DDL transaction | absent | **KEEP, extended** — the fuller contract from the second consolidation adds keyset pagination, a checkpoint watermark, retry idempotency, resumability and replica-lag awareness |
| Clone-and-swap with live change propagation and reconciliation | absent | **KEEP** — including the point both consolidations make: a copy alone is not a blue/green cutover |
| Parallel old-and-new schema via multi-version views | absent | **KEEP as a pattern with reachability criteria**, not as a tool dependency |
| Reconciliation with a divergence budget and an abort criterion | absent; only one of the two consolidations carries it | **KEEP** — this is the exit gate, and without a budget and an abort rule it is not one |
| Cross-engine porting checklist | zero hits for every named divergence term (D18) | **KEEP** |
| Managed-service guardrail | zero hits tree-wide (D19) | **FOLD** into `-relational-modeling` Phase 2, where hosting detection lands; the tactics here inherit it |
| Engine temporal-table syntax and its traps | `history-design:41` generic; `:87-90` already carries the engine-support caveat (D21) | **KEEP as a reference under `history-design`**, and it earns its place twice — the point-in-time comparison is also a verification probe for an in-place migration |
| New linter rules at gate tier | `lint_persistence` gates only where a pre-registered spike passed; unspiked rules stay advisory | **KEEP the rules, CUT the assumed tier** — each rule needs its own spike first |
| An `expand-contract` waiver kind | `WAIVER_KINDS` is a closed `as const` without it | **KEEP as a schema change with a stated cost**, not as a comment convention |
| A `porting` adapter for `lint_persistence` | adapters are keyed off a resolved stack detected by file extension; "porting" is not a stack | **KEEP, reshaped** — a rule within an existing stack adapter, not a new stack |
| Change-data-capture tooling as a rung | named by both sources as the last resort | **KEEP as the ladder's top rung only** — no procedure, because nothing in this package needs one yet |
| Live-engine evaluations | five engine claims unverifiable offline | **KEEP, non-gating** — the council refused parking |
| Three reviewer subagents for query, schema and migration review | `schema-review` exists | **CUT** — duplicate surface |

## Phase 1 — The escalation ladder and the lock mechanism

- [ ] **1.1 Write the ladder as an ordered decision with a promotion rule.**
      Additive change, then expand/contract, then native online DDL, then
      clone-and-swap, then parallel schema, then change capture. The content is
      not the list — it is the rule that each rung requires stated evidence that
      the rung below is inadequate. A plan that starts at clone-and-swap without
      that evidence is over-engineered, and the reference must say so.
      verify: the reference exists under `migration-architect`, and a fixture
      describing an additive nullable column produces the first rung with no
      further machinery.

- [ ] **1.2 State the lock-queue mechanism engine-neutrally.**
      A schema change that needs only a brief exclusive lock still needs it. If
      it queues behind a long-running read, every subsequent statement queues
      behind the schema change — so one slow query plus one fast DDL statement
      freezes the table. The discipline that follows: a short lock timeout, and
      a retry loop rather than a block. State the mechanism without asserting
      any engine's specific lock name or error code; those are Phase 5's to
      measure.
      verify: the mechanism is stated, and `grep -c "ACCESS EXCLUSIVE\|55P03" `
      over the new text is 0 pending Phase 5.

- [ ] **1.3 Write the backfill contract.**
      Seven requirements, not three: batched, throttled, outside the DDL
      transaction, keyset pagination rather than offset, a checkpoint watermark,
      idempotent retry, and resumable after interruption — plus replica lag as a
      throttling input where replicas exist.
      verify: the contract lists seven items, and a fixture backfilling a very
      large table is rejected when it uses offset pagination or has no
      watermark.

- [ ] **1.4 State when a rewrite is unavoidable.**
      A decision tree for the change classes that can be metadata-only versus
      those that rewrite the table, written as the questions to ask rather than
      as a per-engine answer table. The per-engine answers are Phase 5's.
      verify: the tree exists, its leaves are questions with a stated
      consequence, and it contains no unsourced engine-specific claim.

## Phase 2 — Clone, swap, and prove it

- [ ] **2.1 Write the clone-and-swap pattern with its four required parts.**
      Create the new-shape table, copy in batches, propagate concurrent changes
      while copying, then swap under a brief lock — and keep the old table for a
      stated rollback window. A copy without live propagation is not this
      pattern, and the reference must say which part is missing when a plan
      omits one.
      verify: a fixture describing a copy-then-rename with no propagation step
      is rejected, and the rejection names the missing part.

- [ ] **2.2 Write the parallel-schema pattern as a pattern with reachability criteria.**
      Old and new application versions reading one physical table through
      version-specific views. State what must be true for it to be reachable —
      view-updatability limits, the write path, the number of concurrent
      versions supported — so a plan can determine it does not qualify.
      verify: the criteria are stated as checks, and a fixture whose write path
      cannot be expressed through a view is excluded by them.

- [ ] **2.3 Make reconciliation an exit gate with a budget and an abort rule.**
      Row counts plus batched checksums between old and new, a stated tolerated
      divergence, a stated abort criterion, and the requirement that the swap
      does not proceed while divergence is unexplained. This is the step that
      makes the pattern safe, and the one consolidation that omitted it is the
      reason it is called out here.
      verify: the gate template exists with a budget field and an abort field,
      and a fixture cutover with no reconciliation gate is rejected.

- [ ] **2.4 Add the temporal-table reference under `history-design`, with its second use.**
      Engine syntax for system-versioned tables, the traps around truncation and
      history retention, and the operational caveat that already exists at
      `history-design:87-90`. Its second use is the one worth having: a
      point-in-time comparison is a verification probe for an in-place
      migration, not only a history feature. Engine syntax is stated only where
      Phase 5 measured it or a pinned citation exists.
      verify: the reference exists under `history-design`, cites the existing
      caveat rather than restating it, and every syntax claim carries a source.

## Phase 3 — Cross-engine porting

- [ ] **3.1 Write the porting checklist.**
      The divergences that corrupt data or behaviour silently when a schema or
      dump moves between engines: JSON stored as a native type versus as text
      and what must be re-validated after import, authentication plugin
      differences, the invisible-index keyword difference, replication
      identifier formats, strictness-mode differences, functional index support,
      enum semantics, and character-set and row-format traps including the
      index-key-length failure. Each entry states the symptom a user would
      actually see.
      verify: the checklist exists, every entry has a symptom line, and each
      engine-specific claim carries a pinned citation or is marked pending
      Phase 5.

- [ ] **3.2 Add the porting rules to an existing stack adapter, not a new stack.**
      `lint_persistence` adapters are keyed off a resolved stack detected by
      file extension; porting is not a stack and has no extension. The rules
      belong inside the existing SQL adapter, scoped by the dialect the finding
      applies to.
      verify: `grep -n "StackId" src/scripts/lint_persistence.ts` shows the
      union unchanged, and the new rules report with a dialect scope on their
      findings.

- [ ] **3.3 Ship the porting rules at advice tier.**
      No spike, no gate. A dump-shaped fixture with four seeded divergences
      surfaces four findings, each pointing at the checklist entry that explains
      it.
      verify: the fixture yields 4 of 4 findings with references, and the run
      exits 0 because the findings are advisory.

## Phase 4 — Linter rules, each behind its own spike

- [ ] **4.1 Register a spike per proposed rule before writing the rule.**
      Three candidates: a column or table rename without an expand/contract
      waiver, a constraint added without the non-validating two-step form on the
      dialects that have it, and a table alteration that states no algorithm or
      lock mode on the engines that accept one. Each needs a pre-registered pass
      threshold on a frozen corpus, per `docs/spikes/scale-history-spikes.md:21`.
      A rule without a passed spike ships as advice.
      verify: three spike entries exist with pre-registered thresholds and
      frozen corpora, recorded before any rule implementation lands.

- [ ] **4.2 Widen the waiver union deliberately, or drop the waiver.**
      `WAIVER_KINDS` is a closed `as const`. An `expand-contract` waiver means
      adding a member, which changes a shared contract every adapter reads — and
      the alternative is to reuse `migration-unsafe`, which already exists and is
      less precise. Decide with the cost stated, and if the union grows, the
      change is its own commit.
      verify: either `WAIVER_KINDS` contains the new member and every consumer
      compiles, or Notes records the decision to reuse the existing kind with
      its reason.

- [ ] **4.3 Promote only the rules whose spike passed.**
      Each promoted rule ships with the fixture triple the existing rules carry
      — a violation, a waived violation, and a compliant case — and its message
      names the safe alternative rather than only the prohibition.
      verify: `./scripts-run src/scripts/lint_persistence --self-test` passes,
      each promoted rule has three fixtures, and each unpromoted rule is
      registered as advice with its spike result recorded.

- [ ] **4.4 Leave the lock-queue rule out, and say why.**
      It is a runtime property, not a static one: no linter can see what a
      statement will queue behind. Recording the exclusion prevents a later pass
      from adding a rule that cannot work.
      verify: the exclusion and its reason are in Notes.

## Phase 5 — Measure, then state

- [ ] **5.1 Build the defect-seeding benchmark over the campaign's fixtures.**
      One pre-registered run across every fixture the four sibling roadmaps
      produced: missing junction table, wrong cardinality, cascade on a
      self-valued child, enum choice against product vocabulary, an unindexed
      foreign key on a small table, a rename without expand/contract, a cutover
      without reconciliation. Pre-register the pass rate; an honest null is a
      valid result and is recorded as one.
      verify: the benchmark runs, its pre-registered threshold and its actual
      result are both recorded, and the result is written to the claims surface
      whichever way it went.

- [ ] **5.2 Add the anti-expert class, where the folklore answer is the wrong one.**
      Cases whose correct answer contradicts a rule of thumb: a full scan that
      is optimal, a range column that must not lead a composite index, an
      irreversible migration whose roll-forward plan is acceptable, an index
      that should not be created. This class is what distinguishes knowing the
      rules from knowing when they do not apply.
      verify: the class exists with at least four cases, each naming the
      folklore answer it must not give.

- [ ] **5.3 Add the live-engine stage, non-gating, with three distinguishable outcomes.**
      Deterministic pre-authored fixtures against pinned engine images. The
      outcomes must not collapse into one: infrastructure unavailable reads
      `not-run` and never `pass`; an assertion failure is a real finding; a
      timeout or nondeterministic result is a harness defect. Collapsing them
      would hide exactly the engine regressions the stage exists to catch.
      verify: the stage emits three distinguishable statuses, and a run with the
      runtime absent reports `not-run` rather than passing.

- [ ] **5.4 Calibrate the abort thresholds instead of choosing one silently.**
      The council proposed two threshold sets — one seat above 10% flake over
      100 runs, the other above 2% over 50 — and a per-fixture runtime ceiling
      with a consecutive-breach count. Record both, run the calibration, and set
      the initial numbers from the observed distribution.
      verify: both proposals and the observed flake and runtime distributions
      are recorded, and the adopted thresholds cite the observation.

- [ ] **5.5 Fill in the engine facts the earlier phases deferred.**
      Every claim marked pending in Phases 1–3 either becomes a measured fact
      with its fixture, or a pinned upstream citation, or stays a question. A
      fact with neither does not ship.
      verify: `grep -rn "pending Phase 5" ` across the artefacts this campaign
      added returns nothing, and each formerly pending claim cites a measurement
      or a source.

- [ ] **5.6 Ratchet what the benchmark established.**
      No DB-family skill changes without a trigger eval, and a dialect claim
      without a version qualification is a review finding.
      verify: the ratchet is registered in the gate ledger and fails on a
      seeded violation.

## Blockers

### blocker: gate-tier-needs-a-spike-per-rule
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 4.3's promotion branch. Phases 1, 2, 3, 5 and steps 4.1, 4.2
  and 4.4 run without it.
- **What to do:** `docs/spikes/scale-history-spikes.md:21` makes gate tier
  conditional on a spike with a pre-registered pass threshold on a frozen
  corpus; unspiked rules stay advisory. Three rules are proposed, so three
  spikes are needed, and a spike can fail. Decide whether to run all three
  before any promotion, promote incrementally as each passes, or ship all three
  as advice and revisit after the Phase 5 benchmark. Shipping at advice tier is
  not a failure state — `-advice-correction` exists because wrong-but-confident
  guidance is more expensive than absent guidance.
- **Resolved when:** each of the three candidate rules is either promoted with a passed spike recorded, or registered at advice tier with its spike result recorded.
- **Recommendation:** ship all three at advice tier now and revisit after the Phase 5 benchmark. Advice that names the safe alternative is already most of the value, and a false-positive-heavy gate gets waived rather than fixed.
- **If you do nothing:** either the rules are promoted without their spikes — turning the waiver mechanism into noise the first time one misfires — or they are not written at all and the tactics reference has no enforcement behind it.

### blocker: waiver-union-change-is-a-shared-contract
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 4.2 only.
- **What to do:** `WAIVER_KINDS` is a closed `as const` read by every
  persistence adapter, and `FailureClass` is closed the same way. Adding an
  `expand-contract` kind touches a contract shared beyond this campaign; reusing
  the existing `migration-unsafe` kind costs nothing structurally and loses the
  distinction between "this destroys data deliberately" and "this renames
  without a compatibility window". Decide which, with the cost stated.
- **Resolved when:** either `WAIVER_KINDS` carries the new member and every consumer compiles, or `## Notes` records the decision to reuse `migration-unsafe` with its reason.
- **Recommendation:** reuse `migration-unsafe`. It already exists, every adapter reads it, and the lost precision is one word in a message the rule can carry itself.
- **If you do nothing:** step 4.2 stalls, and the rename rule from 4.1 has no waiver to name — so a legitimate expand/contract rename has no compliant way past the rule.

### blocker: live-engine-stage-needs-a-runtime-decision
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 5.3 only. Steps 5.1, 5.2, 5.4, 5.5 and 5.6 run without it,
  and 5.5 falls back to pinned citations where a measurement is unavailable.
- **What to do:** the stage needs pinned engine images and somewhere to run
  them. The council was convergent that the stage must exist and must not be
  parked, and equally clear that it must never gate and must report `not-run`
  where the runtime is absent. What is undecided is the runtime itself: a CI
  container stage, a maintainer-local target invoked deliberately, or a
  scheduled run. Decide the host, and with it who bears the cost and how a
  platform without container support is reported.
- **Resolved when:** `## Notes` names the runtime host, and a run with the runtime absent is shown reporting `not-run` rather than passing.
- **Recommendation:** a maintainer-local target invoked deliberately, not a CI stage. It keeps the cost visible, keeps the flake out of the pull-request path, and the council's `not-run` requirement makes the absent-runtime case honest by construction.
- **If you do nothing:** the five unverifiable engine claims stay unverifiable, every engine fact in the campaign stays deferred forever, and step 5.5 can never close.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The tactics reference states engine behaviour it never measured | product | This is the campaign's central hazard, and it is the same defect `-advice-correction` exists to remove. Online-DDL semantics, metadata-only change classes, lock names, error codes and invisible-index keywords are version-dependent, and five such halves from the input registers were explicitly recorded unverifiable. A confident wrong tactic is worse than no tactic, because it is acted on. | Phases 1–3 state mechanisms and questions and are forbidden from asserting engine specifics; every deferred claim is marked pending and step 5.5 requires a measurement or a pinned citation before it ships. The verify on 1.2 and 1.4 is the absence of such claims, not their presence. | Phase 1 — The escalation ladder and the lock mechanism |
| 2 | The ladder is read as a menu and plans start too high | product | Clone-and-swap reads as thorough and expand/contract reads as a compromise, so a plan that reaches for the heavier rung looks more careful. It is not: it is more moving parts, a longer window, and a reconciliation step that can itself be skipped. | 1.1's promotion rule requires stated evidence that the rung below is inadequate, and its verify is a fixture where the correct answer is the cheapest rung with no further machinery. | Phase 1 — The escalation ladder and the lock mechanism |
| 3 | A cutover ships without a real reconciliation gate | implementation | 2.3 is the step that makes clone-and-swap safe, and it is the easiest to satisfy nominally — "checksums verified" with no budget, no abort rule and no statement of what unexplained divergence means. One of the two input consolidations omitted the gate entirely, which is evidence of how easily it goes missing. | 2.3's template requires a budget field and an abort field, and its verify rejects a cutover fixture that has no gate. 2.1's verify independently rejects a plan missing live propagation. | Phase 2 — Clone, swap, and prove it |
| 4 | Rules are promoted to gate tier without their spikes | implementation | A rule that reads obviously-correct invites promotion, and the spike requirement is documentation in a spikes file rather than something that fires. A false-positive-heavy gate gets waived rather than fixed, and then the whole waiver mechanism loses meaning. | 4.1 registers the spikes **before** any rule is written, 4.3 promotes only what passed, and `blocker: gate-tier-needs-a-spike-per-rule` names advice tier as an acceptable outcome so the pressure to promote has somewhere to go. | Phase 4 — Linter rules, each behind its own spike |
| 5 | The live-engine stage becomes unreliable and is switched off in an emergency | implementation | Named by the council: the stage ships, meets platform limits, fails unpredictably, and gets disabled ad hoc instead of via a stated threshold — after which the engine facts are unverified again but nobody notices, because the stage still exists on paper. | 5.3 requires three distinguishable outcomes so an infrastructure failure can never read as a pass, and 5.4 sets the abort thresholds from an observed distribution before the stage is relied on. `blocker: live-engine-stage-needs-a-runtime-decision` forces the host to be chosen rather than assumed. | Phase 5 — Measure, then state |
| 6 | The benchmark is run, comes out flat, and is quietly not recorded | product | 5.1 is the measurement the whole campaign's value claim rests on. A null result is the outcome most likely to go unwritten, and the pre-registration is what makes it costly to omit. | 5.1's verify requires both the pre-registered threshold and the actual result to be recorded, and the result written to the claims surface whichever way it went. An honest null is named as valid in the step itself. | Phase 5 — Measure, then state |
| 7 | Widening the waiver union breaks consumers of a shared contract | implementation | `WAIVER_KINDS` and `FailureClass` are closed unions read by every persistence adapter. A member added for this campaign's convenience is a contract change with a blast radius outside it. | 4.2 requires the change to be its own commit with every consumer compiling, and `blocker: waiver-union-change-is-a-shared-contract` puts reusing the existing kind on the table as the cheaper option. | Phase 4 — Linter rules, each behind its own spike |

## Acceptance Criteria

- [ ] AC-1 — A tactics reference exists under `migration-architect` whose ladder requires stated evidence before each escalation, and the additive-column fixture resolves at the first rung.
- [ ] AC-2 — The backfill contract lists seven requirements, and an offset-paginated backfill fixture over a very large table is rejected.
- [ ] AC-3 — A clone-and-swap plan without live change propagation is rejected with the missing part named, and a cutover without a reconciliation gate carrying a divergence budget and an abort criterion is rejected.
- [ ] AC-4 — The porting checklist covers the verified-absent divergence classes, every entry states a user-visible symptom, and a seeded dump fixture yields 4 of 4 findings with references.
- [ ] AC-5 — `grep -n "StackId" src/scripts/lint_persistence.ts` shows the union unchanged and the porting findings carry a dialect scope.
- [ ] AC-6 — Every rule at gate tier has a pre-registered spike with a recorded result; every rule without one ships as advice, recorded as such.
- [ ] AC-7 — The defect-seeding benchmark ran once with a pre-registered threshold, its result is on the claims surface, and the anti-expert class carries at least four cases each naming the folklore answer it must not give.
- [ ] AC-8 — The live-engine stage reports three distinguishable outcomes, reports `not-run` with the runtime absent, never gates, and its abort thresholds cite an observed distribution.
- [ ] AC-9 — `grep -rn "pending Phase 5"` across the artefacts this campaign added returns nothing, and every engine-specific claim cites a measurement or a pinned upstream source.

## Notes

The waiver-union decision from 4.2, the lock-queue exclusion reason from 4.4,
and the adopted abort thresholds from 5.4 belong here once taken.
