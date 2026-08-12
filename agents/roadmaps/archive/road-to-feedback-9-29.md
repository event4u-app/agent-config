---
complexity: structural
status: ready
execution:
  mode: autonomous
---

# Road to feedback 9.29 — close the verified residue of the external release reviews

> Eight external review blocks of the 9.23.0→9.29.0 span (plus one auditor
> follow-up) were verified claim-by-claim against the live tree; roughly
> two thirds of their recommendations are already shipped, already covered by
> an active or parked roadmap, or forbidden by a recorded lock. This roadmap
> executes the verified remainder and records every human-owned decision as a
> structured blocker.

> Source (consumed inbox): [`agents/tmp.old/feedback-9.29.0-1.txt`](../tmp.old/feedback-9.29.0-1.txt)
> (multi-model release-review compilation) and
> [`agents/tmp.old/claude-feedback-9.29.0-1.txt`](../tmp.old/claude-feedback-9.29.0-1.txt)
> (auditor follow-up with six maintainer-owned items + absence-experiment
> design). Produced by `/analyze:inbox`; verification ran against
> `origin/main` @ `5169ed39b` on 2026-08-09.

## Goal

Bring the review-verified open defects to zero (gate-completeness ratchet back
to ≤ 217, skill-lint warnings to 0, changelog placeholder heads curated for
9.27–9.29), land the four small capabilities the reviews converged on
(orchestration explain trace, unified conformance funnel report, user-visible
standing-delivery savings, self-repair deny-list), and pre-register the
scoped-rule absence experiment — without touching any surface a lock or an
active roadmap already owns.

## Prerequisites

- [x] Every review claim verified against the tree (4 parallel deep-reads +
      direct verification; consolidation table in the analysis session)
- [x] Overlap scan against active + parked roadmaps (see Prevented work)

## Context

- The reviews were written against the same head that merged as PR #1234/#1235,
  so the `already-fixed` fraction is low — but the overlap with existing
  roadmaps is high. Everything routed elsewhere is listed under **Prevented
  work** so it is never rebuilt here.
- The two sources disagree internally (one block demands "Build More", another
  "Consolidate, Measure, Remove"; one wants forensics expanded, another forbids
  new surface without utilization evidence). Contested directions are NOT
  resolved by this roadmap — each is a `## Blockers` entry for the maintainer.
- `check_gate_completeness` is red on main (225 vs baseline 217 — 8 gates
  landed after the baseline without adopting `gate_ledger` or carrying a
  `ledger-exempt` marker). The gate runs in `taskfiles/ci-fast.yml` only, so
  remote CI never saw it.

> Council pass (anthropic claude-sonnet-4-5 + openai gpt-4o, deep, 3 rounds,
> 2026-08-09 — response artefact local under `agents/runtime/council/responses/`,
> auto-pruned): converged on the Phase-1 ratchet interlock (resolved:
> new-files-only scope, phase-ordering), strict pre-registration sequencing
> (resolved: SHA-binding + outcome-C re-registration), operational exemption
> quality (resolved: property-naming criterion), dispatcher-routed test
> fixtures for all three explain branches, evidence pointers on prevented
> work, and blockers-are-not-completion-requirements. All folded in below.

## Gap-table (KEEP/FOLD/CUT — condensed; full verification in the session)

| Review ask | Verdict | Route |
|---|---|---|
| Gate-completeness red, lint warn, missing label | KEEP | Phase 1 |
| `enforced_by` declaration required on rules | KEEP | Phase 1 (ratchet form) |
| Changelog head curation, proof-page numbers, ledger policy | KEEP | Phase 2 |
| Absence pre-registration, loaded-token distribution, drill coverage scan | KEEP | Phase 3 |
| Orchestration explain, funnel report, savings surface, self-repair deny-list | KEEP | Phase 4 |
| Host-native-first ADR, consent timestamp, launch-draft refresh | KEEP | Phase 5 |
| Outcome ledger, capsule schema, Tier 0, capability registry, self-repair floors, roadmap:next guardrails, settings:get, git tiering, premortem-optional, session leases | FOLD (already shipped) | Prevented work |
| Solution-minimalism bench, orchestration A/B, bus-factor, capability graph, recycling, conformance rounds, skill consolidation | FOLD (existing roadmaps) | Prevented work |
| ADR-220 attestation now, retirement engine, hard session mutex, mechanised adherence gate, migration-YAML runtime claim | CUT (locked / never-true) | Prevented work |
| Runtime event bus, rule reduction, budget rebase, council cache, forensics expansion, highlights hard-block | CUT from execution → maintainer decisions | Blockers |

