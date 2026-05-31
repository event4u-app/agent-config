---
status: ready
complexity: structural
---

# Roadmap: Linter-Debt Paydown + Meta-System Subtraction

> Distilled from two external 5.5.0 reviews (`agents/tmp/feedback16.txt`,
> `feedback17.txt`) and **deliberately narrowed after a neutral two-model
> council pass** (anthropic/claude-sonnet-4-5 + openai/gpt-4o, analysis lens,
> 2026-05-31). The council's strongest finding was that most of the reviews'
> P0/P1 asks are either already shipped in 5.5.0 or already scheduled in
> `road-to-employee-product-and-external-proof` — but that the "already
> covered" claim is **unproven** (feature-parity was asserted, not
> demonstrated). This roadmap therefore does three things and nothing more:
> (1) pays down the one CONFIRMED technical debt the reviews named —
> the `check_references.py` false-positive treadmill; (2) runs a
> **reconciliation pass** that proves-or-disproves the parity claim instead
> of silently dropping the asks; (3) runs a **subtractive** meta-system audit
> whose acceptance criterion is deletion, not a new governance document —
> because the reviews' deepest warning was meta-complexity / "governance-
> theater", and building more measurement or connectors would worsen exactly
> that. Enterprise knowledge connectors and the "−30% concepts" number are
> explicitly deferred (not rejected) with corrected, non-contradictory
> rationale.

## Prerequisites

- [x] Read both reviews (`agents/tmp/feedback16.txt`, `feedback17.txt`), delivered 2026-05-31.
- [x] Verified SHIPPED in 5.5.0 (so excluded from this roadmap): `packages/core/.agent-src.uncondensed/commands/knowledge/cross-repo.md` (= P0 Cross-Repo Knowledge), `.../commands/skills/discover.md` (= core of P1 Discovery), `.../commands/skill/preview.md`, `.../commands/video/from-song.md`, `BREAKING_CHANGES.md`, `scripts/lint_value_dashboard.py`.
- [x] Verified ALREADY-SCHEDULED in active roadmap `road-to-employee-product-and-external-proof` (Phases 0–9): Glama/MCP listing (P0), recruit sessions (P1), single-user knowledge ingestion (Phase 2), document workflows (Phase 5), non-technical explain (Phase 6), telemetry→analytics surface (Phase 7 = P1 Outcome Measurement).
- [x] Council caveat recorded — the parity between those shipped/planned items and the reviews' P0 list is **asserted, not proven**. Phase 2 exists to close that gap, not assume it.
- [x] Confirmed gating rules: `non-destructive-by-default` (no bulk deletion without per-turn confirm), `roadmap-progress-sync` (regen dashboard same response on any touch), `commit-policy` (no commit steps written here unsolicited), `domain-adoption-policy` (gates the enterprise-connector ask), `roadmap-ci-steps-policy` (no full-pipeline `task ci` steps — targeted checks only).

## Context

The reviews score the package 9.8/10 and award perfect marks across architecture, governance, and value measurement — framing that the council flagged as hyperbolic and partly self-contradicting (feedback17 lists items as open P0/P1 that it elsewhere states shipped in 5.5.0). The one finding with a file-level citation and an observable multi-release pattern is the `check-refs` linter treadmill. Everything else is either done, planned, or a vision-level ask that needs scoping before it earns a roadmap phase. The honest shape of the remaining work is **subtraction**, not a new build program.

## Phase 1: Kill the check-references false-positive treadmill

The reviews' only CONFIRMED, roadmap-ready finding (both council members, evidence: confirmed). Four+ releases carry commits that *reword prose* to dodge the linter (`dc84ed01` "reword execution-type mentions to dodge check-refs false positive", `bd02ef0b` "avoid check-refs false-positive on pack name") rather than using the existing `<!-- ref-ignore -->` / `<!-- check-refs: skip -->` markers. The gap is a **content-class allowlist** for known non-reference token shapes (execution-type enum mentions, pack names, bare `skill:`/`rule:` qualifiers in prose), distinct from per-line ignore markers.

- [ ] Read `scripts/check_references.py` end-to-end; catalogue every historical reword-workaround commit and the exact token class each dodged (`git log -i --grep='check-ref'`).
- [ ] Add a structured `ALLOWLIST_PATTERNS` layer (token-class regex with a mandatory `reason` per entry), separate from `SKIP_DIRS` / `LINE_IGNORE_MARKER`, so a known false-positive class is matched centrally instead of reworded per-file.
- [ ] Restore the prose that `dc84ed01` and `bd02ef0b` distorted, proving the allowlist makes the natural wording pass.
- [ ] Add a regression test under `tests/` asserting each restored line + each allowlist class passes, and that a genuine broken reference still fails.
- [ ] Verify locally with the targeted command only: `python3 scripts/check_references.py` (green) + the new test.
- [ ] Fold in the trivial consistency fix the reviews named: reconcile the README command-count badge (135↔136) against the actual command count; document the true number.

## Phase 2: Reconciliation pass — prove or disprove the "already covered" claim

