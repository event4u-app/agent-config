---
status: ready
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to feedback 8.11 — prove, simplify, operate

> Disposition roadmap for the external 8.11.0 reviews (multiple independent
> reviewers, collected 2026-07-12) plus four maintainer notes. The reviews
> converge on one thesis: the package's main risk is no longer missing
> capability but **over-complexity**; the next phase must be "prove, simplify,
> operate" — fewer visible surfaces, more real-world measurement, portfolio
> cleanup, and hard knowledge boundaries. Every point below was either
> (a) verified live against the working tree before adoption, or
> (b) adjudicated by an AI-council debate.
>
> **Council convergence (claude-sonnet-4-5 + gpt-4o, 2026-07-12, 2 rounds,
> actual $0.12):** unanimous ADOPT on release-hygiene fixes; unanimous REJECT
> on team-mode frontmatter (role semantics belong in the `ai_team` config
> block + prompt library, not smeared across 271 skill files); REJECT on the
> ≥2-of-5 council admission gate with ADOPT of a council-vs-solo baseline
> benchmark as precondition for any further deliberation-protocol phases;
> AMEND-convergence on capability lifecycle (measure first — enable telemetry
> in this repo only, no new state machine before one real observation window),
> complexity budget (lightweight report + soft ratchet, no per-feature
> declaration duty), and skills-rules coupling (fold migration into
> `road-to-request-scoped-rule-load`; no `routed_from_rules` skill
> frontmatter); split on roadmap shape resolved as: ONE tightly-scoped
> disposition roadmap covering ONLY unowned gaps, with routing steps into the
> six existing owner roadmaps for everything already owned.

## Goal

Close the 8.11 feedback: (1) fix the five confirmed release-hygiene defects,
(2) give the knowledge layer machine-checkable sensitivity boundaries so
cross-project context transfer is structurally contained (maintainer note a),
(3) record the council's team-mode integration verdict and unblock the
team-mode roadmap (maintainer note d), (4) put measurement before further
council/governance expansion, (5) start the capability-utilization data
window, (6) ship the lightweight complexity report, and (7) run the
skills-rules coupling inventory so the P4 pattern can be applied to all
qualifying rules (maintainer note c) — all without duplicating the six
existing owner roadmaps and without adding any new daemon, state DB, or
auto-build runtime.

## Prerequisites

- [x] Read `AGENTS.md`, `docs/contracts/ai-council-config.md`,
      `docs/decisions/ADR-119-global-knowledge-default-on.md`
- [x] Confirm `agents/tmp/feedback-8.11.txt` is still present locally (source
      material; gitignored, summarized inline here — do not link it from
      stable artifacts)
- [x] Confirm the five Phase-0 defects still reproduce at execution time
      (re-verified 2026-07-12 at run start: 268 vs 271 counts, thin-flipped
      claim present, placeholder commits present)

## Context — feedback themes and where they are owned

The external reviews name many workstreams. Verified against the 30 active
roadmaps, these are **already owned elsewhere** — this roadmap routes to them
and must not duplicate their steps:

| Theme | Owner roadmap |
|---|---|
| Team-mode build-out (`/team`, Review Gate, benchmark) | `road-to-team-mode.md` |
| Council deliberation protocol phases | `road-to-opt-council-deliberation.md` |
| Loaded-vs-fired utilization report (U1) | `road-to-ecosystem-harvest-reliability-measurement.md` |
| Command/rule surface reduction | `road-to-request-scoped-rule-load.md`, `road-to-tier-removal.md` |
| Bus factor / maintainer operating manual | `road-to-maintainer-bus-factor.md` |
| Subagent ROI / agents-subagents cooperation (maintainer note b) | `road-to-subagent-value-realization-followup.md`, `road-to-orchestration-scope-decision.md` |
| External knowledge connectors (Jira/Linear/Confluence/Drive/Slack) | `stubs/road-to-internal-connectors.md` + `later/road-to-mcp-full-power.md` — stays gated behind `domain-adoption-policy` (org customer + per-connector scope review); the reviews rank it P1 but the demand-signal gate is not met |

