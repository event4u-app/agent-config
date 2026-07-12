---
status: ready
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to feedback 8.11 round 2+3 — shrink, pre-register, prepare

> Disposition roadmap for the two follow-up reviews of PR #918 and the
> post-#919 state (collected 2026-07-12, `agents/tmp/feedback-8.11-2.txt` +
> `-3.txt`, gitignored, summarized inline). Both reviews confirm the #918
> direction (9.8/10) and land the next asks: make the complexity report
> capable of showing SHRINKAGE (then actually shrink — execute migration
> Batch A), pre-register the telemetry window's decision criteria before
> data accumulates, make explain-run readable, one maintainer map, prepare
> branch protection, and document what already scales in the knowledge
> layer. Team-mode build-out is explicitly the next DEDICATED PR, not this
> one.
>
> **Council convergence (claude-sonnet-4-5 + gpt-4o, 2026-07-12, 2 rounds,
> actual $0.12):** unanimous — ONE roadmap/PR for rounds 2+3; team-mode
> Phases 1-2 stay OUT (own next PR); hard complexity CI gate REJECTED
> (soft ratchet only); branch protection prepared with a MINIMAL stable
> required-check core, never self-applied. Split on artifact-first vs
> demand-driven (one member: defer new analysis surface until a user asks;
> other: adopt with minimal extensions) — resolved by the host: the
> maintainer's execute-this-feedback instruction IS the demand signal, and
> prereg-before-data follows the repo's own claims convention; adopted
> items stay minimal (bug-fix-class report changes, one cheap coupling
> metric from existing data, one-page map, one-paragraph docs) and every
> new surface keeps a kill criterion. Batch A: all 9 rules WITH per-rule
> deterministic gates and skip-with-note on any red (middle of all-9 vs
> pilot-3).

## Goal

(1) Pre-register the utilization window's decision criteria while the data
is young; (2) complexity report v2 — placeholder-noise fix, stale-wiring
fix, proxy labels, rule→skill coupling metric, checked-in baseline with
WARN-on-increase (always exit 0); (3) execute rule-migration Batch A (9
rules → existing targets) so the report can show real shrinkage; (4)
explain-run plain-language summary; (5) one-page maintainer system map;
(6) branch-protection config prepared as a user-owned blocker; (7)
knowledge-scaling documentation (3 of 5 asked-for mechanisms already
exist) + volume revisit-if; (8) local_auto_run posture paragraph. No new
daemon/state/subsystem; every surface keeps its kill criterion.

## Context — owned elsewhere (routing, not duplication)

| Ask | Owner |
|---|---|
| Team-mode Phases 1-6 build (reviewers' P0/P1) | `road-to-team-mode.md` — immediately-next dedicated PR (council unanimous) |
| Migration Batches B (7 new guidelines) + C (safety-floor shape) | `road-to-request-scoped-rule-load.md` Phase 5 |
| External connectors (Jira/Linear/Confluence/Drive/Slack) | gated stubs — `domain-adoption-policy` demand signal still not met |
| Deep maintainer operating manual / succession | `road-to-maintainer-bus-factor.md` (this PR ships only the one-page map) |
| Settings-axes UX ("108 axes" warning → profiles derive settings) | wizard/profile system — no new work adopted this round; the complexity baseline makes axis growth visible |
| Council-vs-solo baseline execution | pre-registered in #918; still spend-gated (user) |

## Phase 0 — Pre-register the utilization-window decision criteria

Reviewer: without pre-fixed criteria the window "ends with many events and
no decidable statement." Repo convention (orchestration-dispatch-net-win,
council-vs-solo-baseline): falsification criteria are fixed BEFORE the
numbers land. Window started 2026-07-12 (engagement telemetry ON in this
repo, id-only).

