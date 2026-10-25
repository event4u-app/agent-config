---
complexity: lightweight
status: ready
tree_pin: 4e7efca19f
revalidated: 4e7efca19f 2026-10-25
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-at, verified at 01bb841cb: no roadmap owns plan revalidation. Search `grep -rlniE 'revalidat|tree_pin|plan-pin|re-verified at execution' agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs` over the whole roadmap tree returned six files; none owns the mechanism — road-to-a-step-that-costs-what-it-changes names `revalidation` only as a would-skip ceremony in its depth table (src/config/step-depth-table.json), the other five mention the word in passing. The mechanism itself is absent: no `tree_pin` field in src/scripts/new_roadmap.ts or the template, no `--revalidate` mode in src/scripts/roadmap_context.ts, and `staleArtefactVerdict` (src/scripts/roadmap_context.ts:470) has no production caller. The owner asked for exactly this in the source transcript (turn 2). Active estate was 4 of 5 at authoring. Parking it in later/ was rejected because the same invocation asks to execute this round's roadmaps now; merging into road-to-a-step-that-costs-what-it-changes was rejected because that file owns per-class ceremony depth, not the ceremony, and folding five phases into it would double its open work."
relates:
  - slug: road-to-a-step-that-costs-what-it-changes
    relation: disjoint
    note: "Its depth table names `revalidation` as a ceremony per change class (deterministic stale check; council only on detected drift). This file builds the ceremony that row points at; it does not edit the table or the class logic."
  - slug: road-to-a-retro-the-merge-runs
    relation: disjoint
    note: "Parked in later/. Receives the plan-versus-use facts this file produces as its own steps (see its Arrivals line); nothing here edits its phases."
  - slug: road-to-a-run-that-knows-its-skills
    relation: disjoint
    note: "Parked in later/, same round. Owns the run basis and the stop gate; this file owns only the planned-skill line on a roadmap step and the read-out at review and closure."
---
# Road to a plan that stays true

> **Source:** `agents/tmp.old/inbox-2026-10-at/` — three owner transcripts with
> their supplied plans (14 files). This file carries topic 1's programme A and
> the review half of its programme S; the rest of the round landed on existing
> owners (see § What this roadmap does not do).

## Goal

A roadmap in this repository stays checked against the tree it will be executed
on. Every roadmap carries a machine-readable pin; one deterministic primitive
reports which cited paths moved since that pin and which decisions now rest on
moved evidence; the primitive runs at emit, at execution start, at every phase
boundary and at closure without anyone remembering it; a decision whose evidence
moved goes to the council as a question, never to a script as a verdict. A step
can name the skills it plans to use, and the review and the closure read back
whether they were used, waived with a reason, or missed.

## Context

Read at `main@01bb841cb` (2026-10-25).

- The pin exists only as prose or as the optional `drafted-against:` header
  (`docs/contracts/agents-layout.md:147`); `src/scripts/new_roadmap.ts:58-64`
  emits no pin field.
- `src/scripts/roadmap_context.ts` already holds the parts: `citedPaths` (`:332`),
  `absentCitedPaths` (`:458`) and `staleArtefactVerdict` (`:470`), the last with
  no production caller. Its own header states the boundary this file closes
  (`:23-28`): nothing fires the probe and nothing notices when it is skipped.
- Path drift against an anchor is implemented once, privately, in
  `src/scripts/report_memory_pointers.ts:373` (`driftedPaths`), with the right
  stance stated beside it: drift is a re-verification prompt, never a verdict.
- The phase-boundary refresh compares a fingerprint and re-probes PRs only
  (`src/agent-src/contexts/execution/roadmap-process-loop-set.md:186-212` <!-- corrected-from-reproduction: the file has 212 lines; the first --revalidate run reported beyond-end -->); it
  never asks whether the roadmap's own citations moved.
- `/review-changes` dispatches seven judges (`src/domains/engineering-base/review/changes/command.md:6`),
  and none of them sees which skills the run planned or used.

## Phase 1 — The pin and the primitive

Evidence (read): `src/scripts/roadmap_context.ts:470`

- [x] **1.1 Contract `docs/contracts/roadmap-revalidation-v1.md`.** The moments, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/git_drift.ts -->
      the one primitive, the vocabulary: per cited path `unchanged | drifted |
      missing | beyond-end`; per roadmap `fresh | drifted | broken | unpinned`;
      per re-verified statement the intake labels `still-true | already-fixed |
      never-true | unverifiable`. Never blocking (drift is not falsity). Council
      only on decision drift; a degraded council is never consent.
      verify: `grep -c 'still-true' docs/contracts/roadmap-revalidation-v1.md` -> /^[1-9]/
