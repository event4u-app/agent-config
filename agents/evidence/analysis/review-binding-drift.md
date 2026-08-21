# Review-binding segment drift

<!-- evidence-type: analysis -->

Phase 1 + Phase 2 of `road-to-inbox-harvest-2026-08-c-evidence-lifecycle`.

The question: the R2 manifest carries three hash segments (`scope_hash`,
`roadmap_hash`, `ac_hash`) and the currency verdict consults only the first.
`agents/roadmaps/` sits inside the scope, so flipping a checkbox moves
`scope_hash` and invalidates a binding no code change touched. That mechanism
is verified from source. This file measures whether it is what has actually
been costing re-binds.

## Decision — Phase 2 STOPS

**The verdict does not become segment-aware. Steps 2.2 and 2.3 are cancelled.**

The ratio that decided it, measured 2026-08-15 over **81** recorded re-bind
events, and **re-measured 2026-08-20** at `1d2f73c40` over **199** events. Both
readings are kept: the first is the one the decision was taken against, the
second is what the same probe reports now, and the direction between them is
part of the evidence.

| Cause (by changed paths) | 2026-08-15 | share | 2026-08-20 | share |
|---|---:|---:|---:|---:|
| `code` — a code path changed | 64 | **79.0 %** | 158 | **79.4 %** |
| `non-code` — only roadmap / dashboard / docs | 10 | 12.3 % | 16 | 8.0 % |
| `base-moved` — no path changed, but a merge landed | 0 | 0.0 % | 0 | 0.0 % |
| `unattributable` — no path changed and no merge | 7 | 8.6 % | 25 | 12.6 % |
| **total events** | **81** | | **199** | |

**Addressable by the proposed fix: 8 of 81 (9.9 %) then, 14 of 199 (7.0 %)
now** — non-code paths only AND no merge in the span.

The re-measurement **strengthens** the stop rather than reopening it: the `code`
share is flat at ~79 %, and the class the fix would have addressed fell from
12.3 % to 8.0 %. Nothing below was re-argued from the new numbers; the per-figure
refresh is recorded inline where a figure moved.

Step 2.1 pre-registered the stop condition in the roadmap's own words: *"A ratio
that shows code changes dominate is a legitimate stop: the churn would then be
reviews correctly noticing code, and nothing here should ship."* Code changes
dominate at 79 %, so the pre-registered condition is met and the stop is the
recorded outcome rather than a failure to build.

Three findings sharpen that, and each would have to be answered before anyone
reopens this:

**1. The addressable share is 9.9 % (7.0 % re-measured), not the whole non-code
remainder.** A
segment-aware verdict consults roadmap and AC content. Two axes are measured
independently — which path classes changed, and whether a merge landed in the
span — because the scope is `base...head`, so merging the trunk rewrites the
diff without anyone touching a reviewed file. Subtracting the events where a
merge did the rewriting leaves 8 the fix would actually have prevented (14 of
199 on the 2026-08-20 re-measurement). The merge axis is not in the roadmap's
Context; it was found by the measurement, and it also bounds the row above it:
with 23 of the 64 `code` events carrying a merge — 61 of 158 re-measured — 79 %
is an upper bound on "the review correctly noticed a change", not an exact
count.

**2. The relaxation would buy 8 events — 14 re-measured — at the cost of a
silent failure mode.**
Risk 1 of the roadmap states it: the value of the binding is that it notices when
reviewed content moved, and a verdict that forgives one segment is "one careless
predicate away from forgiving a code change that rode along with a roadmap edit".
That failure is silent by construction — a review that wrongly reports current
looks exactly like one that is. Trading 9.9 % of re-bind churn against a silent
integrity hole in the gate is not a trade this evidence supports.

**3. A cheaper repair exists for most of that 9.9 %, and it is out of scope
here.** Of the 10 non-code events, the dashboard `agents/roadmaps-progress.md`
appears in 6 — 7 of 16 on the 2026-08-20 re-measurement, so the share is stable
at roughly 40 %. It is a GENERATED file that regenerates on every roadmap touch,
which is why the roadmap's Context observes that "a single checkbox produces two
in-scope file changes". Excluding a generated artefact from a diff scope is a
different act from excluding authored roadmap content — the latter is what Risk 4
rejects, and rightly. Whether the dashboard belongs in `REVIEW_SCOPE_EXCLUDES` is
a separate, smaller question this plan did not ask and this analysis does not
answer.

## Decision — Phase 3 compaction: NONE

**Blocker `evidence-compaction-approval` is resolved: option (a), no
compaction.** Step 3.3 is cancelled `[-]`; every `*.review-input/` directory
stays, reproducible or not.

Decided 2026-08-20 by AI council (2/2 quorum, anthropic + openai), recorded in
`agents/evidence/council/drain-blocker-dispositions-b.md` <!-- ref-ignore -->
(not yet on `main` at the time of writing). Both seats converged on the action
and split only on the label: the openai seat calls the outcome `abandoned` and
cancels 3.3 outright, the anthropic seat calls it `narrowed` and keeps the
tiering. Adopted: the action is "no compaction"; step 3.3's own outcome state is
`abandoned`. The dissent is recorded, not dropped.

Step 3.3 has no surviving half. It reads "compact the tiers that are provably
reproducible" and nothing else — the tiering is step 3.1 and the reproducibility
verdict is step 3.2, both already landed. So the anthropic seat's `narrowed`
label describes *Phase 3* (which keeps its tiering deliverable) rather than
*step 3.3* (which has nothing left once compaction is refused). That is why the
two labels are not in conflict.

Why the decision is defensible on this evidence, not just on authority:

- **The ceiling is small and shrinking as a share.** Re-measured 2026-08-20:
  **73** directories, **9.01 MB**; **24** re-derived byte-for-byte
  (**2.63 MB**), **49** not (**6.38 MB**). Compaction could reclaim at most
  **29.2 %** — down from the 34.7 % the blocker quoted against 30 directories,
  because the irreproducible share grew faster than the reproducible one.
- **There is no tier boundary to name.** Option (b) requires one. All 73
  directories are in a single tier (`archived`); the only line that separates
  them is the per-directory re-derivation verdict, which is a property of
  reachability rather than of age — and Risk 3 records that reachability can
  silently change.
- **Risk 3 is the asymmetric side.** A reproducible directory becomes the sole
  copy the moment a branch is force-pushed or pruned, and the loss surfaces only
  when someone needs the patch. Trading a recoverable 2.63 MB against an
  unrecoverable record is the trade the roadmap's own Non-goals already refuse.

What this decision does **not** do: it does not set a retention policy, and it
does not claim the tree is small. `agents/evidence` is **13 MB** at
`1d2f73c40`, of which **11 MB** is `reviews/`, and it grew from 5.7 MB to 6.9 MB
to 13 MB across the three measurements this file records. That growth is real and
unaddressed; the decision recorded here is only that *this* roadmap does not
address it by deleting committed evidence. A future plan that wants to may cite
these figures, but it starts from its own blocker.

## The other two segments ARE consulted — by a different gate

The roadmap's Context says the two remaining segments "are written, parsed, and
never consulted for currency". That is true of `artefactStaleness`
(`dispatch_r2_reviewer.ts`), which compares `scope_hash` alone — and it is the
verdict the plan proposed to change.

It is NOT true of the suite as a whole. `--verify-current`, which CI runs as
"Gate R2 — context-manifest re-derivation", re-derives all three segments and
blocks on any of them. This PR proved it the expensive way: the fix pass edited
the roadmap, `roadmap_hash` diverged, and CI refused the artefact with
`manifest mismatch (stale review): roadmap_hash diverged` while every local
check was green.

Two consequences worth keeping:

- **The roadmap segment already has teeth**, just not in the verdict the plan
  targeted. Any future proposal to make the currency verdict segment-aware has
  to say how it interacts with a CI gate that already treats a roadmap edit as
  disqualifying — otherwise the two disagree about what "current" means.
- **A re-bind must update every segment the artefact records, not just the
  scope.** Updating `scope_hash` and `diff_sha` alone passes
  `check_completion_review` locally and fails CI.

## Two integrity findings the measurement surfaced

Neither is in the roadmap's scope. Both are recorded because they were found.

**11 of 52 artefacts carry no `context-manifest` block at all** — 22 of 120 on
the 2026-08-20 re-measurement. Skip and
honest-null artefacts declare their scope hash in prose (`… scope <64-hex>,
declared …`) instead. Their binding is therefore not machine-verifiable by
`parseManifest`, and a measurement reading only manifests would have dropped
them. That population is not random: the skip grammar asserts "no code surface
for this completion", so it is exactly where a non-code re-bind is most likely.
Reading only manifests would have biased the ratio toward its own conclusion —
this probe reads both, and the non-code share above (12.3 % then, 8.0 % now)
includes them.

