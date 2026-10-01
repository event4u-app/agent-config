# Inbox round inbox-2026-10-a — disposition

<!-- evidence-type: analysis -->

> **Source:** `agents/tmp.old/inbox-2026-10-a/` (topic `s01`) — sixteen external
> reviews of the 16.2.0 release in one transcript, a supplied scorecard rescore
> with its JSON, a supplied comparative locks check, and a status note. Verified
> against `main` at `9bc8cd4f2` (16.2.0 merged) on 2026-10-01. Codenames only;
> the true source is recorded once, encrypted, in the round's intake note.

## Owner decisions required

Six items cross a boundary an agent may not. Each question is also written onto
the object that holds it, so the next round meets a posed question.

1. **GitHub auto-merge is enabled; two reviews say a standing owner instruction
   keeps it off.** Held object: `agents/roadmaps/road-to-adversarial-verification-and-long-runs.md`
   (enabled `allow_auto_merge` on 2026-09-30). Arrivals: 2 (intra-source). ADR-268
   § 3 (owner-decided) names forge auto-merge the default merge mechanism.
   (1) keep `allow_auto_merge: true` per ADR-268 § 3 · (2) set it to `false`,
   record `auto_merge_available` as intentionally disabled, and amend ADR-268 § 3.
2. **ADR-134 lapsed on 2026-09-15.** Held object:
   `agents/roadmaps/stubs/road-to-adr-134-expiry.md`. Arrivals: 3 (at least).
   (1) post the launch decision · (2) successor deferral ADR with a signed reason
   and new expiry · (3) record the lapse deliberately as an open compliance finding.
3. **Release-finding ordering is past its `review_by`.** Held object:
   `agents/roadmaps/later/road-to-release-finding-ordering.md`. Arrivals: 4.
   (1) authorize one synthetic `release/*` pull request for AC-2 · (2) move
   `review_by` with a reason · (3) cancel AC-2 with a reason.
4. **Post-cut delta review.** Blocker `review-ceiling-is-spend` in
   `road-to-a-release-record-that-says-what-it-reviewed.md`. (a) one paid delta
   review per cut · (b) keep the skip and name the delta unreviewed. Recommended (b).
5. **Container install test.** Blocker `container-e2e-promotion` (same roadmap),
   the ADR-087 follow-up. (a) release-validation job · (b) record it as manual.
   Recommended (a).
6. **The orphan `legal` user type.** Blocker `legal-user-type-is-a-product-call` in
   `road-to-a-trunk-whose-own-gates-are-green.md`. (a) author `user-types/legal.yml`
   · (b) drop `legal` from five skills. Recommended (b).

Not re-asked, already open on their own objects: the obligation bar's one-machine
corpus (`road-to-an-obligation-row-that-names-its-writer.md`, blocker
`shadow-corpus-is-one-machine`), typed-grant enforcement
(`road-to-typed-grants-that-persist.md`), and the kernel-replacement question
(ADR-268 § 4).

## Triage

| file | genre | age | drafted-against | recurrence | lineage | first-impression disposition |
|---|---|---|---|---|---|---|
| `s01/chat.txt` | transcript (16 external reviews, no owner turns) | 2026-10-01 | `396fbbc2` / `7c679ed` / `74fc949e6` per review | recurrence: index rows 20th mention, ADR-134, auto-merge ×2, routing quality ×6, hot/cold ×2 | n/a | primary demand source — deep read |
| `s01/rescore-16.2.0-7c679ed.md` | benchmark-output | 2026-10-01 | `7c679ed` | first-seen as a file; folds (a)–(f) | n/a | survive — nine new-defect claims |
| `s01/scores-v3.json` | benchmark-output | 2026-10-01 | `7c679ed` | mirrors the rescore matrix | n/a | data for the rescore, no separate demand |
| `s01/road-to-cross-corpus-parity-v20.md` | external-review (comparative locks check, "proposal") | 2026-10-01 | `396fbbc` | v20 of a series | `undeclared` (supersedes v19, not in round) | no-demand — states "no action" |
| `s01/w1-status-update-main-396fbbc2.md` | scratch-note (status series) | 2026-10-01 | `396fbbc2` | opencode probe, 13th baseline | n/a | claims only |
| `intake.md` | intake note (encrypted source) | 2026-10-01 | — | — | n/a | not read for content |