Driven by the council's strongest finding: the exclusions in the prerequisites are **inferred, not confirmed**. P0 "Employee Actions" lists *answer customer · summarize issue · prepare meeting · create offer · analyze incident*; the cited Phase 5 of the employee-product roadmap only names *create offer · mail · brief · memo*. Only "create offer" clearly overlaps. This phase surfaces the real delta instead of burying it.

- [ ] Read `road-to-employee-product-and-external-proof` Phases 5 and 7 acceptance criteria in full.
- [ ] Build a delta table: each P0 Employee-Action verb and each P1 Outcome-Measurement metric (time saved · review reduction · quality increase · token efficiency) → `covered` | `partial` | `gap`, with the covering phase/step or "none" cited per row.
- [ ] For every `gap` / `partial` row, decide its home: fold into `road-to-employee-product-and-external-proof` as a new step (NOT duplicated here), or mark out-of-scope with reason. Surface the table to the user before editing the other roadmap.
- [ ] Do the same one-row check for P1 Discovery "frequently-used assets" against `skills:discover` — confirm whether engagement data (`artifact-engagement-recording`, default-off) even exists to power it; if not, record the dependency, do not schedule the feature.

## Phase 3: Meta-system justification + subtraction audit

The reviews' central thesis (meta-complexity, self-reference, "governance-theater") — but the council warned this audit is itself at severe risk of *becoming* governance-theater unless it is bounded and subtractive. The constraints below are mandatory, not optional.

- [ ] Write a two-sentence definition of "meta-system" and an **enumerated closed list** (exactly the N systems in scope — e.g. Iron-Law kernel, value dashboard, telemetry, council, roadmap dashboard, linked-projects — not "e.g. …"). Anything not on the list is out of scope for this audit.
- [ ] Define **falsifiable kill-criteria** per system, agreed before judging: e.g. "no consult/use signal across the last N session transcripts" OR "duplicates another system's job" OR "no consumer references it". A system that meets a kill-criterion and has no written justification is a removal candidate.
- [ ] **Forcing function (week one):** identify and land the removal/merge of **at least one** meta-system or surfaced concept as the first deliverable — not a baseline document. Any bulk-deletion commit honours `non-destructive-by-default` (surface diff + per-turn confirm).
- [ ] For every system that is KEPT, write a one-paragraph justification (what it does, who consumes it, what breaks if removed) — co-located with the system, not in a new standalone "audit results" artifact.
- [ ] Concept-count reduction (the simplicity ask, with the arbitrary "−30%" replaced by a real denominator): count consumer-visible concepts (commands + always-on rules + surfaced skill categories), record the baseline + count, and remove or merge at least the duplicates the audit surfaces. Success = a *lower* post-audit count, not a target number.

## Deferred — not rejected (with corrected rationale)

- **Enterprise knowledge connectors** (Jira / Confluence / CRM / Drive / SharePoint / enterprise retrieval). The council showed the "0 external users" rejection is internally contradictory (if true package-wide, it disqualifies every feature equally). Correct framing: gated by `domain-adoption-policy` — no named maintenance owner, no CI for these integrations, and single-user knowledge ingestion (`road-to-employee-product` Phase 2) must prove value first. Action: open a watch-note under `agents/settings/contexts/domain-watch/` capturing the missing signals; re-evaluate when Phase 2 ships and a demand signal exists. Do **not** schedule connector phases now.
- **"Reduce visible concepts by 30%"** as a number — direction accepted (folded into Phase 3), the undefended 30% rejected until tied to the Phase 3 denominator.

## Acceptance Criteria

- Phase 1: `python3 scripts/check_references.py` passes on the restored natural-wording prose; the allowlist layer exists with a `reason` per entry; a regression test guards both directions (false-positive class passes, real broken ref fails); README badge count matches reality.
- Phase 2: a committed delta table exists; every `gap`/`partial` row has a decided home; no P0/P1 ask is silently dropped without a cited reason.
- Phase 3: the closed meta-system list + kill-criteria are written; **at least one** system or concept is actually removed/merged (net reduction demonstrated); every kept system carries a co-located justification.
- No new always-on rule, no new permanent "governance" system, and no enterprise-connector code is introduced by this roadmap.

## Notes

- **Council convergence** (anthropic/claude-sonnet-4-5 + openai/gpt-4o, analysis lens, 2 rounds, 2026-05-31, ~$0.07): both members ranked the check-references fix as the single confirmed/roadmap-ready item; both flagged the "already covered" exclusions as unproven feature-parity (→ Phase 2); both demanded a closed definition + falsifiable exit criteria + a deletion forcing-function for the meta-audit or it becomes governance-theater (→ Phase 3 constraints); divergence only on the enterprise connectors (claude: the 0-user gate is contradictory; gpt-4o: keep excluded but cheap demand-survey first) — resolved by deferring with a watch-note rather than rejecting.
- **Excluded as already shipped/planned** (see Prerequisites): Cross-Repo Knowledge, Discovery core, skill:preview, video:from-song, BREAKING_CHANGES, Glama/MCP listing, recruit sessions, single-user knowledge, document workflows, telemetry→analytics. Phase 2 verifies these exclusions rather than trusting them.
