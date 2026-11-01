/**
 * session_eol_report — aggregation over a fixture store
 * (road-to-token-economy-recycling Phases 1.2 + 1.3).
 *
 * Pins: session counting, the fallback-set incidence (sessions without
 * parseable usage), compaction aggregation by trigger, and the marker-drift
 * alarm (boundary vs summary records diverging must be flagged, never
 * silently zeroed).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    SESSION_EOL_STATE_REL,
    buildReport,
    percentiles,
    scanCaptureState,
    coldReturns,
} from '../../src/scripts/session_eol_report.js';

function line(record: unknown): string {
    return JSON.stringify(record) + '\n';
}

function assistant(input: number, cacheRead: number): string {
    return line({
        type: 'assistant',
        timestamp: '2026-08-10T09:00:00.000Z',
        message: {
            role: 'assistant',
            usage: {
                input_tokens: input,
                cache_read_input_tokens: cacheRead,
                cache_creation_input_tokens: 0,
                output_tokens: 1,
            },
        },
    });
}

const TURN = line({ type: 'user', message: { role: 'user', content: 'go' } });

const BOUNDARY = line({
    type: 'system',
    subtype: 'compact_boundary',
    compactMetadata: { trigger: 'auto', preTokens: 900_000, postTokens: 15_000 },
    timestamp: '2026-08-10T09:30:00.000Z',
});

function makeStore(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eol-report-'));
    const project = path.join(root, '-Users-someone-proj');
    fs.mkdirSync(project, { recursive: true });
    // session A: long, compacted (boundary WITHOUT its summary twin → drift)
    fs.writeFileSync(path.join(project, 'a.jsonl'), TURN + assistant(1_000, 50_000) + BOUNDARY + assistant(2_000, 8_000));
    // session B: short, clean
    fs.writeFileSync(path.join(project, 'b.jsonl'), TURN + assistant(500, 500));
    // session C: turns but no parseable usage → fallback set
    fs.writeFileSync(path.join(project, 'c.jsonl'), TURN + TURN);
    // noise: empty file — not a session
    fs.writeFileSync(path.join(project, 'd.jsonl'), '\n');
    return root;
}

describe('buildReport', () => {
    it('aggregates sessions, fallback incidence, and compaction events', () => {
        const report = buildReport(makeStore());
        expect(report.sessions).toBe(3);
        expect(report.sessions_with_usage).toBe(2);
        expect(report.sessions_without_usage).toBe(1);
        expect(report.compaction.events_total).toBe(1);
        expect(report.compaction.events_by_trigger).toEqual({ auto: 1 });
        expect(report.compaction.pre_tokens?.median).toBe(900_000);
        expect(report.final_context_tokens?.max).toBe(10_000);
    });

    it('flags marker drift when boundary and summary counts diverge', () => {
        const report = buildReport(makeStore());
        expect(report.compaction.compact_summary_records).toBe(0);
        expect(report.compaction.marker_drift).toBe(true);
    });
});

describe('capture side — state destroyed vs state captured (Step 2.2)', () => {
    function stateRoot(files: Record<string, unknown>): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eol-capture-'));
        const dir = path.join(root, SESSION_EOL_STATE_REL);
        fs.mkdirSync(dir, { recursive: true });
        for (const [name, body] of Object.entries(files)) {
            fs.writeFileSync(path.join(dir, name), JSON.stringify(body), 'utf-8');
        }
        return root;
    }

    it('reports an ABSENT directory as unobserved, never as zero', () => {
        // A quiet estate and a store this reader cannot see must not produce
        // the same reading.
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eol-capture-none-'));
        expect(scanCaptureState(root)).toMatchObject({ state_files: null, advisory_fired: 0 });
    });

    it('distinguishes an empty directory from an absent one', () => {
        const root = stateRoot({});
        expect(scanCaptureState(root).state_files).toBe(0);
    });

    it('counts advisory stamps and the no-envelope subset independently', () => {
        const root = stateRoot({
            'a.json': { advisory_fired_at: '2026-08-15T00:00:00Z' },
            'b.json': {
                advisory_fired_at: '2026-08-15T00:00:00Z',
                missing_envelope_warned_at: '2026-08-15T01:00:00Z',
            },
            'c.json': { advisory_fired_at: null },
        });
        expect(scanCaptureState(root)).toMatchObject({
            state_files: 3,
            advisory_fired: 2,
            advised_without_envelope: 1,
        });
    });

    it('skips a torn state file rather than crashing the whole report', () => {
        const root = stateRoot({ 'good.json': { advisory_fired_at: '2026-08-15T00:00:00Z' } });
        fs.writeFileSync(path.join(root, SESSION_EOL_STATE_REL, 'torn.json'), '{not json', 'utf-8');
        expect(scanCaptureState(root)).toMatchObject({ state_files: 2, advisory_fired: 1 });
    });

    it('always labels the reading as an aggregate, never as a per-session join', () => {
        // The two sides come from different corpora with no joining key. A
        // reader must not be able to receive this reading without that label.
        expect(scanCaptureState(stateRoot({})).join_basis).toBe('aggregate');
        expect(scanCaptureState('/nonexistent-root-for-this-test').join_basis).toBe('aggregate');
    });
});

describe('percentiles', () => {
    it('computes interpolated percentiles', () => {
        const p = percentiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(p?.median).toBe(5.5);
        expect(p?.min).toBe(1);
        expect(p?.max).toBe(10);
    });

    it('returns null on empty input', () => {
        expect(percentiles([])).toBeNull();
    });
});

describe('coldReturns — 4.1 calibration replay (road-to-a-return-that-names-its-price)', () => {
    const rec = (ts: string, u: Record<string, unknown>, extra: Record<string, unknown> = {}): string =>
        JSON.stringify({ type: 'assistant', isSidechain: false, timestamp: ts, message: { usage: u }, ...extra });
    const oneHour = { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 100_000, output_tokens: 2_000, cache_creation: { ephemeral_1h_input_tokens: 100_000 } };

    it('a gap past the TTL of the newest write is a cold return: predicted = previous input + output, actual = uncached input', () => {
        const text = [
            rec('2026-11-01T09:00:00Z', oneHour),
            rec('2026-11-01T09:30:00Z', { input_tokens: 50, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 2_000, output_tokens: 10 }),
            rec('2026-11-01T11:00:00Z', { input_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 102_000, output_tokens: 10 }),
        ].join('\n');
        expect(coldReturns(text)).toEqual([[50 + 100_000 + 2_000 + 10, 100 + 102_000]]);
    });

    it('a compaction between two responses is not a cold return, and a warm gap is not either', () => {
        const text = [
            rec('2026-11-01T09:00:00Z', oneHour),
            JSON.stringify({ type: 'system', subtype: 'compact_boundary' }),
            rec('2026-11-01T11:00:00Z', { input_tokens: 5, cache_creation_input_tokens: 20_000 }),
            rec('2026-11-01T11:04:00Z', { input_tokens: 5, cache_creation_input_tokens: 0 }),
        ].join('\n');
        expect(coldReturns(text)).toEqual([]);
    });

    it('a 5m session goes cold after five minutes, and sidechain records are ignored', () => {
        const text = [
            rec('2026-11-01T09:00:00Z', { input_tokens: 1, cache_creation_input_tokens: 60_000, cache_creation: { ephemeral_5m_input_tokens: 60_000 } }),
            rec('2026-11-01T09:20:00Z', { input_tokens: 1, cache_creation_input_tokens: 999 }, { isSidechain: true }),
            rec('2026-11-01T09:06:00Z', { input_tokens: 1, cache_creation_input_tokens: 60_001 }),
        ].join('\n');
        expect(coldReturns(text)).toEqual([[60_001, 60_002]]);
    });
});

describe('buildReport — cold-return calibration splits false-cold from size error', () => {
    it('a gap whose request still read the cache counts as false-cold, not as a 99 % size error', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eol-cold-'));
        const dir = path.join(root, 'proj');
        fs.mkdirSync(dir);
        const rec = (ts: string, u: Record<string, unknown>): string => JSON.stringify({ type: 'assistant', isSidechain: false, timestamp: ts, message: { usage: u } });
        fs.writeFileSync(
            path.join(dir, 's.jsonl'),
            [
                rec('2026-11-01T09:00:00Z', { input_tokens: 1, cache_creation_input_tokens: 100_000 }),
                rec('2026-11-01T09:30:00Z', { input_tokens: 1, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 50 }),
                rec('2026-11-01T11:00:00Z', { input_tokens: 1, cache_creation_input_tokens: 95_000 }),
            ].join('\n') + '\n',
        );
        const cr = buildReport(root).cold_return;
        fs.rmSync(root, { recursive: true, force: true });
        expect(cr.returns).toBe(2);
        expect(cr.false_cold).toBe(1);
        expect(cr.relative_error?.n).toBe(1);
        expect(cr.relative_error?.median).toBeCloseTo(((100_051 - 95_001) / 95_001) * 100, 3);
    });
});