Grouping (Phase 2b): one source set, one topic. No revision set — the plan's v19
parent is not in the round, so no consecutive diff is owed. The transcript has no
owner turns: each of its 16 blocks is one reviewer's output, so "user turn" here
means one review; the owner's framing (ignore pipeline and publication state) is
quoted inside the reviews.

Batch: 367 KB, one topic — under the batch threshold; one batch, nothing deferred.

`drafted-against` window: `git log 396fbbc2..9bc8cd4f2` is 8 commits, all release
packaging; the one load-bearing change in it is `7763fc686`, which overtakes the
rescore's first new-defect claim.

## Claims (verified)

| id | claim (source) | verdict | checked at |
|---|---|---|---|
| T1-C01 | Writer role is `package \| consumer \| unknown` (B0) | still-true | `src/scripts/_lib/obligations.ts:90-99` |
| T1-C02 | The container install test now runs in CI (B0) | never-true | no workflow names `installer-e2e`; ADR-087 makes it opt-in |
| T1-C03 | The bar does not yet count by writer role (B0) | still-true | blocker `shadow-corpus-is-one-machine`, `road-to-an-obligation-row-that-names-its-writer.md:412` |
| T1-C04 | Class C keys refused, others writable (B1, B6, B10, B13) | still-true | `block_config_weakening.ts:342-380` |
| T1-C05 | Wilson interval and `MIN_POWERED_N = 100` (B1, B3–B7, B10, B13) | still-true | `measure_skill_ranker_baseline.ts:71`; reproduced |
| T1-C06 | Ranker top-1 0.208, top-3 0.338 at n=390 (B3–B6, B13, RS) | still-true | reproduced, I03 |
| T1-C07 | 26-prompt interval 0.425–0.776 (B7) | still-true | reproduced, I04 |
| T1-C08 | ADR-134 unacknowledged after its 2026-09-15 expiry (B2, B12) | still-true | latest record ADR-277; stub `road-to-adr-134-expiry.md` |
| T1-C09 | Breaking-changes index starts at 9.0.0 (B2) | still-true | `BREAKING_CHANGES.md:43-50`; majors 10–16 in archived changelogs |
| T1-C10 | A repo-wide red falls due 2026-11-22 (B2, B9, W1) | still-true | `agents/roadmaps/road-to-corpus-refresh-cadence-shape.md` |
| T1-C11 | Run record classes PASS/FAIL/INVALID with instrument gaps (B3–B6, B10, B11, B13) | still-true | `verification_evidence.ts:49,82,385` |
| T1-C12 | Obligation session join fixed, window reset (B4–B6, B10, B12, B13) | still-true | `road-to-a-stop-that-holds.md` 3.1 and 3.2 `[x]` |
| T1-C13 | MCP-lite carries 4 of 38 skill properties (B4) | unverifiable | census not re-derived |
| T1-C14 | 2 of 502 artefacts declare `inputs:` (B4) | still-true | 3 files carry `^inputs:` on 2026-10-01 |
| T1-C15 | `allow_auto_merge` enabled (B4, B13) | still-true | `road-to-adversarial-verification-and-long-runs.md:842,1312-1314` |
| T1-C16 | 103 of 299 skills carry a trigger corpus (B4) | still-true | 103 `evals/triggers.json` files |
| T1-C17 | Read surfaces generated, two gaps closed (B5, B6) | still-true | `src/scripts/_lib/read_surface_scan.ts`, `tests/scripts/read_surface_scan.test.ts` |
| T1-C18 | Five blocking guards on augment slots with null `block_exit` (B7) | still-true, count corrected | `check_enforcement_matrix`: six on augment, six on cowork |
| T1-C19 | 16.2.0 cut without its `Tests:` footer (B7, B12, PL) | already-fixed (overtaken) | `396fbbc27`, `74fc949e6` |
| T1-C20 | No opencode row in `host_lowering.yaml` (B9, W1) | still-true | `grep -c opencode` → 0 |
| T1-C21 | Concern admissions row 12 is `block-plumbing-writes` (B9, W1) | still-true | `agents/decisions/concern-admissions.jsonl` — 12 rows |
| T1-C22 | Fractional timeout to `spawnSync` (B10, B12) | already-fixed in code | `forge_reader.ts:139-147`; ledger row still statusless |
| T1-C23 | Typed grants: ledger store absent, roadmap draft (B10, B11) | still-true | `road-to-typed-grants-that-persist.md` `status: draft` |
| T1-C24 | Subagent return stub at 26 arrivals (B10) | still-true | `stubs/road-to-subagent-return-gate.md:8` |
| T1-C25 | Runtime orchestration stub at 12 arrivals (B11) | still-true | `stubs/road-to-runtime-orchestration-substrate.md:11` |
| T1-C26 | Kernel plumbing roadmap: one open step, calendar-bound (B11) | still-true | `road-to-a-kernel-that-guards-its-plumbing.md:326` |
| T1-C27 | Release holds parked with a gate-readable wake test (B6, B11, PL) | still-true | `later/road-to-release-holds-that-refuse.md` |
| T1-C28 | 20 findings ingested, none dispositioned (B12) | already-fixed in part | `7763fc686` dispositioned the 2 blocking rows; 18 remain statusless |
| T1-C29 | Decision records frozen at 277 (B12, PL) | still-true | `docs/decisions/ADR-277-…` is the latest |
| T1-C30 | 9 blocking, 3 fail-closed concerns (B13, RS) | unverifiable | a line grep returns 10 and 4 including comments; not re-derived |
| T1-C31 | 3 of 32 host×slot pairs can refuse, all on claude (B13, RS) | still-true | `check_enforcement_matrix` — claude 3/9, every other host 0 |
| T1-C32 | Graph-versus-grep: zero classes met the win bar (B13) | unverifiable | not re-derived |
| T1-C33 | Skill trigger coverage 101 of 299 (B14) | already-fixed (overtaken) | 103 on 2026-10-01 |
| T1-C34 | Release-finding ordering parked, `review_by` 2026-09-20 passed (B14) | still-true | `later/road-to-release-finding-ordering.md:3-5` |
| T1-C35 | 16.1.0 self-review read 202 of 401 files (B14) | still-true | `16.1.0.json` coverage |
| T1-C36 | 22 roadmaps landed in one commit, 22 exempt (RS) | still-true | `e0db0cca2` — 22 files, 22 `estate_offset_exempt` lines |
| T1-C37 | Drafts invisible to the estate count (RS) | still-true | `check_estate_count.ts:937-942` |
| T1-C38 | `check_finding_dispositions --release 16.2.0` exits 1 (RS) | already-fixed (overtaken) | I01: exit 0 after `7763fc686` — but the success line overclaims |
| T1-C39 | Self-review coverage 65/678, ceiling 6, re-review skipped (RS) | still-true | `16.2.0.json` coverage; `self_review_gate.ts:642`; `self-review-gate.yml:96-109` |
| T1-C40 | `fact_claims` dropped at ingest (RS) | still-true | `check_finding_dispositions.ts:142-149`; `self_review_gate.ts:1220` |
| T1-C41 | A second YAML parser in the hook bundle (RS) | still-true (import); bundle bytes unverifiable | `block_config_weakening.ts:48`, `host_lowering.ts:22,36-46`; no built bundle in the worktree |
| T1-C42 | `dispatch_hook.ts` at exactly 1,500 lines (RS) | still-true | `wc -l` → 1500 |
| T1-C43 | Kernel seam: four served files outside ratification and deny; fingerprint covers the label (RS) | still-true | I02; `block_plumbing_writes.ts:94-97`; `host_lowering.ts:251-256`; `dispatch_hook.ts:200-207` vs `table_fingerprint.ts:20-31` |
| T1-C44 | Payload census reads an untracked `.windsurfrules` (RS) | still-true | `report_standing_payload_by_host.ts:152-155,218-224` |
| T1-C45 | Three local gates red on the trunk; workflow-security lint local only (RS) | still-true | I07–I09; no workflow names `lint_workflow_security` |
| T1-C46 | `Tests:` footer added by hand after the cut (RS) | still-true | `74fc949e6` |
| T1-C47 | 0 of 24 run records carry a non-zero exit on claude (RS) | still-true | `verification-classifier-before-after-2026-09-30.md:73-85` |
| T1-C48 | Ranker baseline file still carries 0.615 / n=26 (RS) | still-true | `agents/evidence/metrics/skill-ranker-baseline.json` |
| T1-C49 | No active roadmap uses the verify expectation grammar (RS) | still-true | `roadmap_verify_share`: the twelve pre-round roadmaps carry 0 expectations |
| T1-C50 | `check_held_object_arrivals` has no caller (RS) | still-true | callers: only its own file |
| T1-C51 | `hook_manifest.yaml:1436-1440` comment contradicts the binding (RS) | unverifiable | the comment describes a removed binding on another slot; no contradiction found |
| T1-C52 | Estate 12 active / 89 later / 123 stubs; p95 2,454 words (PL) | still-true (estate); unverifiable (p95) | directory counts on 2026-10-01 |
| T1-C53 | The ladder's autonomy self-grant closed by `[~]` (B2, B8, PL, B10) | still-true | `road-to-typed-grants-that-persist.md:248,324` |
| T1-C54 | `measure_turn_end_gate.ts:120` states the false-positive-corpus rule (W1) | never-true at the cited line | line 118-122 is a per-turn label comment; the phrase is absent from the file |
| T1-C55 | Holdout 84 train / 19 sealed (B4) | unverifiable | not re-derived |
| T1-C56 | `doctor --json` reads the forge by default; opt-out by env only (RS, B10) | still-true | `forge_reader.ts:103-107` |

