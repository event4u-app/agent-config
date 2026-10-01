/**
 * Native code-graph engine (ADR-124, Class A) — Phase 2 acceptance tests.
 *
 * Covers the pre-registered checks: ABI smoke (grammars load + parse at the
 * pinned ABI), honest confidence taxonomy, byte-equal determinism
 * (golden-checksum), schema validation, and the structural no-network
 * guarantee. Integration tests load the real vendored WASM grammars.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as os from 'node:os';

import { GRAPH_TOOLS } from '../../src/scripts/mcp_server/graph_tools.js';
import type { BuiltinTool } from '../../src/scripts/mcp_server/tools.js';
import { buildFromRepo, buildGraph, serializeGraph, type SourceFile } from '../../src/scripts/code_graph/build.js';
import { pickSource, type SourceVerdict } from '../../src/scripts/code_graph/detect.js';
import { extractFile } from '../../src/scripts/code_graph/extract.js';
import { loadLanguage } from '../../src/scripts/code_graph/loader.js';
import {
    affected,
    loadGraph,
    node as graphNode,
    path as graphPath,
    query,
    resolveExactNode,
    resolveSeeds,
} from '../../src/scripts/code_graph/query.js';
import { sanitizeLabel } from '../../src/scripts/code_graph/sanitize.js';
import { EXPECTED_GRAMMAR_ABI, type Lang } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CODE_GRAPH_DIR = path.resolve(HERE, '..', '..', 'src', 'scripts', 'code_graph');

const PHP_BASE = `<?php
namespace App;
class Base { public function shared() { return 1; } }
`;
const PHP_FOO = `<?php
namespace App;
use App\\Base;
use Illuminate\\Support\\Facades\\Cache;
class Foo extends Base {
  use LoggerTrait;
  public function handle() {
    $this->shared();
    $this->missing();
    Cache::get('k');
    $bar = new Bar();
    $bar->run();
    strlen('x');
  }
}
class Bar { public function run() {} }
`;
const TS_BASE = `export class Base { shared() { return 1; } }\n`;
const TS_WIDGET = `import { Base } from './base';
export class Widget extends Base {
  render() { this.shared(); this.unknown(); helper(); new Widget(); }
}
function helper() {}
`;

async function buildFixture() {
    const files: SourceFile[] = [
        { path: 'app/Base.php', source: PHP_BASE },
        { path: 'app/Foo.php', source: PHP_FOO },
        { path: 'app/base.ts', source: TS_BASE },
        { path: 'app/widget.ts', source: TS_WIDGET },
    ];
    const langOf = (p: string): Lang => (p.endsWith('.php') ? 'php' : 'typescript');
    const extracts = [];
    for (const f of files) extracts.push(await extractFile(f.path, f.source, langOf(f.path)));
    return { files, graph: buildGraph(files, extracts) };
}

describe('ABI smoke — pinned grammars load + parse', () => {
    for (const lang of ['php', 'typescript', 'javascript'] as const) {
        it(`loads ${lang} at the pinned ABI ${EXPECTED_GRAMMAR_ABI}`, async () => {
            const L = await loadLanguage(lang);
            expect(L.version).toBe(EXPECTED_GRAMMAR_ABI);
        });
    }
    it('parses each launch language without a parse error', async () => {
        const php = await extractFile('a.php', '<?php class A { function m(){} }', 'php');
        const ts = await extractFile('a.ts', 'class A { m(){} }', 'typescript');
        const js = await extractFile('a.js', 'function m(){}', 'javascript');
        expect(php.parseError).toBe(false);
        expect(ts.parseError).toBe(false);
        expect(js.parseError).toBe(false);
    });
});

describe('honest confidence taxonomy', () => {
    it('classifies PHP call sites per the ADR-124 taxonomy', async () => {
        const { graph } = await buildFixture();
        const calls = graph.edges.filter((e) => e.relation === 'calls' && e.source === 'app/Foo.php#Foo::handle');
        const by = (target: string) => calls.find((e) => e.target === target || e.target.endsWith(target));

        // EXTRACTED — new X() resolved, direct free fn (external)
        expect(by('app/Foo.php#Bar')?.confidence).toBe('EXTRACTED');
        expect(by('symbol:strlen')?.confidence).toBe('EXTRACTED');
        // INFERRED — $this-> resolved up the in-repo hierarchy
        expect(by('app/Base.php#Base::shared')?.confidence).toBe('INFERRED');
        // AMBIGUOUS — facade (Cache::get), dynamic ($bar->run), unresolved $this->missing
        expect(by('symbol:get')?.confidence).toBe('AMBIGUOUS');
        expect(by('symbol:missing')?.confidence).toBe('AMBIGUOUS');
        const dyn = calls.find((e) => e.confidence === 'AMBIGUOUS' && (e.candidates ?? []).some((c) => c.endsWith('Bar::run')));
        expect(dyn).toBeTruthy();
    });

    it('resolves inherits + this-calls within the same language (no PHP↔TS bleed)', async () => {
        const { graph } = await buildFixture();
        const tsInherit = graph.edges.find((e) => e.relation === 'inherits' && e.source === 'app/widget.ts#Widget');
        expect(tsInherit?.target).toBe('app/base.ts#Base'); // NOT app/Base.php#Base
        const tsThis = graph.edges.find(
            (e) => e.relation === 'calls' && e.source === 'app/widget.ts#Widget::render' && e.confidence === 'INFERRED',
        );
        expect(tsThis?.target).toBe('app/base.ts#Base::shared');
    });

    it('reports a per-confidence edge count that sums to the edge total', async () => {
        const { graph } = await buildFixture();
        const c = graph.edge_confidence_counts;
        expect(c.EXTRACTED + c.INFERRED + c.AMBIGUOUS).toBe(graph.edges.length);
        expect(c.AMBIGUOUS).toBeGreaterThan(0); // dynamic dispatch is honestly ambiguous
    });
});

describe('determinism — identical source → identical graph bytes', () => {
    it('serializes byte-identically across two independent builds', async () => {
        const a = await buildFixture();
        const b = await buildFixture();
        expect(serializeGraph(a.graph)).toBe(serializeGraph(b.graph));
        expect(a.graph.source_checksum).toBe(b.graph.source_checksum);
    });
    it('changes the checksum when source changes', async () => {
        const a = await buildFixture();
        const ex = await extractFile('app/Base.php', PHP_BASE + '// touched\n', 'php');
        const b = buildGraph([{ path: 'app/Base.php', source: PHP_BASE + '// touched\n' }], [ex]);
        expect(b.source_checksum).not.toBe(a.graph.source_checksum);
    });
});

describe('schema validation', () => {
    it('accepts a well-formed graph', async () => {
        const { graph } = await buildFixture();
        expect(validateGraph(graph).ok).toBe(true);
    });
    it('rejects an edge with an unknown confidence', async () => {
        const r = validateGraph({
            schema_version: 1,
            source_checksum: 'x',
            nodes: [{ id: 'a', label: 'a', kind: 'file', source_file: 'a', source_location: [] }],
            edges: [{ source: 'a', target: 'b', relation: 'calls', confidence: 'MAYBE' }],
        });
        expect(r.ok).toBe(false);
        expect(r.errors.join(' ')).toMatch(/confidence invalid/);
    });
    it('rejects an edge whose source is not a known node', () => {
        const r = validateGraph({
            schema_version: 1,
            source_checksum: 'x',
            nodes: [],
            edges: [{ source: 'ghost', target: 'b', relation: 'calls', confidence: 'EXTRACTED' }],
        });
        expect(r.ok).toBe(false);
        expect(r.errors.join(' ')).toMatch(/not a known node/);
    });
});

describe('install-bundle guard', () => {
    it('src/scripts/install.ts never imports the code_graph module', () => {
        // The esbuild install bundle cannot inline Emscripten WASM loading;
        // code_graph must load its grammars from node_modules at runtime only.
        const installPath = path.resolve(HERE, '..', '..', 'src', 'scripts', 'install.ts');
        const body = fs.readFileSync(installPath, 'utf-8');
        expect(/code_graph/.test(body), 'install.ts must not reference code_graph/').toBe(false);
    });
});

describe('query tier (Phase 3)', () => {
    async function loadedFixture() {
        const { graph } = await buildFixture();
        const tmp = path.join(os.tmpdir(), `cg-fixture-${process.pid}-${graph.edges.length}.json`);
        fs.writeFileSync(tmp, serializeGraph(graph));
        return loadGraph(tmp, 'native:fixture');
    }

    it('query returns a seed’s direct relations with source attribution', async () => {
        const g = await loadedFixture();
        const r = query(g, 'app/Foo.php#Foo::handle', 2000);
        expect(r.source).toBe('native:fixture');
        expect(r.lines.some((l) => l.includes('--calls-->'))).toBe(true);
        expect(r.lines.some((l) => l.includes('INFERRED') && l.includes('Base::shared'))).toBe(true);
    });

    it('affected does reverse BFS (who references the target)', async () => {
        const g = await loadedFixture();
        const r = affected(g, 'app/Base.php#Base::shared', 2, 2000);
        // Foo::handle calls Base::shared (INFERRED) → must appear as a caller
        expect(r.lines.some((l) => l.includes('Foo::handle') && l.includes('Base::shared'))).toBe(true);
    });

    it('path finds a route between two connected nodes', async () => {
        const g = await loadedFixture();
        const r = graphPath(g, 'app/Foo.php#Foo', 'app/Foo.php#Foo::handle', 2000);
        expect(r.lines.length).toBeGreaterThan(0);
        expect(r.lines.join(' ')).not.toContain('no path found');
    });

    it('resolveSeeds falls back to BM25 on a partial label', async () => {
        const g = await loadedFixture();
        const ids = resolveSeeds(g, 'handle');
        expect(ids.some((id) => id.endsWith('Foo::handle'))).toBe(true);
    });

    it('respects the token budget (truncates)', async () => {
        const g = await loadedFixture();
        const tiny = query(g, 'app/Foo.php#Foo', 1); // 1 token → ~4 chars → truncates
        expect(tiny.truncated).toBe(true);
    });

    describe('D4 recommended_reads (Phase 9)', () => {
        it('names the dropped edges’ target files instead of silently truncating', async () => {
            const g = await loadedFixture();
            const tiny = query(g, 'app/Foo.php#Foo', 1); // 1 token → ~4 chars → every edge drops
            expect(tiny.truncated).toBe(true);
            expect(tiny.recommended_reads.length).toBeGreaterThan(0);
            // Foo inherits Base (app/Base.php) and declares handle() (app/Foo.php) —
            // both dropped edges' real targets must be named; the unresolved
            // `symbol:LoggerTrait` target has no node and is correctly excluded.
            expect(tiny.recommended_reads.some((r) => r.path === 'app/Base.php')).toBe(true);
            expect(tiny.recommended_reads.some((r) => r.path === 'app/Foo.php')).toBe(true);
            for (const r of tiny.recommended_reads) {
                if (r.lines) {
                    expect(r.lines[0]).toBeGreaterThan(0);
                    expect(r.lines[1]).toBeGreaterThanOrEqual(r.lines[0]);
                }
            }
        });

        it('a non-truncated query with an exact seed match carries no recommended_reads', async () => {
            const g = await loadedFixture();
            const r = query(g, 'app/Foo.php#Foo::handle', 2000); // exact id match, ample budget
            expect(r.truncated).toBe(false);
            expect(r.recommended_reads).toEqual([]);
        });

        it('flags a weak (BM25-fallback, non-exact) seed match even without truncation', async () => {
            const g = await loadedFixture();
            // "handle method" matches neither a node id nor a whole node label —
            // resolution falls through to the BM25 tier, which the D4 read-plan
            // treats as under-threshold and worth flagging on its own.
            const r = query(g, 'handle method', 2000);
            expect(r.truncated).toBe(false);
            expect(r.seeds.length).toBeGreaterThan(0);
            expect(r.recommended_reads.some((rr) => rr.path === 'app/Foo.php')).toBe(true);
        });
    });
});

describe('detect — source precedence (ADR-124 §2)', () => {
    const V = (kind: SourceVerdict['kind'], stale?: boolean): SourceVerdict => ({
        kind,
        path: `/${kind}.json`,
        present: true,
        ...(stale === undefined ? {} : { stale }),
    });
    it('fresh consumer index wins over native', () => {
        expect(pickSource([V('native'), V('consumer', false)])?.kind).toBe('consumer');
    });
    it('native covers a stale consumer index', () => {
        expect(pickSource([V('consumer', true), V('native')])?.kind).toBe('native');
    });
    it('falls back to a stale consumer when nothing else exists', () => {
        expect(pickSource([V('consumer', true)])?.kind).toBe('consumer');
    });
});

describe('sanitizer', () => {
    it('strips control, zero-width, and bidi-override chars', () => {
        const tab = String.fromCharCode(0x09);
        const zwsp = String.fromCharCode(0x200b);
        const rlo = String.fromCharCode(0x202e);
        const cleaned = sanitizeLabel(`a${tab}b${zwsp}c${rlo}d`);
        expect(cleaned).toBe('a b c d');
        expect(cleaned).not.toContain(zwsp);
        expect(cleaned).not.toContain(rlo);
    });
    it('caps overly long labels', () => {
        expect(sanitizeLabel('x'.repeat(500)).length).toBeLessThanOrEqual(160);
    });
});

describe('incremental --update (Phase 4)', () => {
    it('produces a byte-identical graph to a cold build and re-extracts only changed files', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-upd-'));
        fs.mkdirSync(path.join(dir, 'app'));
        fs.writeFileSync(path.join(dir, 'app', 'A.php'), '<?php\nnamespace X;\nclass A { function m(){ $this->m(); } }\n');
        fs.writeFileSync(path.join(dir, 'app', 'w.ts'), 'export class W { a(){ this.a(); } }\n');
        const cache = path.join(dir, 'g.json');

        const cold = await buildFromRepo(dir, cache, {});
        const upd = await buildFromRepo(dir, cache, { update: true });
        expect(serializeGraph(upd.graph)).toBe(serializeGraph(cold.graph)); // byte-identical
        expect(upd.reExtracted).toBe(0);
        expect(upd.reused).toBe(2);

        // change one file → exactly one re-extract, result equals a fresh cold build
        fs.writeFileSync(path.join(dir, 'app', 'A.php'), '<?php\nnamespace X;\nclass A { function m(){ $this->n(); } function n(){} }\n');
        const upd2 = await buildFromRepo(dir, cache, { update: true });
        expect(upd2.reExtracted).toBe(1);
        expect(upd2.reused).toBe(1);
        const cold2 = await buildFromRepo(dir, path.join(dir, 'g2.json'), {});
        expect(serializeGraph(upd2.graph)).toBe(serializeGraph(cold2.graph)); // update === cold
    });
});

describe('no-network guarantee (structural)', () => {
    it('no engine source imports a network module', () => {
        const forbidden = /require\(['"](node:)?(http|https|net|tls|dgram|dns)['"]\)|from ['"](node:)?(http|https|net|tls|dgram|dns)['"]|\bfetch\s*\(|undici|node-fetch|axios/;
        for (const f of fs.readdirSync(CODE_GRAPH_DIR).filter((n) => n.endsWith('.ts'))) {
            const body = fs.readFileSync(path.join(CODE_GRAPH_DIR, f), 'utf-8');
            expect(forbidden.test(body), `${f} must not touch the network`).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------
// road-to-a-graph-that-feeds-the-gate — step 2.4
// ---------------------------------------------------------------------------

/**
 * A consumer root that is a real repository, with its graph built AFTER the
 * commit so the index starts level with HEAD.
 *
 * Real git metadata is the point: step 2.3 reads `edited` out of the porcelain
 * status, so a tmpdir without a repository could only ever assert the fallback.
 */
