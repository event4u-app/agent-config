import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    MODE_CONTRACT,
    RESULT_VERSION,
    aspectResults,
    assessProducer,
    assessRun,
    collect,
    collectorReduce,
    initialCollector,
    parseStream,
    preflight,
    requireMode,
    writeSummary,
    type Limits,
    type ProducerRow,
} from '../../src/scripts/_lib/gate_collector_experimental.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRODUCER = path.resolve(HERE, '../fixtures/gate-collector/producer.mjs');

const LIMITS: Limits = { wallMs: 1500, maxBytes: 64 * 1024, maxLines: 256, killGraceMs: 200 };

function row(overrides: Partial<ProducerRow> = {}): ProducerRow {
    return { id: 'fixture', argv: [process.execPath, PRODUCER], aspects: ['a', 'b'], ...overrides };
}

async function run(scenario: string, r: ProducerRow = row()) {
    const collection = await collect(r, { limits: LIMITS, env: { PRODUCER_SCENARIO: scenario } });
    return { collection, protocol: parseStream(collection, r) };
}

describe('collectorReduce — the accepted-byte boundary as a pure state machine', () => {
    const lim: Limits = { wallMs: 1000, maxBytes: 10, maxLines: 3, killGraceMs: 0 };

    it('accepts data while collecting and ignores every byte after the stop', () => {
        let m = collectorReduce(initialCollector(lim), { type: 'spawned' });
        m = collectorReduce(m, { type: 'data', bytes: Buffer.from('ab\n') });
        m = collectorReduce(m, { type: 'exit', code: 0, signal: null });
        m = collectorReduce(m, { type: 'drain-complete' });
        m = collectorReduce(m, { type: 'data', bytes: Buffer.from('late\n') });
        expect(Buffer.concat(m.accepted).toString()).toBe('ab\n');
        expect(m.outcome).toEqual({ kind: 'exited', code: 0 });
        expect(m.ignoredAfterStop).toBe(5);
    });

    it('accepts bytes drained after the exit event and before the stop', () => {
        let m = collectorReduce(initialCollector(lim), { type: 'spawned' });
        m = collectorReduce(m, { type: 'exit', code: 0, signal: null });
        m = collectorReduce(m, { type: 'data', bytes: Buffer.from('x\n') });
        m = collectorReduce(m, { type: 'drain-complete' });
        expect(Buffer.concat(m.accepted).toString()).toBe('x\n');
        expect(m.phase).toBe('stopped');
    });

    it('lets the first terminal event decide and records the later one as a diagnostic', () => {
        let m = collectorReduce(initialCollector(lim), { type: 'spawned' });
        m = collectorReduce(m, { type: 'deadline' });
        m = collectorReduce(m, { type: 'exit', code: 0, signal: null });
        expect(m.outcome).toEqual({ kind: 'timed-out' });
        expect(m.events).toContain('exit-after-terminal');

        let n = collectorReduce(initialCollector(lim), { type: 'spawned' });
        n = collectorReduce(n, { type: 'exit', code: 3, signal: null });
        n = collectorReduce(n, { type: 'deadline' });
        expect(n.outcome).toEqual({ kind: 'exited', code: 3 });
    });

    it('accepts exactly the byte-limit prefix when one read crosses the limit', () => {
        let m = collectorReduce(initialCollector(lim), { type: 'spawned' });
        m = collectorReduce(m, { type: 'data', bytes: Buffer.from('0123456789ABC') });
        expect(Buffer.concat(m.accepted).toString()).toBe('0123456789');
        expect(m.outcome).toEqual({ kind: 'output-limited', limit: 'bytes' });
        expect(m.phase).toBe('stopped');
    });

    it('accepts up to and including the last permitted line feed when the line limit is crossed', () => {
        let m = collectorReduce(initialCollector({ ...lim, maxBytes: 100 }), { type: 'spawned' });
        m = collectorReduce(m, { type: 'data', bytes: Buffer.from('1\n2\n3\n4\n') });
        expect(Buffer.concat(m.accepted).toString()).toBe('1\n2\n3\n');
        expect(m.outcome).toEqual({ kind: 'output-limited', limit: 'lines' });
    });

    it('maps a spawn failure to not-started and never collects', () => {
        let m = collectorReduce(initialCollector(lim), { type: 'spawn-error', code: 'ENOENT' });
        m = collectorReduce(m, { type: 'data', bytes: Buffer.from('x') });
        expect(m.outcome).toEqual({ kind: 'not-started', reason: 'ENOENT' });
        expect(m.accepted).toHaveLength(0);
    });
});

