// The collector itself — default-off proven by process enumeration, the
// denominator's independence from the daemon, and the drain loop.
//
// `road-to-supervised-telemetry-collector` step 4.1 (AC-7's first half). The
// step's `verify:` is deliberately specific: *"a fresh install runs the full
// test suite with no collector process started, asserted by process enumeration
// rather than by reading the setting"* — so the default-off block below greps
// the live process table and never reads a marker back. A POSITIVE CONTROL runs
// first, because "the grep found nothing" is worthless until the same grep has
// been shown to find something.

import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
    claimSpool,
    denominatorPath,
    disableCollector,
    enableCollector,
    isCollectorEnabled,
    pruneOpportunitiesOlderThan,
    readOpportunities,
    recordOpportunity,
    spoolPendingPath,
    spoolRecord,
} from '../../src/scripts/_lib/collector_denominator.js';
import {
    COLLECTOR_SCHEMA_VERSION,
    type CollectorRecord,
} from '../../src/scripts/_lib/collector_record.js';
import {
    isStoreAvailable,
    openCollectorStore,
    readRecords,
} from '../../src/scripts/_lib/collector_store.js';
import {
    acquireRuntimeLock,
    pullKillSwitch,
    readHeartbeat,
    RESOURCE_BUDGETS,
} from '../../src/scripts/_lib/collector_supervision.js';
import {
    drainOnce,
    openDescriptorCount,
    runLoop,
    sampleResources,
    start,
    stop,
} from '../../src/scripts/collector_daemon.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DAEMON = path.join(REPO, 'src', 'scripts', 'collector_daemon.ts');

let userRoot: string;

beforeAll(() => {
    for (const line of enumerateDaemonProcesses()) baselineDaemonPids.add(pidOf(line));
});

beforeEach(() => {
    userRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-daemon-'));
});

afterEach(() => {
    stop(userRoot);
    fs.rmSync(userRoot, { recursive: true, force: true });
});

function record(over: Partial<CollectorRecord> = {}): CollectorRecord {
    return {
        schema_version: COLLECTOR_SCHEMA_VERSION,
        machine_id: '3f2504e0-4f89-4d3a-9a0c-0305e82c3301',
        episode_id: 'b7c3d1e2-8a4f-4b6c-9d0e-1f2a3b4c5d6e',
        event: 'session_start',
        sequence: 1,
        outcome: 'captured',
        platform: 'claude',
        occurred_on: '2026-08-30',
        collector_version: '1.0.0',
        ...over,
    } as CollectorRecord;
}

/**
 * Every live collector daemon, from the module path in its argv.
 *
 * The DISCRIMINATOR that matters is `--root` (R2 findings 6 and 7). The first
 * draft greped the bare substring `collector_daemon`, which matches any spawn of
 * the module — including the real daemons `collector_lifecycle.test.ts`
 * deliberately starts, in a file vitest may run concurrently with this one. A
 * green implementation could therefore red this test for a reason unrelated to
 * the property under test.
 *
 * `--root` exists so a test cannot touch the developer's own
 * `~/.event4u/agent-config`, which makes it an exact marker of test ownership.
 * Excluding it narrows the default-off assertion to what it actually claims: no
 * collector is running against the DEVELOPER's root. A daemon pinned to a temp
 * root is, by construction, not that.
 *
 * (An earlier attempt at this fix added a `DAEMON_PROCESS_MARKER` token instead.
 * It cannot work: `ps` reads the kernel's copy of argv, fixed at `exec`, and
 * nothing a process writes afterwards changes it. The constant was removed
 * rather than left asserting something untrue.)
 */
/** The pid column of a `ps -eo pid,args` line. */
function pidOf(line: string): string {
    return (line.trim().split(/\s+/)[0] ?? '').trim();
}

/**
 * Daemons already running against the real user root when this file loaded.
 *
 * The denominator of the default-off assertion: it asks whether THIS SUITE
 * started one, and a machine that legitimately has a collector running is not
 * evidence about the suite.
 */
const baselineDaemonPids = new Set<string>();

