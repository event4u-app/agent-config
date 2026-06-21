// Preset loader — step-15 Phase 1 item 4.
//
// Resolves the active `preset.id` and merged knob set from the chain
// documented in the config-presets contract. Pure, read-only, lazy-PyYAML.
//
// Resolution chain (last writer wins for any single knob):
//
//   1. `pack.preset_id` — set `preset.id` (Phase 2; `None` until packs land).
//   2. `profile.preset_id` — set `preset.id` if not pack-set.
//   3. `preset.<id>.yml` — fill all knobs from the seed file.
//   4. `.agent-settings.yml` user keys under `preset:` — override per-knob.
//   5. Environment variables (`AGENT_CONFIG_PRESET_*`) — override per-knob,
//      structured keys mapped from the schema (see `ENV_KNOB_MAP`).
//   6. Runtime CLI overrides — caller passes a flat `runtime_overrides` map.
//
// Profile-aware overlay is **not** done here — callers that need
// profile-specific reads of preset knobs (e.g. `block_on_risk.code_paths` for
// `developer` vs `block_on_risk.financial_paths` for `founder`) read the
// merged knob bag returned by `resolve_preset`.
//
// Twin of `src/scripts/config/presets.py`.
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import { logger } from '../_lib/agent_settings.js';
import { artefact_roots } from '../_lib/agent_src.js';
import type * as YamlModule from 'yaml';

// ESM-standard `require` shim — works whether this module is imported or run
// directly (mirrors Python's lazy `import yaml`).
const _require = createRequire(import.meta.url);

// `any` mirrors Python's `dict[str, Any]` knob bag; knob values are
// heterogeneous (nested dicts, lists, numbers, bools, strings).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
type Dict = Record<string, Any>;

export const PRESET_ID_ENV = 'AGENT_CONFIG_PRESET_ID';
export const SEED_PRESET_IDS: readonly string[] = ['fast', 'balanced', 'strict'];
export const DEFAULT_PRESET_ID = 'balanced';
export const PRESETS_DIRNAME = '.agent-src.uncondensed/presets';

export const SOURCE_PACK = 'pack';
export const SOURCE_PROFILE = 'profile';
export const SOURCE_USER = 'user-settings';
export const SOURCE_ENV = 'env';
export const SOURCE_RUNTIME = 'runtime';
export const SOURCE_DEFAULT = 'default';

export const ENV_KNOB_MAP: Record<string, readonly string[]> = {
    AGENT_CONFIG_PRESET_COST_DAILY_MAX_USD: ['cost', 'daily_max_usd'],
    AGENT_CONFIG_PRESET_COST_WEEKLY_MAX_USD: ['cost', 'weekly_max_usd'],
    AGENT_CONFIG_PRESET_COST_MONTHLY_MAX_USD: ['cost', 'monthly_max_usd'],
    AGENT_CONFIG_PRESET_MCP_PER_CALL_MAX_USD: ['mcp', 'per_call_max_usd'],
    AGENT_CONFIG_PRESET_MCP_PER_SESSION_MAX_USD: ['mcp', 'per_session_max_usd'],
    AGENT_CONFIG_PRESET_COUNCIL_CAP_PER_CONSULT_USD: ['council', 'cap_per_consult_usd'],
    AGENT_CONFIG_PRESET_AUTONOMY_DEFAULT: ['autonomy', 'default'],
    AGENT_CONFIG_PRESET_CONFIDENCE_MIN_BAND: ['confidence', 'min_band'],
};

/** Outcome of `resolve_preset`. See config-presets contract. */
export class ResolvedPreset {
    readonly id: string;
    readonly knobs: Dict;
    readonly source: string;
    readonly overrides: readonly string[];
    readonly warning: string | null;

    constructor(params: {
        id: string;
        knobs?: Dict;
        source?: string;
        overrides?: readonly string[];
        warning?: string | null;
    }) {
        this.id = params.id;
        this.knobs = params.knobs ?? {};
        this.source = params.source ?? SOURCE_DEFAULT;
        this.overrides = params.overrides ?? [];
        this.warning = params.warning ?? null;
    }
}

/** Raised when a preset id is referenced but its YAML cannot load. */
export class PresetError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PresetError';
    }
}

