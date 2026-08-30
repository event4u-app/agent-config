// The collector's operational contract — resource budgets, the kill switch,
// and static-vs-daemon exclusivity.
//
// `road-to-supervised-telemetry-collector` Phase 3 steps 3.2, 3.3 and 3.4
// (AC-6). Each step's `verify:` names a *test*, not a document, and the three
// verify clauses are transcribed at the head of their describe block so a
// reader can check the test against the obligation rather than against its own
// title.
//
// Every block carries a `removing_this_constraint_reds_it` note on the pattern
// `collector_store.test.ts` set — the sensitivity claim per constraint, not one
// blanket claim for the file. The step 3.3 block additionally spawns a REAL
// unresponsive process, because a mocked SIGKILL proves nothing about a wedged
// collector and the step says so.

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    acquireRuntimeLock,
    budgetVerdict,
    clearKillSwitch,
    detectSupervisor,
    DISPATCH_MODE_CONTRACT,
    headroomAtPeak,
    HEARTBEAT_STALE_AFTER_MS,
    killSwitchEngaged,
    killSwitchPath,
    livenessFromBeat,
    pullKillSwitch,
    readHeartbeat,
    releaseHeartbeat,
    releaseRuntimeLock,
    resolveDispatchMode,
    RESOURCE_BUDGETS,
    runtimeLockPath,
    terminateCollector,
    writeHeartbeat,
    type BudgetName,
    type ResourceReading,
} from '../../src/scripts/_lib/collector_supervision.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');

let userRoot: string;

beforeEach(() => {
    userRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-supervision-'));
});

afterEach(() => {
    fs.rmSync(userRoot, { recursive: true, force: true });
});

function reading(over: Partial<ResourceReading> = {}): ResourceReading {
    return {
        cpu_percent: 0.1,
        resident_bytes: 50 * 1024 * 1024,
        disk_bytes: 5 * 1024 * 1024,
        file_descriptors: 9,
        ...over,
    };
}

const BUDGET_NAMES = Object.keys(RESOURCE_BUDGETS) as BudgetName[];

/**
 * A pid that is provably gone: spawn a child that exits immediately and await
 * its `exit` event, which is also the point Node reaps it — so `kill(pid, 0)`
 * raises `ESRCH` rather than succeeding against a zombie.
 *
 * A synchronous busy-wait cannot do this. `Atomics.wait` blocks the main
 * thread, the `exit` event never fires, the child is never reaped, and the pid
 * stays "alive" to `kill(pid, 0)` — which is exactly how the first draft of
 * these two tests failed.
 */
async function deadPid(): Promise<number> {
    const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
    const pid = child.pid as number;
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));
    return pid;
}

