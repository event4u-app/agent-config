<!-- evidence-type: analysis -->

# A bar cannot be set over a surface that has no semantics yet

AI council, 2026-10-13. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present, 2 rounds with blind peer review, `$0.00` (both seats
subscription-authed). The prompt is committed verbatim beside this file as
`activation-bar-20261013.question.md`.

## Verdict — convergent 2/2: option (c), hold step 8.2 as written

Both seats **withheld greenlight on the step**, and both for the same reason:
the step demands a false-positive rate, a false-negative rate and an N, and
none of the three has a stable referent while the verifier's decision surface
is undefined. openai: *"Confidence: high. Greenlight: blocked."*

**Option (b) — pre-register the form, defer the numbers — was rejected by both
as criterion-changing**, and that is the finding with the sharpest edge,
because (b) is the option that looks like progress. openai: *"The step
explicitly requires 'false-positive / false-negative rate, over what N.'
Closing it without those values rewrites the requirement rather than
fulfilling it."* anthropic, independently: *"The useful work should be a new
preparatory step, not a redefinition of 8.2's completion criteria."*

The structural work both seats want IS worth doing — it is simply a
**non-closing predecessor**, explicitly marked as not satisfying 8.2.

**The 7.1 precedent holds, and the prompt's attempt to distinguish it failed.**
Asked directly whether an acceptance bar differs from a classification in a way
that makes pre-registration possible where classification was not, anthropic
answered that it does not: *"if you don't know what a 'false positive' IS,
setting an acceptable false-positive rate is still a number over an undefined
referent."* openai: *"The prerequisite is the same kind as 7.1's prerequisite:
it supplies stable semantics without which the measurement has no referent."*

**But "hold" is not "wait for the data".** openai's correction, which is the
part a later reader is most likely to get backwards: *"Holding 8.2 does not
mean waiting until results arrive. It means waiting for a frozen semantic
contract, then registering numbers before corpus labels or verifier outputs are
disclosed."*

## Six findings neither seat was asked for

1. **Steps 8.1 and 8.2 are circular as written.** 8.1 says its N is *"decided
   by the council in 8.2"*, while 8.2's framing reads as an assessment of
   8.1's report. Both seats flagged it. The repaired order is below.
2. **"What actually happened" is not ground truth.** Merged-PR outcomes are
   observational and censored — a merged PR with no reported incident may carry
   a latent defect, a near-miss, or an issue a different control caught. This
   was openai's hardest pushback: *"Increasing N cannot cure systematically
   incorrect or censored labels; it merely produces a more precise measurement
   of the wrong thing."*
3. **The trust boundary is control, not readership** — and openai corrected its
   peer here. The builder MAY read the sealed report and challenge factual or
   reproducibility errors; reading is not the dangerous power. The builder must
   not: select or exclude cases after seeing outputs, assign final reference
   labels, resolve disputed labels, be the sole interpreter, change the
   evaluated verifier, or authorise activation.
4. **AC-4 protects the initial activation only.** Nothing in it prevents the
   gate being weakened afterwards — the verifier changed, the rule removed, a
   bypass introduced. Approval must bind immutable versions: verifier,
   decision contract, configuration, corpus protocol, enforcement mechanism.
5. **No rollback contract exists.** Activation without suspension and
   reactivation rules is incomplete.
6. **Independence is structurally unavailable here.** anthropic went further
   than its peer: with one active maintainer who is also the sole proposer and
   the only member of the only reachable team, *"'independent review' is not
   achievable through role separation or process design"* — so 8.2 should be
   explicitly blocked on the independence blocker, not merely held pending the
   decision contract.

## The repaired sequence, as openai set it out

1. Define and freeze the decision surface, **including abstention and
   missing-evidence behaviour**.
2. Define the reference-label protocol and the observation window.
3. Pre-register sampling, N, numeric thresholds, confidence requirements,
   severity weighting and exclusions.
4. Freeze the verifier and contract hashes.
5. Select and independently label the corpus under the registered protocol.
6. Run the verifier and produce a sealed report.
7. Independently adjudicate whether the registered bar was met.
8. Obtain the separate external authorisation AC-4 requires.
9. Activate only the evaluated versions and configuration.

*"Steps 1–2 block 3; step 3 blocks exposure of labels or outputs; evaluation
success does not bypass step 8."*

## Disqualifying regardless of rate

No N and no threshold trades these away:

- any demonstrated authorisation or security-critical fail-open;
- treating absent, unverifiable or malformed evidence as a pass;
- nondeterminism on identical frozen inputs;
- evaluation-data leakage into verifier development;
- any unregistered post-freeze change to code, contract, labels, corpus or
  exclusions;
- an irreproducible verdict, or missing audit evidence;
- an unaudited bypass;
- no genuinely independent activation authority.

**One proposed disqualifier was rejected as too broad**, and it is recorded
because the rejection is the useful part: anthropic's *"blocks without cause"*
universal disqualifier. openai: a conservative verifier may intentionally block
or abstain where evidence is insufficient, so whether that is an error depends
on the frozen decision contract and the operational budget. *"'Passes without
sufficient evidence' is categorically dangerous; 'blocks a case later judged
safe' is generally a measured false positive, not automatically fatal."*

## What the sealed report must contain

Version hashes · corpus-selection provenance · every inclusion and exclusion ·
reference labels and disagreements · per-class confusion matrices · confidence
intervals · abstention, error and missing-evidence rates · severity-stratified
results · complete disagreement records · determinism checks · operational
tests for latency, availability, bypass and fail-open behaviour.

## Kill switch

Automatic suspension on any critical false negative, fail-open path,
evidence-integrity loss, contract or version drift, or sustained operational
failure beyond registered limits. Emergency suspension may be immediate but
must be logged, time-bounded, and **separate from the authority to
reactivate**. Reactivation requires a fresh evaluation whenever the validated
artifact or the decision surface materially changes.

## Confidence, and what would move each seat

openai **high**, greenlight blocked; anthropic convergent on (c) with the
added blocking condition in finding 6. The evidence openai named as the single
thing that would change its position: a versioned historical corpus,
independently labelled under a documented observation window, with
indeterminate outcomes preserved, evidence provenance attached, and acceptable
inter-reviewer agreement demonstrated.