- [x] **1.2 `tree_pin:` on every new roadmap.** `new_roadmap` writes <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/git_drift.ts -->
      `tree_pin: <short HEAD>` into the skeleton; the template documents it. A
      reader `readPin` accepts the field and the two older forms
      (`drafted-against:`, a `read at \`main@<sha>\`` context line); no mass
      migration.
      verify: `npx vitest run tests/scripts/roadmap_revalidation.test.ts` -> 0 — covers all three forms and the skeleton
- [x] **1.3 Shared drift and citation parsing in `_lib/`.** `driftedPaths` moves <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/git_drift.ts -->
      to `src/scripts/_lib/git_drift.ts` and both callers use it; the citation
      parser reads `` `path` `` and `` `path:line` `` / `` `path:a-b` `` and
      reports `beyond-end` when a cited line no longer exists.
      verify: `npx vitest run tests/scripts/roadmap_revalidation.test.ts tests/scripts/report_memory_pointers.test.ts` -> 0
- [x] **1.4 `roadmap:context --revalidate <slug|path>`.** No new verb. Prints the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/git_drift.ts -->
      roadmap verdict, each non-`unchanged` citation, and each `## Decisions` row
      whose evidence or `revisit if` cell cites a drifted or missing path.
      Cheap path first: pin equals HEAD, or no cited file changed, means `fresh`
      without reading line ranges. `staleArtefactVerdict` gets its first
      production caller here. `--advance` rewrites `tree_pin` to HEAD and the
      `revalidated:` line, and refuses while the verdict is `broken`.
      verify: `npx vitest run tests/scripts/roadmap_revalidation.test.ts` -> 0 — a fixture repo with one drifted, one deleted and one unchanged citation yields drifted/missing/unchanged and verdict `broken`

## Phase 2 — The moments, bound to carriers that already run

Evidence (read): `src/scripts/roadmap_drain_queue.ts:103`

- [x] **2.1 Emit refuses an unpinned roadmap.** `analysis_validate` reports an <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/analysis_emit.ts -->
      emitted roadmap without a readable pin as a content failure, so a run that
      skips the pin stays in `emitted`; `/analyze:inbox` Phase 6 says the pin is
      the emit-time HEAD.
      verify: `npx vitest run tests/scripts/analysis_validate.test.ts` -> 0 — reds on a fixture without `tree_pin:`
      reach exempt: `emitRound` is the analysis engine's library entry, called from the `/analyze:*` procedure rather than imported by a CLI; it had no import caller before this step either, and the step only adds an optional `treePin` field to it.
- [x] **2.2 Execution start sees freshness.** Each drain-queue entry carries <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/roadmap_drain_queue.ts -->
      `freshness: fresh | drifted | broken | unpinned` from the cheap path; the
      text render shows it; no fifth step class. On `drifted` or `broken` the
      loop revalidates at run start before the first mutation; every lane runs
      that loop, so the brief does not repeat it. <!-- corrected-from-reproduction: the brief sentence put process-full-all.md over the 16,000-char depth ceiling (2 chars of headroom) -->
      verify: `npx vitest run tests/scripts/roadmap_drain_queue.test.ts tests/scripts/process_full_lane_brief.test.ts` -> 0
- [x] **2.3 Phase boundary and resume.** The context-refresh subsection of <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/roadmap_drain_queue.ts -->
      `roadmap-process-loop-set.md` runs `--revalidate` when the fingerprint
      differs, and the agent re-verifies each drifted statement, labels it and
      corrects it in place (`corrected-from-reproduction`), then `--advance`.
      verify: `grep -n 'revalidate' src/agent-src/contexts/execution/roadmap-process-loop-set.md` -> /^[1-9]/
- [x] **2.4 Closure.** The close procedure runs `--revalidate` before archiving; <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/roadmap_drain_queue.ts -->
      a `broken` verdict at closure is named in the closing summary.
      verify: `grep -n 'revalidate' src/agent-src/contexts/execution/roadmap-process-loop-close.md` -> /^[1-9]/

## Phase 3 — The council only where a decision moved

Evidence (read): `src/scripts/ai_council/prompts.ts:58`

