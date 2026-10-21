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

// Bundle note: a static import of the CJS `yaml` package requires the
// createRequire banner in `build:install-bundle` (package.json) — without it
// the esbuild ESM bundle throws `Dynamic require of "process" is not
// supported` at module init. A bare lazy `require('yaml')` is NOT an
// alternative: it is a ReferenceError under plain tsx/node ESM (CI).
function _yaml_parse(text: string): unknown {
    return YAML.parse(text);
}

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
    const manifest = (_yaml_parse(raw) ?? {}) as Record<string, unknown>;
    const hook_spec = (manifest['schema_version'] as unknown) ?? 1;
    const platforms = (manifest['platforms'] ?? {}) as Record<string, unknown>;
    const claude_events = ((platforms['claude'] ?? {}) as Record<string, unknown>) || {};
    const aliasesAll = (manifest['native_event_aliases'] ?? {}) as Record<string, unknown>;
    const aliases = ((aliasesAll['claude'] ?? {}) as Record<string, unknown>) || {};

    // Iterating the ALIAS map, not the event map, because the relation is
    // many-natives-to-one-event and the inversion this replaced silently lost
    // every native but the last. `PostToolUse` and `PostToolUseFailure` both
    // lower to `post_tool_use`; building `ac_to_native` would have kept one of
    // them and UNBOUND the other, turning a routing fix into a routing
    // regression that no existing test could see. Pinned by
    // `before_complete_failure_envelope.test.ts` ("both natives stay bound").
    const matrix: ClaudeHookMatrix = {};
    for (const [native, ac_raw] of Object.entries(aliases)) {
        const ac_event = String(ac_raw);
        const concerns = claude_events[ac_event];
        if (!concerns || (Array.isArray(concerns) && concerns.length === 0)) continue;
        // Only package-owned dispatchers are trusted (17.0.0 finding
        // feaebdef733b, owner decision of 2026-10-21): the staged runtime,
        // then an `agent-config` on PATH whose resolved path is absolute and
        // outside the opened project. Nothing inside $CLAUDE_PROJECT_DIR runs
        // — not a project npm install, not a source checkout's dist/, not a
        // local wrapper — because a cloned repository can commit any of them
        // and would then run as the user's global hook, ahead of the guards.
        // `exec` replaces the shell; stdin and exit codes flow through, so a
        // fail_closed concern still denies.
        //
        // With no dispatcher, PreToolUse refuses (exit 2) on the settings
        // carrier (finding bb6ab0f5f37d): every fail_closed guard would
        // otherwise pass silently, which an upgrade swap was measured doing
        // 487 times in 4,190 invocations. The plugin carrier keeps the warning
        // and exit 0 — a plugin-only install has no package to enforce with,
        // and the session-start context line names the guards that are off
        // (council 2026-10-21). Every other event stays exit 0.
        // NOTE: the CLI fallback carries MANAGED_SIGNATURE — keep it, or
        // previously installed managed entries orphan on refresh.
        const dispatchArgs =
            `--platform claude --event ${ac_event} --native-event ${native} ` +
            `--project-dir "$CLAUDE_PROJECT_DIR" --min-version ${String(hook_spec)}`;
        matrix[native] =
            'R="${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; ' +
            '[ -f "$S/node" ] && read -r N < "$S/node"; ' +
            'if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then ' +
            `exec "$N" "$S/dist/hooks/dispatch.js" ${dispatchArgs}; fi; ` +
            'BIN=$(command -v agent-config 2>/dev/null); [ "${BIN#/}" = "$BIN" ] && BIN=""; ' +
            '[ -n "$CLAUDE_PROJECT_DIR" ] && [ "${BIN#"$CLAUDE_PROJECT_DIR"/}" != "$BIN" ] && BIN=""; ' +
            `[ -n "$BIN" ] || { ${_no_dispatcher_notice(native)}${_thinned_dead_carrier(native)}${_no_dispatcher_exit(native)} }; ` +
            `"$BIN" dispatch:hook ${dispatchArgs}`;
    }
    return matrix;
}

export const NO_DISPATCHER_STDERR =
    'agent-config: no hook dispatcher reachable, so no agent-config hook runs in this session. ' +
    'Hooks need the npm package where they can reach it: npm i -g @event4u/agent-config ' +
    '(then npx -y @event4u/agent-config init)';

