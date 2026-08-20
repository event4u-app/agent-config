# Council decisions — autonomous drain run, blocker dispositions (batch B)

<!-- evidence-type: analysis -->

Session: 2026-08-20. Members: anthropic (claude-sonnet-4-5), openai (codex-default).
Quorum 2/2. Framework: see `drain-blocker-dispositions-a.md` (adopted round 1,
both seats convergent) — the five dispositions A/B/C/D/E, the four outcome
states, the categorical Rule 3, the measured-null distinction, duplicate-evidence
merging, and the three-point stub-integrity check.

Both seats returned a full table this round. Where they diverged the adopted
value is named below with the dissent recorded, never dropped.

## Divergences and what was adopted

| Blocker | openai seat | anthropic seat | Adopted | Why |
|---|---|---|---|---|
| `b-guard-tool-partition` | D (c) decline | D (b) advisory-only | **decline the Claude-only partition** | Both refuse to ship the partition; (c) is the narrower of the two. |
| `b-injection-scan-unwrap-security` | D (a) contract + fixtures, then fix | B transferred | **D (a)** | (a) *is* the "establish the contract first" the dissent asks for, and it is executable now. |
| `b-payload-read-parse-dominates` | D (a) add isolated read-and-exit cell | C accept the Phase-2 null | **D (a)** | The null falsified the earlier attribution; it did not show the remaining latency unavoidable. Dissent recorded. |
| `b-stop-async-split-prerequisites` | D (a) P3 then P4 then P1/P2 then P5 then split | D (c) cancel the split | **D (a)** | Sequencing preserves the outcome; cancelling discards it. Dissent recorded. |
| `cross-vendor-worker-slices` | D approve report-only under a deny-by-default policy | B stub the direction policy first | **write the direction policy, then approve report-only** | Both require the policy artefact to exist first; this is the merge, not a pick. |
| `evidence-compaction-approval` | D abandoned, no compaction, cancel step 3.3 | D narrowed, no compaction, tiering only | **no compaction** | Converged on the action; the outcome state is `abandoned` for step 3.3 itself. |

## Adopted table (openai seat, with the six overrides above applied)

```text
b-consolidated-decision-sheet | D | satisfied | Accept all thirteen rendered defaults and record option (a).
b-guard-tool-partition | D | abandoned | Choose (c): decline the Claude-only partition and cancel the zero-dispatch outcome.
b-injection-scan-unwrap-security | D | narrowed | Choose (a): specify the envelope contract and fixtures before narrowing the scanner input.
b-payload-read-parse-dominates | D | satisfied | Choose (a): add the isolated read-and-exit measurement cell.
b-per-turn-composite-bar | D | narrowed | Choose (b): register the composite as observe-only for one release.
b-stdin-read-failure-policy | D | satisfied | Choose (c): deny failed reads only on block-capable slots with fail-closed concerns.
b-stop-async-split-prerequisites | D | satisfied | Choose (a): land P3/P4, then P1/P2, then gate the split on P5 live evidence.
kernel-cross-link-soak | B | transferred | Move the guarded kernel edits, baseline update, merge, and post-merge soak into one maintainer-owned stub.
maintainer-blind-ratings | B | transferred | Move both blind readings and their Ü2/Ü3 verdicts into one human-rating stub.
first-contract-true-analysis-run | B | transferred | Move the external-fetch run and confidential evidence handling into a maintainer-owned stub.
router-head-retrofit-instrument | D | narrowed | Restructure the three K6 offenders on the published cap without making a token-savings claim.
merge-queue-enablement | B | transferred | Move queue enablement and merge_group validation into a repo-admin stub.
required-check-set-change | B | transferred | Move ADR acceptance, ruleset mutation, and policy-document synchronization into a repo-admin stub.
manual-rubric-rater | B | transferred | Move blind primary scoring and its ordering proof into a human-rater stub.
cross-vendor-worker-slices | D | satisfied | Approve report-only workers under a deny-by-default cross-vendor direction policy.
f4-full-stop-block | B | transferred | Move live delivery verification, telemetry calibration, and the block/advisory choice into a host-evidence stub.
gate-council-auto-dispatch | B | transferred | Move soak validation, telemetry collection, and guarded auto-dispatch into one re-entry stub.
point-of-action-carrier | B | transferred | Move the real-host discrimination spike and resulting build/no-build decision into a host-probe stub.
team-telemetry-behind-flag | B | transferred | Move the flagged-environment spike and concern binding into an experimental-host stub.
b-delegate-gate-maintainer-profile | D | narrowed | Choose (b): enable the team surface for consultation, keep allow_delegate false.
b-gate-budget-preauth | D | satisfied | Choose (a): cap class-1 gates at USD 5 per run and USD 25 per rolling seven days.
evidence-compaction-approval | D | abandoned | Choose (a): perform no compaction and cancel step 3.3.
```