function enumerateDaemonProcesses(opts: { includeTestOwned?: boolean } = {}): string[] {
    const ps = spawnSync('ps', ['-eo', 'pid,args'], { encoding: 'utf8' });
    if (ps.status !== 0) return [];
    return ps.stdout
        .split('\n')
        .filter((line) => line.includes('collector_daemon'))
        // The vitest worker running THIS file can carry the test path in argv.
        .filter((line) => !line.includes('collector_daemon.test'))
        .filter((line) => opts.includeTestOwned === true || !line.includes('--root'));
}

describe('4.1 — default-off, asserted by process enumeration', () => {
    it('POSITIVE CONTROL: the enumeration finds a RUNNING daemon', async () => {
        // Without this, the negative assertion below is unfalsifiable — a grep
        // that can never match reports "no collector" on a machine running ten.
        //
        // A real `run`, not a `status`: a status invocation exits immediately
        // and there is no window in which to see it. It is `--root`-scoped so it
        // touches no real user root, and is therefore found only with
        // `includeTestOwned` — which is the same discrimination the negative
        // assertion below relies on, exercised from the other side.
        enableCollector(userRoot);
        const child = spawn(
            path.join(REPO, 'node_modules', '.bin', 'tsx'),
            [DAEMON, 'run', '--root', userRoot, '--beat-ms', '50'],
            { stdio: 'ignore' },
        );
        try {
            const deadline = Date.now() + 40_000;
            let seen: string[] = [];
            while (Date.now() < deadline) {
                seen = enumerateDaemonProcesses({ includeTestOwned: true });
                if (seen.length > 0) break;
                await new Promise<void>((r) => setTimeout(r, 50));
            }
            expect(seen.length, 'the enumeration can see a running daemon').toBeGreaterThan(0);
            // And the same enumeration, in the shape the negative assertion
            // uses, does NOT see it — because it is test-owned.
            expect(enumerateDaemonProcesses()).toEqual([]);
        } finally {
            const beat = readHeartbeat(userRoot);
            if (beat !== null) {
                try {
                    process.kill(beat.pid, 'SIGKILL');
                } catch {
                    /* already gone */
                }
            }
            child.kill('SIGKILL');
            await new Promise<void>((r) => {
                if (child.exitCode !== null || child.signalCode !== null) return r();
                child.once('exit', () => r());
            });
        }
    }, 60_000);

    it('THIS SUITE starts no daemon against the real user root', async () => {
        // The property the step asks for is "a fresh install runs the full test
        // suite with no collector process started", and the assertion has to
        // match it (R2 round-2 finding 7). The first version asserted "no
        // daemon is running on this machine" — which reds on exactly the
        // machine the feature is aimed at, a developer who has opted in and has
        // a supervised collector running, with a message about a fresh install.
        // Phase 6's whole purpose is to make that state common.
        //
        // So the comparison is against a BASELINE taken before this file ran
        // anything: what matters is whether the suite ADDED a daemon, not
        // whether the machine has one. Test-owned daemons (`--root <tmp>`) are
        // excluded on top, so a concurrently running lifecycle suite cannot red
        // this either.
        const deadline = Date.now() + 1_000;
        while (Date.now() < deadline) {
            await new Promise<void>((r) => setTimeout(r, 100));
        }
        const now = new Set(enumerateDaemonProcesses().map(pidOf));
        const added = [...now].filter((pid) => !baselineDaemonPids.has(pid));
        expect(added, 'the suite started a collector against the real user root').toEqual([]);
    });

    // removing_this_constraint_reds_it: nothing in the collector can red this
    // one by construction, which is the point — it is a *negative* assertion
    // whose sensitivity is carried by the positive control above rather than by
    // an edit to the module. Stated plainly because a block with no red edit
    // looks like a tautology, and this one is the difference between a green
    // suite and a green suite with a stray daemon on the machine.

    it('refuses to start without the opt-in marker, and the marker is absent by default', () => {
        expect(isCollectorEnabled(userRoot)).toBe(false);
        const outcome = start(userRoot);
        expect(outcome.started).toBe(false);
        expect(outcome.refusal).toBe('not-enabled');
        expect(readHeartbeat(userRoot)).toBeNull();
    });

    // removing_this_constraint_reds_it: invert `isCollectorEnabled` to
    // `!fs.existsSync(...)` (default-ON) — this reds, and so does the drain
    // block below via `spoolRecord`.

    it('refuses to start while the kill switch is engaged, even when enabled', () => {
        enableCollector(userRoot);
        pullKillSwitch(userRoot);
        expect(start(userRoot).refusal).toBe('kill-switch-engaged');
    });

    it('refuses to start when another collector holds the lock', () => {
        enableCollector(userRoot);
        acquireRuntimeLock(userRoot, process.pid);
        expect(start(userRoot).refusal).toBe('lock-held');
    });

    it('opt-out beats opt-in', () => {
        enableCollector(userRoot);
        expect(isCollectorEnabled(userRoot)).toBe(true);
        fs.writeFileSync(path.join(userRoot, 'agent-collector', 'OPT-OUT'), 'x');
        expect(isCollectorEnabled(userRoot)).toBe(false);
        expect(start(userRoot).refusal).toBe('not-enabled');
    });

    // removing_this_constraint_reds_it: drop the `isOptedOut` guard from
    // `isCollectorEnabled` — opt-out stops being terminal.
});

