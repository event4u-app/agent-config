// loadChunkExport: the shared require-from-chunk seam of the hook chunk loaders.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { loadChunkExport } from '../../src/scripts/hooks/svg_rules_loader';

const dirs: string[] = [];
const chunk = (body: string | null): { self: string; spec: string } => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-export-'));
    dirs.push(dir);
    const spec = path.join(dir, 'x.chunk.cjs');
    if (body !== null) fs.writeFileSync(spec, body);
    return { self: pathToFileURL(path.join(dir, 'dispatch.js')).href, spec };
};

afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('loadChunkExport', () => {
    it('returns the named function from a present chunk', () => {
        const { self, spec } = chunk('exports.scan = (x) => x + 1;');
        const fn = loadChunkExport<(n: number) => number>(self, spec, 'scan', true);
        expect(fn?.(1)).toBe(2);
    });

    it('returns null for an absent chunk, a throwing chunk, or a missing export', () => {
        const absent = chunk(null);
        expect(loadChunkExport(absent.self, absent.spec, 'scan', true)).toBeNull();
        const throwing = chunk('throw new Error("boom");');
        expect(loadChunkExport(throwing.self, throwing.spec, 'scan', true)).toBeNull();
        const other = chunk('exports.other = () => 1;');
        expect(loadChunkExport(other.self, other.spec, 'scan', true)).toBeNull();
    });
});
