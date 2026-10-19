# Findings: upstream-claim-fields-20261019
<!-- completion-review: v1 | reviewed: 2026-10-19 | scope: 918587d8a4e5e45db567ac334f6dce931d49c75c8fcdff9654ddf48c15ce4fbb | diff: e2d7983c547fcc88d844637f2cdcccdf0d61f9df | reviewer: r2-fresh-subagent-upstream-claim-fields-20261019 | prompt_hash: 928582918ad66f2040727f205d6fdb9f8c316e4a3a77fdcefe95f65bcca0fac6 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-upstream-claim-fields-20261019"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-19 -->

<!-- context-manifest: v1
inputs:
  diff_sha: e2d7983c547fcc88d844637f2cdcccdf0d61f9df
  scope_hash: 918587d8a4e5e45db567ac334f6dce931d49c75c8fcdff9654ddf48c15ce4fbb
  roadmap: agents/roadmaps/road-to-one-upstream-that-checks-what-leaves.md
  roadmap_hash: bfa666657a5104b81c9b412633b1408033d5822d77d1f240d22375c4180beb56
  ac_hash: 7c9b60c89771637734e07777e6d822206bfd5843e20a87fe8e579d18de2136e9
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-19T09:27:57Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/_lib/self_repair.ts:802 | `claimFields` resolves `principle`, `mechanism` and `falsifier` independently with first-wins (`existing[field] ?? finding[field]`). A record that first gets only `principle` from one synthesis and later a `falsifier` from a different synthesis ends up pairing a falsifier with a claim it was never written for; and a wrong or outdated claim can never be replaced by a later retro. The three fields form one claim, so they should be adopted together (all-or-nothing from one source), not merged per field. | fixed | e2d7983c5 — claimFields adopts all three from one source (existing if it carries any, else the finding); fold case extended, seen red under per-field merge. |
| 2 | low | src/scripts/_lib/self_repair.ts:138 | `PRINCIPLE_RE` (`^[a-z0-9][a-z0-9/._-]{0,79}$`) accepts empty segments and trailing separators (`drain//drift`, `drain/drift/`, `a..b`), contradicting its docstring "lowercase segments joined by ...". Since the field's purpose is that two syntheses "spell it identically", admitting several spellings of the same slug works against the later clustering use. | fixed | e2d7983c5 — PRINCIPLE_RE now requires non-empty segments with single separators, length bound kept; five bad spellings asserted, seen red under the old pattern. |
| 3 | low | src/scripts/_lib/self_repair.ts:784 | `mechanism` / `falsifier` are checked only for CR/LF, emptiness and length; other control characters (tabs, NUL, ANSI escapes, U+2028) pass, whereas `evidence` goes through `sanitizeEvidence`. Harmless while no body renders them, but the "one line" guarantee is weaker than it reads once a renderer starts using them. | fixed | e2d7983c5 — CONTROL_RE rejects C0, DEL, U+2028 and U+2029; tab, NUL, ANSI and U+2028 asserted, seen red under the CR/LF-only check. |
| 4 | low | tests/scripts/self_repair.test.ts:318 | `claim-fields-change-neither-key-nor-body-yet` asserts the body only for `renderReport(named, 'issue')`; the pull-request route body is not checked, so a renderer change leaking the fields only on the PR route would pass. | fixed | e2d7983c5 — the body pin loops over issue and pull-request; seen red with a pull-request-only leak. |
| 5 | low | agents/roadmaps/road-to-one-upstream-that-checks-what-leaves.md:380 | The new D9 row is inserted between D7 and D8 in the decisions table, breaking numeric order of the decision log. | fixed | e2d7983c5 — D9 moved after D8. |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
