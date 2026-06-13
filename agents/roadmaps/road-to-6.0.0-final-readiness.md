---
complexity: structural
status: ready
---

# Road to 6.0.0 final-readiness & product coherence

> Turn the PR #489 / 6.0.0 review into a closed set of release-blocking fixes
> plus the boundary contracts that keep "workspace" from becoming the new
> catch-all.

## Goal

Make 6.0.0 final-releasable — structure-truth-clean public docs, verified
upgrade-cleanup, then a human-readable release story with migration
instructions proven against fixtures — and lock the workspace/video scope
boundaries the review flagged, while capturing the heavyweight
knowledge/analytics tracks as gated watch-notes rather than scope-creeping
them into this release.

## Context

Source: multi-reviewer review of PR #489 (6.0.0) in
`agents/tmp/feedback-2026-06-13-04-14.txt`. Convergent verdict across three
reviewers: technically the strongest state to date (workspace runtime + host
runtime + session/encryption system), but two risks — (a) the release *story*
lags the architecture, and (b) "workspace" + "video" threaten scope drift.
First external fork + 7 stars raise the adoption stakes for getting the
release communication right.

**Phase order is dependency-driven** (AI-council convergence, 2026-06-13):
release communication (the migration instructions) cannot be authored before
the structure-truth audit fixes the real target paths and the upgrade-cleanup
scenarios prove the migration tooling works. Hence Structure → Upgrade →
Release, then Boundary → Legibility → Deferred.

## Out of scope — human-owner actions

These surfaced in the review but are not agent work; they belong in
`agents/reports/human-owner-todo.md`, not as checkboxes here:

- Contact the first external fork ("what are you building? can I help?").
- Activate branch protection on the GitHub repo.
- Run structured recruit-sessions with external (non-team) people, now
  exercising the workspace drive (not just install).

## Phase 1 — Structure-truth & jargon audit

Public docs must match the new `src/` + `dist/agent-src/` reality before any
migration instructions can cite real paths.

- [ ] Audit README + public docs for stale source-of-truth paths: no old
      root `.agent-src/` assumptions; reflect `src/`, `dist/agent-src/`,
      `src/scripts`, `src/config`, `src/templates`. Fix every stale path.
- [ ] Confirm `src/scripts/check_no_new_legacy_path.py` already blocks
      re-introduction of legacy root `.agent-src` paths in README/docs/src
      (excluding `dist/`); extend its coverage only if a gap is found — do
      not author a new linter. <!-- carve-out: new-gate-verification -->
- [ ] Record the current `lint_readme_jargon.py` above-fold baseline (actual
      hit count, by README section — semantic section, not line numbers),
      then drive it to 0 and confirm the gate reports 0.

Exit: `grep` for legacy `.agent-src` root paths in README/public docs returns
zero; `lint-readme-jargon` reports 0 above-fold hits; legacy-path linter
coverage confirmed.
Rollback: revert doc edits; any linter extension is additive and revertible.

## Phase 2 — Upgrade-cleanup verification

The stale-file reaper is the boring-but-essential release work; prove it,
including the version-skew cases external (staged-upgrade) users hit.

- [ ] Exercise the stale-file reaper across the forward scenarios and record
      results: 5.10.1 global→6.0.0, 5.10.1 project→6.0.0, old `.agent-src`
      present, old wrappers present, mixed stale files, and a dry-run that
      shows exactly what gets removed before any deletion. <!-- carve-out: new-gate-verification -->
- [ ] Add the version-skew + staged-upgrade scenarios and record results:
      6.0.0 global + 5.10.1 project coexistence (which wins / error vs silent
      fallback); 6.0.0→5.10.1 downgrade (do ghost files resurrect); lock-file
      version mismatch behaviour; partial upgrade (global on 6.0.0, projects
      migrated one at a time later — does the late project still get cleaned).
      <!-- carve-out: new-gate-verification -->

Exit: every scenario leaves no ghost files; dry-run output lists the
to-be-removed set before any deletion; version-skew behaviour is documented.
Rollback: any scenario failure **blocks 6.0.0** — 6.0.0 does not ship until
all scenarios pass; file a P0 reaper bug and re-run this phase after the fix.

## Phase 3 — Release communication

With paths fixed (Phase 1) and migration tooling proven (Phase 2), write the
consumable release story and migration instructions — and validate them.