describe('3.2 — resource budgets are numbers with headroom', () => {
    // verify: the budgets are recorded and a test asserts the collector is
    // stopped when each is exceeded.

    it('records four budgets, each with a ceiling, an expected peak and a stated basis', () => {
        expect(BUDGET_NAMES).toEqual([
            'cpu_percent',
            'resident_bytes',
            'disk_bytes',
            'file_descriptors',
        ]);
        for (const name of BUDGET_NAMES) {
            const budget = RESOURCE_BUDGETS[name];
            expect(budget.ceiling, `${name} ceiling`).toBeGreaterThan(0);
            expect(budget.unit.length, `${name} unit`).toBeGreaterThan(0);
            // An unquantified ceiling is not headroom: the peak must be a real
            // number strictly below the ceiling, or the headroom is zero or
            // negative and the budget is decorative.
            expect(budget.expectedPeak, `${name} expectedPeak`).toBeGreaterThan(0);
            expect(budget.expectedPeak, `${name} peak below ceiling`).toBeLessThan(budget.ceiling);
            expect(headroomAtPeak(name), `${name} headroom`).toBeGreaterThan(0);
            // A number with no basis is a guess. 40 characters is not a quality
            // bar, it is a floor against the empty string and the word "TBD".
            expect(budget.basis.length, `${name} basis`).toBeGreaterThan(40);
        }
    });

    // removing_this_constraint_reds_it: set any `expectedPeak` to its
    // `ceiling` — the peak-below-ceiling assertion and `headroomAtPeak` both
    // red for that row.

    it('stops the collector when EACH budget individually is exceeded', () => {
        for (const name of BUDGET_NAMES) {
            const verdict = budgetVerdict(reading({ [name]: RESOURCE_BUDGETS[name].ceiling + 1 }));
            expect(verdict.action, `${name} breach`).toBe('stop');
            expect(verdict.exceeded).toEqual([name]);
            expect(verdict.reasons.join(' ')).toContain(name);
        }
    });

    // removing_this_constraint_reds_it: change `budgetVerdict`'s comparison to
    // `>=`… no — that keeps this green and reds the at-ceiling test below.
    // The edit that reds THIS one is returning `'continue'` unconditionally, or
    // dropping any single budget from `RESOURCE_BUDGETS`.

    it('treats a reading exactly AT the ceiling as inside it', () => {
        for (const name of BUDGET_NAMES) {
            const verdict = budgetVerdict(reading({ [name]: RESOURCE_BUDGETS[name].ceiling }));
            expect(verdict.action, `${name} at ceiling`).toBe('continue');
            expect(verdict.exceeded).toEqual([]);
        }
    });

    // removing_this_constraint_reds_it: flip the comparison in `budgetVerdict`
    // from `>` to `>=` — all four rows red here and none red above.

    it('treats a missing or non-finite reading as a breach, never as a pass', () => {
        const partial = { ...reading() } as Record<string, unknown>;
        delete partial.file_descriptors;
        const verdict = budgetVerdict(partial as ResourceReading);
        expect(verdict.action).toBe('stop');
        expect(verdict.exceeded).toEqual(['file_descriptors']);
        expect(verdict.reasons.join(' ')).toContain('a missing reading is a breach');

        expect(budgetVerdict(reading({ cpu_percent: Number.NaN })).action).toBe('stop');
    });

    // removing_this_constraint_reds_it: make the `typeof value !== 'number'`
    // branch `continue` without pushing to `exceeded` — this reds, and nothing
    // else does, because every other block supplies all four readings.

    it('reports every exceeded budget, not just the first', () => {
        const verdict = budgetVerdict(
            reading({
                cpu_percent: RESOURCE_BUDGETS.cpu_percent.ceiling + 1,
                disk_bytes: RESOURCE_BUDGETS.disk_bytes.ceiling + 1,
            }),
        );
        expect(verdict.exceeded).toEqual(['cpu_percent', 'disk_bytes']);
        expect(verdict.reasons).toHaveLength(2);
    });

    // removing_this_constraint_reds_it: return from `budgetVerdict` on the
    // first breach instead of collecting them.
});

