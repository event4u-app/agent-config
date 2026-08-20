---
complexity: structural
status: later
execution:
  mode: autonomous
---

# Road to surface consolidation — collapse the proactive mental surface, remove don't add

> **Parked 2026-08-19. Resume when BOTH hold** — the condition is conjunctive on
> purpose, and the council corrected an earlier single-clause version of it:
> (a) the pre-registered utilization window has elapsed (~2026-08-26), and
> (b) enough loaded-versus-fired usage data has accumulated to actually run the
> KEEP / MERGE / DEMOTE / REMOVE sweep. The date alone is necessary and not
> sufficient — a window that elapsed with no usage evidence behind it would let
> the sweep delete on a guess, which its own verify clause forbids.
>
> One open step remains (Phase 3's disposition sweep) against 12 done and 1
> deferred. It is covered by `repo-admin-and-usage`, Class 3, whose `Blocks:`
> field names that sweep directly.
>
> Parked rather than left active on the repository's own active-vs-later test:
> every open item is gated outside this roadmap, and `/roadmap:process-full`
> terminates on it at `blocked-preflight` with zero runnable open steps. Both
> blockers are preserved unresolved and still counted; parking claims no
> reduction. AI council 2026-08-19, 2/2 convergent (anthropic/claude-sonnet-4-5 +
> openai/codex-default, two rounds, blind peer review).
>
> **ADR-237 note, added 2026-08-20 — one leg of this justification is gone.** The
> `blocked-preflight` termination cited above no longer exists: ADR-237 supersedes
> ADR-235, makes `/roadmap:process-full` an end-to-end delegation, and reclassifies
> repository-local prerequisites (a branch, a push, a PR, a settings flip, a CI
> re-run, a failing test, a paid call under USD 25) as remediation work rather than
> blockers. So the command no longer refuses to start here and no longer "agrees
> independently" with the park.
>
> **The park is NOT reversed by this note, and the reason is scope, not conviction.**
> The other leg — every open item genuinely gated outside this roadmap — is the one
> that has to be re-tested under the new capability screen
> (`roadmap-process-loop` § 3c: *can the agent execute this at all?*), and that is a
> per-item judgement this note does not make. What is recorded here is that the
> justification is now **partly stale** and the roadmap is a candidate for
> re-activation, not that it stays parked on the old grounds.

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
      benchmarks) as a decision-context note, NOT a new rule. <!-- done 2026-07-20: agents/settings/contexts/surface-consolidation-restraint.md (one note: harvest-freeze + no-new-modes + learning-tutor quarantine + complexity-budget pointer). --> <!-- superseded 2026-08-05: ADR-216 struck the "until the first external adopter" anchoring on BOTH recorded restraints — the freeze is capacity-anchored and now lifted; the no-new-modes restraint waits on the pending benchmarks only. The step stays [x] because the note WAS written as specified; its content was later corrected. -->
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

### Input evidence — the no-invocation-path enumeration (2026-08-02, NULL)

Fed in from `road-to-renewal-leverage.md` Phase 1, whose step reads: *"Feed
the ~1,900-line no-invocation-path finding (analysis estimate — enumerate
first: file list + method) as input evidence into
`road-to-surface-consolidation.md` Phase 3."* The enumeration was run; the
estimate **does not reproduce**. Recorded here so the post-window sweep does
not budget for a 1,900-line deletion that has no target.

**Method** (reproducible; three reference forms, checked in order):

```bash
# for each src/domains/**/command.md, resolve slug = <cluster>:<sub> (else <name>)
# a command has a DISCOVERY path if any of:
#   1. suggestion.eligible: true                    -> proactively suggested
#   2. its `name` appears in some hub's routes_to:  -> reached via the cluster head
#   3. any of these strings occurs in src/, docs/, README.md, CONTRIBUTING.md
#      OUTSIDE its own file:
#         /<cluster>:<sub>        (canonical invocation slug)
#         /<cluster> <sub>        (space form used by most hub bodies)
#         commands/<cluster>/<sub>.md   (relative link form)
#         /<name>                 (flat form)
# a command with none of the three, and visibility: internal, has no discovery path.
```

