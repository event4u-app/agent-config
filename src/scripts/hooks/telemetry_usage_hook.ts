#!/usr/bin/env tsx
/**
 * Deterministic PostToolUse Class-A usage capture
 * (road-to-org-telemetry Phase 1, step 1.2).
 *
 * Why a hook rather than the existing collector. `skill_usage_collect.ts`
 * scans the maintainer's own transcript directory and derives its project
 * slug from this repository, so a consumer session is invisible to it by
 * construction — the roadmap's Context table records that as still true
 * after 479 commits. Phase 0's third spike then measured the size of the
 * gap on the set the collector DOES read: **0 of 89** invocations detected,
 * against 163 of 164 across every worktree slug. The zero in the usage
 * report is an instrumentation artefact, not an adoption measurement.
 *
 * Phase 0's first spike settled the event this concern binds to:
 * `post_tool_use` with `tool_name === "Skill"`, the skill name at
 * `tool_input.skill` — present in 164 of 164 real invocations across 14,171
 * live records. The transcript-scan fallback the roadmap pre-registered does
 * not fire.
 *
 * DEFAULT-OFF, AND THE SWITCH IS NOT `enabled`. `read_remote_settings`
 * activates only when `enabled` is true AND the org pack supplied an
 * endpoint, an org id, and a salt. An external clone of this repository
 * carries the key names and no values, so copying the tree cannot reach the
 * write path. When inactive this concern performs zero telemetry file
 * operations — no log write, no directory creation — and zero network calls.
 * (It does read `.agent-settings.yml`, once per process and memoised: the
 * settings file is how it learns it is off, the same as the artefact-
 * engagement surface it mirrors.)
 *
 * NO OUTBOUND CALL EXISTS HERE, DELIBERATELY. Transport is Phase 2 and is
 * blocked on `sink-choice`; org-wide enablement is Phase 3 and is blocked on
 * `dpo-signoff`. This concern appends to a local JSONL file and stops.
 *
 * Exit code is ALWAYS 0 — malformed envelope, unreadable settings, failed
 * write, anything. A hook `warn` (exit 2) is read as a hard BLOCK on this
 * host (recorded trap), and a telemetry concern has nothing to say to the
 * model, so it never warns either.
 */
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as fs from 'node:fs';

import {
    read_remote_settings,
    type RemoteTelemetrySettings,
} from '../../agent-src/templates/scripts/telemetry/settings.js';
import {
    append_class_a_record,
    build_class_a_record,
    profile_from_legacy_tier,
} from '../../agent-src/templates/scripts/telemetry/remote.js';
import {
    FLUSH_SESSION_END,
    spool_path_for,
} from '../../agent-src/templates/scripts/telemetry/transport.js';
import { is_replay_mode } from './state_io.js';
import { readHookStdin } from './hook_stdin.js';

const EXIT_ALLOW = 0;

/** The tool name Phase 0 spike 1 confirmed for a skill invocation. */
export const SKILL_TOOL_NAME = 'Skill';

const SETTINGS_FILENAME = '.agent-settings.yml';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Unwrap the dispatcher envelope down to the platform-native payload. */
export function unwrapPayload(envelope: JsonObject): JsonObject {
    const inner = envelope['payload'];
    return isObject(inner) ? inner : envelope;
}

/** Best-effort read of the tool name across host key variants. */
export function extractToolName(payload: JsonObject): string | null {
    const v = payload['tool_name'] ?? payload['toolName'] ?? payload['tool'];
    return typeof v === 'string' && v ? v : null;
}

/**
 * The invoked skill's name, off `tool_input.skill`.
 *
 * Spike 1 observed this key on 164 of 164 real invocations; the camelCase
 * variant is accepted for the same reason `extractToolName` accepts one —
 * host key casing has varied across versions in this tree before.
 */
export function extractSkillName(payload: JsonObject): string | null {
    const input = payload['tool_input'] ?? payload['toolInput'];
    if (!isObject(input)) return null;
    const v = input['skill'] ?? input['skill_name'] ?? input['name'];
    return typeof v === 'string' && v ? v : null;
}

