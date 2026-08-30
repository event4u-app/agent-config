// The five lifecycle properties, on REAL processes.
//
// `road-to-supervised-telemetry-collector` step 5.1 (AC-8). The step's whole
// argument is that mocks cannot establish orphan behaviour, signal handling or
// file locking, so nothing in this file is mocked: every case spawns an actual
// `collector_daemon run` and asserts against the process table, the lock file
// and the heartbeat on disk.
//
// ## The five properties, named
//
// 1. **Exactly one** — two real daemons contending for one OS user's lock
//    produce exactly one live collector; the loser exits rather than proceeding.
// 2. **Signal handling** — SIGTERM ends the process cleanly: lock released,
//    heartbeat removed, no residue that blocks a successor.
// 3. **Unclean death is recoverable** — SIGKILL leaves a lock and a heartbeat
//    behind, and the next start fences both instead of refusing forever.
// 4. **Death is observable** — a killed collector's heartbeat is readable as
//    stale/absent rather than as healthy. This is the property the supervisor
//    blocker called decisive: a silently dead collector makes incomplete
//    telemetry look fine.
// 5. **Orphan survival** — a daemon whose parent exits keeps running and keeps
//    beating. It is re-parented, not killed, which is what a supervisor-started
//    process must do.
//
// ## Why this file is not `describe.runIf(platform)`-gated
//
// AC-8 makes a SKIP a failure on the declared platform, so a conditional skip
// here would be the exact thing the acceptance criterion forbids. The two
// declared rows (macOS, Linux-with-a-user-session-bus) are both POSIX and both
// run this file in full. On a platform outside the declared set the file is not
// expected to be run at all — that is a CI-matrix decision, not a runtime one.

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { enableCollector } from '../../src/scripts/_lib/collector_denominator.js';
import { DEFAULT_BEAT_MS } from '../../src/scripts/collector_daemon.js';
import { isStoreAvailable } from '../../src/scripts/_lib/collector_store.js';
import {
    HEARTBEAT_STALE_AFTER_MS,
    livenessFromBeat,
    readHeartbeat,
    runtimeLockPath,
} from '../../src/scripts/_lib/collector_supervision.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
const DAEMON = path.join(REPO, 'src', 'scripts', 'collector_daemon.ts');

let userRoot: string;
const spawned: ChildProcess[] = [];
/** Daemon pids announced this test, so afterEach can reap the grandchildren. */
const announcedPids: number[] = [];

beforeEach(() => {
    userRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-lifecycle-'));
    enableCollector(userRoot);
});

afterEach(async () => {
    for (const pid of announcedPids.splice(0)) {
        try {
            process.kill(pid, 'SIGKILL');
        } catch {
            /* already gone */
        }
    }
    for (const child of spawned.splice(0)) {
        if (child.exitCode === null && child.signalCode === null) {
            try {
                child.kill('SIGKILL');
            } catch {
                /* already gone */
            }
        }
    }
    fs.rmSync(userRoot, { recursive: true, force: true });
});

interface Daemon {
    readonly child: ChildProcess;
    /**
     * The DAEMON's pid, read from its own readiness line — never `child.pid`.
     *
     * `tsx` is a launcher: `child.pid` is the wrapper, and the daemon runs in a
     * grandchild. Signalling the wrapper leaves the daemon alive, and comparing
     * `child.pid` against the heartbeat compares two different processes. Three
     * of the five properties below failed on exactly that confusion before this
     * field existed, and the failures looked like product bugs rather than test
     * bugs — which is why the distinction is documented here rather than fixed
     * quietly.
     */
    readonly pid: number;
    /** Everything the daemon has written to stdout so far. */
    stdout(): string;
    /** Everything on stderr — where a refusal to start is reported. */
    stderr(): string;
    exited(): Promise<void>;
    /** Signal the DAEMON (not the launcher) and wait for it to be gone. */
    signal(sig: NodeJS.Signals): Promise<void>;
}

