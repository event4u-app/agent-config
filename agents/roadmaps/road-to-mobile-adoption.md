---
complexity: structural
---

# Road to Mobile Adoption

**Status:** READY FOR EXECUTION — decisions synthesized 2026-05-06 from
AI Council (claude-sonnet-4-5 + gpt-4o, $0.0371 actual run).
**Started:** 2026-05-06
**Trigger:** User ask — "harvest the mobile skills from
`Microck/ordinary-claude-skills` (mobile category) into the suite."
**Mode:** Conservative first-toe-in-mobile plate. Hard cap 5 per
6-week plate; this plate uses **3 of 5 slots** intentionally. Phase 2
is gated on Phase-1 evidence + cross-project demand signal. Phase 3
addresses the governance gap surfaced during analysis (council
recommendation: a planned domain-adoption-policy rule).

## Purpose

Establish a minimal, high-confidence mobile track without inheriting
upstream curation problems (mis-categorized index, 8500 LOC of
platform-specific Python, RN-version-pinned skill that rotates every
6-12 months). Adopt only what is currently stable, externalize what
is volatile via authoritative links, defer what would rot in months.

## Decisions (synthesized 2026-05-06 from council)

- **Adopt mobile track now** (user direction wins) — but at minimum
  surface only.
- **`react-native-expo` deferred to Phase 2.** Sonnet's volatility
  argument accepted: 917-line skill pinning RN 0.76-0.82+ / SDK 52+ /
  React 19 will rot before the next plate ships. Reopen after RN
  community consolidates around a stable surface.
- **`ios-simulator-skill` is a guideline, not a skill — and the 21
  Python scripts are NEVER forked.** Authoritative-link only:
  upstream repo SHA + the 5 reference modules (`accessibility_checklist`,
  `idb_quick`, `simctl_quick`, `test_patterns`, `troubleshooting`)
  inlined verbatim with attribution. 8500 LOC of macOS+Xcode-bound
  Python belongs upstream.
- **`flutter-development` dropped.** 12 stars, generic widget
  cheatsheet readily available in Flutter docs. If demand surfaces,
  expect a full rewrite, not adoption.
- **One net-new skill: `mobile-e2e-strategy`.** Bridges existing
  `playwright-testing` / `e2e-plan` / `e2e-heal` to mobile — Detox vs
  Appium vs Maestro selection, simulator/emulator prereqs as
  authoritative links, no implementation details. Closes the "missing
  link in cross-platform E2E" gap.
- **Phase 3 governance:** author the domain-adoption-policy rule
  (≤200 lines) to gate future domain tracks (mobile, ML, blockchain,
  scientific computing) on demand-signal + maintenance ownership.

## Authoritative-Link Sunset path (hard rule)

For mobile-platform tooling that is too volatile or too large to fork:

- The guideline body explains **when, why, and the decision matrix**
  in ≤300 lines.
- All concrete commands, scripts, configs are linked to upstream
  via SHA-pinned URLs with last-checked timestamp.
- Refresh trigger: quarterly review or earlier if upstream
  authoritative-link 404s in CI.
- Applies to `ios-simulator-guide` (Phase 1) and to
  `react-native-expo` if/when adopted (Phase 2).

## Horizon (6-week visible plate)

Phase 1 ships **3 adoptions + suite integration**. Phase 2 unlocks
only after Phase 1 evidence (lint clean, integration confirmed, all
authoritative links resolve in CI).

## Phase 1 — Mobile-track Phase-1 plate (READY)

- [ ] **P1.1 — `react-native-setup` skill.** Adopt 216-line skill
  from anton-abyzov upstream. Strip the SpecWeave-integration block
  (lines mentioning `/specweave:increment`, `tasks.md`, `spec.md`,
  `reports/`). Verify `augment-portability` (no project-specific
  paths). Cross-link from `mobile-e2e-strategy`. Lines budget: ≤250
  after scrub.

- [ ] **P1.2 — `ios-simulator-guide` guideline (authoritative-link).**
  Author new guideline at `docs/guidelines/agent-infra/` covering
  decision matrix (when to use simctl vs idb vs xcodebuild),
  semantic-vs-pixel navigation rationale, accessibility-driven
  testing approach. Inline the 5 reference modules
  (`accessibility_checklist`, `idb_quick`, `simctl_quick`,
  `test_patterns`, `troubleshooting`) verbatim with attribution.
  Authoritative-link to upstream `conorluddy/ios-simulator-skill` SHA
  for the 21 Python scripts. Lines budget: ≤300.

