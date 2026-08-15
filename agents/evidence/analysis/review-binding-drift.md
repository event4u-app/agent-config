# Review-binding segment drift

Phase 1 + Phase 2 of `road-to-inbox-harvest-2026-08-c-evidence-lifecycle`.

The question: the R2 manifest carries three hash segments (`scope_hash`,
`roadmap_hash`, `ac_hash`) and the currency verdict consults only the first.
`agents/roadmaps/` sits inside the scope, so flipping a checkbox moves
`scope_hash` and invalidates a binding no code change touched. That mechanism
is verified from source. This file measures whether it is what has actually
been costing re-binds.

## Decision — Phase 2 STOPS

**The verdict does not become segment-aware. Steps 2.2 and 2.3 are cancelled.**

The ratio that decided it, over **81** recorded re-bind events:

| Cause (by changed paths) | Events | Share | of those, span carried a merge |
|---|---:|---:|---:|
| `code` — a code path changed | 64 | **79.0 %** | 23 |
| `non-code` — only roadmap / dashboard / docs | 10 | 12.3 % | 2 |
| `base-moved` — no path changed, but a merge landed | 0 | 0.0 % | 0 |
| `unattributable` — no path changed and no merge | 7 | 8.6 % | 0 |

**Addressable by the proposed fix: 8 of 81 events (9.9 %)** — non-code paths only
AND no merge in the span.

Step 2.1 pre-registered the stop condition in the roadmap's own words: *"A ratio
that shows code changes dominate is a legitimate stop: the churn would then be
reviews correctly noticing code, and nothing here should ship."* Code changes
dominate at 79 %, so the pre-registered condition is met and the stop is the
recorded outcome rather than a failure to build.

Three findings sharpen that, and each would have to be answered before anyone
reopens this:

**1. The addressable share is 9.9 %, not the whole non-code remainder.** A
segment-aware verdict consults roadmap and AC content. Two axes are measured
independently — which path classes changed, and whether a merge landed in the
span — because the scope is `base...head`, so merging the trunk rewrites the
diff without anyone touching a reviewed file. Subtracting the events where a
merge did the rewriting leaves 8 the fix would actually have prevented. The
merge axis is not in the roadmap's Context; it was found by the measurement,
and it also bounds the row above it: with 23 of the 64 `code` events carrying a
merge, 79 % is an upper bound on "the review correctly noticed a change", not an
exact count.

**2. The relaxation would buy 8 events at the cost of a silent failure mode.**
Risk 1 of the roadmap states it: the value of the binding is that it notices when
reviewed content moved, and a verdict that forgives one segment is "one careless
predicate away from forgiving a code change that rode along with a roadmap edit".
That failure is silent by construction — a review that wrongly reports current
looks exactly like one that is. Trading 9.9 % of re-bind churn against a silent
integrity hole in the gate is not a trade this evidence supports.

**3. A cheaper repair exists for most of that 9.9 %, and it is out of scope
here.** Of the 10 non-code events, the dashboard `agents/roadmaps-progress.md`
appears in 6. It is a GENERATED file that regenerates on every roadmap touch,
which is why the roadmap's Context observes that "a single checkbox produces two
in-scope file changes". Excluding a generated artefact from a diff scope is a
different act from excluding authored roadmap content — the latter is what Risk 4
rejects, and rightly. Whether the dashboard belongs in `REVIEW_SCOPE_EXCLUDES` is
a separate, smaller question this plan did not ask and this analysis does not
answer.

## Two integrity findings the measurement surfaced

Neither is in the roadmap's scope. Both are recorded because they were found.

**11 of 52 artefacts carry no `context-manifest` block at all.** Skip and
honest-null artefacts declare their scope hash in prose (`… scope <64-hex>,
declared …`) instead. Their binding is therefore not machine-verifiable by
`parseManifest`, and a measurement reading only manifests would have dropped
them. That population is not random: the skip grammar asserts "no code surface
for this completion", so it is exactly where a non-code re-bind is most likely.
Reading only manifests would have biased the ratio toward its own conclusion —
this probe reads both, and the 12.3 % above includes them.

**20 of the 28 stored `review-input/diff.patch` files no longer reproduce the
`scope_hash` their artefact binds.** The stored input is the scope the reviewer
actually read; after an in-place re-bind (contract §2.7) the artefact moves and
the input does not. The directory is therefore a record of the ORIGINAL review,
not of the current binding. That is a retention fact, and Phase 3 tiers against
it rather than against an assumption that the input still describes the binding.