### b-consolidated-decision-sheet
**Rationale** — The council has delegated authority for all thirteen decisions; accepting the prepared defaults is the fastest valid closure.
**For D** — Option `(a) accept all defaults`; write every answer at its originating blocker and record option `(a)` on the sheet.

### b-guard-tool-partition
**Rationale** — Guard filtering introduces host-specific coverage risk for a performance optimization that no active step requires.
**For D** — Option `(c) decline`; retain Phase 4 measurement and the shipped in-process `tools:` filter. Outcome `abandoned` applies to the zero-dispatch goal.

### b-injection-scan-unwrap-security
**Rationale** — The current fallback obscures the security contract; narrowing it safely requires executable payload-shape definitions first.
**For D** — Option `(a)`; valid fixtures cover each supported output key, missing output, malformed envelopes, and unrelated root text; then fix `_tool_output`, with a regression test failing against the old unwrap.

### b-payload-read-parse-dominates
**Rationale** — The existing measurements identify the pre-dispatch boundary but do not separate transport from parsing and concern execution.
**For D** — Option `(a)`; add a same-fixture dispatcher cell that reads stdin and exits immediately, reporting its latency and share of the large-payload delta.

### b-per-turn-composite-bar
**Rationale** — The proposed 1.5-second ceiling has no empirical prior and should not become a release claim by fiat.
**For D** — Option `(b)`; mark `(pre + post) × 10 + ups + stop` observe-only for one release, then derive an absolute ceiling and pathology net from that distribution.

### b-stdin-read-failure-policy
**Rationale** — A block-capable slot must preserve fail-closed semantics, while denying on advisory events adds availability risk without enforcement value.
**For D** — Option `(c)`; on a read failure, deny only when the slot is block-capable and at least one selected concern is both blocking and `fail_closed: true`; test `EAGAIN` exhaustion, `EIO`, and `EBADF`.

### b-stop-async-split-prerequisites
**Rationale** — P3 and P4 are correctness defects independent of async dispatch; shipping the split before fixing them creates corruption and lost-update paths.
**For D** — Option `(a)`; sequence P3 → P4 → combined P1/P2 → P5 live host check → split. No split may ship before all three P3 files pass concurrency regression tests.

### kernel-cross-link-soak
**Rationale** — Rule 3 requires B because bypassing the kernel write guard and merging the dedicated PR are externally controlled actions.
**For B** — Original criterion: “both edits are merged and the soak has elapsed.” Move Phase 3 Steps 6 and 7, the cross-link acceptance criterion, baseline regeneration, dedicated PR merge, and required post-merge soak. Re-entry producer: repository maintainer via the override-exception registry; probe: merged PR diff contains both `../../docs/` links and the ease tripwire, `kernel-prefix.json` is clean after regeneration, and merge timestamps satisfy the spacing rule.

### maintainer-blind-ratings
**Rationale** — Blind human judgments cannot be substituted with an architectural choice or inferred from existing nulls.
**For B** — Original criterion: “both readings exist, and each of Ü2 / Ü3 carries an adopt-or-honest-null verdict rather than a deferral.” Move Ü2 R1, Ü3 R2, and Phase 3’s Ü2/Ü3 merge-or-null work. Re-entry producer: named maintainer blind rater; probe: timestamped R1/R2 records exist before arm disclosure and each has an adopt-or-null verdict.

### first-contract-true-analysis-run
**Rationale** — The run crosses the external-fetch and raw named-evidence trust boundaries.
**For B** — Original criterion: “one evidence artefact exists that was produced by the command rather than by an ad-hoc pass.” Move Phase 2 Step 1, the authorized command run, local-only handling, and any anonymized publication. Re-entry producer: repository maintainer operating the approved fetch environment; probe: command provenance and a confidentiality classification accompany the artifact.

### router-head-retrofit-instrument
**Rationale** — The published K6 cap is sufficient to justify structural compliance, but not a quantitative token-savings claim.
**For D** — Retrofit the three offenders to meet K6; record outcome `narrowed`, explicitly stating that no before/after host-load or token reduction is claimed.

### merge-queue-enablement
**Rationale** — Rule 3 categorically assigns repo-admin changes to B.
**For B** — Original criterion: “the merge queue is enabled on `main` and at least one workflow declares a `merge_group` trigger.” Move step 4.3, queue enablement, workflow trigger addition, and live validation. Re-entry producer: GitHub repository administrator; probe: ruleset/API inspection reports the queue enabled and a test merge-group run completes.