- [x] <!-- done 2026-07-12: floor (>=100 boundaries, >=2 hosts w/ documented
      degraded form, >=45 days; one 30-day extension then honest null),
      rules D1-D4, out-of-scope list, kill criterion. -->
      Design doc `docs/design/utilization-window-criteria.md`: observation
      floor (≥100 recorded task boundaries AND ≥2 distinct hosts AND ≥45
      elapsed days — else the window is "underpowered": extend ONCE by 30
      days, then stop and record the honest null); decision rules fixed
      now — (a) artifact loaded-never-consulted across the full window →
      retirement-candidate list (feeds U1's ranked cut list), (b)
      consulted-never-applied at <10% applied-ratio → trigger-review
      queue, (c) window closes above floor → the U1 report MUST name ≥1
      concrete keep/cut/review decision per artifact kind or record why
      not. Explicitly out of scope: outcome-quality attribution (needs the
      loaded denominator + more volume; stays with U1a).
- [x] <!-- done 2026-07-12: entry added (unbacked, PRE-REGISTERED). -->
      CLAIMS.md entry `utilization-window-decidability` (kind:
      comparative, status: unbacked, PRE-REGISTERED — criteria above,
      no goalpost-moving after the numbers land).
- [x] <!-- done 2026-07-12: pointer appended to U1a — the U1 report
      consumes the rules, it does not redefine them. -->
      Cross-reference: append the criteria pointer to the U1a step in
      `road-to-ecosystem-harvest-reliability-measurement.md` (owner keeps
      the report; this roadmap only fixes the decision rules).

## Phase 1 — Complexity report v2 (bug-fix class + one metric + baseline)

Verified live: the runtime-state metric counts placeholder tokens
(`*.json`, `<concern>.json`, `<id>.json` — grep artifacts, not surfaces);
the report body still says "Not wired into CI" although #918 wired
`task complexity-report` into both CI task lists. Council: hard gate
REJECTED; ratchet stays soft (always exit 0).

- [x] <!-- done 2026-07-12: glob/template filter; 15→12 surfaces
      (*.json/<concern>.json/<id>.json dropped); red-path test green. -->
      Fix placeholder-token noise: filter glob/template tokens from the
      runtime-state surface counter; red-path test (a literal
      `<concern>.json` in a fixture must NOT count).
- [x] <!-- done 2026-07-12: names `task complexity-report`, report-only,
      never fails the build. -->
      Fix the stale "Not wired into CI" paragraph (it IS wired; say so and
      name the task).
- [x] <!-- done 2026-07-12: (PROXY) in the Metric column for rows 2/5
      always, row 3 on import-proxy source. -->
      Label every proxy metric as PROXY in the metric table header, not
      only in method prose.
- [x] <!-- done 2026-07-12: countRuleSkillCoupling() imports collect()
      from rule_backlinks — 74 targets / 81 backlinks at baseline. -->
      New metric 6 — rule→skill coupling count: parse the existing
      `rule_backlinks` derivation (targets + backlinks totals); no new
      scanning logic.
- [x] <!-- done 2026-07-12: baseline checked in (reason: initial baseline
      feedback-8.11-2 Phase 1); Ratchet-vs-baseline section with WARN/
      Improved lines; exit 0 always; kill criterion untouched. -->
      Soft ratchet: check in `internal/reports/complexity-baseline.json`
      (schema-versioned snapshot of the raw metrics); the report renders a
      `## Ratchet vs baseline` section with WARN lines on any metric above
      baseline and an instruction to either justify (cite the PR) or
      re-baseline deliberately. ALWAYS exit 0. Kill criterion unchanged.
- [x] Regenerate the report; tests green.
      <!-- done 2026-07-12: regenerated; 34/34 complexity + 4 backlinks
      tests green; typecheck clean. -->

## Phase 2 — Rule-migration Batch A (the "show shrinkage" ask)

All 9 Batch-A rules (existing targets, per the 2026-07-12 inventory), each
individually gated: Iron-Law stub stays byte-preserved
(`check_condensation` / preservation-guard), trigger-set fires at least as
well as before (trigger evals), body lands in the named existing target.
Any rule failing its gate is SKIPPED with a note (per-rule fallback, never
force). Kernel + safety floors untouched by construction.

- [x] Migrate `roadmap-ci-steps-policy` → `contexts/execution/roadmap-process-loop.md` <!-- contingency taken: process-loop already 5x over its 4k budget → body in NEW sibling roadmap-ci-steps-mechanics.md, linked from §5 step 0; 155→68 lines -->
- [x] Migrate `code-comment-discipline` → `docs/guidelines/code-clarity.md` <!-- 148→64; merged into Comment-discipline section, no duplication; 4 fixture tests green -->
- [x] Migrate `untrusted-input-defense` → `docs/guidelines/agent-infra/untrusted-input-spotlighting.md` <!-- 142→70; quarantine stays in stub; smuggling-lint clean -->
- [x] Migrate `no-roadmap-references` → `skill:agent-docs-writing` <!-- 139→75; council-ref regex trap avoided via angle-bracket placeholders; 40 tests green -->
- [x] Migrate `decision-revisit-gate` → `skill:decision-review` <!-- 128→60; lock catalog + fire steps migrated -->
- [x] Migrate `improve-before-implement` → `docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md` <!-- 124→65 lines; anchor #8; links verified -->
- [x] Migrate `architecture` → `skill:module-detect-on-the-fly` <!-- 96→51; Iron-Law fence byte-identical; frontmatter cap fixed; 406 artefacts validate -->
- [x] Migrate `persona-governance` → `docs/contracts/persona-schema.md` <!-- 91→49; §8 governance-discipline section -->
- [x] Migrate `provider-lifecycle-discipline` → `docs/contracts/provider-lifecycle.md` <!-- 78→52; §4a/4b added; day-one merged not duplicated -->
- [x] <!-- done 2026-07-12: check_condensation PASSED; frontmatter 406/0;
      trigger-matrix suites 48 tests green (agents); backlinks regenerated
      (76 targets); complexity report regenerated — ratchet shows coupling
      81→84 (+3 WARN, justified: Batch-A routing, this PR) and the direct
      shrinkage measurement: 9 stubs 56,389→27,209 bytes (−51.7%); Batch-A
      step flipped in road-to-request-scoped-rule-load. -->
      Batch verification: `check_condensation` green over all migrated
      stubs; trigger evals green; `rule_backlinks` + complexity report
      regenerated — the ratchet section must show the always-loaded/auto
      rule-byte shrinkage (the reviewers' explicit ask); flip the
      corresponding Batch-A step in `road-to-request-scoped-rule-load.md`.
      <!-- verify: ./scripts-run src/scripts/check_condensation -->

## Phase 3 — Explain-run readability

- [x] <!-- done 2026-07-12: renderSummarySection() — plain-language
      one-liners derived from the already-computed values (engagement
      summary computed once, reused); both no-data and fixture cases
      tested; 19/19 tests green; typecheck green. -->
      Add a `## Summary` section at the top of the explain-run report:
      plain-language one-liners per section (rule counts always-on vs
      trigger-routed, engagement present/absent with counts, dispatches in
      window with cost total, hygiene state) — no new data sources, no new
      flags; fixture test asserts the summary renders for both data-present
      and no-data cases.

## Phase 4 — Maintainer system map (one page)

- [x] <!-- done 2026-07-12: one-page map shipped (chain + 9 subsystem
      paragraphs w/ one pointer each + 10-second edit router); routing note
      appended to road-to-maintainer-bus-factor (deep manual stays there);
      linked from AGENTS.md pointer block next. -->
      `docs/maintainers/system-map.md`: the chain
      src → condensation → dist → host projection → installer → consumer
      hooks, plus one paragraph per subsystem (router/rules, skills,
      commands, knowledge/memory, council, subagents, telemetry, claims/
      proof, CI gates) with ONE pointer each to the owning contract/skill;
      explicitly labeled "a map, not a contract — the linked docs win."
      Cross-link from `docs/maintainers/` index or AGENTS.md pointer block
      if one exists; deeper operating manual stays with
      `road-to-maintainer-bus-factor.md` (routing note there).

## Phase 5 — Branch protection prepared (user-owned, never self-applied)

- [x] <!-- done 2026-07-12: doc shipped — minimal ubuntu core (Static
      Checks, 4 Node shards, Golden, Install Aux), enforce_admins true,
      reviews 0 w/ bus-factor rationale + revisit, strict:false rationale,
      live name-verification command, rollback, rename caveat. -->
      `docs/maintainers/branch-protection.md`: rationale + the exact
      ready-to-run `gh api` command enforcing on `main`: PR required, no
      force-push/deletion, required checks = MINIMAL STABLE CORE (council:
      not all ~59 checks): Static Checks, the four Node Tests shards per
      OS pair actually named as contexts, Golden Tests, Install Aux — the
      doc derives the exact context names live from a listed command so
      renames are a doc update, not a lockout.
- [x] <!-- done 2026-07-12: registered in § Blockers below; surfaced in
      the run's final report. -->
      Register blocker `branch-protection-apply` (owner: user) in this
      roadmap's Blockers; applying is a repo-admin, outward-facing action
      the agent never performs.

## Phase 6 — Documentation closures

- [x] <!-- done 2026-07-12: "Scaling posture" section added — 3 of 5
      mechanisms exist (.share-blocklist, review_after, purge tombstones);
      batch-review/queues parked behind revisit-if >20 pending promotions
      in one window. -->
      Knowledge-scaling reality: extend
      `agents/settings/contexts/knowledge-sensitivity.md` with a "Scaling
      posture" section — never-promote-source = `.share-blocklist`
      (exists), per-card expiry = `review_after` (exists), bulk revocation
      = `purge` tombstones (exists); batch-review/ownership queues PARKED
      behind revisit-if ">20 pending promotions in one window".
- [x] <!-- done 2026-07-12: posture note in the template comment
      (deliberate design decision; never suppresses diff-scoped probes /
      new-gate carve-out / user-invoked runs; run-end wording fixed). The
      rule-side wording rides with the Batch-A migration of
      roadmap-ci-steps-policy (same PR). -->
      local_auto_run posture: one clarifying paragraph in the settings
      template comment + the roadmap-ci-steps-policy rule's guideline
      home: remote CI is the gate BY DESIGN (deliberate, documented
      deviation), narrow diff-scoped probes still run, new-gate carve-out
      unchanged.
- [x] <!-- done 2026-07-12: the list in this step IS the record. -->
      Feedback items deliberately NOT adopted this round (record inline
      here): hard complexity CI gate (rejected until the report survives
      its kill criterion); team-mode build in this PR (next dedicated PR);
      new time-series metrics beyond the coupling count; connectors
      (still gated); settings-axes UX rework (no new work — baseline makes
      growth visible); "document on first user ask" deferrals from the
      council minority are honored by keeping every adopted doc ≤ 1 page.

## Acceptance criteria (anti-dump)

- Every phase's new/changed script behavior carries a fresh local test run
  (new-gate carve-out); full pipeline stays delegated to remote CI.
- Batch A: 9/9 migrated OR skipped-with-note; zero preservation-check
  regressions; trigger evals not regressed; the regenerated complexity
  report's ratchet section demonstrates measured shrinkage vs the checked-
  in baseline.
- No new always-loaded surface; no new daemon/state DB; every new report
  section keeps a kill criterion.
- Dashboard regenerated; this file archives in the PR that completes it.

## Blockers

- **blocker: branch-protection-apply** — Status: open · Owner: user ·
  Blocks: nothing in this roadmap (preparation ships; application is the
  user's repo-admin action). Resolved when: the user runs the documented
  command (or declines and records why).

## Notes

- Source: `agents/tmp/feedback-8.11-2.txt` + `feedback-8.11-3.txt`
  (local-only). Verified live before adoption: PR #918 + #919 MERGED;
  persona-placebo honest null landed; complexity-report placeholder
  tokens + stale CI line reproduced; `.share-blocklist` / `review_after` /
  purge-tombstones existence confirmed.
- Council question + rounds live in the auto-pruned runtime layer; the
  convergence summary is inlined above.
