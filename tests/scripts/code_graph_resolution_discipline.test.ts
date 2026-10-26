/**
 * Resolution discipline — road-to-edges-that-earn-their-target, Phases 1 and 2.
 *
 * Each shape here was a false or arbitrary edge at `700c41137b`: a closure local
 * reached by name from another file, a repo-wide lookup that bound the first of
 * several same-named declarations. Every test fails on that build.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildGraph, readScipIndexes, type SourceFile } from '../../src/scripts/code_graph/build.js';
import { extractFile } from '../../src/scripts/code_graph/extract.js';
import type { CodeGraph, Lang } from '../../src/scripts/code_graph/types.js';
import { supersededByScip } from '../../src/scripts/code_graph/scip_reader.js';
import { toEdge } from '../../src/scripts/code_graph/sqlite_store.js';
import { isAcceptedEdge } from '../../src/scripts/code_graph/verbs.js';

const langOf = (p: string): Lang => (p.endsWith('.php') ? 'php' : 'typescript');

async function build(files: SourceFile[]): Promise<CodeGraph> {
    const extracts = [];
    for (const f of files) extracts.push(await extractFile(f.path, f.source, langOf(f.path)));
    return buildGraph(files, extracts);
}

const callsFrom = (g: CodeGraph, source: string) => g.edges.filter((e) => e.source === source && e.relation === 'calls');

describe('closure local (1.1)', () => {
    const FILES = [
        {
            path: 'a.ts',
            source: 'export function outer() {\n  const fn = () => 1;\n  function helper() { return 2; }\n  return fn() + helper();\n}\n',
        },
        { path: 'b.ts', source: 'export function caller() { return helper() + fn(); }\n' },
    ];

    it('emits no edge from another file onto a function declared inside a function body', async () => {
        const g = await build(FILES);
        const wrong = callsFrom(g, 'b.ts#caller').filter((e) => e.target.startsWith('a.ts#'));
        expect(wrong, JSON.stringify(wrong)).toEqual([]);
    });

    it('still resolves the closure local inside its own file', async () => {
        const g = await build(FILES);
        const targets = callsFrom(g, 'a.ts#outer').map((e) => [e.target, e.resolved_via]);
        expect(targets).toContainEqual(['a.ts#fn', 'same-file']);
        expect(targets).toContainEqual(['a.ts#helper', 'same-file']);
    });
});

describe('name collision (1.2)', () => {
    it('is ambiguous with both candidates when two files declare the name', async () => {
        const g = await build([
            { path: 'a.ts', source: 'export function run() { return 1; }\n' },
            { path: 'b.ts', source: 'export function run() { return 2; }\n' },
            { path: 'c.ts', source: 'export function go() { return run(); }\n' },
        ]);
        const [e] = callsFrom(g, 'c.ts#go');
        expect(e).toMatchObject({
            target: 'symbol:run',
            confidence: 'AMBIGUOUS',
            resolved_via: 'name-lookup',
            ambiguity_reason: 'name-collision',
            candidates: ['a.ts#run', 'b.ts#run'],
        });
    });

    it('keeps the collision reason on the indexed read path', () => {
        const e = toEdge({
            source: 'c.ts#go',
            target: 'symbol:run',
            relation: 'calls',
            confidence: 'AMBIGUOUS',
            candidates: JSON.stringify(['a.ts#run', 'b.ts#run']),
            ambiguity_reason: 'name-collision',
            resolved_via: 'name-lookup',
            provider: 'native',
            provider_id: null,
            fact: null,
        } as never);
        expect(e.ambiguity_reason).toBe('name-collision');
    });

    it('still binds a name exactly one file declares', async () => {
        const g = await build([
            { path: 'a.ts', source: 'export function solo() { return 1; }\n' },
            { path: 'c.ts', source: 'export function go() { return solo(); }\n' },
        ]);
        expect(callsFrom(g, 'c.ts#go')[0]).toMatchObject({ target: 'a.ts#solo', confidence: 'INFERRED' });
    });

    it('sets a test file aside for a production caller, so one candidate remains', async () => {
        const g = await build([
            { path: 'tests/a.test.ts', source: 'export function run() { return 2; }\n' },
            { path: 'src/a.ts', source: 'export function run() { return 1; }\n' },
            { path: 'src/c.ts', source: 'export function go() { return run(); }\n' },
        ]);
        expect(callsFrom(g, 'src/c.ts#go')[0]).toMatchObject({ target: 'src/a.ts#run', confidence: 'INFERRED' });
    });

    it('never binds a production caller to a test file by name, even when it is the only candidate', async () => {
        const g = await build([
            { path: 'tests/a.test.ts', source: 'export function only() { return 2; }\n' },
            { path: 'src/c.ts', source: 'export function go() { return only(); }\n' },
        ]);
        expect(callsFrom(g, 'src/c.ts#go')[0]?.target).toBe('symbol:only');
    });

    it('does not bind a PHP `use` by base name when two classes share it', async () => {
        const g = await build([
            { path: 'One/Mailer.php', source: '<?php\nnamespace One;\nclass Mailer { public function send() {} }\n' },
            { path: 'Two/Mailer.php', source: '<?php\nnamespace Two;\nclass Mailer { public function send() {} }\n' },
            { path: 'App.php', source: '<?php\nuse Two\\Mailer;\nclass App { public function go() { return new Mailer(); } }\n' },
        ]);
        const imp = g.edges.find((e) => e.source === 'App.php' && e.relation === 'imports');
        expect(imp?.target).not.toBe('One/Mailer.php#Mailer');
        const ctor = callsFrom(g, 'App.php#App::go')[0];
        expect(ctor).toMatchObject({ confidence: 'AMBIGUOUS', ambiguity_reason: 'name-collision' });
    });
});

describe('barrel and re-exports (1.3)', () => {
    const A = { path: 'src/a.ts', source: 'export function foo() { return 1; }\nexport function baz() { return 2; }\n' };

    it('binds a call through `export { foo } from` to the definition, stated', async () => {
        const g = await build([
            A,
            { path: 'src/index.ts', source: "export { foo } from './a.js';\n" },
            { path: 'src/use.ts', source: "import { foo } from './index.js';\nexport function go() { return foo(); }\n" },
        ]);
        expect(callsFrom(g, 'src/use.ts#go')[0]).toMatchObject({
            target: 'src/a.ts#foo',
            confidence: 'EXTRACTED',
            resolved_via: 'import-specifier',
        });
    });

    it('follows `export *`, a rename, and a two-hop chain', async () => {
        const g = await build([
            A,
            { path: 'src/mid.ts', source: "export * from './a.js';\n" },
            { path: 'src/index.ts', source: "export { baz as qux } from './mid.js';\nexport * from './mid.js';\n" },
            {
                path: 'src/use.ts',
                source: "import { foo, qux } from './index.js';\nexport function go() { return foo() + qux(); }\n",
            },
        ]);
        const targets = callsFrom(g, 'src/use.ts#go').map((e) => [e.target, e.resolved_via]);
        expect(targets).toContainEqual(['src/a.ts#foo', 'import-specifier']);
        expect(targets).toContainEqual(['src/a.ts#baz', 'import-specifier']);
    });

    it('terminates on a re-export cycle and binds nothing', async () => {
        const g = await build([
            { path: 'src/x.ts', source: "export * from './y.js';\n" },
            { path: 'src/y.ts', source: "export * from './x.js';\n" },
            { path: 'src/use.ts', source: "import { ghost } from './x.js';\nexport function go() { return ghost(); }\n" },
        ]);
        expect(callsFrom(g, 'src/use.ts#go').filter((e) => e.target.includes('#ghost'))).toEqual([]);
    });

    it('records a literal require() and import() as imports of the file', async () => {
        const g = await build([
            A,
            {
                path: 'src/use.js',
                source: "const a = require('./a.js');\nexport async function go() { const m = await import('./a.js'); return a.foo() + m.baz(); }\n",
            },
        ]);
        const imports = g.edges.filter((e) => e.source === 'src/use.js' && e.relation === 'imports').map((e) => e.target);
        expect(imports).toEqual(['src/a.ts']);
    });
});

describe('class hierarchy (1.4)', () => {
    it('states a this-call that walked to one owner, so a gate verb keeps it', async () => {
        const g = await build([
            { path: 'src/base.ts', source: 'export class Base { shared() { return 1; } }\n' },
            {
                path: 'src/widget.ts',
                source: "import { Base } from './base.js';\nexport class Widget extends Base { render() { return this.shared(); } }\n",
            },
        ]);
        const e = callsFrom(g, 'src/widget.ts#Widget::render').find((x) => x.target === 'src/base.ts#Base::shared');
        expect(e).toMatchObject({ resolved_via: 'class-hierarchy', confidence: 'INFERRED' });
        expect(isAcceptedEdge(e as never)).toBe(true);
    });

    it('is ambiguous when two parents at the same level declare the method', async () => {
        const g = await build([
            {
                path: 'src/C.php',
                source: '<?php\ninterface I { public function m(); }\nclass P { public function m() {} }\nclass C extends P implements I { public function go() { return $this->m(); } }\n',
            },
        ]);
        const e = callsFrom(g, 'src/C.php#C::go')[0];
        expect(e).toMatchObject({ confidence: 'AMBIGUOUS', ambiguity_reason: 'name-collision' });
        expect(e?.candidates).toEqual(['src/C.php#I::m', 'src/C.php#P::m']);
        expect(isAcceptedEdge(e as never)).toBe(false);
    });
});

describe('supersede by the compiler index (2.1)', () => {
    const node = (id: string, label: string) => ({ id, label, kind: 'function', source_file: id.split('#')[0] as string, source_location: [1, 0, 1, 0] });
    const nodes = [node('a.ts#run', 'run'), node('b.ts#run', 'run'), node('c.ts#other', 'other'), node('s.ts#go', 'go')];
    const edge = (source: string, target: string, resolved_via: string, confidence = 'INFERRED') =>
        ({ source, target, relation: 'calls', confidence, resolved_via, provider: 'native' }) as never;
    const scip = [{ source: 's.ts#go', target: 'a.ts#run', relation: 'uses', confidence: 'EXTRACTED', resolved_via: 'compiler-index', provider: 'scip' }] as never;
    const superseded = supersededByScip(scip, nodes as never);

    it('drops a native guess to a different same-named node — the index names the real one', () => {
        expect(superseded(edge('s.ts#go', 'b.ts#run', 'name-lookup'))).toBe(true);
        expect(superseded(edge('s.ts#go', 'symbol:run', 'name-lookup', 'AMBIGUOUS'))).toBe(true);
    });

    it('keeps a guess under another name, from another source, or by a stated mechanism', () => {
        expect(superseded(edge('s.ts#go', 'c.ts#other', 'name-lookup'))).toBe(false);
        expect(superseded(edge('c.ts#other', 'b.ts#run', 'name-lookup'))).toBe(false);
        expect(superseded(edge('s.ts#go', 'b.ts#run', 'import-specifier', 'EXTRACTED'))).toBe(false);
    });
});

describe('several scip indexes (2.2)', () => {
    // Minimal protobuf for the SCIP subset the reader consumes: Index.documents
    // (2) → Document.relative_path (1) + occurrences (2) → range (1), symbol (2).
    const varint = (n: number): number[] => {
        const out: number[] = [];
        let v = n;
        while (v > 0x7f) {
            out.push((v & 0x7f) | 0x80);
            v = Math.floor(v / 128);
        }
        out.push(v);
        return out;
    };
    const field = (num: number, wire: number, payload: number[]): number[] => [
        ...varint(num * 8 + wire),
        ...(wire === 2 ? varint(payload.length) : []),
        ...payload,
    ];
    const str = (t: string): number[] => [...Buffer.from(t, 'utf-8')];
    const index = (docPaths: string[]): Buffer => {
        const occ = [...field(1, 2, [0, 0, 5]), ...field(2, 2, str('sym x.'))];
        const bytes = [...field(1, 2, str('metadata'))];
        for (const p of docPaths) bytes.push(...field(2, 2, [...field(1, 2, str(p)), ...field(2, 2, occ)]));
        return Buffer.from(bytes);
    };

    it('reads one index per package, re-rooted, and drops a path that escapes the root', () => {
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-scips-')));
        try {
            fs.mkdirSync(path.join(root, 'packages', 'a'), { recursive: true });
            fs.writeFileSync(path.join(root, 'index.scip'), index(['src/root.ts', '../outside.ts']));
            fs.writeFileSync(path.join(root, 'packages', 'a', 'index.scip'), index(['src/x.ts']));
            expect(readScipIndexes(root).map((d) => d.path)).toEqual(['src/root.ts', 'packages/a/src/x.ts']);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
