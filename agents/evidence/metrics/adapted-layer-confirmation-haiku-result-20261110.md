<!-- evidence-type: analysis -->

# Adapted layer confirmation — Haiku 4.5: NON-INFERIOR

Pre-registered in `agents/evidence/preregistration/adapted-layer-confirmation-protocol-20261110.md`,
merged to `main` (`ff3f942af7`) before the first trial. Fourth look at closely
related forms of the adapted layer; the first on tasks none of the earlier looks
used.

**Verdict under the protocol: NON-INFERIOR.** Primary `package` vs `package-full`
over the seven held-out tasks: mean d = **+0.020**, 90 % interval **[−0.010, +0.050]**,
n = 126 pairs, against δ = 0.10. No per-task veto, the blind-ask guard does not
fire, no attrition. The Sonnet 5.5 sweep is the second half of the decision; the
layer ships only if both read NON-INFERIOR.

## Run

Report `internal/bench/reports/ab-v2/2026-11-10T06-08-11Z-ab-v2-paired.json`
(primary checkout, gitignored); evidence stored outside the tree. 432 runs,
**$31.56** against the $45 cap. `--pre-model-reruns 2`, `--pad-chars 259343`.

## Validity (§ 1.1)

| Check | Reading |
|---|---|
| Images | `bench-ac` 91 / 103 rule files thinned, 94,693 B; `bench-ac-full` 0 / 102 thinned, 354,036 B |
| Tree | `24272070e5`, `tree_dirty` false; its diff against `ff3f942af7` lists only the § 1 files |
| Contract wording | byte-identical to the third look's `51add0fc53` |
| Trials | 0 errored, 0 pre-model reruns, 0 environment failures in any arm |
| Model | `claude-haiku-4-5`, CLI 2.1.316 |

`--pad-chars` = 354,036 − 94,693 = 259,343, read from the image report as § 1
fixes. The layer is ASCII apart from a few punctuation marks, so bytes slightly
overstate characters.

## Primary and secondary comparisons

`J = discipline_score` if `capability_pass` else 0; d = first arm minus second.

| Comparison | n | mean d | 90 % interval | Σd per task (scope-03, scope-meso-01, callers-01, overeng-02, regress-01, regress-02, guard-02) |
|---|---|---|---|---|
| **package vs package-full** (deciding) | 126 | +0.020 | [−0.010, +0.050] | 0, 0, 0, 0, −1.0, 0, +3.5 |
| package-padded vs package-full | 126 | +0.024 | [−0.010, +0.057] | 0, −1.0, +1.0, 0, 0, 0, +3.0 |
| package-padded vs package | 126 | +0.004 | [−0.029, +0.037] | 0, −1.0, +1.0, 0, +1.0, 0, −0.5 |

**Blind-ask guard** on `trapC-ambig-02` (a trial with no changed file whose kept
stream holds no `tool_use` in any assistant message; every such trial had a
stream): adapted **10**, full **16**, padded 15. `B_a − B_f = −6`; the guard fires
at +3.

## What it shows and does not

- On these seven tasks the adapted layer is not worse than the full one by the
  pre-registered margin. **The held-out set discriminates little on Haiku:**
  mean J per arm (adapted / full) is 1.00 / 1.00 on `trapA-overeng-02`,
  `trapB-regress-02`, `trapE-scope-03` and `trapE-scope-meso-01` (ceiling), and
  0.00 / 0.00 on `hdrH-callers-01` (floor; the guard task `trapC-ambig-02` is also
  0.00 / 0.00). Only `trapB-regress-01` (0.89 / 0.94) and `safeF-guard-02`
  (0.94 / 0.75) move. A pass here means "no loss where these tasks can show one",
  which is two tasks — weaker evidence than the n = 126 suggests, and stated
  rather than corrected after the data.
- Padding the reduced layer to full length changes nothing measurable here; this
  run gives no sign that first-turn size, as opposed to content, decides quality
  on Haiku.
- Mean input tokens per run: adapted 313,342, full 738,205, padded 676,400 —
  whole runs, not first turns, so they include every turn's context.
- One model, seven tasks of one corpus. The first look's loss sat on
  `trapC-ambig-01`, which this run deliberately did not use; that loss is not
  re-tested here.

The verdict was computed by a script written after the run against the frozen
rule of § 4; the script reads the report and nothing else, and its counting rule
for blind asks is the third look's, quoted above.
