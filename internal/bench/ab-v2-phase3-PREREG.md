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
2. ~~**T2's endpoint does not exist.** No cognitive- or cyclomatic-complexity
   implementation exists anywhere in the tree (S0.3 delta #11, sized large). Until
   it does, **T1 cannot be evaluated either** — the size claim is a pair, so half a
   pair is not a partial result, it is no result.~~
   **DISCHARGED 2026-08-16.** `_lib/bench_ab_complexity.ts` computes Campbell
   cognitive complexity per changed function; `bench_ab_v2_stats.size_claim_verdict`
   evaluates T1 and T2 together and refuses a size win when complexity rose. T1 is
   evaluable. The pair reasoning is unchanged and now enforced in code rather than
   recorded here: an **unmeasured** endpoint returns `INCONCLUSIVE`, never a pass,
   so half a pair still cannot be reported as a partial result.
   Thresholds are untouched — they were registered while the run was impossible,
   which is the point, and nothing about this record has been fitted to data.
3. ~~**T4's and T5's endpoints do not exist.** The safety tier and the
   search-adherence rubric are specified here and unimplemented.~~
   **DISCHARGED 2026-08-17.** Both producers ship.
   `_lib/bench_ab_safety_tier.ts` + `bench_ab_v2_safety.ts` score T4 by
   **executing** an adversarial input against each trial's preserved workspace —
   this record tags only T5 `rubric-judged`, and T4's own wording is
   *adversarial-input execution*, so T4 needs no model call and no spend at all.
   The tier is the corpus tasks carrying a `safety_oracle` (three ship:
   `safeF-guard-01..03`), and each probe is calibrated by mutation — the pristine
   fixture reports a held guard, deleting exactly the guard block reports a
   breach, and an unloadable module reports **unmeasured** rather than either.
   `_lib/bench_ab_search_adherence.ts` + `bench_ab_v2_search.ts` score T5 against
   the frozen transcript at the pre-registered k=2, crediting a rubric item only
   when both judges credit it; `bench_ab_v2_stats.search_claim_verdict` evaluates
   it. Both endpoints report an unmeasured trial as absent, never as a zero or a
   `false`, so neither can degrade into a claim about the run.
   Thresholds are untouched — they were registered while the run was impossible,
   which is the point, and nothing about this record has been fitted to data.
   **What this does NOT discharge:** precondition 4. T5 needs a transcript
   preserved beside the clone, which sweeps run before 2026-08-17 did not write,
   so on an older report every T5 observation is legitimately absent.
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
- The T1/T2 endpoints and the Goodhart guard (delta #11, 2026-08-16), plus
  `bench_ab_v2_complexity.ts` — the offline re-scorer that cashes in the previous
  line: it reads a finished report's preserved workspaces and writes `added_lines`
  and `median_cognitive_complexity` onto each trial, so a sweep that already ran
  gains the pair without spending again.
- A no-network `--mode selftest` (delta #8) and
  [`REPRODUCE-ab-v2.md`](REPRODUCE-ab-v2.md).
- The T4 and T5 endpoints (2026-08-17), plus `bench_ab_v2_safety.ts` and
  `bench_ab_v2_search.ts` — two more offline re-scorers on the delta-#7 pattern.
  T4 is free to run; T5 costs two judge calls per trial and therefore defaults
  to a deterministic mock, with live judging opt-in behind `--live`. Neither runs
  on the metered sweep path: T4 because executing produced code during a sweep
  would put a hang on the paid side, T5 because a judge failure mid-sweep would
  otherwise mean re-running the arm rather than re-judging the transcript.
- Per-trial preserved **transcripts**, written beside the clone rather than into
  it — T5's equivalent of delta #7, and the reason a completed sweep can gain
  the endpoint without being re-run.

---

## Amendment v2 — 2026-08-26 · verdict method

**Status:** adopted. **Decided by:** AI council, 2026-08-26, 2/2 convergent
(`anthropic/claude-sonnet-4-5` + `openai/codex-default`), on a maintainer
delegation for an autonomous drain run. Question and both answers:
`agents/runtime/council/questions/prereg-verdict-method.md` and the response
beside it. **Driven by:** `road-to-skill-ecosystem-eval-integrity` Phase 2.

### What changed

The **significance half** of the T1/T2 endpoints moves from a Wilcoxon
signed-rank *p* to an **exact one-sided sign test over non-tied pairs**
(`src/scripts/_lib/paired_verdict.ts`). Wilcoxon ranks by |difference| and is
therefore magnitude-weighted; that was shown to disagree with the exact test on
twelve records up to ten trials and to be the **permissive** side in every one
of them. The visible symptom is inverted, which is why it went unnoticed: an
artifact that won every trial still failed, because a few large
opposite-direction deltas outweighed a clean sweep of small ones.

### What did NOT change, and this is the load-bearing half

`T1_MEDIAN_LINES_PCT = -10` is **unchanged and still independently binding**.
Both council seats required this separately and it is the reason the amendment
is safe: a sign test answers *did this help more often than it hurt* and says
nothing about *how much*. Replacing Wilcoxon outright would let a clean sweep of
negligible improvements claim a **size** win. So the claim now rests on two
propositions that must both hold:

| proposition | test | bar |
|---|---|---|
| directional reliability | exact one-sided sign test over non-tied pairs | p ≤ 0.05 |
| practical magnitude | pre-registered median added-lines change | ≤ −10 % |

Dropping either is a different claim and needs its own amendment.

### Full specification of the applied test

- **Tail:** one-sided, in the direction of interest. A negative delta is the
  improvement for both added lines and cognitive complexity.
- **Tie classification:** |delta| ≤ 1e-9 is a tie. That is the same epsilon
  `wilcoxon()` already uses to drop zeros, so "non-tied" means one thing across
  the whole report.
- **Ties are excluded before anything is counted.** A tie carries no direction
  and must not dilute the sample; a magnitude-weighted interval gets this wrong
  in both directions at once (zero contribution to the mean, full contribution
  to *n*).
- **Alpha:** 0.05, matching every sibling endpoint in this report.
- **Minimum non-tied pairs: 5, DERIVED not chosen.** The smallest attainable
  one-sided *p* on *n* non-tied pairs is `0.5 ** n`; a pass at 0.05 is
  arithmetically impossible until `0.5 ** n ≤ 0.05`, first true at n = 5.
  `deriveMinDiscordant()` recomputes it, so a future alpha change moves the
  floor rather than leaving a stale constant.
- **Below the floor → `underpowered`,** which is neither a pass nor a
  regression and appears in no pass-rate denominator (`passRate()` is the only
  sanctioned way to compute one, because an inline filter reinstates the defect).
- **Exactly on the floor → a warning.** A pass then needs every pair to agree;
  one dissent moves *p* to 0.1875 against a bar of 0.05, so the run is decided
  before it starts. Observed as five specifications raised to exactly the floor
  all failing, four of them decided in advance.
- **All pairs tied → `underpowered`,** never a null result.

### Asymmetry between a claim and a refusal

A **PASS** requires the direction bar to be MET. A **REFUSAL** (anti-golfing)
fires on **either** signal — the direction counts when present, the legacy
Wilcoxon *p* otherwise. Applying the strict reading to both would make the
refusal disappear on any report lacking direction counts, and a missing input
silently rescuing an arm is precisely the failure a refusal exists to prevent.

### Is this fitting to data?

**No for the target population, and the honest qualifier is stated rather than
implied.** `internal/bench/reports/ab-v2/` is empty and this record's own
preconditions 2–4 state the run is impossible, so no Phase-3 outcome exists to
fit to. What DID inform the method choice is twelve **non-Phase-3** records — a
council seat pressed on exactly this and the framing "before any data" was
withdrawn as incomplete. The accurate statement is: *before any Phase-3 outcome
data, informed by analysis of twelve non-Phase-3 records.*

Consequently those **twelve diagnostic records are frozen as development
fixtures and are excluded from any confirmatory Phase-3 analysis.** Both seats
required this independently and it is not optional: evidence that selected the
method cannot also be evidence for the result.

One assumption is named rather than assumed away, at a council seat's
insistence: calling the magnitude-weighted side "permissive" presumes the exact
test is the reference. That presumption is stated here so a future reader can
contest it.

### Revisit-if

- Any Phase-3 or intended-population pilot outcome was inspected before this
  amendment (it was not — the report directory is empty).
- Directional consistency alone ever becomes sufficient to substantiate the size
  claim; the magnitude bar dropping is a separate amendment, not a refactor.
- Evidence emerges that the exact sign test has its own permissive-side failure
  modes.
- Method selection is again informed by empirical analysis of a non-target
  population, which is the general shape this amendment is a case of.
