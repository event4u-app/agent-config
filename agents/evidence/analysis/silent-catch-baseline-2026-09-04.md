<!-- evidence-type: analysis -->

# Silent-catch detector — the counted baseline before any promotion

Recorded 2026-09-04 by `road-to-deterministic-defect-detectors` step 3.2. The
step's requirement is exact: the check "runs over a recorded range of merged
commits and the finding count is written down before any promotion is
discussed". This is that number. It is **not** an argument for promotion.

## The range, so the run is reproducible

```bash
./scripts-run src/scripts/detect_silent_catch --range d1861bad2d276e78268d5515444b9ef36897dda2..b75d7f7cb0a9bfdf88fad7df7b66090f5312d5a3
```

- base: `d1861bad2d276e78268d5515444b9ef36897dda2` (`origin/main~300` at the time of writing)
- head: `b75d7f7cb0a9bfdf88fad7df7b66090f5312d5a3` (`origin/main`)
- non-merge commits scanned: **927**

## The count

| Measure | Value |
|---|---|
| Commits with at least one finding | **29** of 927 (3.1 %) |
| Total findings | **62** |
| `catch-empty` | **62** |
| `catch-discards-error` | **0** |
| Distinct files named | 37 |
| Largest single commit | 16 findings (`190651687`) |

Densest files: `src/scripts/_lib/collector_denominator.ts` (5),
`tests/scripts/collector_lifecycle.test.ts` (4),
`src/scripts/_lib/runtime_journal.ts` (4), `src/scripts/roadmap_context.ts` (4).

## What the count does and does not establish

**It establishes a rate.** 62 findings across 927 merged commits is roughly one
finding per fifteen commits — a volume a warn-only report can carry without
becoming noise, and far below the level at which a blocking version would be
worth discussing.

**It does not establish precision, and one half of the check is entirely
unmeasured.** Every one of the 62 is `catch-empty`; `catch-discards-error`
fired **zero** times over 927 commits. Its behaviour is proven on a fixture and
on nothing else, so its false-positive rate over real work is not low — it is
**unknown**, and those are different claims.

**Sampled by hand, the `catch-empty` findings are true positives by the
check's own definition.** The dominant real shape in this tree is
`} catch {` followed only by a comment — for example
`src/scripts/_lib/collector_denominator.ts:410`, whose entire body is
`/* the file vanished; the rename below re-creates it from \`kept\` */`. The
detection is correct: the block has no statements. Whether that particular one
is a **defect** is a human read the detector does not make and must not be
promoted into making.

**The evasion shape is absent from this tree's history.** The detector was
patched mid-implementation to strip a trailing comment before judging a body,
because `pass  # intentional` had defeated it — the roadmap's Risk 3 reproduced
by the detector written to close it. Re-running the full range with the fixed
binary returned the identical 62/29/927. So the fix changed no historical
count; it closed a hole nobody in this repository had walked through yet.

## The condition a promotion would have to meet

Not a date and not a count of runs. Per the AI council of 2026-09-04
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2/2 convergent, Q1 = option A):
use the warn-only period as data collection, observe which violations actually
surface, classify the false positives among them, and design an auditable
exemption marker **from real cases** before any promotion — not before.
Concretely, promotion owes:

1. a non-zero, classified sample of `catch-discards-error` findings, since it
   has never fired outside a fixture;
2. a false-positive classification of the `catch-empty` population, which this
   note samples but does not complete;
3. the exemption marker the council deferred, designed against those cases.

Until all three exist, `detect_silent_catch` reports and blocks nothing.