## Phase 1 — Gate and lint integrity

Restore the two red/warn signals the reviews caught and close the declared-
enforcement gap structurally.

- [x] Identify the 8 gates newer than the 217-baseline commit that neither
      import `_lib/gate_ledger.js` nor carry `// ledger-exempt:`; adopt the
      ledger where per-target accounting applies. An exemption is valid only
      when its reason names the specific implementation property that makes
      per-target accounting inapplicable (e.g. "single aggregate verdict, no
      per-target findings") — a generic reason is a finding, not a pass
      (council: operational definition, not vibe). <!-- verify: ./scripts-run src/scripts/check_gate_completeness -- exit 0 -->
- [x] Bring skill-lint warnings to 0: fix the "Output format section" warn
      surfaced by `task lint-skills` and the `command_missing_skill_references`
      warn on the source of `dist/agent-src/commands/team/delegate.md` (add a
      skill reference or `type: orchestrator`). <!-- verify: ./scripts-run src/scripts/skill_linter -- 0 warn — verified 2026-08-10: 437 pass, 0 warn, 0 fail (real warn was long_rule on preservation-guard → Iron-Law block added; delegate source got type: orchestrator) -->
- [x] Create the missing `self-repair` GitHub label so the issue-form egress
      path stops silently dropping it. <!-- verify: gh label list --search self-repair non-empty — verified 2026-08-10, label present (D93F0B) -->
- [x] Add an `enforced_by`-declaration ratchet scoped to NEW rule files only
      (council: an edited-rules trigger couples this lint to every unrelated
      rule touch — new-files-only removes the interlock): a new rule must
      carry `enforced_by:` (validator ref or explicit `none` + one-line
      rationale); the 84 existing undeclared rules are a committed baseline
      whose count may only fall. Gate scripts and their ledger-exempt markers
      (step 1.1) are a different surface and are not read by this lint.
      Kernel rule files are not edited by this step (projected-byte
      stability). The new lint itself adopts `gate_ledger` or carries a
      property-naming exemption from day one, and runs LAST in this phase so
      step 1.1's state is settled. <!-- verify: new lint self-test fixtures pass (new-rule-without-declaration fails, declared passes, baseline holds); check_gate_completeness stays exit 0 -->

Exit criteria: `check_gate_completeness` exits 0; skill lint reports 0 warn;
label exists; ratchet lint green with fixtures.
Rollback: revert the lint + exemption commits; label deletion is one command.
If rules landed between the ratchet and a revert, re-run the baseline write —
the revert is only clean when the ratchet commit is the newest rule-surface
change (council note).

## Phase 2 — Editorial closure

- [x] Rewrite the `_auto-derived, rewrite before merge:_` head lines for the
      9.27.0, 9.28.0 and 9.29.0 entries in `CHANGELOG.md` (lines ~320–321, 386,
      389, 485–488) into curated prose derived from the named commits — verify
      each named commit before describing it. <!-- verify: grep -c "auto-derived, rewrite before merge" CHANGELOG.md == 0 for those entries — done 2026-08-10: 7 lines curated, every claim per-commit verified, check_release_highlights "curated head plausible" on all three releases, grep count 0 -->
- [x] Put the conformance round-5 advisory-vs-blocking result (language mirror
      555→19 under advisory injection; blocking guards 8→0 and 1→0) onto
      `docs/proof.md` with its evidence pointer, and one README line pointing
      at it. Source the numbers from the round-5 roadmap/evidence artefacts,
      not from the review file. <!-- verify: grep "555" docs/proof.md -->
- [x] Ledger housekeeping: document the retention policy for
      `agents/decisions/rule-migrations/` in its README (the source-recovery
      rationale already recorded there stays authoritative — no deletion);
      check `agents/decisions/rule-activation-dispositions.yml` for consumers
      and add a closure/summary header if none consume it live. <!-- verify: lint_rule_migration_ledger green -->

Exit criteria: zero placeholder heads in the three release entries; proof page
carries the round-5 numbers with pointer; ledger README states retention.
Rollback: revert the doc commits (no behavior surface).

## Phase 3 — Evidence and measurement (one-shots, no gates)

- [x] Author `agents/evidence/analysis/scoped-rule-absence-preregistration.md`
      in the style of `activation-red-baseline-preregistration.md`, per the
      auditor's design: instrument = the host's InstructionsLoaded record
      (never the filesystem; zero instruction events = outcome C, instrument
      failure); read-corridor computed by expanding the glob-union of the 25
      scoped rules (expected corridor: `tests/**/*.ts`), the expansion output
      lands in the fixture; four outcomes (A hold / B scoped rule loads on
      non-match / B′ scoped rule fails to load on match — worse, obligation
      unreachable / C instrument failure); a single E1 violation ⇒ B, no
      "mostly holds" band. This lands in its own commit BEFORE any session
      run so the registered-before-looking property is in history; the doc
      records its own registration commit SHA placeholder, and the run
      protocol requires citing that SHA plus asserting no corridor-matching
      session ran between registration and experiment — otherwise the run is
      outcome C and re-registers (council: strict sequencing, no best-effort
      disclaimer). The two-session run itself is maintainer-machine work
      (see blockers). <!-- verify: file exists; md-language-check clean -->
- [x] Loaded-token distribution report: compute p50/p95/max delivered rule
      tokens per host/carrier from the existing `conformance_scan` JSONL
      records where present; if no local records exist, the report states
      "instrument ready, data pending" with the exact command to produce
      records — never a fabricated number. <!-- verify: report file in agents/evidence/analysis/ with computed numbers or the honest pending marker — done 2026-08-10: loaded-rule-token-distribution.md; carrier-level numbers real (union 190,794/186,436 tok, 109 divergent double-delivered rules), per-session p50/p95 honestly marked unmeasurable until InstructionsLoaded records accumulate -->
- [x] Drill-coverage scan: enumerate `fix(release):` commits in history and
      map each to a `release_drill.ts` scenario (covered / uncovered); the
      report is the FP-measurement input for the ratchet decision in the
      blockers. <!-- verify: report lists every fix(release): commit with a scenario verdict -->

Exit criteria: three evidence artefacts exist, each either carrying real
numbers or an honest instrument-ready marker.
Rollback: delete the artefacts (no runtime surface).

## Phase 4 — CLI and tooling (small, extend-not-create)

- [x] Orchestration explain trace: extend the existing `explain` /
      `route:explain` verbs and `explain_run.ts` §4 so a dispatch decision
      surfaces the judgment-ladder rung taken, the rungs rejected with
      reasons (why-not-team / why-not-council / why-no-spawn), and the
      token/cost estimate from orchestration-telemetry where a record exists.
      New verb only if the existing ones cannot carry it — then remember the
      dispatcher-verb registry surface. <!-- verify: vitest fixtures for all three branches — successful dispatch, all-rungs-rejected, missing telemetry record — invoked THROUGH the CLI dispatcher, not the function directly (council) -->
- [x] Unified conformance funnel report: one report join over the existing
      sources — `conformance_scan` JSONL (delivered payload, compaction, pins),
      `report_skill_activation` (activation), `report_skill_obligation_violations`
      (compliance), `report_carrier_divergence` (delivery) — delivery →
      activation → compliance in one view. Report only; explicitly NOT a CI
      gate (measured-FP-first lock) — the script carries a header comment
      stating it must never be wired into a workflow without a measured FP
      rate (council: prevent accidental gate creation). <!-- verify: verb runs and emits the joined view on current data -->
- [x] User-visible standing-delivery savings: surface
      `check_standing_rule_delivery`'s measurement (received rule tokens vs
      unscoped both-layers baseline) as a human-readable report line in the
      existing doctor/status surface, so a consumer sees the scoped-delivery
      win on first run. <!-- verify: command output shows received-vs-baseline tokens -->
