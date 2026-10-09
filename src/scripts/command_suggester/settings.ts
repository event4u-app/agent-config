/**
 * Read `commands.suggestion.blocklist` from `.agent-settings.yml` into `Settings`.
 *
 * Ported from the retired Python `src/scripts/command_suggester/settings.py`
 * (ADR-200 py2ts). Mirror of the chat-history pattern:
 *
 *  - The blocklist is the only suggestion key a project still sets. The
 *    master switch, floor, cooldown and option cap are engine constants in
 *    `Settings`: their keys were retired with those defaults as the fixed
 *    behavior, so a leftover value is warned about by the loader and never
 *    read here.
 *  - Malformed YAML / unreadable file → defaults; the suggester degrades
 *    silently rather than crashing the turn.
 *  - The blocklist is forced to an array of non-empty strings.
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
    return new Settings({ blocklist: _coerce_str_tuple(raw.blocklist) });
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

function _isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
