# dim-5 baseline — form-alternative surfacing, 2026-09-07

`road-to-candidate-moves-floor` step 1.3. The baseline arm for the fifth rubric
dimension, scored off transcripts that **predate every change in that roadmap**.

## Why this is a baseline and not a run

The 32 transcripts in `golden-transcripts/l6n-results.json` were captured
2026-06-22, months before `dim5` existed and before any `Candidates:` obligation
was drafted. Re-scoring them is therefore the only way a baseline for this
dimension can exist at all: re-*capturing* them under today's suite would produce
a different corpus, and the treatment arm would then be compared against
something that is not its own baseline.

**Zero capture calls.** `rdp_quality_eval --score-only` reads the stored
transcripts from disk and sends them to the rater; no assistant call is made.

| Field | Value |
|---|---|
| Source transcripts | `golden-transcripts/l6n-results.json`, captured 2026-06-22 |
| Scored output | `golden-transcripts/l6n-dim5-baseline.json` |
| Rater model | `claude-sonnet-4-5` |
| Transcripts scored | 32 (16 slots × 2 variants: `distributed`, `orchestrated`) |
| Capture calls | **0** |
| Rater cost | ~$0.3360 |
| Unparsable rater replies | **0** |
| Command | `rdp_quality_eval --score-only <src> --score-with claude-sonnet-4-5 --results <out> --confirm` |

## The reading

```
dim5 distribution:  0 → 18 · 1 → 6 · 2 → 2 · 3 → 6
dim5 mean:          0.875 / 3   (29.2 %)
dim5 == 0:          18 / 32   (56.3 %)
dim5 >= 2:           8 / 32   (25.0 %)
```

**More than half the corpus generates exactly one solution form.** That is the
defect `road-to-candidate-moves-floor` exists to address, measured rather than
asserted.

### The finding that matters most: dim 3 cannot see this

| Dimension | Mean over the same 32 transcripts |
|---|---|
| dim1 notes-first | at or near ceiling — `3` on 29 of 32 |
| dim3 premature-solution avoidance | at or near ceiling — `3` on 27 of 32 |
| **dim5 form-alternative surfacing** | **0.875 / 3** |

The corpus is already excellent at resolving the load-bearing unknown before
dependent work, and simultaneously generates one form 56 % of the time. That is
exactly the roadmap's premise — dim 3 scores sequencing *inside* a chosen form
and is structurally blind to whether a second form was ever on the table — and
it is now a measurement rather than an argument. If the two dimensions measured
the same thing, dim 5 could not sit at 29 % while dim 3 sits at ceiling.

### Per family

| Family | n | dim5 mean | zeros |
|---|---|---|---|
| `ms-*` multi-stage | 16 | 0.812 | 9 |
| `ss-*` single-step | 16 | 0.938 | 9 |

The two families are indistinguishable, which is itself informative: the
single-step slots are this corpus's trivial-task proxy, and a trivial task
*legitimately* has one form. The absence of a gap means the multi-stage slots —
where a second form genuinely exists — are not scoring better than the ones
where it does not. **Step 2.3's not-owed decision classes must be applied before
the treatment comparison is read**, or the `ss-*` slots will drag both arms down
equally and mask the effect the treatment is supposed to have on `ms-*`.

## What this corpus cannot answer — step 1.4

**All 32 transcripts carry `band: standard`. There is no strong-reasoning-band
transcript in the corpus, so the published bar's second half — "no regression
(≥ 0) on a strong-reasoning host" — is UNMEASURED and stays unmeasured until
someone pays for a strong-band capture run.**

This is stated rather than left implicit because the case that produced this
roadmap was maintainer reasoning on a strong host, which is precisely the band
this reading does not cover. A standard-band-only result must not be reported as
if it settled both halves. Any verdict written under step 3.3 is scoped to the
band it measured and claims nothing about the other.

## Reproducing this

```bash
./scripts-run src/scripts/rdp_quality_eval \
  --score-only tests/reasoning-layer-eval/golden-transcripts/l6n-results.json \
  --score-with claude-sonnet-4-5 \
  --results tests/reasoning-layer-eval/golden-transcripts/l6n-dim5-baseline.json \
  --confirm
```

The rater is non-deterministic, so a re-run will not reproduce the table
byte-for-byte. `l6n-dim5-baseline.json` is committed so the reading above is
auditable against the exact scores it rests on, and so the treatment arm is
compared against a fixed baseline rather than a freshly re-rolled one.

**Single rater, recorded as a confidence caveat** per `rubric.md` § Scoring —
two raters were not run. The distribution is bimodal (18 at `0`, 6 at `3`) with
few middle scores, which is what a dimension with sharp anchors should produce
and is weak evidence that the rater applied them rather than averaging.
