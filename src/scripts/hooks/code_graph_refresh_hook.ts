#!/usr/bin/env tsx
/**
 * Session-start and turn-end code-graph refresh — the consumer-side freshness carrier.
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
 * WHY IT ALSO RUNS AT TURN END. Bound on `session_start` alone, a long session
 * that commits twenty times keeps the map it started with (measured 2026-11-01:
 * a map 20 commits behind). On `stop` it costs one `git rev-parse HEAD`: while
 * HEAD equals the one the last spawn recorded and that spawn is under
 * `THROTTLE_MS` old, it returns `fresh` without spawning or recording — the
 * record it compared against is the one it must keep. Without a HEAD (no commit
 * yet) the window alone throttles. The spawn record is written BEFORE the spawn,
 * and a record that cannot be written means no spawn (`record-failed`), so no
 * path admits a spawn per turn (ratification round 1, 2026-11-01, both seats).
 * Reading and writing that record happen under a short admission mutex, so two
 * concurrent dispatches cannot both pass the throttle, and a child whose launch
 * fails withdraws its own claim (round 2).
 *
 * WHEN IT DOES NOTHING — the conditions a ratification round of 2026-10-23
 * (two of two seats, refused the first cut) made load-bearing:
 *   · no opt-in marker. `code-graph auto-refresh on` writes one, and so does a
 *     local `code-graph build` or `map` unless `auto-refresh off` left an
 *     opt-out. An existing cache alone is not consent: a repository can commit one.
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
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
import { usableCli } from '../code_graph/refresh_cli.js';
import { hasProjectHome, projectBuildPaths } from '../code_graph/graph_home.js';
import { isStale, recordRefreshIn } from '../code_graph/refresh_lock.js';
import { EXIT_ALLOW } from './exit_codes.js';
import { readHookStdin } from './hook_stdin.js';
import { is_replay_mode } from './state_io.js';

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
    | 'fresh'
    | 'record-failed'
    | 'spawned';

/** How long a spawn for one HEAD covers later turn ends; a session start after it re-checks. */
export const THROTTLE_MS = 10 * 60 * 1000;
/** An admission mutex older than this was left by a crashed dispatch and may be taken over. */
export const ADMISSION_STALE_MS = 30 * 1000;

const RECORD = 'code-graph-refresh.session-start.json';

/** Takes the admission mutex (an atomic mkdir); null when another dispatch holds it. */
function admit(buildDir: string, now: number): (() => void) | null {
    const dir = path.join(buildDir, 'code-graph-refresh.admission');
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            fs.mkdirSync(buildDir, { recursive: true });
            fs.mkdirSync(dir);
            return () => fs.rmSync(dir, { recursive: true, force: true });
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'EEXIST') return null;
            try {
                if (now - fs.statSync(dir).mtimeMs < ADMISSION_STALE_MS) return null;
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {
                return null;
            }
        }
    }
    return null;
}

/** Withdraws the spawn claim `nonce` made, unless a newer claim replaced it. */
function withdraw(buildDir: string, nonce: string): void {
    try {
        const file = path.join(buildDir, RECORD);
        const rec = JSON.parse(fs.readFileSync(file, 'utf-8')) as { nonce?: string };
        if (rec.nonce === nonce) fs.writeFileSync(file, JSON.stringify({ ...rec, outcome: 'spawn-error' }));
    } catch {
        /* nothing to withdraw */
    }
}

/** `session_start` / `stop` from either invocation shape, or undefined. */
export function slotOf(envelope: Record<string, unknown>): string | undefined {
    const payload = (typeof envelope['payload'] === 'object' && envelope['payload'] !== null ? envelope['payload'] : {}) as Record<string, unknown>;
    for (const v of [envelope['event'], envelope['native_event'], envelope['hook_event_name'], payload['hook_event_name']]) {
        if (typeof v !== 'string' || v === '') continue;
        const raw = v.toLowerCase();
        return raw === 'sessionstart' ? 'session_start' : raw;
    }
    return undefined;
}

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