describe('4.1 — the denominator is independent of the daemon', () => {
    it('counts opportunities with NO collector process running', () => {
        enableCollector(userRoot);
        for (let i = 0; i < 5; i += 1) recordOpportunity('pre_tool_use', 'claude', userRoot);
        recordOpportunity('stop', 'claude', userRoot);

        const reading = readOpportunities(userRoot);
        expect(reading.total).toBe(6);
        expect(reading.byEvent.pre_tool_use).toBe(5);
        expect(reading.byEvent.stop).toBe(1);
        expect(reading.malformed).toBe(0);
        // The point of the whole module: a dead collector produces a climbing
        // denominator and a flat numerator, so the ratio falls and says so.
        expect(readHeartbeat(userRoot)).toBeNull();
    });

    // removing_this_constraint_reds_it: gate `recordOpportunity` on a running
    // daemon (a heartbeat check) instead of on the marker — the total is 0 and
    // the capture rate becomes 0/0, which is the self-reporting failure this
    // module exists to prevent.

    it('writes nothing at all on a default-off install', () => {
        expect(recordOpportunity('session_start', 'claude', userRoot)).toBe(false);
        expect(fs.existsSync(denominatorPath(userRoot))).toBe(false);
        expect(readOpportunities(userRoot).total).toBe(0);
    });

    it('carries no payload: the line is a date, an event and a platform', () => {
        enableCollector(userRoot);
        recordOpportunity('session_start', 'claude', userRoot, Date.parse('2026-08-30T13:45:12Z'));
        const line = fs.readFileSync(denominatorPath(userRoot), 'utf8').trim();
        expect(line).toBe('2026-08-30\tsession_start\tclaude');
        // A DATE, never a time — a per-second stamp beside a stable id is a
        // behavioural fingerprint, which is `FIELD_PURPOSE`'s argument about
        // `occurred_on` applied to this file.
        expect(line).not.toContain('13:45');
    });

    // removing_this_constraint_reds_it: swap `utcDate` for a full ISO timestamp.

    it('refuses an event or platform outside the closed enums', () => {
        enableCollector(userRoot);
        expect(recordOpportunity('made_up_event', 'claude', userRoot)).toBe(false);
        expect(recordOpportunity('session_start', 'made_up_host', userRoot)).toBe(false);
        expect(readOpportunities(userRoot).total).toBe(0);
    });

    it('reads a WINDOW, so both halves of the ratio age on the same clock', () => {
        // R2 round-2 finding 5. `readOpportunities` used to return a LIFETIME
        // total while the store was pruned to RETENTION_DAYS every iteration, so
        // the two sides of the capture rate were computed over different time
        // bases and the measured rate would fall toward zero as the numerator
        // aged out — the exact failure the two-writer design exists to prevent,
        // arriving through the back door.
        enableCollector(userRoot);
        const day = (iso: string): number => Date.parse(`${iso}T12:00:00Z`);
        recordOpportunity('session_start', 'claude', userRoot, day('2026-01-01'));
        recordOpportunity('session_start', 'claude', userRoot, day('2026-06-01'));
        recordOpportunity('stop', 'claude', userRoot, day('2026-06-02'));

        expect(readOpportunities(userRoot).total).toBe(3);
        expect(readOpportunities(userRoot, { since: '2026-06-01' }).total).toBe(2);
        expect(readOpportunities(userRoot, { since: '2026-06-02' }).total).toBe(1);
        expect(readOpportunities(userRoot, { until: '2026-01-31' }).total).toBe(1);
        const all = readOpportunities(userRoot);
        expect(all.firstDate).toBe('2026-01-01');
        expect(all.lastDate).toBe('2026-06-02');
    });

    // removing_this_constraint_reds_it: drop the `since`/`until` comparisons
    // from `readOpportunities` — every windowed assertion returns 3.

    it('PRUNES the log on the same retention clock as the store', () => {
        enableCollector(userRoot);
        const day = (iso: string): number => Date.parse(`${iso}T12:00:00Z`);
        recordOpportunity('session_start', 'claude', userRoot, day('2026-01-01'));
        recordOpportunity('session_start', 'claude', userRoot, day('2026-06-01'));
        expect(readOpportunities(userRoot).total).toBe(2);

        // 63 days before 2026-06-02 is 2026-03-31, so January goes and June stays.
        const dropped = pruneOpportunitiesOlderThan(userRoot, '2026-06-02');
        expect(dropped).toBe(1);
        expect(readOpportunities(userRoot).total).toBe(1);
        expect(readOpportunities(userRoot).firstDate).toBe('2026-06-01');
        // Idempotent: a second prune over the same horizon drops nothing.
        expect(pruneOpportunitiesOlderThan(userRoot, '2026-06-02')).toBe(0);
    });

    // removing_this_constraint_reds_it: make `pruneOpportunitiesOlderThan`
    // return 0 without rewriting — the log keeps growing inside the directory
    // the disk budget ceilings, and a breach STOPS the collector.

    it('KEEPS a line whose date does not parse rather than deleting it', () => {
        enableCollector(userRoot);
        recordOpportunity('session_start', 'claude', userRoot, Date.parse('2026-01-01T00:00:00Z'));
        fs.appendFileSync(denominatorPath(userRoot), 'not-a-date\tsession_start\tclaude\n');
        // Deleting what you cannot classify is how a prune quietly becomes a
        // truncation; the reader already counts it as malformed.
        pruneOpportunitiesOlderThan(userRoot, '2026-06-02');
        const raw = fs.readFileSync(denominatorPath(userRoot), 'utf8');
        expect(raw).toContain('not-a-date');
        expect(readOpportunities(userRoot).malformed).toBe(1);
    });

    it('never throws, whatever the filesystem does', () => {
        enableCollector(userRoot);
        // Make the collector directory unwritable, then ask for a write. A
        // raising counter would make the observer able to fail a dispatch.
        const dir = path.join(userRoot, 'agent-collector');
        fs.chmodSync(dir, 0o500);
        try {
            expect(() => recordOpportunity('session_start', 'claude', userRoot)).not.toThrow();
        } finally {
            fs.chmodSync(dir, 0o700);
        }
    });

    // removing_this_constraint_reds_it: remove the try/catch from
    // `recordOpportunity` — the unwritable directory raises EACCES.
});

