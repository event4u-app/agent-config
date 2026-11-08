import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { observePostCompact, readEventTally, recordPreCompact, STALE_AFTER_MS } from '../../src/scripts/_lib/compact_checkpoint.js';
import { eolSessionKey, eolStateFile } from '../../src/scripts/_lib/session_eol.js';

let root: string;
const SID = 'session-life';
const T0 = Date.parse('2026-11-08T12:00:00Z');
const at = (ms: number) => new Date(T0 + ms);

const input = (over: Record<string, unknown> = {}) => ({
    root,
    sessionId: SID,
    transcriptPath: '/tmp/t/session-life.jsonl',
    slug: 'road-to-x' as string | null,
    version: '20.1.0',
    now: at(0),
    ...over,
});

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-life-'));
    fs.mkdirSync(path.join(root, 'agents', 'roadmaps'), { recursive: true });
    fs.writeFileSync(path.join(root, 'agents', 'roadmaps', 'road-to-x.md'), '# x\n\n## Phase 1\n\n- [ ] **1.1** open\n');
    const sf = eolStateFile(root, eolSessionKey(SID));
    fs.mkdirSync(path.dirname(sf), { recursive: true });
    fs.writeFileSync(sf, JSON.stringify({ schema_version: 1, counters: { scanned_bytes: 1, assistant_records: 9, tool_calls: 9 } }));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('compact checkpoint lifecycle — can a stale checkpoint become eligible?', () => {
    it('aborted compaction, then a second one that writes: the orphan is replaced, the new one matches', () => {
        recordPreCompact(input());
        recordPreCompact(input({ now: at(30_000) }));
        expect(observePostCompact(input({ now: at(60_000) }))).toBe('match');
        expect(readEventTally(root)).toMatchObject({ written: 2, orphaned: 1, match: 1 });
    });

    it('aborted compaction, then a second whose write is skipped: the orphan is invalidated, nothing is eligible', () => {
        recordPreCompact(input());
        recordPreCompact(input({ slug: null, now: at(30_000) }));
        expect(observePostCompact(input({ now: at(60_000) }))).toBe('none');
        expect(readEventTally(root)).toMatchObject({ orphaned: 1, skipped: 1, none: 1 });
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