describe('collect + parseStream — adversarial fixtures against the reference producer', () => {
    it('accepts the conforming reference producer as complete', async () => {
        const { collection, protocol } = await run('ok');
        expect(collection.outcome).toEqual({ kind: 'exited', code: 1 });
        expect(protocol.outcome).toBe('complete');
        expect(aspectResults(protocol, row())).toEqual([
            { aspect: 'a', evaluation: 'pass' },
            { aspect: 'b', evaluation: 'fail' },
        ]);
    });

    it('rejects a forged record an escaped descendant writes after the producer exits', async () => {
        const { protocol } = await run('late-forgery');
        expect(protocol.outcome).toBe('complete');
        expect(aspectResults(protocol, row())[0]).toEqual({ aspect: 'a', evaluation: 'fail' });
    });

    it('does not let an escaped descendant complete a stream the producer left open', async () => {
        const { protocol } = await run('forgery-without-terminator');
        expect(protocol).toMatchObject({ outcome: 'incomplete', reason: 'no-terminator' });
    });

    it.each([
        ['malformed-json', 'invalid', 'malformed'],
        ['invalid-utf8', 'invalid', 'malformed'],
        ['empty-line', 'invalid', 'malformed'],
        ['mixed-version', 'invalid', 'mixed-version'],
        ['unsupported-version', 'invalid', 'unsupported-version'],
        ['unknown-field', 'invalid', 'schema'],
        ['not-evaluated-without-reason', 'invalid', 'schema'],
        ['duplicate', 'invalid', 'duplicate-aspect'],
        ['foreign', 'invalid', 'foreign-aspect'],
        ['after-terminator', 'invalid', 'framing'],
        ['unterminated-line', 'incomplete', 'unterminated-line'],
        ['no-terminator', 'incomplete', 'no-terminator'],
        ['count-mismatch', 'incomplete', 'count-mismatch'],
        ['missing-aspect', 'incomplete', 'missing-aspect'],
    ])('classifies %s as %s (%s)', async (scenario, outcome, reason) => {
        const { protocol } = await run(scenario);
        expect(protocol).toMatchObject({ outcome, reason });
    });

    it('treats a CR before the line feed as part of the delimiter', async () => {
        const { protocol } = await run('crlf');
        expect(protocol.outcome).toBe('complete');
    });

    it('stops a flood at the byte limit and reports output-limit, never a short stream', async () => {
        const { collection, protocol } = await run('flood');
        expect(collection.outcome.kind).toBe('output-limited');
        expect(collection.bytes.length).toBeLessThanOrEqual(LIMITS.maxBytes);
        expect(protocol).toMatchObject({ outcome: 'invalid', reason: 'output-limit' });
    });

    it('times out a hanging producer, kills its group, and reports incomplete', async () => {
        const { collection, protocol } = await run('hang');
        expect(collection.outcome).toEqual({ kind: 'timed-out' });
        expect(collection.cleanup.groupSignalled).toBe(true);
        expect(protocol).toMatchObject({ outcome: 'incomplete', reason: 'timed-out' });
    });

    it('reports the stronger finding when a stream is both malformed and cut short', async () => {
        const { protocol } = await run('duplicate-and-hang');
        expect(protocol).toMatchObject({ outcome: 'invalid', reason: 'duplicate-aspect' });
        expect(protocol.diagnostics).toContain('timed-out');
    });

    it('applies the compatibility row only to an exited, structurally valid stream', async () => {
        const compat = { expires: '2999-01-01', exitAllPass: 0, exitOtherwise: 1 };
        const contradicted = await run('exit-contradiction', row({ compat }));
        expect(contradicted.protocol).toMatchObject({ outcome: 'invalid', reason: 'exit-contradiction' });
        const consistent = await run('ok', row({ compat }));
        expect(consistent.protocol.outcome).toBe('complete');
        const noRow = await run('exit-contradiction');
        expect(noRow.protocol.outcome).toBe('complete');
        expect(noRow.protocol.diagnostics).toContain('process-nonzero');
    });

    it('never reports a pass for an aspect of a producer that is not complete', async () => {
        const { protocol } = await run('no-terminator');
        expect(aspectResults(protocol, row())).toEqual([
            { aspect: 'a', evaluation: 'not-evaluated', reason: 'no-terminator' },
            { aspect: 'b', evaluation: 'not-evaluated', reason: 'no-terminator' },
        ]);
    });

    it('reports a producer that cannot be spawned as absent', async () => {
        const r = row({ argv: [path.join(os.tmpdir(), 'no-such-producer-binary')] });
        const { collection, protocol } = await run('ok', r);
        expect(collection.outcome.kind).toBe('not-started');
        expect(protocol).toMatchObject({ outcome: 'absent', reason: 'not-started' });
    });
});

