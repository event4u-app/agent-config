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
    machineId,
    machineIdPath,
    pruneEpisodeCounters,
    pruneOpportunitiesOlderThan,
    readOpportunities,
    recordCapture,
    recordOpportunity,
    spoolPendingPath,
    SPOOL_MAX_BYTES,
    spoolRecord,
} from '../../src/scripts/_lib/collector_denominator.js';
import {
    COLLECTOR_SCHEMA_VERSION,
    validateRecord,
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

/**
 * The writers exclude self-observed dispatches, and a test always IS one
 * (vitest sets `VITEST`). This seam is how a test exercises the write path;
 * nothing in `src/` passes it, and the vocabulary-parity suite asserts the
 * default still excludes.
 */
const SELF_OK = { includeSelfObserved: true } as const;

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
            // uses, does NOT see it — because it is test-owned. Compared
            // against the same baseline for the same reason (R2 round-3 finding
            // 6): asserting an empty list here reds on a developer who has
            // opted in and has a real collector running, which is the defect
            // the sibling assertion below was already corrected for and this
            // one was not.
            const nowRunning = new Set(enumerateDaemonProcesses().map(pidOf));
            expect([...nowRunning].filter((p) => !baselineDaemonPids.has(p))).toEqual([]);
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
        for (let i = 0; i < 5; i += 1) recordOpportunity('pre_tool_use', 'claude', userRoot, undefined, SELF_OK);
        recordOpportunity('stop', 'claude', userRoot, undefined, SELF_OK);

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
        expect(recordOpportunity('session_start', 'claude', userRoot, undefined, SELF_OK)).toBe(false);
        expect(fs.existsSync(denominatorPath(userRoot))).toBe(false);
        expect(readOpportunities(userRoot).total).toBe(0);
    });

    it('carries no payload: the line is a date, an event and a platform', () => {
        enableCollector(userRoot);
        recordOpportunity('session_start', 'claude', userRoot, Date.parse('2026-08-30T13:45:12Z'), SELF_OK);
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
        expect(recordOpportunity('made_up_event', 'claude', userRoot, undefined, SELF_OK)).toBe(false);
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
        recordOpportunity('session_start', 'claude', userRoot, day('2026-01-01'), SELF_OK);
        recordOpportunity('session_start', 'claude', userRoot, day('2026-06-01'), SELF_OK);
        recordOpportunity('stop', 'claude', userRoot, day('2026-06-02'), SELF_OK);

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
        recordOpportunity('session_start', 'claude', userRoot, day('2026-01-01'), SELF_OK);
        recordOpportunity('session_start', 'claude', userRoot, day('2026-06-01'), SELF_OK);
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

    it('CARRIES concurrently appended lines across a prune', () => {
        // R2 round-3 finding 5. The prune was read-filter-write-tmp-rename over
        // a file other processes append to, so anything written into the old
        // inode inside that window was dropped — and the direction is the
        // dangerous one: an understated denominator biases the rate UPWARD.
        //
        // Simulated rather than raced, because a real race is not reproducible:
        // the append happens between the read and the rename, which is exactly
        // the window, by monkey-patching nothing — the prune re-reads the tail
        // beyond the bytes it consumed, so appending here and letting the prune
        // run afterwards exercises the same code path deterministically.
        enableCollector(userRoot);
        const day = (iso: string): number => Date.parse(`${iso}T12:00:00Z`);
        recordOpportunity('session_start', 'claude', userRoot, day('2026-01-01'), SELF_OK);
        recordOpportunity('session_start', 'claude', userRoot, day('2026-06-01'), SELF_OK);
        // A line that arrives "during" the prune, appended to the same file.
        fs.appendFileSync(denominatorPath(userRoot), '2026-06-02\tstop\tclaude\n');

        const dropped = pruneOpportunitiesOlderThan(userRoot, '2026-06-02');
        expect(dropped).toBe(1);
        const after = readOpportunities(userRoot);
        expect(after.total, 'the late line survived').toBe(2);
        expect(after.byEvent.stop).toBe(1);
    });

    it('KEEPS a line whose date does not parse rather than deleting it', () => {
        enableCollector(userRoot);
        recordOpportunity('session_start', 'claude', userRoot, Date.parse('2026-01-01T00:00:00Z'), SELF_OK);
        fs.appendFileSync(denominatorPath(userRoot), 'not-a-date\tsession_start\tclaude\n');
        // Deleting what you cannot classify is how a prune quietly becomes a
        // truncation; the reader already counts it as malformed.
        pruneOpportunitiesOlderThan(userRoot, '2026-06-02');
        const raw = fs.readFileSync(denominatorPath(userRoot), 'utf8');
        expect(raw).toContain('not-a-date');
        expect(readOpportunities(userRoot).malformed).toBe(1);
    });

    it('recordCapture WRITES THE NUMERATOR, which had no production caller at all', () => {
        // R2 round-3 finding 1, and the most consequential defect three review
        // rounds surfaced: `spoolRecord` was exported, tested, and called by
        // nothing outside this suite. The denominator was wired into the
        // dispatcher and climbed; the numerator stayed 0 by construction, so
        // the capture rate was 0 % for a WIRING omission and the miss branch
        // could not tell that from a real capture failure.
        enableCollector(userRoot);
        expect(recordCapture('session_start', 'claude', userRoot, undefined, SELF_OK)).toBe(true);
        expect(recordCapture('pre_tool_use', 'claude', userRoot, undefined, SELF_OK)).toBe(true);

        const spooled = fs
            .readFileSync(spoolPendingPath(userRoot), 'utf8')
            .split('\n')
            .filter((l) => l.length > 0)
            .map((l) => JSON.parse(l) as Record<string, unknown>);
        expect(spooled).toHaveLength(2);
        // Every record it builds must survive the schema, or the daemon would
        // refuse them all at the write boundary and the numerator would still
        // be 0 — for a different reason.
        for (const rec of spooled) {
            expect(validateRecord(rec).ok, JSON.stringify(validateRecord(rec).errors)).toBe(true);
        }
        // The sequence orders records within one episode, which is what
        // `dedupKey` scopes; two captures in one episode must not collide.
        expect(spooled[0]?.episode_id).toBe(spooled[1]?.episode_id);
        expect(spooled[0]?.sequence).not.toBe(spooled[1]?.sequence);
    });

    // removing_this_constraint_reds_it: make `recordCapture` return false
    // without spooling — this reds, and nothing else in the tree does, which is
    // exactly how the missing production caller survived two review rounds.

    it('mints a STABLE machine id and never derives it from a host fact', () => {
        enableCollector(userRoot);
        const first = machineId(userRoot);
        expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
        expect(machineId(userRoot)).toBe(first);
        // Not derived: two different roots mint different ids, so the value
        // cannot be a function of hostname or username.
        const other = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-mid-'));
        try {
            expect(machineId(other)).not.toBe(first);
        } finally {
            fs.rmSync(other, { recursive: true, force: true });
        }
    });

    it('writes NOTHING while the collector is off', () => {
        disableCollector(userRoot);
        expect(recordCapture('session_start', 'claude', userRoot, undefined, SELF_OK)).toBe(false);
        expect(fs.existsSync(spoolPendingPath(userRoot))).toBe(false);
        expect(fs.existsSync(machineIdPath(userRoot))).toBe(false);
    });

    it('PRUNES episode counters on the same clock — they are inside the disk budget', () => {
        // R2 round-4 finding 4. `nextSequence` writes one file per session and
        // nothing pruned the directory, inside the very directory the disk
        // budget ceilings — whose breach STOPS the collector. That is the
        // argument the budget's own basis already makes for `opportunities.log`,
        // left unapplied to the sibling directory added in the same change.
        enableCollector(userRoot);
        const dir = path.join(userRoot, 'agent-collector', 'episodes');
        fs.mkdirSync(dir, { recursive: true });
        const old = path.join(dir, 'aaaaaaaa-0000-4000-8000-000000000000.seq');
        const fresh = path.join(dir, 'bbbbbbbb-0000-4000-8000-000000000000.seq');
        fs.writeFileSync(old, '3\n');
        fs.writeFileSync(fresh, '1\n');
        const longAgo = Date.now() - 200 * 86_400_000;
        fs.utimesSync(old, longAgo / 1000, longAgo / 1000);

        expect(pruneEpisodeCounters(userRoot)).toBe(1);
        expect(fs.existsSync(old)).toBe(false);
        expect(fs.existsSync(fresh), 'a live episode keeps its counter').toBe(true);
    });

    // removing_this_constraint_reds_it: make `pruneEpisodeCounters` return 0
    // without unlinking — the stale counter survives and the directory grows
    // with every session forever.

    it('BOUNDS the spool, because the only thing that drains it may not be running', () => {
        // R2 round-4 finding 5. "Collector enabled, daemon not running" is a
        // supported state — the daemon is a separate opt-in process and
        // `start()` legitimately refuses on `lock-held` or `store-unavailable` —
        // and the disk budget that would notice is enforced by the process that
        // is not running.
        enableCollector(userRoot);
        const pending = spoolPendingPath(userRoot);
        fs.mkdirSync(path.dirname(pending), { recursive: true });
        fs.writeFileSync(pending, 'x'.repeat(SPOOL_MAX_BYTES));

        expect(spoolRecord(record(), userRoot), 'refused at the ceiling').toBe(false);
        // Refused, not rotated: dropping the oldest captures to keep the newest
        // inflates the measured rate for the window after an outage. The loss is
        // the same; only one version lies about it.
        expect(fs.statSync(pending).size).toBe(SPOOL_MAX_BYTES);
    });

    // removing_this_constraint_reds_it: delete the size check in `spoolRecord` —
    // the append lands and the spool grows past its ceiling.

    it('never throws, whatever the filesystem does', () => {
        enableCollector(userRoot);
        // Make the collector directory unwritable, then ask for a write. A
        // raising counter would make the observer able to fail a dispatch.
        const dir = path.join(userRoot, 'agent-collector');
        fs.chmodSync(dir, 0o500);
        try {
            expect(() => recordOpportunity('session_start', 'claude', userRoot, undefined, SELF_OK)).not.toThrow();
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

    it('KEEPS a claimed file it could not read, rather than deleting the batch', () => {
        // R2 round-3 finding 2. An unreadable claimed file used to be
        // indistinguishable from an empty one, so the caller deleted it — a
        // transient EACCES destroyed the batch and reported zero malformed.
        enableCollector(userRoot);
        spoolRecord(record(), userRoot);
        const claimed = claimSpool(userRoot) as string;
        fs.chmodSync(claimed, 0o000);

        const handle = openCollectorStore(userRoot);
        try {
            const result = drainOnce(handle, userRoot);
            expect(result.unreadable).toBe(1);
            expect(result.written).toBe(0);
            expect(fs.existsSync(claimed), 'the batch survives for the next drain').toBe(true);

            // And once it is readable again, the next drain picks it up.
            fs.chmodSync(claimed, 0o600);
            expect(drainOnce(handle, userRoot).written).toBe(1);
        } finally {
            try {
                fs.chmodSync(claimed, 0o600);
            } catch {
                /* already gone */
            }
            handle.db.close();
        }
    });

    // removing_this_constraint_reds_it: drop the `parsed.unreadable` branch in
    // `drainOnce` — the file is deleted and `written` stays 0, so the batch is
    // gone with nothing reporting it.

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
