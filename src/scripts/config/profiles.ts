// Profile loader — step-15 Phase 1 item 1.
//
// Resolves the active `profile.id` from the chain documented in the
// profile-system contract and returns a structured `ResolvedProfile`. Pure,
// read-only, lazy-PyYAML.
//
// Resolution chain (last writer wins):
//
//   1. Pack-supplied `profile_id` (Phase 2 item 7 — pack loader passes it in
//      via `pack_profile_id`; `None` until packs land).
//   2. `.agent-settings.yml` top-level `profile.id` (and any user overrides
//      for `audience` / `defaults` / `surface`).
//   3. Environment variable `AGENT_CONFIG_PROFILE_ID`.
//   4. Runtime CLI flag — caller passes `runtime_id`.
//
// Falls back to `developer` **only** when no settings file exists yet (fresh
// install before `/onboard`). With a settings file present but no `profile`
// block, the loader returns a structured warning state so `/onboard` can
// surface "audience not yet picked".
//
// Twin of `src/scripts/config/profiles.py`.
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import { DEFAULT_PROJECT_FILE, logger } from '../_lib/agent_settings.js';
import { artefact_roots } from '../_lib/agent_src.js';

// ESM-standard `require` shim — works whether imported or run directly.
const _require = createRequire(import.meta.url);

// `any` mirrors Python's `dict[str, Any]` raw YAML payload.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
type Dict = Record<string, Any>;

export const PROFILE_ID_ENV = 'AGENT_CONFIG_PROFILE_ID';
export const SEED_PROFILE_IDS: readonly string[] = [
    'founder',
    'developer',
    'content_creator',
    'agency',
    'finance',
    'ops',
];
export const DEFAULT_PROFILE_ID = 'developer';
export const PROFILES_DIRNAME = '.agent-src.uncondensed/profiles';

export const SOURCE_PACK = 'pack';
export const SOURCE_USER = 'user-settings';
export const SOURCE_ENV = 'env';
export const SOURCE_RUNTIME = 'runtime';
export const SOURCE_DEFAULT = 'default';
export const SOURCE_MISSING = 'missing';

/** Outcome of `resolve_profile`. See profile-system contract. */
export class ResolvedProfile {
    readonly id: string;
    readonly audience: Record<string, string>;
    readonly preset_id: string | null;
    readonly packs: readonly string[];
    readonly personas: readonly string[];
    readonly skills_hint: readonly string[];
    readonly commands_hint: readonly string[];
    readonly docs_first_pointer: string | null;
    readonly source: string;
    readonly warning: string | null;

    constructor(params: {
        id: string;
        audience?: Record<string, string>;
        preset_id?: string | null;
        packs?: readonly string[];
        personas?: readonly string[];
        skills_hint?: readonly string[];
        commands_hint?: readonly string[];
        docs_first_pointer?: string | null;
        source?: string;
        warning?: string | null;
    }) {
        this.id = params.id;
        this.audience = params.audience ?? {};
        this.preset_id = params.preset_id ?? null;
        this.packs = params.packs ?? [];
        this.personas = params.personas ?? [];
        this.skills_hint = params.skills_hint ?? [];
        this.commands_hint = params.commands_hint ?? [];
        this.docs_first_pointer = params.docs_first_pointer ?? null;
        this.source = params.source ?? SOURCE_DEFAULT;
        this.warning = params.warning ?? null;
    }
}

/** Raised when a profile id is referenced but its YAML cannot load. */
export class ProfileError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProfileError';
    }
}

function _load_yaml(p: string): Dict {
    let YAML: typeof import('yaml');
    try {
        // Lazy require mirrors Python's lazy `import yaml`.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        YAML = _require('yaml') as typeof import('yaml');
    } catch {
        logger.info('PyYAML unavailable; profile %s returned empty', p);
        return {};
    }
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch (exc) {
        logger.warning('profile read failed for %s: %s', p, String(exc));
        return {};
    }
    let data: Any;
    try {
        data = YAML.parse(text, { version: '1.1' });
        if (data === null || data === undefined) {
            data = {};
        }
    } catch (exc) {
        logger.warning('profile parse failed for %s: %s', p, String(exc));
        return {};
    }
    return _isPlainDict(data) ? (data as Dict) : {};
}