/** Host id off the dispatcher envelope (`claude`, `augment`, …). */
export function extractHost(envelope: JsonObject): string | null {
    const v = envelope['platform'] ?? envelope['host'];
    return typeof v === 'string' && v ? v : null;
}

/**
 * The host session id. Hashed before it is recorded, never stored raw —
 * it is a high-entropy opaque token that `check_secret_leak` reads as a
 * candidate credential.
 */
export function extractSessionId(envelope: JsonObject, payload: JsonObject): string {
    for (const source of [envelope, payload]) {
        const v = source['session_id'] ?? source['sessionId'];
        if (typeof v === 'string' && v) return v;
    }
    return '';
}

/**
 * Read one top-level scalar out of the settings text.
 *
 * Deliberately a raw line scan rather than a YAML parse: this runs on the
 * post-tool hot path, both values wanted here are top-level scalars from
 * closed enums, and `build_class_a_record` rejects anything outside those
 * enums — so a mis-parse produces a dropped field, never a wrong one.
 *
 * Accepts a trailing inline comment, which this file's own settings
 * template uses heavily (`discipline_profile: essential  # ~3.3x kernel
 * tokens`); rejecting it would have silently reported "not declared" for a
 * perfectly ordinary line.
 */
function _scalar(settingsText: string, key: string): string | null {
    const re = new RegExp(`^${key}:[ \\t]*([^#\\r\\n]+?)[ \\t]*(?:#.*)?$`, 'u');
    for (const line of settingsText.split('\n')) {
        const m = re.exec(line);
        if (m && m[1]) {
            const value = m[1].trim().replace(/^["']|["']$/gu, '');
            if (!value) return null;
            // The shipped template carries a placeholder until `install`
            // fills it in; that is "not yet resolved", not a value.
            if (value.startsWith('__')) return null;
            return value;
        }
    }
    return null;
}

/**
 * The DECLARED discipline profile — the knob that actually decides which
 * rule surfaces load.
 *
 * The first version of this function read `rule_loading_tier`, and that was
 * wrong: the settings template calls that key a "legacy knob — superseded by
 * discipline_profile above", and `resolve_discipline_profile` confirms the
 * precedence — explicit `discipline_profile` wins outright and the legacy
 * key is consulted only in its absence. So a default install would have had
 * a knob recorded that does not decide the thing the field implies.
 *
 * The fallback mirrors the resolver's own legacy mapping, which needs no
 * model id and is therefore safe to reproduce here. What is NOT reproduced
 * is the resolver's both-absent default (`essential`): recording it would
 * claim a declaration the install never made. Absent stays `null`, and a
 * reader applies the documented default themselves.
 */
export function extractDisciplineProfile(settingsText: string): string | null {
    const explicit = _scalar(settingsText, 'discipline_profile');
    if (explicit !== null) return explicit;
    return profile_from_legacy_tier(_scalar(settingsText, 'rule_loading_tier'));
}

/**
 * Installed package version, from the env the installer sets. Never
 * fabricated: an install that did not report one records `null`.
 */
export function extractPackageVersion(env: NodeJS.ProcessEnv): string | null {
    const v = env['AGENT_CONFIG_PACKAGE_VERSION'];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
}

interface SettingsRead {
    settings: RemoteTelemetrySettings;
    text: string;
    /**
     * The directory the settings file was found in — the project root, and
     * the base a relative `output.path` resolves against. NOT the session
     * cwd: a session started in a subdirectory would otherwise scatter one
     * log file per directory it happened to start in.
     */
    root: string;
}

/**
 * Read + memoise the settings for one process. The in-process dispatcher
 * runs every concern in one `node`, so without this the file would be read
 * once per concern per tool call.
 */
const _settingsCache = new Map<string, SettingsRead>();

/**
 * Walk up from `start` to the first directory holding a settings file.
 *
 * A host may report a session `cwd` inside a subdirectory of the project,
 * and reading only that directory made the concern silently inactive on a
 * legitimately enabled install — a failure with no message, which is the
 * worst shape for a default-off surface. Bounded by the filesystem root, so
 * it terminates on every path; no hit returns `start` unchanged, and the
 * settings read then fails closed exactly as before.
 */
export function resolveSettingsPath(start: string): string {
    let dir = path.resolve(start);
    for (;;) {
        const candidate = path.join(dir, SETTINGS_FILENAME);
        try {
            if (fs.statSync(candidate).isFile()) return candidate;
        } catch {
            // Not here — keep walking.
        }
        const parent = path.dirname(dir);
        if (parent === dir) return path.join(path.resolve(start), SETTINGS_FILENAME);
        dir = parent;
    }
}

export function readSettingsFor(consumerRoot: string): SettingsRead {
    const p = resolveSettingsPath(consumerRoot);
    const cached = _settingsCache.get(p);
    if (cached !== undefined) return cached;

    let text = '';
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        text = '';
    }
    const read: SettingsRead = { settings: read_remote_settings(p), text, root: path.dirname(p) };
    _settingsCache.set(p, read);
    return read;
}

/** Test seam — the cache is process-global and tests write real files. */
export function _resetSettingsCache(): void {
    _settingsCache.clear();
}

function processEnvelope(envelope: JsonValue, consumer_root: string): number {
    try {
        if (!isObject(envelope)) return EXIT_ALLOW;

        const payload = unwrapPayload(envelope);
        if (extractToolName(payload) !== SKILL_TOOL_NAME) return EXIT_ALLOW;

        const { settings, text, root } = readSettingsFor(consumer_root);
        if (!settings.active) return EXIT_ALLOW;
        if (is_replay_mode()) return EXIT_ALLOW;

        const skill = extractSkillName(payload);
        if (skill === null) return EXIT_ALLOW;

        const record = build_class_a_record({
            skill,
            host: extractHost(envelope),
            org_id: settings.org_id,
            salt: settings.salt,
            hostname: os.hostname(),
            username: os.userInfo().username,
            session_id: extractSessionId(envelope, payload),
            package_version: extractPackageVersion(process.env),
            discipline_profile: extractDisciplineProfile(text),
        });

        // Relative to the PROJECT root (the directory holding the settings
        // file), never to the session cwd — otherwise a session started in a
        // subdirectory writes its own stray log there.
        const logPath = path.isAbsolute(settings.log_path)
            ? settings.log_path
            : path.join(root, settings.log_path);
        // The outbound spool (Phase 2, step 2.1) is written HERE, by the same
        // call that logs the record, and only when the install declared a
        // flush. Under `flush: never` there is no transport at all, so a spool
        // would be a file that grows and is never drained. The path is derived
        // rather than configured so an install cannot point the spool
        // somewhere the appender does not write — a failure whose symptom
        // (records logged locally, nothing ever sent) is invisible.
        const spool = settings.flush === FLUSH_SESSION_END ? spool_path_for(logPath) : null;
        // The growth budget travels from the settings the install actually
        // declared, not from the appender's own defaults — a retention key
        // the write path never reads would be a setting that decorates
        // rather than decides.
        append_class_a_record(
            logPath,
            record,
            {
                max_age_days: settings.retention_max_age_days,
                max_bytes: settings.retention_max_bytes,
            },
            new Date(),
            spool,
        );
    } catch {
        // Malformed payload, unreadable disk, a rejected id — never block
        // the tool call, and never write a degraded record.
        return EXIT_ALLOW;
    }
    return EXIT_ALLOW;
}

export function run(stdin_text: string, options: { consumer_root: string }): number {
    let envelope: JsonValue;
    try {
        const raw = stdin_text.trim();
        if (!raw) return EXIT_ALLOW;
        envelope = JSON.parse(raw) as JsonValue;
    } catch {
        return EXIT_ALLOW;
    }
    return processEnvelope(envelope, options.consumer_root);
}

export function _resolveRoot(envelope: JsonValue): string {
    if (isObject(envelope)) {
        const cwd = envelope['cwd'];
        if (typeof cwd === 'string' && cwd) return cwd;
        const pr = envelope['workspace_root'] ?? envelope['project_root'];
        if (typeof pr === 'string' && pr) return pr;
    }
    return process.cwd();
}

export function main(): number {
    const raw = readHookStdin();
    let envelope: JsonValue = {};
    try {
        envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
    } catch {
        return EXIT_ALLOW;
    }
    return processEnvelope(envelope, _resolveRoot(envelope));
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main());
