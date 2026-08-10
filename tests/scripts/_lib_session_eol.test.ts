/**
 * session_eol scanner — fixture pinned to an OBSERVED compaction
 * (road-to-token-economy-recycling Phase 1.1 + blocker `compaction-marker-shape`).
 *
 * The two compaction marker records below are structural copies of a REAL
 * auto-compaction observed 2026-08-06 on host v2.1.222 (uuids/paths
 * anonymized, shapes verbatim). This is the blocker's resolution artifact:
 * the detector is pinned to observed reality, and a host update that changes
 * the shape fails THIS file's expectations instead of silently zeroing the
 * auto-compact metric. The scanner's twin counters (`compactions` vs
 * `compact_summaries`) are the runtime drift alarm for shapes this fixture
 * cannot see.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    detectCompaction,
    emptyCounters,
    readNewCompleteLines,
    scanEolSlice,
} from '../../src/scripts/_lib/session_eol.js';

/** Structural copy of the observed `compact_boundary` record (host v2.1.222). */
const OBSERVED_BOUNDARY = {
    parentUuid: null,
    logicalParentUuid: '2c690000-0000-4000-a000-000000000001',
    isSidechain: false,
    type: 'system',
    subtype: 'compact_boundary',
    content: 'Conversation compacted',
    level: 'info',
    compactMetadata: {
        trigger: 'auto',
        preTokens: 1000410,
        postTokens: 15870,
        cumulativeDroppedTokens: 984540,
        durationMs: 123281,
    },
    timestamp: '2026-08-06T05:55:15.139Z',
};

/** Structural copy of the observed `isCompactSummary` user record. */
const OBSERVED_SUMMARY = {
    parentUuid: 'e54c0000-0000-4000-a000-000000000002',
    isSidechain: false,
    type: 'user',
    message: {
        role: 'user',
        content: 'This session is being continued from a previous conversation that ran out of context.',
    },
    isVisibleInTranscriptOnly: true,
    isCompactSummary: true,
    uuid: '15370000-0000-4000-a000-000000000003',
    timestamp: '2026-08-06T05:55:15.139Z',
    version: '2.1.222',
};

function assistantRecord(input: number, cacheRead: number, ts: string): Record<string, unknown> {
    return {
        type: 'assistant',
        isSidechain: false,
        timestamp: ts,
        message: {
            role: 'assistant',
            usage: {
                input_tokens: input,
                cache_read_input_tokens: cacheRead,
                cache_creation_input_tokens: 100,
                output_tokens: 50,
            },
        },
    };
}

const USER_TURN = {
    type: 'user',
    isSidechain: false,
    message: { role: 'user', content: 'please fix the failing test' },
};

function jsonl(records: unknown[]): string {
    return records.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

describe('detectCompaction — pinned to the observed marker shape', () => {
    it('reads trigger + pre/post tokens from the observed compact_boundary record', () => {
        const event = detectCompaction(OBSERVED_BOUNDARY as Record<string, unknown>);
        expect(event).not.toBeNull();
        expect(event?.trigger).toBe('auto');
        expect(event?.pre_tokens).toBe(1000410);
        expect(event?.post_tokens).toBe(15870);
        expect(event?.timestamp).toBe('2026-08-06T05:55:15.139Z');
    });

    it('returns null for every non-boundary record', () => {
        expect(detectCompaction(OBSERVED_SUMMARY as Record<string, unknown>)).toBeNull();
        expect(detectCompaction(USER_TURN as Record<string, unknown>)).toBeNull();
        expect(detectCompaction(assistantRecord(1, 2, 't'))).toBeNull();
        expect(detectCompaction({ type: 'system', subtype: 'other' })).toBeNull();
    });

    it('degrades missing metadata to nulls instead of throwing (host territory)', () => {
        const event = detectCompaction({ type: 'system', subtype: 'compact_boundary' });
        expect(event).toEqual({ trigger: 'unknown', pre_tokens: null, post_tokens: null, timestamp: null });
    });
});

describe('scanEolSlice — per-session counters', () => {
    it('counts turns, assistant records, final context, and BOTH compaction markers', () => {
        const text = jsonl([
            USER_TURN,
            assistantRecord(1_000, 200_000, '2026-08-06T05:00:00.000Z'),
            OBSERVED_BOUNDARY,
            OBSERVED_SUMMARY,
            USER_TURN,
            assistantRecord(2_000, 13_000, '2026-08-06T06:00:00.000Z'),
        ]);
        const c = scanEolSlice(text, emptyCounters());
        expect(c.turns).toBe(2);
        expect(c.assistant_records).toBe(2);
        // last record wins; billable = input + cache_read + cache_creation
        expect(c.final_context_tokens).toBe(2_000 + 13_000 + 100);
        expect(c.final_context_at).toBe('2026-08-06T06:00:00.000Z');
        expect(c.compactions).toHaveLength(1);
        expect(c.compact_summaries).toBe(1);
        expect(c.bad_lines).toBe(0);
    });

    it('is incremental: two slices equal one full scan', () => {
        const first = jsonl([USER_TURN, assistantRecord(1, 2, 'a')]);
        const second = jsonl([OBSERVED_BOUNDARY, assistantRecord(3, 4, 'b')]);
        const stepwise = scanEolSlice(second, scanEolSlice(first, emptyCounters()));
        const oneShot = scanEolSlice(first + second, emptyCounters());
        expect(stepwise).toEqual(oneShot);
    });

    it('excludes sidechain records and tool-result user records from turns', () => {
        const text = jsonl([
            { ...USER_TURN, isSidechain: true },
            { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] } },
            { ...assistantRecord(9, 9, 'c'), isSidechain: true },
        ]);
        const c = scanEolSlice(text, emptyCounters());
        expect(c.turns).toBe(0);
        expect(c.assistant_records).toBe(0);
        expect(c.final_context_tokens).toBeNull();
    });

    it('counts unparseable lines instead of throwing', () => {
        const c = scanEolSlice('not json\n[1,2]\n', emptyCounters());
        expect(c.bad_lines).toBe(2);
    });
});

describe('readNewCompleteLines — incremental tail reads', () => {
    it('returns only complete lines and advances the offset past them', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-eol-'));
        const file = path.join(dir, 't.jsonl');
        fs.writeFileSync(file, 'line1\nline2\npartial');
        const first = readNewCompleteLines(file, 0);
        expect(first.text).toBe('line1\nline2\n');
        expect(first.truncated).toBe(false);

        fs.appendFileSync(file, '-done\nline3\n');
        const second = readNewCompleteLines(file, first.nextOffset);
        expect(second.text).toBe('partial-done\nline3\n');

        const third = readNewCompleteLines(file, second.nextOffset);
        expect(third.text).toBe('');
        expect(third.nextOffset).toBe(second.nextOffset);
    });

    it('signals truncation when the file shrank below the prior offset', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-eol-'));
        const file = path.join(dir, 't.jsonl');
        fs.writeFileSync(file, 'short\n');
        const r = readNewCompleteLines(file, 10_000);
        expect(r.truncated).toBe(true);
        expect(r.nextOffset).toBe(0);
    });

    it('never throws on a missing file', () => {
        const r = readNewCompleteLines('/nonexistent/nope.jsonl', 0);
        expect(r).toEqual({ text: '', nextOffset: 0, truncated: false });
    });
});
