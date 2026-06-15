/**
 * Shared settings reader for the `telemetry:*` CLI commands.
 *
 * TypeScript twin of `settings.py` (ADR-200). Reads the
 * `telemetry.artifact_engagement` namespace from `.agent-settings.yml`.
 * Tolerates a missing file, a missing section, and a missing YAML parser —
 * the default-off doctrine means "everything unparseable means disabled".
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';

// Resolve `yaml` relative to this module (not cwd) so a consumer's cwd
// package.json never interferes; mirrors Python's lazy `import yaml`.
const YAML = createRequire(import.meta.url)('yaml') as typeof import('yaml');

export const DEFAULT_LOG_PATH = '.agent-engagement.jsonl';
export const DEFAULT_GRANULARITY = 'task';
export const ALLOWED_GRANULARITIES = ['task', 'phase-step', 'tool-call'] as const;

export const DEFAULT_TIER_USAGE_LOG_PATH = '.agent-tier-usage.jsonl';
export const DEFAULT_TIER_USAGE_RETIER = {
    window_days: 30,
    min_invocations: 20,
    min_distinct_users: 3,
} as const;

export class TelemetrySettings {
    readonly enabled: boolean;
    readonly granularity: string;
    readonly log_path: string;
    readonly record_consulted: boolean;
    readonly record_applied: boolean;
    private readonly _section_present: boolean;

    constructor(init: {
        enabled: boolean;
        granularity: string;
        log_path: string;
        record_consulted: boolean;
        record_applied: boolean;
        section_present: boolean;
    }) {
        this.enabled = init.enabled;
        this.granularity = init.granularity;
        this.log_path = init.log_path;
        this.record_consulted = init.record_consulted;
        this.record_applied = init.record_applied;
        this._section_present = init.section_present;
    }

    get section_present(): boolean {
        return this._section_present;
    }
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

function _coerce_bool(value: unknown, def: boolean): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalised = value.trim().toLowerCase();
        if (['true', 'yes', 'on', '1'].includes(normalised)) {
            return true;
        }
        if (['false', 'no', 'off', '0'].includes(normalised)) {
            return false;
        }
    }
    return def;
}

function _coerce_str(value: unknown, def: string, allowed?: readonly string[]): string {
    if (typeof value !== 'string' || !value.trim()) {
        return def;
    }
    const candidate = value.trim();
    if (allowed && !allowed.includes(candidate)) {
        return def;
    }
    return candidate;
}

function _coerce_path(value: unknown, def: string): string {
    if (typeof value !== 'string' || !value.trim()) {
        return def;
    }
    return value.trim();
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Return parsed telemetry settings — never raises on missing data. */
export function read_settings(p: string): TelemetrySettings {
    let section: Record<string, unknown> = {};
    let section_present = false;

    if (_isFile(p)) {
        let raw: unknown = {};
        try {
            raw = YAML.parse(fs.readFileSync(p, 'utf-8'), { version: '1.1' });
            if (raw === null || raw === undefined) {
                raw = {};
            }
        } catch {
            raw = {};
        }
        if (_isPlainObject(raw)) {
            const tele = raw['telemetry'];
            if (_isPlainObject(tele)) {
                const artefact = tele['artifact_engagement'];
                if (_isPlainObject(artefact)) {
                    section = artefact;
                    section_present = true;
                }
            }
        }
    }

    const record = _isPlainObject(section['record']) ? section['record'] : {};
    const output = _isPlainObject(section['output']) ? section['output'] : {};

    return new TelemetrySettings({
        enabled: _coerce_bool(section['enabled'], false),
        granularity: _coerce_str(section['granularity'], DEFAULT_GRANULARITY, ALLOWED_GRANULARITIES),
        log_path: _coerce_path(output['path'], DEFAULT_LOG_PATH),
        record_consulted: _coerce_bool(record['consulted'], true),
        record_applied: _coerce_bool(record['applied'], true),
        section_present,
    });
}

export class TierUsageSettings {
    readonly enabled: boolean;
    readonly log_path: string;
    readonly window_days: number;
    readonly min_invocations: number;
    readonly min_distinct_users: number;

    constructor(init: {
        enabled: boolean;
        log_path: string;
        window_days: number;
        min_invocations: number;
        min_distinct_users: number;
    }) {
        this.enabled = init.enabled;
        this.log_path = init.log_path;
        this.window_days = init.window_days;
        this.min_invocations = init.min_invocations;
        this.min_distinct_users = init.min_distinct_users;
    }
}

/** Return parsed tier-usage settings — never raises on missing data. */
export function read_tier_usage_settings(p: string): TierUsageSettings {
    let section: Record<string, unknown> = {};
    if (_isFile(p)) {
        let raw: unknown = {};
        try {
            raw = YAML.parse(fs.readFileSync(p, 'utf-8'), { version: '1.1' });
            if (raw === null || raw === undefined) {
                raw = {};
            }
        } catch {
            raw = {};
        }
        if (_isPlainObject(raw)) {
            const tele = raw['telemetry'];
            if (_isPlainObject(tele)) {
                const tu = tele['tier_usage'];
                if (_isPlainObject(tu)) {
                    section = tu;
                }
            }
        }
    }

    const output = _isPlainObject(section['output']) ? section['output'] : {};
    const retier = _isPlainObject(section['retier']) ? section['retier'] : {};
    const defaults = DEFAULT_TIER_USAGE_RETIER;

    const _coerce_int = (value: unknown, def: number): number => {
        if (typeof value === 'boolean') {
            return def;
        }
        if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
            return value;
        }
        return def;
    };

    return new TierUsageSettings({
        enabled: _coerce_bool(section['enabled'], false),
        log_path: _coerce_path(output['path'], DEFAULT_TIER_USAGE_LOG_PATH),
        window_days: _coerce_int(retier['window_days'], defaults.window_days),
        min_invocations: _coerce_int(retier['min_invocations'], defaults.min_invocations),
        min_distinct_users: _coerce_int(retier['min_distinct_users'], defaults.min_distinct_users),
    });
}
