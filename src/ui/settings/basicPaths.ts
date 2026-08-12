/**
 * Curated basic-settings tier (road-to-setup-experience § Phase 5.1).
 *
 * The single source of truth for the simple/advanced split in the
 * settings hub: dotted paths listed here render by default; everything
 * else sits behind the per-section "Show N advanced settings"
 * disclosure. Search always matches across BOTH tiers (council-locked:
 * the split is a navigation aid, never access control).
 *
 * Curation rule of thumb: a key is basic when a first-week user has a
 * reason to touch it — identity, behaviour, budgets, cadence, packs
 * consent. Deep machinery (hooks, decision_engine, projection,
 * knowledge sharing, chat-history internals) stays advanced.
 *
 * The wizard's step slices (src/ui/wizard/steps.ts) are the onboarding
 * subset of this list; keep the two in lockstep when adding keys.
 */

export const BASIC_PATHS: ReadonlySet<string> = new Set([
    // Experience / profile
    'profile.id',
    'rule_loading_tier',
    'discipline_profile',
    // Personal / behaviour
    'personal.ide',
    'personal.open_edited_files',
    'personal.autonomy',
    'personal.minimal_output',
    'personal.play_by_play',
    'personal.pr_comment_bot_icon',
    'personal.pr_progress_comments',
    // Cost / model
    'cost.budgets.daily',
    'cost.budgets.weekly',
    'cost.budgets.monthly',
    'cost.enforcement',
    'model.auto_switch',
    'tokens.rich_skills',
    // Cadence
    'roadmap.quality_cadence',
    'roadmap.dashboard_regen_cadence',
    'quality.local_auto_run',
    // Memory
    'memory.review_threshold',
    'memory.redact_patterns',
    'memory.cadence',
    // Runtime comfort
    'chat_history.enabled',
    'update_check.enabled',
    'worktrees.mode',
    // Consent
    'legal_review_prep.acknowledged',
]);

export function isBasicPath(dotted: string): boolean {
    return BASIC_PATHS.has(dotted);
}
