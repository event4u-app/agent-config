/**
 * Resolve the `inputs` and `pack` why-slots for the trace.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/inputs.py` (ADR-200).
 * Behaviour mirrors the Python original EXACTLY — same resolver reuse,
 * same `None`-on-error branches, same per-knob source attribution, same
 * pack-marker discovery order and key shape. No behaviour changes.
 *
 * Reuses `scripts.config.profiles` and `scripts.config.presets` so the
 * rendered chain matches what the runtime loader actually consulted (no
 * parallel logic — the v1 `explain config` surface already covers this
 * and we read through the same resolvers).
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { DEFAULT_PROJECT_FILE, load_agent_settings, logger } from '../../_lib/agent_settings.js';
import * as presets from '../../config/presets.js';
import * as profiles from '../../config/profiles.js';
import { scrub_string } from './scrubber.js';

const _require = createRequire(import.meta.url);

const _DEFAULT_RULE_LOADING_TIER = 'balanced';
const _SILENCED_LOGGERS: readonly string[] = [
    'scripts.config.profiles',
    'scripts.config.presets',
];

/**
 * Faithful twin of the Python `_silence_resolver_warnings` context manager.
 *
 * The Python original raises the level of the `scripts.config.profiles` /
 * `scripts.config.presets` loggers to ERROR so a profile/preset read
 * failure does not leak an absolute path on stderr. The TypeScript config
 * twins funnel through a single shared `agent_settings.logger` that only
 * appends to `logger.records` (no stderr emission, no per-name level
 * threshold), so there is nothing to silence — the warning never reaches
 * a user-visible channel. This wrapper therefore runs the body unchanged;
 * it preserves the structure (and the `_SILENCED_LOGGERS` name list) for
 * fidelity and never alters the stdout the trace is built from.
 * (ADR-200 documented divergence — logging-model difference, stdout
 * byte-parity unaffected.)
 */
function _silence_resolver_warnings<T>(body: () => T): T {
    // Touch the names + logger so the structural intent is visible to a
    // reader and the import is exercised; behaviour is a pass-through.
    void _SILENCED_LOGGERS;
    void logger;
    return body();
}

function _load_settings(project_root: string): Record<string, unknown> {
    const p = path.join(project_root, DEFAULT_PROJECT_FILE);
    if (!fs.existsSync(p)) {
        return {};
    }
    return (load_agent_settings({ project_path: p }) as Record<string, unknown>) ?? {};
}

/** Python truthiness for the `or` chains below (empty string / 0 / null falsy). */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as object).length > 0;
    }
    return true;
}

export function build(project_root: string): Record<string, unknown> | null {
    let resolved_profile: profiles.ResolvedProfile;
    let resolved_preset: presets.ResolvedPreset;
    let settings: Record<string, unknown>;
    try {
        const result = _silence_resolver_warnings(() => {
            const s = _load_settings(project_root);
            const rp = profiles.resolve_profile({
                project_root,
                user_settings: s,
            });
            const rpre = presets.resolve_preset({
                project_root,
                user_settings: s,
                profile_preset_id: rp.preset_id,
            });
            return { settings: s, resolved_profile: rp, resolved_preset: rpre };
        });
        settings = result.settings;
        resolved_profile = result.resolved_profile;
        resolved_preset = result.resolved_preset;
    } catch (exc) {
        // (profiles.ProfileError, presets.PresetError, OSError) → None.
        if (
            exc instanceof profiles.ProfileError
            || exc instanceof presets.PresetError
            || _isOsError(exc)
        ) {
            return null;
        }
        throw exc;
    }
    // Mirror Python:
    //   rule_loading_tier = (
    //       (settings.get("rule_loading_tier") or settings.get("cost_profile"))
    //       if isinstance(settings, dict) else None
    //   )
    // `.get(...)` is `null` when absent; `or` falls through on a falsy first.
    const isDict = typeof settings === 'object' && settings !== null;
    let rule_loading_tier: unknown;
    if (isDict) {
        const primary = settings.rule_loading_tier ?? null;
        rule_loading_tier = _pyTruthy(primary)
            ? primary
            : (settings.cost_profile ?? null);
    } else {
        rule_loading_tier = null;
    }
    let rule_loading_tier_source = _pyTruthy(rule_loading_tier) ? 'user' : 'default';
    if (!_pyTruthy(rule_loading_tier) || rule_loading_tier === '__RULE_LOADING_TIER__') {
        rule_loading_tier = _DEFAULT_RULE_LOADING_TIER;
        rule_loading_tier_source = 'default';
    }
    return {
        profile: scrub_string(resolved_profile.id),
        preset: scrub_string(resolved_preset.id),
        rule_loading_tier: scrub_string(String(rule_loading_tier)),
        source_per_knob: {
            profile: resolved_profile.source,
            preset: resolved_preset.source,
            rule_loading_tier: rule_loading_tier_source,
        },
    };
}

function _pack_marker(project_root: string): string | null {
    for (const candidate of [
        path.join(project_root, '.agent-pack.yml'),
        path.join(project_root, '.agent-src.uncondensed', '.agent-pack.yml'),
    ]) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

export function build_pack(project_root: string): Record<string, unknown> | null {
    const marker = _pack_marker(project_root);
    if (marker === null) {
        return null;
    }
    let YAML: typeof import('yaml');
    try {
        // Lazy require mirrors Python's lazy `import yaml`.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        YAML = _require('yaml') as typeof import('yaml');
    } catch {
        // ImportError → None.
        return null;
    }
    let raw: unknown;
    try {
        const text = fs.readFileSync(marker, 'utf-8');
        raw = YAML.parse(text, { version: '1.1' });
        if (raw === null || raw === undefined) {
            raw = {};
        }
    } catch {
        // (OSError, yaml.YAMLError) → None.
        return null;
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return null;
    }
    const rawDict = raw as Record<string, unknown>;
    const pack_id = _pyTruthy(rawDict.id) ? rawDict.id : (rawDict.pack ?? null);
    if (typeof pack_id !== 'string' || pack_id.trim() === '') {
        return null;
    }
    const reasonRaw = _pyTruthy(rawDict.reason)
        ? rawDict.reason
        : `declared in ${path.basename(marker)}`;
    return {
        id: scrub_string(pack_id.trim()),
        reason: scrub_string(String(reasonRaw)),
    };
}

/** Heuristic for the Python `except ... OSError` arm. */
function _isOsError(exc: unknown): boolean {
    return (
        exc instanceof Error
        && typeof (exc as NodeJS.ErrnoException).code === 'string'
    );
}