describe('3.3 — the kill switch, reachable without the collector cooperating', () => {
    // verify: a test kills a wedged collector through the documented mechanism
    // with the process unresponsive to graceful shutdown.

    it('is a marker file an operator can create by hand', () => {
        expect(killSwitchEngaged(userRoot)).toBe(false);
        pullKillSwitch(userRoot);
        expect(killSwitchEngaged(userRoot)).toBe(true);
        // The whole signal is presence. Content is documentation for the human
        // who finds it, never something a reader has to parse correctly.
        expect(fs.readFileSync(killSwitchPath(userRoot), 'utf8')).toContain('Delete this file');
        clearKillSwitch(userRoot);
        expect(killSwitchEngaged(userRoot)).toBe(false);
    });

    // removing_this_constraint_reds_it: make `killSwitchEngaged` read the file
    // contents instead of testing existence — `pullKillSwitch` then has to be
    // parsed correctly and a `touch`ed empty file stops working.

    it('refuses activation while engaged: the lock cannot be taken', () => {
        pullKillSwitch(userRoot);
        const outcome = acquireRuntimeLock(userRoot, 4242);
        expect(outcome.acquired).toBe(false);
        expect(outcome.reason).toBe('kill-switch-engaged');
        expect(fs.existsSync(runtimeLockPath(userRoot))).toBe(false);
    });

    // removing_this_constraint_reds_it: drop the `killSwitchEngaged` guard at
    // the top of `acquireRuntimeLock`.

    it('KILLS A REAL WEDGED PROCESS that ignores SIGTERM', async () => {
        // The step's binding clause. A child that installs a SIGTERM handler and
        // does nothing with it is a wedged collector in the only sense that
        // matters — graceful shutdown is offered and declined — and a mocked
        // `kill` would demonstrate the escalation logic while proving nothing
        // about the signal actually landing.
        //
        // The wedged process is deliberately a GRANDCHILD, re-parented to init
        // when its launching shell exits. Two reasons, and the second is the one
        // that cost a debugging round: it matches reality (the collector is
        // never a child of the CLI that kills it), and a direct child would stay
        // a ZOMBIE after SIGKILL — `kill(pid, 0)` succeeds against an unreaped
        // child, and `terminateCollector` is synchronous, so the event loop that
        // would reap it never runs. A re-parented process is reaped by init and
        // reports ESRCH honestly.
        //
        // The readiness file is not ceremony either: Node installs the SIGTERM
        // handler only once the script runs, so a signal sent during interpreter
        // startup takes the DEFAULT action and the process dies gracefully — a
        // green `graceful` verdict for a test whose whole point is the
        // escalation. Waiting for the handler to exist removes that race.
        const readyFile = path.join(userRoot, 'wedged-ready');
        const wedged =
            `process.on('SIGTERM', () => {}); `
            + `require('fs').writeFileSync(${JSON.stringify(readyFile)}, 'ready'); `
            + `setInterval(() => {}, 1000);`;
        const launcher = spawn(
            '/bin/sh',
            ['-c', `${JSON.stringify(process.execPath)} -e ${JSON.stringify(wedged)} & echo $!`],
            { stdio: ['ignore', 'pipe', 'ignore'] },
        );
        let out = '';
        launcher.stdout.on('data', (chunk: Buffer) => {
            out += chunk.toString();
        });
        await new Promise<void>((resolve) => launcher.once('exit', () => resolve()));
        const pid = Number.parseInt(out.trim(), 10);
        expect(Number.isFinite(pid), `launcher printed a pid (got ${JSON.stringify(out)})`).toBe(true);

        const readyBy = Date.now() + 10_000;
        while (!fs.existsSync(readyFile) && Date.now() < readyBy) {
            await new Promise<void>((resolve) => setTimeout(resolve, 25));
        }
        expect(fs.existsSync(readyFile), 'the wedged process installed its SIGTERM handler').toBe(true);

        try {
            const now = Date.now();
            writeHeartbeat(
                { pid, started_at: now, last_heartbeat: now, mode: 'degraded' },
                userRoot,
            );

            const outcome = terminateCollector(userRoot, { graceMs: 600, pollMs: 50 });
            expect(outcome.stopped).toBe(true);
            // `graceful` here would mean the process honoured SIGTERM, which it
            // is written not to. `forced` is the assertion that the escalation
            // is what ended it.
            expect(outcome.via).toBe('forced');
            expect(outcome.pid).toBe(pid);
            expect(() => process.kill(pid, 0)).toThrow();
        } finally {
            try {
                process.kill(pid, 'SIGKILL');
            } catch {
                /* already gone — the assertion above is what matters */
            }
        }
    });

    // removing_this_constraint_reds_it: delete the SIGKILL escalation block in
    // `terminateCollector` and return `unreachable` after the grace loop. The
    // child survives, `stopped` is false, and `signalCode` is null.

    it('reports already-absent when nothing is running, and that is a success', async () => {
        expect(terminateCollector(userRoot).via).toBe('already-absent');

        const now = Date.now();
        const gone = await deadPid();
        writeHeartbeat(
            { pid: gone, started_at: now, last_heartbeat: now, mode: 'degraded' },
            userRoot,
        );
        const outcome = terminateCollector(userRoot, { graceMs: 200, pollMs: 25 });
        expect(outcome.stopped).toBe(true);
        expect(outcome.via).toBe('already-absent');
    });

    // removing_this_constraint_reds_it: remove the `!alive(beat.pid)` early
    // return — the outcome becomes `graceful` or `unreachable`, never
    // `already-absent`.

    it('REFUSES to signal a stale heartbeat, because the pid may be recycled', () => {
        // R2 finding 9. `pidIsAlive` cannot tell the original daemon from
        // whatever the OS has since put on that pid number, and PROPERTY 3
        // establishes that a SIGKILLed daemon leaves its heartbeat on disk
        // indefinitely. So an old beat plus a live pid is not evidence — and
        // the worst thing this module can do is SIGKILL a stranger.
        const now = Date.now();
        writeHeartbeat(
            {
                pid: process.pid,
                started_at: now - 600_000,
                last_heartbeat: now - HEARTBEAT_STALE_AFTER_MS - 1,
                mode: 'degraded',
            },
            userRoot,
        );
        const signalled: string[] = [];
        const outcome = terminateCollector(userRoot, {
            kill: (_pid, sig) => signalled.push(sig),
            alive: () => true,
        });
        expect(outcome.via).toBe('stale-refused');
        expect(outcome.stopped).toBe(false);
        expect(signalled, 'nothing was signalled').toEqual([]);
    });

    // removing_this_constraint_reds_it: drop the `livenessFromBeat` guard from
    // `terminateCollector` — SIGTERM and then SIGKILL are sent to the stale pid.

    it('signals a stale beat when the operator says so explicitly', () => {
        const now = Date.now();
        writeHeartbeat(
            {
                pid: process.pid,
                started_at: now - 600_000,
                last_heartbeat: now - HEARTBEAT_STALE_AFTER_MS - 1,
                mode: 'degraded',
            },
            userRoot,
        );
        const signalled: string[] = [];
        let liveCalls = 0;
        const outcome = terminateCollector(userRoot, {
            signalStale: true,
            graceMs: 100,
            pollMs: 10,
            kill: (_pid, sig) => signalled.push(sig),
            alive: () => {
                liveCalls += 1;
                return liveCalls < 3;
            },
            sleep: () => undefined,
        });
        expect(signalled[0]).toBe('SIGTERM');
        expect(outcome.stopped).toBe(true);
    });
});

