# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: 0026b1c95388e1daa0d5e0a3e4b898dd1618997cf1f3a88808074ff832690dfb | diff: a15f092f862ff068dd6e8ae738899111aca108cc | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: 1fa796d5209db4dd51a7ec2fda62622689ea1da192546c9e6322108f46c7a007 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: a15f092f862ff068dd6e8ae738899111aca108cc
  scope_hash: 0026b1c95388e1daa0d5e0a3e4b898dd1618997cf1f3a88808074ff832690dfb
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T08:52:10Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | src/scripts/report_evidence_temperature.ts:79 | The new `defaultReportPath` docblock claims it is "The one place the name is spelled". It is not: `latestReportBefore` (same file, line 413) independently spells the `.md` extension in its own filter. Change the extension in `defaultReportPath` and that filter matches nothing, while `--since latest` treats an empty result as "a legitimate first run, never an error" — the desync degrades silently with no red anywhere. The comment asserts a single-site invariant the file contradicts two hundred lines down, which is exactly the licence a future rename needs to break discovery quietly. | fixed | 7a0f62682 —  |
| 2 | low | tests/scripts/check_release_pr_shape.test.ts:164 | The new UTC day-boundary test has no sensitivity at offset 0 — its own comment says so, and adds that the TZ is not pinned in `vitest.config.ts`. Under `TZ=UTC`, the common CI default, a local-time implementation passes both assertions unchanged, so the property promoted out of prose into an assertion still cannot fail in the environment where it is meant to gate. Disclosure is not closure here: pinning TZ for this suite is the fix, and it is one line. | fixed | 7a0f62682 —  |
| 3 | low | src/scripts/check_release_pr_shape.ts:103 | The new inline comment narrows the bracket branch to "checked against `[0-9]`, the only class the allowlist uses; anything else is untested", but the function's unchanged docblock (line 67) still states flatly that it mirrors `fnmatch.translate`. The same function now carries a general guarantee and its own denial; a maintainer reading the docblock would add a bracket class believing it is covered. The same sentence also asserts that CPython behaviour "varies by version" with nothing in the branch supporting it — an uncited external claim in the comment this round edited to stop making uncited external claims. | fixed | 7a0f62682 —  |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