- [x] **3.1 Decision drift renders a council question.** `--revalidate --json` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/roadmap_drain_queue.ts -->
      emits, per drifted decision row, a question text in the existing prompt
      mode: the row, its evidence, the diff of its drifted paths since the pin,
      and the closed answer set `holds | holds-changed | falls`. Numbers moving
      never produce a question.
      verify: `npx vitest run tests/scripts/roadmap_revalidation.test.ts` -> 0 — a decision citing a drifted path yields one question; a step citing it yields none
- [x] **3.2 Routing and the degraded case, in the procedure.** The process loop <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/roadmap_drain_queue.ts -->
      sends rendered questions through `council_cli` and records the answer as a
      `## Decisions` row `resolved by: council:<date>`; one seat or a split is
      `provisional` for technical classes and an `agents/owner-questions.md`
      row for owner-reserved ones — never consent.
      verify: `grep -n 'holds-changed' src/agent-src/contexts/execution/roadmap-process-loop-set.md` -> /^[1-9]/

## Phase 4 — Planned skills, read back at review and closure

Evidence (read): `src/scripts/report_skill_activation.ts:188`

- [x] **4.1 A step may carry `uses:`.** An indented `uses: <skill>[, <skill>]` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/skill_plan_usage.ts -->
      line under a step, parallel to `verify:`; a waiver is
      `waived: <skill> — <reason>` with reason from the closed set
      `not-applicable-scope | superseded-by:<skill> | unavailable-on-host |
      already-satisfied`. The template documents both.
      verify: `npx vitest run tests/scripts/skill_plan_usage.test.ts` -> 0 — parses both lines and rejects a reason outside the set
- [x] **4.2 `skill_plan_usage` reads plan against transcript.** For a roadmap and <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/skill_plan_usage.ts -->
      one or more session transcripts: per planned skill `applied | waived |
      missing`, plus `unplanned` skills that were applied; applied means a
      `Skill` tool call or a read of that skill's `SKILL.md` — a tool event,
      never transcript prose. Rules report `not-observable` here.
      verify: `npx vitest run tests/scripts/skill_plan_usage.test.ts` -> 0 — a fixture transcript with one Skill call, one SKILL.md read and one prose mention yields two applied and one missing
- [x] **4.3 Review and closure consume it.** `/review-changes` puts the block in <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/skill_plan_usage.ts -->
      the input of `judge-synthesis` when it runs inside a roadmap run, and
      `missing` is a process finding; the close procedure prints it before the
      archive.
      verify: `grep -n 'skill_plan_usage' src/domains/engineering-base/review/changes/command.md src/agent-src/contexts/execution/roadmap-process-loop-close.md` -> 0

## Phase 5 — Defects the intake found

Evidence (executed): `src/scripts/optimize_skill_description.ts:128`

- [x] **5.1 One judge count.** `/work` delegates to `/review-changes`, which runs <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/directives/backend/verify.ts -->
      seven judges; seven surfaces still say four or five, and
      `docs/contracts/review-lens-schema.md:62` links a path that no longer
      exists. Fix the wording and the link; recapture the golden packs that
      record the old string.
      verify: `grep -rln 'four-judge\|five-judge' src docs tests/golden/baseline` -> /^src\/skills\/ai-council\/SKILL.md$/ <!-- the one remaining site is a council surface; an edit there makes the PR needs-owner (ADR-281), so it is agents/owner-questions.md OQ-16 -->
- [x] **5.2 One selection rule.** `optimize_skill_description` reports the paired <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/paired_verdict.ts -->
      verdict on the test split per candidate instead of picking by raw `>`;
      `underpowered` is printed, never overwritten.
      verify: `npx vitest run tests/scripts/optimize_skill_description.test.ts` -> 0
      production entry: src/scripts/optimize_skill_description.ts
- [x] **5.3 Multiple-comparison correction.** A Holm step-down over the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/paired_verdict.ts -->
      candidates of one run, next to the sign test in `_lib/paired_verdict.ts`,
      used by 5.2.
      verify: `npx vitest run tests/scripts/paired_verdict.test.ts` -> 0 — five candidates each just under α alone are not significant after correction
      production entry: src/scripts/optimize_skill_description.ts
- [x] **5.4 One id per owner question.** `agents/owner-questions.md` carries <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/paired_verdict.ts -->
      `OQ-11` twice; the self-modification one, which nothing cites, becomes
      the next free id (the archived memory roadmap cites the teardown one).
      verify: `grep -c '^### OQ-11 ' agents/owner-questions.md` -> /^1$/ <!-- merged with main: #2683 renumbered and answered the self-modification question as OQ-12 the same day; this branch took main's numbering and filed its two questions as OQ-14 and OQ-15 -->
      production entry: src/scripts/optimize_skill_description.ts