async function committedConsumerRig(): Promise<string> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-edited-'));
    const run = (args: readonly string[]): void => {
        execFileSync('git', ['-C', dir, ...args], { stdio: ['ignore', 'ignore', 'ignore'] });
    };
    run(['init', '-q', '-b', 'main']);
    run(['config', 'user.email', 'fixture@example.com']);
    run(['config', 'user.name', 'fixture']);
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'service.ts'), 'export function handle(x: string): string {\n    return x.trim();\n}\n');
    run(['add', '-A']);
    run(['commit', '-q', '-m', 'fixture']);
    await buildFromRepo(dir, path.join(dir, 'agents/runtime/state/code-graph-v1.json'));
    return dir;
}

describe('2.4 — the MCP answers carry the new state', () => {
    it('reports staleness edited once an indexed file is changed in the working tree', async () => {
        // The CLI `query` verb has no `--json`, so the MCP envelope is where the
        // token is machine-readable at all. `graph_query` already prints
        // `staleness`; what 2.3 added is a fourth value it can carry, and this
        // is the fixture that the value actually reaches the wire.
        const root = await committedConsumerRig();
        const q = GRAPH_TOOLS['graph_query'];
        expect(q).toBeDefined();

        const before = await (q as BuiltinTool).handler({ symbol: 'src/service.ts#handle' }, root);
        expect(before['status']).toBe('ok');
        expect(before['staleness']).toBe('fresh');

        fs.writeFileSync(
            path.join(root, 'src', 'service.ts'),
            'export function handle(x: string): string {\n    return x.trimStart();\n}\n',
        );
        const after = await (q as BuiltinTool).handler({ symbol: 'src/service.ts#handle' }, root);
        expect(after['status']).toBe('ok');
        expect(after['staleness']).toBe('edited');

        fs.rmSync(root, { recursive: true, force: true });
    });
});

