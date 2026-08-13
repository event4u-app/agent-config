---
complexity: lightweight
---

# Road to local-only gate reds — four red gates nobody sees

**Goal.** Clear the four gates that are red on `main` today, and answer the
question the four of them raise together: `task ci` runs gates the GitHub
workflows never run, so a gate can be red on the trunk indefinitely while every
PR reports green.

## Context — how these surfaced

Found while screening roadmaps for `/roadmap:next` on 2026-08-13, measured on a
clean checkout of `origin/main` at `8f9f44415` with an empty working tree. None
of the four is caused by the change that found them; each was verified by
running the gate itself, not inferred from a report.

The load-bearing observation is the one that connects them: **`gh run list` for
`main` is fully green while four gates in the `ci` task list fail.** Every one of
the four is registered in `Taskfile.yml`'s `ci` list and in a `taskfiles/*.yml`
file, and in **no** `.github/workflows/*.yml`. So the trunk can carry a red gate
for as long as nobody runs `task ci` locally — which the repository's own
settings discourage (`quality.local_auto_run` defaults to false, and
`roadmap-ci-steps-policy` forbids scheduling full-pipeline runs during roadmap
work).

That is not automatically a defect. There are legitimate reasons to keep a gate
out of CI — runtime, flakiness, a dependency the runner lacks. But the reason is
recorded nowhere, and the consequence is: the four below went unnoticed.

## Prerequisites

- A clean checkout of `main`, no working-tree modifications — three of the four
  gates read the tracked tree and a dirty tree changes their verdict.
- `task` (go-task) available; gates are invoked directly with `npx tsx` in the
  verification steps so a missing `task` does not block the work.

## Phase 1 — the two mechanical repairs

Both are one-token frontmatter edits with no judgement left in them; the
measurements that decide each value are recorded here so the step does not
re-derive them.

- [ ] `agents/roadmaps/road-to-always-loaded-corpus-scoping.md` declares
      `complexity: standard`, which is not one of the two accepted values.
      `COMPLEXITY_PAT` in `src/scripts/lint_roadmap_complexity.ts` accepts
      `lightweight|structural` only, so the file reports `[untagged]` and the
      gate exits 1 on the whole corpus.
      **Measured, so the value is not a guess:** 149 lines, 4 `## Phase`
      headings — both inside the lightweight caps (600 lines, 6 phases), so
      `lightweight` is the correct tag and `structural` would be a false claim
      of contract-layer scope.
      *Verify:* `npx tsx src/scripts/lint_roadmap_complexity.ts` exits 0 and the
      summary line reports 0 untagged.

- [ ] Decide the disposition of `agents/roadmaps/road-to-august-program.md` and
      apply it. `check_roadmap_trackable` fails it for carrying no
      `## Phase <id>` heading and no `status: draft`, so the dashboard cannot
      count it and a reader sees no planned work.
      **Measured:** 243 lines, 8 `##` sections, **zero** checkboxes of any
      glyph, zero `Phase` headings. It is a pure coordination file that
      schedules three sibling roadmaps and carries no executable work of its
      own; its own Risk 1 pre-registers archival if the two real dependencies
      hold without it.
      The gate names exactly two remedies, and a third exists outside it —
      which is why this is a decision and not a repair. See
      `blocker: august-program-disposition`.
      *Verify:* `npx tsx src/scripts/check_roadmap_trackable.ts` exits 0.
      <!-- blocked-by: august-program-disposition -->

## Phase 2 — the self-test ratchet

