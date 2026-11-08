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
    protectionFlags,
    readEventTally,
    readRegular,
    recordPreCompact,
    STALE_AFTER_MS,
    SWEEP_MAX,
    sweepAbandoned,
    consumeIfUnchanged,
    removeIfStillInvalid,
    WRITE_LIMIT,
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
        expect(Object.keys(m).sort()).toEqual(['generation', 'package_version', 'schema_version', 'session_key', 'transcript_hash', 'written_at']);
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
        fs.writeFileSync(eventsFile(ENV()), 'x'.repeat(EVENT_LOG_MAX_BYTES * 4 + 10));
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

describe('compact checkpoint — sweep: bounded work and cleanup progress', () => {
    it('inspects at most SWEEP_MAX entries and reports an incomplete sweep past it', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < SWEEP_MAX + 100; i++) fs.writeFileSync(path.join(dir, `${i.toString(16).padStart(64, '0')}.json`), '{}');
        const r = sweepAbandoned(dir, new Date());
        expect(r.inspected).toBeLessThanOrEqual(SWEEP_MAX);
        expect(r.complete).toBe(false);
    });

    it('writes no new marker while the directory holds more than the sweep can see, so it cannot grow past the budget', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < SWEEP_MAX + 10; i++) fs.writeFileSync(path.join(dir, `n${i}.txt`), 'x');
        expect(recordPreCompact(base())).toBe('skipped');
        expect(fs.existsSync(markerFile())).toBe(false);
    });

    it('reaches an expired marker behind a persistent prefix of other files', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < 250; i++) fs.writeFileSync(path.join(dir, `keep${i}.txt`), 'x');
        const old = path.join(dir, `${'c'.repeat(64)}.json`);
        fs.writeFileSync(old, '{}');
        const past = new Date(Date.parse('2026-11-08T12:00:00Z') - MARKER_RETENTION_MS - 1000);
        fs.utimesSync(old, past, past);
        for (let i = 0; i < 3; i++) recordPreCompact(base({ now: new Date(Date.parse('2026-11-08T12:00:00Z') + i) }));
        expect(fs.existsSync(old)).toBe(false);
    });
});

describe('compact checkpoint — council round 10 blockers', () => {
    it('refuses a write at the write limit, leaving headroom below what a sweep reads', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < WRITE_LIMIT; i++) fs.writeFileSync(path.join(dir, `n${i}.txt`), 'x');
        expect(recordPreCompact(base())).toBe('skipped');
        expect(fs.readdirSync(dir).length).toBeLessThan(SWEEP_MAX);
    });

    it('invalidates the predecessor even when the new write is refused', () => {
        recordPreCompact(base());
        const dir = checkpointDir(ENV());
        for (let i = 0; i < SWEEP_MAX + 5; i++) fs.writeFileSync(path.join(dir, `n${i}.txt`), 'x');
        expect(recordPreCompact(base({ now: new Date('2026-11-08T12:00:30Z') }))).toBe('skipped');
        expect(observePostCompact(base({ now: new Date('2026-11-08T12:01:00Z') }))).toBe('none');
    });

    it('removes abandoned temporary files once they are older than the retention bound', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        const tmp = path.join(dir, `.${'d'.repeat(64)}.json.abcdef012345.tmp`);
        fs.writeFileSync(tmp, 'x');
        const past = new Date(Date.parse('2026-11-08T12:00:00Z') - MARKER_RETENTION_MS - 1000);
        fs.utimesSync(tmp, past, past);
        recordPreCompact(base());
        expect(fs.existsSync(tmp)).toBe(false);
    });

    it('keeps the marker when the classification could not be logged', () => {
        recordPreCompact(base());
        fs.rmSync(eventsFile(ENV()), { force: true });
        fifoAt(eventsFile(ENV()));
        observePostCompact(base());
        expect(fs.existsSync(markerFile())).toBe(true);
    });
});

describe('compact checkpoint — round 11: headroom keeps every sweep complete', () => {
    it('the write limit leaves room below the sweep budget for the log and concurrent writers', () => {
        expect(WRITE_LIMIT).toBeLessThanOrEqual(SWEEP_MAX - 16);
    });

    it('a sweep reaches the end after writes stopped at the limit and a few concurrent ones landed', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < WRITE_LIMIT + 10; i++) fs.writeFileSync(path.join(dir, `n${i}.txt`), 'x');
        expect(sweepAbandoned(dir, new Date()).complete).toBe(true);
    });
});

describe('compact checkpoint — round 12: progress after an overshoot', () => {
    it('drains a directory pushed past the sweep budget, so a later sweep is complete again', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        const past = new Date(Date.parse('2026-11-08T12:00:00Z') - MARKER_RETENTION_MS - 1000);
        for (let i = 0; i < SWEEP_MAX + 88; i++) {
            const p = path.join(dir, `${(i + 1).toString(16).padStart(64, '0')}.json`);
            fs.writeFileSync(p, '{}');
            fs.utimesSync(p, past, past);
        }
        const outcomes: string[] = [];
        for (let i = 0; i < 4; i++) outcomes.push(recordPreCompact(base({ now: new Date(Date.parse('2026-11-08T12:00:00Z') + i) })));
        expect(outcomes[0]).toBe('skipped');
        expect(outcomes).toContain('written');
        expect(sweepAbandoned(dir, new Date('2026-11-08T12:00:10Z')).complete).toBe(true);
    });
});

