---
complexity: structural
---

# Road to Feedback Followups

**Status:** IMPLEMENTATION-COMPLETE · adoption-signal pending (owner action) —
Phases 0–3 + 5 closed 2026-05-09. Phase 4 deferred with measurable
re-entry trigger; tracked, not dropped.
**Started:** 2026-05-09
**Closed:** 2026-05-09 (agent-side)
**Trigger:** User ask — "Erstelle daraus eine Feedback roadmap. Nutze
ai council dafür. Manche punkte sind valide, andere nicht oder
outdated. Aber erstelle eine roadmap mit dem was noch ist."

## Purpose

Capture the still-open items from the multi-block feedback after the
council notes were folded into mainline (1.21.0 density-gating, PR #62
governance sweep, PR #64 Microck close). Outdated points (4× roadmap
refs, 6-week gate, PR #46 regressions superseded by density-gating)
are NOT in scope — they are recorded as resolved and dropped.

**Out of scope** (already done or user-waived):

- Display-name redesign across 153 skills — user opted for README-only
  display label change.
- 6-week stability gate — user waived.
- 4× `check-no-roadmap-refs` violations — fixed in PR #62.
- 3× PR #46 regressions (`chat-history/import.md`,
  `no-attribution-footers.md`, `role-mode-adherence.md`) —
  density-gating reclassified them; no longer fire as violations.

## Phases

### Phase 0 — Baseline snapshot (must run before any other phase)

Council flagged that Phase 2's warning audit is non-reproducible if
Phase 1 modifies skills first. Snapshot taken once, anchors every
later AC.

- [x] P0.1 — Run `task lint-skills > agents/analysis/lint-baseline-2026-05-09.txt`,
  commit the file. Records the `216 pass, 108 warn, 0 fail` baseline
  before any Phase-1 / Phase-2 changes.

### Phase 1 — Microck-harvest skill cleanup (immediate)

PR #64 (Microck harvest) introduced 5 new linter warnings on adopted
skills. Decision needed — fix, accept-with-record, or backlog.
Tolerating silently breaks the no-warning-drift posture held since
1.15.0. (Merge timing is a delivery decision and out of scope for
this roadmap; see `roadmap-writing` § "Do NOT".)

- [x] P1.1 — Renamed `repomix` → `repomix-packer`; marketplace, provenance,
  ownership matrix, cross-refs regenerated in one pass. External-ref
  sweep run, no public tutorials referenced the old name; no alias
  needed.
- [x] P1.2 — Added explicit `Inspect` step to `error-handling-patterns`
  (`Inspect the feature surface`) and `testing-anti-patterns`
  (`Inspect the diff before any new mock`). `defense-in-depth` and
  `secrets-management` already had inspect-equivalent procedures
  per the linter (verified against baseline).
- [x] P1.3 — Resolved 4 of the 5 `testing-anti-patterns` warnings via
  inline content (concrete capture tools: `curl` / Postman / `Http::fake()`
  / Playwright network-trace cited in Anti-Pattern 4; debugger /
  Xdebug guidance + 2-retry STOP rule added to Gotcha section).
  `missing_frontend_verification_example` did not fire (skill not
  classified as frontend by linter signal counter); no action
  needed. **No silent passthrough** — every fired warning is
  closed by content edit.
- [x] P1.4 — Re-ran `task lint-skills` (219 pass, 105 warn, 0 fail —
  −3 vs. baseline). Updated PR #64 body with the resolution table
  (warning → skill → action → anchor) under
  `## Feedback follow-up — Phase 1 cleanup`.

### Phase 2 — Linter precision (false-positive cleanup)

Two structural false-positives flagged across recent PRs that are
cheaper to fix once than re-decide on every adoption.

- [x] P2.1 — Linter `no_steps` check now exempts commands with a
  delegation signal (`cluster:` / `routes_to:` frontmatter or ≥ 3
  `.md` links) AND recognizes both `### N.` and `### Step N`
  sub-headings. `scripts/skill_linter.py` updated; 3 regression
  tests in `tests/test_skill_linter.py` cover (a) cluster-head no
  warning, (b) leaf without steps still warns, (c) `### Step N`
  pattern recognized. Net effect: 105 → 95 warnings (10 commands
  cleared, including `/research`).
- [x] P2.2 — Triage doc shipped: `agents/analysis/lint-warning-triage.md`
  buckets every baseline warning code into (a) genuine fix
  (~82%), (b) `linter_accept_reason` justified (~11%), (c) check
  too aggressive (~7%). Bucket (a) is forward-only enforced;
  buckets (b)/(c) tracked for follow-up phases.

### Phase 3 — Governance hygiene

Two recurring patterns observed across PR #60 and PR #62 that cost
~30 % of each feature-PR's commit count.

- [x] P3.1 — Governance-baseline sub-section added to
  `command-writing` and `rule-writing` skill procedures (§ 6 in
  both). Advisory pattern: when a PR adds or strengthens a linter
  check, the PR body must include a Markdown table of pre-existing
  violations on `main` with bucket classification. Forward-only,
  reviewer-checked, no CI gate.