describe('3.4 — static and daemon mode against the same tree', () => {
    // verify: a test asserts the declared behaviour — either concurrent
    // operation is correct and proven, or it is prevented and the prevention is
    // proven. This roadmap declares it PREVENTED; these tests prove the
    // prevention rather than the correctness of something that never happens.

    it('declares concurrent operation refused, and names what prevents it', () => {
        expect(DISPATCH_MODE_CONTRACT.concurrentOperationPermitted).toBe(false);
        expect(DISPATCH_MODE_CONTRACT.preventedBy).toContain('runtime lock');
        expect(DISPATCH_MODE_CONTRACT.loserBehaviour).toBe('static');
    });

    it('gives the lock to exactly one of two contenders for the same OS user', () => {
        // Two checkouts, one user root — the worktree case
        // `resident-process-floors` § 2 Q5 calls the common one here.
        const first = acquireRuntimeLock(userRoot, process.pid);
        expect(first.acquired).toBe(true);

        const second = acquireRuntimeLock(userRoot, process.pid + 1);
        expect(second.acquired).toBe(false);
        expect(second.reason).toBe('held-by-live-process');
        expect(second.holder).toBe(process.pid);
    });

    // removing_this_constraint_reds_it: drop the `wx` flag from the
    // `writeFileSync` in `acquireRuntimeLock` — both contenders acquire.

    it('routes the losing contender to static mode, not to a second writer', () => {
        acquireRuntimeLock(userRoot, process.pid);
        const resolution = resolveDispatchMode(userRoot);
        expect(resolution.mode).toBe('static');
        expect(resolution.incumbent).toBe(process.pid);
        expect(resolution.reason).toContain('already live');
    });

    it('fences a stale lock rather than locking the successor out forever', async () => {
        // A crashed collector's lock: a pid that is provably not alive.
        const gone = await deadPid();
        fs.mkdirSync(path.dirname(runtimeLockPath(userRoot)), { recursive: true });
        fs.writeFileSync(runtimeLockPath(userRoot), `${gone}\n`);

        expect(resolveDispatchMode(userRoot).mode).toBe('daemon');
        const outcome = acquireRuntimeLock(userRoot, process.pid);
        expect(outcome.acquired).toBe(true);
        expect(fs.readFileSync(runtimeLockPath(userRoot), 'utf8').trim()).toBe(String(process.pid));
    });

    // removing_this_constraint_reds_it: return `held-by-live-process`
    // unconditionally in the `catch` of `acquireRuntimeLock` instead of probing
    // liveness — the crashed owner's lock becomes permanent.

    it('resolves to static while the kill switch is engaged, whatever the lock says', () => {
        pullKillSwitch(userRoot);
        const resolution = resolveDispatchMode(userRoot);
        expect(resolution.mode).toBe('static');
        expect(resolution.reason).toContain('kill switch');
    });

    it('releases idempotently', () => {
        acquireRuntimeLock(userRoot, process.pid);
        expect(releaseRuntimeLock(userRoot)).toBe(true);
        expect(releaseRuntimeLock(userRoot)).toBe(false);
        expect(resolveDispatchMode(userRoot).mode).toBe('daemon');
    });

    it('a FENCED predecessor does not delete the successor\'s lock (R2 finding 10)', () => {
        // The predecessor holds, is fenced, and then tears down through its
        // own `finally`. An unconditional rmSync there removed the SUCCESSOR's
        // lock, so the next starter also acquired — the one-collector invariant
        // broken by the cleanup path rather than by the acquire path.
        const predecessor = process.pid + 1;
        acquireRuntimeLock(userRoot, predecessor);
        fs.writeFileSync(runtimeLockPath(userRoot), `${process.pid}\n`); // successor fenced it

        expect(releaseRuntimeLock(userRoot, predecessor)).toBe(false);
        expect(fs.existsSync(runtimeLockPath(userRoot))).toBe(true);
        expect(fs.readFileSync(runtimeLockPath(userRoot), 'utf8').trim()).toBe(String(process.pid));
    });

    // removing_this_constraint_reds_it: drop the pid comparison from
    // `releaseRuntimeLock` — the successor's lock file disappears.

    it('a FENCED predecessor does not delete the successor\'s heartbeat', () => {
        const now = Date.now();
        writeHeartbeat(
            { pid: process.pid, started_at: now, last_heartbeat: now, mode: 'degraded' },
            userRoot,
        );
        // The predecessor tries to clean up its own beat; the beat on disk is
        // the successor's. Removing it would report `absent` for a RUNNING
        // collector, which inverts the whole three-valued liveness design.
        expect(releaseHeartbeat(userRoot, process.pid + 1)).toBe(false);
        expect(readHeartbeat(userRoot)).not.toBeNull();
        expect(releaseHeartbeat(userRoot, process.pid)).toBe(true);
        expect(readHeartbeat(userRoot)).toBeNull();
    });

    it('a vanished lock is RETRIED exclusively, never overwritten (R2 finding 2)', () => {
        // `readLockPid` returning null used to take the fencing branch, so a
        // concurrent release between the failed `wx` and the read handed the
        // lock to a second starter. Now the loop retries `wx`, which is the
        // only winner-picker.
        expect(acquireRuntimeLock(userRoot, process.pid).acquired).toBe(true);
        releaseRuntimeLock(userRoot, process.pid);
        const second = acquireRuntimeLock(userRoot, process.pid + 1);
        expect(second.acquired).toBe(true);
        expect(fs.readFileSync(runtimeLockPath(userRoot), 'utf8').trim())
            .toBe(String(process.pid + 1));
    });

    it('CONCURRENT fencers of one dead lock produce exactly one winner', async () => {
        const gone = await deadPid();
        fs.mkdirSync(path.dirname(runtimeLockPath(userRoot)), { recursive: true });
        fs.writeFileSync(runtimeLockPath(userRoot), `${gone}\n`);

        // Two REAL processes, each acquiring under its OWN pid and then holding
        // for a moment before exiting. Both details matter and the first draft
        // had neither: fake pids are not alive, so the second contender
        // correctly fences the first and both legitimately acquire — the test
        // measured its own fixture rather than the race. And a contender that
        // exits immediately is not an incumbent anyone can lose to.
        const module = path.join(REPO, 'src/scripts/_lib/collector_supervision.ts');
        const script =
            `import(${JSON.stringify(module)}).then((m) => {`
            + ` const r = m.acquireRuntimeLock(${JSON.stringify(userRoot)});`
            + ` process.stdout.write(JSON.stringify({ ...r, mine: process.pid }));`
            + ` if (r.acquired) { const t = Date.now(); while (Date.now() - t < 1500) {} }`
            + ` });`;
        const runs = await Promise.all(
            [0, 1].map(
                () =>
                    new Promise<string>((resolve) => {
                        const child = spawn(TSX, ['-e', script], {
                            stdio: ['ignore', 'pipe', 'ignore'],
                        });
                        let out = '';
                        child.stdout.on('data', (c: Buffer) => {
                            out += c.toString();
                        });
                        child.once('exit', () => resolve(out));
                    }),
            ),
        );
        const acquired = runs.filter((r) => {
            try {
                return (JSON.parse(r) as { acquired: boolean }).acquired;
            } catch {
                return false;
            }
        });
        // At least one must win — a stale lock that locks everyone out forever
        // is the other half of row 2's recovery procedure.
        expect(acquired.length, `both outcomes: ${runs.join(' | ')}`).toBeGreaterThanOrEqual(1);
        expect(acquired.length, `both outcomes: ${runs.join(' | ')}`).toBeLessThanOrEqual(2);
        // The honest statement: two `tsx` cold starts do not reliably overlap,
        // so a run where the first has already finished holding is a legitimate
        // sequential fence and both acquiring is correct. What this case pins is
        // that whenever they DO overlap, the lock names exactly one of them.
        const lockPid = fs.readFileSync(runtimeLockPath(userRoot), 'utf8').trim();
        const mine = runs.map((r) => {
            try {
                return String((JSON.parse(r) as { mine: number }).mine);
            } catch {
                return '';
            }
        });
        expect(mine, `lock names one contender (${lockPid})`).toContain(lockPid);
    }, 60_000);

    // removing_this_constraint_reds_it: nothing in this block reds on the old
    // fencing branch, and that is stated rather than claimed away. Two `tsx`
    // cold starts do not overlap reliably enough to hit a microsecond-wide
    // compare-then-write window from a test, so this case is a NECESSARY
    // condition on the invariant — the lock names exactly one contender — and
    // not a reproduction of the race. The argument for the fix is structural:
    // `wx` is now the only path that ever returns `acquired: true`.
});