- [ ] **P1.3 — `mobile-e2e-strategy` skill (NET-NEW).** Author new
  skill bridging existing E2E surface to mobile. Cover Detox vs
  Appium vs Maestro decision matrix, iOS Simulator + Android Emulator
  prerequisites (authoritative links to Apple/Google docs), CI floor
  (macOS runner cost note for iOS), integration touch-points with
  `playwright-testing`, `e2e-plan`, `e2e-heal`. NO implementation
  recipes. Lines budget: ≤300.

- [ ] **P1.4 — Suite integration.** Add the new skill, the new
  guideline, and the adopted skill to `.agent-src.uncompressed/`
  manifests. Run `task sync` → `.agent-src/` regenerated. Run
  `task generate-tools` → `.claude/`, `.cursor/`, `.clinerules/`,
  `.windsurfrules` regenerated. Verify `task ci` exits 0:
  `lint-skills`, `check-portability`, `check-refs`, `lint-readme`,
  `test`. Cross-references from `playwright-testing`, `e2e-plan`,
  `e2e-heal` to `mobile-e2e-strategy` added.

## Phase 2 — Out-of-horizon (gated on Phase 1 evidence + demand)

- [ ] **P2.1 — `react-native-expo` skill (split adoption).** Reopen
  only after (a) RN community consolidates around a stable surface
  past current SDK churn, OR (b) ≥2 consumer projects ship
  Expo-based mobile apps. Adoption shape: aggressive split — core
  ≤300 lines + SHA-linked sections for New Architecture / React 19
  changes / Swift iOS template / DevTools migration. Refresh trigger:
  every minor SDK release.

- [ ] **P2.2 — `flutter-development` rewrite.** Reopen only on
  demand signal (≥1 consumer project shipping Flutter). Do NOT
  adopt as-is — full rewrite from Flutter official docs, ≤300 lines,
  state management + navigation + platform-channel patterns only.
  Drop widget recipe content (already in upstream docs).

- [ ] **P2.3 — Android-side parity.** If Phase 1 lands clean, author
  `android-emulator-guide` mirroring `ios-simulator-guide` pattern:
  decision matrix + reference modules + authoritative-link to
  `adb` / `avdmanager` / `gradle` upstream docs. Lines budget: ≤300.

## Phase 3 — Governance cross-cut (out-of-horizon, council-recommended)

- [ ] **P3.1 — `domain-adoption-policy` rule (NEW).** Author rule at
  `.agent-src.uncompressed/rules/` (≤200 lines) gating future domain
  tracks. Required signals: ≥2 consumer projects in domain OR named
  user direction with target; named maintenance owner; CI tooling
  validated or explicitly out-of-scope. Sunset Policy stacks on top.
  Closes the gap that triggered Sonnet's deferral argument on this
  very harvest.

- [ ] **P3.2 — Sunset audit on mobile track.** After Phase 1 has been
  live for one cycle, audit `mobile-e2e-strategy` (target ≤300) and
  `ios-simulator-guide` (target ≤300) for drift. Verify all
  authoritative links resolve. Re-run `task ci`.

- [ ] **P3.3 — Microck mis-categorization re-scan.** The 24 entries
  Microck mis-categorized as "mobile" include several with stronger
  upstream roots (`payload`, `frontend-design`, `monorepo-management`).
  Cross-check against existing roadmaps (`road-to-microck-harvest.md`)
  to confirm none were missed; capture any net-new candidates as a
  separate harvest plate, not folded into mobile.

## Risk register

- **Domain drift:** mobile track may sit unused on most installs.
  Mitigated by Phase-1 minimum surface + Phase-3 governance rule.
- **Volatility:** RN/Expo SDK churn could rot Phase-2 content.
  Mitigated by deferral and authoritative-link Sunset.
- **macOS-only floor:** `ios-simulator-guide` is a platform fact,
  not a portability violation — but document clearly so consumers
  on Linux/Windows know the guideline is reference-only for them.
- **CI cost:** if Android emulator parity lands (P2.3), GitHub
  Actions matrix may need expansion. Out-of-horizon decision.

## Provenance

- Analysis: `agents/analysis/compare-mobile-harvest.md`
- Microck source SHA: `8f5c83174f7aa683b4ddc7433150471983b93131`
- Upstream sources: `aj-geddes/useful-ai-prompts` (flutter, dropped),
  `conorluddy/ios-simulator-skill` (link-only), `jezweb/claude-skills`
  (RN-expo, deferred), `anton-abyzov/specweave` (RN-setup, adopt)
