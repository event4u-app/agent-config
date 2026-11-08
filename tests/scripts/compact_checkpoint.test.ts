import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    checkpointDir,
    checkpointFile,
    EVENT_LOG_MAX_LINES,
    eventsFile,
    observePostCompact,
    readEventTally,
    recordPreCompact,
    STALE_AFTER_MS,
} from '../../src/scripts/_lib/compact_checkpoint.js';
import { eolSessionKey, eolStateFile } from '../../src/scripts/_lib/session_eol.js';

let root: string;
const SID = 'session-aaaa';
const TRANSCRIPT = '/tmp/transcripts/session-aaaa.jsonl';
const SLUG = 'road-to-x';

function seed(opts: { substantive?: boolean } = {}): void {
    const { substantive = true } = opts;
    fs.mkdirSync(path.join(root, 'agents', 'roadmaps'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'agents', 'roadmaps', `${SLUG}.md`),
        '# Road to x\n\n## Phase 1\n\n- [x] **1.1** done\n- [ ] **1.2** open\n',
    );
    const stateFile = eolStateFile(root, eolSessionKey(SID));
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const counters = substantive
        ? { scanned_bytes: 1, assistant_records: 40, tool_calls: 200, final_context_tokens: 400000 }
        : { scanned_bytes: 1, assistant_records: 0, tool_calls: 0, final_context_tokens: 0 };
    fs.writeFileSync(stateFile, JSON.stringify({ schema_version: 1, counters }));
}

const base = (over: Partial<Parameters<typeof recordPreCompact>[0]> = {}) => ({
    root,
    sessionId: SID,
    transcriptPath: TRANSCRIPT,
    slug: SLUG,
    version: '20.1.0',
    now: new Date('2026-11-08T12:00:00Z'),
    ...over,
});

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('compact checkpoint — write at pre_compact, never inject', () => {
    it('writes a checkpoint carrying the continuity record and the two keys', () => {
        seed();
        expect(recordPreCompact(base())).toBe('written');
        const cp = JSON.parse(fs.readFileSync(checkpointFile(root, eolSessionKey(SID)), 'utf8'));
        expect(cp.session_key).toBe(eolSessionKey(SID));
        expect(cp.transcript_hash).toMatch(/^[0-9a-f]{16}$/);
        expect(cp.package_version).toBe('20.1.0');
        expect(cp.continuity.variant).toBe('continuity_record');
        expect(cp.continuity.remaining.length).toBe(1);
    });

    it('skips without a claimed roadmap and without a substantive session', () => {
        seed();
        expect(recordPreCompact(base({ slug: null }))).toBe('skipped');
        seed({ substantive: false });
        expect(recordPreCompact(base())).toBe('skipped');
        expect(fs.existsSync(checkpointFile(root, eolSessionKey(SID)))).toBe(false);
    });

    it('classifies the paired session_start(compact) as a match and consumes it', () => {
        seed();
        recordPreCompact(base());
        const later = new Date('2026-11-08T12:01:00Z');
        expect(observePostCompact(base({ now: later }))).toBe('match');
        expect(fs.existsSync(checkpointFile(root, eolSessionKey(SID)))).toBe(false);
        expect(observePostCompact(base({ now: later }))).toBe('none');
    });

    it('names a key mismatch, a version mismatch and a stale checkpoint', () => {
        seed();
        recordPreCompact(base());
        expect(observePostCompact(base({ transcriptPath: '/tmp/other.jsonl' }))).toBe('key-mismatch');
        recordPreCompact(base());
        expect(observePostCompact(base({ version: '20.2.0' }))).toBe('version-mismatch');
        recordPreCompact(base());
        const late = new Date(Date.parse('2026-11-08T12:00:00Z') + STALE_AFTER_MS + 1);
        expect(observePostCompact(base({ now: late }))).toBe('stale');
    });

    it('counts an unobserved checkpoint as orphaned when the next compaction writes', () => {
        seed();
        recordPreCompact(base());
        recordPreCompact(base({ now: new Date('2026-11-08T12:30:00Z') }));
        expect(readEventTally(root)).toMatchObject({ written: 2, orphaned: 1 });
    });

    it('returns no task state to the caller on any path', () => {
        seed();
        recordPreCompact(base());
        const out = observePostCompact(base());
        expect(typeof out).toBe('string');
        expect(out).not.toContain(SLUG);
    });

    it('logs counts only — no session id, path or slug in the event log', () => {
        seed();
        recordPreCompact(base());
        observePostCompact(base());
        const log = fs.readFileSync(eventsFile(root), 'utf8');
        expect(log).not.toContain(SID);
        expect(log).not.toContain(TRANSCRIPT);
        expect(log).not.toContain(SLUG);
        expect(readEventTally(root)).toMatchObject({ written: 1, match: 1 });
    });
});

describe('compact checkpoint — council round 1 findings', () => {
    it('a checkpoint with an unparseable timestamp is never a match', () => {
        seed();
        recordPreCompact(base());
        const file = checkpointFile(root, eolSessionKey(SID));
        const cp = JSON.parse(fs.readFileSync(file, 'utf8'));
        fs.writeFileSync(file, JSON.stringify({ ...cp, written_at: 'not-a-date' }));
        expect(observePostCompact(base())).toBe('none');
    });

    it('a checkpoint carrying another session key is a key mismatch', () => {
        seed();
        recordPreCompact(base());
        const file = checkpointFile(root, eolSessionKey(SID));
        const cp = JSON.parse(fs.readFileSync(file, 'utf8'));
        fs.writeFileSync(file, JSON.stringify({ ...cp, session_key: 'f'.repeat(64) }));
        expect(observePostCompact(base())).toBe('key-mismatch');
    });

    it('an observed checkpoint is removed, so files do not accumulate', () => {
        seed();
        recordPreCompact(base());
        observePostCompact(base());
        expect(fs.existsSync(checkpointFile(root, eolSessionKey(SID)))).toBe(false);
    });

    it('refuses to write through a symlinked checkpoint directory', () => {
        seed();
        const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-elsewhere-'));
        fs.mkdirSync(path.dirname(checkpointDir(root)), { recursive: true });
        fs.symlinkSync(elsewhere, checkpointDir(root));
        expect(recordPreCompact(base())).toBe('skipped');
        expect(fs.readdirSync(elsewhere)).toEqual([]);
        fs.rmSync(elsewhere, { recursive: true, force: true });
    });

    it('keeps the event log bounded', () => {
        seed();
        fs.mkdirSync(checkpointDir(root), { recursive: true });
        const line = `${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', event: 'none' })}\n`;
        fs.writeFileSync(eventsFile(root), line.repeat(EVENT_LOG_MAX_LINES + 50));
        recordPreCompact(base());
        const lines = fs.readFileSync(eventsFile(root), 'utf8').trim().split('\n');
        expect(lines.length).toBeLessThanOrEqual(EVENT_LOG_MAX_LINES);
        expect(JSON.parse(lines[lines.length - 1]!).event).toBe('written');
    });
});