describe('heartbeat — a dead collector is readable as dead, not as healthy', () => {
    it('is three-valued: absent, stale, running', () => {
        const now = Date.now();
        expect(livenessFromBeat(null, now)).toBe('absent');
        expect(
            livenessFromBeat(
                { pid: 1, started_at: now, last_heartbeat: now, mode: 'supervised' },
                now,
            ),
        ).toBe('running');
        expect(
            livenessFromBeat(
                {
                    pid: 1,
                    started_at: now,
                    last_heartbeat: now - HEARTBEAT_STALE_AFTER_MS - 1,
                    mode: 'supervised',
                },
                now,
            ),
        ).toBe('stale');
    });

    // removing_this_constraint_reds_it: collapse `livenessFromBeat` to a
    // boolean (`beat !== null`) — the stale case reports running, which is the
    // silently-dead-collector failure the supervisor blocker named as decisive.

    it('round-trips whole, and reads an unparseable beat as absent', () => {
        const now = Date.now();
        const beat = { pid: 99, started_at: now - 10, last_heartbeat: now, mode: 'supervised' as const };
        writeHeartbeat(beat, userRoot);
        expect(readHeartbeat(userRoot)).toEqual(beat);

        fs.writeFileSync(path.join(userRoot, 'agent-collector', 'heartbeat.json'), '{ tru');
        expect(readHeartbeat(userRoot)).toBeNull();
        expect(livenessFromBeat(readHeartbeat(userRoot))).toBe('absent');
    });

    // removing_this_constraint_reds_it: remove the try/catch in
    // `readHeartbeat` — the truncated file throws instead of reading as absent.
});

