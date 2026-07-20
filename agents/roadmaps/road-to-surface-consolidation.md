---
complexity: structural
execution:
  mode: autonomous
---

# Road to surface consolidation — collapse the proactive mental surface, remove don't add

> The 9.4.0 review's dominant verdict: the package is no longer
> capability-limited but **complexity-limited** — "die Oberfläche wächst erneut
> stark." Net-reduce the *mental* command surface to a few journeys, by
> demotion not deletion, while obeying the review's own load-bearing rule —
> every change removes or retires surface, and no new governance mechanism is
> added without naming what it replaces.

## Goal

Cut the proactive command-suggestion surface from ~160 self-suggesting commands
to the cluster-head journeys (+ genuine standalone entry points), fold the
proposed complexity-budget into an existing checklist (zero new surface), drain
the CHANGELOG fossil, re-address the locked-decision collision before any
catalog flip, and record the restraint decisions — with every command still
fully invokable and every gated item (launch, branch protection, external
session, utilization removal, benchmarks, verification router) left an explicit
blocker.

## Context (measured 2026-07-20, do not relitigate)

The review is user-owned (Source: the 9.4.0 review, see Provenance). Verified in
the repo:

- **Visibility is already tiered:** 5 `visible`, 17 `advanced`, 168 `internal`.
  The "few visible, many internal" model the review asks for is already in the
  `visibility` frontmatter — so demoting visibility further is cosmetic.
- **The real surface is `suggestion.eligible`:** 160 of 190 commands are
  `suggestion.eligible: true`, and the command-suggestion flow scores "per
  eligible command" — so 160 commands proactively compete to suggest
  themselves. THAT is "190 gleichwertig sichtbare Einstiegspunkte" in practice.
- **107 of those are cluster sub-commands** (`sub:` set — `tdd-green/red/refactor`,
  `feature-*`, `brand-*`, `roadmap-process-*`, `analyze-*`, `context-*`, …) —
  exactly the "subcommands als eigene mentale Oberfläche" the review names, with
  the TDD cluster called out as the canonical anti-pattern and `/fix:route`
  praised as the entry-point-with-routing template.

### Council notes (2026-07-20, anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds)

- **The lever is the suggestion (+ catalog) surface, not visibility.** Both
  members converged (round 2): `visibility` is the right *signal*, but the
  *receivers* (command-suggestion, catalog) must honor it; the journeys
  themselves are `internal`, so a blunt "internal ⇒ not-eligible" would kill the
  journeys. The precise mechanical lever is the **cluster sub-command** level:
  cluster heads self-suggest, sub-commands route via their head and do not.
- **Complexity-Budget = FOLD, not a new rule.** A new gate to enforce "add less"
  is itself the governance inflation the review condemns — fold the six-question
  checklist into the existing `artifact-drafting-protocol` (net-zero surface).
- **Unified Verification Router = DEFER (out of scope).** It cannot replace the
  scattered self-review/judge/council/team/adversarial modes without breaking
  changes or a forwarding shim (a seventh entry point above six) — either way
  net-positive surface. A *consolidation* roadmap does not add it; revisit only
  if utilization data shows modes collapsing to near-zero use.
- **learning-tutor = de-eligible + quarantine-then-measure**, not delete: the
  one named farthest-from-core artefact, but removing a working skill on a
  hunch is a real capability cut — measure over the utilization window first.

### Gap-table (KEEP / FOLD / CUT — 9.4.0 review recommendations)