function _profile_file(project_root: string, profile_id: string): string {
    const legacy = path.join(project_root, PROFILES_DIRNAME, `${profile_id}.yml`);
    if (_exists(legacy)) {
        return legacy;
    }
    let roots: string[];
    try {
        roots = artefact_roots();
    } catch {
        return legacy;
    }
    for (const root of roots) {
        const candidate = path.join(root, 'profiles', `${profile_id}.yml`);
        if (_exists(candidate)) {
            return candidate;
        }
    }
    return legacy;
}

function _build_resolved(
    profile_id: string,
    raw: Dict,
    options: { source: string; warning?: string | null },
): ResolvedProfile {
    const block: Dict = _isPlainDict(raw['profile']) ? (raw['profile'] as Dict) : {};
    const audience_raw: Dict = _isPlainDict(block['audience']) ? (block['audience'] as Dict) : {};
    const defaults: Dict = _isPlainDict(block['defaults']) ? (block['defaults'] as Dict) : {};
    const surface: Dict = _isPlainDict(block['surface']) ? (block['surface'] as Dict) : {};
    const audience: Record<string, string> = {};
    for (const k of Object.keys(audience_raw)) {
        audience[String(k)] = String(audience_raw[k]);
    }
    const packs = _strTuple(block['packs']);
    const personas = _strTuple(defaults['personas']);
    const skills_hint = _strTuple(defaults['skills_hint']);
    const commands_hint = _strTuple(surface['commands_hint']);
    const docs_pointer = surface['docs_first_pointer'];
    return new ResolvedProfile({
        id: profile_id,
        audience,
        preset_id: defaults['preset_id'] ?? null,
        packs,
        personas,
        skills_hint,
        commands_hint,
        docs_first_pointer: docs_pointer ? String(docs_pointer) : null,
        source: options.source,
        warning: options.warning ?? null,
    });
}

function _pick_id(
    pack_profile_id: string | null,
    user_settings: Dict,
    runtime_id: string | null,
): [string | null, string] {
    if (runtime_id) {
        return [runtime_id, SOURCE_RUNTIME];
    }
    const env_id = process.env[PROFILE_ID_ENV];
    if (env_id) {
        return [env_id, SOURCE_ENV];
    }
    const block = _isPlainDict(user_settings) ? user_settings['profile'] : undefined;
    if (_isPlainDict(block) && (block as Dict)['id']) {
        return [String((block as Dict)['id']), SOURCE_USER];
    }
    if (pack_profile_id) {
        return [pack_profile_id, SOURCE_PACK];
    }
    return [null, SOURCE_MISSING];
}

/** Return the active `ResolvedProfile` for the current session. */
export function resolve_profile(params: {
    project_root: string;
    user_settings?: Dict | null;
    pack_profile_id?: string | null;
    runtime_id?: string | null;
}): ResolvedProfile {
    const settings: Dict = params.user_settings ?? {};
    const settings_file = path.join(params.project_root, DEFAULT_PROJECT_FILE);
    const [profile_id, source] = _pick_id(
        params.pack_profile_id ?? null,
        settings,
        params.runtime_id ?? null,
    );
    if (profile_id === null) {
        if (_exists(settings_file)) {
            return new ResolvedProfile({
                id: DEFAULT_PROFILE_ID,
                source: SOURCE_MISSING,
                warning:
                    'no profile.id in .agent-settings.yml — run /onboard to ' +
                    'pick an audience deliberately',
            });
        }
        return _build_resolved(
            DEFAULT_PROFILE_ID,
            _load_yaml(_profile_file(params.project_root, DEFAULT_PROFILE_ID)),
            { source: SOURCE_DEFAULT },
        );
    }
    const yaml_path = _profile_file(params.project_root, profile_id);
    if (!_exists(yaml_path)) {
        throw new ProfileError(
            `profile.id=${_repr(profile_id)} (${source}) but ${yaml_path} not found`,
        );
    }
    return _build_resolved(profile_id, _load_yaml(yaml_path), { source });
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

/** `tuple(str(x) for x in (value or []))` — empty when value is not a list. */
function _strTuple(value: Any): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map((v) => String(v));
}

/** Python `repr(str)` for the error message shape. */
function _repr(s: string): string {
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
