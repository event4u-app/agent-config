/**
 * Managed Claude Code hook registration in settings.json.
 *
 * road-to-claude-code-single-surface Phase 1: the marketplace plugin used to
 * be the only carrier of the deterministic hook matrix (hooks/hooks.json).
 * This module registers the same matrix directly in a Claude Code settings
 * file (`~/.claude/settings.json` for the global install) so the plugin is
 * no longer required for hooks.
 *
 * Contract (parity findings: agents/settings/contexts/claude-code-hook-parity.md):
 *
 * - The hook schema is identical between plugin hooks.json and settings.json;
 *   Claude Code fires all sources in parallel and dedupes identical command
 *   strings — so a still-installed plugin never double-fires during the
 *   migration window.
 * - Managed entries are identified by the dispatch signature inside the
 *   command string (MANAGED_SIGNATURE). No extra marker field is written —
 *   content-derived identity keeps the entry byte-identical to the plugin's,
 *   which is what makes the dedup guarantee hold.
 * - User-owned entries (anything without the signature) are never touched,
 *   reordered, or removed. Managed entries are replaced in place per event.
 * - Writes are atomic (temp file + rename via atomicWriteFile) and guarded
 *   by a sidecar lockfile so two concurrent installers cannot tear the file.
 * - A settings file that exists but does not parse as JSON is NEVER
 *   overwritten — the operation throws CorruptSettingsError and leaves the
 *   file byte-identical (the user's file outranks our convenience).
 *
 * The hook matrix itself derives from src/scripts/hook_manifest.yaml via
 * build_claude_hook_matrix() — the same single source generate_plugin_hooks()
 * (condense.ts) uses for the plugin's hooks/hooks.json.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import * as YAML from 'yaml';

import { atomicWriteFile } from '../../install/atomic.js';

/** Substring that identifies an entry as agent-config-managed. */
export const MANAGED_SIGNATURE = 'dispatch:hook --platform claude';

export class CorruptSettingsError extends Error {
    constructor(file: string, cause: string) {
        super(
            `${file} exists but is not valid JSON (${cause}). ` +
                'Refusing to overwrite a user-owned settings file — fix or remove it, then re-run.',
        );
        this.name = 'CorruptSettingsError';
    }
}

export class SettingsLockError extends Error {
    constructor(lockPath: string) {
        super(
            `settings lock ${lockPath} is held by another process. ` +
                'Re-run when the concurrent install finishes (stale lock: delete the file).',
        );
        this.name = 'SettingsLockError';
    }
}

interface HookCommand {
    type: string;
    command: string;
    [k: string]: unknown;
}

interface HookGroup {
    matcher?: string;
    hooks: HookCommand[];
    [k: string]: unknown;
}

/** native event name → full shell command, e.g. { SessionStart: "BIN=..." }. */
export type ClaudeHookMatrix = Record<string, string>;

/**
 * Derive the Claude hook matrix from hook_manifest.yaml — the SAME source
 * generate_plugin_hooks() uses, so settings-registered hooks and the plugin's
 * hooks.json can never drift from each other.
 */
export function build_claude_hook_matrix(manifest_path: string): ClaudeHookMatrix {
    const raw = fs.readFileSync(manifest_path, 'utf8');
    const manifest = (YAML.parse(raw) ?? {}) as Record<string, unknown>;
    const hook_spec = (manifest['schema_version'] as unknown) ?? 1;
    const platforms = (manifest['platforms'] ?? {}) as Record<string, unknown>;
    const claude_events = ((platforms['claude'] ?? {}) as Record<string, unknown>) || {};
    const aliasesAll = (manifest['native_event_aliases'] ?? {}) as Record<string, unknown>;
    const aliases = ((aliasesAll['claude'] ?? {}) as Record<string, unknown>) || {};

    const ac_to_native: Record<string, string> = {};
    for (const [native, ac] of Object.entries(aliases)) {
        ac_to_native[String(ac)] = native;
    }

    const matrix: ClaudeHookMatrix = {};
    for (const [ac_event, concerns] of Object.entries(claude_events)) {
        if (!concerns || (Array.isArray(concerns) && concerns.length === 0)) continue;
        const native = ac_to_native[ac_event];
        if (native === undefined) continue;
        matrix[native] =
            'BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; ' +
            `"$BIN" dispatch:hook --platform claude --event ${ac_event} ` +
            `--native-event ${native} --project-dir "$CLAUDE_PROJECT_DIR" ` +
            `--min-version ${String(hook_spec)}`;
    }
    return matrix;
}