**20 of the 28 stored `review-input/diff.patch` files no longer reproduce the
`scope_hash` their artefact binds** — 51 of 72 re-measured. The stored input is the scope the reviewer
actually read; after an in-place re-bind (contract §2.7) the artefact moves and
the input does not. The directory is therefore a record of the ORIGINAL review,
not of the current binding. That is a retention fact, and Phase 3 tiers against
it rather than against an assumption that the input still describes the binding.

**A stored input can outlive its artefact.** The tier pass enumerates
`*.review-input/` DIRECTORIES rather than findings artefacts, which is why it
reports 30 where the segment table reports 28 with a stored patch — 73 against
72 re-measured: one directory has no committed artefact at all, and driving the tiering off the artefact list
skipped it silently while acceptance criterion 4 said "every directory". Found
by the R2 review of this very change.

<!-- BEGIN probe_review_binding_drift -->

## Measurement

Generated by `./scripts-run src/scripts/probe_review_binding_drift --write`.
Re-run it rather than editing the tables by hand; every number below is derived.
Everything outside the two markers is preserved across runs.

- Findings artefacts scanned: **120**
- Carrying a stored `review-input/diff.patch`: **72**
- `scope_hash` still reproduces that stored input: **21**
- `scope_hash` moved after dispatch: **51**
- Recorded re-bind events across all artefacts: **199**

## The ratio Phase 2 turns on

Counted per re-bind **event** — one artefact re-bound three times cost three
re-binds. A re-bind is attributed to the in-scope paths that changed between
the previous binding state and the commit that moved the hash.

Two independent axes are measured, and neither is inferred from the other:
the path classes that changed, and whether a MERGE landed in the span. The
second matters because the scope is `base...head` — merging the trunk into a
branch rewrites the diff, and therefore the hash, without anyone touching a
reviewed file.

| Cause (by changed paths) | Events | Share | of those, span carried a merge |
|---|---:|---:|---:|
| `code` — a code path changed | 158 | 79.4 % | 61 |
| `non-code` — only roadmap / dashboard / docs | 16 | 8.0 % | 2 |
| `base-moved` — no path changed, but a merge landed | 0 | 0.0 % | 0 |
| `unattributable` — no path changed and no merge | 25 | 12.6 % | 0 |

A merge landed in the span of **63** of 199 events
(31.7 %), including 61 filed under `code`. Those
are re-binds where the diff was rewritten by the merge as well as by an edit, so
the `code` row is an upper bound on "the review correctly noticed a change",
not an exact count.

**Addressable by a segment-aware verdict: 14 of 199 events
(7.0 %)** — non-code paths only AND no merge in the span.
Every other class moved either code or the diff itself, and consulting the roadmap
and AC segments does not reach any of them.

## Non-code-only re-binds, in full

- `active-remediation-no-open-errors` @ `65572bcf4` — docs(review): re-bind to the derived-page scope, record the infra red
  - paths: docs/proof.md
- `evidence-artifact-typing` @ `74ee5e89f` — docs(evidence): re-bind after the cross-reference fix
  - paths: agents/roadmaps/road-to-release-review-p0.md
- `feat-local-only-gate-reds` @ `1cba2b111` — docs(review): re-bind the round-2 artefact to the fixed scope
  - paths: agents/roadmaps-progress.md, agents/roadmaps/road-to-local-only-gate-reds.md
- `feat-local-only-gate-reds` @ `57e4fc584` — docs(review): round 2 of the completion review, over the merged scope
  - paths: agents/evidence/analysis/always-loaded-corpus-scoping-verdict.md, agents/roadmaps-progress.md, agents/roadmaps/archive/road-to-always-loaded-corpus-scoping.md, agents/roadmaps/road-to-always-loaded-corpus-scoping.md, agents/roadmaps/road-to-local-only-gate-reds.md, docs/decisions/ADR-227-paths-scoping-is-saturated-not-a-corpus-lever.md, docs/decisions/INDEX.md
- `feat-org-telemetry-phase1-emission` @ `76403ba48` — docs(review): re-bind the findings after the risk-register re-review
  - paths: agents/roadmaps/road-to-org-telemetry.md
- `feat-rule-stub-projection` @ `1e12c2f64` — docs(review): re-bind the findings after the archive-index regeneration
  - paths: agents/roadmaps/archive/INDEX.md, agents/roadmaps/archive/index.json
- `feat-runtime-skill-routing` @ `620613f3b` — docs(review): re-bind the findings after the originality refresh
  - paths: agents/reports/originality.json, agents/reports/originality.md
- `guard-input-prompt-binding` @ `7de39cd46` — docs(review): re-bind after the roadmap addition, and say what it did not cover
  - paths: agents/roadmaps-progress.md, agents/roadmaps/road-to-local-only-gate-reds.md
- `inbox-harvest-2026-08-c` @ `591825da3` — docs(evidence): re-bind the completion-review skip after the anonymisation fix
  - paths: agents/evidence/analysis/inbox-harvest-2026-08-c-triage.md
- `roadmap-sweep-2026-08-14-continued` @ `922271617` — docs(review): re-bind the skip to the final scope, and name what three re-binds cost
  - paths: agents/evidence/reports/SWEEP-REPORT-2026-08-14-continued.md
- `roadmap-sweep-2026-08-14-continued` @ `f16bfa68a` — docs(review): re-bind the completion-review skip after the roadmap closure
  - paths: agents/roadmaps-progress.md, agents/roadmaps/archive/road-to-inbox-harvest-2026-08.md, agents/roadmaps/archive/road-to-inbox-harvest-distillation.md, agents/roadmaps/road-to-inbox-harvest-2026-08.md, agents/roadmaps/road-to-inbox-harvest-residuals.md
- `single-delivery` @ `6ec209555` — docs(review): re-bind after the evidence-type declaration
  - paths: agents/evidence/analysis/single-delivery-partition-census.md
- `single-delivery` @ `ef2b3c122` — docs(review): re-bind after the base merge and ADR renumber
  - paths: agents/roadmaps-progress.md
- `structured-guard-input-phase1` @ `ceac02600` — docs(review): re-bind the skip declaration to the Phase 2 re-cut scope
  - paths: agents/evidence/analysis/structured-guard-input-phase1.md, agents/roadmaps-progress.md, agents/roadmaps/road-to-structured-guard-input.md, docs/contracts/plan-review-gates.md
- `worktree-feat-turn-end-gate-always-on` @ `9dd75ecf1` — docs(review): re-bind after the count correction
  - paths: agents/roadmaps/road-to-skill-ecosystem-executable-payloads.md
- `zcs-close-2026-08-09` @ `143c8a3b4` — docs(review): re-bind the R2 findings scope after the main merge
  - paths: agents/roadmaps-progress.md, agents/roadmaps/road-to-always-on-orchestration.md, docs/contracts/settings-classes.md

## The 12.0.0-era re-binds

Re-bind events landing in `11.0.0..12.0.0`: **4**.

| Binding | Commit | Caused by | Paths |
|---|---|---|---|
| `fix-branch-freshness-r2-findings` | `e63511efd` | code | dist/agent-src/commands/pr/create.md, dist/agent-src/skills/git-workflow/SKILL.md, src/domains/git/pr/create/command.md, src/scripts/check_branch_freshness.ts, src/skills/git-workflow/SKILL.md, taskfiles/ci-fast.yml, tests/scripts/check_branch_freshness.test.ts |
| `roadmap-sweep-2026-08-14-continued` | `922271617` | non-code | agents/evidence/reports/SWEEP-REPORT-2026-08-14-continued.md |
| `roadmap-sweep-2026-08-14-continued` | `f16bfa68a` | non-code | agents/roadmaps-progress.md, agents/roadmaps/archive/road-to-inbox-harvest-2026-08.md, agents/roadmaps/archive/road-to-inbox-harvest-distillation.md, agents/roadmaps/road-to-inbox-harvest-2026-08.md, agents/roadmaps/road-to-inbox-harvest-residuals.md |
| `roadmap-sweep-2026-08-14-continued` | `4094b92f9` | unattributable | (none in scope) |

## Per-binding segment verdicts

`same` = segment reproduces its recorded hash · `moved` = it does not ·
`none` = the manifest recorded none · `no-input` = no stored `review-input/`.