**Genuinely unowned** (this roadmap's scope): release-hygiene defects,
knowledge sensitivity classification + cross-project isolation, team-mode
integration *disposition* (not the build), council admission measurement,
utilization data-window enablement, complexity report, skills-rules coupling
inventory, explainability v0.

Maintainer notes mapping: (a) cross-project context transfer → Phase 1;
(b) agents-subagents cooperation → owned roadmaps above (routing only);
(c) skills-rules coupling for all rules → Phase 6; (d) team mode stronger +
frontmatter question → Phase 2 (council verdict recorded).

## Phase 0 — Release-hygiene fixes (hours, not weeks)

All five defects verified live on `main` 2026-07-12. Council: unanimous
ADOPT. These are trust defects in an evidence-first package — the counts
contradict a "drift-checked in CI" header, and proof.md presents a
failed-gate experiment as a shipped result.

- [x] **Count drift.** `CAPABILITIES.yaml` says 268 skills / 177 commands
      while `README.md` badges, `docs/proof.md`, and `docs/catalog.md` say
      271 / 178; catalog says 103 rules vs 104 elsewhere. Root-cause why the
      generator (`src/scripts/generate_capabilities_index.ts`) trails the
      other surfaces despite the CI drift check; regenerate; then extend the
      drift check so ONE count source feeds all four surfaces
      (CAPABILITIES = README badges = proof = catalog) and CI fails on any
      pairwise mismatch. Verify: a deliberate off-by-one in a fixture fails
      the check.
      <!-- done 2026-07-12: regenerated to 271/178; extended
           check_artefact_count_messaging.ts with STRUCTURED_SURFACES
           (CAPABILITIES.yaml skills_total/commands_total) feeding the same
           canonical counts + cross-surface inconsistency net; 13 tests green
           incl. off-by-one red-path. Finding: catalog.md "103 rules" is BY
           DESIGN (INTERNAL_RULES excluded from the public catalog; its own
           --check is green) — that half of the review claim was a false
           positive. -->

- [x] <!-- done 2026-07-12: reworded in docs/CLAIMS.md (source; proof.md is
      generated) — "MEASURED-BUT-NOT-SHIPPED … FAILED the quality gate (36.2%
      vs 48%) and does not ship"; build_proof regenerated; check_claims green
      (18 backed / 2 debt unchanged). --> **Thin-projection claim.** `docs/proof.md` (retrieval-economy row,
      "~65.6% … thin-flipped") derives 100% of its reduction from the
      thin-rule-load flip that `CHANGELOG.md` records as "FAILS (does not
      ship)" and the token-program verdict keeps deferred. Reword to the
      honest form: "the measured thin projection reduced eager rule load
      78,513 → 13,881 GPT-tokens (~65.6% of the full always-loaded baseline)
      but failed the quality gate (36.2% vs required 48%) and does not ship;
      it un-defers only behind `discipline_profile: essential`." Keep the
      claim marker machine-resolvable; update `docs/CLAIMS.md` if the claim
      id changes.
- [x] <!-- done 2026-07-12: repo-local user.name/email fixed (was t/t@t.t —
      the root cause), .mailmap added (git log resolves 20/20 to matze4u),
      doctor check `git-identity` added incl. worktree-gitdir resolution;
      70 doctor tests green (4 new). -->
      **Git identity.** 72 of the last 100 commits on `main` are authored as
      placeholder `t <t@t.t>`; no `.mailmap` exists. Fix repo-local
      `user.name`/`user.email`, add `.mailmap` mapping the placeholder to the
      maintainer identity (history is NOT rewritten), and add a doctor or
      pre-push warning when the configured identity is a known placeholder.
      Verify: `git shortlog -sne --all | head` resolves through the mailmap.
- [x] <!-- done 2026-07-12: new `hook-lifecycle` leg in consumer_matrix.ts —
      reads managed hooks from the fixture's isolated HOME (MANAGED_SIGNATURE
      import, can't drift), walks the installed binary's compiled ESM import
      graph (checkDistManifestCompleteness — catches the rule_scope.js class
      deterministically), fires each hook via bash -c with representative
      SessionStart/PreToolUse/PostToolUse/Stop envelopes on stdin, asserts
      exit 0. Root cause traced: hooks:doctor is read-only and conformance
      bypasses the real binary via tsx. 13 tests green; rides the existing
      workflow invocation (no CI edit needed). -->
      **Consumer-matrix hook lifecycle.** The matrix
      (`src/scripts/consumer_matrix.ts`) runs install + `hooks:doctor` +
      static conformance only — no leg fires real `SessionStart` /
      `PreToolUse` / `PostToolUse` / `Stop` events, which is how a stop-hook
      crash (missing `dist/install/rule_scope.js`) shipped past it. Add a
      live hook-lifecycle leg: in the fixture consumer, invoke each installed
      hook entrypoint with a representative JSON envelope and assert exit 0 +
      expected side effect. Add a dist-manifest completeness check (every
      runtime-required `dist/install/*.js` present after build) so the
      missing-file class fails deterministically.
