# Findings: findings-that-get-a-disposition
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 6bebde61b7c7535e63d11bd52325a118206f5d239755ea1dc63c2ab8f2dfa083 | diff: df8f2f58c0e49e4dde179509566bae536b354b2d | reviewer: r2-fresh-subagent-findings-that-get-a-disposition | prompt_hash: 2ba4e708c4cd59bd1cd0122c1c28966d88221e4e1a0d40d97f677ce1f2a7d444 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-findings-that-get-a-disposition"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: df8f2f58c0e49e4dde179509566bae536b354b2d
  scope_hash: 6bebde61b7c7535e63d11bd52325a118206f5d239755ea1dc63c2ab8f2dfa083
  roadmap: agents/roadmaps/road-to-findings-that-get-a-disposition.md
  roadmap_hash: 52a544774843836d477bb80b4f8ff3d9f7086440e00dde0935095ed2f160dac6
  ac_hash: 54e9d5fc3420182ceb7a0dd55831d30e38322da85c574f9fa212b6c72fe5d382
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T20:12:58Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | src/scripts/check_finding_dispositions.ts:839 | The release cutoff is threaded through `main` (`missing_dispositions`, `unrecorded_findings`, `disposition_tally` all receive `release`), but no CLI-level test pins that wiring: `runGate` exists in the test file yet no case runs a ledger with an undispositioned `security × medium` row at the cutoff (expect 0) and after it (expect red). Dropping the `release` argument in `main` would keep the whole unit suite green while turning every pre-cutoff ledger with an open medium security row red (or, the other way, silently exempting post-cutoff releases if the default were changed). | fixed | CLI test runs a ledger with an open security x medium row at the cutoff (exit 0) and after it (exit 1); seen red with the release dropped from main |
| 2 | low | src/scripts/_lib/release_findings_ingest.ts:320 | `blockingWithoutDisposition` counts only rows with no `status`, so a blocking `security × medium` row marked `still_open` — the shape this change adds a dedicated refusal message for — is not counted. A release stopped solely by such a row prints a stop message whose figure says 0 blocking findings lack a disposition. The function comment says the figure is never the reason, but after this change the most likely new refusal is exactly the shape the figure misses. | fixed | blockingWithoutDisposition counts still_open blocking rows too, and the stop message says no disposition (no status, or still_open) |
| 3 | low | agents/roadmaps/road-to-findings-that-get-a-disposition.md:64 | Context still says 16.3.0 adds `eff3d4ed3fee` "(no migration note), undispositioned" in present tense, while the same diff records the row `still_open` (D5, ledger) and marks step 3.2 (the migration note) done. The neighbouring sentence was re-dated to "As read on 2026-10-06"; this one was not, so the roadmap contradicts its own ledger and step state. | fixed | Context sentence dated to 2026-10-06 and names the row as still_open, carried by step 3.3 |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