| Binding | scope | roadmap | ac | re-binds | causes | note |
|---|---|---|---|---:|---|---|
| `active-remediation-no-open-errors` | prose-bound | none | none | 5 | code, non-code | skip artefact — scope hash in prose |
| `adr-revisit-governance` | moved | same | same | 2 | code | — |
| `always-loaded-corpus-scoping` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `autonomous-estate-disposition` | moved | moved | same | 3 | code, unattributable | — |
| `carrier-layer-convergence` | moved | moved | same | 2 | code | roadmap archived since dispatch |
| `catalogue-host-fit-phase1` | moved | moved | moved | 2 | code | roadmap archived since dispatch |
| `catalogue-host-fit-phase3` | moved | moved | moved | 1 | code | roadmap archived since dispatch |
| `cli-delegate-entry-guard` | no-input | none | none | 3 | code | — |
| `conformance-round5-stop-refusal` | same | none | none | 0 | — | — |
| `conformance-round7` | moved | none | none | 1 | code | — |
| `consultation-rate-analyzer` | moved | none | none | 1 | code | — |
| `context-fidelity` | same | moved | moved | 1 | code | — |
| `council-codex-transport` | moved | none | none | 1 | code | — |
| `council-integrity` | moved | moved | same | 3 | code | — |
| `council-remaining-adapters` | moved | none | none | 1 | code | — |
| `dead-citations-after-rule-migration` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `dispatch-safety-do-not-touch` | moved | same | none | 4 | code | — |
| `dispatch-safety-phase2` | no-input | moved | same | 3 | code | roadmap archived since dispatch |
| `estate-gate-class-honest` | moved | none | none | 2 | code, unattributable | — |
| `estate-triage-batch-1` | moved | same | same | 3 | code | — |
| `evidence-artifact-typing` | moved | moved | moved | 4 | code, non-code | — |
| `evidence-lifecycle-phase1` | moved | moved | same | 3 | code, unattributable | — |
| `feat-archive-picktier-decision-layer` | moved | none | none | 2 | code | — |
| `feat-ci-economy-shard-fold-back` | prose-bound | none | none | 2 | code, unattributable | skip artefact — scope hash in prose |
| `feat-close-gate-reds-blockers` | same | same | same | 3 | code, unattributable | — |
| `feat-conformance-round6-measurement` | no-input | moved | moved | 0 | — | roadmap archived since dispatch |
| `feat-cost-parity-3-handoff-envelope` | moved | none | none | 1 | code | — |
| `feat-council-solo-floor-implementation` | moved | none | none | 1 | code | — |
| `feat-design-system-onramp-blockers` | moved | same | same | 2 | code | — |
| `feat-design-system-onramp` | moved | moved | same | 3 | code | roadmap archived since dispatch |
| `feat-estate-drawdown-sheet-and-ratchet` | moved | moved | same | 3 | code | — |
| `feat-gate-autonomy` | same | moved | moved | 1 | code | — |
| `feat-hook-payload-optin` | moved | moved | same | 6 | code, unattributable | — |
| `feat-inbox-harvest-b-ci-economy` | same | moved | same | 2 | code | — |
| `feat-inbox-harvest-b-ci-economy.round1` | no-input | moved | same | 0 | — | — |
| `feat-inbox-harvest-b-ci-economy.round2` | no-input | moved | same | 0 | — | — |
| `feat-inbox-harvest-b-ledger-truth` | moved | none | none | 1 | code | — |
| `feat-inbox-harvest-b-quorum-telemetry` | same | moved | same | 1 | unattributable | roadmap archived since dispatch |
| `feat-inbox-harvest-d-picktier-disposition` | prose-bound | none | none | 1 | code | skip artefact — scope hash in prose |
| `feat-inbox-harvest-residuals` | moved | moved | same | 1 | code | roadmap archived since dispatch |
| `feat-local-only-gate-reds` | same | moved | moved | 3 | non-code, code | roadmap archived since dispatch |
| `feat-org-telemetry-phase0-spikes` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `feat-org-telemetry-phase1-emission` | moved | moved | same | 4 | code, non-code | — |
| `feat-parallel-session-collision-hardening` | moved | none | none | 3 | code | — |
| `feat-per-turn-hook-economy` | same | moved | moved | 4 | code | — |
| `feat-release-head-truth` | same | moved | moved | 1 | code | roadmap archived since dispatch |
| `feat-road-to-rule-delivery-integrity` | no-input | moved | same | 1 | unattributable | roadmap archived since dispatch |
| `feat-road-to-skill-ecosystem-authoring-discipline` | no-input | moved | moved | 1 | code | roadmap archived since dispatch |
| `feat-road-to-zero-ceremony-settings` | no-input | moved | moved | 1 | code | — |
| `feat-rule-coherence-readjudication` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `feat-rule-stub-projection` | moved | moved | same | 3 | non-code, code | — |
| `feat-runtime-skill-routing` | same | same | same | 5 | non-code, code | — |
| `feat-scheduled-deprecation` | same | same | same | 6 | unattributable, code | roadmap archived since dispatch |
| `feat-solution-minimalism-complexity-endpoint` | moved | moved | same | 2 | code | — |
| `feat-source-first-frontend` | same | moved | same | 4 | code, unattributable | — |
| `feat-subagent-lifecycle-integrity` | moved | moved | same | 3 | code | — |
| `feat-subagent-lifecycle-phase0-payload-spikes` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `feat-top-band-model-economy` | moved | none | none | 1 | code | — |
| `fix-branch-freshness-r2-findings` | moved | none | none | 1 | code | — |
| `fix-distillation-iron-law-3` | prose-bound | none | none | 2 | code | skip artefact — scope hash in prose |
| `fix-gate-completeness-new-arrivals` | same | none | none | 2 | unattributable | — |
| `fix-injection-budget-emission-and-session-state` | moved | moved | same | 1 | unattributable | — |
| `fix-legal-safety-floor-retraction` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `fix-picktier-blocker-council-evidence` | moved | none | none | 1 | code | — |
| `fix-r2-ac-extraction-inline` | moved | none | none | 1 | code | — |
| `frontend-skill-application` | moved | none | none | 3 | code | — |
| `gate-autonomy-class-writeback` | moved | none | none | 2 | code | — |
| `guard-input-prompt-binding` | moved | none | none | 6 | code, non-code | — |
| `hook-payload-unwrap` | same | same | same | 3 | code | — |
| `inbox-harvest-2026-08-c` | prose-bound | none | none | 1 | non-code | skip artefact — scope hash in prose |
| `inbox-harvest-residuals-closure` | prose-bound | none | none | 1 | code | skip artefact — scope hash in prose |
| `install-lifecycle-pack-source-decision` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `iron-law-3-council-resolution` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `leakage-allowlist-anchors` | no-input | none | none | 1 | code | — |
| `ledger-truth-backfill` | moved | none | none | 2 | code, unattributable | — |
| `long-horizon-phase4-close-r2` | same | moved | moved | 0 | — | roadmap archived since dispatch |
| `long-horizon-phase4-close` | same | moved | moved | 0 | — | roadmap archived since dispatch |
| `negative-test-antipattern` | no-input | none | none | 1 | code | — |
| `orchestrator-discipline-closeout` | no-input | none | none | 2 | code | — |
| `org-telemetry-retention` | moved | same | same | 4 | code | — |
| `pretool-slot-coverage-truth` | moved | none | none | 1 | code | — |
| `release-review-p0` | moved | same | same | 3 | code | — |
| `resume-scoped-rule-load` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `road-to-inbox-harvest-2026-08-b-authoring-contract` | same | none | none | 2 | code | — |
| `roadmap-blocker-premise-corrections` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `roadmap-screen-input-truth` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `roadmap-sweep-2026-08-14-continued` | prose-bound | none | none | 3 | non-code, unattributable | skip artefact — scope hash in prose |
| `rootless-write-refusal` | moved | none | none | 1 | unattributable | — |
| `run-continuation-observed` | same | moved | moved | 0 | — | roadmap archived since dispatch |
| `run-continuation-provenance` | same | moved | same | 6 | code, unattributable | roadmap archived since dispatch |
| `run-continuation-provenance.round2` | no-input | moved | same | 0 | — | roadmap archived since dispatch |
| `run-continuation-provenance.round3` | no-input | moved | same | 0 | — | roadmap archived since dispatch |
| `run-continuation-provenance.round4` | no-input | moved | same | 0 | — | roadmap archived since dispatch |
| `run-continuation-provenance.round5` | no-input | moved | same | 0 | — | roadmap archived since dispatch |
| `run-continuation-provenance.round6` | no-input | moved | same | 0 | — | roadmap archived since dispatch |
| `run-continuation-provenance.round7` | no-input | moved | same | 0 | — | roadmap archived since dispatch |
| `run-continuation-round9` | moved | moved | same | 1 | code | — |
| `single-delivery-binding` | moved | moved | moved | 3 | code | roadmap archived since dispatch |
| `single-delivery` | moved | moved | moved | 4 | code, non-code, unattributable | roadmap archived since dispatch |
| `solution-minimalism-t4-t5-scorers` | moved | moved | same | 3 | code | — |
| `source-first-browser-handover` | prose-bound | none | none | 2 | code | skip artefact — scope hash in prose |
| `standing-context-40k-phase4` | moved | moved | moved | 1 | code | — |
| `stop-gate-detector-demotion` | moved | none | none | 5 | code | — |
| `structured-guard-input-phase1` | prose-bound | none | none | 1 | non-code | skip artefact — scope hash in prose |
| `subagent-lifecycle-return-contract` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `turn-end-gate-r2-fixes` | same | none | none | 0 | — | — |
| `waiter-discipline` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `workspace-identity` | moved | same | same | 2 | code | — |
| `worktree-feat-turn-end-gate-always-on` | moved | moved | same | 2 | non-code, code | roadmap archived since dispatch |
| `worktree-long-horizon` | same | moved | moved | 5 | unattributable | roadmap archived since dispatch |
| `worktree-long-horizon.round1` | no-input | moved | none | 0 | — | roadmap archived since dispatch |
| `worktree-long-horizon.round2` | no-input | moved | moved | 0 | — | roadmap archived since dispatch |
| `worktree-long-horizon.round3-fixed` | no-input | moved | moved | 0 | — | roadmap archived since dispatch |
| `worktree-long-horizon.round3` | no-input | moved | moved | 0 | — | roadmap archived since dispatch |
| `worktree-long-horizon.round4` | no-input | moved | moved | 0 | — | roadmap archived since dispatch |
| `worktree-long-horizon.round5` | no-input | moved | moved | 0 | — | roadmap archived since dispatch |
| `worktree-long-horizon.round6` | no-input | moved | moved | 0 | — | roadmap archived since dispatch |
| `zcs-close-2026-08-09` | moved | same | same | 3 | code, non-code, unattributable | — |
| `zcs-closure-round2` | no-input | moved | moved | 0 | — | — |
| `zcs-closure` | no-input | moved | moved | 0 | — | — |

