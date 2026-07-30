// Scope de-duplication of the rule projection (C-3, road-to-cache-economy).
//
// The safety argument is BYTE-IDENTITY, so that is what these tests pin. A
// filename-keyed dedup would silently let a stale globally-installed copy win
// whenever the two scopes hold different releases — the normal state while
// developing the package (measured: 110/110 shared filenames differing in
// bytes). Every case below therefore checks the *content* predicate, not the
// name.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { dedupableCount } from '../../src/scripts/measure_scope_dedup.js';

const tmps: string[] = [];

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-dedup-test-'));
    tmps.push(d);
    return d;
}

afterEach(() => {
    while (tmps.length) {
        fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
    }
});

function writeRules(dir: string, files: Record<string, string>): string {
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), body, 'utf-8');
    }
    return dir;
}

describe('scope dedup — byte-identity gate', () => {
    it('skips a twin only when the bytes match', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), {
            'a.md': 'alpha body\n',
            'b.md': 'beta body\n',
        });
        const user = writeRules(path.join(root, 'user'), {
            'a.md': 'alpha body\n', // identical -> de-duplicable
            'b.md': 'beta body CHANGED\n', // same name, different bytes -> must NOT dedupe
        });

        const result = dedupableCount(user, source);
        expect(result.skipped).toBe(1);
        // The removed byte count must be the identical file's own size, derived
        // from the fixture rather than hardcoded.
        expect(result.chars).toBe(Buffer.byteLength('alpha body\n'));
    });

    it('never dedupes when the user scope holds a different release (the drift case)', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), {
            'a.md': 'v2 body\n',
            'b.md': 'v2 body\n',
        });
        const user = writeRules(path.join(root, 'user'), {
            'a.md': 'v1 body\n',
            'b.md': 'v1 body\n',
        });

        const result = dedupableCount(user, source);
        expect(result.skipped).toBe(0);
        expect(result.chars).toBe(0);
    });

    it('ignores a rule the user scope does not carry at all', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), { 'a.md': 'x\n', 'b.md': 'y\n' });
        const user = writeRules(path.join(root, 'user'), { 'a.md': 'x\n' });

        expect(dedupableCount(user, source).skipped).toBe(1);
    });

    it('is inert when there is no user-scope directory', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), { 'a.md': 'x\n' });

        const result = dedupableCount(path.join(root, 'absent'), source);
        expect(result.skipped).toBe(0);
        expect(result.chars).toBe(0);
    });

    it('counts every identical twin when both scopes carry the same release', () => {
        const root = tmpdir();
        const bodies = { 'a.md': 'one\n', 'b.md': 'two\n', 'c.md': 'three\n' };
        const source = writeRules(path.join(root, 'source'), bodies);
        const user = writeRules(path.join(root, 'user'), bodies);

        const result = dedupableCount(user, source);
        expect(result.skipped).toBe(Object.keys(bodies).length);
        expect(result.chars).toBe(
            Object.values(bodies).reduce((sum, b) => sum + Buffer.byteLength(b), 0),
        );
    });
});
