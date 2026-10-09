/**
 * The registry of DELETED settings keys, and the once-per-run notice a leftover
 * value gets. Extracted from `agent_settings.ts`, which sits at the 1500-line
 * source ceiling — every retirement batch adds entries here, and here they cost
 * no ratchet. `agent_settings.ts` re-exports `REMOVED_KEYS` so existing
 * importers (the loader, `lint_settings_classes`) are unchanged.
 */

type SettingsDict = Record<string, unknown>;

/**
 * Settings keys this package has DELETED. A leftover value from an older
 * install is ignored — never applied by any reader — and surfaced with ONE
 * deprecation line per key per process run (stderr; the exit code never
 * changes).
 *
 * The map carries a per-key REASON rather than one shared sentence, because
 * the list now spans more than one deletion doctrine and a single blanket
 * phrase would mis-attribute every future entry. A reader who hits the line
 * should learn why the key went, not just that it did.
 *
 * `subagents.*` — the always-on-orchestration doctrine
 * (road-to-always-on-orchestration Phase 1): the layer has no per-layer
 * on/off setting any more. `ai_team.enabled` joined in Step 1.3 — the
 * `/team` family's availability is a codex-CLI/auth FACT
 * (`src/scripts/ai_team/availability.ts`), not a flag; the `ai_team` config
 * loader (`src/scripts/ai_team/config.ts`) separately accepts a leftover
 * `enabled` key without failing closed, so this warning is the only surfaced
 * signal of that deletion.
 *
 * `hooks.turn_end_gate.*` — the turn-end gate is always armed (2026-08-12).
 * A default-off safety gate cannot soak, so the switch protecting the soak
 * made the soak impossible; whether the gate fires is now decided by each
 * detector's own trigger conditions. See `turn_end_gate_hook.ts` § "Always
 * armed".
 *
 * The five `derivable` leaves below (2026-08-12, road-to-zero-settings Phase
 * 2.1) are a different case from every entry above them, and the difference is
 * the whole safety argument: no code path ever *consulted* them. Each appeared
 * in the template, the schema and the reference page, and several in the setup
 * wizard, while the decision they looked like they governed was taken
 * elsewhere. A key nothing reads cannot change a default by leaving — so this
 * is the one deletion batch that needs no replacement mechanism, only the
 * per-key statement of what already decides.
 *
 * A sixth unread key, `screenshots.data_bearing_gate`, was found in the same
 * pass and deliberately NOT deleted — it is `consent`, and the open question is
 * whether the repair is to build its missing reader or to delete a promise a
 * Hard Floor can never honour. See `settings-classes.md` § The six unread keys.
 *
 * `worktrees.mode` (2026-08-13, ADR-229) is a third doctrine again: not
 * always-on, not unread. It WAS read, and the reader honoured all three values —
 * the deletion says the decision was never the agent's to make. `ask` bought a
 * round trip per spawn, `on` let the agent start parallel work unprompted, and
 * `off` described the wanted behaviour, so `off` became the hardcoded rule and
 * the switch went. What decides instead is the user's own sentence in the chat.
 *
 * The 2026-10-09 batch (road-to-settings-classes-derivable-surface-stagnation
 * Phase 2) is a fourth doctrine: `derivable` keys whose shipped default is the
 * only behaviour the package supports. Each WAS read — by code or by rule and
 * command prose — and every reader was rewritten to state the old default as
 * fixed behaviour in the same change, so retiring the key changes no effective
 * default; what a consumer who had set a non-default value loses is named by
 * the reason.
 *
 * Every reason string must name what decides INSTEAD, never just "removed".
 * Exported so `lint_settings_classes` can check the deletion side of the
 * surface: a reason that names no replacement, or an entry whose key is live in
 * the template again, is a contradiction the loader itself cannot notice.
 */
export const REMOVED_KEYS: ReadonlyMap<string, string> = new Map([
    ['subagents.enabled', 'always-on orchestration'],
    ['subagents.auto', 'always-on orchestration'],
    ['subagents.host_capabilities', 'always-on orchestration'],
    ['subagents.budget_routing', 'always-on orchestration'],
    ['ai_team.enabled', 'always-on orchestration'],
    ['hooks.turn_end_gate.enabled', 'the turn-end gate is always armed'],
    ['hooks.turn_end_gate.promissory', 'the turn-end gate is always armed'],
    ['hooks.turn_end_gate.language', 'the turn-end gate is always armed'],
    ['hooks.turn_end_gate.verification', 'the turn-end gate is always armed'],
    ['telegraph.speak_scope', 'the rule body states its own scope; compile_time_toggles decides whether the rule ships'],
    ['chat_history.max_size_kb', 'the rotate command takes --max-kb from argv; session-count pruning bounds the file'],
    ['chat_history.on_overflow', 'the overflow mode comes from the rotate command --mode argv'],
    ['quality.wait_for_remote_ci', 'whether to poll follows from the push plus a detectable remote pipeline'],
    ['legal_review_prep.consented_at', 'the provenance sidecar settings:set writes and consentVerdict reads'],
    ['worktrees.mode', 'the user asking for a worktree in the chat; creation is instruction-only and hardcoded'],
    // 2026-10-09 — output and tone
    ['personal.minimal_output', 'direct-answers Iron Law 3 mandates terse replies; there is no verbose mode'],
    ['personal.play_by_play', 'direct-answers: no narration unless the user asks for it in the turn'],
    ['personal.pr_comment_bot_icon', 'no-decorative-emojis-in-git-surfaces forbids the 🤖 prefix'],
    ['verbosity.intent_announcements', 'direct-answers: act and emit the result, no "Let me…" openers'],
    ['verbosity.preview_artifacts', 'generated content is used directly; preview-on-error and the Iron-Law gates decide when a preview shows'],
    ['verbosity.routine_confirmations', 'the no-cheap-questions Pre-Send Self-Check; Iron-Law gates always ask'],
    ['verbosity.post_action_reports', 'direct-answers Iron Law 3: a one-line confirmation and one end-summary'],
    ['telegraph.speak', 'the telegraph-speak predicate in compile_time_toggles.ts; the bench verdict is package-level (ADR telegraph/0002)'],
    ['tokens.rich_skills', "the skill's own token_budget_class: rich plus the lint_token_budget_discipline ceiling"],
]);

/** Keys already warned about in THIS process — the "once per run" dedupe. */
const _warnedRemovedKeys = new Set<string>();

/** Read one dotted path out of a merged settings tree; `undefined` when absent. */
function _readDotted(root: SettingsDict, dotted: string): unknown {
    let node: unknown = root;
    for (const part of dotted.split('.')) {
        if (typeof node !== 'object' || node === null || Array.isArray(node)) {
            return undefined;
        }
        node = (node as SettingsDict)[part];
    }
    return node;
}

/**
 * Warn once per process, on stderr, for every {@link REMOVED_KEYS} entry still
 * present in a resolved settings tree. Never throws, never changes what the
 * caller does with `merged` — a pure notification side effect.
 */
export function warnRemovedKeys(merged: SettingsDict): void {
    for (const [key, reason] of REMOVED_KEYS) {
        if (_warnedRemovedKeys.has(key)) {
            continue;
        }
        if (_readDotted(merged, key) === undefined) {
            continue;
        }
        _warnedRemovedKeys.add(key);
        process.stderr.write(`${key} was removed (${reason}); ignored.\n`);
    }
}
