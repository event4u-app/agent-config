# Findings: findings-that-get-a-disposition
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: b1f9788b0e136bccb39b869d1d280444c3807408f572971f002f13264230da96 | diff: 27f2eab2713fc74f8414086c5e9cc6492f1efac7 | reviewer: r2-fresh-subagent-findings-that-get-a-disposition | prompt_hash: a6b771b77b90568f5a2de7b9c33071a4f06a34e55819bcca8027be55e2b47a4b -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-findings-that-get-a-disposition"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 27f2eab2713fc74f8414086c5e9cc6492f1efac7
  scope_hash: b1f9788b0e136bccb39b869d1d280444c3807408f572971f002f13264230da96
  roadmap: agents/roadmaps/road-to-findings-that-get-a-disposition.md
  roadmap_hash: 1b6a3dabd02a999fe43b50e10ece18ec352879e846e6a8db61547de13ac2fcbd
  ac_hash: 54e9d5fc3420182ceb7a0dd55831d30e38322da85c574f9fa212b6c72fe5d382
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T20:16:55Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | src/scripts/_lib/release_findings_ingest.ts:324 | The stop-message count and the gate classify a row against different inputs. `blockingWithoutDisposition` passes the ledger file's own `release` field to `isBlocking`, while `check_finding_dispositions` `main()` passes the CLI `--release` argument (`missing_dispositions(ledger.findings, release)`). `parse_ledger` does not check that the two agree, so a ledger whose `release` field was copied from an older file can make the count say 0 while the gate refuses, or the reverse. The same expression also tests `!f.status` without trimming, but trims for `still_open`. The gate trims first and reports a whitespace-only status as "no disposition status", which this count skips. The docstring calls the count a figure, not the reason, but it now disagrees with the gate in two ways. | fixed | blockingWithoutDisposition classifies against the version being released (the gate's --release input) and trims the status like the gate |
| 2 | low | docs/self-review-gate.md:103 | The doc and the CHANGELOG entry (CHANGELOG.md:38) say "`accepted_risk` with a rationale satisfies it". `missing_dispositions` also needs a non-empty `verified_by` for every blocking row (and a `commit` for `fixed`). A maintainer who follows the published wording and writes `accepted_risk` plus a rationale for a medium security row still gets a red release, with "empty verified_by". | fixed | docs/self-review-gate.md and the CHANGELOG now name rationale and verified_by (and the commit for fixed) |
| 3 | low | tests/scripts/check_finding_dispositions.test.ts:456 | The test title says "the CLI passes the ledger release to the cutoff", but the gate uses the `--release` argument, not the ledger's `release` field. Both fixtures set the two to the same value, so the test cannot tell which one decides. The other consumer (`blockingWithoutDisposition`, finding 1) does read the ledger field. Because the two sources are never split in a test, the divergence in finding 1 is unpinned. | fixed | test retitled to the --release input and gains a case where the ledger field lags the version being cut |
| 4 | low | src/scripts/_lib/release_findings_ingest.ts:322 | The diff changes what `blockingWithoutDisposition` counts in two ways: `still_open` rows are now counted, and the classification depends on the release. No test in the diff covers this. The existing `dispositionStopMessage` tests pass the count in as a literal, so if the filter regresses, every suite stays green. | fixed | blockingWithoutDisposition exported and tested: no status, whitespace and still_open counted; classification by the released version; seen red with the version dropped |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