### required-check-set-change
**Rationale** — ADR acceptance does not itself authorize a branch-ruleset mutation; the external enforcement change must remain explicit.
**For B** — Original criterion: “ADR-223 is accepted and the ruleset's `required_status_checks` list matches the matrix in `branch-protection-policy.md`, with `ci-green-floor.md` and `release-pr-gating.md` updated in the same change.” Move step 4.2 and all listed synchronization work. Re-entry producer: repository administrator after ADR-223 acceptance; probe: ruleset `17749383` API output exactly matches all three policy documents.

### manual-rubric-rater
**Rationale** — Viewing automated scores first would irreversibly violate the preregistered anti-anchor ordering.
**For B** — Original criterion: “a human rubric score exists per artifact, recorded before the secondary `lint_persistence` pass for that artifact.” Move Phase 1 Step 1’s scoring half and Step 2’s verdict. Re-entry producer: named independent human rater; probe: immutable timestamps show every rubric score predates the corresponding `score.ts`/`lint_persistence` output.

### cross-vendor-worker-slices
**Rationale** — The policy decision can be made now; implementation remains ordinary repository work.
**For D** — Permit report-only workers only: vendor B may review vendor A output and vice versa; send repository text and redacted artifacts only; prohibit secrets, credentials, personal data, raw confidential evidence, writes, and recursive delegation; resolver entries must cite this deny-by-default policy.

### f4-full-stop-block
**Rationale** — The block/advisory decision depends on real-host delivery behavior and a telemetry distribution not present in the repository.
**For B** — Original criterion: “live delivery evidence exists and the block/advisory decision cites the telemetry distribution.” Move the live `additionalContext` probe, session-marker validation, exact-line `review_skipped` calibration, and decision. Re-entry producer: maintainer running the supported host; probe: captured model-visible canary plus a dated telemetry report.

### gate-council-auto-dispatch
**Rationale** — Auto-dispatch changes external behavior and cannot precede verified reconciliation soak or a usable benefit/risk window.
**For B** — Original criterion: “the wiring lands citing the soak evidence, or the telemetry says auto-fire adds nothing and the gate stays recommend-only.” Move Phase 3 soak verification, F6/F4 and attendance collection, guards, wiring, and 6.2 verdict. Re-entry producer: gate-autonomy maintainer; probe: dated soak report and telemetry query satisfy preregistered minima before an integration test permits auto-fire.

### point-of-action-carrier
**Rationale** — A repository-only inference cannot establish main-agent versus subagent identity on the real host.
**For B** — Original criterion: “the spike note exists and the build/no-build decision cites it plus the F3-lite adoption telemetry.” Move the host spike, telemetry reading, discriminator verdict, and scoped-carrier decision. Re-entry producer: maintainer with a real multi-agent host session; probe: paired main/subagent traces test the candidate discriminator and publish either a separation result or measured null.

### team-telemetry-behind-flag
**Rationale** — No instrument can produce the required payload evidence until the experimental surface is active in a real environment.
**For B** — Original criterion: “payload evidence exists and the concerns ship, or teams leave the experimental state and this re-cuts.” Move Phase 5.4, the 5.1 spike, payload classification, concern binding, and recut decision. Re-entry producer: maintainer of a flag-enabled environment; probe: flag-state check followed by captured `TaskCompleted` payload fixtures.

### b-delegate-gate-maintainer-profile
**Rationale** — Consultation provides useful team access while avoiding delegated-write blast radius before further evidence exists.
**For D** — Option `(b)`; maintainer profile: team surface `enabled`, `allow_delegate: false`, existing `max_calls_per_day` retained and named. Consumer defaults remain unchanged.

### b-gate-budget-preauth
**Rationale** — A per-run and aggregate cap bounds both individual mistakes and repeated low-cost automation.
**For D** — Option `(a)`; `max_cost_per_run_usd: 5`, `max_cost_per_rolling_7d_usd: 25`; append-only ledger records blocker, authorization, estimated/actual cost, timestamp, and single-use bypass consumption.

### evidence-compaction-approval
**Rationale** — Deletion offers limited value while creating avoidable evidence and rollback risk.
**For D** — Option `(a) no compaction`; mark step 3.3 `[-]` cancelled and retain every evidence directory.

Summary: 11 delegated decisions are fixed, 10 externally or observationally blocked outcomes move to integrity-checked stubs, and one compaction outcome plus one optimization outcome are explicitly abandoned.

## Second seat, in full (anthropic)