- [x] P3.2 — Test-count-trend footer added to `scripts/release.py`.
  `_count_tests_current()` runs `pytest --collect-only -q` on the
  current tree; `_previous_test_count_from_changelog()` parses the
  previous release's `Tests: N` footer; `render_changelog_entry`
  appends `Tests: N (+M since X.Y.Z)` when both are available.
  Silent on errors — never blocks a release. 5 regression tests
  added to `tests/test_release.py`.

### Phase 4 — Adoption signal (user-action-deferred · 2026-05-09)

**Status:** owner-action only — not agent-executable. Council 2026-05-09
verdict: keep deferred (Option A), do not drop (Option B), do not
split into a separate checklist (Option C). Re-entry trigger is
measurable, not date-based.

1→2 stars across PR #60 → PR #62 is the first external traction in
60 PRs / 38 releases. Recording a showcase / opening a Discussions
thread before the package crosses verifiable adoption signal is
premature optimization — the binding constraint today is product
depth + verifiability (handled by `road-to-proof-not-features` in
Tier 2), not demo media.

**Re-entry trigger** (any one fires):

- Stars ≥ 5 (currently 2), OR
- ≥ 3 inbound requests for a showcase / demo, OR
- A user explicitly asks for the discussions thread to be opened.

Phase items remain unticked on purpose — they record an open commitment,
not a missed target.

- [ ] P4.1 — Record one showcase session (≤10 min) on the
  `/work` + `refine-prompt` + `judge-*` happy path. **Content
  rubric:** must show (a) a concrete failure mode the council /
  judge skills catch, (b) one user clarification turn,
  (c) the resulting PR-ready diff. Publish on the README's social
  block. _(Deferred — owner action, see re-entry trigger above.)_
- [ ] P4.2 — Open a `discussions` thread on the GitHub repo asking
  the two stargazers what brought them in. No spam — one thread.
  _(Deferred — owner action, see re-entry trigger above.)_

### Phase 5 — Backlog confirmations

- [x] P5.1 — Closed with rationale 2026-05-09. (a) `caveman-speak.md`
  is a tier-1 always-active rule with `intent: "any reply"`; the
  compiled `router.json` correctly emits `routes_to: []`. Compile-time
  gate via `scripts/compile_router.py` (`caveman.enabled` + `caveman.speak`).
  No `routes_to` field is required or appropriate in source frontmatter.
  (b) `verbosity.offer_council_in_delivery` is wired in the three
  chat-level delivery commands (`commands/roadmap/create.md`,
  `commands/review-changes.md`, `commands/feature/plan.md`). The
  Work-Engine Python dispatch (`templates/scripts/work_engine/`) has
  zero council touchpoints by design — Council is invoked at the
  command layer, not the engine layer. Nothing to wire there.
- [x] P5.2 — Advisory delivered 2026-05-09 in
  `agents/analysis/roadmap-priority-2026Q2.md`. Ranks all 13 open
  roadmaps (one more than the original "12" because this roadmap
  itself was created in flight) across the three axes (a) external-
  adoption pull, (b) blocking-other-work, (c) effort-to-close.
  Tier 1 (finish first): this roadmap. Tier 2 (recommended pair):
  proof-not-features + chat-history-cross-agent-hardening Phase 1.
  Three decision points council-synthesised 2026-05-09; verdicts
  + measurable re-entry triggers folded back into the advisory
  (`agents/analysis/roadmap-priority-2026Q2.md` § Verdicts).

## Acceptance criteria

All AC anchored to the Phase-0 baseline snapshot
(`agents/analysis/lint-baseline-2026-05-09.txt`).

- **Phase 1:** Every new warning introduced by PR #64 is either fixed
  or carries `linter_accept_reason` frontmatter. Net new warnings vs.
  baseline = 0 after P1.1 / P1.2 / P1.3.
- **Phase 2:** `task lint-skills` reports baseline-warn − 12 or
  fewer (target: ≤96 warn) AND 0 fail. P2.1 regression tests green
  in `tests/`.
- **Phase 3:** P3.2 lands in the next release notes; P3.1 is
  advisory, no CI gate, success measured by reviewer adoption in
  the next two rule-introducing PRs.
- **Phase 4:** Deferred — owner-action gated. AC re-activates
  when the re-entry trigger fires (stars ≥ 5, ≥ 3 showcase
  requests, or explicit owner ask). Until then, the unticked
  checkboxes record an open commitment, not a missed AC.
- **Phase 5:** Both deliverables exist; P5.2 marked "user-decided"
  with a date stamp.

## Council notes

Validated 2026-05-09 by AI Council (anthropic/claude-sonnet-4-5 +
openai/gpt-4o, 2 rounds, $0.0641 actual). Synthesis with applied
fixes and divergences lives in
`agents/analysis/feedback-followups-council.md`.
