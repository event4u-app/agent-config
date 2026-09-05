/**
 * concern_registry — in-process concern table for the single-process
 * hook dispatcher (road-to-credible-install Phase 1).
 *
 * Maps every `hook_manifest.yaml` concern script path to its statically
 * imported module so the dispatcher can run concerns IN-PROCESS instead of
 * re-spawning tsx per concern (the verified ~1.6 s p50 hot path). Static
 * imports are deliberate: esbuild folds the whole table into
 * `dist/hooks/dispatch.js`, so one `node` start covers dispatcher + every
 * concern.
 *
 * Parity is CI-enforced (tests/hooks/concern_registry_parity.test.ts):
 * every concern in the manifest MUST have a registry entry — a new concern
 * that forgets the registry line falls back to the spawn path and silently
 * reintroduces the latency class this table removed.
 *
 * Invocation contract (mirrors the historical child process exactly):
 *   - stdin  → hook_stdin override (concerns read via readHookStdin())
 *   - argv   → process.argv swapped to [node, <script>, ...args] for the call
 *   - cwd    → process.chdir(workspace) for the call, restored after
 *   - stdout/stderr → captured via write-swap, returned to the dispatcher
 *   - rc     → the concern's `main()` return value (undefined → 0)
 *   - crash  → caught by the dispatcher and mapped to rc 3 (fail-open /
 *              fail-closed reduction unchanged)
 */

import { main as chatHistoryMain } from '../chat_history.js';
import { main as hotContextMain } from '../hot_context_hook.js';
import { main as handoffContextMain } from '../handoff_context_hook.js';
import { main as roadmapProgressMain } from '../roadmap_progress_hook.js';
import { main as onboardingGateMain } from '../onboarding_gate_hook.js';
import { main as contextHygieneMain } from '../context_hygiene_hook.js';
import { main as verifyBeforeCompleteMain } from '../before_complete_hook.js';
import { main as minimalSafeDiffMain } from '../minimal_safe_diff_hook.js';
import { main as shipDiffVolumeMain } from './ship_diff_volume_hook.js';
import { main as injectionScanMain } from '../injection_scan_hook.js';
import { main as memoryLearnMain } from '../memory_learn_hook.js';
import { main as firstRunGateMain } from '../first_run_gate_hook.js';
import { main as profileStalenessMain } from '../profile_staleness_hook.js';
import { main as wrapperFreshnessMain } from '../wrapper_freshness_hook.js';
import { main as surfaceProbeMain } from '../surface_probe_hook.js';
import { main as teamReviewGateMain } from '../team_review_gate_hook.js';
import { main as prUrlReminderMain } from '../pr_url_reminder_hook.js';
import { main as pushSettleMain } from './push_settle_hook.js';
import { main as sessionCanaryMain } from '../session_canary_hook.js';
import { main as councilAvailabilityMain } from '../council_availability_hook.js';
import { main as telemetryDisclosureMain } from '../telemetry_disclosure_hook.js';
import { main as selfRepairMain } from '../self_repair_hook.js';
import { main as sessionRegisterMain } from '../session_register_hook.js';
import { main as languageMirrorMain } from '../language_mirror_hook.js';
import { main as gitAuthorizationMain } from '../git_authorization_hook.js';
import { main as blockUnauthorizedGitMain } from './block_unauthorized_git.js';
import { main as evidenceIndependenceMain } from './evidence_independence.js';
import { main as blockNoVerifyMain } from './block_no_verify.js';
import { main as blockKernelRuleWritesMain } from './block_kernel_rule_writes.js';
import { main as blockConfigWeakeningMain } from './block_config_weakening.js';
import { main as blockSpeakingInboxDirMain } from './block_speaking_inbox_dir.js';
import { main as rtkWrapMain } from './rtk_wrap_hook.js';
import { _main as designPassMain } from './design_pass_hook.js';
import { main as designSlopMain } from './design_slop_hook.js';
import { main as codeGraphNudgeMain } from './code_graph_nudge_hook.js';
import { main as suggestionCaptureMain } from './suggestion_capture_hook.js';
import { main as uiRouteNudgeMain } from './ui_route_nudge_hook.js';
import { main as orchestrationRecordMain } from './orchestration_record_hook.js';
import { main as telemetryUsageMain } from './telemetry_usage_hook.js';
import { main as telemetryFlushMain } from './telemetry_flush_hook.js';
import { main as delegationNudgeMain } from './delegation_nudge_hook.js';
import { main as skillRouteMain } from './skill_route_hook.js';
import { main as ruleInjectMain } from './rule_inject_hook.js';
import { main as endReviewNudgeMain } from './end_review_nudge_hook.js';
import { main as turnEndGateMain } from './turn_end_gate_hook.js';
import { main as editShapeMain } from './edit_shape_hook.js';
import { main as commentDisciplineMain } from './comment_discipline_hook.js';
import { main as rereadGuardMain } from './reread_guard_hook.js';
import { main as sessionEolMain } from './session_eol_hook.js';
import { main as subagentLedgerMain } from './subagent_ledger_hook.js';
import { main as toolResultBytesMain } from './tool_result_bytes_hook.js';
import { main as spawnGuardShadowMain } from './spawn_guard_shadow_hook.js';
import { main as sourceFirstGateMain } from './source_first_gate_hook.js';
import { main as interruptionLedgerMain } from './interruption_ledger_hook.js';
import { main as runContinuationMain } from './run_continuation_hook.js';
import { main as journalRecordMain } from './journal_record_hook.js';