- [ ] Write a human-readable 6.0.0 release overview (≤ 7 headline points:
      new workspace, multi-turn continuation, secure local stores, MCP
      server, AI-video adapters, breaking structure move, upgrade cleanup)
      as a top-of-release summary, separate from the raw changelog. Budget:
      ≤ 400 words total (≈ 2-minute read).
- [ ] Add an explicit **Breaking changes** section answering, per change:
      who is affected · what breaks · how to migrate · which command(s) fix
      it · the rationale. Cover both: root `.agent-src/` removed; condensed
      output moved to `dist/agent-src/`.
- [ ] Validate every migration instruction: from a 5.10.1 fixture state
      (reuse the Phase 2 fixtures), follow the written steps verbatim and
      confirm the result matches the 6.0.0 expected state; fix any gap the
      walkthrough exposes. <!-- carve-out: new-gate-verification -->
- [ ] Frame AI video as an optional Creative Pack ("graduates from prototype
      to validated provider adapters"), not as core identity. No "agent-config
      is now also an AI video platform" framing anywhere in the release notes.

Exit: a reader who never saw the PR understands 6.0.0 in under two minutes
(≤ 400 words); breaking-change section answers all five points for both
moves; migration steps reproduce the expected state from a fixture.
Rollback: revert the release-notes/changelog edits (docs-only, no code).

## Phase 4 — Workspace boundary contract [structural]

Stop "workspace" from becoming the new "meta" — with a drift-detection
mechanism, not a wish-list document.

- [ ] Author an ADR + a workspace-boundary contract under `docs/contracts/`
      stating: workspace **owns** task orchestration, host-session lifecycle,
      continuation, drive health; workspace does **NOT** own skill design,
      profile semantics, video-provider logic, MCP-registry policy, or
      analytics product strategy.
- [ ] Survey the current workspace surface for existing boundary violations;
      document each found (or record zero found) with a fix/accept note.
- [ ] Define a drift-detection mechanism fit to this repo's surface — a
      linter / CI reachability check over the actual workspace code or docs
      (this package has no dependency-cruiser/TS-import-boundary tooling, so
      pick a check that matches the real surface, or record explicitly that
      the boundary is doc-governance-only and why). <!-- carve-out: new-gate-verification -->
- [ ] Cross-link the contract from the workspace docs / overview so the
      boundary is discoverable, not buried in an ADR.

Exit: ADR is `accepted` and indexed; contract enumerates owns/does-not-own
explicitly; existing violations documented (or zero recorded); a drift-check
exists or doc-governance-only is justified; workspace docs link it.
Rollback: mark the ADR `superseded`/`rejected`; remove the cross-link and any
added check.

## Phase 5 — Employee-experience legibility

The review's "the workplace exists now" win needs plain-language surfaces and
a real decision gate (not "decide-or-defer" where any outcome passes).

- [ ] Add host explainability in plain language: why this host, why this
      tier, why a fallback fired, why continue — surfaced to the user, not
      only in logs.
- [ ] Resolve employee-mode with an explicit gate, not an open "decide":
      sketch the option(s) for hiding hosts/tiers/drives/health behind simple
      workflows with their config + testing impact, then either build the
      lowest-impact option **if** a demand signal exists (≥ 3 external
      requests for simpler onboarding), **else** `[~]` defer with the demand
      threshold recorded as the re-open trigger. Record the decision +
      rationale.

Exit: a non-technical user can read why a host/tier/fallback was chosen;
employee-mode is either built, or `[~]`-deferred with a written demand-signal
re-open trigger (not an open-ended "decided").
Rollback: revert the explainability strings; drop the design note.

## Phase 6 — Deferred heavyweight tracks

Capture demand, do not pre-build governance for non-demanded features
(N=1 external fork today — governance follows demand, not the reverse).

- [ ] Create a single watch-note `agents/settings/contexts/domain-watch/knowledge-integrations.md`
      listing the candidate connectors (Jira, Confluence, GitHub retrieval,
      CRM, support KB, shared docs) with status `awaiting demand signal` and
      a recorded threshold (≥ 3 user requests via issues/discussions). Do
      **not** open per-connector `domain-adoption-policy` entries or
      follow-up roadmaps until the threshold is met.
- [ ] Add cross-repo retrieval (linked-project graph as knowledge graph) and
      workspace analytics (task completion, abandonment, retries, follow-ups,
      success-rate) to the same watch-note with their own demand thresholds.

Exit: one `domain-watch/` note captures all deferred tracks with explicit
demand thresholds; no per-connector roadmaps/domain-entries created; nothing
heavyweight is half-built here.
Rollback: delete the watch-note.

## Acceptance criteria

- README/public docs contain zero stale `.agent-src` root paths; 0 above-fold
  jargon hits; legacy-path linter coverage confirmed.
- Upgrade-cleanup forward **and** version-skew/staged scenarios are all
  exercised with recorded results; any failure blocks the release.
- 6.0.0 release notes carry a ≤ 400-word / ≤ 7-point overview and a
  five-point breaking-change section for both structural moves, with
  migration steps validated against a fixture.
- Workspace-boundary ADR + contract are accepted, indexed, cross-linked, with
  existing violations documented and a drift-check (or justified
  doc-governance-only stance).
- Host explainability ships in plain language; employee-mode is built or
  deferred behind a written demand-signal gate.
- Knowledge / cross-repo / analytics tracks live in one `domain-watch/` note
  with demand thresholds; nothing heavyweight is built here.

## Council review (2026-06-13)

Deep-tier AI-council run (members: anthropic/claude-sonnet-4-5 +
openai/gpt-4o; `--input-mode roadmap --depth deep`; actual spend $0.12) on the
first draft of this roadmap. Convergence drove the phase reorder and the
verification/enforcement tightening now reflected above.

### Convergence findings

1. **Phase order was dependency-broken** — release comms (migration steps)
   depended on the structure audit + upgrade verification; reorder 2→3→1.
   · trace: §anthropic §openai (both, strong agreement)
2. **Phase 3 (now P2) rollback contradiction** — "Rollback: n/a" clashed with
   "block the phase"; a reaper-scenario failure must block the release.
   · trace: §anthropic §openai
3. **Boundary contract was unenforceable** — policy statement, not a contract;
   needs a drift-detection mechanism + existing-violation enumeration.
   · trace: §anthropic §openai
4. **Version-skew / staged-upgrade untested** — coexistence, downgrade,
   lock-file mismatch, partial upgrade missing from reaper scenarios.
   · trace: §anthropic §openai
5. **Migration instructions unverified** — validate written steps against a
   fixture, not just "answers the four questions". · trace: §anthropic (+§openai rationale)
6. **Employee-mode "decide-or-defer" too loose** — any outcome passed; needs a
   demand-signal gate. · trace: §anthropic §openai
7. **Phase 6 process debt** — per-connector governance for N=1 fork is
   premature; one watch-note + demand threshold instead. · trace: §anthropic §openai
8. **Release-story length + jargon baseline undefined** — add ≤400-word budget;
   record the real jargon baseline by semantic section. · trace: §anthropic

### Divergences (no consensus)

- **Stakeholder-engagement checkpoints** — openai wanted cross-phase
  stakeholder gates; anthropic argued the Out-of-scope human-owner section
  already covers this and engagement should stay local to the Phase-5
  decision. Host sided with anthropic — kept stakeholder work out-of-scope.
- **Phase granularity** — openai cautioned against over-granular subtasks;
  anthropic added detail. Host kept phases lean.

### Host verdict

| # | Finding | Verdict | Reason |
|---|---|---|---|
| 1 | Phase reorder 2→3→1 | `accept` | logical dependency confirmed; applied |
| 2 | Rollback contradiction → failure blocks release | `accept` | applied to Phase 2 rollback |
| 3 | Boundary contract enforcement + violations | `accept-with-modification` | no dependency-cruiser/TS-import tooling in repo → mechanism must fit the real surface or justify doc-governance-only |
| 4 | Version-skew / staged scenarios | `accept` | added to Phase 2 |
| 5 | Migration-instruction fixture validation | `accept` | added to Phase 3, reuses Phase 2 fixtures |
| 6 | Employee-mode demand-signal gate | `accept` | applied to Phase 5 |
| 7 | Single watch-note over per-connector roadmaps | `accept` | matches `domain-adoption-policy` defer→watch-note path |
| 8 | ≤400-word budget + jargon baseline | `accept` | applied to Phases 3 & 1 |
| — | CI legacy-path protection (council "new issue #4") | `accept-with-modification` | `check_no_new_legacy_path.py` already exists → confirm/extend, not new linter |
| — | Stakeholder cross-phase gates | `reject` | out-of-scope human-owner section already owns this (host sided with anthropic) |

### Predecessor council trace

`agents/runtime/council/responses/road-to-6.0.0-final-readiness-roadmap.json` (this run).