/** Spawn a real daemon and wait until it announces readiness on stdout. */
async function spawnDaemon(extraArgs: string[] = []): Promise<Daemon> {
    // `extraArgs` comes AFTER the default `--beat-ms 50`, and the flag parser
    // takes the first occurrence — so a caller overriding the beat must pass it
    // as the only one. Handled by dropping the default when the caller supplies
    // it, rather than by relying on argument order.
    const overridesBeat = extraArgs.includes('--beat-ms');
    const base = overridesBeat
        ? [DAEMON, 'run', '--root', userRoot]
        : [DAEMON, 'run', '--root', userRoot, '--beat-ms', '50'];
    const child = spawn(TSX, [...base, ...extraArgs], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    spawned.push(child);
    let out = '';
    child.stdout?.on('data', (chunk: Buffer) => {
        out += chunk.toString();
    });
    let err = '';
    child.stderr?.on('data', (chunk: Buffer) => {
        err += chunk.toString();
    });
    const exited = new Promise<void>((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) return resolve();
        child.once('exit', () => resolve());
    });

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        if (out.includes('collector: running') || err.includes('not started')) break;
        if (child.exitCode !== null || child.signalCode !== null) break;
        await new Promise<void>((r) => setTimeout(r, 25));
    }
    const announced = /collector: running pid=(\d+)/.exec(out);
    const pid = announced === null ? Number.NaN : Number.parseInt(announced[1] as string, 10);
    if (Number.isFinite(pid)) announcedPids.push(pid);

    return {
        child,
        pid,
        stdout: () => out,
        stderr: () => err,
        exited: () => exited,
        signal: async (sig: NodeJS.Signals) => {
            if (Number.isFinite(pid)) {
                try {
                    process.kill(pid, sig);
                } catch {
                    /* already gone */
                }
            }
            const deadline = Date.now() + 20_000;
            while (Date.now() < deadline && Number.isFinite(pid) && pidAlive(pid)) {
                await new Promise<void>((r) => setTimeout(r, 25));
            }
            await exited;
        },
    };
}

function pidAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        return (err as NodeJS.ErrnoException).code === 'EPERM';
    }
}

async function waitFor(predicate: () => boolean, ms = 15_000): Promise<boolean> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
        if (predicate()) return true;
        await new Promise<void>((r) => setTimeout(r, 25));
    }
    return predicate();
}

// `node:sqlite` is what the daemon opens on start. Where the runtime does not
// provide it the daemon refuses with `store-unavailable`, which is correct
// behaviour and not a lifecycle property — so the suite reports the platform as
// unable to run rather than pretending it passed. `run_lifecycle_suite` treats
// that as a failure, per AC-8's "a skip counts as a failure".
const STORE = isStoreAvailable();

/**
 * Per-test timeout for every case in this file.
 *
 * `vitest.config.ts` sets `testTimeout: 10_000` globally, and every internal
 * deadline here is longer than that — 30 s for daemon readiness, 20 s for a
 * signal to land, 15 s for a filesystem predicate. Under the global timeout
 * those waits are unreachable: the test is killed before its own deadline can
 * report anything, so a slow runner produces a bare timeout instead of the
 * specific assertion (R2 finding 8). Each property spawns one or two `tsx`
 * daemons, cold-start seconds apiece, on `macos-latest` — the slowest runner in
 * the matrix and the only platform the `collector-lifecycle` job certifies.
 *
 * 90 s is the internal deadlines plus headroom, not a round number: readiness
 * (30) + signal (20) + a fence-and-restart pair (30) is 80 in the worst case
 * PROPERTY 3 can reach.
 */
const CASE_TIMEOUT_MS = 90_000;

