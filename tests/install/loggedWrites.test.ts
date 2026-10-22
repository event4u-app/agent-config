// Tests for src/install/loggedWrites.ts — the install transaction log read back
// as proof that the bytes on disk are this installer's own, untouched output.
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loggedWriteDigests, wroteTheseBytes } from '../../src/install/loggedWrites.js';
import { decideDeployWrite } from '../../src/install/preserve.js';

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
        expect([...(writes.get(a) ?? [])].sort()).toEqual([hex('a-v1'), hex('a-v2')].sort());
        expect([...(writes.get(b) ?? [])]).toEqual([hex('b-v1')]);
        expect(writes.has(c)).toBe(false);
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
        expect(loggedWriteDigests(log).get(a)?.has(hex('v2'))).toBe(false);
        writeFileSync(log, `${line('write', a, hex('v1'))}\n${line('write', a, hex('v2'))}\n`);
        expect(loggedWriteDigests(log).get(a)?.has(hex('v2'))).toBe(true);
    });

    it('matches only the exact bytes at the exact path', () => {
        const a = join(dir, 'a.md');
        const writes = new Map([[a, new Set([hex('ours')])]]);
        expect(wroteTheseBytes(a, hex('ours'), writes)).toBe(true);
        expect(wroteTheseBytes(a, hex('edited'), writes)).toBe(false);
        expect(wroteTheseBytes(join(dir, 'b.md'), hex('ours'), writes)).toBe(false);
    });
});

describe('loggedWrites — the write decision', () => {
    const base = { exists: true, onDiskSha256: hex('installed-v1'), force: false } as const;

    it('writes a recorded-modified target whose bytes we logged writing', () => {
        // The ledger shape a preserving run leaves behind: the STAGED digest.
        const recordedSha256 = hex('package-v2');
        expect(decideDeployWrite({ ...base, recordedSha256 })).toBe('preserve');
        expect(decideDeployWrite({ ...base, recordedSha256, loggedWrite: true })).toBe('write');
    });

    it('writes a digest-less ledger-listed target whose bytes we logged writing', () => {
        const migration = { ...base, recordedSha256: null, ledgerListed: true, packagedSha256: hex('package-v2') };
        expect(decideDeployWrite(migration)).toBe('preserve');
        expect(decideDeployWrite({ ...migration, loggedWrite: true })).toBe('write');
    });
});