- [x] <!-- done 2026-07-12: README title + site tagline now say "zero
      runtime daemon" (matches the claim:no-runtime-daemon marker and the
      body's precise "no background daemon" wording); dated snapshot docs
      (positioning-evidence) deliberately untouched. -->
      **"Zero runtime" wording.** README title claims unqualified "zero
      runtime" while the body correctly narrows to "zero runtime **daemon**"
      and the package ships runtime hooks + a dispatcher. Align the title/
      tagline to the precise form ("no background runtime service or daemon;
      host-triggered hooks remain local and ephemeral") so the strongest
      public claim is the defensible one. Keep `claim:no-runtime-daemon`
      marker intact.

## Phase 1 — Knowledge boundary enforcement (maintainer note a)

Council split (one member: measure first, 2-level enum max; other: full
6-class taxonomy) — resolved to the middle: a SMALL machine-checkable
sensitivity axis layered on the existing gates, because the maintainer names
cross-project transfer as a real present danger (not speculative), while the
6-class enum over-fits a single-maintainer install. ADR-119's default-ON
stays (its 60-90-day measurement window + demotion trigger continue to run).

Current gates (verified): write-time regex redaction (secret/email/path/
hostname/money/customer/SQL/code/hidden-unicode), origin tier
`public|vendor|proprietary`, `allowed_tiers: [public]`, share-blocklist,
binary page `visibility: private`. Missing: any *sensitivity* class (tier is
origin, not sensitivity), per-card owner/expiry, promotion reason, revocation
trail.

- [x] <!-- done 2026-07-12: agents/settings/contexts/knowledge-sensitivity.md
      — three machine-anchored classes, derivation rule (redaction hit forces
      prohibited; never auto-shareable), tier-vs-sensitivity split,
      revisit-if for team/organization. -->
      **Design note first** (`agents/settings/contexts/knowledge-sensitivity.md`):
      sensitivity enum kept to THREE machine-anchored classes —
      `prohibited` (contains redaction-class content; never leaves the repo;
      machine check = existing redaction scan), `project` (DEFAULT; stays
      project-local; promotion refused unless explicitly reclassified by a
      human), `shareable` (eligible for the global store; must pass redaction
      AND carry full provenance). Explicitly record why team/organization
      classes are deferred (phantom for a single-maintainer install; the
      enum widens only when a real multi-tenant consumer exists —
      revisit-if condition, per council).
- [x] <!-- done 2026-07-12: sensitivity in card template frontmatter;
      check_knowledge_cards G4 (present+valid) / G5 (source_repo, owner,
      review_after, promotion_reason in provenance footer) / G6 (prohibited
      in global store = hard error); +7 fixture tests. -->
      **Schema + linter.** Extend the knowledge-card frontmatter and
      `src/scripts/check_knowledge_cards.ts`: G4 = `sensitivity` present and
      valid on every card in the global store; G5 = shared cards carry
      `source_repo`, `owner`, `review_after`, `promotion_reason`; G6 =
      `sensitivity: prohibited` in the global store is a hard error. Fixture
      tests for all three.
- [x] <!-- done 2026-07-12: resolve_effective_sensitivity() +
      gate_sensitivity_for_promotion() — refuses non-shareable, requires
      human promotion_reason; CLI promote gained --sensitivity/--reason/
      --owner/--review-after; gate order: blocklist → tier → redaction →
      sensitivity → write; +11 tests. -->
      **Promotion gate.** `knowledge_global_promote.ts` refuses any card with
      `sensitivity != shareable`; the auto-promote *suggestion*
      (`auto_promote_threshold`) must surface the classification step —
      promotion without a human-entered `promotion_reason` is blocked.
- [x] <!-- done 2026-07-12: append-only .revocations.jsonl tombstones
      (revoked_at, card_id, reason) written BEFORE delete; purge spares the
      ledger; list --revoked renders the trail; +14 CLI tests. -->
      **Revocation trail.** `knowledge:global:forget` / `purge` write an
      append-only tombstone line (`revoked_at`, `card_id`, `reason`) to a
      ledger file in the global store before deleting; `knowledge:global:list`
      can render the trail. No silent deletes.
- [x] <!-- done 2026-07-12: +3 adversarial cases (attack class 4):
      project-marked project-identifying card never promotes; shareable card
      acquiring redaction-class content blocks at the write gate. All 118
      knowledge tests green across 6 files; typecheck clean. -->
      **Cross-project contamination fixtures.** Extend the ADR-119
      adversarial suite: a card carrying project-identifying content marked
      `project` must never promote; a `shareable` card that acquires
      redaction-class content on update must demote/block at the write gate.
- [x] <!-- done 2026-07-12: ADR-121-knowledge-sensitivity-classes.md
      (accepted; default stays ON; alternatives incl. 6-class enum rejected
      with revisit-if); INDEX regenerated (122 numbered). -->
      **ADR.** Record the sensitivity axis as a successor note to ADR-119
      (default stays ON; classes + machine checks; revisit-if for the wider
      enum), via `adr-create`.

## Phase 2 — Team-mode integration disposition (maintainer note d)

Council: unanimous REJECT of `team_mode` frontmatter on skills/commands now —
road-to-team-mode has 37 open steps and 2 registered blockers; adding schema
fields for a feature whose role model does not operationally exist yet is
premature complexity. Role selection belongs in the `ai_team` config block +
prompt library, reusing subagent-orchestration's implementer/judge frame and
status envelope. Revisit-if: team-mode Phase 2 turns out to be blocked
specifically on artefact-level role metadata.

This roadmap does NOT duplicate the `/team` build (owner:
`road-to-team-mode.md`); it records the verdict and removes what blocks the
owner.

- [x] <!-- done 2026-07-12: verdict + revisit-if in road-to-team-mode
      § Notes; design constraint (roles in ai_team block + prompt library,
      reuse subagent-orchestration frame + status envelope, NO frontmatter
      key) written into its Phase 2 Step 4 text. -->
      Append the council verdict + revisit-if to `road-to-team-mode.md`
      § Notes, and write the design constraint into its Phase 2 step text:
      role semantics live in `ai_team` config + prompts, not in artefact
      frontmatter; the planned `docs/contracts/ai-team-config.md` carries the
      role model.
- [x] <!-- done 2026-07-12: RESOLVED — dated list appended to
      road-to-team-mode § Blockers from codex-cli 0.134.0's server-fetched
      models_cache (fetched today) + live exec header: gpt-5.5 (default),
      gpt-5.4, gpt-5.4-mini, codex-auto-review; gpt-5.6-sol confirmed NOT
      available; bogus ids 400-rejected. -->
      Resolve the `model-id-verification` blocker (owner: maintainer): list
      the actual codex CLI model IDs (`codex /model` or CLI docs) and append
      the dated list to `road-to-team-mode.md` § Blockers, unblocking its
      Phase 2 config examples and Phase 5 arm pinning.
- [x] <!-- done 2026-07-12: ask registered — recorded in road-to-team-mode
      § Notes and surfaced in this run's final report; the rendered estimate
      is due when its Phase 5 fixes the fixture count (authoring fixtures is
      unblocked, execution stays user-gated). -->
      Surface the `benchmark-spend-authorization` blocker to the user with a
      rendered estimate once the fixture count is fixed (owner: user; this
      roadmap only ensures it is asked, not answered).
- [x] <!-- done 2026-07-12: priority recorded in road-to-team-mode § Notes
      (the dashboard has no ordering mechanism; the owner-roadmap note is the
      durable record). -->
      Record the priority call in the roadmap dashboard ordering: team-mode
      Phases 1-2 are the next structural build after this roadmap's Phase 0/1
      — per the reviews, team mode is "strategically more valuable than more
      council features."

## Phase 3 — Council measurement before more council

Council: REJECT the proposed ≥2-of-5 admission gate (high reversibility cost
/ material spend / multi-perspective conflict / evidence tension / policy
change) as a second classification ontology layered on the existing necessity
classifier + impact router with zero evidence of gate failure; ADOPT a
council-vs-solo baseline benchmark as the precondition for ANY further
deliberation-protocol expansion. The five dimensions are armchair heuristics
until decision-level data says which characteristics correlate with council
value-add.

- [x] <!-- done 2026-07-12: shadow-log.jsonl ABSENT/EMPTY on both main
      checkout and worktree — zero analyzable lines. Recorded honestly in
      docs/design/council-vs-solo-baseline.md as the first finding and the
      reason the deliberate baseline is required. -->
      **Analyze the shadow log.** `agents/runtime/council/shadow-log.jsonl`
      already records solo-vs-full-council agreement for low-impact
      decisions with SLO thresholds (warn 0.05 / breach 0.08). Produce the
      first written analysis: disagreement rate, class distribution, any SLO
      signal. If the log is empty/thin, record that honestly as the reason
      the benchmark below is required.
- [x] <!-- done 2026-07-12: docs/design/council-vs-solo-baseline.md (arms,
      ≥30-decision corpus with ≥8/impact-class, blind two-judge κ≥0.60
      metrics, five dimensions recorded at prereg as post-hoc correlates,
      kill criteria) + CLAIMS.md § council-vs-solo-baseline (unbacked,
      PRE-REGISTERED 2026-07-12). -->
      **Pre-register the council-vs-solo baseline eval** (design doc +
      CLAIMS.md pre-registration): ≥30 real decisions routed through both
      arms (solo strong model vs full council) using the EXISTING gates;
      quality judged post-hoc (blind), cost = tokens + wall-clock. Kill
      criterion (falsifiable, from the debate): if council decisions show no
      identifiable quality lift on any decision subset, further
      deliberation-protocol phases stop and the protocol is maintenance-only;
      if a subset shows lift, derive empirical admission criteria FROM that
      subset's characteristics (instead of the a-priori ≥2-of-5).
- [x] <!-- done 2026-07-12: "Gate — baseline before further phases" section
      added to road-to-opt-council-deliberation.md. -->
      **Gate note in the owner roadmap.** Add to
      `road-to-opt-council-deliberation.md`: phases beyond the currently
      landed ones are gated on the baseline verdict.
- [x] <!-- done 2026-07-12: spend gate documented in the design doc, the
      CLAIMS entry, and this roadmap's Blockers; design/prereg authored
      (unblocked part complete) — execution stays with the user. -->
      **Execution** of the benchmark is spend-gated (see Blockers) — reuse
      the existing bench spend gate; authoring fixtures/design is unblocked.

## Phase 4 — Utilization data window (feedback P0.1/P0.2, council AMEND)

Council: no new 6-state lifecycle machine now; the existing frontmatter
lifecycle enum stays. The blocker for everything portfolio-shaped is that
engagement telemetry is default-off and has collected ZERO data — there is no
"loaded" denominator and no observation window. Measure first.

- [x] <!-- done 2026-07-12: enabled in the repo-root .agent-settings.yml
      (gitignored project override) with the council scope condition
      documented inline; window start = today. -->
      Enable `telemetry.artifact_engagement` in THIS repo's settings (id-only
      schema, PII-excluded by construction) and start the observation window.
      Per council: NOT in other org repos until Phase 1's boundary
      enforcement ships.
