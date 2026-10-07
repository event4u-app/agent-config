/**
 * The one reader of the `git.*` convention keys.
 *
 * `load_agent_settings` merges a layer that does not parse as if it were absent
 * and drops user-global keys off its whitelist without a word, which is right
 * for a setting whose default is harmless and wrong for these three: a team that
 * declares `rebase` and gets a merge commit because an unrelated line elsewhere
 * in the file has an unclosed bracket has had its convention overridden by a
 * default nobody chose. So every key is reported with one of five states, and a
 * caller that acts on the value refuses on anything but `valid` or `absent`:
 *
 * - `valid`     — the deciding layer parsed and the value is allowed;
 * - `absent`    — no layer sets the key; the template default is reported;
 * - `malformed` — a layer at or above the deciding one does not parse, so the
 *                 value is unknowable;
 * - `invalid`   — the deciding layer sets a value the schema does not allow;
 * - `discarded` — only a user-global file sets the key, and the loader drops
 *                 user-global keys that are not whitelisted.
 *
 * Where the layers come from is a {@link GitConventionSource}, so a reader of a
 * committed declaration can replace the checkout cascade without touching the
 * state logic.
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';

import type * as YamlModule from 'yaml';

import { settings_layer_states, template_defaults, user_global_settings_paths } from './agent_settings.js';

const _require = createRequire(import.meta.url);

export const GIT_CONVENTION_KEYS = ['commit_format', 'branch_pattern', 'update_strategy'] as const;
export type GitConventionKey = (typeof GIT_CONVENTION_KEYS)[number];

export type GitConventionState = 'valid' | 'absent' | 'malformed' | 'invalid' | 'discarded';

/** Mirrors the enums in `agent-settings.schema.json`; a test pins the parity. */
export const GIT_CONVENTION_ENUMS: Partial<Record<GitConventionKey, readonly string[]>> = {
    commit_format: ['ticket-scope', 'ticket-prefix'],
    update_strategy: ['merge', 'rebase'],
};

export type GitConventionReason = 'git-convention-malformed' | 'git-convention-invalid' | 'git-convention-discarded';

export interface GitConventionReading {
    key: GitConventionKey;
    value: string | null;
    source: string | null;
    state: GitConventionState;
    reason: GitConventionReason | null;
    detail: string | null;
}

export interface GitConventionLayer {
    path: string;
    parsed: 'absent' | 'valid' | 'malformed';
    data: unknown;
    /** False for a layer whose `git.*` values the loader discards. */
    carries: boolean;
}

export interface GitConventionSource {
    /** Every layer, lowest precedence first. */
    layers(): GitConventionLayer[];
}

export type GitConventionDefaults = Partial<Record<GitConventionKey, string>>;

function _parse(p: string): Pick<GitConventionLayer, 'parsed' | 'data'> {
    let text: string;
    try {
        if (!fs.statSync(p).isFile()) return { parsed: 'absent', data: null };
        text = fs.readFileSync(p, 'utf-8');
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { parsed: 'absent', data: null };
        return { parsed: 'malformed', data: null };
    }
    let data: unknown;
    try {
        const YAML = _require('yaml') as typeof YamlModule;
        data = YAML.parse(text, { version: '1.1' });
    } catch {
        return { parsed: 'malformed', data: null };
    }
    if (data === null || data === undefined) return { parsed: 'valid', data: {} };
    // The loader ignores a document that is not a map, which is the same silent
    // fallback as a parse error.
    if (typeof data !== 'object' || Array.isArray(data)) return { parsed: 'malformed', data: null };
    return { parsed: 'valid', data };
}

/** Explicit files: the user-global ones carry nothing, the developer ones carry. */
export function fileSource(files: { userGlobal?: readonly string[]; developer?: readonly string[] }): GitConventionSource {
    return {
        layers: () => [
            ...(files.userGlobal ?? []).map((p) => ({ path: p, carries: false, ..._parse(p) })),
            ...(files.developer ?? []).map((p) => ({ path: p, carries: true, ..._parse(p) })),
        ],
    };
}

/** The layers `load_agent_settings({ cwd })` reads for the checkout at `cwd`. */
export function checkoutSource(cwd: string): GitConventionSource {
    return {
        layers: () => {
            const userGlobalCount = user_global_settings_paths().length;
            const all = settings_layer_states({ cwd }).map((l) => l.path);
            return fileSource({ userGlobal: all.slice(0, userGlobalCount), developer: all.slice(userGlobalCount) }).layers();
        },
    };
}

