# Findings: findings-that-get-a-disposition
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 1ca385fe8c36bd065c25555c7546afc1ca140c56b053ba2fc6083cdeab1c7690 | diff: 4cd467601df35307168c0dae4efab201d8b91370 | reviewer: r2-fresh-subagent-findings-that-get-a-disposition | prompt_hash: 4b1beaafe1fcc428c482645a749cc65af9dcd4c8d1e4c570491743abcb6482e8 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-findings-that-get-a-disposition"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 4cd467601df35307168c0dae4efab201d8b91370
  scope_hash: 1ca385fe8c36bd065c25555c7546afc1ca140c56b053ba2fc6083cdeab1c7690
  roadmap: agents/roadmaps/road-to-findings-that-get-a-disposition.md
  roadmap_hash: 2ec10eada6ea99508bcc384829dc0ebb51fb18174a22730e2e567e21bf16aa90
  ac_hash: 54e9d5fc3420182ceb7a0dd55831d30e38322da85c574f9fa212b6c72fe5d382
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T19:28:54Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | agents/evidence/release-findings/16.3.0.json:216 | `eff3d4ed3fee` (security × medium, title: "ships `doctor --json` network egress by default") is recorded `fixed` (commit fc1bdec4f) although its own rationale concedes the titled defect, the default-on forge read, is still open and owner-pending (blocker `doctor-network-default`). The roadmap says this row gains its terminal status in step 3.3 "that matches the decision", and 3.3 and AC-5 are still blocked, so the ledger closes a row the roadmap declares undecided. Under the new `security × medium` blocking cell `still_open` would red the release, so `fixed` is what keeps 1.3 green. That is the "disposition written to empty the ledger" pattern Risk 1 and D1 warn against. The honest states are `accepted_risk`, with a rationale pointing at the owner blocker, or keeping the release red. | fixed | eff3d4ed3fee rewritten to accepted_risk naming blocker doctor-network-default and step 3.3, commit field dropped; roadmap D5 |
| 2 | medium | agents/evidence/release-findings/16.3.0.json:487 | `a78536c88317` (security, title: "follows symlinks for literal entries and reads files outside the project root") is `fixed`, but its rationale and the residue stub (item 1) both say a literal `pkg/x` whose parent `pkg` is a symlink still resolves outside the root. The glob branch follows a symlinked parent the same way, and no test pins the `lstatSync` change. The titled harm (reading outside the root through a literal entry) is therefore still reachable, and the finding's own suggested remedy (realpath containment) is unimplemented. `fixed` overstates this; `still_open` carried by the stub fits D1. `7efdf81cb478` (:337, "follow symlinks out of the project root") is closed the same way. | fixed | 7efdf81cb478 and a78536c88317 rewritten to still_open, carried by road-to-the-16-3-0-findings-residue item 1; roadmap 1.1 outcome note, D5 |
| 3 | medium | agents/roadmaps/road-to-findings-that-get-a-disposition.md:97 | Steps 3.1 and 3.2 and AC-4 are flipped to `[x]`, but the review scope holds no change to the doctor CLI, no `tests/scripts/doctor_offline_flag.test.ts` and no `docs/MIGRATION.md` edit. The only support is the claim inside the `eff3d4ed3fee` rationale that the work landed in fc1bdec4f (#2243), which is outside this branch. The roadmap Context still states, as re-read at a75bb3210, that `doctor --json` reads the forge unconditionally with only an env opt-out, which contradicts the ticked boxes. The completion claim is unevidenced in scope, and the Context is stale against it. | fixed | roadmap 3.1 and 3.2 name fc1bdec4f (#2243) as where they landed; Context line dated and amended |
| 4 | low | agents/roadmaps/stubs/road-to-the-16-3-0-findings-residue.md:33 | The `7efdf81cb478` ledger rationale says its untested fix and the intermediate-segment case "are recorded as residue in road-to-the-16-3-0-findings-residue", but the stub's item 1 names only `a78536c88317 (residual)`, so 7efd's pointer resolves to nothing that mentions it. | fixed | stub item 1 now names both 7efdf81cb478 and a78536c88317 |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
