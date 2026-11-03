import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CAPS, NotAZipError, precheckFile, readCentralDirectory } from '../../src/scripts/archive_precheck.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

interface Spec {
    name: string;
    body?: string;
    mode?: number;
    /** Declared sizes, to model a bomb without writing one. */
    declared?: { compressed: number; size: number };
}

/** Build a STORE-method ZIP in memory: local headers, central directory, EOCD. */
function zip(specs: readonly Spec[]): Buffer {
    const locals: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    for (const s of specs) {
        const name = Buffer.from(s.name, 'utf8');
        const data = Buffer.from(s.body ?? '', 'utf8');
        const comp = s.declared?.compressed ?? data.length;
        const size = s.declared?.size ?? data.length;
        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0);
        lh.writeUInt16LE(20, 4);
        lh.writeUInt32LE(comp, 18);
        lh.writeUInt32LE(size, 22);
        lh.writeUInt16LE(name.length, 26);
        locals.push(lh, name, data);
        const ch = Buffer.alloc(46);
        ch.writeUInt32LE(0x02014b50, 0);
        ch.writeUInt16LE((3 << 8) | 20, 4);
        ch.writeUInt16LE(20, 6);
        ch.writeUInt32LE(comp, 20);
        ch.writeUInt32LE(size, 24);
        ch.writeUInt16LE(name.length, 28);
        ch.writeUInt32LE(((s.mode ?? 0o100644) << 16) >>> 0, 38);
        ch.writeUInt32LE(offset, 42);
        central.push(ch, name);
        offset += 30 + name.length + data.length;
    }
    const cd = Buffer.concat(central);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(specs.length, 8);
    eocd.writeUInt16LE(specs.length, 10);
    eocd.writeUInt32LE(cd.length, 12);
    eocd.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cd, eocd]);
}

let dir: string;
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-precheck-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const write = (name: string, specs: readonly Spec[]): string => {
    const f = path.join(dir, name);
    fs.writeFileSync(f, zip(specs));
    return f;
};

const CLEAN: Spec[] = [
    { name: 'my-skill/', mode: 0o040755 },
    { name: 'my-skill/SKILL.md', body: '---\nname: my-skill\n---\n# my skill\n' },
    { name: 'my-skill/references/notes.md', body: 'notes\n' },
];

describe('archive_precheck', () => {
    it('accepts a clean skill bundle and reads every entry without extracting', () => {
        const r = precheckFile(write('clean.zip', CLEAN));
        expect(r.refusals).toEqual([]);
        expect(r.entries.map((e) => e.name)).toEqual(CLEAN.map((s) => s.name));
        expect(fs.readdirSync(dir)).toEqual(['clean.zip']);
    });

    it.each([
        ['path traversal', { name: '../../.bashrc', body: 'x' }, /path traversal/],
        ['nested traversal', { name: 'my-skill/../../etc/x', body: 'x' }, /path traversal/],
        ['absolute path', { name: '/etc/passwd', body: 'x' }, /absolute path/],
        ['drive letter', { name: 'C:/Windows/x', body: 'x' }, /absolute path/],
        ['symlink', { name: 'my-skill/link', body: '/etc', mode: 0o120777 }, /symlink entry/],
        ['nested archive', { name: 'my-skill/inner.zip', body: 'PK' }, /nested archive/],
        ['ratio bomb', { name: 'my-skill/big.txt', declared: { compressed: 1000, size: 50 * 1024 * 1024 } }, /compression ratio/],
    ] as const)('refuses %s', (_label, bad, msg) => {
        const r = precheckFile(write('bad.zip', [...CLEAN, bad]));
        expect(r.refusals.join('\n')).toMatch(msg);
    });

    it('refuses a total size over the cap', () => {
        const many: Spec[] = Array.from({ length: 3 }, (_, i) => ({
            name: `my-skill/part${i}.bin`,
            declared: { compressed: 40 * 1024 * 1024, size: 40 * 1024 * 1024 },
        }));
        expect(precheckFile(write('big.zip', many)).refusals.join('\n')).toContain(`${CAPS.maxTotalBytes}-byte cap`);
    });

    it('names executables without refusing them', () => {
        const r = precheckFile(
            write('exec.zip', [...CLEAN, { name: 'my-skill/scripts/run.sh', body: '#!/bin/sh\n', mode: 0o100755 }, { name: 'my-skill/tool', body: 'x', mode: 0o100755 }]),
        );
        expect(r.refusals).toEqual([]);
        expect(r.executables).toEqual(['my-skill/scripts/run.sh', 'my-skill/tool']);
    });

    it('a directory entry with x bits is not an executable', () => {
        expect(precheckFile(write('d.zip', CLEAN)).executables).toEqual([]);
    });

    it('a file that is not a ZIP is an error, not an acceptance', () => {
        expect(() => readCentralDirectory(Buffer.from('not a zip at all, just text padding here'))).toThrow(NotAZipError);
    });

    it('CLI: exit 0 clean, 1 refused, 2 usage', () => {
        const run = (...args: string[]) =>
            spawnSync(path.join(REPO_ROOT, 'scripts-run'), ['src/scripts/archive_precheck', ...args], { encoding: 'utf-8' });
        expect(run(write('ok.zip', CLEAN)).status).toBe(0);
        const bad = run(write('no.zip', [...CLEAN, { name: '../x', body: 'x' }]));
        expect(bad.status).toBe(1);
        expect(bad.stdout).toContain('REFUSED');
        expect(run().status).toBe(2);
    });
});
