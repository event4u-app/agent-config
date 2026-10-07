# Findings: git-convention-roadmaps
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 40e4477b4aece0fa2461999cfc143ab32a45953ac0c5fe6f1fb19005e2df6ddb | diff: 48ab977cb5c9a33ed70a23b9d1ea7166af5f6345 | reviewer: r2-fresh-subagent-git-convention-roadmaps | prompt_hash: 0f10e15edd0ec34e5b87c93dc0d2080e365bb85b37c546dd6924e949eb1c6fbd -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-git-convention-roadmaps"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 48ab977cb5c9a33ed70a23b9d1ea7166af5f6345
  scope_hash: 40e4477b4aece0fa2461999cfc143ab32a45953ac0c5fe6f1fb19005e2df6ddb
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T10:25:59Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/sync_pr_branch.ts:434 | The open-PR base lookup (`prBase` via `gh pr list`) was removed, so `sync_pr_branch` and `git:convention sync` without `--base` now target the default branch, while `check_branch_freshness.ts:591` still resolves the PR base from the forge. On a stacked or release-line PR, a bare `task push-ready` (BASE is optional, `taskfiles/dev.yml:221`) reports the branch current against `main` (or merges `main` in under `merge`), and then step 6 / the pre-push hook refuses it as behind its real base. The two resolvers in one documented sequence disagree again, which is the defect the moved `parseSymrefDefault` comment says it closed. The default changed silently: no warning appears when `--base` is omitted on a branch whose open PR targets another base. | open | |
| 2 | low | src/scripts/sync_pr_branch.ts:860 | When the carrier at the target is `unresolvable` and the developer layer is itself a refusal (for example, a malformed local `.agent-settings.yml`), `strategyExit` returns exit 4 but prints `describeRefusal(reading)`, which is the carrier's `git-convention-unresolvable` line ("server reports no commit…"). The developer file's actual `malformed`/`invalid` reason is never named, and exit 4 is paired with the reason code documented for exit 1 or the unverified exit 0. The caller gets a reason code and a file that do not match the cause. | open | |
| 3 | low | src/scripts/sync_pr_branch.ts:770 | `main` memoizes the target lookups (`memoTargetDeps`, :941) so that the strategy and the sync use the same commit. The merge path in `sync` still pins each ref with a fresh, unmemoized `makeGitDeps(repo).remoteSha(ref)`, so it runs a second `ls-remote` per ref. The guarantee stated in `memoTargetDeps`' doc (git_convention_carrier.ts:165-170, "judge the strategy against one commit and sync against another") therefore does not hold on the only path that mutates the branch. The injected `deps` is also bypassed there. | open | |
| 4 | low | src/scripts/sync_pr_branch.ts:725 | Offline behaviour is now inconsistent. Origin unreachable at the ref lookup makes `update_strategy` unresolvable and gives exit 1 ("base could not be resolved"), from `strategyGate` before `sync` runs. The path inside `sync` where `git fetch origin` fails still gives exit 0 `unverified`. Before this change, an offline run on a default-target branch reached the exit-0 `unverified` path. It now usually fails with exit 1 at `ls-remote`, which turns an offline `task push-ready` real run into a hard stop. The two "could not reach origin" outcomes also carry different exits. | open | |
| 5 | low | src/scripts/check_branch_freshness.ts:643 | The behind-branch remedy calls `readCommittedConvention` with the measured SHA. That SHA is by construction not contained in HEAD and is usually not local, so `carrierBlobAt` runs `git fetch origin <base>` with `CARRIER_FETCH_TIMEOUT_MS` (60 s) inside the pre-push hook just to choose remedy text. A slow or hanging remote can stall the push refusal for up to a minute, and if the fetch fails the remedy degrades to "cannot be read", even though the gate's own verdict was already decided. | open | |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
