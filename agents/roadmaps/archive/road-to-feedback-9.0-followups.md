---
complexity: structural
---

# Roadmap: Feedback 9.0.0 Follow-ups

> **Source:** external review passes of Release 9.0.0 (`agents/tmp/feedback-9.0-1.txt`,
> 7 independent reviewers, verdicts 9.3–9.8/10 and 116–118/120). The reviews are
> overwhelmingly positive; this roadmap captures **only the concrete, verified,
> net-new defects** they surfaced. Every claim below was verified against live
> files by parallel subagents before this roadmap was written (file:line evidence
> inline).

## Goal

Close the small set of concrete documentation- and gate-hygiene defects the 9.0.0
review passes surfaced — **without** duplicating the seven strategic items already
tracked by open roadmaps, and **without** building deferred feature-bets that need
demand evidence, benchmark spend, or a human decision.

Scope is deliberately narrow: apply the package's own "prose norms rot without a
mechanism" and "a gate that is green-without-meaning is a defect" doctrines to the
package itself.

## Non-goals (already tracked or council-deferred — see § Disposition)

- Team-Mode 3-arm defect-finding benchmark → `road-to-team-mode.md`.
- Real external adoption / recruit sessions → `road-to-adoption-without-narrative-debt.md`.
- Bus-factor / second maintainer → `road-to-maintainer-bus-factor.md`.
- Request-specific dynamic rule loading → `road-to-request-scoped-rule-load.md`.
- Outcome telemetry / orchestration value → `road-to-subagent-value-realization-followup.md`.
- Utilization window: **let it run, do not rebuild** (pre-registered, decidable ~2026-08-26).
- Knowledge sensitivity layer → **already shipped** (ADR-121, 2026-07-12).
- Command-surface hiding → **already shipped** (ADR-092 `visibility:`).
- External connectors (GitHub+Linear/Jira), cost-per-quality metric, council
  domain-weighting, settings-axes derivation → feature-bets, council-deferred.

---

## Phase 1 — Breaking-surface documentation hygiene (F1 / F4)

Verified defects: `BREAKING_CHANGES.md` is stale four majors; the 9.0.0 breaking
migration prose is misfiled under a `### Breaking changes (6.0.0)` heading inside a
~940-line un-drained `## [Unreleased]` block; no lint keeps a breaking release in
sync with the index; both `MIGRATION.md` files omit the flip.

- [x] **1.1 Repair `BREAKING_CHANGES.md`.** Add the missing released rows for
      6.0.0, 7.0.0, 8.0.0, 9.0.0; convert the two `**Next major** *(unreleased)*`
      rows (`BREAKING_CHANGES.md:47-48` — `.agent-src/`→`dist/agent-src/`,
      `cost_profile`→`rule_loading_tier`) to their real shipped major (6.0.0, per
      `CHANGELOG.md:71,:89`). verify: table's highest row is 9.0.0; grep shows no
      `(unreleased)` label on a shipped change; **AND** every major row corresponds
      to a real shipped major — `git tag --list 'v[0-9]*.0.0'` (and CHANGELOG
      `## [N.0.0]` sections) match the table rows with no phantom or missing major
      (council finding 3A — guards against inventing a `7.5.0`-style phantom row).
- [x] **1.2 Surface the 9.0.0 breaking prose under its own version.** Read
      `tests/test_changelog_eras.py` and the full `## [Unreleased]` structure FIRST,
      then commit to a **single** strategy (the "and/or" was a converged blocker —
      the two options are mutually exclusive). **Default strategy (B): move** the
      9.0.0 scoped-projection migration prose currently under the mislabeled
      `### Breaking changes (6.0.0)` heading (`CHANGELOG.md:49-51`, dated 2026-07-13)
      into the released `## [9.0.0]` section (`CHANGELOG.md:1047-1051`) — a released
      change belongs under its released heading, not `[Unreleased]`. Fall back to
      strategy A (relabel in place) **only if** `test_changelog_eras.py` forbids B;
      if so, record why in the step's done-note. Do NOT do both; do NOT attempt a
      full 940-line drain. verify: `test_changelog_eras.py` green; `## [9.0.0]`
      reaches the scoped-flip migration; no shipped-release prose remains under a
      wrong-major heading inside `[Unreleased]`.
