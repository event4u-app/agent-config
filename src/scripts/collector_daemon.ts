/**
 * collector_daemon — the supervised telemetry collector itself
 * (`road-to-supervised-telemetry-collector` step 4.1).
 *
 * Built against the contracts, not beside them: the record shape is
 * `collector_record`, the store and its quarantine are `collector_store`, the
 * budgets, kill switch, lock and heartbeat are `collector_supervision`, and the
 * denominator plus the spool are `collector_denominator`. This file adds a
 * loop and a signal handler and nothing else — every rule it obeys was decided
 * in Phases 1 to 3 and is imported rather than restated.
 *
 * ## Default-off is a property, not a config line
 *
 * `start()` refuses unless the opt-in marker exists, and the marker is absent on
 * a fresh install. There is no setting whose default could be misread, no
 * environment variable that could be set in CI by accident, and nothing in the
 * install path that creates the marker. The test that matters asserts this by
 * PROCESS ENUMERATION after the full suite — reading the setting back would
 * only prove the setting, which is the check step 4.1 explicitly refuses.
 *
 * ## The five questions (`resident-process-floors` § 2)
 *
 * 1. **Failure mode when absent** — static mode. Dispatches resolve
 *    identically; the denominator keeps counting and the capture rate falls,
 *    which is the true statement rather than a silent gap.
 * 2. **A dispatch it cannot serve** — degraded, never blocked. The hook's only
 *    contact with this process is an append to a spool file, and both
 *    denominator and spool writes return `false` instead of raising.
 * 3. **State on an unclean stop** — the heartbeat goes stale (readable as
 *    likely-dead), the lock is fenced by the next starter, and a claimed spool
 *    file is left in place and re-read on the next drain. Nothing is lost by a
 *    `SIGKILL` except the in-flight batch, which is re-drained.
 * 4. **Who supervises it, with what privileges** — a per-user service manager,
 *    positively probed; no administrator privilege on either supported row.
 *    Where none is detected the mode is `degraded` and says so in the
 *    heartbeat, and it is never labelled supervised.
 * 5. **Uniqueness namespace** — one live collector per OS user, enforced by the
 *    runtime lock, so two worktrees contend and the loser runs static.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
    claimSpool,
    isCollectorEnabled,
    pruneOpportunitiesOlderThan,
    readClaimedSpool,
    spoolDir,
} from './_lib/collector_denominator.js';
import {
    isStoreAvailable,
    openCollectorStore,
    pruneOlderThan,
    resolveCollectorStore,
    writeRecord,
    type StoreHandle,
} from './_lib/collector_store.js';
import {
    acquireRuntimeLock,
    budgetVerdict,
    detectSupervisor,
    killSwitchEngaged,
    livenessFromBeat,
    pullKillSwitch,
    readHeartbeat,
    releaseHeartbeat,
    releaseRuntimeLock,
    terminateCollector,
    writeHeartbeat,
    type BudgetName,
    type ResourceReading,
} from './_lib/collector_supervision.js';

// An earlier draft exported a `DAEMON_PROCESS_MARKER` constant here, claiming
// the daemon put it into its own argv and that the 4.1 test greped for it. Both
// were false — its only use was a usage string — and R2 findings 6 and 7 caught
// it. It is REMOVED rather than made true: nothing can add a token to argv after
// `exec` (a JavaScript `process.argv` is not the kernel's copy, which is what
// `ps` reads), so honouring the claim would have meant re-exec'ing the daemon
// and changing the pid every launcher and test then re-derives — to solve a
// problem `--root` already solves exactly. Process enumeration greps the module
// path, which a real daemon's argv genuinely contains, and tells a test-owned
// daemon from a developer's by `--root`. See `tests/scripts/collector_daemon.test.ts`.

export const DEFAULT_BEAT_MS = 30_000;

export type StartRefusal =
    | 'not-enabled'
    | 'kill-switch-engaged'
    | 'lock-held'
    | 'store-unavailable';

export interface StartOutcome {
    readonly started: boolean;
    readonly refusal: StartRefusal | null;
    readonly mode: 'supervised' | 'degraded' | null;
}

/* -------------------------------------------------------------------------- */
/* Resource sampling                                                          */
/* -------------------------------------------------------------------------- */

