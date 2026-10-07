---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Five release-evidence surfaces each publish a figure or a verdict that a later run of the named command does not reproduce, and no live roadmap owns their reproducibility. Archiving or parking another roadmap frees a slot and fixes none of them; merging into the nearest owner, road-to-a-release-record-that-says-what-it-reviewed-carried, was considered and rejected: it is parked behind an owner spend blocker on the review-coverage floor, and attaching unrelated reproducibility work to a parked file would park it too."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-06 for this round's roadmaps to land as ready in one change; the nearest owner is parked on an unrelated spend decision."
relates:
  - slug: road-to-a-release-record-that-says-what-it-reviewed-carried
    relation: disjoint
    note: "Its owner blocker review-ceiling-is-spend governs the review-coverage floor and chunk ceiling; this file does not touch either, only what a chunk is spent on."
---
# Road to release evidence that reproduces

> **Source:** an external review round (opaque id inbox-2026-10-e), round
> `agents/tmp.old/inbox-2026-10-e/`. Every anchor below was re-read at `main` @
> `a75bb3210` on 2026-10-06; the release-mix figure was re-run at the same
> commit.

## Goal

Every figure and verdict a release publishes can be reproduced by the command
it names, on the range it names. The governance-mix line matches its measurer.
A chunk of the self-review budget is not spent re-reading a copy of a diff
that was already reviewed. A ratification header cannot say more than its
seats said. A deterministic budget metric is checked on the PR that moves its
input. A release PR's manifests differ from the base only in version fields.

## Context

- The 16.3.0 section publishes `> **Governance mix:** governance-only 23 vs
  consumer-only 1 (taxonomy 1.1.0).` (`CHANGELOG.md:755`).
  `./scripts-run src/scripts/measure_release_mix --from 16.2.0 --to 16.3.0`
  prints `governance 83`, `consumer 3` and `response owed YES (… 83 vs 3)`.
  The publisher measures from the previous tag to `'HEAD'` at write time and
  records neither SHA (`src/scripts/release_publication.ts:470-483`), so the
  published line cannot be traced to the range it read.
- The self-review gate skips only generated projections and lockfiles
  (`src/scripts/self_review_gate.ts:116-122`); the R2 reviewer additionally
  excludes `agents/evidence/reviews` (`src/scripts/dispatch_r2_reviewer.ts:116`).
  Review-input copies therefore compete for `MAX_REVIEW_CHUNKS = 6`
  (`self_review_gate.ts:648`). For 16.3.0 the record reads 81 of 684 files
  reviewed; of 603 unreviewed paths, 154 sit under `agents/evidence/reviews/`
  and 94 are `.review-input/` copies (`agents/evidence/release-findings/16.3.0.json`
  `.coverage`).
- A ratification artifact's `providers:` and `verdict:` are free-written
  frontmatter; the parser checks only that they are present, known and
  distinct (`src/scripts/_lib/ratification_artifact.ts:164-183`, `:226-232`),
  and the gate prints them (`src/scripts/check_kernel_edit_ratified.ts:422-423`).
  Three 16.3.0 findings are about exactly that and carry no disposition:
  `2c9959f7262d` (`ratified` while one seat was non-convergent),
  `13568e8fe68a` (two providers listed, one seat closed), `541a64c5b619`
  (seats read an author-written description, not the diff).
