/**
 * Zod schema for `.agent-settings.yml`.
 *
 * Source of truth: `config/agent-settings.template.yml`. Every leaf has a
 * matching template key; the schema↔template parity test
 * (`tests/server/schemas/parity.test.ts`) walks both trees and asserts the
 * Zod schema covers every template path. New template keys without schema
 * additions fail CI.
 *
 * Render strategy: depth ≤ 2. The form renderer (`SchemaForm`, Phase 2)
 * recurses one level into nested objects; deeper trees fail render-time.
 */

import { z } from 'zod';

const costProfile = z.enum(['minimal', 'balanced', 'full', 'custom']);
const enforcementMode = z.enum(['advisory', 'hard-stop']);
const autonomyMode = z.enum(['on', 'off', 'auto']);
const userType = z.enum(['', 'consultant', 'creator', 'developer', 'finance', 'founder', 'gtm', 'ops']);
const accessStyle = z.enum(['getters_setters', 'get_attribute', 'magic_properties']);
const chatFreq = z.enum(['per_turn', 'per_phase', 'per_tool']);
const chatOverflow = z.enum(['rotate', 'compress']);
const qualityCadence = z.enum(['end_of_roadmap', 'per_phase', 'per_step']);
const regenCadence = z.enum(['per_step', 'every_5_steps', 'phase_boundary']);
const worktreeMode = z.enum(['off', 'on', 'ask']);
const replyMethod = z.enum(['replies_endpoint', 'create_review_comment', 'auto']);
const confidenceBand = z.enum(['off', 'low', 'medium', 'high']);
const onBlock = z.enum(['stop', 'ask', 'warn']);
const onBlockFallback = z.enum(['stop', 'warn']);

