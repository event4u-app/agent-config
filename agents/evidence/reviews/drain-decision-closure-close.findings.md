# Completion review — drain of road-to-decision-closure, 2026-10-01

**Skipped:** no code surface for this completion — the diff is one roadmap file under `agents/roadmaps/` and nothing else; the gate itself measures zero code paths of one changed file, scope 6e50794b8bfe52667eb80e6cee956686c5f0e6d5df4d549ceba7996e93dab215, declared 2026-10-01

## Why a skip rather than a review

`git diff --stat origin/main` on this branch is a single line:
`agents/roadmaps/road-to-decision-closure.md`. No script, no hook, no schema, no
fixture, no test, no contract under `docs/`. `check_completion_review` agrees
and says so in its own refusal text — *"diff has 0 code path(s) of 1 changed
file(s)"* — so the skip phrase is a measurement here rather than a claim about
one.

## What was verified instead, and how

A roadmap drain's evidence is the re-execution of the conditions the file
asserts, not a review of code it does not contain. Every one was executed on
this tree at `9f2b9fb4a`; none was taken from the file's own previous note.

- **`adr-266-acceptance-closure` resolves** — `grep -m1 '^status:' docs/decisions/ADR-268-*.md`
  reads `accepted`. Holds.
- **`kernel-write-deny-…`, clause 1** — an `Edit` envelope naming
  `src/rules/ask-when-uncertain.md` piped to `src/scripts/hooks/block_kernel_rule_writes`
  exits **1** with `BLOCKED — kernel rule ask-when-uncertain is immutable`. Fourth
  reproduction; blocker holds.
- **`kernel-write-deny-…`, clause 2** — `grep -niE 'AskUserQuestion|native|primitive'
  src/rules/ask-when-uncertain.md` returns nothing, so the paragraph that would discharge the
  blocker without touching the guard does not exist either. Both clauses negative; this is the
  first run that checked the second.
- **`grant-object-undelivered`** — `grep -rln granted_by src tests` exits 1 with no output.
  Blocker holds, fourth reproduction.
- **`interrupt-classes-owned-by-sibling`, clause 1** — the sibling's 3.2 still reads `- [ ]`.
  Does not hold.
- **`interrupt-classes-owned-by-sibling`, clause 2** — the allocation is now recorded here as
  `DC-1`. **Holds; the blocker is resolved.**
- **Step scan unchanged** — `scanOpenSteps` over the edited file returns
  `open=0, blocked=3, next=null`, identical to the base. The new `## Decisions` H2 does not
  truncate a phase span.
- **No detector finding seeded** — `closure_scan` reports 8 open decisions and 2 owner
  questions on the base file and the same 8 and 2 on the edited one.
- **AC-5 static halves** — `ask_block_census` over 627 files: *zero technical owner asks in
  execution* MET, *zero commit/push/CI/conflict asks* MET, *zero repeats* NOT MEASURED.
- **AC-6 clause 2** — `grep -c '^\s*ask:' src/scripts/hook_manifest.yaml` returns **8**;
  listing them gives one `native` and seven `text`.

Gates run over the diff, all green: `lint_decision_classes` (15 scanned, 0
violations — the new `## Decisions` table passes the eight-class and
resolver-vocabulary contract), `check_council_references`,
`check_no_roadmap_refs` (1009 scanned), `check_references` (2141 scanned),
`lint_plan_risk_register`, `lint_roadmap_producers`, `check_md_language`,
`lint_roadmap_complexity` on this file (`[structural]`, green),
`task roadmap-dashboard-untracked-check`, `task check-archive-index`.

## The one decision this diff carries, and who took it

Row `DC-1` in the roadmap's new `## Decisions` section. It was not taken by this
run: it was taken by the council this run convened, 2/2 present of 2, threshold
1, `concluded`, 2 rounds, members `anthropic/claude-sonnet-4-5` and
`openai/codex-default`, $0.00 (both seats subscription-authed). The question put
to them was written without a stated expectation in either direction and ended
*"If the evidence is insufficient for either sub-question, say which fact is
missing rather than choosing"* — per
[`evaluator-independence`](../../../src/rules/evaluator-independence.md), since
this run authored both the question and the artefact under question.

The convergence is inlined into the roadmap with date, members, rounds and cost.
The council's own response file is deliberately **not** cited from the roadmap:
it lives under `agents/runtime/council/`, which is gitignored and auto-pruned,
and citing it from a durable artefact is what `no-roadmap-references` and
`check_council_references` forbid.

## Pre-existing reds observed and NOT fixed here

Two, both outside this diff, both named rather than silently passed:

1. `lint_roadmap_complexity` fails on `agents/roadmaps/road-to-a-stop-that-holds.md`
   — *"lightweight cap exceeded: 920 lines (max 600)"*. That file is 920 lines on
   `origin/main` itself, untouched by this branch, merged two commits ago by
   #2128. The gate is **local-only**: `rule-backstops.yml`'s own header records
   that no workflow invokes `task ci`, `ci-strict` or `ci-fast`, so it reds no
   pull request. Not fixed here because the one-line repair — retagging it
   `structural` — edits an active parallel workstream's live roadmap frontmatter
   and would conflict with its in-flight branch. Surfaced for its owner.
2. `task roadmap-progress-check` fails on
   `agents/roadmaps/road-to-host-claims-the-tree-contradicts.md` (2 unresolved
   `[~]`). Also untouched by this branch. CI deliberately runs the narrow
   `task roadmap-dashboard-untracked-check` instead, and `consistency.yml` states
   the reason inline: the full gate *"asserts estate-wide conditions over roadmaps
   an unrelated PR never touched, and behind a required check that makes any
   pre-existing estate defect a merge block on every PR."* Both narrow checks pass
   here.
