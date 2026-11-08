import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    checkpointDir,
    checkpointFile,
    EVENT_LOG_MAX_BYTES,
    MARKER_RETENTION_MS,
    eventsFile,
    observePostCompact,
    packageVersionFrom,
    readEventTally,
    readRegular,
    recordPreCompact,
    STALE_AFTER_MS,
} from '../../src/scripts/_lib/compact_checkpoint.js';
import { eolSessionKey, eolStateFile } from '../../src/scripts/_lib/session_eol.js';

let root: string;
const ENV = () => ({ EVENT4U_CONFIG_HOME: root });
const SID = 'session-aaaa';
const TRANSCRIPT = '/tmp/transcripts/session-aaaa.jsonl';

const base = (over: Partial<Parameters<typeof recordPreCompact>[0]> = {}) => ({
    env: { EVENT4U_CONFIG_HOME: root },
    sessionId: SID,
    transcriptPath: TRANSCRIPT,
    version: '20.1.0',
    now: new Date('2026-11-08T12:00:00Z'),
    ...over,
});

const markerFile = () => checkpointFile(eolSessionKey(SID), ENV());

const fifoAt = (p: string) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.rmSync(p, { force: true });
    execFileSync('mkfifo', [p]);
};

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('compact checkpoint — a marker at pre_compact, never injected', () => {
    it('writes a marker carrying only keys, version and time', () => {
        expect(recordPreCompact(base())).toBe('written');
        const m = JSON.parse(fs.readFileSync(markerFile(), 'utf8'));
        expect(Object.keys(m).sort()).toEqual(['package_version', 'schema_version', 'session_key', 'transcript_hash', 'written_at']);
        expect(m.session_key).toBe(eolSessionKey(SID));
        expect(m.transcript_hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('classifies the paired session_start(compact) as a match and consumes the marker', () => {
        recordPreCompact(base());
        expect(observePostCompact(base({ now: new Date('2026-11-08T12:01:00Z') }))).toBe('match');
        expect(fs.existsSync(markerFile())).toBe(false);
        expect(observePostCompact(base())).toBe('none');
    });

    it('names a key mismatch, a version mismatch and a stale marker', () => {
        recordPreCompact(base());
        expect(observePostCompact(base({ transcriptPath: '/tmp/other.jsonl' }))).toBe('key-mismatch');
        recordPreCompact(base());
        expect(observePostCompact(base({ version: '20.2.0' }))).toBe('version-mismatch');
        recordPreCompact(base());
        const late = new Date(Date.parse('2026-11-08T12:00:00Z') + STALE_AFTER_MS + 1);
        expect(observePostCompact(base({ now: late }))).toBe('stale');
    });

    it('counts an unclassified marker as orphaned when the next compaction writes', () => {
        recordPreCompact(base());
        recordPreCompact(base({ now: new Date('2026-11-08T12:30:00Z') }));
        expect(readEventTally(ENV())).toMatchObject({ written: 2, orphaned: 1 });
    });

    it('logs counts only — no session id or path in the event log', () => {
        recordPreCompact(base());
        observePostCompact(base());
        const log = fs.readFileSync(eventsFile(ENV()), 'utf8');
        expect(log).not.toContain(SID);
        expect(log).not.toContain(TRANSCRIPT);
        expect(readEventTally(ENV())).toMatchObject({ written: 1, match: 1 });
    });

    it('a marker with an unparseable timestamp is never a match; another session key is a key mismatch', () => {
        recordPreCompact(base());
        const m = JSON.parse(fs.readFileSync(markerFile(), 'utf8'));
        fs.writeFileSync(markerFile(), JSON.stringify({ ...m, written_at: 'not-a-date' }));
        expect(observePostCompact(base())).toBe('none');
        fs.writeFileSync(markerFile(), JSON.stringify({ ...m, session_key: 'f'.repeat(64) }));
        expect(observePostCompact(base())).toBe('key-mismatch');
    });

    it('opens nothing in the repository: roadmap, claim, counters and .git there may all be FIFOs', () => {
        fifoAt(eolStateFile(root, eolSessionKey(SID)));
        fifoAt(path.join(root, 'agents', 'roadmaps', 'road-to-x.md'));
        fifoAt(path.join(root, 'agents', 'runtime', 'state', 'roadmap-claim.json'));
        fifoAt(path.join(root, '.git'));
        expect(recordPreCompact(base())).toBe('written');
        expect(observePostCompact(base())).toBe('match');
    });
});

describe('compact checkpoint — filesystem boundary', () => {
    it('refuses a symlinked checkpoint directory', () => {
        const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-elsewhere-'));
        fs.mkdirSync(path.dirname(checkpointDir(ENV())), { recursive: true });
        fs.symlinkSync(elsewhere, checkpointDir(ENV()));
        expect(recordPreCompact(base())).toBe('skipped');
        expect(fs.readdirSync(elsewhere)).toEqual([]);
        fs.rmSync(elsewhere, { recursive: true, force: true });
    });

    it('refuses an ancestor symlink on write: nothing lands outside the repository', () => {
        const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-anc-'));
        fs.symlinkSync(elsewhere, path.join(root, 'state'));
        expect(recordPreCompact(base())).toBe('skipped');
        expect(fs.readdirSync(elsewhere)).toEqual([]);
        fs.rmSync(elsewhere, { recursive: true, force: true });
    });

    it('refuses an ancestor symlink on observation: an outside marker is neither read nor deleted', () => {
        recordPreCompact(base());
        const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-obs-'));
        const real = path.join(elsewhere, 'runtime-real');
        fs.renameSync(path.join(root, 'state'), real);
        fs.symlinkSync(real, path.join(root, 'state'));
        expect(observePostCompact(base())).toBe('none');
        expect(fs.existsSync(path.join(real, 'compact-checkpoint', `${eolSessionKey(SID)}.json`))).toBe(true);
        fs.rmSync(elsewhere, { recursive: true, force: true });
    });

    it('does not block on a FIFO at the marker path', () => {
        fifoAt(markerFile());
        expect(observePostCompact(base())).toBe('none');
    });

    it('keeps the event log under its byte bound, however many short lines it holds', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        const line = `${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', event: 'none' })}\n`;
        fs.writeFileSync(eventsFile(ENV()), line.repeat(Math.ceil(EVENT_LOG_MAX_BYTES / line.length) + 50));
        recordPreCompact(base());
        expect(fs.statSync(eventsFile(ENV())).size).toBeLessThanOrEqual(EVENT_LOG_MAX_BYTES);
        const lines = fs.readFileSync(eventsFile(ENV()), 'utf8').trim().split('\n');
        expect(JSON.parse(lines[lines.length - 1]!).event).toBe('written');
    });

    it('a trim never produces a file over the bound, even from long lines', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        const long = `${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', event: 'none', pad: 'p'.repeat(450) })}\n`;
        fs.writeFileSync(eventsFile(ENV()), long.repeat(Math.ceil(EVENT_LOG_MAX_BYTES / long.length) + 50));
        recordPreCompact(base());
        expect(fs.statSync(eventsFile(ENV())).size).toBeLessThanOrEqual(EVENT_LOG_MAX_BYTES);
    });

    it('counts UTF-8 bytes, not characters, against the bound', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        const wide = `${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', event: 'none', pad: '漢'.repeat(150) })}\n`;
        fs.writeFileSync(eventsFile(ENV()), wide.repeat(Math.ceil(EVENT_LOG_MAX_BYTES / Buffer.byteLength(wide)) + 20));
        recordPreCompact(base());
        expect(fs.statSync(eventsFile(ENV())).size).toBeLessThanOrEqual(EVENT_LOG_MAX_BYTES);
    });

    it('stores nothing under the repository it runs in', () => {
        const repo = path.join(root, 'repo');
        fs.mkdirSync(repo, { recursive: true });
        recordPreCompact(base());
        expect(fs.readdirSync(repo)).toEqual([]);
        expect(checkpointDir(ENV()).startsWith(root)).toBe(true);
    });

    it('does not block appending when the event log is a FIFO', () => {
        fifoAt(eventsFile(ENV()));
        expect(recordPreCompact(base())).toBe('written');
    });

    it('removes a malformed marker on observation instead of leaving it behind', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        fs.writeFileSync(markerFile(), '{not json');
        expect(observePostCompact(base())).toBe('none');
        expect(fs.existsSync(markerFile())).toBe(false);
    });

    it('replaces an oversized event log instead of loading it', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        fs.writeFileSync(eventsFile(ENV()), 'x'.repeat(EVENT_LOG_MAX_BYTES + 10));
        recordPreCompact(base());
        expect(fs.statSync(eventsFile(ENV())).size).toBeLessThan(EVENT_LOG_MAX_BYTES);
        expect(readEventTally(ENV()).written).toBe(1);
    });

    it('readRegular refuses a FIFO, a symlink and an oversized file', () => {
        const fifo = path.join(root, 'f');
        execFileSync('mkfifo', [fifo]);
        const big = path.join(root, 'big');
        fs.writeFileSync(big, 'x'.repeat(100));
        const link = path.join(root, 'l');
        fs.symlinkSync(big, link);
        expect(readRegular(fifo, 1000)).toBeNull();
        expect(readRegular(link, 1000)).toBeNull();
        expect(readRegular(big, 99)).toBeNull();
        expect(readRegular(big, 100)).toBe('x'.repeat(100));
    });

    it('packageVersionFrom does not block on a FIFO package.json', () => {
        const dir = path.join(root, 'pkg', 'dist', 'hooks');
        fs.mkdirSync(dir, { recursive: true });
        fifoAt(path.join(dir, 'package.json'));
        fs.writeFileSync(path.join(root, 'pkg', 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: '9.9.9' }));
        expect(packageVersionFrom(dir)).toBe('9.9.9');
    });
});