describe.runIf(isStoreAvailable())('4.1 — the drain loop', () => {
    it('drains spooled records into the store', () => {
        enableCollector(userRoot);
        expect(spoolRecord(record({ sequence: 1 }), userRoot)).toBe(true);
        expect(spoolRecord(record({ sequence: 2 }), userRoot)).toBe(true);

        const handle = openCollectorStore(userRoot);
        try {
            const result = drainOnce(handle, userRoot);
            expect(result.written).toBe(2);
            expect(result.refused).toBe(0);
            expect(readRecords(handle)).toHaveLength(2);
            // The pending file is claimed away, so a second drain finds nothing.
            expect(fs.existsSync(spoolPendingPath(userRoot))).toBe(false);
            expect(drainOnce(handle, userRoot).written).toBe(0);
        } finally {
            handle.db.close();
        }
    });

    it('re-drains a file left claimed by an unclean stop', () => {
        enableCollector(userRoot);
        spoolRecord(record(), userRoot);
        // Claim without draining: exactly the state a SIGKILL mid-batch leaves.
        const claimed = claimSpool(userRoot);
        expect(claimed).not.toBeNull();
        expect(fs.existsSync(claimed as string)).toBe(true);

        const handle = openCollectorStore(userRoot);
        try {
            expect(drainOnce(handle, userRoot).written).toBe(1);
            expect(fs.existsSync(claimed as string)).toBe(false);
        } finally {
            handle.db.close();
        }
    });

    // removing_this_constraint_reds_it: make `drainOnce` read only the file it
    // just claimed rather than every `draining-*` in the directory — the
    // orphaned batch is never picked up.

    it('REFUSES an invalid record rather than dropping it, and counts the refusal', () => {
        enableCollector(userRoot);
        spoolRecord({ ...record(), repo_path: '/Users/someone/secret' }, userRoot);
        const handle = openCollectorStore(userRoot);
        try {
            const result = drainOnce(handle, userRoot);
            expect(result.written).toBe(0);
            expect(result.refused).toBe(1);
            expect(readRecords(handle)).toHaveLength(0);
        } finally {
            handle.db.close();
        }
    });

    it('spools nothing while the collector is off', () => {
        disableCollector(userRoot);
        expect(spoolRecord(record(), userRoot)).toBe(false);
        expect(fs.existsSync(spoolPendingPath(userRoot))).toBe(false);
    });

    it('stops on the SECOND consecutive budget breach, not the first', async () => {
        enableCollector(userRoot);
        expect(start(userRoot).started).toBe(true);
        const over = {
            cpu_percent: RESOURCE_BUDGETS.cpu_percent.ceiling + 1,
            resident_bytes: 1,
            disk_bytes: 1,
            file_descriptors: 1,
        };
        const summary = await runLoop({ userRoot, beatMs: 1, sample: () => over });
        expect(summary.stoppedBy).toBe('budget');
        expect(summary.exceeded).toEqual(['cpu_percent']);
        // Two iterations, because one reading is a sample and two are a load.
        expect(summary.iterations).toBe(2);
    });

    // removing_this_constraint_reds_it: stop on the first breach
    // (`consecutiveBreaches >= 1`) — `iterations` becomes 1.

    it('stops when the kill switch is pulled mid-run', async () => {
        enableCollector(userRoot);
        expect(start(userRoot).started).toBe(true);
        pullKillSwitch(userRoot);
        const summary = await runLoop({ userRoot, beatMs: 1, maxIterations: 5 });
        expect(summary.stoppedBy).toBe('kill-switch');
    });

    it('releases the lock and removes the heartbeat when it stops', async () => {
        enableCollector(userRoot);
        expect(start(userRoot).started).toBe(true);
        expect(readHeartbeat(userRoot)).not.toBeNull();
        await runLoop({ userRoot, beatMs: 1, maxIterations: 1 });
        expect(readHeartbeat(userRoot)).toBeNull();
        // The next starter can take the lock: no permanent lockout.
        expect(start(userRoot).started).toBe(true);
    });

    // removing_this_constraint_reds_it: drop the `finally { stop(userRoot) }`
    // from `runLoop` — the heartbeat survives and the restart reports
    // `lock-held`.
});

describe('4.1 — resource sampling', () => {
    it('samples all four budgeted resources', () => {
        const reading = sampleResources(userRoot);
        expect(Object.keys(reading).sort()).toEqual([
            'cpu_percent',
            'disk_bytes',
            'file_descriptors',
            'resident_bytes',
        ]);
        expect(reading.resident_bytes).toBeGreaterThan(0);
    });

    it('reports a descriptor count on a platform that exposes one', () => {
        const count = openDescriptorCount();
        // NaN is the honest answer where neither /proc/self/fd nor /dev/fd is
        // readable, and `budgetVerdict` treats it as a breach rather than a
        // pass. Both supported platform rows expose one.
        if (process.platform === 'darwin' || process.platform === 'linux') {
            expect(count).toBeGreaterThan(0);
        }
    });
});