describe('preflight — configuration state is not a protocol outcome', () => {
    it('refuses an expired compatibility row before spawning', () => {
        const r = row({ compat: { expires: '2026-01-01', exitAllPass: 0, exitOtherwise: 1 } });
        expect(preflight(r, { today: '2026-10-24', treeClean: true })).toEqual({ ok: false, reason: 'expired-compat-row' });
    });

    it('refuses a dirty starting tree', () => {
        expect(preflight(row(), { today: '2026-10-24', treeClean: false })).toEqual({ ok: false, reason: 'dirty-tree' });
    });

    it('passes a clean tree with no or an active row', () => {
        expect(preflight(row(), { today: '2026-10-24', treeClean: true })).toEqual({ ok: true });
    });
});

describe('assessRun — validator health is a separate dimension', () => {
    it('keeps a producer result when the validator faults on another producer', async () => {
        const good = await assessProducer(row({ id: 'good' }), {
            limits: LIMITS,
            env: { PRODUCER_SCENARIO: 'all-pass' },
            preflight: { today: '2026-10-24', treeClean: true },
        });
        const faulted = await assessProducer(row({ id: 'faulted' }), {
            limits: LIMITS,
            env: { PRODUCER_SCENARIO: 'all-pass' },
            preflight: { today: '2026-10-24', treeClean: true },
            parse: () => {
                throw new Error('validator bug');
            },
        });
        expect(good.status).toBe('complete');
        expect(faulted.status).toBe('unassessed');
        const runReport = assessRun([good, faulted]);
        expect(runReport.health).toBe('degraded');
        expect(runReport.producers.find((p) => p.id === 'good')?.status).toBe('complete');
        expect(runReport.status).not.toBe('complete');
        expect(runReport.evaluationExit).toBe(0);
        expect(runReport.operationalExit).toBe(2);
    });

    it('marks a preflight refusal as not-attempted and never starts the producer', async () => {
        const report = await assessProducer(row(), {
            limits: LIMITS,
            env: { PRODUCER_SCENARIO: 'ok' },
            preflight: { today: '2026-10-24', treeClean: false },
        });
        expect(report).toMatchObject({ status: 'not-attempted', reason: 'dirty-tree' });
        expect(report.collection).toBeUndefined();
    });

    it('reports a healthy run of complete producers as complete with both exits zero', async () => {
        const p = await assessProducer(row(), {
            limits: LIMITS,
            env: { PRODUCER_SCENARIO: 'ok' },
            preflight: { today: '2026-10-24', treeClean: true },
        });
        const r = assessRun([p]);
        expect(r).toMatchObject({ health: 'healthy', status: 'complete', operationalExit: 0, evaluationExit: 0 });
        expect(r.version).toBe(RESULT_VERSION);
    });

    it('ranks an invalid producer above an incomplete one in the run status', async () => {
        const opts = (s: string) => ({ limits: LIMITS, env: { PRODUCER_SCENARIO: s }, preflight: { today: '2026-10-24', treeClean: true } });
        const r = assessRun([await assessProducer(row({ id: 'x' }), opts('no-terminator')), await assessProducer(row({ id: 'y' }), opts('duplicate'))]);
        expect(r.status).toBe('invalid');
    });
});