export const NO_DISPATCHER_CONTEXT =
    'agent-config hooks are NOT running in this session: the plugin found no dispatcher, so no ' +
    'concern runs, the fail_closed guards block-no-verify, block-kernel-rule-writes and ' +
    'block-plumbing-writes included.';

/**
 * The no-dispatcher branch, keyed on CLAUDE_PLUGIN_ROOT — set by the host for
 * a plugin's hooks only (road-to-a-hook-carrier-that-is-never-silent 5.1, D5).
 * The settings carrier runs the byte-same string, which the host's dedupe
 * needs, and stays silent there: that carrier's branch belongs to Phase 3.
 * One stderr line per event (exit 0, never blocking); the context line goes to
 * stdout on SessionStart only, so a tool call is never followed by context.
 * Both texts are single-quoted shell literals: no `'`, and no `;` either,
 * because commandHead() splits on the last `;`.
 */
function _no_dispatcher_notice(native: string): string {
    const context = native === 'SessionStart' ? ` echo '${NO_DISPATCHER_CONTEXT}';` : '';
    return `[ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo '${NO_DISPATCHER_STDERR}' >&2;${context} }; `;
}

export const NO_DISPATCHER_REFUSAL =
    'agent-config: no hook dispatcher reachable, so this tool call is refused: the fail_closed guards ' +
    'block-no-verify, block-kernel-rule-writes and block-plumbing-writes cannot run. Repair in a terminal: ' +
    'npm i -g @event4u/agent-config then npx -y @event4u/agent-config init. To drop the hooks instead: ' +
    'agent-config uninstall, or delete the agent-config entries from ~/.claude/settings.json.';

/**
 * How the no-dispatcher branch ends. PreToolUse on the settings carrier
 * refuses; the plugin carrier and every other event exit 0. Single-quoted
 * literal like the notices: no `'`, no `;`.
 */
function _no_dispatcher_exit(native: string): string {
    if (native !== 'PreToolUse') return 'exit 0;';
    return `[ -z "$CLAUDE_PLUGIN_ROOT" ] && { echo '${NO_DISPATCHER_REFUSAL}' >&2; exit 2; }; exit 0;`;
}

export const THINNED_DEAD_CARRIER_LINE =
    'agent-config: no hook dispatcher was reached and the rule layer on disk is thinned, so routed rule ' +
    'bodies will not arrive in this session. Open a rule body from the absolute Body path in its stub. ' +
    'The full rule layer is restored for the next session.';

/**
 * The dead-carrier branch on a THINNED layer (road-to-a-hook-carrier-that-is-never-silent
 * 3.1, 3.2), SessionStart only and without node. `$R/thinned` exists only while
 * the install left the claude layer thinned and holds that layer's directory; on
 * a full layer the branch is silent, which is what keeps an uninstalled
 * repository quiet. It prints one context line, then restores the staged full
 * layer — overwriting only files that carry the package stamp, adding missing
 * ones, removing none, each by an atomic rename — and demotes the machine. A
 * failed copy leaves the marker, so the line keeps printing rather than the
 * session going quiet on a layer that is still thin. `AC_HOOK_PROBE` is the
 * stripped-environment probe, which must observe and never restore.
 */
function _thinned_dead_carrier(native: string): string {
    if (native !== 'SessionStart') return '';
    return (
        `[ -z "$AC_HOOK_PROBE" ] && [ -f "$R/thinned" ] && { echo '${THINNED_DEAD_CARRIER_LINE}'; ` +
        'L=""; read -r L < "$R/thinned"; F=1; ' +
        'if [ -d "$L" ] && [ -d "$S/claude-rules" ]; then F=0; for f in "$S/claude-rules"/*.md; do ' +
        '[ -f "$f" ] || continue; t="$L/${f##*/}"; ' +
        'if [ ! -e "$t" ] || grep -qx "package: event4u/agent-config" "$t"; then ' +
        'cp "$f" "$t.ac-restore" && mv -f "$t.ac-restore" "$t" || F=1; fi; done; fi; ' +
        '[ "$F" = 0 ] && mv -f "$R/thinned" "$R/demoted"; }; '
    );
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

export function _read_settings(settings_path: string): Record<string, unknown> {
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

export function _with_lock<T>(settings_path: string, fn: () => T): T {
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