**A stored input can outlive its artefact.** The tier pass enumerates
`*.review-input/` DIRECTORIES rather than findings artefacts, which is why it
reports 30 where the segment table reports 28 with a stored patch: one directory
has no committed artefact at all, and driving the tiering off the artefact list
skipped it silently while acceptance criterion 4 said "every directory". Found
by the R2 review of this very change.

<!-- BEGIN probe_review_binding_drift -->

## Measurement

Generated by `./scripts-run src/scripts/probe_review_binding_drift --write`.
Re-run it rather than editing the tables by hand; every number below is derived.
Everything outside the two markers is preserved across runs.

- Findings artefacts scanned: **53**
- Carrying a stored `review-input/diff.patch`: **29**
- `scope_hash` still reproduces that stored input: **9**
- `scope_hash` moved after dispatch: **20**
- Recorded re-bind events across all artefacts: **81**

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
| `code` — a code path changed | 64 | 79.0 % | 23 |
| `non-code` — only roadmap / dashboard / docs | 10 | 12.3 % | 2 |
| `base-moved` — no path changed, but a merge landed | 0 | 0.0 % | 0 |
| `unattributable` — no path changed and no merge | 7 | 8.6 % | 0 |

A merge landed in the span of **25** of 81 events
(30.9 %), including 23 filed under `code`. Those
are re-binds where the diff was rewritten by the merge as well as by an edit, so
the `code` row is an upper bound on "the review correctly noticed a change",
not an exact count.

**Addressable by a segment-aware verdict: 8 of 81 events
(9.9 %)** — non-code paths only AND no merge in the span.
Every other class moved either code or the diff itself, and consulting the roadmap
and AC segments does not reach any of them.

## Non-code-only re-binds, in full

- `active-remediation-no-open-errors` @ `65572bcf4` — docs(review): re-bind to the derived-page scope, record the infra red
  - paths: docs/proof.md
- `feat-local-only-gate-reds` @ `1cba2b111` — docs(review): re-bind the round-2 artefact to the fixed scope
  - paths: agents/roadmaps-progress.md, agents/roadmaps/road-to-local-only-gate-reds.md
- `feat-local-only-gate-reds` @ `57e4fc584` — docs(review): round 2 of the completion review, over the merged scope
  - paths: agents/evidence/analysis/always-loaded-corpus-scoping-verdict.md, agents/roadmaps-progress.md, agents/roadmaps/archive/road-to-always-loaded-corpus-scoping.md, agents/roadmaps/road-to-always-loaded-corpus-scoping.md, agents/roadmaps/road-to-local-only-gate-reds.md, docs/decisions/ADR-227-paths-scoping-is-saturated-not-a-corpus-lever.md, docs/decisions/INDEX.md
- `guard-input-prompt-binding` @ `7de39cd46` — docs(review): re-bind after the roadmap addition, and say what it did not cover
  - paths: agents/roadmaps-progress.md, agents/roadmaps/road-to-local-only-gate-reds.md
- `inbox-harvest-2026-08-c` @ `591825da3` — docs(evidence): re-bind the completion-review skip after the anonymisation fix
  - paths: agents/evidence/analysis/inbox-harvest-2026-08-c-triage.md
- `roadmap-sweep-2026-08-14-continued` @ `922271617` — docs(review): re-bind the skip to the final scope, and name what three re-binds cost
  - paths: agents/evidence/reports/SWEEP-REPORT-2026-08-14-continued.md
