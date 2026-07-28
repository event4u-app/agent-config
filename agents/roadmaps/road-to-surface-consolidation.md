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

- [x] **Fossil drain:** the CHANGELOG `## [Unreleased]` still opens with
      "6.0.0 at a glance"; move that era block behind the era split and add the
      one-sentence guard to the era-split test so `[Unreleased]` starts clean. <!-- deferred 2026-07-20: correct fix is an era-split of the 6.0.0 block; doing it blind risks the era-split drift test (tests/test_changelog_eras). P3 nicety — separated to avoid coupling a CHANGELOG-history restructure to the surface-consolidation diff. -->
      <!-- done — resolved 2026-07-28 by verification, not by new work: the
      deferral was STALE. Both halves already shipped under
      `road-to-changelog-unreleased-drain` on 2026-07-21.
      (a) The block was moved to `docs/archive/CHANGELOG-6.0.0-overview.md`,
      with a pointer note left at CHANGELOG.md:118; `## [Unreleased]` now opens
      on `### Added`, and this step's own verify command passes.
      (b) The guard exists as `test_unreleased_carries_no_at_a_glance_fossil`
      in `tests/lib/changelog_eras.test.ts:113` — it asserts the region between
      `## [Unreleased]` and the first `# Era:` header carries no
      `### N.Y.Z at a glance` block, so the fossil class cannot recur.
      17/17 green this run. Note the CHANGELOG header still points at the
      pre-py2ts path `tests/test_changelog_eras.py`; the live test is the `.ts`
      file above (corrected in this run). -->
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

## Phase 3 — Utilization-window disposition sweep (re-homed 2026-07-28)

> Re-homed verbatim from `road-to-feedback-9.8.0-followups.md` Phase 4 at its
> archive time (council 2026-07-28, 2-round debate, anthropic/claude-sonnet-4-5
> + openai/gpt-4o, unanimous) — that step's own text says it "extends
> road-to-surface-consolidation.md, not forking it", so the one active roadmap
> carries it. Time-gated: the pre-registered window elapses ~2026-08-26; its
> verify forbids pre-window deletions. Gate tracked by the existing
> `repo-admin-and-usage` blocker below.

- [ ] **Utilization-window disposition (after ~2026-08-26).** When the
      pre-registered window elapses, run the KEEP / MERGE / DEMOTE / REMOVE
      sweep on commands + skills with the window's data; target the reviewers'
      190 → <150 commands direction by folding variants into cluster-head modes
      and deleting de-eligibled, unused commands.
      *Verify:* post-window decision log exists; command count and the per-item
      decisions recorded; no pre-window deletions.

## Acceptance criteria (anti-dump — the review's own rule)

- [x] **Net-negative surface:** the diff removes/retires more surface than it
      adds; the proactive suggestion-eligible count strictly drops.
      <!-- verified 2026-07-28 by counting frontmatter across all 191
      `src/domains/**/command.md`: `suggestion.eligible: true` = **53**, false =
      138, absent = 0. Baseline in § Context was 160 eligible of 190, so the
      proactive surface dropped 160 → 53 (-67%), landing exactly on the Phase-1
      exit target of ~53. The Phase-1 invariant is total, not partial: of 130
      cluster sub-commands (`sub:` set), **0 remain eligible**; the 53 eligible
      are all heads/standalone entry points (61 of those exist, 8 are
      additionally ineligible). Nothing was added to offset the reduction — the
      complexity budget went into an existing guideline and the restraint
      decisions into a context note, both net-zero. -->
- [x] **No new mechanism without naming what it retires:** the complexity-budget
      folds into an existing rule; no new lint/rule/command/hook is created.
      <!-- verified 2026-07-28: the complexity-budget checklist lives in the
      EXISTING `docs/guidelines/agent-infra/artifact-drafting-protocol-mechanics.md`
      (§ Complexity budget), and the restraint decisions in the EXISTING context
      dir as `agents/settings/contexts/surface-consolidation-restraint.md` — a
      note, not a rule. No new lint script, rule file, command, or hook is
      attributable to this roadmap.
      STATED RATHER THAN GLOSSED: a `git log --diff-filter=A` sweep over
      `src/rules/`, `src/scripts/lint_*` and `src/scripts/hooks/` in the
      Phase-1/2 window returns exactly one added rule, `src/rules/secret-vcs-guard.md`.
      That belongs to the secret-hygiene guardrail roadmap (rule-first + CI net,
      commit-hook cut), not to this one — the window overlaps, the authorship
      does not. -->
- [x] **Demote, not delete:** every affected command/skill remains fully
      invokable; only suggestion-eligibility (and, for learning-tutor,
      proactive surfacing) is retired.
      <!-- verified 2026-07-28 two ways. (1) Nothing was deleted: 191 source
      `command.md` files and 191 command artefacts in
      `dist/discovery/discovery-manifest.json` — the § Context baseline was 190,
      so the count GREW by one over the window. (2) Invokability spot-checked on
      five de-eligibled cluster sub-commands across five different clusters —
      `tdd-green`, `feature-plan`, `roadmap-process-step`, `brand-tokens`,
      `analyze-decision`: `./agent-config commands explain <slug>` resolves for
      all five. Note the eligibility flag is frontmatter-only and is NOT carried
      in the discovery manifest, so it cannot affect resolution by construction —
      the CLI check is the real evidence, a manifest field check would have been
      vacuous. -->
- [x] The Unified Verification Router is NOT built here (deferred blocker).
      <!-- verified 2026-07-28: a case-insensitive sweep for
      "unified verification router" across `src/` and `docs/contracts/` returns
      no implementation — only the defer/CUT records in this roadmap's gap-table
      and council notes, plus the `benchmark-spend` blocker that gates its
      re-opening. No seventh entry point, no forwarding shim. -->
- [x] Every gated item (launch, branch protection, external session,
      utilization removal, benchmarks) is a `## Blockers` entry, not a step.
      <!-- verified 2026-07-28 — all five map onto the three blockers below:
      launch → `launch-and-adoption`; external session → `launch-and-adoption`;
      branch protection → `repo-admin-and-usage`; utilization removal →
      `repo-admin-and-usage`; benchmarks → `benchmark-spend` (which also gates
      the verification-router re-open).
      ONE NUANCE, recorded rather than smoothed over: Phase 3 IS a step, and its
      subject is utilization-driven disposition. It was re-homed here verbatim
      on 2026-07-28 from an archiving sibling roadmap, and its own header ties
      it to `repo-admin-and-usage`. So the gated WORK is tracked by a blocker as
      this criterion requires; it additionally carries a step so the re-homed
      item stays visible on the dashboard instead of vanishing into a blocker.
      Live check of that gate: branch protection is confirmed OFF
      (`gh api .../branches/main/protection` → 404) and the utilization window
      does not elapse until ~2026-08-26, so the step is correctly still open. -->

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

Source: the user-authored 9.4.0 review (`agents/tmp.old/feedback-9.4.0-1.txt`,
local, gitignored). One external competitor is named in the review's comparison
table (referred to only as **Source A** here per `source-confidentiality`); this
roadmap does not depend on that comparison. Council convergence recorded inline
above (date + members), no session-file path cited.
