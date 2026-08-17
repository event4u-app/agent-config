# Findings: pretool-slot-coverage-truth
<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: fbe370ef18596e28228731a0fe9b4a6acc99485acda25299cfb1e821605528cc | diff: d36c665b5b5d6918d0200710d3df489b10084782 | reviewer: r2-fresh-subagent-pretool-slot-coverage-truth | prompt_hash: f1f67b5549282b55d90bd5bc55227a45f1208c5823b1ad82b3aef854528e15ca -->

<!-- context-manifest: v1
inputs:
  diff_sha: d36c665b5b5d6918d0200710d3df489b10084782
  scope_hash: fbe370ef18596e28228731a0fe9b4a6acc99485acda25299cfb1e821605528cc
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-17T02:59:51Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | docs/contracts/hook-architecture-v1.md:301 | The new state model has three rows and the tree records a fourth: **bound but cannot deny**. `host_semantics.ts:54` sets `VERIFIED_PLATFORMS = {"claude"}` — every other platform, augment and cowork included, falls through to `legacyExit` (internal `EXIT_BLOCK = 1`), which that module's own header documents as the non-blocking code. On top of that both `augment-dispatcher.sh:59-65` and `cowork-dispatcher.sh` pipe the dispatcher `>/dev/null 2>&1 \|\| true` and `exit 0`, with headers stating "Always exit 0 — … must never block the agent loop"; the cowork header adds "lifecycle events do not actually fire". So the Bound row's "listing the concerns **that run**" and the three rules' re-asserted "deterministically blocked" / "enforced at tool-call time" over `augment, claude, cowork` overstate enforcement on 2 of the 3 hosts. This is the same unbacked-host-capability move the change exists to remove, run in the positive direction. | open | |
| 2 | medium | docs/contracts/hook-architecture-v1.md:293 | "The three blocking guards (`block-no-verify`, `block-kernel-rule-writes`, `block-config-weakening`)" omits `block-unauthorized-git`, which carries `severity: blocking` (hook_manifest.yaml:308) and is bound in every `pre_tool_use` row (hook_manifest.yaml:675, 683, 737). Four `block-*` blocking guards sit on the slot, not three — and `evidence-independence`, listed as merely "the concern", is itself `severity: blocking` (hook_manifest.yaml:330). An enumeration error in the preamble of the section that is meant to be the single tabulation. | open | |
| 3 | medium | src/rules/git-history-discipline.md:87 | Changed line asserts the frequency join "reports the per-commit obligation as uncovered on **exactly those platforms**", where the preceding list is the five hosts *including copilot*. `check_enforcement_coverage.ts:487` skips every `fallback_only` platform before computing `gap_platforms`, and `_lib/obligation_frequency.ts:280-289` documents copilot's exclusion by declaration. The join therefore reports four hosts (cursor, cline, windsurf, gemini), never five. Same defect on the changed lines of src/rules/evaluator-independence.md:100-102 ("reports exactly that set"). A falsifiable claim about a named script, on lines this change rewrote. | open | |
| 4 | medium | src/scripts/schemas/skill.schema.json:279 | Defect-pattern sweep: the corrected claim survives verbatim outside the changed set. `skill.schema.json:279` and `command.schema.json:257` both ship "on 5 of 8 hosts there is no `pre_tool_use` slot" — exactly the statement this change declares false for cursor, cline and gemini. `src/rules/ui-audit-gate.md:125` ("bound only where a `pre_tool_use` slot exists") and `src/rules/design-review-after-ui-write.md:118` ("bound only on hosts carrying a `pre_tool_use` slot") keep the same conflation — and the corrected comment at `ui_route_nudge_hook.ts:34-35` now routes readers to those two rules ("exactly as the two rules already declare"). 4 live sites matched; the only other hits ("nowhere to bind") are in `agents/roadmaps/archive/`, which is inert. | open | |
| 5 | low | docs/contracts/hook-architecture-v1.md:306 | "the host sends a pre-tool event and the translation table already accepts it" is stated unqualified for cursor, while `src/scripts/_lib/session_register.ts:178` records that cursor's per-turn slots are **IDE-only** and the CLI "fires only shell-execution hooks" (cited to `hook_manifest.yaml:365-366` and `chat-history-platform-hooks.md:214`; echoed at hook_manifest.yaml:398). The same comment warns that a slot-presence instrument "has no IDE/CLI dimension, so it reports cursor covered" — the precise over-read this section reproduces. The § "What is NOT established" paragraph asks the deny question only of unbound hosts and never mentions this recorded CLI/IDE split. | open | |
| 6 | low | docs/contracts/hook-architecture-v1.md:18 | "Last refreshed: 2026-05-04" is not bumped although the change adds a normative section explicitly dated 2026-08-17 and now cited as the single source of truth by three rules and one hook header. A reader using the doc's own freshness marker is misled about the age of the section they were routed to. | open | |

<!-- Scope note: verifying the diff's central factual claim required reading
     `src/scripts/hook_manifest.yaml` and the concern/trampoline files it names
     (`host_semantics.ts`, `augment-dispatcher.sh`, `cowork-dispatcher.sh`,
     `check_enforcement_coverage.ts`, `_lib/obligation_frequency.ts`,
     `_lib/session_register.ts`, `_lib/kernel_rules.ts`), which sit outside the
     branch-touched set named in the prompt's tool allowlist. Every reference in
     the diff is an assertion about those files; a review confined to the changed
     paths could only have checked the prose against itself. No session
     artifacts, no `agents/runtime/`, no `git log` beyond the branch. -->

<!-- Checked and clean: kernel-membership — none of the three edited rules is a
     kernel rule (`_lib/kernel_rules.ts:17-26`), so the one-rule-per-PR
     slow-rollout gate does not apply. src↔dist projection — the three dist twins
     differ from source only by the pipeline's `../../docs/` → `../docs/` rewrite
     (54 pre-existing peers in `dist/agent-src/rules/` use the same form). Hooks
     are not projected into `dist/agent-src/scripts/`, so the `.ts` comment edit
     needs no twin. The bound/aliased/absent partition itself is accurate against
     `hook_manifest.yaml` (`platforms:` 670-821, `native_event_aliases:` 822-897),
     and `gap_platforms` is indeed computed from bindings, not aliases. -->
