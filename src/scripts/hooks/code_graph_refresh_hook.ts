#!/usr/bin/env tsx
/**
 * Session-start code-graph refresh — the consumer-side freshness carrier.
 *
 * WHY THIS EXISTS. The git-hook refresh block lives in `install-hooks.sh`,
 * which only this package's own `prepare` script runs. A consumer project gets
 * no git hook, so its graph and `agents/map/` stayed at whatever commit the
 * developer last built them on, and `code-graph-context` could only report
 * `behind:N`. This concern closes that at the one moment every agent session
 * shares: its start. It does not write into the consumer's `.git/hooks` — that
 * would collide with husky, lefthook and `core.hooksPath` (council, 2026-10-23,
 * two of two seats).
 *
 * WHAT IT DOES. It spawns a detached
 * `agent-config code-graph refresh --single-flight --map` and returns. The
 * child rebuilds only when the cache is not fresh, discards a result built
 * while HEAD moved, and redraws the map only for a project that has one.
 * Freshness is eventual: the session's first graph read may still see the old
 * cache, and `code-graph-context` keeps saying so.
 *
 * WHEN IT DOES NOTHING — the conditions a ratification round of 2026-10-23
 * (two of two seats, refused the first cut) made load-bearing:
 *   · the project never ran `code-graph auto-refresh on`. An existing cache is
 *     not consent: a repository can commit one.
 *   · the opt-in marker or the cache is TRACKED by git. Both live under the
 *     gitignored runtime dir; a tracked copy came from the repository, not
 *     from this developer.
 *   · no `agent-config` on PATH that resolves OUTSIDE the repository, or one
 *     too old to know `refresh --single-flight` (`refresh_cli.ts`).
 *   · a live refresh holds the lock, the host is Windows (the CLI shim is a
 *     `.cmd` that needs a shell), replay mode, or the kill switch
 *     `AGENT_CONFIG_CODE_GRAPH_REFRESH=off`.
 *
 * Silent and exit 0 on every path — but never invisible: every outcome from the
 * opt-in check onward is recorded in `code-graph-refresh.last.json`, which
 * `code-graph auto-refresh status` prints.
 */
import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
import { usableCli } from '../code_graph/refresh_cli.js';
import { AUTO_REFRESH_REL, LOCK_REL, isStale, recordRefresh } from '../code_graph/refresh_lock.js';
import { EXIT_ALLOW } from './exit_codes.js';
import { readHookStdin } from './hook_stdin.js';
import { is_replay_mode } from './state_io.js';

export const CACHE_REL = path.join('agents', 'runtime', 'state', 'code-graph-v1.json');
export const REFRESH_ARGS = ['code-graph', 'refresh', '--single-flight', '--map', '--budget-seconds', '60'];

export type RefreshOutcome =
    | 'disabled'
    | 'unsupported'
    | 'replay'
    | 'not-opted-in'
    | 'no-cache'
    | 'tracked'
    | 'locked'
    | 'no-cli'
    | 'cli-too-old'
    | 'spawned';

export { resolveCli } from '../code_graph/refresh_cli.js';

/**
 * The nearest ancestor of `start`'s realpath holding `.git` (a dir, or a
 * worktree's file). Only ENOENT walks upward: a `.git` that cannot be
 * inspected ends the search, so an unreadable inner repository is never
 * skipped in favour of an outer one.
 */
export function repoRoot(start: string): string | null {
    let dir: string;
    try {
        dir = fs.realpathSync(start);
    } catch {
        return null;
    }
    for (;;) {
        try {
            fs.lstatSync(path.join(dir, '.git'));
            return dir;
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return null;
        }
        const up = path.dirname(dir);
        if (up === dir) return null;
        dir = up;
    }
}

/** True when git tracks any of `rels` under `root` (or git cannot answer). */
function anyTracked(root: string, rels: readonly string[]): boolean {
    try {
        const out = execFileSync('git', ['-C', root, 'ls-files', '--', ...rels], {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
            env: hardenedSpawnEnv(),
        });
        return out.trim() !== '';
    } catch {
        return true;
    }
}

export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn): RefreshOutcome {
    if (process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'] === 'off') return 'disabled';
    if (process.platform === 'win32') return 'unsupported';
    if (is_replay_mode()) return 'replay';
    const root = repoRoot(cwd);
    if (root === null || !fs.existsSync(path.join(root, AUTO_REFRESH_REL))) return 'not-opted-in';
    // A repository-committed opt-in is refused before anything is written into the tree.
    if (anyTracked(root, [AUTO_REFRESH_REL, CACHE_REL])) return 'tracked';
    const done = (outcome: RefreshOutcome, detail?: string): RefreshOutcome => {
        recordRefresh(root, { by: 'session-start', outcome, detail });
        return outcome;
    };
    if (!fs.existsSync(path.join(root, CACHE_REL))) return done('no-cache');
    const lock = path.join(root, LOCK_REL);
    if (fs.existsSync(lock) && !isStale(lock)) return done('locked');
    const verdict = usableCli(root);
    if ('reason' in verdict) return done(verdict.reason, (verdict as { cli?: string }).cli);
    const child = spawnFn(verdict.cli, [...REFRESH_ARGS, '--root', root], {
        cwd: root,
        detached: true,
        stdio: 'ignore',
        env: hardenedSpawnEnv(),
    });
    child.on('error', () => {});
    child.unref();
    return done('spawned', verdict.cli);
}

export function main(): number {
    try {
        const raw = readHookStdin();
        const envelope = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {};
        const cwd = typeof envelope['cwd'] === 'string' && envelope['cwd'] ? envelope['cwd'] : process.cwd();
        refreshFor(cwd);
    } catch {
        /* a freshness side job never breaks a session start */
    }
    return EXIT_ALLOW;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (isCliEntry()) process.exit(main());
