# Findings: git-convention-review-findings
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 1afa3237b2b380be2b70c0bb475496946ad20f46d5956c156ab48b854fa4cb16 | diff: 3aeb7691550fde8b7f8e7ce3662068bb1ae36f6a | reviewer: r2-fresh-subagent-git-convention-review-findings | prompt_hash: 288ba7621db409155bc23bab43359dff934be744145122c58958bbdb2e16daee -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-git-convention-review-findings"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 3aeb7691550fde8b7f8e7ce3662068bb1ae36f6a
  scope_hash: 1afa3237b2b380be2b70c0bb475496946ad20f46d5956c156ab48b854fa4cb16
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T13:50:45Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | taskfiles/dev.yml:228 | `push-ready` prepends `origin/` to BASE for `sync_pr_branch` (line 228) but passes it bare to `check_branch_freshness` (line 234), and the pre-push refusal (src/scripts/install-hooks.sh:161) tells the user to set `BASE=<base> as named above`, where "above" prints `BEHIND origin/<base>`. Copying that name gives `sync_pr_branch --base origin/origin/<base>` (resolveTarget keeps an existing `origin/` prefix, so the base is unresolvable, exit 1) and `check_branch_freshness --base origin/<base>`, which ls-remotes `refs/heads/origin/<base>`, gets null and exits 0 `NOT VERIFIED`, so the re-check step passes without checking anything. The two resolvers also accept different `--base` spellings (sync accepts bare and prefixed; freshness accepts bare only). | fixed | fixed in 9bdf61fda578 |
| 2 | low | src/scripts/sync_pr_branch.ts:880 | The new strategy gate maps an origin that is unreachable at the `ls-remote` lookup to exit 1 ("base could not be resolved") before `sync()` runs. It does this even under the default `merge` strategy with no carrier anywhere. Before this change, the same offline condition fell through to `sync()`'s fetch failure and exited 0 `unverified`. Whether an offline run exits 0 or 1 now depends on which network call fails first, and `push-ready` step 2 and the `/pr:merge` prose both treat 1 as a hard stop. That is a behaviour change for repositories that never declared a convention. | accepted-risk | the council's exit contract (D10, agents/evidence/council/git-convention-target-resolution-2026-10.md): an origin unreachable at the ref lookup is exit 1 'base could not be resolved', a resolved ref whose fetch fails is exit 0 'unverified'; neither mutates anything. Accepted by: implementing agent |
| 3 | low | src/scripts/_lib/git_convention_carrier.ts:102 | `resolveTarget` rewrites every `--base` without an `origin/` prefix to `origin/<value>`. `sync_pr_branch --base` was previously used verbatim, so a base on another remote (`upstream/main` becomes `origin/upstream/main`) or a full ref (`refs/heads/main` becomes `origin/refs/heads/main`) now silently names a different, nonexistent ref and fails as unresolvable, where it should be rejected or handled. | fixed | fixed in 33c6f42da6ca |
| 4 | low | src/scripts/hooks/block_config_weakening.ts:441 | The guard now fences `.git-convention.yml`, the highest-precedence layer. When the file does not exist yet (`on_disk === null`), both the new MultiEdit branch and the Edit branch (line 421) produce `afterText === null` and return null (allow). An Edit or MultiEdit that creates the carrier, for example with an empty `old_string`, therefore sets Class C `git.*` keys unguarded, while the same content sent through `Write` is checked. | fixed | fixed in ab4b64154287 |
| 5 | low | src/scripts/_lib/git_convention_measure.ts:147 | The migrating path tests `_clears(newerRaw.length, newer, bar)`. The n is the uncapped newer-half count, but `newer.share` is computed over the per-author-capped sample. When three or more authors are present, a newer half whose capped sample is below `MIN_N` can still be declared established (migrating), contrary to the documented bar of "n >= MIN_N ... capped". | fixed | fixed in fa3e476cbebf |
| 6 | low | src/scripts/_lib/git_convention.ts:234 | A non-string `git.*` value is reported with `String(found.value)`, so a mapping value prints as `[object Object]` in `show` and in the `invalid` line. The most likely cause is an unquoted `branch_pattern` such as `{ticket}-{slug}`. If YAML instead rejects that unquoted pattern, the whole developer file turns `malformed` and the loader silently drops every other key it sets. Neither outcome names the actual mistake (the pattern must be quoted). | fixed | fixed in 6e691eb3c9e9 |
