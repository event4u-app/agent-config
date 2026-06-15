/**
 * Context-aware command suggestion engine.
 *
 * TypeScript twin of `src/scripts/command_suggester/__init__.py`
 * (ADR-096 py2ts).
 *
 * Public API exposed for the always-on `command-suggestion` rule and for
 * tests. The engine is deterministic and read-only: it scores
 * candidate commands against a user message + recent context, applies
 * ranking, suppresses cooled-down suggestions, and renders a numbered
 * options block. It never executes a command — the user pick is what
 * triggers the standard slash flow.
 *
 * See `agents/settings/contexts/command-suggestion-eligibility.md` for the
 * locked eligibility table and `road-to-context-aware-command-suggestion`
 * for the full design.
 *
 * The Python `__all__` re-exports these names; the TS twin re-exports
 * the same public surface (`parse_cooldown` stays a submodule export,
 * matching the Python module where it is reachable via
 * `command_suggester.cooldown.parse_cooldown` but not in `__all__`).
 */

export { CommandSpec, Match, Settings, CooldownState } from './types.js';
export { load_commands } from './loader.js';
export { match } from './match.js';
export { rank } from './rank.js';
export {
    apply_cooldown,
    CooldownStore,
    detect_disable_directive,
    is_explicit_slash_invocation,
} from './cooldown.js';
export { render } from './render.js';
export {
    sanitize_context,
    sanitize_message,
    strip_code_blocks,
    strip_suggestion_echo,
} from './sanitize.js';
export { load_settings } from './settings.js';
