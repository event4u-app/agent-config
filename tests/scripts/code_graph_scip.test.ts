import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { readScipIndex } from '../../src/scripts/code_graph/scip_reader.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

/** Minimal protobuf writer for the SCIP subset the reader consumes. */
function varint(n: number): number[] {
    const out: number[] = [];
    let v = n;
    while (v > 0x7f) {
        out.push((v & 0x7f) | 0x80);
        v = Math.floor(v / 128);
    }
    out.push(v);
    return out;
}
function field(num: number, wire: number, payload: number[]): number[] {
    return [...varint(num * 8 + wire), ...(wire === 2 ? varint(payload.length) : []), ...payload];
}
const str = (s: string): number[] => [...Buffer.from(s, 'utf-8')];
function occurrence(line: number, symbol: string, definition: boolean): number[] {
    const range = [...varint(line), ...varint(0), ...varint(5)];
    return [
        ...field(1, 2, range),
        ...field(2, 2, str(symbol)),
        ...(definition ? field(3, 0, varint(1)) : []),
        // An unknown field the reader must skip by wire type.
        ...field(9, 0, varint(7)),
    ];
}
function scipIndex(docs: Array<{ path: string; occ: number[][] }>): Buffer {
    const bytes: number[] = [...field(1, 2, str('metadata'))];
    for (const d of docs) {
        const doc = [...field(1, 2, str(d.path)), ...d.occ.flatMap((o) => field(2, 2, o))];
        bytes.push(...field(2, 2, doc));
    }
    return Buffer.from(bytes);
}

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function repo(): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-scip-')));
    dirs.push(root);
    fs.mkdirSync(path.join(root, 'src'));
    // `obj.save()` on an untyped receiver: the native extractor can only guess
    // which `save` this is, and there are two.
    fs.writeFileSync(path.join(root, 'src', 'store.ts'), 'export class Store {\n    save(): void {}\n}\n');
    fs.writeFileSync(path.join(root, 'src', 'cache.ts'), 'export class Cache {\n    save(): void {}\n}\n');
    fs.writeFileSync(
        path.join(root, 'src', 'app.ts'),
        'export function run(obj: any): void {\n    obj.save();\n}\n',
    );
    return root;
}

describe('the SCIP reader (6.2)', () => {
    it('decodes documents and occurrences and skips fields it does not read', () => {
        const docs = readScipIndex(
            scipIndex([{ path: 'src/store.ts', occ: [occurrence(1, 'scip-typescript npm x 1.0 src/`store.ts`/Store#save().', true)] }]),
        );
        expect(docs).toEqual([
            { path: 'src/store.ts', occurrences: [{ line: 1, symbol: 'scip-typescript npm x 1.0 src/`store.ts`/Store#save().', definition: true }] },
        ]);
    });

    it('rejects a truncated buffer rather than reading garbage', () => {
        const ok = scipIndex([{ path: 'a.ts', occ: [] }]);
        expect(() => readScipIndex(ok.subarray(0, ok.length - 1))).toThrow(/truncated/);
    });

    it('turns a compiler-stated reference into an edge that outranks the native guess', async () => {
        const root = repo();
        const sym = 'scip-typescript npm x 1.0 src/`store.ts`/Store#save().';
        fs.writeFileSync(
            path.join(root, 'index.scip'),
            scipIndex([
                { path: 'src/store.ts', occ: [occurrence(1, sym, true)] },
                { path: 'src/app.ts', occ: [occurrence(1, sym, false), occurrence(0, 'local 3', false)] },
            ]),
        );
        const { graph } = await buildFromRepo(root, null);
        const fromRun = graph.edges.filter((e) => e.source === 'src/app.ts#run');
        expect(fromRun).toContainEqual(
            expect.objectContaining({ target: 'src/store.ts#Store::save', provider: 'scip', resolved_via: 'compiler-index' }),
        );
        // The dynamic guess `obj.save()` the native pass made is superseded.
        expect(fromRun.filter((e) => e.resolved_via === 'dynamic')).toEqual([]);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });

    it('changes the graph checksum when the index changes', async () => {
        const root = repo();
        const before = (await buildFromRepo(root, null)).graph.source_checksum;
        fs.writeFileSync(path.join(root, 'index.scip'), scipIndex([{ path: 'src/app.ts', occ: [] }]));
        expect((await buildFromRepo(root, null)).graph.source_checksum).not.toBe(before);
    });
});
