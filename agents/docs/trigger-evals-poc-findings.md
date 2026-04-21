# Trigger-Eval PoC — Findings

> **Status**: Phase 2 measurement complete (single run per pilot).
> Reproducibility run pending before the Decision Gate can formally
> be declared passed.
>
> **Date**: 2026-04-21
> **Model**: `claude-sonnet-4-5`
> **Catalogue**: 100 skills
> **Total spend**: $0.39 (well under the $5 PoC ceiling and $50 global)
>
> **Source runs**: `evals/results/2026-04-21T08*Z-*-claude-sonnet-4-5.json`
> (gitignored — the run artifacts are not checked in; this document
> is the citable record.)

## Aggregate

| Skill            | Precision | Recall | F1   | TP | FP | FN | Cost    |
|------------------|-----------|--------|------|----|----|----|---------|
| `eloquent`       | 0.714     | 1.000  | 0.83 |  5 |  2 |  0 | $0.1296 |
| `php-coder`      | 0.667     | 0.800  | 0.73 |  4 |  2 |  1 | $0.1301 |
| `skill-writing`  | 1.000     | 0.800  | 0.89 |  4 |  0 |  1 | $0.1297 |
| **Weighted avg** | **0.79**  | **0.87** | **0.83** | **13** | **4** | **2** | **$0.3894** |

Cost estimate calibration is slightly high (est. $0.15 vs. actual
~$0.13 per skill) — matches the "never understate cost" design goal.

## Failure classification

Every failure is tagged:

- **D** — description-fixable (wording in a `SKILL.md` frontmatter)
- **T** — test-vector-fixable (query was mislabelled by the eval
  author; query's expected value should flip, or query should be
  rewritten to be unambiguous)
- **A** — accepted ambiguity (multi-label; the router is not
  objectively wrong, even if the labelled answer differs)

| # | Skill | Kind | Query | Loaded skills | Class |
|---|-------|------|-------|---------------|-------|
| 1 | `eloquent` | FP | "phpstan says mixed return type on my model method" | `eloquent, laravel, php-coder, quality-tools` | **D** |
| 2 | `eloquent` | FP | "what SQL does chunk() generate under the hood?" | `database, eloquent, sql-writing` | **A** |
| 3 | `php-coder` | FN | "my UserController is getting huge, split it into a service" | `code-refactoring, developer-like-execution, laravel, php-service` | **T** |
| 4 | `php-coder` | FP | "write a Pest test for the UserRepository" | `eloquent, laravel, pest-testing, php-coder` | **D** |
| 5 | `php-coder` | FP | "explain what strict_types does in PHP" | `php-coder` (only) | **D** |
| 6 | `skill-writing` | FN | "should this be a skill or a rule?" | `(none)` | **D** |

### D-class explanations (description-fixable, what to change)

- **#1** — `eloquent` wins on "model method" even though the intent
  is a PHPStan/type error. Either `quality-tools` needs a more
  prominent PHPStan trigger, or `eloquent` needs an explicit
  exclusion of static-analysis phrasing. Cheapest fix: add
  `phpstan | mixed | type error` to `quality-tools`.
- **#4** — `php-coder` over-fires on "UserRepository"; `pest-testing`
  was already loaded alongside, so lowering `php-coder`'s pull on
  "write … test" queries is sufficient. Add "NOT writing test code"
  to the tail of `php-coder`'s description.
- **#5** — `php-coder` description says *"writes or edits"* but
  the router triggers on *"explain"*. Add the word "explains" or
  "how does X work" explicitly as a **counter-example** in the
  `php-coder` tail, or direct explanation queries to `laravel` /
  `php-debugging` / a future language-concepts skill.
- **#6** — "should this be a skill or a rule?" loads nothing. Neither
  `skill-writing` (focus: authoring) nor `learning-to-rule-or-skill`
  (focus: capturing learnings) lead with the **format-decision**
  wording. `skill-writing`'s description already says
  *"skill-vs-rule decisions"* — not prominent enough. Promote it
  to the head of the trigger list.

### T-class explanation

- **#3** — the query's intent is *"split controller into service"*.
  Router picked `php-service` (exact scope) + `code-refactoring`.
  This is a **correct narrower routing**, not a miss. Relabel the
  test vector: `expected: false` for `php-coder`, or accept it as
  multi-label where `php-service` counts as a pass.

### A-class explanation

- **#2** — "what SQL does `chunk()` generate" is genuinely both an
  Eloquent question (`chunk()` is Eloquent) and an SQL-generation
  question (`sql-writing`). Loading both is defensible. Keep as-is.

## Phase 2 Decision Gate — status

| Criterion | Status | Notes |
|---|---|---|
| PoC stayed within LoC + cost + time budget | ✅ | $0.39 total, one session |
| Runs found ≥1 real triggering problem | ✅ | 4 D-class failures across 2 skills |
| Two runs differ by ≤5% precision/recall | ⏸ | **pending** — only 1 run per skill so far |
| Problem fixable by description rewrite alone | ✅ | 4 of 6 failures are D-class |

**Net**: 3 of 4 gate criteria are green. The single blocker is
reproducibility, which costs another ~$0.39 to resolve.

## Recommended next actions (not executed yet)

1. **Reproducibility run** — `task test-triggers-live -- <skill>`
   once more for each pilot. Compare Δprecision and Δrecall.
   Accept Phase 2 if every skill is within 5 percentage points.
2. **Description fixes** — open a small follow-up PR that touches
   only `quality-tools`, `php-coder`, and `skill-writing`
   descriptions. Re-run the evals afterwards; expectation is
   precision ≥ 0.9 on php-coder and eloquent, recall to stay at
   1.0 / 0.8.
3. **Test-vector fix** — relabel `php-coder` vector #3
   ("UserController … split into a service") to `expected: false`,
   or extend the runner to allow multi-label passes.
4. **Then** — only then: move to Phase 3 rollout (top-20
   coverage, CI integration per roadmap 3.2).

Nothing in steps 2-4 should happen until step 1 closes the gate.