## What this roadmap does not do

- The run basis, the forced verdict per candidate skill and the stop gate
  (topic 1 programme S): `later/road-to-a-run-that-knows-its-skills`.
- "Why not, and what to improve" per missed skill (programme R):
  `later/road-to-a-retro-the-merge-runs`, under its Arrivals line.
- The automatic-versus-explicit selection measurement (topic 2):
  `later/road-to-routing-assurance-live-floors` and
  `stubs/road-to-live-trigger-eval`, under their Arrivals lines.
- The candidate-aware runner and the failure-informed proposer (topic 3):
  `later/road-to-governed-evidence-production`, under its Arrivals line.
- Reopening ADR-263: `agents/owner-questions.md` OQ-14.
- A JSON record per revalidation, a dashboard column, a CI gate over every
  roadmap's freshness: refused — the `revalidated:` line is the record, and drift
  is a re-verification prompt, not falsity.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Revalidation never blocks; the verdict is context | Drift is a prompt to re-verify (`src/scripts/_lib/git_drift.ts:1-7`) <!-- corrected-from-reproduction: the text moved there in 1.3 --> | the false-alarm share of `drifted` → `still-true` stays under a tenth over 30 roadmaps |
| D2 | reversible-technical | agent | The `revalidated:` frontmatter line is the record; no evidence file per run | Owner directive 2026-10-24: evidence only when re-read later | a reader needs the per-run history the line overwrites |
| D3 | reversible-technical | agent | A `revisit if` cell is evaluated only in the closed forms `test -f <path>` / `test -e <path>`; any other command is `unverifiable`, never executed | a roadmap's text is untrusted input to a script | a third safe form is asked for twice |
| D4 | reversible-technical | agent | Council questions reuse the existing prompt mode; no new council mode | `src/scripts/ai_council/prompts.ts:185-195` mode table; nine modes already | a rendered question is rejected by the bundler size limit |
| D5 | reversible-technical | agent | `uses:` and `waived:` are step lines like `verify:`, not frontmatter | the step is the unit the closure reads | a roadmap needs a skill plan above step level |
| D7 | reversible-technical | agent (revalidation 2026-10-25) | D1 holds: its evidence moved only because step 1.3 relocated the cited text, unchanged, into `_lib/git_drift.ts`; council not asked — a reversible-technical row, per the owner directive of 2026-10-24 | closing `roadmap:context --revalidate` | — |
| D6 | reversible-technical | agent | Closure scan of 2026-10-25: C1 and C3 (`destructive-owned`) match the word "merge" inside the slug `road-to-a-retro-the-merge-runs`; C2 is a pointer line in § What this roadmap does not do. No decision is open behind any of them | `./scripts-run src/scripts/closure_scan agents/roadmaps/archive/road-to-a-plan-that-stays-true.md` | a step of this file starts a merge or names an acceptance criterion in prose |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Revalidation that cries wolf | product | Every merge touches a cited file, every roadmap reads `drifted`, and the line is ignored | cheap path first; drift lists only cited files; never blocking (D1) | Phase 1 — The pin and the primitive |
| 2 | A roadmap's text steers a script | implementation | a `revisit if` or `verify:` cell executed as a shell command from an untrusted roadmap | closed forms only (D3); nothing else is run | Phase 1 — The pin and the primitive |
| 3 | Plan-versus-use counted from prose | implementation | a skill named in the reply counts as applied | applied only from a `Skill` tool event or a `SKILL.md` read (4.2) | Phase 4 — Planned skills, read back at review and closure |
| 4 | Council spend on every drift | product | numbers move daily and each move asks the council | only decision rows produce questions (3.1) | Phase 3 — The council only where a decision moved |

## Acceptance Criteria

- [x] AC-1 — A roadmap written by `new_roadmap` carries `tree_pin:`, and
      `roadmap:context --revalidate` reports its verdict with no new verb, engine
      or settings key.
- [x] AC-2 — A drain-queue entry, a phase boundary and a closure each surface the
      verdict without the agent having to remember the primitive.
- [x] AC-3 — A decision whose evidence moved produces exactly one council
      question; a step whose evidence moved produces none.
- [x] AC-4 — A step's `uses:` line is read back as applied, waived or missing at
      review and at closure, from tool events only.
- [x] AC-5 — No surface counts the `/review-changes` judges as four or five, and
      no code path in the tree picks a skill-description candidate by raw score.
