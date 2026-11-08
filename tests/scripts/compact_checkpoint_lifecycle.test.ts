import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    observePostCompact,
    readEventTally,
    recordPreCompact,
    STALE_AFTER_MS,
} from '../../src/scripts/_lib/compact_checkpoint.js';

let root: string;
const T0 = Date.parse('2026-11-08T12:00:00Z');
const at = (ms: number) => new Date(T0 + ms);

const input = (over: Record<string, unknown> = {}) => ({
    root,
    sessionId: 'session-life',
    transcriptPath: '/tmp/t/session-life.jsonl',
    version: '20.1.0',
    now: at(0),
    ...over,
});

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-life-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('compact checkpoint lifecycle — can a stale marker become eligible?', () => {
    it('aborted compaction, then a second one that writes: the orphan is replaced, the new one matches', () => {
        recordPreCompact(input());
        recordPreCompact(input({ now: at(30_000) }));
        expect(observePostCompact(input({ now: at(60_000) }))).toBe('match');
        expect(readEventTally(root)).toMatchObject({ written: 2, orphaned: 1, match: 1 });
    });

    it('residual: if pre_compact never ran for the second compaction, the orphan is classified — stale once old enough', () => {
        recordPreCompact(input());
        expect(observePostCompact(input({ now: at(STALE_AFTER_MS + 1) }))).toBe('stale');
    });

    it('duplicate session_start(compact): only the first classifies, the second sees nothing', () => {
        recordPreCompact(input());
        expect(observePostCompact(input({ now: at(10_000) }))).toBe('match');
        expect(observePostCompact(input({ now: at(11_000) }))).toBe('none');
    });

    it('manual and automatic compactions take the same path — the trigger is not a key', () => {
        recordPreCompact(input());
        expect(observePostCompact(input({ now: at(5_000) }))).toBe('match');
        recordPreCompact(input({ now: at(100_000) }));
        expect(observePostCompact(input({ now: at(105_000) }))).toBe('match');
    });

    it('package upgraded between write and read: version mismatch, never a match', () => {
        recordPreCompact(input());
        expect(observePostCompact(input({ version: '20.2.0', now: at(5_000) }))).toBe('version-mismatch');
    });
});