- `roadmap-sweep-2026-08-14-continued` @ `f16bfa68a` — docs(review): re-bind the completion-review skip after the roadmap closure
  - paths: agents/roadmaps-progress.md, agents/roadmaps/archive/road-to-inbox-harvest-2026-08.md, agents/roadmaps/archive/road-to-inbox-harvest-distillation.md, agents/roadmaps/road-to-inbox-harvest-2026-08.md, agents/roadmaps/road-to-inbox-harvest-residuals.md
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
| `always-loaded-corpus-scoping` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `carrier-layer-convergence` | moved | moved | same | 2 | code | — |
| `cli-delegate-entry-guard` | no-input | none | none | 3 | code | — |
| `conformance-round5-stop-refusal` | same | none | none | 0 | — | — |
| `conformance-round7` | moved | none | none | 1 | code | — |
| `consultation-rate-analyzer` | moved | none | none | 1 | code | — |
| `council-codex-transport` | moved | none | none | 1 | code | — |
| `council-integrity` | moved | moved | same | 3 | code | — |
| `council-remaining-adapters` | moved | none | none | 1 | code | — |
| `dead-citations-after-rule-migration` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `dispatch-safety-phase2` | no-input | moved | same | 3 | code | — |
| `evidence-lifecycle-phase1` | same | same | same | 0 | — | — |
| `feat-close-gate-reds-blockers` | same | same | same | 3 | code, unattributable | — |
| `feat-conformance-round6-measurement` | no-input | moved | moved | 0 | — | roadmap archived since dispatch |
| `feat-cost-parity-3-handoff-envelope` | moved | none | none | 1 | code | — |
| `feat-council-solo-floor-implementation` | moved | none | none | 1 | code | — |
| `feat-design-system-onramp-blockers` | moved | same | same | 2 | code | — |
| `feat-design-system-onramp` | moved | moved | same | 3 | code | roadmap archived since dispatch |
| `feat-inbox-harvest-b-ci-economy` | same | moved | same | 2 | code | — |
| `feat-inbox-harvest-b-ci-economy.round1` | no-input | moved | same | 0 | — | — |
| `feat-inbox-harvest-b-ci-economy.round2` | no-input | moved | same | 0 | — | — |
| `feat-inbox-harvest-b-ledger-truth` | moved | none | none | 1 | code | — |
| `feat-inbox-harvest-b-quorum-telemetry` | same | moved | same | 1 | unattributable | roadmap archived since dispatch |
| `feat-local-only-gate-reds` | same | moved | moved | 3 | non-code, code | roadmap archived since dispatch |
| `feat-parallel-session-collision-hardening` | moved | none | none | 3 | code | — |
| `feat-road-to-rule-delivery-integrity` | no-input | moved | same | 1 | unattributable | roadmap archived since dispatch |
| `feat-road-to-skill-ecosystem-authoring-discipline` | no-input | moved | moved | 1 | code | roadmap archived since dispatch |
| `feat-road-to-zero-ceremony-settings` | no-input | moved | moved | 1 | code | — |
| `feat-source-first-frontend` | same | moved | same | 4 | code, unattributable | — |
| `feat-subagent-lifecycle-integrity` | moved | moved | same | 3 | code | — |
| `feat-subagent-lifecycle-phase0-payload-spikes` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `fix-branch-freshness-r2-findings` | moved | none | none | 1 | code | — |
| `fix-distillation-iron-law-3` | prose-bound | none | none | 2 | code | skip artefact — scope hash in prose |
| `frontend-skill-application` | moved | none | none | 3 | code | — |
| `guard-input-prompt-binding` | moved | none | none | 6 | code, non-code | — |
| `inbox-harvest-2026-08-c` | prose-bound | none | none | 1 | non-code | skip artefact — scope hash in prose |
| `install-lifecycle-pack-source-decision` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `leakage-allowlist-anchors` | no-input | none | none | 1 | code | — |
| `negative-test-antipattern` | no-input | none | none | 1 | code | — |
| `orchestrator-discipline-closeout` | no-input | none | none | 2 | code | — |
| `road-to-inbox-harvest-2026-08-b-authoring-contract` | same | none | none | 2 | code | — |
| `roadmap-blocker-premise-corrections` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `roadmap-sweep-2026-08-14-continued` | prose-bound | none | none | 3 | non-code, unattributable | skip artefact — scope hash in prose |
| `rootless-write-refusal` | moved | none | none | 1 | unattributable | — |
| `structured-guard-input-phase1` | prose-bound | none | none | 1 | non-code | skip artefact — scope hash in prose |
| `turn-end-gate-r2-fixes` | same | none | none | 0 | — | — |
| `waiter-discipline` | prose-bound | none | none | 0 | — | skip artefact — scope hash in prose |
| `workspace-identity` | moved | same | same | 2 | code | — |
| `worktree-feat-turn-end-gate-always-on` | moved | moved | same | 2 | non-code, code | — |
| `zcs-close-2026-08-09` | moved | same | same | 3 | code, non-code, unattributable | — |
| `zcs-closure-round2` | no-input | moved | moved | 0 | — | — |
| `zcs-closure` | no-input | moved | moved | 0 | — | — |