**Result** over 193 command files:

| Class | Count |
|---|---|
| `suggestion.eligible: true` | 53 |
| Reached via a hub `routes_to:` | 65 |
| Named in a stable surface (one of the three forms) | 73 |
| **No discovery path** | **2** (449 lines) |

The two residuals are `src/domains/git/commit/in-chunks/command.md` and
`src/domains/git/pr/create/description-only/command.md`. Both are **reachable
under their `replaces:` aliases** (`commit:in-chunks`,
`create-pr:description-only`), which are the forms actually cited across
`src/` — so the true no-invocation-path count is **0 commands / 0 lines**, not
~1,900. The residual defect is an *alias*, not an orphan: the canonical
`<cluster>:<sub>` slug of those two appears nowhere.

**By-product finding — sub-command drift the cluster checker cannot see.**
While enumerating, a second and load-bearing defect surfaced: hubs and the
locked cluster contract disagree with what is actually on disk.

- `/roadmap` has 6 sub-commands on disk; its `## Sub-commands` table lists 5
  (`materialize` is in neither the table nor the contract).
- `/memory` has 6 on disk; its table lists 5 (`learn-low-impact` is missing
  from the hub although the contract registers it).
- `routes_to:` is systematically incomplete — 12 of 25 contract-listed
  dispatch clusters omit at least one existing sub-command, and several
  orchestrators carry no `routes_to` at all.
- Contract-side, the inverse also exists: rows for sub-commands that have no
  file, and orchestrators with no contract row.

**Correction (2026-08-17) — the two named examples have been repaired since,
and the by-product finding must not be budgeted as if they had not.** Both
bullets are now false: `/roadmap` has **7** sub-commands on disk and its
`## Sub-commands` table lists **7**, `materialize` included; `/memory` has **6**
on disk and its table lists **6**, `learn-low-impact` included. They are left
above with this note rather than rewritten, so the finding stays auditable —
but the post-window sweep this block feeds would otherwise budget for two fixes
that no longer exist. **Scope of this correction, stated because it bounds
what it proves:** only the first two bullets were re-measured. The `routes_to:`
bullet (12 of 25) and the contract-side inverse were **not** re-checked and are
neither confirmed nor refuted here.

`check_cluster_patterns` cannot catch this class: it iterates the **contract**,
never the filesystem, checks `routes_to` for *resolvability* but never
*completeness*, and matches only the `## Sub-commands` table **header**, never
its rows. Its contract row regex additionally requires a numeric phase column,
so clusters whose row carries `—` fall outside the gate entirely. The
filesystem-enumeration half is closed in `road-to-renewal-leverage.md`; the
**contract-side** half (rows with no file, orchestrators with no row, and the
numeric-phase-column narrowing) is left here as input for the sweep, because
resolving it means deciding per cluster whether an unlisted hub is dead or
intentional — a disposition call, which is what this phase owns.

Not drift, checked and dismissed: hubs mixing `` `/worktree create` `` with
`` `/analyze:decision` `` is **style, not defect** — `docs/contracts/command-clusters.md:157`
makes `/<cluster> <sub>` a first-class equivalent of the colon form.

No parking action is taken here and no command is deleted — per this phase's
own verify, pre-window deletions are forbidden.

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
- **Status:** resolved
- **Owner:** user
- **Blocks:** the product half of the review (post the drafted launch, distribute the wedge, run a first external session)
- **What to do:** RESOLVED AS OUT OF SCOPE, 2026-08-05, per [`ADR-216`](../../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md). Owner decision: external adoption is not a project goal, so posting a launch and running an external session are not work this project will do. The blocker is kept rather than deleted so the disposition is visible in history — it was never going to resolve, and leaving it open would have read as pending.
- **Resolved when:** resolved by the ADR-216 scope decision. The adoption-facing half of this review is closed as out of scope, not as done.