let lastCpu = process.cpuUsage();
let lastCpuAt = Date.now();
let lastCpuPercent = 0;

/**
 * The shortest window a CPU percentage is computed over.
 *
 * MEASURED, not chosen: back-to-back sampling produced `103 %` and then
 * `36800 %` on a real run, because a few hundred microseconds of elapsed wall
 * clock divides into any CPU time at all to give a nonsense ratio. The budget's
 * own unit says *"% of one core, averaged over 60 s"*, and a sub-second window
 * is not that average — it is noise wearing its units.
 */
export const MIN_CPU_WINDOW_MS = 1_000;

/**
 * Sample the four budgeted resources for THIS process.
 *
 * CPU is a delta between samples rather than a lifetime average: a collector
 * that spun for ten minutes an hour ago and is idle now is not currently over
 * budget, and a lifetime figure would keep reporting the old spike.
 *
 * **Below {@link MIN_CPU_WINDOW_MS} the previous percentage is carried forward
 * rather than recomputed**, and the initial value is 0. That is a deliberate
 * choice between three bad options: recomputing gives the 36800 % nonsense
 * above; returning `NaN` is read as a breach by `budgetVerdict` and would stop
 * the daemon during its own startup; carrying the last value reports a stale
 * figure for at most one second. The staleness is bounded and the other two are
 * wrong, so this one is documented rather than hidden.
 */
export function sampleResources(userRoot?: string): ResourceReading {
    const now = Date.now();
    const elapsedMs = now - lastCpuAt;
    if (elapsedMs >= MIN_CPU_WINDOW_MS) {
        const cpu = process.cpuUsage();
        const usedMicros = cpu.user - lastCpu.user + (cpu.system - lastCpu.system);
        lastCpuPercent = (usedMicros / (elapsedMs * 1000)) * 100;
        lastCpu = cpu;
        lastCpuAt = now;
    }

    return Object.freeze({
        cpu_percent: lastCpuPercent,
        resident_bytes: process.memoryUsage().rss,
        disk_bytes: directorySize(resolveCollectorStore(userRoot).root),
        file_descriptors: openDescriptorCount(),
    });
}

function directorySize(dir: string): number {
    let total = 0;
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return 0;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            total += directorySize(full);
            continue;
        }
        try {
            total += fs.statSync(full).size;
        } catch {
            /* raced with a rename; the next sample sees it */
        }
    }
    return total;
}

/**
 * Count open descriptors without shelling out.
 *
 * `/proc/self/fd` on Linux, `/dev/fd` on macOS. Where neither is readable the
 * answer is `NaN`, which {@link budgetVerdict} treats as a BREACH rather than a
 * pass — an unmeasurable resource is not a satisfied budget, which is the R-A12
 * rule this follows.
 */
export function openDescriptorCount(): number {
    for (const dir of ['/proc/self/fd', '/dev/fd']) {
        try {
            return fs.readdirSync(dir).length;
        } catch {
            /* try the next */
        }
    }
    return Number.NaN;
}

/* -------------------------------------------------------------------------- */
/* Draining                                                                    */
/* -------------------------------------------------------------------------- */

export interface DrainResult {
    readonly claimed: number;
    readonly written: number;
    readonly refused: number;
    readonly malformed: number;
}

/**
 * Drain every claimed spool file into the store.
 *
 * Re-drains files left claimed by a previous unclean stop, which is answer 3 to
 * the daemon checklist: the batch in flight when the process died is not lost,
 * it is on disk under its claimed name and the next drain picks it up. A file
 * is deleted only after every one of its records has been offered to the store,
 * so a crash mid-batch re-offers the whole file.
 *
 * **That re-offer inserts duplicate ROWS, and it is safe for a stated reason
 * rather than by accident.** `dedup_key` is deliberately NOT unique — the store
 * is append-only and collapses duplicates at READ time (`readRecords`), while
 * `readSummary` reports `rows` and distinct `dedup_key` separately so a
 * duplicate is observable rather than invisible. Claiming insert-time
 * idempotency here would have been the easier sentence and a false one.
 */
