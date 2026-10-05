# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: 375c04f335c5f0b968b4e27a4b3429421b20e91f78a9b27eca92aa76687e29fa | diff: 3dada223d31c4cc8fff743859c66470c4763add1 | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: 6e5c860ff3d62ce96cddb4e3c4acaaf5d111a4e66ee2410dedf3308ec175c94f -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 3dada223d31c4cc8fff743859c66470c4763add1
  scope_hash: 375c04f335c5f0b968b4e27a4b3429421b20e91f78a9b27eca92aa76687e29fa
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T07:30:04Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | docs/contracts/release-pr-gating.md:38 | The diff reconciles the allowlist in the "Release-PR shape" section but leaves a second copy of the same list ~20 lines above, in the blockquote that argues for skipping the test matrix. That copy still names `packages/*/pack.yaml` and `packages/*/README.md` — the exact two paths this commit corrected to `src/packs/*` and `src/domains/*` below — and omits every entry added since: `package-lock.json`, the two `.augment-plugin/*` twins, the findings ledger, the new census, and the template pin plus its `dist/` twin. It is load-bearing prose ("They cannot regress install or runtime behaviour by construction") that now understates the admitted set, and the diff's own new paragraph says "A change to either edits both" while the file holds three copies, not two. | fixed | 8ddbff616 |
| 2 | medium | tests/scripts/check_release_pr_shape.test.ts:128 | The comment introducing the five denial assertions claims a `????-??-??` spelling "would pass each of these", so the block reads as the polarity test pinning the digit classes. Verified against an fnmatch-equivalent translation of that hypothetical glob: only `evidence-temperature-aaaa-bb-cc.md` would pass. The other four stay denied under `?` too — `-anything.md` and `-2026-1-5.md` fail on the literal dashes and length, `some-other-report.md` fails on the literal stem, and the `nested/` path fails on the literal directory prefix. Swapping the digit classes back to `?` would keep 4 of the 5 assertions green, so the test proves far less than its comment states and the next maintainer is misdirected about which line is the guard. | fixed | 8ddbff616 |
| 3 | low | src/scripts/check_release_pr_shape.ts:96 | The new entry is the first allowlist glob with a `-` inside a bracket class, which routes every call through the `else` branch whose comment reads "Rare; not used by the allowlist" — now false, and false in the same file the diff edits. The two branches are also byte-identical (both only `stuff.replace(/\\/g, '\\\\')`), so the `if`/`else` split suggests a divergence that is not there, while the real divergence from Python `fnmatch.translate` (chunking, `--` escaping, empty-range removal) is silently absent. Behaviour is correct for `[0-9]`; the stale comment and the dead branch are the defect. | fixed | 8ddbff616 |
| 4 | low | tests/scripts/check_release_pr_shape.test.ts:117 | Both new tests hardcode `evidence-temperature-2026-10-05.md`; nothing in the diff ties the glob to the producer the comment names (`taskfiles/content.yml` § `release-prepare`). Producer and consumer are pinned by two independent spellings of the same literal, so a producer-side rename or a different date format keeps all 15 tests green and reds only during a live `task release` — the exact failure this entry exists to prevent. Deriving the expected name from the producer, or asserting the producer's format string, would close the loop. | fixed | 8ddbff616 |
