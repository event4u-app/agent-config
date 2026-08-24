import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    READ_SHAPED_TOOLS,
    collectReadEvents,
    computeRereads,
} from '../../../src/scripts/_lib/transcript_reads.js';

/**
 * Fixture leg: three `Read` tool_use blocks — `a.md` twice, `b.md` once —
 * each with a matching `tool_result` of a known byte size, plus one
 * `Bash` tool_use that must be ignored and one orphan result whose
 * `tool_use_id` matches nothing.
 */
function writeLeg(dir: string, name: string, entries: string[]): string {
    const p = path.join(dir, name);
    fs.writeFileSync(p, entries.join('\n') + '\n', 'utf-8');
    return p;
}

function toolUse(id: string, tool: string, input: Record<string, unknown>): string {
    return JSON.stringify({
        type: 'assistant',
        message: { model: 'm', usage: { input_tokens: 1 }, content: [{ type: 'tool_use', id, name: tool, input }] },
    });
}

function toolResult(id: string, body: string): string {
    return JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: id, content: body }] },
    });
}

let tmp: string;

beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'transcript-reads-'));
});

afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('READ_SHAPED_TOOLS', () => {
    it('names Read and excludes the mutating tools', () => {
        expect(READ_SHAPED_TOOLS.has('Read')).toBe(true);
        expect(READ_SHAPED_TOOLS.has('Edit')).toBe(false);
        expect(READ_SHAPED_TOOLS.has('Write')).toBe(false);
        expect(READ_SHAPED_TOOLS.has('Bash')).toBe(false);
    });
});

describe('collectReadEvents', () => {
    it('pairs every read-shaped tool_use with its result size and ignores other tools', () => {
        const leg = writeLeg(tmp, 'leg-1.jsonl', [
            toolUse('t1', 'Read', { file_path: '/w/a.md' }),
            toolResult('t1', 'x'.repeat(400)),
            toolUse('t2', 'Bash', { command: 'ls' }),
            toolResult('t2', 'y'.repeat(999)),
            toolUse('t3', 'Read', { file_path: '/w/b.md' }),
            toolResult('t3', 'z'.repeat(100)),
            toolUse('t4', 'Read', { file_path: '/w/a.md' }),
            toolResult('t4', 'x'.repeat(400)),
            toolResult('orphan', 'nothing points here'),
        ]);
        const events = collectReadEvents(leg);
        expect(events.map((e) => e.filePath)).toEqual(['/w/a.md', '/w/b.md', '/w/a.md']);
        // result chars are the JSON-encoded body length, so >= the raw body
        expect(events[0]!.resultChars).toBeGreaterThanOrEqual(400);
        expect(events[1]!.resultChars).toBeLessThan(events[0]!.resultChars);
    });

    it('returns an empty list for an unreadable path rather than throwing', () => {
        expect(collectReadEvents(path.join(tmp, 'does-not-exist.jsonl'))).toEqual([]);
    });

    it('records a read whose result never arrived with zero chars', () => {
        const leg = writeLeg(tmp, 'leg-noresult.jsonl', [toolUse('t9', 'Read', { file_path: '/w/c.md' })]);
        const events = collectReadEvents(leg);
        expect(events).toHaveLength(1);
        expect(events[0]!.resultChars).toBe(0);
    });
});

describe('computeRereads', () => {
    it('counts duplicates per leg and never across legs', () => {
        const legA = writeLeg(tmp, 'cross-a.jsonl', [
            toolUse('a1', 'Read', { file_path: '/w/shared.md' }),
            toolResult('a1', 'q'.repeat(800)),
        ]);
        const legB = writeLeg(tmp, 'cross-b.jsonl', [
            toolUse('b1', 'Read', { file_path: '/w/shared.md' }),
            toolResult('b1', 'q'.repeat(800)),
        ]);
        const r = computeRereads([legA, legB]);
        // one read in each of two legs is NOT a re-read
        expect(r.duplicate_reads).toBe(0);
        expect(r.files).toHaveLength(0);
        expect(r.total_reads).toBe(2);
        expect(r.legs_scanned).toBe(2);
    });

    it('ranks re-read files by wasted tokens, descending', () => {
        const leg = writeLeg(tmp, 'rank.jsonl', [
            toolUse('r1', 'Read', { file_path: '/w/small.md' }),
            toolResult('r1', 's'.repeat(100)),
            toolUse('r2', 'Read', { file_path: '/w/small.md' }),
            toolResult('r2', 's'.repeat(100)),
            toolUse('r3', 'Read', { file_path: '/w/big.md' }),
            toolResult('r3', 'b'.repeat(4000)),
            toolUse('r4', 'Read', { file_path: '/w/big.md' }),
            toolResult('r4', 'b'.repeat(4000)),
            toolUse('r5', 'Read', { file_path: '/w/big.md' }),
            toolResult('r5', 'b'.repeat(4000)),
        ]);
        const r = computeRereads([leg]);
        expect(r.files.map((f) => f.file_path)).toEqual(['/w/big.md', '/w/small.md']);
        expect(r.files[0]!.duplicate_reads).toBe(2);
        expect(r.files[1]!.duplicate_reads).toBe(1);
        // wasted tokens are a chars/4 proxy over the 2nd..Nth read only
        expect(r.files[0]!.wasted_tokens_proxy).toBeGreaterThan(r.files[1]!.wasted_tokens_proxy);
        expect(r.duplicate_reads).toBe(3);
        expect(r.wasted_tokens_proxy).toBe(
            r.files[0]!.wasted_tokens_proxy + r.files[1]!.wasted_tokens_proxy,
        );
    });

    it('is empty and non-throwing over an empty file list', () => {
        const r = computeRereads([]);
        expect(r.total_reads).toBe(0);
        expect(r.duplicate_reads).toBe(0);
        expect(r.files).toEqual([]);
        expect(r.legs_scanned).toBe(0);
    });
});