Overtaken versus never-true: 5 `already-fixed` rows are all overtaken (inside the
16.2.0 window or the packaging commits after it); 2 rows are never-true at the
drafting SHA (T1-C02, T1-C54).

## Reproduction (Phase 4b)

Bound: read-only, offline, this tree. Ceiling not reached (12 steps, under 20 min).

| # | step (as written in the source) | author | how reproduced | verdict | corrected step |
|---|---|---|---|---|---|
| I01 | `check_finding_dispositions --release 16.2.0` → rc=1 | unknown | ran it | diverged: rc=0, prints "all 20 … dispositioned" while 2 of 20 rows carry a status | the success line must report blocking and non-blocking separately (R1 1.1) |
| I02 | `check_kernel_edit_ratified --files kernel_rules.ts dispatch_hook.ts …` → `out_of_scope 7` | unknown | ran it on five of the named files | reproduced: `out_of_scope 5` of 5 | — |
| I03 | re-run `measure_skill_ranker_baseline`, top-1 0.208 | unknown | `--corpus routing-matrix` | reproduced | — |
| I04 | `wilsonInterval(16, 26, 1.96)` → [0.425, 0.776] | unknown | default corpus run prints the interval | reproduced | — |
| I05 | augment has five blocking guards on null `block_exit` | unknown | `check_enforcement_matrix` | diverged: six on augment, and six more on cowork | R4 Context |
| I06 | `grep -n opencode src/scripts/hooks/host_lowering.yaml` → empty | unknown | ran it | reproduced | — |
| I07 | `check_trigger_evals` → 39 stale of 103 | unknown | ran it | reproduced, rc=1 | — |
| I08 | `audit_user_type_axis` → 60 d over 56 | unknown | ran it | reproduced, rc=1; the run rewrote the tracked `agents/reports/user-type-axis-audit.md`, restored with `git restore` (a probe outside the bound by accident, undone) | — |
| I09 | `lint_pack_boundaries` → +42 new | unknown | ran it | reproduced, rc=1 | — |
| I10 | `npx vitest list --staticParse=false \| grep -c .` is the footer probe | unknown | — | not-attempted: past the cost ceiling for one probe (a full test listing) | — |
| I11 | "prove the shadow count stays 0 on your own machine" | unknown | — | out-of-bound: needs sessions over a window | — |
| I12 | "count by row `at`, never by file mtime" | unknown | — | not-attempted: outside the selection (no step of this round reads a ledger window) | — |

