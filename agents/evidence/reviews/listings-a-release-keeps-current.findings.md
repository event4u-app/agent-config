# Findings: listings-a-release-keeps-current
<!-- completion-review: v1 | reviewed: 2026-10-24 | scope: 3c761f3aefdd4310252c2be06bba2618cc3ae488d8d6cb91b7c2ffbc889d75f6 | diff: e99d6bbad5c7e50d83a8ad7c5d26c7e6f7f8d73d | reviewer: r2-fresh-subagent-listings-a-release-keeps-current | prompt_hash: c0df3cd4ebd804322755bdc701d3501fec1c13e5041b8400c36ef9f322a21557 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-listings-a-release-keeps-current"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-24 -->

<!-- context-manifest: v1
inputs:
  diff_sha: e99d6bbad5c7e50d83a8ad7c5d26c7e6f7f8d73d
  scope_hash: 3c761f3aefdd4310252c2be06bba2618cc3ae488d8d6cb91b7c2ffbc889d75f6
  roadmap: agents/roadmaps/archive/road-to-listings-a-release-keeps-current.md
  roadmap_hash: b752faf21f4c978efcd131370b4172656b453feacd648d7f6b64d3cf242c378e
  ac_hash: 9293f42343466618b97abd96e0b73bfb100104313f3077b0e4589c6462e860c2
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-24T03:14:23Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/adoption_status.ts:589 | AC-4 is ticked as "no ledger row can sit in `accepted` after its listing vanished without a red on main within a day", but row 3 (`mcpservers.org`, `accepted`, `listing-page`) is documented in the same ledger as always reading `unreachable` via curl (Cloudflare 403), and `_actionFor` never raises an action for an unreadable upstream. If that listing disappeared, the daily `--fail-on-action` watcher would stay green indefinitely, so the criterion does not hold for every row. | open | AC-4; docs/distribution/registry-submissions.md row 3 |
| 2 | medium | .claude-plugin/skills/install-agent-config/SKILL.md:5 | The install-pointer skill is now also shipped by the Copilot discovery plugin (`.github/plugin/plugin.json` `skills`), which registers no hooks and adds an MCP server. The rewritten description still says "This marketplace plugin is a bootstrap shim — it ships hooks plus this pointer only", so it tells a Copilot user something false about the plugin they installed. The same text is in `condense.ts` PLUGIN_POINTER_SKILL_BODY. | open | roadmap 3.3/3.5, E3 condition (description must say discovery plugin, not the full suite) |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