export function drainOnce(handle: StoreHandle, userRoot?: string): DrainResult {
    claimSpool(userRoot);
    let claimedFiles: string[] = [];
    try {
        claimedFiles = fs
            .readdirSync(spoolDir(userRoot))
            .filter((name) => name.startsWith('draining-'))
            .map((name) => path.join(spoolDir(userRoot), name));
    } catch {
        return Object.freeze({ claimed: 0, written: 0, refused: 0, malformed: 0 });
    }

    let written = 0;
    let refused = 0;
    let malformed = 0;
    for (const file of claimedFiles) {
        const parsed = readClaimedSpool(file);
        malformed += parsed.malformed;
        for (const record of parsed.records) {
            const outcome = writeRecord(handle, record);
            if (outcome.written) written += 1;
            else refused += 1;
        }
        fs.rmSync(file, { force: true });
    }
    return Object.freeze({
        claimed: claimedFiles.length,
        written,
        refused,
        malformed,
    });
}

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                   */
/* -------------------------------------------------------------------------- */

export interface RunOptions {
    // `| undefined` is required, not decoration: `exactOptionalPropertyTypes` is
    // on, so an optional property does NOT implicitly accept `undefined`, and
    // `main` threads a `--root` that may legitimately be absent.
    readonly userRoot?: string | undefined;
    readonly beatMs?: number;
    /** Stop after this many iterations. Tests use it; the real daemon does not pass it. */
    readonly maxIterations?: number;
    /** Injected for tests. */
    readonly sample?: (userRoot?: string) => ResourceReading;
}

export interface RunSummary {
    readonly iterations: number;
    readonly drained: DrainResult;
    readonly stoppedBy: 'signal' | 'kill-switch' | 'budget' | 'iterations';
    readonly exceeded: readonly BudgetName[];
}

let stopRequested = false;

/**
 * Ask the loop to finish and exit. Idempotent.
 *
 * Wakes an in-flight {@link sleep} rather than only setting the flag: a daemon
 * that acknowledges `SIGTERM` and then waits out a 30-second beat before acting
 * on it has not honoured the signal in any sense an operator or a supervisor
 * would recognise.
 */
export function requestStop(): void {
    stopRequested = true;
    wake?.();
}

/**
 * Refuse or accept the start, and take the lock when accepting.
 *
 * Order is deliberate and each step is cheaper than the next: the opt-in marker
 * (a `stat`), the kill switch (a `stat`), store availability (a runtime probe),
 * then the lock (a write). Probing availability before taking the lock keeps a
 * runtime without `node:sqlite` from holding a lock it can never use.
 */
export function start(userRoot?: string): StartOutcome {
    if (!isCollectorEnabled(userRoot)) {
        return Object.freeze({ started: false, refusal: 'not-enabled' as const, mode: null });
    }
    if (killSwitchEngaged(userRoot)) {
        return Object.freeze({
            started: false,
            refusal: 'kill-switch-engaged' as const,
            mode: null,
        });
    }
    if (!isStoreAvailable()) {
        return Object.freeze({
            started: false,
            refusal: 'store-unavailable' as const,
            mode: null,
        });
    }
    const lock = acquireRuntimeLock(userRoot);
    if (!lock.acquired) {
        return Object.freeze({ started: false, refusal: 'lock-held' as const, mode: null });
    }
    const probe = detectSupervisor();
    const mode = probe.tier === 'supported' ? ('supervised' as const) : ('degraded' as const);
    const now = Date.now();
    writeHeartbeat({ pid: process.pid, started_at: now, last_heartbeat: now, mode }, userRoot);
    stopRequested = false;
    return Object.freeze({ started: true, refusal: null, mode });
}

