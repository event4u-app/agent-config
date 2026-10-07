# Findings: drain-findings-disposition-20261007
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 2b0d7bf19557fcd5561ef42a8cf15aed0a6bb5dfa0688f7b94e9940bc2d56ac4 | diff: 433f8de86a38f3b483cde4bba88ba815444eadb6 | reviewer: r2-fresh-subagent-drain-findings-disposition-20261007 | prompt_hash: e43ccaa16744f12c101448f461beec4acf09fc41f3303d712e8990eedc7ef455 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-findings-disposition-20261007"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 433f8de86a38f3b483cde4bba88ba815444eadb6
  scope_hash: 2b0d7bf19557fcd5561ef42a8cf15aed0a6bb5dfa0688f7b94e9940bc2d56ac4
  roadmap: agents/roadmaps/road-to-findings-that-get-a-disposition.md
  roadmap_hash: 25b0003078759af1e2e5cc31f01262851d571cab59a02724396459043092c594
  ac_hash: 52dc81ab2d1e0876798f0c357b2e315c6d8cc7a3eabb94018c1fd8b9a948841b
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T19:14:20Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | agents/roadmaps/road-to-findings-that-get-a-disposition.md:90 vs :155 | Step 1.2's "Done" note says 17 `still_open` rows; AC-2 in the same file says "2 of 10 `still_open` rows" (10 total). Two different totals for the same quantity, in the same document, from the same 2026-10-07 pass. | open | Neither number matches the committed ledger either (9 `still_open` rows in `agents/evidence/release-findings/16.3.0.json`, verified by `jq`/`node` count). |
| 2 | medium | agents/roadmaps/road-to-findings-that-get-a-disposition.md:155-161 | AC-2 names `bfe1d6e6d8ca` as one of the two `still_open` rows that cites an owning roadmap (`road-to-enforcement-per-obligation`), but that finding's actual `status` in `agents/evidence/release-findings/16.3.0.json` is `fixed` (commit `93a192bbd`), not `still_open`. The genuinely-`still_open` row that cites a roadmap and AC-2 omits is `2c9959f7262d` → `road-to-release-evidence-that-reproduces` (16.3.0.json line 183). AC-2's "8 genuine orphans" is therefore also off — the actual orphan count among the 9 real `still_open` rows is 7, not 8. | open | Verified by reading both finding records directly (16.3.0.json lines 30-ish and 183-ish) and by grepping every `still_open` row's `rationale` for a `road-to-*` reference. |
| 3 | medium | agents/roadmaps/road-to-findings-that-get-a-disposition.md:86-91 | Step 1.2's done-note tally ("25 `fixed` … 2 `accepted_risk` … 17 `still_open`") doesn't match the committed ledger's actual breakdown of the 44 newly-dispositioned rows: 31 `fixed`, 4 `accepted_risk`, 9 `still_open` (plus the 1 pre-existing `false_positive`, for 45 total). | open | `node` tally over `agents/evidence/release-findings/16.3.0.json`: `{fixed:31, still_open:9, false_positive:1, accepted_risk:4}`. The real commit message (`2e80393ff`, visible via `git show --stat` in the worktree) says "10 still_open" — closer to the true 9 than the roadmap text's 17, suggesting the roadmap prose was never reconciled against the final ledger state. |
| 4 | low | agents/evidence/release-findings/16.3.0.json:527 | Finding `78520e9a6a33`'s `commit` field is the placeholder string `"pending (this roadmap's PR)"` rather than a resolvable commit SHA. Every other `fixed` disposition in the ledger (8 distinct real commits: `0c86ad98f`, `fc1bdec4f`, `93a192bbd`, `96aaee818`, `c4051c7ed`, `8fdb48169`, `00612c1f2`) cites an actual hash; this one can never be verified by `git show <commit>` once merged, and the gate's `missing_dispositions` check only requires the field to be non-blank, so this passes silently. | open | The remedy it claims (`README.md` added "in this change") is real and already committed — it's reachable in the worktree and was added by this same work — but the self-reference uses a non-hash placeholder instead of the commit that actually lands it. |
