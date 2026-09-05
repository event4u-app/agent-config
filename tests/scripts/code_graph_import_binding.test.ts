/**
 * Import bindings — the false edge, pinned.
 *
 * `road-to-the-graph-that-lies-confidently` Phase 1. Before this repair the
 * build pass resolved an import name through a repo-wide `byName` table with
 * no scope and no module specifier, so
 *
 *     import * as path from 'node:path';
 *
 * bound to this repository's own `path()` function in `query.ts` — an edge that
 * is false, and that carried `EXTRACTED`, the label the code-intelligence skill
 * tells a reader to treat as syntactic fact. It was present in 4 of the 11
 * files of the engine's own source.
 *
 * Every test here fails if the specifier is discarded again.
 */
import { describe, expect, it } from 'vitest';

import { buildGraph, type SourceFile } from '../../src/scripts/code_graph/build.js';
import { extractFile } from '../../src/scripts/code_graph/extract.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import type { Lang } from '../../src/scripts/code_graph/types.js';

const langOf = (p: string): Lang => (p.endsWith('.php') ? 'php' : 'typescript');

async function build(files: SourceFile[]): Promise<CodeGraph> {
    const extracts = [];
    for (const f of files) extracts.push(await extractFile(f.path, f.source, langOf(f.path)));
    return buildGraph(files, extracts);
}

/** The exact collision measured on this engine's own source. */
const COLLIDING = [
    { path: 'query.ts', source: 'export function path(a: string, b: string) { return a + b; }\n' },
    {
        path: 'build.ts',
        source: "import * as path from 'node:path';\nexport function go() { return path.resolve('x'); }\n",
    },
];

describe('a namespace import never binds to a local symbol of the same name', () => {
    it('does not emit build.ts -imports-> query.ts#path', async () => {
        const g = await build(COLLIDING);
        const wrong = g.edges.filter((e) => e.target === 'query.ts#path' && e.source === 'build.ts');
        expect(wrong, JSON.stringify(wrong)).toEqual([]);
    });

    it('resolves the namespace import to the external module it names', async () => {
        const g = await build(COLLIDING);
        const imp = g.edges.find((e) => e.source === 'build.ts' && e.relation === 'imports');
        expect(imp?.target).toBe('external:node:path');
        // Still a syntactic fact: the module string is literally in the source.
        expect(imp?.confidence).toBe('EXTRACTED');
    });

    it('does not resolve path.resolve() onto the local function either', async () => {
        // `path.resolve(...)` is a dynamic member call. Its receiver is a module
        // binding, so there is nothing in this repository to point at.
        const g = await build(COLLIDING);
        expect(g.edges.filter((e) => e.target.includes('query.ts#path') && e.relation === 'calls')).toEqual([]);
    });
});

describe('a named import binds to the symbol it names, through its alias', () => {
    const FILES = [
        { path: 'query.ts', source: 'export function path(a: string) { return a; }\n' },
        {
            path: 'cli.ts',
            source: "import { path as graphPath } from './query.js';\nexport function run() { return graphPath('x'); }\n",
        },
    ];

    it('targets the REMOTE name in the resolved file', async () => {
        const g = await build(FILES);
        const imp = g.edges.find((e) => e.source === 'cli.ts' && e.relation === 'imports');
        expect(imp?.target).toBe('query.ts#path');
        expect(imp?.confidence).toBe('EXTRACTED');
    });

    it('resolves a call through the LOCAL alias to the same target', async () => {
        const g = await build(FILES);
        const call = g.edges.find((e) => e.source === 'cli.ts#run' && e.relation === 'calls');
        expect(call?.target).toBe('query.ts#path');
        expect(call?.confidence).toBe('EXTRACTED');
    });

    it("maps a './x.js' specifier onto the x.ts file that actually exists", async () => {
        // TS source imports the emitted `.js` name; the file in the graph is
        // `.ts`. Without the extension substitution every relative import in a
        // NodeNext codebase resolves to nothing.
        const g = await build(FILES);
        expect(g.edges.some((e) => e.target === 'query.ts#path')).toBe(true);
    });
});