## Retention tiers

`active` = the artefact still binds the scope its stored input records ·
`recent` = re-bound, and the reviewed head is not yet in the trunk ·
`archived` = the reviewed head is an ancestor of `origin/main`.

| Tier | Dirs | Bytes |
|---|---:|---:|
| archived | 73 | 9.01 MB |
| **total** | **73** | **9.01 MB** |

### Regeneration guarantee

Re-derived successfully: **24** of 73 — 2.63 MB.
Not re-derivable from the record: **49** — 6.38 MB, which stays regardless.

That bounds the `evidence-compaction-approval` blocker: the most any compaction
could reclaim is **2.63 MB** of 9.01 MB (29.2 %), and only
from the directories listed as re-derivable below.

A stored patch counts as reproducible only when it was ACTUALLY re-derived
here, byte-for-byte. The manifest records no base revision, so reproducibility
is never assertable from the record alone — it is attempted, and the attempt is
what the verdict reports.

**Irreproducible directories — these patches are the only copy and stay:**

- `adr-revisit-governance.review-input` (0.21 MB, archived) — no — not re-derivable from the recorded head alone
- `autonomous-estate-disposition.review-input` (0.18 MB, archived) — no — not re-derivable from the recorded head alone
- `conformance-round7.review-input` (0.13 MB, archived) — no — not re-derivable from the recorded head alone
- `consultation-rate-analyzer.review-input` (0.03 MB, archived) — no — not re-derivable from the recorded head alone
- `context-fidelity.review-input` (0.11 MB, archived) — no — not re-derivable from the recorded head alone
- `council-codex-transport.review-input` (0.02 MB, archived) — no — not re-derivable from the recorded head alone
- `council-integrity.review-input` (0.09 MB, archived) — no — not re-derivable from the recorded head alone
- `council-remaining-adapters.review-input` (0.02 MB, archived) — no — not re-derivable from the recorded head alone
- `dispatch-safety-do-not-touch.review-input` (0.15 MB, archived) — no — not re-derivable from the recorded head alone
- `estate-gate-class-honest.review-input` (0.07 MB, archived) — no — not re-derivable from the recorded head alone
- `estate-triage-batch-1.review-input` (0.32 MB, archived) — no — not re-derivable from the recorded head alone
- `evidence-artifact-typing.review-input` (0.10 MB, archived) — no — not re-derivable from the recorded head alone
- `evidence-lifecycle-phase1.review-input` (0.09 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-design-system-onramp-blockers.review-input` (0.22 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-design-system-onramp.review-input` (0.49 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-estate-drawdown-sheet-and-ratchet.review-input` (0.20 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-hook-payload-optin.review-input` (0.14 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-inbox-harvest-b-ci-economy.review-input` (0.12 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-inbox-harvest-b-ledger-truth.review-input` (0.09 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-inbox-harvest-b-quorum-telemetry.review-input` (0.07 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-inbox-harvest-residuals.review-input` (0.12 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-local-only-gate-reds.review-input` (0.06 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-org-telemetry-phase1-emission.review-input` (0.12 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-parallel-session-collision-hardening.review-input` (0.06 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-per-turn-hook-economy.review-input` (0.21 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-release-head-truth.review-input` (0.07 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-rule-stub-projection.review-input` (0.10 MB, archived) — no — not re-derivable from the recorded head alone
- `fix-gate-completeness-new-arrivals.review-input` (0.03 MB, archived) — no — not re-derivable from the recorded head alone
- `fix-injection-budget-emission-and-session-state.review-input` (0.05 MB, archived) — no — not re-derivable from the recorded head alone
- `frontend-skill-application.review-input` (0.17 MB, archived) — no — not re-derivable from the recorded head alone
- `gate-autonomy-class-writeback.review-input` (0.05 MB, archived) — no — not re-derivable from the recorded head alone
- `guard-input-prompt-binding.review-input` (0.09 MB, archived) — no — not re-derivable from the recorded head alone
- `ledger-truth-backfill.review-input` (0.10 MB, archived) — no — not re-derivable from the recorded head alone
- `long-horizon-phase4-close-r2.review-input` (0.14 MB, archived) — no — not re-derivable from the recorded head alone
- `long-horizon-phase4-close.review-input` (0.13 MB, archived) — no — not re-derivable from the recorded head alone
- `org-telemetry-retention.review-input` (0.12 MB, archived) — no — not re-derivable from the recorded head alone
- `pr-target-base-freshness.review-input` (0.04 MB, archived) — no — not re-derivable from the recorded head alone
- `release-review-p0.review-input` (0.13 MB, archived) — no — not re-derivable from the recorded head alone
- `run-continuation-observed.review-input` (0.05 MB, archived) — no — not re-derivable from the recorded head alone
- `run-continuation-provenance.review-input` (0.18 MB, archived) — no — not re-derivable from the recorded head alone
- `run-continuation-round9.review-input` (0.12 MB, archived) — no — not re-derivable from the recorded head alone
- `single-delivery-binding.review-input` (0.08 MB, archived) — no — not re-derivable from the recorded head alone
- `single-delivery.review-input` (0.14 MB, archived) — no — not re-derivable from the recorded head alone
- `standing-context-40k-phase4.review-input` (0.14 MB, archived) — no — not re-derivable from the recorded head alone
- `turn-end-gate-r2-fixes.review-input` (0.07 MB, archived) — no — not re-derivable from the recorded head alone
- `workspace-identity.review-input` (0.13 MB, archived) — no — not re-derivable from the recorded head alone
- `worktree-feat-turn-end-gate-always-on.review-input` (0.08 MB, archived) — no — not re-derivable from the recorded head alone
- `worktree-long-horizon.review-input` (0.60 MB, archived) — no — not re-derivable from the recorded head alone
- `zcs-close-2026-08-09.review-input` (0.14 MB, archived) — no — not re-derivable from the recorded head alone

| Directory | Tier | Bytes | Re-derivable |
|---|---|---:|---|
| `adr-revisit-governance.review-input` | archived | 212 kB | no — not re-derivable from the recorded head alone |
| `autonomous-estate-disposition.review-input` | archived | 187 kB | no — not re-derivable from the recorded head alone |
| `carrier-layer-convergence.review-input` | archived | 69 kB | yes — trunk at merge `aff2393b9` |
| `catalogue-host-fit-phase1.review-input` | archived | 78 kB | yes — trunk at merge `4cea1f354` |
| `catalogue-host-fit-phase3.review-input` | archived | 68 kB | yes — trunk at merge `09e74447c` |
| `conformance-round5-stop-refusal.review-input` | archived | 184 kB | yes — trunk at merge `8975180df` |
| `conformance-round7.review-input` | archived | 130 kB | no — not re-derivable from the recorded head alone |
| `consultation-rate-analyzer.review-input` | archived | 33 kB | no — not re-derivable from the recorded head alone |
| `context-fidelity.review-input` | archived | 114 kB | no — not re-derivable from the recorded head alone |
| `council-codex-transport.review-input` | archived | 18 kB | no — not re-derivable from the recorded head alone |
| `council-integrity.review-input` | archived | 92 kB | no — not re-derivable from the recorded head alone |
| `council-remaining-adapters.review-input` | archived | 18 kB | no — not re-derivable from the recorded head alone |
| `dispatch-safety-do-not-touch.review-input` | archived | 158 kB | no — not re-derivable from the recorded head alone |
| `estate-gate-class-honest.review-input` | archived | 71 kB | no — not re-derivable from the recorded head alone |
| `estate-triage-batch-1.review-input` | archived | 330 kB | no — not re-derivable from the recorded head alone |
| `evidence-artifact-typing.review-input` | archived | 104 kB | no — not re-derivable from the recorded head alone |
| `evidence-lifecycle-phase1.review-input` | archived | 95 kB | no — not re-derivable from the recorded head alone |
| `feat-archive-picktier-decision-layer.review-input` | archived | 90 kB | yes — trunk at merge `49554cd1b` |
| `feat-close-gate-reds-blockers.review-input` | archived | 60 kB | yes — trunk at merge `af9b8d7ff` |
| `feat-cost-parity-3-handoff-envelope.review-input` | archived | 134 kB | yes — trunk at merge `c3e51cc70` |
| `feat-council-solo-floor-implementation.review-input` | archived | 90 kB | yes — trunk at merge `196ff8bec` |
| `feat-design-system-onramp-blockers.review-input` | archived | 228 kB | no — not re-derivable from the recorded head alone |
| `feat-design-system-onramp.review-input` | archived | 503 kB | no — not re-derivable from the recorded head alone |
| `feat-estate-drawdown-sheet-and-ratchet.review-input` | archived | 200 kB | no — not re-derivable from the recorded head alone |
| `feat-gate-autonomy.review-input` | archived | 219 kB | yes — trunk at merge `c9de2fe1f` |
| `feat-hook-payload-optin.review-input` | archived | 145 kB | no — not re-derivable from the recorded head alone |
| `feat-inbox-harvest-b-ci-economy.review-input` | archived | 121 kB | no — not re-derivable from the recorded head alone |
| `feat-inbox-harvest-b-ledger-truth.review-input` | archived | 89 kB | no — not re-derivable from the recorded head alone |
| `feat-inbox-harvest-b-quorum-telemetry.review-input` | archived | 75 kB | no — not re-derivable from the recorded head alone |
| `feat-inbox-harvest-residuals.review-input` | archived | 123 kB | no — not re-derivable from the recorded head alone |
| `feat-local-only-gate-reds.review-input` | archived | 62 kB | no — not re-derivable from the recorded head alone |
| `feat-org-telemetry-phase1-emission.review-input` | archived | 120 kB | no — not re-derivable from the recorded head alone |
| `feat-parallel-session-collision-hardening.review-input` | archived | 61 kB | no — not re-derivable from the recorded head alone |
| `feat-per-turn-hook-economy.review-input` | archived | 215 kB | no — not re-derivable from the recorded head alone |
| `feat-release-head-truth.review-input` | archived | 75 kB | no — not re-derivable from the recorded head alone |
| `feat-rule-stub-projection.review-input` | archived | 105 kB | no — not re-derivable from the recorded head alone |
| `feat-runtime-skill-routing.review-input` | archived | 319 kB | yes — trunk at merge `ffec3acb7` |
| `feat-scheduled-deprecation.review-input` | archived | 110 kB | yes — trunk at merge `ad198770a` |
| `feat-solution-minimalism-complexity-endpoint.review-input` | archived | 179 kB | yes — trunk at merge `b48b854c9` |
| `feat-source-first-frontend.review-input` | archived | 169 kB | yes — trunk at merge `5538a5998` |
| `feat-subagent-lifecycle-integrity.review-input` | archived | 80 kB | yes — trunk at merge `b3a2d29e2` |
| `feat-top-band-model-economy.review-input` | archived | 51 kB | yes — trunk at merge `8edeae392` |
| `fix-branch-freshness-r2-findings.review-input` | archived | 35 kB | yes — trunk at merge `b3fec2881` |
| `fix-gate-completeness-new-arrivals.review-input` | archived | 28 kB | no — not re-derivable from the recorded head alone |
| `fix-injection-budget-emission-and-session-state.review-input` | archived | 55 kB | no — not re-derivable from the recorded head alone |
| `fix-picktier-blocker-council-evidence.review-input` | archived | 14 kB | yes — trunk at merge `dac3e1860` |
| `fix-r2-ac-extraction-inline.review-input` | archived | 19 kB | yes — trunk at merge `75d6e05f1` |
| `frontend-skill-application.review-input` | archived | 175 kB | no — not re-derivable from the recorded head alone |
| `gate-autonomy-class-writeback.review-input` | archived | 51 kB | no — not re-derivable from the recorded head alone |
| `guard-input-prompt-binding.review-input` | archived | 89 kB | no — not re-derivable from the recorded head alone |
| `hook-payload-unwrap.review-input` | archived | 126 kB | yes — trunk at merge `7be25cf07` |
| `ledger-truth-backfill.review-input` | archived | 106 kB | no — not re-derivable from the recorded head alone |
| `long-horizon-phase4-close-r2.review-input` | archived | 139 kB | no — not re-derivable from the recorded head alone |
| `long-horizon-phase4-close.review-input` | archived | 134 kB | no — not re-derivable from the recorded head alone |
| `org-telemetry-retention.review-input` | archived | 122 kB | no — not re-derivable from the recorded head alone |
| `pr-target-base-freshness.review-input` | archived | 39 kB | no — not re-derivable from the recorded head alone |
| `pretool-slot-coverage-truth.review-input` | archived | 26 kB | yes — trunk at merge `6a679cc19` |
| `release-review-p0.review-input` | archived | 129 kB | no — not re-derivable from the recorded head alone |
| `road-to-inbox-harvest-2026-08-b-authoring-contract.review-input` | archived | 184 kB | yes — trunk at merge `86cc1d778` |
| `rootless-write-refusal.review-input` | archived | 52 kB | yes — trunk at merge `42f22fd27` |
| `run-continuation-observed.review-input` | archived | 50 kB | no — not re-derivable from the recorded head alone |
| `run-continuation-provenance.review-input` | archived | 186 kB | no — not re-derivable from the recorded head alone |
| `run-continuation-round9.review-input` | archived | 119 kB | no — not re-derivable from the recorded head alone |
| `single-delivery-binding.review-input` | archived | 84 kB | no — not re-derivable from the recorded head alone |
| `single-delivery.review-input` | archived | 139 kB | no — not re-derivable from the recorded head alone |
| `solution-minimalism-t4-t5-scorers.review-input` | archived | 208 kB | yes — trunk at merge `7195d2f2a` |
| `standing-context-40k-phase4.review-input` | archived | 147 kB | no — not re-derivable from the recorded head alone |
| `stop-gate-detector-demotion.review-input` | archived | 136 kB | yes — trunk at merge `4071348cd` |
| `turn-end-gate-r2-fixes.review-input` | archived | 74 kB | no — not re-derivable from the recorded head alone |
| `workspace-identity.review-input` | archived | 134 kB | no — not re-derivable from the recorded head alone |
| `worktree-feat-turn-end-gate-always-on.review-input` | archived | 84 kB | no — not re-derivable from the recorded head alone |
| `worktree-long-horizon.review-input` | archived | 615 kB | no — not re-derivable from the recorded head alone |
| `zcs-close-2026-08-09.review-input` | archived | 146 kB | no — not re-derivable from the recorded head alone |

## Every re-bind event

| Binding | Commit | Subject | Path classes |
|---|---|---|---|
| `active-remediation-no-open-errors` | `1eff52101` | docs(review): re-bind after ADR-226 and the release merge | code |
| `active-remediation-no-open-errors` | `408b56162` | docs(review): re-bind after the main merge and the register fix | code, agents-other, roadmap, docs |
| `active-remediation-no-open-errors` | `f6516fccc` | docs(review): re-bind after the authorised re-anchor and its roadmap | roadmap, code |
| `active-remediation-no-open-errors` | `65572bcf4` | docs(review): re-bind to the derived-page scope, record the infra red | docs |
| `active-remediation-no-open-errors` | `d895ad705` | docs(review): re-bind the skip declaration to the token-budget scope | code, docs |
| `adr-revisit-governance` | `7c248f2e9` | review(adr-revisit-governance): re-bind to the router-regen scope | code |
| `adr-revisit-governance` | `921df0c03` | review(adr-revisit-governance): re-bind after the base merge, commit the input package | agents-other, roadmap, code, docs |
| `autonomous-estate-disposition` | `b22162b81` | docs(review): re-bind after merging the 14.6.0 base | code |
| `autonomous-estate-disposition` | `c704fd894` | docs(review): re-bind after the reference-check fix | roadmap, code |
| `autonomous-estate-disposition` | `028ad5fcb` | docs(review): re-bind after the fixes | (none in scope) |
| `carrier-layer-convergence` | `884104c15` | review(carrier): re-bind to the post-merge scope — the fixed point | code, docs |
| `carrier-layer-convergence` | `9bbfbc353` | review(carrier): re-bind the R2 round to the shipping content, all 6 terminal | agents-other, roadmap, code |
| `catalogue-host-fit-phase1` | `8fa6564cb` | docs(review): re-bind the review artefact after the ceiling extraction | code |
| `catalogue-host-fit-phase1` | `3862e5851` | docs(review): record the R2 outcomes and re-bind the artefact | roadmap, code |
| `catalogue-host-fit-phase3` | `a4b320cf3` | docs(review): re-bind the R2 artefact after the fix pass | roadmap, code |
| `cli-delegate-entry-guard` | `b0bf83704` | chore(review): re-bind the artefact after the bundle rebuild | code |
| `cli-delegate-entry-guard` | `ab4272b98` | chore(review): re-bind the artefact after merging main | code, docs |
| `cli-delegate-entry-guard` | `c1eb64ab0` | chore(review): re-bind the artefact and mark all six findings fixed | code |
| `conformance-round7` | `304b89866` | docs(review): re-bind the R2 artefact to the fixed scope | code |
| `consultation-rate-analyzer` | `0cc9057d9` | docs(review): re-bind the R2 artefact to the fixed scope | agents-other, code |
| `context-fidelity` | `8f2176da0` | docs(review): re-bind the findings to the post-fix scope, all 13 terminal | code, agents-other, roadmap, docs |
| `council-codex-transport` | `3a22d357e` | docs(review): re-bind the context manifest, not only the marker | agents-other, roadmap, code |
| `council-integrity` | `dd58e0c7c` | review(council-integrity): re-bind after merging origin/main a second time | code, roadmap, docs |
| `council-integrity` | `eb84ecb6c` | review(council-integrity): re-bind after merging origin/main | roadmap, code, docs |
| `council-integrity` | `267ff3f3b` | review(council-integrity): re-bind the findings artefact to the fixed scope | roadmap, code |
| `council-remaining-adapters` | `783b78445` | docs(review): re-bind the adapter-follow-up artefact to the fixed scope | code |
| `dispatch-safety-do-not-touch` | `91653ad11` | review(dispatch-safety-do-not-touch): re-bind all three anchors after the second merge | agents-other, roadmap, docs, code |
| `dispatch-safety-do-not-touch` | `2528af735` | review(dispatch-safety-do-not-touch): re-bind after merging the un-park | roadmap, code |
| `dispatch-safety-do-not-touch` | `ed2caa5f2` | review(dispatch-safety-do-not-touch): re-bind after the ratchet walk-down | code |
| `dispatch-safety-do-not-touch` | `c87d86cea` | review(dispatch-safety-do-not-touch): dispose the findings and re-bind | roadmap, agents-other, code |
| `dispatch-safety-phase2` | `40e110c72` | chore(review): re-bind round 2 and mark its three findings fixed | code |
| `dispatch-safety-phase2` | `756b226de` | chore(review): re-bind the R2 artefact after merging main | roadmap, docs, code |
| `dispatch-safety-phase2` | `081ffffbe` | chore(review): re-bind the R2 artefact and mark all eight findings fixed | code |
| `estate-gate-class-honest` | `7b3e707fb` | docs(review): fill the R2 findings and re-bind to the post-fix scope | agents-other, roadmap, code |
| `estate-gate-class-honest` | `c2bfba0b1` | docs(review): rescope the R2 review to match the gate scope | (none in scope) |
| `estate-triage-batch-1` | `7eb2862a9` | docs(review): re-bind the R2 round after the second main merge | roadmap, agents-other, code, docs |
| `estate-triage-batch-1` | `a961e7339` | docs(review): re-bind the R2 round after the main merge | agents-other, roadmap, docs, code |
| `estate-triage-batch-1` | `66e5da00d` | docs(review): re-bind the R2 round to the post-fix scope | agents-other, roadmap, code |
| `evidence-artifact-typing` | `b426d8e38` | docs(evidence): re-bind marker AND manifest after the main merge | code, agents-other, roadmap, docs |
| `evidence-artifact-typing` | `74ee5e89f` | docs(evidence): re-bind after the cross-reference fix | roadmap |
| `evidence-artifact-typing` | `a1476cbf5` | docs(evidence): re-bind the findings at the final head | code |
| `evidence-artifact-typing` | `acf8229b4` | docs(evidence): re-bind the R2 findings at the post-merge scope | roadmap, docs, code |
| `evidence-lifecycle-phase1` | `e11f1137e` | docs(review): re-bind after the main merge moved the base | agents-other, roadmap, code |
| `evidence-lifecycle-phase1` | `49b1b7c95` | docs(review): re-bind to the post-finding scope | (none in scope) |
| `evidence-lifecycle-phase1` | `6c03182ac` | docs(review): re-bind the R2 artefact after the fix pass, all nine terminal | agents-other, roadmap, code |
| `feat-archive-picktier-decision-layer` | `35a178d6e` | docs(evidence): re-bind the findings after the bundle rebuild | code |
| `feat-archive-picktier-decision-layer` | `80252df5e` | docs(evidence): re-bind the R2 findings and record the dispositions | roadmap, code, docs |
| `feat-ci-economy-shard-fold-back` | `6f69dc789` | docs(review): re-bind the skip declaration and correct the inherited-red section | agents-other, roadmap, code |
| `feat-ci-economy-shard-fold-back` | `29ad74528` | docs(review): re-bind the skip declaration to the moved review scope | (none in scope) |
| `feat-close-gate-reds-blockers` | `3b4bdb6a0` | docs(review): re-bind the artefact after the third main merge | code, agents-other, roadmap, docs |
| `feat-close-gate-reds-blockers` | `5bfc84c8b` | docs(review): re-bind the R2 artefact after the fix pass | (none in scope) |
| `feat-close-gate-reds-blockers` | `6518a6a12` | docs(review): re-bind the skip declaration to the merged scope | roadmap, docs, code |
| `feat-cost-parity-3-handoff-envelope` | `7a9bbbb2d` | docs(review): re-bind the findings artefact to the post-fix scope | roadmap, code |
| `feat-council-solo-floor-implementation` | `c4f675375` | docs(review): re-bind the completion-review artefact to the fixed scope | roadmap, docs, code |
| `feat-design-system-onramp-blockers` | `47131d403` | docs(review): re-bind the findings artefact after the corpus-staleness fix | code |
| `feat-design-system-onramp-blockers` | `6a48f11ba` | docs(review): re-bind the findings artefact to the post-fix scope | roadmap, agents-other, code, docs |
| `feat-design-system-onramp` | `fcb8ab408` | docs(review): re-bind the findings artefact after the consumer-path fix | code |
| `feat-design-system-onramp` | `cfd269516` | docs(review): re-bind the findings artefact after the second main merge | roadmap, docs, code |
| `feat-design-system-onramp` | `267482700` | docs(review): re-bind the findings artefact to the post-fix scope | roadmap, code, docs |
| `feat-estate-drawdown-sheet-and-ratchet` | `8ca01d602` | docs(review): re-bind after the CI fix | code |
| `feat-estate-drawdown-sheet-and-ratchet` | `348c9aad4` | docs(review): re-bind after the trunk merge, and correct finding 11's ref | docs, code |
| `feat-estate-drawdown-sheet-and-ratchet` | `0ab50ca2d` | docs(review): re-bind the R2 artefact and record the dispositions | code, agents-other |
| `feat-gate-autonomy` | `02ced8e8a` | docs(review): re-bind the R2 findings to the post-fix scope, 18 fixed and 1 deferred | roadmap, code |
| `feat-hook-payload-optin` | `b320587dd` | docs(review): re-bind the findings after merging the PR base | code, roadmap, docs |
| `feat-hook-payload-optin` | `9364896c7` | docs(review): re-bind the findings after the orphan removal | code |
| `feat-hook-payload-optin` | `c6910f5e3` | docs(review): re-bind the findings after the source-size extraction | code |
| `feat-hook-payload-optin` | `e572ed339` | docs(review): re-bind the findings after merging the base | agents-other, roadmap, code |
| `feat-hook-payload-optin` | `1cf1b8189` | docs(review): re-bind the findings after the CI fix pass | code |
| `feat-hook-payload-optin` | `31ba213c0` | docs(review): re-bind the findings artefact after the fix pass | (none in scope) |
| `feat-inbox-harvest-b-ci-economy` | `57867dfd5` | fix(review): close the round-3 findings, including four npm ci sites the verify regex could not see | code, roadmap, docs |
| `feat-inbox-harvest-b-ci-economy` | `90cb3caff` | fix(review): repair the round-2 findings, including a self-falsifying cost table | code, roadmap, docs |
| `feat-inbox-harvest-b-ledger-truth` | `0a585db22` | docs(review): re-bind the completion review to the repaired scope | roadmap, docs, code |
| `feat-inbox-harvest-b-quorum-telemetry` | `4a0504cfc` | docs(review): record round 2 — the fixes introduced two of their own | (none in scope) |
| `feat-inbox-harvest-d-picktier-disposition` | `7594467ce` | docs(evidence): re-bind the completion-review skip after the main merge | code, agents-other, roadmap, docs |
| `feat-inbox-harvest-residuals` | `8941d599f` | docs(review): re-bind the completion review after the fix pass | roadmap, code |
| `feat-local-only-gate-reds` | `1cba2b111` | docs(review): re-bind the round-2 artefact to the fixed scope | roadmap |
| `feat-local-only-gate-reds` | `57e4fc584` | docs(review): round 2 of the completion review, over the merged scope | agents-other, roadmap, docs |
| `feat-local-only-gate-reds` | `c71466897` | docs(review): re-bind the completion-review artefact to the fixed scope | roadmap, code |
| `feat-org-telemetry-phase1-emission` | `34e236aa2` | docs(review): re-bind the findings after merging release 14.3.0 and PR #1424 | code, roadmap, docs |
| `feat-org-telemetry-phase1-emission` | `76403ba48` | docs(review): re-bind the findings after the risk-register re-review | roadmap |
| `feat-org-telemetry-phase1-emission` | `7cb5b8e18` | docs(review): re-bind the org-telemetry findings after the base moved | code, roadmap, docs |
| `feat-org-telemetry-phase1-emission` | `3e434f5e5` | docs(review): close the org-telemetry Phase 1 findings, re-bound to the repair head | roadmap, code |
| `feat-parallel-session-collision-hardening` | `d4b23e1c9` | docs(review): re-bind the review artefact after the pipefail fix | code |
| `feat-parallel-session-collision-hardening` | `3fc625f8b` | docs(review): re-bind the review artefact after merging main | code, docs |
| `feat-parallel-session-collision-hardening` | `0fc9e822c` | docs(review): re-bind the completion-review artefact to the fixed scope | docs, code |
| `feat-per-turn-hook-economy` | `278877028` | docs(review): re-bind the findings after the non-blocking fd fix | roadmap, code |
| `feat-per-turn-hook-economy` | `485a3027c` | docs(review): re-bind the findings after the first-byte-cap fix | roadmap, code |
| `feat-per-turn-hook-economy` | `51986599c` | docs(review): re-bind the findings after the base merge moved the scope | roadmap, code |
| `feat-per-turn-hook-economy` | `12e2aff17` | docs(review): bind the findings to the fix pass and re-derive the manifest | roadmap, docs, code |
| `feat-release-head-truth` | `1ab43c8ac` | docs(review): re-bind the R2 artefact to the fixed scope, all eleven dispositions terminal | agents-other, roadmap, docs, code |
| `feat-road-to-rule-delivery-integrity` | `2ebdb87f0` | docs(review): re-derive the context-manifest scope_hash for the re-bound round (contract 5 header-manifest agreement) | (none in scope) |
| `feat-road-to-skill-ecosystem-authoring-discipline` | `f3d6e2a03` | review(authoring): mark all fourteen findings fixed, drop the regenerable input | code, docs |
| `feat-road-to-zero-ceremony-settings` | `0a96cca52` | review(settings): mark all ten findings fixed, drop the regenerable input | roadmap, docs, code |
| `feat-rule-stub-projection` | `1e12c2f64` | docs(review): re-bind the findings after the archive-index regeneration | roadmap |
| `feat-rule-stub-projection` | `58552ee48` | docs(review): re-bind the findings artefact after merging main | roadmap, code |
| `feat-rule-stub-projection` | `03f98362c` | chore(gates): revert the header denominators, to re-land them after the findings | code |
| `feat-runtime-skill-routing` | `620613f3b` | docs(review): re-bind the findings after the originality refresh | agents-other |
| `feat-runtime-skill-routing` | `a326d59f0` | docs(review): re-bind the findings after the worker-drop pin | code |
| `feat-runtime-skill-routing` | `cfe225cde` | docs(review): re-bind the findings after the CI-fix commit | code |
| `feat-runtime-skill-routing` | `24b091662` | docs(review): re-bind the findings after the main merge | agents-other, roadmap, code |
| `feat-runtime-skill-routing` | `871a96c67` | docs(review): re-bind the findings to the post-fix scope, 13/13 fixed | roadmap, code, docs |
| `feat-scheduled-deprecation` | `ddbecf186` | docs(review): re-bind round 3 to the final scope | (none in scope) |
| `feat-scheduled-deprecation` | `f5873b283` | fix: close round 3's low findings, and correct their dispositions | roadmap, code |
| `feat-scheduled-deprecation` | `a05cd1cd2` | fix(gates): stop reporting green over zero comparisons | agents-other, roadmap, code, docs |
| `feat-scheduled-deprecation` | `005ed2b95` | docs(review): re-bind round 2 to the fixed scope | (none in scope) |
| `feat-scheduled-deprecation` | `f92bc375f` | fix(gates): close review round 2 — 12 findings | roadmap, code |
| `feat-scheduled-deprecation` | `1a884c7dd` | docs(review): re-bind the completion review to the fixed scope | roadmap, docs, code |
| `feat-solution-minimalism-complexity-endpoint` | `218b6eb8f` | docs(evidence): re-bind the completion review after the CI repairs | roadmap, code |
| `feat-solution-minimalism-complexity-endpoint` | `17a8ad09c` | docs(evidence): re-bind the completion review, all ten rows fixed | roadmap, code |
| `feat-source-first-frontend` | `a2d1b7803` | docs(review): re-bind after the main merge and the code-provenance resolution | code, agents-other, roadmap, docs |
| `feat-source-first-frontend` | `25b4478ac` | docs(review): re-bind the findings to the repaired scope, all six terminal | agents-other, roadmap, code, docs |
| `feat-source-first-frontend` | `b30c87b0e` | docs(review): bind the third review round, 6 findings, no high or critical | (none in scope) |
| `feat-source-first-frontend` | `40a8b5e94` | fix(source-first): repair the second-round findings, including a false claim in my own evidence | agents-other, roadmap, code |
| `feat-subagent-lifecycle-integrity` | `f1403f189` | docs(review): re-bind the round-2 findings after the fix pass | roadmap, code |
| `feat-subagent-lifecycle-integrity` | `7914694b9` | docs(review): bind round 2 of the completion review, and keep round 1 | agents-other, roadmap, docs, code |
| `feat-subagent-lifecycle-integrity` | `b58fcd59e` | docs(review): re-bind the findings artefact after the fix pass | agents-other, roadmap, docs, code |
| `feat-top-band-model-economy` | `80c994e8c` | docs(review): re-bind the R2 findings after the fix pass | agents-other, roadmap, code |
| `fix-branch-freshness-r2-findings` | `e63511efd` | docs(review): re-bind round 2 to the post-fix scope, all nine terminal | code |
| `fix-distillation-iron-law-3` | `3e03c75c4` | docs(review): re-bind the skip declaration after merging main | agents-other, roadmap, code, docs |
| `fix-distillation-iron-law-3` | `7184ae89e` | docs(review): re-scope the skip declaration after the main merge | code, roadmap, docs |
| `fix-gate-completeness-new-arrivals` | `41e8a1e4f` | docs(review): record round 2 of the completion review, rows open | (none in scope) |
| `fix-gate-completeness-new-arrivals` | `43847c1e1` | docs(review): re-bind the findings to the post-fix scope | (none in scope) |
| `fix-injection-budget-emission-and-session-state` | `5507a19e1` | docs(review): re-bind the hardening findings after the fixes and the base merge | (none in scope) |
| `fix-picktier-blocker-council-evidence` | `8b6be778a` | docs(evidence): re-bind the R2 findings and record the dispositions | roadmap, code |
| `fix-r2-ac-extraction-inline` | `fe639e548` | docs(review): close all six R2 findings and re-bind the artefact | docs, code |
| `frontend-skill-application` | `f9e66de97` | docs(review): re-bind after the CI fixes, and name what is unreviewed | roadmap, code, docs |
| `frontend-skill-application` | `03e102989` | docs(review): re-bind the R2 artefact after the generated-file regen | code, agents-other, docs |
| `frontend-skill-application` | `aa25eacf6` | docs(review): re-bind the R2 artefact to the fixed scope | roadmap, agents-other, code |
| `gate-autonomy-class-writeback` | `80226766d` | docs(review): re-bind and state which review covers which half of the branch | code, agents-other, roadmap |
| `gate-autonomy-class-writeback` | `6a0240e22` | docs(review): re-bind the findings to the post-merge scope | roadmap, code |
| `guard-input-prompt-binding` | `2fbf6bf3f` | docs(review): re-bind after the parity wiring | code, roadmap, docs |
| `guard-input-prompt-binding` | `9cf9c7c7e` | docs(review): withdraw the docs-only justification, the addition is code now | roadmap, code |
| `guard-input-prompt-binding` | `8f852d3c0` | docs(review): re-bind after the second main merge | agents-other, roadmap, code, docs |
| `guard-input-prompt-binding` | `fb5426dd0` | docs(review): re-bind after the main merge, and record it | code, agents-other, roadmap, docs |
| `guard-input-prompt-binding` | `7de39cd46` | docs(review): re-bind after the roadmap addition, and say what it did not cover | roadmap |
| `guard-input-prompt-binding` | `3e094ce3c` | docs(review): re-bind the R2 artefact after the fix pass | code, docs |
| `hook-payload-unwrap` | `94ffadcc1` | review(hook-payload-unwrap): re-bind the R2 artefact after the base merge | code |
| `hook-payload-unwrap` | `f2d8eed3b` | review(hook-payload-unwrap): re-bind the R2 artefact to the pack-cap scope | code |
| `hook-payload-unwrap` | `29b558e21` | review(hook-payload-unwrap): re-bind the R2 artefact to the post-fix scope, all 6 findings terminal | roadmap, code |
| `inbox-harvest-2026-08-c` | `591825da3` | docs(evidence): re-bind the completion-review skip after the anonymisation fix | agents-other |
| `inbox-harvest-residuals-closure` | `3a188cd6b` | docs(review): re-bind the R2 skip to the post-walk-down scope | code |
| `leakage-allowlist-anchors` | `fb6283fa2` | chore(review): re-bind the artefact and mark all seven findings fixed | code |
| `ledger-truth-backfill` | `3ce343dac` | docs(evidence): re-bind the completion review after the main merge | roadmap, code, docs |
| `ledger-truth-backfill` | `b043aef11` | docs(evidence): re-bind the completion review after the seven repairs | (none in scope) |
| `negative-test-antipattern` | `d2a0c544c` | chore(review): re-bind the artefact and mark all three findings fixed | code |
| `orchestrator-discipline-closeout` | `8c85ea05c` | docs(review): re-bind the R2 findings scope after the main merge | roadmap, agents-other, code |
| `orchestrator-discipline-closeout` | `6728b6798` | docs(review): re-bind the R2 findings after the fix pass | roadmap, agents-other, code |
| `org-telemetry-retention` | `29c610a5a` | docs(review): re-bind after the second main merge, and name the tool misclassification | roadmap, agents-other, code, docs |
| `org-telemetry-retention` | `fb39fef8e` | docs(review): re-bind after the main merge and record what moved since the review | roadmap, docs, code |
| `org-telemetry-retention` | `ffb9dbacc` | docs(review): re-bind the findings to the final content scope | code |
| `org-telemetry-retention` | `217beef37` | docs(review): re-bind the findings artefact to the post-fix scope | code |
| `pretool-slot-coverage-truth` | `81d611d27` | docs(evidence): re-bind the findings after the six fixes | code, docs |
| `release-review-p0` | `baecdfbfe` | docs(evidence): re-bind the R2 artefact after merging main | code, agents-other, roadmap, docs |
| `release-review-p0` | `4c0047eef` | docs(evidence): re-bind the R2 artefact after the quorum extraction | code |
| `release-review-p0` | `13c854aeb` | docs(evidence): re-bind the R2 artefact after the fixes, all 16 rows terminal | roadmap, docs, code |
| `road-to-inbox-harvest-2026-08-b-authoring-contract` | `092842250` | docs(review): re-bind the findings after the gate-hardening fix | roadmap, code |
| `road-to-inbox-harvest-2026-08-b-authoring-contract` | `0208175e6` | docs(review): re-bind the completion-review findings to the post-fix scope | roadmap, docs, code |
| `roadmap-sweep-2026-08-14-continued` | `922271617` | docs(review): re-bind the skip to the final scope, and name what three re-binds cost | agents-other |
| `roadmap-sweep-2026-08-14-continued` | `f16bfa68a` | docs(review): re-bind the completion-review skip after the roadmap closure | roadmap |
| `roadmap-sweep-2026-08-14-continued` | `4094b92f9` | docs(review): re-bind the completion-review skip to the post-report scope | (none in scope) |
| `rootless-write-refusal` | `85e703c65` | docs(review): re-bind the context manifest, not only the marker | (none in scope) |
| `run-continuation-provenance` | `00ea0239a` | docs(review): record round 8 findings before their fixes | agents-other, roadmap, code, docs |
| `run-continuation-provenance` | `c97dcfd37` | chore(review): archive round 6 and bind round 7 on the maintainer call | (none in scope) |
| `run-continuation-provenance` | `d320319f4` | chore(review): archive round 5 and bind round 6 | roadmap, code |
| `run-continuation-provenance` | `578d02189` | chore(review): archive round 4 and bind round 5 to the fixed head | code |
| `run-continuation-provenance` | `ccac4736a` | chore(review): archive round 3 and bind round 4 to the fixed head | roadmap, code |
| `run-continuation-provenance` | `03dc0080b` | chore(review): archive round 2 and re-bind the live artefact to the fixed head | roadmap, code |
| `run-continuation-round9` | `f17a6130d` | docs(review): re-bind round 9 after the base merge | agents-other, roadmap, docs, code |
| `single-delivery-binding` | `b2803e2b1` | docs(review): re-bind the findings artefact after the second main merge | roadmap, code |
| `single-delivery-binding` | `1d04be5e9` | docs(review): re-bind the findings artefact after the main merge | code |
| `single-delivery-binding` | `911d8be49` | docs(review): re-bind the findings artefact to the current scope | code, roadmap, docs |
| `single-delivery` | `110d7a6eb` | docs(review): re-bind after the size-budget repair | roadmap, code |
| `single-delivery` | `6ec209555` | docs(review): re-bind after the evidence-type declaration | agents-other |
| `single-delivery` | `ef2b3c122` | docs(review): re-bind after the base merge and ADR renumber | roadmap |
| `single-delivery` | `f9b7be682` | docs(review): re-bind the findings artefact to the current scope | (none in scope) |
| `solution-minimalism-t4-t5-scorers` | `575258b68` | docs(evidence): re-bind the review after the own-orphan cleanup | code |
| `solution-minimalism-t4-t5-scorers` | `71457e0bb` | docs(evidence): re-bind the review after the CI repair | code |
| `solution-minimalism-t4-t5-scorers` | `f54a02f4c` | docs(evidence): close the nine findings and re-bind the review scope | code |
| `source-first-browser-handover` | `f2ffe38e8` | docs(evidence): re-declare the skip after the forward-merge and index regen | code, agents-other, roadmap, docs |
| `source-first-browser-handover` | `90409ae8c` | docs(evidence): re-declare the docs-only skip at the post-split scope | code, docs |
| `standing-context-40k-phase4` | `b037e141c` | docs(review): re-bind the R2 artefact after the size-ratchet extraction | code |
| `stop-gate-detector-demotion` | `02a6c80bb` | docs(review): re-bind round 2 to the post-fix scope | code |
| `stop-gate-detector-demotion` | `2d8e32be8` | docs(review): land R2 round 2, findings unfixed — and archive round 1 | code, docs |
| `stop-gate-detector-demotion` | `8b9e19b09` | docs(review): re-bind after the estate-ratchet fix | code |
| `stop-gate-detector-demotion` | `1a151d6f8` | docs(review): re-bind the findings after the base merge | roadmap, code |
| `stop-gate-detector-demotion` | `f777b91ba` | docs(review): re-bind the findings to the post-fix scope | roadmap, docs, code |
| `structured-guard-input-phase1` | `ceac02600` | docs(review): re-bind the skip declaration to the Phase 2 re-cut scope | agents-other, roadmap, docs |
| `workspace-identity` | `04a92fca8` | docs(review): re-bind after the origin/main merge, with the measurement that justifies it | agents-other, docs, code |
| `workspace-identity` | `2c99f9421` | docs(review): re-bind the completion review to the post-fix scope | agents-other, code |
| `worktree-feat-turn-end-gate-always-on` | `9dd75ecf1` | docs(review): re-bind after the count correction | roadmap |
| `worktree-feat-turn-end-gate-always-on` | `e6016487e` | docs(review): re-bind the R2 artefact to the fixed scope, dispositions terminal | roadmap, code |
| `worktree-long-horizon` | `a589e5d55` | docs(review): record round 6 before its fixes | (none in scope) |
| `worktree-long-horizon` | `8905d43b4` | docs(review): record round 5 before its fixes | (none in scope) |
| `worktree-long-horizon` | `807ceabaa` | docs(review): record round 4 before its fixes | (none in scope) |
| `worktree-long-horizon` | `a9870a331` | docs(review): record round 3 before its fixes | (none in scope) |
| `worktree-long-horizon` | `aabe209d7` | docs(review): record round 2 before its fixes | (none in scope) |
| `zcs-close-2026-08-09` | `b14f2ae8e` | docs(review): re-bind the R2 findings scope after the CI fix | code |
| `zcs-close-2026-08-09` | `143c8a3b4` | docs(review): re-bind the R2 findings scope after the main merge | roadmap, docs |
| `zcs-close-2026-08-09` | `30461c9c1` | docs(review): re-bind R2 findings to the post-fix review scope (contract 2.1 in-place re-bind) | (none in scope) |

<!-- END probe_review_binding_drift -->