export const settingsSchema = z.object({
    agent_config_version: z.string().default('').describe('Exact semver pin or empty for unpinned.'),
    cost_profile: costProfile.default('balanced').describe('Master switch for which rule tiers load.'),
    cost: z.object({
        budgets: z.object({
            daily: z.number().min(0).default(0).describe('Daily USD ceiling. 0 = unbudgeted.'),
            weekly: z.number().min(0).default(0).describe('Weekly USD ceiling. 0 = unbudgeted.'),
            monthly: z.number().min(0).default(0).describe('Monthly USD ceiling. 0 = unbudgeted.'),
        }),
        enforcement: enforcementMode.default('advisory').describe('Behaviour at HARD_STOP tier.'),
    }),
    personal: z.object({
        ide: z.string().default('').describe('IDE binary (code, phpstorm, cursor, …).'),
        open_edited_files: z.boolean().default(false).describe('Auto-open edited files in the IDE.'),
        user_name: z.string().default('').describe('Legacy fallback identity (use .agent-user.md).'),
        rtk_installed: z.boolean().default(false).describe('rtk (Rust Token Killer) presence.'),
        minimal_output: z.boolean().default(true).describe('Short bullets vs verbose explanations.'),
        play_by_play: z.boolean().default(false).describe('Share intermediate findings.'),
        pr_comment_bot_icon: z.boolean().default(false).describe('Prefix PR replies with 🤖.'),
        autonomy: autonomyMode.default('auto').describe('Suppress trivial workflow questions.'),
        user_type: userType.default('').describe('Step-9 skill-filter axis.'),
    }),
    project: z.object({
        pr_template: z.string().default('.github/pull_request_template.md').describe('PR template path.'),
        upstream_repo: z.string().default('').describe('Improvement-PR target repo.'),
        improvement_pr_branch_prefix: z.string().default('improve/agent-').describe('Branch prefix for improvement PRs.'),
    }),
    github: z.object({
        pr_reply_method: replyMethod.default('create_review_comment').describe('API method for PR review-comment replies.'),
    }),
    augment: z.object({
        rules_use_symlinks: z.boolean().default(false).describe('Symlink rules into .augment/rules instead of copying.'),
    }),
    eloquent: z.object({
        access_style: accessStyle.default('getters_setters').describe('Model property access style.'),
    }),
    chat_history: z.object({
        enabled: z.boolean().default(true).describe('Log chat events to disk.'),
        frequency: chatFreq.default('per_turn').describe('Logging granularity.'),
        max_size_kb: z.number().int().min(0).default(2048).describe('Overflow threshold (KB).'),
        on_overflow: chatOverflow.default('rotate').describe('Overflow behaviour.'),
        text_limits: z.object({
            user: z.number().int().min(0).default(0).describe('User-message length cap (chars). 0 = verbatim.'),
            agent: z.number().int().min(0).default(5000).describe('Agent-reply length cap (chars).'),
            tool: z.number().int().min(0).default(200).describe('Tool inputs/outputs length cap (chars).'),
            phase: z.number().int().min(0).default(200).describe('Phase marker length cap (chars).'),
        }),
    }),
    pipelines: z.object({
        skill_improvement: z.boolean().default(true).describe('Propose learning capture after meaningful tasks.'),
    }),
    roadmap: z.object({
        quality_cadence: qualityCadence.default('end_of_roadmap').describe('When to run quality tools.'),
        dashboard_regen_cadence: regenCadence.default('per_step').describe('Inter-step dashboard regen cadence.'),
        horizon_weeks: z.number().int().min(0).default(0).describe('Visible-horizon framing in weeks. 0 = off.'),
    }),
    quality: z.object({
        local_auto_run: z.boolean().default(true).describe('Run local quality / CI tasks autonomously.'),
        wait_for_remote_ci: z.boolean().default(false).describe('Poll remote CI after push.'),
    }),
    subagents: z.object({
        implementer_model: z.string().default('').describe('Implementer subagent model. Empty = session-tier default.'),
        judge_model: z.string().default('').describe('Judge subagent model. Empty = one tier above implementer.'),
        max_parallel: z.number().int().min(1).default(3).describe('Hard cap on parallel subagents.'),
    }),
    worktrees: z.object({
        mode: worktreeMode.default('ask').describe('Autonomous worktree-creation policy.'),
    }),
    onboarding: z.object({
        onboarded: z.boolean().default(false).describe('Has the developer completed /onboard?'),
    }),
    commands: z.object({
        suggestion: z.object({
            enabled: z.boolean().default(true).describe('Master switch for command suggestion layer.'),
            confidence_floor: z.number().min(0).max(1).default(0.6).describe('Min match score before suggesting.'),
            cooldown_seconds: z.number().int().min(0).default(600).describe('Re-suggestion cooldown (s).'),
            max_options: z.number().int().min(0).default(4).describe('Max suggestions before the as-is option.'),
            blocklist: z.array(z.string()).default([]).describe('Commands to never suggest.'),
        }),
        create_pr: z.object({
            preview_description: z.boolean().default(false).describe('Preview PR title/body before creation.'),
        }),
    }),
    memory: z.object({
        review_threshold: z.number().int().min(0).default(10).describe('Inline-review threshold for /memory load.'),
        redact_patterns: z.array(z.string()).default([]).describe('Regex blocklist for transcript redaction.'),
    }),
    hooks: z.object({
        concern_budget: z.object({
            max_per_event: z.number().int().min(1).default(8).describe('Concerns-per-(platform, event) cap.'),
            tier1_concerns: z.array(z.string()).default([]).describe('Concerns allowed to block on failure.'),
            hard_fail: z.boolean().default(false).describe('Fail (vs warn) on concern-budget breach.'),
        }),
    }),
    decision_engine: z.object({
        surface_traces: z.boolean().default(false).describe('Emit DecisionTraceHook events.'),
        min_confidence: confidenceBand.default('off').describe('Confidence-band floor for Phase=Plan.'),
        block_on_risk: confidenceBand.default('off').describe('Risk-class ceiling for Phase=Implement.'),
        require_memory_hits: z.boolean().default(false).describe('Phase=Refine demands ≥1 memory hit.'),
        on_block: onBlock.default('stop').describe('Behaviour when a gate fires.'),
        ask_timeout_seconds: z.number().int().min(0).default(30).describe('Non-TTY timeout for on_block=ask.'),
        on_block_fallback: onBlockFallback.default('stop').describe('Resolution after ask_timeout.'),
    }),
    update_check: z.object({
        enabled: z.boolean().default(true).describe('Daily npm-registry update check.'),
    }),
    explain: z.object({
        enable_last: z.boolean().default(true).describe('Enable `agent-config explain last`.'),
    }),
});

export type Settings = z.infer<typeof settingsSchema>;