describe('a repo-wide name match is INFERRED, never EXTRACTED', () => {
    it('labels a PHP `use` resolved by base name as INFERRED', async () => {
        // `use App\\Base` names a fully-qualified symbol; the engine matches its
        // base name without checking the namespace, so the binding is a lookup.
        const g = await build([
            { path: 'app/Base.php', source: '<?php\nnamespace App;\nclass Base { public function shared() {} }\n' },
            {
                path: 'app/Foo.php',
                source: '<?php\nnamespace App;\nuse App\\Base;\nclass Foo extends Base { public function h() {} }\n',
            },
        ]);
        const imp = g.edges.find((e) => e.source === 'app/Foo.php' && e.relation === 'imports');
        expect(imp?.target).toBe('app/Base.php#Base');
        expect(imp?.confidence).toBe('INFERRED');
        // The inherits edge rides the same binding and inherits its honesty.
        const inh = g.edges.find((e) => e.relation === 'inherits' && e.source === 'app/Foo.php#Foo');
        expect(inh?.target).toBe('app/Base.php#Base');
        expect(inh?.confidence).toBe('INFERRED');
        expect(g.edge_confidence_counts.INFERRED).toBeGreaterThan(0);
    });

    it('a local declaration shadows an import of the same name', async () => {
        const g = await build([
            { path: 'other.ts', source: 'export function helper() { return 1; }\n' },
            {
                path: 'main.ts',
                source:
                    "import { helper } from './other.js';\nfunction helper2() { return helper(); }\nexport function helper() { return 2; }\n",
            },
        ]);
        const call = g.edges.find((e) => e.source === 'main.ts#helper2' && e.relation === 'calls');
        expect(call?.target).toBe('main.ts#helper');
    });
});

describe('capability filtering — a kind is a claim about what a name can BE', () => {
    it('a constant never satisfies a bare call by name', async () => {
        const g = await build([
            { path: 'a.ts', source: 'export const answer = 42;\n' },
            { path: 'b.ts', source: 'export function go() { return answer(); }\n' },
        ]);
        // The declaring file's own `member` edge is untouched; what must not
        // exist is a CALL resolved onto a value that cannot be called.
        expect(g.edges.some((e) => e.relation === 'calls' && e.target === 'a.ts#answer')).toBe(false);
        const call = g.edges.find((e) => e.source === 'b.ts#go' && e.relation === 'calls');
        expect(call?.target).toBe('symbol:answer');
    });

    it('a type alias never satisfies `new`', async () => {
        const g = await build([
            { path: 'a.ts', source: 'export type Widget = { a: number };\n' },
            { path: 'b.ts', source: 'export function go() { return new Widget(); }\n' },
        ]);
        const call = g.edges.find((e) => e.source === 'b.ts#go' && e.relation === 'calls');
        expect(call?.target).toBe('symbol:Widget');
    });
});

describe('zero-candidate dynamic dispatch is dropped, and the drop is published', () => {
    it('emits no edge for x.push() and counts it', async () => {
        const g = await build([
            { path: 'a.ts', source: 'export function go(xs: number[]) { xs.push(1); xs.push(2); }\n' },
        ]);
        expect(g.edges.some((e) => e.target === 'symbol:push')).toBe(false);
        expect(g.suppressed_edge_counts.dynamic_no_candidate).toBe(1); // deduped, two call sites
    });

    it('keeps a dynamic call that HAS an in-repo candidate', async () => {
        const g = await build([
            { path: 'a.ts', source: 'export class C { push(x: number) { return x; } }\n' },
            { path: 'b.ts', source: 'export function go(o: unknown) { (o as C).push(1); }\n' },
        ]);
        const kept = g.edges.find((e) => e.relation === 'calls' && e.confidence === 'AMBIGUOUS');
        expect(kept).toBeTruthy();
        expect(kept?.candidates).toContain('a.ts#C::push');
        expect(g.suppressed_edge_counts.dynamic_no_candidate).toBe(0);
    });

    it('keeps a scoped call and an unresolved this-call — those name a known receiver', async () => {
        const g = await build([
            {
                path: 'app/Foo.php',
                source:
                    '<?php\nnamespace App;\nclass Foo extends Outside {\n  public function h() { $this->missing(); Cache::get(1); }\n}\n',
            },
        ]);
        expect(g.edges.some((e) => e.target === 'symbol:missing' && e.confidence === 'AMBIGUOUS')).toBe(true);
        expect(g.edges.some((e) => e.target === 'symbol:get' && e.confidence === 'AMBIGUOUS')).toBe(true);
    });
});
