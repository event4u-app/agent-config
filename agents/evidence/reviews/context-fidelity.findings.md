# Findings: context-fidelity
<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: 966abf7cfb049c835aeb3f4e3b88f21052fa1ee5356c7d468858acda14404378 | diff: c19e0df8e45d04ec7f574858ab7361578345043d | reviewer: r2-fresh-subagent-context-fidelity | prompt_hash: da346f64d224b5e17c6016edd0009e4a9ca9bd44ea24bad169ea0d3946ab6fcf -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-17 -->

<!-- context-manifest: v1
inputs:
  diff_sha: c19e0df8e45d04ec7f574858ab7361578345043d
  scope_hash: 966abf7cfb049c835aeb3f4e3b88f21052fa1ee5356c7d468858acda14404378
  roadmap: agents/roadmaps/road-to-context-fidelity.md
  roadmap_hash: 3945357bc064ca28e9ea3cde77b6fee784280acb8c746537497b0b08c8d3c4f8
  ac_hash: 565d365d9d5db372be0b6902cc65d745f0289b5d7026f934f75258ca6c902972
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-17T12:10:56Z
-->

**Re-bound in place after the fix pass, per plan-review-gates §2.7.** The
findings were produced against scope
`cf7f987ace49a3748914cba75ebe2c5da69c1a5dadbd637d996dd4e5b40c895d` at head
`fb49e4c767cf99b6736f34b7308b247fcff7dbff` under prompt
`9ba314f36e6d4c3638b8cbbcdf394f10a53d48e72ed5f897bccda9eb6a1f7092`, and that
version — every row `open`, nothing fixed — is committed at `7ec6be613` so the
verdict as returned stays recoverable. The header above records the current scope
because the artefact asserts something about the tree NOW; the sentence records
the earlier one because a re-bind must not quietly reattribute a review to a diff
it never saw.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | `src/scripts/lint_skill_top_position.ts:69` | `OBLIGATION_HEADING_RE` anchors the phrase to heading-START, so `## Neutrality guidelines (Iron Law)` at `src/skills/ai-council/SKILL.md:185` is missed and the flagship finding is reported at line 1057 — off by 872 lines. Acting on the reported line makes `firstObligationLine` return null, reclassifies the file `not_applicable_kind`, and the gate goes SILENTLY GREEN on the file it was loudest about. | fixed | Verified independently (`sed -n 185p`, and `check_iron_law_prominence` reports both `:185 buried_iron_law` and `:1057 deep_iron_law`). The gate is withdrawn in `059250e9b`, so the matcher no longer exists. |
| 2 | high | `src/scripts/lint_skill_top_position.ts:6` | The premise "post-compaction re-injection truncates by keeping the file START" was asserted as fact in five tracked surfaces and is unverified. The docblock hedged the CAP (§1) and the EFFECT (§3) and never the DIRECTION. The tree's only measured truncation fact (`src/rules/missing-skill-recovery.md:24-33`) is ENTRY-level — whole skills dropped, all descriptions stripped — a granularity intra-file ordering cannot help; and this roadmap's own Context paragraph argues the opposite for attention. | fixed | All five surfaces removed with the gate (`059250e9b`). The roadmap now records the unverified premise as one of the three withdrawal reasons rather than carrying it. |
| 3 | medium | `src/scripts/lint_skill_top_position.ts:11` | "nothing checked it" is false: `check_iron_law_prominence` exists, has a coverage floor (`src/config/gate-coverage.yml:615`), is BLOCKING, and pointed at `src/skills` finds 13 violations against this gate's 3. The definitions also conflict — new = any heading level incl. numbered `Iron Law N`, offset ≤ 60; existing = H2 only, H3 IS the violation, prominence = among the first two H2s. The new test pinned `### Iron Law 1` as VALID, the shape `preservation-guard` forbids. | fixed | Verified independently: the gate exists, its CI argv is `["--quiet"]` with corpus `src/rules/*.md`, and it reports 13 over `src/skills`. This finding is what decided the withdrawal (`059250e9b`); the residual corpus gap is now the `prominence-gate-skills-corpus` blocker. |
| 4 | medium | `.github/workflows/skill-lint.yml:117` | "Argv is identical to the task" was false — `Taskfile.yml:12-13` injects `--quiet` unless verbose, and `--quiet` suppressed the entire summary, so on the default local and `task ci` path the gate reported no count at all while Phase 3's exit criterion is "reports a count". The test pinning the caveat exercised only the bare argv. | fixed | Workflow step and both registrations removed with the gate (`059250e9b`). |
| 5 | medium | `src/scripts/lint_skill_top_position.ts:262` | `--format json` stdout was not parseable JSON: `ledger.report()` wrote before the document. The tree already documents the fix for exactly this (`check_source_size_budget.ts:331-346` routes the report to a no-op writer under `--json`), and `GateLedger.report()` takes a `write` callback. The test worked AROUND it with `stdout.indexOf('{')`. | fixed | Script and test removed with the gate (`059250e9b`). |
| 6 | medium | `agents/evidence/eval-findings/context-fidelity-cf03.md:49-52` | "exclusively automatic … a shape the store shows has never once occurred here" reports an unobservable as an observation: the detector is pinned to ONE observed AUTO event (`src/scripts/_lib/session_eol.ts:11-19`) and nothing establishes that a manual compaction writes a `compact_boundary` record at all. The inference had propagated into the blocker recommendation and into `docs/CLAIMS.md`. | fixed | Verified independently at `session_eol.ts:8-22`. Corrected in all three places (`c19e0df8e`): "0 manual" now reads as absence of a RECORD, and the consequence is sharper — a cf01 null is UNINTERPRETABLE until manual detectability is established, so the blocker asks for one manual compaction as a precondition instead of recommending the manual path be abandoned. |
| 7 | medium | `agents/roadmaps/road-to-context-fidelity.md:20` | Prerequisite 4 is a RECURRING per-phase obligation ("before executing a phase") marked permanently `[x]`, and it is Acceptance Criterion 5's only tracked trigger. Phases 1, 2 and 4 would then run against a table last verified at `9beeb0662` — and this roadmap has already watched its table go stale twice, at 373 and 110 commits. | fixed | Back to `[ ]` in `c19e0df8e`, with the recurrence stated inline and this run's verification recorded in the Context table itself rather than in the checkbox. |
| 8 | medium | `agents/evidence/eval-findings/context-fidelity-cf02.md:59` | The census had no auditable substrate and its independence claim was not one: the three walkers' sets are DISJOINT, so every entry has exactly one classifier and mutual blindness is vacuous. The per-entry verdicts were pointed at "this run's session transcript" under `agents/runtime/` — which this same change documents as gitignored state absent from any worktree, making the 21.5 % unauditable by construction. | fixed | All 107 verdicts now in cf02 with the pointer each was decided on, stale rows carrying what the tree says instead (`c19e0df8e`). The independence claim is retracted in the text rather than deleted, and the batch mechanism (9 of 23 stale rows from two upstream changes) is now checkable against the tables rather than asserted. |
| 9 | low | `src/scripts/lint_skill_top_position.ts:107-118` | Fence tracking compared the marker CHARACTER and never its LENGTH, so a shorter closing run closed a longer fence: a 4-backtick block wrapping a ```-fenced example would invert fence state for the rest of the file and silently UNDER-count in a gate whose only product is a count. Latent (three skills carry 4-backtick fences, none nests a ``` run). | fixed | Removed with the gate (`059250e9b`). |
| 10 | low | `src/scripts/lint_skill_top_position.ts:131-146` | `collectPositions` dropped an unreadable target before `ledger.plan()` saw it, so `planned=` shrank with no skip code — the exact invisible skip the ledger exists to name. `check_gate_completeness` corrected this in itself via `outOfScope('manifest_absent')`. Benign at 290/290. | fixed | Removed with the gate (`059250e9b`). |
| 11 | low | `agents/roadmaps/road-to-context-fidelity.md:100` | The step's `verify:` probe could not fail — the gate exits 0 by design, so it proved the script parses, not that it measured anything. The same file refuses to fire Phase 2's kill criterion on precisely this ground. | fixed | The step is now `[-]` and its probe is a field assertion (`grep -q check_iron_law_prominence src/config/gate-coverage.yml`), which can fail (`c19e0df8e`). |
| 12 | low | `src/scripts/lint_skill_top_position.ts:61` | `TOP_WINDOW_LINES = 60` sat between the measured median (39) and p90 (64), i.e. ≈86th percentile of the gate's own population, so "3 below the window" was a fact about where 60 falls in this data. Two of three findings were within 12 lines of the boundary. | fixed | Removed with the gate (`059250e9b`); the roadmap no longer quotes the 3. |
| 13 | low | `agents/roadmaps/road-to-context-fidelity.md:100` | Denominator narrowness was disclosed in the gate's output but not in the quoted result: 22 of 290 heads checked, 268 skipped, so the population was self-selected by one heading vocabulary. "290 heads scanned … 3 sit below the window" invited reading 3/290. | fixed | Removed with the gate (`059250e9b`); the roadmap no longer quotes either number. |