- [x] **1.3 Cross-reference the flip in MIGRATION.md** *(depends on 1.2 — council
      finding 3-critical: the link target is decided by 1.2's strategy)*. Add one
      section/line to root `MIGRATION.md` (and `docs/MIGRATION.md` if in scope)
      pointing at the scoped consumer-projection default flip
      (`projection.rule_workspaces`, 103→88 rules, rollback `rule_workspaces: []`).
      Link to a **stable anchor** — the `BREAKING_CHANGES.md` 9.0.0 row and/or the
      `## [9.0.0]` section — never a `[Unreleased]` heading (which moves when the
      block drains). verify: grep `scoped|rule_workspaces` finds the reference; the
      link target resolves to a stable heading.
- [x] **1.4 Add the missing sync lint.** Trigger (council finding — "release commit"
      was undefined): a diff that **adds a `### BREAKING` / `BREAKING CHANGE` entry
      under a released `## [N.0.0]` CHANGELOG heading** must also touch
      `BREAKING_CHANGES.md`. This fires on the release-cut diff, not every WIP commit
      (a `### BREAKING` under `[Unreleased]` does not trip it). Provide an explicit
      escape hatch (`breaking-index-override` token in the commit body, mirroring
      `check_structural_breaking.ts`'s `ci-override`). Extend
      `src/scripts/check_structural_breaking.ts` or add
      `lint_breaking_changes_index.ts`, wired into the CI pipeline, with a
      **must-fail fixture** (released-BREAKING-without-index diff) and a pass fixture
      (index touched, and override token). verify: lint red on the must-fail fixture,
      green on a compliant diff and on the override; wired into `task ci` / the
      release gate.

## Phase 2 — CI gate-status honesty

Verified defects: the skill-lint PR comment emits "✅ All changed files pass
cleanly" on **0 checked files** (`.github/workflows/skill-lint.yml:221-223`, no
INCONCLUSIVE state); the workflow reads a non-existent `summary.warn` key (linter
emits `pass_with_warnings` + `total`, `skill_linter.ts:3596-3599`) so warnings never
surface; the self-review gate's "N finding(s) WOULD block merge" counts only
`classifyBlocking` findings while the table lists all, so a "critical" row can sit
above a "2 WOULD block" line (`self_review_gate.ts:52-54,185-193`).

- [x] **2.1 skill-lint: 0-checked ≠ pass.** Guard the "pass cleanly" message on
      `total > 0`; emit an explicit **INCONCLUSIVE** message when 0 files were
      checked. verify: simulate a 0-changed-skill run → INCONCLUSIVE, not the green
      pass line.
- [x] **2.2 skill-lint: fix the warn-key mismatch.** Read `summary.pass_with_warnings`
      (and/or `summary.total`) instead of the absent `summary.warn` so the Warn
      column populates and a warnings-only PR does not render "pass cleanly".
      verify: a warnings-only JSON input → Warn column non-zero, no clean-pass line.
- [x] **2.3 self-review gate: consistent count vs table.** Make the "WOULD block
      merge" count and the findings table consistent — keep the narrow blocking
      definition (`classifyBlocking`, security/claim × critical/high) but render each
      row with an **explicit `(Blocking)` or `(Advisory)` label** (council finding 3B
      — "unambiguous" was itself ambiguous), so a critical-but-non-blocking finding
      cannot read as inconsistent with the count. verify: a `severity: critical,
      kind: correctness` finding renders `Critical (Advisory)` and the count line
      says it does not block; a `security × critical` finding renders
      `Critical (Blocking)` and is counted.

## Phase 3 — Companion fixes (council-greenlit, build-now)

The 2026-07-13 deep council greenlit all three as build-now and explicitly rejected
demanding design spikes for 3.1/3.2 (a "category error" — 3.1 is command
registration, not feature build; 3.2's deriver already exists). KV-prefix drift is
intentionally excluded — there is no KV substrate in `src/` (verified).

- [x] **3.1 Register a discoverable `/explain-run` command.** The engine already
      exists (`src/scripts/explain_run.ts`, read-only, kill-criterion documented)
      but has no command surface. Register it per the standalone-command downstream
      surface (7 places; `task sync` + `task generate-tools`). Explainability is the
      most-repeated remaining reviewer gap. verify: `/explain-run` resolves and runs;
      consistency + host-loadability green.
- [x] **3.2 `doctor` rule-scope-drift check.** `cmd_doctor.ts` runs no scoped-flip
      check; `rule_scope.ts` + `check_consumer_scope_flip.ts` exist but are not
      consumed by doctor. First 5-minute investigation (council finding — not a
      design spike): open `rule_scope.ts`, confirm/derive an expected-rule-set
      function (`ruleScopeFromSettings`/`excludedRuleBasenames` already exported); if
      it emits only boolean pass/fail, wrap it to emit an **actionable diff**
      (`Expected 88 rules, found 103: [15 extras]`). Then add one doctor check that
      (a) warns on leftover legacy full/global rule projections after upgrade and
      (b) diffs profile/pack-derived expected rules against the projected tree.
      verify: `doctor --check rule-scope-drift` flags a synthetic legacy-projection
      fixture with a listed diff; green on a clean scoped install.
- [x] **3.3 Ratchet the behavioural-eval coverage floor.** Coverage is tracked
      (`skill_eval_coverage.ts`, 42/274) but the floor (`coverage-floor.json`) is
      `overall: 2`, so nearly all coverage is unprotected. First confirm the metric
      counts **behavioural evals only** (one coverage type — council finding 3C; if
      multiple types, raise per-type floors instead of one fungible number). Raise
      `overall` to the current behavioural count. Add a lowering policy (council
      findings): a legitimate drop (e.g. two skills merged, redundant test removed)
      is allowed only by **editing the floor value with a logged reason** (mirroring
      `internal/evals/tier-floor-exemptions.json`) — never by deleting the floor;
      allow a small tolerance band only if the maintainer sets one. verify:
      `skill_eval_coverage.ts --check` green at the new floor; a synthetic coverage
      drop fails it; the lowering policy is documented next to the floor file.

---

## Disposition — reviewer strategic items (no new roadmaps created)

| Reviewer item | Disposition |
| --- | --- |
| Team-Mode defect-finding benchmark (P0) | Existing `road-to-team-mode.md` — needs benchmark spend |
| Real external participant / adoption (P0) | Existing `road-to-adoption-without-narrative-debt.md` — field, not code |
| Bus factor / second maintainer | Existing `road-to-maintainer-bus-factor.md` |
| Request-specific dynamic rule loading | Existing `road-to-request-scoped-rule-load.md` |
| Outcome telemetry (influenced_outcome, rework, …) | Existing `road-to-subagent-value-realization-followup.md`; **do not rebuild telemetry yet** |
| Utilization sweep (KEEP/MERGE/DEMOTE/REMOVE) | Gated on the pre-registered window (~2026-08-26); let it run |
| Knowledge sensitivity layer | **Done** — ADR-121 (2026-07-12) |
| Command-surface hiding | **Done** — ADR-092 `visibility:` |
| Cost-per-quality metric (`quality_per_dollar`) | Feature-bet, council-deferred |
| Council domain-expertise weighting | Feature-bet, council-deferred (only confidence weighting exists) |
| Settings-axes derivation from profiles/packs | Feature-bet, council-deferred |
| First read-only connector (GitHub+Linear/Jira) | Feature-bet, demand-gate defer (reviewers agree) |

## Acceptance criteria

- Phase 1 & 2 fully closed; every step verified with fresh evidence.
- Phase 3 items either built-and-verified or explicitly demoted with a council-cited reason.
- `task ci` green (remote CI is the authoritative gate).
- No duplicate roadmap created for any § Disposition item.

## Rollback

All changes are documentation, CI-comment logic, one new lint, one command
registration, one doctor check, and a coverage-floor number — each revertable by
reverting its commit. No runtime or data migration. Two state-dependent notes
(council): **1.4** — reverting the lint is clean only while zero release commits have
passed it; after that, audit for index gaps the passed commits introduced. **3.3** —
revert by restoring the previous floor value, never by deleting the floor (deleting
un-protects the coverage gained since).

## Council review (2026-07-13)

Deep council (`claude-sonnet-4-5` + `gpt-4o`, roadmap input-mode, 3-round peer
review; response `feedback-9.0-followups-roadmap.json`). Verdict: **CONDITIONAL
GREENLIGHT — all phases build-now, ~92% executes-without-blocking confidence after
the fixes below.** Necessity gate: borderline-strategic, proceed.

### Convergence findings (applied above)

1. **1.2 "and/or" is a mutually-exclusive strategy choice** — pick one. Applied:
   default strategy B (move prose to `## [9.0.0]`), fallback A only if the era test
   forbids B · trace: §claude-sonnet-4-5, §gpt-4o.
2. **1.4 "release commit" undefined** — pins the trigger to a `### BREAKING` under a
   released `## [N.0.0]` heading + adds an override escape hatch · trace: all three.
3. **3.3 ratchet lacks a lowering policy** — add logged-reason lowering + behavioural-
   only coverage-type guard · trace: §claude-sonnet-4-5 §3.3, §gpt-4o.
4. **1.1 phantom-major risk** — verify table rows against real `git tag` majors
   (finding 3A) · trace: §claude-sonnet-4-5.
5. **2.3 "unambiguous" is itself ambiguous** — explicit `(Blocking)`/`(Advisory)`
   labels (finding 3B) · trace: §claude-sonnet-4-5.
6. **1.3 depends on 1.2** — MIGRATION link must use a stable anchor, not a
   `[Unreleased]` heading (3-critical) · trace: §claude-sonnet-4-5.
7. **Rollback: one line per risky task, not a gold-plated section** — applied to 1.4
   and 3.3 · trace: §claude-sonnet-4-5 (rejecting the meta-reviewer's over-engineered
   12-line section).

### Divergences (resolved)

- **3.1 / 3.2 pre-registration audit** — Reviewer A demanded 1–2 day design spikes;
  `claude-sonnet-4-5`, `gpt-4o`, and the meta-reviewer rejected this as a category
  error (3.1 is command registration, not feature build; 3.2's deriver exists). →
  **Resolved: no design spike; proceed, with 3.2's 5-minute "confirm/wrap the
  deriver" investigation built into the step.**
- **Phase 1↔2 coupling** — Reviewer B inferred coupling; the panel confirmed the
  phases are architecturally isolated (markdown vs CI/code, no shared read). →
  **Resolved: no coupling; phases independent.**