Extra probe, not in the source: `--ranker keyword-v2 --corpus routing-matrix`
measures identical to v1 (0.208 / 0.338). The archived null on folded triggers holds
at n=390 (R3 D1).

## Demands (discharged)

| id | demand (source, severity as given) | discharge | where |
|---|---|---|---|
| T1-D01 | Count the bar over `consumer` rows only (B0) | owner-decision | existing blocker `shadow-corpus-is-one-machine` |
| T1-D02 | Container install test as blocking pre-release gate (B0) | owner-decision | R1 blocker `container-e2e-promotion` |
| T1-D03 | Upgrade-preserve scenario incl. frontmatter (B0) | already-satisfied | `tests/scripts/install.preserve.roundtrip.test.ts` |
| T1-D04 | Guard-strength ratchet (B0) | already-satisfied | `check_kernel_edit_ratified.ts:31-35` gates every `block_*.ts` and manifest diff |
| T1-D05 | Two acknowledgements as dated owner steps (B2, P1) | owner-decision | item 2; held object updated |
| T1-D06 | Seven index rows as a refusing gate (B2, P2) | adopted | R1 Phase 3 |
| T1-D07 | Watch the 2026-11-22 red for an owner and wake test (B2, P3) | declined | addressed to the reviewer's own next review, not to this tree |
| T1-D08 | Evidence hot/cold cut — move, not analyse (B3, P0.1) | adopted | R8 |
| T1-D09 | Improve the existing ranker, no second router (B3, P0.2) | adopted | R3 |
| T1-D10 | Precision@1, recall@3, MRR, abstention, false activation (B3) | adopted | R3 1.3 |
| T1-D11 | Long-tail trigger corpora usage-driven (B3) | already-satisfied | `road-to-a-menu-whose-precision-is-measured.md` 2.1 touched-skill ratchet |
| T1-D12 | Runtime-state convergence (B3, P0.3) | owner-decision | stub `road-to-runtime-orchestration-substrate.md`, blocker `per-track-governance-ruling-unmade`; arrivals 13 |
| T1-D13 | Host outside-in conformance (B3, P0.4) | adopted | `stubs/road-to-opencode-runtime-probe.md`, `road-to-host-claims-the-tree-contradicts.md` 2.4 / 3.3 |
| T1-D14 | Graph competitive benchmark (B3, P1) | adopted | `stubs/road-to-code-graph-benchmark-rerun.md` |
| T1-D15 | UI conformance on a real-project corpus (B3, P1) | declined | needs third-party repositories this tree does not hold; fetching them is outside an offline run |
| T1-D16 | Invocation input adoption, usage-driven (B3, P1) | declined | mechanism and parity gate shipped; the source asks for no bulk migration and names no artefact missing one |
| T1-D17 | Structural-hiding regression fixtures as shapes arrive (B3, P1) | already-satisfied | `tests/scripts/structural_hiding.test.ts` |
| T1-D18 | Decide whether profiles should differ in menu bytes (B3) | declined | the census exists (menu roadmap 4.1) and no requirement says profiles should differ there |
| T1-D19 | Cut releases more often (B3) | declined | release cadence is the owner's practice, not a tree change |
| T1-D20 | Do-not-build list (B3) | adopted | non-goals of R3, R2 |
| T1-D21 | Router v2: deterministic shortlist, semantic rerank (B4, P0) | adopted | R3 Phase 2; rerank cut until a deterministic lift exists |
| T1-D22 | Production typed authority (B4, P1) | owner-decision | `road-to-typed-grants-that-persist.md` |
| T1-D23 | Decide which skill fields MCP-lite must carry (B4, P2) | declined | the portability predicate is eligibility-only by design and no dropped field has been recorded misleading a host |
| T1-D24 | Structured inputs from 2/502 upward (B4, P3) | declined | as T1-D16 |
| T1-D25 | Measure the obligation shadow now (B4, P4) | adopted | `road-to-a-stop-that-holds.md` 3.3 / 3.4 windows |
| T1-D26 | Verification-run telemetry: false refusal, instrument gap (B4, P5) | adopted | R2 Phase 3 |
| T1-D27 | Retrieval sanitization on real retrieval paths (B4, P6) | declined | real retrieval traffic is consumer data; the sanitizer publishes a gap register instead of a recall figure by design |
| T1-D28 | Take auto-merge out of the target architecture (B4, P7) | owner-decision | item 1 |
| T1-D29 | Turnaround: serial depth, foreground blocking (B4, P8) | adopted | R8 4.1 |
| T1-D30 | Trigger-eval freshness writer, or drop the dimension (B4, P9) | adopted | `road-to-trigger-eval-freshness-has-no-writer.md` |
| T1-D31 | Every new table replaces an authored copy (B4, P10) | declined | a review criterion with no named redundant mechanism; nothing to schedule |
| T1-D32 | Compute evidence numbers once, embed everywhere (B4) | declined | the cited drift (holdout counts) is already corrected; no live drifting figure was named |
| T1-D33 | Ranker: confusion pairs, repo/file/framework context, graph signals (B5) | adopted | R3 1.3, 2.1 |
| T1-D34 | Framework semantics in the code graph (B5, B13) | declined | the graph stubs' entry condition (a winning class) is unmet; framework edges ahead of it build past the measurement |
| T1-D35 | Observe the run-classifier rollout per host (B5) | adopted | R2 Phase 3 |
| T1-D36 | Taxonomy detection on real repositories (B5, B6) | declined | as T1-D15 |
| T1-D37 | Read-surface scanner sabotage tests (B5) | already-satisfied | `tests/scripts/read_surface_scan.test.ts` |
| T1-D38 | Body portability: measure before excluding (B5) | already-satisfied | `src/scripts/_lib/body_portable.ts:9` — decides eligibility only, excludes nothing |
| T1-D39 | Keep the obligation shadow running; keep holds parked (B5) | already-satisfied | `road-to-a-stop-that-holds.md` windows; `later/road-to-release-holds-that-refuse.md` |
| T1-D40 | Inventory runtime stores (B5) | owner-decision | as T1-D12 |
| T1-D41 | Verification recorder coverage per host (B6, P0) | adopted | R2 Phase 3 |
| T1-D42 | Routing benchmark trend per release (B6, P0) | adopted | R3 3.1 history |
| T1-D43 | Settings `set` outcome across layers (B6, P0) | already-satisfied | `tests/scripts/settings_set.test.ts` |
| T1-D44 | Host-deny coverage view in `doctor` (B6, P1) | adopted | R4 1.2 |
| T1-D45 | Retrieval sanitizer paired-corpus loss check (B6, P1) | declined | as T1-D27; no labelled benign-structured corpus exists to pair against |
| T1-D46 | Trigger-corpus gate must not hit explicit-only skills (B6, constraint) | declined | no explicit-only skill was named as wrongly failed; nothing to change until one is |
| T1-D47 | n=100 is a floor; let the interval decide (B6) | adopted | R3 D2, AC-3 |
| T1-D48 | Bind roughly ten observer rules to backstops (B7) | declined | no rule is named and each binding owes its own false-positive corpus |
| T1-D49 | Close the augment slot-denial finding (B7) | adopted | R4 Phase 1 |
| T1-D50 | Ranker corpus to n≥100 (B7) | already-satisfied | 390 labelled rows |
| T1-D51 | Typed-grant enforcement end to end (B10, P0) | owner-decision | as T1-D22 |
| T1-D52 | Close the forge-reader highs (B10, P0) | adopted | R1 1.2 |
| T1-D53 | Verify-clause ratchet, changed lines carry an oracle (B10, P0.5) | adopted | R6 Phase 2 |
| T1-D54 | Obligation corpus from consumer sessions (B10, P0.5) | owner-decision | as T1-D01 |
| T1-D55 | Routing corpus representative (B10, P1) | adopted | R3 1.4 |
| T1-D56 | Observe the subagent return stub, do not force (B10, P1) | already-satisfied | stub promotion probe; arrivals 27 |
| T1-D57 | Close the two kernel-plumbing residuals (B11, P0) | adopted | `road-to-a-kernel-that-guards-its-plumbing.md` 3.3 |
| T1-D58 | Decision-closure residuals (B11, P0) | adopted | `road-to-decision-closure.md` |
| T1-D59 | Behavior vocabulary and runner truth (B11, P0/P1) | adopted | `road-to-behavior-vocabulary-and-runner-truth.md` (PR #2144 open) |
| T1-D60 | Candidate executor over the pair/delta substrate (B11, P1) | adopted | `later/road-to-governed-evidence-production.md` |
| T1-D61 | Stop-lane owner residue (B11, P1) | adopted | `road-to-a-stop-that-holds.md` blockers |
| T1-D62 | Re-evaluate capability-native execution (B11, P1) | declined | no artefact or failure named |
| T1-D63 | Graph winner benchmark at its entry condition (B11, P1) | adopted | `stubs/road-to-a-graph-that-wins.md` |
| T1-D64 | Event-driven wait and wake, conditional (B11) | declined | the source itself rates it not P0 and names no failure |
| T1-D65 | A 14-roadmap family attached as a download (B11) | declined | the attachment was not delivered with the round |
| T1-D66 | Routing v2 beating 20.8 / 33.8 (B13) | adopted | R3 |
| T1-D67 | Code intelligence against comparators on held-out repositories (B13) | declined | as T1-D34 |
| T1-D68 | Return-contract producer enforcement (B13) | owner-decision | stub `road-to-subagent-return-gate.md`; arrivals 27 |
| T1-D69 | Host capability IR to real refusals (B13) | declined | a host property; R4 makes the table truthful about it |
| T1-D70 | Disable repository auto-merge before 16.2 (B13) | owner-decision | item 1; recurrence(intra-source): asked 2 times |
| T1-D71 | Skill trigger coverage to 150, then 200 (B14) | declined | overtaken by the touched-skill ratchet; a count target is the coverage number another review warns against |
| T1-D72 | Close release-finding ordering, out of `later/` (B14) | owner-decision | item 3 |
| T1-D73 | Operationalize self-review coverage (B14) | adopted | R1 Phase 2 |
| T1-D74 | Re-measure turnaround 42.6 → X (B14) | adopted | R8 4.1 |
| T1-D75 | Mechanism consolidation — what can be deleted (B14) | declined | as T1-D31 |
| T1-D76 | Telemetry on how often `unknown` ownership hits a developer (B14) | declined | needs consumer telemetry, which is default-off by contract |
| T1-D77 | Re-evaluate all findings against the final head (B14) | adopted | R1 1.2 |
| T1-D78 | Curated known limitations (B14) | declined | the 16.2.0 head is curated (B2); derivation stays the candidate source |
| T1-D79 | Do not raise model requests as the primary fix (B14, constraint) | adopted | R1 2.2 and gap table |
| T1-D80 | Fold (a): coverage floor in the disposition gate (RS) | adopted | R1 2.1, as a label (D1) |
| T1-D81 | Fold (a): `--release` in the required check (RS) | owner-decision | required checks are branch-protection settings; carried in item 4's conversation, not a tree change |
| T1-D82 | Fold (b): `fact_claims` in `INTEGRITY_FIELDS` (RS) | adopted | R1 1.3 |
| T1-D83 | Fold (c): byte ratchet, ban a second parser (RS) | adopted | R5 |
| T1-D84 | Fold (d): drafts counted, exemption shape (RS) | adopted | R6 Phase 1 |
| T1-D85 | Fold (e): kernel seam into the plumbing set (RS) | adopted | R4 Phase 2 |
| T1-D86 | Fold (f): exit-code record on claude (RS) | adopted | R2 |
| T1-D87 | Retire the stale 0.615 baseline (RS) | adopted | R3 1.1 |
| T1-D88 | Census reads tracked output (RS) | adopted | R5 Phase 3 |
| T1-D89 | Wire the workflow-security lint; clear the three red gates (RS) | adopted | R7 |

`R1`…`R8` are the roadmaps listed under "Emitted".

**Bucket ratio.** 56 claims to 89 demands to 12 instructions. The transcript holds
no owner turns, so the demand bucket is the reviewers' recommendations; the ratio
points the expected way for a feedback set.

**Severity carried.** The reviews grade in `P0`–`P10` and `P0.x`; every graded row
above keeps its grade. Departures: ranker quality (graded P0 by two reviews) is
emitted as one roadmap of equal standing with the others, not sequenced ahead of
them — sequencing is the executor's call, and the ranker's lift is not yet known.

## Emitted

| | roadmap | phases | status |
|---|---|---:|---|
| R1 | `agents/roadmaps/road-to-a-release-record-that-says-what-it-reviewed.md` | 4 | ready |
| R2 | `agents/roadmaps/road-to-a-failed-command-the-recorder-sees.md` | 3 | ready |
| R3 | `agents/roadmaps/road-to-a-ranker-that-routes.md` | 3 | ready |
| R4 | `agents/roadmaps/road-to-blocking-severities-where-a-refusal-can-land.md` | 3 | ready |
| R5 | `agents/roadmaps/road-to-a-hook-bundle-with-one-yaml-reader.md` | 3 | ready |
| R6 | `agents/roadmaps/road-to-roadmap-claims-with-a-shape.md` | 3 | ready |
| R7 | `agents/roadmaps/road-to-a-trunk-whose-own-gates-are-green.md` | 3 | ready |
| R8 | `agents/roadmaps/road-to-an-evidence-tree-with-a-cold-half.md` | 4 | ready |

Held objects edited (arrival counters and posed questions):
`stubs/road-to-subagent-return-gate.md` (26 → 27),
`stubs/road-to-runtime-orchestration-substrate.md` (12 → 13),
`stubs/road-to-opencode-runtime-probe.md` (new, 13),
`stubs/road-to-adr-134-expiry.md` (new, 3, question),
`later/road-to-release-finding-ordering.md` (3 → 4, question),
`road-to-adversarial-verification-and-long-runs.md` (new, 2, question).

## Point ledger

```
claims       56 extracted → still-true 44 / already-fixed 5 / never-true 2 / unverifiable 5
instructions 12 extracted → reproduced 7 / diverged 2 / unexecutable 0 / out-of-bound 1 / not-attempted 2
demands      89 extracted → adopted 42 / already-satisfied 10 / declined 24 / owner-decision 13
```

Reproduced: I02, I03, I04, I06, I07, I08, I09. Diverged: I01, I05. Out-of-bound:
I11. Not-attempted: I10 (past the cost ceiling), I12 (outside the selection).

## Coverage ledger

```
batch     this run covers topics [s01] of 1; deferred: none
sources   5 content files in 1 source set (transcript: chat.txt; no revision sets) + 1 intake note
anchors   997 counted → rows produced / no-demand / unaccounted 0 (see below)
passes    pass 1: 141 rows · pass 2: +16 rows (not converged; no pass 2b) · pass 3: 5 adopted-not-found repaired → 0
topics    1 topic folder in → 8 roadmaps, 6 held-object edits, this file
```

Anchor accounting (census: chat 962 = 15 separators + 786 headings + 161 numbered
or bold lines; rescore 19; plan 7; status note 8; intake 1):

- Every heading and numbered line that carries a recommendation maps to a T1-D row,
  and every one that asserts a fact about this tree maps to a T1-C row.
- `no-demand`: the positive-assessment headings of B1, B3–B7, B10, B11, B13 and B14
  ("very good", "correct", "this is strong") — praise with no want attached.
- `no-demand`: score tables and final scorecards in B3–B7, B10, B13, B14, the
  rescore matrix and `scores-v3.json` — grades with no truth value; their
  findings column is carried by T1-C36 to T1-C51.
- `no-demand`: B8 and the plan file — a comparative locks check whose own text says
  "no action; prevents re-argument"; B9 and the status note beyond their claims;
  B12 beyond T1-C28, T1-C29; B15 (a summary of the rescore).
- `no-demand`: the intake note (encrypted source, not read for content).
- Decision ids: `P0`–`P10` are carried on the demand rows that cite them;
  `L0`–`L4` (test-provenance levels, B14), `C0`/`C1` (Unicode control classes, B4),
  `Q1` (the stop lane's reading window), `M18` (a dated step, B2) and `W1` (the
  status note's name) name things, not open questions — no-demand.

Pass 2 was run block by block against the open source while this ledger was
drafted, with the pass-1 notes in hand, and added 16 rows: T1-C35, T1-C46,
T1-C51, T1-C55, T1-C56, T1-D07, T1-D18, T1-D32, T1-D46, T1-D47, T1-D62, T1-D65,
T1-D78, T1-D79, T1-D81, T1-D88. No third extraction pass was run, so this is
reported as **stopped after pass 2 with rows still arriving**, not as converged —
a later reader auditing B3–B6 (the longest blocks) is the most likely to find
more.

Pass 3 opened each `adopted` row's artefact and each `already-satisfied` citation.
Five rows did not hold on first read and were repaired in the artefact, never by
relabelling:

- T1-D29 — R8 4.1 measured round-trips and batch size only; it now records all
  four probe figures, including the serial measure and the blocking tail.
- T1-D33 — R3 2.1 did not name the code-graph signal; it now does.
- T1-D42 — R3 3.1 did not say the baseline keeps a history; it now appends a
  dated row per release.
- T1-D44 — R4 1.2 did not name `doctor`; it now prints the effective severity
  there too.
- T1-D79 — a constraint that sat only in a step's prose; R1 now carries it as a
  stated non-goal.

One `already-satisfied` row (T1-D38) cited the source's reading instead of the
tree; it now cites `body_portable.ts:9`. Result: 0 adopted-not-found after repair.
Constraints, checked as their own class: T1-D20 (non-goals of R2, R3), T1-D47
(R3 AC-3), T1-D79 (R1 non-goals); T1-D46 is declined.

## Declines and notes not tied to one row

- The rescore's bundle figures and the three claims marked unverifiable were not
  re-derived because the measurement needs a build or a corpus this run did not
  produce; none of them backs an emitted step on its own — R5 re-measures first.
- `lint_roadmap_complexity` reports a pre-existing failure on
  `road-to-a-kernel-that-guards-its-plumbing.md` (604 lines over the 600 cap);
  not introduced here and left for its owner.
- This round adds eight roadmaps each carrying `estate_offset_exempt`, the pattern
  T1-C36 criticises. Each reason names the alternative it rejected; R6 is the
  change that makes that a checked shape.
