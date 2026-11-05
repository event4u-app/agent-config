// The subagent ledger is append-only and monthly; without retention it grows
// without bound (measured ~22 MB over two and a half months on one machine).
// The first write of a month prunes monthly files and index months older than
// LEDGER_RETENTION_MONTHS. The current and recent months, and open records, stay.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LEDGER_DIR, LEDGER_RETENTION_MONTHS, appendLedgerLine } from '../../../src/scripts/hooks/subagent_ledger_hook.js';

let root: string;
let dir: string;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ledger-retention-'));
    dir = join(root, LEDGER_DIR);
    mkdirSync(join(dir, 'index'), { recursive: true });
    mkdirSync(join(dir, 'open'), { recursive: true });
    writeFileSync(join(dir, 'open', 'r1.json'), '{}');
    for (const m of ['2025-12', '2026-05', '2026-06', '2026-10']) {
        writeFileSync(join(dir, `${m}.jsonl`), '{"event":"x"}\n');
        mkdirSync(join(dir, 'index', m), { recursive: true });
        writeFileSync(join(dir, 'index', m, 'k'), 'v');
    }
    writeFileSync(join(dir, 'notes.txt'), 'not a ledger month');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('subagent ledger retention', () => {
    it('keeps a six-month window', () => {
        expect(LEDGER_RETENTION_MONTHS).toBe(6);
    });

    it('the first write of a month prunes months older than the window, files and index alike', () => {
        appendLedgerLine(root, '2026-11-05T10:00:00.000Z', { event: 'y' });
        const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
        // The window is 2026-11 and the five months before it: 2026-06 is the oldest kept, 2026-05 goes.
        expect(files).toEqual(['2026-06.jsonl', '2026-10.jsonl', '2026-11.jsonl']);
        expect(readdirSync(join(dir, 'index')).sort()).toEqual(['2026-06', '2026-10']);
        expect(existsSync(join(dir, 'open', 'r1.json'))).toBe(true);
        expect(existsSync(join(dir, 'notes.txt'))).toBe(true);
    });

    it('the window crosses a year boundary', () => {
        appendLedgerLine(root, '2027-01-02T10:00:00.000Z', { event: 'y' });
        // 2027-01 and the five months before it: 2026-08 is the oldest kept.
        const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
        expect(files).toEqual(['2026-10.jsonl', '2027-01.jsonl']);
    });

    it('a later write in the same month prunes nothing', () => {
        writeFileSync(join(dir, '2026-11.jsonl'), '{"event":"first"}\n');
        appendLedgerLine(root, '2026-11-20T10:00:00.000Z', { event: 'y' });
        expect(existsSync(join(dir, '2025-12.jsonl'))).toBe(true);
    });
});
