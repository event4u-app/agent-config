# Findings: listings-a-release-keeps-current
<!-- completion-review: v1 | reviewed: 2026-10-24 | scope: 49c1d75e6b10b85eed1765c4e945ee2ea420f54a6b866b14e0a1017f5a511918 | diff: c3c3ae9dc577cad2408be8aa405f0682c83ead24 | reviewer: r2-fresh-subagent-listings-a-release-keeps-current | prompt_hash: c0df3cd4ebd804322755bdc701d3501fec1c13e5041b8400c36ef9f322a21557 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-listings-a-release-keeps-current"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-24 -->

<!-- context-manifest: v1
inputs:
  diff_sha: c3c3ae9dc577cad2408be8aa405f0682c83ead24
  scope_hash: 49c1d75e6b10b85eed1765c4e945ee2ea420f54a6b866b14e0a1017f5a511918
  roadmap: agents/roadmaps/archive/road-to-listings-a-release-keeps-current.md
  roadmap_hash: 39ddd9a959cb738f2122d5e417c489d02113446c3003af6eab6e94d9baeb515e
  ac_hash: 6fd6074c5c7b55d6f01cf355d235bad33786a8f84deb8e23364052fe14bdf99e
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-24T03:14:23Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/adoption_status.ts:589 | AC-4 is ticked as "no ledger row can sit in `accepted` after its listing vanished without a red on main within a day", but row 3 (`mcpservers.org`, `accepted`, `listing-page`) is documented in the same ledger as always reading `unreachable` via curl (Cloudflare 403), and `_actionFor` never raises an action for an unreadable upstream. If that listing disappeared, the daily `--fail-on-action` watcher would stay green indefinitely, so the criterion does not hold for every row. | fixed | 2034929c58 — an accepted or submitted row unread past the 30-day threshold is now `read-overdue`; AC-4 states the bound |
| 2 | medium | .claude-plugin/skills/install-agent-config/SKILL.md:5 | The install-pointer skill is now also shipped by the Copilot discovery plugin (`.github/plugin/plugin.json` `skills`), which registers no hooks and adds an MCP server. The rewritten description still says "This marketplace plugin is a bootstrap shim — it ships hooks plus this pointer only", so it tells a Copilot user something false about the plugin they installed. The same text is in `condense.ts` PLUGIN_POINTER_SKILL_BODY. | fixed | 54c771bbfe — the pointer names what each plugin adds and that neither is the full suite; a test pins it |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