- The evaluator umbrella runs on PRs that touch a measured input
  (`.github/workflows/evaluator-umbrella.yml:23-31`). `src/cli/registry.ts`
  is listed for `cli_help_command_count`; nothing under
  `src/scripts/mcp_server/` is listed for `mcp_public_tool_count`. The PR that
  added `graph_node` (#2159, `495880908`) touched
  `src/scripts/mcp_server/graph_tools.ts` and did not move the budget; the
  record's own text says the release gate then blocked 16.3.0, "the same shape
  as the 20 -> 25 move" (`agents/evidence/metrics/evaluator-measurements.json:7`).
  A hand-edit claim about that file was dispositioned `false_positive`
  (`4a7127f47609`, commit `c901b631b`); this file does not repeat it.
- A release PR may carry `package.json`, `package-lock.json` and the plugin
  manifests (`src/scripts/check_release_pr_shape.ts:27-60`), and smoke is
  skipped on release heads; the contract says no gate reads `package.json`
  content and "closing it needs a content check"
  (`docs/contracts/release-pr-gating.md:55`, `:176`, `:203`). Finding
  `9cba89c889a9` (medium, security) records it and has no disposition.

## Phase 1 — The mix line reproduces

- [x] **1.1 The publisher records its range.** `measure_mix_obligation`
      returns the resolved `from` and `to` SHAs with the level, and the
      rendered line carries them. A test asserts the rendered counts equal
      `measureRange` on those two SHAs.
      verify: `npx vitest run tests/scripts/release_mix_line_reproduces.test.ts` -> 0
- [x] **1.2 16.3.0 is corrected or annotated.** The 16.3.0 line is either
      replaced by the reading on `16.2.0..16.3.0` or followed by one dated
      line giving that reading and the command.
      verify: `sed -n '/^## \[16.3.0\]/,/^## \[16.2.0\]/p' CHANGELOG.md | grep -c 'consumer-only 3'` -> /^[1-9]/

## Phase 2 — Review scope parity

- [x] **2.1 Review-input copies spend no chunk.** `isReviewablePath` excludes
      `agents/evidence/reviews/` as the R2 reviewer does, and the coverage
      record counts such paths as "copy of reviewed diff", not unreviewed. A
      fixture span with one source file and one review-input copy plans one
      chunk.
      verify: `npx vitest run tests/scripts/self_review_gate_review_input_skip.test.ts` -> 0

## Phase 3 — A header that says what the seats said

- [x] **3.1 The header is derived from the seats.** The ratification writer
      fills `providers:` and `verdict:` from the per-seat final verdicts, and
      the parser flags `ratified` with a dissenting or non-convergent seat,
      and `providers` naming more seats than gave a final verdict. Fixtures
      both directions.
      verify: `npx vitest run tests/scripts/ratification_header_from_seats.test.ts` -> 0
- [x] **3.2 The three findings get dispositions.** `2c9959f7262d`,
      `13568e8fe68a` and `541a64c5b619` each carry a terminal status.
      verify: `node -e 'const j=require("./agents/evidence/release-findings/16.3.0.json");const ids=["2c9959f7262d","13568e8fe68a","541a64c5b619"];process.exit(j.findings.filter(f=>ids.includes(f.finding_id)&&f.status).length===3?0:1)'` -> 0

## Phase 4 — A budget move is caught on the PR that causes it

- [x] **4.1 Every deterministic metric's input is a trigger.** The umbrella's
      `paths` filter gains the sources each deterministic metric is measured
      from, `src/scripts/mcp_server/**` included, and a test reads
      `evaluator-budgets.json` and the workflow and fails when a
      deterministic metric names no input path present in the filter.
      verify: `npx vitest run tests/scripts/evaluator_umbrella_paths_cover_inputs.test.ts` -> 0

## Phase 5 — Release manifests carry only versions

- [x] **5.1 A content check beside the shape check.** A script compares
      `package.json`, `package-lock.json`, `.claude-plugin/marketplace.json`
      and both `.augment-plugin/` manifests against the base and fails on any
      difference outside version fields; it runs next to
      `check_release_pr_shape` in `release-validation.yml`. Fixtures: version
      bump passes, an added script or dependency fails.
      verify: `npx vitest run tests/scripts/check_release_manifest_content.test.ts` -> 0
- [x] **5.2 The finding gets its disposition.** `9cba89c889a9` is recorded as
      `fixed` with the commit that lands 5.1.
      verify: `node -e 'const j=require("./agents/evidence/release-findings/16.3.0.json");const f=j.findings.find(x=>x.finding_id==="9cba89c889a9");process.exit(f.status==="fixed"&&f.commit?0:1)'` -> 0

## What this roadmap deliberately does not do

- No change to `MAX_REVIEW_CHUNKS` or to the coverage label; both belong to
  the parked owner of the coverage floor.
- No change to how many providers a ratification needs.
- No hand-edit detector for the measurements file; the claim that prompted
  one was dispositioned `false_positive`.
- No re-run of the smoke job on release heads; 5.1 closes the gap the skip
  leaves by reading content instead.

## Acceptance Criteria

- [x] AC-1 — The published mix line names its SHAs and equals the measurer on
      them; the 16.3.0 discrepancy is corrected or annotated.
- [x] AC-2 — A review-input copy consumes no review chunk.
- [x] AC-3 — A ratification header with a dissenting seat, or more providers
      than final verdicts, is flagged.
- [x] AC-4 — A PR touching an input of a deterministic budget metric runs
      the budget check.
- [x] AC-5 — A release PR whose manifests differ from the base outside
      version fields fails.
- [x] AC-6 — The four findings named here carry terminal dispositions.

## Delivery notes

- 3.1 went through four council rounds (2026-10-07, anthropic and openai, every
  round shown the full diff); the ratification artifact is
  `agents/evidence/ratifications/drain-release-evidence-that-reproduces.md`.
  `seats:` became required on the round-2 objection.
- Residue, not closed here: the `seats:` entries are author-recorded, so the
  reader binds the header to them without authenticating them against council
  output (the round-4 openai seat). The contract states this limit.
- 3.2 and AC-6: the three ratification findings are `still_open` — true about
  artifacts this roadmap does not edit; `9cba89c889a9` is `fixed`.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | The mix line is fixed by recording the range, not by re-deriving the taxonomy | The measurer reproduces 83/3 on the tag range; the published line read a different `HEAD` | The tag range itself is found to disagree across clones |
| D2 | reversible-technical | agent | Review-input copies are skipped and counted separately | The R2 reviewer already excludes them (`dispatch_r2_reviewer.ts:116`) | A review-input copy is found that differs from its reviewed diff |
| D3 | reversible-technical | agent | Header fields are derived, never free-written | Three findings in one release on the same free-written fields | — |
| D4 | deterministic | evidence | Path-trigger the umbrella on metric inputs rather than move the check | The filter already is the selection mechanism; one input was missing | A metric's input cannot be expressed as a path |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A manifest check blocks a legitimate release | product | A release that must change a manifest field outside versions is refused. | The failure names the field; the release PR then carries a separate commit off the release branch. | Phase 5 — Release manifests carry only versions |
| 2 | The skip hides a changed review-input | implementation | A review-input file edited after its review would go unread. | 2.1 counts it in the record; D2 names the revisit condition. | Phase 2 — Review scope parity |
| 3 | Rewriting a published changelog line | product | Editing a released section reads as rewriting history. | 1.2 allows an annotation instead of a replacement. | Phase 1 — The mix line reproduces |
| 4 | A wider path filter runs the umbrella more often | implementation | More PRs pay the container run. | Only inputs of deterministic metrics are added. | Phase 4 — A budget move is caught on the PR that causes it |
