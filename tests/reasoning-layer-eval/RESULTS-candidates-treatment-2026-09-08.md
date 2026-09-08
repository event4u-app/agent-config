# Results — candidate-forms treatment arm, 2026-09-08

Steps 3.1 and 3.2 of `road-to-candidate-moves-floor`. The treatment half of the
dim-5 reading whose baseline is `RESULTS-candidates-baseline-2026-09-07.md`.

| Item | Value |
|---|---|
| Corpus | `golden-transcripts/l6-corpus.json` — 16 slots, all `band: standard` |
| Arms | `distributed`, `orchestrated` — both already RDP-treated |
| Treatment | `CANDIDATES_BLOCK` appended to **both** arms' system prompts |
| Captured output | `golden-transcripts/l6n-candidates-treatment.json` (`mode: l6+candidates`) |
| Model under test | `claude-haiku-4-5-20251001` |
| Rater | `claude-sonnet-4-5` — the same rater as the baseline |
| Calls | 32 capture + 32 rater = 64 |
| Actual spend | **$0.7933** (dry-run worst case was $1.2068) |
| Baseline compared against | `golden-transcripts/l6n-dim5-baseline.json`, captured 2026-06-22 |

The block is appended to **both** arms rather than becoming a third arm because
`l6-corpus.json` carries no per-slot treatment field and the comparator is the
32 stored transcripts — 16 slots × the same two RDP framings. Appending to both
keeps the candidates block the single variable.

`Candidates:` was instructed **in the eval's system prompt only.** Nothing was
added to `src/rules/` or to `mandated-lines.md`; `git diff origin/main` over
`src/scripts/lint_mandated_lines.ts` and
`src/agent-src/contexts/execution/mandated-lines.md` is empty. That is the
2026-09-07 split council's authorised half.

## Step 3.1 — the three deterministic counts, before any scoring

`./scripts-run src/scripts/check_candidate_lines --corpus <run>`

| Count | Treatment | Baseline (same checker, as control) |
|---|---|---|
| transcripts | 32 | 32 |
| `Candidates:` line present | **1** | 0 |
| `K0` present | 1 | 0 |
| axes pairwise distinct | 1 | 0 |
| `K0` actually drawn as the choice | 0 | 0 |
| shape findings | 0 | 0 |

**Instruction delivery was 100 % by construction and compliance was 1 of 32
(3.1 %).** The runner logged the appended block on every call and the results
envelope records `mode: l6+candidates`, so all **32 capture** calls carried the
instruction. One transcript produced the artifact.

The compliance denominator is the 32 *generation* transcripts, not the 64 total
calls — the other 32 are rater calls, and whether a rater received the
instruction is irrelevant to whether the model under test produced the line.
The 2026-09-08 verdict council asked for that clarified after an earlier draft
of this file said "all 64 calls".

The one that did (slot 10, `ss-name-retry-fn`, `distributed`) scored dim5 = 3:

> `**Candidates:** K0 <keep searching for existing utility> · A
> `retryWithExponentialBackoff` [naming: verb-first, descriptive] · B
> `exponentialBackoffRetry` [naming: adjective-first, concise] → A; verb-first
> reads as an action.`

A crude probe for alternatives surfaced in **prose** instead (`alternative`,
`option A`, `two approaches`, `trade-off between`) matched **0 / 32**, so the
gain below is not visibly a switch to narrative enumeration either.

### The detector correction, recorded because it nearly published a false zero

The first reading of this step said `Candidates line present: 0`. The checker's
pattern had been copied from the shipped `INTENT_RE`, which anchors a bare label
at line start and matches no markdown emphasis — so `**Candidates:**`, the form
the one compliant model actually used, was invisible to it. A detector that
cannot see what it counts reports the thing was not emitted, silently, in the
direction that looks like a finding.

Widening was then wrong the other way on the first attempt: an `i` flag applied
to the sibling counter took its population from 0 to 172, almost every new match
a lowercase `intent:` YAML key in a prompt-pattern config. Both patterns are now
emphasis-tolerant **and** case-sensitive, and
`tests/scripts/check_candidate_lines.test.ts` pins the real `**Candidates:**`
line from this run as a regression fixture.

## Step 3.2 — the delta against the baseline, and the cost

`./scripts-run src/scripts/rdp_candidates_delta --baseline <base> --treatment <treat>`

Computed from the two stored runs, joined on slot plus variant name. A join hole
exits 2 rather than computing a delta over a partial join; there were none —
32 of 32 paired.

### dim 5 — form-alternative surfacing, intention-to-treat (primary)