/** HEAD of `root`, or null when git cannot say (no commit yet, not a work tree). */
function headOf(root: string): string | null {
    try {
        return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], env: hardenedSpawnEnv() }).trim() || null;
    } catch {
        return null;
    }
}

/**
 * Whether the last spawn already covers `head` (null: no commit yet, matched by a
 * record without one). A record dated in the future — a clock set back — never covers.
 */
function coveredBy(buildDir: string, head: string | null, now: number): boolean {
    try {
        const rec = JSON.parse(fs.readFileSync(path.join(buildDir, RECORD), 'utf-8')) as { outcome?: string; head?: string; at?: string };
        const age = now - Date.parse(rec.at ?? '');
        return rec.outcome === 'spawned' && (rec.head ?? null) === head && Number.isFinite(age) && age >= 0 && age < THROTTLE_MS;
    } catch {
        return false;
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

/** `beforeClaim` runs between the throttle check and the claim — the window the admission mutex closes; tests use it. */
export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn, now: number = Date.now(), slot?: string, beforeClaim?: () => void): RefreshOutcome {
    if (process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'] === 'off') return 'disabled';
    if (process.platform === 'win32') return 'unsupported';
    if (is_replay_mode()) return 'replay';
    const root = repoRoot(cwd);
    // `auto-refresh on` refuses a root without a project home (ADR-299).
    if (root === null || !hasProjectHome(root)) return 'not-opted-in';
    const home = projectBuildPaths(root);
    // The opt-out wins over a marker a concurrent `build` may have written beside it.
    if (!fs.existsSync(home.autoRefreshPath) || fs.existsSync(home.autoRefreshOffPath)) return 'not-opted-in';
    // A repository-committed opt-in is refused before anything is written into the tree.
    if (anyTracked(root, [home.autoRefreshPath, home.cachePath].map((p) => path.relative(root, p)))) return 'tracked';
    const head = headOf(root);
    if (coveredBy(home.buildDir, head, now)) return 'fresh';
    const release = admit(home.buildDir, now);
    if (release === null) return 'locked';
    try {
        return admitted(root, home, head, now, slot, spawnFn, beforeClaim);
    } finally {
        release();
    }
}

function admitted(
    root: string,
    home: ReturnType<typeof projectBuildPaths>,
    head: string | null,
    now: number,
    slot: string | undefined,
    spawnFn: typeof spawn,
    beforeClaim: (() => void) | undefined,
): RefreshOutcome {
    // Re-read under the mutex: a dispatch that held it may have just claimed this HEAD.
    if (coveredBy(home.buildDir, head, now)) return 'fresh';
    const done = (outcome: RefreshOutcome, detail?: string): RefreshOutcome => {
        recordRefreshIn(home.buildDir, { by: 'session-start', outcome, detail, slot }, now);
        return outcome;
    };
    if (!fs.existsSync(home.cachePath)) return done('no-cache');
    const lock = home.lockPath;
    if (fs.existsSync(lock) && !isStale(lock)) return done('locked');
    const verdict = usableCli(root);
    if ('reason' in verdict) return done(verdict.reason, (verdict as { cli?: string }).cli);
    beforeClaim?.();
    const nonce = randomBytes(8).toString('hex');
    if (!recordRefreshIn(home.buildDir, { by: 'session-start', outcome: 'spawned', detail: verdict.cli, slot, nonce, ...(head !== null ? { head } : {}) }, now)) return 'record-failed';
    const child = spawnFn(verdict.cli, [...REFRESH_ARGS, '--root', root], {
        cwd: root,
        detached: true,
        stdio: 'ignore',
        env: hardenedSpawnEnv(),
    });
    child.on('error', () => withdraw(home.buildDir, nonce));
    child.unref();
    return 'spawned';
}

export function main(): number {
    try {
        const raw = readHookStdin();
        const envelope = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {};
        const cwd = typeof envelope['cwd'] === 'string' && envelope['cwd'] ? envelope['cwd'] : process.cwd();
        refreshFor(cwd, spawn, Date.now(), slotOf(envelope));
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