- [x] Self-repair may-not-modify deny-list: codify the surfaces self-repair
      may never target with a patch (kernel rules, trust/safety floors,
      settings class C, CI enforcement, its own policy) — detection stays,
      egress for those surfaces degrades to report-only; wire via the existing
      `egressBlockedReason` hook. Pure tightening, proposal-only egress
      unchanged. <!-- verify: unit test asserting egressBlockedReason for a kernel-rule target -->

Exit criteria: all four capabilities pass their targeted tests; no new flat
top-level CLI verb without namespace.
Rollback: each item is an isolated commit; revert individually.

## Phase 5 — Governance records

- [x] ADR (proposed): the host-native-first ladder — native host feature →
      adapter → own runtime only as fallback — as the codified extension of
      ADR-124's "orchestrator first, owner where it wins", citing the shipped
      instances (native `paths`, capability registry, availability-based teams).
      Status `proposed`; acceptance is the maintainer's. <!-- verify: ADR file + index regen — done 2026-08-10: ADR-221-host-native-first-ladder.md, index regenerated (161 numbered — the 160 in the first regen run predated ADR-221 landing in the index; re-verified 2026-08-10 with `ls docs/decisions/ADR-*.md | wc -l` = 161, and `check_adr_frontmatter` green after the review_trigger field was added) -->
