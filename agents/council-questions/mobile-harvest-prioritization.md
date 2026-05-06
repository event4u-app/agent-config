# Council question — Mobile harvest prioritization

## Context

`event4u/agent-config` is a governed multi-department skill suite (134
skills, 55 rules, ~63 commands) with a project-agnostic floor
(`augment-portability`) and a Sunset Policy (any artifact >400 lines
must externalize bulk to authoritative links). The user (Matze) asked
to deep-scan the **Mobile** category in
`Microck/ordinary-claude-skills` (mirror index of community Claude
skills) and produce one unified roadmap, autonomy on, council to
break ties.

## What "Mobile" actually contains

The `docs/pages/mobile.md` index claims 25 entries, but most are
mis-categorized (api-design-principles, fastapi-templates,
github-actions-templates, monorepo-management, debugging-strategies,
etc. — these are general developer skills tagged "mobile" by mistake
or because they appear in plugins that also ship a mobile component).
After deduping against existing surface and removing
non-mobile-domain entries, **four genuine mobile-platform skills**
remain:

| Skill | Source | Lines | Stars | Volume | Sunset trigger? |
|---|---|---|---|---|---|
| `flutter-development` | aj-geddes/useful-ai-prompts | 316 | 12 | 8 KB · 1 SKILL | clean (<400) |
| `ios-simulator-skill` | conorluddy/ios-simulator-skill (separate repo) | 227 SKILL + 816 SPEC | n/a | 437 KB · 1 SKILL + 5 references + **21 Python scripts (~8500 LOC)** + pyproject.toml | structural — entire surface, not just SKILL.md |
| `react-native-expo` | jezweb/claude-skills | 917 | 58 | 25 KB · 1 SKILL covering RN 0.76-0.82+ / SDK 52+ / New Arch | hard trigger (>2× cap) |
| `react-native-setup` | anton-abyzov/specweave | 216 | 6 | 6 KB · 1 SKILL · contains SpecWeave-coupling lines | clean |

## Existing surface (cross-checked for overlap)

- **No mobile-platform skills today.** Four would establish a brand-new
  domain track.
- Adjacent: `playwright-testing` (web E2E), `e2e-plan` / `e2e-heal`
  (web), `react-shadcn-ui` (web React), `project-analysis-react`
  (web React) — all browser/web-bound.
- No `simctl` / `idb` / `xcodebuild` wrappers, no Dart/Flutter, no
  Expo/Metro tooling, no Android SDK helpers anywhere in the suite.

## Strategic concerns to weigh

1. **Suite identity drift.** Current consumer projects target
   PHP/Laravel + JS/TS web. Mobile is a brand-new domain that will
   sit unused in most installs. Counter-argument: the suite is
   project-agnostic by design and explicitly multi-stack.
2. **Vendor lock-in floor.** `ios-simulator-skill` is macOS+Xcode by
   nature; `react-native-setup` mentions SpecWeave; `react-native-expo`
   pins to specific Expo SDK versions. Portability rule applies to
   `.agent-src/` content, not to the platform a tool runs on — but
   we should be clear which is which.
3. **iOS scripts mass.** 21 Python scripts (~8500 LOC) are the bulk of
   `ios-simulator-skill`. Hosting them in `.agent-src/` would explode
   the package size and require ongoing Black/Ruff alignment.
   Authoritative-link strategy fits better.

## Curated short-list (ICE-scored draft)

ICE = Impact (1–10) · Confidence (1–10) · Ease (1–10), product
threshold: `≥ 200` = Phase 1, `100–199` = Phase 2 backlog, `< 100` =
drop. Impact discounted for cross-project reach (mobile shows up in
~10–15% of typical agent-config consumers).

### Tier S — likely Phase-1 ADOPT

| # | Candidate | Source | I·C·E | Score | Sunset path | Notes |
|---|---|---|---|---|---|---|
| 1 | `react-native-expo` skill (split) | jezweb | 8·8·5 | **320** | Split: ≤300 line core + SHA-linked sections (New Arch / React 19 / Swift template / DevTools) | Most-current of the four, real engineering value; needs aggressive split + portability scrub |
| 2 | `ios-simulator-skill` guideline (authoritative-link) | conorluddy | 8·9·4 | **288** | Authoritative-link only — link to upstream repo SHA + reference the 5 reference modules verbatim, do NOT fork the 21 scripts | Battle-tested, well-architected, but 8500 LOC of Python belongs upstream not here |
| 3 | `react-native-setup` skill (clean) | anton-abyzov | 6·8·8 | **384** | None (216 < 400) | Strip SpecWeave integration block, otherwise clean adopt |

### Tier A — Phase-2 backlog

| # | Candidate | Score | Reason for backlog |
|---|---|---|---|
| 4 | `flutter-development` skill | 240 | Generic Flutter cheatsheet, only 12 stars, content is widget-recipe basics readily available in Flutter docs — defer until consumer demand exists; if adopted later, expect a near-rewrite |

### Tier C — DROP

| Candidate | Reason |
|---|---|
| `angular-migration`, `api-design-principles`, `auth-implementation-patterns`, `bash-defensive-patterns`, `bats-testing-patterns`, `billing-automation`, `command-development`, `command-name`, `configured-agent`, `debugging-strategies`, `deployment-pipeline-design`, `docs-write`, `fastapi-templates`, `frontend-design`, `github-actions-templates`, `hook-development`, `monorepo-management`, `payload`, `react-modernization`, `rule-identifier`, `skill-developer`, `skill-development`, `stripe-integration`, `uv-package-manager` | Mis-categorized as "mobile" by Microck — none are mobile-platform skills. Several already have stronger equivalents in our suite (`api-design`, `command-writing`, `skill-writing`, `github-ci`, `debugging`, `docker`, `composer-packages`). |

## Council ask

1. **Confirm Phase-1 plate of 3** (`react-native-expo` split,
   `ios-simulator-skill` authoritative-link guideline,
   `react-native-setup` clean) or propose Flutter-first ordering.
2. **Sunset path for `ios-simulator-skill`**: confirm
   authoritative-link is correct (link upstream repo SHA, do NOT fork
   the 21 Python scripts), or argue for a thin in-tree wrapper.
3. **`react-native-expo` split shape**: confirm the split axis
   (core ≤300 lines + SHA-linked references for New Arch / React 19 /
   Swift template / DevTools) or recommend a different cut.
4. **Suite-identity check**: is mobile a legitimate new domain track
   given consumer-project mix is heavily backend (PHP/Laravel) +
   web (React/Blade/Livewire)? Adopt now, defer entirely, or
   adopt only the cross-platform-relevant pieces?
5. **DROP verification**: any of the 24 mis-categorized "mobile"
   skills worth pulling forward into a different roadmap (e.g.
   `frontend-design` overlaps with our `fe-design`, `payload` is a
   CMS skill — could either fit a future plate)?

## Constraints

- Hard cap 5 adoptions / 6-week phase (only 3 mobile candidates here,
  budget allows full plate)
- Project-agnostic floor — strip SpecWeave, vendor-specific tool
  references; tool prerequisites (Xcode, Android Studio) are platform
  facts, not portability violations
- Sunset Policy mandatory >400 lines (applies to in-tree content;
  authoritative-link counts as compliance)
- No version-numbers / release-tags in roadmap
- Trackable headings (`## Phase <id>`) + `[ ] / [x]` checkboxes per
  `roadmap-progress-sync`
