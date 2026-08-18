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
} from '../../agent-src/templates/scripts/telemetry/remote.js';
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
 * Active `rule_loading_tier`, read from the same settings file.
 *
 * Deliberately a raw line scan rather than a YAML parse: this runs on the
 * post-tool hot path, the value is a top-level scalar from a closed enum,
 * and `build_class_a_record` rejects anything outside that enum — so a
 * mis-parse produces a dropped field, never a wrong one. Unresolvable
 * reads `null`, which the record carries honestly rather than defaulting
 * to `balanced` and inventing a fact about the install.
 */
export function extractRuleTier(settingsText: string): string | null {
    for (const line of settingsText.split('\n')) {
        const m = /^rule_loading_tier:\s*(\S+)\s*$/u.exec(line);
        if (m && m[1]) {
            const value = m[1].replace(/^["']|["']$/gu, '');
            // The shipped template ships a placeholder until `install` fills
            // it in; that is "not yet resolved", not a tier.
            if (value.startsWith('__')) return null;
            return value;
        }
    }
    return null;
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
}

/**
 * Read + memoise the settings for one process. The in-process dispatcher
 * runs every concern in one `node`, so without this the file would be read
 * once per concern per tool call.
 */
const _settingsCache = new Map<string, SettingsRead>();

export function readSettingsFor(consumerRoot: string): SettingsRead {
    const p = path.join(consumerRoot, SETTINGS_FILENAME);
    const cached = _settingsCache.get(p);
    if (cached !== undefined) return cached;

    let text = '';
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        text = '';
    }
    const read: SettingsRead = { settings: read_remote_settings(p), text };
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

        const { settings, text } = readSettingsFor(consumer_root);
        if (!settings.active) return EXIT_ALLOW;
        if (is_replay_mode()) return EXIT_ALLOW;

        const skill = extractSkillName(payload);
        if (skill === null) return EXIT_ALLOW;

        const record = build_class_a_record({
            skill,
            host: extractHost(envelope) ?? 'unknown',
            org_id: settings.org_id,
            salt: settings.salt,
            hostname: os.hostname(),
            username: os.userInfo().username,
            session_id: extractSessionId(envelope, payload),
            package_version: extractPackageVersion(process.env),
            rule_tier: extractRuleTier(text),
        });

        const logPath = path.isAbsolute(settings.log_path)
            ? settings.log_path
            : path.join(consumer_root, settings.log_path);
        append_class_a_record(logPath, record);
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

function _resolveRoot(envelope: JsonValue): string {
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