function _load_yaml(p: string): Dict {
    let YAML: typeof YamlModule;
    try {
        // Lazy require mirrors Python's lazy `import yaml` — a missing package
        // degrades to `{}` (empty knobs) instead of crashing.
         
        YAML = _require('yaml') as typeof YamlModule;
    } catch {
        logger.info('PyYAML unavailable; preset %s returned empty', p);
        return {};
    }
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch (exc) {
        logger.warning('preset read failed for %s: %s', p, String(exc));
        return {};
    }
    let data: Any;
    try {
        // version '1.1' matches PyYAML safe_load.
        data = YAML.parse(text, { version: '1.1' });
        if (data === null || data === undefined) {
            data = {};
        }
    } catch (exc) {
        logger.warning('preset parse failed for %s: %s', p, String(exc));
        return {};
    }
    return _isPlainDict(data) ? (data as Dict) : {};
}

function _preset_file(project_root: string, preset_id: string): string {
    // Legacy single-root layout — honor when present so tests that mock a
    // `.agent-src.uncondensed/` sub-tree under `project_root` keep working.
    const legacy = path.join(project_root, PRESETS_DIRNAME, `${preset_id}.yml`);
    if (_exists(legacy)) {
        return legacy;
    }
    // Monorepo layout — scan every package root via the agent_src helper.
    let roots: string[];
    try {
        roots = artefact_roots();
    } catch {
        return legacy;
    }
    for (const root of roots) {
        const candidate = path.join(root, 'presets', `${preset_id}.yml`);
        if (_exists(candidate)) {
            return candidate;
        }
    }
    return legacy;
}

function _coerce_scalar(raw: string): Any {
    // Python int(raw): base-10 integer literal, optional sign, surrounding
    // whitespace and underscore separators tolerated.
    const asInt = _pyInt(raw);
    if (asInt !== null) {
        return asInt;
    }
    const asFloat = _pyFloat(raw);
    if (asFloat !== null) {
        return asFloat;
    }
    const lowered = raw.toLowerCase();
    if (lowered === 'true' || lowered === 'false') {
        return lowered === 'true';
    }
    return raw;
}

/**
 * Merge `override` into `base` in place; return dotted-override paths.
 * Mirrors Python's `_deep_merge` with `copy.deepcopy` on leaf writes.
 */
function _deep_merge(base: Dict, override: Dict): string[] {
    const paths: string[] = [];

    function walk(b: Dict, o: Dict, prefix: string): void {
        for (const key of Object.keys(o)) {
            const value = o[key];
            const dotted = `${prefix}${key}`;
            if (_isPlainDict(value) && _isPlainDict(b[key])) {
                walk(b[key] as Dict, value as Dict, `${dotted}.`);
            } else {
                b[key] = _deepCopy(value);
                paths.push(dotted);
            }
        }
    }

    walk(base, override, '');
    return paths;
}

function _pick_id(
    pack_preset_id: string | null,
    profile_preset_id: string | null,
    user_settings: Dict,
    runtime_id: string | null,
): [string | null, string] {
    if (runtime_id) {
        return [runtime_id, SOURCE_RUNTIME];
    }
    const env_id = process.env[PRESET_ID_ENV];
    if (env_id) {
        return [env_id, SOURCE_ENV];
    }
    const block = _isPlainDict(user_settings) ? user_settings['preset'] : undefined;
    if (_isPlainDict(block) && (block as Dict)['id']) {
        return [String((block as Dict)['id']), SOURCE_USER];
    }
    if (pack_preset_id) {
        return [pack_preset_id, SOURCE_PACK];
    }
    if (profile_preset_id) {
        return [profile_preset_id, SOURCE_PROFILE];
    }
    return [null, SOURCE_DEFAULT];
}

