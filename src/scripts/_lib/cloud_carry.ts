/**
 * Cloud carry — the agent-config hook matrix in a repository's committed
 * `.claude/settings.json`, live only in a Claude Code cloud session
 * (road-to-host-inputs-the-installer-honours Phase 5.3, owner decision of
 * 2026-11-02, variant B).
 *
 * A cloud session reads repo `.claude/settings.json` hooks (single-repository
 * sessions) but never `~/.claude/settings.json`, where the global install
 * registers them (code.claude.com/docs `cloud-environments`, read 2026-11-02).
 * Carrying the matrix is opt-in — `agent-config doctor --repair cloud-reach`
 * writes it, the consumer commits it.
 *
 * Three properties, each pinned by `tests/scripts/cloud_carry.test.ts`:
 *
 * - Local no-op. Every carried command starts with {@link CLOUD_ONLY}, so beside
 *   a global install it exits 0 silently and nothing fires twice. This does not
 *   rely on a host dedupe of identical command strings, which is unverified.
 * - Same trust boundary. The command body is the global one byte for byte: the
 *   dispatcher resolves only from the staged runtime or an absolute
 *   `agent-config` outside `$CLAUDE_PROJECT_DIR`, and PreToolUse refuses with no
 *   dispatcher. A cloned repository still cannot supply its own dispatcher.
 * - One bootstrap, pinned. SessionStart installs the exact version that wrote
 *   the file, `--ignore-scripts`, only when no trusted dispatcher is present. A
 *   failed install is said in the session context and on stderr — under network
 *   level `None` every tool call is then refused, which is the loud outcome the
 *   opt-in buys instead of guards that are silently absent.
 */
import * as path from 'node:path';

import * as hooks from './claude_settings_hooks.js';

export const CLOUD_ONLY = '[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0; ';

/** Single-quoted shell literal: no `'`, no `;` (commandHead splits on the last `;`). */
export const CLOUD_BOOTSTRAP_FAILED =
    'agent-config: cloud session bootstrap could not install @event4u/agent-config from npm, ' +
    'so its hooks and fail_closed guards cannot run and tool calls are refused. ' +
    'Set the environment network access to Trusted, or remove the carried hooks from .claude/settings.json';

/** SessionStart may need an npm install; the host default of 60 s is too short for that. */
export const BOOTSTRAP_TIMEOUT_S = 300;

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function bootstrap(version: string): string {
    return (
        'B=$(command -v agent-config); [ "${B#/}" = "$B" ] && B=""; ' +
        '[ -n "$CLAUDE_PROJECT_DIR" ] && [ "${B#"$CLAUDE_PROJECT_DIR"/}" != "$B" ] && B=""; ' +
        '[ -n "$B" ] || [ -f "${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime/current/dist/hooks/dispatch.js" ] || ' +
        `npm i -g --ignore-scripts --no-audit --no-fund @event4u/agent-config@${version} >/dev/null 2>&1 || ` +
        `{ echo '${CLOUD_BOOTSTRAP_FAILED}'; echo '${CLOUD_BOOTSTRAP_FAILED}' >&2; }; `
    );
}

/**
 * The global matrix, gated on CLAUDE_CODE_REMOTE, SessionStart with the
 * bootstrap. Built without a host version: the cloud host's version is not
 * knowable here, so version-gated events are left out rather than guessed.
 */
export function carriedMatrix(manifestPath: string, version: string): hooks.ClaudeHookMatrix {
    if (!SEMVER.test(version)) {
        throw new Error(`cloud carry: refusing to pin version ${JSON.stringify(version)} — not plain semver`);
    }
    const out: hooks.ClaudeHookMatrix = {};
    for (const [native, command] of Object.entries(hooks.build_claude_hook_matrix(manifestPath, { hostVersion: null }))) {
        out[native] = CLOUD_ONLY + (native === 'SessionStart' ? bootstrap(version) : '') + command;
    }
    return out;
}

/** Write the carried matrix into `<projectRoot>/.claude/settings.json`; user entries stay untouched. */
export function carryIntoRepo(projectRoot: string, manifestPath: string, version: string): hooks.EnsureResult {
    return hooks.ensure_managed_hooks(
        path.join(projectRoot, '.claude', 'settings.json'),
        carriedMatrix(manifestPath, version),
        Object.keys(hooks.min_host_versions(manifestPath)),
        { SessionStart: BOOTSTRAP_TIMEOUT_S },
    );
}

export interface RepairResult {
    code: 0 | 2;
    payload: Record<string, unknown>;
    lines: string[];
}

/**
 * `agent-config doctor --repair cloud-reach`: write the carried matrix, pinned
 * to the running package version. Writes one file and commits nothing — the
 * consumer reviews and commits it.
 */
export function repairCloudReach(projectRoot: string, packageRoot: string, version: string | null): RepairResult {
    const target = path.join(projectRoot, '.claude', 'settings.json');
    const payload: Record<string, unknown> = { id: 'cloud-reach', path: target };
    try {
        if (version === null) throw new Error('package version unreadable');
        const res = carryIntoRepo(projectRoot, path.join(packageRoot, 'src', 'scripts', 'hook_manifest.yaml'), version);
        Object.assign(payload, { action: res.changed ? 'carried' : 'noop', version, events: res.events });
    } catch (exc) {
        const error = exc instanceof Error ? exc.message : String(exc);
        Object.assign(payload, { action: 'error', error });
        return { code: 2, payload, lines: [`❌  doctor: could not carry hooks into ${target}: ${error}`] };
    }
    if (payload['action'] === 'noop') {
        return { code: 0, payload, lines: [`✅  doctor: nothing to repair (${target} already carries the hook matrix for ${version})`] };
    }
    return {
        code: 0,
        payload,
        lines: [
            `✅  doctor: carried the hook matrix (pinned ${version}) into ${target}`,
            '    It runs only when CLAUDE_CODE_REMOTE=true. Review and commit the file to reach cloud sessions.',
        ],
    };
}
