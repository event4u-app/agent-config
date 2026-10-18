# Findings: update-installs-itself-20261018
<!-- completion-review: v1 | reviewed: 2026-10-18 | scope: 3fa2f47492b89621eadbc90b9caa1ac8d449cc41bff151663f8a5e77ff196a04 | diff: 83b20d85f19e498b9d559dca6c60e046313e4bde | reviewer: r2-fresh-subagent-update-installs-itself-20261018 | prompt_hash: 54c446a46706a7fcaebb217e8ecf8e4f432d14df4a9899a7878b0720494bd16d -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-update-installs-itself-20261018"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-18 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 83b20d85f19e498b9d559dca6c60e046313e4bde
  scope_hash: 3fa2f47492b89621eadbc90b9caa1ac8d449cc41bff151663f8a5e77ff196a04
  roadmap: agents/roadmaps/road-to-an-update-that-installs-itself-only-when-it-is-safe.md
  roadmap_hash: 2d0c37d50f644fa5a94bef0765aee9ca9478f1d6e7bdf38647178ce59f274a3a
  ac_hash: 4240008514108f3dc87a268b86e626d89232ad7dbead74438bae5233fa4701e9
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-18T14:20:19Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/_cli/upgrade_unattended.ts:272 | EACCES skips the restore whenever `installed.lock` is unchanged; the lock changes only in the `global` step, so EACCES after a successful `npm install -g` leaves the new binary beside the old lock and projection. | fixed | 02ba674ba: see the commit body for this finding |
| 2 | medium | src/scripts/_cli/upgrade_unattended.ts:181 | `restore()` checks `installed.lock`, not the binary; a failed restore `npm install` with the lock still at `previous` returns 1 like a clean restore, and exit 4 is never reached. | fixed | 02ba674ba: see the commit body for this finding |
| 3 | medium | src/scripts/_cli/upgrade_unattended.ts:125 | Stale-lock takeover is not atomic: two callers can both judge it stale, and B's unlink deletes A's fresh lock, so both install. | fixed | 02ba674ba: see the commit body for this finding |
| 4 | medium | src/scripts/_cli/upgrade_unattended.ts:142 | A live owner past its TTL is treated as stale, so a slow install can be overtaken by a second caller mid-swap. | fixed | 02ba674ba: see the commit body for this finding |
| 5 | medium | agents/roadmaps/road-to-an-update-that-installs-itself-only-when-it-is-safe.md:228 | SIGTERM evidence is only a child exiting 143; SIGTERM delivered to the unattended process itself is not handled. | fixed | 02ba674ba: see the commit body for this finding |
| 6 | medium | src/scripts/_lib/unattended_gates.ts:47 | Provenance is a presence check only; nothing verifies the attestation or ties it to the OIDC publish workflow step 2.1 names. | deferred | agents/roadmaps/road-to-an-update-that-installs-itself-only-when-it-is-safe.md step 2.1, reopened on signature verification; production swaps nothing until step 1.4 |
| 7 | low | src/scripts/_cli/upgrade_unattended.ts:251 | `--dry-run` returns before the `activationBlocked` check and reports "would execute" with exit 0 while the real run refuses with exit 3. | fixed | 02ba674ba: see the commit body for this finding |
| 8 | low | src/scripts/_cli/cmd_upgrade.ts:465 | `--skip` accepts any string and overrides `--check` / `--dry-run`. | fixed | 02ba674ba: see the commit body for this finding |
| 9 | low | src/scripts/_cli/upgrade_unattended.ts:348 | `Boolean(process.env.CI)` treats `CI=false` and `CI=0` as CI. | fixed | 02ba674ba: see the commit body for this finding |
| 10 | low | src/scripts/_cli/cmd_update.ts:363 | An impact-map fetch failure is reported as "`<latest>` carries no impact map". | fixed | e03eafaca: fetch failure and absent map are told apart; --to labelled target |
| 11 | low | src/scripts/_cli/cmd_update.ts:520 | `--check --to X` in a pinned project labels the target "latest". | fixed | e03eafaca: fetch failure and absent map are told apart; --to labelled target |