## Disposition summary

13 findings, 13 `fixed`, and the shape of the fix is worth stating because it is
not the usual one: **ten of the thirteen were resolved by deleting the artefact
they were about.** The reverted gate (`059250e9b`) accounts for findings 1–5 and
9–13; only 6, 7 and 8 were repaired in place.

That ratio is the review's real result. A fix pass that had answered findings 1
through 5 individually would have produced a working second gate contradicting an
existing enforced one — each finding closed, the aggregate defect shipped.
Finding 3 is the one that made that visible, and it was a MEDIUM.

## Reviewer scope and what verified clean

All 12 branch-touched files, against the live tree at `fb49e4c76`. Gates run: the
(then-present) gate under five argv forms, its 35 tests, `check_gate_coverage`,
`check_gate_completeness`, `check_ci_local_parity`, `check_claims`,
`build_proof --check`, `check_references`, `check_md_language`,
`lint_evidence_artifacts`, `lint_roadmap_blockers`, `lint_plan_risk_register`,
`check_roadmap_trackable`, `lint_never_silent`, `lint_workflow_paths`,
`lint_workflow_security`, `check_gate_paths`, `check_test_coverage_diff`,
`memory_report`, `check_memory`, `session_eol_report`, and
`check_iron_law_prominence`.

Verified clean, so NOT findings: `SESSION_INDEX_ROW_CAP = 30`; `check_memory`
REQUIRED_KEYS and the stale / critical-stale guards; all 107 curated entries
uniform at `last_validated: 2026-07-09` / `review_after_days: 365` across
66/24/17; `memory_report` → `0.0% (0/107)`; `check_memory` → 0/0/0;
`hook_manifest.yaml:746`; all seven `session_start` chains at exactly
`717,724,768,802,817,836,853` with no reinject concern; `hot_context_hook.ts:394`
and `:52`; `session_eol.ts:40`; zero `quarantine` / `context_management` /
`reinject` hits; `session_eol_report` reproducing 473 / 29 / auto:29 /
964,035–1,031,366 / 17,890 / 239 / 35 exactly; `proof.md` in sync; and the Phase 1
`verify:` correction being real (`lint_rule_references` absent, `check_references`
present).

One red checked and NOT charged to this branch: `check_gate_completeness` reports
218 against a baseline of 216, inherited from the trunk — the branch base is
behind `origin/main`, and this branch's only gate-relevant change has since been
reverted.