## Retention tiers

`active` = the artefact still binds the scope its stored input records ·
`recent` = re-bound, and the reviewed head is not yet in the trunk ·
`archived` = the reviewed head is an ancestor of `origin/main`.

| Tier | Dirs | Bytes |
|---|---:|---:|
| active | 1 | 0.09 MB |
| archived | 29 | 3.15 MB |
| **total** | **30** | **3.24 MB** |

### Regeneration guarantee

Re-derived successfully: **11** of 30 — 1.12 MB.
Not re-derivable from the record: **19** — 2.12 MB, which stays regardless.

That bounds the `evidence-compaction-approval` blocker: the most any compaction
could reclaim is **1.12 MB** of 3.24 MB (34.7 %), and only
from the directories listed as re-derivable below.

A stored patch counts as reproducible only when it was ACTUALLY re-derived
here, byte-for-byte. The manifest records no base revision, so reproducibility
is never assertable from the record alone — it is attempted, and the attempt is
what the verdict reports.

**Irreproducible directories — these patches are the only copy and stay:**

- `conformance-round7.review-input` (0.13 MB, archived) — no — not re-derivable from the recorded head alone
- `consultation-rate-analyzer.review-input` (0.03 MB, archived) — no — not re-derivable from the recorded head alone
- `council-codex-transport.review-input` (0.02 MB, archived) — no — not re-derivable from the recorded head alone
- `council-integrity.review-input` (0.09 MB, archived) — no — not re-derivable from the recorded head alone
- `council-remaining-adapters.review-input` (0.02 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-design-system-onramp-blockers.review-input` (0.22 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-design-system-onramp.review-input` (0.49 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-inbox-harvest-b-ci-economy.review-input` (0.12 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-inbox-harvest-b-ledger-truth.review-input` (0.09 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-inbox-harvest-b-quorum-telemetry.review-input` (0.07 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-local-only-gate-reds.review-input` (0.06 MB, archived) — no — not re-derivable from the recorded head alone
- `feat-parallel-session-collision-hardening.review-input` (0.06 MB, archived) — no — not re-derivable from the recorded head alone
- `frontend-skill-application.review-input` (0.17 MB, archived) — no — not re-derivable from the recorded head alone
- `guard-input-prompt-binding.review-input` (0.09 MB, archived) — no — not re-derivable from the recorded head alone
- `pr-target-base-freshness.review-input` (0.04 MB, archived) — no — not re-derivable from the recorded head alone
- `turn-end-gate-r2-fixes.review-input` (0.07 MB, archived) — no — not re-derivable from the recorded head alone
- `workspace-identity.review-input` (0.13 MB, archived) — no — not re-derivable from the recorded head alone
- `worktree-feat-turn-end-gate-always-on.review-input` (0.08 MB, archived) — no — not re-derivable from the recorded head alone
- `zcs-close-2026-08-09.review-input` (0.14 MB, archived) — no — not re-derivable from the recorded head alone

| Directory | Tier | Bytes | Re-derivable |
|---|---|---:|---|
| `carrier-layer-convergence.review-input` | archived | 69 kB | yes — trunk at merge `aff2393b9` |
| `conformance-round5-stop-refusal.review-input` | archived | 184 kB | yes — trunk at merge `8975180df` |
| `conformance-round7.review-input` | archived | 130 kB | no — not re-derivable from the recorded head alone |
| `consultation-rate-analyzer.review-input` | archived | 33 kB | no — not re-derivable from the recorded head alone |
| `council-codex-transport.review-input` | archived | 18 kB | no — not re-derivable from the recorded head alone |
| `council-integrity.review-input` | archived | 92 kB | no — not re-derivable from the recorded head alone |
| `council-remaining-adapters.review-input` | archived | 18 kB | no — not re-derivable from the recorded head alone |
| `evidence-lifecycle-phase1.review-input` | active | 95 kB | yes — current `origin/main` |
| `feat-close-gate-reds-blockers.review-input` | archived | 60 kB | yes — trunk at merge `af9b8d7ff` |
| `feat-cost-parity-3-handoff-envelope.review-input` | archived | 134 kB | yes — trunk at merge `c3e51cc70` |
| `feat-council-solo-floor-implementation.review-input` | archived | 90 kB | yes — trunk at merge `196ff8bec` |
| `feat-design-system-onramp-blockers.review-input` | archived | 228 kB | no — not re-derivable from the recorded head alone |
| `feat-design-system-onramp.review-input` | archived | 503 kB | no — not re-derivable from the recorded head alone |
| `feat-inbox-harvest-b-ci-economy.review-input` | archived | 121 kB | no — not re-derivable from the recorded head alone |
| `feat-inbox-harvest-b-ledger-truth.review-input` | archived | 89 kB | no — not re-derivable from the recorded head alone |
| `feat-inbox-harvest-b-quorum-telemetry.review-input` | archived | 75 kB | no — not re-derivable from the recorded head alone |
| `feat-local-only-gate-reds.review-input` | archived | 62 kB | no — not re-derivable from the recorded head alone |
| `feat-parallel-session-collision-hardening.review-input` | archived | 61 kB | no — not re-derivable from the recorded head alone |
| `feat-source-first-frontend.review-input` | archived | 169 kB | yes — trunk at merge `5538a5998` |
| `feat-subagent-lifecycle-integrity.review-input` | archived | 80 kB | yes — trunk at merge `b3a2d29e2` |
| `fix-branch-freshness-r2-findings.review-input` | archived | 35 kB | yes — trunk at merge `b3fec2881` |
| `frontend-skill-application.review-input` | archived | 175 kB | no — not re-derivable from the recorded head alone |
| `guard-input-prompt-binding.review-input` | archived | 89 kB | no — not re-derivable from the recorded head alone |
| `pr-target-base-freshness.review-input` | archived | 39 kB | no — not re-derivable from the recorded head alone |
| `road-to-inbox-harvest-2026-08-b-authoring-contract.review-input` | archived | 184 kB | yes — trunk at merge `86cc1d778` |
| `rootless-write-refusal.review-input` | archived | 52 kB | yes — trunk at merge `42f22fd27` |
| `turn-end-gate-r2-fixes.review-input` | archived | 74 kB | no — not re-derivable from the recorded head alone |
| `workspace-identity.review-input` | archived | 134 kB | no — not re-derivable from the recorded head alone |
| `worktree-feat-turn-end-gate-always-on.review-input` | archived | 84 kB | no — not re-derivable from the recorded head alone |
| `zcs-close-2026-08-09.review-input` | archived | 146 kB | no — not re-derivable from the recorded head alone |

## Every re-bind event

| Binding | Commit | Subject | Path classes |
|---|---|---|---|
| `active-remediation-no-open-errors` | `1eff52101` | docs(review): re-bind after ADR-226 and the release merge | code |
| `active-remediation-no-open-errors` | `408b56162` | docs(review): re-bind after the main merge and the register fix | code, agents-other, roadmap, docs |
| `active-remediation-no-open-errors` | `f6516fccc` | docs(review): re-bind after the authorised re-anchor and its roadmap | roadmap, code |
| `active-remediation-no-open-errors` | `65572bcf4` | docs(review): re-bind to the derived-page scope, record the infra red | docs |
| `active-remediation-no-open-errors` | `d895ad705` | docs(review): re-bind the skip declaration to the token-budget scope | code, docs |
| `carrier-layer-convergence` | `884104c15` | review(carrier): re-bind to the post-merge scope — the fixed point | code, docs |
| `carrier-layer-convergence` | `9bbfbc353` | review(carrier): re-bind the R2 round to the shipping content, all 6 terminal | agents-other, roadmap, code |
| `cli-delegate-entry-guard` | `b0bf83704` | chore(review): re-bind the artefact after the bundle rebuild | code |
| `cli-delegate-entry-guard` | `ab4272b98` | chore(review): re-bind the artefact after merging main | code, docs |
| `cli-delegate-entry-guard` | `c1eb64ab0` | chore(review): re-bind the artefact and mark all six findings fixed | code |
| `conformance-round7` | `304b89866` | docs(review): re-bind the R2 artefact to the fixed scope | code |
| `consultation-rate-analyzer` | `0cc9057d9` | docs(review): re-bind the R2 artefact to the fixed scope | agents-other, code |
| `council-codex-transport` | `3a22d357e` | docs(review): re-bind the context manifest, not only the marker | agents-other, roadmap, code |
| `council-integrity` | `dd58e0c7c` | review(council-integrity): re-bind after merging origin/main a second time | code, roadmap, docs |
| `council-integrity` | `eb84ecb6c` | review(council-integrity): re-bind after merging origin/main | roadmap, code, docs |
| `council-integrity` | `267ff3f3b` | review(council-integrity): re-bind the findings artefact to the fixed scope | roadmap, code |
| `council-remaining-adapters` | `783b78445` | docs(review): re-bind the adapter-follow-up artefact to the fixed scope | code |
| `dispatch-safety-phase2` | `40e110c72` | chore(review): re-bind round 2 and mark its three findings fixed | code |
| `dispatch-safety-phase2` | `756b226de` | chore(review): re-bind the R2 artefact after merging main | roadmap, docs, code |
| `dispatch-safety-phase2` | `081ffffbe` | chore(review): re-bind the R2 artefact and mark all eight findings fixed | code |
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
| `feat-inbox-harvest-b-ci-economy` | `57867dfd5` | fix(review): close the round-3 findings, including four npm ci sites the verify regex could not see | code, roadmap, docs |
| `feat-inbox-harvest-b-ci-economy` | `90cb3caff` | fix(review): repair the round-2 findings, including a self-falsifying cost table | code, roadmap, docs |
| `feat-inbox-harvest-b-ledger-truth` | `0a585db22` | docs(review): re-bind the completion review to the repaired scope | roadmap, docs, code |
| `feat-inbox-harvest-b-quorum-telemetry` | `4a0504cfc` | docs(review): record round 2 — the fixes introduced two of their own | (none in scope) |
| `feat-local-only-gate-reds` | `1cba2b111` | docs(review): re-bind the round-2 artefact to the fixed scope | roadmap |
| `feat-local-only-gate-reds` | `57e4fc584` | docs(review): round 2 of the completion review, over the merged scope | agents-other, roadmap, docs |
| `feat-local-only-gate-reds` | `c71466897` | docs(review): re-bind the completion-review artefact to the fixed scope | roadmap, code |
| `feat-parallel-session-collision-hardening` | `d4b23e1c9` | docs(review): re-bind the review artefact after the pipefail fix | code |
| `feat-parallel-session-collision-hardening` | `3fc625f8b` | docs(review): re-bind the review artefact after merging main | code, docs |
| `feat-parallel-session-collision-hardening` | `0fc9e822c` | docs(review): re-bind the completion-review artefact to the fixed scope | docs, code |
| `feat-road-to-rule-delivery-integrity` | `2ebdb87f0` | docs(review): re-derive the context-manifest scope_hash for the re-bound round (contract 5 header-manifest agreement) | (none in scope) |
| `feat-road-to-skill-ecosystem-authoring-discipline` | `f3d6e2a03` | review(authoring): mark all fourteen findings fixed, drop the regenerable input | code, docs |
| `feat-road-to-zero-ceremony-settings` | `0a96cca52` | review(settings): mark all ten findings fixed, drop the regenerable input | roadmap, docs, code |
| `feat-source-first-frontend` | `a2d1b7803` | docs(review): re-bind after the main merge and the code-provenance resolution | code, agents-other, roadmap, docs |
| `feat-source-first-frontend` | `25b4478ac` | docs(review): re-bind the findings to the repaired scope, all six terminal | agents-other, roadmap, code, docs |
| `feat-source-first-frontend` | `b30c87b0e` | docs(review): bind the third review round, 6 findings, no high or critical | (none in scope) |
| `feat-source-first-frontend` | `40a8b5e94` | fix(source-first): repair the second-round findings, including a false claim in my own evidence | agents-other, roadmap, code |
| `feat-subagent-lifecycle-integrity` | `f1403f189` | docs(review): re-bind the round-2 findings after the fix pass | roadmap, code |
| `feat-subagent-lifecycle-integrity` | `7914694b9` | docs(review): bind round 2 of the completion review, and keep round 1 | agents-other, roadmap, docs, code |
| `feat-subagent-lifecycle-integrity` | `b58fcd59e` | docs(review): re-bind the findings artefact after the fix pass | agents-other, roadmap, docs, code |
| `fix-branch-freshness-r2-findings` | `e63511efd` | docs(review): re-bind round 2 to the post-fix scope, all nine terminal | code |
| `fix-distillation-iron-law-3` | `3e03c75c4` | docs(review): re-bind the skip declaration after merging main | agents-other, roadmap, code, docs |
| `fix-distillation-iron-law-3` | `7184ae89e` | docs(review): re-scope the skip declaration after the main merge | code, roadmap, docs |
| `frontend-skill-application` | `f9e66de97` | docs(review): re-bind after the CI fixes, and name what is unreviewed | roadmap, code, docs |
| `frontend-skill-application` | `03e102989` | docs(review): re-bind the R2 artefact after the generated-file regen | code, agents-other, docs |
| `frontend-skill-application` | `aa25eacf6` | docs(review): re-bind the R2 artefact to the fixed scope | roadmap, agents-other, code |
| `guard-input-prompt-binding` | `2fbf6bf3f` | docs(review): re-bind after the parity wiring | code, roadmap, docs |
| `guard-input-prompt-binding` | `9cf9c7c7e` | docs(review): withdraw the docs-only justification, the addition is code now | roadmap, code |
| `guard-input-prompt-binding` | `8f852d3c0` | docs(review): re-bind after the second main merge | agents-other, roadmap, code, docs |
| `guard-input-prompt-binding` | `fb5426dd0` | docs(review): re-bind after the main merge, and record it | code, agents-other, roadmap, docs |
| `guard-input-prompt-binding` | `7de39cd46` | docs(review): re-bind after the roadmap addition, and say what it did not cover | roadmap |
| `guard-input-prompt-binding` | `3e094ce3c` | docs(review): re-bind the R2 artefact after the fix pass | code, docs |
| `inbox-harvest-2026-08-c` | `591825da3` | docs(evidence): re-bind the completion-review skip after the anonymisation fix | agents-other |
| `leakage-allowlist-anchors` | `fb6283fa2` | chore(review): re-bind the artefact and mark all seven findings fixed | code |
| `negative-test-antipattern` | `d2a0c544c` | chore(review): re-bind the artefact and mark all three findings fixed | code |
| `orchestrator-discipline-closeout` | `8c85ea05c` | docs(review): re-bind the R2 findings scope after the main merge | roadmap, agents-other, code |
| `orchestrator-discipline-closeout` | `6728b6798` | docs(review): re-bind the R2 findings after the fix pass | roadmap, agents-other, code |
| `road-to-inbox-harvest-2026-08-b-authoring-contract` | `092842250` | docs(review): re-bind the findings after the gate-hardening fix | roadmap, code |
| `road-to-inbox-harvest-2026-08-b-authoring-contract` | `0208175e6` | docs(review): re-bind the completion-review findings to the post-fix scope | roadmap, docs, code |
| `roadmap-sweep-2026-08-14-continued` | `922271617` | docs(review): re-bind the skip to the final scope, and name what three re-binds cost | agents-other |
| `roadmap-sweep-2026-08-14-continued` | `f16bfa68a` | docs(review): re-bind the completion-review skip after the roadmap closure | roadmap |
| `roadmap-sweep-2026-08-14-continued` | `4094b92f9` | docs(review): re-bind the completion-review skip to the post-report scope | (none in scope) |
| `rootless-write-refusal` | `85e703c65` | docs(review): re-bind the context manifest, not only the marker | (none in scope) |
| `structured-guard-input-phase1` | `ceac02600` | docs(review): re-bind the skip declaration to the Phase 2 re-cut scope | agents-other, roadmap, docs |
| `workspace-identity` | `04a92fca8` | docs(review): re-bind after the origin/main merge, with the measurement that justifies it | agents-other, docs, code |
| `workspace-identity` | `2c99f9421` | docs(review): re-bind the completion review to the post-fix scope | agents-other, code |
| `worktree-feat-turn-end-gate-always-on` | `9dd75ecf1` | docs(review): re-bind after the count correction | roadmap |
| `worktree-feat-turn-end-gate-always-on` | `e6016487e` | docs(review): re-bind the R2 artefact to the fixed scope, dispositions terminal | roadmap, code |
| `zcs-close-2026-08-09` | `b14f2ae8e` | docs(review): re-bind the R2 findings scope after the CI fix | code |
| `zcs-close-2026-08-09` | `143c8a3b4` | docs(review): re-bind the R2 findings scope after the main merge | roadmap, docs |
| `zcs-close-2026-08-09` | `30461c9c1` | docs(review): re-bind R2 findings to the post-fix review scope (contract 2.1 in-place re-bind) | (none in scope) |

<!-- END probe_review_binding_drift -->