describe('writeSummary — persistence is checked by reading it back', () => {
    it('writes one line per producer and a run line, and reads them back', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-summary-'));
        const p = await assessProducer(row(), {
            limits: LIMITS,
            env: { PRODUCER_SCENARIO: 'ok' },
            preflight: { today: '2026-10-24', treeClean: true },
        });
        const file = path.join(dir, 'summary.jsonl');
        const res = writeSummary(file, assessRun([p]));
        expect(res.ok).toBe(true);
        const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
        expect(lines).toHaveLength(2);
        expect(JSON.parse(lines[1]!).kind).toBe('run');
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('turns a write failure into failed health and a non-zero operational exit', async () => {
        const p = await assessProducer(row(), {
            limits: LIMITS,
            env: { PRODUCER_SCENARIO: 'ok' },
            preflight: { today: '2026-10-24', treeClean: true },
        });
        const res = writeSummary(path.join(os.tmpdir(), 'no-such-dir-gate', 'x', 'summary.jsonl'), assessRun([p]));
        expect(res.ok).toBe(false);
        expect(res.run.health).toBe('failed');
        expect(res.run.operationalExit).toBe(1);
        expect(res.run.evaluationExit).toBe(0);
    });
});

describe('mode contract — report-only is explicit, and no incomplete state reads as complete', () => {
    it('refuses an unknown or enforcing mode rather than defaulting', () => {
        expect(requireMode('report-only')).toBe('report-only');
        expect(() => requireMode('enforcing')).toThrow(/mode/);
        expect(() => requireMode(undefined)).toThrow(/mode/);
    });

    it('carries the mode and contract version in every run report', () => {
        const r = assessRun([]);
        expect(r.mode).toBe('report-only');
        expect(r.contract).toBe(MODE_CONTRACT);
    });

    it('reports complete only when every producer is complete and health is healthy, across every combination', () => {
        const statuses = ['complete', 'incomplete', 'invalid', 'absent', 'not-attempted', 'unassessed'] as const;
        const healths = ['healthy', 'degraded', 'failed'] as const;
        let seen = 0;
        for (const h of healths) {
            for (const a of statuses) {
                for (const b of statuses) {
                    const r = assessRun(
                        [
                            { id: 'p1', status: a, reason: null },
                            { id: 'p2', status: b, reason: null },
                        ],
                        h,
                    );
                    const allComplete = a === 'complete' && b === 'complete';
                    expect(r.status === 'complete').toBe(allComplete && r.health === 'healthy');
                    expect(r.evaluationExit).toBe(0);
                    expect(r.operationalExit).toBe(r.health === 'failed' ? 1 : r.health === 'degraded' ? 2 : 0);
                    if (a === 'unassessed' || b === 'unassessed') expect(r.health).not.toBe('healthy');
                    seen++;
                }
            }
        }
        expect(seen).toBe(108);
    });

    it('rejects an unknown producer status instead of reading it as complete', () => {
        expect(() => assessRun([{ id: 'p', status: 'passed' as never, reason: null }])).toThrow(/status/);
    });
});
