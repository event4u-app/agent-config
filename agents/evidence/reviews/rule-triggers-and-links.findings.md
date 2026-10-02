# Findings: rule-triggers-and-links
<!-- completion-review: v1 | reviewed: 2026-10-02 | scope: 2aa6f1f7101138f7f44293b5cbfe080cb4745d68a9e46dafe28d61aabae622e1 | diff: e0b5320f77fa9f0586923c44ce3bec3626465d92 | reviewer: r2-fresh-subagent-rule-triggers-and-links | prompt_hash: cf0b422948212691ec9b8e0aefe20aaa817e3126720190069696a34019ff4559 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-rule-triggers-and-links"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-02 -->

<!-- context-manifest: v1
inputs:
  diff_sha: e0b5320f77fa9f0586923c44ce3bec3626465d92
  scope_hash: 2aa6f1f7101138f7f44293b5cbfe080cb4745d68a9e46dafe28d61aabae622e1
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-02T10:41:58Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | agents/roadmaps/road-to-rule-triggers-and-links-that-hold.md | Blocker `forty-seven-links-name-files-the-package-does-not-ship` resolved-when named only the `docs` row and the `outside-install-root` rows, which cover 45 of its 47. Group 3s two one-offs are `directory-not-deployed` rows and satisfy neither condition, so the blocker could close with 2 links still dead and AC-2 still false. | fixed | dd4bd191e — both rows now named explicitly, with the arithmetic stated |
| 2 | low | agents/roadmaps/road-to-rule-triggers-and-links-that-hold.md | Group 3 rejected deploying `templates/` by invoking the standing-cost test D4 applied; D4s test is standing CHARACTERS, on which deploying scores 0 for any directory. The operative criterion is MB per link resolved. | fixed | dd4bd191e — restated as a different test (1.7 MB for one link against 1.6 MB for 113) |
| 3 | low | src/install/claudePathsPlan.ts | The comment at the `_has_non_path_trigger` call site still enumerated keyword / phrase — the list the predicate stopped being, 40 lines under a docblock saying so. Same drift class D1 names as the defects cause. | fixed | dd4bd191e — call-site comment now describes the negation |
| 4 | low | src/install/installedRuleLinks.ts | For a plan mapping rules to the install root, any first segment the plan did not carry took the root branch and was probed inside the rules source, returning `file-missing` — whose documented meaning is that the directory IS deployed. Latent: clines `directory-not-deployed` is pinned at 0, so no number was wrong. | fixed | dd4bd191e — the root entry now answers for a bare filename only |
| 5 | low | src/scripts/report_installed_rule_links.ts | The reporters only cost line printed the rewrite price with no caveat, while D4 uses a like-for-like figure 40 % lower; `rewriteOptionCost` prices every unresolved link including those a rewrite cannot reach. | fixed | dd4bd191e — the line now states what it priced |