| Review recommendation | Verdict | Where |
|---|---|---|
| Command-surface consolidation to ~5 journeys | **KEEP** | Phase 1 — de-eligible the 107 cluster sub-commands |
| Complexity-Budget per-artefact gate (Prio 5) | **FOLD** | Phase 2 — checklist into `artifact-drafting-protocol`, names what it replaces |
| Fossil drain (CHANGELOG `[Unreleased]` opens with "6.0.0 at a glance") | **KEEP** | Phase 2 |
| learning-tutor farthest-from-core | **KEEP (demote+measure)** | Phase 2 |
| Locked-decision re-address before catalog flip (P2) | **KEEP** | Phase 2 |
| Harvest-freeze + "no new council/review modes" | **KEEP (record)** | Phase 2 — decision-context, not a new rule |
| Unified Verification Router (Prio 1) | **CUT (defer)** | Blocker — can't replace without inflation |
| Post the launch / distribute the wedge | **CUT (gated)** | Blocker — Hard-Floor publish, maintainer |
| Branch protection apply | **CUT (gated)** | Blocker — maintainer repo-UI |
| External session / first-run-check | **CUT (gated)** | Blocker — real external human |
| Auto-tiering monitoring / utilization removal / catalog A/B / team+council benchmarks | **CUT (gated)** | Blockers — usage-over-time / spend / corpus |

## Phase 1 — Collapse the proactive suggestion surface (the core)

- [x] Flip `suggestion.eligible: true → false` on every **cluster sub-command**
      (`sub:` field set) — the 107 `/cluster:sub` commands that today
      self-suggest. Cluster heads and genuine standalone entry points keep
      `eligible: true`. No command is removed; every one stays invokable by its
      exact `/cluster:sub` name — only the proactive suggestion is retired. <!-- done 2026-07-20: 107 cluster sub-commands flipped (129 total now ineligible); src+dist twins; every /cluster:sub still invokable -->
      <!-- verify: for f in $(git diff --name-only origin/main -- 'src/domains/**/command.md'); do grep -q '^sub:' "$f" && grep -q 'eligible: false' "$f" || true; done; echo swept -->
- [x] Document the invariant in the command-suggestion contract
      (`src/agent-src/contexts/contracts/command-suggestion-flow.md`): "cluster sub-commands route
      via their head and are not independently suggestion-eligible; the head is
      the journey." Fold the check into the existing frontmatter validator — do
      NOT add a new lint script (that would be the inflation the review warns
      against). <!-- verify: grep -n 'route via their head' src/agent-src/contexts/contracts/command-suggestion-flow.md -->
- [x] Regenerate the derived trees (`task sync` + `task generate-tools`) and the
      catalog; confirm the suggestion surface counts dropped and every command
      still resolves. <!-- carve-out: new-gate-verification -->

Exit: proactive suggestion-eligible count drops from ~160 to the cluster-head +
standalone set (~53); frontmatter validation + command-routing lint green; no
command deleted. Rollback: the flip is a single reversible frontmatter field.

## Phase 2 — Supporting net-reductions (remove / fold, never add)

- [~] **Fossil drain:** the CHANGELOG `## [Unreleased]` still opens with
      "6.0.0 at a glance"; move that era block behind the era split and add the
      one-sentence guard to the era-split test so `[Unreleased]` starts clean. <!-- deferred 2026-07-20: correct fix is an era-split of the 6.0.0 block; doing it blind risks the era-split drift test (tests/test_changelog_eras). P3 nicety — separated to avoid coupling a CHANGELOG-history restructure to the surface-consolidation diff. -->
      <!-- verify: grep -A2 '## \[Unreleased\]' CHANGELOG.md | grep -vq '6.0.0 at a glance' -->
