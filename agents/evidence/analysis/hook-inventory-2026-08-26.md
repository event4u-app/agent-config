<!-- evidence-type: analysis -->
# Hook inventory — 53 concerns, their slots and their exit contracts

`road-to-skill-ecosystem-runtime-enforcement` Phase 0 Step 2, so Phase 1
does not duplicate an existing guard.

## Reproduce

```
agent-config hooks:status        # what is bound on the host you are on
agent-config hooks:doctor        # health, posture, missing trampolines
```

The table below is derived from `src/scripts/hook_manifest.yaml` — the
`concerns:` map crossed with the `platforms:` bindings, inverted so each row is
one concern rather than one slot.

## The headline, and it corrects the roadmap

The step says *"the current 15 hooks"*. There are **53**. The figure was true
when the step was written and is not true of the tree it now runs against —
recorded as a correction rather than silently working from the larger number,
because a plan sized for 15 guards is a different plan.

- **53 concerns**, every one bound to at least one host slot and every one
  resolving to a script that exists on disk. No orphans in either direction.
- **46 advisory, 7 blocking.** Only **3** are `fail_closed: true`.
- The blocking seven are the guards Phase 1 must not duplicate:
  - `block-no-verify` — pre_tool_use (fail-closed)
  - `block-kernel-rule-writes` — pre_tool_use (fail-closed)
  - `block-config-weakening` — pre_tool_use (fail-open)
  - `block-unauthorized-git` — pre_tool_use (fail-closed)
  - `evidence-independence` — pre_tool_use (fail-open)
  - `turn-end-gate` — stop (fail-open)
  - `run-continuation` — stop (fail-open)

**The shim in Phase 1 Step 2 duplicates none of them.** The nearest neighbours
are `block-no-verify` and `block-unauthorized-git`, which guard git invocations,
and `block-kernel-rule-writes`, which guards a write path. None covers
container-only tooling, and none is a PATH shim — every one is a `pre_tool_use`
concern, so they pay a spawn per tool call where the shim pays one path prepend
per session.

## The full inventory

