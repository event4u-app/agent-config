/**
 * Read `commands.suggestion.*` from `.agent-settings.yml` into `Settings`.
 *
 * TypeScript twin of `src/scripts/command_suggester/settings.py`
 * (ADR-200 py2ts). Mirror of the chat-history pattern:
 *
 *  - Default-permissive: a missing file or missing section returns
 *    `Settings()` defaults (suggestion layer enabled). Only an explicit
 *    `enabled: false` flips the master switch off.
 *  - Malformed YAML / unreadable file → defaults; the suggester degrades
 *    silently rather than crashing the turn.
 *  - Type-coerces with bounded fallbacks (floors clamped 0.0-1.0, ints
 *    non-negative, blocklist forced to an array of strings).
 *
 * The Python module reads the YAML via the shared `agent_settings`
 * loader; this twin delegates to the ported `agent_settings.ts`.
 */

import { load_agent_settings } from '../_lib/agent_settings.js';
import { Settings } from './types.js';

export const DEFAULT_SETTINGS_FILE = '.agent-settings.yml';

const _DEFAULT = new Settings();

/**
 * Return a `Settings` instance hydrated from `.agent-settings.yml`.
 *
 * `settings_path` is an explicit override. `null` / `undefined`
 * resolves to `./.agent-settings.yml` relative to the current working
 * directory — same convention as `chat_history`.
 */
export function load_settings(settings_path?: string | null): Settings {
    const path = settings_path ? settings_path : DEFAULT_SETTINGS_FILE;
    const raw = _read_section(path);
    if (raw === null) {
        return _DEFAULT;
    }
    return _settings_from_raw(raw);
}

/**
 * Return the `commands.suggestion` mapping or `null` on any miss.
 *
 * The tolerance contract handles missing file / malformed YAML /
 * absent section uniformly. No `commands.*` keys are whitelisted in
 * the user-global cascade, so user-global cannot cascade into this
 * section.
 */
function _read_section(path: string): Record<string, unknown> | null {
    const data = load_agent_settings({ project_path: path });
    const commands = (data as Record<string, unknown>).commands;
    if (!_isPlainObject(commands)) {
        return null;
    }
    const section = commands.suggestion;
    if (!_isPlainObject(section)) {
        return null;
    }
    return section;
}

function _settings_from_raw(raw: Record<string, unknown>): Settings {
    return new Settings({
        enabled: _coerce_bool(raw.enabled, _DEFAULT.enabled),
        confidence_floor: _coerce_floor(raw.confidence_floor, _DEFAULT.confidence_floor),
        cooldown_seconds: _coerce_nonneg_int(raw.cooldown_seconds, _DEFAULT.cooldown_seconds),
        max_options: _coerce_nonneg_int(raw.max_options, _DEFAULT.max_options),
        blocklist: _coerce_str_tuple(raw.blocklist),
    });
}

function _coerce_bool(value: unknown, defaultValue: boolean): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (value === null || value === undefined) {
        return defaultValue;
    }
    if (typeof value === 'string') {
        const s = value.trim().toLowerCase();
        if (['true', 'yes', 'on', '1'].includes(s)) {
            return true;
        }
        if (['false', 'no', 'off', '0'].includes(s)) {
            return false;
        }
    }
    return defaultValue;
}

function _coerce_floor(value: unknown, defaultValue: number): number {
    const f = _pyFloat(value);
    if (f === null) {
        return defaultValue;
    }
    if (f < 0.0) {
        return 0.0;
    }
    if (f > 1.0) {
        return 1.0;
    }
    return f;
}

function _coerce_nonneg_int(value: unknown, defaultValue: number): number {
    const i = _pyInt(value);
    if (i === null) {
        return defaultValue;
    }
    return i >= 0 ? i : defaultValue;
}

function _coerce_str_tuple(value: unknown): string[] {
    // Python: `if not isinstance(value, Iterable) or isinstance(value, (str, bytes))`
    // → only non-string iterables pass; here, arrays. (YAML never yields
    // bytes; strings are excluded just like Python.)
    if (!Array.isArray(value)) {
        return [];
    }
    const out: string[] = [];
    for (const item of value) {
        if (typeof item === 'string' && item.trim()) {
            out.push(item.trim());
        }
    }
    return out;
}

/**
 * Mirror of Python `float(value)`, returning null where Python raises
 * `TypeError` / `ValueError` (the coercion catches those and falls
 * back to the default).
 */
function _pyFloat(value: unknown): number | null {
    if (typeof value === 'boolean') {
        return value ? 1.0 : 0.0;
    }
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const s = value.trim();
        if (s === '') {
            return null;
        }
        const n = Number(s);
        return Number.isNaN(n) ? null : n;
    }
    return null;
}

/**
 * Mirror of Python `int(value)` for the YAML scalar types, returning
 * null where Python raises.
 *
 *  - bool → 1 / 0.
 *  - int  → itself.
 *  - float → truncated toward zero (Python `int(3.9) == 3`).
 *  - string → `int(str, 10)` semantics: an optional sign + digits,
 *    surrounding whitespace allowed; a float-shaped string raises in
 *    Python, so it maps to null.
 */
function _pyInt(value: unknown): number | null {
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    if (typeof value === 'number') {
        if (Number.isNaN(value) || !Number.isFinite(value)) {
            return null;
        }
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const s = value.trim();
        if (!/^[+-]?\d+$/.test(s)) {
            return null;
        }
        return parseInt(s, 10);
    }
    return null;
}

function _isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
