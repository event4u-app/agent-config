# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: 787c6ee59d796bab781a417917ab187485f48f9c7c7ab16b5ad5d7c777e46d9e | diff: 03e9a4cff9e218e2a079c1066b9c9385826e719d | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: 569b83134e055a846f8782b5c02278edeb25c5ed21daefe3b5cbb9df369af7ee -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 03e9a4cff9e218e2a079c1066b9c9385826e719d
  scope_hash: 787c6ee59d796bab781a417917ab187485f48f9c7c7ab16b5ad5d7c777e46d9e
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T10:33:57Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | .github/workflows/tests.yml:188 | The `node-tests` skip comment still asserts that release PRs "don't touch src/** or tests/**". This same change declares that claim false in the contract it cites — `docs/contracts/release-pr-gating.md:176` reads "the diff has no `src/**`" would be the stronger claim, and it is false — and `ALLOWLIST_GLOBS` admits five `src/` entries (`src/packs/*/pack.yaml`, `src/packs/*/README.md`, `src/domains/*/pack.yaml`, `src/domains/*/README.md`, `src/agent-src/templates/agents/agent-project-settings.example.yml`). The justification a reader of the guard actually sees now contradicts the contract the guard points at. | fixed | ce3b5dfb2 —  |
| 2 | medium | .github/workflows/tests.yml:60 | The de-duplication the change performs is incomplete: `tests.yml:60-62` and `smoke-public-install.yml:67-69` each carry a surviving copy of the allowlist — "only touch package.json / CHANGELOG / marketplace / pack manifests and cannot regress ..." — which is the four-item list the contract blockquote removes as stale (it omits the six entries added since) plus the categorical "cannot regress" the blockquote explicitly withdraws. The new parity test binds the contract enumeration to `ALLOWLIST_GLOBS` only, so these two copies remain bound by nothing — the same failure mode the contract's own § Release-PR shape text describes as having already happened once. | fixed | ce3b5dfb2 —  |
| 3 | low | docs/contracts/release-pr-gating.md:186 | The `smoke` row singles out `package.json` as "admitted and this job's own trigger", but `src/agent-src/templates/agents/agent-project-settings.example.yml` is also admitted and also matches this job's `src/agent-src/templates/**` path filter (`.github/workflows/smoke-public-install.yml:48`) — a second admitted path that triggers the very job being skipped. The row disposes of that pair with "not installer input", a content judgement the existence of the path filter argues against, and never notes that it triggers the job. The row was rewritten to be exhaustive about the admitted-path residue; this is the one it leaves unnamed. | fixed | ce3b5dfb2 —  |
| 4 | low | tests/scripts/check_release_pr_shape.test.ts:95 | "The widest of the six" is an unsupported superlative. The stated reason — the `*` sits before the extension, not before a separator — applies equally to `agents/evidence/release-findings/*.json`, asserted two lines above at line 94, which admits the same unbounded depth; neither glob is a superset of the other. The block's own framing is that a reader checking whether a given row is narrow should find the answer here rather than infer it from a neighbour, and the superlative invites exactly that wrong inference about the release-findings row. | fixed | ce3b5dfb2 —  |
| 5 | low | tests/scripts/check_release_pr_shape.test.ts:236 | The invocation pin is a substring filter over a single file, which is weaker than the claim its comment makes for it ("the last layer of the binding" against the drift class that broke 16.3.0). A documentation comment in `taskfiles/content.yml` that merely names `report_evidence_temperature` reds the `toHaveLength(1)` assertion, and an invocation carrying `--out` added in another taskfile or in `release.ts` passes unseen, because nothing outside `taskfiles/content.yml` is read. | fixed | ce3b5dfb2 —  |