- [x] <!-- done 2026-07-12: U1a step added to
      road-to-ecosystem-harvest-reliability-measurement.md — optional
      `loaded` dict (consulted ⊆ loaded superset contract), sourced from the
      resolved router/discovery set, PII-exclusion shape preserved. -->
      Route the "loaded" denominator to its owner: amend
      `road-to-ecosystem-harvest-reliability-measurement.md` (U1) with the
      schema step — record what was *available/injected* per boundary so
      loaded-vs-consulted-vs-applied becomes computable. No duplication here.
- [x] <!-- done 2026-07-12: gate recorded in the U1a step text (owner
      roadmap) + here: parked until ≥1 full 60-90-day window AND first U1
      report landed. -->
      Record the lifecycle-automation gate: any
      experimental→measured→promoted style state machine is parked with
      revisit-if = "≥1 full engagement observation window (60-90 days) exists
      AND U1's first loaded-vs-fired report has landed."
- [x] <!-- done 2026-07-12: same gate, recorded in the U1a step text;
      subagent-ROI subset stays with
      road-to-subagent-value-realization-followup. -->
      Record the field-outcome-ledger gate (feedback P0.2 — task → loaded
      capabilities → cost → first-pass success → rework → outcome): parked
      with revisit-if = same data window + real usage volume; the
      subagent-ROI subset is already owned by
      `road-to-subagent-value-realization-followup.md`.

