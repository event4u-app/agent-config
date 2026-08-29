## Acceptance Criteria

1. `judgment_ladder.ts` remains the single task-side orchestration resolver,
   and a test fails on any second one.
2. Council topology selection exists only behind the ladder's council rung;
   `team` and `user_required` are not representable in its vocabulary.
3. `ai_council/necessity.ts` retains a clear, non-duplicative role.
4. Method provenance is recorded as Source A/B/C in `CREDITS.md` and
   `provenance/harvests.jsonl`, with links as `ENC1:` tokens only, and
   `check_no_external_sources` is green.
5. The unlicensed-source verbatim scan is recorded, or explicitly scoped out
   with the licence state written down.
6. Exact repeat council runs warn before new spend, and the warning can never
   become an unconditional block.
7. Near-duplicate warnings print their similarity score against a
   pre-registered threshold.
8. Inline findings reduce analysis-lens extraction calls with no parse-quality
   regression, or the null is published and the change reverts.
9. Deterministic and executable truth outranks council consensus — a
   probe-resolvable question never reaches topology selection.
10. Every council-effectiveness claim carries a strong single-model baseline, a
    trial count, and a variance band.
11. Benchmark results separate topology quality from model quality.
12. Peer reviewers never receive their own authored answer, enforced in payload
    construction rather than in prompt text.
13. Candidate ordering is reviewer-specific and property-tested for position
    bias at N=2..8.
14. Provider-recognition leakage is measured against chance; style
    normalization remains absent unless leakage is both measurable and shown
    harmful.
15. Candidate content cannot override ranking or synthesis contracts.
16. Sequential dispatch remains the default and its byte-pinned tests are
    unmodified; any parallel path requires a confirmed worst-case ceiling and a
    recorded revisit verdict.
17. Majority vote cannot decide finding-level correctness, and material
    minority arguments survive synthesis.
18. Correct-minority / wrong-majority fixtures are permanent benchmark cases.
19. ADR-120 changes only on synthesis evidence, with the artifact pinned.
20. Dissent repair runs before argument-exhaustion stopping can fire, proven
    red-then-green; majority size alone never stops a run.
21. A stopped run is textually distinguishable from a full run.
22. Large councils do not require unconditional O(N²) peer review, and
    targeted cross-examination names the exact disputed claim.
23. The five existing personas are benchmarked before any sixth is proposed,
    and same-provider fan-out is never labelled external-model independence.
24. Every paid call is explainable in replay; useful corrections are
    attributable to a stage; `zero_marginal_value_call_rate` is measurable.
25. Re-council and early-stop savings are measured separately from quality.
26. Learned routing, if explored, stays an offline shadow challenger, and the
    suite runs green with its artifact deleted.
27. User authority, the Hard Floor, and spend gates are never weakened by a
    topology choice.
28. The published proof surface reports where council **loses** as well as
    where it wins.
29. No row in § Prevented items has been rebuilt, and the quota-source split
    has not been re-proposed.

---
