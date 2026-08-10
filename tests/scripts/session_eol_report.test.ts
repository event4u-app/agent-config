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

import { buildReport, percentiles } from '../../src/scripts/session_eol_report.js';

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
