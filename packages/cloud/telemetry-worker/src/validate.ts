/**
 * Schema validator. Strict: unknown fields and out-of-enum values
 * cause rejection. Mirrors `docs/distribution/telemetry-schema.md`.
 *
 * The validator never throws — it returns a `Result` so the worker
 * can map invalid bodies to `400` without a try/catch around parsing.
 */

import {
    SCHEMA_VERSION,
    type DurationBucket,
    type EntryPath,
    type ErrorClass,
    type HostAgentFamily,
    type InstallStageEvent,
    type NodeMajor,
    type OsFamily,
    type PackCategory,
    type TelemetryStage,
} from './types.js';

const STAGES: readonly TelemetryStage[] = [
    'started',
    'wizard_opt_in_seen',
    'wizard_opt_in_accepted',
    'packs_selected',
    'applied',
    'first_command_run',
    'errored',
];
const ENTRY_PATHS: readonly EntryPath[] = ['npx', 'curl', 'gui'];
const HOST_AGENTS: readonly HostAgentFamily[] = ['vscode', 'jetbrains', 'cli', 'browser', 'unknown'];
const OS_FAMILIES: readonly OsFamily[] = ['linux', 'macos', 'windows'];
const NODE_MAJORS: readonly NodeMajor[] = ['20', '22'];
const PACK_CATEGORIES: readonly PackCategory[] = [
    'finance',
    'founder',
    'engineering',
    'content',
    'consultant',
    'meta',
    'other',
];
const DURATION_BUCKETS: readonly DurationBucket[] = ['<30s', '30s-2m', '2m-10m', '>10m'];
const ERROR_CLASSES: readonly ErrorClass[] = [
    'network',
    'filesystem',
    'config_invalid',
    'dependency',
    'unknown',
];

const ALLOWED_KEYS = new Set([
    'schema_version',
    'event',
    'stage',
    'ts',
    'session_id',
    'entry_path',
    'host_agent_family',
    'os',
    'node_major',
    'agent_config_version',
    'pack_categories',
    'wizard_used',
    'duration_bucket',
    'error_class',
]);

export type ValidationResult =
    | { readonly ok: true; readonly event: InstallStageEvent }
    | { readonly ok: false; readonly reason: string };

export function validateEvent(raw: unknown): ValidationResult {
    if (raw === null || typeof raw !== 'object') {
        return { ok: false, reason: 'body is not a JSON object' };
    }
    const obj = raw as Record<string, unknown>;

    for (const key of Object.keys(obj)) {
        if (!ALLOWED_KEYS.has(key)) {
            return { ok: false, reason: `unknown field: ${key}` };
        }
    }

    if (obj.schema_version !== SCHEMA_VERSION) {
        return { ok: false, reason: 'schema_version must be "1"' };
    }
    if (obj.event !== 'install_stage') {
        return { ok: false, reason: 'event must be "install_stage"' };
    }
    if (!isOneOf(obj.stage, STAGES)) return { ok: false, reason: 'invalid stage' };
    if (typeof obj.ts !== 'string' || !isIsoTimestamp(obj.ts)) {
        return { ok: false, reason: 'ts must be ISO-8601 UTC' };
    }
    if (obj.session_id !== undefined && !isHexToken(obj.session_id, 32)) {
        return { ok: false, reason: 'session_id must be 32-char hex' };
    }
    if (!isOneOf(obj.entry_path, ENTRY_PATHS)) return { ok: false, reason: 'invalid entry_path' };
    if (!isOneOf(obj.host_agent_family, HOST_AGENTS)) return { ok: false, reason: 'invalid host_agent_family' };
    if (!isOneOf(obj.os, OS_FAMILIES)) return { ok: false, reason: 'invalid os' };
    if (!isOneOf(obj.node_major, NODE_MAJORS)) return { ok: false, reason: 'invalid node_major' };
    if (typeof obj.agent_config_version !== 'string' || obj.agent_config_version.length === 0) {
        return { ok: false, reason: 'agent_config_version required' };
    }
    if (obj.pack_categories !== undefined) {
        if (!Array.isArray(obj.pack_categories)) {
            return { ok: false, reason: 'pack_categories must be array' };
        }
        for (const cat of obj.pack_categories) {
            if (!isOneOf(cat, PACK_CATEGORIES)) {
                return { ok: false, reason: `invalid pack_category: ${String(cat)}` };
            }
        }
    }
    if (typeof obj.wizard_used !== 'boolean') {
        return { ok: false, reason: 'wizard_used must be boolean' };
    }
    if (!isOneOf(obj.duration_bucket, DURATION_BUCKETS)) {
        return { ok: false, reason: 'invalid duration_bucket' };
    }
    if (obj.error_class !== undefined && !isOneOf(obj.error_class, ERROR_CLASSES)) {
        return { ok: false, reason: 'invalid error_class' };
    }

    return { ok: true, event: obj as unknown as InstallStageEvent };
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function isIsoTimestamp(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)) return false;
    const ms = Date.parse(value);
    return Number.isFinite(ms);
}

function isHexToken(value: unknown, length: number): value is string {
    return typeof value === 'string' && value.length === length && /^[0-9a-f]+$/.test(value);
}
