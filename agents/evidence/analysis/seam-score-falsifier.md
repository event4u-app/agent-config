<!-- evidence-type: analysis -->

# Pre-registration — does a machine seam score track human judgement?

**registered_at: 2026-08-23**
**Status: REGISTERED, NO DATA COLLECTED. Outcome: see § Outcome — an honest null on the collection arm.**

Registered **before** any `handoff` clip was rendered, so the outcome cannot be
steered by what the data happened to look like. Nothing in the render path reads
a seam score today, and nothing in CI reads one either — by construction, not by
omission: a score whose validity is unknown must not be able to fail a build.

## Why this is a question and not a setting

Two external sources disagree about it, and one of them contradicts its own
earlier position. One published a set of SSIM thresholds for judging clip
seams; the same lineage later published a calibration showing that a
**verified-good** seam can score 18–25 dB PSNR — i.e. that the raw pixel metric
was measuring the wrong thing, and that composition, not pixel identity, is
what a viewer reacts to. Adopting either source's numbers would therefore mean
importing a calibration that its own author had already partly retracted.

So the honest target is not "a good seam scores above X". It is: **is there any
threshold, on any of these metrics, whose agreement with blind human judgement
is known?** A pre-registered null is a real and useful answer to that.

### Nearest in-tree precedent, cited instead of a fork

`tests/design-artifacts/fixtures/design.html:15` reasons about SSIM explicitly —
*"A hotlinked face would make an SSIM score a function of"* — which makes it the
closest thing this repository already contains to treating a similarity score as
a measurement with a **stated validity condition** rather than as a number with
an inherent meaning. That framing is adopted here. It is nearer than any external
calibration precisely because it is about the condition under which the score
means anything, which is the question, rather than about a threshold, which is
the answer nobody has yet earned.

## The two arms, fixed in advance

- **H1** — a machine seam score (SSIM or PSNR on the boundary frame pair of the
  encoded clips) separates human-judged "pop" seams from "clean" seams with
  **≥ 0.8 precision** at some threshold, at **≥ 0.5 recall**.
- **H0** — no threshold reaches 0.8 precision with ≥ 0.5 recall.

Both metrics are computed and neither is privileged, because which one (if
either) tracks human judgement is the question. `smoke-trace.sh seam-score
<a.mp4> <b.mp4>` emits both and labels itself diagnostic-only.

## Metric definitions — fixed, so they cannot be chosen after the fact

The scored pair is the **last frame of clip *i*** and the **first frame of clip
*i+1***, taken from the **encoded** outputs, because that is the pair a viewer
actually sees across the boundary. Extraction: `ffmpeg -sseof -0.15 …
-frames:v 1` for the last frame, `ffmpeg -i … -frames:v 1` for the first.

- **PSNR** — the `average` field of ffmpeg's `psnr` filter, in dB. `inf` for a
  byte-identical pair is reported as `inf` and never mapped to a finite number:
  an exact match and a very good match are different observations.
- **SSIM** — the `All` field of ffmpeg's `ssim` filter, in `0..1`.

## Rater protocol

- **Sample size:** N ≥ 24 seams, from previz-tier (cheapest model) `handoff`
  renders.
- **Composition:** half deliberately wrong — connector endpoints set to the
  source **stills** instead of the rendered frames, which is the documented
  failure mode and therefore the negative control — and half built per step 3.1.
- **Raters:** two, independent, **blind** to the score and to which half a seam
  came from. Forced binary choice: `pop` / `clean`.
- **Reported:** inter-rater agreement, in this file, **before** any threshold is
  fitted. Low agreement is itself a finding: if humans do not agree on what a
  bad seam is, no metric can be validated against them, and H1 is unanswerable
  rather than false.
- **Output:** a CSV with `seam_id, ssim, psnr, rater1, rater2`.

## Cost, stated up front

≈ USD 10–20 (24 seams × previz tier). *(est.)* — an estimate, not a measurement.

## Kill criteria — written before the data, so they bind

- If H0 holds: record the null here, keep the eyeball-QA sentence in
  `motion-choreographer`, ship `seam-score` as a **diagnostic only**, and note
  that this replicates the later calibration finding against the earlier
  thresholds.
- If H1 holds: the winning score and threshold become a **warning** in
  `stitch.sh --mode handoff`, citing the CSV. Never a hard gate, and never a CI
  gate — the sample is 24 seams and two raters, which supports a hint and
  nothing stronger.
- **Either way:** `grep -rn 'seam-score' .github/workflows src/scripts/gate*`
  must return 0.

## Outcome

**HONEST NULL ON THE COLLECTION ARM — H1 and H0 are both UNDECIDED, and this is
recorded as undecided rather than resolved.**

Recorded 2026-08-23. Step 4.2 requires ≥ 24 seams from **paid** previz renders
(≈ USD 10–20) and two blind human raters. The drain run that landed Phases 0–3
had authority to spend **nothing** on provider calls and cannot supply human
raters at all, so no data exists. There is therefore no threshold to fit and no
null to report against the raters — the distinction matters:

- **H0 was not confirmed.** "No threshold reaches 0.8 precision" is a claim
  about measured data. Reporting it here without data would be exactly the
  fabricated verdict this pre-registration exists to prevent.
- **The question stays open**, registered, and cheap to answer later: the
  registration is complete, the metric definitions are fixed, and the tool
  (`smoke-trace.sh seam-score`) is built and tested on fixture clips.

What was verified without spend, and is worth separating from what was not:

| Claim | Status |
|---|---|
| Registration precedes any data | **Verified** — no `handoff` render has occurred; there is no sentinel to precede |
| Both metrics computable on real clips | **Verified** — `tests/scripts/ai_video_frame_lock_probe.test.ts` drives `seam-score` over two ffmpeg-generated clips |
| `seam-score` is diagnostic-only | **Verified** — `grep -rn 'seam-score' .github/workflows src/scripts/gate*` returns 0 |
| Metric definitions fixed before data | **Verified** — this file |
| A threshold separates pop from clean seams | **UNKNOWN — not measured** |
| Inter-rater agreement | **UNKNOWN — no raters** |

**What closes this:** a maintainer runs 24 previz `handoff` renders, scores them
with `smoke-trace.sh seam-score`, has two people rate them blind, appends the
CSV beside this file, and writes the outcome into § Outcome. Until then the
default is unchanged and correct: `stitch.sh --mode cut` is the default, no
score gates anything, and the eyeball-QA sentence in `motion-choreographer`
stands.

**Revisit-if:** the renders are captured and rated; or the seam question is
settled upstream by a source whose calibration is reproducible in-tree, in which
case this file records that instead of measuring it again.
