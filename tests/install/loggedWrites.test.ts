// Tests for src/install/loggedWrites.ts — the install transaction log read back
// as proof that the bytes on disk are this installer's own, untouched output.
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { canonicalPath, loggedWriteDigests, onlyDeployed, wroteTheseBytes } from '../../src/install/loggedWrites.js';
import { decideDeployWrite, logProofApplies } from '../../src/install/preserve.js';

function hex(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

function line(kind: string, path: string, sha256: string | null): string {
    return JSON.stringify({ ts: '2026-10-12T10:00:00.000Z', kind, path, sha256 });
}

describe('loggedWrites — reading the transaction log', () => {
    let dir: string;
    let log: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'logged-writes-'));
        log = join(dir, 'install-log.jsonl');
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('collects write digests from the active, rotated and gzipped logs', () => {
        const a = join(dir, 'a.md');
        const b = join(dir, 'b.md');
        const c = join(dir, 'c.md');
        writeFileSync(log, `${line('write', a, hex('a-v2'))}\n`);
        writeFileSync(join(dir, 'install-log.2026-10-01T00-00-00-000Z.jsonl'), `${line('write', a, hex('a-v1'))}\n`);
        writeFileSync(
            join(dir, 'install-log.2026-09-01T00-00-00-000Z.jsonl.gz'),
            gzipSync(`${line('write', b, hex('b-v1'))}\n`),
        );
        writeFileSync(join(dir, 'unrelated.jsonl'), `${line('write', c, hex('c'))}\n`);

        const writes = loggedWriteDigests(log);
        expect([...(writes.get(canonicalPath(a)) ?? [])].sort()).toEqual([hex('a-v1'), hex('a-v2')].sort());
        expect([...(writes.get(canonicalPath(b)) ?? [])]).toEqual([hex('b-v1')]);
        expect(writes.has(canonicalPath(c))).toBe(false);
    });

    it('ignores skip entries, null digests, malformed lines and a truncated archive', () => {
        const a = join(dir, 'a.md');
        writeFileSync(
            log,
            [line('skip', a, null), line('write', a, null), '{"kind":"write", broken', ''].join('\n'),
        );
        writeFileSync(join(dir, 'install-log.2026-09-01T00-00-00-000Z.jsonl.gz'), Buffer.from([0x1f, 0x8b, 0x08]));
        expect(loggedWriteDigests(log).size).toBe(0);
    });

    it('re-reads when a log changes', () => {
        const a = join(dir, 'a.md');
        writeFileSync(log, `${line('write', a, hex('v1'))}\n`);
        expect(loggedWriteDigests(log).get(canonicalPath(a))?.has(hex('v2'))).toBe(false);
        writeFileSync(log, `${line('write', a, hex('v1'))}\n${line('write', a, hex('v2'))}\n`);
        expect(loggedWriteDigests(log).get(canonicalPath(a))?.has(hex('v2'))).toBe(true);
    });

    it('re-reads only the file that changed — a rotated archive is parsed once', () => {
        const a = join(dir, 'a.md');
        const rotated = join(dir, 'install-log.2026-10-01T00-00-00-000Z.jsonl');
        const pinned = new Date('2026-10-01T00:00:00.000Z');
        writeFileSync(rotated, `${line('write', a, hex('v1'))}\n`);
        utimesSync(rotated, pinned, pinned);
        expect(loggedWriteDigests(log).get(canonicalPath(a))?.has(hex('v1'))).toBe(true);
        // Same size and mtime, different bytes: a cached file is not re-read.
        writeFileSync(rotated, `${line('write', a, hex('v9'))}\n`);
        utimesSync(rotated, pinned, pinned);
        writeFileSync(log, `${line('write', a, hex('v2'))}\n`);
        const writes = loggedWriteDigests(log);
        expect(writes.get(canonicalPath(a))?.has(hex('v1'))).toBe(true);
        expect(writes.get(canonicalPath(a))?.has(hex('v9'))).toBe(false);
        expect(writes.get(canonicalPath(a))?.has(hex('v2'))).toBe(true);
    });

    it('matches a log key and a query spelled through different symlinked prefixes', () => {
        const real = join(dir, 'real');
        const link = join(dir, 'link');
        mkdirSync(real);
        symlinkSync(real, link);
        writeFileSync(log, `${line('write', join(link, 'a.md'), hex('ours'))}\n`);
        const writes = loggedWriteDigests(log);
        expect(wroteTheseBytes(join(realpathSync(real), 'a.md'), hex('ours'), writes)).toBe(true);
        expect(wroteTheseBytes(join(link, 'a.md'), hex('ours'), writes)).toBe(true);
    });

    it('onlyDeployed logs a path only when the copy deploys it', () => {
        const logged: string[] = [];
        const write = onlyDeployed(dir, new Set(['rules/ours.md']), (p) => logged.push(p));
        write(join(dir, 'rules', 'ours.md'));
        write(join(dir, 'rules', 'users-own.md'));
        expect(logged).toEqual([join(dir, 'rules', 'ours.md')]);
    });

    it('matches only the exact bytes at the exact path', () => {
        const a = join(dir, 'a.md');
        writeFileSync(log, `${line('write', a, hex('ours'))}\n`);
        const writes = loggedWriteDigests(log);
        expect(wroteTheseBytes(a, hex('ours'), writes)).toBe(true);
        expect(wroteTheseBytes(a, hex('edited'), writes)).toBe(false);
        expect(wroteTheseBytes(join(dir, 'b.md'), hex('ours'), writes)).toBe(false);
    });
});

describe('loggedWrites — the write decision', () => {
    const base = { exists: true, onDiskSha256: hex('installed-v1'), force: false } as const;

    it('writes a target recorded under its STAGED digest whose bytes we logged writing', () => {
        // The ledger shape a preserving run leaves behind.
        const recordedSha256 = hex('package-v2');
        const staged = { ...base, recordedSha256, recordedIsStaged: true };
        expect(decideDeployWrite(staged)).toBe('preserve');
        expect(decideDeployWrite({ ...staged, loggedWrite: true })).toBe('write');
    });

    it('still preserves a recorded-modified target whose recorded digest is bytes we wrote', () => {
        // A user restoring an older shipped version on purpose: the log matches,
        // the record says we wrote something else since — that is an edit.
        const recordedSha256 = hex('package-v2');
        expect(decideDeployWrite({ ...base, recordedSha256, loggedWrite: true })).toBe('preserve');
        expect(logProofApplies({ ...base, recordedSha256 })).toBe(false);
    });

    it('does not consult the log for an unknown file that is not ledger-listed', () => {
        expect(logProofApplies({ ...base, recordedSha256: undefined })).toBe(false);
        expect(logProofApplies({ ...base, recordedSha256: hex('installed-v1') })).toBe(false);
    });

    it('writes a digest-less ledger-listed target whose bytes we logged writing', () => {
        const migration = { ...base, recordedSha256: null, ledgerListed: true, packagedSha256: hex('package-v2') };
        expect(decideDeployWrite(migration)).toBe('preserve');
        expect(decideDeployWrite({ ...migration, loggedWrite: true })).toBe('write');
    });
});