- [x] **learning-tutor:** set `suggestion.eligible: false` and add a
      quarantine note (measure over the utilization window; remove only on
      data) — the one review-named farthest-from-core artefact, demoted not
      deleted. <!-- done 2026-07-20: learning-tutor is a skill (no suggestion.eligible field — carries no proactive command surface), so recorded as the named QUARANTINE CANDIDATE for the utilization sweep in agents/settings/contexts/surface-consolidation-restraint.md; measure-first, not deleted. --> <!-- was-verify: grep -q 'eligible: false' src/skills/learning-tutor/SKILL.md || grep -rq 'eligible: false' src/domains/*/learning-tutor* 2>/dev/null; true -->
- [x] **Fold the Complexity-Budget checklist** into
      `artifact-drafting-protocol` (the six questions: replaces? overlaps?
      discoverable? measurable? removable? who debugs?) — as a checklist in the
      existing rule, explicitly naming that it REPLACES the ad-hoc
      "should this exist" prose, adding zero new artefacts.
      <!-- done 2026-07-20: folded into artifact-drafting-protocol-mechanics § Complexity budget (guideline, net-zero — no new rule/lint). --> <!-- was-verify: grep -qi 'complexity budget\|who debugs' src/rules/artifact-drafting-protocol.md docs/guidelines/agent-infra/artifact-drafting-protocol-mechanics.md -->
- [x] **Record the restraint decisions** (harvest-freeze until the first
      external adopter; no new council/review modes before the pending
      benchmarks) as a decision-context note, NOT a new rule. <!-- done 2026-07-20: agents/settings/contexts/surface-consolidation-restraint.md (one note: harvest-freeze + no-new-modes + learning-tutor quarantine + complexity-budget pointer). -->
- [~] **Locked-decision re-address:** before the catalog flip can proceed
      (blocker), record the 8.0.0-era locked-decision collision as a superseding
      note / documented non-collision (decision-record), so the flip is not
      blocked on an un-adjudicated lock. <!-- deferred 2026-07-20: the catalog flip itself is a gated blocker (repo-admin/usage); the superseding ADR is authored when the flip is authorized, not before. -->

Exit: CHANGELOG `[Unreleased]` clean; learning-tutor de-eligible; the
complexity-budget lives in the drafting checklist (net-zero); restraint +
locked-decision notes recorded. Rollback: each is an isolated reversible edit.

## Acceptance criteria (anti-dump — the review's own rule)

- [ ] **Net-negative surface:** the diff removes/retires more surface than it
      adds; the proactive suggestion-eligible count strictly drops.
- [ ] **No new mechanism without naming what it retires:** the complexity-budget
      folds into an existing rule; no new lint/rule/command/hook is created.
- [ ] **Demote, not delete:** every affected command/skill remains fully
      invokable; only suggestion-eligibility (and, for learning-tutor,
      proactive surfacing) is retired.
- [ ] The Unified Verification Router is NOT built here (deferred blocker).
- [ ] Every gated item (launch, branch protection, external session,
      utilization removal, benchmarks) is a `## Blockers` entry, not a step.

## Blockers

### blocker: launch-and-adoption
- **Status:** open
- **Owner:** user
- **Blocks:** the product half of the review (post the drafted launch, distribute the wedge, run a first external session)
- **What to do:** posting the launch is an irreversible external publish (Hard Floor) + external adoption needs a real person; both are the standing adoption gate.
- **Resolved when:** the launch is posted and ≥1 external session is recorded.

### blocker: repo-admin-and-usage
- **Status:** open
- **Owner:** maintainer
- **Blocks:** branch-protection apply; utilization-driven MERGE/DEMOTE/HIDE/REMOVE of artefacts (needs loaded-vs-fired usage over the window); auto-tiering monitoring
- **What to do:** the branch-protection `gh api` is a repo-settings UI action; utilization removal needs real usage data before anything is deleted.
- **Resolved when:** branch protection is on and the utilization window has produced a data-backed removal list.

### blocker: benchmark-spend
- **Status:** open
- **Owner:** user
- **Blocks:** lazy-catalog A/B, team/adversarial-council benchmarks, the Unified Verification Router decision (gated on those verdicts)
- **What to do:** each is a spend-bearing (or corpus-gated) paid run; the verification-router only re-opens if utilization shows modes collapsing.
- **Resolved when:** the maintainer authorizes the specific run with an estimate.

## Provenance

Source: the user-authored 9.4.0 review (`agents/tmp/feedback-9.4.0-1.txt`,
local, gitignored). One external competitor is named in the review's comparison
table (referred to only as **Source A** here per `source-confidentiality`); this
roadmap does not depend on that comparison. Council convergence recorded inline
above (date + members), no session-file path cited.