// ---------------------------------------------------------------------------
// road-to-a-graph-that-feeds-the-gate — step 3.1, the graph_node view
// ---------------------------------------------------------------------------

describe('3.1 — graph_node answers about one node, or refuses', () => {
    async function nodeFixture() {
        const { graph } = await buildFixture();
        const tmp = path.join(os.tmpdir(), `cg-node-${process.pid}-${graph.edges.length}.json`);
        fs.writeFileSync(tmp, serializeGraph(graph));
        return loadGraph(tmp, 'native:fixture');
    }

    it('reports location, in-edges, out-edges and degree for an exact id', async () => {
        const g = await nodeFixture();
        const r = graphNode(g, 'app/Base.php#Base::shared');
        expect(r.refusal).toBeUndefined();
        expect(r.id).toBe('app/Base.php#Base::shared');
        expect(r.location?.path).toBe('app/Base.php');
        // Foo::handle reaches it through $this-> up the hierarchy, so the
        // in-edge list is the "who calls this" answer that needed two calls
        // before.
        expect(r.in.some((e) => e.id === 'app/Foo.php#Foo::handle' && e.relation === 'calls')).toBe(true);
        expect(r.in_degree).toBe(r.in.filter((e) => e.hops === 1).length);
        expect(r.out_degree).toBe(r.out.filter((e) => e.hops === 1).length);
    });

    it('resolves an exact LABEL as well as an id', async () => {
        const g = await nodeFixture();
        const r = graphNode(g, 'render');
        expect(r.refusal).toBeUndefined();
        expect(r.id).toBe('app/widget.ts#Widget::render');
        expect(r.out.length).toBeGreaterThan(0);
    });

    it('refuses an AMBIGUOUS label and names the candidates instead of picking one', async () => {
        const g = await nodeFixture();
        // `shared` is a method on both the PHP and the TypeScript Base. Picking
        // the first would be the silent guess the refusal exists to avoid.
        const r = graphNode(g, 'shared');
        expect(r.refusal).toContain('re-ask with one id');
        expect(r.refusal).toContain('app/Base.php#Base::shared');
        expect(r.refusal).toContain('app/base.ts#Base::shared');
        expect(r.id).toBe('');
        // Exactly two, so the count is stated plainly and nothing is truncated.
        expect(r.refusal).toContain('is a label on 2 nodes');
        expect(r.refusal).not.toContain('truncated');
    });

    it('never states a candidate count it did not measure', async () => {
        // The measured defect: `resolveExactNode` inherited the seed ladder's
        // default limit of 5, so a label on twelve nodes refused with "is a
        // label on 5 nodes" and listed five with nothing marking the cut.
        const ids = Array.from({ length: 40 }, (_, i) => `app/m${String(i)}.ts#Dup`);
        const stub = {
            source: 'native:stub',
            byId: { get: () => undefined, has: () => false },
            idsByLabel: (_label: string, limit: number) => ids.slice(0, limit),
            lex: () => {
                throw new Error('BM25 must not be reached — the label resolved exactly');
            },
        } as unknown as Parameters<typeof resolveExactNode>[0];

        const r = resolveExactNode(stub, 'Dup');
        expect(r.id).toBeNull();
        expect(r.more).toBe(true);
        // Whatever it SHOWS, it must never claim that is the whole set.
        expect(r.ambiguous.length).toBeLessThanOrEqual(ids.length);
        const node = graphNode(stub, 'Dup');
        expect(node.refusal).toContain('more than');
        expect(node.refusal).toContain('(list truncated)');
    });

    it('REFUSES free text rather than scoring it — D4', async () => {
        const g = await nodeFixture();
        // `query` happily BM25-matches this; a node view must not, because every
        // field it returns is a statement about one specific node.
        expect(query(g, 'handle foo').seeds.length).toBeGreaterThan(0);
        const r = graphNode(g, 'handle foo');
        expect(r.refusal).toBeDefined();
        expect(r.refusal).toContain('does not score free text');
        expect(r.id).toBe('');
        expect(r.in).toStrictEqual([]);
        expect(r.out).toStrictEqual([]);
    });

    it('honours direction, depth and the relation filter', async () => {
        const g = await nodeFixture();
        const outOnly = graphNode(g, 'app/Foo.php#Foo::handle', { direction: 'out' });
        expect(outOnly.in).toStrictEqual([]);
        expect(outOnly.out.length).toBeGreaterThan(0);

        const inOnly = graphNode(g, 'app/Base.php#Base::shared', { direction: 'in' });
        expect(inOnly.out).toStrictEqual([]);
        expect(inOnly.in.length).toBeGreaterThan(0);

        const callsOnly = graphNode(g, 'app/Foo.php#Foo::handle', { direction: 'out', relation: 'calls' });
        expect(callsOnly.out.every((e) => e.relation === 'calls')).toBe(true);
        expect(callsOnly.out.length).toBeGreaterThan(0);

        // Depth is clamped to 1-3 rather than refused, and a deeper walk can
        // only ever add lines.
        const deep = graphNode(g, 'app/Foo.php#Foo::handle', { direction: 'out', depth: 99 });
        expect(deep.out.length).toBeGreaterThanOrEqual(outOnly.out.length);
        expect(deep.out.every((e) => e.hops >= 1 && e.hops <= 3)).toBe(true);
    });

    it('is registered as a read-only MCP tool whose relation enum IS the closed vocabulary', () => {
        const t = GRAPH_TOOLS['graph_node'];
        expect(t).toBeDefined();
        expect(t?.side_effect).toBe('ro');
        const props = (t as BuiltinTool).input_schema['properties'] as Record<string, { enum?: string[] }>;
        // Pinned against the union in types.ts, which erases at compile time —
        // an enum that silently lost a value would reject a legal filter.
        const declared = fs.readFileSync(path.join(CODE_GRAPH_DIR, 'types.ts'), 'utf-8');
        const union = /export type Relation = ([^;]+);/.exec(declared)?.[1] ?? '';
        const vocab = [...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1] as string).sort();
        expect([...(props['relation']?.enum ?? [])].sort()).toStrictEqual(vocab);
    });
});
