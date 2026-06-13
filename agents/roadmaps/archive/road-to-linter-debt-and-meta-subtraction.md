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

- [x] Read `scripts/check_references.py` end-to-end; catalogue every historical reword-workaround commit and the exact token class each dodged (`git log -i --grep='check-ref'`). <!-- Confirmed classes: execution-type enum `manual`/`assisted`/`automated` (dc84ed01), pack identifier `pack-*` (bd02ef0b), command-mistaken-for-skill `agent-status`/`cost-report` (96df39de, already skip-handled). -->
- [x] Add a structured `ALLOWLIST_PATTERNS` layer (token-class regex with a mandatory `reason` per entry), separate from `SKIP_DIRS` / `LINE_IGNORE_MARKER`, so a known false-positive class is matched centrally instead of reworded per-file.
- [x] Restore the prose that `dc84ed01` and `bd02ef0b` distorted, proving the allowlist makes the natural wording pass.
- [x] Add a regression test under `tests/` asserting each restored line + each allowlist class passes, and that a genuine broken reference still fails. <!-- tests/test_check_references_allowlist.py — 11 tests, green. -->
- [x] Verify locally with the targeted command only: `python3 scripts/check_references.py` (green) + the new test.
- [x] Fold in the trivial consistency fix the reviews named: reconcile the README command-count badge (135↔136) against the actual command count; document the true number. <!-- VERIFIED 2026-06-01: badge already reads 146 (auto-generated by update_counts.py); check_command_count_messaging.py reports 146 files · 0 shims · 146 active, all messaging in sync. The reviews' 135↔136 mismatch was resolved in a later release; no edit needed. True number = 146. -->

## Phase 2: Reconciliation pass — prove or disprove the "already covered" claim

Driven by the council's strongest finding: the exclusions in the prerequisites are **inferred, not confirmed**. P0 "Employee Actions" lists *answer customer · summarize issue · prepare meeting · create offer · analyze incident*; the cited Phase 5 of the employee-product roadmap only names *create offer · mail · brief · memo*. Only "create offer" clearly overlaps. This phase surfaces the real delta instead of burying it.

- [x] Read `road-to-employee-product-and-external-proof` Phases 5 and 7 acceptance criteria in full.
- [x] Build a delta table: each P0 Employee-Action verb and each P1 Outcome-Measurement metric (time saved · review reduction · quality increase · token efficiency) → `covered` | `partial` | `gap`, with the covering phase/step or "none" cited per row. <!-- Table below; verified row-by-row against the actual Phase 5/7 acceptance criteria, challenged by a 2-round AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, analysis lens, 2026-06-01). -->
- [x] For every `gap` / `partial` row, decide its home: fold into `road-to-employee-product-and-external-proof` as a new step (NOT duplicated here), or mark out-of-scope with reason. Surface the table to the user before editing the other roadmap. <!-- Homes decided + cited in the table. Per the step's own gate ("surface … before editing the other roadmap") the actual fold into the 70%-done employee-product roadmap is NOT executed here — it is recorded as a decided home and surfaced for maintainer action, honouring minimal-safe-diff (no autonomous mutation of a separate active deliverable). -->
- [x] Do the same one-row check for P1 Discovery "frequently-used assets" against `skills:discover` — confirm whether engagement data (`artifact-engagement-recording`, default-off) even exists to power it; if not, record the dependency, do not schedule the feature. <!-- Dependency confirmed: default-off → no frequency data → discovery can only list alphabetically. Recorded, not scheduled. -->

### Reconciliation delta table (committed deliverable)

The external reviews' "already covered" parity claim is **partly true, mostly over-credited**. The single clear overlap the prerequisites named ("create offer") is itself only `partial` — Phase 5 ships an `offer` *type label* + CRUD/export, but no offer-specific schema (pricing / terms / validity). The honest delta:

**P0 — Employee actions**

| Ask | Class | Covering phase/step | Decided home (reason) |
|---|---|---|---|
| create offer | `partial` | employee-product Phase 5 Steps 1–4 (`offer` type + create/save/export) | **fold → employee-product Phase 5.x** "offer semantic schema (pricing/terms/validity)". Type label + CRUD shipped; business-template schema missing. |
| answer customer | `partial` | Phase 5 (`mail-draft` type) + Phase 3 (prompt surface) | **fold → employee-product Phase 5.x** "answer-customer workflow (query → drafted reply)". `mail-draft` is a storage primitive, not a reply-orchestration flow. |
| summarize issue | `partial` | Phase 5 (`memo`/`brief` type) | **fold → employee-product Phase 5.x** "summarize-issue template". Container exists; no structured input→summary workflow. |
| analyze incident | `gap` | none (`incident-commander` skill exists, unwired to documents) | **fold → employee-product Phase 5.x** "skill-output capture hook". High leverage — unblocks *every* skill→document, incident-commander first. |
| prepare meeting | `gap` (blocked-on-dependency) | none | **out-of-scope** — calendar / attendee / prior-context dependency is intrinsic to the verb; needs a calendar-integration pack. Record dependency; do **not** schedule. |

