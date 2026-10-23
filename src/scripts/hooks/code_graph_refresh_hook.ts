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
 * WHAT IT DOES. If a graph cache already exists and no refresh holds the lock,
 * it spawns a detached `agent-config code-graph refresh --single-flight --map`
 * and returns. The child rebuilds only when the cache is not fresh, discards a
 * result built while HEAD moved, and redraws the map only for a project that
 * already has one. Freshness is eventual: the session's first graph read may
 * still see the old cache, and `code-graph-context` keeps saying so.
 *
 * NEVER BUILDS UNBIDDEN, same rule as the git hooks: no cache, no spawn.
 * Silent and exit 0 on every path. POSIX only — on Windows the CLI shim is a
 * `.cmd`, which needs a shell to spawn, so this concern does nothing there.
 * Kill switch: `AGENT_CONFIG_CODE_GRAPH_REFRESH=off`.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
import { LOCK_REL, isStale } from '../code_graph/refresh_lock.js';
import { EXIT_ALLOW } from './exit_codes.js';
import { readHookStdin } from './hook_stdin.js';
import { is_replay_mode } from './state_io.js';

export const CACHE_REL = path.join('agents', 'runtime', 'state', 'code-graph-v1.json');
export const REFRESH_ARGS = ['code-graph', 'refresh', '--single-flight', '--map', '--budget-seconds', '60'];

export type RefreshOutcome = 'disabled' | 'unsupported' | 'replay' | 'no-cache' | 'locked' | 'no-cli' | 'spawned';

/** The nearest ancestor of `start` holding `.git` (a dir, or a worktree's file). */
export function repoRoot(start: string): string | null {
    let dir = path.resolve(start);
    for (;;) {
        if (fs.existsSync(path.join(dir, '.git'))) return dir;
        const up = path.dirname(dir);
        if (up === dir) return null;
        dir = up;
    }
}

function executable(p: string): boolean {
    try {
        fs.accessSync(p, fs.constants.X_OK);
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** The project's own CLI first, then its local install, then PATH. */
export function resolveCli(root: string, envPath: string = process.env['PATH'] ?? ''): string | null {
    const local = [path.join(root, 'agent-config'), path.join(root, 'node_modules', '.bin', 'agent-config')];
    const onPath = envPath.split(path.delimiter).filter(Boolean).map((d) => path.join(d, 'agent-config'));
    return [...local, ...onPath].find(executable) ?? null;
}

export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn): RefreshOutcome {
    if (process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'] === 'off') return 'disabled';
    if (process.platform === 'win32') return 'unsupported';
    if (is_replay_mode()) return 'replay';
    const root = repoRoot(cwd);
    if (root === null || !fs.existsSync(path.join(root, CACHE_REL))) return 'no-cache';
    const lock = path.join(root, LOCK_REL);
    if (fs.existsSync(lock) && !isStale(lock)) return 'locked';
    const cli = resolveCli(root);
    if (cli === null) return 'no-cli';
    const child = spawnFn(cli, [...REFRESH_ARGS, '--root', root], {
        cwd: root,
        detached: true,
        stdio: 'ignore',
        env: hardenedSpawnEnv(),
    });
    child.on('error', () => {});
    child.unref();
    return 'spawned';
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