| concern | slots | severity | fail-closed | hosts bound | script |
|---|---|---|---|---|---|
| `chat-history` | post_tool_use, session_end, session_start, stop, user_prompt_submit | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/chat_history.ts` |
| `hot-context` | pre_compact, session_start, stop | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/hot_context_hook.ts` |
| `handoff-context` | session_start | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/handoff_context_hook.ts` |
| `roadmap-progress` | post_tool_use, session_end, stop | advisory | no | augment claude cline cowork cursor gemini | `src/scripts/roadmap_progress_hook.ts` |
| `onboarding-gate` | session_start | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/onboarding_gate_hook.ts` |
| `context-hygiene` | post_tool_use | advisory | no | augment claude cline cowork cursor gemini | `src/scripts/context_hygiene_hook.ts` |
| `verify-before-complete` | post_tool_use, session_start, stop, user_prompt_submit | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/before_complete_hook.ts` |
| `ship-diff-volume` | pre_tool_use | advisory | no | augment claude cowork | `src/scripts/hooks/ship_diff_volume_hook.ts` |
| `minimal-safe-diff` | post_tool_use, session_start, user_prompt_submit | advisory | no | augment claude cline cowork cursor gemini | `src/scripts/minimal_safe_diff_hook.ts` |
| `injection-scan` | post_tool_use | advisory | no | augment claude cline cowork cursor gemini | `src/scripts/injection_scan_hook.ts` |
| `block-no-verify` | pre_tool_use | blocking | yes | augment claude cowork | `src/scripts/hooks/block_no_verify.ts` |
| `block-kernel-rule-writes` | pre_tool_use | blocking | yes | augment claude cowork | `src/scripts/hooks/block_kernel_rule_writes.ts` |
| `block-config-weakening` | pre_tool_use | blocking | no | augment claude cowork | `src/scripts/hooks/block_config_weakening.ts` |
| `rtk-wrap` | pre_tool_use | advisory | no | augment claude cowork | `src/scripts/hooks/rtk_wrap_hook.ts` |
| `design-slop` | pre_tool_use | advisory | no | augment claude cowork | `src/scripts/hooks/design_slop_hook.ts` |
| `design-pass` | post_tool_use | advisory | no | augment claude cline cowork cursor gemini | `src/scripts/hooks/design_pass_hook.ts` |
| `design-pass-stop` | stop | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/hooks/design_pass_hook.ts` |
| `ui-route-nudge` | pre_tool_use | advisory | no | augment claude cowork | `src/scripts/hooks/ui_route_nudge_hook.ts` |
| `suggestion-capture` | stop, user_prompt_submit | advisory | no | claude | `src/scripts/hooks/suggestion_capture_hook.ts` |
| `code-graph-nudge` | pre_tool_use | advisory | no | augment claude cowork | `src/scripts/hooks/code_graph_nudge_hook.ts` |
| `memory-learn` | session_end | advisory | no | augment claude cline cowork cursor gemini | `src/scripts/memory_learn_hook.ts` |
| `first-run-gate` | session_start | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/first_run_gate_hook.ts` |
| `profile-staleness` | session_start | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/profile_staleness_hook.ts` |
| `wrapper-freshness` | session_start | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/wrapper_freshness_hook.ts` |
| `surface-probe` | session_start | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/surface_probe_hook.ts` |
| `team-review-gate` | stop | advisory | no | claude | `src/scripts/team_review_gate_hook.ts` |
| `pr-url-reminder` | post_tool_use | advisory | no | augment claude cline cowork cursor gemini | `src/scripts/pr_url_reminder_hook.ts` |
| `language-mirror` | post_tool_use, pre_compact, user_prompt_submit | advisory | no | claude cline cowork cursor gemini windsurf | `src/scripts/language_mirror_hook.ts` |
| `git-authorization` | user_prompt_submit | advisory | no | claude cline cowork cursor gemini windsurf | `src/scripts/git_authorization_hook.ts` |
| `block-unauthorized-git` | pre_tool_use | blocking | yes | augment claude cowork | `src/scripts/hooks/block_unauthorized_git.ts` |
| `evidence-independence` | pre_tool_use | blocking | no | augment claude cowork | `src/scripts/hooks/evidence_independence.ts` |
| `session-canary` | session_start, user_prompt_submit | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/session_canary_hook.ts` |
| `council-availability` | session_start | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/council_availability_hook.ts` |
| `telemetry-disclosure` | session_start | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/telemetry_disclosure_hook.ts` |
| `telemetry-flush` | session_end | advisory | no | augment claude cline cowork cursor gemini | `src/scripts/hooks/telemetry_flush_hook.ts` |
| `self-repair` | stop, user_prompt_submit | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/self_repair_hook.ts` |
| `session-register` | session_end, session_start, stop, user_prompt_submit | advisory | no | augment claude cline cowork cursor gemini windsurf | `src/scripts/session_register_hook.ts` |
| `orchestration-record` | post_tool_use | advisory | no | augment claude cline cowork cursor gemini | `src/scripts/hooks/orchestration_record_hook.ts` |
| `telemetry-usage` | post_tool_use | advisory | no | augment claude cline cowork cursor gemini | `src/scripts/hooks/telemetry_usage_hook.ts` |
| `delegation-nudge` | user_prompt_submit | advisory | no | claude | `src/scripts/hooks/delegation_nudge_hook.ts` |
| `skill-route` | user_prompt_submit | advisory | no | claude | `src/scripts/hooks/skill_route_hook.ts` |
| `rule-inject` | pre_compact, pre_tool_use, user_prompt_submit | advisory | no | claude | `src/scripts/hooks/rule_inject_hook.ts` |
| `end-review-nudge` | stop | advisory | no | claude | `src/scripts/hooks/end_review_nudge_hook.ts` |
| `turn-end-gate` | stop | blocking | no | claude | `src/scripts/hooks/turn_end_gate_hook.ts` |
| `edit-shape` | post_tool_use | advisory | no | augment claude cline cowork cursor gemini | `src/scripts/hooks/edit_shape_hook.ts` |
| `reread-guard` | pre_tool_use | advisory | no | augment claude cowork | `src/scripts/hooks/reread_guard_hook.ts` |
| `session-eol` | stop | advisory | no | claude | `src/scripts/hooks/session_eol_hook.ts` |
| `run-continuation` | stop | blocking | no | claude | `src/scripts/hooks/run_continuation_hook.ts` |
| `interruption-ledger` | stop | advisory | no | claude | `src/scripts/hooks/interruption_ledger_hook.ts` |
| `subagent-ledger` | subagent_start, subagent_stop | advisory | no | claude cowork | `src/scripts/hooks/subagent_ledger_hook.ts` |
| `tool-result-bytes` | post_tool_use | advisory | no | augment claude cline cowork cursor gemini | `src/scripts/hooks/tool_result_bytes_hook.ts` |
| `spawn-guard-shadow` | pre_tool_use | advisory | no | claude cowork | `src/scripts/hooks/spawn_guard_shadow_hook.ts` |
| `source-first-gate` | pre_tool_use | advisory | no | claude cowork | `src/scripts/hooks/source_first_gate_hook.ts` |

## What `fail_closed` means here, since only three carry it

`fail_closed: true` says the dispatcher treats a CRASH in the concern as a
refusal rather than as a pass. It is orthogonal to `severity`: a blocking
concern that is fail-open still refuses when it decides to refuse — it simply
does not refuse when it breaks. Four of the seven blocking concerns are
fail-open, which is the honest reading of a guard whose own failure should not
stop a turn.