/**
 * Release the lock and remove the heartbeat — ONLY the ones this process owns.
 *
 * Both helpers are ownership-checked (R2 finding 10). The unconditional
 * `rmSync` pair this replaces meant a FENCED predecessor tearing down through
 * `runLoop`'s `finally` deleted the successor's lock and heartbeat: the next
 * starter then also acquired, and `livenessFromBeat` reported `absent` for a
 * process that was running.
 *
 * Returns what it actually removed, so a caller can tell a clean release from a
 * no-op after a fence.
 */
export function stop(userRoot?: string): { lock: boolean; heartbeat: boolean } {
    return {
        lock: releaseRuntimeLock(userRoot),
        heartbeat: releaseHeartbeat(userRoot),
    };
}

/**
 * The loop. Beat, drain, sample, decide.
 *
 * ## Why this is `async`, and why the synchronous version was a real bug
 *
 * R2 round-2 finding 1. The first version slept with `Atomics.wait`, which
 * blocks the main thread — and a Node signal handler is a JS callback on the
 * event loop, so `SIGTERM` could not be observed until the sleep returned. Stop
 * latency was therefore up to a full beat, the shipped default beat is 30 s and
 * `terminateCollector`'s grace is 5 s, so **in the shipped configuration the
 * graceful half of the kill switch could never win**: every stop escalated to
 * `SIGKILL`, leaving the lock and heartbeat residue of an unclean death and an
 * unclosed SQLite handle, every time.
 *
 * PROPERTY 2 passed anyway, and that is the part worth remembering: the
 * lifecycle suite spawns with `--beat-ms 50`, the one configuration in which
 * the graceful path is reachable. The suite certified a beat production never
 * uses.
 *
 * `await setTimeout` yields to the event loop, so a handler runs while the
 * daemon waits. Nothing else about the loop changed.
 *
 * A budget breach stops the collector on the SECOND consecutive reading, not
 * the first. One sample is not a breach: the first CPU sample after start
 * measures a window of a few milliseconds that includes the store open, and
 * stopping on it would make the daemon unable to start under its own budget.
 * Two consecutive readings over the ceiling is a load; one is a sample.
 */
export async function runLoop(options: RunOptions = {}): Promise<RunSummary> {
    const userRoot = options.userRoot;
    const beatMs = options.beatMs ?? DEFAULT_BEAT_MS;
    const sample = options.sample ?? sampleResources;

    let iterations = 0;
    let consecutiveBreaches = 0;
    let exceeded: readonly BudgetName[] = [];
    let drained: DrainResult = Object.freeze({
        claimed: 0,
        written: 0,
        refused: 0,
        malformed: 0,
    });
    let stoppedBy: RunSummary['stoppedBy'] = 'iterations';

    // INSIDE the try (R2 round-2 finding 13): opening the store can throw on a
    // corrupt or unreadable file, and `isStoreAvailable()` in `start()` probes
    // the runtime rather than this file. Outside the try that throw skipped the
    // `finally` and left behind the lock and heartbeat `start()` had already
    // taken — so a supervisor restart loop met its own stale lock on every
    // attempt until the fencing path cleared it.
    let handle: StoreHandle | null = null;
    try {
        handle = openCollectorStore(userRoot);
        for (;;) {
            iterations += 1;

            if (stopRequested) {
                stoppedBy = 'signal';
                break;
            }
            if (killSwitchEngaged(userRoot)) {
                stoppedBy = 'kill-switch';
                break;
            }

            const beat = readHeartbeat(userRoot);
            const now = Date.now();
            writeHeartbeat(
                {
                    pid: process.pid,
                    started_at: beat?.started_at ?? now,
                    last_heartbeat: now,
                    mode: beat?.mode ?? 'degraded',
                },
                userRoot,
            );

            const result = drainOnce(handle, userRoot);
            drained = Object.freeze({
                claimed: drained.claimed + result.claimed,
                written: drained.written + result.written,
                refused: drained.refused + result.refused,
                malformed: drained.malformed + result.malformed,
            });
            const today = new Date(now).toISOString().slice(0, 10);
            pruneOlderThan(handle, today);
            // BOTH sides age on the same clock (R2 round-2 finding 5). Pruning
            // only the store made the ratio fall toward zero as the numerator
            // aged out against a lifetime denominator, and left an unbounded
            // file inside the directory the disk budget ceilings.
            pruneOpportunitiesOlderThan(userRoot, today);

            const verdict = budgetVerdict(sample(userRoot));
            if (verdict.action === 'stop') {
                consecutiveBreaches += 1;
                exceeded = verdict.exceeded;
                if (consecutiveBreaches >= 2) {
                    stoppedBy = 'budget';
                    break;
                }
            } else {
                consecutiveBreaches = 0;
                exceeded = [];
            }

            if (options.maxIterations !== undefined && iterations >= options.maxIterations) {
                stoppedBy = 'iterations';
                break;
            }
            await sleep(beatMs);
        }
    } finally {
        handle?.db.close();
        stop(userRoot);
    }

    return Object.freeze({ iterations, drained, stoppedBy, exceeded });
}

