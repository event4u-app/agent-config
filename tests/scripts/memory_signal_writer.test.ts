// road-to-a-memory-each-worker-is-handed 2.1 — what a worker writes back carries
// who wrote it. A legacy intake line has no writer and reads `unknown`; an unpaid
// route or a council seat is refused at the write edge; a record tainted by an
// external read is kept in the log but never aggregated into a lesson.

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildSidecar, readSignals } from '../../src/scripts/learning_sidecar.js';
import * as sig from '../../src/scripts/memory_signal.js';
import * as tpl from '../../src/agent-src/templates/scripts/memory_signal.js';

let tmp: string;
let intake: string;

beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'memsig-writer-'));
    intake = join(tmp, 'agents', 'memory', 'intake');
    sig._setIntakeRoot(intake);
    tpl._setIntakeRoot(intake);
});
afterEach(() => {
    sig._setIntakeRoot(join('agents', 'memory', 'intake'));
    tpl._setIntakeRoot(join('agents', 'memory', 'intake'));
    rmSync(tmp, { recursive: true, force: true });
});

function intakeLineCount(): number {
    let n = 0;
    try {
        for (const f of readdirSync(intake)) {
            n += readFileSync(join(intake, f), 'utf-8').split('\n').filter((l) => l.trim()).length;
        }
    } catch {
        return 0;
    }
    return n;
}

describe.each([
    ['dev-side', sig],
    ['consumer template', tpl],
])('memory_signal %s — writer provenance', (_name, mod) => {
    it('a legacy line without a writer reads writer: unknown, a stamped one reads its writer', () => {
        const legacy = { id: 'sig-1', ts: '2026-10-01T00:00:00+00:00', origin: 'agent', entry_type: 'ownership', path: 'a', body: 'b' };
        expect(mod._writer_of(legacy)).toBe('unknown');
        expect(mod._writer_of({ ...legacy, writer: '   ' })).toBe('unknown');
        for (const ok of ['orchestrator', 'fork:w1', 'cheap-paid:haiku', 'unknown']) {
            expect(() => mod._assert_writer_allowed({ writer: ok })).not.toThrow();
        }
        const rec = mod.emit('ownership', 'app/x', 'team-x', { writer: 'non-fork:implementer' });
        expect(rec).not.toBeNull();
        expect(mod._writer_of(rec as Record<string, unknown>)).toBe('non-fork:implementer');
    });

    it.each([
        ['unpaid', { writer: 'unpaid:free-route' }],
        ['council-seat', { writer: 'council-seat:openai' }],
        ['council-seat via extra', { extra: { writer: 'Council-Seat' } }],
        ['judge-seat', { writer: 'judge-seat:spec-compliance' }],
        ['an empty class', { writer: ':unpaid' }],
        ['a bare colon', { writer: ':' }],
        ['a class outside the audience table', { writer: 'free-route' }],
        ['a padded refused class', { writer: '  unpaid : x' }],
    ])('refuses a %s writer and writes nothing', (_label, options) => {
        expect(() => mod.emit('historical-patterns', 'app/Y.php', 'a lesson', options)).toThrow(mod.WriterRefusedError);
        expect(intakeLineCount()).toBe(0);
    });
});

describe('an external_read taint never reaches aggregation', () => {
    it('a tainted record stays in the log and is excluded from the lesson set', () => {
        mkdirSync(intake, { recursive: true });
        const base = { entry_type: 'historical-patterns', path: 'app/Z.php', body: 'retry the flaky call' };
        const lines = [
            { id: 's1', ts: '2026-10-01T00:00:00+00:00', origin: 'session-a', ...base },
            { id: 's2', ts: '2026-10-02T00:00:00+00:00', origin: 'session-b', taint: 'external_read', ...base },
        ];
        writeFileSync(join(intake, 'signals-2026-10.jsonl'), `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);

        expect(readSignals(intake).map((s) => s.id)).toEqual(['s1']);
        const variants = ['EXTERNAL_READ', ' external_read ', 'External_Read'];
        writeFileSync(
            join(intake, 'signals-2026-09.jsonl'),
            `${variants.map((t, i) => JSON.stringify({ id: `v${i}`, ts: '2026-09-01T00:00:00+00:00', origin: `o${i}`, taint: t, ...base })).join('\n')}\n`,
        );
        expect(readSignals(intake).map((s) => s.id)).toEqual(['s1']);
        // Without the taint the two origins would corroborate into a lesson.
        expect(buildSidecar(intake, '2026-10-03T00:00:00+00:00').lessons).toEqual([]);
    });

    it('emit stamps the taint it is handed', () => {
        const rec = sig.emit('historical-patterns', 'app/T.php', 'from a fetched page', { taint: 'external_read' });
        expect((rec as Record<string, unknown>)['taint']).toBe('external_read');
    });

    it('end to end: a tainted emit never corroborates a lesson, an untainted pair does', () => {
        sig.emit('historical-patterns', 'app/E.php', 'cache the lookup', { origin: 'session-a' });
        sig.emit('historical-patterns', 'app/E.php', 'cache the lookup', { origin: 'session-b', taint: 'external_read', force: true });
        const now = new Date(Date.now() + 1000).toISOString();
        expect(buildSidecar(intake, now).lessons).toEqual([]);
        sig.emit('historical-patterns', 'app/E.php', 'cache the lookup', { origin: 'session-c', force: true });
        expect(buildSidecar(intake, now).lessons.map((l) => l.path)).toEqual(['app/E.php']);
    });
});
