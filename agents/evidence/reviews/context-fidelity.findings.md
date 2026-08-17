# Findings: context-fidelity
<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: cf7f987ace49a3748914cba75ebe2c5da69c1a5dadbd637d996dd4e5b40c895d | diff: fb49e4c767cf99b6736f34b7308b247fcff7dbff | reviewer: r2-fresh-subagent-context-fidelity | prompt_hash: 9ba314f36e6d4c3638b8cbbcdf394f10a53d48e72ed5f897bccda9eb6a1f7092 -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-17 -->

<!-- context-manifest: v1
inputs:
  diff_sha: fb49e4c767cf99b6736f34b7308b247fcff7dbff
  scope_hash: cf7f987ace49a3748914cba75ebe2c5da69c1a5dadbd637d996dd4e5b40c895d
  roadmap: agents/roadmaps/road-to-context-fidelity.md
  roadmap_hash: c5b04e7aa773c0f51956ffce0a834854ab54e0356fa1e23a12c25d511f1fde1a
  ac_hash: 565d365d9d5db372be0b6902cc65d745f0289b5d7026f934f75258ca6c902972
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-17T11:36:40Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | `src/scripts/lint_skill_top_position.ts:69` | `OBLIGATION_HEADING_RE` anchors the phrase to heading-START, so `## Neutrality guidelines (Iron Law)` at `src/skills/ai-council/SKILL.md:185` is missed and the gate reports its flagship finding at line 1057 — wrong by 872 lines. Acting on the reported finding (promote/move the H3 at 1057) makes `firstObligationLine` return null, reclassifies the file `not_applicable_kind`, and the gate goes SILENTLY GREEN while the buried H2 at 185 is untouched. Fixing the reported finding blinds the gate to the file. | open | |
| 2 | high | `src/scripts/lint_skill_top_position.ts:6` | The load-bearing premise — post-compaction re-injection truncates by keeping the file START — is asserted as fact in five tracked surfaces (`:6`, `:176`, `taskfiles/ci-fast.yml:1227-1230`, `.github/workflows/skill-lint.yml:112-114`, `agents/roadmaps/road-to-context-fidelity.md:100`) and is unverified. The docblock hedges the CAP (§1) and the EFFECT (§3) and never the DIRECTION. The tree's only measured truncation fact (`src/rules/missing-skill-recovery.md:24-33`) is ENTRY-level — whole skills dropped, all descriptions stripped — a granularity intra-file ordering cannot help. The same diff's Context paragraph (`road-to-context-fidelity.md:47`) argues the opposite for attention: above ~half-full recency dominates and the session-start block is weakest. | open | |
| 3 | medium | `src/scripts/lint_skill_top_position.ts:11` | "nothing checked it" is inaccurate: `check_iron_law_prominence` exists, is registered with a coverage floor (`src/config/gate-coverage.yml:615`), is BLOCKING, and pointed at `src/skills` finds 13 violations with actionable diagnoses against this gate's 3 proxy warnings. The two definitions also conflict — new = any heading level incl. numbered `Iron Law N`, offset ≤ 60; existing = H2 only, H3+ IS the violation, prominence = among the first two H2s. `tests/scripts/lint_skill_top_position.test.ts` asserts `### Iron Law 1` / `###### Iron Law 2` are VALID, the shape the existing gate rejects and `preservation-guard` forbids ("No Iron Law downgrades"). Two of three findings are H3-only Iron Laws, so the gates disagree on the same text. | open | |
| 4 | medium | `.github/workflows/skill-lint.yml:117` | "Argv is identical to the `lint-skill-top-position` task" is FALSE: `Taskfile.yml:12-13` sets `QUIET_FLAG=--quiet` unless `AGENT_SCRIPT_VERBOSITY=verbose`, so the task runs `--quiet` and the workflow runs bare. `--quiet` suppresses the entire summary (`lint_skill_top_position.ts:299-307`) — no count, no median/p90, no UNVERIFIED/proxy caveat. Phase 3's exit criterion is "reports a count", and on the default local and `task ci` path it reports none. The test pinning the caveat exercises only the bare argv, so nothing pins the property on the argv actually used. Same false claim repeated at `road-to-context-fidelity.md:100`. | open | |
| 5 | medium | `src/scripts/lint_skill_top_position.ts:262` | `--format json` stdout is not parseable JSON: `ledger.report()` writes to stdout before the document, so `JSON.parse` fails on the `ledger: scanned=…` prefix. The tree already documents the convention for exactly this (`check_source_size_budget.ts:331-346` routes the report to a no-op writer under `--json` and states why); `GateLedger.report()` takes a `write` callback, so the fix is one argument. The test works AROUND the defect with `stdout.indexOf('{')` instead of asserting the contract. | open | |
| 6 | medium | `agents/evidence/eval-findings/context-fidelity-cf03.md:49-52` | "exclusively automatic … a shape the store shows has never once occurred here" reports an unobservable as an observation. The detector is pinned to one observed AUTO event (`src/scripts/_lib/session_eol.ts:11-19`), and nothing establishes that a manual compaction writes a `compact_boundary` record at all. "0 manual" is absence-of-RECORD, not absence-of-EVENT. The inference is then carried as fact into `road-to-context-fidelity.md:149` ("a path production never takes") and `docs/CLAIMS.md:630`, where it recommends re-specifying cf01 against the automatic path — permanently unmeasuring the manual path on the strength of an instrument that could not have seen it. | open | |
| 7 | medium | `agents/roadmaps/road-to-context-fidelity.md:20` | Prerequisite 4 is a RECURRING per-phase obligation ("before executing a phase") marked permanently `[x]`, and it was Acceptance Criterion 5's only tracked trigger. Phases 1, 2 and 4 would then run against a table last verified at `9beeb0662`, already behind `origin/main` at review time. This roadmap's own history is the argument: 373 commits stale, then 110, with one row wrong on half its claim. The checkbox that would have caught the third drift is spent. | open | |
| 8 | medium | `agents/evidence/eval-findings/context-fidelity-cf02.md:59` | The census that keeps Phase 2's kill criterion from firing has no retained substrate, and its independence claim is not one: the three walkers' sets are DISJOINT, so every entry has exactly one classifier and blindness buys nothing (cf02 itself concedes inter-rater agreement is unmeasured). The per-entry verdicts are pointed at "this run's session transcript" under `agents/runtime/` — which THIS SAME CHANGE documents (cf03) as gitignored state absent from any worktree. The 21.5 % cannot be audited or re-derived, and its only pointer aims at a store the branch proves unavailable. | open | |
| 9 | low | `src/scripts/lint_skill_top_position.ts:107-118` | Fence tracking compares the marker CHARACTER and never its LENGTH, so a shorter closing run closes a longer fence. A 4-backtick block wrapping a ```-fenced example inverts fence state for the rest of the file: an `## Iron Law` inside the example reads as real, and a genuine later heading is then treated as fenced and silently missed. Latent today (three skills carry 4-backtick fences, none nests a ``` run; `markdown-safe-codeblocks` forbids 4-backtick outer fences). Named because the failure direction is a silent UNDER-count in a gate whose only product is a count. | open | |
| 10 | low | `src/scripts/lint_skill_top_position.ts:131-146` | `collectPositions` drops an unreadable target before `ledger.plan()` sees it, so a skill directory with a missing or unreadable `SKILL.md` is never planned and never resolved and `planned=` shrinks with no skip code — the exact invisible skip the ledger exists to name (`_lib/gate_ledger.ts:6-13`). `check_gate_completeness` corrected this in itself by moving its existence filter into `outOfScope('manifest_absent')`. Benign today (290 dirs, 290 heads). | open | |
| 11 | low | `agents/roadmaps/road-to-context-fidelity.md:100` | The step's `verify:` probe cannot fail: the gate exits 0 by design, so the annotation proves the script parses, not that it measured anything. The same file refuses to fire Phase 2's kill criterion on precisely this ground ("a gate that passes because it cannot fail"). A field assertion was available and is used two steps earlier (`grep -q SESSION_INDEX_ROW_CAP …`). | open | |
| 12 | low | `src/scripts/lint_skill_top_position.ts:61` | `TOP_WINDOW_LINES = 60` sits between the measured median (39) and p90 (64), i.e. ≈86th percentile of the gate's own population, so "3 below the window" is a fact about where 60 falls in this data rather than about any cap. Two of the three findings are within 12 lines of the boundary (64, 72). The roadmap and the workflow quote the 3 without that framing. | open | |
| 13 | low | `agents/roadmaps/road-to-context-fidelity.md:100` | Denominator narrowness is disclosed in the gate's output but not in the quoted result: 22 of 290 heads are checked (7.6 %) and 268 skipped, so the population is self-selected by one heading vocabulary (`src/skills/prediction-pool-optimizer/SKILL.md:45` `## Hard rules` is an obligation-shaped block outside it). "290 heads scanned … 3 sit below the window" invites reading 3/290 rather than 3/22. | open | |

## Reviewer scope and what verified clean

All 12 branch-touched files, against the live tree at `fb49e4c76`. Gates run:
the new gate under five argv forms, its 35 tests, `check_gate_coverage`,
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
`reinject` hits; `gate-coverage.yml` 265 against a computed 265;
`session_eol_report` reproducing 473 / 29 / auto:29 / 964,035–1,031,366 / 17,890
/ 239 / 35 exactly; the gate reproducing 290 / 22 / 3 / median 39 / p90 64
exactly; `proof.md` in sync; and the Phase 1 `verify:` correction being real
(`lint_rule_references` absent, `check_references` present).

One red checked and NOT charged to this branch: `check_gate_completeness` reports
218 against a baseline of 216, inherited from the trunk — this gate adopts
`_lib/gate_ledger.ts` and does not appear in the un-adopted list, and the branch
base is behind `origin/main`.
