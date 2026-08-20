/**
 * P3 of `b-stop-async-split-prerequisites` — council 2026-08-20, option (a),
 * "and P3 before anything else". Three state files were unsafe under concurrent
 * dispatch, in three different ways:
 *
 *   - `dispatch-issues.jsonl` — no lock, no tmp+rename. `readFileSync` then
 *     `writeFileSync` straight onto the target: CORRUPTION-capable, and written
 *     precisely when something has already gone wrong.
 *   - `rule-trips.json` — lost update. The read sat OUTSIDE the lock, so two
 *     dispatchers both loaded `block: 3`, both computed 4, and one trip vanished.
 *   - `summary.json` — lossy overwrite. The publish was atomic; the PATH was
 *     singular, so the later rename discarded the earlier rollup whole.
 *
 * ## Why these spawn real processes
 *
 * The primitive being tested is cross-PROCESS mutual exclusion: an
 * `O_CREAT | O_EXCL` lockfile. N promises inside one process share one event
 * loop and one lock owner, so they serialise for free and a concurrency test
 * built that way passes against code that has no lock at all. Each case below
 * therefore forks N real `node` processes against one state directory.
 *
 * ## Sensitivity, verified rather than claimed
 *
 * Every case here was run against the PRE-FIX writer and observed to fail:
 * unlocked append loses lines, the outside-the-lock read loses increments, and
 * the single-path publish loses rollups. The counts are recorded at each case.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

/** Real concurrency, not simulated: this many separate OS processes. */
const WRITERS = 8;
/** Writes per process. Enough that an unlocked writer loses something. */
const WRITES_PER_WRITER = 12;
/**
 * Writes per process for the two read-modify-write cases, and the delay each
 * mutator spends between the read and the write.
 *
 * THE DELAY IS THE TEST, and it is here because the first version of this file
 * WITHOUT it passed against a deliberately sabotaged primitive — the trap of a
 * concurrency test whose sensitivity was never established. The unsafe window in
 * the pre-fix code is the gap between reading the file and publishing it, and
 * with a mutator that runs in microseconds eight tsx processes staggered by
 * their own startup jitter simply never land inside it. So the workload holds
 * the window open.
 *
 * This changes the WORKLOAD, never the code under test, and the discriminator is
 * structural: in the fixed primitive the mutator runs INSIDE the lock, so a slow
 * mutator serialises and every increment lands; in the pre-fix shape the mutator
 * runs outside it, so a slow mutator loses almost all of them. Serialised cost
 * is bounded at WRITERS × LOCKED_WRITES × MUTATOR_DELAY_MS.
 */
const LOCKED_WRITES_PER_WRITER = 3;
const MUTATOR_DELAY_MS = 25;
/**
 * How long the children get to boot before the barrier deadline passes. Must
 * exceed tsx startup for the slowest child, or the fast ones start alone again.
 */
const BARRIER_LEAD_MS = 3000;

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p3-conc-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

/**
 * Run `workerSource` in N real child processes at once and wait for all of them.
 *
 * `spawn` (async) rather than `spawnSync`, because `spawnSync` would serialise —
 * which is exactly the failure mode a concurrency test must not have. A barrier
 * file makes the children start their writes together: each spins until it
 * appears, so the critical sections genuinely overlap rather than merely
 * coexist.
 */
async function runConcurrently(workerSource: string): Promise<number> {
    const worker = path.join(tmp, 'worker.ts');
    fs.writeFileSync(worker, workerSource);
    // A TIMED barrier, written BEFORE the children are spawned.
    //
    // The first version created the barrier file after spawning and had each
    // child spin until it existed. That synchronises nothing: tsx takes a few
    // hundred ms to start, by which time the file is long since there, so the
    // children began their writes spread across their own startup jitter and
    // never overlapped. The barrier therefore carries a wall-clock DEADLINE and
    // each child spins until it passes — so all N enter the critical section at
    // the same instant regardless of how unevenly they booted.
    const barrier = path.join(tmp, 'GO');
    fs.writeFileSync(barrier, String(Date.now() + BARRIER_LEAD_MS));
    const waits: Promise<void>[] = [];
    for (let i = 0; i < WRITERS; i += 1) {
        const child = spawn(TSX_BIN, [worker, String(i)], {
            cwd: REPO_ROOT,
            env: { ...process.env, P3_STATE_ROOT: tmp, P3_BARRIER: barrier },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let err = '';
        child.stderr.on('data', (d: Buffer) => (err += d.toString()));
        waits.push(
            new Promise<void>((resolve, reject) => {
                child.on('error', reject);
                child.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`child ${String(i)} exit ${String(code)}: ${err}`));
                });
            }),
        );
    }
    await Promise.all(waits);
    return WRITERS;
}