## Phase 5 — Complexity report, lightweight (feedback P0.3)

Council split (reject-entirely vs lightweight) — resolved to the lightweight
form WITH a kill criterion, honoring both: no per-feature complexity
declaration duty (rejected as meta-governance), but one cheap generated
report so "complexity grew unnoticed" stops being unfalsifiable.

- [x] <!-- done 2026-07-12: src/scripts/complexity_report.ts (25 fixture
      tests green; import-proxy fallback for graph edges, self-scan exclusion
      for the state-path metric); wired as `task complexity-report` in both
      CI task lists — report-only, always exit 0. Headline: 108 settings
      axes, 15 runtime-state surfaces, 78 dep edges, 30,563 always-loaded
      rule bytes, 2.52 avg gates/directive. -->
      One script (`complexity_report`) that counts, deterministically:
      active settings axes in the template, runtime-state files under
      `agents/runtime/state/`, cross-subsystem dependency edges (from the
      discovery graph), always-loaded rule bytes, and mandatory gates per
      core workflow. Output: a generated report (docs or internal/), CI runs
      it report-only (soft ratchet: prints deltas, never fails the build).
- [x] Kill criterion in the report header: if the report is cited by zero
      decisions (ADR/roadmap/PR) within 3 releases, delete the script and
      record the honest null.