- [x] Consent provenance: document the sidecar's grant-timestamp field in
      `docs/contracts/settings-classes.md` (the review asked for `granted_at`;
      the field already exists as `at` — see the note, no such key was added,
      and expires/revoked stay unbuilt until a reader needs them). <!-- verify: targeted test on the sidecar write — resolved 2026-08-10: the sidecar ALREADY writes `{source, at}` per key (cmd_settings_set.ts:381), so the grant timestamp existed under a different name; the gap was documentation only — record shape now documented in settings-classes.md § provenance sidecar. NO code change, and no `granted_at` identifier exists in the tree; grepping for that name finds nothing by design. -->
- [x] Launch-draft refresh: locate the existing unposted announcement drafts;
      fold the round-5 advisory-vs-blocking numbers into them so the strongest
      measured story is in the draft — each number cites its evidence artefact
      and measurement date so draft and source cannot version-drift (council).
      Posting is NOT part of this roadmap (blocker b-launch). <!-- verify: draft contains the round-5 numbers with evidence pointer -->

Exit criteria: ADR indexed; sidecar test green; draft updated.
Rollback: revert commits; ADR stays `proposed` until human acceptance.

## Prevented work (verified — do not rebuild)

- **Shipped already:** orchestration outcome ledger (`orchestration-telemetry`
  schema + `orchestration-record` hook) · CHECKPOINT capsule schema +
  `validateCapsule` (free-form fields violate transcript-exclusion) · judgment-
  ladder Tier 0 / rung ∅ (`auto-dispatch-classification`) · self-repair floors
  (`block-kernel-rule-writes`, Hard-Floor egress, class-C refusal) · host-
  capability observed-only registry + probe · `settings:get` value/source/class ·
  git authorization tiering (`block_unauthorized_git`) · premortem optional +
  retro-validation PASSED 3/4 · session leases/TTL/release (advisory by
  design) · release drill + CI scenarios · rich-band contradiction (ADR-217) ·
  necessity classifier + spend gate + cost budget for council · `.claude/rules/`
  symlink set complete (110 files incl. both named security rules).
- **Owned by existing roadmaps:** solution-minimalism bench run
  (`road-to-solution-minimalism`) · orchestration outcome claim + A/B
  (`road-to-orchestration-scope-decision`, always-on Phase-6 registered
  metrics — a literal gates-vs-ladder A/B would resurrect a deleted arm) ·
  bus-factor / second-maintainer drill (`road-to-maintainer-bus-factor`) ·
  capability graph fields (`road-to-capability-answerability`) · checkpoint
  verify + capsule/handoff unification (`later/road-to-worker-generation-
  recycling`, parked with resume conditions) · adherence one-shot
  (`archive/road-to-conformance-round6`, completed 2026-08-12) · skill/command surface
  reduction (`road-to-surface-consolidation` + `later/road-to-command-
  structure-followup`) · skill-selection baseline (`road-to-skill-description-
  measurement`, human live run).
