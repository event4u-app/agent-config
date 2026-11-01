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
 * a map 20 commits behind). On `stop` it costs one `git rev-parse HEAD` and one
 * exclusive file create: a claim named for the HEAD (or `none` before the first
 * commit) and the current `THROTTLE_MS` window is created with `O_EXCL` right
 * before the spawn. Exactly one dispatch wins a (HEAD, window) pair; every other
 * gets `fresh` — so at most one launch per HEAD and fixed window, and two may
 * fall either side of a window boundary. There is no lock to take over, nothing
 * to release and no record another process could overwrite (ratification rounds
 * 1-6, 2026-11-01). Claims live in one folder per UTC day; only day folders
 * two or more days old are swept, while admission refuses windows older than two
 * (a clock read at claim time), so deletion trails admission by more than a day.
 * The exactly-once property holds unless a dispatch pauses, or clocks disagree,
 * by more than a day; then a duplicate launch is absorbed by the single-flight
 * refresh lock. A failed launch keeps its claim and the pair retries in the next
 * window.
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
const DAY_MS = 24 * 60 * 60 * 1000;
/** Day folders this many days older than today are swept; admission refuses windows older than two. */
export const SWEEP_AFTER_DAYS = 2;

/**
 * The claim for one (HEAD, window) pair, inside the folder of the UTC day its
 * window starts on; its path is the whole protocol.
 */
export function claimPath(buildDir: string, head: string | null, now: number): string {
    const w = Math.floor(now / THROTTLE_MS);
    return path.join(buildDir, 'claims', String(Math.floor((w * THROTTLE_MS) / DAY_MS)), `${head ?? 'none'}-${w}`);
}

/** The window a claim path names, or null for a path that is not a claim. */
function windowOf(file: string): number | null {
    const m = /-(\d+)$/.exec(path.basename(file));
    return m ? Number(m[1]) : null;
}

/**
 * Deletes whole day folders at least SWEEP_AFTER_DAYS older than `today`. The
 * deletion horizon sits a day behind the admission horizon (two windows), so a
 * claim can only be deleted after no dispatch can claim its window any more —
 * unless a dispatch pauses, or clocks disagree, by more than a day. In that case
 * a second launch for the pair is possible and the single-flight refresh lock
 * absorbs it: the second refresh backs off.
 */
function sweepSpent(claimsDir: string, today: number): void {
    try {
        if (!isRealDir(claimsDir)) return;
        for (const d of fs.readdirSync(claimsDir)) {
            const full = path.join(claimsDir, d);
            // Only a real directory is removed recursively: a symlink here could point anywhere.
            if (/^\d+$/.test(d) && Number(d) <= today - SWEEP_AFTER_DAYS && isRealDir(full)) fs.rmSync(full, { recursive: true, force: true });
        }
    } catch {
        /* a spent day folder only costs disk entries */
    }
}

/** True for a directory that is not a symlink (lstat never follows the last component). */
function isRealDir(p: string): boolean {
    try {
        const st = fs.lstatSync(p);
        return st.isDirectory() && !st.isSymbolicLink();
    } catch {
        return false;
    }
}

/**
 * Whether every component from `root` down to `dir` that exists is a real
 * directory (lstat, never followed). A symlinked `agents/`, `agents/map/`,
 * `.build/`, `claims/` or day folder — or a file planted at one — would let a
 * write or a recursive delete land outside the checkout.
 */
export function containedPath(root: string, dir: string): boolean {
    const rel = path.relative(root, dir);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false;
    let at = root;
    for (const part of rel.split(path.sep)) {
        at = path.join(at, part);
        try {
            fs.lstatSync(at);
        } catch {
            return true; // the rest does not exist yet and will be created as real directories
        }
        if (!isRealDir(at)) return false;
    }
    return true;
}

/**
 * Creates the claim exclusively: `won`, `taken` (another dispatch holds this
 * pair, or its window is past admission by a clock read at claim time) or
 * `failed`.
 */
function claim(root: string, file: string, clock: () => number): 'won' | 'taken' | 'failed' {
    const at = clock();
    const w = windowOf(file);
    if (w !== null && w <= Math.floor(at / THROTTLE_MS) - 2) return 'taken';
    const day = path.dirname(file);
    const claims = path.dirname(day);
    // Claims are created and swept only inside real directories from the root down, never through a symlink.
    if (!containedPath(root, day)) return 'failed';
    try {
        fs.mkdirSync(day, { recursive: true });
        if (!containedPath(root, day) || !isRealDir(day)) return 'failed';
        fs.writeFileSync(file, '', { flag: 'wx' });
    } catch (e) {
        return (e as NodeJS.ErrnoException).code === 'EEXIST' ? 'taken' : 'failed';
    }
    sweepSpent(claims, Math.floor(at / DAY_MS));
    return 'won';
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

/** `beforeClaim` runs right before the claim is created and `clock` is read there; tests use both to interleave and pause a dispatch. */
export function refreshFor(cwd: string, spawnFn: typeof spawn = spawn, now: number = Date.now(), slot?: string, beforeClaim?: () => void, clock: () => number = Date.now): RefreshOutcome {
    if (process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'] === 'off') return 'disabled';
    if (process.platform === 'win32') return 'unsupported';
    if (is_replay_mode()) return 'replay';
    const root = repoRoot(cwd);
    // `auto-refresh on` refuses a root without a project home (ADR-299).
    if (root === null || !hasProjectHome(root)) return 'not-opted-in';
    const home = projectBuildPaths(root);
    // The opt-out wins over a marker a concurrent `build` may have written beside it.
    if (!fs.existsSync(home.autoRefreshPath) || fs.existsSync(home.autoRefreshOffPath)) return 'not-opted-in';
    // A claimed pair returns before the tracked-file probe: the common turn end costs one git call.
    const head = headOf(root);
    const file = claimPath(home.buildDir, head, now);
    if (fs.existsSync(file)) return 'fresh';
    // A repository-committed opt-in is refused before anything is written into the tree.
    if (anyTracked(root, [home.autoRefreshPath, home.cachePath, path.join(home.buildDir, 'claims')].map((p) => path.relative(root, p)))) return 'tracked';
    const done = (outcome: RefreshOutcome, detail?: string): RefreshOutcome => {
        recordRefreshIn(home.buildDir, { by: 'session-start', outcome, detail, slot, ...(head !== null ? { head } : {}) }, now);
        return outcome;
    };
    if (!fs.existsSync(home.cachePath)) return done('no-cache');
    const lock = home.lockPath;
    if (fs.existsSync(lock) && !isStale(lock)) return done('locked');
    const verdict = usableCli(root);
    if ('reason' in verdict) return done(verdict.reason, (verdict as { cli?: string }).cli);
    beforeClaim?.();
    const won = claim(root, file, clock);
    if (won === 'taken') return 'fresh';
    if (won === 'failed') return 'record-failed';
    const child = spawnFn(verdict.cli, [...REFRESH_ARGS, '--root', root], {
        cwd: root,
        detached: true,
        stdio: 'ignore',
        env: hardenedSpawnEnv(),
    });
    // A failed launch keeps its claim: the pair retries in the next window, and no path is ever deleted by its name.
    child.on('error', () => {});
    child.unref();
    return done('spawned', verdict.cli);
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