## Phase 6 — Skills-rules coupling for all qualifying rules (maintainer note c)

Council AMEND convergence: the P4 pattern (thin Iron-Law stub in the rule,
body migrated to a skill/guideline, trigger-set routing) was applied to only
~15-20 of 104 rules. The systematic migration belongs to
`road-to-request-scoped-rule-load.md` (already cutting the consumer rule
surface 95→~32) — this roadmap contributes the inventory and the routing.
REJECTED: `routed_from_rules` skill frontmatter (backwards coupling; linkage
stays derivable from rule frontmatter alone).

- [x] <!-- done 2026-07-12: docs/guidelines/agent-infra/rule-body-migration-inventory.md
      — 32 already-thin / 16 should-migrate (with named targets; 7 need a new
      guideline, 9 extend existing) / 56 must-stay (9 kernel + 7 safety floors
      + 40 tight). Bonus finding: legal-safety-floor is the P4-inside-a-floor
      exemplar the other 6 floors lack. -->
      **Inventory all 104 rules** and classify each:
      `already-thin` / `should-migrate` (body > stub, has a natural skill or
      guideline home, no kernel membership) / `must-stay-monolithic` (kernel
      Iron-Law rules, safety floors, rules whose body IS the law). Deliverable:
      a classification table checked into the rule-governance guideline area,
      with per-rule target home for the should-migrate set.
- [x] <!-- done 2026-07-12: Phase 5 added to road-to-request-scoped-rule-load
      — Batch A (9 existing-target extensions), Batch B (7 new-guideline
      homes), Batch C (safety-floor template application, review-heavy,
      legal-safety-floor as exemplar), per-batch preservation-guard +
      trigger-eval gates, exit + rollback defined. -->
      **Author the migration sub-phase into
      `road-to-request-scoped-rule-load.md`**: batches of 5-10 rules, each
      batch preservation-guard-checked (`check_condensation` — Iron-Law
      headings/fences/negations byte-preserved in stubs), trigger-sets
      verified by the existing trigger-eval infrastructure so routing fires
      at least as well as the monolithic rule did.
- [x] <!-- done 2026-07-12: src/scripts/rule_backlinks.ts →
      internal/reports/rule-backlinks.md (70 targets, 77 backlinks; derived
      from routes_to + migration prose; 4 tests green; report-only). -->
      **Backlink visibility without schema cost:** a small generated report
      (derived from rule frontmatter `routes_to`/trigger-sets) listing, per
      skill, which rules route to it — so skill authors see inbound routes;
      no new frontmatter key.

## Phase 7 — Explainability v0 (feedback priority 1 in one review; lean)