- **Locked / never-true:** ADR-220 attestation implementation (recorded
  deferral, `review_trigger` unmet) · skill retirement engine (cancelled under
  ADR-216 capacity cap) · hard session-claim mutex (advisory register is the
  documented design) · mechanised rule-adherence CI gate (3/110
  mechanisability + measured-FP-first lock) · migration-YAML "runtime input"
  claim (ledger is lint-consumed only) · self-repair plan/apply split
  (`--dry-run` is the plan half) · per-gate runtime cost telemetry (transport
  dominates ~88%, no dynamic range) · full skill-utilization funnel (host
  truncates the catalogue; selection unobservable from transcripts).

## Blockers

### blocker: b-highlights-mechanism
- Status: open
- Owner: maintainer
- Blocks: nothing in this roadmap (Phase 2 curates the existing heads regardless)
- What to do: decide the standing mechanism for release-highlight curation —
  (a) keep advisory-by-design (documented in `check_release_highlights.ts`),
  (b) release-PR-scoped hard block on the placeholder marker (deterministic
  string match, FP-free, but reverses the recorded no-guaranteed-red
  rationale — needs an ADR), or (c) document suspension one-liner.
- Resolved when: an ADR or a one-line policy note records the choice.

### blocker: b-launch
- Status: open
- Owner: user
- Blocks: nothing (draft refresh happens in Phase 5)
- What to do: post the conformance-arc launch story (three reviews call it the
  strongest shareable material; the stated utilization window closes ~26.08).
  Posting is an irreversible external action — Hard Floor, never autonomous.
- Resolved when: the user posts or explicitly declines.

### blocker: b-council-posture
- Status: open
- Owner: maintainer
- Blocks: any council verdict-cache work
- What to do: decide the council investment posture. Review positions
  conflict: one demands a verdict cache (`hash(task,diff,config) → reuse` —
  reverses the session auto-prune policy, ADR-worthy), another demands a
  hardening stop ("no further council investment until an external signal").
- Resolved when: an ADR records cache-vs-stop (or neither).

### blocker: b-runtime-consolidation
- Status: open
- Owner: maintainer
- Blocks: any typed-event-bus / central-runtime work
- What to do: decide whether the hook/concern layer grows into a unified
  runtime with a typed event model. Structural, highest-sensitivity path
  (hooks), never autonomous; the concern registry is the shipped primitive.
- Resolved when: an ADR accepts or rejects the direction.

### blocker: b-rule-reduction
- Status: open
- Owner: maintainer
- Blocks: any rule-merge pass
- What to do: authorize (or decline) a same-obligation rule-merge pass. Kernel
  slow-rollout applies (own PR, 24 h soak per rule); a numeric quota (10–20%)
  is rejected as framing — ADR-216 adjacency; the dispositions ledger is the
  input.
- Resolved when: maintainer authorizes a scoped merge list or declines.

### blocker: b-budget-rebase
- Status: open
- Owner: maintainer
- Blocks: flipping `check_always_budget` from source-chars to loaded tokens
- What to do: after Phase 3's loaded-token distribution report exists, decide
  whether the budget gate re-anchors on delivered tokens (p50/p95 per host).
  Token-baseline re-anchor discipline + measured-FP-first apply.
- Resolved when: decision recorded; only then a gate change is planned.

### blocker: b-drill-ratchet
- Status: open
- Owner: maintainer
- Blocks: coupling `fix(release):` commits to drill scenarios as a gate
- What to do: read Phase 3's drill-coverage report; if uncovered classes are
  real and the scan is FP-free over history, decide whether the coupling
  ships as a gate or stays a release-checklist line.
- Resolved when: decision recorded against the report.

### blocker: b-forensics-expansion
- Status: open
- Owner: maintainer
- Blocks: building the five proposed analyzers (CI failure, test flake,
  dependency drift, perf regression, decision trace)