Recorded so the divergences above are auditable against their source.

Matze, here is the disposition table:

```
b-consolidated-decision-sheet | D | satisfied | Accept all defaults (option a)
b-guard-tool-partition | D | satisfied | Option (b) - partition advisory only, guards unscoped
b-injection-scan-unwrap-security | B | transferred | Stub with security contract + fixture establishment
b-payload-read-parse-dominates | C | satisfied | Phase 2 null (dispatcher read+parse dominates)
b-per-turn-composite-bar | D | satisfied | Option (b) - observe-only for one release
b-stdin-read-failure-policy | D | satisfied | Option (c) - deny only on block-capable slots  
b-stop-async-split-prerequisites | D | narrowed | Option (c) - cancel async split, Phase 4 is lever
kernel-cross-link-soak | B | transferred | Stub for maintainer execution of kernel edits
maintainer-blind-ratings | B | transferred | Stub for maintainer blind rating execution
first-contract-true-analysis-run | B | transferred | Stub for maintainer spend + anonymization
router-head-retrofit-instrument | D | narrowed | Contract alone justifies retrofit (option b)
merge-queue-enablement | B | transferred | Stub for repo-admin merge-queue setting
required-check-set-change | B | transferred | Stub for ruleset 17749383 modification per ADR-223
manual-rubric-rater | B | transferred | Stub for human rubric scoring (PRIMARY)
cross-vendor-worker-slices | B | transferred | Stub for direction-policy authoring first
f4-full-stop-block | B | transferred | Stub for live verification + telemetry calibration
gate-council-auto-dispatch | B | transferred | Stub for post-soak wiring with telemetry
point-of-action-carrier | B | transferred | Stub for discrimination spike execution
team-telemetry-behind-flag | B | transferred | Stub for experimental-flag verification
b-delegate-gate-maintainer-profile | D | satisfied | Option (b) - team surface yes, delegate no
b-gate-budget-preauth | D | satisfied | Option (a) - per-run + per-week caps with ledger
evidence-compaction-approval | D | narrowed | Option (a) - no compaction, tiering only
```

---

**b-consolidated-decision-sheet**
Rationale: Accepting all defaults is explicitly valid and fastest. Defaults were agent-drafted/rendered with care. Unblocks 3 steps immediately.
For D: Option (a) — accept all defaults. Agent writes answers back per blocker text.

**b-guard-tool-partition**  
Rationale: Finding 2 showed unscoped group buys nothing. Keeps guards safe while allowing advisory optimization. Phase 4 measurement is real lever.
For D: Option (b). Partition advisory concerns only; guards remain unscoped.

**b-injection-scan-unwrap-security**
Rationale: Security surface requiring contract fixtures before any narrowing change. Current fallback works (albeit broad). Too risky without established valid/missing/malformed shapes.
For B: Transfer steps requiring contract + fixture work. Re-entry: security review after fixtures land. Dependent: unwrap fix + test against pre-fix behavior.

**b-payload-read-parse-dominates**
Rationale: Measured null — instrument ran, found dispatcher's own read+parse dominates. Two independent phases converged. Terminal per Rule 4.
For C: Phase 2 null (82ms small vs 130-143ms large; ten stringifies removed, moved nothing).

**b-per-turn-composite-bar**
Rationale: No prior measurement. Proposed p50 ≤ 1.5s is candidate, not data. Honest choice is observe-then-set.
For D: Option (b). Register row as observe-only for one release, set bar from observed distribution.

**b-stdin-read-failure-policy**
Rationale: Balances fail-closed intent with transient I/O tolerance. Block-capable slots can enforce denial; others cannot.
For D: Option (c). Deny on `pre_tool_use` (claude only per verified coverage); allow elsewhere. Test: failure → deny for block-capable slots.

**b-stop-async-split-prerequisites**
Rationale: Async split requires five prerequisites, three with corruption/safety concerns. Phase 4 measurement exists as alternative lever. 5.1 cancellation precedent.
For D: Option (c). Cancel 5.3 async split; record turn-end wall clock addressed via Phase 4 measurement only. Narrow roadmap scope to Phases 1-4.

**kernel-cross-link-soak**
Rationale: Guard refuses agent writes to kernel rules. Maintainer-only per measured 2026-08-10 attempt. Already past 24h spacing. Edits specified in blocker.
For B: Transfer to maintainer stub. Steps: Apply two edits to `verify-before-complete.md` + updated `kernel-prefix.json` baseline. Re-entry: maintainer via override exception registry or guard disable.