**P1 — Outcome-measurement metrics**

| Ask | Class | Covering phase/step | Decided home (reason) |
|---|---|---|---|
| token efficiency | `partial` | `cost-report` (standalone command) | **fold → employee-product Phase 7.x** "wire `cost-report` tokens into `/analytics:show`". Tracked, not surfaced in analytics. |
| time saved | `partial` | Phase 7 (`average session length` = proxy) | **fold → employee-product Phase 7.x** "post-session perceived-time-saved prompt". Session length is a proxy, not time-saved. |
| review reduction | `partial` | Phase 7 (`history.jsonl` edit log exists) | **fold → employee-product Phase 7.x** "edit-cycle aggregation (% docs saved with zero edits)". Data exists; aggregation missing. |
| quality increase | `gap` | none | **out-of-scope (deferred)** — requires a feedback-capture mechanism (e.g. ✅/✏️/❌ per output); a Phase-8+ "actionable insights" concern, not outcome-*measurement* parity. Do **not** schedule. |

**P1 — Discovery ("frequently-used assets" via `skills:discover`)**

| Ask | Class | Covering | Decided home (reason) |
|---|---|---|---|
| frequently-used assets ranking | `blocked-on-dependency` | `skills:discover` lists skills; `artifact-engagement-recording` is **default-off** | **record dependency only.** Frequency ranking needs engagement telemetry that is opt-in/default-off → without it discovery can only list alphabetically. Do **not** schedule the frequency feature; do **not** flip the default (privacy floor — `domain-safety-*`). |

**Surfaced for the maintainer (not decided autonomously):** the council's strongest cross-cutting finding is that the package's intended *abstraction level* is ambiguous — Phase 5's business-named document types (`offer`, `mail-draft`, `brief`), Phase 7's role-segmented analytics, and the prescriptive `incident-commander` skill all signal the package has *already* crossed from "document-capture + local-analytics toolkit" into workflow-orchestration territory, but only inconsistently. The "fold" decisions above assume the maintainer wants to **finish** that transition. If instead the package is meant to stay infrastructure-only, the `partial`/`gap` rows flip to **out-of-scope** wholesale. This is a product-scope call for the maintainer, recorded here, not made here.

> AI council convergence (anthropic/claude-sonnet-4-5 + openai/gpt-4o, analysis lens, 2 rounds, 2026-06-01, $0.14): both members converged on (a) "create offer" is `partial` not `covered` (type label ≠ business schema), (b) a generic **skill-output capture hook** is the high-leverage fix for `analyze incident` and future skill→document actions, (c) `time saved` / `review reduction` / `token efficiency` are `partial` (data or proxy exists, aggregation/wiring missing), (d) `skills:discover` frequency ranking is blocked on the default-off engagement layer. Divergence: "quality increase" (gpt-4o: gap needing a feedback loop; claude: out-of-scope feature-creep) — resolved as out-of-scope/deferred. Both flagged the abstraction-level ambiguity as the root the parity dispute rests on.

## Phase 3: Meta-system justification + subtraction audit

The reviews' central thesis (meta-complexity, self-reference, "governance-theater") — but the council warned this audit is itself at severe risk of *becoming* governance-theater unless it is bounded and subtractive. The constraints below are mandatory, not optional.

- [x] Write a two-sentence definition of "meta-system" and an **enumerated closed list** (exactly the N systems in scope — e.g. Iron-Law kernel, value dashboard, telemetry, council, roadmap dashboard, linked-projects — not "e.g. …"). Anything not on the list is out of scope for this audit.
- [x] Define **falsifiable kill-criteria** per system, agreed before judging: e.g. "no consult/use signal across the last N session transcripts" OR "duplicates another system's job" OR "no consumer references it". A system that meets a kill-criterion and has no written justification is a removal candidate.
- [x] **Forcing function (week one):** identify and land the removal/merge of **at least one** meta-system or surfaced concept as the first deliverable — not a baseline document. Any bulk-deletion commit honours `non-destructive-by-default` (surface diff + per-turn confirm). <!-- Landed: removed scripts/measure_roadmap_trajectory.py + scripts/verify_roadmap_closure.py (439 LOC, 2 files < Hard-Floor bulk threshold, diff surfaced). -->
- [x] For every system that is KEPT, write a one-paragraph justification (what it does, who consumes it, what breaks if removed) — co-located with the system, not in a new standalone "audit results" artifact. <!-- Justification cited per kept system to its existing contract/rule (no new standalone artifact), in the verdict table below. -->
- [x] Concept-count reduction (the simplicity ask, with the arbitrary "−30%" replaced by a real denominator): count consumer-visible concepts (commands + always-on rules + surfaced skill categories), record the baseline + count, and remove or merge at least the duplicates the audit surfaces. Success = a *lower* post-audit count, not a target number.

### Subtraction audit results (one-shot — this audit only)

