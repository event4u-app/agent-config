---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Reliability & Measurement

**Trigger:** Ecosystem survey (see [`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Sources cited source-anonymously (**K** = a loaded-vs-fired transcript pruner,
**W** = a cross-tool session-audit CLI, **M** = a PR-review worked-example,
**L** = a production-readiness scorer, **A** = a multi-harness marketplace,
**E** = a slash-command collection, **G** = a security-firm repo); full
provenance in the index § Provenance.

**Priority: P1.** The loaded-vs-fired utilization report is the one mechanism
that lets the suite **subtract** — it feeds the token-budget program directly by
naming always-loaded skills/rules that never fire. Golden-adversarial fixtures
make review output regression-testable.

## Goal

Give the suite **evidence about itself**: which of its ~271 skills / ~90 rules
actually fire, whether review skills catch known-bad inputs, and whether every
projected host can load the tree — measurement that turns "we think this is
useful" into "the transcripts say so".

## Reality check — already shipped (do NOT rebuild)

| Candidate | Verdict | Evidence |
|---|---|---|
| Per-turn engagement recording (consulted/applied ids) | Shipped | `artifact-engagement-recording` rule |
| A/B activation measurement | Shipped | `bench:ab`, `evals/triggers.json` |
| Orchestration telemetry (counts) | Shipped | `orchestration-telemetry` |
| Loop / context-decay detection | Shipped | `context-hygiene` rule |
| Judge cluster + council + verify-repair | Shipped | `judge-*`, `ai-council`, `verify-repair-loop` |

- [x] Reality check complete — the gaps are **cross-session utilization**, **golden fixtures**, and **real-host load proof**; the per-turn/A-B primitives already exist.

## Phase 1 — Adopt-now plate (≤ 5 units)

- [x] <!-- done 2026-07-13: src/scripts/utilization_report.ts — local-only/
      report-only (privacy header first line; NOT in task ci), consumes the
      pre-registered D1-D4 criteria, REAP/KEEP/REVIEW with MIN_SESSIONS=4
      session floor, kernel + safety floors REAP-exempt, REAP = reversible-
      quarantine candidate (manifest contract in header; move tooling ships
      with the first above-floor REAP — impossible before the 45-day floor).
      Opt-in consumer CI flags --fail-under-utilization/--fail-on-stale-days.
      Real-data run: UNDERPOWERED (window day 1 — the honest D4 path; the
      "names ≥1 zero-fire artifact" assertion is proven on synthetic
      above-floor fixtures in tests/scripts/utilization_report.test.ts and
      re-runs on real data at window close). -->
      **U1 — Loaded-vs-fired utilization report.** A transcript-driven analysis that computes, per skill/rule/command over a session window, `Fired / Loaded` and surfaces "loaded but never fired" dead weight (the "what you carry vs what you touch" ratio). Reuse the existing per-turn engagement data as the event source; output a ranked cut-candidate list. *Source K.* Verify: run on a real transcript set, assert the report names ≥1 zero-fire always-loaded artifact (or proves 100% utilization).
- [x] <!-- done 2026-07-13: optional loaded dict (kind→ids, superset contract
      consulted ⊆ loaded enforced in validate()) in engagement.ts + --loaded
      in telemetry_record + aggregator loaded counts/fired_ratio + renderer
      loaded column — emitted ONLY when the log carries the field, so pre-U1a
      logs stay byte-identical to the frozen parity oracle (8/8 golden parity
      + 3 new loaded-path tests green). Ids-only shape preserved. -->
      **U1a — "loaded" denominator in the engagement schema** (feedback-8.11 Phase 4 routing, 2026-07-12). The engagement record captures `consulted`/`applied` but nothing records what was AVAILABLE/INJECTED per boundary — so `Fired / Loaded` has no denominator today. Add an optional `loaded` dict (same kind→ids shape as `consulted`, superset contract `consulted ⊆ loaded`) to `templates/scripts/telemetry/engagement.ts` + aggregator + renderer, sourced from the resolved router/discovery set at boundary time; keep the PII-exclusion-by-construction shape (ids only). The observation window is RUNNING since 2026-07-12 (engagement telemetry enabled in the agent-config repo itself — feedback-8.11 Phase 4); data collected before this field lands is consulted/applied-only and stays usable for the applied-ratio half of the report. Gates recorded by the same disposition: lifecycle-state automation (experimental→measured→…) AND any generic field-outcome ledger stay parked until ≥1 full window (60–90 days) of this data exists AND the first U1 report has landed. Decision criteria for the window are PRE-REGISTERED (2026-07-12, feedback-8.11-2 Phase 0): floor + rules D1-D4 at `docs/design/utilization-window-criteria.md` / CLAIMS `utilization-window-decidability` — the U1 report consumes those rules, it does not redefine them.
  - **REAP / KEEP / REVIEW verdicts with a session floor.** Each candidate gets a verdict, but only above a minimum session count — **absence of evidence is not evidence of absence** (a skill unused across 3 sessions is not yet a cut). *Source K.*
  - **Reversible quarantine, not deletion.** A cut moves the artifact to a quarantine with a manifest (what/when/why + restore path), never a hard delete — feeds `road-to-tier-removal` safely. *Source K.*
  - **Cross-tool session-audit facet.** Beyond fire-rate: per-session cost / token / tool-failure / health signals across hosts (the raw material for the token-budget story), with an opt-in CI-gate flag contract (`--fail-under-utilization`, `--fail-on-stale-days`). *Source W.* Keep measurement CI-side/opt-in; add no always-loaded surface.
  - **Grounding — census-honesty prerequisite (Phase 0, no code).** `docs/SKILL_CENSUS.md` self-describes as description-heuristic-only ("no skill body was read"); this report is the evidence it lacks. Land a census-header limitation note + cross-link so any pre-evidence prune must cite a non-usage rationale, and hand the bottom-utilization decile to `road-to-tier-removal` as input. This is the mechanism the leanness/token-budget track has been missing.
  - **Privacy blocker (design constraint, not detail).** Session transcripts are personal data → the toolchain is **local-only, report-only by default, never wired into `task ci`**; the report header states this in the first line. Phased parsing: ship the largest-install-base host first; additional host parsers are one-per-follow-up, each gated on a real consumer request (do NOT pre-build many).
- [ ] **U2 — Golden-adversarial review fixtures.** A small fixture library of known-bad inputs with required verdicts (canonical: "golden SQL-injection PR → must produce a high/block finding"; a benign look-alike → must NOT). Wire into the `judge-*` / `code-review` eval harness as a regression gate. *Source M.* Verify: the fixtures run in CI and fail loudly if a review skill regresses to missing the planted bug.
- [x] <!-- done: split executed — road-to-ecosystem-harvest-prelaunch-diagnostics
      exists as its own plate; this cross-link is the kept navigation. -->
      **U3 — Evidence-gated launch go/no-go → split into its own plate.** The consumer-launch diagnostic (stable finding IDs, Unknown ≠ Pass epistemics, `diff --ci` regression gate, suppression-with-evidence, the score revisit-note) now lives in [`road-to-ecosystem-harvest-prelaunch-diagnostics`](road-to-ecosystem-harvest-prelaunch-diagnostics.md) — it targets the *consumer's* launch surface, a different audience from this roadmap's *suite-self* measurement. Kept here only as the cross-link so the leanness/evidence story stays navigable.
- [ ] **U4 — Real-host loadability smoke test.** A CI check that boots each projected host against the generated tree and asserts skills/rules actually load (complements the existing condensation-hash + linter gates, which prove *shape* not *loadability*). *Source G.* Verify: the check catches a deliberately-malformed projection.
- [ ] **U5 (rolling) — Agent-coordination-history facet.** Extend `orchestration-telemetry` to record *which subagent combinations* completed successfully (not just counts) so the orchestrator can prefer combos that worked. *Source E.* Verify: after a multi-agent run, the record names the combo + outcome.

## Dropped (council)

- **Monte-Carlo reliability testing of activation** — DROPPED. Redundant with U1
  (skills that should fire but don't already show as 0-fire in the utilization
  report), and theoretical for deterministic pattern-matching triggers.
  Revisit-if both a fixture library and a *measured* activation-flakiness signal
  exist. *Source A.*

## Council convergence (2026-07-11)

Council (claude-sonnet-4-5 + gpt-4o) put U1 + U2 in the top tier (U1 enables
subtraction; U2 makes review testable), converted the readiness *score* to
evidence-gated binary caps (U3), and **dropped Monte-Carlo** as redundant.

## Acceptance criteria

- [x] U1 report runs on real transcripts and produces a ranked cut-candidate list.
      <!-- 2026-07-13: runs on the real log; verdict table ranked by consulted↑/
      loaded↓; real data is window-day-1 → honest UNDERPOWERED, verdicts proven
      on synthetic above-floor fixtures. -->
- [ ] U2 golden fixtures gate the review eval harness and fail on regression.
- [ ] U3 lands as binary go/no-go (no 0–100 meter).
- [ ] No new always-loaded surface added (measurement is opt-in/CI-side).
- [ ] Dashboard regenerated.