- [ ] Identify which registered gate crossed the
      `gate-self-test:registered-non-adopters` ratchet. It reads **25** against
      a baseline of **24**, i.e. one over, and the baseline note records the
      landing state as "24 of the 32 gates registered enforced" on 2026-08-06.
      The manifest now carries 35 enforced entries, so at least one gate was
      registered after that date without adopting `_lib/gate_self_test.ts` and
      without a `// self-test-exempt: <reason>` marker.
      The current 25, recorded so the next reader does not re-derive the list:
      `audit_skill_overlap`, `check_augment_description_cap`,
      `check_ci_local_parity`, `check_cli_registry_budget_sync`,
      `check_completion_review`, `check_condensation`, `check_context_paths`,
      `check_gate_completeness`, `check_iron_law_prominence`,
      `check_no_roadmap_refs`, `check_portability`, `check_review_dispositions`,
      `check_site_links`, `check_suppression_hygiene`,
      `lint_abstraction_thresholds`, `lint_artefact_frontmatter`,
      `lint_handoffs`, `lint_load_context`, `lint_namespace`,
      `lint_plan_risk_register`, `lint_profile_personas`,
      `lint_rule_skill_pack_reach`, `lint_token_budget_discipline`,
      `lint_trigger_collisions`, `skill_linter`.
      *Verify:* the crossing gate is named with the commit that registered it.

- [ ] Give that gate a self-test, or an exemption marker carrying a real reason.
      Adoption is the default; an exemption is legitimate where a gate's
      rejection cannot be provoked by a fixture it can build in a temp
      directory. **Do not raise the baseline** — `check_gate_coverage` states in
      its own failure message that raising it is a defect, not a fix.
      *Verify:* `npx tsx src/scripts/check_gate_coverage.ts` reports the ratchet
      at 24 or below.

## Phase 3 — the roadmap that cannot archive

- [ ] Resolve or record the three open blockers on
      `agents/roadmaps/road-to-inbox-harvest-2026-08-b-release-integrity.md`:
      `release-head-cadence-decision`, `carrier-install-paths-decision`,
      `adr-221-acceptance`. The roadmap is 12/12 done with zero deferred steps,
      so `roadmap:progress-check` reports it as completed-but-unarchived and the
      archival sweep refuses it — correctly, since archiving a roadmap with open
      blockers would bury three decisions.
      All three are maintainer calls; see `blocker: release-integrity-blockers`.
      *Verify:* each blocker reads `Status: resolved` with the decision recorded
      in the roadmap.
      <!-- blocked-by: release-integrity-blockers -->

- [ ] Archive it and regenerate the dashboard.
      *Verify:* `npx tsx src/agent-src/scripts/archive_completed_roadmaps.ts`
      moves the file, and `agent-config roadmap:progress-check` exits 0.
      <!-- blocked-by: release-integrity-blockers -->

## Phase 4 — close the class, or state why it stays open

The three phases above clear four instances. This phase decides whether the
class recurs.

- [ ] Establish, per gate, why the four are absent from every
      `.github/workflows/*.yml`. Distinguish a deliberate exclusion (runtime,
      runner dependency, known flakiness) from drift (nobody wired it). Report
      the split; do not assume it is all drift.
      *Verify:* a table of the four with a cited reason each, and the same
      question answered for the rest of the `ci` list — how many `ci` tasks have
      no workflow counterpart at all.

- [ ] Decide what follows from that number, and record the decision.
      The options are genuinely different in cost and none is obviously right:
      wire the local-only gates into an existing workflow; add one aggregate
      workflow job that runs the local-only remainder; or state explicitly that
      `task ci` is a superset local gate and that trunk-red on those gates is
      accepted, with a named cadence for checking it.
      See `blocker: ci-reachability-decision`.
      *Verify:* the decision is recorded as an ADR or in
      `docs/contracts/ci-green-floor.md`, whichever the decision's scope fits.
      <!-- blocked-by: ci-reachability-decision -->

## Acceptance criteria

- `npx tsx src/scripts/lint_roadmap_complexity.ts` exits 0.
- `npx tsx src/scripts/check_roadmap_trackable.ts` exits 0.
- `npx tsx src/scripts/check_gate_coverage.ts` reports
  `gate-self-test:registered-non-adopters` at 24 or below, with the baseline
  unchanged or lowered — never raised.
- `agent-config roadmap:progress-check` exits 0.
- The Phase 4 decision is recorded in a durable artefact, including the case
  where the decision is to change nothing.

## Quality gates