/** A concern `main` — argv-taking or not; both shapes exist. */
export type ConcernMain = (argv?: string[]) => number | undefined | void;

/** Keyed by the manifest's `script:` value (repo-relative path). */
export const CONCERN_REGISTRY: Readonly<Record<string, ConcernMain>> = {
    'src/scripts/chat_history.ts': chatHistoryMain as ConcernMain,
    'src/scripts/hot_context_hook.ts': hotContextMain as ConcernMain,
    'src/scripts/handoff_context_hook.ts': handoffContextMain as ConcernMain,
    'src/scripts/roadmap_progress_hook.ts': roadmapProgressMain as ConcernMain,
    'src/scripts/onboarding_gate_hook.ts': onboardingGateMain as ConcernMain,
    'src/scripts/context_hygiene_hook.ts': contextHygieneMain as ConcernMain,
    'src/scripts/before_complete_hook.ts': verifyBeforeCompleteMain as ConcernMain,
    'src/scripts/minimal_safe_diff_hook.ts': minimalSafeDiffMain as ConcernMain,
    'src/scripts/hooks/ship_diff_volume_hook.ts': shipDiffVolumeMain as ConcernMain,
    'src/scripts/injection_scan_hook.ts': injectionScanMain as ConcernMain,
    'src/scripts/memory_learn_hook.ts': memoryLearnMain as ConcernMain,
    'src/scripts/first_run_gate_hook.ts': firstRunGateMain as ConcernMain,
    'src/scripts/profile_staleness_hook.ts': profileStalenessMain as ConcernMain,
    'src/scripts/wrapper_freshness_hook.ts': wrapperFreshnessMain as ConcernMain,
    'src/scripts/surface_probe_hook.ts': surfaceProbeMain as ConcernMain,
    'src/scripts/team_review_gate_hook.ts': teamReviewGateMain as ConcernMain,
    'src/scripts/pr_url_reminder_hook.ts': prUrlReminderMain as ConcernMain,
    'src/scripts/hooks/push_settle_hook.ts': pushSettleMain as ConcernMain,
    'src/scripts/session_canary_hook.ts': sessionCanaryMain as ConcernMain,
    'src/scripts/council_availability_hook.ts': councilAvailabilityMain as ConcernMain,
    'src/scripts/telemetry_disclosure_hook.ts': telemetryDisclosureMain as ConcernMain,
    'src/scripts/self_repair_hook.ts': selfRepairMain as ConcernMain,
    'src/scripts/session_register_hook.ts': sessionRegisterMain as ConcernMain,
    'src/scripts/language_mirror_hook.ts': languageMirrorMain as ConcernMain,
    'src/scripts/git_authorization_hook.ts': gitAuthorizationMain as ConcernMain,
    'src/scripts/hooks/block_unauthorized_git.ts': blockUnauthorizedGitMain as ConcernMain,
    'src/scripts/hooks/evidence_independence.ts': evidenceIndependenceMain as ConcernMain,
    'src/scripts/hooks/block_no_verify.ts': blockNoVerifyMain as ConcernMain,
    'src/scripts/hooks/block_kernel_rule_writes.ts': blockKernelRuleWritesMain as ConcernMain,
    'src/scripts/hooks/block_config_weakening.ts': blockConfigWeakeningMain as ConcernMain,
    'src/scripts/hooks/block_speaking_inbox_dir.ts': blockSpeakingInboxDirMain as ConcernMain,
    'src/scripts/hooks/rtk_wrap_hook.ts': rtkWrapMain as ConcernMain,
    'src/scripts/hooks/design_pass_hook.ts': designPassMain as ConcernMain,
    'src/scripts/hooks/design_slop_hook.ts': designSlopMain as ConcernMain,
    'src/scripts/hooks/code_graph_nudge_hook.ts': codeGraphNudgeMain as ConcernMain,
    'src/scripts/hooks/suggestion_capture_hook.ts': suggestionCaptureMain as ConcernMain,
    'src/scripts/hooks/ui_route_nudge_hook.ts': uiRouteNudgeMain as ConcernMain,
    'src/scripts/hooks/orchestration_record_hook.ts': orchestrationRecordMain as ConcernMain,
    'src/scripts/hooks/telemetry_usage_hook.ts': telemetryUsageMain as ConcernMain,
    'src/scripts/hooks/telemetry_flush_hook.ts': telemetryFlushMain as ConcernMain,
    'src/scripts/hooks/delegation_nudge_hook.ts': delegationNudgeMain as ConcernMain,
    'src/scripts/hooks/skill_route_hook.ts': skillRouteMain as ConcernMain,
    'src/scripts/hooks/rule_inject_hook.ts': ruleInjectMain as ConcernMain,
    'src/scripts/hooks/end_review_nudge_hook.ts': endReviewNudgeMain as ConcernMain,
    'src/scripts/hooks/turn_end_gate_hook.ts': turnEndGateMain as ConcernMain,
    'src/scripts/hooks/edit_shape_hook.ts': editShapeMain as ConcernMain,
    'src/scripts/hooks/comment_discipline_hook.ts': commentDisciplineMain as ConcernMain,
    'src/scripts/hooks/reread_guard_hook.ts': rereadGuardMain as ConcernMain,
    'src/scripts/hooks/session_eol_hook.ts': sessionEolMain as ConcernMain,
    'src/scripts/hooks/subagent_ledger_hook.ts': subagentLedgerMain as ConcernMain,
    'src/scripts/hooks/tool_result_bytes_hook.ts': toolResultBytesMain as ConcernMain,
    'src/scripts/hooks/spawn_guard_shadow_hook.ts': spawnGuardShadowMain as ConcernMain,
    'src/scripts/hooks/source_first_gate_hook.ts': sourceFirstGateMain as ConcernMain,
    'src/scripts/hooks/interruption_ledger_hook.ts': interruptionLedgerMain as ConcernMain,
    'src/scripts/hooks/run_continuation_hook.ts': runContinuationMain as ConcernMain,
    'src/scripts/hooks/journal_record_hook.ts': journalRecordMain as ConcernMain,
};
