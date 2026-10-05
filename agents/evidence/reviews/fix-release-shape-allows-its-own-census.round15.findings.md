# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: 451d2c89197d1e75542dac7e1d517374d53b32e2ea5462b6c29148a101abb151 | diff: 3657fd005a2504b53597160d5600c04013740cd4 | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: a8f7e0379fe0d6c41d0747996794b4429d6e21bdf3d25583383944f56f6c0e89 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 3657fd005a2504b53597160d5600c04013740cd4
  scope_hash: 451d2c89197d1e75542dac7e1d517374d53b32e2ea5462b6c29148a101abb151
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T09:49:32Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | docs/contracts/release-pr-gating.md:150 | The blockquote this diff rewrites now refutes the categorical claim ("the categorical version — 'no entry is install or runtime code' — is false of several of them"), but three later sections still assert that same claim verbatim as the justification for the skip: § Cut surface's preamble ("jobs that release PRs cannot regress by construction (no install scripts, no runtime code, no test source in the release-PR allowlist)", L150-152), § Release install E2E (L189-193) and § Consumer-matrix exemption (L216-218). Before the diff the document asserted the over-broad claim consistently; after it, the same document both asserts and refutes it, and a reader entering at § Cut surface gets the refuted version. The new text pre-emptively reconciles with § Mid-release fixes but is silent on the three sections that carry the sentence it just called false. | fixed | 9dfef9a93 —  |
| 2 | medium | docs/contracts/release-pr-gating.md:159 | The § Cut surface table is a third copy of the allowlist path list and it is stale in exactly the way the blockquote copy was — the defect this change exists to remove. `node-tests` claims "release-PR diff has no `src/**` … `packages/core/installer/**`": the enumeration added at L74-90 admits five `src/**` paths (`src/packs/*/pack.yaml`, `src/packs/*/README.md`, `src/domains/*/pack.yaml`, `src/domains/*/README.md`, `src/agent-src/templates/agents/agent-project-settings.example.yml`) and `packages/` is the pre-rename spelling this very diff corrected to `src/packs/` elsewhere. `smoke` (L161) claims no `templates/**` while the same enumeration names two template files. The new paragraph at L102-106 states the blockquote "now carries no copy at all rather than a third one to keep in sync" — a copy in table form remains, un-updated, in the same file. | fixed | 9dfef9a93 —  |
| 3 | low | docs/contracts/release-pr-gating.md:111 | The change records that "a parity check between this list and `ALLOWLIST_GLOBS` would, and does not exist" and leaves the binding to an instruction plus review; findings 1 and 2 are that instruction failing inside this same change, so the gap is evidenced rather than hypothetical. `ALLOWLIST_GLOBS` is already exported (src/scripts/check_release_pr_shape.ts:306) and the doc list is a flat markdown bullet list, so a parity assertion in tests/scripts/check_release_pr_shape.test.ts is small and would have gone red on the `packages/*` → `src/packs/*` drift this change had to repair by hand. | fixed | 9dfef9a93 —  |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