Targeted per step, as each *Verify:* line names. The full pipeline is not
scheduled here: `quality.local_auto_run` is false in this repository and the
remote CI on the PR is the authoritative gate
([`roadmap-ci-steps-policy`](../../src/rules/roadmap-ci-steps-policy.md)).

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-13 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 4 concludes "wire everything into CI" | implementation | The `ci` list holds well over a hundred tasks; wiring the local-only remainder wholesale could add substantial runtime to every PR and turn a quiet problem into a loud one | Phase 4 step 1 measures the split between deliberate exclusion and drift BEFORE step 2 decides; the three options are pre-registered so the cheap one (accept, with a cadence) is on the table from the start | Phase 4 — close the class, or state why it stays open |
| 2 | The august-program disposition is decided by convenience | product | `status: draft` is the cheapest way to green the gate and is arguably false — the file is an accepted coordination layer, not an unfinished draft. Choosing it to silence a linter is the config-bending this repository has recorded before | The step is gated on an explicit blocker rather than left to the executing agent, and the blocker enumerates all three remedies with what each asserts about the file | Phase 1 — the two mechanical repairs |
| 3 | The self-test crosser is exempted rather than fixed | implementation | An exemption marker is one line and always available, so the ratchet can be satisfied without any gate gaining the ability to prove it discriminates | Phase 2 step 2 states adoption as the default and names the only legitimate exemption ground (a rejection that cannot be provoked by a temp-directory fixture); the reason field is read at review time | Phase 2 — the self-test ratchet |
| 4 | Three maintainer decisions block a roadmap indefinitely | product | Phase 3 cannot proceed without three calls only the maintainer can make, so this roadmap can stall at 4 of 6 steps | Phases 1, 2 and 4 step 1 are independent of it and carry their own value; if Phase 3 stalls, the roadmap moves to `later/` rather than sitting active, per the disposition rules | Phase 3 — the roadmap that cannot archive |

## Blockers

### blocker: august-program-disposition
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 1 — the two mechanical repairs
- **What to do:**
  1. Decide what `agents/roadmaps/road-to-august-program.md` is. It has 243
     lines, 8 sections, zero checkboxes and zero `Phase` headings, and
     coordinates three sibling roadmaps that each back-link to it.
  2. Pick one, knowing what each asserts:
     **(a) `status: draft`** — cheapest, greens the gate, and claims the file is
     unfinished, which it is not. **(b) Canonical `## Phase <id>` headings** —
     makes it dashboard-visible, but requires inventing executable steps a
     coordination file does not have. **(c) Archive it** — its own Risk 1
     pre-registers exactly this if the dependencies it coordinates hold without
     it; the three siblings' back-links would need migrating.
  3. Apply the choice and re-run
     `npx tsx src/scripts/check_roadmap_trackable.ts`.
- **Resolved when:** `check_roadmap_trackable` exits 0 and the choice is
  recorded in this roadmap with one sentence of reasoning.

### blocker: release-integrity-blockers
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 3 — the roadmap that cannot archive
- **What to do:**
  1. Read the three open blockers in
     `agents/roadmaps/road-to-inbox-harvest-2026-08-b-release-integrity.md`:
     `release-head-cadence-decision`, `carrier-install-paths-decision`,
     `adr-221-acceptance`.
  2. For each, either record the decision in that roadmap and flip
     `Status: resolved`, or state that it is not decidable yet — in which case
     the roadmap moves to `agents/roadmaps/later/` instead of archive.
- **Resolved when:** all three read `Status: resolved`, or the roadmap has been
  moved to `later/` with the reason recorded.

### blocker: ci-reachability-decision
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 4 — close the class, or state why it stays open
- **What to do:**
  1. Read the Phase 4 step 1 measurement — how many `ci` tasks have no workflow
     counterpart, and how many of those absences are deliberate.
  2. Choose: wire the local-only gates into an existing workflow · add one
     aggregate job for the remainder · accept the gap explicitly and name a
     cadence for checking trunk state.
  3. Record the choice where its scope fits — an ADR for the first two, a
     paragraph in `docs/contracts/ci-green-floor.md` for the third.
- **Resolved when:** the decision exists in a tracked artefact and Phase 4
  step 2 can cite it.
