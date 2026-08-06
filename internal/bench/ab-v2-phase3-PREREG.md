# `ab-v2` Phase 3 — pre-registration (fixed before any paid run)

Registered 2026-08-06 · owner: maintainer · `road-to-solution-minimalism` Phase 3.

**Status on registration day: the run this record binds cannot yet be fired.** Two
gates stand — the spend grant (`benchmark-spend-authorization`, owner: user) and
three absent endpoints named in § Endpoints that do not exist. This record exists
anyway, and that is the point: thresholds written after seeing data are not
thresholds. Registering them while the run is impossible is the strongest possible
guarantee they were not fitted to a result.

## What is measured

Whether the solution-size ladder — shipped as rule text in
`improve-before-implement` with this package's safety floors **routed**, not
restated — reduces the size of a change without paying for it somewhere else.

**Not measured:** whether minimalism is good. The comparison is deliberately
narrow: the ladder against the same package without it, and both against a naked
principle, so what survives is a claim about *this artefact*, host-scoped, with
the floors' contribution measured rather than asserted.

## Arms

| arm | what reaches the model |
|---|---|
| `vanilla` (baseline) | plugin scoped away, no injection |
| `package` | the real plugin as shipped — the ladder rule is `type: auto` and keyword-triggered, so it reaches the model only when a task's wording trips `refactor\|implement\|migration` |
| `package-ladder` (treatment) | the same plugin config, with the ladder rule body injected so it is guaranteed in context |
| `bare-principle` (control, F6) | plugin scoped away, one authored sentence, **no floors routed** |
| `placebo` | plugin scoped away, inert prose length-matched to the package footprint |

The `package` → `package-ladder` contrast is the primary comparison. The
`bare-principle` arm is what makes the floors falsifiable: F6 measured a bare
critic prompt nearly matching a full minimalism artefact on size while being the
only arm that dropped a safety guard.

## Binding thresholds — declared before any data

The ladder graduates to **default-on** only if **every** row holds. Miss any one
and it stays opt-in and the null is published with the same honesty labels the
existing nulls carry.

| # | metric (`package-ladder` vs `package`) | threshold | why this number |
|---|---|---|---|
| T1 | median added lines | **≤ −10 %** at **p < 0.05** | Calibrated to the **independent** measurement (−15.4 % code, p=0.088 on 80 tasks nobody chose for the purpose), not to the source's own −54 % headline (mean, hand-picked tickets, n=4). −10 % sits inside the independent effect with room for a weaker paired design; requiring −15 % would pre-register a number the independent run itself did not reach at p<0.05. |
| T2 | median cognitive complexity per changed function | **no significant rise** | F9: LLM-generated code is on average shorter but denser, so a lines-only metric actively rewards golfing. Lines down **and** complexity up fails T1 even at p<0.05 on lines alone — the size claim is a *pair*, and this is the half that makes it one. |
| T3 | discipline rubric | **no significant regression** | The ladder is additive discipline; buying size with a loss of the discipline it sits next to is not a win. |
| T4 | safety tier (adversarial-input execution on surgical tasks) | **no significant regression** | F6's guard-drop was a path-traversal check deleted to save ~3 lines. This is a **disqualifier**, not a side metric (see § Goodhart). |
| T5 | search-adherence (rubric-judged, k=2) | **no significant regression** | F8: the ladder enforces a *search* discipline; lines-of-code measures output volume. A run can shrink a diff without anyone having looked for an existing mechanism, so a size-only report would measure the wrong hypothesis. |

Statistics: paired non-parametric tests. Errored pairs are dropped from **both**
arms and the drop asymmetry is reported (it already is — the attrition block,
delta #5). Significance is two-sided; "no significant regression" means the test
does not reject at p < 0.05 in the harmful direction.

## Goodhart guard — binding, not advisory

A size metric is a **measurement**, never a scored target. Concretely: the scorer
may not rank an arm above another on size alone when its safety tier regressed. An
arm that saves a line and drops a guard has lost, not won.

## Hygiene ladder — publish nothing below full

`selftest` → 10-task smoke → k=3 → full. **Nothing below the full tier is
published**, because F4 measured the same benchmark's 10-task smoke showing +9.6 %
cost and collapsing quality while the full 80 showed the opposite. Every report
states which tier produced it (`tier` in the payload); the selftest additionally
carries `synthetic: true` and cannot be quoted at all.

Every number that ever appears in prose renders from a pinned report. Hand-typed
figures are forbidden (F7).

## Preconditions — what must exist before this record can be acted on

Registered as reopen terms, so the next attempt starts from a declared bar:

1. **The spend grant.** `benchmark-spend-authorization`, owner: user. ~$150–250 as
   a floor for 30 tasks × 4 arms × 3 seeds on sonnet. Firing a paid external run
   without it is a Hard-Floor action.
2. **T2's endpoint does not exist.** No cognitive- or cyclomatic-complexity
   implementation exists anywhere in the tree (S0.3 delta #11, sized large). Until
   it does, **T1 cannot be evaluated either** — the size claim is a pair, so half a
   pair is not a partial result, it is no result.
3. **T4's and T5's endpoints do not exist.** The safety tier and the
   search-adherence rubric are specified here and unimplemented.
4. **A pinned external repo and its task oracles do not exist** (deltas #9 + #10).
   The corpus carries no `repo`/`sha` keys and every fixture is a self-contained
   in-repo tree.

Consequence, stated plainly: granting the spend does **not** make this run
possible. The grant unblocks the money; preconditions 2–4 are a harness-extension
project.

## What is already in place

- The paired sweep, the deterministic scorer, and checkpoint/resume.
- The activation audit in both directions, wired as an exit-2 gate (delta #1) —
  the harness can no longer produce the specific invalid null it produced once.
- `tokens_breakdown` on every trial (delta #2), model-id verification (delta #3),
  a sweep-level `--max-usd` abort (delta #4), attrition reporting (delta #5).
- A bucket-priced cost sheet in the report (delta #6) — Table 3b, with the price
  sourcing date and its age against the report's own stamp. An unpriceable model
  reports `null`, never `0`.
- Per-trial preserved workspaces (delta #7) — which is what makes T2 retro-fittable
  onto completed runs once its endpoint exists, instead of requiring a re-run.
- A no-network `--mode selftest` (delta #8) and
  [`REPRODUCE-ab-v2.md`](REPRODUCE-ab-v2.md).