describe('supervisor detection — probed, never assumed', () => {
    it('accepts macOS only when the per-user agent directory is REACHABLE', () => {
        // R2 finding 17: this branch used to return `supported` unconditionally
        // and never consult the injected predicate, under a heading that says
        // "probed, never assumed" — and it is the one row the CI job certifies.
        const probe = detectSupervisor({
            platform: 'darwin',
            env: { HOME: '/Users/someone' },
            exists: (p) => p === '/Users/someone/Library/LaunchAgents',
        });
        expect(probe.kind).toBe('launchd-user');
        expect(probe.tier).toBe('supported');
        expect(probe.reason).toContain('no administrator privilege');
    });

    it('routes a darwin home with no Library at all to static fallback', () => {
        const probe = detectSupervisor({
            platform: 'darwin',
            env: { HOME: '/var/empty' },
            exists: () => false,
        });
        expect(probe.kind).toBe('none');
        expect(probe.tier).toBe('static-fallback');
        expect(probe.reason).toContain('per-user agent directory');
    });

    // removing_this_constraint_reds_it: return `supported` unconditionally from
    // the darwin branch — the fallback case reds, and the accepted case does
    // not, which is exactly the asymmetry an assume-instead-of-probe has.

    it('accepts Linux ONLY with a positively detected user session bus', () => {
        expect(
            detectSupervisor({
                platform: 'linux',
                env: { DBUS_SESSION_BUS_ADDRESS: 'unix:path=/run/user/1000/bus' },
            }).tier,
        ).toBe('supported');

        expect(
            detectSupervisor({
                platform: 'linux',
                env: { XDG_RUNTIME_DIR: '/run/user/1000' },
                exists: (p) => p === path.join('/run/user/1000', 'systemd', 'private'),
            }).tier,
        ).toBe('supported');
    });

    it('routes a bus-less Linux (container, CI runner) to static fallback', () => {
        const probe = detectSupervisor({ platform: 'linux', env: {}, exists: () => false });
        expect(probe.kind).toBe('none');
        expect(probe.tier).toBe('static-fallback');
        expect(probe.reason).toContain('systemd being installed is not the condition');
    });

    // removing_this_constraint_reds_it: make the linux branch return
    // `systemd-user` unconditionally — this reds and the two supported cases
    // stay green, which is exactly the assume-instead-of-probe defect the
    // supervisor blocker's wording exists to prevent.

    it('records Windows as unevaluated rather than refused', () => {
        const probe = detectSupervisor({ platform: 'win32', env: {} });
        expect(probe.tier).toBe('static-fallback');
        expect(probe.reason).toContain('unevaluated, not refused');
    });
});
