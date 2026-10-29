/**
 * `ask` usage / affected answer with the callers of a symbol, not its own
 * definition, and `--fetch` returns a location and a snippet.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type Scope, ask, fetchById } from '../../../src/scripts/code_graph/ask.js';
import { graphSources } from '../../../src/scripts/code_graph/cli_ask.js';
import { type LoadedGraph, loadGraph } from '../../../src/scripts/code_graph/query.js';
import type { CodeEdge, CodeGraph, CodeNode } from '../../../src/scripts/code_graph/types.js';

const n = (id: string, at: [number, number] = [1, 3]): CodeNode => {
    const file = id.split('#')[0] as string;
    const sym = id.includes('#');
    return { id, label: sym ? (id.split('#')[1] as string) : path.basename(id), kind: sym ? 'function' : 'file', source_file: file, source_location: sym ? [at[0], 1, at[1], 1] : [] } as CodeNode;
};
const e = (source: string, target: string): CodeEdge => ({ source, target, relation: 'calls', confidence: 'EXTRACTED', resolved_via: 'import-specifier', provider: 'native' }) as CodeEdge;

const graph = {
    schema_version: 7,
    source_checksum: 'fixture',
    languages: ['typescript'],
    grammar_abi: 14,
    edge_confidence_counts: { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 },
    suppressed_edge_counts: { dynamic_no_candidate: 0 },
    nodes: [n('src/cart.ts'), n('src/cart.ts#sumLines'), n('src/checkout.ts'), n('src/checkout.ts#pay', [2, 4]), n('src/report.ts'), n('src/report.ts#monthly')],
    edges: [e('src/checkout.ts#pay', 'src/cart.ts#sumLines'), e('src/report.ts#monthly', 'src/cart.ts#sumLines')],
} as unknown as CodeGraph;

const scope: Scope = { repoId: 'r', branch: 'main', worktree: '/w', user: 'u' };
let dir: string;
let g: LoadedGraph;
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-callers-'));
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src/checkout.ts'), 'import { sumLines } from "./cart.js";\nexport function pay() {\n    return sumLines();\n}\n');
    fs.writeFileSync(path.join(dir, 'g.json'), JSON.stringify(graph));
    g = loadGraph(path.join(dir, 'g.json'), 'fixture');
});
afterEach(() => {
    g.close();
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('ask usage and affected answer with callers', () => {
    it('who uses sumLines lists its two callers, not its definition', () => {
        const r = ask('who uses src/cart.ts#sumLines', graphSources(g, 'r', dir), scope);
        expect(r.intent).toBe('usage');
        expect(r.envelope.answer.map((a) => a.id).sort()).toEqual(['src/checkout.ts#pay', 'src/report.ts#monthly']);
    });

    it('what breaks if I change sumLines lists the dependents', () => {
        const r = ask('what breaks if I change src/cart.ts#sumLines', graphSources(g, 'r', dir), scope);
        expect(r.intent).toBe('affected');
        expect(r.envelope.answer.map((a) => a.id).sort()).toEqual(['src/checkout.ts#pay', 'src/report.ts#monthly']);
    });

    it('--fetch returns the location and a snippet, not the title', () => {
        const f = fetchById('src/checkout.ts#pay', graphSources(g, 'r', dir), scope);
        expect(f.ok).toBe(true);
        const body = f.ok ? f.body : '';
        expect(body).toMatch(/^src\/checkout\.ts:2-4/);
        expect(body).toContain('return sumLines();');
    });
});
