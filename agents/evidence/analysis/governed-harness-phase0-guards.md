<!-- evidence-type: analysis -->

# Governed harness evolution — the Phase-0 guards

`road-to-governed-harness-evolution` steps 0.4, 0.5 and 0.6, executed
2026-08-30. All three are **pre-registration**: the runner they guard does not
exist yet, Phases 1-7 are unbuilt, and that is the point. A budget written after
the first run describes what was spent; a leakage abort written after the first
leak is a post-mortem.

Everything below is in `src/scripts/_lib/harness_evolution_guards.ts` and
`src/config/harness-evolution-budget.json`, with 16 tests in
`tests/scripts/harness_evolution_guards.test.ts`.

## 0.4 — the trust boundary is now detectable

The master design named which fields are proposer-visible and which are
evaluator-private, and stopped at the naming. A declared boundary that nothing
checks holds until the first convenient exception.

Three classes, and the third is the load-bearing one:

| class | meaning |
|---|---|
| `proposer-visible` | the proposer may read it — candidate text, public metric names, the task |
| `evaluator-private` | the evaluator reads it, the proposer never does — per-trial raw scores |
| `holdout` | sealed-partition truth. Disclosure **invalidates the run**, not just the trial |

`discloseToProposer()` releases an observation field by field, **logs every
field it releases**, and throws `HoldoutLeakError` naming the field on the
first `holdout`. It does not redact: a proposer that has seen sealed truth
cannot be evaluated against it, and no later stage can undo that.

**It fails CLOSED on an undeclared field.** A field with no class is treated as
`holdout`. The alternative — defaulting to visible — makes *forgetting to
classify a new field* silently equivalent to publishing it, which is the exact
shape of the defect step 0.4 exists to close. Pinned by its own test.

An `evaluator-private` field is withheld **without** throwing. It is not a leak,
it is simply not the proposer's; conflating the two would make the abort fire so
often it would be routed around.

## 0.5 — the budget aborts, and aborts first on a countable dimension

Pre-registered in `src/config/harness-evolution-budget.json`:

| ceiling | value | why this number |
|---|---|---|
| `max_candidates` | 5 | the roadmap's First cut asks for 3-5 candidates on ONE dimension; a run wanting six is a run that changed the cut |
| `max_trials_per_candidate` | 20 | room above `paired_verdict`'s DERIVED discordant floor for a 10-query corpus run in both orders. **Not a power calculation** — a ceiling with its reasoning, not a computed sample size |
| `max_spend_cents` | 500 | the cut is spend-bearing (`description_route_check.ts:112-125` routes through a model backend). A deliberately small first ceiling: the point of the invariant is that the run STOPS at it |

`assertWithinBudget()` **aborts rather than truncating**, which is the whole
distinction the step draws: a truncated run yields `underpowered`, which
`_lib/paired_verdict.ts:26` refuses to call a pass and which a reader mistakes
for one.

It checks candidates, then trials, then spend. When several are over it fails on
the countable one first — that message is actionable without any pricing
discussion, and the ordering is pinned by a test so a refactor cannot silently
reverse it.

## 0.6 — four stop conditions, three detectors, one honest null

A spend cap stops on **cost**. Most of the reasons to stop are about
**validity**, and both parent designs carried eight or nine of them before the
master compressed them into the budget cap.

| condition | detector |
|---|---|
| `holdout-underpowered` | `holdoutUnderpowered` |
| `evaluator-leakage` | `discloseToProposer` (throws) |
| `diversity-collapse` | `diversityCollapsed` |
| `cross-component-interference` | **none — model-carried** |

The fourth is written out rather than left to inference. Deciding whether two
changes interfere needs a causal model of the components and this programme has
none; a detector here would pattern-match on file paths and report confidence it
does not have. A test asserts that **exactly one** condition is model-carried
and that it is this one, so a later addition cannot quietly join it.

`diversityCollapsed` is deterministic and deliberately crude — normalise, count
distinct. No embedding, no model call: a detector that needs a model to decide
whether to stop a model run can fail the same way as the thing it watches. It
**under-detects** (a synonym reads as distinct), and that direction is chosen:
a false stop discards a valid run, while a missed stop is caught downstream by
the verdict coming back `no-change`.

`holdoutUnderpowered` takes the floor as an argument rather than restating a
number. `MIN_DISCORDANT` in `paired_verdict` is *derived* from the exact sign
test at `ALPHA`, not chosen, and a second constant here would be a fork of a
derivation. The test imports the real one.

## What this does NOT do

- It does not run anything. Nothing here spends, fetches, or writes — the guards
  are pure functions over declared state, so a future runner can call them
  before it does any of those.
- It does not make the First cut executable on its own. That cut still needs the
  candidate variant (3.1), the deterministic proposer (3.5) and the lifecycle
  enum (3.4). What it removes is the sequencing hazard the roadmap names: the
  budget invariant had to exist before step 3 of the cut, and now does.
- It does not resolve `merge-authority`. Phase 7 stays gated; 0.8 stays `[~]`.