describe('compact checkpoint — council round 7 findings (retention)', () => {
    it('removes abandoned markers of other sessions once they are older than the retention bound', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        const old = path.join(checkpointDir(ENV()), `${'a'.repeat(64)}.json`);
        const fresh = path.join(checkpointDir(ENV()), `${'b'.repeat(64)}.json`);
        fs.writeFileSync(old, '{}');
        fs.writeFileSync(fresh, '{}');
        const past = new Date(Date.parse('2026-11-08T12:00:00Z') - MARKER_RETENTION_MS - 1000);
        fs.utimesSync(old, past, past);
        const now = new Date('2026-11-08T12:00:00Z');
        fs.utimesSync(fresh, now, now);
        recordPreCompact(base());
        expect(fs.existsSync(old)).toBe(false);
        expect(fs.existsSync(fresh)).toBe(true);
    });

    it('leaves files that are not markers alone', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        const other = path.join(checkpointDir(ENV()), 'notes.txt');
        fs.writeFileSync(other, 'x');
        const past = new Date(0);
        fs.utimesSync(other, past, past);
        recordPreCompact(base());
        expect(fs.existsSync(other)).toBe(true);
    });

    it('reads the version only from this package’s own manifest', () => {
        const dir = path.join(root, 'outer', 'inner');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(root, 'outer', 'inner', 'package.json'), JSON.stringify({ name: 'someone-else', version: '1.0.0' }));
        fs.writeFileSync(path.join(root, 'outer', 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: '20.1.0' }));
        expect(packageVersionFrom(dir)).toBe('20.1.0');
    });

    it('ignores log lines whose event is an object prototype key', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        fs.writeFileSync(eventsFile(ENV()), `${JSON.stringify({ event: 'toString' })}\n${JSON.stringify({ event: 'written' })}\n`);
        const tally = readEventTally(ENV());
        expect(tally.written).toBe(1);
        expect(Object.values(tally).every((v) => Number.isFinite(v))).toBe(true);
    });
});
