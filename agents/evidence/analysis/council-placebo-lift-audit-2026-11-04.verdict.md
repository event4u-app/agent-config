# Council verdict — `placebo` and the footprint-lift audit (2026-11-04)

- **Prompt:** `council-placebo-lift-audit-2026-11-04.prompt.md` (beside this file), sent verbatim.
- **Run:** `council_cli run --input-mode prompt --prompt-mode analysis --effort medium`; seats anthropic + openai, 2/2 present, quorum concluded, $0 billed (subscription-authed).
- **Raw responses:** `agents/runtime/council/responses/placebo-lift-audit-2026-11-04.json` (runtime, not tracked).

## Verdict — convergent

Both seats: give `placebo` `min_lift_ratio: null`, keep its per-trial text-direction check, and keep the whole-run footprint as a descriptive measurement rather than a publication gate. The openai seat: "The supplied evidence undermines the 1.2 publication gate; it does not establish a replacement threshold."

## Reasons both seats accepted

- The whole-run footprint sums over a variable number of turns, so a pair below 1.2x cannot separate "the injection did not load" from "the run was shorter".
- The 1.2 threshold was calibrated on treatments of 1.7x–6.8x; nothing calibrates it for a ~1.7k-token inert payload.

## Points the seats rejected or flagged

- Speculative explanations for ratios below 1.0 (a faster placebo, cache effects) are not established by the data.
- The prompt's measurement line was ambiguous: "19 of 24 pairs below 1.2x" and "observed ratios 0.37–1.17" describe the 19 violating pairs, not all 24.
- A replacement threshold (1.0 or 1.05) was not adopted; it would carry the same turn-count confound.

## Revisit-if

A per-turn footprint (first-turn cache creation, which isolates the system prompt) is added to the audit; then `placebo` can be checked against an expected lift computed from its injected length.