```
baseline  mean 0.875 / 3   (29.2 %)   n=32
treatment mean 1.156 / 3   (38.5 %)   n=32
delta          +0.281 / 3   (+9.4 pp of the 0-3 scale)

scoring 0 (one form only): 18/32 → 14/32
scoring >= 2:               8/32 → 11/32
by family:  ms  0.813 → 1.000  (+0.187)
            ss  0.938 → 1.313  (+0.375)
```

Intention-to-treat is the primary reading on the 2026-09-08 council's
instruction: conditioning on whether the model complied selects treatment
outputs on post-treatment behaviour and biases the estimate. The
compliance-conditioned figure is dim5 = 3.000 at **n = 1**, reported as
exploratory and carrying no weight.

### dim 1 — the notes-first tripwire

```
baseline 2.906 / 3 → treatment 3.000 / 3    delta +0.094
```

The tripwire did **not** fire. Step 3.3's third outcome — dim 5 rising while
dim 1 falls, meaning the line is being emitted into the reply instead of the
notes — is not what happened. Dim 1 rose.

### The cost guard

The published L10 bar is ~5 % output-token overhead on the trivial proxy
(`README.md` § Fail conditions, `rubric.md:74`), which for this corpus is the 8
single-step (`ss`) slots — the bridge argued in
`RESULTS-candidates-baseline-2026-09-07.md:64-70`.

```
mean per-slot overhead:   -8.1 %   n=16
token-weighted overhead:  -8.0 %   (8,542 → 7,858 output tokens)
```

Output got **shorter**. The guard passes with margin. Per-slot spread runs from
-58.3 % (slot 10, `orchestrated`) to +30.1 % (slot 11, `distributed`), so the
mean is reported beside the token-weighted figure rather than instead of it — a
mean of per-slot percentages is dominated by small denominators.

This is *treatment versus baseline*, which no stored field holds. The
`output_token_overhead_pct` already in each run is arm-versus-arm **within**
that run and is a different number.

## Against the published bar

`README.md` § Metrics sets treatment − baseline at **≥ +15 %** on a standard
host and ≥ 0 on a strong-reasoning host. The roadmap renders the same bar as
**+15 pp** (`:77`). Both readings of the unit are recorded rather than one
picked, because the two source documents disagree:

- as a fraction of the 0-3 scale: **+9.4 pp** against +15 → **below the bar**
- as a relative change on the baseline mean: 0.875 → 1.156 is **+32.1 %**
  against +15 % → above it

The two are not the same quantity and the bar's own wording does not say which
it means. The +9.4 pp reading is the conservative one and is the one step 3.3's
verdict rests on. Recording both is not hedging — picking the flattering unit
silently is how a sub-bar result gets reported as a pass.

## What this corpus cannot answer

**All 32 transcripts on both sides carry `band: standard`.** The bar's second
half — "no regression (≥ 0) on a strong-reasoning host" — is **unmeasured and
stays unmeasured** until a strong-band capture is paid for. The case that
produced this roadmap was maintainer reasoning on a strong host, which is
precisely the band this reading does not cover. Any verdict is scoped to the
band it measured and claims nothing about the other.

**Single rater on both sides**, recorded as a confidence caveat per `rubric.md`
§ Scoring. The baseline dim5 distribution is bimodal (18 at `0`, 6 at `3`).

**n = 32 with a compliance denominator of 1.** Whatever moved dim 5, it was
almost certainly not the artifact under test being produced.

## Step 3.3 — the verdict

**A fourth outcome. None of the three the roadmap named describes this
measurement, and closing on one that misdescribes the data would be worse than
closing on a fourth.**

> **Treatment signal observed; line validation failed. Retain the evaluation
> artifacts and the block for research. Promote neither the line nor the prose.**

Decided by a 2-seat AI council on 2026-09-08 (3 rounds, depth deep, blind
chairman, quorum 2/2, $0.0000 billed — subscription transport). Convergent on
all four questions. Why each of the three named verdicts is wrong:

- **KEEP** is what the literal rule selects — dim 5 moved and the cost guard
  passed — and it is wrong, because it would assert that the *emitted artifact*
  earned the improvement. At 1/32 compliance the artifact was almost never
  produced. The preregistered rule was written assuming the treatment would be
  delivered; following "dim 5 moved" while ignoring "the line was not produced"
  is the post-hoc rationalisation, not the refusal to.
- **DELETE** misdescribes it too: dim 5 *did* move, and the two results files
  are not the whole deliverable.
- **The third outcome did not occur.** Dim 1 rose (2.906 → 3.000), so the line
  was not being emitted into the reply instead of the notes.

### The arithmetic that settles attribution

The delta is **exactly 9 rubric points** across the 32 paired cells (baseline
sum 28 → treatment sum 37; 0.28125 × 32 = 9). One transcript emitted a line,
and it moved 0 → 3.

