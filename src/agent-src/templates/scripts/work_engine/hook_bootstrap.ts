/**
 * Lifecycle-hook registry assembly for the CLI entry point.
 *
 * TypeScript twin of `work_engine/hook_bootstrap.py` (ADR-200 py2ts Phase 1 —
 * work_engine TOP/integration layer). Public API names stay snake_case to
 * mirror the Python module 1:1 (per ADR-200 — Python style is part of the
 * contract).
 *
 * Extracted from `cli.py` in P2.3 of `road-to-post-pr29-optimize.md`. Owns
 * nothing but `_build_hook_registry` and its chat-history helper.
 */

import type { ParsedArgs } from './cli_args.js';
import { HookRegistry } from './hooks/index.js';
import {
    ChatHistoryAppendHook,
    ChatHistoryHaltAppendHook,
    DecisionTraceHook,
    DirectiveSetGuardHook,
    HaltSurfaceAuditHook,
    MemoryVisibilityHook,
    StateShapeValidationHook,
    TraceHook,
    build_decision_gate_hook,
} from './hooks/builtin/index.js';
import { HookSettings, load_hook_settings } from './hooks/settings.js';

/**
 * Build the CLI-side {@link HookRegistry} for one `main()` run.
 *
 * Reads `hooks.*` from `.agent-settings.yml` and registers the enabled hooks.
 * The master switch `hooks.enabled` defaults to `false` when the block (or the
 * file) is missing — the registry stays empty and golden replay flows are
 * byte-stable.
 *
 * `--no-hooks` on the CLI forces an empty registry regardless of settings,
 * which is the explicit escape hatch golden-replay test harnesses can use.
 */
export function _build_hook_registry(args: ParsedArgs): HookRegistry {
    const registry = new HookRegistry();
    if (_getattr(args, 'no_hooks', false)) {
        return registry;
    }

    const settings_path = _getattr(args, 'hooks_config', null) as string | null;
    const settings = load_hook_settings(settings_path);
    if (!settings.enabled) {
        return registry;
    }

    if (settings.trace) {
        new TraceHook().register(registry);
    }
    if (settings.halt_surface_audit) {
        new HaltSurfaceAuditHook().register(registry);
    }
    if (settings.state_shape_validation) {
        new StateShapeValidationHook().register(registry);
    }
    if (settings.directive_set_guard) {
        new DirectiveSetGuardHook().register(registry);
    }
    if (settings.decision_trace) {
        new DecisionTraceHook().register(registry);
    }
    const gate_hook = build_decision_gate_hook(settings.decision_engine);
    if (gate_hook !== null) {
        gate_hook.register(registry);
    }
    if (settings.memory_visibility) {
        new MemoryVisibilityHook({
            memory_cadence: settings.memory_cadence,
            visibility_off: settings.memory_visibility_off,
        }).register(registry);
    }
    if (settings.chat_history_enabled) {
        _register_chat_history_hooks(registry, settings);
    }

    return registry;
}

/**
 * Register the structural chat-history hooks bound to the configured script.
 *
 * Hook-only contract (post road-to-chat-history-hook-only): only the append +
 * halt-append hooks remain; cooperative `turn-check` / `heartbeat` hooks were
 * removed when the cooperative always-rules were retired.
 */
export function _register_chat_history_hooks(registry: HookRegistry, settings: HookSettings): void {
    const script = settings.chat_history_script;
    new ChatHistoryAppendHook(script).register(registry);
    new ChatHistoryHaltAppendHook(script).register(registry);
}

/** Python `getattr(obj, attr, default)` for plain object attribute access. */
function _getattr(obj: unknown, attr: string, dflt: unknown): unknown {
    if (obj !== null && typeof obj === 'object' && attr in (obj as Record<string, unknown>)) {
        const v = (obj as Record<string, unknown>)[attr];
        return v === undefined ? dflt : v;
    }
    return dflt;
}