Not council-adjudicated — flagged as maintainer-cuttable. The reviews' ask:
"why was this rule active, why this skill, why this subagent, what was
omitted due to budget?" Lean scope only: a generated report assembled from
artifacts that ALREADY exist (router resolution, engagement JSONL,
orchestration audit log, hooks state) — no new state, no daemon, no runtime
capture beyond what ships today.

- [x] <!-- done 2026-07-12: answerable = rule eligibility+triggers
      (dist/router.json), rules_applied at work-engine phase boundaries
      (audit JSONL), skill consulted/applied (engagement JSONL when opted in),
      dispatch+cost (audit orchestration), hygiene state. Parked (revisit-if
      Phase-4 data window ships): which exact trigger fired per turn,
      budget-omission record, memory-id influence on ad-hoc runs,
      host-capability persistence. -->
      Inventory which of the ask's questions are answerable TODAY from
      existing artifacts (router.json + discovery manifest → why rule/skill
      eligible; engagement record → consulted/applied; audit JSONL →
      dispatches + cost; context-hygiene state → loop/freshness) and which
      are structurally unanswerable without new capture (park those,
      revisit-if the Phase 4 data window ships).
- [x] <!-- done 2026-07-12: src/scripts/explain_run.ts — reuses
      orchestration_savings_report readers + telemetry/engagement parser;
      every section prints its source + honest "no data" lines; 17 fixture
      tests green; distinct from `agent-config explain last` (.work-state.json
      lens), noted in the report. -->
      `explain-run` v0: one script rendering, for a given task id/window:
      resolved profile → active rules (and which trigger matched) → skills
      consulted/applied → subagent dispatches with tiers + token deltas →
      hook events. Read-only over existing files.
- [x] Kill criterion: if unused after 3 releases (zero invocations recorded/
      cited), delete — same honest-null convention as Phase 5.
      <!-- done 2026-07-12: kill-criterion note in explain_run.ts header. -->

## Acceptance criteria (anti-dump)

- Every Phase-0 defect has a fresh verification command output attached at
  close (counts agree pairwise in CI; proof.md wording marks thin as
  not-shipped; `git shortlog` resolves via .mailmap; matrix hook-lifecycle
  leg red-tested against a deliberately broken hook; README claim marker
  still resolves).
- Phase 1 ships schema + linter + promotion gate + revocation ledger with
  fixture tests, and the ADR-119 successor note is linked from the knowledge
  contract docs. Global sharing default remains ON.
- The council verdicts (team-mode frontmatter REJECT + revisit-if; admission
  gate REJECT + baseline precondition) are recorded in the owner roadmaps,
  not just here.
- No step in this roadmap duplicates a step that exists in an owner roadmap —
  routing steps amend the owner instead.
- No new daemon, no state DB, no auto-build runtime, no new always-on
  subsystem; every new script is generated-report-shaped with a kill
  criterion where adoption is unproven.
- Roadmap dashboard regenerated; this file archives in the PR that completes
  it (PR-gate).

## Blockers

- **blocker: council-baseline-spend-authorization** — Status: open ·
  Owner: user · Blocks: Phase 3 benchmark execution (design +
  pre-registration are unblocked). What to do: approve the ≥30-decision
  two-arm run once the design doc renders its cost estimate (existing bench
  spend gate applies). Resolved when: the user confirms the run budget
  in-session.
- **blocker: model-id-verification** — registered in
  `road-to-team-mode.md` § Blockers (owner: maintainer); Phase 2 here
  resolves it there. Listed for visibility, not duplicated.

## Notes

- Source material: external 8.11.0 reviews + maintainer notes in
  `agents/tmp/feedback-8.11.txt` (local-only, gitignored); their verifiable
  claims were re-checked live on 2026-07-12 before adoption — all five
  hygiene defects reproduced; the review's "55/80 placeholder commits" was
  actually 72/100 at verification time.
- Council question and round files live under the auto-pruned runtime
  council layer; the convergence summary is inlined above (per
  no-roadmap-references).
- Feedback items deliberately NOT adopted: ≥2-of-5 admission gate (rejected,
  see Phase 3); 6-class sensitivity enum (reduced to 3, see Phase 1);
  per-feature complexity declarations (rejected, see Phase 5);
  `routed_from_rules` frontmatter (rejected, see Phase 6); external
  connectors build (stays gated by `domain-adoption-policy` — demand signal
  not met); new memory layer / multi-agent mode / web console / runtime
  daemon (the reviews themselves advise against; README boundary stays).