**maintainer-blind-ratings**
Rationale: Requires human blind rating of prepared packet. Ü1 decided/merged; Ü2/Ü3 depend on these ratings. Cannot be agent-executed.
For B: Transfer to maintainer stub. Steps: R1 (majority preference across 9 pairs) + R2 (collective_blind_spot decision-influencing in ≥2/3). Re-entry: maintainer blind rating.

**first-contract-true-analysis-run**
Rationale: Spends on external fetches; produces raw named evidence requiring source-confidentiality anonymization. Both are maintainer calls per blocker.
For B: Transfer to maintainer stub. Steps: Run command against small reference, anonymize, land evidence. Re-entry: maintainer spend authorization + anonymization.

**router-head-retrofit-instrument**
Rationale: Published K6 cap documents reason. No instrument exists. Waiting delays improvement for unmeasured token claim. Contract suffices.
For D: Decide contract alone justifies retrofit. Proceed with restructuring three offenders without token measurement.

**merge-queue-enablement**
Rationale: Repo-admin setting, cannot execute from tree. Rule 3 categorical: repo-admin → B.
For B: Transfer to maintainer stub. Steps: Enable merge queue on `main`, add `merge_group` trigger to ≥1 workflow. Re-entry: maintainer repo-admin access.

**required-check-set-change**
Rationale: Ruleset modification is repo-admin action. Rule 3 categorical. ADR-223 decision exists.
For B: Transfer to maintainer stub. Steps: Modify ruleset 17749383 per ADR-223 + update `branch-protection-policy.md`, `ci-green-floor.md`, `release-pr-gating.md`. Re-entry: maintainer repo-admin access.

**manual-rubric-rater**
Rationale: Pre-registration makes manual rubric PRIMARY. Requires human blind scoring before viewing secondary `score.ts`. Anti-anchor ordering binding.
For B: Transfer to maintainer stub. Steps: Human score per artifact against rubric, blind to arm, before `score.ts` view. Re-entry: human rater, detection probe: rubric scoring complete.

**cross-vendor-worker-slices**
Rationale: Direction-policy artifact doesn't exist. Rule 3: external routing policy → B. Substantive policy authoring beyond value fill.
For B: Transfer to stub. Steps: Draft direction-policy (vendor review permissions, egress discipline extension), add resolver entries. Re-entry: policy authoring completion, probe: policy artifact + resolver entries exist.

**f4-full-stop-block**
Rationale: Needs live verification that `additionalContext` on Stop reaches model. Telemetry-based threshold calibration. Cannot verify from tree alone.
For B: Transfer to stub. Steps: Verify live delivery, calibrate threshold on `review_skipped` telemetry. Re-entry: live environment verification + telemetry window.

**gate-council-auto-dispatch**
Rationale: Depends on Phase 3 soak (not yet occurred) + F6/F4 telemetry window. Time-dependent evidence.
For B: Transfer to stub. Steps: After soak verify + telemetry, wire gate escalation → council dispatch per 3.3. Re-entry: soak evidence + telemetry window exists.

**point-of-action-carrier**
Rationale: Needs live host probe for identity discrimination. Pre-registered null (no discriminator is publishable). Upstream closed identity request.
For B: Transfer to stub. Steps: Run main-vs-subagent discrimination spike, build/no-build decision citing spike + F3-lite telemetry. Re-entry: spike execution.

**team-telemetry-behind-flag**
Rationale: Blocked on experimental flag being on in real environment. External state dependency. 5.1 spike requires it.
For B: Transfer to stub. Steps: When flag on, run 5.1 spike, bind concerns per #1223 discipline. Re-entry: teams leave experimental or flag on probe.

**b-delegate-gate-maintainer-profile**
Rationale: Permits consultation without delegated writes. Balances enablement with safety. `max_calls_per_day` cap exists but no writes avoids blast radius.
For D: Option (b). Enable team surface in maintainer profile; leave `allow_delegate: false`. Cap: existing `max_calls_per_day`.

**b-gate-budget-preauth**
Rationale: Per-run cap alone is not spend bound. Per-week cap provides real budget control. Receipt ledger satisfies terminal abort's ledger-bound requirement.
For D: Option (a). Settings keys: `gate_budget.per_run_cap`, `gate_budget.per_week_cap`. Append-only receipt ledger at `agents/state/gate-budget-receipts.jsonl`.

**evidence-compaction-approval**
Rationale: Compaction adds complexity/risk. Tiering achieves classification goal. Reproducibility verdict is valuable documentation. Step 3.3 unnecessary.
For D: Option (a). No compaction. Tiering + reproducibility verdict is complete deliverable. Mark step 3.3 `[-]` cancelled.