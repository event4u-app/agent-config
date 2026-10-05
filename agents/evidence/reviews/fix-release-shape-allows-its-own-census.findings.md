# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: 60278b2c09e88d65cb8bed03f4c7903ee512eaf4eae192cbf99267d5187af7cb | diff: 507e25c438b22b801ebe959b038da79387aaf645 | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: e406e58f5a8f84e533944b5cb9b672c03e7b64800c8ede0a073975368f7e7982 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 507e25c438b22b801ebe959b038da79387aaf645
  scope_hash: 60278b2c09e88d65cb8bed03f4c7903ee512eaf4eae192cbf99267d5187af7cb
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T08:33:28Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/check_release_pr_shape.ts:56 | The round's one substantive edit states categorically that the second census's "delta section is empty", and the reason given does not entail it. The delta is `cold` minus `previousCold` (report_evidence_temperature.ts:557), so emptiness needs the two cold sets to agree, not merely a baseline that resolves to the same release's first census. Once that first census is tracked, the second census classes it COLD by the instrument's own rule: `buildCensus` takes its subjects from `git ls-files`, `analysis` is absent from `GATE_SCAN_ROOTS` (report_evidence_temperature.ts:134-168), and `isSelfReport` drops census reports from the referrer index (ibid.:180, 319), so it is uncited. It cannot have been in the first report's own cold list, because it was not tracked when that census was built — so it lands in the second report's newly-cold set and the delta is non-empty. Which way it falls depends on whether the release commits the first census before `--resume`, an ordering the comment never states while stating the outcome unconditionally. | open | |
| 2 | medium | docs/contracts/release-pr-gating.md:44 | The rewrite replaces a categorical claim with a precise one, then scopes the counterexample too narrowly: "false of its own first two entries" names only `package.json` and `package-lock.json`. The same change adds `.augment-plugin/plugin.json` and `.augment-plugin/marketplace.json` and says at line 65 that "both ship in the tarball, so a release PR must carry them" — i.e. install-surface by the contract's own words — and `.claude-plugin/marketplace.json` plus `src/packs/*/pack.yaml` and `src/domains/*/pack.yaml` are the same class. This blockquote is the argument for skipping Public Install Smoke on `release/*` heads, so understating which allowlist entries can regress install is understatement exactly where the skip argument is load-bearing. The "held by review, not by a gate" residual is correspondingly larger than the sentence admits. | open | |
| 3 | low | src/scripts/check_release_pr_shape.ts:103 | Collapsing the two byte-identical arms is behaviour-preserving, but it removed the file's only notice that Python's `-` handling is unported ("Rare; not used by the allowlist"), and the replacement phrases it as "an implemented divergence that does not exist". That is true of the two arms and false of the port against `fnmatch.translate`, whose `-` arm additionally escapes non-range hyphens and deletes out-of-order ranges. The divergence exists; it was never implemented. It is unreachable today, but `_COMPILED_GLOBS` is built at module load (line 121), so a future allowlist class such as `[z-a]` or `[a-]` would throw a RegExp SyntaxError at import and take the whole gate down where Python normalised it — and the function docstring above still claims it mirrors `fnmatch.translate` with no caveat left anywhere in the file. | open | |