**So 3 of the 9 points came from the one compliant transcript and 6 came from
transcripts that emitted no line at all.** Whatever moved dim 5, it was mostly
not the artifact under test. That is the attribution finding, and it is
checkable from the two stored runs rather than argued.

Recomputing the per-cell movement makes the reading weaker still:

```
improved   10 cells   +20 points gross
regressed   7 cells   -11 points gross
unchanged  15 cells
net                    +9 points
```

Gross movement is 31 points to net 9. With a single rater and a baseline whose
distribution is bimodal (18 at `0`, 6 at `3`), that much churn is a
**replication risk**, not a confidence caveat: a different rater scoring the
boundary cases the other way erases most of the gain.

### The bar, and what it cannot say

Neither reading of the published bar satisfies the *complete* criterion,
because its second half — no regression on a strong-reasoning host — was never
measured. Under the conservative unit the first half fails as well:
**+9.4 pp against +15 pp.**

### Recorded dissent

The two seats disagreed on two points, and both are recorded rather than
smoothed:

1. **How strong the negative claim may be.** Seat 1 read the result as the line
   form "tested and not validated", adding that 3.1 % is "worse than does not
   reach — models actively refuse to produce it even when directly instructed".
   Seat 2 objected that this is too universal: what was falsified is *reliable
   production under this prompt placement, model and corpus*, and the
   experiment did not isolate whether the failure belongs to the line form, its
   placement, notes-channel behaviour, or instruction competition. **Seat 2's
   narrower wording is the one published above**, because it is the claim the
   evidence carries.
2. **Whether the historical control confounds the reading.** Seat 2 held that a
   June baseline against a September treatment leaves model, runtime and
   infrastructure drift as plausible explanations for a 9-point aggregate. Seat
   1 dismissed this as "practically weak" on the ground that the two arms were
   captured on "the same date". **That premise is factually wrong** — the
   baseline JSON records `date: 2026-06-22` and the treatment `2026-09-08`, 78
   days apart — so seat 2's concern stands and seat 1's dismissal of it does
   not. The reading is a historical-control comparison and is labelled as one.

### What follows, and what does not

The `CANDIDATES_BLOCK` stays **eval-only**, in `rdp_quality_eval.ts`. Nothing
is promoted: not the sixth mandated line, and not a prose form of the same
instruction — the block bundled six obligations (generate alternatives, attach
axes, retain `K0`, choose, justify, format) and this design isolates none of
them.

The +9.4 pp is recorded as a **directional observation**, not a result. Both
seats named the same follow-up shape, and it is recorded here rather than
started: a contemporaneous randomised control, separate prose-only and
mandated-line arms, a **preregistered minimum-compliance gate assessed before
efficacy**, the required strong-band host, and a second blinded rater.

## Reproduction

```bash
# treatment capture (billable)
RDP_EVAL_ALLOW_NONTTY=1 ./scripts-run src/scripts/rdp_quality_eval \
  --mode l6 --corpus tests/reasoning-layer-eval/golden-transcripts/l6-corpus.json \
  --candidates --score-with claude-sonnet-4-5 \
  --results tests/reasoning-layer-eval/golden-transcripts/l6n-candidates-treatment.json \
  --date 2026-09-08 --confirm

# the three deterministic counts (free)
./scripts-run src/scripts/check_candidate_lines \
  --corpus tests/reasoning-layer-eval/golden-transcripts/l6n-candidates-treatment.json

# the delta (free)
./scripts-run src/scripts/rdp_candidates_delta \
  --baseline tests/reasoning-layer-eval/golden-transcripts/l6n-dim5-baseline.json \
  --treatment tests/reasoning-layer-eval/golden-transcripts/l6n-candidates-treatment.json
```

The rater is non-deterministic, so a re-run will not reproduce the table
exactly. The two stored JSON runs are the artefacts; the aggregates above are
recomputed from them by `rdp_candidates_delta`, whose arithmetic is pinned
against this baseline's published figures in
`tests/scripts/rdp_candidates_delta.test.ts`.

**Per-slot transcript markdown was not written for this run.** `--candidates`
originally reused the plain `l6n-` prefix and overwrote all 16 committed June
baseline transcripts mid-capture. The measurement survived — `--results` pointed
elsewhere and every transcript body is in that JSON — but the baseline's
human-readable artefacts had been replaced by treatment ones under the
baseline's own names, which would have made a later markdown comparison compare
the treatment against itself. The June files are restored and the prefix is now
`l6n-cand-`; regenerating this run's markdown would cost a second capture, so
the JSON is the artefact.
