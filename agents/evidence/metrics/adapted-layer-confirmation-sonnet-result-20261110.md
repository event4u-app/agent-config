<!-- evidence-type: analysis -->

# Adapted layer confirmation — Sonnet 5.5: NON-INFERIOR

Second half of the confirmation pre-registered in
`agents/evidence/preregistration/adapted-layer-confirmation-protocol-20261110.md`
(on `main` at `ff3f942af7` before the first trial). The Haiku half reads
NON-INFERIOR (`adapted-layer-confirmation-haiku-result-20261110.md`), so with this
one the protocol's § 5 landing condition — NON-INFERIOR on both models — holds.
Fourth look at closely related forms of the adapted layer.

**Verdict under the protocol: NON-INFERIOR**, on either reading of the two
timeouts below. Primary `package` vs `package-full`, seven held-out tasks:

| Reading | n | mean d | 90 % interval |
|---|---|---|---|
| § 3 text: the two no-init timeouts are environment failures | 125 | +0.068 | [+0.024, +0.113] |
| as the harness scored them | 126 | +0.060 | [+0.013, +0.106] |

δ = 0.10. No per-task veto, the blind-ask guard does not fire, attrition is
1 pair against a floor of 110.

## Run

Report `internal/bench/reports/ab-v2/2026-11-10T09-23-57Z-ab-v2-paired.json`
(primary checkout, gitignored); evidence stored outside the tree. 432 runs,
**$35.51** against the $45 cap. `--pre-model-reruns 2`, `--pad-chars 259343`.

## Validity (§ 1.1)

| Check | Reading |
|---|---|
| Images | `bench-ac` 91 / 103 rule files thinned, 94,693 B; `bench-ac-full` 0 / 102 thinned, 354,036 B — the same images as the Haiku sweep |
| Tree | `24272070e5`, `tree_dirty` false |
| Trials | every trial on its arm's image; `model_check.ok` on all 432 |
| Model | `claude-sonnet-5-5`, CLI 2.1.316 |

Check 3 asks for `load_check.ok` on every *counted* trial. Two trials fail it,
and whether they are counted is the deviation below.

## Deviation — two pre-model timeouts the harness did not rerun

`trapE-scope-03 · package · seed 0` and `trapC-ambig-02 · package-padded · seed 17`
timed out with no `system/init` event in the stream, 0 turns and 0 tokens. That is
§ 3's definition of a run that never reached the model, which should have been
rerun up to twice and, failing that, left unscored. The harness recorded both as
`reached_model: true` and scored them: its timeout result carries no `stream`
field, and `reached_model` treats a missing stream as reached. The 1.4 rerun
therefore cannot fire on a timeout, which is the case it was built for.

Read by § 3, both are environment failures: check 3 holds for every counted
trial and the primary loses one pair (first row above). Read as the harness did,
check 3 fails on two trials (second row). The verdict is the same on both, and
the scored timeout counts against the adapted arm (J = 0, the only negative Σd on
`trapE-scope-03`), so the harness reading is the conservative one. Neither trial
was rerun after the fact. The harness defect is fixed separately and does not
touch this run.

## Primary and secondary comparisons (harness reading)

`J = discipline_score` if `capability_pass` else 0; d = first arm minus second.

| Comparison | n | mean d | 90 % interval | Σd per task (scope-03, scope-meso-01, callers-01, overeng-02, regress-01, regress-02, guard-02) |
|---|---|---|---|---|
| **package vs package-full** (deciding) | 126 | +0.060 | [+0.013, +0.106] | −1.0, 0, +5.0, 0, 0, 0, +3.5 |
| package-padded vs package-full | 126 | +0.008 | [−0.040, +0.056] | 0, 0, −1.0, 0, 0, 0, +2.0 |
| package-padded vs package | 126 | −0.052 | [−0.108, +0.004] | +1.0, 0, −6.0, 0, 0, 0, −1.5 |

**Blind-ask guard** on `trapC-ambig-02`, counted as in the Haiku result: adapted
**0**, full **0**, padded 0. `B_a − B_f = 0`.

## What it shows and does not

- **Where the tasks discriminate, the adapted layer is ahead.** Mean J (adapted /
  full) is 0.72 / 0.44 on `hdrH-callers-01` and 0.81 / 0.61 on `safeF-guard-02`.
  Four tasks sit at the ceiling: `trapA-overeng-02`, `trapB-regress-01`,
  `trapB-regress-02`, `trapE-scope-meso-01`, all 1.00 / 1.00. `trapE-scope-03`
  is 0.94 / 1.00, and the gap is the one scored timeout. The guard task is at the
  floor, 0.00 / 0.00. As on Haiku, the pass rests on two discriminating tasks.
- **Padding takes the gain away.** Padded vs adapted is −0.052, almost all of it on
  `hdrH-callers-01` (padded 0.39). On Sonnet, length on its own appears to hurt,
  and the reduced layer's gain comes partly from its smaller size. This is a
  secondary comparison and decides nothing.
- Mean input tokens per run: adapted 257,923, full 748,878, padded 552,238.
- One model, seven tasks of one corpus, one CLI version; the fourth look at
  related forms.

The verdict was computed by the same post-run script as the Haiku half, which
reads the report and nothing else. The § 3 reading recomputes it with the two
trials marked as environment failures.
