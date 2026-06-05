/**
 * Zod schema for `.agent-settings.yml`.
 *
 * Source of truth: `src/config/agent-settings.template.yml`. Every leaf has a
 * matching template key; the schema↔template parity test
 * (`tests/server/schemas/parity.test.ts`) walks both trees and asserts the
 * Zod schema covers every template path. New template keys without schema
 * additions fail CI.
 *
 * Render strategy: depth ≤ 2. The form renderer (`SchemaForm`, Phase 2)
 * recurses one level into nested objects; deeper trees fail render-time.
 */

import { z } from 'zod';

const ruleLoadingTier = z.enum(['minimal', 'balanced', 'full', 'custom']);
const enforcementMode = z.enum(['advisory', 'hard-stop']);
const autonomyMode = z.enum(['on', 'off', 'auto']);
const userType = z.enum(['', 'consultant', 'creator', 'developer', 'finance', 'founder', 'gtm', 'ops']);
const profileId = z.enum(['developer', 'content_creator', 'founder', 'agency', 'finance', 'ops']);
const accessStyle = z.enum(['getters_setters', 'get_attribute', 'magic_properties']);
const chatFreq = z.enum(['per_turn', 'per_phase', 'per_tool']);
const chatOverflow = z.enum(['rotate', 'condense']);
const qualityCadence = z.enum(['end_of_roadmap', 'per_phase', 'per_step']);
const regenCadence = z.enum(['per_step', 'every_5_steps', 'phase_boundary']);
const worktreeMode = z.enum(['off', 'on', 'ask']);
const replyMethod = z.enum(['replies_endpoint', 'create_review_comment', 'auto']);
const confidenceBand = z.enum(['off', 'low', 'medium', 'high']);
const onBlock = z.enum(['stop', 'ask', 'warn']);
const onBlockFallback = z.enum(['stop', 'warn']);
const modelAutoSwitch = z.enum(['auto', 'suggest', 'off']);
const leanProjectionMode = z.enum(['eager-all', 'thin']);
const projectionMode = z.enum(['legacy-all', 'scoped']);
const memoryCadence = z.enum(['auto', 'always', 'never']);