describe.runIf(STORE)('the five lifecycle properties, on real processes', () => {
    it('PROPERTY 1 — exactly one live collector per OS user', async () => {
        const first = await spawnDaemon();
        expect(first.stdout()).toContain('collector: running');
        expect(await waitFor(() => fs.existsSync(runtimeLockPath(userRoot)))).toBe(true);

        const second = await spawnDaemon();
        await second.exited();
        // The loser EXITS rather than proceeding — it does not become a second
        // writer against the same store.
        expect(second.child.exitCode).toBe(0);
        expect(second.stdout()).not.toContain('collector: running');

        const beat = readHeartbeat(userRoot);
        expect(beat?.pid).toBe(first.pid);
        expect(pidAlive(first.pid)).toBe(true);
    }, CASE_TIMEOUT_MS);

    it('PROPERTY 2 — SIGTERM ends it cleanly: lock released, heartbeat removed', async () => {
        const daemon = await spawnDaemon();
        expect(await waitFor(() => readHeartbeat(userRoot) !== null)).toBe(true);

        await daemon.signal('SIGTERM');

        expect(pidAlive(daemon.pid)).toBe(false);
        expect(readHeartbeat(userRoot)).toBeNull();
        expect(fs.existsSync(runtimeLockPath(userRoot))).toBe(false);

        // The successor starts without any fencing being needed.
        const successor = await spawnDaemon();
        expect(successor.stdout()).toContain('collector: running');
    }, CASE_TIMEOUT_MS);

    it('PROPERTY 3 — SIGKILL leaves residue, and the successor FENCES it', async () => {
        const daemon = await spawnDaemon();
        expect(await waitFor(() => readHeartbeat(userRoot) !== null)).toBe(true);

        await daemon.signal('SIGKILL');
        expect(pidAlive(daemon.pid)).toBe(false);

        // An unclean death cannot run a cleanup handler, so the residue is real
        // — that is the state this property exists to test.
        expect(fs.existsSync(runtimeLockPath(userRoot))).toBe(true);
        expect(readHeartbeat(userRoot)).not.toBeNull();

        const successor = await spawnDaemon();
        expect(successor.stdout()).toContain('collector: running');
        expect(await waitFor(() => readHeartbeat(userRoot)?.pid === successor.pid)).toBe(true);
        expect(
            fs.readFileSync(runtimeLockPath(userRoot), 'utf8').trim(),
            'the lock names the successor',
        ).toBe(String(successor.pid));
    }, CASE_TIMEOUT_MS);

    it('PROPERTY 4 — a dead collector is READABLE as dead, never as healthy', async () => {
        const daemon = await spawnDaemon();
        expect(await waitFor(() => readHeartbeat(userRoot) !== null)).toBe(true);
        expect(livenessFromBeat(readHeartbeat(userRoot))).toBe('running');

        await daemon.signal('SIGKILL');

        const beat = readHeartbeat(userRoot);
        expect(beat, 'the beat of the dead process survives').not.toBeNull();
        // Read at a clock past the staleness threshold, the surviving beat is
        // `stale` — likely dead — rather than `running`. This is the property
        // the supervisor blocker called decisive: a boolean would report the
        // corpse as healthy and the capture-rate gap as a product finding.
        expect(
            livenessFromBeat(beat, (beat?.last_heartbeat ?? 0) + HEARTBEAT_STALE_AFTER_MS + 1),
        ).toBe('stale');
        expect(pidAlive(beat?.pid as number)).toBe(false);
    }, CASE_TIMEOUT_MS);

    it('honours SIGTERM PROMPTLY at the PRODUCTION beat, not only at a test beat', async () => {
        // R2 round-2 finding 1, and the test that would have caught it. Every
        // other case here spawns with `--beat-ms 50`, which is the one
        // configuration where a synchronous sleep still lets the graceful path
        // win. This one uses the shipped default (30 s) and asserts the process
        // is gone in a fraction of it.
        //
        // Under the old `Atomics.wait` loop the signal handler could not run
        // until the sleep returned, so stop latency was a full beat: 30 s
        // against `terminateCollector`'s 5 s grace, i.e. every production stop
        // escalated to SIGKILL and left the residue of an unclean death.
        const daemon = await spawnDaemon(['--beat-ms', String(DEFAULT_BEAT_MS)]);
        expect(daemon.stdout()).toContain('collector: running');
        expect(await waitFor(() => readHeartbeat(userRoot) !== null)).toBe(true);

        const sentAt = Date.now();
        process.kill(daemon.pid, 'SIGTERM');
        await daemon.exited();
        const elapsed = Date.now() - sentAt;

        expect(pidAlive(daemon.pid)).toBe(false);
        // Well inside `terminateCollector`'s 5 s default grace, and two orders
        // of magnitude inside the 30 s beat it was sleeping on.
        expect(elapsed, `SIGTERM honoured in ${String(elapsed)}ms`).toBeLessThan(5_000);
        // And it was a CLEAN stop: the `finally` ran.
        expect(readHeartbeat(userRoot)).toBeNull();
        expect(fs.existsSync(runtimeLockPath(userRoot))).toBe(false);
    }, CASE_TIMEOUT_MS);

    // removing_this_constraint_reds_it: restore the synchronous
    // `Atomics.wait` sleep in `runLoop` — this case times out at the 5 s
    // assertion while every other case in the file stays green, which is
    // exactly the asymmetry that hid the bug.

    it('the operator STOP verb ends a real daemon through the documented path', async () => {
        // R2 finding 3: `terminateCollector` had no production caller and
        // `collector_daemon` exposed only `status|run`, so the SIGTERM->SIGKILL
        // half of the kill switch documented in
        // `docs/contracts/collector-operations.md` was unreachable. This drives
        // the verb an operator is told to run, against a daemon that is running.
        const daemon = await spawnDaemon();
        expect(await waitFor(() => readHeartbeat(userRoot) !== null)).toBe(true);

        const stopRun = spawnSync(TSX, [DAEMON, 'stop', '--root', userRoot], {
            encoding: 'utf8',
        });
        expect(stopRun.stdout, stopRun.stderr).toContain('collector: stopped');
        expect(stopRun.status).toBe(0);
        await daemon.exited();

        expect(pidAlive(daemon.pid)).toBe(false);
        // The switch LATCHES by default: a supervisor restart loop must not
        // bring back a collector the operator just stopped.
        expect(fs.existsSync(path.join(userRoot, 'agent-collector', 'STOP'))).toBe(true);
        const restart = await spawnDaemon();
        await restart.exited();
        expect(restart.stderr()).toContain('not started');
        expect(restart.stdout()).not.toContain('collector: running');
    }, CASE_TIMEOUT_MS);

    it('PROPERTY 5 — an orphaned collector survives its parent and keeps beating', async () => {
        // Launch through a shell that exits immediately, so the daemon is
        // re-parented to init. A supervisor-started process is never a child of
        // whatever asked for it, and a daemon that dies with its launcher is not
        // supervised — it is a subprocess.
        const launcher = spawn(
            '/bin/sh',
            [
                '-c',
                `${JSON.stringify(TSX)} ${JSON.stringify(DAEMON)} run `
                    + `--root ${JSON.stringify(userRoot)} --beat-ms 50 >/dev/null 2>&1 & echo $!`,
            ],
            { stdio: ['ignore', 'pipe', 'ignore'] },
        );
        let out = '';
        launcher.stdout.on('data', (c: Buffer) => {
            out += c.toString();
        });
        await new Promise<void>((r) => launcher.once('exit', () => r()));
        // `$!` is the shell's child — tsx — which execs or spawns the daemon.
        // The daemon's pid is whatever the heartbeat records; that is the
        // authoritative answer and it is what the assertions use.
        expect(out.trim().length, 'the launcher printed a pid').toBeGreaterThan(0);

        expect(await waitFor(() => readHeartbeat(userRoot) !== null, 30_000)).toBe(true);
        const beat = readHeartbeat(userRoot);
        expect(beat).not.toBeNull();
        const pid = beat?.pid as number;
        expect(pidAlive(pid)).toBe(true);

        // Still beating after the launcher is long gone: the beat advances.
        const first = beat?.last_heartbeat as number;
        expect(
            await waitFor(() => (readHeartbeat(userRoot)?.last_heartbeat ?? 0) > first, 20_000),
            'the orphan keeps beating',
        ).toBe(true);

        // Its parent is not the launcher. On Linux an orphan re-parents to pid 1
        // or to a subreaper; on macOS to 1. Either way it is not this test.
        const ppid = spawnSync('ps', ['-o', 'ppid=', '-p', String(pid)], { encoding: 'utf8' });
        expect(Number.parseInt(ppid.stdout.trim(), 10)).not.toBe(process.pid);

        try {
            process.kill(pid, 'SIGKILL');
        } catch {
            /* already gone */
        }
    }, CASE_TIMEOUT_MS);
});
