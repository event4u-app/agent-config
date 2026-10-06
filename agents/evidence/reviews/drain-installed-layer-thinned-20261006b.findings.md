# Findings: drain-installed-layer-thinned-20261006b
<!-- completion-review: v1 | reviewed: 2026-10-06 | scope: 0c5e6c3fe3f7f4fd7ed840d0c0adb13b3eba150098971cd8c1fdc6bcf549c937 | diff: 3f64ae273f835889812fe349d21690d056fc305c | reviewer: r2-fresh-subagent-drain-installed-layer-thinned-20261006b | prompt_hash: 5c77bffc9cc97ae417e74367e677a6f931cc55f1553a1252334b3e0057b3ea77 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-installed-layer-thinned-20261006b"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-06 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 3f64ae273f835889812fe349d21690d056fc305c
  scope_hash: 0c5e6c3fe3f7f4fd7ed840d0c0adb13b3eba150098971cd8c1fdc6bcf549c937
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-06T04:38:44Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | src/scripts/lint_rule_law_section.ts:367-399 (`writeBaseline`) | `no_trigger` is recomputed fresh from the live tree every call (`measures.filter(... === 0).map(...)`), with no reference to the previous `no_trigger` list — unlike `law_exceptions`/`body_exceptions`, which genuinely enforce "never raise" via `Math.min(old.chars, m.lawChars)`. The config's own `_comment` claims shrink-only is "blocked by construction" "on every axis", but for list membership (`missing` and now `no_trigger` identically) nothing in `writeBaseline` itself stops a rule that temporarily loses its trigger from being added to the regenerated baseline, or a freshly-introduced triggerless rule from being silently swept in the next time someone runs `--write-baseline`. In practice this is caught only because the regenerated JSON diff is visible to a reviewer, not because the generator refuses it. This is NOT a regression introduced by this diff — `missing` already had exactly this property before step 3.4, and `no_trigger` mirrors it faithfully — but the module docstring is honest about it ("not a cross-commit ratchet … a silently LOWERED baseline is a question the diff answers, not this gate") while the JSON `_comment`'s "blocks by construction" wording overstates what the two list-type baselines actually guarantee. Worth a one-line precision fix to the `_comment` (scope "blocks by construction" to the two exception maps only) rather than a behavior change. | open | pre-existing pattern extended identically to the new axis; see module docstring's own "WHAT IT DOES NOT ASSERT" paragraph, which already concedes this for the gate as a whole |
