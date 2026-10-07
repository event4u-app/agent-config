# Findings: drain-findings-disposition-20261007-r4
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 69dbdc070ab80490bc85632f9eb27ead05669a5ab99b8f3ed0e1984ce0e77cef | diff: 7f0e6ff95174ffed3f09cfbe24b565c68527856c | reviewer: r2-fresh-subagent-drain-findings-disposition-20261007-r4 | prompt_hash: ad3d4b45bee459e4f58e70ccdd389b189b3e3732b960258959fcf4ad24d8b0ff -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-findings-disposition-20261007-r4"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 7f0e6ff95174ffed3f09cfbe24b565c68527856c
  scope_hash: 69dbdc070ab80490bc85632f9eb27ead05669a5ab99b8f3ed0e1984ce0e77cef
  roadmap: agents/roadmaps/road-to-findings-that-get-a-disposition.md
  roadmap_hash: 206bd39254f2bbed3ea6650d06b56e7c304065c3fc04094f6038bec3fedc7cec
  ac_hash: 53952eb8170a57903d778199761720816f66099681c29e17f9ef5095c183c80a
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T20:02:36Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | agents/roadmaps/road-to-findings-that-get-a-disposition.md (AC-2) / agents/evidence/release-findings/16.3.0.json:183 | AC-2 counts `2c9959f7262d` as one of the "2 of 9 `still_open` rows [that] name an owning roadmap" (the other being `ee95ff4aca5f` → road-to-blocking-time-by-cause, which is a genuinely active roadmap with 3 open steps). But the named owner for `2c9959f7262d`, `road-to-release-evidence-that-reproduces`, is fully archived (`agents/roadmaps/archive/road-to-release-evidence-that-reproduces.md`, 0 open / 14 closed steps) — and the finding's own rationale says its step 3.1 already landed and the gate does not re-read the named (already-merged) artifact retroactively. There is no remaining work in that roadmap that will ever close this finding; citing it as a "roadmap-owning" row is functionally indistinguishable from the 7 declared orphans. AC-2's own accounting ("2 of 9 name an owning roadmap") therefore overstates live ownership by one row. | fixed | Verified by reading the archived roadmap's checkbox state (`grep -c '^- \[ \]'` → 0) and the finding's rationale text in the ledger. Fixed in `10f720650` — AC-2 now distinguishes the archived, closed "owner" from the genuinely active one. |
| 2 | low | agents/evidence/release-findings/16.3.0.json (finding `1b661735687e`) | Roadmap step 1.2's completion note summarizes the 4 `accepted_risk` dispositions as "a deliberate, disclosed design choice each, with a revisit-if." Finding `1b661735687e`'s rationale is a limitation disclosure about two frozen, already-merged review rounds ("roadmap: none" manifests) and states no revisit condition — it documents a permanent, immutable property of a past artifact, not a reversible risk acceptance. 3 of the 4 accepted_risk entries do state an explicit REVISIT-IF; this one doesn't, so the step-1.2 summary's "each … with a revisit-if" is a minor overgeneralization. The disposition itself is sound; only the summary prose overclaims uniformity. | fixed | Checked all 4 `accepted_risk` entries' `rationale` text for "revisit" (case-insensitive); 3/4 match, `1b661735687e` does not. Fixed in `10f720650` — step 1.2 now reads "3 of the 4 carry a revisit-if" and names the exception. |