/**
 * Wakes the current {@link sleep} early. Set while the loop is waiting.
 *
 * Yielding to the event loop is necessary and NOT sufficient, which cost a
 * measured round: with `await setTimeout` the `SIGTERM` handler ran promptly —
 * and the loop still finished the full 30 s beat before it looked at
 * `stopRequested`, so the observed stop latency was 29,995 ms against a 5 s
 * grace. The handler has to be able to END the wait, not merely run during it.
 */
let wake: (() => void) | null = null;

/**
 * Wait up to `ms`, or until {@link requestStop} wakes us — whichever is first.
 *
 * Two properties, and the loop needs both (R2 round-2 finding 1). It yields, so
 * signal handlers run at all; and it is interruptible, so a handler's effect is
 * immediate rather than deferred to the end of the beat.
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            wake = null;
            resolve();
        }, ms);
        wake = () => {
            clearTimeout(timer);
            wake = null;
            resolve();
        };
    });
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
    const command = argv[0] ?? 'status';

    // `--root` exists for the process-level lifecycle suite (step 5.1), which
    // has to spawn REAL daemons and cannot be allowed to touch the developer's
    // own `~/.event4u/agent-config`. It is not a production knob: the supervisor
    // units never pass it, and omitting it resolves the real user root exactly
    // as before.
    //
    // A TRAILING `--root` with no value is an ERROR, not a default (R2 finding
    // 16). `argv[i + 1]` is `undefined` there, and `undefined` is precisely the
    // value that falls back to the real user root — so a malformed invocation
    // would do the one thing this flag was added to prevent.
    // A flag's value must exist AND not be another flag (R2 round-2 finding 12).
    // `--root --beat-ms 5` used to pass the presence check and silently take the
    // literal string `--beat-ms` as the user root — which is the failure `--root`
    // was added to prevent, arriving through a typo instead of an omission.
    const flagValue = (name: string): string | null | undefined => {
        const at = argv.indexOf(name);
        if (at < 0) return undefined;
        const value = argv[at + 1];
        if (value === undefined || value.startsWith('--')) return null;
        return value;
    };

    const rootValue = flagValue('--root');
    if (rootValue === null) {
        process.stderr.write('collector: --root needs a directory argument\n');
        return 2;
    }
    const userRoot = rootValue;

    const beatValue = flagValue('--beat-ms');
    if (beatValue === null) {
        process.stderr.write('collector: --beat-ms needs a number\n');
        return 2;
    }
    const beatMs = beatValue === undefined ? undefined : Number.parseInt(beatValue, 10);
    // Positive, not merely finite: 0 and a negative both turned the wait into a
    // no-op, i.e. a busy loop that budget-stops the collector after two
    // iterations — a spin dressed as a configuration.
    if (beatMs !== undefined && (!Number.isFinite(beatMs) || beatMs <= 0)) {
        process.stderr.write('collector: --beat-ms must be a positive number of milliseconds\n');
        return 2;
    }

    if (command === 'status') {
        const beat = readHeartbeat(userRoot);
        const liveness = livenessFromBeat(beat);
        const enabled = isCollectorEnabled(userRoot);
        process.stdout.write(
            `collector: ${enabled ? 'enabled' : 'default-off'} · ${liveness}`
                + (beat === null ? '' : ` (pid ${beat.pid}, ${beat.mode})`)
                + `\n`,
        );
        return 0;
    }

    // The operator-facing half of the kill switch (R2 finding 3). Before this
    // existed, `terminateCollector` had no production caller at all and
    // `docs/contracts/collector-operations.md` told an operator under pressure
    // that there was nothing running to stop — while this very file had just
    // shipped a daemon that runs.
    if (command === 'stop') {
        const engaged = argv.includes('--no-latch') ? false : true;
        if (engaged) pullKillSwitch(userRoot);
        const outcome = terminateCollector(userRoot, {
            signalStale: argv.includes('--signal-stale'),
        });
        process.stdout.write(
            `collector: ${outcome.stopped ? 'stopped' : 'NOT stopped'} (${outcome.via}`
                + (outcome.pid === null ? '' : `, pid ${outcome.pid}`)
                + `)${engaged ? ' · kill switch engaged — delete STOP to allow a restart' : ''}\n`,
        );
        if (outcome.via === 'stale-refused') {
            process.stderr.write(
                'collector: the heartbeat is stale, so its pid may have been recycled — '
                    + 'refused rather than signalling a stranger. Re-run with --signal-stale '
                    + 'if you know that pid is still the collector.\n',
            );
        }
        return outcome.stopped ? 0 : 1;
    }

    if (command === 'run') {
        const outcome = start(userRoot);
        if (!outcome.started) {
            process.stderr.write(`collector: not started — ${outcome.refusal}\n`);
            // Refusing to start is the designed behaviour on a default-off
            // install, so it is exit 0. A non-zero here would make every
            // supervisor on a fresh machine report a failing unit.
            return 0;
        }
        process.on('SIGTERM', requestStop);
        process.on('SIGINT', requestStop);
        // Announce readiness AFTER the lock and heartbeat exist. A test that
        // signals before this line is racing the startup it is trying to test —
        // the same race the 3.3 wedged-process test learned the hard way.
        process.stdout.write(
            `collector: running pid=${process.pid} mode=${outcome.mode}\n`,
        );
        // WRAPPED (R2 round-2 finding 13): an uncaught throw out of the loop
        // used to kill the process with `start()`'s lock and heartbeat still on
        // disk. `runLoop`'s own `finally` releases them, but only for throws it
        // can see; this catches the rest so a supervisor restart does not meet
        // a stale lock every attempt.
        let summary: RunSummary;
        try {
            summary = await runLoop(
                beatMs !== undefined ? { userRoot, beatMs } : { userRoot },
            );
        } catch (err) {
            stop(userRoot);
            process.stderr.write(`collector: loop failed — ${(err as Error).message}\n`);
            return 1;
        }
        process.stderr.write(
            `collector: stopped by ${summary.stoppedBy}`
                + (summary.exceeded.length > 0 ? ` (${summary.exceeded.join(', ')})` : '')
                + `\n`,
        );
        return 0;
    }

    process.stderr.write(
        'usage: collector_daemon [status|run|stop] [--root <dir>] [--beat-ms <n>]'
            + ' [--no-latch] [--signal-stale]\n',
    );
    return 2;
}

const invokedDirectly =
    process.argv[1] !== undefined && process.argv[1].includes('collector_daemon');
if (invokedDirectly) {
    void main().then((code) => {
        process.exitCode = code;
    });
}