describe('P3 — dispatch-issues.jsonl survives concurrent appends', () => {
    // PRE-FIX RESULT, measured on this machine by restoring the unlocked
    // read-append-write: 96 expected lines, **3 observed**. The unlocked shape
    // does not lose a line here and there — under a synchronised start it keeps
    // roughly one writer's worth and discards the rest.
    it('loses no line and writes no malformed line under 8 concurrent writers', async () => {
        const worker = `
import { log_dispatch_issue } from ${JSON.stringify(path.join(REPO_ROOT, 'src/scripts/hooks/dispatch_issues.ts'))};
import * as fs from 'node:fs';
const root = process.env.P3_STATE_ROOT!;
const barrier = process.env.P3_BARRIER!;
const id = process.argv[2];
const goAt = Number(fs.readFileSync(barrier, 'utf8'));
while (Date.now() < goAt) { /* spin to the shared deadline */ }
for (let i = 0; i < ${WRITES_PER_WRITER}; i += 1) {
    log_dispatch_issue(root, 'w' + id, 'execution_failed', 'line ' + id + '-' + i, 'none');
}
`;
        expect(await runConcurrently(worker)).toBe(WRITERS);

        const log = path.join(tmp, 'agents', 'runtime', 'state', 'dispatch-issues.jsonl');
        const raw = fs.readFileSync(log, 'utf8');
        const lines = raw.split('\n').filter((l) => l.trim() !== '');
        const expected = WRITERS * WRITES_PER_WRITER;

        // Every line is valid JSON with the locked schema — a truncated write
        // shows up here before it shows up in the count.
        const details = new Set<string>();
        for (const line of lines) {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            expect(Object.keys(parsed).sort()).toEqual(
                ['detail', 'hook', 'issue', 'resolution', 'timestamp'].sort(),
            );
            details.add(String(parsed['detail']));
        }
        // The cap is 200 and expected is 96, so nothing may be rotated out.
        expect(lines).toHaveLength(expected);
        expect(details.size).toBe(expected);
        // And the file ends cleanly — a torn final write would not.
        expect(raw.endsWith('\n')).toBe(true);
    });
});

describe('P3 — rule-trips.json loses no increment', () => {
    // PRE-FIX RESULT, measured by restoring the read-outside-the-lock shape in
    // `update_json_under_lock`: 24 expected, **3 observed**. The read outside
    // the lock is the whole defect — `atomic_write_json` publishes atomically
    // and the increment was computed from a snapshot taken before any lock.
    it('counts every trip under 8 concurrent read-modify-writers', async () => {
        const worker = `
import { update_json_under_lock } from ${JSON.stringify(path.join(REPO_ROOT, 'src/scripts/hooks/state_io.ts'))};
import * as fs from 'node:fs';
import * as path from 'node:path';
const dir = path.join(process.env.P3_STATE_ROOT!, 'agents', 'runtime', 'state');
const target = path.join(dir, 'rule-trips.json');
const barrier = process.env.P3_BARRIER!;
const goAt = Number(fs.readFileSync(barrier, 'utf8'));
while (Date.now() < goAt) { /* spin to the shared deadline */ }
function hold(ms: number) {
    // Synchronous, because the mutator is synchronous. Holds the read-to-write
    // window open so the pre-fix shape's race is reachable at all.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
for (let i = 0; i < ${LOCKED_WRITES_PER_WRITER}; i += 1) {
    update_json_under_lock(target, (loaded) => {
        const doc = { schema_version: 1, concerns: {}, ...(loaded as Record<string, unknown>) };
        const concerns = (doc.concerns ?? {}) as Record<string, { block: number }>;
        const prev = concerns['shared'] ?? { block: 0 };
        const nextCount = (prev.block || 0) + 1;
        hold(${MUTATOR_DELAY_MS});
        concerns['shared'] = { block: nextCount };
        doc.concerns = concerns;
        return doc;
    });
}
`;
        expect(await runConcurrently(worker)).toBe(WRITERS);

        const target = path.join(tmp, 'agents', 'runtime', 'state', 'rule-trips.json');
        const doc = JSON.parse(fs.readFileSync(target, 'utf8')) as {
            concerns: Record<string, { block: number }>;
        };
        expect(doc.concerns['shared']!.block).toBe(WRITERS * LOCKED_WRITES_PER_WRITER);
    });
});

describe('P3 — summary.json keeps every overlapping invocation', () => {
    // PRE-FIX RESULT, same sabotage: 8 concurrent dispatches, **1 rollup
    // survived**. The publish was atomic and the path was singular, so the last
    // rename discarded every earlier rollup.
    it('retains one entry per concurrent invocation, up to the cap', async () => {
        const worker = `
import { update_json_under_lock } from ${JSON.stringify(path.join(REPO_ROOT, 'src/scripts/hooks/state_io.ts'))};
import * as fs from 'node:fs';
import * as path from 'node:path';
const dir = path.join(process.env.P3_STATE_ROOT!, 'agents', 'runtime', 'state');
const target = path.join(dir, 'summary.json');
const barrier = process.env.P3_BARRIER!;
const id = process.argv[2];
const goAt = Number(fs.readFileSync(barrier, 'utf8'));
while (Date.now() < goAt) { /* spin to the shared deadline */ }
const invocation = String(process.pid) + '-' + id;
function hold(ms: number) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
update_json_under_lock(target, (loaded) => {
    const priorRaw = (loaded as Record<string, unknown>).invocations;
    const prior = Array.isArray(priorRaw) ? priorRaw : [];
    hold(${MUTATOR_DELAY_MS});
    const next = [...prior, { invocation, final_exit_code: 0 }];
    return { schema_version: 2, session_id: 's', invocations: next.slice(Math.max(0, next.length - 20)) };
});
`;
        expect(await runConcurrently(worker)).toBe(WRITERS);

        const target = path.join(tmp, 'agents', 'runtime', 'state', 'summary.json');
        const doc = JSON.parse(fs.readFileSync(target, 'utf8')) as {
            schema_version: number;
            invocations: { invocation: string }[];
        };
        expect(doc.schema_version).toBe(2);
        // WRITERS < the cap of 20, so nothing may be rotated out either.
        expect(doc.invocations).toHaveLength(WRITERS);
        expect(new Set(doc.invocations.map((i) => i.invocation)).size).toBe(WRITERS);
    });
});
