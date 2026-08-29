# Completion review — uncle-bob-swarm-inbox

**Skipped:** no code surface for this completion — the branch changes 5 files and 0 of them is a code path: three roadmaps, one stub and one evidence artefact, all markdown, scope 716e4b06f4abbdd3df3483bcdb7a81283f2217ef803bc89638423403ba2a84a8, declared 2026-08-27

## Why there is no code to review

The change is the output of `/analyze:inbox` over an 18-file, 12,682-line inbox
artifact, plus two rounds of AI-council review on that output. Every deliverable
is prose: three roadmaps, one stub, one evidence record. No script, schema, hook,
contract, template or projection is touched — the gate itself measures zero code
paths of five changed files. Nothing in the branch executes the doctrine reversal
the roadmaps plan; the surfaces they name (`ADR-124`, `ADR-109`,
`docs/contracts/no-runtime-boundary.md`, `README.md`, `docs/comparison.yaml`,
`docs/CLAIMS.md`) are all untouched here by design, because authoring a plan does
not inherit authorization to run it.

**This is a re-bind, not a fresh declaration.** The previous artefact was bound to
scope `a0e13767…`, which covered three files. Two council rounds and a structural
split later, the reviewed content is different, so the contract forces re-review
and the scope moved.

## Two council rounds, and what they found

Unusually for a docs-only branch, the substantive verification here is external
and adversarial rather than instrument-based. Both rounds ran 2/2 present with
both seats answering — checked against `responses[].error` and character counts
in the artefacts, not against the stdout tally, which printed a contradictory
`0/2 present` line before the run and `2/2` after.

**Round 1** — `agents/runtime/council/responses/pr-1688.md`, PR-diff mode.
Verdict: both seats REJECT / REQUEST_CHANGES. Four Tier-1 blockers, three of
which were errors rather than judgement calls:

- The publication blocker gated only `docs/comparison.yaml` while the roadmap's
  own prose called `README.md` "internal-facing". All three public surfaces
  carried one present-tense claim, and AC-1 could have passed with every one of
  them publishing an unproven property.
- The supervision verify asserted SIGKILL survival and second-instance refusal —
  persistence and exclusivity, not supervision.
- AC-4 required the uncovered-stack count to equal the whole detection list,
  arithmetically impossible with one adapter shipped.
- The specification roadmap shipped `status: ready` across three phases while its
  own blocker recommended Phase 1 only. Both seats independently.

Plus: the same avoided expansion was cited as the estate offset in two
frontmatters, and the telemetry collector had no data contract at all.

**Round 2** — `agents/runtime/council/responses/roadmap-runtime-governance-flip.md`,
roadmap mode, deep tier. Verdict: both seats "not ready", on a corrected file.
The structural finding drove the split: governance and a telemetry collector have
incompatible completion conditions, and folded together one roadmap owned two
rollbacks. One plain bug survived round 1 —

`grep -rniI 'zero.runtime|no runtime daemon' …` in AC-1. In a basic regex `|` is
a literal pipe, so the pattern matched nothing and the criterion would have
passed with the forbidden text in place. Proved on a one-line fixture before
fixing: without `-E`, count 0 exit 1; with `-E`, count 1. Every other
grep-shaped verify in the file was then swept — single-pattern, clean.

## What was verified against the tree, and how

Every anchor cited in the roadmaps was read at HEAD rather than carried from the
source, and re-read after **four** merges moved main under this branch
(`d55d1f101`, `d26edc97b`, `4bbc3c9d0`, plus the squash of this branch's own
first PR).

**The correction that changes the work.** The source set names `ADR-088` as the
zero-runtime anchor. It is not: `ADR-088-no-external-runtime-federation.md:78`
decides this suite does not bridge to or drive *other tools'* runtimes, and it
already carries `superseded_by: ADR-124`. The live prohibition is
`ADR-124-embedded-engine-doctrine.md:111` (Class B, "PROHIBITED in core") with a
second independent accepted floor at `ADR-109-subagent-v1-contract.md:28`.
Executing the source's Phase 0 as written would have superseded a federation
decision, left both live floors standing, and read as complete.

**Anchors reproduced, each by its own grep.** `docs/CLAIMS.md:120`
(`no-runtime-daemon`, `kind: qual`) · `docs/proof.md:416` — **one** row, where
the source claimed three · `src/scripts/check_claims.ts:487` · `README.md:3`
headline and `:17` body · `docs/comparison.yaml:31` (path corrected from
`src/config/`; line and content exact) · `docs/positioning-evidence.md:56`–`:74`
· `subagent-steering.md:107` verbatim · `docs/contracts/no-runtime-boundary.md`
present with `keep-beta-until: 2026-08-17` expired ten days before this branch,
which the source did not notice.

**Measurements, re-run after every merge and unchanged.** Gherkin/BDD in `src/`:
**1** hit, a rubric line in
`judge-artifact-completeness/rubrics/ticket-quality-score.json:21` asking a
*reviewer* to check the shape. Skills teaching mutation testing: **0** of
**299**, against `grade_target_readiness.ts:183-189` grading consumer repos on
exactly that. No-runtime surface: **129** files — and the composition is now
enumerated per directory, because round 2 correctly asked where the 68 files
outside the top three directories were. Assurance registry: 19 capabilities,
`e2e-test` at `unknown`, `mutation-sensitivity` at `degraded` with a recorded
measured refusal whose `revisit_if` sentence one roadmap adopts verbatim.

**A prescription that does not apply here, stated rather than silently dropped.**
Both seats required `status: blocked`. `src/agent-src/templates/roadmaps.md:31`
states the vocabulary is binary — `ready` or `draft` — and names "while waiting
for upstream decisions" as exactly what `draft` is for. Both roadmaps are `draft`;
that is the local translation of the instruction, not a downgrade of it.

**Recurrence, checked and dispositioned.** `agents/tmp.old/robert-c-martin/`
(2026-08-22) analysed the same external source and produced five roadmaps — two
archived, three in `stubs/`. Its output *is* the assurance registry both new
roadmaps build on, so the earlier disposition was executed rather than wrong.

**One divergence found and closed rather than exempted.** While the branch sat
behind main, `check_estate_count` read `skill_description_tokens` 11455 → 11461
and attributed the growth to this change's exemption claim. After the rebase it
reads +0. A second instance of the same shape appeared at the end: the estate
claim's text asserted "+1 on open_blockers" after main's own blocker repair
(#1689) had absorbed it, so the text was corrected rather than left asserting a
growth that is not happening.

## Gates run green on this branch

`lint_roadmap_blockers` (+ decidability) · `lint_plan_risk_register` ·
`check_roadmap_trackable` · `lint_roadmap_complexity` · `lint_empty_roadmaps` ·
`lint_roadmap_family_cap` · `lint_roadmap_ci_steps` · `check_estate_count` ·
`check_references` · `check_no_roadmap_refs` · `check_no_external_sources` ·
`check_md_language` · `lint_evidence_artifacts`.

Two gate results are worth naming rather than listing. `lint_roadmap_complexity`
reds on a `relates:` block without per-row `slug` + `relation` keys — caught and
fixed on both new files. And `lint_roadmap_blockers` passes **vacuously** on zero
parsed blockers, so the five blocker sections were verified as parsed by grepping
the literal `### blocker: ` prefix rather than trusting the lint's green.
