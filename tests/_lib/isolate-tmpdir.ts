/**
 * Give every vitest run its own temp root, and delete it when the run ends.
 *
 * Measured 2026-10-21 on a developer Mac: the per-user `$TMPDIR` had passed
 * 65,535 subdirectories (the APFS link count saturated) and a single `stat()`
 * on it took 7-10 s. Every interactive shell blocked in that `stat()` —
 * powerlevel10k's gitstatus checks `[[ -d $TMPDIR && -w $TMPDIR ]]` at
 * startup — so opening a terminal or starting Claude Code took 9-35 s.
 *
 * Nearly every entry came from this suite: `hermetic-env.ts` is a `setupFiles`
 * entry, which runs once PER TEST FILE, and created an `agent-config-home-*`
 * directory each time; 112 further test files call `mkdtempSync` with no
 * cleanup. Three test files alone left 107 directories behind.
 *
 * One root instead of 112 fixes: patching each `mkdtempSync` site would fix today's leakers and none of
 * tomorrow's. Pointing `TMPDIR` at a run-scoped root makes `os.tmpdir()` in
 * every worker — and in every hook subprocess a test spawns, which inherits the
 * environment — land inside a directory this file owns and removes. A leak in a
 * future test then costs nothing outside the run.
 *
 * `globalSetup` runs once in the main process before any worker is forked, so
 * the workers inherit the variable; a `setupFiles` entry would be too late for
 * modules that captured `os.tmpdir()` at import.
 *
 * A run killed before teardown leaves its root behind. The next run sweeps
 * roots older than `STALE_AFTER_MS`, never younger ones, because a younger root
 * may belong to a run still in progress in another checkout.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Prefix of every run root; the sweep only ever touches names carrying it.
 *
 * Short on purpose: `tsx` opens its IPC pipe at `$TMPDIR/tsx-<uid>/<pid>.pipe`,
 * macOS caps a socket path at 103 bytes, and a macOS `$TMPDIR` is already 49.
 * A long prefix here made every spawned `tsx` fail with `listen EINVAL`.
 */
export const RUN_ROOT_PREFIX = 'ac-vitest-';

/** Set when `setup` declined to isolate, so the wiring test can tell a skip from a missing entry. */
export const ISOLATION_SKIPPED_VAR = 'AGENT_CONFIG_TMP_ISOLATION_SKIPPED';

/** The macOS `sun_path` limit, minus its terminating NUL. */
export const MAX_SOCKET_PATH = 103;

/** A run root this old cannot belong to a live run. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** The variables `os.tmpdir()` consults on POSIX (`TMPDIR`) and Windows (`TEMP`, `TMP`). */
const TMP_VARS = ['TMPDIR', 'TEMP', 'TMP'] as const;

/** Remove run roots under `base` older than `STALE_AFTER_MS`; returns the names removed. */
export function sweepStaleRunRoots(base: string, now: number = Date.now()): string[] {
    const removed: string[] = [];
    let entries: string[];
    try {
        entries = fs.readdirSync(base);
    } catch {
        return removed;
    }
    for (const name of entries) {
        if (!name.startsWith(RUN_ROOT_PREFIX)) {
            continue;
        }
        const full = path.join(base, name);
        try {
            if (now - fs.statSync(full).mtimeMs > STALE_AFTER_MS) {
                fs.rmSync(full, { recursive: true, force: true });
                removed.push(name);
            }
        } catch {
            // Raced with another run's teardown — already gone is the goal.
        }
    }
    return removed;
}

/** Create a fresh run root under `base`. */
export function createRunRoot(base: string): string {
    return fs.mkdtempSync(path.join(base, RUN_ROOT_PREFIX));
}

/** Whether the longest socket a spawned `tsx` opens under `root` stays within the limit. */
export function fitsSocketPath(root: string): boolean {
    const worstCasePipe = path.join(root, 'tsx-4294967295', '4194304.pipe');
    return Buffer.byteLength(worstCasePipe) <= MAX_SOCKET_PATH;
}

export default function setup(): () => void {
    return isolate(fs.realpathSync(os.tmpdir()));
}

/** Point every temp variable at a fresh run root under `base`; the returned teardown undoes it. */
export function isolate(base: string): () => void {
    sweepStaleRunRoots(base);
    const root = createRunRoot(base);
    if (!fitsSocketPath(root)) {
        // Isolating here would break every spawned `tsx`; leaking is the lesser harm.
        fs.rmSync(root, { recursive: true, force: true });
        process.stderr.write(
            `[isolate-tmpdir] ${base} is too long for a run root under the ` +
                `${String(MAX_SOCKET_PATH)}-byte socket limit — running without temp isolation\n`,
        );
        process.env[ISOLATION_SKIPPED_VAR] = '1';
        return () => {
            delete process.env[ISOLATION_SKIPPED_VAR];
        };
    }
    const previous = TMP_VARS.map((name) => [name, process.env[name]] as const);
    for (const name of TMP_VARS) {
        process.env[name] = root;
    }
    return () => {
        for (const [name, value] of previous) {
            if (value === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = value;
            }
        }
        fs.rmSync(root, { recursive: true, force: true });
    };
}
