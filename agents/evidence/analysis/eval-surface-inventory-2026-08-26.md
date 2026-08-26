---
type: analysis
---

# Eval and golden-fixture surfaces — inventory, 2026-08-26

> Prerequisite for `road-to-skill-ecosystem-eval-integrity` Phase 1: a gate over
> "the measurement inputs" is only meaningful against a corpus somebody has
> counted. Measured on `origin/main` at `3f4508a9b`.

## What exists

| Surface | Count | Shape | Gated by `lint_eval_specs` |
|---|---:|---|---|
| `src/skills/*/evals/triggers.json` | 99 | activation axis: `queries[]` of `{q, trigger, language?}` | yes |
| `src/skills/*/evals/evals.json` | 42 | behavioural axis: `scenarios[]` of `{id, prompt, assertions[]}` | yes |
| `src/*/*/evals/domain-truth.json` | 9 | answer keys: `cases[]` of `{id, scenario, source, check}` | yes |
| `src/agent-src/commands/evals/*.json` | 24 | routing axis: `cases[]` of `{prompt, expected}` | yes |
| `src/skills/*/evals/strip_fixtures.json` | 1 | one skill's own fixture set | yes |
| `tests/golden/**` | — | replay baselines + `invariants.json` | **no** — see below |
| `internal/evals/*.json` | 4 | coverage floors, tier exemptions, soundness run/floor | **no** — see below |

**175 specification files** are in the gate's corpus (the first five rows), which
is the number `scanned:` publishes and the number the `min_scanned: 120` floor
protects.

## What is deliberately out of scope, and why

`tests/golden/**` is a REPLAY corpus, not a specification corpus: its baselines
are captured output, and the checks that own them (`check_condensation`,
`golden_replay.*`, `check_token_quality_golden`) compare a tree against a
recording. A structural lint over those files would either duplicate those gates
or start grading recorded output, and neither is this gate's contract.

`internal/evals/*.json` are FLOORS and exemption lists rather than cases — they
declare numbers other gates enforce. `check_eval_coverage` and
`check_domain_soundness` already read them, and a second reader with its own
opinion about their shape is how two gates start disagreeing about one file.

## Assertion kinds in the behavioural corpus

Seven, mirroring `_grade_assertions` exactly: `contains`, `not_contains`,
`file_exists`, `finding_floor`, `rubric`, `tool-choice`, `trajectory_budget` —
plus `event-choice`, added by Phase 1 Step 5 of this roadmap.

**One of the seven can be written so it enforces nothing.** `tool-choice`
requires only `kind` in the schema, so `{"kind": "tool-choice"}` is valid, parses
cleanly, grades no tool, and reports as a graded assertion. That is the
"grader whose configuration is absent" class in as many words. It is caught by
`lint_eval_specs` at `incomplete-grader`; the new `event-choice` kind cannot
express the same shape, because its schema requires at least one of its two
arrays via `anyOf`.

## Defect classes measured on the real corpus

Run before the gate was promoted, which is what Phase 1 Step 7 asks for:

| Class | Hits |
|---|---:|
| `duplicate-key` | 0 |
| `untracked-fixture` | 0 |
| `arithmetic-disagreement` | 0 |
| `incomplete-grader` | 0 |
| `declared-count-mismatch` | 0 |

**An honest null across all five**, and the reason the gate ships as an error on
day one rather than advisory: there is no inherited debt for an advisory period
to classify, so an advisory window would measure nothing and delay the
protection. Discrimination therefore rests on `--self-test` (7 cases, 5
rejecting) and on the `check_gate_coverage --canary` plant, both of which are
verified rather than asserted.

Only 18 of the 94 trigger files declare a count in prose at all, so
`declared-count-mismatch` has a corpus of 18, not 94. Stated because a "0 hits"
line over an unstated denominator is the kind of number this repository's own
gates exist to distrust.

## Three false positives the first implementation produced

Recorded because each is a check that looked correct and was not, and each is
now pinned by a test that must PASS:

1. **Chained derivations read as independent claims.** `500 x 0.80 / 0.02 = 400
   / 0.02 = 20,000` was read as a claim that `0.80 / 0.02 = 400`. Three findings
   on a corpus that was correct.
2. **`^` unparsed.** `1.12^3 = 1.404928` was captured as `3 = 1.404928`.
3. **A unit-scaled expectation.** A derivation working in dollars
   (`4,200,000,000 x 0.006 = 25,200,000 = $25.2M`) against an `expected` of
   `25.2`, because the scenario asks for the figure "in $M". Nothing in the file
   states the unit machine-readably. Resolved by tolerating a decimal SCALE and
   naming the weakening it accepts in `_lib/arith_claims.ts`.
