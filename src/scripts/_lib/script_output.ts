/**
 * Verbosity-aware print router for scripts.
 *
 * TypeScript twin of `src/scripts/_lib/script_output.py` (ADR-089,
 * Phase 2 / Wave 2b). Mirrors the Python module's public API exactly —
 * same exported snake_case names, same resolution order, same level
 * semantics, same output channels (stdout vs stderr), same module-level
 * caching, same env-var inheritance. Single source of truth for how
 * maintenance scripts emit progress, success, warnings, and errors.
 *
 * Resolution order (first wins):
 *   1. AGENT_SCRIPT_VERBOSITY env var      (silent | minimal | verbose)
 *   2. SCRIPT_OUTPUT_VERBOSE=1 alias       (== verbose)
 *   3. .agent-settings.yml verbosity.script_output
 *   4. Default: minimal
 *
 * Once resolved, the level is exported back into AGENT_SCRIPT_VERBOSITY
 * so child processes inherit the same level (Phase 10.1c). Explicit
 * --quiet flags on the child still win at the call site.
 *
 * Levels:
 *   silent   = stderr only; success() drops; info() drops; warn() drops
 *   minimal  = success() collapsed to one end-of-run summary; info() drops
 *   verbose  = pre-Phase-10 behaviour, every call prints
 *
 * error() always writes to stderr regardless of level. Iron-Law surfaces
 * (release confirms, install secrets prompts) bypass this module and use
 * plain print() so they cannot be silenced.
 */
import { load_agent_settings, type SettingsValue } from './agent_settings.js';

export const VALID_LEVELS: readonly string[] = ['silent', 'minimal', 'verbose'];
export const DEFAULT_LEVEL = 'minimal';
export const ENV_VAR = 'AGENT_SCRIPT_VERBOSITY';
export const ENV_ALIAS = 'SCRIPT_OUTPUT_VERBOSE';
export const SETTINGS_FILE = '.agent-settings.yml';

let _resolved_level: string | null = null;
const _pending_summary: string[] = [];

/**
 * Read `verbosity.script_output` from `.agent-settings.yml`.
 *
 * Returns `null` when the file is missing, YAML is unparseable, or the
 * key is absent. Errors fall through to the default level. Goes through
 * the centralized loader so the tolerance contract — missing file,
 * malformed YAML — degrades uniformly across scripts.
 * `verbosity.script_output` is not on the user-global whitelist, so a
 * value there is silently ignored; the project file is the only source
 * for this knob.
 */
function _read_settings_level(settings_path: string): string | null {
    const data = load_agent_settings({ project_path: settings_path });
    const section: SettingsValue = data['verbosity'];
    if (typeof section !== 'object' || section === null || Array.isArray(section)) {
        return null;
    }
    const value: SettingsValue = (section as Record<string, SettingsValue>)['script_output'];
    if (typeof value === 'string' && VALID_LEVELS.includes(value)) {
        return value;
    }
    return null;
}

/**
 * Resolve and cache the active verbosity level.
 *
 * First call wins; subsequent calls return the cached value so the
 * process is internally consistent. Tests reset via `reset_level()`.
 */
export function resolve_level(settings_path: string | null = null): string {
    if (_resolved_level !== null) {
        return _resolved_level;
    }

    const env_value = (process.env[ENV_VAR] ?? '').trim().toLowerCase();
    if (VALID_LEVELS.includes(env_value)) {
        _resolved_level = env_value;
    } else if ((process.env[ENV_ALIAS] ?? '').trim() === '1') {
        _resolved_level = 'verbose';
    } else {
        const p = settings_path ?? SETTINGS_FILE;
        _resolved_level = _read_settings_level(p) ?? DEFAULT_LEVEL;
    }

    // Inheritance: export resolved level so child processes see it.
    process.env[ENV_VAR] = _resolved_level;
    return _resolved_level;
}

/** Clear the cached level. Test helper. */
export function reset_level(): void {
    _resolved_level = null;
    _pending_summary.length = 0;
}

/** Per-step progress note. Drops at silent + minimal. */
export function info(message: string): void {
    if (resolve_level() === 'verbose') {
        process.stdout.write(`${message}\n`);
    }
}

/**
 * Per-step success. At minimal collected for end-of-run summary; at
 * verbose printed immediately; at silent dropped.
 */
export function success(message: string): void {
    const level = resolve_level();
    if (level === 'verbose') {
        process.stdout.write(`${message}\n`);
    } else if (level === 'minimal') {
        _pending_summary.push(message);
    }
}

/** Warning. Stderr at all levels except silent. */
export function warn(message: string): void {
    if (resolve_level() !== 'silent') {
        process.stderr.write(`${message}\n`);
    }
}

/** Error. Always stderr regardless of level. */
export function error(message: string): void {
    process.stderr.write(`${message}\n`);
}

/**
 * Emit the pending `success()` summary at end-of-run.
 *
 * No-op at verbose (already printed) and silent (suppressed). Use the
 * explicit `headline` arg to override the auto-pick.
 */
export function flush_summary(headline: string | null = null): void {
    const level = resolve_level();
    if (level !== 'minimal' || _pending_summary.length === 0) {
        return;
    }
    if (headline) {
        process.stdout.write(`${headline}\n`);
    } else {
        // Default: print the last collected line as the headline.
        process.stdout.write(`${_pending_summary[_pending_summary.length - 1] as string}\n`);
    }
    _pending_summary.length = 0;
}
