# Mobile Harvest — Comparison & Adoption Analysis

**Source:** `Microck/ordinary-claude-skills` mirror at SHA
`8f5c83174f7aa683b4ddc7433150471983b93131`, `docs/pages/mobile.md` index.
**Scope:** Genuine mobile-platform skills only — 24 of the 25 entries
in the Microck "mobile" page were mis-categorized (general developer
skills tagged mobile by mistake) and are dropped without further
review.

## In-scope candidates

| Skill | Upstream | Lines | Stars | Surface |
|---|---|---|---|---|
| `flutter-development` | aj-geddes/useful-ai-prompts | 316 | 12 | 1 SKILL.md (8 KB) |
| `ios-simulator-skill` | conorluddy/ios-simulator-skill | 227 SKILL + 816 SPEC | n/a | 1 SKILL + 5 reference modules + **21 Python scripts (~8500 LOC)** + pyproject.toml |
| `react-native-expo` | jezweb/claude-skills | 917 | 58 | 1 SKILL.md (25 KB) covering RN 0.76-0.82+ / SDK 52+ |
| `react-native-setup` | anton-abyzov/specweave | 216 | 6 | 1 SKILL.md (6 KB) — contains SpecWeave coupling |

## Existing surface — overlap check

No mobile-platform skills exist today (134 skills, 0 hits on
`mobile|ios|android|flutter|react-native|expo|swift|kotlin`). Adjacent
skills are web-bound only:

- `playwright-testing`, `e2e-plan`, `e2e-heal` — browser E2E
- `react-shadcn-ui`, `project-analysis-react` — web React
- `blade-ui`, `flux`, `livewire` — Laravel-bound web

Mobile would establish a brand-new domain track. Suite identity is
governed multi-department (Wings 1–4), explicitly multi-stack via
`augment-portability`. New domain is structurally allowed; the
question is demand-validation.

## Council synthesis (Sonnet · GPT-4o, 1 round, $0.0371 actual)

| Question | Sonnet | GPT-4o | Resolution |
|---|---|---|---|
| Adopt mobile track? | DEFER until ≥2 consumer projects ship mobile | PROCEED with Tier-S plate | User-direction wins ("interesting, take all useful") — but Sonnet's tactical refinements applied |
| `react-native-expo` (917 lines) | SKIP — RN rotates every 6-12 mo, will rot | ADOPT with split | **Sonnet wins** — defer to Phase 2, content too volatile for Phase 1 |
| `ios-simulator-skill` Sunset path | Authoritative-link only — do NOT fork 8500 LOC of Python | Authoritative-link | **Both agree** — link-only |
| `flutter-development` | DROP entirely (10 stars, generic) | Backlog | **Both agree** — DROP |
| Governance gap | Propose `domain-adoption-policy` rule for future tracks | (not addressed) | **Adopt as Phase-3 cross-cut** |
| Bridge to existing E2E | Create `mobile-e2e-strategy` meta-skill | (not addressed) | **Adopt as Phase-1 net-new** |

## Tier S — Phase-1 ADOPT (3 items, 2 harvest + 1 net-new)

| # | Adoption | Source | I·C·E | Score | Sunset path | Effort |
|---|---|---|---|---|---|---|
| 1 | `react-native-setup` skill | anton-abyzov | 6·8·8 | **384** | None (216<400) — strip SpecWeave block | 0.5 d |
| 2 | `ios-simulator-guide` guideline | conorluddy | 8·9·5 | **360** | Authoritative-link only — link upstream SHA + the 5 reference modules verbatim, NO script forking | 1.0 d |
| 3 | `mobile-e2e-strategy` skill (net-new) | synthesized from Sonnet recommendation | 7·7·8 | **392** | None (target ≤300 lines) — Detox/Appium/Maestro selection + iOS Sim/Android Emu prereqs (authoritative links) + integration with existing `playwright-testing` | 1.0 d |

**Phase-1 total effort:** ~2.5 d. 3 of 5 plate slots used.

## Tier A — Phase-2 backlog (deferred to next plate)

| # | Candidate | Score | Reason for backlog |
|---|---|---|---|
| 4 | `react-native-expo` skill (split) | 320 | 917-line skill with SDK 52+ pinning — Sonnet's rot-risk argument: RN moves every 6-12 mo. Defer until RN community consolidates around a stable surface; reevaluate after 2 quarters |
| 5 | `flutter-development` skill (rewrite) | 240 | Generic widget cheatsheet, 12 stars. If adopted later, expect a full rewrite — current content adds little over Flutter docs. Defer indefinitely; reopen on consumer demand signal |

## Tier C — DROP (24 mis-categorized + governance)

The Microck `mobile.md` index lumps 24 entries that are not
mobile-platform skills: `angular-migration`, `api-design-principles`,
`auth-implementation-patterns`, `bash-defensive-patterns`,
`bats-testing-patterns`, `billing-automation`, `command-development`,
`command-name`, `configured-agent`, `debugging-strategies`,
`deployment-pipeline-design`, `docs-write`, `fastapi-templates`,
`frontend-design`, `github-actions-templates`, `hook-development`,
`monorepo-management`, `payload`, `react-modernization`,
`rule-identifier`, `skill-developer`, `skill-development`,
`stripe-integration`, `uv-package-manager`. Several already have
stronger equivalents in our suite (`api-design`, `command-writing`,
`skill-writing`, `github-ci`, `docker`, `composer-packages`). None
adopted from this harvest.

## Phase-3 governance cross-cut (Sonnet recommendation)

Author `domain-adoption-policy` rule (≤200 lines) gating future
domain tracks (mobile, ML, blockchain, scientific computing, etc.):

- Demand signal: ≥2 consumer projects actively using domain OR
  user-stated direction with named target
- Maintenance rotation: named owner per domain
- CI floor: tooling validated in `task ci` or documented as
  out-of-scope
- Sunset Policy still applies on top

Closes the open governance gap surfaced by this harvest decision.

## Integration & CI

`mobile-e2e-strategy` references existing `playwright-testing`
without restating its content. `ios-simulator-guide` is a guideline
(reference material), not a skill — sits in `docs/guidelines/`,
linked from `playwright-testing` and `e2e-plan` only when mobile
context is active. `react-native-setup` cross-references
`mobile-e2e-strategy` for E2E framework selection.

## Decisions locked

1. Phase 1 = 3 adoptions (well under hard cap of 5) — conservative
   first toe in mobile, validates demand before expanding.
2. `react-native-expo` deferred — Sonnet's volatility argument
   accepted; 917-line New-Architecture-pinned skill is the worst-case
   Sunset trigger this suite would ever take on.
3. iOS scripts NEVER forked — 8500 LOC of Python belongs upstream.
   Guideline format with authoritative-link is the only path.
4. Net-new `mobile-e2e-strategy` skill bridges existing E2E surface
   to mobile — addresses Sonnet's "real gap" point.
5. `domain-adoption-policy` rule (Phase 3) closes the governance gap
   that triggered Sonnet's deferral argument in the first place.
