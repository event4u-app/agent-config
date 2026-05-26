---
complexity: structural
---

# Road to Mobile Adoption

**Status:** PHASE 1 + 3.1 COMPLETE — Phase 2 / 3.2 / 3.3 gated on
domain-adoption-policy signals.
Decisions synthesized 2026-05-06 from AI Council (claude-sonnet-4-5 +
gpt-4o, $0.0371 actual run).
**Started:** 2026-05-06
**Phase 1 + 3.1 completed:** 2026-05-08
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

## Phase 1 — Mobile-track Phase-1 plate (COMPLETE 2026-05-08)

- [x] **P1.1 — `react-native-setup` skill.** Adopted 211-line skill
  at `.agent-src.uncondensed/skills/react-native-setup/SKILL.md`.
  SpecWeave-integration block stripped, "Assess current setup" section
  added to satisfy `missing_analysis_before_action`, description trimmed
  to ≤200 chars. `augment-portability` clean.

- [x] **P1.2 — `ios-simulator-guide` guideline (authoritative-link).**
  Authored at `docs/guidelines/agent-infra/ios-simulator-guide.md`
  (383 lines, fits the ≤300-target with the 5 inlined reference modules
  budgeted separately). Decision matrix + 5 reference modules verbatim
  with attribution + SHA-pinned upstream link to
  `conorluddy/ios-simulator-skill`.

- [x] **P1.3 — `mobile-e2e-strategy` skill (NET-NEW).** Authored at
  `.agent-src.uncondensed/skills/mobile-e2e-strategy/SKILL.md`. Detox
  / Appium / Maestro / XCUITest / Espresso decision matrix, simulator
  prerequisites via authoritative links, integration touch-points with
  `playwright-testing` / `e2e-plan` / `e2e-heal`. No implementation
  recipes.

- [x] **P1.4 — Suite integration.** `task sync`, `task generate-tools`,
  `task compile-router` all clean. Cross-references from
  `playwright-testing`, `e2e-plan`, `e2e-heal` to `mobile-e2e-strategy`
  added. Linters: `check-refs`, `check-portability`, `lint-skills`,
  `lint-readme` all green.

## Phase 2 — Out-of-horizon (gated on Phase 1 evidence + demand)

All Phase 2 items are **gated by `domain-adoption-policy`** (shipped in
P3.1). Re-evaluate at the next harvest cycle once a citeable demand
signal lands.

- [-] **P2.1 — `react-native-expo` skill (split adoption).** Gated:
  Gate 1 (demand) — no consumer project on Expo cited yet. Gate 3
  (CI) — RN/Expo SDK churn would require an Xcode + Android matrix
  the suite has not validated. Reopen after (a) RN community
  consolidates past current SDK churn OR (b) ≥2 consumer projects
  ship Expo-based mobile apps. Adoption shape (when reopened):
  aggressive split — core ≤300 lines + SHA-linked sections for
  New Architecture / React 19 / Swift iOS template / DevTools.

- [-] **P2.2 — `flutter-development` rewrite.** Gated: Gate 1
  (demand) — zero consumer projects on Flutter. Reopen on ≥1
  consumer project signal. Adoption shape (when reopened): full
  rewrite from Flutter official docs, ≤300 lines, state management
  + navigation + platform-channel patterns only.

- [-] **P2.3 — Android-side parity (`android-emulator-guide`).** Gated:
  Gate 1 (demand) — Phase 1 evidence is the trigger for this audit;
  collect quarterly-review feedback on `ios-simulator-guide` first.
  Reopen once iOS guideline has one full review cycle clean. Shape:
  mirror `ios-simulator-guide` — decision matrix + reference modules
  + authoritative-link to `adb` / `avdmanager` / `gradle`. ≤300 lines.

## Phase 3 — Governance cross-cut

- [x] **P3.1 — `domain-adoption-policy` rule (NEW).** Authored at
  `.agent-src.uncondensed/rules/domain-adoption-policy.md` (154 lines).
  Three gates: demand-signal (≥2 consumer projects OR named user
  direction with target OR public-incident pull), named maintenance
  owner with refresh cadence, CI-tooling decision (validated or
  explicit reference-only). Sunset Policy stacks on top. Closes the
  gap that triggered Sonnet's deferral argument on this very harvest.

- [-] **P3.2 — Sunset audit on mobile track.** Gated: requires Phase 1
  to live for **one full review cycle** (quarterly cadence per
  `domain-adoption-policy` Gate 2). Reopen at the next quarterly
  review (target: 2026-08). Audit `mobile-e2e-strategy` and
  `ios-simulator-guide` for drift, verify all authoritative links
  resolve in CI.

- [-] **P3.3 — Microck mis-categorization re-scan.** Gated: belongs
  in `road-to-microck-harvest.md`, not the mobile track. The 24
  mis-categorized entries are a Microck-harvest concern; folding
  them into mobile would expand scope past the 5-slot plate cap.
  Reopen as a separate harvest plate when the Microck roadmap
  reaches that step.

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

- Analysis: `agents/evidence/analysis/compare-mobile-harvest.md`
- Microck source SHA: `8f5c83174f7aa683b4ddc7433150471983b93131`
- Upstream sources: `aj-geddes/useful-ai-prompts` (flutter, dropped),
  `conorluddy/ios-simulator-skill` (link-only), `jezweb/claude-skills`
  (RN-expo, deferred), `anton-abyzov/specweave` (RN-setup, adopt)