- What to do: two reviews want the forensics pack expanded as the second
  end-user cluster; a third forbids new surface without utilization evidence
  (positions in the consumed source files, `agents/tmp.old/feedback-9.29.0-1.txt`).
  Capacity call — read-only + default-off would be held either way. "Expand"
  means a FUTURE pack-extension roadmap, never items appended here (council).
- Resolved when: maintainer picks expand / hold.

### blocker: b-machine-dedup
- Status: open
- Owner: user
- Blocks: the absence-experiment run (identical topology precondition)
- What to do: run the `--layer` dedup + `task generate-tools` on the
  maintainer machine (auditor: 176k → ~75k standing rule tokens). Machine-
  local, not repo work.
- Resolved when: `check_standing_rule_delivery` is green on that machine.

### blocker: b-absence-run
- Status: open
- Owner: user
- Blocks: closing the unproven half of the 34.8% savings claim
- What to do: after Phase 3's pre-registration lands and b-machine-dedup is
  done, run the two-session experiment (one session inside the corridor, one
  outside; diff the InstructionsLoaded records) and fill the outcome table.
- Resolved when: the pre-registration's outcome table carries A/B/B′/C.

### blocker: b-live-trigger-eval
- Status: open
- Owner: user
- Blocks: the skill-description de-collide evaluation (existing roadmap)
- What to do: the one human baseline run `road-to-skill-description-measurement`
  needs (hard-aborts under automation by design).
- Resolved when: the run's three pre-registered criteria have values.

### blocker: b-quorum-n2
- Status: open
- Owner: maintainer (telemetry-gated)
- Blocks: nothing
- What to do: watch council attendance telemetry for how often n=2 passes
  conclude with a single parsed stance; if frequent, evaluate a third CLI
  member (gemini is in the `cli_hints` set) as the cheaper fix vs tightening
  the quorum rule (2-of-2 deadlocks on every timeout — recorded rationale).
- Resolved when: attendance data exists and the evaluation is recorded.

## Risk Register

| # | Risk | Sev | Mitigation | Anchor |
|---|---|---|---|---|
| 1 | `enforced_by` ratchet breaks frontmatter validation for the 84 undeclared rules | high | ratchet form: only new/edited rules must declare; baseline committed; fixtures cover both paths | Phase 1.4 |
| 2 | Gate adoption gamed with boilerplate exemptions (recorded gaming risk in the gate header) | med | prefer real `gate_ledger` adoption; every exemption reason names the concrete why; reviewer-visible in diff | Phase 1.1 |
| 3 | Changelog curation misdescribes a behaviour change | med | derive each head line from reading the named commits, not from the review file; per-commit verification | Phase 2.1 |
| 4 | New/extended CLI verbs miss the dispatcher registry (recorded trap) | med | registry entry + targeted test per verb; extend existing verbs first | Phase 4 |
| 5 | Kernel-prefix byte-stability gate trips if any kernel rule is touched | med | Phase 1.4 changes schema + lint only; no kernel rule file is edited | Phase 1.4 |
| 6 | Loaded-token report fabricates numbers when no JSONL exists locally | med | honest "instrument ready, data pending" branch is a stated exit criterion | Phase 3.2 |
| 7 | Funnel report drifts into a gate | low | "report only, never CI" stated in the step; measured-FP-first lock cited | Phase 4.2 |
| 8 | Absence pre-registration written AFTER a session run destroys the registered-before-looking property | low | own commit ordered before any run; run itself is blocker-gated | Phase 3.1 |

## Acceptance criteria

- Blockers are decision surfaces, never completion requirements: the roadmap
  is implementation-complete when every checkbox is closed and the criteria
  below hold, regardless of open blockers (council clarification).
- `check_gate_completeness` exits 0 and skill lint reports 0 warnings.
- Zero `_auto-derived, rewrite before merge:_` markers in the 9.27–9.29
  changelog entries; proof page carries the round-5 numbers.
- The three Phase-3 evidence artefacts exist (real numbers or honest pending
  marker); the pre-registration commit precedes any experiment run.
- The four Phase-4 capabilities pass targeted tests; no new un-namespaced
  top-level CLI verb.
- Anti-dump: every executed item names the existing artefact it extended; no
  item on the Prevented-work list was rebuilt.
