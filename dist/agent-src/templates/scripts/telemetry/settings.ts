/**
 * Shared settings reader for the `telemetry:*` CLI commands.
 *
 * TypeScript twin of `settings.py` (ADR-200). Reads the
 * `telemetry.artifact_engagement` namespace from `.agent-settings.yml`.
 * Tolerates a missing file, a missing section, and a missing YAML parser —
 * the default-off doctrine means "everything unparseable means disabled".
 *
 * Three namespaces live here, all under `telemetry:` and all default-off:
 * `artifact_engagement` (the CLI's own log), `tier_usage` (the documented
 * signal contract), and `remote` (road-to-org-telemetry Phase 1 — the
 * org-pack-enabled Class-A usage record). They share one doctrine and one
 * set of coercion helpers; they share no state.
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import type * as YamlModule from 'yaml';

// Resolve `yaml` relative to this module (not cwd) so a consumer's cwd
// package.json never interferes; mirrors Python's lazy `import yaml`.
const YAML = createRequire(import.meta.url)('yaml') as typeof YamlModule;

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

/**
 * Read one `telemetry.<key>` section out of a settings file.
 *
 * Every branch that cannot produce a section returns the empty one with
 * `present: false` — a missing file, unparseable YAML, a missing `telemetry:`
 * mapping, and a missing sub-key are deliberately indistinguishable here.
 * That IS the default-off doctrine: unparseable means disabled, and a reader
 * that could tell those cases apart would invite a caller to treat one of
 * them as consent.
 */
function _read_telemetry_section(
    p: string,
    key: string,
): { section: Record<string, unknown>; present: boolean } {
    if (!_isFile(p)) {
        return { section: {}, present: false };
    }
    let raw: unknown = {};
    try {
        raw = YAML.parse(fs.readFileSync(p, 'utf-8'), { version: '1.1' });
        if (raw === null || raw === undefined) {
            raw = {};
        }
    } catch {
        raw = {};
    }
    if (!_isPlainObject(raw)) {
        return { section: {}, present: false };
    }
    const tele = raw['telemetry'];
    if (!_isPlainObject(tele)) {
        return { section: {}, present: false };
    }
    const sub = tele[key];
    if (!_isPlainObject(sub)) {
        return { section: {}, present: false };
    }
    return { section: sub, present: true };
}

/** Return parsed telemetry settings — never raises on missing data. */
export function read_settings(p: string): TelemetrySettings {
    const { section, present: section_present } = _read_telemetry_section(p, 'artifact_engagement');

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
    const { section } = _read_telemetry_section(p, 'tier_usage');

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

// ── telemetry.remote — org-pack Class-A usage records ───────────────────
//
// road-to-org-telemetry Phase 1. Same default-off doctrine as the two
// namespaces above, with one addition the others do not need: this is the
// only namespace whose records are intended to LEAVE the machine (Phase 2
// transports them; Phase 1 writes them locally and nothing else). So
// `enabled: true` alone is deliberately not enough to switch it on.

export const DEFAULT_REMOTE_LOG_PATH = '.agent-telemetry.jsonl';
export const DEFAULT_REMOTE_FLUSH = 'session-end';
export const ALLOWED_REMOTE_FLUSH = ['session-end', 'never'] as const;

/**
 * The four fields that must ALL carry a value before a single record is
 * written. `endpoint` and `org_id` name where the data goes and on whose
 * authority; `salt` is the org-pack secret without which the user hash
 * would be a plain hash of a login name — i.e. reversible by dictionary.
 *
 * None of the four has a usable default, and that is the point: an
 * external clone of this repository carries the key NAMES and no values,
 * so it cannot reach `active` by copying the tree.
 */
export const REMOTE_REQUIRED_FIELDS = ['endpoint', 'org_id', 'salt'] as const;

export class RemoteTelemetrySettings {
    /** The raw `enabled:` value. NOT the switch — see `active`. */
    readonly enabled: boolean;
    readonly endpoint: string;
    readonly org_id: string;
    /** Org-pack secret. Never written into a record, never logged. */
    readonly salt: string;
    readonly flush: string;
    readonly log_path: string;

    constructor(init: {
        enabled: boolean;
        endpoint: string;
        org_id: string;
        salt: string;
        flush: string;
        log_path: string;
    }) {
        this.enabled = init.enabled;
        this.endpoint = init.endpoint;
        this.org_id = init.org_id;
        this.salt = init.salt;
        this.flush = init.flush;
        this.log_path = init.log_path;
    }

    /**
     * Which required fields are absent. Empty array + `enabled` ⇒ `active`.
     * Exposed so a doctor command can say WHICH field is missing without
     * printing the salt, rather than reporting a bare "disabled".
     */
    get missing(): string[] {
        const out: string[] = [];
        for (const field of REMOTE_REQUIRED_FIELDS) {
            if (!this[field]) {
                out.push(field);
            }
        }
        return out;
    }

    /** The real switch: opted in AND fully configured by the org pack. */
    get active(): boolean {
        return this.enabled && this.missing.length === 0;
    }
}

/**
 * Return parsed remote-telemetry settings — never raises on missing data.
 *
 * Fail-closed on every axis. A missing file, unparseable YAML, a missing
 * section, a missing field, or an unknown `flush` value all resolve to a
 * settings object whose `active` is false.
 */
export function read_remote_settings(p: string): RemoteTelemetrySettings {
    const { section } = _read_telemetry_section(p, 'remote');
    const output = _isPlainObject(section['output']) ? section['output'] : {};

    return new RemoteTelemetrySettings({
        enabled: _coerce_bool(section['enabled'], false),
        endpoint: _coerce_str(section['endpoint'], ''),
        org_id: _coerce_str(section['org_id'], ''),
        salt: _coerce_str(section['salt'], ''),
        flush: _coerce_str(section['flush'], DEFAULT_REMOTE_FLUSH, ALLOWED_REMOTE_FLUSH),
        log_path: _coerce_path(output['path'], DEFAULT_REMOTE_LOG_PATH),
    });
}
