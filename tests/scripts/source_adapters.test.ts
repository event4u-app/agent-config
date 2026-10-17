import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SourceError, resolveSource } from '../../src/scripts/source_adapters.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'source-adapters-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const MIT = 'MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy';

interface Entry {
    name: string;
    body?: string;
    type?: '0' | '2' | '5';
    link?: string;
}

function octal(n: number, width: number): string {
    return `${n.toString(8).padStart(width - 1, '0')}\0`;
}

/** A minimal ustar writer, so a fixture can carry entries no real tool would write. */
function tar(entries: Entry[]): Buffer {
    const blocks: Buffer[] = [];
    for (const e of entries) {
        const body = Buffer.from(e.body ?? '');
        const h = Buffer.alloc(512);
        h.write(e.name, 0, 100);
        h.write(octal(0o644, 8), 100);
        h.write(octal(0, 8), 108);
        h.write(octal(0, 8), 116);
        h.write(octal(body.length, 12), 124);
        h.write(octal(0, 12), 136);
        h.write('        ', 148);
        h.write(e.type ?? '0', 156);
        if (e.link !== undefined) h.write(e.link, 157, 100);
        h.write('ustar\0', 257);
        h.write('00', 263);
        let sum = 0;
        for (const b of h) sum += b;
        h.write(octal(sum, 7), 148);
        blocks.push(h, body, Buffer.alloc((512 - (body.length % 512)) % 512));
    }
    blocks.push(Buffer.alloc(1024));
    return Buffer.concat(blocks);
}

function write(rel: string, body: string | Buffer): string {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
    return abs;
}

describe('local source adapters', () => {
    it('pins a local path read in place, with a digest per file and its license', () => {
        write('ref/LICENSE', MIT);
        write('ref/src/a.ts', 'export const a = 1;\n');
        const ref = resolveSource(path.join(root, 'ref'));
        expect(ref.kind).toBe('local-path');
        expect(ref.license).toBe('MIT');
        expect(ref.tier).toBe('read');
        expect(Object.keys(ref.files).sort()).toEqual(['LICENSE', 'src/a.ts']);
        expect(ref.files['src/a.ts']).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(ref.pin).toBe(ref.digest);
        expect(resolveSource(path.join(root, 'ref')).digest).toBe(ref.digest);
        write('ref/src/a.ts', 'export const a = 2;\n');
        expect(resolveSource(path.join(root, 'ref')).digest).not.toBe(ref.digest);
    });

    it('pins an existing local clone to its HEAD sha without running git', () => {
        const sha = 'a'.repeat(40);
        write('clone/.git/HEAD', 'ref: refs/heads/main\n');
        write('clone/.git/refs/heads/main', `${sha}\n`);
        write('clone/README.md', '# x\n');
        const ref = resolveSource(path.join(root, 'clone'));
        expect(ref.kind).toBe('local-clone');
        expect(ref.pin).toBe(sha);
        expect(Object.keys(ref.files)).toEqual(['README.md']);
    });

    it('reads a packed ref when the loose ref is absent', () => {
        const sha = 'b'.repeat(40);
        write('clone/.git/HEAD', 'ref: refs/heads/main\n');
        write('clone/.git/packed-refs', `# pack-refs with: peeled\n${sha} refs/heads/main\n`);
        expect(resolveSource(path.join(root, 'clone')).pin).toBe(sha);
    });

    it('pins a tar and a gzipped tar archive by content', () => {
        const entries: Entry[] = [
            { name: 'pkg/LICENSE', body: MIT },
            { name: 'pkg/src/a.ts', body: 'export const a = 1;\n' },
        ];
        const plain = resolveSource(write('a.tar', tar(entries)));
        const gz = resolveSource(write('a.tgz', gzipSync(tar(entries))));
        expect(plain.kind).toBe('archive');
        expect(plain.license).toBe('MIT');
        expect(Object.keys(plain.files).sort()).toEqual(['pkg/LICENSE', 'pkg/src/a.ts']);
        expect(gz.digest).toBe(plain.digest);
    });

    it('refuses an archive with a ../ entry, an absolute entry or a symlink out', () => {
        expect(() => resolveSource(write('b.tar', tar([{ name: 'pkg/../../etc/passwd', body: 'x' }])))).toThrow(/\.\.\//);
        expect(() => resolveSource(write('c.tar', tar([{ name: '/etc/passwd', body: 'x' }])))).toThrow(/absolute/);
        expect(() => resolveSource(write('d.tar', tar([{ name: 'pkg/l', type: '2', link: '../../outside' }])))).toThrow(/symlink/);
    });

    it('refuses an archive above the size cap', () => {
        const file = write('e.tar', tar([{ name: 'pkg/big', body: 'x'.repeat(4096) }]));
        expect(() => resolveSource(file, { maxArchiveBytes: 1024 })).toThrow(SourceError);
    });

    it('fails a URL argument with a diagnostic naming the fetch blocker', () => {
        for (const url of ['https://example.org/repo', 'git@example.org:o/r.git']) {
            expect(() => resolveSource(url)).toThrow(/source-fetch-authorization/);
        }
    });

    it('fails an unsupported local kind with the same diagnostic', () => {
        expect(() => resolveSource(write('f.zip', 'PK\u0003\u0004'))).toThrow(/source-fetch-authorization/);
    });
});
