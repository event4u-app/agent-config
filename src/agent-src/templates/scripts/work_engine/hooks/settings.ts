/**
 * Read `hooks.*` from `.agent-settings.yml` into {@link HookSettings}.
 *
 * TypeScript twin of `work_engine/hooks/settings.py` (ADR-094 py2ts —
 * work_engine.hooks subpackage). Mirror of the chat-history settings pattern:
 *
 * - The YAML read goes through `work_engine/_lib/agent_settings.load_agent_settings`,
 *   which cascades the whitelisted DX-comfort keys from the user-global file.
 * - Default-permissive: a missing file or missing `hooks:` block returns
 *   {@link HookSettings} with `enabled=false` — every hook off, every golden
 *   replay safe by construction.
 * - Malformed YAML / unreadable file → defaults; degrade silently.
 * - Chat-history hooks gate on **two** switches: `hooks.chat_history.enabled`
 *   AND the global `chat_history.enabled`. Either off → no chat-history hook.
 */
import { load_agent_settings, type SettingsDict } from '../_lib/agent_settings.js';
import {
    DecisionEngineConfigError,
    DecisionEngineSettings,
    parse as _parse_decision_engine,
} from '../scoring/decision_engine.js';

export const DEFAULT_SETTINGS_FILE = '.agent-settings.yml';
export const DEFAULT_CHAT_HISTORY_SCRIPT = 'scripts/chat_history.py';

/** Arbitrary value, mirroring the Python `Any` fields. */
type Any = unknown;

/** Per-field init shape for {@link HookSettings} (mirrors the dataclass). */
export interface HookSettingsInit {
    enabled?: boolean;
    trace?: boolean;
    halt_surface_audit?: boolean;
    state_shape_validation?: boolean;
    directive_set_guard?: boolean;
    decision_trace?: boolean;
    memory_visibility?: boolean;
    memory_visibility_off?: boolean;
    memory_cadence?: string;
    chat_history_enabled?: boolean;
    chat_history_script?: string;
    decision_engine?: DecisionEngineSettings;
}

/**
 * Resolved view of the `hooks:` block.
 *
 * `enabled` is the master switch. When `false` the registry stays empty
 * regardless of the per-hook fields; this is the default when no settings
 * file exists or no `hooks` block is declared, and it is what keeps
 * golden-replay tests byte-stable.
 *
 * `decision_engine` carries the parsed gate config so {@link DecisionGateHook}
 * can read it without re-parsing `.agent-settings.yml`.
 */
export class HookSettings {
    readonly enabled: boolean;
    readonly trace: boolean;
    readonly halt_surface_audit: boolean;
    readonly state_shape_validation: boolean;
    readonly directive_set_guard: boolean;
    readonly decision_trace: boolean;
    readonly memory_visibility: boolean;
    readonly memory_visibility_off: boolean;
    readonly memory_cadence: string;
    readonly chat_history_enabled: boolean;
    readonly chat_history_script: string;
    readonly decision_engine: DecisionEngineSettings;

    constructor(init: HookSettingsInit = {}) {
        this.enabled = init.enabled ?? false;
        this.trace = init.trace ?? false;
        this.halt_surface_audit = init.halt_surface_audit ?? false;
        this.state_shape_validation = init.state_shape_validation ?? false;
        this.directive_set_guard = init.directive_set_guard ?? false;
        this.decision_trace = init.decision_trace ?? false;
        this.memory_visibility = init.memory_visibility ?? false;
        this.memory_visibility_off = init.memory_visibility_off ?? false;
        this.memory_cadence = init.memory_cadence ?? 'always';
        this.chat_history_enabled = init.chat_history_enabled ?? false;
        this.chat_history_script = init.chat_history_script ?? DEFAULT_CHAT_HISTORY_SCRIPT;
        this.decision_engine = init.decision_engine ?? new DecisionEngineSettings();
        Object.freeze(this);
    }
}

const _DEFAULT = new HookSettings();

/**
 * Return {@link HookSettings} hydrated from `.agent-settings.yml`.
 *
 * `settings_path` defaults to `./.agent-settings.yml` relative to the
 * current working directory. `user_global_path` defaults to
 * `~/.event4u/agent-config/agent-settings.yml` and only cascades the
 * whitelisted DX-comfort keys when the project file omits them.
 */
export function load_hook_settings(
    settings_path: string | null = null,
    user_global_path: string | null = null,
): HookSettings {
    const path = settings_path ? settings_path : DEFAULT_SETTINGS_FILE;
    const raw = load_agent_settings({
        project_path: path,
        user_global_path,
    });
    if (!_pyTruthy(raw)) {
        return _DEFAULT;
    }
    return _settings_from_raw(raw);
}