describe('compact checkpoint — round 13 follow-ups', () => {
    it('does not consume a marker replaced between reading and removal', () => {
        recordPreCompact(base());
        const first = JSON.parse(fs.readFileSync(markerFile(), 'utf8'));
        recordPreCompact(base({ now: new Date('2026-11-08T12:00:05Z') }));
        expect(consumeIfUnchanged(markerFile(), first.generation)).toBe(false);
        expect(fs.existsSync(markerFile())).toBe(true);
        const second = JSON.parse(fs.readFileSync(markerFile(), 'utf8'));
        expect(consumeIfUnchanged(markerFile(), second.generation)).toBe(true);
        expect(fs.existsSync(markerFile())).toBe(false);
    });

    it('an unknown version on both sides compares equal: match means the available keys agree', () => {
        recordPreCompact(base({ version: null }));
        expect(observePostCompact(base({ version: null }))).toBe('match');
        recordPreCompact(base({ version: null }));
        expect(observePostCompact(base({ version: '20.1.0' }))).toBe('version-mismatch');
    });
});

describe('compact checkpoint — round 14: generation-aware consumption', () => {
    it('two markers written at the same instant are told apart', () => {
        recordPreCompact(base());
        const first = JSON.parse(fs.readFileSync(markerFile(), 'utf8'));
        recordPreCompact(base());
        const second = JSON.parse(fs.readFileSync(markerFile(), 'utf8'));
        expect(second.written_at).toBe(first.written_at);
        expect(second.generation).not.toBe(first.generation);
        expect(consumeIfUnchanged(markerFile(), first.generation)).toBe(false);
        expect(fs.existsSync(markerFile())).toBe(true);
    });

    it('an invalid-marker cleanup leaves a valid marker that appeared in the meantime', () => {
        recordPreCompact(base());
        expect(removeIfStillInvalid(markerFile())).toBe(false);
        expect(fs.existsSync(markerFile())).toBe(true);
        fs.writeFileSync(markerFile(), '{not json');
        expect(removeIfStillInvalid(markerFile())).toBe(true);
        expect(fs.existsSync(markerFile())).toBe(false);
    });
});

describe('compact checkpoint — round 18: missing protection flags skip, never degrade', () => {
    it('protectionFlags is null when the platform lacks O_NOFOLLOW or O_NONBLOCK', () => {
        const { O_NOFOLLOW, O_NONBLOCK, ...rest } = fs.constants;
        expect(protectionFlags({ ...rest, O_NONBLOCK } as typeof fs.constants)).toBeNull();
        expect(protectionFlags({ ...rest, O_NOFOLLOW } as typeof fs.constants)).toBeNull();
        expect(protectionFlags(fs.constants)).toEqual({ O_NOFOLLOW, O_NONBLOCK });
    });

    it('readRegular refuses to read when a protection flag is missing', () => {
        const file = path.join(root, 'plain');
        fs.writeFileSync(file, 'x');
        const { O_NOFOLLOW: _drop, ...rest } = fs.constants;
        expect(readRegular(file, 10, rest as typeof fs.constants)).toBeNull();
        expect(readRegular(file, 10)).toBe('x');
    });
});

describe('compact checkpoint — round 19: no mutation at all without protection flags', () => {
    const lacking = () => {
        const { O_NOFOLLOW: _drop, ...rest } = fs.constants;
        return rest as typeof fs.constants;
    };

    it('writes nothing at pre_compact when a flag is missing', () => {
        expect(recordPreCompact(base({ constants: lacking() }))).toBe('skipped');
        expect(fs.existsSync(checkpointDir(ENV()))).toBe(false);
    });

    it('neither trims an oversized log nor consumes the marker when a flag is missing', () => {
        recordPreCompact(base());
        const big = `${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', event: 'none' })}\n`.repeat(Math.ceil(EVENT_LOG_MAX_BYTES / 50));
        fs.writeFileSync(eventsFile(ENV()), big);
        expect(observePostCompact(base({ constants: lacking() }))).toBe('none');
        expect(fs.readFileSync(eventsFile(ENV()), 'utf8')).toBe(big);
        expect(fs.existsSync(markerFile())).toBe(true);
    });
});

describe('compact checkpoint — round 20: the runtime root is trusted as given', () => {
    it('writes under a symlinked runtime root, because the root is the user’s own', () => {
        const real = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-realroot-'));
        const link = path.join(root, 'linked-root');
        fs.symlinkSync(real, link);
        expect(recordPreCompact(base({ env: { EVENT4U_CONFIG_HOME: link } }))).toBe('written');
        expect(fs.existsSync(path.join(real, 'state', 'compact-checkpoint'))).toBe(true);
        fs.rmSync(real, { recursive: true, force: true });
    });
});