### blocker: repo-admin-and-usage
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** branch-protection apply; utilization-driven MERGE/DEMOTE/HIDE/REMOVE of artefacts (needs loaded-vs-fired usage over the window); auto-tiering monitoring
- **What to do:** the branch-protection `gh api` is a repo-settings UI action; utilization removal needs real usage data before anything is deleted. The two halves share nothing but this entry, so decide them separately: (a) apply branch protection now — it has no data dependency; (b) hold the utilization-driven MERGE/DEMOTE/HIDE/REMOVE list until a loaded-vs-fired window exists; (c) split this blocker in two so the second half stops holding the first.
- **Recommendation:** (a) plus (b) — apply protection now and keep the removals waiting. Protection is a settings action whose cost is one visit to repo settings, while every removal is irreversible against artefacts nobody has usage data for, and this package's own discipline is that a deletion needs a data-backed list rather than a plausible one. (c) is worth doing at the same time, since one entry blocking two unrelated things is why the cheap half has waited on the expensive one.
- **If you do nothing:** the required-check set stays advisory — a check can go red on the trunk without refusing the merge, which is exactly the state branch protection exists to end — and the artefact surface keeps growing with no removal ever justified, which is the condition this roadmap was opened to close.
- **Resolved when:** branch protection is on and the utilization window has produced a data-backed removal list.

### blocker: benchmark-spend
- **Status:** open
- **Owner:** user
- **Class:** 2 — consent-once (authorise the A/B with an estimate)
- **History note, 2026-08-17 — the cap works now; it did not when the two
  statements below were written.** They claim that
  `task bench:ab:live -- --budget <N>` "caps per-task spend" and that this option
  has "a spend cap already in the tree". Both were **false when authored**:
  `taskfiles/bench-ab.yml` invoked the runner without `{{.CLI_ARGS}}`, so the
  trailing flag never reached it and the run took the parser default of `2.0`
  instead of `<N>`. **Fixed and merged the same day (PR #1406), so the statements
  below are now accurate and (a) may be authorised on their strength.** Kept as a
  note rather than deleted because this entry was promoted from the absent-field
  default to `Class: 2` on that same day, which made it renderable as a consent
  gate for the first time — for a few hours it presented a wrong money claim more
  prominently than before, which is worth a reader knowing (R2 finding 2). The
  prose below is left as authored: correcting another roadmap's recommendation is
  its owner's call, not this pass's.
- **Blocks:** lazy-catalog A/B, team/adversarial-council benchmarks, the Unified Verification Router decision (gated on those verdicts)
- **What to do:** each is a spend-bearing (or corpus-gated) paid run, authorized per run and never as a bundle. The options: (a) authorize the lazy-catalog A/B — `task bench:ab:live -- --budget <N>`, which caps per-task spend and resumes rather than re-spends when restarted with the same flags; (b) authorize the team / adversarial-council benchmarks, which have no task wired today and need their runner named before an estimate exists; (c) authorize none and mark the Unified Verification Router decision cancelled rather than parked, since it is gated on verdicts (a) and (b) would produce.
- **Recommendation:** (a) alone, if anything. It is the only one of the three with a runner and a spend cap already in the tree, so it is the only one that can be authorized against a real estimate rather than a guess; (b) needs a runner named first, and until either verdict exists (c) is a decision about a question nobody has asked recently.
- **If you do nothing:** nothing degrades and nothing is at risk — which is precisely why this has not moved. The cost is that the Unified Verification Router decision stays parked indefinitely while reading as pending, so the roadmap cannot close and a reader cannot tell a deferred decision from a forgotten one.
- **Resolved when:** the maintainer authorizes the specific run with an estimate, or records (c).

## Provenance

Source: the user-authored 9.4.0 review (`agents/tmp.old/feedback-9.4.0-1.txt`,
local, gitignored). One external competitor is named in the review's comparison
table (referred to only as **Source A** here per `source-confidentiality`); this
roadmap does not depend on that comparison. Council convergence recorded inline
above (date + members), no session-file path cited.