function _settings_from_raw(data: SettingsDict): HookSettings {
    const hooks = data['hooks'];
    if (!_isPlainDict(hooks)) {
        return _DEFAULT;
    }
    const hooksDict = hooks as Record<string, Any>;
    const enabled = _coerce_bool(hooksDict['enabled'], false);

    const decision_engine_raw = data['decision_engine'];
    let decision_engine_settings: DecisionEngineSettings;
    try {
        decision_engine_settings = _parse_decision_engine(decision_engine_raw);
    } catch (exc) {
        if (exc instanceof DecisionEngineConfigError) {
            decision_engine_settings = new DecisionEngineSettings();
        } else {
            throw exc;
        }
    }

    if (!enabled) {
        return new HookSettings({
            enabled: false,
            decision_engine: decision_engine_settings,
        });
    }

    const chat_section = hooksDict['chat_history'];
    let chat_block_enabled: boolean;
    let chat_script: string;
    if (_isPlainDict(chat_section)) {
        const cs = chat_section as Record<string, Any>;
        chat_block_enabled = _coerce_bool(cs['enabled'], true);
        chat_script = String(_pyOr(cs['script'], DEFAULT_CHAT_HISTORY_SCRIPT));
    } else {
        chat_block_enabled = true;
        chat_script = DEFAULT_CHAT_HISTORY_SCRIPT;
    }

    const global_chat = data['chat_history'];
    const global_chat_on =
        _isPlainDict(global_chat) &&
        _coerce_bool((global_chat as Record<string, Any>)['enabled'], false);

    const decision_trace_on = decision_engine_settings.surface_traces;

    const memory_section = data['memory'];
    let visibility_off = false;
    let memory_cadence = 'always';
    if (_isPlainDict(memory_section)) {
        const ms = memory_section as Record<string, Any>;
        const rawVis = ms['visibility'];
        if (typeof rawVis === 'string' && rawVis.trim().toLowerCase() === 'off') {
            visibility_off = true;
        } else if (typeof rawVis === 'boolean' && rawVis === false) {
            visibility_off = true;
        }
        const cadence_raw = ms['cadence'];
        if (cadence_raw !== null && cadence_raw !== undefined) {
            memory_cadence = String(cadence_raw).trim().toLowerCase() || 'always';
        }
    }

    const memory_hooks = hooksDict['memory_visibility'];
    let memory_visibility_on: boolean;
    if (_isPlainDict(memory_hooks)) {
        memory_visibility_on = _coerce_bool(
            (memory_hooks as Record<string, Any>)['enabled'],
            true,
        );
    } else {
        memory_visibility_on = true;
    }

    return new HookSettings({
        enabled: true,
        trace: _coerce_bool(hooksDict['trace'], false),
        halt_surface_audit: _coerce_bool(hooksDict['halt_surface_audit'], true),
        state_shape_validation: _coerce_bool(hooksDict['state_shape_validation'], true),
        directive_set_guard: _coerce_bool(hooksDict['directive_set_guard'], true),
        decision_trace: decision_trace_on,
        memory_visibility: memory_visibility_on,
        memory_visibility_off: visibility_off,
        memory_cadence,
        chat_history_enabled: chat_block_enabled && global_chat_on,
        chat_history_script: chat_script,
        decision_engine: decision_engine_settings,
    });
}

function _coerce_bool(value: Any, dflt: boolean): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (value === null || value === undefined) {
        return dflt;
    }
    if (typeof value === 'string') {
        const s = value.trim().toLowerCase();
        if (s === 'true' || s === 'yes' || s === 'on' || s === '1') {
            return true;
        }
        if (s === 'false' || s === 'no' || s === 'off' || s === '0') {
            return false;
        }
    }
    return dflt;
}

// ── Python-parity primitives ────────────────────────────────────────────

/** Python `a or b` — returns `a` when truthy, else `b`. */
function _pyOr(a: Any, b: Any): Any {
    return _pyTruthy(a) ? a : b;
}

/** Python `isinstance(x, dict)` — only a plain object (not array, not null). */
function _isPlainDict(value: Any): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Python `bool(x)` truthiness: `None`/`undefined`, `False`, `0`, `""`,
 * empty list/dict are falsy; everything else truthy.
 */
function _pyTruthy(value: Any): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (value instanceof Map || value instanceof Set) {
        return value.size > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return true;
}