type Lookup = { present: false } | { present: true; value: unknown } | { present: true; notAMap: true };

function _lookup(data: unknown, key: GitConventionKey): Lookup {
    if (data === null || typeof data !== 'object') return { present: false };
    const git = (data as Record<string, unknown>).git;
    if (git === undefined || git === null) return { present: false };
    if (typeof git !== 'object' || Array.isArray(git)) return { present: true, notAMap: true };
    const value = (git as Record<string, unknown>)[key];
    if (value === undefined || value === null) return { present: false };
    return { present: true, value };
}

function _normalise(key: GitConventionKey, value: string): string {
    const trimmed = value.trim();
    return GIT_CONVENTION_ENUMS[key] === undefined ? trimmed : trimmed.toLowerCase();
}

/** Why `value` is not allowed for `key`, or null when it is. */
export function invalidReason(key: GitConventionKey, value: string): string | null {
    const allowed = GIT_CONVENTION_ENUMS[key];
    if (allowed !== undefined) {
        return allowed.includes(value) ? null : `\`${value}\` is not one of ${allowed.map((v) => `\`${v}\``).join(', ')}`;
    }
    return value === '' ? 'the pattern is empty' : null;
}

function _defaults(): GitConventionDefaults {
    const git = (template_defaults() as { git?: Record<string, unknown> }).git ?? {};
    const out: GitConventionDefaults = {};
    for (const key of GIT_CONVENTION_KEYS) {
        if (typeof git[key] === 'string') out[key] = git[key] as string;
    }
    return out;
}

function _reading(
    key: GitConventionKey,
    state: GitConventionState,
    value: string | null,
    source: string | null,
    detail: string | null = null,
): GitConventionReading {
    const reason: GitConventionReason | null =
        state === 'malformed' || state === 'invalid' || state === 'discarded' ? `git-convention-${state}` : null;
    return { key, value, source, state, reason, detail };
}

export function readGitConventionKey(
    key: GitConventionKey,
    source: GitConventionSource,
    defaults: GitConventionDefaults = _defaults(),
): GitConventionReading {
    const layers = source.layers();
    const fallback = defaults[key] ?? null;
    for (const layer of [...layers].reverse().filter((l) => l.carries)) {
        if (layer.parsed === 'malformed') {
            return _reading(key, 'malformed', null, layer.path, 'the file does not parse, so the value it may set is unknown');
        }
        const found = _lookup(layer.data, key);
        if (!found.present) continue;
        if ('notAMap' in found) return _reading(key, 'invalid', null, layer.path, '`git:` is not a map');
        if (typeof found.value !== 'string') {
            return _reading(key, 'invalid', String(found.value), layer.path, 'the value is not a string');
        }
        const value = _normalise(key, found.value);
        const why = invalidReason(key, value);
        return why === null ? _reading(key, 'valid', value, layer.path) : _reading(key, 'invalid', value, layer.path, why);
    }
    for (const layer of [...layers].reverse().filter((l) => !l.carries && l.parsed === 'valid')) {
        const found = _lookup(layer.data, key);
        if (!found.present || 'notAMap' in found) continue;
        const value = typeof found.value === 'string' ? _normalise(key, found.value) : String(found.value);
        if (fallback !== null && value === _normalise(key, fallback)) continue;
        return _reading(
            key,
            'discarded',
            value,
            layer.path,
            'user-global files do not carry git.* keys; set it in the project settings file',
        );
    }
    return _reading(key, 'absent', fallback, null);
}

export function readGitConvention(
    source: GitConventionSource,
    defaults: GitConventionDefaults = _defaults(),
): Record<GitConventionKey, GitConventionReading> {
    const out = {} as Record<GitConventionKey, GitConventionReading>;
    for (const key of GIT_CONVENTION_KEYS) out[key] = readGitConventionKey(key, source, defaults);
    return out;
}

/** True for every state a caller must not act on. */
export function isRefusal(state: GitConventionState): boolean {
    return state === 'malformed' || state === 'invalid' || state === 'discarded';
}

/** One line naming the reason code, the key and the file. */
export function describeRefusal(reading: GitConventionReading): string {
    return `${reading.reason ?? 'git-convention-ok'}: git.${reading.key} in ${reading.source ?? '(no file)'} — ${reading.detail ?? reading.state}`;
}