export const settingsSchema = z.object({
    agent_config_version: z.string().default('').describe(
        'Pin the package to an exact semver (e.g. "1.4.2") so all teammates load the same skill / rule set. Leave empty to track whatever is installed locally — useful for the maintainers of this package, risky for production projects.',
    ),
    profile: z.object({
        id: profileId.default('developer').describe(
            'Which experience you run — the audience identity that selects your default skill / command surface, README entry-path, and persona pre-selection (ADR-010, docs/contracts/profile-system.md). Six seed profiles: developer · content_creator · founder · agency · finance · ops. This is the first wizard question. In 6.0.0-A it records the choice only; pack-scoped surfacing (projection-time filtering, ADR-040) activates in 6.0.0-B behind a staged, opt-in rollout. Switch later with `agent-config use --profile=<id>`.',
        ),
    }).default({ id: 'developer' }),
    projection: z.object({
        mode: projectionMode.default('legacy-all').describe(
            'Whether the per-tool projector writes EVERY artefact into the host-tool trees (.claude/ .cursor/ .windsurf/) or only the active profile + packs\' artefacts (ADR-040, docs/contracts/capability-packs.md). legacy-all = (default, non-breaking) project the full surface exactly as 5.x did. scoped = project only the active profile\'s packs unioned with the runtime.active_packs overlay, expanded over the requires graph — opt in with `agent-config use --profile=<id>`. A failed scoped projection restores the full tree.',
        ),
    }).default({ mode: 'legacy-all' }),
    rule_loading_tier: ruleLoadingTier.default('balanced').describe(
        'Master switch for which rule tiers load and how cautiously the agent spends tokens. minimal = only the 9 kernel rules (cheapest, fewest guardrails). balanced = kernel + tier-1 (recommended default). full = kernel + tier-1 + tier-2 (most guardrails, highest token cost). custom = roll your own in agents/overrides/.',
    ),
    lean_projection: z.object({
        mode: leanProjectionMode.default('eager-all').describe(
            'How the per-tool projector emits the rule layer. eager-all = every rule body inlined into every projection (default, safe). thin = kernel rules full-bodied + non-kernel rules as router-resolved pointers (~45k GPT-tok lighter per session). EXPERIMENTAL: validate with the live A/B before flipping; one-flip revert to eager-all.',
        ),
    }).default({ mode: 'eager-all' }),
    cost: z.object({
        budgets: z.object({
            daily: z.number().min(0).default(0).describe(
                'Daily USD ceiling across all model calls. The agent warns at 50% / 75% / 90% and either stops or warns at 100% depending on cost.enforcement. Set 0 to disable the daily budget entirely.',
            ),
            weekly: z.number().min(0).default(0).describe(
                'Rolling 7-day USD ceiling. Same alert ladder as cost.budgets.daily but useful when work bursts unevenly across the week. Set 0 to disable.',
            ),
            monthly: z.number().min(0).default(0).describe(
                'Calendar-month USD ceiling. Pairs with cost.enforcement = hard-stop for a hard cap on agent spend before the next billing cycle. Set 0 to disable.',
            ),
        }),
        enforcement: enforcementMode.default('advisory').describe(
            'What happens when a budget hits 100%. advisory = show a banner, keep working (default — never blocks an active task). hard-stop = refuse further model calls until the budget resets or you raise the ceiling.',
        ),
    }),
    model: z.object({
        auto_switch: modelAutoSwitch.default('suggest').describe(
            'Per-skill model auto-switch (ADR-035). Skills declare a vendor-neutral model_tier (lite/medium/high); the generator maps it to a native Claude model (high→opus, medium→sonnet, lite→haiku). suggest (default) = never emit a native Claude model: key; the model-recommendation rule names the tier as a one-question suggestion on every surface — your explicit /model choice is never silently overridden. auto = render a native Claude model: into lite/medium/high-tier skills so Claude Code switches automatically for that turn (reverts next prompt), and suggest on surfaces without a native override. off = inert, no native key and no suggestion.',
        ),
    }).default({ auto_switch: 'suggest' }),
    personal: z.object({
        ide: z.string().default('').describe(
            'CLI binary your IDE registers (code, code-insiders, phpstorm, cursor, windsurf, idea, subl, …). Used by the file-editor skill to open edited files. Leave empty to disable IDE integration.',
        ),
        open_edited_files: z.boolean().default(false).describe(
            'After the agent edits a file, run `<ide> <path>` to surface it in your editor immediately. Off by default to avoid window-stealing during long agent runs.',
        ),
        rtk_installed: z.boolean().default(false).describe(
            'Does this machine have rtk (Rust Token Killer, https://github.com/event4u-app/rtk) on PATH? When true the agent wraps verbose CLI output (git, tests, linters, docker, npm, composer) with rtk for ~60-90% token savings. Leave false if rtk is missing — the agent falls back to tail / grep.',
        ),
        minimal_output: z.boolean().default(true).describe(
            'Prefer short bullets and tables (true, default) vs verbose prose with rationale (false). Affects every chat reply; flip to false during debugging when you want the agent to think out loud.',
        ),
        play_by_play: z.boolean().default(false).describe(
            'Narrate intermediate findings between tool calls ("Found it.", "Let me check Y."). Off by default — most users find it noisy. Turn on when you want to follow the agent\'s reasoning step by step.',
        ),
        pr_comment_bot_icon: z.boolean().default(false).describe(
            'Prefix every PR review-comment reply with 🤖 so humans can tell agent-authored comments apart from teammate comments at a glance. Cosmetic only; the comment body itself never changes.',
        ),
        pr_progress_comments: z.boolean().default(false).describe(
            'Permit the agent to post unsolicited progress / status comments on an open PR (e.g. "CI fix iteration #2", "still blocked on workflow scope"). Default off — most teammates find them noisy. User-invoked flows (/fix:pr-comments, /create-pr, /code-review, explicit "post a comment that …") are NOT gated by this setting. See rules/no-pr-progress-comments.md.',
        ),
        autonomy: autonomyMode.default('auto').describe(
            'How aggressively the agent suppresses trivial workflow questions ("commit now?", "open PR?"). on = silently pick the sensible default. off = always ask. auto (default) = decide per project, on for solo / off when collaborators are involved. The Hard Floor (prod, deploys, bulk deletes) ignores this setting and always asks.',
        ),
        user_type: userType.default('').describe(
            'Optional persona axis used by the skill-suggester to surface the relevant subset (consultant / creator / developer / finance / founder / gtm / ops). Empty = no filter, all skills available. You can change this any time without re-running setup.',
        ),
    }),
    project: z.object({
        pr_template: z.string().default('.github/pull_request_template.md').describe(
            'Path (relative to project root) to the PR-description template the agent fills in before opening a pull request. Override only if your repo keeps the template somewhere non-standard.',
        ),
        upstream_repo: z.string().default('').describe(
            'GitHub slug (owner/repo) the upstream-contribute skill targets when you ask the agent to push a learning back to the shared agent-config package. Empty = improvement PRs are disabled.',
        ),
        improvement_pr_branch_prefix: z.string().default('improve/agent-').describe(
            'Branch-name prefix for improvement PRs the agent opens against project.upstream_repo (e.g. "improve/agent-add-react-skill"). Pick a prefix your repo conventions allow.',
        ),
    }),
    github: z.object({
        pr_reply_method: replyMethod.default('create_review_comment').describe(
            'How the agent replies to PR review comments. create_review_comment = post a new review comment (works on every GitHub plan). replies_endpoint = thread the reply under the original comment (needs the newer REST endpoint). auto = detect at runtime, prefer threaded replies when available.',
        ),
    }),
    augment: z.object({
        rules_use_symlinks: z.boolean().default(false).describe(
            'When true, .augment/rules/*.md are symlinks into .agent-src/rules/ — edits flow back to source on save. When false (default), they are copies — safer on Windows and shared volumes, but rule edits in .augment/ are lost on the next `task sync`.',
        ),
    }),
    eloquent: z.object({
        access_style: accessStyle.default('getters_setters').describe(
            'How the agent writes Laravel Eloquent property access. getters_setters = explicit getName() / setName() methods (most refactor-safe). get_attribute = $model->getAttribute("name") (verbose but explicit). magic_properties = $model->name (idiomatic but harder to grep).',
        ),
    }),
    chat_history: z.object({
        enabled: z.boolean().default(true).describe(
            'Persist a structured log of every chat turn to .agent-config/chat-history/ so /chat-history:show, :import, and :learn can replay sessions. Turn off if you never want chat transcripts on disk.',
        ),
        frequency: chatFreq.default('per_turn').describe(
            'How often the chat-history writer flushes to disk. per_turn = after every user / agent exchange (default, lowest data loss on crash). per_phase = at phase boundaries (cheaper I/O). per_tool = after every tool call (highest fidelity, noisiest log).',
        ),
        max_size_kb: z.number().int().min(0).default(2048).describe(
            'Maximum size (KB) of the active chat-history file before chat_history.on_overflow kicks in. Set 0 to disable rotation / condensation entirely (file grows forever).',
        ),
        on_overflow: chatOverflow.default('rotate').describe(
            'What happens when chat_history.max_size_kb is hit. rotate = move the current log aside and start fresh (default). condense = telegraph-condense the oldest entries in place to keep recent context.',
        ),
        text_limits: z.object({
            user: z.number().int().min(0).default(0).describe(
                'Per-message character cap for user inputs in the chat-history log. 0 = log verbatim (default). Raise above 0 only if your prompts contain large pasted artefacts you do not want stored.',
            ),
            agent: z.number().int().min(0).default(5000).describe(
                'Per-message character cap for agent replies in the chat-history log. Truncates with an ellipsis past the cap. Lower to shrink history files, raise for long-reasoning replies.',
            ),
            tool: z.number().int().min(0).default(200).describe(
                'Per-call character cap for tool input / output blobs in the chat-history log. The default 200 keeps history files compact while preserving enough signal to replay a session.',
            ),
            phase: z.number().int().min(0).default(200).describe(
                'Per-marker character cap for phase markers (Phase=Refine, Phase=Plan, …) in the chat-history log. Rarely needs tuning.',
            ),
        }),
    }),
    pipelines: z.object({
        skill_improvement: z.boolean().default(true).describe(
            'After a meaningful task the agent proposes a learning-capture turn (new skill, rule tweak, guideline). Turn off if you find the prompts noisy — you can still run /memory:promote manually.',
        ),
    }),
    roadmap: z.object({
        skip_pre_run_gate: z.boolean().default(true).describe(
            'Skip the /roadmap:process-* pre-run confirmation gate. true (default) starts processing immediately and surfaces the resolved config inline; false shows the numbered-options gate and waits. A genuine "which roadmap?" ambiguity always prompts regardless.',
        ),
        quality_cadence: qualityCadence.default('end_of_roadmap').describe(
            'When the agent runs the full quality / test suite during /roadmap:process-* runs. end_of_roadmap = once, after the last step (fastest, default). per_phase = after each phase boundary. per_step = after every single step (slowest, highest confidence).',
        ),
        dashboard_regen_cadence: regenCadence.default('per_step').describe(
            'How often the agent regenerates agents/roadmaps/dashboard.md during a roadmap run. per_step = after every step (default, freshest dashboard). every_5_steps = batch the regen. phase_boundary = only at phase edges.',
        ),
        horizon_weeks: z.number().int().min(0).default(0).describe(
            'Optional planning horizon (weeks) the agent shows in roadmap framing ("next 4 weeks"). Set 0 to omit the horizon — most teams prefer to ship without a hardcoded window.',
        ),
    }),
    quality: z.object({
        local_auto_run: z.boolean().default(true).describe(
            'Run quality tools (linters, type-checks, formatters) and the local test suite autonomously after edits. Turn off if your toolchain is slow and you prefer to invoke quality runs manually with /quality-fix.',
        ),
        wait_for_remote_ci: z.boolean().default(false).describe(
            'After pushing a branch, poll the remote CI provider (GitHub Actions, GitLab CI) and surface failures inline. Off by default — useful when local CI does not cover everything the remote pipeline runs.',
        ),
    }),
    subagents: z.object({
        implementer_model: z.string().default('').describe(
            'Override the model the orchestrator dispatches to subagents that write code (e.g. claude-sonnet-4, gpt-5). Empty (default) = inherit the session\'s primary model — cheapest and usually right.',
        ),
        judge_model: z.string().default('').describe(
            'Override the model used for review / judge subagents that critique implementer output. Empty (default) = one tier above the implementer model — picks up nuance the implementer missed.',
        ),
        max_parallel: z.number().int().min(1).default(3).describe(
            'Hard cap on subagents running in parallel during /do-in-parallel, /do-competitively, and /judge runs. Raise for faster fan-out, lower if you hit rate limits or want lower token spend.',
        ),
    }),
    worktrees: z.object({
        mode: worktreeMode.default('ask').describe(
            'When the agent considers a parallel `git worktree` for risky / large work. ask (default) = surface a numbered option and wait. on = spawn worktrees autonomously. off = never use worktrees, edit in place.',
        ),
    }),
    onboarding: z.object({
        onboarded: z.boolean().default(false).describe(
            'Set to true once the developer has completed `agent-config setup`. The onboarding-gate rule blocks the first turn of every chat until this is true. Toggle back to false to re-trigger the wizard.',
        ),
    }),
    commands: z.object({
        suggestion: z.object({
            enabled: z.boolean().default(true).describe(
                'Master switch for the slash-command suggestion layer. When on, the agent offers numbered options ("did you mean /commit?") instead of guessing. Turn off if you prefer to type every command yourself.',
            ),
            confidence_floor: z.number().min(0).max(1).default(0.6).describe(
                'Minimum semantic-match score (0.0–1.0) before a command is offered as a suggestion. 0.6 (default) balances precision and recall. Raise toward 0.8 for fewer false positives, lower for broader hints.',
            ),
            cooldown_seconds: z.number().int().min(0).default(600).describe(
                'How long (seconds) the suggester waits before offering the same command again after you ignored it. Default 600s (10 min) keeps the agent from nagging. Set 0 to disable the cooldown.',
            ),
            max_options: z.number().int().min(0).default(4).describe(
                'Maximum number of command suggestions shown in a single numbered-options block, before the "Proceed as-is" escape. Lower for terser prompts, raise if you regularly want broader fan-out.',
            ),
            blocklist: z.array(z.string()).default([]).describe(
                'Slash-command names that should never be suggested, one per line (e.g. "commit", "create-pr"). Useful if a command misfires on your common phrasing.',
            ),
        }),
        create_pr: z.object({
            preview_description: z.boolean().default(false).describe(
                'When /create-pr runs, show the generated title and body and wait for confirmation before opening the PR. Off by default (zero-friction PR creation); turn on if you want a last-look gate.',
            ),
        }),
    }),
    memory: z.object({
        cadence: memoryCadence.default('always').describe(
            'Cadence of the 🧠 memory-visibility line after a memory-consulting step. always (default) = show whenever a memory type was asked; auto = show only when 3+ types were consulted (less noise); never = suppress. Distinct from rule_loading_tier — owns its own key since the 2026-06-01 untangle.',
        ),
        review_threshold: z.number().int().min(0).default(10).describe(
            'Maximum number of memory entries /memory:load surfaces inline before falling back to a summary view. Default 10 keeps the chat readable. Raise to see more candidates, lower to keep the context tight.',
        ),
        redact_patterns: z.array(z.string()).default([]).describe(
            'Regex patterns (one per line) that scrub matches from chat-history transcripts and memory before they hit disk. Use for secrets, customer names, internal URLs. Patterns are anchored and case-insensitive.',
        ),
    }),
    hooks: z.object({
        concern_budget: z.object({
            max_per_event: z.number().int().min(1).default(8).describe(
                'Maximum number of concerns (issues / warnings) a single hook may raise per (platform, event) pair before the hook is rate-limited. Default 8 prevents noisy hooks from drowning out high-signal ones.',
            ),
            tier1_concerns: z.array(z.string()).default([]).describe(
                'Concern IDs (one per line) that are allowed to block the run on failure rather than warn. Reserved for high-confidence guards — leave empty unless you maintain custom hooks.',
            ),
            hard_fail: z.boolean().default(false).describe(
                'When a hook exceeds hooks.concern_budget.max_per_event, fail the run (true) instead of warning and continuing (false, default). Turn on in CI when you want hook quality to gate merges.',
            ),
        }),
    }),
    decision_engine: z.object({
        surface_traces: z.boolean().default(false).describe(
            'Emit DecisionTraceHook events that surface why the agent picked one option over another. Useful when debugging unexpected choices; off by default to keep chat noise low.',
        ),
        min_confidence: confidenceBand.default('off').describe(
            'During Phase=Plan, refuse to advance to Phase=Implement if confidence is below this band. off (default) = no gate. low / medium / high = raise the floor; on miss, decision_engine.on_block decides what happens.',
        ),
        block_on_risk: confidenceBand.default('off').describe(
            'During Phase=Implement, refuse to act when the risk class meets or exceeds this band. off (default) = no gate. low / medium / high = stricter ceilings; pairs with decision_engine.on_block.',
        ),
        require_memory_hits: z.boolean().default(false).describe(
            'During Phase=Refine, require at least one relevant memory hit (skill, ADR, past decision) before the agent proceeds. Off by default; turn on for highly conventional codebases where memory should always inform decisions.',
        ),
        on_block: onBlock.default('stop').describe(
            'What the decision engine does when a gate (min_confidence / block_on_risk / require_memory_hits) fires. stop (default) = halt and surface the reason. ask = present numbered options. warn = log and continue.',
        ),
        ask_timeout_seconds: z.number().int().min(0).default(30).describe(
            'Non-TTY timeout (seconds) for decision_engine.on_block = ask. After this elapses without input, decision_engine.on_block_fallback takes over. Default 30s; raise for slow human review, 0 = wait forever.',
        ),
        on_block_fallback: onBlockFallback.default('stop').describe(
            'Resolution when decision_engine.on_block = ask times out (see decision_engine.ask_timeout_seconds). stop (default) = halt the run. warn = log and continue with the agent\'s best guess.',
        ),
    }),
    update_check: z.object({
        enabled: z.boolean().default(true).describe(
            'Once per day the agent checks the npm registry for a newer agent-config release and surfaces a one-line banner if one exists. Turn off in air-gapped environments or to silence the banner.',
        ),
    }),
    explain: z.object({
        enable_last: z.boolean().default(true).describe(
            'Enable the `agent-config explain last` command, which prints the reasoning behind the agent\'s most recent decision (last tool call, last suggestion). Disable if you never use it and want a smaller CLI surface.',
        ),
    }),
});

export type Settings = z.infer<typeof settingsSchema>;