function _is_managed_group(group: unknown): boolean {
    if (typeof group !== 'object' || group === null || Array.isArray(group)) return false;
    const hooks = (group as HookGroup).hooks;
    if (!Array.isArray(hooks)) return false;
    return hooks.some(
        (h) =>
            typeof h === 'object' &&
            h !== null &&
            typeof (h as HookCommand).command === 'string' &&
            (h as HookCommand).command.includes(MANAGED_SIGNATURE),
    );
}

function _read_settings(settings_path: string): Record<string, unknown> {
    if (!fs.existsSync(settings_path)) return {};
    const raw = fs.readFileSync(settings_path, 'utf8');
    if (raw.trim() === '') return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        throw new CorruptSettingsError(settings_path, (e as Error).message);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new CorruptSettingsError(settings_path, 'top level is not an object');
    }
    return parsed as Record<string, unknown>;
}

function _with_lock<T>(settings_path: string, fn: () => T): T {
    const lockPath = settings_path + '.agent-config.lock';
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    let fd: number;
    try {
        fd = fs.openSync(lockPath, 'wx');
    } catch {
        throw new SettingsLockError(lockPath);
    }
    try {
        return fn();
    } finally {
        fs.closeSync(fd);
        fs.rmSync(lockPath, { force: true });
    }
}

export interface EnsureResult {
    /** true when the file content changed on disk. */
    changed: boolean;
    /** native events whose managed entry was added or replaced. */
    events: string[];
}

/**
 * Idempotently register the managed hook matrix in a Claude settings file.
 * User entries are preserved untouched; managed entries are replaced in
 * place; a second run with the same matrix produces zero diff.
 */
export function ensure_managed_hooks(
    settings_path: string,
    matrix: ClaudeHookMatrix,
): EnsureResult {
    return _with_lock(settings_path, () => {
        const settings = _read_settings(settings_path);
        const before = JSON.stringify(settings);

        const hooks = ((settings['hooks'] ?? {}) as Record<string, unknown>) || {};
        const touched: string[] = [];

        for (const [native, command] of Object.entries(matrix)) {
            const existing = Array.isArray(hooks[native]) ? (hooks[native] as unknown[]) : [];
            const user_groups = existing.filter((g) => !_is_managed_group(g));
            const managed_group: HookGroup = {
                hooks: [{ type: 'command', command }],
            };
            const next = [...user_groups, managed_group];
            if (JSON.stringify(next) !== JSON.stringify(existing)) touched.push(native);
            hooks[native] = next;
        }

        settings['hooks'] = hooks;
        const after = JSON.stringify(settings);
        if (after === before) {
            return { changed: false, events: [] };
        }
        atomicWriteFile(settings_path, JSON.stringify(settings, null, 2) + '\n');
        return { changed: true, events: touched };
    });
}

export interface RemoveResult {
    changed: boolean;
    /** native events a managed entry was removed from. */
    events: string[];
}

/**
 * Remove exactly the managed entries (dispatch-signature match) from a
 * Claude settings file. User entries, other settings keys, and files
 * without managed entries are left byte-identical. Missing file → no-op.
 */
export function remove_managed_hooks(settings_path: string): RemoveResult {
    if (!fs.existsSync(settings_path)) return { changed: false, events: [] };
    return _with_lock(settings_path, () => {
        const settings = _read_settings(settings_path);
        const hooks = settings['hooks'];
        if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) {
            return { changed: false, events: [] };
        }

        const hooksRec = hooks as Record<string, unknown>;
        const touched: string[] = [];
        for (const [native, groups] of Object.entries(hooksRec)) {
            if (!Array.isArray(groups)) continue;
            const kept = groups.filter((g) => !_is_managed_group(g));
            if (kept.length !== groups.length) {
                touched.push(native);
                if (kept.length === 0) {
                    delete hooksRec[native];
                } else {
                    hooksRec[native] = kept;
                }
            }
        }
        if (touched.length === 0) return { changed: false, events: [] };
        if (Object.keys(hooksRec).length === 0) {
            delete settings['hooks'];
        }
        atomicWriteFile(settings_path, JSON.stringify(settings, null, 2) + '\n');
        return { changed: true, events: touched };
    });
}