/** Return the active `ResolvedPreset` for the current session. */
export function resolve_preset(params: {
    project_root: string;
    user_settings?: Dict | null;
    pack_preset_id?: string | null;
    profile_preset_id?: string | null;
    runtime_id?: string | null;
    runtime_overrides?: Map<readonly string[], Any> | null;
}): ResolvedPreset {
    const settings: Dict = params.user_settings ?? {};
    let [preset_id, source] = _pick_id(
        params.pack_preset_id ?? null,
        params.profile_preset_id ?? null,
        settings,
        params.runtime_id ?? null,
    );
    if (preset_id === null) {
        preset_id = DEFAULT_PRESET_ID;
        source = SOURCE_DEFAULT;
    }
    const yaml_path = _preset_file(params.project_root, preset_id);
    if (!_exists(yaml_path)) {
        throw new PresetError(
            `preset.id=${_repr(preset_id)} (${source}) but ${yaml_path} not found`,
        );
    }
    const raw = _load_yaml(yaml_path);
    let knobs = raw['preset'] ?? {};
    if (!_isPlainDict(knobs)) {
        throw new PresetError(`${yaml_path} has no top-level 'preset:' mapping`);
    }
    knobs = _deepCopy(knobs) as Dict;
    delete (knobs as Dict)['id'];
    const overrides: string[] = [];
    const settingsPreset = settings['preset'];
    const user_block = _isPlainDict(settingsPreset) ? (settingsPreset as Dict) : null;
    if (_isPlainDict(user_block)) {
        const user_overrides: Dict = {};
        for (const k of Object.keys(user_block as Dict)) {
            if (k !== 'id') {
                user_overrides[k] = (user_block as Dict)[k];
            }
        }
        if (Object.keys(user_overrides).length > 0) {
            overrides.push(..._deep_merge(knobs as Dict, user_overrides));
        }
    }
    for (const env_key of Object.keys(ENV_KNOB_MAP)) {
        const keyPath = ENV_KNOB_MAP[env_key]!;
        const raw_value = process.env[env_key];
        if (raw_value === undefined) {
            continue;
        }
        let cursor: Dict = knobs as Dict;
        for (const part of keyPath.slice(0, -1)) {
            if (!_isPlainDict(cursor[part])) {
                cursor[part] = {};
            }
            cursor = cursor[part] as Dict;
        }
        cursor[keyPath[keyPath.length - 1]!] = _coerce_scalar(raw_value);
        overrides.push(keyPath.join('.'));
    }
    if (params.runtime_overrides) {
        for (const [keyPath, value] of params.runtime_overrides) {
            let cursor: Dict = knobs as Dict;
            for (const part of keyPath.slice(0, -1)) {
                if (!_isPlainDict(cursor[part])) {
                    cursor[part] = {};
                }
                cursor = cursor[part] as Dict;
            }
            cursor[keyPath[keyPath.length - 1]!] = value;
            overrides.push(keyPath.join('.'));
        }
    }
    return new ResolvedPreset({
        id: preset_id,
        knobs: knobs as Dict,
        source,
        overrides,
    });
}

// --- parity primitives -----------------------------------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isPlainDict(value: Any): value is Dict {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Map)
    );
}

/** Structural deep copy of YAML/JSON-shaped values (mirrors copy.deepcopy). */
function _deepCopy(value: Any): Any {
    if (Array.isArray(value)) {
        return value.map((v) => _deepCopy(v));
    }
    if (_isPlainDict(value)) {
        const out: Dict = {};
        for (const k of Object.keys(value)) {
            out[k] = _deepCopy(value[k]);
        }
        return out;
    }
    return value;
}

/** Python `int(str)` — base-10 only, sign + underscores tolerated; null on fail. */
function _pyInt(raw: string): number | null {
    const s = raw.trim();
    if (!/^[+-]?\d+(?:_\d+)*$/.test(s)) {
        return null;
    }
    const n = Number(s.replace(/_/g, ''));
    return Number.isFinite(n) ? n : null;
}

/** Python `float(str)` — accepts ints, decimals, exponents, inf/nan; null on fail. */
function _pyFloat(raw: string): number | null {
    const s = raw.trim();
    if (s === '') {
        return null;
    }
    const lowered = s.toLowerCase().replace('+', '').replace('-', '');
    if (lowered === 'inf' || lowered === 'infinity') {
        return s.trim().startsWith('-') ? -Infinity : Infinity;
    }
    if (lowered === 'nan') {
        return NaN;
    }
    if (!/^[+-]?(?:\d+(?:_\d+)*\.?\d*(?:_\d+)*|\.\d+(?:_\d+)*)(?:[eE][+-]?\d+)?$/.test(s)) {
        return null;
    }
    const n = Number(s.replace(/_/g, ''));
    return Number.isFinite(n) ? n : null;
}

/** Python `repr(str)` for the single-quoted-string error message shape. */
function _repr(s: string): string {
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
