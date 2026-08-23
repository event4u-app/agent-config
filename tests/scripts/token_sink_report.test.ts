import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    buildReport,
    parseArgs,
    rankSinks,
    renderText,
} from '../../src/scripts/token_sink_report.js';
import type { TranscriptRecord } from '../../src/scripts/_lib/cc_transcript.js';

function rec(
    bucket: 'main' | 'subagent',
    model: string,
    agentId: string | null,
    input: number,
    cacheRead: number,
    timestamp: string,
): TranscriptRecord {
    return {
        bucket,
        agentId,
        model,
        timestamp,
        usage: {
            input_tokens: input,
            cache_read_input_tokens: cacheRead,
            cache_creation_input_tokens: 0,
            output_tokens: 1,
            ephemeral_5m_input_tokens: 0,
            ephemeral_1h_input_tokens: 0,
        },
    };
}

describe('rankSinks', () => {
    it('ranks by weighted input units descending and shares sum to ~1', () => {
        const sinks = rankSinks([
            rec('main', 'opus', null, 1000, 0, '2026-08-01T00:00:00Z'),
            rec('subagent', 'haiku', 'a1', 100, 0, '2026-08-02T00:00:00Z'),
            rec('subagent', 'haiku', 'a2', 300, 0, '2026-08-03T00:00:00Z'),
        ]);
        expect(sinks.map((s) => s.sink)).toEqual(['main/opus', 'subagent/haiku']);
        expect(sinks[0]!.calls).toBe(1);
        expect(sinks[1]!.calls).toBe(2);
        const shareSum = sinks.reduce((s, x) => s + x.weighted_share, 0);
        expect(shareSum).toBeCloseTo(1, 6);
    });

    it('weights a cache read at a tenth of an uncached input token', () => {
        const sinks = rankSinks([
            rec('main', 'm', null, 0, 1000, '2026-08-01T00:00:00Z'),
            rec('subagent', 'm', 'a', 100, 0, '2026-08-01T00:00:00Z'),
        ]);
        const main = sinks.find((s) => s.sink === 'main/m')!;
        const sub = sinks.find((s) => s.sink === 'subagent/m')!;
        expect(main.weighted_input_units).toBeCloseTo(100, 6);
        expect(sub.weighted_input_units).toBeCloseTo(100, 6);
    });

    it('is empty, not throwing, on an empty record set', () => {
        expect(rankSinks([])).toEqual([]);
    });
});

describe('buildReport', () => {
    let tmp: string;

    beforeAll(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'token-sink-'));
        const proj = path.join(tmp, '-w-proj');
        fs.mkdirSync(proj, { recursive: true });
        const assistant = (model: string, input: number, ts: string, content?: unknown[]) =>
            JSON.stringify({
                type: 'assistant',
                timestamp: ts,
                message: {
                    id: `m-${ts}-${input}`,
                    model,
                    usage: { input_tokens: input, cache_read_input_tokens: 0 },
                    ...(content ? { content } : {}),
                },
            });
        fs.writeFileSync(
            path.join(proj, 'session.jsonl'),
            [
                assistant('opus', 500, '2026-08-10T10:00:00Z', [
                    { type: 'tool_use', id: 'u1', name: 'Read', input: { file_path: '/w/dup.md' } },
                ]),
                JSON.stringify({
                    type: 'user',
                    message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: 'd'.repeat(800) }] },
                }),
                assistant('opus', 600, '2026-08-11T10:00:00Z', [
                    { type: 'tool_use', id: 'u2', name: 'Read', input: { file_path: '/w/dup.md' } },
                ]),
                JSON.stringify({
                    type: 'user',
                    message: { content: [{ type: 'tool_result', tool_use_id: 'u2', content: 'd'.repeat(800) }] },
                }),
            ].join('\n') + '\n',
            'utf-8',
        );
    });

    afterAll(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('publishes its denominator: record count, date range and local-store provenance', () => {
        const r = buildReport({ ...parseArgs([]), root: tmp, maxAgeDays: 100000, format: 'json' });
        expect(r.deduped_count).toBe(2);
        expect(r.legs_scanned).toBe(1);
        expect(r.date_range.first).toBe('2026-08-10T10:00:00Z');
        expect(r.date_range.last).toBe('2026-08-11T10:00:00Z');
        expect(r.provenance).toMatch(/local/i);
        expect(r.provenance).toMatch(/one machine/i);
    });

    it('finds the in-leg re-read and labels the wasted figure a proxy', () => {
        const r = buildReport({ ...parseArgs([]), root: tmp, maxAgeDays: 100000, format: 'json' });
        expect(r.rereads.duplicate_reads).toBe(1);
        expect(r.rereads.files[0]!.file_path).toBe('/w/dup.md');
        expect(r.rereads.files[0]!.wasted_tokens_proxy).toBeGreaterThan(0);
        const text = renderText(r);
        expect(text).toMatch(/proxy/i);
        expect(text).toMatch(/chars \/ 4|chars\/4/);
    });

    it('renders the record count, the date range and the single-store caveat in-band', () => {
        const text = renderText(buildReport({ ...parseArgs([]), root: tmp, maxAgeDays: 100000, format: 'text' }));
        expect(text).toContain('2026-08-10T10:00:00Z');
        expect(text).toMatch(/records/i);
        expect(text).toMatch(/one machine/i);
    });

    it('reports an empty store as empty rather than failing', () => {
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'token-sink-empty-'));
        try {
            const r = buildReport({ ...parseArgs([]), root: empty, maxAgeDays: 100000, format: 'json' });
            expect(r.deduped_count).toBe(0);
            expect(r.sinks).toEqual([]);
            expect(r.date_range.first).toBeNull();
            expect(renderText(r)).toMatch(/no records/i);
        } finally {
            fs.rmSync(empty, { recursive: true, force: true });
        }
    });
});

describe('parseArgs', () => {
    it('defaults to text format and accepts both --k v and --k=v', () => {
        expect(parseArgs([]).format).toBe('text');
        expect(parseArgs(['--format', 'json']).format).toBe('json');
        expect(parseArgs(['--format=json']).format).toBe('json');
        expect(parseArgs(['--top=3']).top).toBe(3);
        expect(parseArgs(['--max-age-days', '7']).maxAgeDays).toBe(7);
    });

    it('rejects an unknown format instead of propagating it', () => {
        expect(parseArgs(['--format=xml']).format).toBe('text');
    });
});