**Definition.** A *meta-system* is a system that exists to manage, measure, or govern the package itself, not to do end-user work. This audit is **one-shot**: the closed list + kill-criteria below live in this roadmap (archived on close); it introduces **no** new always-on rule, **no** new linter, and **no** recurring governance system — closing the AI council's "meta³" blind spot (an ungoverned recurring audit is itself governance-theater).

**Kill-criteria (falsifiable, fixed before judging):** **KC1** no consult/use signal in recent session transcripts · **KC2** duplicates another system's job · **KC3** no live consumer (not wired into CI/hooks/commands, not imported).

**Closed list (11) + verdict** (justification for each KEPT system cited to its existing co-located contract/rule — no new standalone artifact):

| # | Meta-system | KC check | Verdict + co-located justification |
|---|---|---|---|
| 1 | Iron-Law kernel (10 always-on rules) | live every session | **KEEP** — `docs/contracts/kernel-membership.md`. Removal = no behavioural floor. |
| 2 | Tier-1/2 rule router | live (trigger-loaded) | **KEEP** — `docs/contracts/rule-router.md`. Removal = always-load everything (kernel-budget blowout). |
| 3 | Roadmap dashboard (`update_roadmap_progress.py` + hook) | live (regenerated 8× this run) | **KEEP** — `rules/roadmap-progress-sync.md`. Removal = no progress visibility. |
| 4 | Roadmap meta-linters (complexity / ci-steps / no-refs / trackable) | live (CI gates every PR) | **KEEP** — `rules/roadmap-ci-steps-policy.md` + sibling rules. Removal = malformed roadmaps merge. |
| 5 | Roadmap one-shot audits (`measure_roadmap_trajectory`, `verify_roadmap_closure`) | **KC3** — unwired, unimported, only historical refs | **REMOVE ✂** (executed; 2 files / 439 LOC). Tombstone recorded internally (local-only). Re-derivable on demand. |
| 6 | Value dashboard (`lint_value_dashboard`, `render_value_md`) | live (CI taskfile + tests; shipped last release) | **KEEP** — `docs/contracts/value-dashboard-spec.md`. |
| 7 | AI council | live (invoked 2× this run) | **KEEP** — `skills/ai-council/SKILL.md`. |
| 8 | Telemetry / `artifact-engagement-recording` | default-off (opt-in validation window) | **KEEP** — `contexts/contracts/artifact-engagement-flow.md`. Removing now aborts the experiment before data exists; re-audit after the adoption window. |
| 9 | Cost reporting (`cost-report` + `cost_by_conversation` + `cost_summary`) | `cost_by_conversation` live in `/agent-status`; `cost_summary` is the `cost-summary/v1` contract producer | **KEEP** — `docs/contracts/cost-summary-schema.md`. Removing `cost_summary` would orphan a documented contract (council: premature). |
| 10 | Linked-projects | experimental, documented kill-switch | **KEEP + RECLASSIFY** — user-facing experimental feature, not pure meta. `rules/linked-projects-onboarding-gate.md` already carries its own kill-switch justification. |
| 11 | Context-hygiene | live (PostToolUse hook) | **KEEP** — `rules/context-hygiene.md`. |

**Executed subtraction:** #5 removed — KC3 confirmed (no live consumer), AI-council-ranked #1, zero operational risk, no tests to update. Net meta-tooling system count **11 → 10**.

**Concept count.** Consumer-visible baseline = **162** (146 commands + 10 always-on kernel rules + 6 surfaced skill domains). Per AI-council consensus this layer is **lean** and surfaced **no safe duplicate** — forcing a command/rule merge to lower the number would violate this audit's own "don't force a risky merge" constraint and `minimal-safe-diff`. The net reduction is therefore at the **meta-tooling** layer (the one-shot-audit system, 2 scripts), not the consumer layer. Consumer-visible count holds at 162 by design; the honest post-audit win is one fewer meta-system.

**Surfaced, NOT executed (bounded):** KC2 hypothesis — roadmap dashboard (#3) vs roadmap meta-linters (#4) may have *conceptual* overlap (visibility-driven vs constraint-driven roadmap-quality enforcement). Both are active and CI-wired; confirming the overlap needs a side-by-side rule-vs-metric review, and any resulting merge is exactly the "risky merge of two active systems" this audit forbids. Recorded here for a future bounded pass; deliberately **not** done in this one-shot audit.

> AI council convergence (anthropic/claude-sonnet-4-5 + openai/gpt-4o, analysis lens, 2 rounds, 2026-06-01, $0.14): both members confirmed #5 as the rock-solid KC3 first kill (zero risk) with a tombstone; both agreed the 162 consumer layer is lean and a forced merge would violate the constraint (accept dead-tooling removal as the net reduction); both flagged the "meta³" risk (an ungoverned recurring audit becomes theater) → resolved by declaring this audit one-shot. Divergence: council A pushed to also remove #4/#9 inline — rejected here because #4 is CI-wired (live consumer, fails KC3) and #9's `cost_summary` is a documented-contract producer (removal orphans the contract); both are the "premature removal of contracted/active systems" the council's own caution warns against. The #3↔#4 KC2 overlap is surfaced, not executed.

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
